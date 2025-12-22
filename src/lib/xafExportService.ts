import { supabase } from './supabase';
import type { Database } from './database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];
type JournalLine = Database['public']['Tables']['journal_lines']['Row'];

interface XAFGenerationOptions {
  fiscalYear: number;
  startDate: string;
  endDate: string;
  companyName?: string;
  companyVAT?: string;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

export async function generateXAF32Export(options: XAFGenerationOptions): Promise<string> {
  const { fiscalYear, startDate, endDate, companyName = 'Mijn Onderneming', companyVAT = '' } = options;

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .order('code');

  if (!accounts) {
    throw new Error('Failed to load accounts');
  }

  const { data: allLines } = await supabase
    .from('journal_lines')
    .select('*, journal_entries!inner(*)')
    .lte('journal_entries.entry_date', endDate)
    .eq('journal_entries.status', 'Final');

  const { data: periodEntries } = await supabase
    .from('journal_entries')
    .select('*, journal_lines(*)')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .eq('status', 'Final')
    .order('entry_date', { ascending: true });

  const openingBalances = new Map<string, { debit: number; credit: number }>();

  if (allLines) {
    for (const line of allLines) {
      const entryDate = (line.journal_entries as any)?.entry_date;
      if (entryDate && entryDate < startDate) {
        const current = openingBalances.get(line.account_id) || { debit: 0, credit: 0 };
        openingBalances.set(line.account_id, {
          debit: current.debit + Number(line.debit),
          credit: current.credit + Number(line.credit),
        });
      }
    }
  }

  const currentDate = formatDate(new Date());

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<auditfile xmlns="http://www.auditfiles.nl/XAF/3.2">
  <header>
    <fiscalYear>${fiscalYear}</fiscalYear>
    <startDate>${startDate}</startDate>
    <endDate>${endDate}</endDate>
    <curCode>EUR</curCode>
    <dateCreated>${currentDate}</dateCreated>
    <softwareDesc>Boekhoudapplicatie</softwareDesc>
    <softwareVersion>1.0</softwareVersion>
  </header>
  <company>
    <companyIdent>${escapeXML(companyVAT)}</companyIdent>
    <companyName>${escapeXML(companyName)}</companyName>
    <taxRegistrationCountry>NL</taxRegistrationCountry>
  </company>
  <generalLedger>
    <ledgerAccounts>`;

  for (const account of accounts) {
    const openingBalance = openingBalances.get(account.id);
    const openingDebit = openingBalance?.debit || 0;
    const openingCredit = openingBalance?.credit || 0;

    let normalBalance = 'debit';
    if (account.type === 'Liability' || account.type === 'Equity' || account.type === 'Revenue') {
      normalBalance = 'credit';
    }

    xml += `
      <ledgerAccount>
        <accID>${escapeXML(account.code)}</accID>
        <accDesc>${escapeXML(account.name)}</accDesc>
        <accTp>${escapeXML(account.type || 'Asset')}</accTp>`;

    if (account.rgs_code) {
      xml += `
        <taxonomy>${escapeXML(account.rgs_code)}</taxonomy>`;
    } else {
      xml += `
        <taxonomy></taxonomy>`;
    }

    xml += `
        <leadCode></leadCode>
        <openingBalance>
          <amnt>${formatAmount(openingDebit)}</amnt>
          <amntTp>debit</amntTp>
        </openingBalance>
        <openingBalance>
          <amnt>${formatAmount(openingCredit)}</amnt>
          <amntTp>credit</amntTp>
        </openingBalance>
      </ledgerAccount>`;
  }

  xml += `
    </ledgerAccounts>
    <transactions>`;

  if (periodEntries) {
    for (const entry of periodEntries) {
      const lines = entry.journal_lines as JournalLine[];
      if (!lines || lines.length === 0) continue;

      const entryDate = formatDate(new Date(entry.entry_date));
      const transactionID = entry.id.substring(0, 8);
      const description = escapeXML(entry.description || '');
      const transactionType = entry.memoriaal_type || 'general';

      xml += `
      <transaction>
        <trID>${transactionID}</trID>
        <desc>${description}</desc>
        <periodNumber>${new Date(entry.entry_date).getMonth() + 1}</periodNumber>
        <trDt>${entryDate}</trDt>
        <trTp>${transactionType}</trTp>
        <lines>`;

      for (const line of lines) {
        const account = accounts.find(a => a.id === line.account_id);
        if (!account) continue;

        const lineDesc = escapeXML(line.description || description);
        const debitAmount = Number(line.debit);
        const creditAmount = Number(line.credit);
        const amountType = debitAmount > 0 ? 'debit' : 'credit';
        const amount = debitAmount > 0 ? debitAmount : creditAmount;

        xml += `
          <line>
            <accID>${escapeXML(account.code)}</accID>
            <docRef>${transactionID}</docRef>
            <effDate>${entryDate}</effDate>
            <desc>${lineDesc}</desc>
            <amnt>${formatAmount(amount)}</amnt>
            <amntTp>${amountType}</amntTp>
          </line>`;
      }

      xml += `
        </lines>
      </transaction>`;
    }
  }

  xml += `
    </transactions>
  </generalLedger>
</auditfile>`;

  return xml;
}

export async function downloadXAFFile(options: XAFGenerationOptions): Promise<void> {
  try {
    const xml = await generateXAF32Export(options);

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `RGS_Brugstaat_${options.fiscalYear}.xaf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to generate XAF file:', error);
    throw error;
  }
}
