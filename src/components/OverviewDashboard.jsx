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
const ORDER_KEY = 'canvas_client_orders';

const money = value =>
  `Rs. ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const readOrders = () => {
  try {
    return JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
  } catch {
    return [];
  }
};

const ageInDays = value => {
  const dateKey = getInvoiceDateKey(value);
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const invoiceTime = Date.UTC(year, month - 1, day);
  const now = new Date();
  const todayTime = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((todayTime - invoiceTime) / 86400000));
};

const clientGroupKey = value => String(value || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[.,]/g, ' ')
  .replace(/\b(private|pvt)\s+(limited|ltd)\b/g, ' ')
  .replace(/\b(limited|ltd)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export default function OverviewDashboard({
  onNewInvoice,
  onOpenBilling,
  onNavigate,
  activeView = 'overview'
}) {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState(readOrders);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [chartFilter, setChartFilter] = useState('paid-pending');

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
      const { data: clientRows } = await supabase
        .from('clients')
        .select('id, client_name');
      setClients(clientRows || []);
      setOrders(readOrders());
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

  const analytics = useMemo(() => {
    const clientMap = new Map();
    const clientIds = new Map(clients.map(client => [String(client.id), client.client_name]));

    invoices.forEach(invoice => {
      const name = invoice.client_name || invoice.clients?.client_name || 'Unnamed client';
      const key = clientGroupKey(name);
      const record = clientMap.get(key) || {
        name,
        paid: 0,
        pending: 0,
        overdue: 0,
        bills: 0,
        orders: 0
      };
      const totals = calculateInvoiceReportTotals(invoice);
      const amount = Number(totals.grandTotal || 0);
      const status = String(invoice.status || '').toLowerCase();
      const isPaid = ['paid', 'successful'].includes(status);
      const age = ageInDays(invoice.date || invoice.invoice_date);

      record.bills += 1;
      if (isPaid) record.paid += amount;
      else {
        record.pending += amount;
        if (age !== null && age >= 45) record.overdue += amount;
      }
      clientMap.set(key, record);
    });

    orders.forEach(order => {
      const name = clientIds.get(String(order.clientId));
      if (!name) return;
      const key = clientGroupKey(name);
      const record = clientMap.get(key) || {
        name,
        paid: 0,
        pending: 0,
        overdue: 0,
        bills: 0,
        orders: 0
      };
      record.orders += 1;
      clientMap.set(key, record);
    });

    const clientsByActivity = [...clientMap.values()]
      .map(client => ({
        ...client,
        collectionRate: client.paid + client.pending
          ? Math.round((client.paid / (client.paid + client.pending)) * 100)
          : 0,
        status: client.overdue > 0 ? 'Needs follow-up' : client.pending > 0 ? 'Pending' : 'On track'
      }))
      .sort((left, right) => (right.overdue - left.overdue) || (right.pending - left.pending) || (right.orders - left.orders))
      .slice(0, 8);
    const maximum = Math.max(1, ...clientsByActivity.map(client => client.pending + client.paid));
    const maximumOverdue = Math.max(1, ...clientsByActivity.map(client => client.overdue));
    const maximumOrders = Math.max(1, ...clientsByActivity.map(client => client.orders));

    return {
      clients: clientsByActivity,
      maximum,
      maximumOverdue,
      maximumOrders,
      totalPaid: clientsByActivity.reduce((sum, client) => sum + client.paid, 0),
      totalPending: clientsByActivity.reduce((sum, client) => sum + client.pending, 0),
      totalOverdue: clientsByActivity.reduce((sum, client) => sum + client.overdue, 0),
      totalOrders: orders.length,
      openOrders: orders.filter(order => order.status !== 'Completed').length,
      completedOrders: orders.filter(order => order.status === 'Completed').length
    };
  }, [clients, invoices, orders]);

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
      <style>{dashboardStyles + analyticsStyles + referenceStyles + oneLineChartStyles}</style>

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

              <div className="performance-card">
                <div className="performance-card-head"><div><div className="card-overline">PAYMENT HEALTH</div><h3>Collection performance</h3></div><ArrowUpRight size={16} /></div>
                <div className="performance-ring" style={{ '--collection-rate': `${metrics.totalAmount ? Math.round((metrics.paidAmount / metrics.totalAmount) * 100) : 0}%` }}><div><strong>{metrics.totalAmount ? Math.round((metrics.paidAmount / metrics.totalAmount) * 100) : 0}%</strong><span>collected</span></div></div>
                <div className="performance-breakdown"><span><i className="performance-paid" />Paid <b>{money(metrics.paidAmount)}</b></span><span><i className="performance-pending" />Pending <b>{money(metrics.pendingAmount)}</b></span></div>
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

            <section className="analytics-section">
              <div className="analytics-heading">
                <div>
                  <div className="card-overline">CLIENT COMPARISON</div>
                  <h2>Payments, receivables & order activity</h2>
                  <p>Compare paid, pending and 45+ day overdue amounts across clients.</p>
                </div>
                <div className="analytics-summary">
                  <div><small>Pending</small><strong>{money(analytics.totalPending)}</strong></div>
                  <div className="summary-alert"><small>Overdue</small><strong>{money(analytics.totalOverdue)}</strong></div>
                  <div><small>Orders</small><strong>{analytics.openOrders}<em> open</em></strong></div>
                </div>
              </div>
              {analytics.clients.length ? <div className="client-analytics-chart">
                <div className="chart-filter" role="group" aria-label="Client statistics filter"><button className={chartFilter === 'paid-pending' ? 'active' : ''} onClick={() => setChartFilter('paid-pending')}>Paid & pending</button><button className={chartFilter === 'overdue' ? 'active' : ''} onClick={() => setChartFilter('overdue')}>Overdue</button><button className={chartFilter === 'orders' ? 'active' : ''} onClick={() => setChartFilter('orders')}>Orders</button></div>
                <div className="chart-legend">{chartFilter === 'paid-pending' && <><span><i className="legend-paid" />Paid</span><span><i className="legend-pending" />Pending</span></>}{chartFilter === 'overdue' && <span><i className="legend-overdue" />Overdue 45+ days</span>}{chartFilter === 'orders' && <span><i className="legend-orders" />Orders</span>}</div>
                <div className="chart-rows" style={{ gridTemplateColumns: `repeat(${Math.max(analytics.clients.length, 1)}, minmax(0, 1fr))` }}>{analytics.clients.map(client => {
                  const total = client.paid + client.pending;
                  const paidWidth = total ? (client.paid / analytics.maximum) * 100 : 0;
                  const pendingWidth = total ? (client.pending / analytics.maximum) * 100 : 0;
                  const overdueWidth = analytics.maximum ? (client.overdue / analytics.maximum) * 100 : 0;
                  const initials = client.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
                  return <div className="chart-row" key={client.name}>
                    <div className="chart-client"><div className="chart-client-top"><span className="client-avatar">{initials}</span><strong title={client.name}>{client.name}</strong></div><small>{client.bills} bill{client.bills === 1 ? '' : 's'} · {client.orders} order{client.orders === 1 ? '' : 's'} · {client.collectionRate}% collected</small><span className={`client-status ${client.status === 'Needs follow-up' ? 'needs-follow-up' : client.status === 'Pending' ? 'watch-status' : 'on-track'}`}>{client.status}</span></div>
                    <div className="chart-track"><span className="chart-bar paid-bar" style={{ height: `${paidWidth}%`, display: chartFilter === 'paid-pending' ? 'block' : 'none' }} /><span className="chart-bar pending-bar" style={{ height: `${pendingWidth}%`, display: chartFilter === 'paid-pending' ? 'block' : 'none' }} /><span className="chart-bar overdue-marker" style={{ height: `${overdueWidth}%`, display: chartFilter === 'overdue' ? 'block' : 'none' }} /><span className="chart-bar orders-bar" style={{ height: `${(client.orders / analytics.maximumOrders) * 100}%`, display: chartFilter === 'orders' ? 'block' : 'none' }} /></div>
                    <div className="chart-values">{chartFilter === 'paid-pending' && <><div><small>Paid</small><strong className="paid-value">{money(client.paid)}</strong></div><div><small>Pending</small><strong>{money(client.pending)}</strong></div></>}{chartFilter === 'overdue' && <div><small>Overdue</small><strong className={client.overdue ? 'overdue-value' : 'clear-value'}>{money(client.overdue)}</strong></div>}{chartFilter === 'orders' && <div><small>Orders</small><strong className="orders-value">{client.orders}</strong></div>}</div>
                  </div>;
                })}</div>
              </div> : <div className="analytics-empty">Create invoices or record orders to see client comparisons here.</div>}
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

const analyticsStyles = `
  .analytics-section{margin:22px 0 24px;padding:23px 24px;border:1px solid #e4ebef;border-radius:18px;background:#fff;box-shadow:0 10px 28px rgba(29,48,61,.04)}
  .analytics-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:20px}
  .analytics-heading h2{margin:6px 0 5px;color:#172033;font-size:20px;letter-spacing:-.3px}
  .analytics-heading p{margin:0;color:#8390a2;font-size:12px}
  .analytics-summary{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.analytics-summary>div{min-width:94px;padding:8px 10px;border:1px solid #e3eeee;border-radius:10px;background:#f5faf9}.analytics-summary small,.analytics-summary strong{display:block}.analytics-summary small{color:#78908d;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.analytics-summary strong{margin-top:3px;color:#17534d;font-size:12px}.analytics-summary em{color:#78908d;font-size:9px;font-style:normal}.analytics-summary .summary-alert{border-color:#f0c2c2;background:#fff6f6}.analytics-summary .summary-alert small,.analytics-summary .summary-alert strong{color:#bd4848}
  .client-analytics-chart{padding:15px 16px;border:1px solid #edf1f3;border-radius:13px;background:#fbfcfd}
  .chart-legend{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;color:#748196;font-size:10px;font-weight:700}
  .chart-legend span{display:inline-flex;align-items:center;gap:6px}.chart-legend i{width:9px;height:9px;border-radius:3px;display:inline-block}.legend-paid{background:#7bc7e8}.legend-pending{background:#e9a449}.legend-overdue{background:#df6262}.legend-orders{background:#087d73}
  .chart-axis{display:flex;justify-content:space-between;margin-bottom:8px;color:#a0aab6;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.chart-rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;align-items:stretch}.chart-row{display:flex;flex-direction:column;gap:10px;min-width:0;padding:12px 10px;border:1px solid transparent;border-radius:11px;transition:.18s ease}.chart-row:hover{border-color:#dcebea;background:#f7fbfa}.chart-client{order:2;min-width:0}.chart-client-top{display:flex;align-items:center;gap:8px;min-width:0}.chart-client strong,.chart-client small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chart-client strong{color:#273142;font-size:12px}.chart-client small{margin:4px 0 5px 34px;color:#93a0ad;font-size:9px}.client-avatar{display:grid;place-items:center;width:26px;height:26px;flex:0 0 26px;border-radius:8px;background:#e3f3f0;color:#087d73;font-size:9px;font-weight:900}.client-status{display:inline-flex;margin-left:34px;padding:3px 6px;border-radius:5px;font-size:8px;font-weight:900}.client-status.needs-follow-up{background:#ffe8e8;color:#c34d4d}.client-status.watch-status{background:#fff1da;color:#b9771e}.client-status.on-track{background:#e5f7ed;color:#16805b}.chart-track{order:1;position:relative;display:flex;flex-direction:column;justify-content:flex-end;width:100%;height:180px;overflow:hidden;border-radius:7px 7px 4px 4px;background:repeating-linear-gradient(to top,#edf2f3 0,#edf2f3 1px,transparent 1px,transparent 25%)}.chart-bar{display:block;width:100%;min-height:2px}.paid-bar{background:linear-gradient(180deg,#9bdaf0,#67bde0)}.pending-bar{background:linear-gradient(180deg,#f0bd6f,#e5a044)}.overdue-marker{position:absolute;right:0;bottom:0;width:5px!important;height:auto;background:#df6262}.chart-values{order:3;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:right}.chart-values strong,.chart-values small{display:block}.chart-values small{color:#9aa5b2;font-size:8px;font-weight:800;text-transform:uppercase}.chart-values strong{margin-top:3px;color:#34445a;font-size:10px}.chart-values .paid-value{color:#3a9fc7}.chart-values .overdue-value{color:#c65353}.chart-values .clear-value{color:#82909d}.analytics-empty{padding:32px;color:#91a0ad;text-align:center;font-size:12px;background:#fbfcfd;border:1px dashed #dce5e8;border-radius:12px}
  @media(max-width:1000px){.chart-row{grid-template-columns:200px minmax(130px,1fr) 240px;gap:10px}.chart-values strong{font-size:9px}}
  @media(max-width:800px){.analytics-heading{flex-direction:column}.analytics-summary{justify-content:flex-start}.chart-axis,.chart-row{grid-template-columns:140px minmax(120px,1fr) 180px;gap:9px}}
  @media(max-width:560px){.analytics-section{padding:18px 14px}.chart-axis{display:none}.chart-row{grid-template-columns:1fr 100px;gap:10px}.chart-track{grid-column:1 / -1;grid-row:2}.chart-values{grid-column:1 / -1;grid-row:3;text-align:left}.chart-client{grid-column:1;grid-row:1}.chart-legend{gap:10px}.chart-values{grid-template-columns:repeat(3,1fr)}.chart-client small,.client-status{margin-left:0}}
`;

const referenceStyles = `
  .canvas-dashboard-shell{background:#f5f7f8}.canvas-dashboard-surface{padding:25px 32px 42px;background:#f8fafb}.dashboard-header{margin-bottom:20px;padding-bottom:16px;border-bottom:0}.dashboard-header h1{font-size:27px}.dashboard-header p{max-width:420px;line-height:1.45}.top-analytics{grid-template-columns:minmax(250px,1fr) minmax(360px,1.7fr) minmax(230px,.9fr);gap:13px;align-items:stretch}.portfolio-card{min-height:205px;background:linear-gradient(145deg,#073e39,#00665e);border-color:#07534d;box-shadow:0 12px 22px rgba(0,102,94,.14)}.portfolio-card::after{border-color:rgba(255,255,255,.12)}.portfolio-card .card-overline,.portfolio-card .portfolio-subtitle,.portfolio-card .portfolio-footer span{color:#b7dad5}.portfolio-card .portfolio-value,.portfolio-card .portfolio-footer strong{color:#fff}.portfolio-card .portfolio-icon{background:rgba(255,255,255,.13);color:#fff}.portfolio-card .portfolio-line{background:rgba(255,255,255,.18)}.portfolio-card .portfolio-line div{background:#8ee0c8}.asset-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.mini-metric{height:auto;min-height:97px;padding:14px;border-radius:12px}.mini-metric-value{margin-top:13px;font-size:16px}.mini-metric.orange{background:#e7f3fb;border-color:#cce5f2}.performance-card{min-height:205px;padding:17px;border:1px solid #e4e9ee;border-radius:15px;background:#fff;box-shadow:0 8px 18px rgba(32,50,60,.04)}.performance-card-head{display:flex;align-items:flex-start;justify-content:space-between;color:#718096}.performance-card-head h3{margin-top:5px;color:#283548;font-size:14px}.performance-ring{width:114px;height:114px;margin:8px auto 7px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#7bc7e8 0 var(--collection-rate),#087d73 var(--collection-rate) 100%);position:relative}.performance-ring::after{content:'';position:absolute;inset:13px;border-radius:50%;background:#fff}.performance-ring>div{position:relative;z-index:1;text-align:center}.performance-ring strong,.performance-ring span{display:block}.performance-ring strong{color:#25354a;font-size:18px}.performance-ring span{margin-top:2px;color:#8995a5;font-size:9px}.performance-breakdown{display:grid;gap:5px}.performance-breakdown span{display:grid;grid-template-columns:8px 1fr auto;gap:6px;align-items:center;color:#8490a0;font-size:9px}.performance-breakdown i{width:8px;height:8px;border-radius:3px}.performance-breakdown b{color:#445269;font-size:9px}.performance-paid{background:#7bc7e8}.performance-pending{background:#087d73}.count-strip{margin-top:13px;border:1px solid #e3e8ed;border-radius:12px;background:#fff}.analytics-section{margin-top:15px;background:#fff}.dashboard-content-grid{margin-top:16px}.section-heading h2{font-size:18px}
  @media(max-width:1180px){.top-analytics{grid-template-columns:minmax(250px,1fr) minmax(330px,1.3fr)}.performance-card{grid-column:1 / -1;min-height:0}.performance-card-head{display:flex}.performance-ring{margin:7px auto}.performance-breakdown{max-width:420px;margin:auto;grid-template-columns:1fr 1fr;gap:12px}}
  @media(max-width:700px){.canvas-dashboard-surface{padding:20px 15px 34px}.top-analytics{grid-template-columns:1fr}.asset-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.performance-card{grid-column:auto}}
`;

const oneLineChartStyles = `
  .client-analytics-chart{overflow:hidden}.chart-rows{display:grid;gap:8px;align-items:stretch;overflow:hidden;padding:6px 2px 10px}.chart-row{min-width:0;padding:8px 4px}.chart-track{height:150px;gap:3px;border-radius:5px}.chart-bar{width:14px;max-width:14px;align-self:center;border-radius:4px 4px 0 0}.paid-bar{background:#7bc7e8}.pending-bar{background:#087d73}.overdue-marker{width:14px!important;background:#f05b62}.orders-bar{background:#6c63c9}.legend-pending{background:#087d73!important}.performance-pending{background:#087d73!important}.chart-axis{padding:0 2px}.chart-values{text-align:center;gap:3px}.chart-values strong{font-size:9px}.chart-client-top{justify-content:center}.chart-client strong{max-width:100%;text-align:center}.chart-client small,.client-status{margin-left:0;display:block;text-align:center}.chart-client small{font-size:8px}.chart-status{margin-inline:auto}
  .chart-filter{display:inline-flex;gap:4px;margin-bottom:10px;padding:3px;border:1px solid #e3ebef;border-radius:8px;background:#f5f8fa}.chart-filter button{border:0;border-radius:6px;padding:6px 9px;background:transparent;color:#718096;font-size:10px;font-weight:800;cursor:pointer}.chart-filter button.active{background:#172f3d;color:#fff;box-shadow:0 2px 5px rgba(23,47,61,.16)}
  @media(max-width:700px){.chart-row{padding-inline:2px}.chart-track{height:125px}.chart-bar{width:10px;max-width:10px}.chart-client strong{font-size:10px}.chart-values small{font-size:7px}.chart-values strong{font-size:8px}}
`;

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
