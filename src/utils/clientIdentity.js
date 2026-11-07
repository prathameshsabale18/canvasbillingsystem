export const invoiceClientName = invoice =>
  String(invoice?.clients?.client_name || invoice?.client_name || '').trim();

export const invoiceClientGst = invoice =>
  String(invoice?.client_gstin || invoice?.clients?.gst_no || '').trim();

export const clientGroupKey = value => String(value || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/\([^)]*\)/g, ' ')
  .replace(/\b(private|pvt|limited|ltd|llp|incorporated|inc|company|co)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
