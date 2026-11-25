// ---------- Conflict-Free Multi-Language State Merge & Cross-Sandbox Sync Adapter ----------
const AMBIENT_STORAGE_KEY = 'ambientLang.v3';
const LEGACY_STORAGE_KEY = 'ambientThai.v2';
const DEFAULT_KNOWN_GLYPHS = ['ม', 'า', 'น', 'ก', 'ี'];
const MAX_TERMS_PER_SHOW = 450;

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

function sanitizeStringList(arr, maxLen = 5000) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    if (typeof item === 'string' && item.length > 0 && !seen.has(item)) {
      seen.add(item);
      out.push(item);
      if (out.length >= maxLen) break;
    }
  }
  return out;
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

function sanitizeTerm(raw) {
  if (!isPlainObject(raw) || typeof raw.text !== 'string' || !raw.text.trim()) return null;
  const examples = [];
  if (Array.isArray(raw.examples)) {
    for (const ex of raw.examples.slice(0, 3)) {
      if (isPlainObject(ex) && typeof ex.src === 'string' && ex.src.trim()) {
        examples.push({
          src: ex.src.slice(0, 220),
          tgt: typeof ex.tgt === 'string' ? ex.tgt.slice(0, 220) : ''
        });
      }
    }
  }
  return {
    text: raw.text.trim().slice(0, 80),
    n: Math.min(3, Math.max(1, toSafeInt(raw.n, 1, 1))),
    count: toSafeInt(raw.count, 1, 1),
    gloss: typeof raw.gloss === 'string' ? raw.gloss.trim().slice(0, 120) : '',
    customGloss: typeof raw.customGloss === 'string' ? raw.customGloss.trim().slice(0, 120) : '',
    properScore: typeof raw.properScore === 'number' && Number.isFinite(raw.properScore) ? Math.max(0, Math.min(1, raw.properScore)) : 0,
    examples
  };
}

function sanitizeShow(raw) {
  if (!isPlainObject(raw) || typeof raw.id !== 'string' || !raw.id) return null;
  const episodes = [];
  if (Array.isArray(raw.episodes)) {
    for (const ep of raw.episodes.slice(-60)) {
      if (isPlainObject(ep) && typeof ep.title === 'string') {
        episodes.push({
          title: ep.title.slice(0, 120),
          importedAt: toSafeInt(ep.importedAt, 0, Date.now()),
          lineCount: toSafeInt(ep.lineCount, 0, 0)
        });
      }
    }
  }
  const terms = {};
  if (isPlainObject(raw.terms)) {
    let added = 0;
    for (const [k, v] of Object.entries(raw.terms)) {
      if (!k || added >= MAX_TERMS_PER_SHOW) break;
      const clean = sanitizeTerm(v);
      if (clean) {
        terms[k] = clean;
        added++;
      }
    }
  }
  return {
    id: raw.id.slice(0, 64),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Untitled Show',
    lang: typeof raw.lang === 'string' && raw.lang.trim() ? raw.lang.trim().slice(0, 16) : 'es-MX',
    episodeCount: Math.max(episodes.length, toSafeInt(raw.episodeCount, 0, episodes.length)),
    episodes,
    terms,
    updatedAt: toSafeInt(raw.updatedAt, 0, Date.now())
  };
}

function sanitizeMediaShows(rawShows) {
  const out = {};
  if (!isPlainObject(rawShows)) return out;
  for (const [id, raw] of Object.entries(rawShows)) {
    const clean = sanitizeShow(raw);
    if (clean) out[clean.id || id] = clean;
  }
  return out;
}

function sanitizeMediaProgress(rawProg) {
  const out = {};
  if (!isPlainObject(rawProg)) return out;
  for (const [k, v] of Object.entries(rawProg)) {
    if (!k || !isPlainObject(v)) continue;
    out[k] = {
      streak: toSafeInt(v.streak, 0, 0),
      seen: toSafeInt(v.seen, 0, 0),
      correct: toSafeInt(v.correct, 0, 0),
      wrong: toSafeInt(v.wrong, 0, 0),
      lastTurn: toSafeInt(v.lastTurn, 0, 0),
      stage: Math.min(2, toSafeInt(v.stage, 0, 0))
    };
  }
  return out;
}

function mergeShows(locShows, remShows) {
  const loc = sanitizeMediaShows(locShows);
  const rem = sanitizeMediaShows(remShows);
  const ids = new Set([...Object.keys(loc), ...Object.keys(rem)]);
  const merged = {};
  for (const id of ids) {
    const a = loc[id];
    const b = rem[id];
    if (!a) { merged[id] = b; continue; }
    if (!b) { merged[id] = a; continue; }
    const newer = b.updatedAt > a.updatedAt ? b : a;
    const older = newer === b ? a : b;
    const terms = { ...older.terms };
    for (const [tk, tv] of Object.entries(newer.terms)) {
      const prev = terms[tk];
      if (!prev) {
        terms[tk] = tv;
      } else {
        terms[tk] = {
          ...tv,
          count: Math.max(prev.count, tv.count),
          customGloss: tv.customGloss || prev.customGloss || '',
          gloss: tv.gloss || prev.gloss || '',
          examples: tv.examples.length ? tv.examples : prev.examples
        };
      }
    }
    merged[id] = {
      ...newer,
      episodeCount: Math.max(a.episodeCount, b.episodeCount),
      episodes: newer.episodes.length >= older.episodes.length ? newer.episodes : older.episodes,
      terms,
      updatedAt: Math.max(a.updatedAt, b.updatedAt)
    };
  }
  return merged;
}

function mergeMediaProgress(locProg, remProg, remIsNewer) {
  const a = sanitizeMediaProgress(locProg);
  const b = sanitizeMediaProgress(remProg);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = {};
  for (const k of keys) {
    const p1 = a[k];
    const p2 = b[k];
    if (!p1) { out[k] = p2; continue; }
    if (!p2) { out[k] = p1; continue; }
    const primary = (p2.lastTurn > p1.lastTurn || (p2.lastTurn === p1.lastTurn && remIsNewer)) ? p2 : p1;
    out[k] = {
      streak: primary.streak,
      seen: Math.max(p1.seen, p2.seen),
      correct: Math.max(p1.correct, p2.correct),
      wrong: Math.max(p1.wrong, p2.wrong),
      lastTurn: Math.max(p1.lastTurn, p2.lastTurn),
      stage: Math.max(p1.stage, p2.stage)
    };
  }
  return out;
}

function mergeStates(local, remote) {
  const loc = isPlainObject(local) ? local : {};
  const rem = isPlainObject(remote) ? remote : {};

  const mergedKnown = [...new Set([...sanitizeStringList(loc.emoKnown), ...sanitizeStringList(rem.emoKnown)])];
  const mergedUnlocked = [...new Set([...sanitizeUnlocked(loc.emoUnlocked), ...sanitizeUnlocked(rem.emoUnlocked)])];

  const locLastSeen = sanitizeIntMap(loc.charLastSeen, 0);
  const remLastSeen = sanitizeIntMap(rem.charLastSeen, 0);
  const mergedLastSeen = { ...locLastSeen };
  for (const [k, v] of Object.entries(remLastSeen)) {
    mergedLastSeen[k] = Math.max(mergedLastSeen[k] || 0, v);
  }

  const locUpdated = toSafeInt(loc.updatedAt, 0, 0);
  const remUpdated = toSafeInt(rem.updatedAt, 0, 0);
  const remIsNewer = remUpdated > locUpdated;
  const newer = remIsNewer ? rem : loc;

  const locFlaws = sanitizeIntMap(loc.flaws, 1, 9);
  const remFlaws = sanitizeIntMap(rem.flaws, 1, 9);
  const mergedFlaws = remIsNewer ? { ...locFlaws, ...remFlaws } : { ...remFlaws, ...locFlaws };

  const validFont = val => (val === 'modern' || val === 'looped' || val === 'mix' ? val : null);
  const validTrack = val => (val === 'thai' || val === 'media' || val === 'mix' ? val : null);
  const validStage = val => (val === 'auto' || val === 'recognize' || val === 'cloze' || val === 'listen' ? val : null);
  const validRatio = val => (val === '3:1' || val === '1:1' || val === '1:3' ? val : null);

  const mergedShows = mergeShows(loc.shows, rem.shows);
  const mergedIgnored = [...new Set([...sanitizeStringList(loc.mediaIgnored), ...sanitizeStringList(rem.mediaIgnored)])];
  const mergedProgress = mergeMediaProgress(loc.mediaProgress, rem.mediaProgress, remIsNewer);

  let activeShowId = newer.activeShowId !== undefined ? newer.activeShowId : loc.activeShowId;
  if (activeShowId !== 'all' && (!activeShowId || !mergedShows[activeShowId])) {
    const ids = Object.keys(mergedShows);
    activeShowId = ids.length ? ids[0] : 'all';
  }

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
    trackMode: validTrack(newer.trackMode) || validTrack(loc.trackMode) || 'thai',
    activeShowId,
    mixRatio: validRatio(newer.mixRatio) || validRatio(loc.mixRatio) || '3:1',
    mixTurn: Math.max(toSafeInt(loc.mixTurn, 0, 0), toSafeInt(rem.mixTurn, 0, 0)),
    freshBoost: toSafeInt(newer.freshBoost, 0, 0),
    mediaStage: validStage(newer.mediaStage) || validStage(loc.mediaStage) || 'auto',
    mediaMinCount: Math.min(5, Math.max(1, toSafeInt(newer.mediaMinCount, 1, toSafeInt(loc.mediaMinCount, 1, 2)))),
    mediaTurn: Math.max(toSafeInt(loc.mediaTurn, 0, 0), toSafeInt(rem.mediaTurn, 0, 0)),
    shows: mergedShows,
    mediaProgress: mergedProgress,
    mediaIgnored: mergedIgnored,
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
      const rawV3 = localStorage.getItem(AMBIENT_STORAGE_KEY);
      const rawV2 = !rawV3 ? localStorage.getItem(LEGACY_STORAGE_KEY) : null;
      const raw = rawV3 || rawV2;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isPlainObject(parsed)) {
          loaded = parsed;
        } else {
          localStorage.removeItem(rawV3 ? AMBIENT_STORAGE_KEY : LEGACY_STORAGE_KEY);
        }
      }
    } catch (e) {
      try { localStorage.removeItem(AMBIENT_STORAGE_KEY); } catch (err) {}
    }
    return mergeStates(defaultState, loaded);
  },

  save(state) {
    if (!isPlainObject(state)) return;
    state.updatedAt = Date.now();
    try {
      const serialized = JSON.stringify(state);
      this._lastSerialized = serialized;
      localStorage.setItem(AMBIENT_STORAGE_KEY, serialized);
    } catch (e) {}

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

    window.addEventListener('storage', e => {
      if (e.key === AMBIENT_STORAGE_KEY && e.newValue && e.newValue !== this._lastSerialized) {
        try {
          const remote = JSON.parse(e.newValue);
          const cur = getCurrentState();
          if (isPlainObject(remote) && isPlainObject(cur)) {
            if (toSafeInt(remote.updatedAt, 0, 0) <= toSafeInt(cur.updatedAt, 0, 0)) return;
          }
          safeApply(remote);
        } catch (err) {}
      }
    });

    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'AMBIENT_RESTORE_STATE' && e.data.state) {
        safeApply(e.data.state);
      }
    });
  }
};