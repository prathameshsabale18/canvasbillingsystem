import React, { useEffect, useState } from 'react';
import { Check, Database, Package, Plus, RefreshCw, UserRound, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { clientGst, clientGroupKey } from '../utils/clientIdentity';

const blankClient = { client_name: '', address: '', gst_no: '' };
const blankProduct = { product: '', rates: '', category: '', spec: 'Nos', hsn: '' };
const MANTHAN_GSTIN = '27AJKPJ5733E1Z7';

export default function DatabaseDashboard({ activeView = 'database' }) {
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [clientForm, setClientForm] = useState(blankClient);
  const [productForm, setProductForm] = useState(blankProduct);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    const [{ data: clientRows, error: clientError }, { data: productRows, error: productError }] = await Promise.all([
      supabase.from('clients').select('*').order('client_name', { ascending: true }),
      supabase.from('products').select('*').order('product', { ascending: true })
    ]);
    if (clientError || productError) setError(clientError?.message || productError?.message || 'Could not load database records.');
    setClients(clientRows || []);
    setProducts(productRows || []);
    setLoading(false);
  };

  useEffect(() => {
    const repairManthanGst = async () => {
      await Promise.all([
        supabase.from('clients').update({ gst_no: MANTHAN_GSTIN }).ilike('client_name', '%Manthan Architects%'),
        supabase.from('invoices').update({ client_gstin: MANTHAN_GSTIN }).ilike('client_name', '%Manthan Architects%')
      ]);
      refresh();
    };
    repairManthanGst();
  }, []);

  const openClient = () => { setError(''); setNotice(''); setClientForm(blankClient); setModal('client'); };
  const openProduct = () => { setError(''); setNotice(''); setProductForm(blankProduct); setModal('product'); };

  const saveClient = async event => {
    event.preventDefault();
    const payload = { client_name: clientForm.client_name.trim(), address: clientForm.address.trim(), gst_no: clientForm.gst_no.trim().toUpperCase() };
    if (!payload.client_name || !payload.address || !payload.gst_no) return setError('Client name, address, and GSTIN are required.');
    if (clients.some(client => clientGroupKey(client.client_name) === clientGroupKey(payload.client_name))) return setError('This client already exists in the database.');
    setSaving(true); setError('');
    const { error: insertError } = await supabase.from('clients').insert([payload]);
    setSaving(false);
    if (insertError) return setError(insertError.message);
    setModal(null); setNotice(`${payload.client_name} was added to clients.`); refresh();
  };

  const saveProduct = async event => {
    event.preventDefault();
    const payload = { product: productForm.product.trim(), rates: `${productForm.spec.trim()} @ ${Number(productForm.rates).toFixed(2)}`, category: productForm.category.trim(), spec: productForm.spec.trim(), hsn: productForm.hsn.trim() };
    if (!payload.product || !productForm.rates || !payload.category || !payload.spec || !payload.hsn) return setError('Product name, rate, type, unit, and HSN are required.');
    if (products.some(product => String(product.product || '').trim().toLowerCase() === payload.product.toLowerCase())) return setError('This product already exists in the database.');
    setSaving(true); setError('');
    const { error: insertError } = await supabase.from('products').insert([payload]);
    setSaving(false);
    if (insertError) return setError(insertError.message);
    setModal(null); setNotice(`${payload.product} was added to products.`); refresh();
  };

  return <><style>{databaseStyles}</style><div className="database-shell">
    <header className="database-header"><div><div className="database-eyebrow"><Database size={14} /> CANVASBILL / DATABASE</div><h1>Clients & products</h1><p>Manage the records used by your invoices and reports.</p></div><button className="database-refresh" onClick={refresh} title="Refresh database"><RefreshCw size={16} /></button></header>
    {notice && <div className="database-notice"><Check size={15} /> {notice}<button onClick={() => setNotice('')}><X size={14} /></button></div>}
    {error && <div className="database-error">{error}<button onClick={() => setError('')}><X size={14} /></button></div>}
    <div className="database-actions"><button onClick={openClient}><UserRound size={17} /> Add client</button><button onClick={openProduct}><Package size={17} /> Add product</button></div>
    <div className="database-grid">
      <section className="database-card"><div className="database-card-head"><div><span>CLIENT DIRECTORY</span><h2>{clients.length} clients</h2></div><UserRound size={19} /></div>{loading ? <p className="database-empty">Loading clients…</p> : clients.length ? <div className="database-list">{clients.map(client => <div className="database-row" key={client.id}><div><strong>{client.client_name}</strong><small>{clientGst(client) || 'GSTIN not added'}</small></div><span>{client.address || 'Address not added'}</span></div>)}</div> : <p className="database-empty">No clients saved yet.</p>}</section>
      <section className="database-card"><div className="database-card-head"><div><span>PRODUCT CATALOGUE</span><h2>{products.length} products</h2></div><Package size={19} /></div>{loading ? <p className="database-empty">Loading products…</p> : products.length ? <div className="database-list">{products.map(product => <div className="database-row" key={product.id}><div><strong>{product.product}</strong><small>{product.category || 'Uncategorised'} · {product.spec || 'Nos'}</small></div><span>{product.rates || 'Rate not added'} · HSN {product.hsn || '—'}</span></div>)}</div> : <p className="database-empty">No products saved yet.</p>}</section>
    </div>
    {modal && <div className="database-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setModal(null)}><form className="database-modal" onSubmit={modal === 'client' ? saveClient : saveProduct}><div className="database-modal-head"><div><span>{modal === 'client' ? 'NEW CLIENT' : 'NEW PRODUCT'}</span><h2>{modal === 'client' ? 'Add client' : 'Add product'}</h2></div><button type="button" onClick={() => setModal(null)}><X size={18} /></button></div>{modal === 'client' ? <><label>Client name<input autoFocus required value={clientForm.client_name} onChange={event => setClientForm({ ...clientForm, client_name: event.target.value })} placeholder="Manthan Architects" /></label><label>Address<textarea required rows="3" value={clientForm.address} onChange={event => setClientForm({ ...clientForm, address: event.target.value })} placeholder="Full billing address" /></label><label>GSTIN<input required value={clientForm.gst_no} onChange={event => setClientForm({ ...clientForm, gst_no: event.target.value })} placeholder="27AJKPJ5733E1Z7" /></label></> : <><label>Product name<input autoFocus required value={productForm.product} onChange={event => setProductForm({ ...productForm, product: event.target.value })} placeholder="Acrylic signboard" /></label><div className="database-two-col"><label>Rate<input required min="0" step="0.01" type="number" value={productForm.rates} onChange={event => setProductForm({ ...productForm, rates: event.target.value })} placeholder="450" /></label><label>Type / category<input required value={productForm.category} onChange={event => setProductForm({ ...productForm, category: event.target.value })} placeholder="Signage" /></label></div><div className="database-two-col"><label>Unit<input required value={productForm.spec} onChange={event => setProductForm({ ...productForm, spec: event.target.value })} placeholder="Nos" /></label><label>HSN code<input required value={productForm.hsn} onChange={event => setProductForm({ ...productForm, hsn: event.target.value })} placeholder="998386" /></label></div></>}<div className="database-modal-actions"><button type="button" onClick={() => setModal(null)}>Cancel</button><button className="database-save" disabled={saving}><Plus size={15} /> {saving ? 'Saving…' : 'Save record'}</button></div></form></div>}
  </div></>;
}

const databaseStyles = `
  .database-shell{min-height:calc(100vh - 60px);padding:34px 44px 52px;background:#f7f9fc;color:#172033}.database-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}.database-eyebrow{display:flex;align-items:center;gap:7px;color:#74819b;font-size:10px;font-weight:800;letter-spacing:.1em}.database-header h1{margin:10px 0 6px;font-size:30px;letter-spacing:-.7px}.database-header p{margin:0;color:#8390a2;font-size:13px}.database-refresh{display:grid;place-items:center;width:36px;height:36px;border:1px solid #dce5e8;border-radius:8px;background:#fff;color:#5d6b7e;cursor:pointer}.database-actions{display:flex;gap:10px;margin-bottom:18px}.database-actions button,.database-modal-actions button{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 14px;border:1px solid #dce5e8;border-radius:8px;background:#fff;color:#4b596e;font-size:12px;font-weight:700;cursor:pointer}.database-actions button{background:#087d73;border-color:#087d73;color:#fff}.database-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.database-card{min-height:420px;padding:22px;border:1px solid #e5eaef;border-radius:16px;background:#fff;box-shadow:0 10px 28px rgba(29,48,61,.04)}.database-card-head{display:flex;justify-content:space-between;align-items:flex-start;color:#087d73}.database-card-head span{color:#9aa5b5;font-size:9px;font-weight:800;letter-spacing:.09em}.database-card-head h2{margin:5px 0 18px;color:#273142;font-size:20px}.database-list{display:grid}.database-row{display:flex;justify-content:space-between;gap:16px;padding:13px 2px;border-top:1px solid #eef1f4}.database-row strong,.database-row small,.database-row>span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.database-row strong{color:#273142;font-size:12px}.database-row small{margin-top:4px;color:#8793a2;font-size:10px}.database-row>span{max-width:45%;align-self:center;color:#7f8b9d;font-size:10px;text-align:right}.database-empty{padding:42px 10px;color:#98a3b2;text-align:center;font-size:12px}.database-notice,.database-error{display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px 13px;border-radius:8px;font-size:12px}.database-notice{background:#e7f7f3;color:#087d73}.database-error{background:#fff0f0;color:#b73c3c}.database-notice button,.database-error button,.database-modal-head button{margin-left:auto;border:0;background:transparent;color:inherit;cursor:pointer}.database-modal-backdrop{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.35)}.database-modal{width:min(520px,100%);padding:23px;border-radius:14px;background:#fff;box-shadow:0 20px 55px rgba(15,23,42,.18)}.database-modal-head{display:flex;justify-content:space-between;margin-bottom:18px}.database-modal-head span{color:#9aa5b5;font-size:9px;font-weight:800;letter-spacing:.09em}.database-modal-head h2{margin:5px 0 0;font-size:20px}.database-modal label{display:grid;gap:7px;margin-top:13px;color:#64748b;font-size:11px;font-weight:700}.database-modal input,.database-modal textarea{width:100%;padding:10px 11px;border:1px solid #dce4e8;border-radius:7px;outline:0;font:inherit;font-size:12px;color:#172033;background:#fff;box-sizing:border-box;resize:vertical}.database-two-col{display:grid;grid-template-columns:1fr 1fr;gap:11px}.database-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:21px}.database-save{background:#087d73!important;border-color:#087d73!important;color:#fff!important}@media(max-width:800px){.database-shell{padding:26px 20px 40px}.database-grid{grid-template-columns:1fr}}@media(max-width:480px){.database-shell{padding:22px 14px}.database-two-col{grid-template-columns:1fr}.database-row{display:block}.database-row>span{max-width:100%;margin-top:6px;text-align:left}}
`;

