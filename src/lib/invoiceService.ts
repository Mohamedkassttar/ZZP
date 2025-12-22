import { supabase } from './supabase';
import { processInvoiceWithAI } from './intelligentInvoiceProcessor';
import { bookInvoice, type PaymentMethod } from './invoiceBookingService';
import type { EnhancedInvoiceData } from './intelligentInvoiceProcessor';

export interface UploadInvoiceResult {
  success: boolean;
  documentId?: string;
  error?: string;
}

export interface ProcessInvoiceResult {
  success: boolean;
  documentId: string;
  extractedData?: EnhancedInvoiceData;
  error?: string;
}

export interface BookInvoiceInput {
  documentId: string;
  invoiceData: EnhancedInvoiceData;
  expenseAccountId: string;
  supplierContactId?: string;
  paymentMethod?: PaymentMethod;
}

export interface BookInvoiceResult {
  success: boolean;
  purchaseInvoiceId?: string;
  journalEntryId?: string;
  error?: string;
}

export async function uploadInvoiceFile(file: File): Promise<UploadInvoiceResult> {
  try {
    if (!file.type.match(/^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/)) {
      return {
        success: false,
        error: 'Alleen PDF en afbeeldingen (JPEG, PNG, WebP) worden ondersteund',
      };
    }

    if (file.size > 10 * 1024 * 1024) {
      return {
        success: false,
        error: 'Bestand is te groot (maximaal 10MB)',
      };
    }

    // CRITICAL: Sanitize filename - strip any directory paths
    // If file.name contains "invoices/file.pdf", we only want "file.pdf"
    const rawFileName = file.name.split('/').pop()?.split('\\').pop() || 'unknown';

    // Build clean path with timestamp
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}_${rawFileName}`;

    // Define storage structure (never trust input paths)
    const BUCKET = 'invoices';
    const FOLDER = 'invoices';
    const storagePath = `${FOLDER}/${uniqueFileName}`;

    console.log('📤 Upload Info:', {
      originalName: file.name,
      sanitizedName: rawFileName,
      storagePath,
      bucket: BUCKET
    });

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return {
        success: false,
        error: `Upload fout: ${uploadError.message}`,
      };
    }

    console.log('✓ Upload successful, path:', uploadData.path);

    const { data: document, error: insertError } = await supabase
      .from('documents_inbox')
      .insert({
        file_url: uploadData.path,
        file_name: rawFileName,
        file_type: file.type,
        status: 'Processing',
        source: 'portal',
      })
      .select()
      .single();

    if (insertError || !document) {
      return {
        success: false,
        error: `Database fout: ${insertError?.message || 'Onbekend'}`,
      };
    }

    return {
      success: true,
      documentId: document.id,
    };
  } catch (err) {
    console.error('Unexpected error in uploadInvoiceFile:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Onbekende fout bij uploaden',
    };
  }
}

export async function processAndExtractInvoice(
  documentId: string
): Promise<ProcessInvoiceResult> {
  try {
    const { data: document, error: docError } = await supabase
      .from('documents_inbox')
      .select('file_url')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return {
        success: false,
        documentId,
        error: 'Document niet gevonden',
      };
    }

    console.log('📄 Processing document:', {
      documentId,
      file_url: document.file_url
    });

    // CRITICAL: Use signed URL for external access (OpenAI)
    // Public URLs may not work for all Supabase configurations
    const BUCKET = 'invoices';
    const EXPIRY_SECONDS = 3600; // 1 hour

    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(document.file_url, EXPIRY_SECONDS);

    if (urlError || !signedUrlData) {
      console.error('Failed to create signed URL:', urlError);
      throw new Error(`Kan geen toegangslink maken: ${urlError?.message}`);
    }

    console.log('✓ Signed URL created for OpenAI:', signedUrlData.signedUrl.substring(0, 100) + '...');

    const extractedData = await processInvoiceWithAI(signedUrlData.signedUrl, documentId);

    const { error: updateError } = await supabase
      .from('documents_inbox')
      .update({
        status: 'Review_Needed',
        extracted_data: extractedData as any,
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Failed to update document status:', updateError);
    }

    console.log('✓ Document processed successfully');

    return {
      success: true,
      documentId,
      extractedData,
    };
  } catch (err) {
    console.error('Error in processAndExtractInvoice:', err);

    await supabase
      .from('documents_inbox')
      .update({
        status: 'Error',
        processing_notes: err instanceof Error ? err.message : 'Onbekende fout',
      })
      .eq('id', documentId);

    return {
      success: false,
      documentId,
      error: err instanceof Error ? err.message : 'Fout bij verwerken factuur',
    };
  }
}

export async function uploadAndProcessInvoice(file: File): Promise<ProcessInvoiceResult> {
  const uploadResult = await uploadInvoiceFile(file);

  if (!uploadResult.success || !uploadResult.documentId) {
    return {
      success: false,
      documentId: '',
      error: uploadResult.error,
    };
  }

  return await processAndExtractInvoice(uploadResult.documentId);
}

export async function bookInvoiceFromPortal(
  input: BookInvoiceInput
): Promise<BookInvoiceResult & { paymentAccountUsed?: { code: string; name: string } }> {
  try {
    const result = await bookInvoice({
      documentId: input.documentId,
      invoiceData: input.invoiceData,
      expenseAccountId: input.expenseAccountId,
      supplierContactId: input.supplierContactId,
      paymentMethod: input.paymentMethod,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Onbekende fout bij boeken',
      };
    }

    return {
      success: true,
      purchaseInvoiceId: result.purchaseInvoiceId,
      journalEntryId: result.journalEntryId,
      paymentAccountUsed: result.paymentAccountUsed,
    };
  } catch (err) {
    console.error('Error in bookInvoiceFromPortal:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Onbekende fout',
    };
  }
}

export async function deleteInvoiceDocument(documentId: string, fileUrl: string) {
  try {
    await supabase.from('documents_inbox').delete().eq('id', documentId);
    await supabase.storage.from('invoices').remove([fileUrl]);
    return { success: true };
  } catch (err) {
    console.error('Error deleting document:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fout bij verwijderen',
    };
  }
}

export async function getExpenseAccounts() {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'Expense')
    .eq('is_active', true)
    .order('code');

  if (error) {
    console.error('Failed to load expense accounts:', error);
    return [];
  }

  return data || [];
}

export async function getSuppliers() {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, company_name, email, vat_number')
    .or('relation_type.eq.Supplier,relation_type.eq.Both')
    .eq('is_active', true)
    .order('company_name');

  if (error) {
    console.error('Failed to load suppliers:', error);
    return [];
  }

  return data || [];
}
