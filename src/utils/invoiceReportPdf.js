import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import download from 'downloadjs';
import { formatInvoiceDate, getInvoiceDateKey } from './invoiceDates';
import { calculateItemAmount } from './calculations';

export { getInvoiceDateKey } from './invoiceDates';

export const calculateInvoiceItemAmount = (item) => {
  const per = String(item.per ?? item.uom ?? '').toLowerCase();
  const quantityValue = item.quantity ?? item.qty ?? '';

  if (
    per.includes('sqft') ||
    per.includes('sq.ft') ||
    /sq\.?\s*ft/i.test(String(item.description || '')) ||
    (per === 'job' && !(Number(quantityValue) > 0))
  ) {
    return calculateItemAmount(item);
  }

  const quantity = Number(
    item.quantity ??
      item.qty ??
      item.quantity_value ??
      0
  );

  const rate = Number(
    item.rate ??
      item.unit_price ??
      item.price ??
      0
  );

  const amount = Number(
    item.amount ??
      item.total ??
      item.item_amount ??
      0
  );

  if (amount > 0) return amount;

  return quantity * rate;
};

export const calculateInvoiceReportTotals = (invoice) => {
  const items = Array.isArray(invoice.items)
    ? invoice.items
    : [];

  const storedSubtotal =
    Number(invoice.subtotal) || 0;

  const subtotal =
    items.length > 0
      ? items.reduce(
          (sum, item) =>
            sum + calculateInvoiceItemAmount(item),
          0
        )
      : storedSubtotal;

  const freight =
    Number(invoice.freight) || 0;

  const assessableValue =
    items.length > 0
      ? subtotal + freight
      : Number(invoice.assessable_value) || subtotal + freight;

  const gstin =
    invoice.clients?.gst_no ||
    invoice.client_gstin ||
    invoice.clientGstin ||
    '';

  const isIntraState =
    String(gstin).startsWith('27');

  const cgst = isIntraState
    ? assessableValue * 0.09
    : 0;

  const sgst = isIntraState
    ? assessableValue * 0.09
    : 0;

  const igst = 0;

  const totalTax =
    cgst + sgst + igst;

  const grandTotal = Math.round(
    (assessableValue + totalTax) * 100
  ) / 100;

  return {
    subtotal,
    freight,
    assessableValue,
    cgst,
    sgst,
    igst,
    totalTax,
    grandTotal,
  };
};

export async function downloadInvoiceReportPDF(
  invoices,
  startDate,
  endDate,
  useProvidedList = false,
  periodLabel = ''
) {
  /*
   * When useProvidedList is true:
   * use exactly what is currently displayed
   * in the Billing table.
   *
   * This preserves:
   * - Search
   * - Filters
   * - Sorting
   * - Current displayed records
   */

  const matchingInvoices = useProvidedList
    ? Array.isArray(invoices)
      ? [...invoices]
      : []
    : (Array.isArray(invoices)
        ? invoices
        : []
      )
        .filter((invoice) => {
          const invoiceDate =
            getInvoiceDateKey(
              invoice.date ||
                invoice.invoice_date
            );

          return (
            invoiceDate &&
            invoiceDate >= startDate &&
            invoiceDate <= endDate
          );
        })
        .sort((a, b) => {
          const dateA =
            getInvoiceDateKey(
              a.date ||
                a.invoice_date
            );

          const dateB =
            getInvoiceDateKey(
              b.date ||
                b.invoice_date
            );

          return dateA.localeCompare(
            dateB
          );
        });

  const usingAllBills =
    !useProvidedList &&
    matchingInvoices.length === 0 &&
    invoices.length > 0;

  const selectedInvoices =
    usingAllBills
      ? invoices
      : matchingInvoices;

  if (!selectedInvoices.length) {
    throw new Error(
      'No invoices found for the selected filters.'
    );
  }

  const pdfDoc =
    await PDFDocument.create();

  const regularFont =
    await pdfDoc.embedFont(
      StandardFonts.Helvetica
    );

  const boldFont =
    await pdfDoc.embedFont(
      StandardFonts.HelveticaBold
    );

  const PAGE_WIDTH = 842;
  const PAGE_HEIGHT = 595;

  const margin = 28;

  const headerHeight = 62;

  const tableTop =
    PAGE_HEIGHT -
    margin -
    headerHeight;

  /*
   * Column widths are intentionally balanced
   * so long client names have enough room.
   */
  const columns = [
    { key: 'invoice', label: 'Invoice No.', width: 72 },
    { key: 'date', label: 'Date', width: 58 },
    { key: 'client', label: 'Client', width: 160 },
    { key: 'gst', label: 'GST No.', width: 97 },
    { key: 'products', label: 'Products', width: 100 },
    { key: 'amount', label: 'Assessed', width: 65 },
    { key: 'cgst', label: 'CGST', width: 52 },
    { key: 'sgst', label: 'SGST', width: 52 },
    { key: 'grandTotal', label: 'Grand Total', width: 55 },
    { key: 'status', label: 'Status', width: 60 },
  ];

  const tableWidth =
    columns.reduce(
      (sum, column) =>
        sum + column.width,
      0
    );

  /*
   * Break text into lines based on
   * approximate PDF text width.
   */
  const wrapText = (
    text,
    font,
    size,
    maxWidth,
    maxLines = 2
  ) => {
    const value =
      text === null ||
      text === undefined
        ? ''
        : String(text);

    if (!value) {
      return [''];
    }

    const words =
      value.split(/\s+/);

    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine =
        currentLine
          ? `${currentLine} ${word}`
          : word;

      const width =
        font.widthOfTextAtSize(
          testLine,
          size
        );

      if (
        width <= maxWidth ||
        !currentLine
      ) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;

        if (
          lines.length ===
          maxLines - 1
        ) {
          break;
        }
      }
    }

    if (
      currentLine &&
      lines.length < maxLines
    ) {
      lines.push(currentLine);
    }

    /*
     * If text still remains after the
     * maximum number of lines, add ellipsis.
     */
    const consumed =
      lines.join(' ').length;

    if (
      consumed <
      value.length
    ) {
      let lastLine =
        lines[lines.length - 1] ||
        '';

      while (
        font.widthOfTextAtSize(
          `${lastLine}...`,
          size
        ) > maxWidth &&
        lastLine.length > 0
      ) {
        lastLine =
          lastLine.slice(0, -1);
      }

      lines[lines.length - 1] =
        `${lastLine}...`;
    }

    return lines;
  };

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString(
      'en-IN',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );

  const getClientName = (
    invoice
  ) =>
    invoice.clients?.client_name ||
    invoice.client_name ||
    '';

  const getGST = (invoice) =>
    invoice.clients?.gst_no ||
    invoice.client_gstin ||
    invoice.clientGstin ||
    '';

  const getProducts = (
    invoice
  ) => {
    if (
      !Array.isArray(
        invoice.items
      )
    ) {
      return '';
    }

    return invoice.items
      .map(
        (item) =>
          item.description ||
          item.item_name ||
          item.productName ||
          item.product ||
          ''
      )
      .filter(Boolean)
      .join(', ');
  };

  const reportRows =
    selectedInvoices.map(
      (invoice) => ({
        invoice,
        totals:
          calculateInvoiceReportTotals(
            invoice
          ),
      })
    );

  const reportTotals =
    reportRows.reduce(
      (totals, row) => {
        totals.assessableValue +=
          row.totals
            .assessableValue;

        totals.cgst +=
          row.totals.cgst;

        totals.sgst +=
          row.totals.sgst;

        totals.grandTotal +=
          row.totals.grandTotal;

        return totals;
      },
      {
        assessableValue: 0,
        cgst: 0,
        sgst: 0,
        grandTotal: 0,
      }
    );

  const drawText = (
    page,
    text,
    x,
    y,
    options = {}
  ) => {
    page.drawText(
      String(text ?? ''),
      {
        x,
        y,
        size:
          options.size || 8,
        font:
          options.font ||
          regularFont,
        color:
          options.color ||
          rgb(
            0.1,
            0.15,
            0.2
          ),
        maxWidth:
          options.maxWidth,
      }
    );
  };

  const drawPageHeader =
    (page) => {
      drawText(
        page,
        'CANVAS CREATION',
        margin,
        PAGE_HEIGHT -
          margin -
          18,
        {
          font: boldFont,
          size: 16,
        }
      );

      drawText(
        page,
        'Invoice Billing Report',
        margin,
        PAGE_HEIGHT -
          margin -
          38,
        {
          font: boldFont,
          size: 11,
        }
      );

      drawText(
        page,
        periodLabel ||
          `${startDate} to ${endDate}`,
        PAGE_WIDTH -
          margin -
          220,
        PAGE_HEIGHT -
          margin -
          20,
        {
          size: 8,
          maxWidth: 220,
        }
      );

      drawText(
        page,
        `${selectedInvoices.length} invoice${
          selectedInvoices.length ===
          1
            ? ''
            : 's'
        }`,
        PAGE_WIDTH -
          margin -
          220,
        PAGE_HEIGHT -
          margin -
          38,
        {
          size: 8,
          maxWidth: 220,
        }
      );
    };

  const drawTableHeader =
    (page, y) => {
      let x = margin;

      const headerHeight = 22;

      page.drawRectangle({
        x,
        y:
          y -
          headerHeight +
          4,
        width: tableWidth,
        height: headerHeight,
        color: rgb(
          0.94,
          0.96,
          0.97
        ),
        borderColor: rgb(
          0.78,
          0.81,
          0.84
        ),
        borderWidth: 0.5,
      });

      columns.forEach(
        (column) => {
          drawText(
            page,
            column.label,
            x + 4,
            y - 11,
            {
              font: boldFont,
              size: 7,
              maxWidth:
                column.width - 8,
            }
          );

          x += column.width;
        }
      );
    };

  /*
   * Calculate row height based on
   * whether Client / Products need
   * multiple lines.
   */
  const getRowData = (
    row
  ) => {
    const invoice =
      row.invoice;

    const totals =
      row.totals;

    const values = {
      invoice:
        invoice.invoice_no ||
        invoice.invoiceNo ||
        '',

      date:
        formatInvoiceDate(
          invoice.date ||
            invoice.invoice_date
        ),

      client:
        getClientName(invoice),

      gst:
        getGST(invoice),

      products:
        getProducts(invoice),

      amount:
        formatMoney(
          totals.assessableValue
        ),

      cgst:
        formatMoney(
          totals.cgst
        ),

      sgst:
        formatMoney(
          totals.sgst
        ),

      grandTotal:
        formatMoney(
          totals.grandTotal
        ),

      status:
        invoice.status ||
        'Pending',
    };

    const clientLines =
      wrapText(
        values.client,
        regularFont,
        6.4,
        152,
        2
      );

    const productLines =
      wrapText(
        values.products,
        regularFont,
        6.4,
        92,
        3
      );

    const rowHeight =
      Math.max(
        22,
        Math.max(
          clientLines.length,
          productLines.length
        ) * 8 + 11
      );

    return {
      values,
      clientLines,
      productLines,
      rowHeight,
    };
  };

  const drawRow = (
    page,
    row,
    y
  ) => {
    const rowData =
      getRowData(row);

    const {
      values,
      clientLines,
      productLines,
      rowHeight,
    } = rowData;

    let x = margin;

    page.drawRectangle({
      x,
      y:
        y -
        rowHeight +
        4,
      width: tableWidth,
      height: rowHeight,
      borderColor: rgb(
        0.86,
        0.88,
        0.9
      ),
      borderWidth: 0.35,
    });

    columns.forEach(
      (column) => {
        let lines = [
          String(
            values[column.key] ??
              ''
          ),
        ];

        let fontSize = 6.8;

        if (
          column.key ===
          'client'
        ) {
          lines =
            clientLines;
          fontSize = 6.4;
        }

        if (
          column.key ===
          'products'
        ) {
          lines =
            productLines;
          fontSize = 6.4;
        }

        const lineHeight = 8;

        const totalTextHeight =
          lines.length *
          lineHeight;

        const startY =
          y -
          (
            rowHeight -
            totalTextHeight
          ) /
            2 -
          lineHeight +
          2;

        lines
          .slice(
            0,
            column.key === 'products'
              ? 3
              : 2
          )
          .forEach(
            (
              line,
              lineIndex
            ) => {
              drawText(
                page,
                line,
                x + 4,
                startY -
                  lineIndex *
                    lineHeight,
                {
                  size: fontSize,
                  maxWidth:
                    column.width -
                    8,
                }
              );
            }
          );

        x +=
          column.width;
      }
    );

    return rowHeight;
  };

  let page = null;
  let currentY = 0;

  const createPage = () => {
    page =
      pdfDoc.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]);

    drawPageHeader(page);

    currentY = tableTop;

    drawTableHeader(
      page,
      currentY
    );

    currentY -= 22;

    return page;
  };

  createPage();

  reportRows.forEach(
    (row) => {
      const rowData =
        getRowData(row);

      /*
       * Keep enough space for the
       * complete row. If the row does
       * not fit, move it to the next
       * page.
       */
      if (
        currentY -
          rowData.rowHeight <
        margin + 95
      ) {
        createPage();
      }

      const usedHeight =
        drawRow(
          page,
          row,
          currentY
        );

      currentY -=
        usedHeight;
    }
  );

  /*
   * Summary section
   */

  if (
    currentY <
    margin + 125
  ) {
    createPage();
    currentY -= 10;
  }

  currentY -= 10;

  drawText(
    page,
    'REPORT SUMMARY',
    margin,
    currentY,
    {
      font: boldFont,
      size: 10,
    }
  );

  currentY -= 20;

  const summaryItems = [
    [
      'Bills',
      String(
        selectedInvoices.length
      ),
    ],
    [
      'Assessed Value',
      formatMoney(
        reportTotals
          .assessableValue
      ),
    ],
    [
      'CGST',
      formatMoney(
        reportTotals.cgst
      ),
    ],
    [
      'SGST',
      formatMoney(
        reportTotals.sgst
      ),
    ],
    [
      'Total GST',
      formatMoney(
        reportTotals.cgst +
          reportTotals.sgst
      ),
    ],
    [
      'Grand Total',
      formatMoney(
        reportTotals
          .grandTotal
      ),
    ],
  ];

  let summaryX = margin;

  summaryItems.forEach(
    ([label, value]) => {
      const boxWidth = 122;

      page.drawRectangle({
        x: summaryX,
        y:
          currentY - 40,
        width: boxWidth,
        height: 40,
        borderColor: rgb(
          0.82,
          0.84,
          0.87
        ),
        borderWidth: 0.5,
      });

      drawText(
        page,
        label,
        summaryX + 7,
        currentY - 15,
        {
          font: boldFont,
          size: 7,
        }
      );

      drawText(
        page,
        value,
        summaryX + 7,
        currentY - 30,
        {
          size: 8,
        }
      );

      summaryX +=
        boxWidth + 8;

      if (
        summaryX >
        PAGE_WIDTH -
          margin -
          boxWidth
      ) {
        summaryX = margin;
        currentY -= 48;
      }
    }
  );

  /*
   * Footer
   */

  const pages =
    pdfDoc.getPages();

  pages.forEach(
    (pdfPage, pageIndex) => {
      drawText(
        pdfPage,
        `Page ${
          pageIndex + 1
        } of ${pages.length}`,
        PAGE_WIDTH -
          margin -
          80,
        15,
        {
          size: 7,
        }
      );

      drawText(
        pdfPage,
        'Generated by CanvasBILL',
        margin,
        15,
        {
          size: 7,
        }
      );
    }
  );

  const pdfBytes =
    await pdfDoc.save();

  const blob = new Blob(
    [pdfBytes],
    {
      type: 'application/pdf',
    }
  );

  const filename =
    `CanvasBILL-Report-${
      periodLabel
        ? periodLabel.replace(
            /[^a-z0-9]+/gi,
            '-'
          )
        : 'Filtered'
    }.pdf`;

  download(
    blob,
    filename,
    'application/pdf'
  );

  return blob;
}