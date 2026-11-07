import React, { useState, useEffect } from 'react';
import { stampInvoice } from './pdfStamper';
import { convertPdfToJpeg } from '../utils/invoiceImage';

export default function InvoicePreview({
  invoiceData = {},
  totals = {},
  onClose = () => {}
}) {
  const [copyType, setCopyType] = useState('master');
  const [format, setFormat] = useState('pdf');
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(true);

  // ============================================================
  // LIVE PDF PREVIEW
  // ============================================================

  useEffect(() => {
    let currentUrl = '';
    let isMounted = true;

    async function generatePreview() {
      try {
        setLoadingPreview(true);

        const pdfBlob = await stampInvoice(
          {
            ...invoiceData,
            docType: copyType
          },
          totals,
          copyType,
          copyType
        );

        if (!isMounted) {
          return;
        }

        currentUrl = URL.createObjectURL(pdfBlob);

        setPreviewUrl(currentUrl);
      } catch (err) {
        console.error(
          'Error generating PDF preview:',
          err
        );

        if (isMounted) {
          setPreviewUrl('');
        }
      } finally {
        if (isMounted) {
          setLoadingPreview(false);
        }
      }
    }

    generatePreview();

    return () => {
      isMounted = false;

      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [
    copyType,
    invoiceData,
    totals
  ]);

  // ============================================================
  // DOWNLOAD
  // ============================================================

  const handleDownload = async () => {
    if (saving) {
      return;
    }

    try {
      setSaving(true);

      console.log(
        '[InvoicePreview] Download started:',
        {
          copyType,
          format,
          invoiceNo:
            invoiceData?.invoiceNo
        }
      );

      // Generate the exact same PDF used by preview
      const pdfBlob = await stampInvoice(
        {
          ...invoiceData,
          docType: copyType
        },
        totals,
        copyType,
        copyType
      );

      if (!pdfBlob) {
        throw new Error(
          'PDF generation returned no file.'
        );
      }

      let downloadBlob = pdfBlob;
      let extension = 'pdf';
      let mimeType =
        'application/pdf';

      // Convert to JPG if requested
      if (format === 'jpg') {
        downloadBlob =
          await convertPdfToJpeg(
            pdfBlob
          );

        extension = 'jpg';
        mimeType = 'image/jpeg';
      }

      if (!downloadBlob) {
        throw new Error(
          'Could not create the download file.'
        );
      }

      const invoiceNo =
        String(
          invoiceData?.invoiceNo ||
          'Draft'
        )
          .trim()
          .replace(
            /[\\/:*?"<>|]/g,
            '-'
          );

      const filename =
        `Invoice_${invoiceNo}_${copyType}.${extension}`;

      // --------------------------------------------------------
      // Create temporary download URL
      // --------------------------------------------------------

      const url =
        URL.createObjectURL(
          downloadBlob
        );

      const link =
        document.createElement('a');

      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);

      // Trigger download
      link.click();

      // IMPORTANT:
      // Do NOT revoke the URL immediately.
      // Give the browser time to start the download.
      setTimeout(() => {
        URL.revokeObjectURL(url);

        if (link.parentNode) {
          link.parentNode.removeChild(
            link
          );
        }
      }, 1500);

      console.log(
        `[InvoicePreview] Download complete: ${filename}`
      );

    } catch (err) {
      console.error(
        'Error generating invoice download:',
        err
      );

      alert(
        `Could not download invoice.\n\n${
          err?.message ||
          'Unknown error'
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor:
          'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
    >

      <div
        style={{
          width: '90%',
          maxWidth: '850px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '90vh',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}
      >

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            padding:
              '16px 24px',
            borderBottom:
              '1px solid #e2e8f0',
            backgroundColor:
              '#ffffff'
          }}
        >

          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '600',
              color: '#1e293b'
            }}
          >
            Invoice Preview — #
            {invoiceData?.invoiceNo ||
              'Draft'}
          </h3>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >

            {/* COPY TYPE */}

            <select
              value={copyType}
              onChange={e =>
                setCopyType(
                  e.target.value
                )
              }
              style={{
                padding:
                  '6px 12px',
                borderRadius: '6px',
                border:
                  '1px solid #cbd5e1',
                fontSize: '14px',
                backgroundColor:
                  '#ffffff',
                color: '#334155',
                cursor: 'pointer',
                outline: 'none'
              }}
            >

              <option value="master">
                Master Copy
              </option>

              <option value="office">
                Office Copy
              </option>

              <option value="dcchallan">
                DC Challan
              </option>

            </select>

            {/* FORMAT */}

            <select
              value={format}
              onChange={e =>
                setFormat(
                  e.target.value
                )
              }
              aria-label={`${copyType} output format`}
              style={{
                padding:
                  '6px 12px',
                borderRadius: '6px',
                border:
                  '1px solid #cbd5e1',
                fontSize: '14px',
                backgroundColor:
                  '#ffffff',
                color: '#334155',
                cursor: 'pointer',
                outline: 'none'
              }}
            >

              <option value="pdf">
                PDF
              </option>

              <option value="jpg">
                JPG
              </option>

            </select>

            {/* DOWNLOAD */}

            <button
              onClick={
                handleDownload
              }
              disabled={saving}
              style={{
                backgroundColor:
                  saving
                    ? '#94a3b8'
                    : '#0ea5e9',
                color: '#ffffff',
                border: 'none',
                padding:
                  '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: saving
                  ? 'not-allowed'
                  : 'pointer'
              }}
            >
              {saving
                ? 'Processing...'
                : `Download ${format.toUpperCase()}`}
            </button>

            {/* CLOSE */}

            <button
              onClick={onClose}
              style={{
                background:
                  'transparent',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: '#64748b',
                padding:
                  '4px 8px'
              }}
            >
              ✕
            </button>

          </div>
        </div>

        {/* ======================================================
            PREVIEW
        ====================================================== */}

        <div
          style={{
            padding: '16px',
            flex: 1,
            backgroundColor:
              '#f1f5f9',
            display: 'flex',
            justifyContent:
              'center',
            minHeight: 0
          }}
        >

          {loadingPreview ? (

            <div
              style={{
                display: 'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                height: '100%',
                color: '#64748b'
              }}
            >
              Rendering preview...
            </div>

          ) : previewUrl ? (

            <iframe
              src={previewUrl}
              title="PDF Preview"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '8px',
                backgroundColor:
                  '#ffffff'
              }}
            />

          ) : (

            <div
              style={{
                display: 'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                height: '100%',
                color: '#ef4444'
              }}
            >
              Failed to load PDF preview.
            </div>

          )}

        </div>

      </div>

    </div>
  );
}