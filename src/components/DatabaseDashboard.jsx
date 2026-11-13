import React, { useEffect, useState } from 'react';
import { Check, Database, MapPin, Package, Plus, RefreshCw, UserRound, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { clientGst, clientGroupKey } from '../utils/clientIdentity';

const blankClient = { client_name: '', address: '', gst_no: '' };
const blankProduct = { product: '', rates: '', category: '', spec: 'Nos', hsn: '' };
const MANTHAN_GSTIN = '27AJKPJ5733E1Z7';

export default function DatabaseDashboard() {
  const [view, setView] = useState('clients');
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
    setModal(null); setNotice(`${payload.client_name} was added to Supabase.`); refresh();
  };

  const saveProduct = async event => {
    event.preventDefault();
    const numericRate = Number(productForm.rates);
    const payload = { product: productForm.product.trim(), rates: `${productForm.spec.trim()} @ ${numericRate.toFixed(2)}`, category: productForm.category.trim(), spec: productForm.spec.trim(), hsn: productForm.hsn.trim() };
    if (!payload.product || !Number.isFinite(numericRate) || numericRate < 0 || !payload.category || !payload.spec || !payload.hsn) return setError('Product name, valid rate, type, unit, and HSN are required.');
    if (products.some(product => String(product.product || '').trim().toLowerCase() === payload.product.toLowerCase())) return setError('This product already exists in the database.');
    setSaving(true); setError('');
    const { error: insertError } = await supabase.from('products').insert([payload]);
    setSaving(false);
    if (insertError) return setError(insertError.message);
    setModal(null); setNotice(`${payload.product} was added to Supabase.`); refresh();
  };

  return <><style>{operationsStyles}</style><div className="operations-shell">
    <header className="operations-header"><div><div className="operations-eyebrow"><Database size={14} /> CANVASBILL / OPERATIONS</div><h1>Operations</h1><p>Manage the clients and products used by your invoices.</p></div><button className="operations-refresh" onClick={refresh} title="Refresh Supabase records"><RefreshCw size={16} /></button></header>
    <div className="operations-toggle" role="tablist" aria-label="Operations data type"><button className={view === 'clients' ? 'active' : ''} onClick={() => setView('clients')} role="tab" aria-selected={view === 'clients'}><UserRound size={17} /> Clients <span>{clients.length}</span></button><button className={view === 'products' ? 'active' : ''} onClick={() => setView('products')} role="tab" aria-selected={view === 'products'}><Package size={17} /> Products <span>{products.length}</span></button></div>
    {notice && <div className="operations-notice"><Check size={15} /> {notice}<button onClick={() => setNotice('')}><X size={14} /></button></div>}
    {error && <div className="operations-error">{error}<button onClick={() => setError('')}><X size={14} /></button></div>}
    {view === 'clients' ? <section className="operations-panel"><div className="operations-panel-head"><div><span>CLIENT DIRECTORY</span><h2>Clients</h2></div><strong>{clients.length} saved</strong></div><div className="client-box-grid"><button className="add-client-box" onClick={openClient}><span><Plus size={24} /></span><strong>Add client</strong><small>Save a new client to Supabase</small></button>{loading ? <div className="operations-empty">Loading clients...</div> : clients.map(client => <article className="client-box" key={client.id}><div className="client-box-avatar"><UserRound size={19} /></div><div className="client-box-copy"><h3>{client.client_name}</h3><p><strong>GSTIN</strong> {clientGst(client) || 'Not added'}</p><p className="client-address"><MapPin size={13} /> {client.address || 'Address not added'}</p></div></article>)}</div></section> : <section className="operations-panel"><div className="operations-panel-head"><div><span>PRODUCT CATALOGUE</span><h2>Products</h2></div><button className="operations-add" onClick={openProduct}><Plus size={15} /> Add product</button></div>{loading ? <div className="operations-empty">Loading products...</div> : products.length ? <div className="product-list">{products.map(product => <div className="product-row" key={product.id}><div className="product-icon"><Package size={17} /></div><div className="product-main"><strong>{product.product}</strong><span>{product.category || 'Uncategorised'} · {product.spec || 'Nos'}</span></div><div className="product-meta"><strong>{product.rates || 'Rate not added'}</strong><span>HSN {product.hsn || '—'}</span></div></div>)}</div> : <div className="operations-empty">No products saved yet. Add the first product above.</div>}</section>}
    {modal && <div className="operations-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setModal(null)}><form className="operations-modal" onSubmit={modal === 'client' ? saveClient : saveProduct}><div className="operations-modal-head"><div><span>{modal === 'client' ? 'NEW CLIENT' : 'NEW PRODUCT'}</span><h2>{modal === 'client' ? 'Add client' : 'Add product'}</h2></div><button type="button" onClick={() => setModal(null)}><X size={18} /></button></div>{modal === 'client' ? <><label>Client name<input autoFocus required value={clientForm.client_name} onChange={event => setClientForm({ ...clientForm, client_name: event.target.value })} placeholder="Manthan Architects" /></label><label>Address<textarea required rows="3" value={clientForm.address} onChange={event => setClientForm({ ...clientForm, address: event.target.value })} placeholder="Full billing address" /></label><label>GSTIN<input required value={clientForm.gst_no} onChange={event => setClientForm({ ...clientForm, gst_no: event.target.value })} placeholder="27AJKPJ5733E1Z7" /></label></> : <><label>Product name<input autoFocus required value={productForm.product} onChange={event => setProductForm({ ...productForm, product: event.target.value })} placeholder="Acrylic signboard" /></label><div className="operations-two-col"><label>Rate<input required min="0" step="0.01" type="number" value={productForm.rates} onChange={event => setProductForm({ ...productForm, rates: event.target.value })} placeholder="450" /></label><label>Type / category<input required value={productForm.category} onChange={event => setProductForm({ ...productForm, category: event.target.value })} placeholder="Signage" /></label></div><div className="operations-two-col"><label>Unit<input required value={productForm.spec} onChange={event => setProductForm({ ...productForm, spec: event.target.value })} placeholder="Nos" /></label><label>HSN code<input required value={productForm.hsn} onChange={event => setProductForm({ ...productForm, hsn: event.target.value })} placeholder="998386" /></label></div></>}<div className="operations-modal-actions"><button type="button" onClick={() => setModal(null)}>Cancel</button><button className="operations-save" disabled={saving}><Plus size={15} /> {saving ? 'Saving...' : 'Save to Supabase'}</button></div></form></div>}
  </div></>;
}

const operationsStyles = `
  .operations-shell{min-height:calc(100vh - 60px);padding:34px 44px 52px;background:#f7f9fc;color:#172033}.operations-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}.operations-eyebrow{display:flex;align-items:center;gap:7px;color:#74819b;font-size:10px;font-weight:800;letter-spacing:.1em}.operations-header h1{margin:10px 0 6px;font-size:30px;letter-spacing:-.7px}.operations-header p{margin:0;color:#8390a2;font-size:13px}.operations-refresh{display:grid;place-items:center;width:36px;height:36px;border:1px solid #dce5e8;border-radius:8px;background:#fff;color:#5d6b7e;cursor:pointer}.operations-toggle{display:flex;gap:5px;width:max-content;margin-bottom:18px;padding:4px;border:1px solid #dce6e8;border-radius:12px;background:#fff}.operations-toggle button{display:flex;align-items:center;gap:8px;padding:11px 16px;border:0;border-radius:8px;background:transparent;color:#718096;font-size:12px;font-weight:800;cursor:pointer}.operations-toggle button.active{background:#087d73;color:#fff;box-shadow:0 4px 10px rgba(8,125,115,.18)}.operations-toggle span{min-width:20px;padding:2px 6px;border-radius:20px;background:rgba(255,255,255,.2);font-size:10px;text-align:center}.operations-toggle button:not(.active) span{background:#edf3f3;color:#087d73}.operations-notice,.operations-error{display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px 13px;border-radius:8px;font-size:12px}.operations-notice{background:#e7f7f3;color:#087d73}.operations-error{background:#fff0f0;color:#b73c3c}.operations-notice button,.operations-error button,.operations-modal-head button{margin-left:auto;border:0;background:transparent;color:inherit;cursor:pointer}.operations-panel{padding:24px;border:1px solid #e5eaef;border-radius:18px;background:#fff;box-shadow:0 10px 28px rgba(29,48,61,.04)}.operations-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin-bottom:20px}.operations-panel-head span,.operations-modal-head span{color:#9aa5b5;font-size:9px;font-weight:800;letter-spacing:.09em}.operations-panel-head h2{margin:5px 0 0;color:#273142;font-size:22px}.operations-panel-head>strong{color:#8793a2;font-size:11px}.operations-add{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border:1px solid #087d73;border-radius:8px;background:#087d73;color:#fff;font-size:12px;font-weight:800;cursor:pointer}.client-box-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.add-client-box,.client-box{min-height:150px;padding:18px;border:1px solid #e4ebee;border-radius:14px;background:#fbfdfd;text-align:left}.add-client-box{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;border:1.5px dashed #7bc8be;color:#087d73;cursor:pointer}.add-client-box>span{display:grid;place-items:center;width:38px;height:38px;margin-bottom:13px;border-radius:11px;background:#e4f5f1}.add-client-box strong{font-size:14px}.add-client-box small{margin-top:5px;color:#879a9e;font-size:10px}.client-box{display:flex;gap:12px;transition:.18s ease}.client-box:hover{border-color:#9bd8d0;box-shadow:0 8px 20px rgba(8,125,115,.08);transform:translateY(-1px)}.client-box-avatar{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border-radius:11px;background:#e4f5f1;color:#087d73}.client-box-copy{min-width:0}.client-box h3{margin:2px 0 12px;overflow:hidden;color:#273142;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.client-box p{margin:5px 0;color:#718096;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.client-box p strong{color:#9aa5b5;font-size:8px;letter-spacing:.06em}.client-address{display:flex;align-items:center;gap:4px;white-space:normal!important;line-height:1.35}.client-address svg{flex:0 0 auto;color:#087d73}.product-list{border:1px solid #e7edef;border-radius:12px;overflow:hidden}.product-row{display:flex;align-items:center;gap:13px;padding:14px 15px;border-bottom:1px solid #edf2f3}.product-row:last-child{border-bottom:0}.product-icon{display:grid;place-items:center;width:34px;height:34px;flex:0 0 34px;border-radius:10px;background:#e7f3fb;color:#318db4}.product-main{min-width:0;flex:1}.product-main strong,.product-main span,.product-meta strong,.product-meta span{display:block}.product-main strong{overflow:hidden;color:#273142;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.product-main span,.product-meta span{margin-top:4px;color:#8793a2;font-size:10px}.product-meta{text-align:right}.product-meta strong{color:#087d73;font-size:12px}.product-meta span{font-size:9px}.operations-empty{padding:50px 15px;color:#98a3b2;text-align:center;font-size:12px}.operations-modal-backdrop{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.35)}.operations-modal{width:min(520px,100%);padding:23px;border-radius:14px;background:#fff;box-shadow:0 20px 55px rgba(15,23,42,.18)}.operations-modal-head{display:flex;justify-content:space-between;margin-bottom:18px}.operations-modal-head h2{margin:5px 0 0;font-size:20px}.operations-modal label{display:grid;gap:7px;margin-top:13px;color:#64748b;font-size:11px;font-weight:700}.operations-modal input,.operations-modal textarea{width:100%;padding:10px 11px;border:1px solid #dce4e8;border-radius:7px;outline:0;font:inherit;font-size:12px;color:#172033;background:#fff;box-sizing:border-box;resize:vertical}.operations-two-col{display:grid;grid-template-columns:1fr 1fr;gap:11px}.operations-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:21px}.operations-modal-actions>button{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border:1px solid #dce5e8;border-radius:8px;background:#fff;color:#4b596e;font-size:12px;font-weight:700;cursor:pointer}.operations-save{background:#087d73!important;border-color:#087d73!important;color:#fff!important}@media(max-width:850px){.operations-shell{padding:26px 20px 40px}.client-box-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.operations-shell{padding:22px 14px}.operations-header h1{font-size:26px}.operations-toggle{width:100%}.operations-toggle button{flex:1;justify-content:center}.client-box-grid{grid-template-columns:1fr}.operations-two-col{grid-template-columns:1fr}.product-row{align-items:flex-start}.product-meta{margin-left:auto}}
`;
