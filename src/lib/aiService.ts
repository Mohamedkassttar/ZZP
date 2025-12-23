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

═══════════════════════════════════════════════════════════════
📋 STEP-BY-STEP PROCESS
═══════════════════════════════════════════════════════════════
STEP 1: EXTRACT the visible data from the invoice/receipt
  - Supplier name, address, city
  - Invoice date, number, amounts
  - VAT details
  - Look for category clues (keywords like "Restaurant", "Garage", "Software", etc.)

STEP 2: MATCH the supplier to an existing contact from the contact list
  - If found: set contact_id and is_new_supplier = false
  - If NOT found: leave contact_id empty and set is_new_supplier = true

STEP 3: SELECT the correct ledger account from the available accounts list
  - Based on the supplier type and description
  - MUST choose an account ID from the "Available accounts" list below
  - DO NOT invent new account IDs or codes

═══════════════════════════════════════════════════════════════
⚠️ CRITICAL ACCOUNT SELECTION RULES ⚠️
═══════════════════════════════════════════════════════════════
1. You MUST choose from accounts with type "Expense" or "Asset" (see list below)
2. The suggested_account_id MUST be copied EXACTLY from the "Available accounts" list
3. DO NOT invent new UUIDs or account codes
4. NEVER suggest depreciation accounts (code 4200-4299) - these are year-end entries only
5. NEVER suggest VAT accounts, Creditor accounts, Bank accounts, or Equity accounts

Examples of correct matching:
- Shell, BP, Esso → Look for "Brandstof" or "Autokosten" in the list
- Office supplies, software → Look for "Software" or "Kantoorkosten" in the list
- Marketing, ads → Look for "Marketing" in the list
- Phone, internet → Look for "Telecommunicatie" or "Telefoon" in the list
- Bank fees → Look for "Bankkosten" in the list
- Restaurant → Look for "Representatie" in the list

═══════════════════════════════════════════════════════════════
📤 REQUIRED RESPONSE FORMAT (JSON)
═══════════════════════════════════════════════════════════════
Return ONLY valid JSON in this exact format:

{
  "supplier_name": "Shell Nederland B.V.",
  "supplier_address": "Mariaplaats 50",
  "supplier_city": "Utrecht",
  "category_clues": "Gas Station Fuel",
  "contact_id": "uuid-from-contact-list-or-empty-string",
  "is_new_supplier": false,
  "invoice_date": "2024-03-15",
  "invoice_number": "INV-2024-001",
  "total_amount": 121.00,
  "vat_amount": 21.00,
  "net_amount": 100.00,
  "vat_percentage": 21,
  "suggested_account_id": "COPY-UUID-FROM-ACCOUNTS-LIST",
  "suggested_account_code": "4605",
  "suggested_account_name": "Brandstof",
  "description": "Fuel purchase",
  "confidence": 0.95
}

⚠️ CRITICAL: The suggested_account_id field must contain a UUID copied EXACTLY from the Available accounts list below. Do NOT generate a new UUID.

═══════════════════════════════════════════════════════════════
Available contacts:
${JSON.stringify(contactList, null, 2)}

Available accounts (COPY THE ID EXACTLY):
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

    // VALIDATION: Check if the suggested account exists in the accounts list
    if (extractedData.suggested_account_id) {
      const foundAccount = accountList.find(acc => acc.id === extractedData.suggested_account_id);
      if (!foundAccount) {
        console.log('⚠️ [INVOICE AI] AI suggested invalid account ID - removing suggestion');
        console.log(`   AI suggested: ${extractedData.suggested_account_id}`);
        console.log(`   This ID does not exist in the database`);
        extractedData.suggested_account_id = undefined;
        extractedData.suggested_account_code = undefined;
        extractedData.suggested_account_name = undefined;
      } else {
        console.log('✓ [INVOICE AI] Account suggestion validated:', foundAccount.code, foundAccount.name);
      }
    }

    // VALIDATION: Check if the suggested account code matches
    if (extractedData.suggested_account_code && !extractedData.suggested_account_id) {
      const foundAccount = accountList.find(acc => acc.code === extractedData.suggested_account_code);
      if (foundAccount) {
        console.log('✓ [INVOICE AI] Account code validated, adding ID:', foundAccount.code, foundAccount.name);
        extractedData.suggested_account_id = foundAccount.id;
        extractedData.suggested_account_name = foundAccount.name;
      } else {
        console.log('⚠️ [INVOICE AI] AI suggested invalid account code - removing suggestion');
        console.log(`   AI suggested code: ${extractedData.suggested_account_code}`);
        extractedData.suggested_account_code = undefined;
        extractedData.suggested_account_name = undefined;
      }
    }

    console.log('✓ [INVOICE AI] Analysis complete');
    console.log('📊 Result:', {
      supplier: extractedData.supplier_name,
      amount: extractedData.total_amount,
      account: extractedData.suggested_account_code,
      accountId: extractedData.suggested_account_id,
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
