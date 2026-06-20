import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, X, Plus, Search, Trash2, Send, Mic, Paperclip, 
  Camera, FileText, Image, Download, RotateCcw, ShieldCheck, 
  BrainCircuit, LayoutGrid, Terminal, HelpCircle, Check, Info, LogOut, Shield, Users, Cpu, Play, Loader2, Code, MonitorPlay, Share2, Orbit
} from 'lucide-react';
import mermaid from 'mermaid';
import CouncilRoom from './CouncilRoom';
import WorkflowPanel from './WorkflowPanel';


const MindMap3D = React.lazy(() => import('./MindMap3D'));
const Interactive3DObject = React.lazy(() => import('./Interactive3DObject'));

// Initialize Mermaid.js configuration
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    themeVariables: {
      background: '#0c152b',
      primaryColor: '#00f2fe',
      primaryTextColor: '#f1f5f9',
      lineColor: '#4facfe'
    }
  });
} catch (e) {
  console.error('Mermaid init error:', e);
}

// Mermaid Chart Renderer Component
function MermaidChart({ chartCode, defaultTo3D = false }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState(defaultTo3D ? '3d' : '2d'); // '2d' or '3d'
  const elementId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    setViewMode(defaultTo3D ? '3d' : '2d');
  }, [chartCode, defaultTo3D]);

  useEffect(() => {
    const renderChart = async () => {
      try {
        setError(false);
        // Clear any previous graphs
        const { svg: renderedSvg } = await mermaid.render(elementId, chartCode);
        setSvg(renderedSvg);
      } catch (err) {
        console.error('Mermaid render failure:', err);
        setError(true);
        // Clean up elements that mermaid leaves on error
        const badElement = document.getElementById(elementId);
        if (badElement) badElement.remove();
      }
    };
    renderChart();
  }, [chartCode]);

  if (error) {
    return (
      <pre style={{ background: 'rgba(255, 51, 102, 0.1)', border: '1px solid rgba(255, 51, 102, 0.3)', padding: '10px' }}>
        <code>{chartCode}</code>
      </pre>
    );
  }

  return (
    <div className="mermaid-chart-card glass-panel" style={{ margin: '15px 0', padding: '15px', borderRadius: '12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', width: '100%' }}>
      {/* Toggle headers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-cyan)', fontFamily: 'var(--font-heading)' }}>
          📊 Interactive Visualization
        </span>
        <div style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
          <button 
            onClick={() => setViewMode('2d')}
            style={{
              background: viewMode === '2d' ? 'var(--bg-glass-active)' : 'transparent',
              color: viewMode === '2d' ? 'var(--text-main)' : 'var(--text-muted)',
              border: 'none',
              padding: '4px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'var(--transition-smooth)'
            }}
          >
            2D View
          </button>
          <button 
            onClick={() => setViewMode('3d')}
            style={{
              background: viewMode === '3d' ? 'var(--bg-glass-active)' : 'transparent',
              color: viewMode === '3d' ? 'var(--text-main)' : 'var(--text-muted)',
              border: 'none',
              padding: '4px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'var(--transition-smooth)'
            }}
          >
            3D Mind Map
          </button>
        </div>
      </div>

      {viewMode === '2d' ? (
        <div 
          className="mermaid-graph-container" 
          style={{ padding: '10px', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}
          dangerouslySetInnerHTML={{ __html: svg }} 
        />
      ) : (
        <React.Suspense fallback={<div style={{ padding: '20px', color: 'var(--accent-cyan)', textAlign: 'center', fontFamily: 'var(--font-heading)' }}>Loading 3D Mind Map...</div>}>
          <MindMap3D chartCode={chartCode} />
        </React.Suspense>
      )}
    </div>
  );
}

const themeOptions = [
  { value: 'supernova-blast', label: 'Supernova Blast', color: '#ff007f', bg: '#050207' },
  { value: 'solar-eruption', label: 'Solar Eruption', color: '#ff4e50', bg: '#070200' },
  { value: 'quasar-jet', label: 'Quasar Jet', color: '#00f2fe', bg: '#02040c' },
  { value: 'nebula-tempest', label: 'Nebula Tempest', color: '#da22ff', bg: '#07020a' },
  { value: 'hyperdrive-warp', label: 'Hyperdrive Warp', color: '#00c6ff', bg: '#010206' },
  { value: 'meteor-shower', label: 'Meteor Shower', color: '#38ef7d', bg: '#010403' },
  { value: 'blackhole-vortex', label: 'Black Hole Vortex', color: '#f12711', bg: '#050101' },
  { value: 'gammaray-burst', label: 'Gamma Ray Burst', color: '#a8c0ff', bg: '#030208' },
  { value: 'asteroid-storm', label: 'Asteroid Storm', color: '#f6d365', bg: '#050402' },
  { value: 'cosmic-collision', label: 'Cosmic Collision', color: '#e0e0e0', bg: '#010305' }
];

function Dashboard({ 
  currentUser, 
  deviceId,
  userPlanDetails, 
  refreshUserStatus, 
  onLogout, 
  onLogin,
  theme, 
  setTheme, 
  onTriggerUpgrade,
  onShowAdmin,
  onShowHelp
}) {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [conversations, setConversations] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  
  // Search bar for filtering chats
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);



  // Prompt states
  const [promptInput, setPromptInput] = useState('');
  const [personality, setPersonality] = useState('standard'); // 'standard', 'architect', 'analyst'
  const [mode, setMode] = useState('normal'); // 'normal', 'matrix_simulation', 'optimize', 'generate'
  const [loading, setLoading] = useState(false);
  const [livePreviewApp, setLivePreviewApp] = useState(null);

  // App Credentials State for Generate Mode
  const [showCredentials, setShowCredentials] = useState(false);
  const [appCredentials, setAppCredentials] = useState(() => {
    try {
      const saved = localStorage.getItem('appCredentials');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const handleAddCredentialRow = () => {
    setAppCredentials([...appCredentials, { name: '', value: '' }]);
  };

  const handleCredentialChange = (index, field, val) => {
    const updated = [...appCredentials];
    updated[index][field] = val;
    setAppCredentials(updated);
  };

  const handleRemoveCredentialRow = (index) => {
    const updated = [...appCredentials];
    updated.splice(index, 1);
    setAppCredentials(updated);
  };

  const handleSaveCredentials = () => {
    localStorage.setItem('appCredentials', JSON.stringify(appCredentials));
    alert('Credentials saved securely to your local browser storage.');
  };
  const handleShareApp = async (htmlContent) => {
    try {
      const res = await fetch('/api/apps/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlCode: htmlContent })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const fullUrl = window.location.origin + data.url;
        navigator.clipboard.writeText(fullUrl);
        alert(`App hosted locally!\nLink: ${fullUrl}\n(Copied to clipboard)`);
      } else {
        alert('Failed to host app: ' + data.error);
      }
    } catch (err) {
      alert('Error hosting app locally.');
    }
  };

  // Anonymize Input feature
  const [anonymizeEnabled, setAnonymizeEnabled] = useState(false);
  const anonymizeMapRef = useRef({});

  // Council Room state (desktop only)
  const [councilMode, setCouncilMode] = useState(false);
  const [councilPrompt, setCouncilPrompt] = useState('');
  const isDesktop = typeof window !== 'undefined' && window.innerWidth > 1024;

  // Interview Mode state



  const handleCallCouncil = () => {
    if (!promptInput.trim()) return;
    setCouncilPrompt(promptInput);
    setCouncilMode(true);
  };

  const handleCouncilConsensus = (consensusText) => {
    // Inject consensus result into the active chat as a bot message
    const currentChat = conversations.find(c => c.id === activeChatId);
    if (!currentChat) return;

    const councilMsg = {
      id: 'msg_council_' + Date.now(),
      sender: 'bot',
      text: `🏛️ **Council Room — Consensus Decision**\n\n${consensusText}`,
      timestamp: new Date().toISOString()
    };

    const updated = conversations.map(c => {
      if (c.id === activeChatId) return { ...c, messages: [...c.messages, councilMsg] };
      return c;
    });
    saveChatsToLocal(updated);
    setPromptInput('');
  };

  // Workflow Sequencer states
  const [workflowMode, setWorkflowMode] = useState(false);
  const [workflowGoal, setWorkflowGoal] = useState('');

  const handleCallWorkflow = () => {
    if (!promptInput.trim()) return;
    setWorkflowGoal(promptInput);
    setWorkflowMode(true);
  };

  const handleWorkflowComplete = (finalReport) => {
    const currentChat = conversations.find(c => c.id === activeChatId);
    if (!currentChat) return;

    const workflowMsg = {
      id: 'msg_workflow_' + Date.now(),
      sender: 'bot',
      text: `⚙️ **Workflow Execution — Final Report**\n\n${finalReport}`,
      timestamp: new Date().toISOString()
    };

    const updated = conversations.map(c => {
      if (c.id === activeChatId) return { ...c, messages: [...c.messages, workflowMsg] };
      return c;
    });
    saveChatsToLocal(updated);
    setPromptInput('');
  };

  // Anonymize: scan text and replace sensitive data with labels
  const anonymizeText = (text) => {
    const map = {};
    let counter = { email: 0, phone: 0, apikey: 0, ip: 0, upi: 0, name: 0 };
    let result = text;

    // Emails
    result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => {
      counter.email++;
      const label = `[REDACTED_EMAIL_${counter.email}]`;
      map[label] = match;
      return label;
    });

    // Phone numbers (Indian & international formats)
    result = result.replace(/(\+?\d{1,4}[\s-]?)?(\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{3,5}/g, (match) => {
      if (match.replace(/[\s\-()]/g, '').length >= 10) {
        counter.phone++;
        const label = `[REDACTED_PHONE_${counter.phone}]`;
        map[label] = match;
        return label;
      }
      return match;
    });

    // API keys / tokens (long alphanumeric strings 20+ chars)
    result = result.replace(/\b[A-Za-z0-9_\-]{20,}\b/g, (match) => {
      // Skip if it looks like a normal word or URL path
      if (/^[a-z]+$/i.test(match)) return match;
      if (match.length < 24) return match;
      counter.apikey++;
      const label = `[REDACTED_KEY_${counter.apikey}]`;
      map[label] = match;
      return label;
    });

    // IP addresses
    result = result.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, (match) => {
      counter.ip++;
      const label = `[REDACTED_IP_${counter.ip}]`;
      map[label] = match;
      return label;
    });

    // UPI IDs
    result = result.replace(/[a-zA-Z0-9._%+-]+@[a-z]{2,}bank\b/gi, (match) => {
      counter.upi++;
      const label = `[REDACTED_UPI_${counter.upi}]`;
      map[label] = match;
      return label;
    });

    return { anonymized: result, map };
  };

  // De-anonymize: replace labels back with original values
  const deanonymizeText = (text, map) => {
    let result = text;
    for (const [label, original] of Object.entries(map)) {
      result = result.split(label).join(original);
    }
    return result;
  };

  // Attachment states
  const [attachment, setAttachment] = useState(null); // { name: '', mimeType: '', base64: '' }
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  
  // Camera capture modal state
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // Bottom scroll Ref
  const messagesEndRef = useRef(null);

  // 1. Fetch Local Chat History on Mount
  useEffect(() => {
    const savedChats = localStorage.getItem(`chats_${currentUser?.email || deviceId}`);
    if (savedChats) {
      try {
        const parsed = JSON.parse(savedChats);
        setConversations(parsed);
        if (parsed.length > 0) {
          setActiveChatId(parsed[0].id);
        }
      } catch (e) {
        console.error('Corrupted chat history, resetting:', e);
        localStorage.removeItem(`chats_${currentUser?.email || deviceId}`);
      }
    } else {
      // Start a welcome conversation automatically
      const welcomeMessage = { id: Date.now(), sender: 'model', text: 'Welcome to MatrixMind! How can I assist you today?' };
      const initialChat = {
        id: 'chat_' + Date.now(),
        title: 'New Conversation Topic',
        messages: [welcomeMessage],
        personality: 'standard',
        created_at: new Date().toISOString()
      };
      setConversations([initialChat]);
      setActiveChatId(initialChat.id);
      localStorage.setItem(`chats_${currentUser?.email || deviceId}`, JSON.stringify([initialChat]));
    }
  }, [currentUser?.email, deviceId]);

  // Sync scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeChatId]);

  // 2. Local Chat CRUD Operations
  const saveChatsToLocal = (updatedChats) => {
    setConversations(updatedChats);
    localStorage.setItem(`chats_${currentUser?.email || deviceId}`, JSON.stringify(updatedChats));
  };

  const handleCreateChat = () => {
    const welcomeMessage = { id: Date.now(), sender: 'model', text: 'Welcome to MatrixMind! How can I assist you today?' };
    const newChat = {
      id: 'chat_' + Date.now(),
      title: 'New Conversation',
      messages: [welcomeMessage],
      personality: personality,
      created_at: new Date().toISOString()
    };
    const updated = [newChat, ...conversations];
    saveChatsToLocal(updated);
    setActiveChatId(newChat.id);

  };

  const handleDeleteChat = (id, e) => {
    e.stopPropagation();
    if (conversations.length <= 1) return; // Prevent deleting the only chat

    const updated = conversations.filter(c => c.id !== id);
    saveChatsToLocal(updated);
    
    if (activeChatId === id) {
      setActiveChatId(updated[0].id);
    }
  };

  const handleEraseChatMemory = () => {
    if (!activeChatId) return;
    const confirmErase = window.confirm('Are you sure you want to clear the memory of this chat? This will remove all previous context.');
    if (!confirmErase) return;

    const updated = conversations.map(c => {
      if (c.id === activeChatId) {
        return { ...c, messages: [] };
      }
      return c;
    });
    saveChatsToLocal(updated);
  };

  const handleDownloadChat = () => {
    const activeChat = conversations.find(c => c.id === activeChatId);
    if (!activeChat || activeChat.messages.length === 0) return;

    let docContent = `Chat Title: ${activeChat.title}\nDate: ${new Date(activeChat.created_at).toLocaleDateString()}\n`;
    docContent += `Personality Profile: ${activeChat.personality.toUpperCase()}\n`;
    docContent += `=========================================\n\n`;

    activeChat.messages.forEach((m, idx) => {
      const senderName = m.sender === 'user' ? 'USER' : 'MATRIXMIND BOT';
      docContent += `[${senderName}] - ${new Date(m.timestamp || Date.now()).toLocaleTimeString()}\n`;
      docContent += `${m.text}\n\n`;
    });

    const blob = new Blob([docContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeChat.title.replace(/\s+/g, '_')}_chat_history.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 3. VOICE SPEECH TRANSCRIPTION ENGINE
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US'; // standard fallback, works nicely with Hinglish in modern Chromium browsers

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setPromptInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsRecording(false);
      };

      rec.onerror = (e) => {
        console.error('Voice recognition error:', e);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported on your browser. Please use Chrome or Safari.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  // 4. ATTACHMENTS (Camera capture & File Browse)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setShowAttachmentMenu(false);
    const reader = new FileReader();

    if (file.type.startsWith('image/')) {
      reader.onloadend = () => {
        setAttachment({
          name: file.name,
          mimeType: file.type,
          base64: reader.result
        });
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'text/plain' || file.type === 'application/pdf') {
      // For documents, we convert text or attach details
      reader.onloadend = () => {
        setAttachment({
          name: file.name,
          mimeType: file.type,
          base64: reader.result // Encode full base64 or pass content
        });
      };
      reader.readAsDataURL(file);
    } else {
      alert('Unsupported file format. Please attach images (.png, .jpg) or documents (.txt, .pdf).');
    }
  };

  const startCamera = async () => {
    setShowAttachmentMenu(false);
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error('Camera access denied:', e);
      alert('Could not access camera. Please check your browser permissions.');
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg');

    setAttachment({
      name: 'cam_snapshot_' + Date.now() + '.jpg',
      mimeType: 'image/jpeg',
      base64
    });

    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  // 5. CHAT GENERATION DISPATCH
  const handleSendMessage = async (e, textOverride = null) => {
    if (e) e.preventDefault();
    const textToSend = textOverride || promptInput;
    if (!textToSend.trim() && !attachment) return;
    if (loading) return;





    // Check Plan limitations locally before calling backend
    if (userPlanDetails) {
      if (Number(userPlanDetails.limit) !== -1 && userPlanDetails.promptsUsed >= userPlanDetails.limit) {
        onTriggerUpgrade();
        return;
      }
    }

    const currentChat = conversations.find(c => c.id === activeChatId);
    if (!currentChat) return;

    // Store original raw input (what user sees in their chat bubble)
    const originalRawInput = textToSend;

    // Prepare the message that will be SENT to the server
    let messageForServer = textToSend;
    let activeAnonymizeMap = {};

    // Anonymize if enabled — masking runs locally in the browser before any data leaves
    if (anonymizeEnabled) {
      try {
        const trackRes = await fetch('/api/feature/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentUser?.email || null, deviceId: currentUser ? null : deviceId, feature: 'masking' })
        });
        const trackData = await trackRes.json();
        if (!trackRes.ok) {
          setLoading(false);
          onTriggerUpgrade();
          alert(trackData.message || 'Daily limit reached for Data Masking. Please upgrade.');
          return;
        }
      } catch (e) {
        console.warn('Failed to track masking feature limit:', e);
      }

      const { anonymized, map } = anonymizeText(textToSend);
      messageForServer = anonymized; // This is what goes over the internet
      activeAnonymizeMap = map;       // Translation map stays in browser memory only
      anonymizeMapRef.current = map;
      console.log('[ANONYMIZE] Local masking applied. Items masked:', Object.keys(map).length);
    }
    const activeAttachment = attachment;

    // Append user message immediately to local state — user sees their ORIGINAL text
    const userMsg = {
      id: 'msg_user_' + Date.now(),
      sender: 'user',
      text: originalRawInput, // User always sees their raw, unmasked input
      attachment: activeAttachment ? { name: activeAttachment.name, mimeType: activeAttachment.mimeType, base64: activeAttachment.base64 } : null,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...currentChat.messages, userMsg];
    
    // Use placeholder title initially — smart title will be generated after bot responds
    let chatTitle = currentChat.title;
    if (currentChat.messages.length === 0) {
      chatTitle = originalRawInput.substring(0, 40) + (originalRawInput.length > 40 ? '...' : '');
    }

    const updatedChatList = conversations.map(c => {
      if (c.id === activeChatId) {
        return {
          ...c,
          title: chatTitle,
          messages: updatedMessages,
          personality: personality
        };
      }
      return c;
    });

    saveChatsToLocal(updatedChatList);
    setPromptInput('');
    setAttachment(null);
    setLoading(true);

    try {
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser?.email || null,
          deviceId: currentUser ? null : deviceId,
          message: messageForServer, // MASKED version sent over the internet
          history: currentChat.messages.slice(-10),
          personality: personality,
          mode: mode,
          attachment: activeAttachment,
          appCredentials: mode === 'generate' ? appCredentials : []
        })
      });

      const responseData = await chatRes.json();
      
      if (chatRes.ok) {
        let botResponseText = responseData.response;

        // De-anonymize bot response if anonymize was used
        if (anonymizeEnabled && Object.keys(activeAnonymizeMap).length > 0) {
          botResponseText = deanonymizeText(botResponseText, activeAnonymizeMap);
        }


        // PPT GENERATION: Detect if user asked for a presentation
        const isPPTRequest = /\b(presentation|ppt|powerpoint|pptx|slides)\b/i.test(originalRawInput) && 
                             /\b(create|make|generate|build|prepare|design)\b/i.test(originalRawInput);
        
        if (isPPTRequest) {
          try {
            // Extract slide count from user message
            const countMatch = originalRawInput.match(/(\d+)\s*(slide|page|ppt)/i);
            const pageCount = countMatch ? parseInt(countMatch[1]) : 8;
            
            // Detect style preference
            let style = 'balanced';
            if (/more\s*visual|image|picture|graphic/i.test(originalRawInput)) style = 'visual';
            if (/more\s*text|detailed|content|heavy/i.test(originalRawInput)) style = 'text-heavy';

            botResponseText += '\n\n⏳ **Generating your PowerPoint presentation...** Please wait.';
            
            // Show intermediate message
            const tempMsg = {
              id: 'msg_bot_' + Date.now(),
              sender: 'bot',
              text: botResponseText,
              timestamp: new Date().toISOString()
            };
            const tempChatList = conversations.map(c => {
              if (c.id === activeChatId) return { ...c, messages: [...updatedMessages, tempMsg] };
              return c;
            });
            saveChatsToLocal(tempChatList);

                // Extract clean topic name from the user message
                let cleanTopic = originalRawInput
                  .replace(/\b(create|make|generate|build|prepare|design|give|write|draft)\b/gi, '')
                  .replace(/\b(a|an|the|my|me|please|can you|could you|i want|i need)\b/gi, '')
                  .replace(/\b(presentation|ppt|powerpoint|pptx|slides?)\b/gi, '')
                  .replace(/\b(on|about|for|regarding|related to|based on|of|with)\b/gi, '')
                  .replace(/\b(more|visuals?|texts?|images?|detailed|professional|beautiful|attractive)\b/gi, '')
                  .replace(/\b(pages?|number|both)\b/gi, '')
                  .replace(/\d+\s*(slide|page)/gi, '')
                  .replace(/\s+/g, ' ')
                  .trim();
                if (cleanTopic.length < 3) cleanTopic = originalRawInput.substring(0, 80);

                const pptRes = await fetch('/api/generate-ppt', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: currentUser?.email || null,
                    topic: cleanTopic,
                pageCount,
                style
              })
            });

            const pptData = await pptRes.json();
            
            if (pptRes.ok && pptData.success) {
              botResponseText += `\n\n✅ **Your presentation is ready!** (${pptData.slideCount} slides)\n\n📥 [**Click here to download your PPT**](${pptData.downloadUrl})\n\n*File: ${pptData.fileName}*`;
            } else if (pptData.error === 'FEATURE_LIMIT') {
              botResponseText += `\n\n🔒 **PPT daily limit reached!** ${pptData.message}\n\nUpgrade your plan for more PPT generations per day.`;
            } else {
              botResponseText += `\n\n⚠️ PPT generation failed: ${pptData.message || pptData.error || 'Unknown error'}. You can still use the information above to create your presentation manually.`;
            }
          } catch (pptErr) {
            console.error('PPT generation error:', pptErr);
            botResponseText += '\n\n⚠️ Could not generate PPT file. Please try again.';
          }
        }

        const botMsg = {
          id: 'msg_bot_' + Date.now(),
          sender: 'bot',
          text: botResponseText,
          timestamp: new Date().toISOString()
        };

        const finalChatList = conversations.map(c => {
          if (c.id === activeChatId) {
            return {
              ...c,
              messages: [...updatedMessages, botMsg]
            };
          }
          return c;
        });

        // AUTO-DOWNLOAD ZIP FOR APP GENERATION
        if (mode === 'generate') {
          const blockRegex = /```html\s*\n([\s\S]*?)```/;
          const match = blockRegex.exec(botResponseText);
          if (match && match[1]) {
            const htmlCode = match[1].trim();
            setLivePreviewApp(htmlCode); // Auto-open live preview
            try {
              Promise.all([
                import('jszip'),
                import('file-saver')
              ]).then(([JSZipModule, FileSaverModule]) => {
                const JSZip = JSZipModule.default;
                const saveAs = FileSaverModule.saveAs;
                const zip = new JSZip();
                zip.file("index.html", htmlCode);
                zip.generateAsync({ type: "blob" }).then((content) => {
                  saveAs(content, "MatrixMind_GeneratedApp.zip");
                });
              }).catch(err => console.error("Auto-zip module load failed", err));
            } catch (err) {
              console.error("Auto-zip failed", err);
            }
          }
        }

        saveChatsToLocal(finalChatList);
        refreshUserStatus(); // Refresh daily counts

        // Generate smart AI title for the chat (only for first message in this chat)
        if (currentChat.messages.length === 0 || currentChat.title.startsWith('New Conversation')) {
          try {
            const titleRes = await fetch('/api/chat/generate-title', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userMessage: originalRawInput.substring(0, 200),
                botResponse: botResponseText.substring(0, 200)
              })
            });
            if (titleRes.ok) {
              const titleData = await titleRes.json();
              if (titleData.title && titleData.title.length > 1) {
                const titledChatList = finalChatList.map(c => {
                  if (c.id === activeChatId) return { ...c, title: titleData.title };
                  return c;
                });
                saveChatsToLocal(titledChatList);
              }
            }
          } catch (titleErr) {
            console.warn('Smart title generation failed:', titleErr);
          }
        }
      } else {
        if (responseData.error === 'LIMIT_EXCEEDED') {
          alert("You have reached your daily prompt limit for today. Please upgrade your plan to unlock higher capacity.");
          onTriggerUpgrade();
        } else if (responseData.error === 'FEATURE_LIMIT') {
          alert(responseData.message || "You've reached the daily limit for this feature. Upgrade your plan for more.");
          onTriggerUpgrade();
        } else if (responseData.error === 'FEATURE_LOCKED') {
          alert(responseData.message || "This feature is not available in your current plan. Please upgrade.");
          onTriggerUpgrade();
        } else {
          alert(`Error: ${responseData.message || 'AI engine failed to respond.'}`);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Failed to reach the chatbot backend.');
    } finally {
      setLoading(false);
    }
  };

  const activeChat = conversations.find(c => c.id === activeChatId) || null;
  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(chatSearchQuery.toLowerCase())
  );

  // Helper to render Markdown snippets
  const renderMessageContent = (text) => {
    if (!text) return null;
    const is3DDefault = /3d|3-d/i.test(text);
    
    // Pattern to catch both mermaid and html blocks
    const blockRegex = /```(mermaid|html)\s*\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = blockRegex.exec(text)) !== null) {
      const textBefore = text.substring(lastIndex, match.index);
      if (textBefore) {
        parts.push({ type: 'text', content: textBefore });
      }
      parts.push({ type: match[1], content: match[2].trim() });
      lastIndex = blockRegex.lastIndex;
    }

    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push({ type: 'text', content: remainingText });
    }

    return parts.map((part, i) => {
      if (part.type === 'mermaid') {
        return <MermaidChart key={i} chartCode={part.content} defaultTo3D={is3DDefault} />;
      }
      
      if (part.type === 'html') {
        return (
          <div key={i} className="html-app-block glass-panel" style={{ padding: '15px', marginTop: '10px', borderRadius: '10px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent-cyan)' }}><Code size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }}/> Live App Generated</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setLivePreviewApp(part.content)} 
                style={{ flex: 1, padding: '10px', background: 'var(--accent-purple)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                <MonitorPlay size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Live Preview
              </button>
              <button 
                onClick={() => handleShareApp(part.content)}
                style={{ padding: '10px 15px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer' }}
                title="Host Locally & Get Link"
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>
        );
      }
      
      // Basic split formatting for lists, links, tables, and pre blocks
      return (
        <div key={i} className="markdown-render">
          {part.content.split('\n').map((line, lineIdx) => {
            // 3D Shape Renderer (handles primitive shape token or composite scenes DSL)
            if (line.includes('[3D_SHAPE_RENDER:')) {
              const startIdx = line.indexOf('[3D_SHAPE_RENDER:');
              const endIdx = line.indexOf(']', startIdx);
              if (endIdx !== -1) {
                const tokenContent = line.substring(startIdx + 17, endIdx);
                
                const shapeParam = tokenContent.match(/shape\s*=\s*([^,;\]]+)/);
                const colorParam = tokenContent.match(/color\s*=\s*([^,;\]]+)/);
                const materialParam = tokenContent.match(/material\s*=\s*([^,;\]]+)/);
                const compositeParam = tokenContent.match(/composite\s*=\s*([^;\]]+)/);
                const textParam = tokenContent.match(/text\s*=\s*([^;\]]+)/);

                const shape = shapeParam ? shapeParam[1].trim() : null;
                const color = colorParam ? colorParam[1].trim() : null;
                const material = materialParam ? materialParam[1].trim() : null;
                const composite = compositeParam ? compositeParam[1].trim() : null;
                const label = textParam ? textParam[1].trim() : (composite ? "Custom 3D Object" : `${color || ''} ${material || ''} ${shape || 'Shape'}`);

                return (
                  <React.Suspense key={lineIdx} fallback={<div style={{ padding: '15px', color: 'var(--accent-cyan)', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>Loading 3D Visualizer...</div>}>
                    <Interactive3DObject shape={shape} color={color} material={material} composite={composite} label={label} />
                  </React.Suspense>
                );
              }
            }

            // AI Image Generator (renders AI-generated images from Pollinations.ai)
            if (line.includes('[AI_IMAGE:')) {
              const startIdx = line.indexOf('[AI_IMAGE:');
              const endIdx = line.indexOf(']', startIdx);
              if (endIdx !== -1) {
                const tokenContent = line.substring(startIdx + 10, endIdx);
                const promptParam = tokenContent.match(/prompt\s*=\s*(.+)/);
                const imagePrompt = promptParam ? promptParam[1].trim() : 'abstract digital art';
                const encodedPrompt = encodeURIComponent(imagePrompt);
                const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
                
                return (
                  <div key={lineIdx} style={{ margin: '15px 0', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(0,242,254,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', position: 'relative', background: 'rgba(6,6,18,0.8)' }}>
                    <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, background: 'rgba(0,0,0,0.7)', padding: '5px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', fontSize: '0.8rem', fontWeight: 'bold', color: '#fff', fontFamily: 'Inter, sans-serif', backdropFilter: 'blur(8px)' }}>
                      🎨 AI Generated Image
                    </div>
                    <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, display: 'flex', gap: '8px' }}>
                      <a href={imageUrl} target="_blank" rel="noopener noreferrer" download style={{ background: 'rgba(0,0,0,0.7)', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', fontSize: '0.75rem', color: '#00f2fe', textDecoration: 'none', fontFamily: 'Inter, sans-serif', backdropFilter: 'blur(8px)' }}>
                        ⬇ Download
                      </a>
                    </div>
                    <img 
                      src={imageUrl} 
                      alt={imagePrompt} 
                      style={{ width: '100%', maxHeight: '550px', objectFit: 'contain', display: 'block', background: '#0a0a1a' }}
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                    <div style={{ display: 'none', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#ff5555', fontSize: '0.9rem', flexDirection: 'column', gap: '10px' }}>
                      <span>⚠️ Image generation failed. Try again.</span>
                    </div>
                    <div style={{ padding: '10px 15px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)', fontFamily: 'Inter, sans-serif' }}>
                      Prompt: {imagePrompt}
                    </div>
                  </div>
                );
              }
            }

            // Check headers
            if (line.startsWith('### ')) {
              return <h4 key={lineIdx} style={{ margin: '15px 0 5px' }}>{line.replace('### ', '')}</h4>;
            }
            if (line.startsWith('## ')) {
              return <h3 key={lineIdx} style={{ margin: '20px 0 8px', fontFamily: 'var(--font-heading)' }}>{line.replace('## ', '')}</h3>;
            }
            if (line.startsWith('# ')) {
              return <h2 key={lineIdx} style={{ margin: '22px 0 10px', fontFamily: 'var(--font-heading)' }}>{line.replace('# ', '')}</h2>;
            }

            // Bullet Lists
            if (line.startsWith('- ') || line.startsWith('* ')) {
              return <li key={lineIdx} style={{ marginLeft: '20px', marginBottom: '4px' }}>{formatInlineStyles(line.substring(2))}</li>;
            }

            // Format markdown links [text](url)
            return <p key={lineIdx}>{formatInlineStyles(line)}</p>;
          })}
        </div>
      );
    });
  };

  const formatInlineStyles = (line) => {
    // Basic inline bold and link replacement
    const boldRegex = /\*\*(.*?)\*\*/g;
    const linkRegex = /\[(.*?)\]\((.*?)\)/g;

    let elements = [];
    let lastIndex = 0;
    let match;
    let counter = 0;

    // Bold tags
    let cleanLine = line.replace(boldRegex, '<b>$1</b>');
    
    // Links
    // For simplicity, we split and map them:
    const linkParts = [];
    let linkMatch;
    let linkLastIndex = 0;

    while ((linkMatch = linkRegex.exec(cleanLine)) !== null) {
      const textBefore = cleanLine.substring(linkLastIndex, linkMatch.index);
      if (textBefore) {
        linkParts.push(<span key={counter++} dangerouslySetInnerHTML={{ __html: textBefore }} />);
      }
      linkParts.push(
        <a key={counter++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>
          {linkMatch[1]}
        </a>
      );
      linkLastIndex = linkRegex.lastIndex;
    }

    const remaining = cleanLine.substring(linkLastIndex);
    if (remaining) {
      linkParts.push(<span key={counter++} dangerouslySetInnerHTML={{ __html: remaining }} />);
    }

    return linkParts.length > 0 ? linkParts : <span dangerouslySetInnerHTML={{ __html: cleanLine }} />;
  };



  // Auto-close sidebar on mobile when chat selected
  const handleChatSelect = (chatId) => {
    setActiveChatId(chatId);

    if (window.innerWidth <= 768) setSidebarOpen(false);
  };

  return (
    <div className="dashboard-container" style={{ position: 'relative', zIndex: 1, display: 'flex', height: '100vh', backgroundColor: 'transparent' }}>
      {/* Sidebar backdrop — tap to close on mobile */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Responsive Sidebar */}
      <div className={`sidebar glass-panel ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title-row">
            <div className="logo-container">
              <BrainCircuit size={28} color="var(--accent-cyan)" />
              <span className="logo-text">MatrixMind</span>
            </div>
            <button className="hamburger-btn" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <button className="btn btn-secondary" onClick={handleCreateChat} style={{ width: '100%', padding: '10px' }}>
            <Plus size={16} /> New Chat Topic
          </button>

          <div className="search-chat-container">
            <Search size={16} className="search-icon-inside" />
            <input 
              type="text" 
              className="search-chat-input" 
              placeholder="Search chat topics..." 
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Chats History list */}
        <div className="chats-list">
          {filteredConversations.map((chat) => (
            <div 
              key={chat.id} 
              className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
              onClick={() => handleChatSelect(chat.id)}
            >
              <span className="chat-item-text">{chat.title}</span>
              {conversations.length > 1 && (
                <button className="chat-delete-btn" onClick={(e) => handleDeleteChat(chat.id, e)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          {/* Theme switcher */}
          <div className="theme-dropdown-container" style={{ position: 'relative', width: '100%', marginBottom: '5px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>
              Stellar Theme
            </label>
            <button 
              className="btn btn-secondary" 
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              style={{ 
                width: '100%', 
                padding: '10px 14px', 
                fontSize: '0.85rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                borderColor: 'var(--border-glass)',
                background: 'rgba(0,0,0,0.3)',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Orbit size={16} color={themeOptions.find(o => o.value === theme)?.color || '#ff007f'} />
                <span>{themeOptions.find(o => o.value === theme)?.label || 'Supernova Blast'}</span>
              </div>
              <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>▼</span>
            </button>
            
            {themeDropdownOpen && (
              <>
                <div 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                  onClick={() => setThemeDropdownOpen(false)}
                />
                <div 
                  className="glass-panel" 
                  style={{ 
                    position: 'absolute', 
                    bottom: '100%', 
                    left: 0, 
                    right: 0, 
                    marginBottom: '8px', 
                    maxHeight: '260px', 
                    overflowY: 'auto', 
                    zIndex: 1000,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-glass)',
                    background: 'rgba(10, 15, 30, 0.95)',
                    padding: '6px'
                  }}
                >
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setTheme(opt.value);
                        setThemeDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: theme === opt.value ? 'rgba(255,255,255,0.08)' : 'transparent',
                        border: 'none',
                        color: theme === opt.value ? 'var(--text-main)' : 'var(--text-muted)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                        transition: 'var(--transition-smooth)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.color = 'var(--text-main)';
                      }}
                      onMouseLeave={(e) => {
                        if (theme !== opt.value) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        } else {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                          e.currentTarget.style.color = 'var(--text-main)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          background: opt.color,
                          boxShadow: `0 0 8px ${opt.color}`
                        }} />
                        <span>{opt.label}</span>
                      </div>
                      {theme === opt.value && <Check size={14} color="var(--accent-cyan)" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Help & Support button */}
          <button className="btn btn-secondary" onClick={onShowHelp} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', marginBottom: '8px' }}>
            <HelpCircle size={14} /> Help & Support
          </button>





          {/* Upgrade Plan button */}
          <button className="btn" onClick={onTriggerUpgrade} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', background: 'var(--gradient-primary)' }}>
            Upgrade Subscription
          </button>

          {/* User badge */}
          <div className="user-badge">
            <div className="user-badge-info">
              <span className="user-badge-email" style={{ fontWeight: 'bold' }}>{currentUser?.email || 'Guest User'}</span>
              <span className="user-badge-plan" style={{ color: 'var(--accent-cyan)' }}>
                {userPlanDetails?.plan ? userPlanDetails.plan.toUpperCase() : 'FREE'} PLAN
              </span>
              <span style={{ fontSize: '0.8rem', color: '#ffb86c', marginTop: '2px' }}>
                Prompts Left Today: {Number(userPlanDetails?.limit) === -1 ? 'Unlimited' : Math.max(0, (userPlanDetails?.limit || 30) - (userPlanDetails?.promptsUsed || 0)) + ' / ' + (userPlanDetails?.limit || 30)}
              </span>
            </div>
          </div>

          {/* Login / Logout button */}
          {currentUser ? (
            <button className="btn btn-secondary" onClick={onLogout} style={{ width: '100%', padding: '10px 12px', fontSize: '0.85rem', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--accent-neon-red)', borderColor: 'rgba(255,51,102,0.3)' }}>
              <LogOut size={16} /> Log Out
            </button>
          ) : onLogin ? (
            <button className="btn btn-secondary" onClick={onLogin} style={{ width: '100%', padding: '10px 12px', fontSize: '0.85rem', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--accent-cyan)', borderColor: 'rgba(0,242,254,0.3)' }}>
              <Shield size={16} /> Sign In with Google
            </button>
          ) : null}
        </div>
      </div>

      {/* Main chat viewport */}
      {/* Main chat viewport */}
      <div className={(livePreviewApp && mode === 'generate') || "main-chat-area-wrapper"} style={{ flex: 1, overflow: 'hidden' }}>
        
        <div className={`main-chat-area ${livePreviewApp && mode === 'generate' ? 'chat-pane' : ''}`}>
          <div className="chat-container-inner" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', flex: 1 }}>
          <div className="main-header">
          <div className="header-row-top">
            {!sidebarOpen && (
              <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
                <Menu size={24} />
              </button>
            )}

            {/* Personality switcher */}
            <div className="personality-bar">
              <button 
                className={`personality-btn ${personality === 'standard' ? 'active' : ''}`}
                onClick={() => setPersonality('standard')}
              >
                Standard
              </button>
              <button 
                className={`personality-btn ${personality === 'architect' ? 'active' : ''}`}
                onClick={() => setPersonality('architect')}
              >
                Architect
              </button>
              <button 
                className={`personality-btn ${personality === 'analyst' ? 'active' : ''}`}
                onClick={() => setPersonality('analyst')}
              >
                Analyst
              </button>
            </div>

            {/* Mode toggle buttons */}
            <div className="header-modes">
              <div className="tooltip-container">
                <button 
                  className={`mode-toggle-btn ${mode === 'generate' ? 'active' : ''}`}
                  style={mode === 'generate' ? { background: 'linear-gradient(90deg, #ff007f, #7928ca)', color: '#fff', border: 'none' } : {}}
                  onClick={() => setMode(prev => prev === 'generate' ? 'normal' : 'generate')}
                >
                  <Code size={14} style={{ marginRight: '6px' }} />
                  Generate App
                </button>
                <div className="tooltip-text">Autonomous AI Web Developer that builds real React code!</div>
              </div>

              <div className="tooltip-container">
                <button 
                  className={`mode-toggle-btn ${mode === 'optimize' ? 'active' : ''}`}
                  onClick={() => setMode(prev => prev === 'optimize' ? 'normal' : 'optimize')}
                >
                  <Orbit size={14} style={{ marginRight: '6px' }} />
                  Optimize
                </button>
                <div className="tooltip-text">Analyzes and improves code performance and structure.</div>
              </div>

              <div className="tooltip-container">
                <button 
                  className={`mode-toggle-btn matrix ${mode === 'matrix_simulation' ? 'active' : ''}`}
                  onClick={() => setMode(prev => prev === 'matrix_simulation' ? 'normal' : 'matrix_simulation')}
                >
                  <BrainCircuit size={14} style={{ marginRight: '6px' }} />
                  Matrix
                </button>
                <div className="tooltip-text">Multi-dimensional reasoning for complex edge-cases.</div>
              </div>




              

            </div>
          </div>
        </div>

        {/* Credentials Panel - Only visible in Generate Mode */}
        {mode === 'generate' && (
          <div className="credentials-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '5px' }} onClick={() => setShowCredentials(!showCredentials)}>
              <h4 style={{ margin: 0, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={16} /> App Credentials (Local)
              </h4>
              <div style={{ fontSize: '0.75rem', color: '#8b9bb4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{appCredentials.length} Saved</span>
                <button style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>
                  {showCredentials ? 'Hide' : 'Show / Add'}
                </button>
              </div>
            </div>
            
            {showCredentials && (
              <div style={{ marginTop: '15px' }}>
                <div style={{ fontSize: '0.75rem', color: '#8b9bb4', marginBottom: '10px' }}>
                  These are saved securely in your browser and injected into your generated apps automatically.
                </div>
                {appCredentials.map((cred, index) => (
                  <div key={index} className="credential-row">
                    <input 
                      type="text" 
                      placeholder="Credential Name (e.g., WEATHER_API_KEY)" 
                      className="credential-input"
                      value={cred.name}
                      onChange={(e) => handleCredentialChange(index, 'name', e.target.value)}
                    />
                    <input 
                      type="text" 
                      placeholder="Actual Value (e.g., 12345ABC)" 
                      className="credential-input"
                      value={cred.value}
                      onChange={(e) => handleCredentialChange(index, 'value', e.target.value)}
                    />
                    <button onClick={() => handleRemoveCredentialRow(index)} style={{ background: 'transparent', border: 'none', color: '#ff3366', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button onClick={handleAddCredentialRow} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    <Plus size={14} style={{ verticalAlign: 'middle' }} /> Add Row
                  </button>
                  <button onClick={handleSaveCredentials} style={{ background: 'var(--accent-purple)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    Save Credentials
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Message view */}
        <div className="messages-container">
          {activeChat && activeChat.messages.length === 0 ? (
            <div className="empty-chat-state">
              <h1>Welcome to MatrixMind</h1>
              <p>An advanced AI assistant utilizing real-time internet search grounding, Hinglish translations, voice inputs, and rotative Gemini credits.</p>
              
              <div className="features-grid">
                <div className="feature-box glass-panel" onClick={() => setPromptInput('Search who won the football match today and give links')}>
                  <HelpCircle size={28} color="var(--accent-cyan)" />
                  <h3>Real-time Facts</h3>
                  <p>Asks the bot to scrape the web live to verify news, events, or facts with authentic reference links.</p>
                </div>
                <div className="feature-box glass-panel" onClick={() => { setPersonality('architect'); setPromptInput('Create a mermaid mind map for web development learning paths'); }}>
                  <Terminal size={28} color="#ffe259" />
                  <h3>Architect Diagrams</h3>
                  <p>Switch to Architect personality and request structural designs, flows, or live interactive mind maps.</p>
                </div>
                <div className="feature-box glass-panel" onClick={() => { setPersonality('analyst'); setPromptInput('Analyze the statistics of global warming trends and present them in a table'); }}>
                  <LayoutGrid size={28} color="#ff3366" />
                  <h3>Analyst Statistics</h3>
                  <p>Switch to Analyst personality to dissect problems, generate metrics tables, and inspect trends.</p>
                </div>
              </div>
            </div>
          ) : (
            activeChat && (
              <>
                {/* Erase & Download buttons for active chat */}
                <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-end', marginBottom: '-10px' }}>
                  <button className="chat-action-btn" onClick={handleDownloadChat}>
                    <Download size={14} /> Download Chat File
                  </button>
                  <button className="chat-action-btn" onClick={handleEraseChatMemory} style={{ color: 'var(--accent-neon-red)' }}>
                    <RotateCcw size={14} /> Erase Memory
                  </button>
                </div>

                {activeChat.messages.map((m) => (
                  <div key={m.id} className={`chat-bubble-wrapper ${m.sender}`}>
                    <div className="chat-bubble">
                      <div className="chat-bubble-header">
                        <span>{m.sender === 'user' ? 'You' : 'MatrixMind Bot'}</span>
                      </div>
                      
                      {/* Attachment in chat */}
                      {m.attachment && (
                        <div className="chat-bubble-attachment">
                          {m.attachment.mimeType.startsWith('image/') ? (
                            <img src={m.attachment.base64} alt={m.attachment.name} />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                              <FileText size={20} />
                              <span style={{ fontSize: '0.8rem' }}>{m.attachment.name}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bot/User text */}
                      {renderMessageContent(m.text)}



                    </div>
                  </div>
                ))}
                
                {loading && (
                  <div className="chat-bubble-wrapper bot">
                    <div className="chat-bubble">
                      <div className="chat-bubble-header">
                        <span>MatrixMind Bot</span>
                      </div>
                      <p style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Calculating response...</p>
                    </div>
                  </div>
                )}
              </>
            )
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input typings */}
        <div className="chat-input-container">
          <div className="chat-input-bar-wrapper">
            
            {/* Anonymize indicator */}
            {anonymizeEnabled && (
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', 
                padding: '6px 14px', marginBottom: '6px',
                background: 'rgba(0, 242, 254, 0.08)', 
                border: '1px solid rgba(0, 242, 254, 0.2)',
                borderRadius: '8px', fontSize: '0.75rem', color: '#00f2fe'
              }}>
                <Shield size={14} />
                <span><strong>Anonymize ON</strong> — Emails, phones, API keys & IPs will be masked before sending</span>
              </div>
            )}


            {/* Attachment preview above bar */}
            {attachment && (
              <div className="attachment-preview-card">
                <div className="attachment-preview-info">
                  {attachment.mimeType.startsWith('image/') ? <Image size={16} /> : <FileText size={16} />}
                  <span className="attachment-preview-name">{attachment.name}</span>
                </div>
                <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="chat-input-bar glass-panel">
              {/* Attachment selector */}
              <button 
                type="button" 
                className="chat-input-btn"
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              >
                <Paperclip size={20} />
              </button>

              <input 
                type="text" 
                placeholder={isRecording ? "Listening to voice input..." : "Ask a query, write Hinglish, build designs..."}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                disabled={loading}
              />

              {/* Voice recognition mic */}
              <div className="tooltip-container">
                <button 
                  type="button" 
                  className={`chat-input-btn voice-rec ${isRecording ? 'recording' : ''}`}
                  onClick={toggleVoiceInput}
                >
                  <Mic size={20} />
                </button>
                <div className="tooltip-text">Voice Input (English/Hinglish)</div>
              </div>

              {/* Anonymize toggle */}
              <div className="tooltip-container">
                <button 
                  type="button" 
                  className={`chat-input-btn ${anonymizeEnabled ? 'anonymize-active' : ''}`}
                  onClick={() => setAnonymizeEnabled(!anonymizeEnabled)}
                  style={anonymizeEnabled ? { color: '#00f2fe', background: 'rgba(0, 242, 254, 0.15)', borderRadius: '8px' } : {}}
                >
                  <Shield size={20} />
                </button>
                <div className="tooltip-text">{anonymizeEnabled ? 'Anonymize ON — sensitive data will be masked' : 'Anonymize OFF — click to protect sensitive data'}</div>
              </div>

              {/* Call Council button (desktop only) */}
              {isDesktop && (
                <div className="tooltip-container">
                  <button 
                    type="button" 
                    className="chat-input-btn"
                    onClick={handleCallCouncil}
                    disabled={loading || !promptInput.trim()}
                    style={promptInput.trim() ? { color: '#667eea' } : {}}
                  >
                    <Users size={20} />
                  </button>
                  <div className="tooltip-text">Call Council — Multi-Agent Debate</div>
                </div>
              )}

              {/* Execute Workflow Sequence button */}
              <div className="tooltip-container">
                <button 
                  type="button" 
                  className="chat-input-btn"
                  onClick={handleCallWorkflow}
                  disabled={loading || !promptInput.trim()}
                  style={promptInput.trim() ? { color: '#00f2fe' } : {}}
                >
                  <Cpu size={20} />
                </button>
                <div className="tooltip-text">Execute Workflow Sequence</div>
              </div>
              {/* Send message */}
              <button type="submit" className="chat-input-btn send-msg" disabled={loading}>
                <Send size={20} />
              </button>
            </form>

            {/* Floating Attachment Menu */}
            {showAttachmentMenu && (
              <div className="attachment-popover glass-panel">
                <button className="attachment-popover-item" onClick={startCamera}>
                  <Camera size={16} /> Take a Picture
                </button>
                <label className="attachment-popover-item" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Image size={16} /> Browse Devices
                  <input 
                    type="file" 
                    onChange={handleFileUpload} 
                    style={{ display: 'none' }}
                    accept="image/*,text/plain,application/pdf"
                  />
                </label>
              </div>
            )}
          </div>
          </div>
        </div>

      </div>

      {/* Live Preview Pane (Split Screen) */}
      {livePreviewApp && mode === 'generate' && (
        <div className="preview-pane">
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#000', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>
              <MonitorPlay size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }}/> 
              Live App Preview
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => handleShareApp(livePreviewApp)} 
                className="btn" style={{ background: '#00f2fe', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
              >
                <Share2 size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }}/> Share Locally
              </button>
              <button 
                onClick={() => setLivePreviewApp(null)} 
                className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <X size={14} style={{ verticalAlign: 'middle' }}/> Close
              </button>
            </div>
          </div>
          <div style={{ flex: 1, background: '#fff', overflow: 'hidden' }}>
            <iframe 
              srcDoc={livePreviewApp} 
              style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
              title="App Preview Sandbox"
            />
          </div>
        </div>
      )}
      
      </div>
      {/* Camera modal view overlay */}
      {showCamera && (
        <div className="camera-overlay">
          <div className="camera-preview-box">
            <video ref={videoRef} autoPlay playsInline />
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button className="btn" onClick={capturePhoto}>Capture Photo</button>
            <button className="btn btn-secondary" onClick={stopCamera}>Close Camera</button>
          </div>
        </div>
      )}

      {/* Council Room overlay (desktop only) */}
      {councilMode && (
        <CouncilRoom
          prompt={councilPrompt}
          email={currentUser?.email || 'anonymous'}
          onClose={() => setCouncilMode(false)}
          onConsensusComplete={handleCouncilConsensus}
        />
      )}

      {/* Workflow Sequencer overlay */}
      {workflowMode && (
        <WorkflowPanel
          prompt={workflowGoal}
          email={currentUser?.email || 'anonymous'}
          onClose={() => setWorkflowMode(false)}
          onWorkflowComplete={handleWorkflowComplete}
        />
      )}





    </div>
  );
}

export default Dashboard;
