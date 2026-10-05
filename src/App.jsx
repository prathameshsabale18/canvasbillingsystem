import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import InvoiceForm from './components/InvoiceForm';
import Dashboard from './components/Dashboard';
import OverviewDashboard from './components/OverviewDashboard';
import WorkspaceSidebar from './components/WorkspaceSidebar';
import { calculateTotals } from './utils/calculations';
import { stampInvoice } from './utils/pdfStamper';
import { numberToWords } from './utils/calculations';
import { saveInvoiceToDatabase } from './utils/saveInvoice';
import { convertPdfToJpeg } from './utils/invoiceImage';
import { saveInvoicePdf } from './utils/invoicePdfStorage';
import { getTodayInvoiceDate } from './utils/invoiceDates';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import download from 'downloadjs';
import {
  Download,
  FileText,
  Eye,
  Loader2,
  X,
  AlertCircle,
  LogOut,
  Save
} from 'lucide-react';

const today = getTodayInvoiceDate();
const INVOICE_SERIES_PREFIX = 'CC-2627-';

const generateNextInvoiceNumber = async () => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('invoice_no');

    if (error) throw error;

    let maxNo = 7560;

    if (data && data.length > 0) {
      data.forEach(row => {
        const match = String(row.invoice_no || '').match(/^CC-2627-(\d+)$/);
        const num = match ? Number(match[1]) : 0;

        if (!Number.isNaN(num) && num > maxNo) {
          maxNo = num;
        }
      });
    }

    return `${INVOICE_SERIES_PREFIX}${maxNo + 1}`;
  } catch (err) {
    console.error('Failed to fetch live sequence:', err);
    return `${INVOICE_SERIES_PREFIX}7561`;
  }
};

function InvoiceWorkspace({ role, onSignOut }) {
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('canvas_active_tab');
    return savedTab === 'dashboard' ? 'overview' : savedTab || 'overview';
  });

  const [isChallan, setIsChallan] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [copyType, setCopyType] = useState('Master Copy');

  const [copyFormats, setCopyFormats] = useState({
    'Master Copy': 'pdf',
    'Office Copy': 'pdf',
    'DCCHALLAN': 'pdf',
  });

  const [savedInvoiceNo, setSavedInvoiceNo] = useState(null);
  const [savedInvoiceId, setSavedInvoiceId] = useState(null);
  const [error, setError] = useState(null);

  const prevUrlRef = useRef(null);

  const navigateToTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('canvas_active_tab', tab);
  };

  const [invoiceData, setInvoiceData] = useState({
    invoiceNo: 'CC-2627-7561',
    invoiceDate: today,
    poNo: '',
    poDate: '',
    freight: 0,
    clientName: '',
    clientAddress: '',
    clientGstin: '',
    clientState: '',
    clientStateCode: '',
    clientVendorCode: '',
    clientEmail: '',
    status: 'Pending',
  });

  const [items, setItems] = useState([]);

  useEffect(() => {
    async function fetchLatestInvoiceNo() {
      if (activeTab === 'generator') {
        setSavedInvoiceNo(null);
        setSavedInvoiceId(null);

        const nextInvoiceNo = await generateNextInvoiceNumber();

        setInvoiceData(prev => ({
          ...prev,
          invoiceNo: nextInvoiceNo
        }));
      }
    }

    fetchLatestInvoiceNo();
  }, [activeTab]);

  const totals = useMemo(
    () =>
      calculateTotals(
        items,
        invoiceData.clientGstin,
        invoiceData.freight
      ),
    [
      items,
      invoiceData.clientGstin,
      invoiceData.freight
    ]
  );

  const enrichedTotals = useMemo(
    () => ({
      ...totals,
      inWords: numberToWords(totals.grandTotal || 0),
    }),
    [totals]
  );

  const getTemplateKey = useCallback(
    () => (
      copyType === 'Office Copy'
        ? 'office'
        : copyType === 'DCCHALLAN'
          ? 'dcchallan'
          : 'master'
    ),
    [copyType]
  );

  const selectedFormat = copyFormats[copyType];

  const setSelectedFormat = (format) => {
    setCopyFormats(prev => ({
      ...prev,
      [copyType]: format
    }));
  };

  // The full-design PDF remains the canonical document.
  const generatePdf = useCallback(async () => {
    return await stampInvoice(
      invoiceData,
      enrichedTotals,
      isChallan ? 'challan' : 'invoice',
      getTemplateKey(),
      'full'
    );
  }, [
    invoiceData,
    enrichedTotals,
    isChallan,
    getTemplateKey
  ]);

  // For Master Copy JPG only, use the supplied Print Ready template
  // without the company header. PDF output remains unchanged.
  const generateOutput = useCallback(async () => {
    const templateKey = getTemplateKey();

    const pdfBlob = await stampInvoice(
      invoiceData,
      enrichedTotals,
      isChallan ? 'challan' : 'invoice',
      templateKey,
      selectedFormat === 'jpg' && templateKey === 'master'
        ? 'print'
        : 'full'
    );

    return selectedFormat === 'jpg'
      ? convertPdfToJpeg(pdfBlob)
      : pdfBlob;
  }, [
    invoiceData,
    enrichedTotals,
    isChallan,
    getTemplateKey,
    selectedFormat
  ]);

  const handlePreview = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const blob = await generateOutput();

      const url = URL.createObjectURL(blob);

      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
      }

      prevUrlRef.current = url;

      setPreviewUrl(url);
      setShowModal(true);

    } catch (err) {
      setError(err.message);

    } finally {
      setIsGenerating(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
  };

  // ---------------------------------------------------------
  // SAVE INVOICE
  // Saves database record + canonical PDF.
  // Does NOT download anything.
  // ---------------------------------------------------------
  const handleSave = async () => {
    setIsDownloading(true);
    setError(null);

    try {
      // Prevent saving the same invoice again.
      if (savedInvoiceId) {
        return;
      }

      const saveResult = await saveInvoiceToDatabase(
        invoiceData,
        items
      );

      if (!saveResult || !saveResult.success) {
        throw new Error('Database save failed.');
      }

      const confirmedInvoiceNo = saveResult.invoiceNo;
      const confirmedInvoiceId = saveResult.invoiceId;

      setSavedInvoiceId(confirmedInvoiceId);
      setSavedInvoiceNo(confirmedInvoiceNo);

      setInvoiceData(prev => ({
        ...prev,
        invoiceNo: confirmedInvoiceNo
      }));

      // Generate the canonical full PDF.
      const pdfBlob = await stampInvoice(
        {
          ...invoiceData,
          invoiceNo: confirmedInvoiceNo
        },
        enrichedTotals,
        isChallan ? 'challan' : 'invoice',
        getTemplateKey(),
        'full'
      );

      // Save canonical PDF to Supabase Storage.
      await saveInvoicePdf(
        confirmedInvoiceId,
        pdfBlob
      );

      console.log(
        'Invoice saved successfully:',
        confirmedInvoiceNo
      );

    } catch (err) {
      console.error('Save invoice error:', err);
      setError(err.message);

    } finally {
      setIsDownloading(false);
    }
  };

  // ---------------------------------------------------------
  // DOWNLOAD INVOICE
  // Generates and downloads only.
  // Does NOT save to Supabase.
  // ---------------------------------------------------------
  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);

    try {
      const invoiceNo =
        savedInvoiceNo ||
        invoiceData.invoiceNo ||
        'Preview';

      const templateKey = getTemplateKey();

      const pdfBlob = await stampInvoice(
        {
          ...invoiceData,
          invoiceNo
        },
        enrichedTotals,
        isChallan ? 'challan' : 'invoice',
        templateKey,
        'full'
      );

      let blob = pdfBlob;

      if (selectedFormat === 'jpg') {
        const jpgSourcePdf = await stampInvoice(
          {
            ...invoiceData,
            invoiceNo
          },
          enrichedTotals,
          isChallan ? 'challan' : 'invoice',
          templateKey,
          templateKey === 'master'
            ? 'print'
            : 'full'
        );

        blob = await convertPdfToJpeg(
          jpgSourcePdf
        );
      }

      const extension =
        selectedFormat === 'jpg'
          ? 'jpg'
          : 'pdf';

      const mimeType =
        selectedFormat === 'jpg'
          ? 'image/jpeg'
          : 'application/pdf';

      const filename =
        `CC-${isChallan ? 'Challan' : 'Invoice'}-${invoiceNo}.${extension}`;

      download(
        blob,
        filename,
        mimeType
      );

    } catch (err) {
      console.error(
        'Download invoice error:',
        err
      );

      setError(err.message);

    } finally {
      setIsDownloading(false);
    }
  };

  const docLabel = isChallan
    ? 'Challan'
    : 'Invoice';

  return (
    <div
      className="app-wrapper"
      style={{
        width: '100vw',
        maxWidth: '100%',
        margin: 0,
        paddingTop: '60px',
        boxSizing: 'border-box',
        overflowX: 'hidden'
      }}
    >
      <nav
        className="navbar"
        style={{
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <div className="navbar-brand">

          <div
            className="navbar-logo"
            style={{
              background: '#ffffff',
              padding: '3px',
              overflow: 'hidden'
            }}
          >
            <img
              src="/logo.svg"
              alt="Canvas Creation logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transform: 'scale(2.35)'
              }}
            />
          </div>

          <div>
            <div className="navbar-title">
              Canvas Creation
            </div>

            <div className="navbar-subtitle">
              Invoice Automation Engine · {role}
            </div>
          </div>

        </div>

        {/* TOP RIGHT HEADER BUTTONS */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >

          {/* SAVE INVOICE */}
          {activeTab === 'generator' && (
            <button
              className="btn btn-sm"
              onClick={handleSave}
              disabled={isDownloading || savedInvoiceId}
              title="Save Invoice"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                border: '1px solid var(--border)',
                borderRadius: '9px',
                padding: '8px 14px'
              }}
            >
              {isDownloading ? (
                <>
                  <Loader2
                    size={15}
                    className="spin"
                  />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>
                    {savedInvoiceId
                      ? 'Saved'
                      : 'Save Invoice'}
                  </span>
                </>
              )}
            </button>
          )}

          {/* SIGN OUT */}
          <button
            className="btn btn-sm btn-ghost"
            onClick={onSignOut}
            title="Sign out"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              border: '1px solid var(--border)',
              borderRadius: '9px',
              padding: '8px 12px'
            }}
          >
            <LogOut size={15} />
            <span>Sign out</span>
          </button>

        </div>
      </nav>

      <main
        className="main-content"
        style={{
          padding: 0,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          margin: 0
        }}
      >

        {error && (
          <div
            className="error-banner"
            style={{
              margin: '20px'
            }}
          >
            <AlertCircle
              size={16}
              style={{
                flexShrink: 0,
                marginTop: 1
              }}
            />

            <span>{error}</span>
          </div>
        )}

        {activeTab === 'overview' ||
        activeTab === 'user' ? (

          <OverviewDashboard
            onNewInvoice={() =>
              navigateToTab('generator')
            }
            onOpenBilling={() =>
              navigateToTab('billing')
            }
            onNavigate={navigateToTab}
            activeView={activeTab}
          />

        ) : activeTab === 'billing' ? (

          <Dashboard
            onNewInvoice={() =>
              navigateToTab('generator')
            }
            onOpenOverview={() =>
              navigateToTab('overview')
            }
            onNavigate={navigateToTab}
          />

        ) : (

          <div
            style={{
              display: 'flex',
              minHeight: 'calc(100vh - 60px)',
              width: '100%',
              background: '#f7f9fc'
            }}
          >

            <WorkspaceSidebar
              activeView="generator"
              onNavigate={navigateToTab}
            />

            <div
              style={{
                flex: 1,
                minWidth: 0,
                padding: '20px',
                boxSizing: 'border-box'
              }}
            >

              <InvoiceForm
                invoiceData={invoiceData}
                setInvoiceData={setInvoiceData}
                items={items}
                setItems={setItems}
              />

            </div>

          </div>

        )}

      </main>

      {/* BOTTOM ACTION BAR */}
      {activeTab === 'generator' && (
        <div
          className="action-bar"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >

          <div
            className="action-bar-info"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '15px'
            }}
          >

            <div>
              <strong>
                {docLabel} #
                {invoiceData.invoiceNo || '—'}
              </strong>

              {invoiceData.clientName && (
                <>
                  &nbsp;·&nbsp;
                  {invoiceData.clientName}
                </>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                background: 'rgba(255,255,255,0.08)',
                padding: '4px 10px',
                borderRadius: '6px'
              }}
            >

              <span style={{ opacity: 0.8 }}>
                Status:
              </span>

              <select
                value={invoiceData.status}
                onChange={e =>
                  setInvoiceData(prev => ({
                    ...prev,
                    status: e.target.value
                  }))
                }
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >

                <option
                  value="Successful"
                  style={{ color: '#000' }}
                >
                  Successful
                </option>

                <option
                  value="Paid"
                  style={{ color: '#000' }}
                >
                  Paid
                </option>

                <option
                  value="Pending"
                  style={{ color: '#000' }}
                >
                  Pending
                </option>

                <option
                  value="Cancelled"
                  style={{ color: '#000' }}
                >
                  Cancelled
                </option>

              </select>

            </div>

          </div>

          <div className="action-bar-buttons">

            <select
              value={copyType}
              onChange={e =>
                setCopyType(e.target.value)
              }
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                color: '#00665e',
                cursor: 'pointer'
              }}
            >

              <option value="Master Copy">
                Master Copy
              </option>

              <option value="Office Copy">
                Office Copy
              </option>

              <option value="DCCHALLAN">
                DCCHALLAN
              </option>

            </select>

            <select
              value={selectedFormat}
              onChange={e =>
                setSelectedFormat(e.target.value)
              }
              aria-label={`${copyType} output format`}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                color: '#00665e',
                cursor: 'pointer'
              }}
            >

              <option value="pdf">
                PDF
              </option>

              <option value="jpg">
                JPG
              </option>

            </select>

            {/* PREVIEW */}
            <button
              className="btn btn-outline"
              onClick={handlePreview}
              disabled={
                isGenerating ||
                isDownloading
              }
            >

              {isGenerating ? (
                <>
                  <Loader2
                    size={15}
                    className="spin"
                  />
                  Generating…
                </>
              ) : (
                <>
                  <Eye size={15} />
                  Preview {docLabel}
                </>
              )}

            </button>

            {/* DOWNLOAD */}
            <button
              className="btn"
              onClick={handleDownload}
              disabled={
                isGenerating ||
                isDownloading
              }
            >

              {isDownloading ? (
                <>
                  <Loader2
                    size={15}
                    className="spin"
                  />
                  Downloading…
                </>
              ) : (
                <>
                  <Download size={15} />
                  Download {docLabel}
                </>
              )}

            </button>

          </div>

        </div>
      )}

      {/* PREVIEW MODAL */}
      {showModal && (
        <div
          className="modal-backdrop"
          onClick={closeModal}
        >

          <div
            className="modal"
            onClick={e =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <div className="modal-title">
                <FileText size={17} />

                {docLabel} Preview —
                #{invoiceData.invoiceNo}
              </div>

              <div className="modal-actions">

                <button
                  className="btn btn-sm"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >

                  {isDownloading ? (
                    <>
                      <Loader2
                        size={13}
                        className="spin"
                      />
                      Downloading…
                    </>
                  ) : (
                    <>
                      <Download size={13} />
                      Download
                    </>
                  )}

                </button>

                <button
                  className="btn btn-sm btn-ghost"
                  onClick={closeModal}
                >
                  <X size={15} />
                </button>

              </div>

            </div>

            <div className="modal-body">

              {previewUrl ? (

                selectedFormat === 'jpg' ? (

                  <img
                    src={previewUrl}
                    alt={`${copyType} preview`}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 'auto'
                    }}
                  />

                ) : (

                  <iframe
                    src={previewUrl}
                    title="Bill Preview"
                  />

                )

              ) : (

                <div className="modal-loading">

                  <Loader2
                    size={28}
                    className="spin"
                    style={{
                      color: 'var(--cc-teal)'
                    }}
                  />

                  <span>
                    Rendering…
                  </span>

                </div>

              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [role, setRole] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data } =
        await supabase.auth.getSession();

      if (!active) return;

      if (!data.session) {
        setSession(null);
        return;
      }

      const {
        data: profile,
        error
      } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single();

      if (!active) return;

      if (error || !profile?.role) {
        await supabase.auth.signOut();
        setSession(null);
        return;
      }

      setRole(profile.role);
      setSession(data.session);
    }

    loadSession();

    const {
      data: listener
    } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setRole(null);
        }
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) {
    return (
      <div className="auth-loading">
        Loading secure workspace...
      </div>
    );
  }

  if (!session) {
    return (
      <Login
        onLoginSuccess={(nextRole) => {
          setRole(nextRole);
          setSession({ user: true });
        }}
      />
    );
  }

  return (
    <InvoiceWorkspace
      role={role}
      onSignOut={() =>
        supabase.auth.signOut()
      }
    />
  );
}
