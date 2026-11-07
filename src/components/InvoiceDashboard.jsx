import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, FileText, BarChart3, Wallet, Users, Settings, LogOut,
  Search, Bell, Plus, Trash2, Edit3, ArrowUpRight, CheckCircle2
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  formatInvoiceDate,
  getTodayInvoiceDate,
  toStoredInvoiceDate
} from '../utils/invoiceDates';

export default function Dashboard({ onViewChange }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    invoiceNo: '',
    clientName: '',
    date: getTodayInvoiceDate(),
    amount: '',
    status: 'Successful'
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
    } else {
      setInvoices(data || []);
    }
    setLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    const invoiceDate = toStoredInvoiceDate(formData.date);

    if (!invoiceDate) {
      alert('Enter a valid invoice date in DD/MM/YYYY format.');
      return;
    }

    const payload = {
      invoiceNo: formData.invoiceNo,
      clientName: formData.clientName,
      date: invoiceDate,
      amount: parseFloat(formData.amount),
      status: formData.status
    };

    if (editingId) {
      const { error } = await supabase
        .from('invoices')
        .update(payload)
        .eq('id', editingId);

      if (!error) {
        setEditingId(null);
        resetForm();
        fetchInvoices();
      }
    } else {
      const { error } = await supabase
        .from('invoices')
        .insert([payload]);

      if (!error) {
        resetForm();
        fetchInvoices();
      }
    }
    setIsModalOpen(false);
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (!error) {
      setInvoices(invoices.filter(inv => inv.id !== id));
    }
  }

  function handleEdit(invoice) {
    setEditingId(invoice.id);
    setFormData({
      invoiceNo: invoice.invoiceNo || invoice.invoice_no || '',
      clientName: invoice.clientName || invoice.client_name || '',
      date: formatInvoiceDate(invoice.date || invoice.invoice_date),
      amount:  invoice.grandTotal || '',
      status: invoice.status || 'Successful'
    });
    setIsModalOpen(true);
  }

  function resetForm() {
    setFormData({
      invoiceNo: '',
      clientName: '',
      date: getTodayInvoiceDate(),
      amount: '',
      status: 'Successful'
    });
    setEditingId(null);
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-slate-800 flex font-sans">
      <aside className="w-20 m-4 bg-white rounded-3xl shadow-sm flex flex-col items-center py-6 justify-between">
        <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-emerald-200">
          Q
        </div>
        <div className="flex flex-col gap-6 text-slate-400">
          <button className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl transition"><LayoutDashboard size={20} /></button>
          <button className="p-3 hover:bg-slate-50 hover:text-slate-600 rounded-2xl transition"><BarChart3 size={20} /></button>
          <button className="p-3 hover:bg-slate-50 hover:text-slate-600 rounded-2xl transition"><Wallet size={20} /></button>
          <button className="p-3 hover:bg-slate-50 hover:text-slate-600 rounded-2xl transition"><FileText size={20} /></button>
          <button className="p-3 hover:bg-slate-50 hover:text-slate-600 rounded-2xl transition"><Users size={20} /></button>
        </div>
        <div className="flex flex-col gap-4 text-slate-400">
          <button className="p-3 hover:bg-slate-50 hover:text-slate-600 rounded-2xl transition"><Settings size={20} /></button>
          <button className="p-3 hover:bg-red-50 hover:text-red-500 rounded-2xl transition"><LogOut size={20} /></button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        <header className="flex items-center justify-between bg-white px-8 py-4 rounded-3xl shadow-sm mb-6">
          <nav className="flex items-center gap-8 text-sm font-medium text-slate-500">
            <span className="text-slate-900 font-semibold cursor-pointer border-b-2 border-emerald-600 pb-1">Dashboard</span>
            <span className="cursor-pointer hover:text-slate-800 transition">Reports</span>
            <span className="cursor-pointer hover:text-slate-800 transition">Documents</span>
            <span className="cursor-pointer hover:text-slate-800 transition">History</span>
            <span className="cursor-pointer hover:text-slate-800 transition">Contacts</span>
          </nav>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 bg-slate-50 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <button className="p-2.5 bg-slate-50 rounded-full text-slate-600 hover:bg-slate-100 transition"><Bell size={18} /></button>
            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        <div className="flex justify-between items-center mb-6 px-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome Back, Creator</h1>
            <p className="text-sm text-slate-400">Manage your active bills and financial transactions seamlessly.</p>
          </div>
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl font-medium shadow-lg shadow-emerald-200 transition"
          >
            <Plus size={18} /> Add New Billing
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-3xl p-6 text-white shadow-xl shadow-emerald-900/10 flex flex-col justify-between h-48">
            <div className="flex justify-between items-center">
              <span className="font-semibold tracking-wider text-sm opacity-90">VISA</span>
              <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-md">Credit Card</span>
            </div>
            <div>
              <p className="text-xs opacity-80 mb-1">Total Balance</p>
              <h3 className="text-3xl font-bold tracking-tight">$78,989.09</h3>
            </div>
            <div className="flex justify-between items-end text-xs opacity-80">
              <span>•••• 909090</span>
              <span>EXP 09/26</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col justify-between md:col-span-2">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-semibold text-slate-900">Engagement & Revenue</h4>
                <p className="text-xs text-slate-400">Monthly financial performance overview</p>
              </div>
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full">+17.8%</span>
            </div>
            <div className="flex items-end justify-between h-24 pt-4 px-2">
              {[40, 65, 50, 90, 70, 85].map((val, idx) => (
                <div key={idx} className="w-10 bg-slate-100 hover:bg-emerald-600 transition rounded-2xl flex items-end justify-center pb-2 group relative" style={{ height: `${val}%` }}>
                  <div className="w-6 bg-emerald-500 rounded-xl h-full"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Billing & Payment History</h3>
              <p className="text-xs text-slate-400">Recent invoices and recorded transactions</p>
            </div>
            <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition"><ArrowUpRight size={18} /></button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Loading billing records...</div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No billing records found. Click "Add New Billing" to create one.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 pb-3">
                    <th className="pb-3 font-medium">Invoice No</th>
                    <th className="pb-3 font-medium">Client Name</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 font-semibold text-slate-700">#{inv.invoiceNo || inv.invoice_no || 'N/A'}</td>
                      <td className="py-4 text-slate-600">{inv.clientName || inv.client_name || 'Unnamed Client'}</td>
                      <td className="py-4 text-slate-500">{formatInvoiceDate(inv.date || inv.invoice_date)}</td>
                      <td className="py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
                          <CheckCircle2 size={12} /> {inv.status || 'Successful'}
                        </span>
                      </td>
                      <td className="py-4 font-bold text-slate-900 text-right">
                        ${Number(inv.amount || inv.grandTotal || inv.grand_total || inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEdit(inv)} className="p-2 hover:bg-slate-100 text-slate-500 rounded-xl transition" title="Edit">
                            <Edit3 size={15} />
                          </button>
                          <button onClick={() => handleDelete(inv.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">{editingId ? 'Edit Billing Record' : 'Add New Billing'}</h3>
            <p className="text-xs text-slate-400 mb-6">Fill in the details below to persist changes to Supabase.</p>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Invoice Number</label>
                <input
                  type="text" required
                  value={formData.invoiceNo}
                  onChange={e => setFormData({...formData, invoiceNo: e.target.value})}
                  placeholder="e.g. INV-001"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Client Name</label>
                <input
                  type="text" required
                  value={formData.clientName}
                  onChange={e => setFormData({...formData, clientName: e.target.value})}
                  placeholder="e.g. Amcor Flexibles"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input
                    type="text" inputMode="numeric" placeholder="DD/MM/YYYY" required
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($)</label>
                  <input
                    type="number" step="0.01" required
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-2xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-md shadow-emerald-200 transition"
                >
                  {editingId ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
