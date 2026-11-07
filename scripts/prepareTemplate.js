import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function generateForm() {
  const inputPath = path.resolve('public/templates/canvas_creation_master.pdf');
  const outputPath = path.resolve('public/templates/canvas_creation_form.pdf');

  const existingPdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const form = pdfDoc.getForm();
  const page = pdfDoc.getPages()[0];

  // Helper to add a text field
  const addField = (name, x, y, width, height, multiline = false) => {
    const textField = form.createTextField(name);
    textField.addToPage(page, { x, y, width, height, borderWidth: 0 });
    if (multiline) textField.enableMultiline();
  };

  // Header / Invoice Meta
  addField('invoice_no', 345, 680, 100, 16);
  addField('invoice_date', 480, 680, 80, 16);
  addField('time_of_supply', 350, 665, 120, 14);
  addField('reverse_charge', 430, 652, 50, 14);

  // Receiver / Billed to
  addField('client_name', 45, 625, 250, 16);
  addField('client_address', 45, 595, 250, 28, true); // multiline for plant address
  addField('client_gstin', 345, 636, 150, 16);
  addField('client_state', 330, 622, 90, 14);
  addField('client_state_code', 480, 622, 50, 14);

  // PO & Transport Row
  addField('po_no', 75, 582, 100, 15);
  addField('po_date', 210, 582, 80, 15);
  addField('vendor_code', 360, 582, 100, 15);
  addField('vehicle_no', 85, 215, 120, 14);
  addField('lr_no', 240, 215, 100, 14);

  // Line Items (6 rows)
  let itemY = 538;
  for (let i = 1; i <= 6; i++) {
    addField(`item_${i}_desc`, 65, itemY, 215, 15);
    addField(`item_${i}_hsn`, 282, itemY, 48, 15);
    addField(`item_${i}_qty`, 332, itemY, 40, 15);
    addField(`item_${i}_rate`, 374, itemY, 40, 15);
    addField(`item_${i}_per`, 416, itemY, 30, 15);
    addField(`item_${i}_amount`, 450, itemY, 70, 15);
    itemY -= 17.5;
  }

  // Totals & Declarations
  addField('assessable_value', 460, 218, 65, 14);
  addField('freight', 460, 198, 65, 14);
  addField('sub_total', 460, 180, 65, 14);
  addField('cgst_amount', 460, 160, 65, 14);
  addField('sgst_amount', 460, 140, 65, 14);
  addField('igst_amount', 460, 120, 65, 14);
  addField('grand_total', 460, 100, 65, 16);
  addField('amount_in_words', 45, 192, 350, 14);

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  console.log('Successfully generated canvas_creation_form.pdf');
}

generateForm();
