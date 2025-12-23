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
  - You MUST provide BOTH the account ID and the account CODE
  - Find the matching account in the list and copy BOTH values

═══════════════════════════════════════════════════════════════
⚠️ CRITICAL ACCOUNT SELECTION RULES ⚠️
═══════════════════════════════════════════════════════════════
1. You MUST choose from accounts with type "Expense" or "Asset" (see list below)
2. The suggested_account_id MUST be the UUID copied EXACTLY from the "Available accounts" list
3. The suggested_account_code MUST be the 4-digit code from the same account
4. DO NOT invent new UUIDs or account codes - copy them from the list
5. NEVER suggest depreciation accounts (code 4200-4299) - these are year-end entries only
6. NEVER suggest VAT accounts, Creditor accounts, Bank accounts, or Equity accounts

Examples of correct matching:
- Shell, BP, Esso → Look for "Brandstof" (code 4605) in the list, copy its ID
- Office supplies, software → Look for "Software" (code 4815) in the list, copy its ID
- Marketing, ads → Look for "Marketing" (code 4500) in the list, copy its ID
- Phone, internet → Look for "Telecommunicatie" (code 4800) in the list, copy its ID
- Bank fees → Look for "Bankkosten" (code 4950) in the list, copy its ID
- Restaurant → Look for "Representatie" (code 4510) in the list, copy its ID

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
  "suggested_account_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "suggested_account_code": "4605",
  "suggested_account_name": "Brandstof",
  "description": "Fuel purchase",
  "confidence": 0.95
}

⚠️ CRITICAL REMINDER:
- suggested_account_id = The UUID from the accounts list (looks like "a1b2c3d4-5678-90ab-cdef-1234567890ab")
- suggested_account_code = The 4-digit code (looks like "4605")
- suggested_account_name = The account name (looks like "Brandstof")
- ALL THREE must come from the SAME account in the list below
- Do NOT invent UUIDs - copy them EXACTLY from the list

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

    // ═══════════════════════════════════════════════════════════════
    // VALIDATION & AUTO-CORRECTION: Code → UUID Mapping
    // ═══════════════════════════════════════════════════════════════
    // Problem: AI sometimes returns a CODE (e.g., "4510") in the suggested_account_id field
    // Solution: Detect this and convert CODE → UUID using the accounts list

    console.log('🔍 [VALIDATION] Checking AI account suggestion...');
    console.log(`   Raw suggested_account_id: ${extractedData.suggested_account_id}`);
    console.log(`   Raw suggested_account_code: ${extractedData.suggested_account_code}`);

    let validatedAccount = null;

    // STEP 1: Check if suggested_account_id looks like a CODE instead of UUID
    if (extractedData.suggested_account_id) {
      const suggestedId = String(extractedData.suggested_account_id);

      // UUID pattern: 8-4-4-4-12 hex characters
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(suggestedId);

      if (isUUID) {
        // Looks like a UUID - validate it exists
        validatedAccount = accountList.find(acc => acc.id === suggestedId);
        if (validatedAccount) {
          console.log('   ✓ Valid UUID found:', validatedAccount.code, validatedAccount.name);
        } else {
          console.log('   ⚠️ UUID not found in database:', suggestedId);
        }
      } else {
        // Looks like a CODE (e.g., "4510") - convert to UUID
        console.log(`   🔄 AI returned CODE instead of UUID: "${suggestedId}"`);
        validatedAccount = accountList.find(acc => acc.code === suggestedId);
        if (validatedAccount) {
          console.log(`   ✓ Converted CODE → UUID: ${suggestedId} → ${validatedAccount.id}`);
          extractedData.suggested_account_id = validatedAccount.id;
          extractedData.suggested_account_code = validatedAccount.code;
          extractedData.suggested_account_name = validatedAccount.name;
        } else {
          console.log(`   ❌ CODE "${suggestedId}" not found in database`);
        }
      }
    }

    // STEP 2: If no valid ID yet, try using the suggested_account_code field
    if (!validatedAccount && extractedData.suggested_account_code) {
      const suggestedCode = String(extractedData.suggested_account_code);
      console.log(`   🔄 Trying to find account by code: "${suggestedCode}"`);

      validatedAccount = accountList.find(acc => acc.code === suggestedCode);
      if (validatedAccount) {
        console.log(`   ✓ Found account by code: ${validatedAccount.code} ${validatedAccount.name}`);
        extractedData.suggested_account_id = validatedAccount.id;
        extractedData.suggested_account_code = validatedAccount.code;
        extractedData.suggested_account_name = validatedAccount.name;
      } else {
        console.log(`   ❌ Code "${suggestedCode}" not found in database`);
      }
    }

    // STEP 3: Clean up if no valid account found
    if (!validatedAccount) {
      console.log('   ❌ No valid account found - removing all suggestions');
      extractedData.suggested_account_id = undefined;
      extractedData.suggested_account_code = undefined;
      extractedData.suggested_account_name = undefined;
    } else {
      console.log('   ✅ Final validated account:', {
        id: validatedAccount.id,
        code: validatedAccount.code,
        name: validatedAccount.name,
      });
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
