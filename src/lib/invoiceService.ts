import { supabase } from './supabase';
import { processInvoiceWithAI } from './intelligentInvoiceProcessor';
import { bookInvoice, type PaymentMethod } from './invoiceBookingService';
import type { EnhancedInvoiceData } from './intelligentInvoiceProcessor';
import { getCurrentCompanyId } from './companyHelper';

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
    console.log('[Upload Debug] Starting upload:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    const companyId = await getCurrentCompanyId();
    if (!companyId) throw new Error('Geen bedrijf geselecteerd');

    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop() || '';

    const validExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    const validMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    ];

    const isValidByExtension = validExtensions.includes(fileExtension);
    const isValidByMimeType = file.type !== '' && (
      validMimeTypes.includes(file.type) ||
      validMimeTypes.some(type => file.type.includes(type.split('/')[1]))
    );
    const isValidByName = /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(fileName);

    if (!isValidByExtension && !isValidByMimeType && !isValidByName && file.type !== '') {
      console.error('[Upload Debug] Invalid file type:', { type: file.type, extension: fileExtension });
      return {
        success: false,
        error: `Ongeldig bestandstype: ${file.type} (.${fileExtension}). Toegestaan: PDF, JPG, PNG, WEBP, HEIC`,
      };
    }

    console.log('[Upload Debug] File validation passed:', {
      isValidByExtension,
      isValidByMimeType,
      isValidByName
    });

    if (file.size > 10 * 1024 * 1024) {
      return {
        success: false,
        error: 'Bestand is te groot (maximaal 10MB)',
      };
    }

    const rawFileName = file.name.split('/').pop()?.split('\\').pop() || 'unknown';

    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}_${rawFileName}`;

    const BUCKET = 'invoices';
    const FOLDER = 'invoices';
    const storagePath = `${FOLDER}/${uniqueFileName}`;

    let detectedContentType = file.type;
    if (!detectedContentType || detectedContentType === '') {
      if (fileExtension === 'heic' || fileExtension === 'heif') {
        detectedContentType = 'image/heic';
      } else if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
        detectedContentType = 'image/jpeg';
      } else if (fileExtension === 'png') {
        detectedContentType = 'image/png';
      } else if (fileExtension === 'webp') {
        detectedContentType = 'image/webp';
      } else if (fileExtension === 'pdf') {
        detectedContentType = 'application/pdf';
      } else {
        detectedContentType = 'application/octet-stream';
      }
    }

    console.log('[Upload Debug] Uploading to storage:', {
      path: storagePath,
      contentType: detectedContentType
    });

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: detectedContentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Upload Debug] Storage error:', uploadError);
      return {
        success: false,
        error: `Upload fout: ${uploadError.message}`,
      };
    }

    console.log('[Upload Debug] Storage upload successful, creating database record...');

    const { data: document, error: insertError } = await supabase
      .from('documents_inbox')
      .insert({
        file_url: uploadData.path,
        file_name: rawFileName,
        file_type: detectedContentType,
        status: 'Processing',
        source: 'portal',
        company_id: companyId,
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
    const companyId = await getCurrentCompanyId();
    if (!companyId) throw new Error('Geen bedrijf geselecteerd');

    const { data: document, error: docError } = await supabase
      .from('documents_inbox')
      .select('file_url')
      .eq('id', documentId)
      .eq('company_id', companyId)
      .single();

    if (docError || !document) {
      return {
        success: false,
        documentId,
        error: 'Document niet gevonden',
      };
    }

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

    const extractedData = await processInvoiceWithAI(signedUrlData.signedUrl, documentId);

    const { error: updateError } = await supabase
      .from('documents_inbox')
      .update({
        status: 'Review_Needed',
        extracted_data: extractedData as any,
      })
      .eq('id', documentId)
      .eq('company_id', companyId);

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

    const companyId = await getCurrentCompanyId();
    if (companyId) {
      await supabase
        .from('documents_inbox')
        .update({
          status: 'Error',
          processing_notes: err instanceof Error ? err.message : 'Onbekende fout',
        })
        .eq('id', documentId)
        .eq('company_id', companyId);
    }

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
    const companyId = await getCurrentCompanyId();
    if (!companyId) throw new Error('Geen bedrijf geselecteerd');

    await supabase.from('documents_inbox').delete().eq('id', documentId).eq('company_id', companyId);
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
  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error('Geen bedrijf geselecteerd');

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
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
  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error('Geen bedrijf geselecteerd');

  const { data, error } = await supabase
    .from('contacts')
    .select('id, company_name, email, vat_number')
    .eq('company_id', companyId)
    .or('relation_type.eq.Supplier,relation_type.eq.Both')
    .eq('is_active', true)
    .order('company_name');

  if (error) {
    console.error('Failed to load suppliers:', error);
    return [];
  }

  return data || [];
}

export async function getInboxDocuments() {
  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error('Geen bedrijf geselecteerd');

  const { data, error } = await supabase
    .from('documents_inbox')
    .select('*')
    .eq('company_id', companyId)
    .in('status', ['Review_Needed', 'Processing'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load inbox documents:', error);
    throw error;
  }

  return data || [];
}

export async function getBookedInvoices() {
  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error('Geen bedrijf geselecteerd');

  const { data, error } = await supabase
    .from('purchase_invoices')
    .select(`
      id,
      invoice_number,
      invoice_date,
      total_amount,
      status,
      contact:contacts!inner(company_name),
      document:documents_inbox!inner(file_url, file_name)
    `)
    .eq('company_id', companyId)
    .eq('contacts.company_id', companyId)
    .eq('documents_inbox.company_id', companyId)
    .order('invoice_date', { ascending: false });

  if (error) {
    console.error('Failed to load booked invoices:', error);
    throw error;
  }

  return data || [];
}

export async function getAllAccounts() {
  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error('Geen bedrijf geselecteerd');

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (error) {
    console.error('Failed to load accounts:', error);
    throw error;
  }

  if (!data) return [];

  return data.sort((a, b) => parseInt(a.code) - parseInt(b.code));
}

export async function getAllContacts() {
  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error('Geen bedrijf geselecteerd');

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (error) {
    console.error('Failed to load contacts:', error);
    throw error;
  }

  if (!data) return [];

  return data.sort((a, b) => a.company_name.localeCompare(b.company_name));
}
