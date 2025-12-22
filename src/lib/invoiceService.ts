import { supabase } from './supabase';
import { processInvoiceWithAI } from './intelligentInvoiceProcessor';
import { bookInvoice } from './invoiceBookingService';
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

    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const filePath = `invoices/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false,
        error: `Upload fout: ${uploadError.message}`,
      };
    }

    const { data: document, error: insertError } = await supabase
      .from('documents_inbox')
      .insert({
        file_url: uploadData.path,
        file_name: file.name,
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

    const { data: publicUrlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(document.file_url);

    const extractedData = await processInvoiceWithAI(publicUrlData.publicUrl, documentId);

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
): Promise<BookInvoiceResult> {
  try {
    const result = await bookInvoice({
      documentId: input.documentId,
      invoiceData: input.invoiceData,
      expenseAccountId: input.expenseAccountId,
      supplierContactId: input.supplierContactId,
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
