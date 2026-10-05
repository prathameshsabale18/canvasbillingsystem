import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import download from 'downloadjs';
import {
  Trash2,
  Plus,
  FileText,
  Loader2,
  Search,
  RefreshCw,
  LayoutDashboard,
  Settings,
  FileSpreadsheet,
  Building2,
  ChevronDown,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Eye,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download
} from 'lucide-react';

import {
  calculateInvoiceItemAmount,
  calculateInvoiceReportTotals,
  downloadInvoiceReportPDF,
  getInvoiceDateKey
} from '../utils/invoiceReportPdf';
import {
  formatInvoiceDate,
  toStoredInvoiceDate
} from '../utils/invoiceDates';

import {
  downloadSavedInvoicePdf,
  removeSavedInvoicePdf
} from '../utils/invoicePdfStorage';

import WorkspaceSidebar from './WorkspaceSidebar';

const getLocalMonth = () => {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`;
};

const editInputStyle = {
  width: '100%',
  minWidth: 0,
  padding: '8px 9px',
  border: '1px solid #b8dcd7',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#172033',
  fontSize: '12px',
  boxSizing: 'border-box',
};

export default function Dashboard({
  onNewInvoice,
  onOpenOverview,
  onNavigate
}) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // CHANGED: show all invoices by default
  const [reportType, setReportType] = useState('all');

  const [reportMonth, setReportMonth] = useState(getLocalMonth);
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');
  const [reportDownloading, setReportDownloading] = useState(false);

  // CHANGED: invoice number descending by default
  const [sortConfig, setSortConfig] = useState({
    key: 'invoice_no',
    direction: 'desc'
  });

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditInvoice, setCurrentEditInvoice] = useState(null);

  const [editFormData, setEditFormData] = useState({
    invoice_no: '',
    date: '',
    amount: '',
    status: 'Pending',
    po_no: '',
    freight: 0,
    items: []
  });

  const [savingEdit, setSavingEdit] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, clients(*)')
        .order('id', { ascending: false });

      if (error) {
        console.error(
          'Supabase fetch error:',
          error.message
        );
      } else {
        const records = data || [];

        const normalizedRecords = await Promise.all(
          records.map(async invoice => {
            const {
              data: invoiceItems,
              error: itemsError
            } = await supabase
              .from('invoice_items')
              .select('*')
              .eq('invoice_id', invoice.id);

            if (itemsError) {
              console.error(
                'Invoice items fetch error:',
                itemsError.message
              );
            }

            const invoiceWithItems = {
              ...invoice,
              items: invoiceItems?.length
                ? invoiceItems
                : invoice.items,
            };

            const calculated =
              calculateInvoiceReportTotals(
                invoiceWithItems
              );

            const valuesChanged = [
              ['amount', calculated.grandTotal],
              ['grand_total', calculated.grandTotal],
              ['subtotal', calculated.subtotal],
              ['cgst', calculated.cgst],
              ['sgst', calculated.sgst],
              ['igst', calculated.igst],
            ].some(
              ([field, value]) =>
                Math.abs(
                  Number(invoice[field] || 0) -
                  Number(value || 0)
                ) > 0.005
            );

            if (valuesChanged) {
              const { error: syncError } =
                await supabase
                  .from('invoices')
                  .update({
                    amount: calculated.grandTotal,
                    grand_total: calculated.grandTotal,
                    subtotal: calculated.subtotal,
                    cgst: calculated.cgst,
                    sgst: calculated.sgst,
                    igst: calculated.igst,
                  })
                  .eq('id', invoice.id);

              if (syncError) {
                console.error(
                  'Invoice total sync error:',
                  syncError.message
                );
              }
            }

            return {
              ...invoice,
              items: invoiceItems?.length
                ? invoiceItems
                : (
                    Array.isArray(invoice.items)
                      ? invoice.items
                      : []
                  ),
              ...calculated,
              amount: calculated.grandTotal,
              grand_total: calculated.grandTotal,
            };
          })
        );

        setInvoices(normalizedRecords);
      }

    } catch (err) {
      console.error(
        'Exception fetching invoices:',
        err
      );

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoiceDetails = async invoice => {
    setSelectedInvoice(invoice);
    setLoadingDetails(true);

    try {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id);

      if (!error && data?.length) {
        setInvoiceItems(data);
      } else {
        setInvoiceItems(
          Array.isArray(invoice.items)
            ? invoice.items
            : []
        );
      }

    } catch (err) {
      setInvoiceItems(
        Array.isArray(invoice.items)
          ? invoice.items
          : []
      );

    } finally {
      setLoadingDetails(false);
    }
  };

  const handleStatusChange = async (
    invoiceId,
    newStatus,
    e
  ) => {
    if (e) e.stopPropagation();

    setInvoices(prev =>
      prev.map(inv =>
        inv.id === invoiceId
          ? {
              ...inv,
              status: newStatus
            }
          : inv
      )
    );

    const { error } = await supabase
      .from('invoices')
      .update({
        status: newStatus
      })
      .eq('id', invoiceId);

    if (error) {
      fetchInvoices();
    }
  };

  const handleDelete = async (
    invoiceId,
    e
  ) => {
    if (e) e.stopPropagation();

    if (
      !window.confirm(
        'Are you sure you want to delete this invoice record?'
      )
    ) {
      return;
    }

    const invoice = invoices.find(
      item => item.id === invoiceId
    );

    try {
      await removeSavedInvoicePdf(invoice);
    } catch (storageError) {
      console.error(
        'Invoice PDF cleanup error:',
        storageError.message
      );
    }

    await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoiceId);

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId);

    if (!error) {
      setInvoices(prev =>
        prev.filter(
          inv => inv.id !== invoiceId
        )
      );

      if (
        selectedInvoice?.id === invoiceId
      ) {
        setSelectedInvoice(null);
      }
    }
  };

  const handleDownloadInvoicePdf = async (
    invoice,
    e
  ) => {
    if (e) e.stopPropagation();

    try {
      const pdfBlob =
        await downloadSavedInvoicePdf(
          invoice
        );

      download(
        pdfBlob,
        `CC-Invoice-${invoice.invoice_no || invoice.id}.pdf`,
        'application/pdf'
      );

    } catch (error) {
      alert(
        `PDF Download Error: ${error.message}`
      );
    }
  };

  const handleOpenEdit = async (
    inv,
    e
  ) => {
    if (e) e.stopPropagation();

    let items = Array.isArray(inv.items)
      ? inv.items
      : [];

    const { data } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', inv.id);

    if (data?.length) {
      items = data;
    }

    setCurrentEditInvoice(inv);

    setEditFormData({
      invoice_no: inv.invoice_no || '',
      date: formatInvoiceDate(
        inv.date || inv.invoice_date
      ),
      amount: inv.amount || '',
      status: [
        'Paid',
        'Pending',
        'Cancelled'
      ].includes(inv.status)
        ? inv.status
        : 'Pending',
      po_no:
        inv.po_no ||
        inv.poNo ||
        inv.po_number ||
        '',
      freight: inv.freight || 0,
      items
    });

    setIsEditModalOpen(true);
  };

  const handleUpdateInvoice = async e => {
    e.preventDefault();

    if (!currentEditInvoice) return;

    const invoiceDate = toStoredInvoiceDate(
      editFormData.date
    );

    if (!invoiceDate) {
      alert('Enter a valid invoice date in DD/MM/YYYY format.');
      return;
    }

    setSavingEdit(true);

    try {
      const calculated =
        calculateInvoiceReportTotals({
          ...currentEditInvoice,
          items: editFormData.items,
          freight: editFormData.freight,
        });

      const { error } = await supabase
        .from('invoices')
        .update({
          invoice_no:
            editFormData.invoice_no,

          date:
            invoiceDate,

          amount:
            calculated.grandTotal,

          grand_total:
            calculated.grandTotal,

          subtotal:
            calculated.subtotal,

          cgst:
            calculated.cgst,

          sgst:
            calculated.sgst,

          igst:
            calculated.igst,

          status:
            editFormData.status
        })
        .eq(
          'id',
          currentEditInvoice.id
        );

      if (error) {
        console.error(
          'Error updating invoice:',
          error.message
        );

      } else {
        await supabase
          .from('invoice_items')
          .delete()
          .eq(
            'invoice_id',
            currentEditInvoice.id
          );

        if (
          editFormData.items.length
        ) {
          const {
            error: itemError
          } = await supabase
            .from('invoice_items')
            .insert(
              editFormData.items.map(
                item => ({
                  invoice_id:
                    currentEditInvoice.id,

                  description:
                    item.description ||
                    item.item_name ||
                    '',

                  quantity:
                    Number(
                      item.quantity || 0
                    ),

                  rate:
                    Number(
                      item.baseRate ??
                      item.rate ??
                      item.price ??
                      0
                    ),

                  per:
                    item.per ||
                    item.uom ||
                    'Nos',

                  total_sqft:
                    item.totalSqft ??
                    item.total_sqft ??
                    null,
                })
              )
            );

          if (itemError) {
            console.error(
              'Error updating invoice items:',
              itemError.message
            );
          }
        }

        setIsEditModalOpen(false);

        fetchInvoices();
      }

    } catch (err) {
      console.error(
        'Exception updating invoice:',
        err
      );

    } finally {
      setSavingEdit(false);
    }
  };

  // ---------------------------------------------------------
  // SORTING
  // ---------------------------------------------------------

  const handleSort = key => {
    let direction = 'asc';

    if (
      sortConfig.key === key &&
      sortConfig.direction === 'asc'
    ) {
      direction = 'desc';
    }

    setSortConfig({
      key,
      direction
    });
  };

  // ---------------------------------------------------------
  // REPORT RANGE
  // ---------------------------------------------------------

  const reportRange = useMemo(() => {
    // ALL INVOICES
    if (reportType === 'all') {
      return {
        start: '0000-01-01',
        end: '9999-12-31'
      };
    }

    // MONTH
    if (reportType === 'month') {
      const [
        year,
        month
      ] = reportMonth
        .split('-')
        .map(Number);

      const lastDay =
        new Date(
          year,
          month,
          0
        ).getDate();

      return {
        start:
          `${reportMonth}-01`,

        end:
          `${reportMonth}-${String(
            lastDay
          ).padStart(2, '0')}`
      };
    }

    // CUSTOM RANGE
    return {
      start: getInvoiceDateKey(reportStart),
      end: getInvoiceDateKey(reportEnd)
    };

  }, [
    reportType,
    reportMonth,
    reportStart,
    reportEnd
  ]);

  // ---------------------------------------------------------
  // FILTER + SORT INVOICES
  // ---------------------------------------------------------

  const filteredAndSortedInvoices =
    useMemo(() => {
      let result =
        invoices.filter(inv => {
          const clientName =
            inv.clients?.client_name ||
            inv.client_name ||
            '';

          const poVal =
            inv.po_no ||
            inv.poNo ||
            inv.po_number ||
            '';

          const productText =
            (
              Array.isArray(inv.items)
                ? inv.items
                : []
            )
              .map(
                item =>
                  item.description ||
                  item.item_name ||
                  item.productName ||
                  item.product ||
                  ''
              )
              .join(' ');

          const normalizedSearch =
            searchTerm
              .trim()
              .toLowerCase();

          const matchesSearch =
            !normalizedSearch ||
            [
              inv.invoice_no,
              clientName,
              poVal,
              inv.clients?.gst_no ||
                inv.client_gstin ||
                inv.clientGstin,
              inv.status,
              productText,
            ].some(value =>
              String(value || '')
                .toLowerCase()
                .includes(
                  normalizedSearch
                )
            );

          const matchesStatus =
            statusFilter === 'All' ||
            inv.status === statusFilter;

          const invoiceDate =
            getInvoiceDateKey(
              inv.date ||
              inv.invoice_date
            ) ||
            getInvoiceDateKey(
              inv.created_at
            );

          const matchesPeriod =
            normalizedSearch ||
            (
              invoiceDate &&
              invoiceDate >=
                reportRange.start &&
              invoiceDate <=
                reportRange.end
            );

          return (
            matchesSearch &&
            matchesStatus &&
            matchesPeriod
          );
        });

      // -------------------------------------------------------
      // CORRECT SORTING
      // -------------------------------------------------------

      if (sortConfig.key) {
        result.sort((a, b) => {
          let aValue;
          let bValue;

          // Invoice number:
          // CC-2627-7567 -> 7567
          // CC-2627-7500 -> 7500
          if (
            sortConfig.key ===
            'invoice_no'
          ) {
            aValue = Number(
              String(
                a.invoice_no || ''
              ).match(
                /(\d+)$/
              )?.[1] || 0
            );

            bValue = Number(
              String(
                b.invoice_no || ''
              ).match(
                /(\d+)$/
              )?.[1] || 0
            );

          // Date
          } else if (
            sortConfig.key === 'date'
          ) {
            aValue =
              getInvoiceDateKey(
                a.date ||
                a.invoice_date
              ) || '';

            bValue =
              getInvoiceDateKey(
                b.date ||
                b.invoice_date
              ) || '';

          // Client
          } else if (
            sortConfig.key ===
            'client_name'
          ) {
            aValue = (
              a.clients?.client_name ||
              a.client_name ||
              ''
            ).toLowerCase();

            bValue = (
              b.clients?.client_name ||
              b.client_name ||
              ''
            ).toLowerCase();

          // Amount
          } else if (
            sortConfig.key ===
            'amount'
          ) {
            aValue = Number(
              a.amount || 0
            );

            bValue = Number(
              b.amount || 0
            );

          } else {
            aValue =
              a[
                sortConfig.key
              ] ?? '';

            bValue =
              b[
                sortConfig.key
              ] ?? '';
          }

          if (
            aValue < bValue
          ) {
            return sortConfig.direction ===
              'asc'
              ? -1
              : 1;
          }

          if (
            aValue > bValue
          ) {
            return sortConfig.direction ===
              'asc'
              ? 1
              : -1;
          }

          return 0;
        });
      }

      return result;

    }, [
      invoices,
      searchTerm,
      statusFilter,
      sortConfig,
      reportRange
    ]);

  const metrics = useMemo(() => {
    const totalCount =
      invoices.length;

    return {
      totalCount
    };
  }, [invoices]);

  const reportTotals = useMemo(() => {
    const selected =
      invoices.filter(
        invoice => {
          const invoiceDate =
            getInvoiceDateKey(
              invoice.date ||
              invoice.invoice_date
            ) ||
            getInvoiceDateKey(
              invoice.created_at
            );

          return (
            invoiceDate &&
            invoiceDate >=
              reportRange.start &&
            invoiceDate <=
              reportRange.end
          );
        }
      );

    const summaryInvoices =
      selected.length > 0
        ? selected
        : invoices;

    const summary =
      summaryInvoices.reduce(
        (summary, invoice) => {
          const totals =
            calculateInvoiceReportTotals(
              invoice
            );

          const isPending =
            String(
              invoice.status || ''
            ).toLowerCase() ===
            'pending';

          return {
            count:
              summary.count + 1,

            totalAmount:
              summary.totalAmount +
              totals.grandTotal,

            pendingAmount:
              summary.pendingAmount +
              (
                isPending
                  ? totals.grandTotal
                  : 0
              ),

            assessableValue:
              summary.assessableValue +
              totals.assessableValue,

            cgst:
              summary.cgst +
              totals.cgst,

            sgst:
              summary.sgst +
              totals.sgst,

            igst:
              summary.igst +
              totals.igst,

            totalGst:
              summary.totalGst +
              totals.cgst +
              totals.sgst,

            usingAllBills:
              summary.usingAllBills,
          };
        },
        {
          count: 0,
          totalAmount: 0,
          pendingAmount: 0,
          assessableValue: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalGst: 0,

          usingAllBills:
            selected.length === 0 &&
            invoices.length > 0
        }
      );

    return summary;

  }, [
    invoices,
    reportRange
  ]);

  const handleReportDownload =
    async () => {
      if (
        !reportRange.start ||
        !reportRange.end ||
        reportRange.start >
          reportRange.end
      ) {
        alert(
          'Please select a valid report date range.'
        );

        return;
      }

      setReportDownloading(true);

      try {
        await downloadInvoiceReportPDF(
  filteredAndSortedInvoices,
  reportRange.start,
  reportRange.end,
  true
);

      } catch (err) {
        console.error(
          'Failed to generate invoice report:',
          err
        );

        alert(
          'Could not generate the invoice report. Please try again.'
        );

      } finally {
        setReportDownloading(false);
      }
    };

  const getStatusBadge =
    status => {
      switch (status) {
        case 'Successful':
        case 'Paid':
          return {
            bg: '#f0fdf4',
            color: '#166534',
            border: '#dcfce7'
          };

        case 'Pending':
          return {
            bg: '#fefce8',
            color: '#854d0e',
            border: '#fef08a'
          };

        case 'Cancelled':
          return {
            bg: '#fef2f2',
            color: '#991b1b',
            border: '#fecaca'
          };

        default:
          return {
            bg: '#f8fafc',
            color: '#475569',
            border: '#e2e8f0'
          };
      }
    };

  const renderSortIcon =
    key => {
      if (
        sortConfig.key !== key
      ) {
        return (
          <ArrowUpDown
            size={12}
            style={{
              opacity: 0.4,
              marginLeft: '6px'
            }}
          />
        );
      }

      return sortConfig.direction ===
        'asc'
        ? (
          <ArrowUp
            size={12}
            style={{
              marginLeft: '6px',
              color: '#00665e'
            }}
          />
        )
        : (
          <ArrowDown
            size={12}
            style={{
              marginLeft: '6px',
              color: '#00665e'
            }}
          />
        );
    };

  const getItemSize =
    item => {
      const description =
        String(
          item.description || ''
        );

      const dimensions =
        description.match(
          /(\d+(?:\.\d+)?)\s*(?:x|X|\*|\u00D7|\u2715|\u2716)\s*(\d+(?:\.\d+)?)/
        );

      if (
        dimensions &&
        String(item.per || '')
          .toLowerCase()
          .includes('sq')
      ) {
        return `${dimensions[1]} x ${dimensions[2]} sqft`;
      }

      return (
        item.per ||
        item.uom ||
        'Nos'
      );
    };

  return (
    <div
      className="dashboard-shell"
      style={{
        display: 'flex',
        width: '100%',
        maxWidth: 'none',
        minHeight:
          'calc(100vh - 60px)',
        margin: 0,
        background: '#ffffff',
        borderRadius: 0,
        boxShadow: 'none',
        fontFamily:
          'Inter, system-ui, sans-serif',
        color: '#172033',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >

      <WorkspaceSidebar
        activeView="billing"
        onNavigate={onNavigate}
      />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding:
            '32px 40px 40px',
          overflowY: 'auto',
          boxSizing: 'border-box',
          width: '100%',
          background: '#f7fbfb',
          borderTop:
            '4px solid #1ba5b8'
        }}
      >

        <div
          style={{
            background: '#ffffff',
            padding: '0',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >

          {/* HEADER */}
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              marginBottom: '30px',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >

            <div>

              <h1
                style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: '#172033',
                  margin: 0,
                  letterSpacing:
                    '-0.4px'
                }}
              >
                Billing
              </h1>

              <div
                style={{
                  display: 'flex',
                  gap: '20px',
                  marginTop: '14px',
                  borderBottom:
                    '1px solid #f1f5f9'
                }}
              >

                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#4b67d1',
                    paddingBottom:
                      '10px',
                    borderBottom:
                      '2px solid #4b67d1',
                    cursor: 'pointer'
                  }}
                >
                  All Bills
                </div>

              </div>

            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >

              <button
                onClick={
                  fetchInvoices
                }
                title="Refresh Records"
                style={{
                  background: '#ffffff',
                  border:
                    '1px solid #e2e8f0',
                  borderRadius: '9px',
                  padding: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems:
                    'center',
                  color: '#64748b'
                }}
              >
                <RefreshCw
                  size={18}
                  className={
                    loading
                      ? 'spin'
                      : ''
                  }
                />
              </button>

              <div
                title="Canvas Creation account"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#cbd5e1',
                  display: 'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  fontWeight: '700',
                  fontSize: '14px',
                  color: '#334155'
                }}
              >
                CC
              </div>

              <button
                onClick={
                  onNewInvoice
                }
                style={{
                  background: '#4b67d1',
                  color: '#fff',
                  border: 'none',
                  padding:
                    '12px 18px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems:
                    'center',
                  gap: '8px',
                  boxShadow:
                    '0 4px 10px rgba(75, 103, 209, 0.18)'
                }}
              >
                <Plus size={17} />
                New Invoice
              </button>

            </div>

          </div>

          {/* SEARCH / FILTER */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px',
              justifyContent:
                'space-between',
              alignItems: 'center',
              marginBottom: '30px'
            }}
          >

            <div
              style={{
                display: 'flex',
                gap: '14px',
                flex: '1',
                minWidth: '360px',
                alignItems: 'center'
              }}
            >

              <div
                style={{
                  position: 'relative',
                  flex: '1'
                }}
              >

                <Search
                  size={16}
                  style={{
                    position:
                      'absolute',
                    left: '16px',
                    top: '50%',
                    transform:
                      'translateY(-50%)',
                    color: '#94a3b8'
                  }}
                />

                <input
                  type="text"
                  placeholder="Search invoice no, client name, GSTIN, or PO..."
                  value={searchTerm}
                  onChange={e =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                  style={{
                    width: '100%',
                    padding:
                      '13px 18px 13px 44px',
                    borderRadius:
                      '10px',
                    border:
                      '1px solid #e2e8f0',
                    fontSize: '14px',
                    outline: 'none',
                    background:
                      '#f8fafc',
                    color:
                      '#0f172a',
                    boxSizing:
                      'border-box'
                  }}
                />

              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems:
                    'center',
                  gap: '8px',
                  border:
                    '1px solid #e2e8f0',
                  padding:
                    '12px 18px',
                  borderRadius:
                    '10px',
                  background: '#fff',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#64748b'
                }}
              >
                <Filter size={15} />
                Filter
              </div>

            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap'
              }}
            >

              {[
                'All',
                'Paid',
                'Pending',
                'Cancelled'
              ].map(status => (
                <button
                  key={status}
                  onClick={() =>
                    setStatusFilter(
                      status
                    )
                  }
                  style={{
                    padding:
                      '8px 14px',
                    borderRadius:
                      '8px',
                    border:
                      '1px solid',
                    borderColor:
                      statusFilter ===
                      status
                        ? '#00665e'
                        : '#e2e8f0',
                    background:
                      statusFilter ===
                      status
                        ? '#00665e'
                        : '#fff',
                    color:
                      statusFilter ===
                      status
                        ? '#fff'
                        : '#64748b',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {status}
                </button>
              ))}

            </div>

          </div>

          {/* REPORT FILTER */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'end',
              gap: '16px',
              padding: '20px',
              marginBottom: '28px',
              background: '#e6f7f9',
              border:
                '1px solid #b8dcd7',
              borderRadius: '12px'
            }}
          >

            <div
              style={{
                display: 'flex',
                flexDirection:
                  'column',
                gap: '7px',
                flex:
                  '1 1 220px',
                minWidth:
                  '210px'
              }}
            >

              <label
                style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#475569'
                }}
              >
                Report period
              </label>

              <select
                value={reportType}
                onChange={e =>
                  setReportType(
                    e.target.value
                  )
                }
                style={{
                  padding:
                    '11px 12px',
                  border:
                    '1px solid #cbd5e1',
                  borderRadius:
                    '8px',
                  background:
                    '#fff',
                  color:
                    '#334155',
                  fontSize:
                    '14px'
                }}
              >

                <option value="all">
                  All Invoices
                </option>

                <option value="month">
                  Month
                </option>

                <option value="range">
                  Custom date range
                </option>

              </select>

            </div>

            {reportType ===
            'month' ? (

              <div
                style={{
                  display: 'flex',
                  flexDirection:
                    'column',
                  gap: '7px',
                  flex:
                    '1 1 220px',
                  minWidth:
                    '220px'
                }}
              >

                <label
                  style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#475569'
                  }}
                >
                  Month
                </label>

                <input
                  type="month"
                  value={reportMonth}
                  onChange={e =>
                    setReportMonth(
                      e.target.value
                    )
                  }
                  style={{
                    padding:
                      '10px 12px',
                    border:
                      '1px solid #cbd5e1',
                    borderRadius:
                      '8px',
                    color:
                      '#334155',
                    fontSize:
                      '14px'
                  }}
                />

              </div>

            ) : reportType ===
              'range' ? (

              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection:
                      'column',
                    gap: '7px',
                    minWidth:
                      '190px'
                  }}
                >

                  <label
                    style={{
                      fontSize: '13px',
                      fontWeight:
                        '700',
                      color:
                        '#475569'
                    }}
                  >
                    From
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="DD/MM/YYYY"
                    value={
                      reportStart
                    }
                    onChange={e =>
                      setReportStart(
                        e.target.value
                      )
                    }
                    style={{
                      padding:
                        '10px 12px',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '8px',
                      color:
                        '#334155',
                      fontSize:
                        '14px'
                    }}
                  />

                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection:
                      'column',
                    gap: '7px',
                    minWidth:
                      '190px'
                  }}
                >

                  <label
                    style={{
                      fontSize: '13px',
                      fontWeight:
                        '700',
                      color:
                        '#475569'
                    }}
                  >
                    To
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="DD/MM/YYYY"
                    value={
                      reportEnd
                    }
                    onChange={e =>
                      setReportEnd(
                        e.target.value
                      )
                    }
                    style={{
                      padding:
                        '10px 12px',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '8px',
                      color:
                        '#334155',
                      fontSize:
                        '14px'
                    }}
                  />

                </div>
              </>

            ) : null}

            <button
              onClick={
                handleReportDownload
              }
              disabled={
                reportDownloading
              }
              title="Download invoice totals PDF"
              style={{
                display: 'flex',
                alignItems:
                  'center',
                gap: '8px',
                padding:
                  '11px 18px',
                border: 'none',
                borderRadius:
                  '8px',
                background:
                  '#00665e',
                color: '#fff',
                fontSize:
                  '14px',
                fontWeight:
                  '600',
                cursor:
                  reportDownloading
                    ? 'wait'
                    : 'pointer',
                opacity:
                  reportDownloading
                    ? 0.7
                    : 1,
                marginLeft:
                  'auto'
              }}
            >
              <Download size={15} />

              {reportDownloading
                ? 'Preparing...'
                : 'Download PDF'}
            </button>

          </div>

          {/* REPORT SUMMARY */}
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'end',
              gap: '16px',
              marginBottom:
                '12px',
              flexWrap: 'wrap'
            }}
          >

            <div
              style={{
                fontSize: '14px',
                color: '#64748b'
              }}
            >

              {reportType ===
              'all' ? (
                <>
                  Showing all{' '}
                  <strong
                    style={{
                      color:
                        '#172033'
                    }}
                  >
                    {reportTotals.count}
                  </strong>{' '}
                  loaded invoices.
                </>
              ) : reportTotals.usingAllBills ? (
                <>
                  Showing all{' '}
                  {
                    reportTotals.count
                  }{' '}
                  loaded bill
                  {reportTotals.count ===
                  1
                    ? ''
                    : 's'} because
                  the selected period
                  has no matching
                  invoice dates.
                </>
              ) : (
                <>
                  Showing totals for{' '}
                  <strong
                    style={{
                      color:
                        '#172033'
                    }}
                  >
                    {reportRange.start ||
                      'selected start'}{' '}
                    to{' '}
                    {reportRange.end ||
                      'selected end'}
                  </strong>
                </>
              )}

            </div>

            <div
              style={{
                fontSize: '14px',
                color: '#64748b'
              }}
            >
              {
                filteredAndSortedInvoices.length
              }{' '}
              bill
              {filteredAndSortedInvoices.length ===
              1
                ? ''
                : 's'} shown
            </div>

          </div>

          {/* SUMMARY CARDS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '14px',
              marginBottom:
                '28px'
            }}
          >

            {[
              [
                'Total Bills',
                reportTotals.count,
                reportType ===
                'all'
                  ? 'All invoices'
                  : 'Invoices in selected period'
              ],

              [
                'Total Amount',
                `₹${reportTotals.totalAmount.toFixed(2)}`,
                'Including GST'
              ],

              [
                'Amount Pending',
                `₹${reportTotals.pendingAmount.toFixed(2)}`,
                'Pending invoices'
              ],

              [
                'Assessed Value',
                `₹${reportTotals.assessableValue.toFixed(2)}`,
                'Before GST'
              ],

              [
                'Total GST',
                `₹${reportTotals.totalGst.toFixed(2)}`,
                'CGST + SGST'
              ],

            ].map(
              ([label, value, hint]) => (
                <div
                  key={label}
                  style={{
                    padding: '18px',
                    border:
                      `1px solid ${
                        label ===
                          'Total Amount' ||
                        label ===
                          'Total GST'
                          ? '#b8dcd7'
                          : '#e2e8f0'
                      }`,
                    borderRadius:
                      '10px',
                    background:
                      label ===
                      'Total Amount'
                        ? '#f0fdf4'
                        : '#fff'
                  }}
                >

                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight:
                        '700',
                      color:
                        '#64748b',
                      textTransform:
                        'uppercase'
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      marginTop:
                        '7px',
                      fontSize:
                        '20px',
                      fontWeight:
                        '700',
                      color:
                        '#172033'
                    }}
                  >
                    {value}
                  </div>

                  <div
                    style={{
                      marginTop:
                        '6px',
                      fontSize:
                        '12px',
                      color:
                        '#94a3b8'
                    }}
                  >
                    {hint}
                  </div>

                </div>
              )
            )}

          </div>

          {/* TABLE */}
          {loading ? (

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'center',
                padding: '80px'
              }}
            >
              <Loader2
                className="spin"
                size={32}
                style={{
                  color: '#00665e'
                }}
              />
            </div>

          ) : filteredAndSortedInvoices.length ===
            0 ? (

            <div
              style={{
                textAlign:
                  'center',
                padding: '80px',
                background:
                  '#f8fafc',
                borderRadius:
                  '14px',
                border:
                  '1px dashed #cbd5e1'
              }}
            >

              <FileText
                size={40}
                style={{
                  color:
                    '#cbd5e1',
                  marginBottom:
                    '12px'
                }}
              />

              <p
                style={{
                  fontSize:
                    '15px',
                  fontWeight:
                    '600',
                  color:
                    '#334155'
                }}
              >
                No billing records found
              </p>

              <p
                style={{
                  fontSize:
                    '13px',
                  color:
                    '#94a3b8',
                  marginTop:
                    '4px'
                }}
              >
                Click "New Invoice" to create your first transaction.
              </p>

            </div>

          ) : (

            <div
              style={{
                borderRadius:
                  '12px',
                border:
                  '1px solid #f1f5f9',
                overflowX:
                  'auto',
                overflowY:
                  'hidden',
                width: '100%'
              }}
            >

              <table
                style={{
                  width: '100%',
                  minWidth:
                    '1380px',
                  borderCollapse:
                    'collapse',
                  textAlign:
                    'left',
                  tableLayout:
                    'auto'
                }}
              >

                <thead>

                  <tr
                    style={{
                      background:
                        '#f8fafc',
                      borderBottom:
                        '1px solid #f1f5f9',
                      fontSize:
                        '12px',
                      color:
                        '#64748b',
                      fontWeight:
                        '700',
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        '0.6px'
                    }}
                  >

                    <th
                      onClick={() =>
                        handleSort(
                          'invoice_no'
                        )
                      }
                      style={{
                        padding:
                          '16px 20px',
                        cursor:
                          'pointer',
                        userSelect:
                          'none'
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center'
                        }}
                      >
                        Inv No{' '}
                        {renderSortIcon(
                          'invoice_no'
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() =>
                        handleSort(
                          'date'
                        )
                      }
                      style={{
                        padding:
                          '16px 20px',
                        cursor:
                          'pointer',
                        userSelect:
                          'none'
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center'
                        }}
                      >
                        Date{' '}
                        {renderSortIcon(
                          'date'
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() =>
                        handleSort(
                          'client_name'
                        )
                      }
                      style={{
                        padding:
                          '16px 20px',
                        cursor:
                          'pointer',
                        userSelect:
                          'none'
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center'
                        }}
                      >
                        Client{' '}
                        {renderSortIcon(
                          'client_name'
                        )}
                      </div>
                    </th>

                    <th
                      style={{
                        padding:
                          '16px 20px'
                      }}
                    >
                      GST No.
                    </th>

                    <th
                      style={{
                        padding:
                          '16px 20px'
                      }}
                    >
                      Products
                    </th>

                    <th
                      onClick={() =>
                        handleSort(
                          'amount'
                        )
                      }
                      style={{
                        padding:
                          '16px 20px',
                        cursor:
                          'pointer',
                        userSelect:
                          'none'
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center'
                        }}
                      >
                        Amount{' '}
                        {renderSortIcon(
                          'amount'
                        )}
                      </div>
                    </th>

                    <th
                      style={{
                        padding:
                          '16px 20px'
                      }}
                    >
                      CGST
                    </th>

                    <th
                      style={{
                        padding:
                          '16px 20px'
                      }}
                    >
                      SGST
                    </th>

                    <th
                      style={{
                        padding:
                          '16px 20px'
                      }}
                    >
                      Status
                    </th>

                    <th
                      style={{
                        padding:
                          '16px 20px',
                        textAlign:
                          'center'
                      }}
                    >
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredAndSortedInvoices.map(
                    inv => {
                      const badge =
                        getStatusBadge(
                          inv.status
                        );

                      const clientName =
                        inv.clients
                          ?.client_name ||
                        inv.client_name ||
                        'Unnamed Client';

                      const clientGst =
                        inv.clients
                          ?.gst_no ||
                        inv.client_gstin ||
                        inv.clientGstin ||
                        '';

                      const invoiceLineItems =
                        Array.isArray(
                          inv.items
                        )
                          ? inv.items
                          : [];

                      const productSummary =
                        invoiceLineItems
                          .map(
                            item =>
                              item.description ||
                              item.item_name ||
                              item.productName ||
                              item.product ||
                              'Unnamed item'
                          )
                          .filter(
                            Boolean
                          )
                          .join(', ');

                      const calculatedTotals =
                        calculateInvoiceReportTotals(
                          inv
                        );

                      return (
                        <tr
                          key={inv.id}
                          onClick={() =>
                            fetchInvoiceDetails(
                              inv
                            )
                          }
                          style={{
                            borderBottom:
                              '1px solid #f8fafc',
                            fontSize:
                              '14px',
                            cursor:
                              'pointer',
                            transition:
                              'background 0.15s ease'
                          }}
                          onMouseEnter={e =>
                            e.currentTarget.style.background =
                              '#f8fafc'
                          }
                          onMouseLeave={e =>
                            e.currentTarget.style.background =
                              'transparent'
                          }
                        >

                          <td
                            style={{
                              padding:
                                '18px 20px',
                              fontWeight:
                                '600',
                              color:
                                '#00665e'
                            }}
                          >
                            #{inv.invoice_no}
                          </td>

                          <td
                            style={{
                              padding:
                                '18px 20px',
                              color:
                                '#475569'
                            }}
                          >
                            {formatInvoiceDate(
                              inv.date || inv.invoice_date
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '18px 20px'
                            }}
                          >

                            <div
                              title={
                                clientName
                              }
                              style={{
                                fontWeight:
                                  '600',
                                color:
                                  '#0f172a',
                                maxWidth:
                                  '230px',
                                display:
                                  '-webkit-box',
                                WebkitBoxOrient:
                                  'vertical',
                                WebkitLineClamp:
                                  2,
                                overflow:
                                  'hidden',
                                lineHeight:
                                  1.25
                              }}
                            >
                              {clientName}
                            </div>

                            {clientGst && (
                              <div
                                style={{
                                  fontSize:
                                    '11px',
                                  color:
                                    '#64748b',
                                  marginTop:
                                    '3px'
                                }}
                              >
                                GST: {clientGst}
                              </div>
                            )}

                          </td>

                          <td
                            style={{
                              padding:
                                '18px 20px',
                              color:
                                '#64748b',
                              fontWeight:
                                '500',
                              whiteSpace:
                                'nowrap'
                            }}
                          >
                            {clientGst ||
                              '—'}
                          </td>

                          <td
                            style={{
                              padding:
                                '18px 20px',
                              color:
                                '#475569',
                              minWidth:
                                '220px',
                              maxWidth:
                                '320px'
                            }}
                          >

                            <div
                              title={
                                productSummary ||
                                'No products saved'
                              }
                              style={{
                                maxWidth:
                                  '300px',
                                display:
                                  '-webkit-box',
                                WebkitBoxOrient:
                                  'vertical',
                                WebkitLineClamp:
                                  2,
                                overflow:
                                  'hidden',
                                lineHeight:
                                  1.35
                              }}
                            >
                              {productSummary ||
                                'No products saved'}
                            </div>

                            {invoiceLineItems.length >
                              0 && (
                              <div
                                style={{
                                  fontSize:
                                    '12px',
                                  color:
                                    '#94a3b8',
                                  marginTop:
                                    '4px'
                                }}
                              >
                                {
                                  invoiceLineItems.length
                                }{' '}
                                item
                                {invoiceLineItems.length ===
                                1
                                  ? ''
                                  : 's'}
                              </div>
                            )}

                          </td>

                          <td
                            style={{
                              padding:
                                '18px 20px',
                              fontWeight:
                                '700',
                              color:
                                '#0f172a'
                            }}
                          >
                            ₹
                            {calculatedTotals.grandTotal.toFixed(
                              2
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '18px 20px',
                              color:
                                '#475569'
                            }}
                          >
                            ₹
                            {calculatedTotals.cgst.toFixed(
                              2
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '18px 20px',
                              color:
                                '#475569'
                            }}
                          >
                            ₹
                            {calculatedTotals.sgst.toFixed(
                              2
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '18px 20px'
                            }}
                            onClick={e =>
                              e.stopPropagation()
                            }
                          >

                            <select
                              value={[
                                'Paid',
                                'Pending',
                                'Cancelled'
                              ].includes(
                                inv.status
                              )
                                ? inv.status
                                : 'Pending'}
                              onChange={e =>
                                handleStatusChange(
                                  inv.id,
                                  e.target
                                    .value,
                                  e
                                )
                              }
                              style={{
                                background:
                                  badge.bg,
                                color:
                                  badge.color,
                                border:
                                  `1px solid ${badge.border}`,
                                padding:
                                  '6px 12px',
                                borderRadius:
                                  '8px',
                                fontWeight:
                                  '600',
                                fontSize:
                                  '12px',
                                cursor:
                                  'pointer',
                                outline:
                                  'none'
                              }}
                            >

                              <option value="Paid">
                                Paid
                              </option>

                              <option value="Pending">
                                Pending
                              </option>

                              <option value="Cancelled">
                                Cancelled
                              </option>

                            </select>

                          </td>

                          <td
                            style={{
                              padding:
                                '18px 20px',
                              textAlign:
                                'center'
                            }}
                            onClick={e =>
                              e.stopPropagation()
                            }
                          >

                            <div
                              style={{
                                display:
                                  'flex',
                                alignItems:
                                  'center',
                                justifyContent:
                                  'center',
                                gap: '8px'
                              }}
                            >

                              <button
                                onClick={() =>
                                  fetchInvoiceDetails(
                                    inv
                                  )
                                }
                                style={{
                                  background:
                                    '#e6f3f2',
                                  border:
                                    'none',
                                  cursor:
                                    'pointer',
                                  color:
                                    '#00665e',
                                  padding:
                                    '8px',
                                  borderRadius:
                                    '8px'
                                }}
                                title="View All Fields"
                              >
                                <Eye
                                  size={16}
                                />
                              </button>

                              <button
                                onClick={e =>
                                  handleOpenEdit(
                                    inv,
                                    e
                                  )
                                }
                                style={{
                                  background:
                                    '#fef9c3',
                                  border:
                                    'none',
                                  cursor:
                                    'pointer',
                                  color:
                                    '#854d0e',
                                  padding:
                                    '8px',
                                  borderRadius:
                                    '8px'
                                }}
                                title="Edit Record"
                              >
                                <Pencil
                                  size={16}
                                />
                              </button>

                              <button
                                onClick={e =>
                                  handleDownloadInvoicePdf(
                                    inv,
                                    e
                                  )
                                }
                                disabled={
                                  !inv.pdf_storage_path
                                }
                                style={{
                                  background:
                                    inv.pdf_storage_path
                                      ? '#e6f3f2'
                                      : '#f8fafc',
                                  border:
                                    'none',
                                  cursor:
                                    inv.pdf_storage_path
                                      ? 'pointer'
                                      : 'not-allowed',
                                  color:
                                    inv.pdf_storage_path
                                      ? '#00665e'
                                      : '#cbd5e1',
                                  padding:
                                    '8px',
                                  borderRadius:
                                    '8px'
                                }}
                                title={
                                  inv.pdf_storage_path
                                    ? 'Download Invoice PDF'
                                    : 'PDF not available'
                                }
                              >
                                <Download
                                  size={16}
                                />
                              </button>

                              <button
                                onClick={e =>
                                  handleDelete(
                                    inv.id,
                                    e
                                  )
                                }
                                style={{
                                  background:
                                    'transparent',
                                  border:
                                    'none',
                                  cursor:
                                    'pointer',
                                  color:
                                    '#94a3b8',
                                  padding:
                                    '8px',
                                  borderRadius:
                                    '8px'
                                }}
                                title="Delete Record"
                                onMouseEnter={e => {
                                  e.currentTarget.style.background =
                                    '#fef2f2';

                                  e.currentTarget.style.color =
                                    '#dc2626';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background =
                                    'transparent';

                                  e.currentTarget.style.color =
                                    '#94a3b8';
                                }}
                              >
                                <Trash2
                                  size={16}
                                />
                              </button>

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </main>

      {/* INVOICE DETAILS MODAL */}
      {selectedInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: '0',
            background:
              'rgba(15, 23, 42, 0.5)',
            backdropFilter:
              'blur(4px)',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >

          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '750px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '36px',
              boxShadow:
                '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'center',
                marginBottom:
                  '28px',
                borderBottom:
                  '1px solid #f1f5f9',
                paddingBottom:
                  '18px'
              }}
            >

              <div>

                <h2
                  style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color:
                      '#0f172a',
                    margin: 0
                  }}
                >
                  Invoice Details #
                  {
                    selectedInvoice.invoice_no
                  }
                </h2>

                <p
                  style={{
                    fontSize:
                      '12px',
                    color:
                      '#64748b',
                    marginTop:
                      '4px'
                  }}
                >
                  Complete database form fields and line items
                </p>

              </div>

              <button
                onClick={() =>
                  setSelectedInvoice(
                    null
                  )
                }
                style={{
                  background:
                    '#f8fafc',
                  border: 'none',
                  borderRadius:
                    '10px',
                  padding: '8px',
                  cursor:
                    'pointer',
                  color:
                    '#64748b'
                }}
              >
                <X size={18} />
              </button>

            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr',
                gap: '20px',
                marginBottom:
                  '28px',
                background:
                  '#f8fafc',
                padding: '20px',
                borderRadius:
                  '14px',
                border:
                  '1px solid #f1f5f9'
              }}
            >

              <div>
                <div
                  style={{
                    fontSize:
                      '11px',
                    fontWeight:
                      '600',
                    color:
                      '#64748b',
                    textTransform:
                      'uppercase'
                  }}
                >
                  Client Name
                </div>

                <div
                  style={{
                    fontSize:
                      '14px',
                    fontWeight:
                      '600',
                    color:
                      '#0f172a',
                    marginTop:
                      '4px'
                  }}
                >
                  {
                    selectedInvoice
                      .clients
                      ?.client_name ||
                    selectedInvoice.client_name ||
                    'N/A'
                  }
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize:
                      '11px',
                    fontWeight:
                      '600',
                    color:
                      '#64748b',
                    textTransform:
                      'uppercase'
                  }}
                >
                  Client GSTIN
                </div>

                <div
                  style={{
                    fontSize:
                      '14px',
                    fontWeight:
                      '600',
                    color:
                      '#0f172a',
                    marginTop:
                      '4px'
                  }}
                >
                  {
                    selectedInvoice
                      .clients?.gst_no ||
                    selectedInvoice.client_gstin ||
                    selectedInvoice.clientGstin ||
                    'N/A'
                  }
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize:
                      '11px',
                    fontWeight:
                      '600',
                    color:
                      '#64748b',
                    textTransform:
                      'uppercase'
                  }}
                >
                  Invoice Date
                </div>

                <div
                  style={{
                    fontSize:
                      '14px',
                    fontWeight:
                      '500',
                    color:
                      '#0f172a',
                    marginTop:
                      '4px'
                  }}
                >
                  {formatInvoiceDate(
                    selectedInvoice.date ||
                    selectedInvoice.invoice_date
                  )}
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize:
                      '11px',
                    fontWeight:
                      '600',
                    color:
                      '#64748b',
                    textTransform:
                      'uppercase'
                  }}
                >
                  PO Number
                </div>

                <div
                  style={{
                    fontSize:
                      '14px',
                    fontWeight:
                      '500',
                    color:
                      '#0f172a',
                    marginTop:
                      '4px'
                  }}
                >
                  {
                    selectedInvoice.po_no ||
                    selectedInvoice.poNo ||
                    selectedInvoice.po_number ||
                    'N/A'
                  }
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize:
                      '11px',
                    fontWeight:
                      '600',
                    color:
                      '#64748b',
                    textTransform:
                      'uppercase'
                  }}
                >
                  Status
                </div>

                <div
                  style={{
                    fontSize:
                      '14px',
                    fontWeight:
                      '600',
                    color:
                      '#00665e',
                    marginTop:
                      '4px'
                  }}
                >
                  {
                    selectedInvoice.status
                  }
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize:
                      '11px',
                    fontWeight:
                      '600',
                    color:
                      '#64748b',
                    textTransform:
                      'uppercase'
                  }}
                >
                  Total Amount
                </div>

                <div
                  style={{
                    fontSize:
                      '16px',
                    fontWeight:
                      '700',
                    color:
                      '#16a34a',
                    marginTop:
                      '4px'
                  }}
                >
                  ₹
                  {calculateInvoiceReportTotals(
                    selectedInvoice
                  ).grandTotal.toFixed(
                    2
                  )}
                </div>
              </div>

            </div>

            <div
              style={{
                marginBottom:
                  '28px'
              }}
            >

              <h3
                style={{
                  fontSize:
                    '15px',
                  fontWeight:
                    '700',
                  color:
                    '#0f172a',
                  marginBottom:
                    '14px'
                }}
              >
                Line Items
              </h3>

              {loadingDetails ? (

                <div
                  style={{
                    textAlign:
                      'center',
                    padding:
                      '24px'
                  }}
                >
                  <Loader2
                    className="spin"
                    size={20}
                    style={{
                      color:
                        '#00665e'
                    }}
                  />
                </div>

              ) : invoiceItems.length ===
                0 ? (

                <div
                  style={{
                    fontSize:
                      '13px',
                    color:
                      '#64748b',
                    fontStyle:
                      'italic',
                    background:
                      '#f8fafc',
                    padding:
                      '14px',
                    borderRadius:
                      '10px'
                  }}
                >
                  No individual line items registered for this record. Total recorded as single amount.
                </div>

              ) : (

                <div
                  style={{
                    border:
                      '1px solid #f1f5f9',
                    borderRadius:
                      '10px',
                    overflow:
                      'hidden'
                  }}
                >

                  <table
                    style={{
                      width:
                        '100%',
                      borderCollapse:
                        'collapse',
                      textAlign:
                        'left',
                      fontSize:
                        '13px'
                    }}
                  >

                    <thead>

                      <tr
                        style={{
                          background:
                            '#f8fafc',
                          borderBottom:
                            '1px solid #f1f5f9',
                          color:
                            '#64748b'
                        }}
                      >

                        <th
                          style={{
                            padding:
                              '12px 14px'
                          }}
                        >
                          Product
                        </th>

                        <th
                          style={{
                            padding:
                              '12px 14px'
                          }}
                        >
                          Qty
                        </th>

                        <th
                          style={{
                            padding:
                              '12px 14px'
                          }}
                        >
                          Rate
                        </th>

                        <th
                          style={{
                            padding:
                              '12px 14px'
                          }}
                        >
                          Size / UOM
                        </th>

                        <th
                          style={{
                            padding:
                              '12px 14px',
                            textAlign:
                              'right'
                          }}
                        >
                          Amount
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {invoiceItems.map(
                        (item, idx) => (
                          <tr
                            key={idx}
                            style={{
                              borderBottom:
                                '1px solid #f8fafc'
                            }}
                          >

                            <td
                              style={{
                                padding:
                                  '12px 14px',
                                fontWeight:
                                  '500',
                                color:
                                  '#0f172a'
                              }}
                            >
                              {
                                item.description ||
                                item.item_name ||
                                'Unnamed item'
                              }
                            </td>

                            <td
                              style={{
                                padding:
                                  '12px 14px',
                                color:
                                  '#64748b'
                              }}
                            >
                              {
                                item.quantity ||
                                1
                              }
                            </td>

                            <td
                              style={{
                                padding:
                                  '12px 14px',
                                color:
                                  '#64748b'
                              }}
                            >
                              ₹
                              {Number(
                                item.baseRate ??
                                item.rate ??
                                item.unit_price ??
                                item.price ??
                                0
                              ).toFixed(
                                2
                              )}
                            </td>

                            <td
                              style={{
                                padding:
                                  '12px 14px',
                                color:
                                  '#64748b'
                              }}
                            >
                              {
                                getItemSize(
                                  item
                                )
                              }
                            </td>

                            <td
                              style={{
                                padding:
                                  '12px 14px',
                                textAlign:
                                  'right',
                                fontWeight:
                                  '600',
                                color:
                                  '#0f172a'
                              }}
                            >
                              ₹
                              {calculateInvoiceItemAmount(
                                item
                              ).toFixed(
                                2
                              )}
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </div>

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'flex-end',
                gap: '12px'
              }}
            >

              <button
                onClick={() =>
                  setSelectedInvoice(
                    null
                  )
                }
                style={{
                  background:
                    '#00665e',
                  color: '#fff',
                  border: 'none',
                  padding:
                    '11px 24px',
                  borderRadius:
                    '10px',
                  fontSize:
                    '13px',
                  fontWeight:
                    '600',
                  cursor:
                    'pointer'
                }}
              >
                Close Details
              </button>

            </div>

          </div>

        </div>
      )}

      {/* EDIT INVOICE MODAL */}
      {isEditModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: '0',
            background:
              'rgba(15, 23, 42, 0.5)',
            backdropFilter:
              'blur(4px)',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >

          <div
            style={{
              background: '#ffffff',
              borderTop:
                '5px solid #1ba5b8',
              borderRadius:
                '14px',
              width: '100%',
              maxWidth:
                '760px',
              padding:
                '36px',
              boxShadow:
                '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'center',
                marginBottom:
                  '24px',
                borderBottom:
                  '1px solid #f1f5f9',
                paddingBottom:
                  '16px'
              }}
            >

              <h2
                style={{
                  fontSize:
                    '18px',
                  fontWeight:
                    '700',
                  color:
                    '#0f172a',
                  margin: 0
                }}
              >
                Edit Invoice Record
              </h2>

              <button
                onClick={() =>
                  setIsEditModalOpen(
                    false
                  )
                }
                style={{
                  background:
                    '#f8fafc',
                  border: 'none',
                  borderRadius:
                    '10px',
                  padding:
                    '8px',
                  cursor:
                    'pointer',
                  color:
                    '#64748b'
                }}
              >
                <X size={18} />
              </button>

            </div>

            <form
              onSubmit={
                handleUpdateInvoice
              }
              style={{
                display:
                  'flex',
                flexDirection:
                  'column',
                gap: '16px'
              }}
            >

              <div>

                <label
                  style={{
                    display:
                      'block',
                    fontSize:
                      '12px',
                    fontWeight:
                      '600',
                    color:
                      '#64748b',
                    marginBottom:
                      '6px'
                  }}
                >
                  Invoice Number
                </label>

                <input
                  type="text"
                  value={
                    editFormData.invoice_no
                  }
                  onChange={e =>
                    setEditFormData({
                      ...editFormData,
                      invoice_no:
                        e.target.value
                    })
                  }
                  style={{
                    width: '100%',
                    padding:
                      '10px 14px',
                    borderRadius:
                      '8px',
                    border:
                      '1px solid #cbd5e1',
                    fontSize:
                      '13px',
                    boxSizing:
                      'border-box'
                  }}
                  required
                />

              </div>

              <div>

                <label
                  style={{
                    display:
                      'block',
                    fontSize:
                      '12px',
                    fontWeight:
                      '600',
                    color:
                      '#64748b',
                    marginBottom:
                      '6px'
                  }}
                >
                  Date
                </label>

                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={
                    editFormData.date
                  }
                  onChange={e =>
                    setEditFormData({
                      ...editFormData,
                      date:
                        e.target.value
                    })
                  }
                  style={{
                    width: '100%',
                    padding:
                      '10px 14px',
                    borderRadius:
                      '8px',
                    border:
                      '1px solid #cbd5e1',
                    fontSize:
                      '13px',
                    boxSizing:
                      'border-box'
                  }}
                  required
                />

              </div>

              <div>

                <label
                  style={{
                    display:
                      'block',
                    fontSize:
                      '12px',
                    fontWeight:
                      '600',
                    color:
                      '#64748b',
                    marginBottom:
                      '6px'
                  }}
                >
                  PO Number
                </label>

                <input
                  type="text"
                  value={
                    editFormData.po_no
                  }
                  onChange={e =>
                    setEditFormData({
                      ...editFormData,
                      po_no:
                        e.target.value
                    })
                  }
                  style={{
                    width: '100%',
                    padding:
                      '10px 14px',
                    borderRadius:
                      '8px',
                    border:
                      '1px solid #cbd5e1',
                    fontSize:
                      '13px',
                    boxSizing:
                      'border-box'
                  }}
                />

              </div>

              <div>

                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    marginBottom:
                      '8px'
                  }}
                >

                  <label
                    style={{
                      display:
                        'block',
                      fontSize:
                        '12px',
                      fontWeight:
                        '700',
                      color:
                        '#00665e'
                    }}
                  >
                    Products and material lines
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setEditFormData(
                        prev => ({
                          ...prev,
                          items: [
                            ...prev.items,
                            {
                              description:
                                '',
                              quantity: 1,
                              rate: 0,
                              baseRate: 0,
                              per: 'Nos',
                              hsn: ''
                            }
                          ]
                        })
                      )
                    }
                    style={{
                      border:
                        '1px solid #b8dcd7',
                      borderRadius:
                        '7px',
                      padding:
                        '6px 10px',
                      background:
                        '#e6f7f9',
                      color:
                        '#00665e',
                      fontSize:
                        '12px',
                      fontWeight:
                        '700',
                      cursor:
                        'pointer'
                    }}
                  >
                    <Plus size={13} />
                    Add item
                  </button>

                </div>

                <div
                  style={{
                    display:
                      'grid',
                    gap: '8px',
                    maxHeight:
                      '240px',
                    overflowY:
                      'auto',
                    padding:
                      '10px',
                    background:
                      '#f8fafc',
                    border:
                      '1px solid #e2e8f0',
                    borderRadius:
                      '9px'
                  }}
                >

                  {editFormData.items.length ===
                  0 ? (

                    <div
                      style={{
                        color:
                          '#94a3b8',
                        fontSize:
                          '12px',
                        padding:
                          '8px'
                      }}
                    >
                      No saved product lines. Add an item to begin editing.
                    </div>

                  ) : (

                    editFormData.items.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          key={index}
                          style={{
                            display:
                              'grid',
                            gridTemplateColumns:
                              'minmax(150px, 2fr) 70px 90px 90px 30px',
                            gap: '7px',
                            alignItems:
                              'center'
                          }}
                        >

                          <input
                            value={
                              item.description ||
                              item.item_name ||
                              ''
                            }
                            placeholder="Product description"
                            onChange={event =>
                              setEditFormData(
                                prev => ({
                                  ...prev,
                                  items:
                                    prev.items.map(
                                      (
                                        row,
                                        rowIndex
                                      ) =>
                                        rowIndex ===
                                        index
                                          ? {
                                              ...row,
                                              description:
                                                event.target
                                                  .value
                                            }
                                          : row
                                    )
                                })
                              )
                            }
                            style={
                              editInputStyle
                            }
                          />

                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={
                              item.quantity ??
                              1
                            }
                            placeholder="Qty"
                            onChange={event =>
                              setEditFormData(
                                prev => ({
                                  ...prev,
                                  items:
                                    prev.items.map(
                                      (
                                        row,
                                        rowIndex
                                      ) =>
                                        rowIndex ===
                                        index
                                          ? {
                                              ...row,
                                              quantity:
                                                event.target
                                                  .value
                                            }
                                          : row
                                    )
                                })
                              )
                            }
                            style={
                              editInputStyle
                            }
                          />

                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={
                              item.baseRate ??
                              item.rate ??
                              0
                            }
                            placeholder="Rate"
                            onChange={event =>
                              setEditFormData(
                                prev => ({
                                  ...prev,
                                  items:
                                    prev.items.map(
                                      (
                                        row,
                                        rowIndex
                                      ) =>
                                        rowIndex ===
                                        index
                                          ? {
                                              ...row,
                                              rate:
                                                event.target
                                                  .value,
                                              baseRate:
                                                event.target
                                                  .value
                                            }
                                          : row
                                    )
                                })
                              )
                            }
                            style={
                              editInputStyle
                            }
                          />

                          <input
                            value={
                              item.per ||
                              item.uom ||
                              'Nos'
                            }
                            placeholder="UOM / sqft"
                            onChange={event =>
                              setEditFormData(
                                prev => ({
                                  ...prev,
                                  items:
                                    prev.items.map(
                                      (
                                        row,
                                        rowIndex
                                      ) =>
                                        rowIndex ===
                                        index
                                          ? {
                                              ...row,
                                              per:
                                                event.target
                                                  .value
                                            }
                                          : row
                                    )
                                })
                              )
                            }
                            style={
                              editInputStyle
                            }
                          />

                          <button
                            type="button"
                            title="Remove item"
                            onClick={() =>
                              setEditFormData(
                                prev => ({
                                  ...prev,
                                  items:
                                    prev.items.filter(
                                      (
                                        _,
                                        rowIndex
                                      ) =>
                                        rowIndex !==
                                        index
                                    )
                                })
                              )
                            }
                            style={{
                              border: 0,
                              background:
                                'transparent',
                              color:
                                '#dc2626',
                              cursor:
                                'pointer',
                              padding:
                                '4px'
                            }}
                          >
                            <Trash2
                              size={15}
                            />
                          </button>

                        </div>
                      )
                    )

                  )}

                </div>

                <div
                  style={{
                    marginTop:
                      '8px',
                    color:
                      '#00665e',
                    fontSize:
                      '13px',
                    fontWeight:
                      '700'
                  }}
                >
                  Recalculated total: ₹
                  {calculateInvoiceReportTotals(
                    {
                      ...currentEditInvoice,
                      items:
                        editFormData.items,
                      freight:
                        editFormData.freight
                    }
                  ).grandTotal.toFixed(
                    2
                  )}
                </div>

              </div>

              <div>

                <label
                  style={{
                    display:
                      'block',
                    fontSize:
                      '12px',
                    fontWeight:
                      '600',
                    color:
                      '#64748b',
                    marginBottom:
                      '6px'
                  }}
                >
                  Status
                </label>

                <select
                  value={
                    editFormData.status
                  }
                  onChange={e =>
                    setEditFormData({
                      ...editFormData,
                      status:
                        e.target.value
                    })
                  }
                  style={{
                    width: '100%',
                    padding:
                      '10px 14px',
                    borderRadius:
                      '8px',
                    border:
                      '1px solid #cbd5e1',
                    fontSize:
                      '13px',
                    boxSizing:
                      'border-box',
                    background:
                      '#fff'
                  }}
                >

                  <option value="Paid">
                    Paid
                  </option>

                  <option value="Pending">
                    Pending
                  </option>

                  <option value="Cancelled">
                    Cancelled
                  </option>

                </select>

              </div>

              <div
                style={{
                  display:
                    'flex',
                  justifyContent:
                    'flex-end',
                  gap: '12px',
                  marginTop:
                    '10px'
                }}
              >

                <button
                  type="button"
                  onClick={() =>
                    setIsEditModalOpen(
                      false
                    )
                  }
                  style={{
                    background:
                      '#f8fafc',
                    color:
                      '#64748b',
                    border:
                      '1px solid #cbd5e1',
                    padding:
                      '10px 20px',
                    borderRadius:
                      '8px',
                    fontSize:
                      '13px',
                    fontWeight:
                      '600',
                    cursor:
                      'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    savingEdit
                  }
                  style={{
                    background:
                      '#00665e',
                    color: '#fff',
                    border:
                      'none',
                    padding:
                      '10px 20px',
                    borderRadius:
                      '8px',
                    fontSize:
                      '13px',
                    fontWeight:
                      '600',
                    cursor:
                      'pointer',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    gap: '8px'
                  }}
                >

                  {savingEdit && (
                    <Loader2
                      className="spin"
                      size={14}
                    />
                  )}

                  Save Changes

                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}
