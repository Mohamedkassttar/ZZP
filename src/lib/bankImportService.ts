import { supabase } from './supabase';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { callOpenAIWithRetry, extractJSON } from './openaiRetryHelper';
import { getCurrentCompanyId } from './companyHelper';

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch (error) {
  console.warn('[PDF Worker] Failed to set worker source:', error);
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export interface BankTransaction {
  transaction_date: string;
  amount: number;
  description: string;
  contra_account?: string;
  contra_name?: string;
  transaction_type: string;
  status: string;
}

export interface ImportResult {
  newTransactions: number;
  duplicates: number;
  errors: string[];
  skipped?: number;
  transactionIds?: string[];
}


export async function generateTransactionHash(
  date: string,
  amount: number,
  description: string,
  accountName?: string,
  rawMT940Content?: string
): Promise<string> {
  let hashInput: string;

  if (rawMT940Content) {
    hashInput = rawMT940Content;
  } else {
    const cleanDate = date.replace(/\s+/g, '');
    const cleanAmount = amount.toString().replace(/\s+/g, '');
    const cleanDescription = description.replace(/\s+/g, '');
    const cleanAccountName = (accountName || '').replace(/\s+/g, '');
    hashInput = `${cleanDate}_${cleanAmount}_${cleanDescription}_${cleanAccountName}`;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function checkDuplicateHashes(hashes: string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();

  const duplicateHashes = new Set<string>();

  const { data: journalData, error: journalError } = await supabase
    .from('journal_entries')
    .select('transaction_hash')
    .in('transaction_hash', hashes)
    .not('transaction_hash', 'is', null);

  if (journalError) {
    console.error('Error checking journal_entries duplicates:', journalError);
  } else if (journalData) {
    journalData.forEach(row => {
      if (row.transaction_hash) duplicateHashes.add(row.transaction_hash);
    });
  }

  return duplicateHashes;
}

export async function checkDuplicateTransactions(
  transactions: Array<{ transaction_date: string; amount: number; description: string; contra_account?: string }>
): Promise<Set<string>> {
  if (transactions.length === 0) return new Set();

  const duplicateSignatures = new Set<string>();

  for (const txn of transactions) {
    const signature = `${txn.transaction_date}_${txn.amount}_${txn.description}_${txn.contra_account || ''}`;

    const { data, error } = await supabase
      .from('bank_transactions')
      .select('id')
      .eq('transaction_date', txn.transaction_date)
      .eq('amount', txn.amount)
      .eq('description', txn.description)
      .limit(1);

    if (!error && data && data.length > 0) {
      duplicateSignatures.add(signature);
    }
  }

  return duplicateSignatures;
}

export async function parseMT940File(content: string): Promise<BankTransaction[]> {
  const transactions: BankTransaction[] = [];

  const cleanedContent = content.replace(/^\uFEFF/, '').replace(/^\ufeff/, '').trim();
  const lines = cleanedContent.split('\n');

  let currentTransaction: Partial<BankTransaction> = {};
  let rawTransactionContent = '';
  let inTransaction = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith(':61:')) {
      if (inTransaction && currentTransaction.transaction_date) {
        if (currentTransaction.transaction_date && currentTransaction.amount !== undefined && currentTransaction.amount !== 0) {
          const hash = await generateTransactionHash(
            currentTransaction.transaction_date,
            currentTransaction.amount,
            currentTransaction.description || '',
            currentTransaction.contra_name,
            rawTransactionContent
          );
          transactions.push({
            ...currentTransaction,
            status: 'Unmatched',
            transaction_type: currentTransaction.amount! > 0 ? 'Credit' : 'Debit',
          } as BankTransaction & { transaction_hash: string });
        }
      }

      inTransaction = true;
      rawTransactionContent = line;
      currentTransaction = {};

      const dateMatch = line.match(/^:61:(\d{6})/);
      if (dateMatch) {
        const yymmdd = dateMatch[1];
        const year = 2000 + parseInt(yymmdd.substring(0, 2));
        const month = yymmdd.substring(2, 4);
        const day = yymmdd.substring(4, 6);
        currentTransaction.transaction_date = `${year}-${month}-${day}`;
      }

      const amountMatch = line.match(/[CD]([0-9.,]+)/);
      if (amountMatch) {
        const dcIndicator = line.match(/([CD])[0-9.,]+/)?.[1];
        let amount = parseFloat(amountMatch[1].replace(',', '.'));
        if (dcIndicator === 'D') amount = -amount;
        currentTransaction.amount = amount;
      }
    } else if (line.startsWith(':86:')) {
      rawTransactionContent += '\n' + line;
      const description = line.substring(4).trim();
      currentTransaction.description = description;

      const nameMatch = description.match(/NAME:(.+?)(?:IBAN:|REMI:|$)/i);
      if (nameMatch) {
        currentTransaction.contra_name = nameMatch[1].trim();
      }

      const ibanMatch = description.match(/IBAN:\s*([A-Z]{2}[0-9]{2}[A-Z0-9]+)/i);
      if (ibanMatch) {
        currentTransaction.contra_account = ibanMatch[1];
      }
    }
  }

  if (inTransaction && currentTransaction.transaction_date && currentTransaction.amount !== undefined && currentTransaction.amount !== 0) {
    const hash = await generateTransactionHash(
      currentTransaction.transaction_date,
      currentTransaction.amount,
      currentTransaction.description || '',
      currentTransaction.contra_name,
      rawTransactionContent
    );
    transactions.push({
      ...currentTransaction,
      status: 'Unmatched',
      transaction_type: currentTransaction.amount > 0 ? 'Credit' : 'Debit',
    } as BankTransaction);
  }

  return transactions;
}

export async function parseCSVFile(content: string): Promise<BankTransaction[]> {
  const transactions: BankTransaction[] = [];

  const cleanedContent = content.replace(/^\uFEFF/, '').replace(/^\ufeff/, '').trim();
  const lines = cleanedContent.split('\n');

  if (lines.length < 2) return transactions;

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const dateIndex = headers.findIndex(h => h.includes('date') || h.includes('datum'));
  const amountIndex = headers.findIndex(h => h.includes('amount') || h.includes('bedrag'));
  const descIndex = headers.findIndex(h => h.includes('description') || h.includes('omschrijving'));
  const nameIndex = headers.findIndex(h => h.includes('name') || h.includes('naam') || h.includes('tegenpartij'));
  const accountIndex = headers.findIndex(h => h.includes('account') || h.includes('rekening') || h.includes('iban'));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));

    if (dateIndex >= 0 && amountIndex >= 0) {
      const amount = parseFloat(values[amountIndex]?.replace(',', '.') || '0');

      if (amount === 0) continue;

      const transaction: BankTransaction = {
        transaction_date: values[dateIndex] || '',
        amount,
        description: descIndex >= 0 ? values[descIndex] : '',
        contra_name: nameIndex >= 0 ? values[nameIndex] : undefined,
        contra_account: accountIndex >= 0 ? values[accountIndex] : undefined,
        status: 'Unmatched',
        transaction_type: amount > 0 ? 'Credit' : 'Debit',
      };

      transactions.push(transaction);
    }
  }

  return transactions;
}

export async function parsePDFFile(file: File): Promise<BankTransaction[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    console.log(`📄 PDF heeft ${pdf.numPages} pagina(s)`);

    const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key niet geconfigureerd');
    }

    const systemPrompt = `Je bent een banktransactie-parser. Analyseer de volgende ongestructureerde tekst van een bankafschrift.

INSTRUCTIES:
- Negeer headers, footers, saldo-regels en samenvattingen
- Haal alleen individuele transacties eruit
- Elke transactie moet een datum, bedrag en omschrijving hebben
- Als een rekeningnummer (IBAN/contra account) zichtbaar is, voeg het toe
- Bepaal of het een debit (betaling/uitgave) of credit (ontvangst/inkomst) is

OUTPUT FORMAT:
Geef ALLEEN een JSON array terug, zonder uitleg. Format:
[
  {
    "date": "YYYY-MM-DD",
    "description": "beschrijving",
    "amount": -123.45,
    "counter_account": "NL12BANK1234567890",
    "transaction_type": "Debit"
  }
]

BELANGRIJK:
- amount moet negatief zijn voor uitgaven (Debit), positief voor inkomsten (Credit)
- transaction_type moet "Debit" of "Credit" zijn
- Als counter_account niet zichtbaar is, laat het weg
- Geef ALLEEN de JSON array terug, geen markdown, geen uitleg`;

    let allTransactions: BankTransaction[] = [];

    // Loop door ALLE pagina's
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`⏳ Verwerken pagina ${pageNum} van ${pdf.numPages}...`);

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      // Skip lege pagina's
      if (pageText.trim().length < 50) {
        console.log(`⏭️  Pagina ${pageNum} overgeslagen (te weinig tekst)`);
        continue;
      }

      // Stuur DEZE pagina naar AI
      const userPrompt = `Parseer deze bankafschrift pagina (pagina ${pageNum} van ${pdf.numPages}):\n\n${pageText}`;

      try {
        const data = await callOpenAIWithRetry(OPENAI_API_KEY, {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 2000,
          temperature: 0.0,
        });

        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          console.warn(`⚠️  Pagina ${pageNum}: Geen response van OpenAI`);
          continue;
        }

        const jsonData = extractJSON(content);

        if (!Array.isArray(jsonData)) {
          console.warn(`⚠️  Pagina ${pageNum}: AI response is geen array`);
          continue;
        }

        const pageTransactions: BankTransaction[] = jsonData.map((item: any) => ({
          transaction_date: item.date || '',
          amount: parseFloat(item.amount) || 0,
          description: item.description || '',
          contra_account: item.counter_account || undefined,
          contra_name: undefined,
          transaction_type: item.transaction_type || (item.amount < 0 ? 'Debit' : 'Credit'),
          status: 'Unmatched',
        }));

        const validPageTransactions = pageTransactions.filter(
          t => t.amount !== 0 && t.transaction_date && t.description
        );

        console.log(`✅ Pagina ${pageNum}: ${validPageTransactions.length} transacties gevonden`);
        allTransactions = [...allTransactions, ...validPageTransactions];
      } catch (pageError) {
        console.error(`❌ Fout bij verwerken pagina ${pageNum}:`, pageError);
        // Ga door naar de volgende pagina
      }

      // Kleine pauze tussen pagina's om rate limiting te vermijden
      if (pageNum < pdf.numPages) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Deduplicatie: verwijder exact dezelfde transacties
    const uniqueTransactions = deduplicateTransactions(allTransactions);

    console.log(`🎉 Totaal: ${uniqueTransactions.length} unieke transacties geëxtraheerd`);

    return uniqueTransactions;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Fout bij verwerken PDF: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
  }
}

function deduplicateTransactions(transactions: BankTransaction[]): BankTransaction[] {
  const seen = new Map<string, BankTransaction>();

  for (const txn of transactions) {
    // Maak een unieke key op basis van datum, bedrag, beschrijving en contra account
    const key = `${txn.transaction_date}_${txn.amount}_${txn.description}_${txn.contra_account || ''}`;

    // Voeg alleen toe als we deze combinatie nog niet hebben gezien
    if (!seen.has(key)) {
      seen.set(key, txn);
    }
  }

  return Array.from(seen.values());
}

export interface ParseResult {
  transactions: BankTransaction[];
  skipped: number;
}

function cleanXMLInput(xmlContent: string): string {
  let cleaned = xmlContent;

  cleaned = cleaned.replace(/^\uFEFF/, '');
  cleaned = cleaned.replace(/^\ufeff/, '');

  cleaned = cleaned.trim();

  cleaned = cleaned.replace(/^[\s\xA0\u0000-\u001F]+/, '');
  cleaned = cleaned.replace(/[\s\xA0\u0000-\u001F]+$/, '');

  const xmlDeclMatch = cleaned.match(/^<\?xml[^?]*\?>/i);
  if (xmlDeclMatch) {
    const xmlDecl = xmlDeclMatch[0];
    if (xmlDecl.includes('encoding') && !xmlDecl.toLowerCase().includes('utf-8')) {
      cleaned = cleaned.replace(/^<\?xml[^?]*\?>/, '<?xml version="1.0" encoding="UTF-8"?>');
    }
  }

  return cleaned;
}

function stripNamespaces(xmlContent: string): string {
  let stripped = xmlContent;

  stripped = stripped.replace(/\sxmlns(:[^=]+)?="[^"]*"/g, '');

  stripped = stripped.replace(/<([a-zA-Z0-9_]+):([a-zA-Z0-9_]+)/g, '<$2');
  stripped = stripped.replace(/<\/([a-zA-Z0-9_]+):([a-zA-Z0-9_]+)>/g, '</$2>');

  return stripped;
}

export async function parseCAMT053(xmlContent: string): Promise<ParseResult> {
  const transactions: BankTransaction[] = [];
  const skippedEntries: Array<{ error: string; xml?: string }> = [];

  try {
    let cleanedXML = cleanXMLInput(xmlContent);
    cleanedXML = stripNamespaces(cleanedXML);

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanedXML, 'text/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      console.error('XML Parser Error:', parserError.textContent);
      throw new Error('Invalid XML format: ' + parserError.textContent);
    }

    const entries = xmlDoc.getElementsByTagName('Ntry');

    if (entries.length === 0) {
      console.warn('No Ntry elements found in CAMT.053 file');
      return {
        transactions: [],
        skipped: 0
      };
    }

    console.log(`Found ${entries.length} entries in CAMT.053 file`);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      try {
        let dateStr: string | null = null;

        const bookgDtElements = entry.getElementsByTagName('BookgDt');
        if (bookgDtElements.length > 0) {
          const dtElements = bookgDtElements[0].getElementsByTagName('Dt');
          if (dtElements.length > 0) {
            dateStr = dtElements[0].textContent?.trim() || null;
          }
        }

        if (!dateStr) {
          const valDtElements = entry.getElementsByTagName('ValDt');
          if (valDtElements.length > 0) {
            const dtElements = valDtElements[0].getElementsByTagName('Dt');
            if (dtElements.length > 0) {
              dateStr = dtElements[0].textContent?.trim() || null;
            }
          }
        }

        if (!dateStr) {
          skippedEntries.push({ error: 'Missing date' });
          continue;
        }

        const amountElements = entry.getElementsByTagName('Amt');
        if (amountElements.length === 0) {
          skippedEntries.push({ error: 'Missing amount' });
          continue;
        }

        const amountStr = amountElements[0].textContent?.trim() || '';
        if (!amountStr) {
          skippedEntries.push({ error: 'Empty amount' });
          continue;
        }

        let amount = parseFloat(amountStr);
        if (isNaN(amount)) {
          skippedEntries.push({ error: `Invalid amount: ${amountStr}` });
          continue;
        }

        if (amount === 0) {
          skippedEntries.push({ error: 'Zero amount transaction skipped' });
          continue;
        }

        const cdtDbtIndElements = entry.getElementsByTagName('CdtDbtInd');
        const cdtDbtInd = cdtDbtIndElements.length > 0
          ? cdtDbtIndElements[0].textContent?.trim()
          : null;

        if (cdtDbtInd === 'DBIT') {
          amount = -Math.abs(amount);
        } else if (cdtDbtInd === 'CRDT') {
          amount = Math.abs(amount);
        }

        let description = '';

        const ntryDtlsElements = entry.getElementsByTagName('NtryDtls');
        if (ntryDtlsElements.length > 0) {
          const txDtlsElements = ntryDtlsElements[0].getElementsByTagName('TxDtls');
          if (txDtlsElements.length > 0) {
            const rmtInfElements = txDtlsElements[0].getElementsByTagName('RmtInf');
            if (rmtInfElements.length > 0) {
              const ustrdElements = rmtInfElements[0].getElementsByTagName('Ustrd');
              if (ustrdElements.length > 0) {
                description = ustrdElements[0].textContent?.trim() || '';
              }
            }
          }
        }

        if (!description) {
          const addtlNtryInfElements = entry.getElementsByTagName('AddtlNtryInf');
          if (addtlNtryInfElements.length > 0) {
            description = addtlNtryInfElements[0].textContent?.trim() || '';
          }
        }

        if (!description) {
          description = 'Bank Transaction';
        }

        let contraName: string | undefined;
        let contraAccount: string | undefined;

        try {
          const ntryDtlsElements = entry.getElementsByTagName('NtryDtls');
          if (ntryDtlsElements.length > 0) {
            const txDtlsElements = ntryDtlsElements[0].getElementsByTagName('TxDtls');
            if (txDtlsElements.length > 0) {
              const rltdPtiesElements = txDtlsElements[0].getElementsByTagName('RltdPties');

              if (rltdPtiesElements.length > 0) {
                const rltdPties = rltdPtiesElements[0];

                const cdtrElements = rltdPties.getElementsByTagName('Cdtr');
                if (cdtrElements.length > 0) {
                  const nmElements = cdtrElements[0].getElementsByTagName('Nm');
                  if (nmElements.length > 0) {
                    contraName = nmElements[0].textContent?.trim() || undefined;
                  }
                }

                if (!contraName) {
                  const dbtrElements = rltdPties.getElementsByTagName('Dbtr');
                  if (dbtrElements.length > 0) {
                    const nmElements = dbtrElements[0].getElementsByTagName('Nm');
                    if (nmElements.length > 0) {
                      contraName = nmElements[0].textContent?.trim() || undefined;
                    }
                  }
                }

                const cdtrAcctElements = rltdPties.getElementsByTagName('CdtrAcct');
                if (cdtrAcctElements.length > 0) {
                  const idElements = cdtrAcctElements[0].getElementsByTagName('Id');
                  if (idElements.length > 0) {
                    const ibanElements = idElements[0].getElementsByTagName('IBAN');
                    if (ibanElements.length > 0) {
                      contraAccount = ibanElements[0].textContent?.trim() || undefined;
                    }
                  }
                }

                if (!contraAccount) {
                  const dbtrAcctElements = rltdPties.getElementsByTagName('DbtrAcct');
                  if (dbtrAcctElements.length > 0) {
                    const idElements = dbtrAcctElements[0].getElementsByTagName('Id');
                    if (idElements.length > 0) {
                      const ibanElements = idElements[0].getElementsByTagName('IBAN');
                      if (ibanElements.length > 0) {
                        contraAccount = ibanElements[0].textContent?.trim() || undefined;
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (counterpartyError) {
          console.warn(`Entry ${i + 1}: Error extracting counterparty details, continuing without:`, counterpartyError);
        }

        const transaction: BankTransaction = {
          transaction_date: dateStr,
          amount,
          description: description.substring(0, 500),
          contra_name: contraName?.substring(0, 200),
          contra_account: contraAccount?.substring(0, 34),
          status: 'Unmatched',
          transaction_type: amount > 0 ? 'Credit' : 'Debit',
        };

        transactions.push(transaction);
      } catch (entryError) {
        const errorMsg = entryError instanceof Error ? entryError.message : 'Unknown error';
        console.warn(`Entry ${i + 1}: Failed to parse -`, errorMsg);
        skippedEntries.push({
          error: errorMsg,
          xml: entry.outerHTML?.substring(0, 200)
        });
        continue;
      }
    }

    if (skippedEntries.length > 0) {
      console.warn(`Skipped ${skippedEntries.length} entries due to parsing errors:`, skippedEntries);
    }

    console.log(`Successfully parsed ${transactions.length} transactions from CAMT.053`);

    return {
      transactions,
      skipped: skippedEntries.length
    };
  } catch (error) {
    console.error('Error parsing CAMT.053 XML:', error);
    throw new Error('Failed to parse CAMT.053 XML file. Please check the format.');
  }
}

export async function importBankTransactions(
  transactions: BankTransaction[],
  bankAccountId: string
): Promise<ImportResult> {
  const result: ImportResult = {
    newTransactions: 0,
    duplicates: 0,
    errors: [],
    transactionIds: [],
  };

  const validTransactions = transactions.filter(t => t.amount !== 0);

  if (validTransactions.length === 0) {
    result.errors.push('No valid transactions to import');
    return result;
  }

  const transactionsWithHashes = await Promise.all(
    validTransactions.map(async (txn) => {
      const hash = await generateTransactionHash(
        txn.transaction_date,
        txn.amount,
        txn.description,
        txn.contra_name
      );
      const signature = `${txn.transaction_date}_${txn.amount}_${txn.description}_${txn.contra_account || ''}`;
      return { ...txn, transaction_hash: hash, signature };
    })
  );

  const allHashes = transactionsWithHashes.map(t => t.transaction_hash);
  const existingJournalHashes = await checkDuplicateHashes(allHashes);

  const existingBankSignatures = await checkDuplicateTransactions(
    transactionsWithHashes.map(t => ({
      transaction_date: t.transaction_date,
      amount: t.amount,
      description: t.description,
      contra_account: t.contra_account,
    }))
  );

  const newTransactions = transactionsWithHashes.filter(
    t => !existingJournalHashes.has(t.transaction_hash) && !existingBankSignatures.has(t.signature)
  );

  const duplicateCount = transactionsWithHashes.length - newTransactions.length;
  result.duplicates = duplicateCount;

  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    result.errors.push('Geen bedrijf geselecteerd');
    return result;
  }

  for (const txn of newTransactions) {
    try {
      const { data, error: bankError } = await supabase
        .from('bank_transactions')
        .insert({
          company_id: companyId,
          bank_account_id: bankAccountId,
          transaction_date: txn.transaction_date,
          amount: txn.amount,
          description: txn.description,
          contra_account: txn.contra_account,
          contra_name: txn.contra_name,
          transaction_type: txn.transaction_type,
          status: txn.status || 'Unmatched',
        })
        .select('id')
        .single();

      if (bankError) {
        if (bankError.code === '23505') {
          result.duplicates++;
        } else {
          result.errors.push(`Failed to import transaction: ${bankError.message}`);
        }
      } else {
        result.newTransactions++;
        if (data && data.id) {
          result.transactionIds!.push(data.id);
        }
      }
    } catch (error) {
      result.errors.push(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  return result;
}
