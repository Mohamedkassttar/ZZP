import { supabase } from './supabase';
import type { Database } from './database.types';
import { getCurrentCompanyId } from './companyHelper';

type Account = Database['public']['Tables']['accounts']['Row'];

export interface InvoiceLine {
  description: string;
  amount: number;
  vatRate: number;
}

export interface CreateInvoiceInput {
  contactId: string;
  lines: InvoiceLine[];
  invoiceDate?: string;
  dueDate?: string;
}

export interface CreateInvoiceResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
}

async function generateNextInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();

  const { data: existingInvoices } = await supabase
    .from('sales_invoices')
    .select('invoice_number')
    .ilike('invoice_number', `INV-${currentYear}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1);

  let nextNumber = 1;

  if (existingInvoices && existingInvoices.length > 0) {
    const lastInvoiceNumber = existingInvoices[0].invoice_number;
    if (lastInvoiceNumber) {
      const match = lastInvoiceNumber.match(/INV-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
  }

  return `INV-${currentYear}-${nextNumber.toString().padStart(4, '0')}`;
}

async function getSystemAccounts(): Promise<{
  debtorAccount: Account;
  revenueAccount: Account;
  vatPayableAccount: Account;
} | null> {
  const [debtorRes, revenueRes, vatPayableRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .eq('type', 'Asset')
      .ilike('name', '%debiteur%')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('accounts')
      .select('*')
      .eq('type', 'Revenue')
      .eq('is_active', true)
      .order('code')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('accounts')
      .select('*')
      .eq('code', '1700')
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  if (!debtorRes.data || !revenueRes.data || !vatPayableRes.data) {
    return null;
  }

  return {
    debtorAccount: debtorRes.data,
    revenueAccount: revenueRes.data,
    vatPayableAccount: vatPayableRes.data,
  };
}

export async function createAndBookInvoice(
  input: CreateInvoiceInput
): Promise<CreateInvoiceResult> {
  try {
    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      return { success: false, error: 'Geen bedrijf geselecteerd' };
    }
    const { contactId, lines } = input;

    if (!contactId || lines.length === 0) {
      return { success: false, error: 'Contact ID en minimaal één regel zijn verplicht' };
    }

    const validLines = lines.filter(line => line.description.trim() && line.amount > 0);
    if (validLines.length === 0) {
      return { success: false, error: 'Geen geldige factuurregels' };
    }

    const accounts = await getSystemAccounts();
    if (!accounts) {
      return {
        success: false,
        error: 'Vereiste grootboekrekeningen niet gevonden (Debiteuren, Omzet, BTW Te Betalen)',
      };
    }

    const { debtorAccount, revenueAccount, vatPayableAccount } = accounts;

    const invoiceNumber = await generateNextInvoiceNumber();
    const invoiceDate = input.invoiceDate || new Date().toISOString().split('T')[0];
    const dueDate =
      input.dueDate ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const subtotal = validLines.reduce((sum, line) => sum + line.amount, 0);
    const vatAmount = validLines.reduce(
      (sum, line) => sum + line.amount * (line.vatRate / 100),
      0
    );
    const total = subtotal + vatAmount;

    const entryId = crypto.randomUUID();
    const { error: journalError } = await supabase
      .from('journal_entries')
      .insert({
        id: entryId,
        company_id: companyId,
        entry_date: invoiceDate,
        description: `Verkoopfactuur ${invoiceNumber}`,
        reference: invoiceNumber,
        status: 'Final',
        contact_id: contactId,
        memoriaal_type: 'Verkoopfactuur',
      });

    if (journalError) {
      return {
        success: false,
        error: `Fout bij aanmaken journaalpost: ${journalError?.message || 'Unknown error'}`,
      };
    }
    const journalEntry = { id: entryId };

    const journalLines = [
      {
        journal_entry_id: journalEntry.id,
        account_id: debtorAccount.id,
        debit: total,
        credit: 0,
        description: `Debiteur ${invoiceNumber}`,
      },
      {
        journal_entry_id: journalEntry.id,
        account_id: revenueAccount.id,
        debit: 0,
        credit: subtotal,
        description: `Omzet ${invoiceNumber}`,
      },
    ];

    if (vatAmount > 0.01) {
      journalLines.push({
        journal_entry_id: journalEntry.id,
        account_id: vatPayableAccount.id,
        debit: 0,
        credit: vatAmount,
        description: `BTW ${invoiceNumber}`,
      });
    }

    const { error: linesError } = await supabase.from('journal_lines').insert(journalLines);

    if (linesError) {
      return {
        success: false,
        error: `Fout bij aanmaken journaalregels: ${linesError.message}`,
      };
    }

    const { data: invoiceData, error: invoiceError } = await supabase
      .from('sales_invoices')
      .insert({
        company_id: companyId,
        contact_id: contactId,
        invoice_number: invoiceNumber,
        date: invoiceDate,
        vat_amount: vatAmount,
        total_amount: total,
        status: 'open',
      })
      .select()
      .single();

    if (invoiceError) {
      return {
        success: false,
        error: `Fout bij opslaan factuur: ${invoiceError.message}`,
      };
    }

    return {
      success: true,
      invoiceId: invoiceData.id,
      invoiceNumber: invoiceNumber,
    };
  } catch (err) {
    console.error('Unexpected error in createAndBookInvoice:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Onbekende fout',
    };
  }
}

export async function getCustomers() {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, company_name, email, address')
    .or('relation_type.eq.Customer,relation_type.eq.Both')
    .eq('is_active', true)
    .order('company_name');

  if (error) {
    console.error('Failed to load customers:', error);
    return [];
  }

  return data || [];
}

export async function createCustomer(input: {
  company_name: string;
  email?: string;
  address?: string;
}) {
  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    throw new Error('Geen bedrijf geselecteerd');
  }

  const { data: debtorAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('type', 'Asset')
    .ilike('name', '%debiteur%')
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      company_id: companyId,
      company_name: input.company_name,
      email: input.email || null,
      address: input.address || null,
      relation_type: 'Customer',
      default_ledger_account_id: debtorAccount?.id || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Fout bij aanmaken klant: ${error.message}`);
  }

  return data;
}
