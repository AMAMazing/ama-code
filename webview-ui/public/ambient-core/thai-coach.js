// ---------- Thai Diagnostic Flaw Engine, Flaw-Aware Scheduler & Emoji Trophy UI ----------
const ThaiCoach = (() => {
  const AMP = String.fromCharCode(38);
  const escAttr = s => String(s || '').replace(/"/g, AMP + 'quot;');

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

  function recordFlaw(st, key, delta) {
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

  function diagnoseAttempt(st, th, targetRom, guess) {
    const events = [];
    const feat = getWordFeatures(th);
    const g = (guess || '').toLowerCase();

    for (const initChar of feat.initials) {
      const twins = LOOKALIKE_TWINS[initChar];
      if (!twins || !U[initChar]) continue;
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

    if (st.phoneticsMode !== 'literal') {
      for (const [finChar, shiftedSnd] of feat.finals.entries()) {
        const initSnd = U[finChar] && U[finChar][0];
        if (initSnd && g.endsWith(initSnd) && !targetRom.endsWith(initSnd)) {
          events.push({
            key: `final:${finChar}`,
            weight: 2,
            tip: `Position shift: ${finChar} is “${initSnd}” at start, but “-${shiftedSnd}” at the end`
          });
        }
      }
      for (const pv of feat.preVowels) {
        const pvSnd = U[pv] && U[pv][0];
        if (pvSnd && g.startsWith(pvSnd) && !targetRom.startsWith(pvSnd)) {
          events.push({
            key: `pre:${pv}`,
            weight: 2,
            tip: `Order: ${disp(pv)} (${pvSnd}) is written left, but spoken AFTER the consonant`
          });
        }
      }
    }

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

  function healWordFlaws(st, th) {
    if (!st.flaws) return;
    const feat = getWordFeatures(th);
    for (const ch of new Set([...th])) {
      if (st.flaws[`char:${ch}`]) recordFlaw(st, `char:${ch}`, -1);
      if (LOOKALIKE_TWINS[ch]) {
        for (const [tw] of LOOKALIKE_TWINS[ch]) {
          const pk = `twin:${[ch, tw].sort().join('|')}`;
          if (st.flaws[pk]) recordFlaw(st, pk, -1);
        }
      }
    }
    for (const [finChar] of feat.finals) {
      if (st.flaws[`final:${finChar}`]) recordFlaw(st, `final:${finChar}`, -1);
    }
    for (const pv of feat.preVowels) {
      if (st.flaws[`pre:${pv}`]) recordFlaw(st, `pre:${pv}`, -1);
    }
  }

  function pickFlawAwareEmojiStep(st, unlockedSet, emoKnownSet, saveFn) {
    const targetRom = item => (st.phoneticsMode === 'literal' ? item.romLit : item.romReal);
    const flaws = st.flaws || {};

    if (st.emoTurn > 0 && st.emoTurn % 6 === 0 && st.lastFlawTurn !== st.emoTurn) {
      const entries = Object.entries(flaws)
        .filter(([, sc]) => sc >= 2)
        .sort((a, b) => b[1] - a[1]);

      if (entries.length) {
        st.lastFlawTurn = st.emoTurn;
        const [flawKey] = entries[0];

        if (flawKey.startsWith('twin:')) {
          const [c1, c2] = flawKey.slice(5).split('|');
          if (c1 && c2 && U[c1] && U[c2] && U[c1][0] && U[c2][0]) {
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
          if (ch && U[ch] && shifted) {
            return ['f', ch, shifted, {
              flawKey,
              badge: `🎯 Flaw Buster · End-of-Syllable ${ch}`,
              hook: `At start ${ch} = “${U[ch][0]}”, but at the END of a syllable ${ch} → “-${shifted}”. Type its ending sound:`
            }];
          }
        }

        if (flawKey.startsWith('char:')) {
          const ch = flawKey.slice(5);
          if (ch && U[ch] && U[ch][0]) {
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

    if (!best) best = EMOJI_DB[Math.abs(st.emoTurn) % EMOJI_DB.length] || EMOJI_DB[0];

    for (const c of best.th) {
      if (!U[c]) continue;
      if (!emoKnownSet.has(c)) {
        emoKnownSet.add(c);
        st.charLastSeen[c] = st.emoTurn;
        saveFn();
        return ['i', c, false, best];
      }
    }

    for (const c of best.th) st.charLastSeen[c] = st.emoTurn;
    const rom = targetRom(best) || romanizeThai(best.th, st.phoneticsMode) || 'thai';
    return ['w', best.th, rom, best.en, best, false];
  }

  function drawTrophyStage(el, ctx) {
    const { st, unlockedSet, emoKnownSet, selectedTrophy, trFilter, trQuery, trLimit } = ctx;
    const filtered = EMOJI_DB.filter(item => {
      const unl = unlockedSet.has(item.id);
      if (trFilter === 'unlocked' && !unl) return false;
      if (trFilter === 'locked' && unl) return false;
      if (trFilter === 'core' && !item.isCore) return false;
      if (trQuery) {
        if (!unl) return false;
        const q = trQuery.toLowerCase();
        return (item.en || '').toLowerCase().includes(q) || (item.th || '').includes(q) || (item.rom || '').includes(q) || (item.emo || '').includes(q);
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
          <input class="tr-search" id="trsearch" placeholder="Search earned..." value="${escAttr(trQuery)}">
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

    el.querySelectorAll('#trfseg button').forEach(b => b.onclick = () => ctx.onFilter(b.dataset.tf));
    const inp = document.getElementById('trsearch');
    if (inp) inp.oninput = e => ctx.onSearch(e.target.value);
    const backBtn = document.getElementById('trback');
    if (backBtn) backBtn.onclick = () => ctx.onBack();
    const trSpk = document.getElementById('trspk');
    if (trSpk) trSpk.onclick = () => ctx.onSpeak(sel.th);
    const syncBtn = document.getElementById('trsync');
    if (syncBtn) syncBtn.onclick = () => ctx.onSync();
    const more = document.getElementById('trmore');
    if (more) more.onclick = () => ctx.onMore();
    const prac = document.getElementById('trprac');
    if (prac) prac.onclick = () => ctx.onPractice(sel);
    el.querySelectorAll('.tr-cell').forEach(cell => {
      cell.onclick = () => {
        const found = EMOJI_DB[+cell.dataset.id];
        if (found) ctx.onSelect(found);
      };
    });
  }

  return {
    LOOKALIKE_TWINS,
    recordFlaw,
    diagnoseAttempt,
    healWordFlaws,
    pickFlawAwareEmojiStep,
    drawTrophyStage
  };
})();