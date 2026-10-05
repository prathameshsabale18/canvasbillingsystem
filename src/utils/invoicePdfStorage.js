import { supabase } from '../supabaseClient';

export const INVOICE_PDF_BUCKET = 'invoice-pdfs';

function getInvoicePdfPath(invoiceId) {
  return `invoices/${invoiceId}.pdf`;
}

export async function saveInvoicePdf(invoiceId, pdfBlob) {
  if (!invoiceId || !pdfBlob) {
    throw new Error('Invoice ID and PDF are required to save the invoice PDF.');
  }

  const path = getInvoicePdfPath(invoiceId);
  const { error: uploadError } = await supabase.storage
    .from(INVOICE_PDF_BUCKET)
    .upload(path, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`PDF upload failed: ${uploadError.message}`);
  }

  const { error: invoiceError } = await supabase
    .from('invoices')
    .update({ pdf_storage_path: path })
    .eq('id', invoiceId);

  if (invoiceError) {
    throw new Error(`Invoice PDF path update failed: ${invoiceError.message}`);
  }
  return path;
}

export async function downloadSavedInvoicePdf(invoice) {
  const path = invoice?.pdf_storage_path;
  if (!path) throw new Error('This invoice does not have a saved PDF.');

  const { data, error } = await supabase.storage
    .from(INVOICE_PDF_BUCKET)
    .download(path);

  if (error) throw error;
  return data;
}

export async function removeSavedInvoicePdf(invoice) {
  const path = invoice?.pdf_storage_path;
  if (!path) return;

  const { error } = await supabase.storage
    .from(INVOICE_PDF_BUCKET)
    .remove([path]);

  if (error) throw error;
}
