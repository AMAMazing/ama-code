// ---------- Conflict-Free State Merge & Cross-Sandbox Sync Adapter ----------
const AMBIENT_STORAGE_KEY = 'ambientThai.v2';
const DEFAULT_KNOWN_GLYPHS = ['ม', 'า', 'น', 'ก', 'ี'];

function isPlainObject(val) {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

function toSafeInt(val, min = 0, fallback = 0) {
  return typeof val === 'number' && Number.isFinite(val) && val >= min ? Math.floor(val) : fallback;
}

function normalizeSnd(val) {
  if (val === 'off' || val === 'dings' || val === 'voice') return val;
  if (val === false) return 'off';
  return 'dings';
}

function sanitizeKnown(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter(c => typeof c === 'string' && c.length > 0))];
}

function sanitizeUnlocked(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter(id => typeof id === 'number' && Number.isInteger(id) && id >= 0))];
}

function sanitizeIntMap(obj, min = 0, max = Infinity) {
  const out = {};
  if (!isPlainObject(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (k && typeof v === 'number' && Number.isFinite(v) && v >= min) {
      out[k] = Math.min(Math.floor(v), max);
    }
  }
  return out;
}

function mergeStates(local, remote) {
  const loc = isPlainObject(local) ? local : {};
  const rem = isPlainObject(remote) ? remote : {};

  const mergedKnown = [...new Set([...sanitizeKnown(loc.emoKnown), ...sanitizeKnown(rem.emoKnown)])];
  const mergedUnlocked = [...new Set([...sanitizeUnlocked(loc.emoUnlocked), ...sanitizeUnlocked(rem.emoUnlocked)])];

  const locLastSeen = sanitizeIntMap(loc.charLastSeen, 0);
  const remLastSeen = sanitizeIntMap(rem.charLastSeen, 0);
  const mergedLastSeen = { ...locLastSeen };
  for (const [k, v] of Object.entries(remLastSeen)) {
    mergedLastSeen[k] = Math.max(mergedLastSeen[k] || 0, v);
  }

  const locUpdated = toSafeInt(loc.updatedAt, 0, 0);
  const remUpdated = toSafeInt(rem.updatedAt, 0, 0);
  const newer = remUpdated > locUpdated ? rem : loc;

  const locFlaws = sanitizeIntMap(loc.flaws, 1, 9);
  const remFlaws = sanitizeIntMap(rem.flaws, 1, 9);
  const mergedFlaws = remUpdated > locUpdated ? { ...locFlaws, ...remFlaws } : { ...remFlaws, ...locFlaws };

  const validFont = val => (val === 'modern' || val === 'looped' || val === 'mix' ? val : null);

  return {
    ...loc,
    ...rem,
    f: validFont(newer.f) || validFont(loc.f) || 'modern',
    phoneticsMode: (newer.phoneticsMode || loc.phoneticsMode) === 'literal' ? 'literal' : 'real',
    clueMode: (newer.clueMode || loc.clueMode) === 'learn' ? 'learn' : 'mystery',
    m: newer.m === 'B' ? 'B' : 'A',
    snd: normalizeSnd(newer.snd !== undefined ? newer.snd : loc.snd),
    i: Math.max(toSafeInt(loc.i, 0, 0), toSafeInt(rem.i, 0, 0)),
    n: Math.max(toSafeInt(loc.n, 0, 0), toSafeInt(rem.n, 0, 0)),
    emoTurn: Math.max(toSafeInt(loc.emoTurn, 0, 0), toSafeInt(rem.emoTurn, 0, 0)),
    lastFlawTurn: Math.max(toSafeInt(loc.lastFlawTurn, -1, -1), toSafeInt(rem.lastFlawTurn, -1, -1)),
    emoKnown: mergedKnown.length ? mergedKnown : [...DEFAULT_KNOWN_GLYPHS],
    emoUnlocked: mergedUnlocked,
    charLastSeen: mergedLastSeen,
    flaws: mergedFlaws,
    updatedAt: Math.max(locUpdated, remUpdated, Date.now())
  };
}

function exportSyncCode(state) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  } catch (e) {
    return '';
  }
}

function importSyncCode(code, currentState) {
  try {
    const remote = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!isPlainObject(remote)) return null;
    return mergeStates(currentState, remote);
  } catch (e) {
    return null;
  }
}

const AmbientSync = {
  vscodeApi: typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null,
  _lastSerialized: '',

  loadInitial(defaultState) {
    let loaded = {};
    try {
      const raw = localStorage.getItem(AMBIENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isPlainObject(parsed)) {
          loaded = parsed;
        } else {
          localStorage.removeItem(AMBIENT_STORAGE_KEY);
        }
      }
    } catch (e) {
      try {
        localStorage.removeItem(AMBIENT_STORAGE_KEY);
      } catch (err) {}
    }
    return mergeStates(defaultState, loaded);
  },

  save(state) {
    if (!isPlainObject(state)) return;
    state.updatedAt = Date.now();
    let serialized = '';
    try {
      serialized = JSON.stringify(state);
      this._lastSerialized = serialized;
      localStorage.setItem(AMBIENT_STORAGE_KEY, serialized);
    } catch (e) {}

    // Chrome Extension storage.sync adapter
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ [AMBIENT_STORAGE_KEY]: state });
      }
    } catch (e) {}

    // VS Code Webview globalState adapter
    try {
      if (this.vscodeApi) {
        this.vscodeApi.postMessage({ type: 'AMBIENT_SAVE_STATE', state });
      }
    } catch (e) {}
  },

  subscribe(getCurrentState, applyMergedState) {
    const safeApply = remote => {
      if (!isPlainObject(remote)) return;
      try {
        applyMergedState(mergeStates(getCurrentState(), remote));
      } catch (err) {}
    };

    // Web Companion cross-tab storage listener
    window.addEventListener('storage', e => {
      if (e.key === AMBIENT_STORAGE_KEY && e.newValue && e.newValue !== this._lastSerialized) {
        try {
          const remote = JSON.parse(e.newValue);
          const cur = getCurrentState();
          if (isPlainObject(remote) && isPlainObject(cur)) {
            const remUpdated = toSafeInt(remote.updatedAt, 0, 0);
            const curUpdated = toSafeInt(cur.updatedAt, 0, 0);
            const remUnl = Array.isArray(remote.emoUnlocked) ? remote.emoUnlocked.length : 0;
            const curUnl = Array.isArray(cur.emoUnlocked) ? cur.emoUnlocked.length : 0;
            if (remUpdated <= curUpdated && remUnl <= curUnl) return;
          }
          safeApply(remote);
        } catch (err) {}
      }
    });

    // Chrome Extension storage.sync listener
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get([AMBIENT_STORAGE_KEY], res => {
          if (res && res[AMBIENT_STORAGE_KEY]) {
            safeApply(res[AMBIENT_STORAGE_KEY]);
          }
        });
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'sync' && changes[AMBIENT_STORAGE_KEY] && changes[AMBIENT_STORAGE_KEY].newValue) {
            safeApply(changes[AMBIENT_STORAGE_KEY].newValue);
          }
        });
      }
    } catch (e) {}

    // VS Code Extension message listener
    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'AMBIENT_RESTORE_STATE' && e.data.state) {
        safeApply(e.data.state);
      }
    });
  }
};