import React, { useState, useEffect, Suspense, lazy } from 'react';
import OwnerSecureLogin from './components/OwnerSecureLogin';
import Admin from './components/Admin';
import Setup from './components/Setup';
import { LogOut, Shield, Settings, BarChart3, Cpu, Zap } from 'lucide-react';

const SpaceBackground = lazy(() => import('./components/SpaceBackground'));

const COSMIC_THEMES = [
  'supernova-blast', 'solar-eruption', 'quasar-jet', 'nebula-tempest', 'hyperdrive-warp',
  'meteor-shower', 'blackhole-vortex', 'gammaray-burst', 'asteroid-storm', 'cosmic-collision'
];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeView, setActiveView] = useState('portal');
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('admin_theme');
    return COSMIC_THEMES.includes(saved) ? saved : 'supernova-blast';
  });

  // Performance mode toggle
  const [perfMode, setPerfMode] = useState(() => localStorage.getItem('admin_perf_mode') !== 'false');

  const handleTogglePerfMode = () => {
    const newVal = !perfMode;
    setPerfMode(newVal);
    localStorage.setItem('admin_perf_mode', String(newVal));
    window.dispatchEvent(new Event('perfModeChanged'));
  };

  // Auto-cycle themes every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTheme(prev => {
        const idx = COSMIC_THEMES.indexOf(prev);
        const next = COSMIC_THEMES[(idx + 1) % COSMIC_THEMES.length];
        localStorage.setItem('admin_theme', next);
        return next;
      });
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveView('portal');
  };

  if (!isAuthenticated) {
    return (
      <div className={`app-container theme-${theme}`}>
        <Suspense fallback={<div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, background: '#010103' }} />}>
          <SpaceBackground theme={theme} />
        </Suspense>

        <div className="matrixmind-logo-badge" title="MatrixMind AI Admin">
          <img src="/matrixmind-logo.jpg" alt="MatrixMind AI" />
        </div>

        <button 
          className="perf-toggle-btn"
          onClick={handleTogglePerfMode}
          title={perfMode ? "Switch to 3D Background" : "Switch to 2D Background (Reduces Lag)"}
        >
          {perfMode ? <Zap size={13} color="#fda085" /> : <Cpu size={13} color="#00f2fe" />}
          <span>{perfMode ? "2D BG" : "3D BG"}</span>
        </button>

        <OwnerSecureLogin
          onSuccess={() => {
            setIsAuthenticated(true);
            setActiveView('portal');
          }}
          onBack={() => {}}
        />
      </div>
    );
  }

  return (
    <div className={`app-container theme-${theme}`}>
      {/* 3D COSMIC BACKGROUND */}
      <Suspense fallback={<div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, background: '#010103' }} />}>
        <SpaceBackground theme={theme} />
      </Suspense>

      {/* FLOATING LOGO */}
      <div className="matrixmind-logo-badge" title="MatrixMind AI Admin">
        <img src="/matrixmind-logo.jpg" alt="MatrixMind AI" />
      </div>

      {/* PERFORMANCE TOGGLE */}
      <button 
        className="perf-toggle-btn"
        onClick={handleTogglePerfMode}
        title={perfMode ? "Switch to 3D Background" : "Switch to 2D Background (Reduces Lag)"}
      >
        {perfMode ? <Zap size={13} color="#fda085" /> : <Cpu size={13} color="#00f2fe" />}
        <span>{perfMode ? "2D BG" : "3D BG"}</span>
      </button>

      {/* ADMIN PORTAL */}
      {activeView === 'portal' && (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ maxWidth: '520px', width: '100%', padding: '44px 36px', textAlign: 'center', borderRadius: '22px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>
            
            {/* Animated title */}
            <h1 style={{ 
              fontFamily: 'Outfit', fontWeight: 800, fontSize: '2.4rem', 
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 30%, #a855f7 60%, #ff3366 100%)', 
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', 
              marginBottom: '6px', letterSpacing: '-0.02em'
            }}>
              Admin Control Center
            </h1>
            
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Shield size={14} color="#00f2fe" /> Authenticated as Owner
            </p>

            {/* Current theme indicator */}
            <div style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '6px', 
              padding: '4px 14px', borderRadius: '20px', fontSize: '0.72rem', 
              background: 'rgba(0,242,254,0.06)', border: '1px solid rgba(0,242,254,0.15)', 
              color: '#00f2fe', marginBottom: '28px', fontWeight: 600
            }}>
              🌌 {theme.replace(/-/g, ' ').toUpperCase()}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <button
                className="btn"
                onClick={() => setActiveView('admin')}
                style={{ 
                  padding: '16px', fontSize: '1.05rem', fontWeight: 700, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                  border: 'none', borderRadius: '12px', color: '#fff',
                  transition: 'all 0.3s ease', cursor: 'pointer'
                }}
                onMouseOver={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 30px rgba(0,242,254,0.3)'; }}
                onMouseOut={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = 'none'; }}
              >
                <BarChart3 size={20} /> Admin Dashboard
              </button>
              
              <button
                className="btn btn-secondary"
                onClick={() => setActiveView('setup')}
                style={{ 
                  padding: '16px', fontSize: '1.05rem', fontWeight: 700, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  borderRadius: '12px', transition: 'all 0.3s ease', cursor: 'pointer'
                }}
                onMouseOver={e => { e.target.style.transform = 'translateY(-2px)'; }}
                onMouseOut={e => { e.target.style.transform = 'translateY(0)'; }}
              >
                <Settings size={20} /> System Setup
              </button>
              
              <button
                className="btn"
                onClick={handleLogout}
                style={{ 
                  padding: '13px', fontSize: '0.92rem', marginTop: '8px', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: 'linear-gradient(135deg, #ff3366, #ff6b6b)', 
                  border: 'none', borderRadius: '12px', color: '#fff',
                  transition: 'all 0.3s ease', cursor: 'pointer'
                }}
                onMouseOver={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 30px rgba(255,51,102,0.3)'; }}
                onMouseOut={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = 'none'; }}
              >
                <LogOut size={16} /> Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {activeView === 'admin' && (
        <Admin onBack={() => setActiveView('portal')} email="prakharmishra00000@gmail.com" />
      )}

      {activeView === 'setup' && (
        <Setup
          onComplete={() => setActiveView('portal')}
          onBack={() => setActiveView('portal')}
          currentUser={{ email: 'prakharmishra00000@gmail.com' }}
        />
      )}
    </div>
  );
}

export default App;
