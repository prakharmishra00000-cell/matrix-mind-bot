import React, { useState, useEffect } from 'react';
import { Mail, Lock, ShieldCheck, ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react';

function OwnerSecureLogin({ onSuccess, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');

  // Password Reset States
  const [resetStep, setResetStep] = useState('login'); // 'login', 'code', 'newPassword'
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Fetch Google Client ID to initialize official login button if present
  useEffect(() => {
    const fetchPublicKeys = async () => {
      try {
        const res = await fetch('/api/config/public');
        const data = await res.json();
        if (data.googleClientId) {
          setGoogleClientId(data.googleClientId);
        }
      } catch (e) {
        console.warn('Failed to load public config:', e);
      } finally {
        setIsConfigLoaded(true);
      }
    };
    fetchPublicKeys();
  }, []);

  // Poll for the Google GSI SDK
  useEffect(() => {
    if (!googleClientId) return;

    const checkSDK = setInterval(() => {
      /* global google */
      if (typeof google !== 'undefined') {
        clearInterval(checkSDK);
        initGoogleButton(googleClientId);
      }
    }, 100);

    const timeout = setTimeout(() => clearInterval(checkSDK), 5000);

    return () => {
      clearInterval(checkSDK);
      clearTimeout(timeout);
    };
  }, [googleClientId]);

  const initGoogleButton = (clientId) => {
    /* global google */
    if (typeof google === 'undefined') return;
    try {
      google.accounts.id.initialize({
        client_id: clientId,
        context: 'use',
        ux_mode: 'popup',
        callback: (response) => {
          try {
            const base64Url = response.credential.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            const profile = JSON.parse(jsonPayload);
            if (profile && profile.email) {
              if (profile.email === 'prakharmishra00000@gmail.com') {
                onSuccess();
              } else {
                setError('Access Denied: Only prakharmishra00000@gmail.com is authorized.');
              }
            }
          } catch (err) {
            console.error('JWT decoding error:', err);
            setError('Google authentication succeeded, but verification failed.');
          }
        }
      });

      google.accounts.id.renderButton(
        document.getElementById('owner-google-btn-container'),
        { theme: 'outline', size: 'large', width: 300 }
      );
      
      // Automatically show the "One Tap" popup to choose emails linked to device
      google.accounts.id.prompt();
    } catch (err) {
      console.error('GSI Init error:', err);
    }
  };

  const handleManualAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/verify-owner-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess();
      } else {
        setError(data.message || 'Invalid administrative password.');
      }
    } catch (err) {
      console.error(err);
      setError('Network connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/send-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'prakharmishra00000@gmail.com' })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'Verification code sent.');
        setResetStep('code');
      } else {
        setError(data.message || data.error || 'Failed to send verification code. Make sure SMTP email server credentials are set in System Setup.');
      }
    } catch (err) {
      console.error(err);
      setError('Network connection error. Failed to trigger reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!resetCode) {
      setError('Please enter the verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'prakharmishra00000@gmail.com',
          code: resetCode
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Code verified successfully. Enter your new password.');
        setResetStep('newPassword');
      } else {
        setError(data.message || 'Invalid verification code.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error. Failed to verify code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'prakharmishra00000@gmail.com',
          code: resetCode,
          newPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert('Password updated successfully! You can now log in with the new password.');
        setSuccessMsg('Password updated successfully!');
        setPassword('');
        setResetStep('login');
      } else {
        setError(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error. Failed to save new password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatedGoogle = () => {
    onSuccess();
  };

  return (
    <div className="auth-container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="auth-card glass-panel" style={{ maxWidth: '420px', width: '100%', padding: '30px' }}>
        
        <button 
          onClick={onBack} 
          className="btn btn-secondary" 
          style={{ padding: '6px 12px', fontSize: '0.8rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px', width: 'max-content' }}
        >
          <ArrowLeft size={16} />
          Back to Portal
        </button>

        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <ShieldCheck size={48} color="#00f2fe" style={{ margin: '0 auto 10px' }} />
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#fff' }}>
            {resetStep === 'login' ? 'Secure Verification' : 'Reset Password'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '5px' }}>
            {resetStep === 'login' && 'Re-authentication required for prakharmishra00000@gmail.com to access setup & admin options.'}
            {resetStep === 'code' && 'Enter the verification code to reset your password.'}
            {resetStep === 'newPassword' && 'Set a new password for your owner admin account.'}
          </p>
        </div>

        {error && (
          <div style={{ color: '#ff3366', marginBottom: '15px', padding: '8px 12px', background: 'rgba(255,51,102,0.1)', borderRadius: '6px', fontSize: '0.8rem' }}>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{ color: '#39ff14', marginBottom: '15px', padding: '8px 12px', background: 'rgba(57,255,20,0.1)', borderRadius: '6px', fontSize: '0.8rem' }}>
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: standard secure login */}
        {resetStep === 'login' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              {isConfigLoaded && (
                googleClientId ? (
                  <div id="owner-google-btn-container" style={{ display: 'flex', justifyContent: 'center' }} />
                ) : (
                  <button 
                    type="button" 
                    onClick={handleSimulatedGoogle} 
                    className="btn btn-google" 
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18">
                      <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.8 2.72v2.24h2.9c1.7-1.57 2.7-3.88 2.7-6.59z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.9-2.24c-.8.54-1.84.87-3.06.87-2.35 0-4.33-1.58-5.04-3.71H.92v2.32C2.4 15.98 5.46 18 9 18z"/>
                      <path fill="#FBBC05" d="M3.96 10.72c-.18-.54-.28-1.12-.28-1.72s.1-1.18.28-1.72V4.96H.92C.33 6.13 0 7.52 0 9s.33 2.87.92 4.04l3.04-2.32z"/>
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.1C13.46.7 11.43 0 9 0 5.46 0 2.4 2.02.92 4.96l3.04 2.32C4.67 5.16 6.65 3.58 9 3.58z"/>
                    </svg>
                    Continue with Google
                  </button>
                )
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: 'var(--text-muted)' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }}></div>
              <span style={{ padding: '0 10px', fontSize: '0.8rem' }}>or enter manually</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }}></div>
            </div>

            <form onSubmit={handleManualAuth}>
              <div className="input-group" style={{ marginBottom: '15px' }}>
                <Mail size={18} />
                <input 
                  type="email" 
                  placeholder="Owner Email Address"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                />
              </div>

              <div className="input-group" style={{ marginBottom: '15px', position: 'relative' }}>
                <Lock size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Admin Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', color: '#00f2fe', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Forgot Password?
                </button>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%' }} 
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Access Secured Area'}
              </button>
            </form>
          </>
        )}

        {/* STEP 2: verification code entry */}
        {resetStep === 'code' && (
          <form onSubmit={handleVerifyCode}>
            <div className="input-group" style={{ marginBottom: '20px' }}>
              <KeyRound size={18} />
              <input 
                type="text" 
                placeholder="Verification code"
                value={resetCode} 
                maxLength={10}
                onChange={(e) => setResetCode(e.target.value)} 
                style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem' }}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginBottom: '10px' }} 
              disabled={loading}
            >
              {loading ? 'Verifying Code...' : 'Verify Code & Proceed'}
            </button>

            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%' }} 
              onClick={() => { setResetStep('login'); setError(''); setSuccessMsg(''); }}
            >
              Cancel
            </button>
          </form>
        )}

        {/* STEP 3: enter new password */}
        {resetStep === 'newPassword' && (
          <form onSubmit={handleResetPassword}>
            <div className="input-group" style={{ marginBottom: '20px', position: 'relative' }}>
              <Lock size={18} />
              <input 
                type={showNewPassword ? "text" : "password"} 
                placeholder="Enter New Password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginBottom: '10px' }} 
              disabled={loading}
            >
              {loading ? 'Saving Password...' : 'Save New Password'}
            </button>

            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%' }} 
              onClick={() => { setResetStep('login'); setError(''); setSuccessMsg(''); }}
            >
              Cancel
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

export default OwnerSecureLogin;
