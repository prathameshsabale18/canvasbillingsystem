import React, { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = authData.user.id;

    // Check if user profile exists
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    // Profiles are created by an administrator; never grant admin access implicitly.
    if (profileError || !profileData?.role) {
      await supabase.auth.signOut();
      setError('Your account is waiting for admin approval.');
    } else {
      onLoginSuccess(profileData.role);
    }

    setLoading(false);
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', boxSizing: 'border-box', background: 'linear-gradient(135deg, #eef8f7 0%, #f8fafc 52%, #fff7e8 100%)', fontFamily: 'Inter, sans-serif' }}>
      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '420px', padding: '40px', boxSizing: 'border-box', borderRadius: '20px', border: '1px solid rgba(0, 102, 94, .12)', background: 'rgba(255,255,255,.94)', boxShadow: '0 24px 70px rgba(15, 55, 60, .14)' }}>
        <div style={{ width: '46px', height: '46px', display: 'grid', placeItems: 'center', marginBottom: '22px', borderRadius: '14px', background: '#00665e', color: '#fff' }}><LockKeyhole size={21} /></div>
        <div style={{ color: '#00665e', fontSize: '11px', fontWeight: '800', letterSpacing: '1.4px', textTransform: 'uppercase' }}>Canvas Creation</div>
        <h1 style={{ fontSize: '28px', lineHeight: 1.15, margin: '8px 0 8px', color: '#172033' }}>Welcome back</h1>
        <p style={{ margin: '0 0 28px', color: '#64748b', fontSize: '13px' }}>Sign in to your invoice workspace.</p>
        {error && <div role="alert" style={{ color: '#991b1b', fontSize: '12px', marginBottom: '16px', background: '#fef2f2', border: '1px solid #fecaca', padding: '11px 12px', borderRadius: '10px' }}>{error}</div>}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '7px' }}>Email address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px', outlineColor: '#00665e' }} />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '7px' }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px', outlineColor: '#00665e' }} />
            <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'grid', placeItems: 'center', padding: '5px', border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', background: loading ? '#5c9e98' : '#00665e', color: '#fff', padding: '13px', borderRadius: '10px', border: 'none', fontWeight: '700', cursor: loading ? 'wait' : 'pointer', fontSize: '14px' }}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
