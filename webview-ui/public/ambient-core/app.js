// ---------- Diagnostic Flaw Engine (Lookalikes, Positional Shifts & Pre-posed Order) ----------
const LOOKALIKE_TWINS = {
  'ด': [['ต', 'Flat roof ด = d · Notched roof ต = t'], ['ค', 'Tucked loop ด = d · Arch loop ค = k']],
  'ต': [['ด', 'Notched roof ต = t · Flat roof ด = d']],
  'บ': [['ป', 'Short stem บ = b · Tall stem ป = p'], ['ษ', 'Open bucket บ = b · Crossbar ษ = s']],
  'ป': [['บ', 'Tall stem ป = p · Short stem บ = b'], ['ฝ', 'Flat bottom ป = p · W-bottom ฝ = f']],
  'ม': [['น', 'Front loop ม = m · Back loop น = n']],
  'น': [['ม', 'Back loop น = n · Front loop ม = m'], ['บ', 'Bottom loop น = n · No loop บ = b']],
  'ก': [['ถ', 'No loop ก = g · Inner loop ถ = t'], ['ภ', 'No loop ก = g · Outer loop ภ = p']],
  'ถ': [['ก', 'Inner loop ถ = t · No loop ก = g'], ['ภ', 'Inner loop ถ = t · Outer loop ภ = p']],
  'ภ': [['ก', 'Outer loop ภ = p · No loop ก = g'], ['ถ', 'Outer loop ภ = p · Inner loop ถ = t']],
  'พ': [['ฟ', 'Short stem พ = p · Tall tail ฟ = f'], ['ผ', 'Outer loop พ = p · Inner loop ผ = p']],
  'ฟ': [['พ', 'Tall tail ฟ = f · Short stem พ = p'], ['ฝ', 'Outer loop ฟ = f · Inner loop ฝ = f']],
  'ผ': [['ฝ', 'Short stem ผ = p · Tall tail ฝ = f']],
  'ฝ': [['ผ', 'Tall tail ฝ = f · Short stem ผ = p']],
  'ส': [['ล', 'Top tail ส = s · No top tail ล = l']],
  'ล': [['ส', 'No top tail ล = l · Top tail ส = s']],
  'ช': [['ซ', 'Smooth head ช = ch · Notched head ซ = s'], ['ข', 'Right tail ช = ch · No tail ข = k']],
  'ซ': [['ช', 'Notched head ซ = s · Smooth head ช = ch']],
  'เ': [['แ', 'Single pole เ = ay · Double pole แ = ae'], ['โ', 'Short pole เ = ay · Tall hook โ = oh']],
  'แ': [['เ', 'Double pole แ = ae · Single pole เ = ay']],
  'โ': [['เ', 'Tall hook โ = oh · Short pole เ = ay'], ['ไ', 'Round hook โ = oh · Zigzag ไ = ai']],
  'ไ': [['โ', 'Zigzag ไ = ai · Round hook โ = oh']],
  'ุ': [['ู', 'Tiny peg ◌ุ = u · Longer shoe ◌ู = uu']],
  'ู': [['ุ', 'Longer shoe ◌ู = uu · Tiny peg ◌ุ = u']],
  'ิ': [['ี', 'No tick ◌ิ = i · Tall tick ◌ี = ee']],
  'ี': [['ิ', 'Tall tick ◌ี = ee · No tick ◌ิ = i'], ['ื', 'One tick ◌ี = ee · Two ticks ◌ื = ue']]
};

// ---------- State & Persistence ----------
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
  updatedAt: Date.now()
});

st.flaws = st.flaws || {};

if ((st.emoTurn > 0 || (st.emoUnlocked && st.emoUnlocked.length > 0)) && st.i < TUT_DECK.length) {
  st.i = TUT_DECK.length;
}

window.AMBIENT_PHONETICS_MODE = st.phoneticsMode || 'real';

const unlockedSet = new Set(st.emoUnlocked);
const emoKnownSet = new Set(st.emoKnown);

function inTutorial() {
  return st.i < TUT_DECK.length;
}

function seedTutorialGlyphs() {
  for (const step of TUT_DECK) {
    if (step[0] === 'i') emoKnownSet.add(step[1]);
  }
}
if (!inTutorial()) {
  seedTutorialGlyphs();
}

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
    st.flaws = st.flaws || {};
    if ((st.emoTurn > 0 || (st.emoUnlocked && st.emoUnlocked.length > 0)) && st.i < TUT_DECK.length) {
      st.i = TUT_DECK.length;
    }
    unlockedSet.clear();
    (st.emoUnlocked || []).forEach(id => unlockedSet.add(id));
    emoKnownSet.clear();
    (st.emoKnown || []).forEach(c => emoKnownSet.add(c));
    if (!inTutorial()) seedTutorialGlyphs();
    window.AMBIENT_PHONETICS_MODE = st.phoneticsMode;
    syncSoundUI();
    updateHeaderCounts();
  }
);

function recordFlaw(key, delta) {
  if (!key) return;
  st.flaws = st.flaws || {};
  const nextVal = (st.flaws[key] || 0) + delta;
  if (nextVal <= 0) delete st.flaws[key];
  else st.flaws[key] = Math.min(nextVal, 9);
}

function getWordFeatures(th) {
  const { syllables } = analyzeRealThai(th);
  const initials = new Set();
  const finals = new Map();
  const preVowels = new Set();

  for (const s of syllables) {
    const raw = [...s.th].filter(c => U[c] !== undefined && !TONES.has(c) && c !== '์' && c !== 'ฯ');
    if (!raw.length) continue;
    let idx = 0;
    if (PRE_VOWELS.has(raw[0])) {
      preVowels.add(raw[0]);
      idx++;
    }
    if (idx < raw.length && CONSONANTS.has(raw[idx])) {
      if (raw[idx] === 'ห' && idx + 1 < raw.length && HO_NAM_FOLLOWERS.has(raw[idx + 1])) {
        initials.add(raw[idx + 1]);
      } else {
        initials.add(raw[idx]);
      }
    }
    const lastCh = raw[raw.length - 1];
    if (raw.length >= 2 && CONSONANTS.has(lastCh) && lastCh !== raw[idx]) {
      const fSnd = FINAL_SOUND[lastCh];
      const baseSnd = U[lastCh] ? U[lastCh][0] : '';
      if (fSnd && fSnd !== baseSnd) finals.set(lastCh, fSnd);
    }
  }
  return { initials, finals, preVowels, syllables };
}

function diagnoseAttempt(th, targetRom, guess) {
  const events = [];
  const feat = getWordFeatures(th);
  const g = (guess || '').toLowerCase();

  // 1. Visual Lookalike Twin Confusion
  for (const initChar of feat.initials) {
    const twins = LOOKALIKE_TWINS[initChar];
    if (!twins) continue;
    const trueSnd = U[initChar][0];
    if (trueSnd && !g.startsWith(trueSnd)) {
      for (const [twinChar, hook] of twins) {
        const twinSnd = U[twinChar] && U[twinChar][0];
        if (twinSnd && twinSnd !== trueSnd && g.startsWith(twinSnd)) {
          const pairKey = [initChar, twinChar].sort().join('|');
          events.push({ key: `twin:${pairKey}`, weight: 2, tip: `Lookalike: ${hook}` });
        }
      }
    }
  }

  // 2. Positional Final Consonant Sound Shifts (-n, -t, -p, -k)
  if (st.phoneticsMode !== 'literal') {
    for (const [finChar, shiftedSnd] of feat.finals.entries()) {
      const initSnd = U[finChar][0];
      if (initSnd && g.endsWith(initSnd) && !targetRom.endsWith(initSnd)) {
        events.push({
          key: `final:${finChar}`,
          weight: 2,
          tip: `Position shift: ${finChar} is “${initSnd}” at start, but “-${shiftedSnd}” at the end`
        });
      }
    }

    // 3. Pre-posed Vowel Order (typing เ/แ/โ/ไ/ใ before the consonant)
    for (const pv of feat.preVowels) {
      const pvSnd = U[pv][0];
      if (pvSnd && g.startsWith(pvSnd) && !targetRom.startsWith(pvSnd)) {
        events.push({
          key: `pre:${pv}`,
          weight: 2,
          tip: `Order: ${disp(pv)} (${pvSnd}) is written left, but spoken AFTER the consonant`
        });
      }
    }
  }

  // 4. Syllable-aligned character struggle
  let offset = 0;
  for (const s of feat.syllables) {
    const sRom = s.rom;
    const gSlice = g.slice(offset, offset + sRom.length);
    offset += sRom.length;
    if (gSlice !== sRom) {
      for (const ch of s.th) {
        if (U[ch] && U[ch][0]) {
          events.push({ key: `char:${ch}`, weight: 1, tip: `${disp(ch)} = “${U[ch][0]}”` });
        }
      }
    }
  }
  return events;
}

function healWordFlaws(th) {
  if (!st.flaws) return;
  const feat = getWordFeatures(th);
  for (const ch of new Set([...th])) {
    if (st.flaws[`char:${ch}`]) recordFlaw(`char:${ch}`, -1);
    if (LOOKALIKE_TWINS[ch]) {
      for (const [tw] of LOOKALIKE_TWINS[ch]) {
        const pk = `twin:${[ch, tw].sort().join('|')}`;
        if (st.flaws[pk]) recordFlaw(pk, -1);
      }
    }
  }
  for (const [finChar] of feat.finals) {
    if (st.flaws[`final:${finChar}`]) recordFlaw(`final:${finChar}`, -1);
  }
  for (const pv of feat.preVowels) {
    if (st.flaws[`pre:${pv}`]) recordFlaw(`pre:${pv}`, -1);
  }
}

// Replaces blind timer revision with Flaw-Aware Emoji Selection + 6-Turn Flaw Buster Clinic
function pickFlawAwareEmojiStep() {
  const targetRom = item => (st.phoneticsMode === 'literal' ? item.romLit : item.romReal);
  const flaws = st.flaws || {};

  // Every 6 emojis (only if flaws exist with score >= 2), run a quick Flaw Buster drill
  if (st.emoTurn > 0 && st.emoTurn % 6 === 0 && st.lastFlawTurn !== st.emoTurn) {
    const entries = Object.entries(flaws)
      .filter(([, sc]) => sc >= 2)
      .sort((a, b) => b[1] - a[1]);

    if (entries.length) {
      st.lastFlawTurn = st.emoTurn;
      const [flawKey] = entries[0];

      if (flawKey.startsWith('twin:')) {
        const [c1, c2] = flawKey.slice(5).split('|');
        if (U[c1] && U[c2]) {
          const twinInfo = (LOOKALIKE_TWINS[c1] || []).find(t => t[0] === c2) ||
                           (LOOKALIKE_TWINS[c2] || []).find(t => t[0] === c1);
          const hook = twinInfo ? twinInfo[1] : `${disp(c1)} (${U[c1][0]}) vs ${disp(c2)} (${U[c2][0]})`;
          const target = st.emoTurn % 2 === 0 ? c1 : c2;
          const other = target === c1 ? c2 : c1;
          return ['f', target, U[target][0], {
            flawKey,
            badge: `🎯 Flaw Buster · Spot the Twin (${disp(target)} vs ${disp(other)})`,
            hook: `${hook} — Type ${disp(target)}:`
          }];
        }
      }

      if (flawKey.startsWith('final:')) {
        const ch = flawKey.slice(6);
        const shifted = FINAL_SOUND[ch];
        if (U[ch] && shifted) {
          return ['f', ch, shifted, {
            flawKey,
            badge: `🎯 Flaw Buster · End-of-Syllable ${ch}`,
            hook: `At start ${ch} = “${U[ch][0]}”, but at the END of a syllable ${ch} → “-${shifted}”. Type its ending sound:`
          }];
        }
      }

      if (flawKey.startsWith('char:')) {
        const ch = flawKey.slice(5);
        if (U[ch] && U[ch][0]) {
          const tw = LOOKALIKE_TWINS[ch] && LOOKALIKE_TWINS[ch][0];
          return ['f', ch, U[ch][0], {
            flawKey,
            badge: `🎯 Flaw Buster · Tricky Glyph`,
            hook: `${U[ch][1]}${tw ? ' · (' + tw[1] + ')' : ''}`
          }];
        }
      }
    }
  }

  // Pick next locked emoji: fewest chars + Stealth Bonus for words containing active flaws
  let best = null, bestScore = -1e9;
  for (let idx = 0; idx < EMOJI_DB.length; idx++) {
    const item = EMOJI_DB[idx];
    if (unlockedSet.has(item.id)) continue;
    const chars = [...item.th];
    const uniqueChars = [...new Set(chars)];
    let knownCount = 0;
    for (const c of chars) if (emoKnownSet.has(c)) knownCount++;
    const unknownUnique = uniqueChars.filter(c => !emoKnownSet.has(c)).length;

    let flawBonus = 0;
    if (unknownUnique === 0) {
      for (const c of uniqueChars) {
        if (flaws[`char:${c}`]) flawBonus += flaws[`char:${c}`] * 95;
        if (LOOKALIKE_TWINS[c]) {
          for (const [tw] of LOOKALIKE_TWINS[c]) {
            const pk = `twin:${[c, tw].sort().join('|')}`;
            if (flaws[pk]) flawBonus += flaws[pk] * 140;
          }
        }
      }
      if (PRE_VOWELS.has(chars[0]) && flaws[`pre:${chars[0]}`]) flawBonus += flaws[`pre:${chars[0]}`] * 150;
      const lastCh = chars[chars.length - 1];
      if (chars.length >= 2 && flaws[`final:${lastCh}`]) flawBonus += flaws[`final:${lastCh}`] * 160;
    }

    const sc = -(chars.length * 1000) - (unknownUnique * 220) + (knownCount * 50) + (item.isCore ? 80 : 0) + Math.min(flawBonus, 950);
    if (sc > bestScore) {
      bestScore = sc;
      best = item;
    }
  }

  if (!best) best = EMOJI_DB[st.emoTurn % EMOJI_DB.length];

  for (const c of best.th) {
    if (!emoKnownSet.has(c)) {
      emoKnownSet.add(c);
      st.charLastSeen[c] = st.emoTurn;
      save();
      return ['i', c, false, best];
    }
  }

  for (const c of best.th) st.charLastSeen[c] = st.emoTurn;
  return ['w', best.th, targetRom(best), best.en, best, false];
}

function getStep() {
  if (inTutorial()) {
    const raw = TUT_DECK[st.i];
    if (raw[0] === 'i') {
      emoKnownSet.add(raw[1]);
      return raw;
    }
    const rom = romanizeThai(raw[1], st.phoneticsMode);
    return ['w', raw[1], rom, raw[3], raw[4] || null, false];
  }
  return pickFlawAwareEmojiStep();
}

// ---------- Upgraded Audio Synth & Spoken Thai TTS ----------
let ac;
let thVoice = null;

function initVoices() {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  thVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('th')) || null;
}
if (typeof speechSynthesis !== 'undefined') {
  initVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = initVoices;
  }
}

function getAudioContext() {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

function playNote(freq, duration, vol = 0.07, delay = 0, type = 'triangle') {
  if (st.snd === 'off') return;
  try {
    const ctx = getAudioContext();
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

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq * 2, start);
    subGain.gain.setValueAtTime(0.0001, start);
    subGain.gain.linearRampToValueAtTime(vol * 0.22, start + 0.008);
    subGain.gain.exponentialRampToValueAtTime(0.0001, start + duration * 0.55);

    subOsc.connect(subGain).connect(ctx.destination);
    subOsc.start(start);
    subOsc.stop(start + duration * 0.55 + 0.02);
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
    u.pitch = 1.0;
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
  try {
    const ctx = getAudioContext();
    const s = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, s);
    osc.frequency.exponentialRampToValueAtTime(170, s + 0.032);
    g.gain.setValueAtTime(0.035, s);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.032);
    osc.connect(g).connect(ctx.destination);
    osc.start(s);
    osc.stop(s + 0.035);
  } catch (e) {}
};

const soft = () => {
  if (st.snd === 'off') return;
  playNote(220, 0.14, 0.045, 0, 'sine');
  playNote(174.61, 0.22, 0.04, 0.065, 'sine');
};

// ---------- Game Loop & Trophy UI ----------
let cur, buf, rows, misses, solved, hint, keyst, locked, lastFlawTip = '', feed = [];
let viewMode = 'play';
let trFilter = 'all', trQuery = '', trLimit = 180, selectedTrophy = EMOJI_DB[0];

const FONTS = {
  modern: '"Noto Sans Thai","Sarabun",sans-serif',
  looped: '"Noto Sans Thai Looped","Noto Sans Thai",sans-serif'
};

function applyTurnFont() {
  const activeFont = st.f === 'mix'
    ? (st.n % 2 === 0 ? FONTS.modern : FONTS.looped)
    : (FONTS[st.f] || FONTS.modern);
  document.documentElement.style.setProperty('--thf', activeFont);
}

function updateHeaderCounts() {
  const tc = document.getElementById('trophcnt');
  if (tc) tc.textContent = `${unlockedSet.size}/${EMOJI_DB.length}`;
  const cnt = document.getElementById('cnt');
  if (!cnt) return;
  if (inTutorial()) {
    cnt.textContent = `tutorial ${st.i + 1}/${TUT_DECK.length}`;
  } else {
    cnt.textContent = `${emoKnownSet.size}/${Object.keys(U).length} glyphs`;
  }
}

function render() {
  applyTurnFont();
  cur = getStep();
  buf = ''; rows = []; misses = 0; solved = false; hint = false; keyst = {}; locked = false; lastFlawTip = '';
  draw();
}

function score(g, t) {
  const r = Array(t.length).fill('no'), left = {};
  for (let i = 0; i < t.length; i++) {
    if (g[i] === t[i]) r[i] = 'ok';
    else left[t[i]] = (left[t[i]] || 0) + 1;
  }
  for (let i = 0; i < t.length; i++) {
    if (r[i] !== 'ok' && left[g[i]] > 0) {
      r[i] = 'pre';
      left[g[i]]--;
    }
  }
  return r;
}

function draw(extra) {
  updateHeaderCounts();
  const el = document.getElementById('stage');
  const kb = document.getElementById('kb');

  if (viewMode === 'trophy') {
    el.className = 'trophy-mode';
    kb.style.display = 'none';
    drawTrophyStage(el);
    return;
  }

  kb.style.display = 'flex';
  let h = '';
  if (cur[0] === 'i') {
    const c = cur[1], upcomingEmo = cur[3];
    const showLearnClue = st.clueMode === 'learn' && upcomingEmo;
    const badge = showLearnClue
      ? `<span class="badge">new glyph for ${upcomingEmo.emo} “${upcomingEmo.en}”</span>`
      : upcomingEmo
        ? `<span class="badge">new glyph for next mystery emoji (${upcomingEmo.th.length} chars)</span>`
        : inTutorial()
          ? `<span class="badge">tutorial ${st.i + 1}/${TUT_DECK.length} · new character</span>`
          : `<span class="badge">new character</span>`;
    h = `${badge}<div class="th glyph">${disp(c)}</div><p class="hook">${U[c][1]}</p><div class="buf">${buf || '_'}</div>`;
  } else if (cur[0] === 'f') {
    const [, c, , meta] = cur;
    h = `<span class="badge rev">${meta.badge}</span><div class="th glyph">${disp(c)}</div><p class="hook">${meta.hook}</p><div class="buf">${buf || '_'}</div>`;
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
      line = `<p class="hint ok">${emoObj ? emoObj.emo + ' ' : ''}${th} (${rom}) = “${mean}” <button id="spkbtn" class="spk-inline" title="Listen to pronunciation">🔊</button>${tipSuffix}</p>`;
    } else if (hint) {
      if (st.phoneticsMode === 'literal') {
        line = `<p class="hint">${[...th].map(c => disp(c) + ' ' + (U[c][0] || 'silent')).join(' · ')}</p>`;
      } else {
        line = explainRealThai(th);
      }
    } else if (lastFlawTip) {
      line = `<p class="hint"><span class="rule-pill">🎯 ${lastFlawTip}</span></p>`;
    } else if (st.clueMode === 'learn') {
      line = `<p class="hint">💡 “${mean}” · Sound out the Thai script (${st.phoneticsMode === 'real' ? 'Real Thai syllables' : 'Literal 1:1'}).</p>`;
    } else {
      line = `<p class="hint">${emoObj ? 'Sound out the Thai script to unlock this mystery emoji.' : 'Type how it sounds.'}</p>`;
    }
    h = `${topBadge}<div class="th word">${th}</div><div class="grid">${g}</div>${line}<div class="act-row">${(!solved && !hint) ? '<button id="hintbtn">hint</button>' : ''}</div>`;
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
        for (const ch of new Set([...cur[1]])) {
          if (U[ch] && U[ch][0]) recordFlaw(`char:${ch}`, 1);
        }
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

function drawTrophyStage(el) {
  const filtered = EMOJI_DB.filter(item => {
    const unl = unlockedSet.has(item.id);
    if (trFilter === 'unlocked' && !unl) return false;
    if (trFilter === 'locked' && unl) return false;
    if (trFilter === 'core' && !item.isCore) return false;
    if (trQuery) {
      if (!unl) return false;
      const q = trQuery.toLowerCase();
      return item.en.toLowerCase().includes(q) || item.th.includes(q) || item.rom.includes(q) || item.emo.includes(q);
    }
    return true;
  });

  filtered.sort((a, b) => a.th.length - b.th.length || (b.isCore ? 1 : 0) - (a.isCore ? 1 : 0) || a.id - b.id);
  const slice = filtered.slice(0, trLimit);

  const sel = selectedTrophy || EMOJI_DB[0];
  const selUnlocked = unlockedSet.has(sel.id);

  el.innerHTML = `
    <div class="tr-head">
      <div class="tr-stats">
        <strong>🏆 ${unlockedSet.size} / ${EMOJI_DB.length} Unlocked</strong>
        <span>(${emoKnownSet.size}/${Object.keys(U).length} Thai glyphs learned)</span>
      </div>
      <div class="tr-controls">
        <div class="seg" id="trfseg">
          <button data-tf="all" class="${trFilter === 'all' ? 'on' : ''}">All</button>
          <button data-tf="unlocked" class="${trFilter === 'unlocked' ? 'on' : ''}">Earned</button>
          <button data-tf="core" class="${trFilter === 'core' ? 'on' : ''}">Core</button>
        </div>
        <input class="tr-search" id="trsearch" placeholder="Search earned..." value="${trQuery.replace(/"/g, '&quot;')}">
        <button id="trsync" class="badge" style="cursor:pointer" title="Copy or paste 1-Click Sync Code">🔄 Sync Code</button>
        <button id="trback" class="badge" style="cursor:pointer">▶ Back to Play</button>
      </div>
    </div>
    <div class="tr-detail">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:28px">${selUnlocked ? sel.emo : '❓'}</span>
        <div style="text-align:left">
          <div class="th-big">${selUnlocked ? sel.th : '🔒 Mystery Emoji'} ${selUnlocked ? `<button id="trspk" class="spk-inline" title="Pronounce Thai">🔊</button>` : ''}</div>
          <div style="color:var(--dim)">${selUnlocked ? `${romanizeThai(sel.th, st.phoneticsMode)} · “${sel.en}”` : `${sel.th.length} Thai characters · Solve to reveal`}</div>
        </div>
      </div>
      ${selUnlocked ? `<button id="trprac" class="badge" style="cursor:pointer">Practice Wordle</button>` : ''}
    </div>
    <div class="tr-grid" id="trgrid">
      ${slice.map(item => {
        const unl = unlockedSet.has(item.id);
        return `<div class="tr-cell ${unl ? 'unlocked' : 'locked'}" data-id="${item.id}" title="${unl ? item.th + ' (' + romanizeThai(item.th, st.phoneticsMode) + ')' : 'Locked (' + item.th.length + ' chars)'}">
          <span class="e">${unl ? item.emo : '❓'}</span>
          <span class="l">${unl ? item.th : item.th.length + 'ch'}</span>
        </div>`;
      }).join('')}
      ${filtered.length > trLimit ? `<button class="tr-more" id="trmore">Show more (${filtered.length - trLimit} remaining)</button>` : ''}
    </div>
  `;

  el.querySelectorAll('#trfseg button').forEach(b => b.onclick = () => { trFilter = b.dataset.tf; trLimit = 180; drawTrophyStage(el); });
  const inp = document.getElementById('trsearch');
  inp.oninput = e => {
    trQuery = e.target.value;
    trLimit = 180;
    drawTrophyStage(el);
    const ni = document.getElementById('trsearch');
    if (ni) { ni.focus(); ni.setSelectionRange(trQuery.length, trQuery.length); }
  };
  document.getElementById('trback').onclick = () => toggleTrophy(false);

  const trSpk = document.getElementById('trspk');
  if (trSpk) trSpk.onclick = () => speakThai(sel.th, true);

  const syncBtn = document.getElementById('trsync');
  if (syncBtn) {
    syncBtn.onclick = () => {
      const code = exportSyncCode(st);
      const input = prompt('Copy your 1-Click Sync Code, or paste a code from another device to merge progress:', code);
      if (input && input !== code) {
        const merged = importSyncCode(input, st);
        if (merged) {
          st = merged;
          unlockedSet.clear();
          st.emoUnlocked.forEach(id => unlockedSet.add(id));
          emoKnownSet.clear();
          st.emoKnown.forEach(c => emoKnownSet.add(c));
          save();
          drawTrophyStage(el);
        }
      }
    };
  }

  const more = document.getElementById('trmore');
  if (more) more.onclick = () => { trLimit += 300; drawTrophyStage(el); };
  const prac = document.getElementById('trprac');
  if (prac) prac.onclick = () => {
    viewMode = 'play';
    document.getElementById('trophbtn').classList.remove('on');
    cur = ['w', sel.th, romanizeThai(sel.th, st.phoneticsMode), sel.en, sel, false];
    buf = ''; rows = []; misses = 0; solved = false; hint = false; keyst = {}; locked = false; lastFlawTip = '';
    draw();
  };
  el.querySelectorAll('.tr-cell').forEach(cell => {
    cell.onclick = () => {
      selectedTrophy = EMOJI_DB[+cell.dataset.id];
      if (unlockedSet.has(selectedTrophy.id) && st.snd === 'voice') {
        speakThai(selectedTrophy.th, true);
      }
      drawTrophyStage(el);
    };
  });
}

function next() {
  if (cur[0] === 'i') {
    feed.push(`${disp(cur[1])} → ${U[cur[1]][0] || 'silent'}`);
    st.charLastSeen[cur[1]] = st.emoTurn;
  } else if (cur[0] === 'f') {
    feed.push(`🎯 ${disp(cur[1])} → ${cur[2]}`);
  } else {
    const emoObj = cur[4];
    feed.push(`${emoObj ? emoObj.emo + ' ' : ''}${cur[1]} · ${cur[2]} · ${cur[3]}`);
    if (emoObj && emoObj.id < EMOJI_DB.length) {
      unlockedSet.add(emoObj.id);
      selectedTrophy = emoObj;
    }
  }
  if (feed.length > 4) feed.shift();
  if (inTutorial()) {
    st.i++;
    if (!inTutorial()) {
      seedTutorialGlyphs();
    }
  } else if (cur[0] !== 'f') {
    st.emoTurn++;
  }
  st.n++;
  save();
  render();
}

function press(k) {
  if (viewMode === 'trophy' || locked) return;
  if (k === 'Enter') {
    if (solved) return next();
    if (cur[0] === 'w' && buf.length === cur[2].length) submit();
    return;
  }
  if (solved) return;
  if (k === 'Backspace') { buf = buf.slice(0, -1); return draw(); }

  if (cur[0] === 'i' || cur[0] === 'f') {
    const key = cur[0] === 'f' ? cur[2] : U[cur[1]][0];
    if (!key) { locked = true; ping(); draw('pop'); setTimeout(next, 600); return; }
    buf += k; tick();
    if (buf === key) {
      if (cur[0] === 'f' && cur[3] && cur[3].flawKey) {
        recordFlaw(cur[3].flawKey, misses === 0 ? -2 : -1);
      } else if (misses === 0) {
        recordFlaw(`char:${cur[1]}`, -1);
      }
      locked = true; ping(); draw('pop'); setTimeout(next, 600); return;
    }
    if (!key.startsWith(buf)) {
      misses++;
      recordFlaw(cur[0] === 'f' && cur[3] ? cur[3].flawKey : `char:${cur[1]}`, 1);
      save();
      soft(); buf = ''; return draw('miss');
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
    if (misses === 0 && !hint) {
      healWordFlaws(cur[1]);
    }
    if (cur[4] && cur[4].id < EMOJI_DB.length) {
      unlockedSet.add(cur[4].id);
      selectedTrophy = cur[4];
    }
    save();
    ping(cur[1]);
    draw('pop');
  } else {
    const diag = diagnoseAttempt(cur[1], t, buf);
    for (const d of diag) {
      recordFlaw(d.key, d.weight);
      if (d.tip && d.weight >= 2) lastFlawTip = d.tip;
    }
    save();
    misses++; soft(); buf = ''; if (misses >= 2) hint = true; draw();
  }
}

// ---------- Controls & Virtual Keyboard ----------
const kb = document.getElementById('kb');
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

addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
  else if (e.key === 'Enter' || e.key === 'Backspace') { e.preventDefault(); press(e.key); }
});

function setPhoneticsMode(pm) {
  st.phoneticsMode = pm === 'literal' ? 'literal' : 'real';
  window.AMBIENT_PHONETICS_MODE = st.phoneticsMode;
  document.querySelectorAll('#pseg button').forEach(b => b.classList.toggle('on', b.dataset.p === st.phoneticsMode));
  save();
  render();
}
document.querySelectorAll('#pseg button').forEach(b => b.onclick = () => setPhoneticsMode(b.dataset.p));

function setClueMode(cm) {
  st.clueMode = cm === 'learn' ? 'learn' : 'mystery';
  document.querySelectorAll('#cseg button').forEach(b => b.classList.toggle('on', b.dataset.c === st.clueMode));
  save();
  draw();
}
document.querySelectorAll('#cseg button').forEach(b => b.onclick = () => setClueMode(b.dataset.c));

function toggleTrophy(force) {
  viewMode = (force !== undefined ? (force ? 'trophy' : 'play') : (viewMode === 'trophy' ? 'play' : 'trophy'));
  document.getElementById('trophbtn').classList.toggle('on', viewMode === 'trophy');
  draw();
}
document.getElementById('trophbtn').onclick = () => toggleTrophy();

function setMode(m) {
  st.m = m; document.body.className = m;
  document.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  save();
}
document.querySelectorAll('#seg button').forEach(b => b.onclick = () => setMode(b.dataset.m));

function syncSoundUI() {
  st.snd = normalizeSnd(st.snd);
  document.querySelectorAll('#sseg button').forEach(b => b.classList.toggle('on', b.dataset.s === st.snd));
}

function setSoundMode(s, preview = false) {
  st.snd = normalizeSnd(s);
  syncSoundUI();
  save();
  if (preview) {
    if (st.snd === 'dings') ping();
    else if (st.snd === 'voice') ping(cur && cur[0] === 'w' ? cur[1] : 'สวัสดี');
  }
}
document.querySelectorAll('#sseg button').forEach(b => b.onclick = () => setSoundMode(b.dataset.s, true));

function setFont(f) {
  if (!FONTS[f] && f !== 'mix') f = 'modern';
  st.f = f;
  applyTurnFont();
  document.querySelectorAll('#fseg button').forEach(b => b.classList.toggle('on', b.dataset.f === f));
  save();
}
document.querySelectorAll('#fseg button').forEach(b => b.onclick = () => setFont(b.dataset.f));

const fs = document.getElementById('fs'), D = document;
if (fs) {
  if (!(D.fullscreenEnabled || D.webkitFullscreenEnabled)) fs.style.display = 'none';
  fs.onclick = () => {
    try {
      const on = D.fullscreenElement || D.webkitFullscreenElement, e = D.documentElement;
      const p = on ? (D.exitFullscreen || D.webkitExitFullscreen).call(D) : (e.requestFullscreen || e.webkitRequestFullscreen).call(e);
      if (p && p.catch) p.catch(() => {});
    } catch (x) {}
  };
  const fsl = () => { fs.textContent = (D.fullscreenElement || D.webkitFullscreenElement) ? 'exit full screen' : 'full screen'; };
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
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && !setPanel.hidden) toggleSettings(false);
  });
}

const replayTutBtn = document.getElementById('replaytut');
if (replayTutBtn) {
  replayTutBtn.onclick = () => {
    st.i = 0;
    save();
    toggleSettings(false);
    if (viewMode === 'trophy') toggleTrophy(false);
    else render();
  };
}

setFont(st.f || 'modern');
setMode(st.m || 'A');
setSoundMode(st.snd || 'dings', false);
setPhoneticsMode(st.phoneticsMode || 'real');
setClueMode(st.clueMode || 'mystery');
render();
