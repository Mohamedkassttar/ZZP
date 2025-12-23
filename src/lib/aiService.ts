import type { Database, ExtractedInvoiceData } from './database.types';
import { supabase } from './supabase';
import { callOpenAIWithRetry, extractJSON } from './openaiRetryHelper';
import { AI_CONFIG } from './aiConfig';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Safely set PDF.js worker (with fallback to prevent crashes)
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch (error) {
  console.warn('[PDF Worker] Failed to set worker source:', error);
  // Fallback to CDN worker if local import fails
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

type Account = Database['public']['Tables']['accounts']['Row'];

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

async function extractTextFromPDF(fileUrl: string): Promise<string> {
  try {
    console.log('📄 [PDF EXTRACTOR] Downloading PDF from signed URL...');

    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();

    console.log('📄 [PDF EXTRACTOR] Loading PDF document...');
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    console.log(`📄 [PDF EXTRACTOR] PDF has ${pdf.numPages} pages`);

    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      fullText += pageText + '\n\n';
      console.log(`📄 [PDF EXTRACTOR] Extracted page ${pageNum}/${pdf.numPages}`);
    }

    console.log(`✓ [PDF EXTRACTOR] Total text extracted: ${fullText.length} characters`);

    return fullText.trim();
  } catch (error) {
    console.error('❌ [PDF EXTRACTOR] Failed to extract text:', error);
    throw new Error('Kon geen tekst uit PDF extraheren');
  }
}

interface OpenAIMessage {
  role: 'system' | 'user';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export async function analyzeInvoice(
  fileUrl: string,
  accounts: Account[],
  fileType?: string
): Promise<ExtractedInvoiceData & { contact_id?: string; is_new_supplier?: boolean }> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Please add VITE_OPENAI_API_KEY to your .env file.');
  }

  const accountList = accounts
    .filter(acc => acc.type === 'Expense' || acc.type === 'Asset')
    .map(acc => ({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      vat_code: acc.vat_code,
    }));

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, company_name, relation_type')
    .eq('is_active', true);

  const contactList = (contacts || []).map(c => ({
    id: c.id,
    name: c.company_name,
    type: c.relation_type
  }));

  const isPDF = fileType === 'application/pdf';

  const systemPrompt = `You are an expert Dutch accountant specializing in ZZP (freelancer) bookkeeping.

Your task is to extract data from invoices and receipts, and suggest the correct General Ledger account for booking.

Extract the following information:
1. supplier_name - Name of the company/supplier
2. supplier_address - Street name and number (e.g., "Mariaplaats 50")
3. supplier_city - City name (e.g., "Utrecht")
4. category_clues - Keywords that indicate the business type (e.g., "Restaurant", "Bar", "Cafe", "Taxi", "Supermarket", "Garage", "Software"). Look for these words on the receipt/invoice.
5. invoice_date - Date in YYYY-MM-DD format
6. invoice_number - Invoice or receipt number
7. total_amount - Total amount including VAT (in euros)
8. vat_amount - VAT amount (in euros)
9. net_amount - Amount excluding VAT (in euros)
10. vat_percentage - VAT percentage (21, 9, or 0)
11. description - Brief description of what was purchased
12. confidence - Your confidence level (0-1)
13. contact_id - Match supplier name to existing contact ID from the list (if found)
14. is_new_supplier - Set to true if supplier is NOT found in the contact list

IMPORTANT: Try to match the extracted supplier name to an existing contact from the contact list.
If no match is found, set is_new_supplier to true and leave contact_id empty.

Suggest the correct EXPENSE or ASSET account from the provided Chart of Accounts based on:
- The supplier name and type of business
- The description of goods/services
- Common Dutch accounting practices for ZZP

CRITICAL RULES:
1. ONLY suggest accounts with type "Expense" or "Asset" (available in the list below)
2. NEVER suggest VAT accounts, Creditor accounts, Bank accounts, or Equity accounts
3. NEVER suggest depreciation accounts (4200, 4900) - depreciation is a year-end journal entry only
4. The suggested_account_id MUST exist in the "Available accounts" list

Examples:
- Shell, BP, Esso → Brandstofkosten (Expense)
- Office supplies, software → Software & Licenties (Expense)
- Marketing, ads → Marketing & Advertenties (Expense)
- Phone, internet → Telefoon en Internet (Expense)
- Bank fees → Bankkosten en rente (Expense)

Return ONLY valid JSON in this exact format:
{
  "supplier_name": "Shell Nederland B.V.",
  "supplier_address": "Mariaplaats 50",
  "supplier_city": "Utrecht",
  "category_clues": "Restaurant Bar Cafe",
  "contact_id": "uuid-from-contact-list-or-empty",
  "is_new_supplier": false,
  "invoice_date": "2024-03-15",
  "invoice_number": "INV-2024-001",
  "total_amount": 121.00,
  "vat_amount": 21.00,
  "net_amount": 100.00,
  "vat_percentage": 21,
  "suggested_account_id": "uuid-from-list",
  "suggested_account_code": "4000",
  "suggested_account_name": "Autokosten",
  "description": "Brandstof",
  "confidence": 0.95
}

Available contacts:
${JSON.stringify(contactList, null, 2)}

Available accounts:
${JSON.stringify(accountList, null, 2)}`;

  let messages: OpenAIMessage[];

  try {
    console.log('\n' + '═'.repeat(60));
    console.log('🤖 [INVOICE AI] Starting invoice analysis');
    console.log(`📄 File Type: ${isPDF ? 'PDF' : 'Image'}`);
    console.log(`📄 File URL: ${fileUrl.substring(0, 100)}...`);
    console.log(`📊 Available accounts: ${accountList.length}`);
    console.log(`👥 Available contacts: ${contactList.length}`);
    console.log('═'.repeat(60));

    if (isPDF) {
      console.log('\n📄 Processing PDF document...');
      const extractedText = await extractTextFromPDF(fileUrl);

      messages = [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Please analyze this invoice/receipt text and extract the required information.\n\nINVOICE TEXT:\n${extractedText}`,
        },
      ];
    } else {
      console.log('\n🖼️ Processing image document...');
      messages = [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this invoice/receipt and extract the required information.',
            },
            {
              type: 'image_url',
              image_url: {
                url: fileUrl,
              },
            },
          ],
        },
      ];
    }

    console.log('📤 [INVOICE AI] Sending request to OpenAI...');

    const data = await callOpenAIWithRetry(OPENAI_API_KEY, {
      model: AI_CONFIG.model,
      messages,
      max_tokens: 1000,
      temperature: AI_CONFIG.temperature,
    });

    console.log('📥 [INVOICE AI] Received response from OpenAI');

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('❌ [INVOICE AI] No content in OpenAI response');
      console.error('Full response:', JSON.stringify(data, null, 2));
      throw new Error('No response from OpenAI - received empty content');
    }

    console.log('✓ [INVOICE AI] Extracting JSON from response...');

    const extractedData: ExtractedInvoiceData = extractJSON(content);

    console.log('✓ [INVOICE AI] Analysis complete');
    console.log('📊 Result:', {
      supplier: extractedData.supplier_name,
      amount: extractedData.total_amount,
      account: extractedData.suggested_account_code,
      confidence: extractedData.confidence,
    });

    return extractedData;
  } catch (error) {
    console.error('❌ [INVOICE AI] Analysis failed');
    console.error('Error details:', error);

    // Re-throw with more context
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Invoice AI analysis failed: ${errorMessage}`);
  }
}
