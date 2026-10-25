import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';

const DEMO_USERS = [
  { label: 'Administrator', username: 'admin',      password: 'admin123', desc: 'Full access to all features' },
  { label: 'PGRC Officer',  username: 'pgrc_off1',  password: 'demo123',  desc: 'Public Grievance Redressal Cell' },
  { label: 'RB Officer',    username: 'rb_off1',    password: 'demo123',  desc: 'Regulation Bureau' },
  { label: 'Regional (North)', username: 'north_ro',password: 'demo123',  desc: 'North Region cases only' },
  { label: 'Senior Mgmt',  username: 'director',   password: 'demo123',  desc: 'Read-only dashboards & reports' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u) => {
    setUsername(u.username);
    setPassword(u.password);
    setError('');
  };

  return (
    <div className="login-page">
      {/* Left panel */}
      <div className="login-left">
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 460 }}>
          {/* AICTE emblem placeholder */}
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: 'var(--color-accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 28px', boxShadow: '0 8px 24px rgba(15,157,138,.4)'
          }}>
            <Shield size={38} color="white" strokeWidth={1.5} />
          </div>

          <h1 style={{ color: 'white', fontSize: 28, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.2 }}>
            AICTE Integrated<br/>Complaint Monitoring
          </h1>
          <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 15, margin: '0 0 36px' }}>
            A unified monitoring and coordination layer for AICTE officials
            to track institution-related complaint cases across all Bureaus and Cells.
          </p>

          {/* Feature highlights */}
          {[
            'Institution-centric consolidated complaint view',
            'Cross-bureau overlap detection (flagged for human review)',
            'Real-time case tracking with deadline alerts',
            'Full timestamped action history across departments',
          ].map(f => (
            <div key={f} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, textAlign: 'left'
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: 'rgba(15,157,138,.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)' }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 14 }}>{f}</span>
            </div>
          ))}

          <div style={{
            marginTop: 36, padding: '14px 20px', background: 'rgba(255,255,255,.08)',
            borderRadius: 10, border: '1px solid rgba(255,255,255,.15)',
            fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.5
          }}>
            SIH 2026 · Problem Statement SIH26264<br/>
            Prototype — All data is SYNTHETIC demo data. Not official AICTE statistics.
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 6px' }}>
            Sign in
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '0 0 28px' }}>
            Use demo credentials below or enter your own.
          </p>

          {/* Demo role picker */}
          <div style={{
            background: 'var(--color-bg)', borderRadius: 10, padding: 14,
            marginBottom: 24, border: '1px solid var(--color-border)'
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Quick demo login
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {DEMO_USERS.map(u => (
                <button
                  key={u.username}
                  onClick={() => fillDemo(u)}
                  title={u.desc}
                  style={{
                    padding: '5px 11px', borderRadius: 6, border: '1px solid var(--color-border)',
                    background: username === u.username ? 'var(--color-primary)' : 'white',
                    color: username === u.username ? 'white' : 'var(--color-text-primary)',
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            {error && (
              <div style={{
                background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 18,
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: 'var(--color-status-overdue)'
              }}>
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                id="username"
                className="form-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. admin"
                required
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  className="form-input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Authorised AICTE officials only. All sessions are logged.
          </p>
        </div>
      </div>
    </div>
  );
}
