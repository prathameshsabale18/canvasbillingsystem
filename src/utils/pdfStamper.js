import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const W = 595.28;
const H = 841.89;

const px = (lp) => (lp / 100) * W;
const py = (tp) => H - (tp / 100) * H;

const C = {
  invoiceNo: [66.5, 21.2],
  invoiceDate: [85.0, 21.2],

  clientName: [6.5, 22.9],
  clientAddress: [6.5, 24.4],
  clientGstin: [67.0, 23.3],

  clientState: [7, 27.6],
  clientStateCode: [36, 27.6],

  poNo: [67.0, 25.3],
  poDate: [80.0, 26],
  vendorCode: [69.0, 27.2],

  itemStartTop: 35,
  itemRowH: 3.2,

  col: {
    srCenter: 9,
    srWidth: 7.9,
    desc: 13,
    hsn: 48.5,
    hsnCenter: 51.75,
    hsnWidth: 7.7,
    qtyCenter: 59.3,
    qtyWidth: 7.4,
    rateCenter: 67.0,
    rateWidth: 8.0,
    perCenter: 75.65,
    perWidth: 9.3,
    amtCenter: 88.25,
    amtWidth: 15.9
  },

  words: [4.5, 64.7],

  totX: 90.0,
  totAV: 63.6,
  totFreight: 65.7,
  totST: 69,
  totCGST: 71.5,
  totSGST: 74.4,
  totIGST: 77.3,
  totGrand: 84.5
};

const MASTER_COL = {
  srCenter: 7,
  srWidth: 7,
  desc: 12,
  hsn: 49,
  hsnCenter: 53.8,
  hsnWidth: 8.8,
  qtyCenter: 71.5,
  qtyWidth: 7.4,
  rateCenter: 78,
  rateWidth: 7.6,
  perCenter: 63.4,
  perWidth: 8.6,
  amtCenter: 89,
  amtWidth: 14.4
};

const MASTER_ITEM_START_TOP = 35;

const TEMPLATE_CONFIG = {
  master: {
    file: '/templates/canvas_creation_master.pdf',
    isChallan: false
  },

  mastercopy: {
    file: '/templates/canvas_creation_master.pdf',
    isChallan: false
  },

  office: {
    file: '/templates/OFFICECOPYMASTER.pdf',
    isChallan: false
  },

  officecopy: {
    file: '/templates/OFFICECOPYMASTER.pdf',
    isChallan: false
  },

  ebill: {
    file: '/templates/ebill.pdf',
    isChallan: false
  },

  dcchallan: {
    file: '/templates/DCCHALLAN.pdf',
    isChallan: true
  },

  challan: {
    file: '/templates/DCCHALLAN.pdf',
    isChallan: true
  }
};

function cleanText(input) {
  if (input === null || input === undefined) {
    return '';
  }

  return String(input)
    .replace(/₹/g, 'Rs. ')
    .replace(/[\u20B9]/g, 'Rs. ')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

function parseNum(val) {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }

  if (!val) {
    return 0;
  }

  const cleaned = String(val).replace(/[^\d.-]/g, '');
  const num = Number(cleaned);

  return isNaN(num) ? 0 : num;
}

function formatRate(val) {
  const num = parseNum(val);

  if (num === 0) {
    return '';
  }

  return Number.isInteger(num)
    ? String(num)
    : num.toFixed(2);
}

function getPdfTotalSqft(item) {
  const per = String(item.per || '').toLowerCase();
  const manualTotal = Number(item.totalSqft ?? item.total_sqft) || 0;

  if (manualTotal > 0) {
    return `${formatRate(manualTotal)} sqft`;
  }

  if (
    per.includes('sqft') ||
    per.includes('sq.ft') ||
    /sq\.?\s*ft/i.test(String(item.desc || ''))
  ) {
    const dimensions = String(item.desc || '').match(
      /(\d+(?:\.\d+)?)\s*(?:x|X|\*|\u00D7|\u2715|\u2716)\s*(\d+(?:\.\d+)?)/
    );

    if (!dimensions || !Number(item.qty)) return '';

    const total =
      Number(dimensions[1]) *
      Number(dimensions[2]) *
      Number(item.qty);

    return `${formatRate(total)} sqft`;
  }

  if (per === 'job' && item.serviceWithoutQuantity) {
    return 'Service';
  }

  return '-';
}

/* ============================================================
   NUMBER TO WORDS
   ============================================================ */

function numberToWords(num) {
  if (isNaN(num) || num === 0) {
    return 'Zero Only';
  }

  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen'
  ];

  const b = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety'
  ];

  function inWords(n) {
    if ((n = n.toString()).length > 9) {
      return 'Overflow';
    }

    const n_array = (
      '000000000' + n
    )
      .substr(-9)
      .match(
        /^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/
      );

    if (!n_array) {
      return '';
    }

    let str = '';

    str +=
      Number(n_array[1]) !== 0
        ? (
            a[Number(n_array[1])] ||
            b[n_array[1][0]] +
              ' ' +
              a[n_array[1][1]]
          ) + ' Crore '
        : '';

    str +=
      Number(n_array[2]) !== 0
        ? (
            a[Number(n_array[2])] ||
            b[n_array[2][0]] +
              ' ' +
              a[n_array[2][1]]
          ) + ' Lakh '
        : '';

    str +=
      Number(n_array[3]) !== 0
        ? (
            a[Number(n_array[3])] ||
            b[n_array[3][0]] +
              ' ' +
              a[n_array[3][1]]
          ) + ' Thousand '
        : '';

    str +=
      Number(n_array[4]) !== 0
        ? (
            a[Number(n_array[4])] ||
            b[n_array[4][0]] +
              ' ' +
              a[n_array[4][1]]
          ) + ' Hundred '
        : '';

    str +=
      Number(n_array[5]) !== 0
        ? (
            (str !== '' ? 'and ' : '') +
            (
              a[Number(n_array[5])] ||
              b[n_array[5][0]] +
                ' ' +
                a[n_array[5][1]]
            ) +
            ' '
          )
        : '';

    return str.trim();
  }

  const rupees = Math.floor(num);

  const paise = Math.round(
    (num - rupees) * 100
  );

  let res =
    inWords(rupees) + ' Rupees';

  if (paise > 0) {
    res +=
      ' and ' +
      inWords(paise) +
      ' Paise';
  }

  return res + ' Only';
}

/* ============================================================
   STAMP INVOICE
   ============================================================ */

export async function stampInvoice(
  invoiceData = {},
  totals = {},
  mode = 'master',
  copyType = 'master',
  templateVariant = 'full'
) {
  const selectedType = String(
    copyType || mode || ''
  ).toLowerCase();

  let templatePath =
    '/templates/canvas_creation_master.pdf';

  let isChallan = false;

  if (
    selectedType.includes('challan')
  ) {
    templatePath =
      '/templates/DCCHALLAN.pdf';

    isChallan = true;
  } else if (
    selectedType.includes('office')
  ) {
    templatePath =
      '/templates/OFFICECOPYMASTER.pdf';

    isChallan = false;
  } else {
    templatePath =
      templateVariant === 'print'
        ? '/templates/canvas_creation_master_print.pdf'
        : '/templates/canvas_creation_master.pdf';

    isChallan = false;
  }

  console.log(
    `[STAMPER] Selected Type: ${selectedType} | Fetching Path: ${templatePath} | Challan: ${isChallan}`
  );

  /* ==========================================================
     LOAD TEMPLATE
  ========================================================== */

  const pdfDoc =
    await PDFDocument.create();

  let templateLoaded = false;

  const cacheBustedUrl =
    `${templatePath}?v=${Date.now()}`;

  try {
    const res =
      await fetch(cacheBustedUrl);

    if (res.ok) {
      const bytes =
        await res.arrayBuffer();

      const templateDoc =
        await PDFDocument.load(bytes);

      const [tplPage] =
        await pdfDoc.copyPages(
          templateDoc,
          [0]
        );

      pdfDoc.addPage(tplPage);

      templateLoaded = true;
    } else {
      console.error(
        `[stampInvoice] Failed to fetch template at ${cacheBustedUrl}: Status ${res.status}`
      );
    }
  } catch (err) {
    console.error(
      `[stampInvoice] Error loading template ${cacheBustedUrl}:`,
      err
    );
  }

  /* ==========================================================
     FALLBACK
  ========================================================== */

  if (!templateLoaded) {
    const page =
      pdfDoc.addPage([
        595.28,
        841.89
      ]);

    try {
      const res =
        await fetch(
          `/template.jpg?v=${Date.now()}`
        );

      if (res.ok) {
        const bytes =
          await res.arrayBuffer();

        const img =
          await pdfDoc.embedJpg(bytes);

        page.drawImage(img, {
          x: 0,
          y: 0,
          width: 595.28,
          height: 841.89
        });
      }
    } catch {
      // Blank page fallback
    }
  }

  const activePage =
    pdfDoc.getPages()[0];

  /* ==========================================================
     FONTS
  ========================================================== */

  const fontRegular =
    await pdfDoc.embedFont(
      StandardFonts.Helvetica
    );

  const fontBold =
    await pdfDoc.embedFont(
      StandardFonts.HelveticaBold
    );

  const fontBoldOblique =
    await pdfDoc.embedFont(
      StandardFonts.HelveticaBoldOblique
    );

  const black =
    rgb(0, 0, 0);

  const white =
    rgb(1, 1, 1);

  /* ==========================================================
     DRAW
  ========================================================== */

  const draw = (
    text,
    x,
    y,
    size = 8.5,
    isBold = false,
    isRightAligned = false,
    color = black,
    isItalic = false
  ) => {
    const sanitized =
      cleanText(text);

    if (!sanitized) {
      return;
    }

    const font =
      isBold && isItalic
        ? fontBoldOblique
        : isBold
          ? fontBold
          : fontRegular;

    let finalX = x;

    if (isRightAligned) {
      finalX =
        x -
        font.widthOfTextAtSize(
          sanitized,
          size
        );
    }

    activePage.drawText(
      sanitized,
      {
        x: finalX,
        y,
        size,
        font,
        color
      }
    );
  };

  const drawCentered = (
    text,
    centerX,
    y,
    size = 8.5,
    maxWidth = Infinity,
    isBold = false
  ) => {
    const sanitized = cleanText(text);

    if (!sanitized) return;

    const font = isBold ? fontBold : fontRegular;

    const textWidth =
      font.widthOfTextAtSize(
        sanitized,
        size
      );

    const fittedSize =
      textWidth > maxWidth
        ? size * (maxWidth / textWidth)
        : size;

    const fittedWidth =
      font.widthOfTextAtSize(
        sanitized,
        fittedSize
      );

    draw(
      sanitized,
      centerX - fittedWidth / 2,
      y,
      fittedSize,
      isBold
    );
  };

  /* ==========================================================
     MULTI-LINE DRAW
  ========================================================== */

  const drawLines = (
    text,
    x,
    top,
    size = 8.5,
    lineGap = 1.8,
    isBold = false
  ) => {
    const lines = [];

    String(text || '')
      .split(/[\r\n]+/)
      .forEach(rawLine => {
        let line =
          rawLine.trim();

        while (line.length > 58) {
          let splitAt =
            line.lastIndexOf(
              ' ',
              58
            );

          if (splitAt < 20) {
            splitAt = 58;
          }

          lines.push(
            line
              .slice(0, splitAt)
              .trim()
          );

          line =
            line
              .slice(splitAt)
              .trim();
        }

        if (line) {
          lines.push(line);
        }
      });

    lines
      .slice(0, 2)
      .forEach(
        (line, index) => {
          draw(
            line,
            x,
            py(
              top +
                index *
                  lineGap
            ),
            size,
            isBold
          );
        }
      );
  };

  /* ==========================================================
     ITEM DESCRIPTION WRAP
  ========================================================== */

  const wrapItemDescription = (
    text,
    maxWidth,
    size = 9.5
  ) => {
    const sanitized =
      cleanText(text);

    if (!sanitized) {
      return [];
    }

    const words =
      sanitized.split(/\s+/);

    const lines = [];

    let currentLine = '';

    for (const word of words) {
      const testLine =
        currentLine
          ? `${currentLine} ${word}`
          : word;

      const width =
        fontRegular.widthOfTextAtSize(
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

        if (lines.length === 2) {
          break;
        }
      }
    }

    if (
      currentLine &&
      lines.length < 2
    ) {
      lines.push(currentLine);
    }

    return lines.slice(0, 2);
  };

  /* ==========================================================
     CLIENT
  ========================================================== */

  const client =
    invoiceData.client || {
      name:
        invoiceData.clientName || '',

      address:
        invoiceData.clientAddress || '',

      gstin:
        invoiceData.clientGstin || '',

      state:
        invoiceData.clientState || '',

      stateCode:
        invoiceData.clientStateCode || '',

      vendorCode:
        invoiceData.clientVendorCode || ''
    };

  const fullAddr = [
    client.addressLine1,
    client.addressLine2,
    client.address
  ]
    .filter(Boolean)
    .join(', ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  /* ==========================================================
     ITEMS
  ========================================================== */

  const rawItems =
    totals.items ||
    invoiceData.items ||
    invoiceData.lineItems ||
    [];

  const items =
    rawItems.map(it => {
      const rawQuantity = it.qty ?? it.quantity ?? '';
      const per = String(it.per || it.unit || 'Nos');
      const serviceWithoutQuantity =
        per.toLowerCase() === 'job' &&
        !(Number(rawQuantity) > 0);
      const calculationQty = serviceWithoutQuantity
        ? 1
        : parseNum(rawQuantity);
      const totalSqft =
        parseNum(it.totalSqft ?? it.total_sqft);

      const rate =
        parseNum(
          it.rate ||
          it.price
        );

      const desc =
        String(
          it.desc ||
          it.description ||
          it.productName ||
          ''
        );

      const explicitAmount =
        parseNum(
          it.amount ||
          it.lineAmount ||
          it.total ||
          it.lineTotal
        );

      let calculatedAmount =
        totalSqft > 0
          ? totalSqft * rate
          : calculationQty * rate;

      const dimMatch =
        desc.match(
          /(\d+(?:\.\d+)?)\s*(?:x|X|\*|\u00D7|\u2715|\u2716)\s*(\d+(?:\.\d+)?)/
        );

      if (dimMatch && totalSqft <= 0) {
        const d1 =
          parseFloat(
            dimMatch[1]
          );

        const d2 =
          parseFloat(
            dimMatch[2]
          );

        calculatedAmount =
          calculationQty *
          d1 *
          d2 *
          rate;
      }

      let finalAmount =
        calculatedAmount;

      if (explicitAmount > 0) {
        if (
          dimMatch &&
          explicitAmount ===
            calculationQty * rate
        ) {
          finalAmount =
            calculatedAmount;
        } else {
          finalAmount =
            explicitAmount;
        }
      }

      return {
        desc,

        hsn:
          it.hsn ||
          it.hsnCode ||
          '',

        qty: serviceWithoutQuantity ? '' : calculationQty,

        serviceWithoutQuantity,

        totalSqft,

        rate,

        per,

        amount:
          finalAmount
      };
    });

  /* ==========================================================
     TOTALS
  ========================================================== */

  const itemsTotal =
    items.reduce(
      (sum, it) =>
        sum + it.amount,
      0
    );

  const getVal = (...keys) => {
    for (const k of keys) {
      if (
        invoiceData[k] !==
          undefined &&
        invoiceData[k] !==
          null &&
        invoiceData[k] !== ''
      ) {
        const val =
          parseNum(
            invoiceData[k]
          );

        if (val !== 0) {
          return val;
        }
      }

      if (
        totals[k] !==
          undefined &&
        totals[k] !== null &&
        totals[k] !== ''
      ) {
        const val =
          parseNum(
            totals[k]
          );

        if (val !== 0) {
          return val;
        }
      }
    }

    return 0;
  };

  const assessableValue =
    itemsTotal > 0
      ? itemsTotal
      : getVal(
          'assessableValue',
          'subtotal',
          'subTotal',
          'sub_total'
        );

  const freight =
    getVal(
      'freight',
      'shipping',
      'shippingCost'
    );

  const subTotal =
    assessableValue +
    freight;

  /* ==========================================================
     GST
  ========================================================== */

  const cgst =
    Number(
      (
        (subTotal * 9) /
        100
      ).toFixed(2)
    );

  const sgst =
    Number(
      (
        (subTotal * 9) /
        100
      ).toFixed(2)
    );

  const igst = 0;

  const grandTotal =
    isChallan
      ? Number(
          subTotal.toFixed(2)
        )
      : Number(
          (
            subTotal +
            cgst +
            sgst +
            igst
          ).toFixed(2)
        );

  const amountInWords =
    numberToWords(
      grandTotal
    );

  /* ==========================================================
     HEADER
  ========================================================== */

  draw(
    invoiceData.invoiceNo ||
      invoiceData.number,
    px(C.invoiceNo[0]),
    py(C.invoiceNo[1]),
    10,
    true
  );

  draw(
    invoiceData.invoiceDate ||
      invoiceData.date,
    px(C.invoiceDate[0]),
    py(C.invoiceDate[1]),
    10,
    true
  );

  draw(
    client.name,
    px(C.clientName[0]),
    py(C.clientName[1]),
    9.5,
    true
  );

  drawLines(
    fullAddr,
    px(C.clientAddress[0]),
    C.clientAddress[1],
    8
  );

  draw(
    client.gstin,
    px(C.clientGstin[0]),
    py(C.clientGstin[1]),
    8.5,
    true
  );

  draw(
    client.vendorCode,
    px(C.vendorCode[0]),
    py(C.vendorCode[1]),
    8.5
  );

  draw(
    invoiceData.poNo,
    px(C.poNo[0]),
    py(C.poNo[1]),
    10,
    true
  );

  /* ==========================================================
     ITEM ROWS
  ========================================================== */

  const ITEM_Y0 = py(MASTER_ITEM_START_TOP);

  const ROW_H =
    (C.itemRowH / 100) *
    H;

  const itemColumns = MASTER_COL;

  items
    .slice(0, 8)
    .forEach(
      (item, index) => {
        const y =
          ITEM_Y0 -
          index * ROW_H;

        const itemTextSize = 9.5;

        /* SR NO */

        drawCentered(
          String(index + 1),
          px(itemColumns.srCenter),
          y,
          itemTextSize,
          px(itemColumns.srWidth)
        );

        /* DESCRIPTION */

        const descriptionWidth =
          px(itemColumns.hsn) -
          px(itemColumns.desc) -
          6;

        const descriptionLines =
          wrapItemDescription(
            item.desc,
            descriptionWidth,
            itemTextSize
          );

        descriptionLines.forEach(
          (line, lineIndex) => {
            draw(
              line,
              px(itemColumns.desc),
              y -
                lineIndex * 12,
              itemTextSize
            );
          }
        );

        /* HSN */

        drawCentered(
          String(item.hsn),
          px(itemColumns.hsnCenter),
          y,
          itemTextSize,
          px(itemColumns.hsnWidth)
        );

        /* QTY */

        drawCentered(
          item.qty === '' ? '-' : String(item.qty),
          px(itemColumns.qtyCenter),
          y,
          itemTextSize,
          px(itemColumns.qtyWidth)
        );

        /* SIZE / PER */

        const sizePerText = getPdfTotalSqft(item);

        /* RATE */

        drawCentered(
          formatRate(item.rate),
          px(itemColumns.rateCenter),
          y,
          9,
          px(itemColumns.rateWidth)
        );

        /* SIZE / PER */

        drawCentered(
          sizePerText,
          px(itemColumns.perCenter),
          y,
          itemTextSize,
          px(itemColumns.perWidth)
        );

        /* AMOUNT */

        drawCentered(
          item.amount.toFixed(2),
          px(itemColumns.amtCenter),
          y,
          itemTextSize,
          px(itemColumns.amtWidth),
          true
        );
      }
    );

  /* ==========================================================
     TOTAL SECTION
  ========================================================== */

  const TX =
    px(C.totX);

  /* ASSESSABLE VALUE */

  if (assessableValue > 0) {
    draw(
      assessableValue.toFixed(2),
      TX,
      py(C.totAV),
      9.5,
      false,
      true
    );
  }

  /* FREIGHT */

  if (freight > 0) {
    draw(
      freight.toFixed(2),
      TX,
      py(C.totFreight),
      9.5,
      false,
      true
    );
  }

  /* SUB TOTAL */

  if (subTotal > 0) {
    draw(
      subTotal.toFixed(2),
      TX,
      py(C.totST),
      9.5,
      false,
      true
    );
  }

  /* ==========================================================
     GST
  ========================================================== */

  if (!isChallan) {
    if (cgst > 0) {
      draw(
        cgst.toFixed(2),
        TX,
        py(C.totCGST),
        9.5,
        false,
        true
      );
    }

    if (sgst > 0) {
      draw(
        sgst.toFixed(2),
        TX,
        py(C.totSGST),
        9.5,
        false,
        true
      );
    }

    if (igst > 0) {
      draw(
        igst.toFixed(2),
        TX,
        py(C.totIGST),
        9.5,
        false,
        true
      );
    }
  }

  /* ==========================================================
     GRAND TOTAL
  ========================================================== */

  if (grandTotal > 0) {
    const grandTotalY =
      isChallan
        ? 72
        : 80.5;

    draw(
      grandTotal.toFixed(2),
      TX,
      py(grandTotalY),
      15,
      true,
      true,
      white
    );
  }

  /* ==========================================================
     AMOUNT IN WORDS
  ========================================================== */

  draw(
    amountInWords,
    px(C.words[0]),
    py(C.words[1]),
    8,
    true,
    false,
    black,
    true
  );

  /* ==========================================================
     SAVE PDF
  ========================================================== */

  const pdfBytes =
    await pdfDoc.save();

  return new Blob(
    [pdfBytes],
    {
      type: 'application/pdf'
    }
  );
}