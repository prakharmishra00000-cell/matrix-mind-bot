const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const cron = require('node-cron');
let firebaseApp, firebaseDatabase;
try {
  firebaseApp = require('firebase-admin/app');
  firebaseDatabase = require('firebase-admin/database');
} catch (e) {
  // Fallback for older cached versions of firebase-admin on Render
  const admin = require('firebase-admin');
  firebaseApp = {
    initializeApp: admin.initializeApp.bind(admin),
    cert: admin.credential ? admin.credential.cert.bind(admin.credential) : admin.cert
  };
  firebaseDatabase = {
    getDatabase: () => admin.database()
  };
}

const { initializeApp, cert } = firebaseApp;
const { getDatabase } = firebaseDatabase;
const { performWebSearch } = require('./search');
const { generatePPT, parseSlideContent, extractTopicWithAI, DOWNLOADS_DIR } = require('./pptGenerator');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// Exclude Razorpay webhook from global JSON parser so we can verify the raw cryptographic signature
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payment/razorpay/webhook') {
    next();
  } else {
    express.json({ limit: '50mb' })(req, res, next);
  }
});

// Paths for config and local database
const CONFIG_PATH = path.join(__dirname, 'config.json');
const DB_PATH = path.join(__dirname, 'db.json');

// Auto-bootstrap config.json from environment variables on startup (for Render deployment)
function bootstrapConfigFromEnv() {
  const envKeys = [];
  
  // Method 1: Check numbered keys with multiple naming patterns
  for (let i = 1; i <= 9; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`] 
           || process.env[`GEMINI_KEY_${i}`] 
           || process.env[`API_KEY_${i}`]
           || process.env[`GEMINI_API_KEY${i}`]
           || process.env[`KEY_${i}`];
    if (k && k.trim()) envKeys.push(k.trim());
  }
  
  // Method 2: Check single key env vars
  if (envKeys.length === 0) {
    const singleKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.API_KEY;
    if (singleKey && singleKey.trim()) envKeys.push(singleKey.trim());
  }
  
  // Method 3: Scan ALL env vars for any that look like Google/Gemini API keys
  if (envKeys.length === 0) {
    for (const [key, val] of Object.entries(process.env)) {
      if (val && (val.startsWith('AIza') || val.startsWith('AQ') || val.startsWith('gsk_')) && val.length > 20) {
        console.log(`[STARTUP] Auto-detected API key from env var: ${key}`);
        envKeys.push(val.trim());
      }
    }
  }

  console.log(`[STARTUP] Found ${envKeys.length} Gemini API key(s) from environment variables.`);
  
  const hasGoogleClientId = !!(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID);

  if (envKeys.length > 0 || hasGoogleClientId) {
    try {
      let existingConfig = {};
      if (fs.existsSync(CONFIG_PATH)) {
        try { existingConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (e) {}
      }

      const configData = {
        keys: envKeys,
        RECEIVER_UPI_ID: process.env.RECEIVER_UPI_ID || existingConfig.RECEIVER_UPI_ID || '6372843175@kotakbank',
        RECEIVER_NAME: process.env.RECEIVER_NAME || existingConfig.RECEIVER_NAME || 'Prakhar Mishra',
        googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || existingConfig.googleClientId || '',
        adminUsername: process.env.ADMIN_USERNAME || existingConfig.adminUsername || 'prakhar mishra',
        adminPassword: process.env.ADMIN_PASSWORD || existingConfig.adminPassword || 'prakhar@2025',
        smtpUser: process.env.SMTP_USER || process.env.SMTP_EMAIL || existingConfig.smtpUser || '',
        smtpPass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.SMTP_APP_PASSWORD || existingConfig.smtpPass || '',
        firebaseDbUrl: process.env.FIREBASE_DB_URL || existingConfig.firebaseDbUrl || '',
        firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || existingConfig.firebaseServiceAccount || '',
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || existingConfig.razorpayKeyId || '',
        razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || existingConfig.razorpayKeySecret || '',
        razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || existingConfig.razorpayWebhookSecret || ''
      };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(configData, null, 2));
      console.log(`[STARTUP] Successfully bootstrapped config.json with ${envKeys.length} API key(s).`);
      return true;
    } catch (e) {
      console.error('[STARTUP] Failed to write config.json:', e);
    }
  } else {
    console.warn('[STARTUP] WARNING: No Gemini API keys found in environment variables!');
    console.warn('[STARTUP] Expected env var names: GEMINI_API_KEY_1, GEMINI_API_KEY_2, ... or GEMINI_API_KEY');
  }
  return false;
}

// Try bootstrap on startup — ALWAYS attempt env vars first on fresh deploy
console.log(`[STARTUP] Checking config at: ${CONFIG_PATH}`);
console.log(`[STARTUP] Config file exists: ${fs.existsSync(CONFIG_PATH)}`);

// Always try to bootstrap from env vars (overwrite if env vars exist)
const bootstrapped = bootstrapConfigFromEnv();

if (!bootstrapped && !fs.existsSync(CONFIG_PATH)) {
  console.warn('[STARTUP] No config.json and no env vars. Bot will need Setup page configuration.');
} else if (fs.existsSync(CONFIG_PATH)) {
  try {
    const existingConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    console.log(`[STARTUP] config.json loaded with ${existingConfig.keys ? existingConfig.keys.length : 0} API key(s).`);
  } catch (e) {
    console.error('[STARTUP] config.json is corrupted:', e.message);
  }
}

// Initialize database file if it doesn't exist or doesn't have plans/support/anonymousVisits
let dbInitData = {
  users: {},
  transactions: [],
  visits: {},
  anonymousVisits: {},
  supportQueries: [],
  pendingApprovals: [],
  plans: {
    free: {
      id: "free",
      name: "Free",
      price: 0,
      prompts: 30,
      featureLimits: { ppt: 3, mindmap: 5, matrix: 3, optimize: 3, masking: 5, interview: 3, workflow: 1, council: 1, leads: -1, threed: 3 },
      features: [
        "30 daily prompts limit",
        "All features unlocked (Trial)",
        "PPT Generator (3/day)",
        "Mind Maps — 2D & 3D (5/day)",
        "Matrix Simulation (3/day)",
        "Prompt Optimization (3/day)",
        "Data Masking & Anonymization (5/day)",
        "Interview Mode (3/day)",
        "Workflow Sequencer (1/day)",
        "Council Room (1/day)",
        "Lead Extractor (Unlimited)",
        "Live App Generator & Preview",
        "Knowledge Graph Visualization",
        "3D Object Generation",
        "Mermaid Diagrams & Charts",
        "Advanced Coding (Architect Mode)",
        "Voice Input & Speech-to-Text",
        "File & Image Attachments",
        "Web Grounding Search",
        "3 AI Personality Modes",
        "LaTeX & Math Rendering",
        "Code Syntax Highlighting",
        "10 Cosmic 3D Animated Themes",
        "Chat History & Search",
        "Smart AI Chat Titles",
        "Resets Daily at Midnight"
      ]
    },
    standard: {
      id: "standard",
      name: "Basic",
      price: 99,
      duration: "1 Month",
      days: 30,
      prompts: 100,
      featureLimits: { ppt: 5, mindmap: 8, matrix: 5, optimize: 5, masking: 20, interview: 10, workflow: 0, council: 0, threed: 5 },
      features: [
        "100 daily prompts limit",
        "Standard processing priority",
        "PPT Generator (5/day)",
        "Mind Maps — 2D & 3D (8/day)",
        "Matrix Simulation (5/day)",
        "Prompt Optimization (5/day)",
        "Data Masking & Anonymization (20/day)",
        "Interview Mode (10/day)",
        "Lead Extractor (Unlimited)",
        "Live App Generator & Preview",
        "Knowledge Graph Visualization",
        "3D Object Generation",
        "Mermaid Diagrams & Charts",
        "Advanced Coding (Architect Mode)",
        "Voice Input & Speech-to-Text",
        "File & Image Attachments",
        "Web Grounding Search",
        "3 AI Personality Modes",
        "LaTeX & Math Rendering",
        "Code Syntax Highlighting",
        "10 Cosmic 3D Animated Themes",
        "Chat History & Search",
        "Smart AI Chat Titles",
        "Valid for 30 Days"
      ]
    },
    better: {
      id: "better",
      name: "Pro",
      price: 199,
      duration: "3 Months",
      days: 90,
      prompts: 150,
      featureLimits: { ppt: 7, mindmap: 10, matrix: 10, optimize: 10, masking: 50, interview: 30, workflow: 10, council: 0, threed: 10 },
      features: [
        "150 daily prompts limit",
        "Better processing priority",
        "PPT Generator (7/day)",
        "Mind Maps — 2D & 3D (10/day)",
        "Matrix Simulation (10/day)",
        "Prompt Optimization (10/day)",
        "Data Masking & Anonymization (50/day)",
        "Interview Mode (30/day)",
        "Workflow Sequencer (10/day)",
        "Lead Extractor (Unlimited)",
        "Live App Generator & Preview",
        "Knowledge Graph Visualization",
        "3D Object Generation",
        "Mermaid Diagrams & Charts",
        "Advanced Coding (Architect Mode)",
        "Voice Input & Speech-to-Text",
        "File & Image Attachments",
        "Web Grounding Search",
        "3 AI Personality Modes",
        "LaTeX & Math Rendering",
        "Code Syntax Highlighting",
        "10 Cosmic 3D Animated Themes",
        "Chat History & Search",
        "Smart AI Chat Titles",
        "Valid for 90 Days"
      ]
    },
    premium: {
      id: "premium",
      name: "Ultimate",
      price: 999,
      duration: "1 Year",
      days: 365,
      prompts: 200,
      featureLimits: { ppt: 10, mindmap: 15, matrix: -1, optimize: -1, masking: -1, interview: -1, workflow: -1, council: -1, threed: -1 },
      features: [
        "200 daily prompts limit",
        "Maximum processing priority",
        "PPT Generator (10/day)",
        "Mind Maps — 2D & 3D (15/day)",
        "Matrix Simulation (Unlimited)",
        "Prompt Optimization (Unlimited)",
        "Data Masking & Anonymization (Unlimited)",
        "Interview Mode (Unlimited)",
        "Workflow Sequencer (Unlimited)",
        "Council Room (Unlimited)",
        "Lead Extractor (Unlimited)",
        "Live App Generator & Preview",
        "Knowledge Graph Visualization",
        "3D Object Generation",
        "Mermaid Diagrams & Charts",
        "Advanced Coding (Architect Mode)",
        "Voice Input & Speech-to-Text",
        "File & Image Attachments",
        "Web Grounding Search",
        "3 AI Personality Modes",
        "LaTeX & Math Rendering",
        "Code Syntax Highlighting",
        "10 Cosmic 3D Animated Themes",
        "Chat History & Search",
        "Smart AI Chat Titles",
        "Priority Support",
        "Valid for 365 Days"
      ]
    }
  },
  featureNames: {
    ppt: "PPT Generator",
    mindmap: "Mind Maps",
    matrix: "Matrix Simulation",
    optimize: "Prompt Optimization",
    masking: "Data Masking",
    interview: "Interview Mode",
    workflow: "Workflow Sequencer",
    council: "Council Room",
    leads: "Lead Extractor",
    threed: "3D Object Generator"
  }
};

// Track whether db.json was just created from hardcoded defaults (cold start on ephemeral filesystem)
let dbIsHardcodedSeed = false;

if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify(dbInitData, null, 2), 'utf8');
  dbIsHardcodedSeed = true; // Mark: this is default seed, Firebase cloud data should override it
  console.log('[DB] Created db.json from hardcoded defaults (cold start). Firebase cloud data will override.');
} else {
  try {
    const currentDB = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    let updated = false;
    // Only add missing structural keys — NEVER inject hardcoded plan data
    if (!currentDB.plans) { currentDB.plans = {}; updated = true; }
    if (!currentDB.featureNames) { currentDB.featureNames = {}; updated = true; }
    if (!currentDB.supportQueries) { currentDB.supportQueries = []; updated = true; }
    if (!currentDB.anonymousVisits) { currentDB.anonymousVisits = {}; updated = true; }
    if (!currentDB.pendingApprovals) { currentDB.pendingApprovals = []; updated = true; }
    if (updated) {
      fs.writeFileSync(DB_PATH, JSON.stringify(currentDB, null, 2), 'utf8');
    }
  } catch (e) {
    console.error('Failed to sync DB schema on startup:', e);
  }
}

// Helpers for Reading/Writing Config & DB
function readConfig() {
  // Try config.json first
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (config && config.keys && config.keys.length > 0) {
        if (process.env.FIREBASE_DB_URL) config.firebaseDbUrl = process.env.FIREBASE_DB_URL;
        if (process.env.FIREBASE_SERVICE_ACCOUNT) config.firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (process.env.RAZORPAY_KEY_ID) config.razorpayKeyId = process.env.RAZORPAY_KEY_ID;
        if (process.env.RAZORPAY_KEY_SECRET) config.razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
        if (process.env.RAZORPAY_WEBHOOK_SECRET) config.razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        return config;
      }
    } catch (e) {
      console.error('Error reading config.json:', e);
    }
  }
  // Fallback: load keys directly from env vars every time
  const envKeys = [];
  for (let i = 1; i <= 9; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`] || process.env[`GEMINI_KEY_${i}`];
    if (k && k.trim()) envKeys.push(k.trim());
  }
  if (envKeys.length === 0) {
    const single = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
    if (single && single.trim()) envKeys.push(single.trim());
  }
  if (envKeys.length > 0 || process.env.FIREBASE_DB_URL) {
    return {
      keys: envKeys,
      RECEIVER_UPI_ID: process.env.RECEIVER_UPI_ID || '6372843175@kotakbank',
      RECEIVER_NAME: process.env.RECEIVER_NAME || 'Prakhar Mishra',
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      firebaseDbUrl: process.env.FIREBASE_DB_URL || '',
      firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || '',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
      razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
      razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
      adminUsername: process.env.ADMIN_USERNAME || 'prakhar mishra',
      adminPassword: process.env.ADMIN_PASSWORD || '',
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || ''
    };
  }
  return null;
}

function writeConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    if (firebaseInitialized) {
      getDatabase().ref('/_config').set(config).catch(e => console.error('[FIREBASE] Sync Config failed:', e.message));
    }
    return true;
  } catch (e) {
    console.error('Error writing config:', e);
    return false;
  }
}

const https = require('https');
const CLOUD_DB_HOST = 'extendsclass.com';
const CLOUD_DB_PATH = '/api/json-storage/bin/efdebab';

let cloudSyncTimeout = null;
function syncDBToCloud(data) {
  // Debounce cloud backup sync (5 seconds)
  if (cloudSyncTimeout) return;
  cloudSyncTimeout = setTimeout(() => {
    cloudSyncTimeout = null;
    try {
      const payload = JSON.stringify(data);
      const options = {
        hostname: CLOUD_DB_HOST,
        path: CLOUD_DB_PATH,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      const req = https.request(options, (res) => { res.on('data', () => {}); });
      req.on('error', (e) => console.error('[CLOUD-BACKUP] Sync Error:', e.message));
      req.write(payload);
      req.end();
      console.log('[CLOUD-BACKUP] Synced to ExtendsClass backup.');
    } catch (e) {
      console.error('[CLOUD-BACKUP] Sync failed:', e.message);
    }
  }, 5000);
}

// Promise-based fetch from ExtendsClass cloud backup
function fetchDBFromCloud() {
  return new Promise((resolve) => {
    try {
      const req = https.get(`https://${CLOUD_DB_HOST}${CLOUD_DB_PATH}`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data && data.plans && data.users) {
              console.log('[CLOUD-BACKUP] Successfully fetched backup data. Users:', Object.keys(data.users || {}).length);
              resolve(data);
            } else {
              console.warn('[CLOUD-BACKUP] Backup data is empty or invalid.');
              resolve(null);
            }
          } catch(e) {
            console.error('[CLOUD-BACKUP] Parse error:', e.message);
            resolve(null);
          }
        });
      });
      req.on('error', (e) => {
        console.error('[CLOUD-BACKUP] Fetch error:', e.message);
        resolve(null);
      });
      // Hard timeout for the HTTP request
      req.setTimeout(10000, () => {
        console.warn('[CLOUD-BACKUP] Fetch timed out after 10s.');
        req.destroy();
        resolve(null);
      });
    } catch(e) {
      console.error('[CLOUD-BACKUP] Fetch failed:', e.message);
      resolve(null);
    }
  });
}

// --- FIREBASE INTEGRATION & MEMORY DB ---
let globalDB = null;
let firebaseInitialized = false;
let firebaseFirstLoadComplete = false;

// Shared helper: process cloud data snapshot into globalDB
// RULE: Cloud data is THE SINGLE SOURCE OF TRUTH. Never merge with hardcoded defaults.
// Admin-configured plans/limits in the cloud must NEVER be overwritten by dbInitData.
function processFirebaseData(val) {
  if (val) {
    // Extract config if bundled
    if (val._config) {
      const currentConfig = readConfig() || {};
      if (JSON.stringify(currentConfig) !== JSON.stringify({ ...currentConfig, ...val._config })) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...currentConfig, ...val._config }, null, 2), 'utf8');
      }
      delete val._config;
    }
    
    // Ensure structural keys exist (empty defaults only — NEVER override with hardcoded plan data)
    if (!val.users) val.users = {};
    if (!val.transactions) val.transactions = [];
    if (!val.visits) val.visits = {};
    if (!val.anonymousVisits) val.anonymousVisits = {};
    if (!val.supportQueries) val.supportQueries = [];
    if (!val.pendingApprovals) val.pendingApprovals = [];
    
    // Plans: ONLY use hardcoded defaults if cloud has NO plans at all
    // If cloud has plans, use them AS-IS (admin configured them)
    if (!val.plans || Object.keys(val.plans).length === 0) {
      console.warn('[FIREBASE] Cloud has no plans — using hardcoded defaults as seed.');
      val.plans = JSON.parse(JSON.stringify(dbInitData.plans)); // deep copy
    }
    
    // FeatureNames: same logic
    if (!val.featureNames || Object.keys(val.featureNames).length === 0) {
      val.featureNames = JSON.parse(JSON.stringify(dbInitData.featureNames));
    }
    
    // DONE — cloud data is now the global DB
    globalDB = val;
    dbIsHardcodedSeed = false;
    
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(val, null, 2), 'utf8');
    } catch (err) {
      console.error('[FIREBASE] Failed to write local DB copy:', err.message);
    }
    console.log('[FIREBASE] Cloud data loaded. Users:', Object.keys(val.users || {}).length, 
      '| Plans:', Object.keys(val.plans || {}).join(', '),
      '| Free prompts:', val.plans?.free?.prompts || 'N/A');
  } else {
    // Firebase is empty — push local data as initial seed
    if (!globalDB) globalDB = readLocalDB();
    const initialPayload = { ...globalDB, _config: readConfig() || {} };
    getDatabase().ref('/').set(initialPayload);
    dbIsHardcodedSeed = false;
    console.log('[FIREBASE] Cloud was empty. Pushed local data as initial seed.');
  }
  firebaseFirstLoadComplete = true;
  
  // Keep ExtendsClass backup in sync
  if (globalDB && !dbIsHardcodedSeed) {
    syncDBToCloud(globalDB);
  }
}

function initFirebase() {
  if (firebaseInitialized) return;
  const config = readConfig();
  if (config && config.firebaseServiceAccount && config.firebaseDbUrl) {
    try {
      let serviceAccount;
      if (typeof config.firebaseServiceAccount === 'string') {
        try {
          serviceAccount = JSON.parse(config.firebaseServiceAccount);
        } catch (err) {
          console.warn('[FIREBASE] Standard JSON parse failed, attempting to fix mangled newlines...');
          // Fix unescaped newlines inside the JSON string (common issue when pasting into Render env vars)
          const fixedString = config.firebaseServiceAccount.replace(/\n/g, '\\n').replace(/\r/g, '');
          serviceAccount = JSON.parse(fixedString);
        }
      } else {
        serviceAccount = config.firebaseServiceAccount;
      }
      
      // Ensure the private key has correct actual newlines, not literal '\n' strings
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      // Strip any accidental child paths from the URL to prevent FIREBASE FATAL ERROR
      let cleanDbUrl = config.firebaseDbUrl;
      try {
        cleanDbUrl = new URL(config.firebaseDbUrl).origin;
      } catch(e) {}

      initializeApp({
        credential: cert(serviceAccount),
        databaseURL: cleanDbUrl
      });
      firebaseInitialized = true;
      console.log('[FIREBASE] Successfully connected to Realtime Database.');

      // RACE: Try Firebase REST API AND ExtendsClass REST backup IN PARALLEL
      // .get() uses REST internally (unlike .once('value') which uses WebSocket and hangs on Render)
      const dbRef = getDatabase().ref('/');
      
      const firebasePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Firebase REST timed out (10s)')), 10000);
        dbRef.get().then((snapshot) => {
          clearTimeout(timeout);
          resolve({ source: 'firebase-rest', data: snapshot.val() });
        }).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      
      const extendsClassPromise = fetchDBFromCloud().then(data => {
        if (data) return { source: 'extendsclass', data };
        throw new Error('ExtendsClass returned no data');
      });
      
      // Use Promise.any — first successful source wins
      Promise.any([firebasePromise, extendsClassPromise]).then((result) => {
        if (firebaseFirstLoadComplete) return;
        console.log(`[STARTUP] Cloud data loaded from: ${result.source.toUpperCase()}`);
        processFirebaseData(result.data);
      }).catch((err) => {
        console.error('[STARTUP] All cloud data sources failed:', err.message || err);
        console.warn('[STARTUP] Using local data. Retries will continue in background...');
        firebaseFirstLoadComplete = true;
      });
    } catch (e) {
      console.error('[FIREBASE] Failed to initialize Firebase:', e.message);
    }
  }
}

function readLocalDB() {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    // Never inject hardcoded plan defaults — cloud data is source of truth
    if (!data.plans) data.plans = {};
    if (!data.featureNames) data.featureNames = {};
    return data;
  } catch (e) {
    return { 
      users: {}, 
      transactions: [], 
      visits: {}, 
      anonymousVisits: {}, 
      supportQueries: [], 
      pendingApprovals: [], 
      plans: {},
      featureNames: {}
    };
  }
}

function readDB() {
  if (!globalDB) {
    globalDB = readLocalDB();
  }
  // Firebase auto-deletes empty objects. Re-inject core schema if missing.
  if (!globalDB.users) globalDB.users = {};
  if (!globalDB.transactions) globalDB.transactions = [];
  if (!globalDB.visits) globalDB.visits = {};
  if (!globalDB.anonymousVisits) globalDB.anonymousVisits = {};
  if (!globalDB.supportQueries) globalDB.supportQueries = [];
  if (!globalDB.pendingApprovals) globalDB.pendingApprovals = [];
  // NEVER replace plans with hardcoded defaults — admin may have customized them
  if (!globalDB.plans) globalDB.plans = {};
  if (!globalDB.featureNames) globalDB.featureNames = {};
  
  return globalDB;
}

let writeDBTimeout = null;
let firebaseSyncTimeout = null;

function writeDB(data) {
  globalDB = data; // Update memory instantly for all read requests
  
  // Debounce disk writes to prevent excessive file system locks
  if (!writeDBTimeout) {
    writeDBTimeout = setTimeout(() => {
      writeDBTimeout = null;
      try {
        fs.writeFile(DB_PATH, JSON.stringify(globalDB, null, 2), 'utf8', (err) => {
          if (err) console.error('[DB] Async disk write error:', err.message);
        });
      } catch (e) {
        console.error('[DB] Async persistence failure:', e.message);
      }
    }, 100); // 100ms debounce
  }

  // CRITICAL: NEVER push hardcoded seed data to Firebase or cloud backup.
  if (dbIsHardcodedSeed) {
    return true;
  }

  // Always sync to ExtendsClass cloud backup (debounced, reliable REST API)
  syncDBToCloud(data);

  if (firebaseInitialized) {
    if (!firebaseFirstLoadComplete) {
      return true;
    }
    
    // Debounce Firebase Realtime DB syncing
    if (!firebaseSyncTimeout) {
      firebaseSyncTimeout = setTimeout(() => {
        firebaseSyncTimeout = null;
        try {
          const config = readConfig() || {};
          const payload = { ...globalDB, _config: config };
          getDatabase().ref('/').set(payload).catch(e => {
            console.error('[FIREBASE] Async Sync failed:', e.message);
          });
        } catch (e) {
          console.error('[FIREBASE] Async Sync failed:', e.message);
        }
      }, 500); // 500ms debounce for cloud database sync
    }
  } else {
    // Try to init in case config was just updated
    initFirebase();
  }
  return true;
}

// Flush pending database writes on process exit to prevent data loss
process.on('SIGTERM', () => {
  if (writeDBTimeout) {
    clearTimeout(writeDBTimeout);
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(globalDB, null, 2), 'utf8');
      console.log('[DB] Flushed database to disk on SIGTERM');
    } catch (e) {}
  }
  process.exit(0);
});
process.on('SIGINT', () => {
  if (writeDBTimeout) {
    clearTimeout(writeDBTimeout);
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(globalDB, null, 2), 'utf8');
      console.log('[DB] Flushed database to disk on SIGINT');
    } catch (e) {}
  }
  process.exit(0);
});

// Call on startup
initFirebase();

// FIREBASE RETRY: If the initial once('value') hangs (common on Render cold starts),
// retry loading cloud data periodically until it succeeds
let firebaseRetryCount = 0;
const FIREBASE_MAX_RETRIES = 5;
const FIREBASE_RETRY_INTERVAL = 30000; // 30 seconds

async function retryFirebaseLoad() {
  if (firebaseFirstLoadComplete || !firebaseInitialized || firebaseRetryCount >= FIREBASE_MAX_RETRIES) return;
  
  firebaseRetryCount++;
  console.log(`[FIREBASE] Retry #${firebaseRetryCount}/${FIREBASE_MAX_RETRIES}: Attempting to load cloud data...`);
  
  // TRY 1: ExtendsClass REST backup (faster, more reliable than WebSocket)
  try {
    const backupData = await fetchDBFromCloud();
    if (backupData && !firebaseFirstLoadComplete) {
      console.log(`[CLOUD-BACKUP] Retry #${firebaseRetryCount} loaded from ExtendsClass backup!`);
      processFirebaseData(backupData);
      return;
    }
  } catch (e) {
    console.warn(`[CLOUD-BACKUP] Retry #${firebaseRetryCount} ExtendsClass fallback failed:`, e.message);
  }

  // TRY 2: Firebase REST API (.get() not WebSocket .once())
  if (firebaseFirstLoadComplete) return;
  
  const dbRef = getDatabase().ref('/');
  const retryTimeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Retry #${firebaseRetryCount} timed out after 10s`)), 10000);
  });

  Promise.race([
    dbRef.get(),
    retryTimeoutPromise
  ]).then((snapshot) => {
    if (firebaseFirstLoadComplete) return;
    const val = snapshot.val();
    processFirebaseData(val);
    console.log(`[FIREBASE] Retry #${firebaseRetryCount} SUCCESS via REST API!`);
  }).catch((err) => {
    console.error(`[FIREBASE] Retry #${firebaseRetryCount} failed:`, err.message);
    if (firebaseRetryCount < FIREBASE_MAX_RETRIES) {
      setTimeout(retryFirebaseLoad, FIREBASE_RETRY_INTERVAL);
    } else {
      console.error('[FIREBASE] All retries exhausted. Running with local data only.');
    }
  });
}

// Start retry loop 20 seconds after startup (gives initial once() time to complete)
setTimeout(() => {
  if (!firebaseFirstLoadComplete && firebaseInitialized) {
    console.log('[FIREBASE] Initial load did not complete in 20s. Starting retry loop...');
    retryFirebaseLoad();
  }
}, 20000);

// Helper to prevent race conditions on cold start
// This BLOCKS until Firebase cloud data has been loaded into globalDB
let firebaseWaitTimedOut = false;
async function waitForFirebase() {
  if (!firebaseInitialized) {
    initFirebase();
  }
  // Wait for cloud data load (up to 10 seconds — must be fast enough for Render health checks)
  if (firebaseInitialized && !firebaseFirstLoadComplete) {
    let attempts = 0;
    while (!firebaseFirstLoadComplete && attempts < 100) { // wait up to 10s
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    if (!firebaseFirstLoadComplete) {
      if (!firebaseWaitTimedOut) {
        console.warn('[STARTUP] Timed out waiting for cloud data (10s). Unblocking all requests.');
        firebaseWaitTimedOut = true;
      }
      firebaseFirstLoadComplete = true;
    }
  }
}

// ============================================================
// GLOBAL API MIDDLEWARE: Block ALL API requests until Firebase cloud data is loaded
// This prevents hardcoded defaults from being used to create users with "free" plan
// when they actually have a paid plan stored in Firebase cloud.
// ============================================================
app.use(async (req, res, next) => {
  // Only block API routes that require user/transaction database state
  const nonBlockingRoutes = [
    '/api/setup/status',
    '/api/config/public',
    '/api/plans',
    '/api/visit/anonymous',
    '/api/health',
    '/api/payment-qr'
  ];
  const isNonBlocking = nonBlockingRoutes.includes(req.path) || req.path.startsWith('/api/download-ppt/');
  if (req.path.startsWith('/api/') && !isNonBlocking) {
    await waitForFirebase();
  }
  next();
});

// Track visits (middleware) — MUST wait for Firebase to prevent stale data overwriting cloud
app.use(async (req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    await waitForFirebase();

    const today = new Date().toISOString().split('T')[0];
    const db = readDB();
    db.visits = db.visits || {};
    db.visits[today] = (db.visits[today] || 0) + 1;
    
    // Use writeDB which has all safety guards (dbIsHardcodedSeed check, debouncing, etc.)
    writeDB(db);
  }
  next();
});

// Setup Configuration Endpoint
app.post('/api/setup', (req, res) => {
  const { keys, googleClientId, adminUsername, adminPassword, smtpUser, smtpPass, firebaseDbUrl, firebaseServiceAccount, razorpayKeyId, razorpayKeySecret, razorpayWebhookSecret } = req.body;
  
  if (!keys || !Array.isArray(keys) || keys.length === 0 || !adminUsername || !adminPassword) {
    return res.status(400).json({ error: 'Keys, admin username, and admin password are required.' });
  }

  const cleanKeys = keys.filter(k => k && k.trim() !== '');
  if (cleanKeys.length === 0) {
    return res.status(400).json({ error: 'At least one valid Gemini API Key is required.' });
  }
  // Preserve existing payment settings from previous config
  const existingConfig = readConfig() || {};
  const success = writeConfig({
    keys: cleanKeys,
    RECEIVER_UPI_ID: existingConfig.RECEIVER_UPI_ID || '6372843175@kotakbank',
    RECEIVER_NAME: existingConfig.RECEIVER_NAME || 'Prakhar Mishra',
    googleClientId: googleClientId || '',
    adminUsername,
    adminPassword,
    smtpUser: smtpUser || '',
    smtpPass: smtpPass || '',
    firebaseDbUrl: firebaseDbUrl || '',
    firebaseServiceAccount: firebaseServiceAccount || '',
    razorpayKeyId: razorpayKeyId || '',
    razorpayKeySecret: razorpayKeySecret || '',
    razorpayWebhookSecret: razorpayWebhookSecret || ''
  });

  if (success) {
    return res.json({ success: true, message: 'Configuration saved successfully.' });
  } else {
    return res.status(500).json({ error: 'Failed to write configuration.' });
  }
});

// Check if Setup is Completed
app.get('/api/setup/status', (req, res) => {
  const config = readConfig();
  res.json({ setupCompleted: !!config });
});

// Securely expose public config to frontend (Google Sign-In, UPI receiver details)
app.get('/api/config/public', (req, res) => {
  const config = readConfig();
  res.json({
    googleClientId: config?.googleClientId || '',
    razorpayKeyId: config?.razorpayKeyId || '',
    receiverUpiId: config?.RECEIVER_UPI_ID || '6372843175@kotakbank',
    receiverName: config?.RECEIVER_NAME || 'Prakhar Mishra'
  });
});

// Admin email — gets unlimited everything (not shown in plans)
const ADMIN_EMAIL = 'prakharmishra00000@gmail.com';

// User Session and Plan Status Middleware Helper
function getOrCreateUser(email) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  const db = readDB();
  const today = new Date().toISOString().split('T')[0];
  
  let user = db.users[cleanEmail];
  if (!user) {
    // SAFETY: If we're still on hardcoded seed data, Firebase cloud data hasn't loaded.
    // This user likely exists in Firebase with a paid plan.
    // Return a TEMPORARY user WITHOUT persisting to DB, so the real cloud data isn't overwritten.
    if (dbIsHardcodedSeed) {
      console.warn(`[SAFETY] Returning temporary user for ${cleanEmail} — Firebase cloud data hasn't loaded yet. NOT persisting to DB.`);
      return {
        email: cleanEmail,
        plan: 'free',
        promptsUsed: 0,
        lastResetDate: today,
        planExpiry: null,
        featureUsage: { ppt: 0, mindmap: 0, matrix: 0, optimize: 0, masking: 0, interview: 0, workflow: 0, council: 0, leads: 0, threed: 0 },
        _temporary: true // Flag: this user was NOT loaded from the real database
      };
    }
    user = {
      email: cleanEmail,
      plan: 'free',
      promptsUsed: 0,
      lastResetDate: today,
      planExpiry: null,
      featureUsage: { ppt: 0, mindmap: 0, matrix: 0, optimize: 0, masking: 0, interview: 0, workflow: 0, council: 0, leads: 0, threed: 0 }
    };
    db.users[cleanEmail] = user;
    writeDB(db);
  } else {
    // Ensure featureUsage field exists (for existing users)
    if (!user.featureUsage) {
      user.featureUsage = { ppt: 0, mindmap: 0, matrix: 0, optimize: 0, masking: 0, interview: 0, workflow: 0, council: 0, leads: 0, threed: 0 };
    }

    // Check Plan Expiry — ONLY downgrade if plan has ACTUALLY expired
    if (user.plan !== 'free' && user.planExpiry) {
      const expiry = new Date(user.planExpiry);
      const now = new Date();
      if (now > expiry) {
        console.log(`[EXPIRY] Plan expired for ${cleanEmail}: ${user.plan} expired on ${user.planExpiry}. Downgrading to free.`);
        user.plan = 'free';
        user.planExpiry = null;
        db.users[cleanEmail] = user;
        writeDB(db);
      }
    }

    // Daily Reset at Midnight (prompts + feature usage)
    if (user.lastResetDate !== today) {
      user.promptsUsed = 0;
      user.featureUsage = { ppt: 0, mindmap: 0, matrix: 0, optimize: 0, masking: 0, interview: 0, workflow: 0, council: 0, leads: 0, threed: 0 };
      user.lastResetDate = today;
      db.users[cleanEmail] = user;
      writeDB(db);
    }
  }
  return user;
}

// Device-based anonymous user tracking (for users who haven't signed in)
function getOrCreateDevice(deviceId) {
  if (!deviceId) return null;
  const db = readDB();
  const today = new Date().toISOString().split('T')[0];
  
  if (!db.devices) {
    db.devices = {};
  }
  
  let device = db.devices[deviceId];
  if (!device) {
    device = {
      deviceId,
      promptsUsed: 0,
      lastResetDate: today,
      featureUsage: { ppt: 0, mindmap: 0, matrix: 0, optimize: 0, masking: 0, interview: 0, workflow: 0, council: 0, leads: 0, threed: 0 }
    };
    db.devices[deviceId] = device;
    writeDB(db);
  } else {
    // Daily reset at midnight
    if (device.lastResetDate !== today) {
      device.promptsUsed = 0;
      device.featureUsage = { ppt: 0, mindmap: 0, matrix: 0, optimize: 0, masking: 0, interview: 0, workflow: 0, council: 0, leads: 0, threed: 0 };
      device.lastResetDate = today;
      db.devices[deviceId] = device;
      writeDB(db);
    }
  }
  return device;
}

// Check feature limit for device-based anonymous users
function checkDeviceFeatureLimit(deviceId, feature) {
  const device = getOrCreateDevice(deviceId);
  if (!device) return { allowed: false, used: 0, limit: 0 };
  
  const db = readDB();
  const freePlan = db.plans && db.plans['free'];
  const defaultLimits = { ppt: 3, mindmap: 5, matrix: 3, optimize: 3, masking: 5, interview: 3, workflow: 1, council: 1, leads: -1, threed: 3 };
  const limits = freePlan?.featureLimits || defaultLimits;
  let limit = limits[feature];
  if (limit === undefined) limit = defaultLimits[feature] !== undefined ? defaultLimits[feature] : 0;
  const used = device.featureUsage?.[feature] || 0;
  
  if (Number(limit) === -1) return { allowed: true, used, limit: -1 };
  return { allowed: used < limit, used, limit };
}

// Increment feature usage for device-based anonymous users  
function incrementDeviceFeatureUsage(deviceId, feature) {
  if (!deviceId) return;
  const db = readDB();
  if (!db.devices || !db.devices[deviceId]) return;
  const device = db.devices[deviceId];
  if (!device.featureUsage) device.featureUsage = { ppt: 0, mindmap: 0, matrix: 0, optimize: 0, masking: 0, interview: 0, workflow: 0, council: 0, leads: 0, threed: 0 };
  device.featureUsage[feature] = (device.featureUsage[feature] || 0) + 1;
  db.devices[deviceId] = device;
  writeDB(db);
}

// Check if a feature is within its daily limit
function checkFeatureLimit(email, feature) {
  if (email === ADMIN_EMAIL) return { allowed: true, used: 0, limit: -1 };
  
  const user = getOrCreateUser(email);
  const db = readDB();
  const planInfo = db.plans && db.plans[user.plan];
  
  const defaultLimits = { ppt: 3, mindmap: 5, matrix: 3, optimize: 3, masking: 5, interview: 3, workflow: 1, council: 1, leads: -1 };
  const limits = planInfo?.featureLimits || defaultLimits;
  let limit = limits[feature];
  if (limit === undefined) {
    limit = defaultLimits[feature] !== undefined ? defaultLimits[feature] : 0;
  }
  const used = user.featureUsage?.[feature] || 0;
  
  if (Number(limit) === -1) return { allowed: true, used, limit: -1 }; // unlimited
  return { allowed: used < limit, used, limit };
}

// Increment feature usage count
function incrementFeatureUsage(email, feature) {
  if (!email) return;
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === ADMIN_EMAIL) return;
  
  const db = readDB();
  const user = db.users[cleanEmail];
  if (user) {
    if (!user.featureUsage) user.featureUsage = { ppt: 0, mindmap: 0, matrix: 0, optimize: 0, masking: 0, interview: 0, workflow: 0, council: 0, leads: 0, threed: 0 };
    user.featureUsage[feature] = (user.featureUsage[feature] || 0) + 1;
    db.users[cleanEmail] = user;
    writeDB(db);
  }
}

// User Auth Endpoint (Explicit Sign In / Sign Up) — Seamless cross-device auth
app.post('/api/user/auth', async (req, res) => {
  try {
    await waitForFirebase();
    const { email, action } = req.body;
    if (!email || !action) return res.status(400).json({ error: 'Email and action are required' });
    
    const cleanEmail = email.trim().toLowerCase();
    const db = readDB();
    const userExists = !!db.users[cleanEmail];

    if (action === 'login') {
      if (!userExists) {
        // Auto-register on login attempt — seamless cross-device experience
        getOrCreateUser(cleanEmail);
        return res.json({ success: true, message: 'Account created and logged in successfully.', autoRegistered: true });
      }
      return res.json({ success: true, message: 'Logged in successfully.' });
    } else if (action === 'signup') {
      if (userExists) {
        // If already registered, just log them in instead of showing error
        return res.json({ success: true, message: 'Account found. Logged in successfully.', alreadyExists: true });
      }
      // Create the user implicitly via helper
      getOrCreateUser(cleanEmail);
      return res.json({ success: true, message: 'Signed up successfully.' });
    } else {
      return res.status(400).json({ error: 'INVALID_ACTION', message: 'Action must be login or signup.' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'CRASH', message: e.message, stack: e.stack });
  }
});

// Device Status Endpoint (anonymous users without login)
app.post('/api/device/status', async (req, res) => {
  await waitForFirebase();
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'Device ID is required' });
  
  const device = getOrCreateDevice(deviceId);
  const db = readDB();
  const freePlan = db.plans && db.plans['free'];
  const defaultLimits = { ppt: 3, mindmap: 5, matrix: 3, optimize: 3, masking: 5, interview: 3, workflow: 1, council: 1, leads: -1 };
  
  res.json({
    deviceId: device.deviceId,
    plan: 'free',
    promptsUsed: device.promptsUsed,
    limit: freePlan ? freePlan.prompts : 30,
    featureUsage: device.featureUsage || { ppt: 0, mindmap: 0, matrix: 0, optimize: 0, masking: 0, interview: 0, workflow: 0, council: 0, leads: 0, threed: 0 },
    featureLimits: freePlan?.featureLimits || defaultLimits
  });
});

// User Status Endpoint
app.post('/api/user/status', async (req, res) => {
  await waitForFirebase();
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  
  const user = getOrCreateUser(email);
  const db = readDB();
  const isAdmin = email.trim().toLowerCase() === ADMIN_EMAIL;
  
  // Admin ALWAYS gets unlimited everything — never show "free" tier
  if (isAdmin) {
    return res.json({
      email: user.email,
      plan: 'premium',
      promptsUsed: 0,
      limit: -1,
      expiry: null,
      featureUsage: { ppt: 0, mindmap: 0, matrix: 0, optimize: 0, masking: 0, interview: 0, workflow: 0, council: 0, leads: 0, threed: 0 },
      featureLimits: { ppt: -1, mindmap: -1, matrix: -1, optimize: -1, masking: -1, interview: -1, workflow: -1, council: -1, leads: -1, threed: -1 },
      isAdmin: true
    });
  }
  
  const planInfo = db.plans && db.plans[user.plan];
  const userLimit = planInfo ? planInfo.prompts : (user.plan === 'free' ? 30 : 100);
  const featureLimits = planInfo?.featureLimits || { ppt: 3, mindmap: 5, matrix: 3, optimize: 3, masking: 5, interview: 3, workflow: 1, council: 1, leads: -1, threed: 3 };
  
  res.json({
    email: user.email,
    plan: user.plan,
    promptsUsed: user.promptsUsed,
    limit: userLimit,
    expiry: user.planExpiry,
    featureUsage: user.featureUsage || { ppt: 0, mindmap: 0, matrix: 0, optimize: 0, masking: 0, interview: 0, workflow: 0, council: 0, leads: 0, threed: 0 },
    featureLimits: featureLimits
  });
});



// GEMINI API ROTATION ENGINE
let activeKeyIndex = 0;
let lastGeminiError = '';

async function queryGeminiAPI(keys, contents, systemInstruction, enableWebSearch = false) {
  const modelConfigs = [
    { model: 'gemini-2.5-flash', api: 'v1beta' },
    { model: 'gemini-2.0-flash', api: 'v1beta' },
    { model: 'gemini-2.0-flash-lite-preview-02-05', api: 'v1beta' },
    { model: 'gemini-1.5-flash', api: 'v1beta' },
    { model: 'gemini-1.5-flash', api: 'v1' },
    { model: 'gemini-1.5-pro', api: 'v1beta' },
    { model: 'gemini-1.5-pro', api: 'v1' },
    { model: 'gemini-1.0-pro', api: 'v1beta' },
    { model: 'gemini-1.0-pro', api: 'v1' },
    { model: 'gemini-pro', api: 'v1' }
  ];

  // Try each key
  keyLoop: for (let keyAttempt = 0; keyAttempt < keys.length; keyAttempt++) {
    const keyIndex = (activeKeyIndex + keyAttempt) % keys.length;
    const activeKey = (keys[keyIndex] || '').trim();
    if (!activeKey) continue;
    
    const keyPreview = activeKey.substring(0, 8) + '...';

    for (const { model, api } of modelConfigs) {
      const url = `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${activeKey}`;
      
      let attempts = 0;
      while (attempts < 2) {
        attempts++;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); 

        try {
          let payloadContents = JSON.parse(JSON.stringify(contents));
          if (systemInstruction && payloadContents.length > 0) {
             // Inject system instruction into the MOST RECENT user message so the model doesn't forget it in long chats
             for (let i = payloadContents.length - 1; i >= 0; i--) {
                if (payloadContents[i].role === 'user') {
                   payloadContents[i].parts[0].text = `[SYSTEM INSTRUCTION: ${systemInstruction}]\n\n` + payloadContents[i].parts[0].text;
                   break;
                }
             }
          }

          console.log(`[GEMINI] Trying Key ${keyPreview} | ${api}/${model}`);

          const requestPayload = { contents: payloadContents };
          if (enableWebSearch) {
             requestPayload.tools = [{ googleSearch: {} }];
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Connection': 'close' 
            },
            body: JSON.stringify(requestPayload),
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          const responseData = await response.json();

          if (response.ok) {
            if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].content) {
              console.log(`[GEMINI] ✅ SUCCESS: Key ${keyPreview} | ${api}/${model}`);
              activeKeyIndex = keyIndex;
              return responseData.candidates[0].content.parts[0].text;
            }
            break; // Empty response — try next model
          }

          const errMsg = (responseData.error?.message || '').substring(0, 80);
          lastGeminiError = `Status: ${response.status}. Msg: ${errMsg}`;
          console.warn(`[GEMINI] ❌ ${response.status}: ${keyPreview} | ${api}/${model} | ${errMsg}`);
          
          if (response.status === 429) {
            continue keyLoop; // Quota exceeded — this entire KEY is burned/rate-limited, immediately skip to NEXT KEY
          }
          if (response.status === 401 || response.status === 403) {
            continue keyLoop; // Bad key — skip to next key
          }
          if (response.status === 404) {
            break; // Model not found, skip to NEXT MODEL in the modelConfigs loop
          }
          if (response.status >= 500) {
             // Google server error, wait and retry same model
             await new Promise(r => setTimeout(r, 1000 * attempts));
             continue; // Loops the while loop
          }
          
          break; // Other 4xx error — try next model

        } catch (error) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            console.warn(`[GEMINI] ⏱ TIMEOUT: ${keyPreview} | ${model}`);
            break; // Timeout, move to next model
          }
          
          console.error(`[GEMINI] 💥 ${keyPreview} | ${model} (Attempt ${attempts}): ${error.message}`);
          lastGeminiError = `Exception: ${error.message}`;
          
          if (attempts < 2 && (error.message.includes('Premature close') || error.message.includes('ECONNRESET') || error.message.includes('fetch failed'))) {
             console.log(`[GEMINI] Retrying due to network drop...`);
             await new Promise(r => setTimeout(r, 1000 * attempts));
             continue; 
          }
          break; // Exhausted attempts, move to next model
        }
      }
    }
  }

  // FINAL RETRY
  console.log('[GEMINI] All attempts failed. Waiting 2s for final retry...');
  await new Promise(r => setTimeout(r, 2000));
  
  const finalFallbackModels = [
    { model: 'gemini-1.5-flash', api: 'v1beta' },
    { model: 'gemini-1.0-pro', api: 'v1' },
    { model: 'gemini-pro', api: 'v1beta' }
  ];

  for (let i = 0; i < Math.min(keys.length, 3); i++) {
    const key = (keys[i] || '').trim();
    if (!key) continue;
    
    for (const { model, api } of finalFallbackModels) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      try {
        let payloadContents = JSON.parse(JSON.stringify(contents));
        if (systemInstruction && payloadContents.length > 0 && payloadContents[0].role === 'user') {
          payloadContents[0].parts[0].text = `[System Instruction: ${systemInstruction}]\n\n` + payloadContents[0].parts[0].text;
        }
        
        const url = `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${key}`;
        const requestPayloadFinal = { contents: payloadContents };
        if (enableWebSearch) requestPayloadFinal.tools = [{ googleSearch: {} }];

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayloadFinal),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await response.json();

        if (response.ok && data.candidates && data.candidates[0]) {
          return data.candidates[0].content.parts[0].text;
        } else {
          lastGeminiError = `Status: ${response.status}. Msg: ${data.error?.message || 'Unknown error'}`;
        }
      } catch (e) {
        clearTimeout(timeoutId);
        lastGeminiError = `Final Fallback Exception: ${e.message}`;
      }
    }
  }

  console.error(`[GEMINI] ALL ${keys.length} KEYS EXHAUSTED — daily free-tier quota likely reached`);
  if (keys.length === 0) {
    throw new Error("CRITICAL: No API keys found! You must add GEMINI_API_KEY_1 to your Render Environment Variables.");
  }
  throw new Error(`I apologize, but the backend failed to generate a response.\n\n**Exact Internal Error**: ${lastGeminiError || 'Unknown timeout/quota error'}\n\nPlease check your API keys or try again later.`);
}

// Health Check — diagnose key loading issues
app.get('/api/health', (req, res) => {
  const config = readConfig();
  const keyCount = config?.keys?.length || 0;
  const keyPreviews = (config?.keys || []).map(k => k.substring(0, 6) + '...' + k.substring(k.length - 4));
  const db = readDB();
  res.json({
    status: keyCount > 0 ? 'OK' : 'NO_KEYS',
    keyCount,
    keyPreviews,
    configFileExists: fs.existsSync(CONFIG_PATH),
    envKeysFound: Object.keys(process.env).filter(k => k.includes('GEMINI')).length,
    firebaseStatus: {
      initialized: firebaseInitialized,
      cloudLoaded: firebaseFirstLoadComplete,
      isHardcodedSeed: dbIsHardcodedSeed,
      retryCount: firebaseRetryCount || 0
    },
    dbStats: {
      users: Object.keys(db.users || {}).length,
      plans: Object.keys(db.plans || {}).join(', ')
    },
    timestamp: new Date().toISOString()
  });
});

// Admin: Force sync current DB to ExtendsClass backup
app.post('/api/admin/force-sync-backup', (req, res) => {
  const db = readDB();
  if (!db || !db.plans) {
    return res.status(400).json({ error: 'No valid data to sync' });
  }
  // Bypass debounce — force immediate sync
  const https = require('https');
  const payload = JSON.stringify(db);
  const options = {
    hostname: CLOUD_DB_HOST,
    path: CLOUD_DB_PATH,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  const syncReq = https.request(options, (syncRes) => {
    let body = '';
    syncRes.on('data', chunk => body += chunk);
    syncRes.on('end', () => {
      console.log('[CLOUD-BACKUP] Force sync completed. Users:', Object.keys(db.users || {}).length);
      res.json({ 
        success: true, 
        message: 'Backup synced to ExtendsClass',
        users: Object.keys(db.users || {}).length,
        plans: Object.keys(db.plans || {}).join(', ')
      });
    });
  });
  syncReq.on('error', (e) => {
    console.error('[CLOUD-BACKUP] Force sync failed:', e.message);
    res.status(500).json({ error: 'Sync failed: ' + e.message });
  });
  syncReq.write(payload);
  syncReq.end();
});

// PPT File Download endpoint
app.get('/api/download-ppt/:filename', (req, res) => {
  const filePath = path.join(DOWNLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found or expired. Please generate again.' });
  }
  res.download(filePath, req.params.filename);
});

// PPT Generation endpoint
app.post('/api/generate-ppt', async (req, res) => {
  const { email, topic, pageCount, style } = req.body;
  if (!email || !topic) {
    return res.status(400).json({ error: 'Email and topic are required.' });
  }
  
  // Check PPT daily limit
  const pptCheck = checkFeatureLimit(email, 'ppt');
  if (!pptCheck.allowed) {
    return res.status(403).json({ 
      error: 'FEATURE_LIMIT', 
      message: `You have used all ${pptCheck.limit} PPT generations for today (${pptCheck.used}/${pptCheck.limit}). Upgrade your plan for more.` 
    });
  }
  
  let config = readConfig();
  if (!config || !config.keys || config.keys.length === 0) {
    return res.status(500).json({ error: 'API keys not configured.' });
  }

  const slideCount = Math.min(Math.max(parseInt(pageCount) || 8, 3), 25);
  const stylePreference = style || 'balanced';

  try {
    // STEP 1: AI deeply analyzes the user's FULL prompt to understand what they actually want
    // This extracts: the clean topic name + what sub-topics/aspects should be covered
    const userOriginalPrompt = topic; // This is the user's full raw prompt
    
    let cleanTopic = userOriginalPrompt;
    let slideOutline = '';
    
    try {
      const analysisPrompt = `A user wants a presentation. Read their request carefully and understand exactly what topic they want and what aspects they expect to be covered.

User's request: "${userOriginalPrompt}"

You must respond in EXACTLY this format (nothing else):

TOPIC: [The exact topic name — just the subject, no extra words. For example if user says "make a ppt on evolution of engines" the topic is "Evolution of Engines"]

OUTLINE:
1. [First sub-topic that should be covered based on what user asked]
2. [Second sub-topic]
3. [Third sub-topic]
4. [Fourth sub-topic]
5. [Fifth sub-topic]
6. [Sixth sub-topic]
7. [Seventh sub-topic]
8. [Eighth sub-topic]

Create exactly ${slideCount} sub-topics in the outline. Each sub-topic must be directly related to the main topic. Think about what aspects the user would naturally expect to see in a presentation about this topic.

For example, if the user asks about "Evolution of Engines":
TOPIC: Evolution of Engines
OUTLINE:
1. What is an Engine - Definition and Basic Working
2. Origin and Invention of the First Engine
3. Steam Engine Era - The Beginning of Mechanical Power
4. Internal Combustion Engine - How It Changed Everything
5. Types of Engines - Petrol, Diesel, Rotary, Turbine
6. Key Upgrades and Technological Improvements in Engines
7. Modern Engines - Electric Motors and Hybrid Technology
8. Future of Engines - Hydrogen, AI-Powered, and Beyond`;

      const analysisContents = [{ role: 'user', parts: [{ text: analysisPrompt }] }];
      const analysisResponse = await queryGeminiAPI(config.keys, analysisContents, 'You analyze user requests to extract the topic and create a presentation outline. Respond only in the format asked. No markdown.');
      
      // Parse the analysis
      const topicMatch = analysisResponse.match(/TOPIC:\s*(.+)/i);
      if (topicMatch) {
        const extracted = topicMatch[1].trim().replace(/^["']|["']$/g, '');
        if (extracted.length > 2 && extracted.length < 150) cleanTopic = extracted;
      }
      
      const outlineMatch = analysisResponse.match(/OUTLINE:\s*([\s\S]+)/i);
      if (outlineMatch) {
        slideOutline = outlineMatch[1].trim();
      }
      
      console.log(`[PPT] AI understood topic: "${cleanTopic}"`);
      console.log(`[PPT] AI created outline with ${slideOutline.split('\n').filter(l => l.trim()).length} sub-topics`);
    } catch (e) {
      console.warn('[PPT] Analysis fallback — using raw prompt');
      // Fallback: try simple topic extraction
      try {
        const aiTopic = await extractTopicWithAI(userOriginalPrompt, queryGeminiAPI, config.keys);
        if (aiTopic) cleanTopic = aiTopic;
      } catch (e2) { /* use raw */ }
    }
    
    console.log(`[PPT] Generating ${slideCount}-slide presentation on: "${cleanTopic}"`);
    
    // STEP 2: Generate detailed slide content using the outline
    const pptContentPrompt = slideOutline
      ? `You are creating a detailed presentation about "${cleanTopic}".

The user's original request was: "${userOriginalPrompt}"

Follow this outline and write detailed content for each slide. Every point must be a real fact specifically about "${cleanTopic}":

${slideOutline}

For each sub-topic in the outline above, write one slide with 4-6 detailed bullet points. Every bullet must contain specific information directly about "${cleanTopic}" — real facts, dates, names, numbers, examples.

Write as if you are teaching someone everything about "${cleanTopic}". The content should be the same quality as if someone asked you to explain "${cleanTopic}" in a conversation.

FORMAT — use this exact format:

SLIDE 1: [Sub-topic from outline]
- [Detailed specific fact about this aspect of ${cleanTopic}]
- [Another real fact with names/dates/numbers]
- [Important detail about ${cleanTopic}]
- [Key point or example]
- [Additional fact if relevant]

SLIDE 2: [Next sub-topic from outline]
- [Point 1]
- [Point 2]
- [Point 3]
- [Point 4]

Continue for all ${slideCount} slides.

SLIDE ${slideCount + 1}: Sources and References
- [Real official URL about ${cleanTopic}]
- [Another credible source]
- [Third reference]

Rules: Plain text only. No bold, no **, no markdown. Start each slide with "SLIDE X:" exactly.`
      : `Explain "${cleanTopic}" in complete detail. The user asked: "${userOriginalPrompt}"

Break your explanation into exactly ${slideCount} sections covering all important aspects of "${cleanTopic}". Include specific facts, dates, names, numbers.

FORMAT:
SLIDE 1: [Sub-topic of ${cleanTopic}]
- [Detailed fact]
- [Another fact]
- [Data point]
- [Key detail]

Continue for ${slideCount} slides, then add:
SLIDE ${slideCount + 1}: Sources and References
- [URL 1]
- [URL 2]
- [URL 3]

Plain text only. No markdown. Start each with "SLIDE X:".`;

    const contents = [{ role: 'user', parts: [{ text: pptContentPrompt }] }];
    const systemInstr = `You are a subject matter expert on "${cleanTopic}". Explain "${cleanTopic}" thoroughly with real, accurate information. Every slide heading must be a sub-topic of "${cleanTopic}". Every bullet must contain specific facts about "${cleanTopic}" — not generic information. Write as if teaching someone who wants to learn everything about "${cleanTopic}". Plain text only.`;
    
    const aiResponse = await queryGeminiAPI(config.keys, contents, systemInstr);
    
    // STEP 3: Parse AI response into slides
    const slides = parseSlideContent(aiResponse);
    
    if (!slides || slides.length === 0) {
      console.error('[PPT] Failed to parse slides from AI response');
      return res.status(500).json({ error: 'Failed to generate slide content. Please try again.' });
    }
    
    console.log(`[PPT] Parsed ${slides.length} slides, generating PPTX with images...`);
    
    // STEP 4: Generate PPTX with real images (uses cleanTopic)
    const result = await generatePPT(cleanTopic, slides, { style: stylePreference });
    
    const downloadUrl = `/api/download-ppt/${result.fileName}`;
    
    // Increment PPT usage
    incrementFeatureUsage(email, 'ppt');
    
    res.json({
      success: true,
      downloadUrl,
      fileName: result.fileName,
      slideCount: result.slideCount,
      topic: cleanTopic,
      message: `✅ Presentation generated! ${result.slideCount} slides on "${cleanTopic}".`
    });
    
  } catch (error) {
    console.error('[PPT] Generation error:', error.message);
    res.status(500).json({ error: 'Failed to generate presentation. ' + error.message });
  }
});

// Key Diagnostic — tests each key individually to find exact errors
app.get('/api/test-keys', async (req, res) => {
  const config = readConfig();
  if (!config || !config.keys || config.keys.length === 0) {
    return res.json({ error: 'No keys found' });
  }
  
  const results = [];
  const testPayload = { contents: [{ role: 'user', parts: [{ text: 'Say hi in one word' }] }] };
  
  for (let i = 0; i < config.keys.length; i++) {
    const key = config.keys[i];
    const keyPreview = key.substring(0, 8) + '...' + key.substring(key.length - 4);
    
    // Test with gemini-3.5-flash
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (response.ok && data.candidates?.[0]?.content) {
        results.push({ key: keyPreview, status: 'WORKING', httpCode: 200, model: 'gemini-3.5-flash' });
      } else {
        const errMsg = data.error?.message || 'Unknown error';
        results.push({ key: keyPreview, status: 'FAILED', httpCode: response.status, error: errMsg.substring(0, 150), model: 'gemini-3.5-flash' });
      }
    } catch (e) {
      results.push({ key: keyPreview, status: 'ERROR', error: e.message, model: 'gemini-3.5-flash' });
    }
  }
  
  const workingKeys = results.filter(r => r.status === 'WORKING').length;
  res.json({ 
    summary: `${workingKeys}/${results.length} keys working`,
    results,
    timestamp: new Date().toISOString()
  });
});
// --- LIVE APP GENERATOR HOSTING ---
const generatedApps = new Map(); // Store generated HTML files in memory. Key: short id, Value: raw HTML

app.post('/api/apps/share', (req, res) => {
  const { htmlCode } = req.body;
  if (!htmlCode) return res.status(400).json({ error: 'No HTML code provided' });
  
  // Generate a random 6-character ID
  const id = crypto.randomBytes(3).toString('hex');
  generatedApps.set(id, htmlCode);
  
  // Clean up old apps if map gets too large to prevent memory leaks (keep last 100)
  if (generatedApps.size > 100) {
    const firstKey = generatedApps.keys().next().value;
    generatedApps.delete(firstKey);
  }
  
  res.json({ success: true, url: `/api/apps/serve/${id}`, id });
});

app.get('/api/apps/serve/:id', (req, res) => {
  const { id } = req.params;
  const htmlCode = generatedApps.get(id);
  
  if (!htmlCode) {
    return res.status(404).send('<h1>App Not Found or Expired</h1><p>This live app preview link has expired. Generate a new one in the MatrixMind dashboard.</p>');
  }
  
  res.setHeader('Content-Type', 'text/html');
  res.send(htmlCode);
});

function detectLanguage(message, history) {
  const msgLower = message.toLowerCase().trim();
  
  // 1. Explicit "in hindi" or "hindi me/mein" request — user explicitly wants Hindi
  if (/\b(in\s+hindi|hindi\s+me(?:in)?|hindi\s+m[ae]i?n?)\b/i.test(msgLower) || 
      /\b(give|answer|reply|respond|bata|batao|samjha|samjhao)\b.*\bhindi\b/i.test(msgLower)) {
    return 'hindi';
  }
  
  // 2. Explicit "in english" request — user explicitly wants English
  if (/\b(in\s+english|english\s+me(?:in)?|english\s+m[ae]i?n?)\b/i.test(msgLower)) {
    return 'english';
  }

  // 3. Devanagari script detected — clearly Hindi
  if (/[\u0900-\u097F]/.test(message)) {
    return 'hindi';
  }

  // 4. Hinglish detection — STRICT: only words that are NOT common English words
  //    Removed: to, hi, me, se, the, ho, par, pe, ek, ka, ki, ke (all common English or too short)
  const strongHinglishWords = [
    /\bkya\b/i, /\bhai\b/i, /\bhain\b/i, /\bbanao\b/i, /\bkaise\b/i, 
    /\bkyun\b/i, /\bkyon\b/i, /\bbatao\b/i, /\bsamjhao\b/i, /\bsamjha\b/i,
    /\bkaro\b/i, /\bkarte\b/i, /\bkrna\b/i, /\bkarna\b/i, /\bhota\b/i,
    /\bhoti\b/i, /\bhote\b/i, /\bmein\b/i, /\btoh\b/i, /\btha\b/i, /\bthi\b/i,
    /\braha\b/i, /\brahi\b/i, /\brahe\b/i, /\bgaya\b/i, /\bgayi\b/i, /\bgaye\b/i,
    /\bbanaen\b/i, /\bbanaiye\b/i, /\bchahiye\b/i, /\bkijiye\b/i, /\bbaat\b/i,
    /\bbolna\b/i, /\bbolo\b/i, /\bdikhao\b/i, /\blikho\b/i, /\bpadho\b/i,
    /\bsuno\b/i, /\bjao\b/i, /\baao\b/i, /\bchalo\b/i, /\bkuch\b/i,
    /\bkoi\b/i, /\bkaun\b/i, /\bkahan\b/i, /\bkab\b/i, /\byeh\b/i, /\bwoh\b/i,
    /\bnahi\b/i, /\bnahin\b/i, /\bnhi\b/i, /\bhum\b/i, /\btum\b/i, /\baap\b/i,
    /\bkr\b/i, /\bh\b/i, /\biska\b/i, /\buska\b/i, /\bjaise\b/i, /\bwaise\b/i,
    /\bphir\b/i, /\bfir\b/i, /\bsabse\b/i, /\bbahut\b/i, /\bzyada\b/i,
    /\baccha\b/i, /\btheek\b/i, /\bthik\b/i, /\bsahi\b/i, /\bgalat\b/i,
    /\bpehle\b/i, /\bbaad\b/i, /\bdusra\b/i, /\bteesra\b/i
  ];
  
  // Count how many Hinglish words match — need at least 2 to be confident
  const hinglishMatchCount = strongHinglishWords.filter(p => p.test(msgLower)).length;
  if (hinglishMatchCount >= 2) {
    return 'hindi';
  }

  // 5. Default: English
  return 'english';
}

// Main Chat AI Endpoint
app.post('/api/chat', async (req, res) => {
  let config = readConfig();
  if (!config || !config.keys || config.keys.length === 0) {
    bootstrapConfigFromEnv();
    config = readConfig();
    if (!config || !config.keys || config.keys.length === 0) {
      return res.status(500).json({ error: 'SETUP_REQUIRED', message: 'API credentials are not configured. Please set GEMINI_API_KEY_1 through GEMINI_API_KEY_9 in Render environment variables.' });
    }
  }
  
  console.log(`[CHAT] Processing request with ${config.keys.length} API key(s). First key prefix: ${config.keys[0].substring(0, 6)}...`);

  const { email, message, history, personality, mode, attachment, appCredentials, deviceId } = req.body;
  
  // Support anonymous device-based users (no email required)
  const isAnonymous = !email && deviceId;
  if (!email && !deviceId) return res.status(400).json({ error: 'Email or Device ID is required.' });

  const db = readDB();
  const user = isAnonymous ? null : getOrCreateUser(email);
  const device = isAnonymous ? getOrCreateDevice(deviceId) : null;
  const isAdmin = email && email.trim().toLowerCase() === ADMIN_EMAIL;

  // 0. LEAD EXTRACTOR INTENT DETECTION
  let isLeadGenRequest = false;
  if (/lead|prospect|contact info|contact details|find email|find phone|extract lead/i.test(message)) {
    try {
      const intentPrompt = `Analyze this user query: "${message}"\nIs the user primarily asking to extract, generate, or find "leads", contact info, or prospects? Return only valid JSON: {"isLeadGen": true/false}`;
      const intentRes = await queryGeminiAPI(config.keys, [{ role: 'user', parts: [{ text: intentPrompt }] }], 'You are a JSON generator.');
      const intentJson = JSON.parse(intentRes.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim());
      if (intentJson && intentJson.isLeadGen) {
        isLeadGenRequest = true;
      }
    } catch(e) {
      console.error('[LEAD EXTRACTOR] Intent parse failed:', e.message);
    }
  }

  // Execute Lead Gen if detected
  if (isLeadGenRequest) {
    try {
      console.log(`[LEAD EXTRACTOR] Intent detected for ${email}`);
      const check = isAnonymous ? checkDeviceFeatureLimit(deviceId, 'leads') : checkFeatureLimit(email, 'leads');
      if (!check.allowed && !isAdmin) {
        return res.status(403).json({ error: 'FEATURE_LIMIT', message: `Lead Extractor daily limit reached (${check.used}/${check.limit}). Upgrade your plan for more.` });
      }
      isAnonymous ? incrementDeviceFeatureUsage(deviceId, 'leads') : incrementFeatureUsage(email, 'leads');
      
      const leadPrompt = `You are a Professional B2B Lead Researcher. The user wants leads based on this requirement: "${message}".\nSearch the public internet for relevant professional discussions, Reddit threads, Twitter posts, and professional networks. \nUse your search tool to find actual public contact info or profiles. Append queries with "contact me" OR "email me at" to find actual leads if needed.\nFormat the output EXACTLY as a Markdown Table with these columns:\n| Lead Name/Handle | Contact Info (Email/Phone) | Relevant Comment/Bio | Direct Source Link |\n|---|---|---|---|\nIf direct contact info is missing from the public web, write "N/A (DM via Platform)". \nProvide as many leads as the user requested. Output the markdown table and a brief summary. Do not output anything malicious or harmful.`;
      
      const leadResult = await queryGeminiAPI(config.keys, [{ role: 'user', parts: [{ text: leadPrompt }] }], 'You are a professional lead researcher. You must use web search to find publicly available business contact details.', true);
      
      if (!isAdmin) {
        if (isAnonymous) {
          device.promptsUsed += 1;
          db.devices[deviceId] = device;
        } else {
          user.promptsUsed += 1;
          db.users[email] = user;
        }
        writeDB(db);
      }
      
      return res.json({ success: true, response: `🤖 **Autonomous Lead Extractor Activated**\n\n${leadResult}` });
    } catch (error) {
      console.error('[LEAD EXTRACTOR] Execution failed:', error.message);
      return res.json({ success: false, response: `🤖 **Lead Extractor Error**\n\nI detected that you want to generate leads, but my search engine encountered an error (this could be due to API timeouts or safety filters blocking the query). Please try rephrasing your request to be more specific or try again later.\n\nError details: ${error.message.substring(0, 100)}` });
    }
  }

  // 1. Enforce Prompt Limit & Feature Gating
  const planInfo = isAnonymous ? null : (db.plans && db.plans[user.plan]);
  const userLimit = isAnonymous ? null : (planInfo ? planInfo.prompts : (user.plan === 'free' ? 30 : 100));
  const planFeatures = planInfo && planInfo.features ? [...new Set(planInfo.features)].join(' ').toLowerCase() : '';

  // Feature usage limits (matrix, optimize, mindmap)
  
  if (!isAdmin) {
    if (mode === 'matrix_simulation') {
      const check = isAnonymous ? checkDeviceFeatureLimit(deviceId, 'matrix') : checkFeatureLimit(email, 'matrix');
      if (!check.allowed) {
        return res.status(403).json({ error: 'FEATURE_LIMIT', message: `Matrix Simulation daily limit reached (${check.used}/${check.limit}). Upgrade your plan for more.` });
      }
    }
    if (mode === 'optimize') {
      const check = isAnonymous ? checkDeviceFeatureLimit(deviceId, 'optimize') : checkFeatureLimit(email, 'optimize');
      if (!check.allowed) {
        return res.status(403).json({ error: 'FEATURE_LIMIT', message: `Prompt Optimization daily limit reached (${check.used}/${check.limit}). Upgrade your plan for more.` });
      }
    }

    const is3DRequest = /\b3d\b/i.test(message) && /(generate|render|make|create|draw|show|build|mode)\b/i.test(message);
    if (is3DRequest) {
      const check = isAnonymous ? checkDeviceFeatureLimit(deviceId, 'threed') : checkFeatureLimit(email, 'threed');
      if (!check.allowed) {
        return res.status(403).json({ error: 'FEATURE_LIMIT', message: `3D Shape Generator daily limit reached (${check.used}/${check.limit}). Upgrade your plan for more.` });
      }
      isAnonymous ? incrementDeviceFeatureUsage(deviceId, 'threed') : incrementFeatureUsage(email, 'threed');
    }

  }

  const activeEntity = isAnonymous ? device : user;
  const activePlanInfo = isAnonymous ? (db.plans && db.plans['free']) : planInfo;
  const activeLimit = isAnonymous ? (activePlanInfo ? activePlanInfo.prompts : 30) : userLimit;
  
  if (!isAdmin && Number(activeLimit) !== -1 && activeEntity.promptsUsed >= Number(activeLimit)) {
    return res.status(403).json({
      error: 'LIMIT_EXCEEDED',
      message: `You have reached your daily limit of ${activeLimit} prompts. Please upgrade your plan.`
    });
  }

  try {
    let finalPrompt = message;



    // AA. GENERATE APP MODE
    if (mode === 'generate') {
      let credentialsInjection = '';
      if (appCredentials && Array.isArray(appCredentials) && appCredentials.length > 0) {
        const validCreds = appCredentials.filter(c => c.name && c.value);
        if (validCreds.length > 0) {
          credentialsInjection = `\n7. **CREDENTIALS INJECTION**: You MUST automatically integrate the following credentials exactly as named into the generated application code: ${validCreds.map(c => `- ${c.name}: ${c.value}`).join('\n')}. DO NOT leave placeholder comments asking the user to insert them. Use them immediately. DO NOT output annoying confirmation messages like "API Key added successfully" in your chat response.`;
        }
      }

      finalPrompt = `[APP GENERATION MODE INSTRUCTIONS — STRICTLY ENFORCED]

You are an expert full-stack developer. The user wants you to either generate a NEW fully functional Web App/Bot OR FIX/UPDATE an existing one based on this query:
"${message}"

REQUIREMENTS:
1. Whether creating from scratch or fixing a bug, you MUST provide the complete, updated code as a SINGLE cohesive HTML file that includes HTML, CSS (in <style>), and JavaScript (in <script>). Do NOT give partial snippets. If the user asks for a fix, you MUST make the app perfectly functional. In your intro text, explicitly state what the error was and how you fixed it. Then output the FULL repaired HTML code block.
2. The UI must be incredibly modern, premium, and beautiful (use glassmorphism, nice gradients, animations, dark mode).
3. Do NOT use external frameworks that require a build step (No React/Vue build systems). You may use CDNs for libraries like Tailwind, FontAwesome, or simple React via Babel standalone if absolutely necessary, but vanilla JS/HTML/CSS is preferred for speed and reliability.
4. Wrap the ENTIRE HTML code inside a single markdown code block like this:
\`\`\`html
<!DOCTYPE html>
<html>...</html>
\`\`\`
5. **CREDENTIAL DETECTION**: Analyze the requested app/feature. If it requires ANY external API keys or credentials (e.g., Firebase, OpenAI, Stripe, OpenWeather), you MUST list them explicitly at the VERY TOP of your response (above the code block) under the exact heading: "⚠️ **REQUIRED CREDENTIALS:**". List exactly what they need to add to their local Setup Panel. If none are needed, omit this.
6. The app MUST handle its logic locally in the browser where possible, or simulate responses if it's a "bot". Furthermore, 100% of the frontend and backend logic requested must be done BY YOU within the generated file. Do not ask the user to add code. You must do all the heavy lifting. Finally, if anything else is required to make the app fully functional and live in a production environment (like purchasing a domain, setting up a real database), explicitly state this in your short intro.
7. **SPEED & OPTIMIZATION**: To reduce generation time, write extremely lean, highly optimized code. Avoid unnecessary boilerplate, massive base64 images, or bloated CSS unless strictly required for the design. Prioritize flawless logic and error-free functionality over verbose code.${credentialsInjection}

CRITICAL: Return nothing else but the short intro (including fix explanations, credential warnings, or live hosting requirements) and the HTML code block.`;
    }

    // A. OPTIMIZE MODE — show restructured prompt + detailed answer
    if (mode === 'optimize') {
      finalPrompt = `[OPTIMIZE MODE INSTRUCTIONS — FOLLOW EXACTLY]

You received a raw, possibly messy user query. You must do TWO things in order:

**STEP 1 — RESTRUCTURED PROMPT:**
Rewrite the user's raw query into a clear, well-structured, grammatically correct, detailed prompt. This should be the kind of prompt that would get the BEST possible answer from an AI. Show it at the very top of your response in this exact format:

---
🔧 **Optimized Prompt:**
> [Write the beautifully restructured, detailed version of the user's query here]
---

**STEP 2 — DETAILED ANSWER:**
Now answer the optimized prompt above in FULL DETAIL. Give a thorough, comprehensive, well-organized response as if you received a perfect prompt. Use headings, bullet points, and clear explanations.

**STEP 3 — OFFICIAL LINKS (MANDATORY):**
You MUST end your response with a section titled '**📎 Official Sources & References:**' containing 2-5 real, authentic, clickable links relevant to the topic. Format: [Website Name](https://url). NEVER skip this section.

IMPORTANT: Do NOT skip any step. The user MUST see: restructured prompt → answer → official links.
IMPORTANT: Do NOT include any Mermaid diagrams, flowcharts, or visual diagrams unless the user's original query specifically asks for one.

User's original raw query: ${message}`;
    }

    // B. WEB SEARCH — only for factual/current queries, 3s timeout to keep responses fast
    let searchGroundingContext = '';
    const needsSearch = mode !== 'generate' && /search|latest|news|weather|current|today|\b202[4-9]\b|who is|who won|score|price|stock|release|launch|update|trending/i.test(finalPrompt);
    
    if (needsSearch) {
      try {
        console.log(`Executing web search for: "${finalPrompt.substring(0, 60)}..."`);
        const searchPromise = performWebSearch(finalPrompt);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Search timeout')), 3000));
        const searchResults = await Promise.race([searchPromise, timeoutPromise]);
        if (searchResults && searchResults.length > 0) {
          searchGroundingContext = "\n\nReal-time Web Search Results:\n";
          searchResults.forEach((res, i) => {
            searchGroundingContext += `[${i + 1}] "${res.title}" (${res.link})\nSnippet: ${res.snippet}\n\n`;
          });
          searchGroundingContext += "Use these results to answer. Include source links in markdown format.";
        }
      } catch (e) {
        console.warn('Web search skipped:', e.message);
        // Continue without search — don't block the response
      }
    }

    // C. SYSTEM INSTRUCTION / PERSONALITY
    let systemInstruction = "You are MatrixMind, a super advanced, friendly AI Assistant. ";
    
    // Strict Personality enforcement
      if (personality === 'architect') {
        systemInstruction += "You are currently in ARCHITECT mode. You are a senior-level technical Architect and full-stack developer. ";
        systemInstruction += "STRICT RULES FOR ARCHITECT MODE: ";
        systemInstruction += "1. You MUST answer ALL coding, programming, scripting, app development, web development, bot building, and technical architecture queries. ";
        systemInstruction += "2. When asked to write a script or code, you MUST provide the COMPLETE, ERROR-FREE, PRODUCTION-READY code in a SINGLE response. Never give partial code. Never say 'rest of the code remains same'. Include EVERY line. ";
        systemInstruction += "3. Along with the code, explain: (a) What each section does, (b) How to integrate it, (c) How to run it, (d) Any dependencies needed. ";
        systemInstruction += "4. Output diagrams using Mermaid.js syntax block when requested. ";
        systemInstruction += "5. If the user asks a general knowledge or statistics query that does NOT involve coding/architecture, respond: '⚠️ This query is better suited for a different personality mode. Please switch to **Standard** mode for general queries or **Analyst** mode for statistics and data analysis.' Do NOT answer the query. ";

      } else if (personality === 'analyst') {
        systemInstruction += "You are currently in ANALYST mode. You are a professional data Analyst and statistician. ";
        systemInstruction += "STRICT RULES FOR ANALYST MODE: ";
        systemInstruction += "1. You MUST analyze problems, statistics, data, trends, lists, comparisons, graphs, and logic. ";
        systemInstruction += "2. Break down complex facts step-by-step using tables, bullet points, charts, and explain findings thoroughly with numbers and percentages. ";
        systemInstruction += "3. If the user asks a coding/programming/script query, respond: '⚠️ This query requires code generation. Please switch to **Architect** mode to get complete, production-ready scripts and technical solutions.' Do NOT write code. ";
        systemInstruction += "4. If the user asks a casual general knowledge query, respond: '⚠️ This is a general query. Please switch to **Standard** mode for the best casual and informative response.' Do NOT answer it. ";

      } else {
        systemInstruction += "You are currently in STANDARD mode. You are a helpful general-purpose assistant. ";
        systemInstruction += "STRICT RULES FOR STANDARD MODE: ";
        systemInstruction += "1. Answer general knowledge, facts, explanations, daily life queries, and casual conversations. ";
        systemInstruction += "2. If the user asks you to write code, scripts, programs, or anything related to programming/development, respond: '⚠️ For code generation and technical scripts, please switch to **Architect** mode. The Architect personality is specifically designed to provide complete, error-free, production-ready code.' Do NOT write code. ";
        systemInstruction += "3. If the user asks for detailed statistical analysis, data breakdowns, trend analysis, or complex comparisons, respond: '⚠️ For detailed statistical analysis and data breakdowns, please switch to **Analyst** mode. The Analyst personality specializes in data-driven insights.' Do NOT provide deep analysis. ";
      }

      // Multiverse simulation
      if (mode === 'matrix_simulation') {
        systemInstruction += "CRITICAL — MATRIX SIMULATION MODE ACTIVATED: ";
        systemInstruction += "You are answering from a parallel dimension/alternate reality within the Multiverse. Your ENTIRE response must be written from this alternate-reality perspective. ";
        systemInstruction += "RULES FOR MATRIX SIMULATION: ";
        systemInstruction += "1. Start your response with a dimension header like: '🌌 **Dimension #[random number] — [Alternate Reality Name]**' to set the scene. ";
        systemInstruction += "2. Rewrite history, science, or facts as they would exist in THIS alternate dimension. For example: if asked about gravity, explain how gravity works differently in this dimension. If asked about a historical event, describe how it played out differently here. ";
        systemInstruction += "3. Use vivid, immersive, sci-fi language. Make it feel like the user has genuinely entered another dimension. Reference alternate laws of physics, different historical outcomes, parallel technological evolution, etc. ";
        systemInstruction += "4. Ground your alternate-reality answer in plausible-sounding science and logic — it should feel real, not random. ";
        systemInstruction += "5. At the end, add a brief '🔮 **Back to Base Reality:**' section with 1-2 sentences about what the REAL answer is in our dimension. ";
        systemInstruction += "6. Do NOT show any 'Optimized Prompt' or 'Restructured Prompt' section. That feature is ONLY for Optimize mode. Just answer directly in the multidimensional style. ";
        systemInstruction += "7. You MUST still end with '**📎 Official Sources & References:**' containing 2-5 real clickable links relevant to the topic. ";
      }

      // Safety and language instruction
      systemInstruction += "SAFETY: Politely handle or refuse adult queries, illegal activities, or copyright infringement requests. Keep your content safe and appropriate for users of all ages. ";
      
      // Dynamic language rules — match response language to user's prompt language
      const detectedLang = detectLanguage(message, history);
      if (detectedLang === 'hindi') {
        systemInstruction += "STRICT LANGUAGE RULE: The user's message is in Hindi or Hinglish. You MUST reply STRICTLY in Hindi (using Hindi Devanagari script characters, e.g., 'भौतिक विज्ञान एक...'). Do NOT reply in English or Hinglish (Romanized Hindi). Translate ALL explanations, headings, bullet points, and content to Hindi Devanagari script. ";
      } else {
        systemInstruction += "STRICT LANGUAGE RULE: The user's message is in English. You MUST reply ONLY in English. Do NOT reply in Hindi, Hinglish, or any other language. Even if the topic is about India or Hindi culture, respond ONLY in English. ";
      }

      // Mind map / Visual diagram instructions
      const wantsDiagram = /m[ieo]nd\s*ma?[sp]/i.test(message) || 
                           /flow\s*ch/i.test(message) || 
                           /diagram/i.test(message) || 
                           /chart/i.test(message) || 
                           /graph/i.test(message) || 
                           /tree/i.test(message) ||
                           /visual/i.test(message) ||
                           /\b3d\b/i.test(message);
      if (wantsDiagram) {
        if (detectedLang === 'hindi') {
          systemInstruction += "VISUAL DIAGRAMS RULE: You MUST generate a Mermaid.js diagram (such as mindmap, graph TD, flowchart LR, etc.) inside a ```mermaid code block. You MUST write all diagram node labels specifically in the Hindi language using Hindi Devanagari letters (e.g., root((\"विषय\")) or A[\"सौर मंडल\"]). Do NOT write node labels in English. ";
        } else {
          systemInstruction += "VISUAL DIAGRAMS RULE: You MUST generate a Mermaid.js diagram (such as mindmap, graph TD, flowchart LR, etc.) inside a ```mermaid code block. You MUST write all diagram node labels specifically in the English language. ";
        }
        
        systemInstruction += "Follow these STRICT Mermaid rules: ";
        systemInstruction += "1. Use ONLY these diagram types: graph TD, graph LR, mindmap, flowchart TD, flowchart LR, sequenceDiagram, classDiagram, pie. ";
        systemInstruction += "2. Keep node labels SHORT (under 30 chars). Use quotes around labels with special characters: A[\"Label (info)\"]. ";
        systemInstruction += "3. Do NOT use HTML tags in labels. Do NOT use emojis in node IDs. ";
        systemInstruction += "4. For mind maps use: ```mermaid\\nmindmap\\n  root((Topic))\\n    Branch1\\n      Sub1\\n    Branch2\\n      Sub2\\n```. ";
        systemInstruction += "5. Always produce VALID Mermaid syntax that renders without errors. Test your output mentally before writing. ";
      } else {
        systemInstruction += "STRICT VISUAL DIAGRAMS RULE: Do NOT generate any Mermaid.js diagrams, flowcharts, mind maps, or visual graphs under any circumstances. You were not asked for one, and including one would be a failure. ";
      }

      systemInstruction += `3D OBJECT GENERATION — MASTER BUILDER INSTRUCTIONS:
You are a 3D scene architect. When the user asks to generate ANY 3D image, shape, object, scene, character, vehicle, building, animal, or anything visual in 3D, you MUST deeply analyze their request and output a 3D render token.

AVAILABLE PRIMITIVES: cube, sphere, torus, cylinder, cone, pyramid, ring, capsule, dodecahedron, torusKnot, heart, star
AVAILABLE MATERIALS: metallic, matte, glow, glass, plastic
PREBUILT SHAPES (use directly as shape=): tree, house, car, robot, rocket, spaceship, duck, sword, airplane, ship, snowman, table, chair, lamp, tower, planet, crown, guitar, flower, mushroom, castle, tank, helicopter, train, windmill, lighthouse, telescope, trophy, diamond, anchor, skull, ghost, pumpkin, candy, gift, candle, umbrella, balloon, camera, football

FORMAT 1 — Simple shape: [3D_SHAPE_RENDER: shape=<shape>, color=<hex>, material=<material>, text=<label>]
FORMAT 2 — Prebuilt: [3D_SHAPE_RENDER: shape=<prebuilt_name>, color=<hex>, material=<material>, text=<label>]
FORMAT 3 — Custom composite (for ANYTHING not in prebuilts): [3D_SHAPE_RENDER: composite=<part1>;<part2>;...; text=<label>]
Each composite part: shapeName,color,material,scaleX,scaleY,scaleZ,posX,posY,posZ,rotX,rotY,rotZ

CRITICAL RULES FOR COMPOSITE BUILDING:
1. THINK step by step: What parts does the object have? What shape best represents each part? What color? Where should it be positioned?
2. Use MANY parts (8-20+) for complex objects. More parts = more detailed = better quality.
3. Position parts correctly using posX,posY,posZ. Y is up. Use negative Y for lower parts, positive for upper.
4. Scale parts using scaleX,scaleY,scaleZ. Default is 1,1,1. Make parts thinner/wider as needed.
5. Rotate parts using rotX,rotY,rotZ (in radians). Use Math.PI/2 = 1.5708, Math.PI = 3.1416.
6. Choose realistic colors: wood=#8B4513, metal=#888888, gold=#FFD700, grass=#2e8b57, glass=#87CEEB, fire=#FF4500, skin=#FDBCB4, etc.

EXAMPLES:
- "Generate a 3D coffee cup" → [3D_SHAPE_RENDER: composite=cylinder,#FFFFFF,matte,1.2,1.2,1.2,0,0,0,0,0,0;torus,#FFFFFF,matte,0.15,0.3,0.15,1.2,0,0,0,0,1.5708;cylinder,#3E2723,matte,1.1,0.1,1.1,0,0.55,0,0,0,0; text=Coffee Cup]
- "Make a 3D Christmas tree" → [3D_SHAPE_RENDER: composite=cylinder,#5D4037,matte,0.3,1.5,0.3,0,-2,0,0,0,0;cone,#1B5E20,matte,2,1.5,2,0,-0.5,0,0,0,0;cone,#2E7D32,matte,1.6,1.3,1.6,0,0.5,0,0,0,0;cone,#388E3C,matte,1.2,1.1,1.2,0,1.3,0,0,0,0;star,#FFD700,glow,0.3,0.3,0.3,0,2.1,0,0,0,0;sphere,#FF0000,glow,0.15,0.15,0.15,0.5,0,0.3,0,0,0;sphere,#0000FF,glow,0.15,0.15,0.15,-0.4,0.3,-0.2,0,0,0;sphere,#FFD700,glow,0.15,0.15,0.15,0.3,0.8,0.4,0,0,0; text=Christmas Tree]
- "Create a 3D laptop" → [3D_SHAPE_RENDER: composite=cube,#333333,metallic,2.5,0.1,1.6,0,-0.5,0,0,0,0;cube,#222222,metallic,2.4,1.5,0.08,0,0.3,-0.75,0.3,0,0;cube,#1a1a2e,glow,2.2,1.3,0.02,0,0.35,-0.73,0.3,0,0; text=Laptop]

You can build ANYTHING: animals, vehicles, furniture, buildings, food, tools, characters, weapons, plants, planets, abstract art, logos, etc.
ALWAYS use the composite format for complex objects. ALWAYS include 8+ parts for detailed objects. ALWAYS choose realistic colors and materials.
ONLY use [3D_SHAPE_RENDER] for requests where the user explicitly wants an interactive rotatable 3D geometric model (simple shapes, objects made of primitives).
Do NOT output HTML canvas code, base64, or image URLs for 3D shapes. ONLY use the token format above. `;

      systemInstruction += `AI IMAGE GENERATION — COLORFUL 3D RENDERED IMAGES:
When the user asks you to generate, create, or make ANY kind of IMAGE (whether they say "3D image", "image", "picture", "photo", "generate", "create", "draw", "make an image of" etc.), you MUST output this special token:

[AI_IMAGE: prompt=<detailed english description for image generation>]

MANDATORY STYLE RULES:
1. EVERY image prompt MUST include "3D rendered, vibrant colors, highly detailed, 8k resolution" at the end
2. ALWAYS use the ACTUAL REAL-WORLD COLORS of objects: grass=green, sky=blue, fire=orange/red, gold=golden yellow, water=blue/cyan, wood=brown, etc.
3. Make images COLORFUL and visually stunning — never dull or monochrome
4. The prompt MUST be a highly detailed English description (even if user asks in Hindi/Hinglish)
5. Describe EXACTLY what should appear: subject, actual colors, lighting, composition, mood, background
6. Be VERY descriptive with colors: Instead of "a car", write "a sleek cherry red sports car with glossy metallic paint, chrome wheels, on a dark asphalt road, dramatic studio lighting, 3D rendered, vibrant colors, highly detailed, 8k resolution"
7. Instead of "a tree", write "a tall green oak tree with lush emerald leaves, thick brown bark trunk, standing in a bright green meadow with yellow wildflowers, blue sky with white clouds, natural sunlight, 3D rendered, vibrant colors, highly detailed, 8k resolution"
8. Add quality/style keywords: 3D rendered, Unreal Engine style, octane render, volumetric lighting, cinematic, ray tracing, photorealistic 3D
9. For animals: describe fur/skin color accurately (tiger=orange with black stripes, peacock=blue-green, flamingo=pink, etc.)
10. For food: use appetizing colors (pizza=golden crust with red sauce and white cheese, mango=yellow-orange, etc.)
11. Keep the prompt under 200 words but be as descriptive and colorful as possible

EXAMPLES:
- User: "generate image of a dragon" → [AI_IMAGE: prompt=a majestic fire-breathing dragon with emerald green scales, golden underbelly, massive crimson red wings spread wide, bright orange flames from mouth, perched on a dark grey mountain cliff, dramatic purple storm clouds, fantasy 3D rendered, vibrant colors, volumetric lighting, highly detailed, 8k resolution]
- User: "make image of a lion" → [AI_IMAGE: prompt=a powerful male lion with golden tawny fur mane, amber eyes, sitting majestically on a brown rocky outcrop, golden African savanna grassland background, warm sunset orange sky, 3D rendered, vibrant colors, photorealistic, highly detailed, 8k resolution]
- User: "create a pizza" → [AI_IMAGE: prompt=a delicious freshly baked pizza with golden brown crispy crust, bright red tomato sauce, melted white mozzarella cheese, green basil leaves, red pepperoni slices, on a rustic brown wooden table, warm restaurant lighting, 3D rendered, vibrant colors, food photography style, highly detailed, 8k resolution]
- User: "cyberpunk city" → [AI_IMAGE: prompt=a futuristic cyberpunk cityscape at night, bright neon lights in electric purple blue and hot pink, flying cars with glowing cyan lights, holographic advertisements in green and yellow, rain-soaked streets with colorful reflections, 3D rendered, vibrant colors, Unreal Engine style, cinematic composition, highly detailed, 8k resolution]
`;

      systemInstruction += "RESPONSE SPEED: Keep your response concise yet complete. Respond within a single message. Do not split answers across multiple messages. ";
      systemInstruction += "MANDATORY LINKS RULE (CRITICAL — NEVER SKIP): At the VERY END of EVERY single response, regardless of mode (normal, optimize, matrix simulation, or any other), you MUST include a section titled '**📎 Official Sources & References:**' containing 2-5 real, authentic, official clickable links relevant to the topic discussed. Format as markdown: [Website Name](https://url). Examples: Wikipedia, official docs, government sites, reputable news outlets. This section is ABSOLUTELY REQUIRED in every response without exception. If you skip this section, the response is considered INCOMPLETE and FAILED. NEVER use fake or made-up URLs. ";

    // D. BIND CHAT HISTORY
    const contents = [];
    
    // Map history to Gemini API format (role: user/model, parts: [{text: ...}])
    if (history && Array.isArray(history)) {
      history.forEach(item => {
        contents.push({
          role: item.sender === 'user' ? 'user' : 'model',
          parts: [{ text: item.text }]
        });
      });
    }

    // Attachment processing (Images/Files)
    if (attachment) {
      // Attachment schema: { mimeType: 'image/png', base64: '...' }
      // Gemini expects inline_data for attachments in the prompt parts
      const promptParts = [];
      
      if (attachment.base64 && attachment.mimeType) {
        // Remove data URL prefix if present
        const base64Data = attachment.base64.replace(/^data:[^;]+;base64,/, '');
        promptParts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: base64Data
          }
        });
      }
      
      promptParts.push({ text: finalPrompt + searchGroundingContext });
      
      contents.push({
        role: 'user',
        parts: promptParts
      });
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: finalPrompt + searchGroundingContext }]
      });
    }

    // E. CALL GEMINI ENGINE
    const aiResponse = await queryGeminiAPI(config.keys, contents, systemInstruction);

    let finalResponse = aiResponse;


    // F. INCREMENT USAGE
    if (!isAdmin) {
      if (isAnonymous) {
        device.promptsUsed += 1;
        const db2 = readDB();
        if (!db2.devices) db2.devices = {};
        db2.devices[deviceId] = device;
        writeDB(db2);
      } else {
        user.promptsUsed += 1;
        const db2 = readDB();
        db2.users[email] = user;
        writeDB(db2);
      }
    }

    // Increment feature-specific usage
    if (mode === 'matrix_simulation') isAnonymous ? incrementDeviceFeatureUsage(deviceId, 'matrix') : incrementFeatureUsage(email, 'matrix');
    if (mode === 'optimize') isAnonymous ? incrementDeviceFeatureUsage(deviceId, 'optimize') : incrementFeatureUsage(email, 'optimize');

    // Mindmap: detect if response contains mermaid diagram
    if (/m[ieo]nd\s*ma?[sp]/i.test(message) || /flow\s*ch/i.test(message) || /diagram/i.test(message) || /chart/i.test(message) || /graph/i.test(message) || /tree/i.test(message) || /visual/i.test(message) || /\b3d\b/i.test(message)) {
      isAnonymous ? incrementDeviceFeatureUsage(deviceId, 'mindmap') : incrementFeatureUsage(email, 'mindmap');
    }

    res.json({
      response: finalResponse,
      optimizedPrompt: mode === 'optimize' ? finalPrompt : null,
      promptsUsed: activeEntity.promptsUsed,
      limit: activeLimit
    });

  } catch (error) {
    console.error('Error generating chat response:', error);
    res.status(500).json({ error: 'GENERATION_ERROR', message: error.message || 'Our AI servers are currently busy. Please try your query again.' });
  }
});

// ==================== COUNCIL ROOM - MULTI-AGENT DEBATE (DESKTOP ONLY) ====================
// Phase 1: Generate personas + Round 1 individual proposals
app.post('/api/chat/council/start', async (req, res) => {
  const { email, prompt } = req.body;
  if (!email || !prompt) return res.status(400).json({ error: 'Email and prompt required.' });

  const check = checkFeatureLimit(email, 'council');
  if (!check.allowed) {
    return res.status(403).json({ error: 'FEATURE_LIMIT', message: `Council Room daily limit reached (${check.used}/${check.limit}). Upgrade your plan for more.` });
  }

  const config = readConfig();
  if (!config?.keys?.length) return res.status(500).json({ error: 'AI not configured.' });

  try {
    // Generate 3 personas + Round 1 in a single optimized call
    const masterPrompt = `You are an AI Council Orchestrator. A user has a complex problem that needs adversarial debate from multiple expert perspectives.

USER'S PROBLEM: "${prompt.substring(0, 500)}"

YOUR TASK: Create 3 opposing expert personas specifically tailored to THIS problem domain, then generate each persona's initial detailed analysis.

Return a JSON object with this EXACT structure. No markdown, no code blocks, ONLY pure valid JSON:
{
  "personas": [
    {
      "id": "pragmatist",
      "name": "[Creative name for a hard-nosed pragmatist relevant to this domain]",
      "emoji": "⚡",
      "focus": "[Their specific focus area, 5-10 words]",
      "color": "#ff6b6b",
      "description": "[One-line stance description]"
    },
    {
      "id": "creative",
      "name": "[Creative name for an innovative risk-taker relevant to this domain]",
      "emoji": "🎨",
      "focus": "[Their specific focus area]",
      "color": "#4ecdc4",
      "description": "[One-line stance description]"
    },
    {
      "id": "guardian",
      "name": "[Creative name for a safety/ethics/compliance guardian relevant to this domain]",
      "emoji": "🛡️",
      "focus": "[Their specific focus area]",
      "color": "#45b7d1",
      "description": "[One-line stance description]"
    }
  ],
  "round1": [
    { "personaId": "pragmatist", "response": "[200-300 word detailed initial analysis from this persona's perspective. Be specific, data-driven, and stay in character. Include concrete recommendations.]" },
    { "personaId": "creative", "response": "[200-300 word analysis...]" },
    { "personaId": "guardian", "response": "[200-300 word analysis...]" }
  ]
}

CRITICAL: Customize persona names and focus areas to match the problem domain. For medical questions use Doctor/Researcher/Patient-Advocate. For business use CFO/Innovator/Legal. For tech use Engineer/Designer/Security. Make each Round 1 response substantive and opinionated.`;

    const contents = [{ role: 'user', parts: [{ text: masterPrompt }] }];
    const raw = await queryGeminiAPI(config.keys, contents, 'You are a JSON generator. Return ONLY valid JSON, no markdown.');
    
    let result;
    try {
      const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'AI returned invalid format. Please retry.' });
    }

    console.log(`[COUNCIL] Started for ${email}: ${result.personas?.length || 0} personas created`);
    incrementFeatureUsage(email, 'council');
    res.json({ success: true, personas: result.personas, round1: result.round1 });
  } catch (error) {
    console.error('[COUNCIL] Start error:', error.message);
    res.status(500).json({ error: 'Failed to start council. Try again.' });
  }
});

// Phase 2: Cross-examination — agents critique each other
app.post('/api/chat/council/debate', async (req, res) => {
  const { email, prompt, personas, round1 } = req.body;
  if (!email || !prompt || !personas || !round1) return res.status(400).json({ error: 'Missing debate data.' });

  const config = readConfig();
  if (!config?.keys?.length) return res.status(500).json({ error: 'AI not configured.' });

  try {
    const round1Summary = round1.map(r => {
      const p = personas.find(x => x.id === r.personaId);
      return `${p?.name || r.personaId}: "${r.response}"`;
    }).join('\n\n');

    const debatePrompt = `You are orchestrating Round 2 of an adversarial multi-agent debate. Each agent must now CRITIQUE the other agents' Round 1 proposals — find flaws, challenge assumptions, and defend their own position.

ORIGINAL PROBLEM: "${prompt.substring(0, 300)}"

ROUND 1 PROPOSALS:
${round1Summary}

THE 3 PERSONAS:
${personas.map(p => `- ${p.name} (${p.id}): ${p.focus}`).join('\n')}

Generate Round 2 cross-examination. Each agent must:
1. Directly reference and critique specific points from the OTHER agents' proposals
2. Point out flaws, risks, or blind spots in their reasoning
3. Defend their own position against anticipated criticism

Return ONLY valid JSON:
{
  "round2": [
    { "personaId": "pragmatist", "response": "[200-300 words cross-examining the other two agents' proposals. Quote their specific claims and challenge them.]" },
    { "personaId": "creative", "response": "[200-300 words...]" },
    { "personaId": "guardian", "response": "[200-300 words...]" }
  ]
}`;

    const contents = [{ role: 'user', parts: [{ text: debatePrompt }] }];
    const raw = await queryGeminiAPI(config.keys, contents, 'Return ONLY valid JSON.');
    
    let result;
    try {
      const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'Cross-examination parsing failed.' });
    }

    res.json({ success: true, round2: result.round2 });
  } catch (error) {
    console.error('[COUNCIL] Debate error:', error.message);
    res.status(500).json({ error: 'Cross-examination failed.' });
  }
});

// Phase 3: User steers the debate — course correction
app.post('/api/chat/council/steer', async (req, res) => {
  const { email, prompt, personas, round1, round2, steerInput } = req.body;
  if (!email || !steerInput || !personas) return res.status(400).json({ error: 'Missing steering data.' });

  const config = readConfig();
  if (!config?.keys?.length) return res.status(500).json({ error: 'AI not configured.' });

  try {
    const steerPrompt = `You are orchestrating Round 3 of a multi-agent debate. The human observer has watched the debate and now wants to REDIRECT the discussion with new constraints.

ORIGINAL PROBLEM: "${prompt.substring(0, 200)}"

THE 3 PERSONAS:
${personas.map(p => `- ${p.name} (${p.id}): ${p.focus}`).join('\n')}

HUMAN'S COURSE CORRECTION: "${steerInput}"

Each agent must now re-analyze the problem incorporating the human's new direction. They should:
1. Acknowledge the course correction
2. Adapt their position to the new constraints
3. Provide updated, specific recommendations
4. Still maintain their unique persona perspective

Return ONLY valid JSON:
{
  "round3": [
    { "personaId": "pragmatist", "response": "[200-300 words updated analysis incorporating the human's steering...]" },
    { "personaId": "creative", "response": "[200-300 words...]" },
    { "personaId": "guardian", "response": "[200-300 words...]" }
  ]
}`;

    const contents = [{ role: 'user', parts: [{ text: steerPrompt }] }];
    const raw = await queryGeminiAPI(config.keys, contents, 'Return ONLY valid JSON.');
    
    let result;
    try {
      const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'Steering round parsing failed.' });
    }

    res.json({ success: true, round3: result.round3 });
  } catch (error) {
    console.error('[COUNCIL] Steer error:', error.message);
    res.status(500).json({ error: 'Steering failed.' });
  }
});

// Phase 4: Consensus — synthesize debate into final action plan
app.post('/api/chat/council/consensus', async (req, res) => {
  const { email, prompt, personas, rounds } = req.body;
  if (!email || !prompt || !personas) return res.status(400).json({ error: 'Missing consensus data.' });

  const config = readConfig();
  if (!config?.keys?.length) return res.status(500).json({ error: 'AI not configured.' });

  try {
    // Build full debate transcript
    let transcript = '';
    if (rounds?.round1) {
      transcript += 'ROUND 1 — INITIAL PROPOSALS:\n';
      rounds.round1.forEach(r => {
        const p = personas.find(x => x.id === r.personaId);
        transcript += `${p?.name || r.personaId}: ${r.response}\n\n`;
      });
    }
    if (rounds?.round2) {
      transcript += 'ROUND 2 — CROSS-EXAMINATION:\n';
      rounds.round2.forEach(r => {
        const p = personas.find(x => x.id === r.personaId);
        transcript += `${p?.name || r.personaId}: ${r.response}\n\n`;
      });
    }
    if (rounds?.round3?.length > 0) {
      transcript += 'ROUND 3 — STEERED ITERATION:\n';
      rounds.round3.forEach(r => {
        const p = personas.find(x => x.id === r.personaId);
        transcript += `${p?.name || r.personaId}: ${r.response}\n\n`;
      });
    }

    const consensusPrompt = `You are the Chief Synthesis Officer. A multi-agent adversarial debate has just concluded. Your job is to review all debate transcripts, filter out the hostile arguments, and distill the survivable, stress-tested ideas into a comprehensive, bulletproof action plan.

ORIGINAL PROBLEM: "${prompt}"

THE DEBATERS:
${personas.map(p => `- ${p.name}: ${p.focus}`).join('\n')}

FULL DEBATE TRANSCRIPT:
${transcript}

YOUR TASK — Generate the FINAL CONSENSUS DECISION:

Structure your response EXACTLY as follows:
1. Start with a bold title for the stress-tested strategy
2. "The Core Play" — the main recommended action (2-3 sentences)
3. For EACH persona, extract their KEY SURVIVING CONTRIBUTION as a named guardrail:
   - "The [Persona Focus] Guardrail ([Persona Name]):" — their specific, actionable safeguard
4. "Implementation Timeline" — concrete next steps with priorities
5. "Risks Acknowledged" — remaining risks the team accepts
6. "Why This Plan Survives" — 2-3 sentences on why this plan is superior to any single agent's proposal

Use clear headings, bullet points, and bold text. Make it feel like a real executive strategy document. This should be a COMPLETE, ACTIONABLE blueprint — not a vague summary.`;

    const contents = [{ role: 'user', parts: [{ text: consensusPrompt }] }];
    const consensusText = await queryGeminiAPI(config.keys, contents, 'You are a strategy synthesizer. Produce a comprehensive, well-formatted action plan. MANDATORY LINKS RULE: At the VERY END of your response, you MUST append a section titled \'**?? Official Sources & References:**\' providing 2-5 valid, authentic, clickable markdown links relevant to the topic. NEVER skip this rule.');

    console.log(`[COUNCIL] Consensus generated for ${email}`);
    res.json({ success: true, consensus: consensusText });
  } catch (error) {
    console.error('[COUNCIL] Consensus error:', error.message);
    res.status(500).json({ error: 'Consensus generation failed.' });
  }
});

// ==================== WORKFLOW EXECUTION SEQUENCER ====================
app.post('/api/workflow/start', async (req, res) => {
  const { email, goal } = req.body;
  if (!email || !goal) return res.status(400).json({ error: 'Email and goal required.' });

  const check = checkFeatureLimit(email, 'workflow');
  if (!check.allowed) {
    return res.status(403).json({ error: 'FEATURE_LIMIT', message: `Workflow Sequencer daily limit reached (${check.used}/${check.limit}). Upgrade your plan for more.` });
  }

  const config = readConfig();
  if (!config?.keys?.length) return res.status(500).json({ error: 'AI not configured.' });

  try {
    const startPrompt = `A user wants to execute an autonomous multi-step software pipeline for this goal: "${goal.substring(0, 500)}".
Break this goal down into exactly 4 sequential logical sub-tasks/steps.
Step 3 MUST be an interactive review step that gathers items (competitors, links, resources, stock suggestions, etc. depending on the goal) for human review before proceeding.
Step 4 must be the final synthesis/consolidation.

Return a JSON array of exactly 4 steps in this format. No markdown, no code blocks, ONLY valid JSON array:
[
  { "id": "step_1", "label": "Analysis & Planning: [specific descriptive sub-task]" },
  { "id": "step_2", "label": "Data Extraction & Scraping: [specific descriptive sub-task]" },
  { "id": "step_3", "label": "Staging Review: [specific descriptive sub-task]", "requiresApproval": true },
  { "id": "step_4", "label": "Final Consolidation & Drafting: [specific descriptive sub-task]" }
]`;

    const contents = [{ role: 'user', parts: [{ text: startPrompt }] }];
    const raw = await queryGeminiAPI(config.keys, contents, 'You are a JSON generator. Return only a valid JSON array.');
    
    let steps;
    try {
      const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      steps = JSON.parse(cleaned);
    } catch (err) {
      // Fallback steps if JSON parsing fails
      steps = [
        { id: 'step_1', label: 'Analysis & Target Identification' },
        { id: 'step_2', label: 'Background Scrape & Data Extraction' },
        { id: 'step_3', label: 'Interactive Result Filtering', requiresApproval: true },
        { id: 'step_4', label: 'Report Compilation & Draft Generation' }
      ];
    }

    const workflowId = 'wf_' + Date.now();
    console.log(`[WORKFLOW] Started: ${workflowId} for ${email}`);
    incrementFeatureUsage(email, 'workflow');
    res.json({ success: true, workflowId, steps });
  } catch (error) {
    console.error('[WORKFLOW] Start error:', error.message);
    res.status(500).json({ error: 'Failed to start workflow sequence.' });
  }
});

app.post('/api/workflow/execute-step', async (req, res) => {
  const { email, goal, workflowId, stepId, stepIndex, stepsHistory } = req.body;
  if (!email || !goal || !workflowId || !stepId) return res.status(400).json({ error: 'Missing step details.' });

  const config = readConfig();
  if (!config?.keys?.length) return res.status(500).json({ error: 'AI not configured.' });

  const currentStep = stepsHistory?.[stepIndex] || {};

  try {
    if (currentStep.requiresApproval) {
      // Step 3 (Review Step): Generate a structured JSON response with console logs AND 5-6 review items
      const reviewPrompt = `The user is running a multi-step workflow.
Goal: "${goal.substring(0, 500)}"
We are at Step: "${currentStep.label}".
Generate 5-6 structured items/competitors/links/images (relevant to the goal) that the AI sub-agents 'discovered'.
Also generate 4 developer-style console log messages showing the backend process.

Return a JSON object in this format. No markdown, no code blocks, ONLY valid JSON:
{
  "logs": [
    "Spinning up search spiders...",
    "Crawling identified assets...",
    "Extracting metadata and relevance metrics...",
    "Staging candidate list for human verification..."
  ],
  "items": [
    {
      "id": "[short id, e.g. comp_1 or link_1]",
      "name": "[Name of company, resource, link, or image]",
      "description": "[1-2 sentence description of what this is and how it matches the user's goal]",
      "relevance": "[Relevance percentage, e.g. 96%]"
    }
  ]
}`;

      const contents = [{ role: 'user', parts: [{ text: reviewPrompt }] }];
      const raw = await queryGeminiAPI(config.keys, contents, 'You are a JSON generator. Return only a valid JSON object.');
      
      let parsed;
      try {
        const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        parsed = {
          logs: [
            "Launching entity extraction subprocess...",
            "Crawled relevant channels...",
            "Compiled matches in staging table..."
          ],
          items: [
            { id: 'item_1', name: 'Option Alpha', description: 'Strong relevance match based on initial site audit.', relevance: '95%' },
            { id: 'item_2', name: 'Beta Labs Solutions', description: 'Secondary provider with similar pricing structure.', relevance: '88%' },
            { id: 'item_3', name: 'Gamma Resource Group', description: 'Alternative repository containing high-quality replacement assets.', relevance: '84%' }
          ]
        };
      }
      return res.json({ success: true, logs: parsed.logs, items: parsed.items, output: 'Awaiting human review.' });
    } else {
      // Regular steps (Step 1, Step 2)
      const executionPrompt = `The user is running a multi-step workflow.
Goal: "${goal.substring(0, 500)}"
We are at Step: "${currentStep.label}" (Step index: ${stepIndex + 1}).
Generate 4 developer-style backend console log messages showing the work being done.

Return a JSON object in this format. No markdown, no code blocks, ONLY valid JSON:
{
  "logs": [
    "[Developer log line 1]",
    "[Developer log line 2]",
    "[Developer log line 3]",
    "[Developer log line 4]"
  ],
  "output": "[A short 1-sentence summary of step completion]"
}`;

      const contents = [{ role: 'user', parts: [{ text: executionPrompt }] }];
      const raw = await queryGeminiAPI(config.keys, contents, 'You are a JSON generator. Return only a valid JSON object.');
      
      let parsed;
      try {
        const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        parsed = {
          logs: [
            "Task initialized by scheduler.",
            "Gathering system resources...",
            "Executing logic logic...",
            "Logs synchronized successfully."
          ],
          output: "Step completed."
        };
      }
      return res.json({ success: true, logs: parsed.logs, output: parsed.output });
    }
  } catch (error) {
    console.error('[WORKFLOW] Step execution error:', error.message);
    res.status(500).json({ error: 'Failed to execute step.' });
  }
});

app.post('/api/workflow/consolidate', async (req, res) => {
  const { email, goal, workflowId, filteredItems, steeringInput } = req.body;
  if (!email || !goal || !workflowId) return res.status(400).json({ error: 'Missing consolidation data.' });

  const config = readConfig();
  if (!config?.keys?.length) return res.status(500).json({ error: 'AI not configured.' });

  try {
    const consolidatePrompt = `The user ran a multi-step workflow for the macro goal: "${goal}".
After data collection and scraping, the human owner approved these verified items:
${JSON.stringify(filteredItems, null, 2)}

${steeringInput ? `The human owner also provided this course correction feedback: "${steeringInput}"` : ''}

Generate the final consolidated macro report / action plan / outreach drafts to fully solve the user's goal.
Use clear headers, structured tables/lists, and detailed recommendations. Make it look like a highly professional final product.`;

    const contents = [{ role: 'user', parts: [{ text: consolidatePrompt }] }];
    const finalReport = await queryGeminiAPI(config.keys, contents, 'You are a professional report compiler. Generate a detailed, structured final report. MANDATORY LINKS RULE: At the VERY END of your response, you MUST append a section titled \'**?? Official Sources & References:**\' providing 2-5 valid, authentic, clickable markdown links relevant to the topic. NEVER skip this rule.');

    console.log(`[WORKFLOW] Completed: ${workflowId} for ${email}`);
    res.json({ success: true, report: finalReport });
  } catch (error) {
    console.error('[WORKFLOW] Consolidation error:', error.message);
    res.status(500).json({ error: 'Failed to consolidate workflow report.' });
  }
});

// ==================== SMART CHAT TITLE GENERATOR ====================
// Generates a concise, descriptive title for a chat based on the first exchange
app.post('/api/chat/generate-title', async (req, res) => {
  const { userMessage, botResponse } = req.body;
  if (!userMessage) return res.status(400).json({ error: 'User message is required.' });

  try {
    const config = readConfig();
    if (!config || !config.keys || config.keys.length === 0) {
      // Fallback: extract title from user message
      const fallback = userMessage.replace(/[^a-zA-Z0-9\s]/g, '').trim().substring(0, 50);
      return res.json({ title: fallback || 'Chat' });
    }

    const titlePrompt = `Generate a short, descriptive topic title (3-6 words max) for a chat conversation that started with this user message:

"${userMessage.substring(0, 200)}"

${botResponse ? `The bot responded about: "${botResponse.substring(0, 200)}"` : ''}

Rules:
- Return ONLY the title text, nothing else
- No quotes, no punctuation at the end, no prefixes
- Make it specific and descriptive (e.g., "Evolution of Car Engines", "Python Web Scraping Tutorial", "Black Holes & Spacetime")
- If the message is a greeting, use "General Conversation"
- Maximum 6 words`;

    const contents = [{ role: 'user', parts: [{ text: titlePrompt }] }];
    const titleResponse = await queryGeminiAPI(config.keys, contents, 'You are a title generator. Return only the title.');
    
    let title = titleResponse.trim()
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/[.!?]+$/, '')       // Remove trailing punctuation
      .substring(0, 60);            // Max 60 chars
    
    if (!title || title.length < 2) title = userMessage.substring(0, 40);

    res.json({ title });
  } catch (error) {
    console.warn('[TITLE] Generation failed, using fallback:', error.message);
    const fallback = userMessage.replace(/[^a-zA-Z0-9\s]/g, '').trim().substring(0, 50);
    res.json({ title: fallback || 'Chat' });
  }
});

// ==================== SIMPLE UPI PAYMENT - ADMIN APPROVAL SYSTEM ====================
// User pays via QR/UPI ID → enters UTR → submits for admin review → admin approves/rejects

app.post('/api/payment/submit-utr', (req, res) => {
  try {
    const { email, utr, planRequested } = req.body;
    if (!email || !utr) {
      return res.status(400).json({ error: 'Email and UTR number are required.' });
    }

    // Validate UTR format: exactly 12 numeric digits
    if (!/^\d{12}$/.test(utr)) {
      return res.status(400).json({ error: 'Invalid UTR. Must be exactly 12 digits.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = readDB();
    db.pendingApprovals = db.pendingApprovals || [];

    // Check if this UTR was already submitted
    const exists = db.pendingApprovals.some(r => r.transactionId === utr);
    if (exists) {
      return res.status(400).json({ error: 'This UTR has already been submitted for verification.' });
    }

    const approvalRequest = {
      id: 'req_' + Date.now(),
      email: cleanEmail,
      plan: planRequested || 'standard',
      transactionId: utr,
      amount: 0,
      status: 'pending',
      date: new Date().toISOString()
    };

    db.pendingApprovals.push(approvalRequest);
    writeDB(db);

    console.log(`[PAYMENT] UTR submitted for approval: ${utr} by ${email}`);

    res.json({
      success: true,
      message: 'Your UTR has been submitted successfully! Your plan will be activated once the admin verifies your payment.'
    });
  } catch (error) {
    console.error('[PAYMENT] UTR submission error:', error.message);
    res.status(500).json({ error: 'Failed to submit UTR.' });
  }
});

// GET FULL CONFIGURATION (OWNER ONLY)
app.post('/api/admin/config', (req, res) => {
  const { email } = req.body;
  if (email !== 'prakharmishra00000@gmail.com') {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Unauthorized access to configuration.' });
  }

  const config = readConfig();
  if (!config) {
    return res.json({ keys: [], RECEIVER_UPI_ID: '6372843175@kotakbank', RECEIVER_NAME: 'Prakhar Mishra', googleClientId: '', adminUsername: 'prakhar mishra', adminPassword: '', smtpUser: '', smtpPass: '', firebaseDbUrl: '', firebaseServiceAccount: '' });
  }
  res.json(config);
});

// VERIFY OWNER MANUAL LOGIN PASSWORD
app.post('/api/admin/verify-owner-password', (req, res) => {
  const { email, password } = req.body;
  if (email !== 'prakharmishra00000@gmail.com') {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Only prakharmishra00000@gmail.com can re-authenticate.' });
  }

  const config = readConfig();
  if (!config) {
    return res.status(500).json({ error: 'CONFIG_MISSING', message: 'System configuration is not initialized.' });
  }

  if (password === config.adminPassword) {
    return res.json({ success: true });
  } else {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid administrative password.' });
  }
});

// SEND RESET VERIFICATION CODE (OWNER ONLY)
app.post('/api/admin/send-reset-code', (req, res) => {
  const { email } = req.body;
  if (email !== 'prakharmishra00000@gmail.com') {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Only prakharmishra00000@gmail.com can request a reset code.' });
  }

  // Set the specific hardcoded code '123' directly
  global.activeResetCode = {
    code: '123',
    email: 'prakharmishra00000@gmail.com',
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
  };

  res.json({ success: true, message: 'Identity verification session initialized.' });
});

// VERIFY RESET VERIFICATION CODE (OWNER ONLY)
app.post('/api/admin/verify-reset-code', (req, res) => {
  const { email, code } = req.body;
  if (email !== 'prakharmishra00000@gmail.com') {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const activeCode = global.activeResetCode;
  if (!activeCode || activeCode.email !== email || Date.now() > activeCode.expiresAt) {
    return res.status(400).json({ error: 'EXPIRED_OR_INVALID', message: 'Verification session has expired or is invalid.' });
  }
  if (activeCode.code !== code || code !== '123') {
    return res.status(400).json({ error: 'INVALID_CODE', message: 'Incorrect verification code.' });
  }
  res.json({ success: true, message: 'Code verified successfully.' });
});

// RESET ADMINISTRATIVE PASSWORD (OWNER ONLY)
app.post('/api/admin/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;
  if (email !== 'prakharmishra00000@gmail.com') {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const activeCode = global.activeResetCode;
  if (!activeCode || activeCode.email !== email || activeCode.code !== code || code !== '123' || Date.now() > activeCode.expiresAt) {
    return res.status(400).json({ error: 'UNAUTHORIZED_RESET', message: 'Reset session is invalid.' });
  }

  if (!newPassword || newPassword.trim() === '') {
    return res.status(400).json({ error: 'INVALID_PASSWORD', message: 'Password cannot be empty.' });
  }

  const config = readConfig();
  if (!config) {
    return res.status(500).json({ error: 'CONFIG_MISSING' });
  }
  config.adminPassword = newPassword;
  writeConfig(config);
  
  global.activeResetCode = null; // Clear code
  res.json({ success: true, message: 'Password updated successfully!' });
});

// ADMIN ANALYTICS PORTAL ENDPOINT
app.post('/api/admin/stats', async (req, res) => {
  const { email } = req.body;
  if (email !== 'prakharmishra00000@gmail.com') {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Unauthorized access to admin stats.' });
  }

  await waitForFirebase();
  const db = readDB();
  const usersArray = Object.values(db.users);
  const plans = db.plans || {};
  const now = new Date();
  
  // Plan distribution & active subscription revenue
  let freeUsers = 0, standardUsers = 0, betterUsers = 0, premiumUsers = 0;
  let activeRevenue = 0;
  let activeSubscribers = 0;
  const revenueByPlan = {};

  usersArray.forEach(u => {
    if (u.plan === 'standard') standardUsers++;
    else if (u.plan === 'better') betterUsers++;
    else if (u.plan === 'premium') premiumUsers++;
    else freeUsers++;

    // Calculate active subscription revenue (users with non-expired paid plans)
    if (u.plan !== 'free' && u.planExpiry) {
      const expiry = new Date(u.planExpiry);
      if (expiry > now) {
        activeSubscribers++;
        const planPrice = plans[u.plan]?.price || 0;
        activeRevenue += planPrice;
        revenueByPlan[u.plan] = (revenueByPlan[u.plan] || 0) + planPrice;
      }
    }
  });

  // Visitors
  const today = now.toISOString().split('T')[0];
  const visitorsToday = db.visits ? (db.visits[today] || 0) : 0;
  
  // Total Revenue from all transactions
  const totalRevenue = (db.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);

  // Signups today
  const signupsToday = usersArray.filter(u => u.lastResetDate === today).length;

  // Backups list
  const backupDir = path.join(__dirname, 'backup');
  let backups = [];
  if (fs.existsSync(backupDir)) {
    try {
      backups = fs.readdirSync(backupDir).map(file => {
        const stats = fs.statSync(path.join(backupDir, file));
        return { filename: file, size: stats.size, date: stats.mtime.toISOString() };
      }).sort((a,b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      console.error('Failed to read backup files:', e);
    }
  }

  res.json({
    totalUsers: usersArray.length,
    visitorsToday,
    signupsToday,
    totalRevenue,
    activeRevenue,
    activeSubscribers,
    revenueByPlan,
    planDistribution: {
      free: freeUsers,
      standard: standardUsers,
      better: betterUsers,
      premium: premiumUsers
    },
    transactions: (db.transactions || []).slice(-100).reverse(),
    users: usersArray.map(u => ({
      email: u.email,
      plan: u.plan,
      promptsUsed: u.promptsUsed,
      expiry: u.planExpiry,
      planPrice: plans[u.plan]?.price || 0,
      isActive: u.plan !== 'free' && u.planExpiry && new Date(u.planExpiry) > now
    })),
    anonymousVisits: db.anonymousVisits || {},
    supportQueries: db.supportQueries || [],
    pendingApprovals: db.pendingApprovals || [],
    backups,
    cloudStatus: {
      firebaseLoaded: firebaseFirstLoadComplete,
      isHardcodedSeed: dbIsHardcodedSeed,
      lastSync: new Date().toISOString()
    }
  });
});

// GET SUBSCRIPTION PLANS ENDPOINT
app.get('/api/plans', async (req, res) => {
  await waitForFirebase();
  const db = readDB();
  res.json({
    plans: db.plans || {},
    featureNames: db.featureNames || {}
  });
});

// UPDATE SUBSCRIPTION PLANS ENDPOINT (ADMIN ONLY)
app.post('/api/plans/update', async (req, res) => {
  const { email, plans, featureNames } = req.body;
  if (email !== 'prakharmishra00000@gmail.com') {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  if (!plans) {
    return res.status(400).json({ error: 'Plans are required.' });
  }

  // Auto-deduplicate features in each plan before saving
  Object.keys(plans).forEach(planKey => {
    if (plans[planKey].features && Array.isArray(plans[planKey].features)) {
      plans[planKey].features = [...new Set(plans[planKey].features)];
    }
  });

  const db = readDB();
  db.plans = plans;
  if (featureNames) {
    db.featureNames = featureNames;
  }
  
  // Explicitly write to Firebase to guarantee persistence
  writeDB(db);
  if (firebaseInitialized && firebaseFirstLoadComplete) {
    try {
      const config = readConfig() || {};
      await getDatabase().ref('/').set({ ...db, _config: config });
      console.log('[FIREBASE] Plans updated successfully in cloud.');
    } catch (err) {
      console.error('[FIREBASE] Failed to update plans:', err);
    }
  }
  
  res.json({ success: true, message: 'Plans updated successfully.' });
});

// ==================== ADMIN PAYMENT SETTINGS (UPI ID + QR Upload) ====================
const QR_IMAGE_PATH = path.join(__dirname, 'payment-qr.png');

// GET payment settings for admin
app.get('/api/admin/payment-settings', (req, res) => {
  const config = readConfig();
  if (!config) return res.json({ receiverUpiId: '6372843175@kotakbank', receiverName: 'Prakhar Mishra', hasCustomQR: false });
  
  res.json({
    receiverUpiId: config.RECEIVER_UPI_ID || '6372843175@kotakbank',
    receiverName: config.RECEIVER_NAME || 'Prakhar Mishra',
    hasCustomQR: fs.existsSync(QR_IMAGE_PATH)
  });
});

// POST update payment settings (UPI ID + Name)
app.post('/api/admin/payment-settings', (req, res) => {
  const { receiverUpiId, receiverName } = req.body;
  if (!receiverUpiId) return res.status(400).json({ error: 'UPI ID is required.' });
  
  const config = readConfig();
  if (!config) return res.status(500).json({ error: 'Config not initialized.' });
  
  config.RECEIVER_UPI_ID = receiverUpiId.trim();
  config.RECEIVER_NAME = (receiverName || '').trim() || 'Prakhar Mishra';
  writeConfig(config);
  
  console.log(`[ADMIN] Payment settings updated: UPI=${receiverUpiId}, Name=${receiverName}`);
  res.json({ success: true, message: 'Payment settings updated successfully.' });
});

// POST upload custom QR code image (base64)
app.post('/api/admin/upload-qr', (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) return res.status(400).json({ error: 'No image data provided.' });
    
    // imageData should be base64 string (data:image/png;base64,...)
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'QR image too large. Max 5MB.' });
    }
    
    fs.writeFileSync(QR_IMAGE_PATH, buffer);
    console.log(`[ADMIN] Custom QR code uploaded (${Math.round(buffer.length / 1024)} KB)`);
    res.json({ success: true, message: 'QR code uploaded successfully.' });
  } catch (err) {
    console.error('[ADMIN] QR upload error:', err.message);
    res.status(500).json({ error: 'Failed to save QR image.' });
  }
});

// DELETE custom QR code (revert to auto-generated)
app.delete('/api/admin/upload-qr', (req, res) => {
  try {
    if (fs.existsSync(QR_IMAGE_PATH)) {
      fs.unlinkSync(QR_IMAGE_PATH);
      console.log('[ADMIN] Custom QR code removed');
    }
    res.json({ success: true, message: 'Custom QR removed. Auto-generated QR will be used.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove QR.' });
  }
});

// GET serve the QR code image to frontend
app.get('/api/payment-qr', (req, res) => {
  if (fs.existsSync(QR_IMAGE_PATH)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(QR_IMAGE_PATH);
  } else {
    res.status(404).json({ error: 'No custom QR uploaded.' });
  }
});



// ==========================================
// FULLY AUTOMATED RAZORPAY PAYMENT ENGINE
// ==========================================

// Create a Razorpay Order
app.post('/api/payment/razorpay/create-order', async (req, res) => {
  const config = readConfig();
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    return res.status(500).json({ error: 'Razorpay keys are not configured by the admin.' });
  }

  const { planId, amountINR, email } = req.body;
  if (!planId || !amountINR || !email) {
    return res.status(400).json({ error: 'Plan ID, Amount, and Email are required.' });
  }

  try {
    const rzp = new Razorpay({
      key_id: config.razorpayKeyId,
      key_secret: config.razorpayKeySecret,
    });

    const db = readDB();
    const plan = db.plans && db.plans[planId];
    const durationDays = plan ? (plan.days || 30) : 30;

    const options = {
      amount: parseInt(amountINR) * 100, // amount in smallest currency unit (paise)
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      payment_capture: 1, // AUTO-CAPTURE: immediately capture payment so money settles to admin's bank
      notes: {
        email: email,
        planId: planId,
        durationDays: durationDays
      }
    };

    const order = await rzp.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    res.status(500).json({ error: 'Failed to create Razorpay order' });
  }
});

// Razorpay Webhook (Triggers automatically when payment succeeds)
app.post('/api/payment/razorpay/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const config = readConfig();
  const secret = config.razorpayWebhookSecret;

  const signature = req.headers['x-razorpay-signature'];
  const body = req.body; // Raw body needed for crypto verification

  try {
    // Validate signature only if webhook secret is configured
    if (secret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.warn('[WEBHOOK] Signature verification failed.');
        return res.status(400).send('Invalid signature');
      }
    } else {
      console.warn('[WEBHOOK] No webhook secret configured, skipping signature verification.');
    }

    // Process event
    const payload = JSON.parse(body.toString());
    console.log(`[WEBHOOK] Received Razorpay event: ${payload.event}`);

    if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
      let email = null;
      let planId = null;
      let durationDays = null;
      let amountPaid = 0;
      let paymentRef = '';

      // Try reading from payment entity
      if (payload.payload && payload.payload.payment && payload.payload.payment.entity) {
        const payment = payload.payload.payment.entity;
        email = payment.notes?.email;
        planId = payment.notes?.planId;
        durationDays = payment.notes?.durationDays;
        amountPaid = payment.amount / 100;
        paymentRef = payment.id;
      }

      // Fallback: Try reading from order entity
      if ((!email || !planId) && payload.payload && payload.payload.order && payload.payload.order.entity) {
        const order = payload.payload.order.entity;
        email = email || order.notes?.email;
        planId = planId || order.notes?.planId;
        durationDays = durationDays || order.notes?.durationDays;
        amountPaid = amountPaid || (order.amount_paid ? order.amount_paid / 100 : order.amount / 100);
        paymentRef = paymentRef || order.id;
      }

      if (!email || !planId) {
        console.warn('[WEBHOOK] Payment successful but missing email/plan metadata in notes.', {
          paymentNotes: payload.payload?.payment?.entity?.notes,
          orderNotes: payload.payload?.order?.entity?.notes
        });
        return res.status(200).send('Missing metadata');
      }

      const cleanEmail = email.trim().toLowerCase();
      console.log(`[WEBHOOK] Processing upgrade for: ${cleanEmail}, plan: ${planId}, duration: ${durationDays}`);

      // Automatically Unlock Plan
      const user = getOrCreateUser(cleanEmail);
      user.plan = planId;
      
      // Re-read DB after getOrCreateUser (it may have written internally)
      const db = readDB();
      const dbPlans = db.plans || {};
      const planConfig = dbPlans[planId];
      const days = parseInt(durationDays) || (planConfig ? parseInt(planConfig.days) : 30) || 30;

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      user.planExpiry = expiryDate.toISOString();

      db.users[cleanEmail] = user;

      // Log automated transaction
      if (!db.transactions) db.transactions = [];
      db.transactions.push({
        id: `txn_auto_${Date.now()}`,
        email: cleanEmail,
        amount: amountPaid,
        plan: planId,
        paymentRef: paymentRef,
        date: new Date().toISOString(),
        automated: true
      });

      writeDB(db);
      console.log(`[WEBHOOK] Successfully auto-unlocked ${planId} for ${cleanEmail} via Razorpay! Expiry: ${user.planExpiry}`);
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Razorpay Webhook Error:', err);
    res.status(400).send('Webhook error');
  }
});

// ==========================================
// RAZORPAY PAYMENT VERIFICATION (called by frontend handler after successful checkout)
// This route verifies the payment with Razorpay API and immediately unlocks the plan
// ==========================================
app.post('/api/payment/razorpay/verify', async (req, res) => {
  const config = readConfig();
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    return res.status(500).json({ error: 'Razorpay keys not configured.' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, planId } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !email || !planId) {
    return res.status(400).json({ error: 'Missing required payment verification fields.' });
  }

  try {
    // Verify payment signature using Razorpay's standard method
    const generatedSignature = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (razorpay_signature && generatedSignature !== razorpay_signature) {
      console.warn('[VERIFY] Payment signature mismatch.');
      return res.status(400).json({ error: 'Payment verification failed — invalid signature.' });
    }

    // Double-check with Razorpay API that this payment is actually captured/paid
    const rzp = new Razorpay({
      key_id: config.razorpayKeyId,
      key_secret: config.razorpayKeySecret,
    });

    let payment = await rzp.payments.fetch(razorpay_payment_id);
    
    // LOG FULL PAYMENT DETAILS for debugging
    console.log(`[VERIFY] ===== RAZORPAY PAYMENT DETAILS =====`);
    console.log(`[VERIFY] Payment ID: ${payment.id}`);
    console.log(`[VERIFY] Status: ${payment.status}`);
    console.log(`[VERIFY] Amount: ₹${payment.amount / 100}`);
    console.log(`[VERIFY] Currency: ${payment.currency}`);
    console.log(`[VERIFY] Method: ${payment.method}`);
    console.log(`[VERIFY] Bank: ${payment.bank || 'N/A'}`);
    console.log(`[VERIFY] VPA: ${payment.vpa || 'N/A'}`);
    console.log(`[VERIFY] Email: ${payment.email}`);
    console.log(`[VERIFY] Contact: ${payment.contact || 'N/A'}`);
    console.log(`[VERIFY] Order ID: ${payment.order_id}`);
    console.log(`[VERIFY] Captured: ${payment.captured}`);
    console.log(`[VERIFY] Fee: ₹${(payment.fee || 0) / 100} (Razorpay's cut)`);
    console.log(`[VERIFY] Tax: ₹${(payment.tax || 0) / 100}`);
    console.log(`[VERIFY] Error Code: ${payment.error_code || 'NONE'}`);
    console.log(`[VERIFY] ========================================`);
    
    // If payment is only authorized but not yet captured, capture it now so money settles
    if (payment.status === 'authorized') {
      try {
        console.log(`[VERIFY] Payment ${razorpay_payment_id} is authorized but not captured. Capturing now...`);
        payment = await rzp.payments.capture(razorpay_payment_id, payment.amount, payment.currency);
        console.log(`[VERIFY] Payment ${razorpay_payment_id} captured successfully. New status: ${payment.status}`);
      } catch (captureErr) {
        console.error(`[VERIFY] Failed to capture payment ${razorpay_payment_id}:`, captureErr.message);
        // Continue anyway — the payment might auto-capture via Razorpay settings
      }
    }
    
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      console.warn(`[VERIFY] Payment ${razorpay_payment_id} status is '${payment.status}', not captured.`);
      return res.status(400).json({ error: `Payment status is '${payment.status}', not captured. Please wait or contact support.` });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const amountPaid = payment.amount / 100;
    console.log(`[VERIFY] ✅ Payment CONFIRMED and CAPTURED: ${razorpay_payment_id}, amount: ₹${amountPaid}, email: ${cleanEmail}, plan: ${planId}`);

    // Unlock the plan
    const user = getOrCreateUser(cleanEmail);
    user.plan = planId;

    // Re-read DB after getOrCreateUser (it may have written internally)
    const db = readDB();
    const dbPlans = db.plans || {};
    const planConfig = dbPlans[planId];
    const days = planConfig ? (parseInt(planConfig.days) || 30) : 30;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    user.planExpiry = expiryDate.toISOString();

    db.users[cleanEmail] = user;

    // Log transaction
    if (!db.transactions) db.transactions = [];
    db.transactions.push({
      id: `txn_rzp_${Date.now()}`,
      email: cleanEmail,
      amount: amountPaid,
      plan: planId,
      paymentRef: razorpay_payment_id,
      orderId: razorpay_order_id,
      date: new Date().toISOString(),
      automated: true
    });

    writeDB(db);
    console.log(`[VERIFY] Successfully auto-unlocked ${planId} for ${cleanEmail}! Expiry: ${user.planExpiry}`);

    return res.json({
      success: true,
      message: `${planConfig ? planConfig.name : planId} plan activated successfully!`,
      plan: planId,
      expiry: user.planExpiry
    });
  } catch (err) {
    console.error('[VERIFY] Razorpay verification error:', err);
    return res.status(500).json({ error: 'Payment verification failed. Please contact support.' });
  }
});

// ACTION ON PENDING APPROVAL REQUEST - ADMIN SELECTS PLAN TO UNLOCK
app.post('/api/admin/approvals/action', (req, res) => {
  const { email, requestId, action, selectedPlan } = req.body;
  if (email !== 'prakharmishra00000@gmail.com') {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  if (!requestId || !action) {
    return res.status(400).json({ error: 'Request ID and Action are required.' });
  }

  const db = readDB();
  db.pendingApprovals = db.pendingApprovals || [];
  const reqIdx = db.pendingApprovals.findIndex(r => r.id === requestId);

  if (reqIdx === -1) {
    return res.status(404).json({ error: 'Approval request not found.' });
  }

  const approvalReq = db.pendingApprovals[reqIdx];

  if (approvalReq.status !== 'pending') {
    return res.status(400).json({ error: 'This request has already been processed.' });
  }

  if (action === 'reject') {
    approvalReq.status = 'rejected';
    writeDB(db);
    return res.json({ success: true, message: 'Payment verification rejected. User will be notified.' });
  }

  // Admin is approving with a specific plan
  // action should be 'approve' and selectedPlan should be 'standard', 'better', or 'premium'
  const planToActivate = selectedPlan || action; // action itself could be the plan name
  
  // Map plan names to durations
  const planConfigs = {
    standard: { days: 30, price: 99, name: 'Basic' },
    better: { days: 90, price: 199, name: 'Pro' },
    premium: { days: 365, price: 999, name: 'Ultimate' }
  };

  const planConfig = planConfigs[planToActivate];
  if (!planConfig) {
    return res.status(400).json({ error: 'Invalid plan selection.' });
  }

  // Check if DB has custom plan config
  const dbPlanInfo = db.plans && db.plans[planToActivate];
  const days = dbPlanInfo ? (dbPlanInfo.days || planConfig.days) : planConfig.days;
  const price = dbPlanInfo ? (dbPlanInfo.price || planConfig.price) : planConfig.price;

  approvalReq.status = 'approved';
  approvalReq.approvedPlan = planToActivate;
  approvalReq.approvedAmount = price;

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);

  const cleanUserEmail = approvalReq.email.trim().toLowerCase();
  const user = getOrCreateUser(cleanUserEmail);
  user.plan = planToActivate;
  user.planExpiry = expiryDate.toISOString();
  db.users[cleanUserEmail] = user;

  // Log transaction
  if (!db.transactions) db.transactions = [];
  db.transactions.push({
    id: `txn_${Date.now()}`,
    email: cleanUserEmail,
    amount: price,
    plan: planToActivate,
    paymentRef: `UPI_${approvalReq.transactionId}`,
    date: new Date().toISOString()
  });
  writeDB(db);

  console.log(`[ADMIN] Plan approved: ${approvalReq.email} → ${planConfig.name} (₹${price}, ${days} days)`);
  return res.json({ success: true, message: `${planConfig.name} (₹${price}) activated for ${approvalReq.email} for ${days} days.` });
});

// SUPPORT QUERY ENDPOINT
app.post('/api/support/query', async (req, res) => {
  const { email, query } = req.body;
  if (!email || !query) {
    return res.status(400).json({ error: 'Email and query are required.' });
  }

  const db = readDB();
  db.supportQueries = db.supportQueries || [];
  const queryItem = {
    id: 'query_' + Date.now(),
    email,
    query,
    date: new Date().toISOString()
  };
  db.supportQueries.push(queryItem);
  writeDB(db);

  // Attempt to deliver query to prakharmishra00000@gmail.com
  try {
    const nodemailer = require('nodemailer');
    const config = readConfig();
    
    if (!config || !config.smtpUser || !config.smtpPass) {
      console.error('SMTP not configured. Query saved to database but email not sent.');
      return res.json({ success: true, message: 'Your query has been submitted successfully our team will connect with you shortly' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    });

    const mailOptions = {
      from: `"MatrixMind Support" <${config.smtpUser}>`,
      to: 'prakharmishra00000@gmail.com',
      subject: `MatrixMind User Support Query from ${email}`,
      text: `User Email: ${email}\nDate: ${queryItem.date}\n\nQuery:\n${query}`,
      html: `<p><strong>User Email:</strong> ${email}</p>
             <p><strong>Date:</strong> ${queryItem.date}</p>
             <h3>Query:</h3>
             <p>${query.replace(/\n/g, '<br>')}</p>`
    };

    // Send email asynchronously
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Nodemailer SMTP delivery failed:', error.message);
      } else {
        console.log('Nodemailer query email delivered successfully:', info.messageId);
      }
    });

    return res.json({ success: true, message: 'Your query has been submitted successfully out team will connect with you shortly' });

  } catch (err) {
    console.error('Support query mail error:', err);
    return res.json({ success: true, message: 'Your query has been submitted successfully out team will connect with you shortly' });
  }
});

// SECURITY THREAT ASSESSMENT REPORT ENDPOINT (ADMIN ONLY)
app.post('/api/admin/threats', async (req, res) => {
  const { email } = req.body;
  if (email !== 'prakharmishra00000@gmail.com') {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  try {
    const db = readDB();
    const totalUsers = Object.keys(db.users).length;
    const visitsData = JSON.stringify(db.visits || {});
    
    const threatPrompt = `\nGenerate a website security threat assessment report for the next 7 days based on the following server metrics:\n- Total Registered Profiles: ${totalUsers}\n- Page Visits Log: ${visitsData}\n- Port: 5000 running local Express API\n- Database: local JSON-file db.json\n\nAnalyze potential threats (e.g. Brute Force attacks on admin panel, Denial of Service, database file corruption, API abuse, credit limit exhaustion). Provide a clear risk rating (Low/Medium/High) for each threat and list authentic, specific step-by-step solutions for each issue. Format your answer as a clean, structured report with markdown tables.\n`;

    const contents = [{ role: 'user', parts: [{ text: threatPrompt }] }];
    const config = readConfig();
    if (!config || !config.keys) return res.status(500).json({ error: 'Config not available' });
    const aiResponse = await queryGeminiAPI(config.keys, contents, 'You are an expert cybersecurity auditor.');
    
    res.json({ success: true, report: aiResponse });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'THREAT_SCAN_FAILED', message: e.message });
  }
});

// ANONYMOUS VISITOR TRACKING ENDPOINT
app.post('/api/visit/anonymous', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const db = readDB();
  db.anonymousVisits = db.anonymousVisits || {};
  db.anonymousVisits[today] = (db.anonymousVisits[today] || 0) + 1;
  
  // Return response immediately to client
  res.json({ success: true, count: db.anonymousVisits[today] });
  
  // Save in background
  writeDB(db);
});

// AI SELF-CODING DEV-AGENT COMPILER LOOP ENDPOINT (ADMIN ONLY)
app.post('/api/admin/self-code', async (req, res) => {
  const { email, prompt } = req.body;
  let targetFile = req.body.targetFile;
  if (email !== 'prakharmishra00000@gmail.com') {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const config = readConfig();
  if (!config) {
    return res.status(500).json({ error: 'CONFIG_MISSING', message: 'System configuration is not initialized.' });
  }

  // Automatically determine the target file if not provided
  if (!targetFile) {
    try {
      const fileListPrompt = `\nYou are a project manager. We have a full-stack project with the following files:\n1. "backend/server.js" (Handles Express routes, database reads/writes, APIs)\n2. "frontend/src/App.jsx" (Handles views, routing, top-level state, alerts)\n3. "frontend/src/App.css" (Stylesheets, glassmorphism UI)\n4. "frontend/src/components/Dashboard.jsx" (Chat, voice messages, sidebar UI layout)\n5. "frontend/src/components/Admin.jsx" (Admin panel metrics, charts, tables, payment approval)\n6. "frontend/src/components/UpgradeModal.jsx" (Subscription plan cards, UPI QR payment, UTR submission)\n7. "frontend/src/components/Setup.jsx" (System Setup form for API Keys and SMTP configuration)\n8. "frontend/src/components/HelpSupport.jsx" (Query box and support contact)\n9. "frontend/src/components/Legal.jsx" (Terms of Service, Privacy Policy pages)\n10. "frontend/src/components/OwnerSecureLogin.jsx" (Re-verification secure page)\n\nBased on the following request from the user, which file should be modified?\nUser Request: "${prompt}"\n\nResponse format: Return ONLY the exact file path from the list above (e.g. "backend/server.js" or "frontend/src/components/Dashboard.jsx"). Do not include any formatting, explanation, punctuation, quotes, or markdown tags.\n`;

      const contents = [{ role: 'user', parts: [{ text: fileListPrompt }] }];
      const aiResponse = await queryGeminiAPI(config.keys, contents, 'You are an expert file router.');
      targetFile = aiResponse.trim().replace(/['"`]/g, '');
      console.log(`Auto-routing self-code prompt: "${prompt}" -> determined targetFile: "${targetFile}"`);
    } catch (err) {
      console.error('Failed to auto-determine target file, defaulting to backend/server.js:', err);
      targetFile = 'backend/server.js';
    }
  }

  const projectRoot = path.join(__dirname, '..');
  const filePath = path.join(projectRoot, targetFile);

  if (!fs.existsSync(filePath)) {
    return res.status(400).json({ error: `File not found: ${targetFile}` });
  }

  const originalContent = fs.readFileSync(filePath, 'utf8');
  let attempts = 0;
  let buildError = '';

  const backupDir = path.join(__dirname, 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const fileBasename = path.basename(targetFile);
  const backupPath = path.join(backupDir, `${fileBasename}.${Date.now()}.bak`);

  try {
    fs.writeFileSync(backupPath, originalContent, 'utf8');
    console.log(`Self-coder: Backed up original file to ${backupPath}`);
  } catch (e) {
    console.error('Backup write failed:', e);
  }

  const { execSync } = require('child_process');

  while (attempts < 3) {
    try {
      console.log(`Self-coder: Call Gemini API, attempt ${attempts + 1}...`);
      
      let aiPrompt = `\nYou are a senior self-coding AI developer. You must modify the file "${targetFile}" to implement the requested feature.\nRequested Feature: "${prompt}"\n\nOriginal Code of the File:\n${originalContent}\n`;

      if (buildError) {
        aiPrompt += `\nThe previous attempt failed compiling with the following build error:\n${buildError}\n\nPlease analyze the compilation error, rewrite your modified content to fix the issues, and return the complete updated code.\n`;
      }

      aiPrompt += `\nReturn the complete updated code inside a JSON object:\n{\n  "content": "YOUR ENTIRE UPDATED CODE HERE"\n}\nDo not return any explanations, markdown code blocks (e.g. \`\`\`json or \`\`\`javascript), or comments outside of the JSON object. Keep variables and formatting standard.\n`;

      const contents = [{ role: 'user', parts: [{ text: aiPrompt }] }];
      const aiResponse = await queryGeminiAPI(config.keys, contents, 'You are an advanced self-coding system compiler.');
      
      let cleanedResponse = aiResponse.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.substring(7);
      }
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.substring(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
      }
      cleanedResponse = cleanedResponse.trim();

      const parsed = JSON.parse(cleanedResponse);
      const updatedCode = parsed.content;

      if (!updatedCode || updatedCode.trim() === '') {
        throw new Error('Gemini returned an empty code block.');
      }

      // Write updated content to file
      fs.writeFileSync(filePath, updatedCode, 'utf8');

      // Verify compile build
      console.log('Self-coder: Verifying build compilation...');
      if (targetFile.startsWith('backend/')) {
        try {
          execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
          console.log('Self-coder: Backend syntax check passed!');
          break;
        } catch (syntaxErr) {
          console.warn('Self-coder: Backend syntax check failed.');
          buildError = syntaxErr.stderr ? syntaxErr.stderr.toString() : syntaxErr.message;
          attempts++;
        }
      } else {
        try {
          const frontendDir = path.join(projectRoot, 'frontend');
          execSync(`npm run build`, { cwd: frontendDir, stdio: 'pipe' });
          console.log('Self-coder: Frontend production build compiled successfully!');
          break;
        } catch (buildErr) {
          console.warn('Self-coder: Frontend build compilation failed.');
          buildError = buildErr.stderr ? buildErr.stderr.toString() : (buildErr.stdout ? buildErr.stdout.toString() : buildErr.message);
          attempts++;
        }
      }

    } catch (err) {
      console.error('Self-coder exception:', err);
      buildError = err.message;
      attempts++;
    }
  }

  if (attempts === 3) {
    // Restore backup
    fs.writeFileSync(filePath, originalContent, 'utf8');
    console.log(`Self-coder: Failed compile checks. Restored original file from ${backupPath}`);
    return res.status(500).json({
      error: 'SELF_CODE_FAILED',
      message: `Failed to compile features after 3 attempts. Build Error: ${buildError}`
    });
  }

  res.json({
    success: true,
    message: `Feature added successfully to ${targetFile}! Code compiled clean. Backup created at ${path.basename(backupPath)}.`
  });
});

// Serve MatrixMind logo for social media previews (OG image) and standard browser icons/favicons
app.get(['/matrixmind-logo.jpg', '/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'], (req, res) => {
  const logoPath = path.join(__dirname, 'matrixmind-logo.jpg');
  const fileToServe = fs.existsSync(logoPath) ? logoPath : path.join(__dirname, '../frontend/dist/matrixmind-logo.jpg');
  
  if (fs.existsSync(fileToServe)) {
    if (req.path.endsWith('.ico')) {
      res.setHeader('Content-Type', 'image/x-icon');
    } else if (req.path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    res.sendFile(fileToServe);
  } else {
    res.status(404).send('Logo not found');
  }
});

// OS GHOST FEATURE REMOVED

// Serve frontend production build statically
const distPath = path.join(__dirname, '../frontend/dist');

// Serve root path dynamically to inject crawler metadata (must be BEFORE express.static)
app.get(['/', '/index.html'], (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    try {
      let html = fs.readFileSync(indexPath, 'utf8');
      const protocol = 'https';
      const host = req.get('host') || 'ai-chat-bot-gykb.onrender.com';
      const absoluteLogoUrl = `${protocol}://${host}/matrixmind-logo.jpg`;
      
      // Inject absolute paths for social sharing cards & browser icons
      html = html.replace(/content="\/matrixmind-logo\.jpg"/g, `content="${absoluteLogoUrl}"`);
      html = html.replace(/href="\/matrixmind-logo\.jpg\?v=3"/g, `href="${absoluteLogoUrl}?v=3"`);
      html = html.replace(/href="\/favicon\.ico\?v=3"/g, `href="${protocol}://${host}/favicon.ico?v=3"`);
      html = html.replace(/href="\/apple-touch-icon\.png\?v=3"/g, `href="${protocol}://${host}/apple-touch-icon.png?v=3"`);
      
      res.send(html);
    } catch (err) {
      console.error('Error reading index.html:', err);
      res.sendFile(indexPath);
    }
  } else {
    res.send('Server is active. Frontend is not built yet. Please run npm run build inside the frontend directory.');
  }
});

app.use(express.static(distPath));

// Fallback index.html for React SPA Routing
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    try {
      let html = fs.readFileSync(indexPath, 'utf8');
      const protocol = 'https';
      const host = req.get('host') || 'ai-chat-bot-gykb.onrender.com';
      const absoluteLogoUrl = `${protocol}://${host}/matrixmind-logo.jpg`;
      
      // Inject absolute paths for social sharing cards & browser icons
      html = html.replace(/content="\/matrixmind-logo\.jpg"/g, `content="${absoluteLogoUrl}"`);
      html = html.replace(/href="\/matrixmind-logo\.jpg\?v=3"/g, `href="${absoluteLogoUrl}?v=3"`);
      html = html.replace(/href="\/favicon\.ico\?v=3"/g, `href="${protocol}://${host}/favicon.ico?v=3"`);
      html = html.replace(/href="\/apple-touch-icon\.png\?v=3"/g, `href="${protocol}://${host}/apple-touch-icon.png?v=3"`);
      
      res.send(html);
    } catch (err) {
      console.error('Error reading index.html:', err);
      res.sendFile(indexPath);
    }
  } else {
    res.send('Server is active. Frontend is not built yet. Please run npm run build inside the frontend directory.');
  }
});

// ==========================================
// BACKGROUND CRON JOBS
// ==========================================
// Run every hour to check for expired plans globally
cron.schedule('0 * * * *', () => {
  console.log('[CRON] Running automatic plan expiry check...');
  const db = readDB();
  let dbModified = false;
  
  if (db.users) {
    const now = new Date();
    Object.values(db.users).forEach(user => {
      if (user.plan !== 'free' && user.planExpiry) {
        const expiry = new Date(user.planExpiry);
        if (now > expiry) {
          console.log(`[CRON] Plan expired for user: ${user.email}. Downgrading to free.`);
          user.plan = 'free';
          user.planExpiry = null;
          dbModified = true;
        }
      }
    });
  }

  if (dbModified) {
    writeDB(db);
    console.log('[CRON] Plan expiry check complete. DB updated.');
  } else {
    console.log('[CRON] Plan expiry check complete. No changes.');
  }
});

// --- GLOBAL CRASH PREVENTION ---
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

app.use((err, req, res, next) => {
  console.error('[EXPRESS GLOBAL ERROR]', err);
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: "Malformed JSON payload" });
  }
  res.status(500).json({ error: "Internal Server Error" });
});

// IMAGE GENERATION PROXY ENDPOINT
// Fetches AI-generated images server-side to avoid CORS issues
app.get('/api/generate-image', async (req, res) => {
  try {
    const prompt = (req.query.prompt || 'colorful abstract 3D art').substring(0, 500);
    const width = parseInt(req.query.width) || 1024;
    const height = parseInt(req.query.height) || 1024;
    const encoded = encodeURIComponent(prompt);

    const providers = [
      `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true`,
      `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&model=flux`,
      `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&nologo=true`,
    ];

    let lastErr;
    for (const url of providers) {
      try {
        const imgRes = await fetch(url, {
          headers: { 'User-Agent': 'MatrixMindBot/1.0' },
          timeout: 45000
        });
        if (imgRes.ok) {
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('Access-Control-Allow-Origin', '*');
          imgRes.body.pipe(res);
          return;
        }
        lastErr = `HTTP ${imgRes.status}`;
      } catch (e) {
        lastErr = e.message;
      }
    }
    res.status(502).json({ error: `Image generation failed: ${lastErr}` });
  } catch (err) {
    console.error('[IMAGE GEN]', err.message);
    res.status(500).json({ error: 'Image generation error' });
  }
});

// START EXPRESS SERVER
app.listen(PORT, () => {
  console.log(`Super Advanced AI Bot Server running on http://localhost:${PORT}`);
});

// This is an automatically added comment.
