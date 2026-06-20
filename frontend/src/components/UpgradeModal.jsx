import React, { useState, useEffect } from 'react';
import { X, Check, Award, Flame, Zap, Copy, Loader, CheckCircle, AlertCircle } from 'lucide-react';

function UpgradeModal({ email, currentPlan, onClose, onPaymentSuccess, preFetchedPlans, preFetchedFeatureNames, preFetchedReceiverUpiId, preFetchedReceiverName, preFetchedRazorpayKeyId, preFetchedGoogleClientId, needsLogin, onLoginSuccess }) {
  // Track internal email state (updates when anonymous user signs in)
  const [internalEmail, setInternalEmail] = useState(email);
  const [loginStep, setLoginStep] = useState(needsLogin && !email);
  const [googleReady, setGoogleReady] = useState(false);
  // NO hardcoded prices — all prices come from the server (admin-configured)
  const iconsMap = {
    standard: <Zap size={32} color="#4facfe" />,
    better: <Award size={32} color="#ffe259" />,
    premium: <Flame size={32} color="#ff3366" />,
    free: <Zap size={32} color="#94a3b8" />
  };

  const [dbPlans, setDbPlans] = useState([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [featureNames, setFeatureNames] = useState({});
  const [utrInput, setUtrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedManualPlan, setSelectedManualPlan] = useState('standard'); // standard, better, premium
  const [receiverUpiId, setReceiverUpiId] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [hasCustomQR, setHasCustomQR] = useState(null); // null = loading, true/false = resolved

  // Detect mobile
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Fetch plans from DB — this is the ONLY source of truth for prices
  useEffect(() => {
    if (preFetchedPlans && preFetchedPlans.length > 0) {
      setDbPlans(preFetchedPlans);
      if (preFetchedFeatureNames) {
        setFeatureNames(preFetchedFeatureNames);
      }
      setPlansLoaded(true);
      if (preFetchedReceiverUpiId) setReceiverUpiId(preFetchedReceiverUpiId);
      if (preFetchedReceiverName) setReceiverName(preFetchedReceiverName);
    } else {
      const fetchPlans = async () => {
        try {
          const res = await fetch('/api/plans');
          const data = await res.json();
          if (data.plans) {
            const arr = Object.values(data.plans);
            if (arr.length > 0) setDbPlans(arr);
          }
          if (data.featureNames) {
            setFeatureNames(data.featureNames);
          }
          if (data.receiverUpiId) setReceiverUpiId(data.receiverUpiId);
          if (data.receiverName) setReceiverName(data.receiverName);
        } catch (err) {
          console.error('Failed to fetch plans', err);
        } finally {
          setPlansLoaded(true);
        }
      };
      fetchPlans();
    }

    // Check if custom QR exists
    fetch('/api/payment-qr', { method: 'HEAD' })
      .then(res => setHasCustomQR(res.ok))
      .catch(() => setHasCustomQR(false));
      
    // Load Razorpay Script dynamically
    const loadRazorpay = () => {
      if (!document.getElementById('rzp-script')) {
        const script = document.createElement('script');
        script.id = 'rzp-script';
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
      }
    };
    loadRazorpay();
  }, [preFetchedPlans, preFetchedFeatureNames, preFetchedReceiverUpiId, preFetchedReceiverName]);

  // Initialize Google Sign-In for login step (anonymous users upgrading)
  useEffect(() => {
    if (!loginStep) return;
    const clientId = preFetchedGoogleClientId;
    if (!clientId) return;

    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            try {
              const payload = JSON.parse(atob(response.credential.split('.')[1]));
              const userEmail = payload.email;
              setInternalEmail(userEmail);
              setLoginStep(false);
              // Register user on backend
              fetch('/api/user/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail, action: 'login' })
              }).catch(() => {});
              // Notify parent
              if (onLoginSuccess) onLoginSuccess(userEmail);
            } catch (e) {
              setError('Google sign-in failed. Please try again.');
            }
          }
        });
        const btnContainer = document.getElementById('upgrade-google-btn');
        if (btnContainer) {
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'filled_black',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: 300
          });
        }
        setGoogleReady(true);
      }
    };

    // Wait for GSI script
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGoogle();
        clearInterval(interval);
      }
    }, 200);
    const timeout = setTimeout(() => clearInterval(interval), 8000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [loginStep, preFetchedGoogleClientId]);

  // Use internalEmail throughout (falls back to prop email)
  const activeEmail = internalEmail || email;

  const handleRazorpayCheckout = async (plan) => {
    setLoading(true);
    setError('');
    
    // Check if Razorpay script loaded
    if (typeof window === 'undefined' || !window.Razorpay) {
      setError('Payment gateway failed to load. Please try again or use Manual UPI.');
      setLoading(false);
      return;
    }

    try {
      // Create Order on Backend
      const orderRes = await fetch('/api/payment/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, amountINR: plan.price, email: activeEmail })
      });
      
      const orderData = await orderRes.json();
      
      if (!orderRes.ok || !orderData.order) {
        // Fallback triggered: Razorpay keys likely not set in Admin
        setError('Automated checkout is currently unavailable. Please use the Manual UPI method below.');
        setLoading(false);
        return;
      }

      // Use pre-fetched Razorpay key or fetch it dynamically
      let keyId = preFetchedRazorpayKeyId;
      if (!keyId) {
        const configRes = await fetch('/api/config/public');
        const configData = await configRes.json();
        keyId = configData.razorpayKeyId;
      }
      if (!keyId) {
        throw new Error('Missing Razorpay public key');
      }

      // Initialize Razorpay Options
      const options = {
        key: keyId,
        order_id: orderData.order.id,
        name: "MatrixMind Advanced AI",
        description: `Upgrade to ${plan.name} Plan`,
        image: "https://cdn-icons-png.flaticon.com/512/2111/2111432.png",
        handler: async function (response) {
          // Payment successful on Razorpay's end — now verify server-side and auto-unlock
          setSuccess(`Payment received! Verifying and unlocking your ${plan.name} plan...`);
          try {
            const verifyRes = await fetch('/api/payment/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                email: activeEmail,
                planId: plan.id
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setSuccess(`🎉 Thank you for choosing our ${plan.name.toUpperCase()} plan! Your plan is now active. Enjoy your new features!`);
              setTimeout(() => {
                if (onPaymentSuccess) onPaymentSuccess();
              }, 3000);
            } else {
              setSuccess(`Payment received! Your plan will be activated shortly. If not activated within 5 minutes, please contact support.`);
              // The polling loop will still catch it if webhook fires later
            }
          } catch (verifyErr) {
            console.error('Verification call failed:', verifyErr);
            setSuccess(`Payment received! Your plan will be activated automatically within a few minutes.`);
          }
        },
        prefill: {
          email: activeEmail || "",
        },
        notes: {
          email: activeEmail || "",
          planId: plan.id,
          durationDays: plan.days || 30
        },
        theme: {
          color: "#00f2fe"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response){
        setError(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
      
    } catch (err) {
      console.error('Razorpay Error:', err);
      setError('Checkout failed to initialize. Please use Manual UPI below.');
    } finally {
      setLoading(false);
    }
  };


  // Fetch public config for UPI ID
  useEffect(() => {
    if (preFetchedReceiverUpiId && preFetchedReceiverName) {
      setReceiverUpiId(preFetchedReceiverUpiId);
      setReceiverName(preFetchedReceiverName);
    } else {
      const fetchConfig = async () => {
        try {
          const res = await fetch('/api/config/public');
          if (res.ok) {
            const data = await res.json();
            if (data.receiverUpiId) setReceiverUpiId(data.receiverUpiId);
            if (data.receiverName) setReceiverName(data.receiverName);
          }
        } catch (e) {
          console.warn('Failed to fetch public config:', e);
        }
      };
      fetchConfig();
    }
  }, [preFetchedReceiverUpiId, preFetchedReceiverName]);

  // Check if admin uploaded a custom QR
  useEffect(() => {
    const checkQR = async () => {
      try {
        const res = await fetch('/api/payment-qr', { method: 'HEAD' });
        setHasCustomQR(res.ok);
      } catch {
        setHasCustomQR(false);
      }
    };
    checkQR();
  }, []);

  // Polling loop to check if plan is unlocked in background via webhook or manual UTR approval
  useEffect(() => {
    let interval;
    if (activeEmail) {
      const initialPlan = currentPlan || 'free';
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/user/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: activeEmail })
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.plan && data.plan !== initialPlan) {
              setSuccess(`🎉 Thank you for choosing our ${data.plan.toUpperCase()} plan! Hope you will enjoy your new features!`);
              clearInterval(interval);
              setTimeout(() => {
                if (onPaymentSuccess) onPaymentSuccess();
              }, 3500);
            }
          }
        } catch (e) {
          console.warn('Background check for plan upgrade failed:', e);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentPlan, activeEmail, onPaymentSuccess]);

  // Copy UPI ID
  const handleCopyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(manualUpiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = manualUpiId;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Submit UTR for admin verification
  const handleSubmitUtr = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (utrInput.length !== 12) {
      setError('Please enter a valid 12-digit UTR number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/payment/submit-utr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: activeEmail, utr: utrInput, planRequested: selectedManualPlan })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess('Your UTR has been submitted! Your plan will be activated once admin verifies your payment.');
      } else {
        setError(data.error || 'Failed to submit UTR. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error while submitting UTR.');
    } finally {
      setLoading(false);
    }
  };

  const manualUpiId = receiverUpiId || '6372843175@kotakbank';
  const manualUpiName = receiverName || 'Prakhar Mishra';
  const activePlanObj = dbPlans.find(p => p.id === selectedManualPlan) || dbPlans.find(p => p.id !== 'free') || { price: 0, name: 'Loading...' };
  const manualAmount = activePlanObj.price;
  const manualName = activePlanObj.name;

  // Dynamically generate UPI link based on whether it is a Razorpay merchant VPA or personal VPA
  let manualUpiLink = '';
  if (manualUpiId.includes('.rzp@')) {
    // Razorpay merchant VPA: use merchant parameters
    manualUpiLink = `upi://pay?cu=INR&mc=5817&mode=19&pa=${manualUpiId}&tn=PaymentToPrakharMishra&tr=T3XH5bgAIiHCyQqrv2&am=${manualAmount}`;
  } else {
    // Personal UPI VPA: use clean standard NPCI P2P parameters to prevent "cannot pay by this method" errors
    const payeeName = encodeURIComponent(manualUpiName);
    const note = encodeURIComponent(`Payment for ${manualName} Plan`);
    manualUpiLink = `upi://pay?pa=${manualUpiId}&pn=${payeeName}&am=${manualAmount}&cu=INR&tn=${note}`;
  }
  const manualQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(manualUpiLink)}`;
  const upiIntentUrl = manualUpiLink;

  return (
    <div className="modal-overlay">
      <div className="modal-card glass-panel" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={24} />
        </button>

        <h2 className="plans-title">Upgrade Your Plan</h2>

        {/* Step-by-step instructions for new users */}
        <div style={{ background: 'rgba(0, 242, 254, 0.04)', border: '1px solid rgba(0, 242, 254, 0.15)', borderRadius: '12px', padding: '16px 20px', marginBottom: '22px' }}>
          <h4 style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📋 How to Purchase a Plan
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#00f2fe', fontWeight: 700, minWidth: '20px' }}>1.</span>
              <span>{loginStep ? <strong style={{ color: '#ffd740' }}>Sign in with your Google account below ↓</strong> : <span style={{ color: '#00e676' }}>✅ Signed in as <strong>{activeEmail}</strong></span>}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#00f2fe', fontWeight: 700, minWidth: '20px' }}>2.</span>
              <span>Choose a plan that suits your needs</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#00f2fe', fontWeight: 700, minWidth: '20px' }}>3.</span>
              <span>Complete payment via Razorpay or UPI</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#00f2fe', fontWeight: 700, minWidth: '20px' }}>4.</span>
              <span>Plan unlocks <strong>instantly</strong> on your email across all devices</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#00f2fe', fontWeight: 700, minWidth: '20px' }}>5.</span>
              <span>Plan <strong>auto-expires</strong> on the date shown — no manual cancellation needed</span>
            </div>
          </div>
        </div>

        {/* LOGIN STEP — for anonymous users who need to sign in first */}
        {loginStep && (
          <div style={{ textAlign: 'center', padding: '30px 20px', marginBottom: '20px', background: 'rgba(255,215,64,0.05)', border: '1px solid rgba(255,215,64,0.2)', borderRadius: '14px' }}>
            <h3 style={{ color: '#ffd740', fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
              🔐 Sign In to Continue
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              To purchase a plan, please sign in with your Google account. The plan will be linked to your email.
            </p>
            
            {/* Google Sign-In Button Container */}
            <div id="upgrade-google-btn" style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}></div>
            
            {!googleReady && !preFetchedGoogleClientId && (
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '10px' }}>
                Google Sign-In is not configured. Please contact the admin.
              </p>
            )}
            
            {!googleReady && preFetchedGoogleClientId && (
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '10px' }}>
                <Loader size={14} className="spin" style={{ display: 'inline', marginRight: '6px' }} />
                Loading Google Sign-In...
              </p>
            )}
          </div>
        )}

        {/* Error / Success messages */}
        {error && (
          <div style={{ color: '#ff3366', background: 'rgba(255,51,102,0.1)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {success && (
          <div style={{ color: '#00f2fe', background: 'rgba(0,242,254,0.1)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <CheckCircle size={18} />
            {success}
          </div>
        )}

        {/* ===== PLAN CARDS (View Only) ===== */}
        {!plansLoaded ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', gap: '12px', color: '#94a3b8' }}>
            <Loader size={24} className="spin" /> Loading plans...
          </div>
        ) : dbPlans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No plans available. Please contact admin.</div>
        ) : (
        <div className="plans-grid">
          {dbPlans.map((plan) => {
            const isActive = currentPlan === plan.id;
            const isPopular = plan.popular;
            return (
              <div
                key={plan.id}
                className={`plan-card glass-panel ${isPopular ? 'popular' : ''}`}
                style={{
                  cursor: 'default',
                  border: isActive ? '2px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                  boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {isPopular && <span className="plan-badge">Most Popular</span>}
                <div style={{ marginBottom: '15px' }}>{iconsMap[plan.id] || <Zap size={32} color="#4facfe" />}</div>
                <h3 className="plan-name">{plan.name}</h3>

                <div className="plan-price-row">
                  <span className="plan-price">₹{plan.price}</span>
                  <span className="plan-duration">/ {plan.duration || 'Month'}</span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {plan.efficiency || (plan.id === 'premium' ? 'Maximum Response Rate' : 'High Response Rate')}
                </div>

                <ul className="plan-features">
                  {/* Show all features exactly as saved by admin */}
                  {(plan.features || []).map((feature, idx) => (
                    <li key={idx}>
                      <Check size={16} color="var(--accent-cyan)" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isActive && (
                  <div style={{
                    marginTop: 'auto',
                    padding: '8px 16px',
                    background: 'rgba(0, 242, 254, 0.1)',
                    border: '1px solid var(--accent-cyan)',
                    borderRadius: '8px',
                    color: 'var(--accent-cyan)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    ✓ Active
                  </div>
                )}

                {!isActive && plan.price > 0 && (
                  <button 
                    onClick={() => loginStep ? null : handleRazorpayCheckout(plan)}
                    disabled={loading || loginStep}
                    style={{
                      marginTop: 'auto',
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                  >
                    {loading ? <Loader size={16} className="spin-animation" /> : loginStep ? '🔐 Sign In First' : '💳 Auto Unlock Plan'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        )}

        {/* ===== PAYMENT SECTION (MANUAL FALLBACK) ===== */}
        {!success && (
          <div className="glass-panel" style={{ marginTop: '30px', padding: '25px', width: '100%', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-cyan)', fontSize: '1.25rem', marginBottom: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
              Direct UPI / QR Code Payment
            </h3>
            <p style={{textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px'}}>
              You can pay through the UPI ID or scan the QR code directly to pay. Select a plan to update the QR code:
            </p>

            {/* Plan selector pills */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
              {dbPlans.filter(p => p.id !== 'free').map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedManualPlan(p.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '1px solid ' + (selectedManualPlan === p.id ? 'var(--accent-cyan)' : 'var(--border-glass)'),
                    background: selectedManualPlan === p.id ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255,255,255,0.05)',
                    color: selectedManualPlan === p.id ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {p.name} (₹{p.price})
                </button>
              ))}
            </div>

            {/* QR Code Container */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '20px 0' }}>
              <div style={{
                position: 'relative',
                width: '260px',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,242,254,0.15)',
                border: '2px solid rgba(0, 242, 254, 0.3)',
                background: '#0a0b10'
              }}>
                {/* Background static Razorpay QR card image */}
                <img 
                  src="/razorpay_qr.jpg" 
                  alt="Razorpay Payment Card"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
                
                {/* Dynamically generated overlay QR code centered exactly over the static QR code */}
                <div style={{
                  position: 'absolute',
                  left: '21.7%',
                  top: '40.0%',
                  width: '56.3%',
                  aspectRatio: '1 / 1',
                  background: '#fff',
                  padding: '2.5%',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img
                    src={manualQrUrl}
                    alt={`Scan QR code to pay ₹${manualAmount}`}
                    style={{ width: '100%', height: '100%', display: 'block' }}
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#ffe259', fontWeight: 600, marginTop: '12px', textAlign: 'center' }}>
                Scan to pay ₹{manualAmount} for {manualName} Plan
              </p>
            </div>

            {/* UPI ID display + Copy */}
            <div style={{ textAlign: 'center', margin: '15px 0', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px dashed var(--border-glass-glow)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                UPI ID — Copy or Pay to
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <p style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)', fontWeight: 800, fontFamily: 'monospace', margin: 0 }}>
                  {manualUpiId}
                </p>
                <button
                  type="button"
                  onClick={handleCopyUpiId}
                  style={{ background: 'none', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '4px 8px', color: copied ? '#00f2fe' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                >
                  <Copy size={14} />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Receiver: {manualUpiName}
              </p>
            </div>

            {/* Mobile: Pay via UPI App button */}
            {isMobile && (
              <a
                href={upiIntentUrl}
                className="btn"
                style={{
                  width: '100%', padding: '16px', fontSize: '1.05rem', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  textDecoration: 'none', color: 'inherit', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)',
                  borderRadius: '8px', fontWeight: 'bold'
                }}
              >
                💳 Open UPI App to Pay ₹{manualAmount}
              </a>
            )}

            {/* Instructions */}
            <div style={{ padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: '8px' }}>📋 How to complete payment:</p>
              <ol style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.8, margin: 0, paddingLeft: '16px' }}>
                <li>Select your desired subscription plan above (Basic, Pro, or Ultimate).</li>
                <li>Scan the generated QR code directly using your UPI app (GPay, PhonePe, Paytm, BHIM, etc.), or copy and enter the UPI ID: <strong style={{ color: 'var(--accent-cyan)' }}>{manualUpiId}</strong></li>
                <li>Pay the exact amount of <strong style={{ color: 'var(--accent-cyan)' }}>₹{manualAmount}</strong> corresponding to your chosen plan.</li>
                <li>Note the <strong style={{ color: '#ffe259' }}>12-digit UTR/Reference number</strong> from the payment confirmation.</li>
                <li>Enter the UTR number in the field below and submit to unlock your features instantly.</li>
              </ol>
            </div>

            {/* UTR Input + Submit */}
            <form onSubmit={handleSubmitUtr}>
              <div style={{ padding: '20px', background: 'rgba(0,242,254,0.05)', borderRadius: '12px', border: '1px solid rgba(0,242,254,0.2)' }}>
                <p style={{ fontSize: '0.9rem', color: '#ffe259', fontWeight: 700, textAlign: 'center', marginBottom: '15px' }}>
                  ⚠️ Enter the 12-digit UTR number from your payment receipt
                </p>

                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <input
                    type="text"
                    placeholder="Enter 12-digit UTR number"
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    required
                    maxLength="12"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      color: 'var(--text-main)',
                      border: '2px solid var(--accent-cyan)',
                      fontSize: '1.3rem',
                      fontFamily: 'monospace',
                      letterSpacing: '0.2em',
                      textAlign: 'center',
                      padding: '14px'
                    }}
                  />
                  <p style={{ fontSize: '0.75rem', color: utrInput.length === 12 ? '#00f2fe' : 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
                    {utrInput.length}/12 digits entered {utrInput.length === 12 ? '✅' : ''}
                  </p>
                </div>

                <button
                  type="submit"
                  className="btn"
                  style={{ width: '100%', padding: '16px', fontSize: '1.05rem' }}
                  disabled={loading || utrInput.length !== 12}
                >
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <Loader size={20} className="spin-animation" />
                      Submitting...
                    </span>
                  ) : (
                    '📤 Submit for Verification'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===== SUCCESS STATE ===== */}
        {success && (
          <div className="glass-panel" style={{ marginTop: '30px', padding: '40px', width: '100%', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
            <CheckCircle size={64} color="#00f2fe" style={{ marginBottom: '20px' }} />
            <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-cyan)', fontSize: '1.5rem', marginBottom: '15px', fontWeight: 700 }}>
              UTR Submitted!
            </h3>
            <p style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '10px' }}>
              {success}
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              You will be notified once the admin verifies your payment.
            </p>
          </div>
        )}
      </div>

      {/* Spinner animation style */}
      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default UpgradeModal;
