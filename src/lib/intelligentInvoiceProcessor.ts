/**
 * Intelligent Invoice Processor
 *
 * Orchestrates the complete invoice processing pipeline:
 * 1. AI Extraction (eyes) - Extract structured data from PDF
 * 2. AI Enrichment (brain) - Match suppliers, determine categories
 * 3. Payment Matching - Link to existing bank transactions
 * 4. Booking Suggestions - Propose journal entries
 *
 * This service creates a rich extracted_data object for the UI
 */

import { analyzeInvoice } from './aiService';
import { findPaymentMatch, type PaymentMatchResult } from './invoicePaymentMatchingService';
import { enrichTransactionWithTavily } from './tavilyEnrichmentService';
import { findBestAccountMatch } from './invoiceAccountMatcher';
import { supabase } from './supabase';
import type { Database, ExtractedInvoiceData } from './database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];

export interface EnhancedInvoiceData extends ExtractedInvoiceData {
  contact_id?: string;
  contact_name?: string;
  is_new_supplier?: boolean;

  suggested_account_id?: string;
  suggested_account_code?: string;
  suggested_account_name?: string;

  payment_match?: PaymentMatchResult;

  enrichment?: {
    tavily_used: boolean;
    confidence: number;
    reason: string;
  };

  booking_ready: boolean;
  processing_notes: string[];
}

export async function processInvoiceWithAI(
  fileUrl: string,
  documentId: string
): Promise<EnhancedInvoiceData> {
  console.log('\n' + '═'.repeat(70));
  console.log('🚀 [INTELLIGENT PROCESSOR] Starting invoice processing pipeline');
  console.log(`📄 Document ID: ${documentId}`);
  console.log('═'.repeat(70));

  const notes: string[] = [];

  try {
    const { data: document } = await supabase
      .from('documents_inbox')
      .select('file_type')
      .eq('id', documentId)
      .single();

    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true);

    if (!accounts || accounts.length === 0) {
      throw new Error('No active accounts found in database');
    }

    console.log('\n📊 STEP 1: AI Extraction (The Eyes)');
    console.log('─'.repeat(70));

    const extractedData = await analyzeInvoice(
      fileUrl,
      accounts,
      document?.file_type || undefined
    );

    console.log('✓ Extraction complete:', {
      supplier: extractedData.supplier_name,
      amount: extractedData.total_amount,
      date: extractedData.invoice_date,
    });

    notes.push('AI extractie voltooid');

    console.log('\n🧠 STEP 2: Supplier Matching & Enrichment');
    console.log('─'.repeat(70));

    let contactId = extractedData.contact_id;
    let contactName = extractedData.supplier_name;
    let isNewSupplier = extractedData.is_new_supplier !== false;

    if (!contactId && extractedData.supplier_name) {
      console.log('  Searching for existing supplier...');

      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('*')
        .ilike('company_name', `%${extractedData.supplier_name}%`)
        .eq('is_active', true)
        .limit(1);

      if (existingContacts && existingContacts.length > 0) {
        contactId = existingContacts[0].id;
        contactName = existingContacts[0].company_name;
        isNewSupplier = false;
        console.log(`  ✓ Found existing supplier: ${contactName}`);
        notes.push(`Leverancier gevonden: ${contactName}`);
      } else {
        isNewSupplier = true;
        console.log('  ! Supplier not found - will need to be created');
        notes.push(`Nieuwe leverancier: ${extractedData.supplier_name}`);
      }
    }

    console.log('\n💰 STEP 3: Payment Matching');
    console.log('─'.repeat(70));

    let paymentMatch: PaymentMatchResult | undefined;

    if (extractedData.invoice_date && extractedData.total_amount) {
      paymentMatch = await findPaymentMatch(
        extractedData.invoice_date,
        extractedData.total_amount,
        extractedData.supplier_name
      );

      if (paymentMatch.matched) {
        console.log(`  ✓ Payment match found: €${paymentMatch.matchedAmount} (${paymentMatch.matchConfidence}% confidence)`);
        notes.push(paymentMatch.reason);
      } else {
        console.log('  ! No payment match found');
        notes.push('Geen betaling gevonden - boeken als Te Betalen');
      }
    } else {
      console.log('  ⚠ Insufficient data for payment matching');
      notes.push('Onvoldoende data voor betalingsmatch');
    }

    console.log('\n📋 STEP 4: Smart Category Enhancement (with VAT Validation)');
    console.log('─'.repeat(70));

    let accountId = extractedData.suggested_account_id;
    let accountCode = extractedData.suggested_account_code;
    let accountName = extractedData.suggested_account_name;
    let tavilyUsed = false;
    let detectedIndustry: string | undefined;
    let enrichmentReason: string | undefined;

    // Always try to find the best account match using smart matching
    if (extractedData.supplier_name) {
      console.log(`  🔍 Starting smart account matching...`);

      // First, try Tavily enrichment to get industry/tags
      let industry: string | undefined;
      let tags: string[] = [];

      // Build enrichment context from extracted data
      const enrichmentContext = {
        name: extractedData.supplier_name,
        city: (extractedData as any).supplier_city,
        address: (extractedData as any).supplier_address,
        categoryClues: (extractedData as any).category_clues,
      };

      console.log('  📍 Enrichment context:', {
        name: enrichmentContext.name,
        city: enrichmentContext.city || 'not provided',
        address: enrichmentContext.address || 'not provided',
        clues: enrichmentContext.categoryClues || 'not provided',
      });

      const tavilyEnrichment = await enrichTransactionWithTavily(
        enrichmentContext,
        extractedData.total_amount
      );

      if (tavilyEnrichment) {
        industry = tavilyEnrichment.companyType;
        detectedIndustry = industry;
        tavilyUsed = true;
        console.log(`  ✓ Tavily enrichment: Industry = "${industry}"`);

        // Log the search query that was used
        if (tavilyEnrichment.debug_info?.search_query) {
          console.log(`  🔍 Search query used: "${tavilyEnrichment.debug_info.search_query}"`);
        }

        // Extract tags from reason if available
        if (tavilyEnrichment.debug_info?.tavily_output) {
          try {
            const tavilyData = JSON.parse(tavilyEnrichment.debug_info.tavily_output);
            if (tavilyData.answer && typeof tavilyData.answer === 'string') {
              // Extract potential tags from answer
              const lowerAnswer = tavilyData.answer.toLowerCase();
              if (lowerAnswer.includes('software')) tags.push('software');
              if (lowerAnswer.includes('saas')) tags.push('saas');
              if (lowerAnswer.includes('cloud')) tags.push('cloud');
              if (lowerAnswer.includes('hosting')) tags.push('hosting');
              if (lowerAnswer.includes('subscription')) tags.push('subscription');
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      } else {
        console.log(`  ℹ Tavily enrichment not available, using AI suggestion as fallback`);
      }

      // Now use smart matching with VAT validation
      const matchResult = await findBestAccountMatch(
        extractedData.supplier_name,
        industry,
        tags.length > 0 ? tags : undefined,
        extractedData.net_amount,
        extractedData.vat_amount,
        extractedData.total_amount
      );

      if (matchResult) {
        const aiConfidence = extractedData.confidence || 0;

        // PRIORITY LOGIC: Tavily ALWAYS wins over OpenAI
        // If we have Tavily enrichment data, use smart match result
        // Otherwise, only use smart match if it's better than AI
        const shouldUseSmartMatch =
          tavilyUsed ||                                    // Tavily always wins
          !accountId ||                                    // No AI suggestion
          matchResult.matchType === 'keyword_vat' ||       // Perfect match
          matchResult.confidence > aiConfidence;           // Better confidence

        if (shouldUseSmartMatch) {
          accountId = matchResult.accountId;
          accountCode = matchResult.accountCode;
          accountName = matchResult.accountName;
          enrichmentReason = matchResult.reason;

          const source = tavilyUsed ? 'Tavily + Smart Match' : 'Smart Match';
          console.log(`  ✓ ${source} Used: ${accountCode} - ${accountName}`);
          console.log(`    Match Type: ${matchResult.matchType}`);
          console.log(`    Confidence: ${(matchResult.confidence * 100).toFixed(0)}%`);
          console.log(`    Reason: ${matchResult.reason}`);

          if (tavilyUsed) {
            notes.push(`Tavily enrichment: ${accountName} (${matchResult.matchType}, ${(matchResult.confidence * 100).toFixed(0)}%)`);
          } else {
            notes.push(`Smart matching: ${accountName} (${matchResult.matchType}, ${(matchResult.confidence * 100).toFixed(0)}%)`);
          }
        } else {
          console.log(`  ℹ AI suggestion kept (AI: ${(aiConfidence * 100).toFixed(0)}% confidence, no Tavily data)`);
          notes.push(`Categorie voorgesteld: ${accountName} (AI confidence: ${(aiConfidence * 100).toFixed(0)}%)`);
        }
      } else if (accountId) {
        console.log(`  ℹ Smart matching failed, keeping AI suggestion: ${accountCode} - ${accountName}`);
        notes.push(`Categorie voorgesteld: ${accountName} (Smart matching niet beschikbaar)`);
      } else {
        console.log('  ⚠ No category determined');
        notes.push('Geen categorie bepaald - handmatig invoeren');
      }
    } else {
      console.log('  ⚠ No supplier name - cannot determine category');
      notes.push('Geen leverancier naam - handmatig invoeren');
    }

    const bookingReady = !!(
      contactId &&
      extractedData.invoice_date &&
      extractedData.total_amount &&
      accountId
    );

    console.log('\n✅ PROCESSING COMPLETE');
    console.log('─'.repeat(70));
    console.log(`Booking Ready: ${bookingReady ? 'YES' : 'NO'}`);
    console.log(`Contact: ${contactName || 'Unknown'}`);
    console.log(`Account: ${accountCode || 'Not set'} - ${accountName || 'Not set'}`);
    console.log(`Payment: ${paymentMatch?.matched ? 'Matched' : 'Not matched'}`);
    console.log('═'.repeat(70) + '\n');

    const result: EnhancedInvoiceData = {
      ...extractedData,
      contact_id: contactId,
      contact_name: contactName,
      is_new_supplier: isNewSupplier,
      suggested_account_id: accountId,
      suggested_account_code: accountCode,
      suggested_account_name: accountName,
      payment_match: paymentMatch,
      enrichment: tavilyUsed || enrichmentReason ? {
        tavily_used: tavilyUsed,
        confidence: extractedData.confidence || 0,
        reason: enrichmentReason || (detectedIndustry ? `Industry: ${detectedIndustry} → ${accountName}` : `Matched: ${accountName}`),
      } : undefined,
      booking_ready: bookingReady,
      processing_notes: notes,
    };

    await supabase
      .from('documents_inbox')
      .update({
        extracted_data: result as any,
        status: 'Review_Needed',
      })
      .eq('id', documentId);

    return result;

  } catch (error) {
    console.error('❌ [INTELLIGENT PROCESSOR] Processing failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    notes.push(`Fout: ${errorMessage}`);

    await supabase
      .from('documents_inbox')
      .update({
        status: 'Error',
        error_message: errorMessage,
      })
      .eq('id', documentId);

    throw error;
  }
}

export async function bulkProcessDocuments(documentIds: string[]): Promise<{
  processed: number;
  failed: number;
  errors: string[];
}> {
  console.log(`\n🔄 [BULK PROCESSOR] Processing ${documentIds.length} documents...`);

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const docId of documentIds) {
    try {
      const { data: doc } = await supabase
        .from('documents_inbox')
        .select('file_url')
        .eq('id', docId)
        .single();

      if (!doc) {
        throw new Error('Document not found');
      }

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('invoices')
        .createSignedUrl(doc.file_url, 300);

      if (signedUrlError || !signedUrlData) {
        throw new Error('Kon geen signed URL maken voor AI verwerking');
      }

      await processInvoiceWithAI(signedUrlData.signedUrl, docId);
      processed++;
    } catch (error) {
      failed++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${docId}: ${errorMsg}`);
      console.error(`❌ Failed to process ${docId}:`, error);
    }
  }

  console.log(`✅ Bulk processing complete: ${processed} succeeded, ${failed} failed`);

  return { processed, failed, errors };
}
