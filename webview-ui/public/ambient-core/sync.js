// ---------- Conflict-Free State Merge & Cross-Sandbox Sync Adapter ----------
const AMBIENT_STORAGE_KEY = 'ambientThai.v2';

function normalizeSnd(val) {
  if (val === 'off' || val === 'dings' || val === 'voice') return val;
  if (val === false) return 'off';
  return 'dings';
}

function mergeStates(local = {}, remote = {}) {
  const mergedKnown = [...new Set([...(local.emoKnown || []), ...(remote.emoKnown || [])])];
  const mergedUnlocked = [...new Set([...(local.emoUnlocked || []), ...(remote.emoUnlocked || [])])];

  const mergedLastSeen = { ...(local.charLastSeen || {}) };
  for (const [k, v] of Object.entries(remote.charLastSeen || {})) {
    mergedLastSeen[k] = Math.max(mergedLastSeen[k] || 0, v || 0);
  }

  const newer = (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;

  return {
    ...local,
    ...remote,
    f: newer.f || local.f || 'modern',
    phoneticsMode: newer.phoneticsMode || local.phoneticsMode || 'real',
    clueMode: newer.clueMode || local.clueMode || 'mystery',
    m: newer.m || local.m || 'A',
    snd: normalizeSnd(newer.snd !== undefined ? newer.snd : local.snd),
    i: Math.max(local.i || 0, remote.i || 0),
    n: Math.max(local.n || 0, remote.n || 0),
    emoTurn: Math.max(local.emoTurn || 0, remote.emoTurn || 0),
    emoKnown: mergedKnown.length ? mergedKnown : ['ม', 'า', 'น', 'ก', 'ี'],
    emoUnlocked: mergedUnlocked,
    charLastSeen: mergedLastSeen,
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now())
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
    return mergeStates(currentState, remote);
  } catch (e) {
    return null;
  }
}

const AmbientSync = {
  vscodeApi: typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null,

  loadInitial(defaultState) {
    let loaded = {};
    try {
      loaded = JSON.parse(localStorage.getItem(AMBIENT_STORAGE_KEY) || '{}');
    } catch (e) {}
    return mergeStates(defaultState, loaded);
  },

  save(state) {
    state.updatedAt = Date.now();
    try {
      localStorage.setItem(AMBIENT_STORAGE_KEY, JSON.stringify(state));
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
    // Web Companion cross-tab storage listener
    window.addEventListener('storage', e => {
      if (e.key === AMBIENT_STORAGE_KEY && e.newValue) {
        try {
          const remote = JSON.parse(e.newValue);
          applyMergedState(mergeStates(getCurrentState(), remote));
        } catch (err) {}
      }
    });

    // Chrome Extension storage.sync listener
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get([AMBIENT_STORAGE_KEY], res => {
          if (res && res[AMBIENT_STORAGE_KEY]) {
            applyMergedState(mergeStates(getCurrentState(), res[AMBIENT_STORAGE_KEY]));
          }
        });
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'sync' && changes[AMBIENT_STORAGE_KEY]?.newValue) {
            applyMergedState(mergeStates(getCurrentState(), changes[AMBIENT_STORAGE_KEY].newValue));
          }
        });
      }
    } catch (e) {}

    // VS Code Extension message listener
    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'AMBIENT_RESTORE_STATE' && e.data.state) {
        applyMergedState(mergeStates(getCurrentState(), e.data.state));
      }
    });
  }
};
