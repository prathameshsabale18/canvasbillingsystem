import React from 'react';
import { FileSpreadsheet, LayoutDashboard, Settings } from 'lucide-react';

export default function WorkspaceSidebar({ activeView, onNavigate }) {
  const items = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'Billing', icon: FileSpreadsheet },
    { id: 'generator', label: 'Invoice Generator', icon: FileSpreadsheet },
  ];

  return (
    <aside style={{ width: '240px', minHeight: '100%', background: '#fbfbfc', borderRight: '1px solid #e5eaf0', padding: '30px 18px', flexShrink: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '42px', padding: '0 8px' }}>
        <div style={{ width: '42px', height: '34px', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
          <img src="/logo.svg" alt="Canvas Creation logo" style={{ width: '42px', height: '34px', objectFit: 'contain', transform: 'scale(2.35)' }} />
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#172033' }}>Canvas Creation</div>
          <div style={{ fontSize: '11px', color: '#8c95a5' }}>Workspace</div>
        </div>
      </div>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#a0a8b6', letterSpacing: '.08em', margin: '0 8px 10px' }}>WORKSPACE</div>
      <nav style={{ display: 'grid', gap: '5px' }}>
        {items.map(({ id, label, icon: Icon }) => {
          const active = activeView === id;
          return (
            <button key={id} onClick={() => onNavigate(id)} style={{ display: 'flex', alignItems: 'center', gap: '11px', width: '100%', padding: '12px 11px', border: 0, borderRadius: '8px', background: active ? '#e9edff' : 'transparent', color: active ? '#4b67d1' : '#596477', fontSize: '14px', fontWeight: active ? 700 : 500, cursor: 'pointer', textAlign: 'left' }}>
              <Icon size={18} /> {label}
            </button>
          );
        })}
      </nav>
      <div style={{ marginTop: 'auto', paddingTop: '30px' }}>
        <button style={{ display: 'flex', alignItems: 'center', gap: '11px', width: '100%', padding: '12px 11px', border: 0, background: 'transparent', color: '#596477', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}>
          <Settings size={18} /> Settings
        </button>
      </div>
    </aside>
  );
}
