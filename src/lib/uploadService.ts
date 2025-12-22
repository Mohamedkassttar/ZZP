import { supabase } from './supabase';
import { analyzeInvoice } from './aiService';
import type { Database } from './database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

export interface UploadResult {
  success: boolean;
  documentId?: string;
  error?: string;
}

export async function uploadAndProcessInvoice(
  file: File,
  accounts: Account[]
): Promise<UploadResult> {
  try {
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
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: document, error: docError } = await supabase
      .from('documents_inbox')
      .insert({
        file_url: uploadData.path,
        file_name: file.name,
        file_type: file.type,
        status: 'Processing',
      })
      .select()
      .single();

    if (docError) {
      await supabase.storage.from('invoices').remove([uploadData.path]);
      throw new Error(`Failed to create document record: ${docError.message}`);
    }

    processDocumentAsync(document.id, uploadData.path, accounts);

    return {
      success: true,
      documentId: document.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

async function processDocumentAsync(
  documentId: string,
  filePath: string,
  accounts: Account[]
): Promise<void> {
  try {
    const { data: doc } = await supabase
      .from('documents_inbox')
      .select('file_type')
      .eq('id', documentId)
      .single();

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('invoices')
      .createSignedUrl(filePath, 300);

    if (signedUrlError || !signedUrlData) {
      throw new Error('Kon geen signed URL maken voor AI verwerking');
    }

    const extractedData = await analyzeInvoice(
      signedUrlData.signedUrl,
      accounts,
      doc?.file_type || undefined
    );

    await supabase
      .from('documents_inbox')
      .update({
        status: 'Review_Needed',
        extracted_data: extractedData,
      })
      .eq('id', documentId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'AI processing failed';

    await supabase
      .from('documents_inbox')
      .update({
        status: 'Error',
        error_message: errorMessage,
      })
      .eq('id', documentId);
  }
}

export async function deleteDocument(documentId: string, filePath: string): Promise<boolean> {
  try {
    const { error: dbError } = await supabase
      .from('documents_inbox')
      .delete()
      .eq('id', documentId);

    if (dbError) throw dbError;

    const { error: storageError } = await supabase.storage
      .from('invoices')
      .remove([filePath]);

    if (storageError) throw storageError;

    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    return false;
  }
}

export async function getSignedUrl(filePath: string, expiresIn: number = 300): Promise<string> {
  const { data, error } = await supabase.storage
    .from('invoices')
    .createSignedUrl(filePath, expiresIn);

  if (error || !data) {
    throw new Error('Kon geen signed URL maken');
  }

  return data.signedUrl;
}
