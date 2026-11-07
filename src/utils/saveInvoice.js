import { supabase } from '../supabaseClient';
import {
  calculateInvoiceItemAmount,
  calculateInvoiceReportTotals
} from './invoiceReportPdf';
import { toStoredInvoiceDate } from './invoiceDates';

const INVOICE_SERIES_PREFIX = 'CC-2627-';

export async function saveInvoiceToDatabase(invoiceData, items) {
  try {
    const freight = parseFloat(invoiceData.freight) || 0;

    const invoiceDate = toStoredInvoiceDate(
      invoiceData.invoiceDate
    );

    if (!invoiceDate) {
      throw new Error(
        'Enter a valid invoice date in DD/MM/YYYY format.'
      );
    }

    const calculated = calculateInvoiceReportTotals({
      items,
      freight,
      client_gstin: invoiceData.clientGstin,
    });

    const { data: existing, error: fetchError } = await supabase
      .from('invoices')
      .select('invoice_no');

    if (fetchError) throw fetchError;

    let maxNo = 7560;

    if (existing && existing.length > 0) {
      existing.forEach(row => {
        const match = String(row.invoice_no || '').match(
          /^CC-2627-(\d+)$/
        );

        const num = match ? Number(match[1]) : 0;

        if (!Number.isNaN(num) && num > maxNo) {
          maxNo = num;
        }
      });
    }

    const enteredInvoiceNo =
      String(invoiceData.invoiceNo || '').trim();

    const freshInvoiceNo = enteredInvoiceNo
      ? (
          enteredInvoiceNo.startsWith(INVOICE_SERIES_PREFIX)
            ? enteredInvoiceNo
            : `${INVOICE_SERIES_PREFIX}${enteredInvoiceNo}`
        )
      : `${INVOICE_SERIES_PREFIX}${maxNo + 1}`;

    const payload = {
      invoice_no: freshInvoiceNo,
      date: invoiceDate,
      client_name: invoiceData.clientName || '',
      client_gstin: invoiceData.clientGstin || '',
      freight,
      amount: calculated.grandTotal,
      grand_total: calculated.grandTotal,
      status: invoiceData.status || 'Pending',
      subtotal: calculated.subtotal,
      cgst: calculated.cgst,
      sgst: calculated.sgst,
      igst: calculated.igst,
    };

    const { data, error } = await supabase
      .from('invoices')
      .insert([payload])
      .select();

    if (error) {
      console.error('Supabase invoice insert error:', error);
      alert(
        `Invoice Save Error: ${error.message} (Code: ${error.code})`
      );
      return { success: false };
    }

    if (data?.[0]?.id && items.length > 0) {
      const itemRows = items.map(item => ({
        invoice_id: data[0].id,
        description:
          item.description || item.item_name || '',
        quantity: Number(item.quantity || 0),
        unit_price: Number(
          item.baseRate ?? item.rate ?? item.price ?? 0
        ),
        rate: Number(
          item.baseRate ?? item.rate ?? item.price ?? 0
        ),
        per: item.per || item.uom || 'Nos',
        total_sqft:
          item.totalSqft === '' || item.totalSqft === undefined
            ? null
            : Number(item.totalSqft),
        total: calculateInvoiceItemAmount(item),
      }));

      let rowsToInsert = itemRows;
      let itemError = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await supabase
          .from('invoice_items')
          .insert(rowsToInsert);

        itemError = result.error;

        if (!itemError) break;

        const missingColumnMatch =
          itemError.message?.match(
            /column\s+['"]([^'"]+)['"]|['"]([^'"]+)['"]\s+column/i
          );

        const missingColumn =
          missingColumnMatch?.[1] ||
          missingColumnMatch?.[2];

        if (
          !missingColumn ||
          missingColumn === 'invoice_id'
        ) {
          break;
        }

        rowsToInsert = rowsToInsert.map(row => {
          const {
            [missingColumn]: omitted,
            ...remaining
          } = row;

          return remaining;
        });
      }

      if (itemError) {
        console.error(
          'Invoice item save error:',
          itemError
        );

        await supabase
          .from('invoices')
          .delete()
          .eq('id', data[0].id);

        alert(
          `Invoice item save error: ${itemError.message}`
        );

        return { success: false };
      }
    }

    console.log(
      'Successfully saved invoice:',
      freshInvoiceNo,
      'Date:',
      invoiceDate,
      'Total:',
      calculated.grandTotal
    );

    return {
      success: true,
      invoiceNo: freshInvoiceNo,
      invoiceId: data?.[0]?.id
    };

  } catch (err) {
    console.error(
      'Failed to save invoice:',
      err.message
    );

    alert(`Invoice Save Error: ${err.message}`);

    return { success: false };
  }
}