const MANTHAN_GSTIN = '27AJKPJ5733E1Z7';

const correctedGstForClient = name =>
  /\bmanthan\s+architects\b/i.test(String(name || ''))
    ? MANTHAN_GSTIN
    : '';

export const invoiceClientName = invoice =>
  String(invoice?.clients?.client_name || invoice?.client_name || '').trim();

export const clientGst = client => {
  const name = client?.client_name || client?.name || '';
  return correctedGstForClient(name) || String(client?.gst_no || '').trim();
};

export const invoiceClientGst = invoice =>
  correctedGstForClient(invoiceClientName(invoice)) ||
  String(invoice?.client_gstin || invoice?.clients?.gst_no || '').trim();

export const clientGroupKey = value => String(value || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/\([^)]*\)/g, ' ')
  .replace(/\b(private|pvt|limited|ltd|llp|incorporated|inc|company|co)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+cha$/, '')
  .replace(/\s+/g, ' ')
  .trim();
