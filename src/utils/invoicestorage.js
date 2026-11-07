// src/utils/invoicestorage.js
import { toStoredInvoiceDate, getTodayInvoiceDate } from './invoiceDates';

export function getSavedInvoices() {
  try {
    const data = localStorage.getItem('canvas_invoice_history');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveInvoiceRecord(invoiceData, totals) {
  const invoices = getSavedInvoices();
  const record = {
    id: invoiceData.invoiceNo || `INV-${Date.now().toString().slice(-6)}`,
    date: toStoredInvoiceDate(invoiceData.invoiceDate) || getTodayInvoiceDate(),
    clientName: invoiceData.client?.name || invoiceData.clientName || 'Unknown Client',
    gstin: invoiceData.client?.gstin || invoiceData.clientGstin || '',
    items: totals.items || invoiceData.items || [],
    grandTotal: totals.grandTotal || invoiceData.grandTotal || 0,
    createdAt: new Date().toISOString(),
  };

  const filtered = invoices.filter(inv => inv.id !== record.id);
  const updated = [record, ...filtered];
  localStorage.setItem('canvas_invoice_history', JSON.stringify(updated));
  return updated;
}
