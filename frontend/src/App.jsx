import React, { useState, useEffect } from 'react';
import OwnerSecureLogin from './components/OwnerSecureLogin';
import Admin from './components/Admin';
import Setup from './components/Setup';
import { LogOut, Shield, Settings, BarChart3 } from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeView, setActiveView] = useState('portal'); // 'portal', 'admin', 'setup'
  const [theme] = useState('supernova-blast');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveView('portal');
  };

  if (!isAuthenticated) {
    return (
      <div className={`app-container theme-${theme}`} style={{ background: '#010103', minHeight: '100vh' }}>
        <div className="matrixmind-logo-badge" title="MatrixMind AI">
          <img src="/matrixmind-logo.jpg" alt="MatrixMind AI" />
        </div>
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
    <div className={`app-container theme-${theme}`} style={{ background: '#010103', minHeight: '100vh' }}>
      <div className="matrixmind-logo-badge" title="MatrixMind AI">
        <img src="/matrixmind-logo.jpg" alt="MatrixMind AI" />
      </div>

      {activeView === 'portal' && (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', padding: '40px', textAlign: 'center', borderRadius: '20px' }}>
            <h1 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '2.2rem', background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #ff3366 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '10px' }}>
              Admin Control Center
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '30px' }}>
              <Shield size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Authenticated as Admin
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <button
                className="btn"
                onClick={() => setActiveView('admin')}
                style={{ padding: '14px', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                <BarChart3 size={20} /> Admin Dashboard
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setActiveView('setup')}
                style={{ padding: '14px', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                <Settings size={20} /> System Setup
              </button>
              <button
                className="btn btn-danger"
                onClick={handleLogout}
                style={{ padding: '12px', fontSize: '0.9rem', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
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
