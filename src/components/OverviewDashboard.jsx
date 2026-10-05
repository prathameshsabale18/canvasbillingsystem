import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  FilePlus2,
  FileText,
  PackagePlus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
} from 'lucide-react';

import { supabase } from '../supabaseClient';

import {
  calculateInvoiceReportTotals,
  getInvoiceDateKey
} from '../utils/invoiceReportPdf';
import { formatInvoiceDate } from '../utils/invoiceDates';
import WorkspaceSidebar from './WorkspaceSidebar';

const PAGE_SIZE = 1000;
const BILLS_PER_PAGE = 9;

const money = value =>
  `Rs. ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export default function OverviewDashboard({
  onNewInvoice,
  onOpenBilling,
  onNavigate,
  activeView = 'overview'
}) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchInvoices = async () => {
    setLoading(true);

    try {
      const allRecords = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('invoices')
          .select(`
            id,
            invoice_no,
            date,
            client_name,
            client_gstin,
            freight,
            subtotal,
            status,
            amount,
            grand_total,
            cgst,
            sgst,
            igst,
            clients (
              client_name,
              gst_no
            )
          `)
          .order('id', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error(
            'Dashboard fetch error:',
            error.message
          );
          break;
        }

        const batch = data || [];

        allRecords.push(...batch);

        if (batch.length < PAGE_SIZE) {
          break;
        }

        from += PAGE_SIZE;
      }

      const itemsByInvoice = new Map();

      for (let index = 0; index < allRecords.length; index += 100) {
        const invoiceIds = allRecords
          .slice(index, index + 100)
          .map(invoice => invoice.id);
        const { data: items, error: itemsError } = await supabase
          .from('invoice_items')
          .select('*')
          .in('invoice_id', invoiceIds);

        if (itemsError) {
          console.error(
            'Dashboard invoice items fetch error:',
            itemsError.message
          );
          continue;
        }

        (items || []).forEach(item => {
          const invoiceItems = itemsByInvoice.get(item.invoice_id) || [];
          invoiceItems.push(item);
          itemsByInvoice.set(item.invoice_id, invoiceItems);
        });
      }

      setInvoices(
        allRecords.map(invoice => ({
          ...invoice,
          items: itemsByInvoice.get(invoice.id) || []
        }))
      );
    } catch (error) {
      console.error(
        'Dashboard fetch exception:',
        error
      );

      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [activeView]);

  const metrics = useMemo(() => {
    const now = new Date();

    const today =
      `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}`;

    return invoices.reduce(
      (summary, invoice) => {
        const totals =
          calculateInvoiceReportTotals(invoice);

        const status = String(
          invoice.status || ''
        ).toLowerCase();

        const invoiceDate =
          getInvoiceDateKey(
            invoice.date ||
            invoice.invoice_date
          );

        const isPaid =
          status === 'paid' ||
          status === 'successful';

        const isPending =
          status === 'pending';

        const cgst =
          Number(totals.cgst || 0);

        const sgst =
          Number(totals.sgst || 0);

        const igst =
          Number(totals.igst || 0);

        const grandTotal =
          Number(totals.grandTotal || 0);

        const assessableValue =
          Number(
            totals.assessableValue || 0
          );

        return {
          totalBills:
            summary.totalBills + 1,

          totalAmount:
            summary.totalAmount +
            grandTotal,

          paidAmount:
            summary.paidAmount +
            (isPaid ? grandTotal : 0),

          pendingAmount:
            summary.pendingAmount +
            (isPending ? grandTotal : 0),

          assessableValue:
            summary.assessableValue +
            assessableValue,

          gst:
            summary.gst +
            cgst +
            sgst +
            igst,

          cgst:
            summary.cgst + cgst,

          sgst:
            summary.sgst + sgst,

          todayCount:
            summary.todayCount +
            (invoiceDate === today ? 1 : 0),

          paidBills:
            summary.paidBills +
            (isPaid ? 1 : 0),

          pendingBills:
            summary.pendingBills +
            (isPending ? 1 : 0)
        };
      },
      {
        totalBills: 0,
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        assessableValue: 0,
        gst: 0,
        cgst: 0,
        sgst: 0,
        todayCount: 0,
        paidBills: 0,
        pendingBills: 0
      }
    );
  }, [invoices]);

  const sortedInvoices = useMemo(
    () =>
      [...invoices].sort((left, right) => {
        const leftNumber = Number(
          String(left.invoice_no || '').match(/(\d+)$/)?.[1] || 0
        );
        const rightNumber = Number(
          String(right.invoice_no || '').match(/(\d+)$/)?.[1] || 0
        );

        return rightNumber - leftNumber || Number(right.id) - Number(left.id);
      }),
    [invoices]
  );

  const pageCount = Math.max(
    1,
    Math.ceil(sortedInvoices.length / BILLS_PER_PAGE)
  );
  const visiblePage = Math.min(currentPage, pageCount);
  const firstBill = sortedInvoices.length
    ? (visiblePage - 1) * BILLS_PER_PAGE + 1
    : 0;
  const lastBill = Math.min(
    visiblePage * BILLS_PER_PAGE,
    sortedInvoices.length
  );
  const visibleInvoices = sortedInvoices.slice(
    firstBill - 1,
    lastBill
  );

  return (
    <>
      <style>{dashboardStyles}</style>

      <div className="canvas-dashboard-shell">

        {/* SIDEBAR */}

        <WorkspaceSidebar
          activeView={activeView}
          onNavigate={onNavigate}
        />

        {/* MAIN */}

        <main className="canvas-dashboard-main">

          <div className="canvas-dashboard-surface">

            {/* HEADER */}

            <header className="dashboard-header">

              <div>
                <div className="dashboard-eyebrow">
                  <Activity size={14} />
                  CANVASBILL
                </div>

                <h1>
                  Overview
                </h1>

                <p>
                  Billing performance,
                  receivables and invoice
                  activity at a glance.
                </p>
              </div>

              <div className="dashboard-header-actions">

                <button
                  onClick={fetchInvoices}
                  className="icon-header-button"
                  title="Refresh"
                >
                  <RefreshCw size={16} />
                </button>

                <button
                  onClick={onOpenBilling}
                  className="header-secondary-button"
                >
                  <FileText size={15} />
                  Billing
                </button>

                <button
                  onClick={onNewInvoice}
                  className="header-primary-button"
                >
                  <FilePlus2 size={15} />
                  New Invoice
                </button>

              </div>

            </header>

            {/* TOP ANALYTICS */}

            <section className="top-analytics">

              {/* LARGE TOTAL CARD */}

              <div className="portfolio-card">

                <div className="portfolio-card-top">

                  <div>

                    <div className="card-overline">
                      AMOUNT PENDING
                    </div>

                    <div
                      className="portfolio-value"
                      title={money(
                        metrics.pendingAmount
                      )}
                    >
                      {money(
                        metrics.pendingAmount
                      )}
                    </div>

                    <div className="portfolio-subtitle">
                      {metrics.pendingBills}{' '}
                      pending bills
                    </div>

                  </div>

                  <div className="portfolio-icon">
                    <IndianRupee size={21} />
                  </div>

                </div>

                <div className="portfolio-footer">

                  <div>
                    <span>
                      Assessed value
                    </span>

                    <strong>
                      {money(
                        metrics.assessableValue
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      GST calculated
                    </span>

                    <strong>
                      {money(
                        metrics.gst
                      )}
                    </strong>
                  </div>

                </div>

                <div className="portfolio-line">
                  <div />
                </div>

              </div>

              {/* SMALL METRICS */}

              <div className="asset-grid">

                <MiniMetric
                  label="Amount paid"
                  value={money(
                    metrics.paidAmount
                  )}
                  hint={`${metrics.paidBills} paid bills`}
                  icon={
                    <CheckCircle2 size={17} />
                  }
                  type="green"
                />

                <MiniMetric
                  label="Total amount recorded"
                  value={money(
                    metrics.totalAmount
                  )}
                  hint={`${metrics.totalBills} bills recorded`}
                  icon={
                    <IndianRupee size={17} />
                  }
                  type="orange"
                />

                <MiniMetric
                  label="Assessed value"
                  value={money(
                    metrics.assessableValue
                  )}
                  hint="Before GST"
                  icon={
                    <ArrowUpRight size={17} />
                  }
                  type="purple"
                />

                <MiniMetric
                  label="GST calculated"
                  value={money(
                    metrics.gst
                  )}
                  hint={`CGST ${money(
                    metrics.cgst
                  )}`}
                  icon={
                    <FileText size={17} />
                  }
                  type="yellow"
                />

              </div>

            </section>

            {/* COUNT STRIP */}

            <section className="count-strip">

              <CountItem
                icon={
                  <Clock3 size={16} />
                }
                label="Bills recorded today"
                value={metrics.todayCount}
              />

              <CountItem
                icon={
                  <CheckCircle2 size={16} />
                }
                label="Paid bills"
                value={metrics.paidBills}
              />

              <CountItem
                icon={
                  <AlertCircle size={16} />
                }
                label="Pending bills"
                value={metrics.pendingBills}
              />

              <CountItem
                icon={
                  <FileText size={16} />
                }
                label="Total bills"
                value={metrics.totalBills}
              />

            </section>

            {/* CONTENT */}

            <section className="dashboard-content-grid">

              <div className="billing-area">
                <div className="section-heading">
                  <div>
                    <h2>Recent invoices</h2>
                    <p>
                      {loading
                        ? 'Loading invoice data...'
                        : invoices.length
                          ? `Showing ${firstBill}-${lastBill} of ${metrics.totalBills} bills`
                          : 'No bills recorded'}
                    </p>
                  </div>

                  <button
                    className="header-secondary-button"
                    onClick={onOpenBilling}
                  >
                    <FileText size={15} />
                    Open billing table
                  </button>
                </div>

                {loading ? (
                  <div className="table-state">
                    Loading invoice data...
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="table-state">
                    No invoice records found.
                  </div>
                ) : (
                  <div className="billing-table-wrap">
                    <table className="billing-table">
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Client</th>
                          <th>Date</th>
                          <th className="amount-column">Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleInvoices.map(invoice => {
                          const totals =
                            calculateInvoiceReportTotals(invoice);
                          const status = invoice.status || 'Pending';
                          const normalizedStatus = String(status).toLowerCase();
                          const statusClass =
                            normalizedStatus === 'pending'
                              ? 'pending'
                              : ['paid', 'successful'].includes(normalizedStatus)
                                ? 'paid'
                                : 'other';

                          return (
                            <tr key={invoice.id}>
                              <td>
                                <span className="invoice-number">
                                  #{invoice.invoice_no || '-'}
                                </span>
                              </td>
                              <td>
                                <div className="client-name">
                                  {invoice.clients?.client_name ||
                                    invoice.client_name ||
                                    'Unnamed client'}
                                </div>
                              </td>
                              <td>
                                <span className="date-text">
                                  {formatInvoiceDate(
                                    invoice.date || invoice.invoice_date
                                  ) || '-'}
                                </span>
                              </td>
                              <td className="amount-column">
                                <strong>{money(totals.grandTotal)}</strong>
                              </td>
                              <td>
                                <span className={`status-pill ${statusClass}`}>
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {!loading && invoices.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                      paddingTop: '12px',
                      color: '#64748b',
                      fontSize: '12px'
                    }}
                  >
                    <span>
                      Page {visiblePage} of {pageCount}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="header-secondary-button"
                        disabled={visiblePage <= 1}
                        onClick={() => setCurrentPage(visiblePage - 1)}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="header-secondary-button"
                        disabled={visiblePage >= pageCount}
                        onClick={() => setCurrentPage(visiblePage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT PANEL */}

              <aside className="dashboard-side-panel">

                {/* RECEIVABLES */}

                <div className="receivable-card">

                  <div className="receivable-header">

                    <div>

                      <span>
                        RECEIVABLES
                      </span>

                      <h3>
                        Pending amount
                      </h3>

                    </div>

                    <ArrowDownRight size={19} />

                  </div>

                  <div
                    className="receivable-value"
                    title={money(
                      metrics.pendingAmount
                    )}
                  >
                    {money(
                      metrics.pendingAmount
                    )}
                  </div>

                  <div className="receivable-bottom">

                    <span>
                      {metrics.pendingBills}{' '}
                      pending bill
                      {metrics.pendingBills === 1
                        ? ''
                        : 's'}
                    </span>

                    <div className="receivable-progress">

                      <div
                        style={{
                          width:
                            metrics.totalAmount > 0
                              ? `${Math.min(
                                  100,
                                  (
                                    metrics.pendingAmount /
                                    metrics.totalAmount
                                  ) * 100
                                )}%`
                              : '0%'
                        }}
                      />

                    </div>

                  </div>

                </div>

                {/* TAX SUMMARY */}

                <div className="side-card">

                  <div className="side-card-header">

                    <div>

                      <span className="side-card-label">
                        TAX SUMMARY
                      </span>

                      <h3>
                        GST calculated
                      </h3>

                    </div>

                    <FileText size={17} />

                  </div>

                  <div className="tax-row">
                    <span>
                      CGST
                    </span>

                    <strong>
                      {money(
                        metrics.cgst
                      )}
                    </strong>
                  </div>

                  <div className="tax-row">
                    <span>
                      SGST
                    </span>

                    <strong>
                      {money(
                        metrics.sgst
                      )}
                    </strong>
                  </div>

                  <div className="tax-total">
                    <span>
                      Total GST
                    </span>

                    <strong>
                      {money(
                        metrics.gst
                      )}
                    </strong>
                  </div>

                </div>

                {/* QUICK ACTIONS */}

                <div className="side-card">

                  <div className="side-card-header">

                    <div>

                      <span className="side-card-label">
                        QUICK ACTIONS
                      </span>

                      <h3>
                        Workspace
                      </h3>

                    </div>

                  </div>

                  <div className="quick-actions">

                    <QuickAction
                      icon={
                        <FilePlus2 size={16} />
                      }
                      title="Create invoice"
                      description="New tax invoice"
                      onClick={
                        onNewInvoice
                      }
                    />

                    <QuickAction
                      icon={
                        <PackagePlus size={16} />
                      }
                      title="Record order"
                      description="Order workspace"
                      onClick={() =>
                        alert(
                          'Order intake is the next dashboard module.'
                        )
                      }
                    />

                    <QuickAction
                      icon={
                        <RefreshCw size={16} />
                      }
                      title="Refresh records"
                      description="Reload billing data"
                      onClick={
                        fetchInvoices
                      }
                    />

                  </div>

                </div>

              </aside>

            </section>

          </div>

        </main>

      </div>
    </>
  );
}

/* =====================================================
   MINI METRIC
===================================================== */

function MiniMetric({
  label,
  value,
  hint,
  icon,
  type
}) {
  return (
    <div className={`mini-metric ${type}`}>

      <div className="mini-metric-header">

        <span>
          {label}
        </span>

        <div className="mini-metric-icon">
          {icon}
        </div>

      </div>

      <strong
        className="mini-metric-value"
        title={value}
      >
        {value}
      </strong>

      <small>
        {hint}
      </small>

    </div>
  );
}

/* =====================================================
   COUNT ITEM
===================================================== */

function CountItem({
  icon,
  label,
  value
}) {
  return (
    <div className="count-item">

      <div className="count-icon">
        {icon}
      </div>

      <div>
        <strong>
          {value}
        </strong>

        <span>
          {label}
        </span>
      </div>

    </div>
  );
}

/* =====================================================
   QUICK ACTION
===================================================== */

function QuickAction({
  icon,
  title,
  description,
  onClick
}) {
  return (
    <button
      className="quick-action"
      onClick={onClick}
      type="button"
    >

      <div className="quick-action-icon">
        {icon}
      </div>

      <div>
        <strong>
          {title}
        </strong>

        <span>
          {description}
        </span>
      </div>

    </button>
  );
}

/* =====================================================
   STYLES
===================================================== */

const dashboardStyles = `

  .canvas-dashboard-shell {
    min-height: 100vh;
    display: flex;
    background: #f7f9fb;
    color: #172033;
  }

  .canvas-dashboard-main {
    flex: 1;
    min-width: 0;
    padding: 0;
  }

  .canvas-dashboard-surface {
    width: 100%;
    max-width: none;
    min-height: 100vh;
    margin: 0;
    padding: 28px 36px 42px;
    background: #ffffff;
    border-radius: 0;
    box-shadow: none;
    overflow: hidden;
  }

  /* HEADER */

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 24px;
    padding-bottom: 22px;
    border-bottom: 1px solid #edf0f3;
  }

  .dashboard-eyebrow {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 7px;
    color: #00665e;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .08em;
  }

  .dashboard-header h1 {
    margin: 0;
    color: #111827;
    font-size: 29px;
    line-height: 1.1;
    letter-spacing: -.8px;
  }

  .dashboard-header p {
    margin: 8px 0 0;
    color: #7b8797;
    font-size: 12px;
  }

  .dashboard-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon-header-button,
  .header-secondary-button,
  .header-primary-button {
    height: 36px;
    border-radius: 9px;
    border: 1px solid #e1e7ee;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 12px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .icon-header-button {
    width: 36px;
    padding: 0;
    background: #f7f9fb;
    color: #64748b;
  }

  .header-secondary-button {
    background: #ffffff;
    color: #344054;
  }

  .header-primary-button {
    border-color: #00665e;
    background: #00665e;
    color: #ffffff;
  }

  /* TOP AREA */

  .top-analytics {
    display: grid;
    grid-template-columns:
      minmax(330px, 1.05fr)
      minmax(0, 1.95fr);
    gap: 14px;
    margin-bottom: 18px;
    align-items: start;
  }

  /* LARGE TOTAL CARD */

  .portfolio-card {
    min-height: 196px;
    padding: 21px 22px;
    border-radius: 17px;
    background:
      linear-gradient(
        145deg,
        #edf8f7 0%,
        #dff2ef 100%
      );
    border: 1px solid #d7ebe8;
    position: relative;
    overflow: hidden;
  }

  .portfolio-card::after {
    content: '';
    position: absolute;
    width: 210px;
    height: 210px;
    border-radius: 50%;
    right: -90px;
    bottom: -115px;
    border: 1px solid rgba(0,102,94,.1);
  }

  .portfolio-card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    position: relative;
    z-index: 1;
  }

  .card-overline {
    color: #54716e;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .07em;
  }

  .portfolio-value {
    margin-top: 14px;
    color: #111827;
    font-size: 31px;
    line-height: 1.12;
    font-weight: 800;
    letter-spacing: -1px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .portfolio-subtitle {
    margin-top: 6px;
    color: #718581;
    font-size: 11px;
  }

  .portfolio-icon {
    width: 39px;
    height: 39px;
    border-radius: 11px;
    display: grid;
    place-items: center;
    background: #ffffff;
    color: #00665e;
    box-shadow:
      0 4px 12px rgba(0,102,94,.08);
  }

  .portfolio-footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    position: absolute;
    left: 22px;
    right: 22px;
    bottom: 39px;
  }

  .portfolio-footer span {
    display: block;
    color: #718581;
    font-size: 9px;
    margin-bottom: 4px;
  }

  .portfolio-footer strong {
    color: #263a39;
    font-size: 12px;
  }

  .portfolio-line {
    position: absolute;
    left: 22px;
    right: 22px;
    bottom: 20px;
    height: 3px;
    border-radius: 99px;
    background: rgba(0,102,94,.1);
    overflow: hidden;
  }

  .portfolio-line div {
    width: 76%;
    height: 100%;
    border-radius: inherit;
    background: #00665e;
  }

  /* SMALL CARDS */

  .asset-grid {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
    gap: 12px;
    align-self: start;
  }

  .mini-metric {
    min-width: 0;
    height: 160px;
    min-height: 160px;
    padding: 16px;
    border-radius: 14px;
    border-radius: 15px;
    border: 1px solid #e4e8ee;
    position: relative;
    overflow: hidden;
  }

  .mini-metric.green {
    background: #e8f5f0;
    border-color: #d9ebe4;
  }

  .mini-metric.orange {
    background: #fff3df;
    border-color: #f4e4c9;
  }

  .mini-metric.purple {
    background: #eee8f8;
    border-color: #e1d9ef;
  }

  .mini-metric.yellow {
    background: #f8f1d8;
    border-color: #eee5c6;
  }

  .mini-metric-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }

  .mini-metric-header > span {
    color: #59616c;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .045em;
    line-height: 1.35;
  }

  .mini-metric-icon {
    width: 29px;
    height: 29px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: rgba(255,255,255,.72);
    color: #3c4652;
  }

  .mini-metric-value {
    display: block;
    margin-top: 25px;
    color: #111827;
    font-size: 18px;
    line-height: 1.18;
    font-weight: 800;
    letter-spacing: -.4px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .mini-metric small {
    display: block;
    margin-top: 8px;
    color: #7b8490;
    font-size: 9px;
  }

  /* COUNT STRIP */

  .count-strip {
    display: grid;
    grid-template-columns:
      repeat(4, 1fr);
    gap: 0;
    margin-bottom: 28px;
    padding: 4px 0;
    border-top: 1px solid #e9edf1;
    border-bottom: 1px solid #e9edf1;
  }

  .count-item {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 10px 18px;
    border-right: 1px solid #edf0f3;
  }

  .count-item:last-child {
    border-right: none;
  }

  .count-icon {
    width: 31px;
    height: 31px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: #f1f5f7;
    color: #00665e;
  }

  .count-item strong {
    display: block;
    color: #172033;
    font-size: 17px;
    line-height: 1;
  }

  .count-item span {
    display: block;
    margin-top: 4px;
    color: #8993a1;
    font-size: 9px;
  }

  /* CONTENT */

  .dashboard-content-grid {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr)
      300px;
    gap: 28px;
    align-items: start;
  }

  .billing-area {
    min-width: 0;
  }

  .section-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 15px;
    margin-bottom: 14px;
  }

  .section-heading h2 {
    margin: 0;
    color: #172033;
    font-size: 18px;
    letter-spacing: -.3px;
  }

  .section-heading p {
    margin: 5px 0 0;
    color: #9aa3af;
    font-size: 10px;
  }

  .billing-controls {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .search-box {
    width: 235px;
    height: 35px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    border: 1px solid #e1e6ec;
    border-radius: 8px;
    background: #ffffff;
    color: #9aa3af;
  }

  .search-box input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: #172033;
    font-size: 10px;
  }

  .search-box input::placeholder {
    color: #a6afba;
  }

  .filter-button {
    width: 35px;
    height: 35px;
    display: grid;
    place-items: center;
    border: 1px solid #e1e6ec;
    border-radius: 8px;
    background: #ffffff;
    color: #64748b;
    cursor: pointer;
  }

  /* TABLE */

  .billing-table-wrap {
    height: 560px;
    overflow-x: auto;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .billing-table {
    width: 100%;
    min-width: 700px;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 11px;
    border: 1px solid #e7ebef;
    border-radius: 12px;
    overflow: hidden;
  }

  .billing-table thead {
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .billing-table th {
    padding: 11px 10px;
    text-align: left;
    background: #f7f9fb;
    border-bottom: 1px solid #e5e9ee;
    color: #8993a1;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .055em;
    white-space: nowrap;
  }

  .table-sort-button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-transform: inherit;
    letter-spacing: inherit;
    cursor: pointer;
  }

  .billing-table td {
    padding: 13px 10px;
    border-bottom: 1px solid #edf0f3;
    color: #4b5563;
  }

  .billing-table tbody tr:last-child td {
    border-bottom: none;
  }

  .billing-table tbody tr {
    transition:
      background .15s ease;
  }

  .billing-table tbody tr:hover {
    background: #fafcfc;
  }

  .invoice-number {
    color: #00665e;
    font-weight: 800;
    white-space: nowrap;
  }

  .client-name {
    max-width: 300px;
    color: #273142;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .date-text {
    color: #8993a1;
    white-space: nowrap;
  }

  .amount-column {
    text-align: right !important;
    white-space: nowrap;
  }

  .amount-column strong {
    color: #273142;
    font-size: 11px;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    border-radius: 99px;
    font-size: 8px;
    font-weight: 800;
    text-transform: capitalize;
  }

  .status-pill.paid {
    background: #e7f6ee;
    color: #08784f;
  }

  .status-pill.pending {
    background: #fff2dc;
    color: #b76a00;
  }

  .status-pill.other {
    background: #eef1f4;
    color: #667085;
  }

  .action-column {
    width: 35px;
    text-align: center !important;
  }

  .row-more {
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #9aa3af;
    cursor: pointer;
  }

  .row-more:hover {
    background: #f1f4f6;
  }

  .table-state {
    height: 400px;
    display: grid;
    place-items: center;
    color: #8993a1;
    font-size: 11px;
  }

  /* RIGHT PANEL */

  .dashboard-side-panel {
    display: grid;
    gap: 13px;
  }

  .receivable-card {
    min-height: 160px;
    padding: 19px;
    border-radius: 15px;
    background: #182222;
    color: #ffffff;
    position: relative;
    overflow: hidden;
  }

  .receivable-card::after {
    content: '';
    position: absolute;
    width: 150px;
    height: 150px;
    right: -75px;
    bottom: -85px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,.1);
  }

  .receivable-header {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .receivable-header span {
    color: #91aaa7;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .07em;
  }

  .receivable-header h3 {
    margin: 5px 0 0;
    color: #ffffff;
    font-size: 15px;
  }

  .receivable-value {
    margin-top: 21px;
    color: #ffffff;
    font-size: 21px;
    font-weight: 800;
    letter-spacing: -.4px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .receivable-bottom {
    margin-top: 9px;
  }

  .receivable-bottom span {
    color: #9db2b0;
    font-size: 9px;
  }

  .receivable-progress {
    height: 3px;
    margin-top: 7px;
    background: rgba(255,255,255,.1);
    border-radius: 99px;
    overflow: hidden;
  }

  .receivable-progress div {
    height: 100%;
    border-radius: inherit;
    background: #56c9b9;
  }

  /* SIDE CARDS */

  .side-card {
    padding: 17px;
    border: 1px solid #e4e8ed;
    border-radius: 13px;
    background: #ffffff;
  }

  .side-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 15px;
    color: #64748b;
  }

  .side-card-label {
    display: block;
    color: #9aa3af;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .06em;
  }

  .side-card-header h3 {
    margin: 5px 0 0;
    color: #172033;
    font-size: 14px;
  }

  .tax-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #eef1f4;
    color: #788392;
    font-size: 10px;
  }

  .tax-row strong {
    color: #273142;
    font-size: 10px;
  }

  .tax-total {
    display: flex;
    justify-content: space-between;
    padding-top: 11px;
    color: #172033;
    font-size: 10px;
    font-weight: 800;
  }

  .tax-total strong {
    color: #00665e;
  }

  /* QUICK ACTIONS */

  .quick-actions {
    display: grid;
    gap: 6px;
  }

  .quick-action {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: #f8fafb;
    text-align: left;
    cursor: pointer;
  }

  .quick-action:hover {
    border-color: #dfe7e7;
    background: #f5f9f8;
  }

  .quick-action-icon {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 7px;
    background: #e6f4f1;
    color: #00665e;
  }

  .quick-action strong {
    display: block;
    color: #273142;
    font-size: 9px;
  }

  .quick-action span {
    display: block;
    margin-top: 2px;
    color: #9aa3af;
    font-size: 8px;
  }

  /* RESPONSIVE */

  @media (max-width: 1250px) {
    .top-analytics {
      grid-template-columns: 1fr;
    }

    .portfolio-card {
      min-height: 196px;
    }

    .mini-metric {
      height: 160px;
      min-height: 160px;
    }
  }

  @media (max-width: 1050px) {
    .dashboard-content-grid {
      grid-template-columns: 1fr;
    }

    .dashboard-side-panel {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 800px) {
    .canvas-dashboard-main {
      padding: 0;
    }

    .canvas-dashboard-surface {
      padding: 22px 18px 28px;
      border-radius: 0;
    }

    .dashboard-header {
      flex-direction: column;
    }

    .asset-grid {
      grid-template-columns:
        repeat(2, 1fr);
    }

    .count-strip {
      grid-template-columns:
        repeat(2, 1fr);
    }

    .count-item:nth-child(2) {
      border-right: none;
    }

    .count-item:nth-child(-n+2) {
      border-bottom:
        1px solid #edf0f3;
    }
  }

  @media (max-width: 600px) {
    .dashboard-header h1 {
      font-size: 25px;
    }

    .dashboard-header-actions {
      width: 100%;
    }

    .dashboard-header-actions button {
      flex: 1;
    }

    .portfolio-value {
      font-size: 26px;
    }

    .asset-grid {
      grid-template-columns:
        1fr 1fr;
    }

    .mini-metric {
      height: 145px;
      min-height: 145px;
    }

    .dashboard-side-panel {
      grid-template-columns: 1fr;
    }

    .section-heading {
      align-items: flex-start;
      flex-direction: column;
    }

    .billing-controls {
      width: 100%;
    }

    .search-box {
      flex: 1;
      width: auto;
    }
  }

  @media (max-width: 430px) {
    .asset-grid {
      grid-template-columns: 1fr;
    }

    .mini-metric {
      height: 125px;
      min-height: 125px;
    }

    .count-strip {
      grid-template-columns: 1fr;
    }

    .count-item {
      border-right: none !important;
      border-bottom:
        1px solid #edf0f3;
    }

    .count-item:last-child {
      border-bottom: none;
    }
  }

`;