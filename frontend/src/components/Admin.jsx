import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Users, Eye, ShieldCheck, TrendingUp, Lock, 
  RefreshCw, Trash2, Plus, ShieldAlert, Cpu, Database, 
  HelpCircle, Save, Calendar, AlertTriangle, Upload, CreditCard
} from 'lucide-react';

function Admin({ onBack, email }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'users', 'plans', 'queries', 'threats', 'selfcode'
  
  // Plans Editor state
  const [editingPlans, setEditingPlans] = useState({});
  const [editingFeatureNames, setEditingFeatureNames] = useState({});
  const [newFeatureText, setNewFeatureText] = useState({});
  const [showFeaturePrompt, setShowFeaturePrompt] = useState(null); // planId
  const [newFeatureInput, setNewFeatureInput] = useState('');
  
  // AI Self-Coder state
  const [coderPrompt, setCoderPrompt] = useState('');
  const [coderFile, setCoderFile] = useState('frontend/src/components/Dashboard.jsx');
  const [coderLoading, setCoderLoading] = useState(false);
  const [coderResult, setCoderResult] = useState('');
  const [coderError, setCoderError] = useState('');

  // Threat Audit state
  const [threatScanLoading, setThreatScanLoading] = useState(false);
  const [threatReport, setThreatReport] = useState('');

  // Payment Settings state
  const [payUpiId, setPayUpiId] = useState('6372843175@kotakbank');
  const [payName, setPayName] = useState('Prakhar Mishra');
  const [payQrPreview, setPayQrPreview] = useState(null);
  const [hasCustomQR, setHasCustomQR] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payMsg, setPayMsg] = useState('');

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/plans');
      if (res.ok) {
        const data = await res.json();
        if (data.plans) {
          setEditingPlans(data.plans);
          setEditingFeatureNames(data.featureNames || {});
        } else {
          setEditingPlans(data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch plans:', e);
    }
  };

  useEffect(() => {
    if (email !== 'prakharmishra00000@gmail.com') return;

    fetchAdminStats(email);
    fetchPlans();
    
    // Auto-poll stats/approvals/backups every 10 seconds to keep dashboard updated globally
    const interval = setInterval(() => {
      fetchAdminStats(email);
    }, 10000);

    return () => clearInterval(interval);
  }, [email]);

  const fetchAdminStats = async (userEmail) => {
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      } else {
        setError(data.error || 'Unauthorized admin access.');
      }
    } catch (e) {
      console.error(e);
      setError('Connection error: Failed to fetch admin stats.');
    }
  };

  // Update Subscription Plans in db.json
  const handleSavePlans = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/plans/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plans: editingPlans, featureNames: editingFeatureNames })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Subscription plan settings updated successfully!');
        fetchPlans();
        fetchAdminStats(email);
      } else {
        setError(data.error || 'Failed to update plans.');
      }
    } catch (e) {
      setError('Failed to save plans: Connection error.');
    } finally {
      setLoading(false);
    }
  };

  // Add a feature metadata text to plan list
  const handleAddFeatureText = (planId) => {
    if (!newFeatureInput.trim()) return;
    
    const updated = { ...editingPlans };
    if (updated[planId]) {
      updated[planId].features = [...(updated[planId].features || []), newFeatureInput.trim()];
      setEditingPlans(updated);
      setNewFeatureInput('');
      setShowFeaturePrompt(null);
    }
  };

  // Remove a feature metadata text from plan list
  const handleRemoveFeatureText = (planId, featureIdx) => {
    const updated = { ...editingPlans };
    if (updated[planId] && updated[planId].features) {
      updated[planId].features = updated[planId].features.filter((_, idx) => idx !== featureIdx);
      setEditingPlans(updated);
    }
  };

  // ===== PAYMENT SETTINGS HANDLERS =====
  const fetchPaymentSettings = async () => {
    try {
      const res = await fetch('/api/admin/payment-settings');
      if (res.ok) {
        const data = await res.json();
        setPayUpiId(data.receiverUpiId || '6372843175@kotakbank');
        setPayName(data.receiverName || 'Prakhar Mishra');
        setHasCustomQR(data.hasCustomQR || false);
        setPayQrPreview(null);
      }
    } catch (e) {
      console.error('Failed to fetch payment settings:', e);
    }
  };

  const handleSavePaymentSettings = async () => {
    setPayLoading(true);
    setPayMsg('');
    try {
      const res = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverUpiId: payUpiId, receiverName: payName })
      });
      const data = await res.json();
      if (res.ok) {
        setPayMsg(data.message || 'Settings saved!');
        setTimeout(() => setPayMsg(''), 3000);
      } else {
        setPayMsg('Error: ' + (data.error || 'Failed to save.'));
      }
    } catch (e) {
      setPayMsg('Network error saving settings.');
    } finally {
      setPayLoading(false);
    }
  };

  const handleQrFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPayMsg('Error: File too large. Max 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      setPayQrPreview(base64);
      setPayLoading(true);
      setPayMsg('');
      try {
        const res = await fetch('/api/admin/upload-qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: base64 })
        });
        const data = await res.json();
        if (res.ok) {
          setHasCustomQR(true);
          setPayMsg(data.message || 'QR uploaded!');
          setTimeout(() => setPayMsg(''), 3000);
        } else {
          setPayMsg('Error: ' + (data.error || 'Upload failed.'));
        }
      } catch (err) {
        setPayMsg('Network error uploading QR.');
      } finally {
        setPayLoading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset file input
  };

  const handleDeleteQr = async () => {
    setPayLoading(true);
    try {
      const res = await fetch('/api/admin/upload-qr', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setHasCustomQR(false);
        setPayQrPreview(null);
        setPayMsg(data.message || 'QR removed.');
        setTimeout(() => setPayMsg(''), 3000);
      }
    } catch (e) {
      setPayMsg('Error removing QR.');
    } finally {
      setPayLoading(false);
    }
  };

  // AI Self-Coding deployment trigger
  const handleTriggerSelfCode = async () => {
    setCoderError('');
    setCoderResult('');
    setCoderLoading(true);
    try {
      const res = await fetch('/api/admin/self-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          prompt: coderPrompt
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCoderResult(data.message);
        setCoderPrompt('');
        fetchAdminStats(email); // refresh backups list
      } else {
        setCoderError(data.message || data.error || 'Compilation errors occurred.');
      }
    } catch (e) {
      setCoderError('Self-coding server execution timed out or failed.');
    } finally {
      setCoderLoading(false);
    }
  };

  // Run AI Security threats assessment
  const handleRunThreatScan = async () => {
    setThreatReport('');
    setThreatScanLoading(true);
    try {
      const res = await fetch('/api/admin/threats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
      const data = await res.json();
      if (res.ok) {
        setThreatReport(data.report);
      } else {
        alert('Threat scan failed: ' + data.error);
      }
    } catch (e) {
      alert('Network scan error.');
    } finally {
      setThreatScanLoading(false);
    }
  };

  // Handle Approve/Reject for UPI payment requests
  const handleApprovalAction = async (requestId, action, selectedPlan) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/approvals/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, requestId, action, selectedPlan })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || `Request processed.`);
        fetchAdminStats(email);
      } else {
        setError(data.error || 'Failed to perform approval action.');
      }
    } catch (e) {
      setError('Connection error: Failed to process approval request.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate percentage helper
  const getPercentage = (val, total) => {
    if (!total) return '0%';
    return `${Math.round((val / total) * 100)}%`;
  };

  if (email !== 'prakharmishra00000@gmail.com') {
    return (
      <div className="auth-container" style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="auth-card glass-panel" style={{ maxWidth: '450px', padding: '35px', textAlign: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onBack}
            style={{ padding: '6px 12px', fontSize: '0.8rem', marginBottom: '20px', width: 'max-content', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h2 style={{ color: '#ff3366', fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.8rem', marginBottom: '15px' }}>Unauthorized Access</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Only the registered owner account <strong>prakharmishra00000@gmail.com</strong> is authorized to access the Admin Console.</p>
        </div>
      </div>
    );
  }

  // Find users whose plans have expired (plan === 'free' but has previous expiry)
  const expiredUsers = stats?.users?.filter(u => !u.expiry && u.plan === 'free') || [];
  
  // Current active plan expirations
  const activeExpirations = stats?.users?.filter(u => u.expiry && u.plan !== 'free') || [];

  return (
    <div className="admin-container" style={{ padding: '40px', width: '100vw', height: '100vh', overflowY: 'auto' }}>
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '2.2rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            MatrixMind System Administration
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>Dynamically manage tier pricing, security assessments, and prompt features.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => fetchAdminStats(email)}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn" onClick={onBack}>
            <ArrowLeft size={16} /> Return
          </button>
        </div>
      </div>

      {/* Admin Tab navigation */}
      <div className="auth-tabs" style={{ marginBottom: '30px' }}>
        <button className={`auth-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics & Traffic</button>
        <button className={`auth-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Users & Credentials</button>
        <button className={`auth-tab ${activeTab === 'plans' ? 'active' : ''}`} onClick={() => setActiveTab('plans')}>Dynamic Plans Editor</button>
        <button className={`auth-tab ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}>Pending Approvals ({stats?.pendingApprovals?.filter(r => r.status === 'pending').length || 0})</button>
        <button className={`auth-tab ${activeTab === 'queries' ? 'active' : ''}`} onClick={() => setActiveTab('queries')}>Support Queries ({stats?.supportQueries?.length || 0})</button>
        <button className={`auth-tab ${activeTab === 'threats' ? 'active' : ''}`} onClick={() => setActiveTab('threats')}>Security Threat Assessment</button>
        <button className={`auth-tab ${activeTab === 'selfcode' ? 'active' : ''}`} onClick={() => setActiveTab('selfcode')}>AI Self-Coding Developer</button>
        <button className={`auth-tab ${activeTab === 'payment' ? 'active' : ''}`} onClick={() => { setActiveTab('payment'); fetchPaymentSettings(); }}>Payment Settings</button>
      </div>

      {error && (
        <div style={{ color: '#ff3366', background: 'rgba(255,51,102,0.1)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '25px' }}>
          {error}
        </div>
      )}

      {stats && (
        <>
          {/* TAB 1: ANALYTICS & TRAFFIC */}
          {activeTab === 'analytics' && (
            <div>
              {/* Cloud Sync Status Banner */}
              {stats.cloudStatus && (
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', marginBottom: '20px',
                  borderRadius: '10px', fontSize: '0.8rem',
                  background: stats.cloudStatus.firebaseLoaded && !stats.cloudStatus.isHardcodedSeed 
                    ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 51, 102, 0.1)',
                  border: `1px solid ${stats.cloudStatus.firebaseLoaded && !stats.cloudStatus.isHardcodedSeed ? 'rgba(0,230,118,0.25)' : 'rgba(255,51,102,0.25)'}`
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', 
                    background: stats.cloudStatus.firebaseLoaded && !stats.cloudStatus.isHardcodedSeed ? '#00e676' : '#ff3366',
                    boxShadow: `0 0 8px ${stats.cloudStatus.firebaseLoaded ? '#00e676' : '#ff3366'}` }} />
                  <span style={{ color: stats.cloudStatus.firebaseLoaded ? '#a5d6a7' : '#ff8a80' }}>
                    {stats.cloudStatus.firebaseLoaded && !stats.cloudStatus.isHardcodedSeed 
                      ? `🔥 Firebase Live • Synced at ${new Date(stats.cloudStatus.lastSync).toLocaleTimeString()}`
                      : '⚠️ Using local fallback data — Firebase not connected'}
                  </span>
                </div>
              )}

              {/* Top Stats Row */}
              <div className="admin-stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '25px' }}>
                <div className="stat-card glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                  <div className="stat-label">Total Users</div>
                  <div className="stat-value" style={{ color: 'var(--accent-cyan)', fontSize: '2rem' }}>{stats.totalUsers}</div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>Registered accounts</p>
                </div>
                <div className="stat-card glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                  <div className="stat-label">Active Subscribers</div>
                  <div className="stat-value" style={{ color: '#00e676', fontSize: '2rem' }}>{stats.activeSubscribers || 0}</div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>Paid plans currently active</p>
                </div>
                <div className="stat-card glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                  <div className="stat-label">Active Revenue</div>
                  <div className="stat-value" style={{ color: '#ffd740', fontSize: '2rem' }}>₹{stats.activeRevenue || 0}</div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>From current subscriptions</p>
                </div>
                <div className="stat-card glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                  <div className="stat-label">Total Revenue</div>
                  <div className="stat-value" style={{ color: 'var(--accent-neon-green)', fontSize: '2rem' }}>₹{stats.totalRevenue}</div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>All-time transactions</p>
                </div>
                <div className="stat-card glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                  <div className="stat-label">Page Views (Today)</div>
                  <div className="stat-value" style={{ color: '#ce93d8', fontSize: '2rem' }}>{stats.visitorsToday}</div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Anonymous: {stats.anonymousVisits[new Date().toISOString().split('T')[0]] || 0}
                  </p>
                </div>
              </div>

              <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
                {/* Transaction history logs */}
                <div className="admin-table-container glass-panel" style={{ padding: '25px', borderRadius: 'var(--radius-lg)', overflowX: 'auto' }}>
                  <h3 className="admin-section-title" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.15rem', marginBottom: '18px' }}>
                    💳 Recent Payment Logs
                  </h3>
                  {stats.transactions.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '30px' }}>No payments logged yet.</p>
                  ) : (
                    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Email</th>
                          <th>Plan</th>
                          <th>Payment ID</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.transactions.map((t) => (
                          <tr key={t.id}>
                            <td>{new Date(t.date).toLocaleDateString()}</td>
                            <td style={{ fontWeight: 600 }}>{t.email}</td>
                            <td><span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--accent-cyan)' }}>{(t.plan || '').toUpperCase()}</span></td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.paymentRef || t.razorpayPaymentId || '-'}</td>
                            <td style={{ color: 'var(--accent-neon-green)', fontWeight: 700 }}>₹{t.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Plan distribution + Revenue breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="admin-chart-box glass-panel" style={{ padding: '22px', borderRadius: 'var(--radius-lg)' }}>
                    <h3 className="admin-section-title" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '18px' }}>
                      📊 Plan Distribution
                    </h3>
                    <div className="bar-chart" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[
                        { label: 'Free', count: stats.planDistribution.free, color: '#94a3b8' },
                        { label: 'Standard', count: stats.planDistribution.standard, color: 'var(--accent-cyan)' },
                        { label: 'Pro', count: stats.planDistribution.better, color: '#ffd740' },
                        { label: 'Ultimate', count: stats.planDistribution.premium, color: '#ff3366' }
                      ].map(p => (
                        <div key={p.label} className="chart-bar-row">
                          <span className="chart-label" style={{ minWidth: '70px' }}>{p.label}</span>
                          <div className="chart-bar-wrapper" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', height: '12px', borderRadius: '6px', margin: '0 10px' }}>
                            <div className="chart-bar-fill" style={{ width: getPercentage(p.count, stats.totalUsers), height: '100%', background: p.color, borderRadius: '6px', transition: 'width 0.5s ease' }}></div>
                          </div>
                          <span className="chart-value" style={{ minWidth: '24px', textAlign: 'right' }}>{p.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active Revenue Breakdown */}
                  {stats.revenueByPlan && Object.keys(stats.revenueByPlan).length > 0 && (
                    <div className="glass-panel" style={{ padding: '22px', borderRadius: 'var(--radius-lg)' }}>
                      <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '15px', color: '#ffd740' }}>
                        💰 Active Revenue Breakdown
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {Object.entries(stats.revenueByPlan).map(([plan, amount]) => (
                          <div key={plan} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{plan}</span>
                            <span style={{ color: '#ffd740', fontWeight: 700 }}>₹{amount}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: '1px solid var(--border-glass)', marginTop: '4px' }}>
                          <span style={{ fontWeight: 700 }}>Total Active</span>
                          <span style={{ color: '#00e676', fontWeight: 800, fontSize: '1.1rem' }}>₹{stats.activeRevenue || 0}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USERS & CREDENTIALS — LIVE DATA */}
          {activeTab === 'users' && (
            <div>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '25px' }}>
                <div className="glass-panel" style={{ padding: '18px', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Total Users</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{stats.totalUsers}</div>
                </div>
                <div className="glass-panel" style={{ padding: '18px', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Active Paid</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#00e676' }}>{stats.users.filter(u => u.isActive).length}</div>
                </div>
                <div className="glass-panel" style={{ padding: '18px', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Free Users</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#94a3b8' }}>{stats.users.filter(u => u.plan === 'free').length}</div>
                </div>
                <div className="glass-panel" style={{ padding: '18px', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Active Revenue</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffd740' }}>₹{stats.activeRevenue || 0}</div>
                </div>
              </div>

              {/* Full user table */}
              <div className="admin-table-container glass-panel" style={{ padding: '25px', borderRadius: 'var(--radius-lg)', marginBottom: '25px' }}>
                <h3 className="admin-section-title" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.15rem', marginBottom: '18px' }}>
                  👤 All Registered Users ({stats.users.length})
                </h3>
                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Email</th>
                      <th>Plan</th>
                      <th>Price</th>
                      <th>Prompts Used</th>
                      <th>Expiry</th>
                      <th>Days Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Sort: active paid users first, then free */}
                    {[...stats.users].sort((a, b) => {
                      if (a.isActive && !b.isActive) return -1;
                      if (!a.isActive && b.isActive) return 1;
                      if (a.plan !== 'free' && b.plan === 'free') return -1;
                      if (a.plan === 'free' && b.plan !== 'free') return 1;
                      return 0;
                    }).map((u, idx) => {
                      const daysLeft = u.expiry ? Math.max(0, Math.ceil((new Date(u.expiry) - new Date()) / (1000 * 60 * 60 * 24))) : null;
                      return (
                        <tr key={idx} style={{ background: u.isActive ? 'rgba(0, 230, 118, 0.04)' : 'transparent' }}>
                          <td>
                            {u.isActive ? (
                              <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '10px', background: 'rgba(0, 230, 118, 0.15)', color: '#00e676', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e676', display: 'inline-block' }}></span>
                                ACTIVE
                              </span>
                            ) : u.plan === 'free' ? (
                              <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#94a3b8' }}>FREE</span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '10px', background: 'rgba(255,51,102,0.1)', color: '#ff5555' }}>EXPIRED</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.email}</td>
                          <td>
                            <span style={{ 
                              fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 600,
                              background: u.plan === 'free' ? 'rgba(255,255,255,0.05)' : u.plan === 'premium' ? 'rgba(255,51,102,0.12)' : 'rgba(0, 242, 254, 0.1)', 
                              color: u.plan === 'free' ? '#94a3b8' : u.plan === 'premium' ? '#ff6b8a' : 'var(--accent-cyan)' 
                            }}>
                              {u.plan.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ color: u.planPrice > 0 ? '#ffd740' : 'var(--text-muted)', fontWeight: u.planPrice > 0 ? 700 : 400 }}>
                            {u.planPrice > 0 ? `₹${u.planPrice}` : '—'}
                          </td>
                          <td>{u.promptsUsed} prompts</td>
                          <td style={{ fontSize: '0.82rem', color: u.expiry ? (u.isActive ? '#a5d6a7' : '#ff8a80') : 'var(--text-muted)' }}>
                            {u.expiry ? new Date(u.expiry).toLocaleDateString() : '—'}
                          </td>
                          <td>
                            {daysLeft !== null ? (
                              <span style={{ 
                                fontWeight: 700, fontSize: '0.85rem',
                                color: daysLeft > 30 ? '#00e676' : daysLeft > 7 ? '#ffd740' : '#ff5555'
                              }}>
                                {daysLeft > 0 ? `${daysLeft}d` : 'Expired'}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Active subscribers detail panel */}
              {stats.users.filter(u => u.isActive).length > 0 && (
                <div className="glass-panel" style={{ padding: '22px', borderRadius: 'var(--radius-lg)' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', color: '#00e676', marginBottom: '15px', fontFamily: 'var(--font-heading)' }}>
                    💎 Active Paying Subscribers ({stats.users.filter(u => u.isActive).length})
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {stats.users.filter(u => u.isActive).map((u, i) => {
                      const daysLeft = Math.max(0, Math.ceil((new Date(u.expiry) - new Date()) / (1000 * 60 * 60 * 24)));
                      return (
                        <div key={i} style={{ 
                          padding: '14px 16px', borderRadius: '10px', 
                          background: 'rgba(0, 230, 118, 0.05)', border: '1px solid rgba(0,230,118,0.15)'
                        }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>{u.email}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <span>{u.plan.toUpperCase()} • ₹{u.planPrice}</span>
                            <span style={{ color: daysLeft > 30 ? '#00e676' : daysLeft > 7 ? '#ffd740' : '#ff5555', fontWeight: 600 }}>
                              {daysLeft}d remaining
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DYNAMIC PLANS EDITOR */}
          {activeTab === 'plans' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', margin: 0 }}>
                  Subscription Tiers configuration
                </h3>
                <button className="btn" onClick={handleSavePlans} disabled={loading} style={{ padding: '10px 20px', fontSize: '0.85rem' }}>
                  <Save size={16} /> Save Plan Settings
                </button>
              </div>

              <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', borderRadius: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--accent-cyan)' }}>Manage Feature Types</h4>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '15px' }}>Trackable features with daily limits. Use -1 for unlimited, 0 to disable.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
                  {Object.keys(editingFeatureNames).map(key => (
                    <div key={key} style={{ background: 'rgba(0,242,254,0.05)', border: '1px solid rgba(0,242,254,0.15)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: '#00f2fe', fontSize: '0.7rem', textTransform: 'uppercase' }}>{key}</span>
                      <input type="text" value={editingFeatureNames[key]} onChange={(e) => { const u = { ...editingFeatureNames }; u[key] = e.target.value; setEditingFeatureNames(u); }} style={{ background: 'none', border: '1px solid var(--border-glass)', padding: '2px 6px', color: '#fff', fontSize: '0.8rem', borderRadius: '4px', width: '140px' }} />
                      <button type="button" title="Delete from all plans" onClick={() => { if (!window.confirm('Delete feature "' + editingFeatureNames[key] + '" (' + key + ') from ALL plans?')) return; const un = { ...editingFeatureNames }; delete un[key]; setEditingFeatureNames(un); const up = { ...editingPlans }; Object.keys(up).forEach(pid => { if (up[pid].featureLimits) delete up[pid].featureLimits[key]; }); setEditingPlans(up); }} style={{ background: 'none', border: 'none', color: '#ff5555', cursor: 'pointer', padding: '0 2px' }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', border: '1px dashed rgba(0,242,254,0.2)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-cyan)', display: 'block', marginBottom: '10px' }}>Add New Trackable Feature</span>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="text" placeholder="Feature Key (e.g. autocoder)" id="newFeatureKeyInput" style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', width: '180px', borderRadius: '8px', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.8rem' }} />
                    <input type="text" placeholder="Display Name (e.g. Auto Coder)" id="newFeatureNameInput" style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', width: '200px', borderRadius: '8px', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.8rem' }} />
                    <input type="number" placeholder="Default limit (0)" id="newFeatureDefaultLimit" style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', width: '120px', borderRadius: '8px', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.8rem' }} />
                    <button className="btn" onClick={() => { const k = document.getElementById('newFeatureKeyInput').value.trim(); const n = document.getElementById('newFeatureNameInput').value.trim(); const dl = parseInt(document.getElementById('newFeatureDefaultLimit').value) || 0; if (!k || !n) { alert('Both Key and Name required.'); return; } if (editingFeatureNames[k]) { alert('Key "' + k + '" exists.'); return; } setEditingFeatureNames({ ...editingFeatureNames, [k]: n }); const up = { ...editingPlans }; Object.keys(up).forEach(pid => { if (!up[pid].featureLimits) up[pid].featureLimits = {}; up[pid].featureLimits[k] = dl; if (!up[pid].features) up[pid].features = []; const lt = dl === -1 ? 'Unlimited' : dl === 0 ? 'Disabled' : dl + '/day'; up[pid].features.push(n + ' (' + lt + ')'); }); setEditingPlans(up); document.getElementById('newFeatureKeyInput').value = ''; document.getElementById('newFeatureNameInput').value = ''; document.getElementById('newFeatureDefaultLimit').value = ''; }} style={{ padding: '8px 15px', fontSize: '0.8rem' }}><Plus size={14} /> Add Feature</button>
                  </div>
                  <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '8px', marginBottom: 0 }}>Use -1 for unlimited. Auto-added to all plans feature lists.</p>
                </div>
              </div>

              <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                {Object.keys(editingPlans).map((planId) => {
                  const plan = editingPlans[planId];
                  return (
                    <div key={planId} className="plan-card glass-panel" style={{ padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                      <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-cyan)', marginBottom: '15px', textTransform: 'uppercase', textAlign: 'center' }}>{plan.name} configuration</h4>
                      <div className="form-group" style={{ marginBottom: '12px' }}><label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Plan Name</label><input type="text" value={plan.name || ''} onChange={(e) => { const u = { ...editingPlans }; u[planId].name = e.target.value; setEditingPlans(u); }} style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px' }} /></div>
                      <div className="form-group" style={{ marginBottom: '12px' }}><label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Plan Price (₹)</label><input type="number" value={plan.price} onChange={(e) => { const u = { ...editingPlans }; u[planId].price = parseInt(e.target.value) || 0; setEditingPlans(u); }} disabled={planId === 'free'} style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px' }} /></div>
                      <div className="form-group" style={{ marginBottom: '12px' }}><label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Daily Prompts limit</label><input type="number" value={plan.prompts} onChange={(e) => { const u = { ...editingPlans }; u[planId].prompts = parseInt(e.target.value) || 0; setEditingPlans(u); }} style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px' }} /></div>
                      <div className="form-group" style={{ marginBottom: '12px' }}><label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Billing Duration</label><input type="text" value={plan.duration || ''} onChange={(e) => { const u = { ...editingPlans }; u[planId].duration = e.target.value; setEditingPlans(u); }} disabled={planId === 'free'} placeholder="e.g. 1 Month" style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px' }} /></div>
                      {planId !== 'free' && (<div className="form-group" style={{ marginBottom: '12px' }}><label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Days Duration</label><input type="number" value={plan.days || 30} onChange={(e) => { const u = { ...editingPlans }; u[planId].days = parseInt(e.target.value) || 30; setEditingPlans(u); }} style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px' }} /></div>)}

                      <div style={{ borderTop: '1px solid var(--border-glass)', marginTop: '10px', paddingTop: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}><span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>Feature Limits</span><span style={{ fontSize: '0.6rem', color: '#64748b' }}>-1=∞ 0=Off</span></div>
                        {plan.featureLimits && Object.keys(editingFeatureNames).map((key) => {
                          const val = plan.featureLimits[key] !== undefined ? plan.featureLimits[key] : 0;
                          return (
                            <div key={key} className="form-group" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 600, maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={editingFeatureNames[key]}>{editingFeatureNames[key]}</label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input type="number" value={val} onChange={(e) => { const u = { ...editingPlans }; if (!u[planId].featureLimits) u[planId].featureLimits = {}; u[planId].featureLimits[key] = parseInt(e.target.value) || 0; setEditingPlans(u); }} style={{ background: 'rgba(0,0,0,0.3)', padding: '4px 8px', width: '70px', textAlign: 'center' }} />
                                <span style={{ fontSize: '0.6rem', color: Number(val) === -1 ? '#22c55e' : Number(val) === 0 ? '#ef4444' : '#00f2fe', fontWeight: 700, minWidth: '50px' }}>{Number(val) === -1 ? '∞ Unlim' : Number(val) === 0 ? '✗ Off' : val + '/day'}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-glass)', marginTop: '10px', paddingTop: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Features List</span>
                          <button type="button" onClick={() => setShowFeaturePrompt(showFeaturePrompt === planId ? null : planId)} style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer' }}><Plus size={16} /></button>
                        </div>
                        {showFeaturePrompt === planId && (
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                            <input type="text" placeholder="e.g. Knowledge Graph Visualization" value={newFeatureInput} onChange={(e) => setNewFeatureInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddFeatureText(planId); }} style={{ padding: '6px 10px', fontSize: '0.75rem', flex: 1, background: 'rgba(0,0,0,0.4)', borderRadius: '6px', border: '1px solid var(--border-glass)', color: '#fff' }} />
                            <button type="button" className="btn" onClick={() => handleAddFeatureText(planId)} style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Add</button>
                          </div>
                        )}
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '300px', overflowY: 'auto' }}>
                          {plan.features?.map((f, idx) => (
                            <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.73rem', color: 'var(--text-muted)', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }} title={f}>✓ {f}</span>
                              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                {idx > 0 && <button type="button" onClick={() => { const u = { ...editingPlans }; const feats = [...u[planId].features]; [feats[idx-1], feats[idx]] = [feats[idx], feats[idx-1]]; u[planId].features = feats; setEditingPlans(u); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 2px', fontSize: '0.65rem' }} title="Move up">▲</button>}
                                {idx < (plan.features?.length || 0) - 1 && <button type="button" onClick={() => { const u = { ...editingPlans }; const feats = [...u[planId].features]; [feats[idx], feats[idx+1]] = [feats[idx+1], feats[idx]]; u[planId].features = feats; setEditingPlans(u); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 2px', fontSize: '0.65rem' }} title="Move down">▼</button>}
                                <button type="button" onClick={() => handleRemoveFeatureText(planId, idx)} style={{ background: 'none', border: 'none', color: '#ff5555', cursor: 'pointer', padding: '0 2px' }} title="Remove"><Trash2 size={12} /></button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <p style={{ fontSize: '0.6rem', color: '#475569', marginTop: '6px', marginBottom: 0 }}>{plan.features?.length || 0} features • Shown on Upgrade page</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: PENDING UPI APPROVALS */}
          {activeTab === 'approvals' && (
            <div className="admin-table-container glass-panel" style={{ padding: '25px', borderRadius: 'var(--radius-lg)' }}>
              <h3 className="admin-section-title" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem', marginBottom: '20px' }}>
                Pending UPI Payments Verification
              </h3>
              {stats.pendingApprovals.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '30px' }}>No UPI transactions submitted for verification yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>User Email</th>
                        <th>Requested Plan</th>
                        <th>Amount</th>
                        <th>UTR / Transaction ID</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.pendingApprovals.map((req) => (
                        <tr key={req.id}>
                          <td>{new Date(req.date).toLocaleString()}</td>
                          <td style={{ fontWeight: 600 }}>{req.email}</td>
                          <td>
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--accent-cyan)' }}>
                              {req.plan.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>₹{req.amount}</td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)', fontWeight: 600 }}>{req.transactionId}</td>
                          <td>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              background: req.status === 'pending' ? 'rgba(255, 165, 0, 0.1)' : req.status === 'approved' ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 51, 102, 0.1)', 
                              color: req.status === 'pending' ? 'orange' : req.status === 'approved' ? 'var(--accent-neon-green)' : '#ff3366' 
                            }}>
                              {req.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {req.status === 'pending' ? (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', minWidth: '200px' }}>
                                {Object.keys(editingPlans || {}).filter(k => k !== 'free').map((planKey) => {
                                  const planInfo = editingPlans[planKey];
                                  let btnBg = 'var(--accent-neon-green)';
                                  let btnColor = '#000';
                                  if (planKey === 'better') {
                                    btnBg = 'linear-gradient(135deg, #ffe259, #ffa751)';
                                  } else if (planKey === 'premium') {
                                    btnBg = 'linear-gradient(135deg, #ff3366, #ff6b9d)';
                                    btnColor = '#fff';
                                  }
                                  return (
                                    <button 
                                      key={planKey}
                                      className="btn" 
                                      onClick={() => handleApprovalAction(req.id, 'approve', planKey)}
                                      style={{ padding: '5px 8px', fontSize: '0.7rem', background: btnBg, color: btnColor, fontWeight: 700 }}
                                    >
                                      ₹{planInfo.price} {planInfo.name}
                                    </button>
                                  );
                                })}
                                <button 
                                  className="btn" 
                                  onClick={() => handleApprovalAction(req.id, 'reject')}
                                  style={{ padding: '5px 8px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', color: '#ff3366', border: '1px solid rgba(255,51,102,0.3)', fontWeight: 700 }}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Processed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SUPPORT CENTER QUERY LOGS */}
          {activeTab === 'queries' && (
            <div className="admin-table-container glass-panel" style={{ padding: '25px', borderRadius: 'var(--radius-lg)' }}>
              <h3 className="admin-section-title" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem', marginBottom: '20px' }}>
                User Queries & Support Tickets
              </h3>
              {stats.supportQueries.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '30px' }}>No queries submitted yet.</p>
              ) : (
                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Sender Email</th>
                      <th>Query Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.supportQueries.map((q) => (
                      <tr key={q.id}>
                        <td>{new Date(q.date).toLocaleString()}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{q.email}</td>
                        <td style={{ padding: '12px', fontSize: '0.9rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>{q.query}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 5: SECURITY THREAT AUDIT */}
          {activeTab === 'threats' && (
            <div className="glass-panel" style={{ padding: '30px', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', margin: 0 }}>
                    7-Day Website Cyber Threat Scan
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                    Queries Gemini model rotation credentials to run heuristics audits over system logs and suggest immediate solutions.
                  </p>
                </div>
                <button 
                  className="btn" 
                  onClick={handleRunThreatScan} 
                  disabled={threatScanLoading}
                  style={{ padding: '12px 24px', fontSize: '0.9rem' }}
                >
                  {threatScanLoading ? 'Scanning Codebase Logs...' : 'Execute AI Threat Audit'}
                </button>
              </div>

              {threatReport ? (
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-glass)', maxHeight: '60vh', overflowY: 'auto' }}>
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: '0.9rem', lineHeight: '1.6rem' }}>
                    {threatReport}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <ShieldAlert size={48} style={{ margin: '0 auto 15px', color: 'var(--text-muted)' }} />
                  <p>Execute audit scan to generate the predictive report.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: AI SELF-CODING AGENT */}
          {activeTab === 'selfcode' && (
            <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
              <div className="glass-panel" style={{ padding: '30px', borderRadius: 'var(--radius-lg)' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--accent-cyan)', marginBottom: '15px' }}>
                  AI Developer Agent (Self-Coding Engine)
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Describe a feature or code correction you want. The AI Dev-Agent will read the target file, write updated code, create a secure backup, verify compilation, and automatically deploy the edits.
                </p>

                {coderResult && (
                  <div style={{ color: 'var(--accent-neon-green)', background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.2)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px' }}>
                    <strong>Success:</strong> {coderResult}
                  </div>
                )}

                {coderError && (
                  <div style={{ color: '#ff3366', background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.2)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px', whiteSpace: 'pre-wrap' }}>
                    <strong>Build Error:</strong> {coderError}
                  </div>
                )}



                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Feature Prompt Description</label>
                  <textarea 
                    rows="5"
                    placeholder="e.g. Add a light bulb icon in Dashboard.jsx next to chat topics that optimizes prompts when clicked..."
                    value={coderPrompt}
                    onChange={(e) => setCoderPrompt(e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}
                  />
                </div>

                <button 
                  className="btn" 
                  onClick={handleTriggerSelfCode} 
                  disabled={coderLoading || !coderPrompt.trim()}
                  style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Cpu size={18} /> {coderLoading ? 'Running Compiler Diagnostics & Build Loop...' : 'Deploy Feature & Rebuild Code'}
                </button>
              </div>

              {/* Backups log */}
              <div className="glass-panel" style={{ padding: '25px', borderRadius: 'var(--radius-lg)', maxHeight: '70vh', overflowY: 'auto' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', marginBottom: '15px', color: 'var(--accent-cyan)' }}>
                  <Database size={16} /> Codebase Backups
                </h4>
                {stats.backups.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No backups created yet.</p>
                ) : (
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {stats.backups.map((b, i) => (
                      <li key={i} style={{ fontSize: '0.8rem', paddingBottom: '8px', borderBottom: '1px solid var(--border-glass)' }}>
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{b.filename}</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginTop: '4px' }}>
                          <span>Size: {Math.round(b.size / 1024)} KB</span>
                          <span>{new Date(b.date).toLocaleDateString()}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === 'payment' && (
            <div className="glass-panel" style={{ padding: '30px', borderRadius: 'var(--radius-lg)', maxWidth: '700px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--accent-cyan)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CreditCard size={22} /> Payment & UPI Settings
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '25px' }}>
                Configure the UPI ID where user payments will be credited. Upload a custom QR code or let the system auto-generate one.
              </p>

              {payMsg && (
                <div style={{ color: '#00f2fe', background: 'rgba(0,242,254,0.1)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px' }}>
                  {payMsg}
                </div>
              )}

              {/* UPI ID */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Receiver UPI ID</label>
                <input
                  type="text"
                  value={payUpiId}
                  onChange={(e) => setPayUpiId(e.target.value)}
                  placeholder="e.g. 6372843175@kotakbank"
                  style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '1rem', fontFamily: 'monospace' }}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>All user payments will go to this UPI ID</p>
              </div>

              {/* Receiver Name */}
              <div className="form-group" style={{ marginBottom: '25px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Receiver Name</label>
                <input
                  type="text"
                  value={payName}
                  onChange={(e) => setPayName(e.target.value)}
                  placeholder="e.g. Prakhar Mishra"
                  style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', border: '1px solid var(--border-glass)' }}
                />
              </div>

              {/* Save UPI Settings */}
              <button
                className="btn"
                onClick={handleSavePaymentSettings}
                disabled={payLoading}
                style={{ width: '100%', padding: '14px', fontSize: '1rem', marginBottom: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Save size={18} /> {payLoading ? 'Saving...' : 'Save UPI Settings'}
              </button>

            </div>
          )}

        </>
      )}
    </div>
  );
}

export default Admin;
