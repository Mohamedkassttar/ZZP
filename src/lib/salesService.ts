import { supabase } from './supabase';
import type { Database } from './database.types';
import { findActiveAccountsReceivable, findActiveVATPayable } from './systemAccountsService';
import { sendInvoiceEmail, sendInvoiceReminder, isValidEmail } from './emailService';

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
  shouldSendEmail?: boolean;
}

export interface CreateInvoiceResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
  emailSent?: boolean;
  emailMessage?: string;
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
  console.log('[SALES_SERVICE] Fetching system accounts for sales invoice...');

  // Use smart search functions instead of hardcoded account codes
  const [debtorAccount, vatPayableAccount, revenueRes] = await Promise.all([
    findActiveAccountsReceivable(),
    findActiveVATPayable(),
    supabase
      .from('accounts')
      .select('*')
      .eq('type', 'Revenue')
      .eq('is_active', true)
      .order('code')
      .limit(1)
      .maybeSingle(),
  ]);

  if (!debtorAccount) {
    console.error('[SALES_SERVICE] Geen Debiteuren rekening gevonden');
    return null;
  }
  console.log(`[SALES_SERVICE] ✓ Debiteuren: ${debtorAccount.code} - ${debtorAccount.name}`);

  if (!vatPayableAccount) {
    console.error('[SALES_SERVICE] Geen BTW te betalen rekening gevonden');
    return null;
  }
  console.log(`[SALES_SERVICE] ✓ BTW te betalen: ${vatPayableAccount.code} - ${vatPayableAccount.name}`);

  if (!revenueRes.data) {
    console.error('[SALES_SERVICE] Geen Omzet rekening gevonden');
    return null;
  }
  console.log(`[SALES_SERVICE] ✓ Omzet: ${revenueRes.data.code} - ${revenueRes.data.name}`);

  return {
    debtorAccount,
    revenueAccount: revenueRes.data,
    vatPayableAccount,
  };
}

export async function createAndBookInvoice(
  input: CreateInvoiceInput
): Promise<CreateInvoiceResult> {
  try {
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

    const { data: journalEntry, error: journalError } = await supabase
      .from('journal_entries')
      .insert({
        entry_date: invoiceDate,
        description: `Verkoopfactuur ${invoiceNumber}`,
        reference: invoiceNumber,
        status: 'Final',
        contact_id: contactId,
        memoriaal_type: 'Verkoopfactuur',
      })
      .select()
      .single();

    if (journalError || !journalEntry) {
      return {
        success: false,
        error: `Fout bij aanmaken journaalpost: ${journalError?.message || 'Unknown error'}`,
      };
    }

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

    // Handle email sending if requested
    let emailSent = false;
    let emailMessage = '';

    if (input.shouldSendEmail) {
      // Get contact email
      const { data: contact } = await supabase
        .from('contacts')
        .select('email, company_name')
        .eq('id', contactId)
        .single();

      if (contact?.email && isValidEmail(contact.email)) {
        try {
          const emailResult = await sendInvoiceEmail({
            to: contact.email,
            invoiceNumber: invoiceNumber,
            invoiceDate: invoiceDate,
            totalAmount: total,
            contactName: contact.company_name,
            dueDate: dueDate,
          });

          if (emailResult.success) {
            // Update invoice with email tracking
            await supabase
              .from('sales_invoices')
              .update({
                sent_to_email: contact.email,
                last_sent_at: emailResult.sentAt,
                status: 'sent',
              })
              .eq('id', invoiceData.id);

            emailSent = true;
            emailMessage = emailResult.message;
          }
        } catch (emailError) {
          console.error('Error sending invoice email:', emailError);
          emailMessage = 'Factuur aangemaakt, maar email kon niet worden verzonden';
        }
      } else {
        emailMessage = 'Factuur aangemaakt, maar geen geldig emailadres beschikbaar';
      }
    }

    return {
      success: true,
      invoiceId: invoiceData.id,
      invoiceNumber: invoiceNumber,
      emailSent,
      emailMessage,
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

/**
 * Resend an existing invoice via email
 */
export async function resendInvoice(
  invoiceId: string,
  targetEmail?: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('sales_invoices')
      .select(`
        id,
        invoice_number,
        date,
        total_amount,
        status,
        contact:contacts(email, company_name)
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return {
        success: false,
        message: 'Factuur niet gevonden',
      };
    }

    const contact = invoice.contact as any;
    const emailToUse = targetEmail || contact?.email;

    if (!emailToUse || !isValidEmail(emailToUse)) {
      return {
        success: false,
        message: 'Geen geldig emailadres beschikbaar',
      };
    }

    // Calculate due date (30 days from invoice date)
    const invoiceDate = new Date(invoice.date);
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);

    // Send email
    const emailResult = await sendInvoiceReminder({
      to: emailToUse,
      invoiceNumber: invoice.invoice_number || 'Onbekend',
      invoiceDate: invoice.date,
      totalAmount: invoice.total_amount || 0,
      contactName: contact.company_name,
      dueDate: dueDate.toISOString().split('T')[0],
    });

    if (emailResult.success) {
      // Update invoice with email tracking and status
      const updateData: any = {
        sent_to_email: emailToUse,
        last_sent_at: emailResult.sentAt,
      };

      // Update status to 'sent' if it was 'draft'
      if (invoice.status === 'draft') {
        updateData.status = 'sent';
      }

      await supabase
        .from('sales_invoices')
        .update(updateData)
        .eq('id', invoiceId);

      return {
        success: true,
        message: emailResult.message,
      };
    }

    return {
      success: false,
      message: 'Fout bij verzenden email',
    };
  } catch (err) {
    console.error('Error in resendInvoice:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Onbekende fout',
    };
  }
}
