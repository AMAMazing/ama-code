// ---------- Unified Multi-Language State & Persistence ----------
let st = AmbientSync.loadInitial({
  i: 0,
  n: 0,
  m: 'A',
  snd: 'dings',
  f: 'modern',
  phoneticsMode: 'real',
  clueMode: 'mystery',
  emoKnown: ['ม', 'า', 'น', 'ก', 'ี'],
  emoUnlocked: [],
  charLastSeen: {},
  flaws: {},
  lastFlawTurn: -1,
  emoTurn: 0,
  trackMode: 'thai',
  activeShowId: 'all',
  mixRatio: '3:1',
  mixTurn: 0,
  freshBoost: 0,
  mediaStage: 'auto',
  mediaMinCount: 2,
  mediaTurn: 0,
  shows: {},
  mediaProgress: {},
  mediaIgnored: [],
  updatedAt: Date.now()
});

function sanitizeRuntimeState(state) {
  state.flaws = state.flaws && typeof state.flaws === 'object' ? state.flaws : {};
  state.charLastSeen = state.charLastSeen && typeof state.charLastSeen === 'object' ? state.charLastSeen : {};
  state.i = Number.isFinite(state.i) && state.i >= 0 ? Math.floor(state.i) : 0;
  state.n = Number.isFinite(state.n) && state.n >= 0 ? Math.floor(state.n) : 0;
  state.emoTurn = Number.isFinite(state.emoTurn) && state.emoTurn >= 0 ? Math.floor(state.emoTurn) : 0;
  state.lastFlawTurn = Number.isFinite(state.lastFlawTurn) && state.lastFlawTurn >= -1 ? Math.floor(state.lastFlawTurn) : -1;
  state.emoUnlocked = Array.isArray(state.emoUnlocked) ? state.emoUnlocked : [];
  state.emoKnown = Array.isArray(state.emoKnown) && state.emoKnown.length ? state.emoKnown : ['ม', 'า', 'น', 'ก', 'ี'];
  state.shows = state.shows && typeof state.shows === 'object' ? state.shows : {};
  state.mediaProgress = state.mediaProgress && typeof state.mediaProgress === 'object' ? state.mediaProgress : {};
  state.mediaIgnored = Array.isArray(state.mediaIgnored) ? state.mediaIgnored : [];
  state.trackMode = ['thai', 'media', 'mix'].includes(state.trackMode) ? state.trackMode : 'thai';
  state.mixRatio = ['3:1', '1:1', '1:3'].includes(state.mixRatio) ? state.mixRatio : '3:1';
  state.mediaStage = ['auto', 'recognize', 'cloze', 'listen'].includes(state.mediaStage) ? state.mediaStage : 'auto';
  state.mediaMinCount = Number.isFinite(state.mediaMinCount) ? Math.min(5, Math.max(1, Math.floor(state.mediaMinCount))) : 2;
  if ((state.emoTurn > 0 || state.emoUnlocked.length > 0) && state.i < TUT_DECK.length) {
    state.i = TUT_DECK.length;
  }
}

sanitizeRuntimeState(st);
window.AMBIENT_PHONETICS_MODE = st.phoneticsMode || 'real';

const unlockedSet = new Set(st.emoUnlocked);
const emoKnownSet = new Set(st.emoKnown);

function inTutorial() { return st.i < TUT_DECK.length; }
function seedTutorialGlyphs() {
  for (const step of TUT_DECK) if (step[0] === 'i') emoKnownSet.add(step[1]);
}
if (!inTutorial()) seedTutorialGlyphs();

const save = () => {
  st.emoUnlocked = [...unlockedSet];
  st.emoKnown = [...emoKnownSet];
  window.AMBIENT_PHONETICS_MODE = st.phoneticsMode;
  AmbientSync.save(st);
};

AmbientSync.subscribe(
  () => st,
  merged => {
    st = merged;
    sanitizeRuntimeState(st);
    unlockedSet.clear();
    st.emoUnlocked.forEach(id => unlockedSet.add(id));
    emoKnownSet.clear();
    st.emoKnown.forEach(c => emoKnownSet.add(c));
    if (!inTutorial()) seedTutorialGlyphs();
    window.AMBIENT_PHONETICS_MODE = st.phoneticsMode;
    syncAllUI();
    updateHeaderCounts();
  }
);

// ---------- Audio Synth & Multi-Language TTS ----------
let ac = null;
let thVoice = null;

function initVoices() {
  if (typeof speechSynthesis === 'undefined') return;
  try {
    const voices = speechSynthesis.getVoices();
    thVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('th')) || null;
  } catch (e) {}
}
if (typeof speechSynthesis !== 'undefined') {
  initVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = initVoices;
}

function getAudioContext() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (ac && ac.state === 'closed') ac = null;
    ac = ac || new Ctor();
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  } catch (e) { return null; }
}

function closeAudioResources() {
  try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch (e) {}
  try { if (ac && ac.state !== 'closed' && typeof ac.close === 'function') ac.close().catch(() => {}); } catch (e) {}
  ac = null;
}
window.addEventListener('pagehide', closeAudioResources);
window.addEventListener('beforeunload', closeAudioResources);

function playNote(freq, duration, vol = 0.07, delay = 0, type = 'triangle') {
  if (st.snd === 'off') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  } catch (e) {}
}

function speakThai(thText, force = false) {
  if (!force && st.snd !== 'voice') return;
  if (typeof speechSynthesis === 'undefined' || !thText) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(thText);
    u.lang = 'th-TH';
    u.rate = 0.92;
    if (!thVoice) initVoices();
    if (thVoice) u.voice = thVoice;
    speechSynthesis.speak(u);
  } catch (e) {}
}

const ping = thToSpeak => {
  if (st.snd === 'off') return;
  if (st.snd === 'voice' && thToSpeak) {
    playNote(523.25, 0.22, 0.035, 0);
    playNote(783.99, 0.32, 0.04, 0.06);
    setTimeout(() => speakThai(thToSpeak), 90);
  } else {
    playNote(523.25, 0.28, 0.06, 0.00);
    playNote(659.25, 0.32, 0.06, 0.055);
    playNote(783.99, 0.38, 0.065, 0.11);
    playNote(1046.50, 0.52, 0.055, 0.17);
  }
};

const tick = () => {
  if (st.snd === 'off') return;
  playNote(420, 0.032, 0.03, 0, 'sine');
};

const soft = () => {
  if (st.snd === 'off') return;
  playNote(220, 0.14, 0.045, 0, 'sine');
  playNote(174.61, 0.22, 0.04, 0.065, 'sine');
};

// ---------- Game Loop, Media Engine & View State ----------
let cur, buf = '', rows = [], misses = 0, solved = false, hint = false, keyst = {}, locked = false, lastFlawTip = '', feed = [];
let lastMediaKey = '';
let nextTimer = null;
let viewMode = 'play'; // 'play' | 'trophy' | 'library'
let trFilter = 'all', trQuery = '', trLimit = 180, selectedTrophy = EMOJI_DB[0];

const FONTS = {
  modern: '"Noto Sans Thai","Leelawadee UI","Thonburi","Sarabun",sans-serif',
  looped: '"Noto Sans Thai Looped","Noto Sans Thai","Leelawadee UI","Thonburi",sans-serif'
};

function clearPendingNext() {
  if (nextTimer !== null) {
    clearTimeout(nextTimer);
    nextTimer = null;
  }
}

function applyTurnFont() {
  const activeFont = st.f === 'mix'
    ? (st.n % 2 === 0 ? FONTS.modern : FONTS.looped)
    : (FONTS[st.f] || FONTS.modern);
  document.documentElement.style.setProperty('--thf', activeFont);
}

function isMediaStep(step) {
  return Boolean(step && (step[0] === 'm' || step[0] === 'm-empty'));
}

function getThaiStep() {
  if (inTutorial()) {
    const raw = TUT_DECK[st.i];
    if (raw) {
      if (raw[0] === 'i') {
        emoKnownSet.add(raw[1]);
        return raw;
      }
      const rom = romanizeThai(raw[1], st.phoneticsMode);
      return ['w', raw[1], rom, raw[3], raw[4] || null, false];
    }
    st.i = TUT_DECK.length;
  }
  return ThaiCoach.pickFlawAwareEmojiStep(st, unlockedSet, emoKnownSet, save);
}

function getStep() {
  const activeTrack = typeof MediaEngine !== 'undefined' ? MediaEngine.pickTrackForTurn(st) : 'thai';
  if (activeTrack === 'media' && typeof MediaEngine !== 'undefined') {
    return MediaEngine.pickNextMediaStep(st, lastMediaKey);
  }
  return getThaiStep();
}

function updateHeaderCounts() {
  const tc = document.getElementById('trophcnt');
  if (tc) tc.textContent = `${unlockedSet.size}/${EMOJI_DB.length}`;

  const readyCards = typeof MediaEngine !== 'undefined' ? MediaEngine.getAllReadyCards(st).length : 0;
  const lc = document.getElementById('libcnt');
  if (lc) lc.textContent = readyCards > 0 ? String(readyCards) : '+';

  const cnt = document.getElementById('cnt');
  if (!cnt) return;
  if (st.trackMode === 'media') {
    const shows = typeof MediaEngine !== 'undefined' ? MediaEngine.getShowsList(st).length : 0;
    cnt.textContent = shows ? `${readyCards} cards` : 'upload .md';
  } else if (st.trackMode === 'mix') {
    cnt.textContent = st.freshBoost > 0 ? `⚡ boost (${st.freshBoost})` : `${emoKnownSet.size}th · ${readyCards}m`;
  } else if (inTutorial()) {
    cnt.textContent = `tut ${st.i + 1}/${TUT_DECK.length}`;
  } else {
    cnt.textContent = `${emoKnownSet.size}/${Object.keys(U).length} glyphs`;
  }
}

function openSyncPrompt() {
  const code = exportSyncCode(st);
  const input = prompt('Copy your 1-Click Sync Code, or paste a code from another device to merge progress:', code);
  if (input && input !== code) {
    const merged = importSyncCode(input, st);
    if (merged) {
      st = merged;
      sanitizeRuntimeState(st);
      unlockedSet.clear();
      st.emoUnlocked.forEach(id => unlockedSet.add(id));
      emoKnownSet.clear();
      st.emoKnown.forEach(c => emoKnownSet.add(c));
      save();
      syncAllUI();
      draw();
    }
  }
}

function replayMediaAudio() {
  if (!cur || cur[0] !== 'm') return;
  const { card, stage } = cur[1];
  const prog = (st.mediaProgress && st.mediaProgress[card.cardKey]) || null;
  const rate = stage === 2 && prog && prog.streak >= 4 ? 1.06 : 0.94;
  MediaEngine.speakLang(card.text, card.lang, rate);
}

function answerMedia(choiceIdx) {
  if (!cur || cur[0] !== 'm') return;
  const data = cur[1];
  if (data.answeredIdx >= 0) return;
  const chosen = data.choices[choiceIdx];
  if (!chosen) return;

  data.answeredIdx = choiceIdx;
  data.correct = Boolean(chosen.correct);
  solved = true;

  const key = data.card.cardKey;
  const prev = st.mediaProgress[key] || { streak: 0, seen: 0, correct: 0, wrong: 0, lastTurn: 0, stage: 0 };
  const nextStreak = data.correct ? prev.streak + 1 : 0;
  st.mediaProgress[key] = {
    streak: nextStreak,
    seen: prev.seen + 1,
    correct: prev.correct + (data.correct ? 1 : 0),
    wrong: prev.wrong + (data.correct ? 0 : 1),
    lastTurn: st.mediaTurn,
    stage: nextStreak >= 3 ? 2 : nextStreak >= 1 ? 1 : 0
  };
  save();

  if (data.correct) {
    playNote(523.25, 0.22, 0.05, 0);
    playNote(783.99, 0.34, 0.055, 0.07);
    if (st.snd === 'voice') setTimeout(() => replayMediaAudio(), 90);
    draw('pop');
  } else {
    soft();
    if (st.snd !== 'off') setTimeout(() => replayMediaAudio(), 110);
    draw();
  }
}

function ignoreMediaTerm(card) {
  if (!card) return;
  if (!st.mediaIgnored.includes(card.cardKey)) st.mediaIgnored.push(card.cardKey);
  save();
  if (viewMode === 'library') draw();
  else render();
}

function editMediaGloss(card) {
  if (!card || !st.shows || !st.shows[card.showId]) return;
  const term = st.shows[card.showId].terms && st.shows[card.showId].terms[card.key];
  if (!term) return;
  const nextGloss = prompt(`Set English meaning for “${card.text}”:`, term.customGloss || term.gloss || '');
  if (nextGloss === null) return;
  term.customGloss = nextGloss.trim().slice(0, 120);
  st.shows[card.showId].updatedAt = Date.now();
  save();
  if (cur && cur[0] === 'm' && cur[1].card.cardKey === card.cardKey) {
    cur[1].card.gloss = term.customGloss || term.gloss;
    const rightChoice = cur[1].choices.find(c => c.correct);
    if (rightChoice) rightChoice.gloss = cur[1].card.gloss;
  }
  draw();
}

const mediaApi = {
  answerMedia,
  replayMediaAudio,
  nextStep: () => next(),
  ignoreMediaTerm,
  editMediaGloss,
  openLibrary: () => setViewMode('library'),
  closeLibrary: () => setViewMode('play'),
  openSyncPrompt,
  setTrackMode: m => setTrackMode(m, true),
  redraw: () => draw(),
  selectShow: id => {
    st.activeShowId = id;
    save();
    draw();
  },
  deleteShow: id => {
    if (!st.shows[id]) return;
    if (!confirm(`Delete show “${st.shows[id].name}”?`)) return;
    delete st.shows[id];
    if (st.activeShowId === id) {
      const rem = Object.keys(st.shows);
      st.activeShowId = rem.length ? rem[0] : 'all';
    }
    save();
    draw();
  },
  importTrancy: ({ mdText, showId, name, lang }) => {
    const existing = showId && st.shows[showId] ? st.shows[showId] : null;
    const res = TrancyParser.ingestTrancyIntoShow(existing, mdText, { name, lang, minCount: st.mediaMinCount });
    st.shows[res.show.id] = res.show;
    st.activeShowId = res.show.id;
    st.freshBoost = 12;
    if (st.trackMode === 'thai') st.trackMode = 'mix';
    save();
    syncAllUI();
    return res;
  }
};

function render() {
  clearPendingNext();
  applyTurnFont();
  try {
    cur = getStep();
  } catch (e) {
    cur = ['i', 'ม', false, null];
  }
  buf = ''; rows = []; misses = 0; solved = false; hint = false; keyst = {}; locked = false; lastFlawTip = '';
  draw();
  if (cur && cur[0] === 'm' && viewMode === 'play') {
    if (cur[1].stage === 2 && st.snd !== 'off') {
      setTimeout(() => replayMediaAudio(), 140);
    } else if (st.snd === 'voice') {
      setTimeout(() => replayMediaAudio(), 140);
    }
  }
}

function score(g, t) {
  const r = Array(t.length).fill('no'), left = {};
  for (let i = 0; i < t.length; i++) {
    if (g[i] === t[i]) r[i] = 'ok';
    else left[t[i]] = (left[t[i]] || 0) + 1;
  }
  for (let i = 0; i < t.length; i++) {
    if (r[i] !== 'ok' && left[g[i]] > 0) { r[i] = 'pre'; left[g[i]]--; }
  }
  return r;
}

function draw(extra) {
  updateHeaderCounts();
  const el = document.getElementById('stage');
  const kb = document.getElementById('kb');
  if (!el || !kb) return;

  if (viewMode === 'trophy') {
    el.className = 'trophy-mode';
    kb.style.display = 'none';
    ThaiCoach.drawTrophyStage(el, {
      st, unlockedSet, emoKnownSet, selectedTrophy, trFilter, trQuery, trLimit,
      onFilter: f => { trFilter = f; trLimit = 180; draw(); },
      onSearch: q => {
        trQuery = q; trLimit = 180; draw();
        const ni = document.getElementById('trsearch');
        if (ni) { ni.focus(); ni.setSelectionRange(trQuery.length, trQuery.length); }
      },
      onBack: () => setViewMode('play'),
      onSpeak: th => speakThai(th, true),
      onSync: openSyncPrompt,
      onMore: () => { trLimit += 300; draw(); },
      onPractice: sel => {
        clearPendingNext();
        viewMode = 'play';
        syncViewButtons();
        cur = ['w', sel.th, romanizeThai(sel.th, st.phoneticsMode), sel.en, sel, false];
        buf = ''; rows = []; misses = 0; solved = false; hint = false; keyst = {}; locked = false; lastFlawTip = '';
        draw();
      },
      onSelect: found => {
        selectedTrophy = found;
        if (unlockedSet.has(found.id) && st.snd === 'voice') speakThai(found.th, true);
        draw();
      }
    });
    return;
  }

  if (viewMode === 'library' && typeof MediaEngine !== 'undefined') {
    el.className = 'trophy-mode';
    kb.style.display = 'none';
    MediaEngine.renderLibraryStage(el, st, mediaApi);
    return;
  }

  if (!cur) cur = getStep();

  if (isMediaStep(cur) && typeof MediaEngine !== 'undefined') {
    kb.style.display = 'none';
    el.className = extra || '';
    MediaEngine.renderMediaStage(el, cur, st, mediaApi);
    return;
  }

  kb.style.display = 'flex';
  let h = '';
  try {
    if (cur[0] === 'i') {
      const c = cur[1], upcomingEmo = cur[3];
      const info = U[c] || ['', 'Thai character'];
      const showLearnClue = st.clueMode === 'learn' && upcomingEmo;
      const badge = showLearnClue
        ? `<span class="badge">new glyph for ${upcomingEmo.emo} “${upcomingEmo.en}”</span>`
        : upcomingEmo
          ? `<span class="badge">new glyph for next mystery emoji (${upcomingEmo.th.length} chars)</span>`
          : inTutorial()
            ? `<span class="badge">tutorial ${st.i + 1}/${TUT_DECK.length} · new character</span>`
            : `<span class="badge">new character</span>`;
      h = `${badge}<div class="th glyph">${disp(c)}</div><p class="hook">${info[1]}</p><div class="buf">${buf || '_'}</div>`;
    } else if (cur[0] === 'f') {
      const [, c, , meta] = cur;
      const safeMeta = meta || { badge: '🎯 Flaw Buster', hook: '' };
      h = `<span class="badge rev">${safeMeta.badge}</span><div class="th glyph">${disp(c)}</div><p class="hook">${safeMeta.hook}</p><div class="buf">${buf || '_'}</div>`;
    } else {
      const [, th, rom, mean, emoObj] = cur;
      const shown = rows.slice(-3);
      let g = '';
      for (const r of shown) {
        g += `<div class="gr">${[...r.g].map((ch, i) => `<div class="t ${r.r[i]}">${ch}</div>`).join('')}</div>`;
      }
      if (!solved) {
        g += `<div class="gr">${[...rom].map((_, i) => `<div class="t ${buf[i] ? 'f' : ''}">${buf[i] || ''}</div>`).join('')}</div>`;
      }

      let topBadge = '';
      if (solved && emoObj) {
        topBadge = `<div class="emo-reveal"><div class="emo-hero">${emoObj.emo}</div><span class="emo-tag">🏆 Unlocked!</span></div>`;
      } else if (st.clueMode === 'learn' && emoObj) {
        topBadge = `<div class="emo-reveal"><div class="emo-hero">${emoObj.emo}</div><span class="badge">💡 ${mean}</span></div>`;
      } else if (emoObj) {
        topBadge = `<span class="badge">mystery emoji · ${th.length} Thai chars</span>`;
      } else if (inTutorial()) {
        topBadge = `<span class="badge">tutorial ${st.i + 1}/${TUT_DECK.length}</span>`;
      }

      let line;
      if (solved) {
        const tipSuffix = lastFlawTip ? ` · <span class="rule-pill">🎯 ${lastFlawTip}</span>` : '';
        line = `<p class="hint ok">${emoObj ? emoObj.emo + ' ' : ''}${th} (${rom}) = “${mean}” <button id="spkbtn" class="spk-inline" title="Listen">🔊</button>${tipSuffix}</p>`;
      } else if (hint) {
        line = st.phoneticsMode === 'literal'
          ? `<p class="hint">${[...th].map(c => disp(c) + ' ' + ((U[c] && U[c][0]) || 'silent')).join(' · ')}</p>`
          : explainRealThai(th);
      } else if (lastFlawTip) {
        line = `<p class="hint"><span class="rule-pill">🎯 ${lastFlawTip}</span></p>`;
      } else if (st.clueMode === 'learn') {
        line = `<p class="hint">💡 “${mean}” · Sound out the Thai script.</p>`;
      } else {
        line = `<p class="hint">${emoObj ? 'Sound out the Thai script to unlock this mystery emoji.' : 'Type how it sounds.'}</p>`;
      }
      h = `${topBadge}<div class="th word">${th}</div><div class="grid">${g}</div>${line}<div class="act-row">${(!solved && !hint) ? '<button id="hintbtn">hint</button>' : ''}</div>`;
    }
  } catch (e) {
    cur = ['i', 'ม', false, null];
    locked = false;
    h = `<span class="badge">recovered</span><div class="th glyph">${disp('ม')}</div><p class="hook">${U['ม'][1]}</p><div class="buf">_</div>`;
  }

  h += `<div id="feed">${feed.map(f => `<div>${f}</div>`).join('')}</div>`;
  el.innerHTML = h;
  el.className = extra || '';

  const hb = document.getElementById('hintbtn');
  if (hb) {
    hb.onpointerdown = e => {
      e.preventDefault();
      hint = true;
      if (cur[0] === 'w') {
        for (const ch of new Set([...cur[1]])) if (U[ch] && U[ch][0]) ThaiCoach.recordFlaw(st, `char:${ch}`, 1);
        save();
      }
      draw();
    };
  }

  const sb = document.getElementById('spkbtn');
  if (sb) sb.onpointerdown = e => { e.preventDefault(); speakThai(cur[1], true); };

  document.querySelectorAll('.k[data-k]').forEach(k => {
    const s = keyst[k.dataset.k];
    k.className = 'k' + (k.dataset.k === 'Enter' ? ' w go' : '') + (s ? ' ' + s : '');
  });
  const en = document.querySelector('[data-k=Enter]');
  if (en) en.textContent = solved ? 'next' : 'enter';
}

function next() {
  clearPendingNext();
  if (!cur) return render();
  if (cur[0] === 'm') {
    lastMediaKey = cur[1].card.cardKey;
    feed.push(`${cur[1].card.text} → ${cur[1].card.gloss}`);
    st.mediaTurn = (st.mediaTurn || 0) + 1;
    if (st.trackMode === 'mix') {
      st.mixTurn = (st.mixTurn || 0) + 1;
      if (st.freshBoost > 0) st.freshBoost--;
    }
  } else if (cur[0] === 'i') {
    feed.push(`${disp(cur[1])} → ${(U[cur[1]] && U[cur[1]][0]) || 'silent'}`);
    st.charLastSeen[cur[1]] = st.emoTurn;
    if (inTutorial()) { st.i++; if (!inTutorial()) seedTutorialGlyphs(); }
    else st.emoTurn++;
    if (st.trackMode === 'mix') st.mixTurn = (st.mixTurn || 0) + 1;
  } else if (cur[0] === 'f') {
    feed.push(`🎯 ${disp(cur[1])} → ${cur[2]}`);
  } else if (cur[0] === 'w') {
    const emoObj = cur[4];
    feed.push(`${emoObj ? emoObj.emo + ' ' : ''}${cur[1]} · ${cur[2]} · ${cur[3]}`);
    if (emoObj && emoObj.id < EMOJI_DB.length) { unlockedSet.add(emoObj.id); selectedTrophy = emoObj; }
    if (inTutorial()) { st.i++; if (!inTutorial()) seedTutorialGlyphs(); }
    else st.emoTurn++;
    if (st.trackMode === 'mix') st.mixTurn = (st.mixTurn || 0) + 1;
  }
  if (feed.length > 4) feed.shift();
  st.n++;
  save();
  render();
}

function scheduleNext() {
  clearPendingNext();
  nextTimer = setTimeout(() => { nextTimer = null; next(); }, 600);
}

function press(k) {
  if (viewMode !== 'play' || locked || !cur || isMediaStep(cur)) return;
  if (k === 'Enter') {
    if (solved) return next();
    if (cur[0] === 'w' && buf.length === cur[2].length) submit();
    return;
  }
  if (solved) return;
  if (k === 'Backspace') { buf = buf.slice(0, -1); return draw(); }

  if (cur[0] === 'i' || cur[0] === 'f') {
    const key = cur[0] === 'f' ? cur[2] : (U[cur[1]] && U[cur[1]][0]);
    if (!key) { locked = true; ping(); draw('pop'); scheduleNext(); return; }
    buf += k; tick();
    if (buf === key) {
      if (cur[0] === 'f' && cur[3] && cur[3].flawKey) ThaiCoach.recordFlaw(st, cur[3].flawKey, misses === 0 ? -2 : -1);
      else if (misses === 0) ThaiCoach.recordFlaw(st, `char:${cur[1]}`, -1);
      locked = true; ping(); draw('pop'); scheduleNext(); return;
    }
    if (!key.startsWith(buf)) {
      misses++;
      ThaiCoach.recordFlaw(st, cur[0] === 'f' && cur[3] ? cur[3].flawKey : `char:${cur[1]}`, 1);
      save(); soft(); buf = ''; return draw('miss');
    }
    return draw();
  }
  if (buf.length < cur[2].length) { buf += k; tick(); draw(); }
}

function submit() {
  const t = cur[2], r = score(buf, t);
  rows.push({ g: buf, r });
  const rank = { no: 1, pre: 2, ok: 3 };
  [...buf].forEach((ch, i) => { if (!keyst[ch] || rank[r[i]] > rank[keyst[ch]]) keyst[ch] = r[i]; });

  if (buf === t) {
    solved = true; buf = '';
    if (misses === 0 && !hint) ThaiCoach.healWordFlaws(st, cur[1]);
    if (cur[4] && cur[4].id < EMOJI_DB.length) { unlockedSet.add(cur[4].id); selectedTrophy = cur[4]; }
    save(); ping(cur[1]); draw('pop');
  } else {
    const diag = ThaiCoach.diagnoseAttempt(st, cur[1], t, buf);
    for (const d of diag) {
      ThaiCoach.recordFlaw(st, d.key, d.weight);
      if (d.tip && d.weight >= 2) lastFlawTip = d.tip;
    }
    save(); misses++; soft(); buf = ''; if (misses >= 2) hint = true; draw();
  }
}

// ---------- Virtual Keyboard & Global Shortcuts ----------
const kb = document.getElementById('kb');
if (kb) {
  [['q','w','e','r','t','y','u','i','o','p'], ['a','s','d','f','g','h','j','k','l'], ['z','x','c','v','b','n','m','Backspace'], ['Enter']].forEach(r => {
    const d = document.createElement('div'); d.className = 'row';
    r.forEach(k => {
      const b = document.createElement('button'); b.className = 'k'; b.dataset.k = k; b.type = 'button';
      b.textContent = k === 'Backspace' ? '⌫' : k === 'Enter' ? 'enter' : k;
      if (k === 'Backspace') b.setAttribute('aria-label', 'Backspace');
      if (k === 'Enter') b.classList.add('w', 'go');
      b.addEventListener('pointerdown', e => { e.preventDefault(); press(k); });
      d.appendChild(b);
    });
    kb.appendChild(d);
  });
}

addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (viewMode === 'play' && cur && cur[0] === 'm') {
    if (/^[1-4]$/.test(e.key)) { e.preventDefault(); answerMedia(Number(e.key) - 1); }
    else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); replayMediaAudio(); }
    else if (e.key === 'Enter' && solved) { e.preventDefault(); next(); }
    else if (e.key === 'x' || e.key === 'X') { e.preventDefault(); ignoreMediaTerm(cur[1].card); }
    return;
  }
  if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
  else if (e.key === 'Enter' || e.key === 'Backspace') { e.preventDefault(); press(e.key); }
});

// ---------- Controls & Settings Wiring ----------
function syncViewButtons() {
  const tb = document.getElementById('trophbtn');
  if (tb) tb.classList.toggle('on', viewMode === 'trophy');
  const lb = document.getElementById('libbtn');
  if (lb) lb.classList.toggle('on', viewMode === 'library');
}

function setViewMode(mode) {
  clearPendingNext();
  viewMode = viewMode === mode && mode !== 'play' ? 'play' : mode;
  syncViewButtons();
  if (viewMode === 'play') render();
  else draw();
}

function setTrackMode(tm, persist = true) {
  st.trackMode = ['thai', 'media', 'mix'].includes(tm) ? tm : 'thai';
  document.querySelectorAll('#trackseg button').forEach(b => b.classList.toggle('on', b.dataset.tr === st.trackMode));
  if (persist) {
    save();
    viewMode = 'play';
    syncViewButtons();
    render();
  }
}

function setMixRatio(mr, persist = true) {
  st.mixRatio = ['3:1', '1:1', '1:3'].includes(mr) ? mr : '3:1';
  document.querySelectorAll('#mixseg button').forEach(b => b.classList.toggle('on', b.dataset.mr === st.mixRatio));
  if (persist) { save(); updateHeaderCounts(); }
}

function setMediaStage(ms, persist = true) {
  st.mediaStage = ['auto', 'recognize', 'cloze', 'listen'].includes(ms) ? ms : 'auto';
  document.querySelectorAll('#mstageseg button').forEach(b => b.classList.toggle('on', b.dataset.ms === st.mediaStage));
  if (persist) { save(); if (viewMode === 'play' && isMediaStep(cur)) render(); }
}

function setMediaMinCount(mc, persist = true) {
  st.mediaMinCount = Math.min(5, Math.max(1, Number(mc) || 2));
  document.querySelectorAll('#mminseg button').forEach(b => b.classList.toggle('on', Number(b.dataset.mc) === st.mediaMinCount));
  if (persist) { save(); if (viewMode === 'library') draw(); else if (isMediaStep(cur)) render(); else updateHeaderCounts(); }
}

function setPhoneticsMode(pm, persist = true) {
  st.phoneticsMode = pm === 'literal' ? 'literal' : 'real';
  window.AMBIENT_PHONETICS_MODE = st.phoneticsMode;
  document.querySelectorAll('#pseg button').forEach(b => b.classList.toggle('on', b.dataset.p === st.phoneticsMode));
  if (persist) { save(); render(); }
}

function setClueMode(cm, persist = true) {
  st.clueMode = cm === 'learn' ? 'learn' : 'mystery';
  document.querySelectorAll('#cseg button').forEach(b => b.classList.toggle('on', b.dataset.c === st.clueMode));
  if (persist) { save(); draw(); }
}

function setMode(m, persist = true) {
  st.m = m === 'B' ? 'B' : 'A';
  document.body.className = st.m;
  document.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.m === st.m));
  if (persist) save();
}

function setSoundMode(s, preview = false, persist = true) {
  st.snd = normalizeSnd(s);
  document.querySelectorAll('#sseg button').forEach(b => b.classList.toggle('on', b.dataset.s === st.snd));
  if (persist) save();
  if (preview) {
    if (st.snd === 'dings') ping();
    else if (st.snd === 'voice') {
      if (cur && cur[0] === 'm') replayMediaAudio();
      else ping(cur && cur[0] === 'w' ? cur[1] : 'สวัสดี');
    }
  }
}

function setFont(f, persist = true) {
  if (!FONTS[f] && f !== 'mix') f = 'modern';
  st.f = f;
  applyTurnFont();
  document.querySelectorAll('#fseg button').forEach(b => b.classList.toggle('on', b.dataset.f === f));
  if (persist) save();
}

function syncAllUI() {
  setTrackMode(st.trackMode, false);
  setMixRatio(st.mixRatio, false);
  setMediaStage(st.mediaStage, false);
  setMediaMinCount(st.mediaMinCount, false);
  setFont(st.f || 'modern', false);
  setMode(st.m || 'A', false);
  setSoundMode(st.snd || 'dings', false, false);
  setPhoneticsMode(st.phoneticsMode || 'real', false);
  setClueMode(st.clueMode || 'mystery', false);
  syncViewButtons();
}

document.querySelectorAll('#trackseg button').forEach(b => b.onclick = () => setTrackMode(b.dataset.tr));
document.querySelectorAll('#mixseg button').forEach(b => b.onclick = () => setMixRatio(b.dataset.mr));
document.querySelectorAll('#mstageseg button').forEach(b => b.onclick = () => setMediaStage(b.dataset.ms));
document.querySelectorAll('#mminseg button').forEach(b => b.onclick = () => setMediaMinCount(b.dataset.mc));
document.querySelectorAll('#pseg button').forEach(b => b.onclick = () => setPhoneticsMode(b.dataset.p));
document.querySelectorAll('#cseg button').forEach(b => b.onclick = () => setClueMode(b.dataset.c));
document.querySelectorAll('#seg button').forEach(b => b.onclick = () => setMode(b.dataset.m));
document.querySelectorAll('#sseg button').forEach(b => b.onclick = () => setSoundMode(b.dataset.s, true));
document.querySelectorAll('#fseg button').forEach(b => b.onclick = () => setFont(b.dataset.f));

const trophBtn = document.getElementById('trophbtn');
if (trophBtn) trophBtn.onclick = () => setViewMode('trophy');
const libBtn = document.getElementById('libbtn');
if (libBtn) libBtn.onclick = () => setViewMode('library');

const fsBtn = document.getElementById('fs'), D = document;
if (fsBtn) {
  if (!(D.fullscreenEnabled || D.webkitFullscreenEnabled)) fsBtn.style.display = 'none';
  fsBtn.onclick = () => {
    try {
      const on = D.fullscreenElement || D.webkitFullscreenElement, e = D.documentElement;
      const p = on ? (D.exitFullscreen || D.webkitExitFullscreen).call(D) : (e.requestFullscreen || e.webkitRequestFullscreen).call(e);
      if (p && p.catch) p.catch(() => {});
    } catch (x) {}
  };
  const fsl = () => { fsBtn.textContent = (D.fullscreenElement || D.webkitFullscreenElement) ? 'exit full screen' : 'full screen'; };
  D.addEventListener('fullscreenchange', fsl);
  D.addEventListener('webkitfullscreenchange', fsl);
}

const setBtn = document.getElementById('setbtn');
const setPanel = document.getElementById('settings');
function toggleSettings(force) {
  if (!setBtn || !setPanel) return;
  const open = force !== undefined ? !!force : setPanel.hidden;
  setPanel.hidden = !open;
  setBtn.classList.toggle('on', open);
  setBtn.setAttribute('aria-expanded', String(open));
}
if (setBtn && setPanel) {
  setBtn.onclick = e => { e.stopPropagation(); toggleSettings(); };
  document.addEventListener('pointerdown', e => {
    if (setPanel.hidden) return;
    if (setPanel.contains(e.target) || setBtn.contains(e.target)) return;
    toggleSettings(false);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !setPanel.hidden) toggleSettings(false); });
}

const replayTutBtn = document.getElementById('replaytut');
if (replayTutBtn) {
  replayTutBtn.onclick = () => {
    st.i = 0;
    st.trackMode = 'thai';
    save();
    toggleSettings(false);
    syncAllUI();
    setViewMode('play');
  };
}

syncAllUI();
render();