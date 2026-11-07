import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import download from 'downloadjs';
import { numberToWords } from './calculations';

const W = 595.28;
const H = 841.89;
const px = (lp) => (lp / 100) * W;
const py = (tp) => H - (tp / 100) * H;
const fmt = (n) => Number(n || 0).toFixed(2);

/**
 * Strips all non-ASCII characters (including ⚠ ₹ emojis) before any text
 * reaches pdf-lib's WinAnsi-encoded Helvetica font.
 */
function cleanText(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/₹/g, 'Rs. ')
    .replace(/[\u20B9]/g, 'Rs. ')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATE MAP
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  // Right column: Invoice No / Date  (row ~22%)
  invoiceNo:   [63,   22.0],
  invoiceDate: [82.5, 22.0],

  // LEFT: client name / address   (~31-37%)
  clientName:  [2,    31.0],
  addrStart:   [2,    33.6],  // first address line; each wrap adds 2.3% down
  addrLineH:   2.3,

  // RIGHT: client GST / State / State Code
  clientGstin:     [60, 28.6],
  clientState:     [58, 31.8],
  clientStateCode: [86, 31.8],

  // PO row  (~37.2%)
  poNo:         [11,  37.2],
  poDate:       [33,  37.2],
  vendorCode:   [65,  37.2],

  // Items table
  itemStartTop: 40.8,   // top% of first item row
  itemRowH:     2.55,   // % of page height per row

  // Item column left% positions
  col: {
    sr:   3.5,
    desc: 7.5,
    hsn:  49,
    qty:  57.5,
    rate: 64.5,
    per:  72.5,
    amt:  97.5,   // right-aligned
  },

  // Invoice value in words  (~70%)
  words: [2, 70.2],

  // Totals (right-aligned at 97.5%)
  totX:       97.5,
  totAV:      69.5,
  totFreight: 71.55,
  totST:      73.6,
  totCGST:    75.65,
  totSGST:    77.7,
  totIGST:    79.75,
  totGrand:   83.6,
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE ENGINE
// ─────────────────────────────────────────────────────────────────────────────
async function buildPDF(invoiceData, totals, mode = 'invoice') {
  const isChallan = mode === 'challan' || invoiceData.docType === 'DC_CHALLAN';
  const {
    invoiceNo = '', invoiceDate = '',
    poNo = '',      poDate = '',
    clientName = '', clientAddress = '',
    clientGstin = '', clientState = '', clientStateCode = '',
    clientVendorCode = '', freight = 0,
  } = invoiceData;

  const { items = [], assessableValue = 0, cgst = 0, sgst = 0, igst = 0, grandTotal = 0 } = totals || {};
  const subTotal = assessableValue + Number(freight);
  const inWords  = `INR ${numberToWords(grandTotal)}`;

  let pdfDoc;
  let page;

  // 1. Load Background Template
  if (isChallan) {
    // Load DCCHALLAN.pdf directly from public folder
    try {
      const res = await fetch('/DCCHALLAN.pdf');
      if (!res.ok) throw new Error('DCCHALLAN.pdf not found');
      const bytes = await res.arrayBuffer();
      pdfDoc = await PDFDocument.load(bytes);
      page = pdfDoc.getPages()[0];
    } catch {
      pdfDoc = await PDFDocument.create();
      page = pdfDoc.addPage([W, H]);
      page.drawRectangle({ x: 10, y: 10, width: W - 20, height: H - 20,
        borderColor: rgb(0,0,0), borderWidth: 1.5 });
      page.drawText('⚠ Place DCCHALLAN.pdf in the /public folder', {
        x: 40, y: H / 2, size: 12, color: rgb(0.7, 0, 0),
      });
    }
  } else {
    // Original JPG template behavior for standard invoices
    pdfDoc = await PDFDocument.create();
    page = pdfDoc.addPage([W, H]);
    try {
      const res = await fetch('/template.jpg');
      if (!res.ok) throw new Error('Template image not found');
      const bytes = await res.arrayBuffer();
      const img   = await pdfDoc.embedJpg(bytes);
      page.drawImage(img, { x: 0, y: 0, width: W, height: H });
    } catch {
      page.drawRectangle({ x: 10, y: 10, width: W - 20, height: H - 20,
        borderColor: rgb(0,0,0), borderWidth: 1.5 });
      page.drawText('⚠ Place template.jpg in the /public folder', {
        x: 40, y: H / 2, size: 12, color: rgb(0.7, 0, 0),
      });
    }
  }

  // 2. Embed fonts  ──────────────────────────────────────────────────────────
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 3. Stamp helper  ─────────────────────────────────────────────────────────
  const stamp = (text, x, y, { size = 10, b = false, ra = false } = {}) => {
    const s = cleanText(text);
    if (!s) return;
    const fnt = b ? bold : regular;
    const xp  = ra ? x - fnt.widthOfTextAtSize(s, size) : x;
    page.drawText(s, { x: xp, y, size, font: fnt, color: rgb(0, 0, 0) });
  };

  // 4. INVOICE / CHALLAN META  ───────────────────────────────────────────────
  stamp(invoiceNo,   px(C.invoiceNo[0]),   py(C.invoiceNo[1]),   { size: 10, b: true });
  stamp(invoiceDate, px(C.invoiceDate[0]), py(C.invoiceDate[1]), { size: 10, b: true });

  // 5. RECEIVER DETAILS  ─────────────────────────────────────────────────────
  stamp(clientName, px(C.clientName[0]), py(C.clientName[1]), { size: 10, b: true });

  const addrLines = wrapAddress(clientAddress, 52);
  addrLines.slice(0, 3).forEach((line, i) =>
    stamp(line, px(C.addrStart[0]), py(C.addrStart[1] + i * C.addrLineH), { size: 9 })
  );

  // 6. CLIENT GST  ───────────────────────────────────────────────────────────
  stamp(clientGstin,     px(C.clientGstin[0]),     py(C.clientGstin[1]),     { size: 9.5 });
  stamp(clientState,     px(C.clientState[0]),     py(C.clientState[1]),     { size: 9.5 });
  stamp(clientStateCode, px(C.clientStateCode[0]), py(C.clientStateCode[1]), { size: 9.5 });

  // 7. PO ROW  ───────────────────────────────────────────────────────────────
  stamp(poNo,             px(C.poNo[0]),       py(C.poNo[1]),       { size: 9.5 });
  stamp(poDate,           px(C.poDate[0]),     py(C.poDate[1]),     { size: 9.5 });
  stamp(clientVendorCode, px(C.vendorCode[0]), py(C.vendorCode[1]), { size: 9.5 });

  // 8. ITEMS TABLE  ──────────────────────────────────────────────────────────
  const ITEM_Y0 = py(C.itemStartTop);
  const ROW_H   = (C.itemRowH / 100) * H;

  items.forEach((item, i) => {
    const y = ITEM_Y0 - i * ROW_H;
    stamp(i + 1,            px(C.col.sr),   y, { size: 9 });
    stamp(item.description, px(C.col.desc), y, { size: 9 });
    stamp(item.hsn,         px(C.col.hsn),  y, { size: 9 });
    stamp(item.quantity,    px(C.col.qty),  y, { size: 9 });
    stamp(item.per,         px(C.col.per),  y, { size: 9 });

    // Hide Rate & Amount if generating a DC Challan
    if (!isChallan) {
      stamp(fmt(item.rate),       px(C.col.rate), y, { size: 9 });
      stamp(fmt(item.lineAmount), px(C.col.amt),  y, { size: 9, ra: true });
    }
  });

  // 9. TOTALS & GST SUMMARY  ───────────────────────────────────────────────
  // Completely bypassed when mode is 'challan' or docType is DC_CHALLAN
  if (!isChallan) {
    const wordLines = wrapWords(inWords, 62);
    stamp(wordLines[0] || '', px(C.words[0]), py(C.words[1]),      { size: 8.5, b: true });
    stamp(wordLines[1] || '', px(C.words[0]), py(C.words[1] + 2.3),{ size: 8.5, b: true });

    const TX = px(C.totX);
    stamp(fmt(assessableValue), TX, py(C.totAV),      { size: 9.5, ra: true });
    stamp(fmt(freight),          TX, py(C.totFreight), { size: 9.5, ra: true });
    stamp(fmt(subTotal),         TX, py(C.totST),      { size: 9.5, ra: true });
    stamp(fmt(cgst),             TX, py(C.totCGST),    { size: 9.5, ra: true });
    stamp(fmt(sgst),             TX, py(C.totSGST),    { size: 9.5, ra: true });
    stamp(fmt(igst),             TX, py(C.totIGST),    { size: 9.5, ra: true });
    stamp(fmt(grandTotal),       TX, py(C.totGrand),   { size: 10.5, b: true, ra: true });
  }

  return pdfDoc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export async function generatePDFBytes(invoiceData, totals, mode = 'invoice') {
  return buildPDF(invoiceData, totals, mode);
}

export async function downloadInvoicePDF(invoiceData, totals, mode = 'invoice') {
  const bytes    = await buildPDF(invoiceData, totals, mode);
  const filename = `CC-${mode === 'challan' ? 'Challan' : 'Invoice'}-${invoiceData.invoiceNo || 'DRAFT'}.pdf`;
  download(bytes, filename, 'application/pdf');
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function wrapAddress(str, maxChars) {
  if (!str) return [];
  const flat   = str.replace(/[\r\n]+/g, ', ');
  const result = [];
  let   buf    = flat;

  while (buf.length > maxChars) {
    let idx = buf.lastIndexOf(',', maxChars);
    if (idx <= 0) idx = maxChars;
    result.push(buf.slice(0, idx + 1).trim());
    buf = buf.slice(idx + 1).trim();
  }
  if (buf) result.push(buf.trim());
  return result;
}

function wrapWords(str, maxChars) {
  const words = str.split(' ');
  const lines = [''];
  words.forEach(w => {
    const cur  = lines[lines.length - 1];
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) lines[lines.length - 1] = next;
    else lines.push(w);
  });
  return lines;
}
