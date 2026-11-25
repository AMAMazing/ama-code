// ---------- Language-Agnostic Media Comprehension Engine, Smart Mix Scheduler & Library UI ----------
const MediaEngine = (() => {
  const AMP = String.fromCharCode(38);
  const STAGE_META = [
    { id: 0, key: 'recognize', label: '1 · Meaning' },
    { id: 1, key: 'cloze', label: '2 · Context' },
    { id: 2, key: 'listen', label: '3 · Listen' }
  ];

  function esc(str) {
    return String(str || '')
      .replace(/&/g, AMP + 'amp;')
      .replace(/</g, AMP + 'lt;')
      .replace(/>/g, AMP + 'gt;')
      .replace(/"/g, AMP + 'quot;');
  }

  function escapeRegex(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function formatExample(sentence, term, mode) {
    const raw = String(sentence || '');
    if (!term || !raw) return esc(raw);
    try {
      const rx = new RegExp(escapeRegex(term), 'gi');
      let out = '';
      let lastIdx = 0;
      let matched = false;
      raw.replace(rx, (m, offset) => {
        out += esc(raw.slice(lastIdx, offset));
        out += mode === 'blank'
          ? '<span class="m-blank">_____</span>'
          : `<mark class="m-hl">${esc(m)}</mark>`;
        lastIdx = offset + m.length;
        matched = true;
        return m;
      });
      if (!matched) return esc(raw);
      out += esc(raw.slice(lastIdx));
      return out;
    } catch (e) {
      return esc(raw);
    }
  }

  function speakLang(text, lang, rate = 0.96) {
    if (typeof speechSynthesis === 'undefined' || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const code = lang || 'es-MX';
      u.lang = code;
      u.rate = rate;
      u.pitch = 1.0;
      const voices = speechSynthesis.getVoices() || [];
      const exact = voices.find(v => v.lang && v.lang.toLowerCase() === code.toLowerCase());
      const prefix = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(code.split('-')[0].toLowerCase()));
      if (exact || prefix) u.voice = exact || prefix;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  function getShowsList(st) {
    return Object.values((st && st.shows) || {}).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function getAllReadyCards(st, overrideShowId) {
    const shows = (st && st.shows) || {};
    const ignored = new Set((st && st.mediaIgnored) || []);
    const minCount = (st && st.mediaMinCount) || 2;
    const targetId = overrideShowId !== undefined ? overrideShowId : (st && st.activeShowId) || 'all';
    const selectedShows = targetId !== 'all' && shows[targetId] ? [shows[targetId]] : Object.values(shows);
    const out = [];
    for (const show of selectedShows) {
      out.push(...TrancyParser.getShowReadyTerms(show, ignored, minCount));
    }
    out.sort((a, b) => (a.n - b.n) || (b.count - a.count) || a.text.localeCompare(b.text));
    return out;
  }

  function pickTrackForTurn(st) {
    const mode = (st && st.trackMode) || 'thai';
    if (mode === 'thai') return 'thai';
    const ready = getAllReadyCards(st);
    if (mode === 'media') return 'media';
    if (!ready.length) return 'thai';

    const turn = (st && st.mixTurn) || 0;
    if ((st && st.freshBoost) > 0) {
      return turn % 3 !== 2 ? 'media' : 'thai';
    }
    const ratio = (st && st.mixRatio) || '3:1';
    if (ratio === '1:1') return turn % 2 === 1 ? 'media' : 'thai';
    if (ratio === '1:3') return turn % 4 === 0 ? 'thai' : 'media';
    return turn % 4 === 3 ? 'media' : 'thai';
  }

  function resolveStage(st, prog, card) {
    const pref = (st && st.mediaStage) || 'auto';
    const hasEx = Boolean(card.examples && card.examples.length && card.examples[0].src);
    if (pref === 'recognize') return 0;
    if (pref === 'cloze') return hasEx ? 1 : 0;
    if (pref === 'listen') return 2;
    const streak = prog ? prog.streak || 0 : 0;
    if (streak >= 3) return 2;
    if (streak >= 1 && hasEx) return 1;
    return 0;
  }

  function buildChoices(card, allCards) {
    const targetGloss = card.gloss.trim();
    const targetNorm = targetGloss.toLowerCase();
    const pool = allCards.filter(c => {
      if (c.cardKey === card.cardKey) return false;
      const g = c.gloss.trim().toLowerCase();
      return g && g !== targetNorm && !g.includes(targetNorm) && !targetNorm.includes(g);
    });
    // Prefer distractors of similar n-gram length and gloss length
    pool.sort((a, b) => {
      const sameA = a.n === card.n ? 0 : 1;
      const sameB = b.n === card.n ? 0 : 1;
      if (sameA !== sameB) return sameA - sameB;
      const lenA = Math.abs(a.gloss.length - targetGloss.length);
      const lenB = Math.abs(b.gloss.length - targetGloss.length);
      return lenA - lenB;
    });

    const picked = [];
    const usedGloss = new Set([targetNorm]);
    const windowPool = pool.slice(0, 24);
    for (let i = windowPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [windowPool[i], windowPool[j]] = [windowPool[j], windowPool[i]];
    }
    for (const cand of windowPool) {
      const gNorm = cand.gloss.trim().toLowerCase();
      if (usedGloss.has(gNorm)) continue;
      usedGloss.add(gNorm);
      picked.push({ gloss: cand.gloss.trim(), correct: false });
      if (picked.length >= 3) break;
    }

    const fallbacks = ['something else', 'another phrase', 'not this one'];
    let fi = 0;
    while (picked.length < 3 && fi < fallbacks.length) {
      picked.push({ gloss: fallbacks[fi++], correct: false });
    }

    const choices = [{ gloss: targetGloss, correct: true }, ...picked];
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return choices;
  }

  function pickNextMediaStep(st, lastCardKey) {
    const allCards = getAllReadyCards(st);
    if (!allCards.length) return ['m-empty'];

    const progress = (st && st.mediaProgress) || {};
    const turn = (st && st.mediaTurn) || 0;
    const words = allCards.filter(c => c.n === 1);
    const seenWords = words.filter(c => (progress[c.cardKey]?.seen || 0) > 0).length;
    const chunksUnlocked = words.length === 0 || seenWords >= Math.min(8, words.length) || (turn > 0 && turn % 4 === 3);

    const eligible = chunksUnlocked ? allCards : words;
    let best = eligible[0];
    let bestScore = -1e9;

    for (const card of eligible) {
      const p = progress[card.cardKey] || { streak: 0, seen: 0, correct: 0, wrong: 0, lastTurn: 0 };
      let score = 0;
      if (card.cardKey === lastCardKey && eligible.length > 1) score -= 5000;

      if (p.seen === 0) {
        // High-frequency unseen words/chunks surface first
        const tierPenalty = (card.n - 1) * 45;
        score += 180 + Math.min(card.count * 14, 160) - tierPenalty;
      } else {
        const interval = Math.min(32, 3 * Math.pow(2, Math.min(p.streak, 4)));
        const age = Math.max(0, turn - (p.lastTurn || 0));
        if (age >= interval) {
          score += 240 + Math.min((age - interval) * 18, 180);
        } else {
          score -= 120 - age * 8;
        }
        if (p.streak === 0) score += 110;
        if (p.wrong > p.correct) score += 60;
      }

      // Small tie-breaker favoring higher corpus count
      score += Math.min(card.count * 2, 24);
      if (score > bestScore) {
        bestScore = score;
        best = card;
      }
    }

    const prog = progress[best.cardKey] || { streak: 0, seen: 0, correct: 0, wrong: 0, lastTurn: 0, stage: 0 };
    const stage = resolveStage(st, prog, best);
    const choices = buildChoices(best, allCards);
    const example = (best.examples && best.examples[0]) || null;

    return ['m', { card: best, stage, choices, example, answeredIdx: -1, correct: false }];
  }

  function renderMediaStage(el, step, st, api) {
    if (step[0] === 'm-empty') {
      const showCount = getShowsList(st).length;
      el.innerHTML = `
        <div class="m-empty">
          <div class="m-empty-ico">📺</div>
          <h3>${showCount ? 'No recurring terms meet the filter yet' : 'Import a Trancy .md Export'}</h3>
          <p>${showCount
            ? 'Upload another episode to accumulate cross-episode frequencies, or lower the min-frequency threshold in Settings.'
            : 'Watch any show with Trancy, export the .md subtitles, and drop it here to learn the most frequent words & 2-word chunks.'}</p>
          <div class="m-empty-acts">
            <button id="mopenlib" class="m-primary" type="button">📥 Upload Trancy .md</button>
            <button id="mswitchth" class="badge" type="button">🇹🇭 Practice Thai</button>
          </div>
        </div>
      `;
      const openBtn = document.getElementById('mopenlib');
      if (openBtn) openBtn.onclick = () => api.openLibrary();
      const swBtn = document.getElementById('mswitchth');
      if (swBtn) swBtn.onclick = () => api.setTrackMode('thai');
      return;
    }

    const data = step[1];
    const { card, stage, choices, example, answeredIdx, correct } = data;
    const answered = answeredIdx >= 0;
    const langMeta = TrancyParser.getLangMeta(card.lang);
    const nLabel = card.n === 1 ? 'word' : `${card.n}-word`;
    const stMeta = STAGE_META[stage] || STAGE_META[0];
    const boostTag = (st.freshBoost || 0) > 0 ? '<span class="badge rev">⚡ Fresh Episode</span>' : '';

    let promptHtml = '';
    if (stage === 2 && !answered) {
      promptHtml = `
        <button id="mlistenbtn" class="m-listen-btn" type="button" title="Replay audio (Space)">
          <span class="m-listen-ico">🔊</span>
          <span>Tap or press Space to listen</span>
        </button>
      `;
    } else if (stage === 1 && !answered && example) {
      promptHtml = `
        <div class="m-term">${esc(card.text)} <button id="mspk" class="spk-inline" type="button" title="Listen (Space)">🔊</button></div>
        <div class="m-cloze">${formatExample(example.src, card.text, 'highlight')}</div>
      `;
    } else {
      promptHtml = `
        <div class="m-term">${esc(card.text)} <button id="mspk" class="spk-inline" type="button" title="Listen (Space)">🔊</button></div>
      `;
    }

    const choicesHtml = choices.map((ch, idx) => {
      let cls = 'm-choice';
      if (answered) {
        if (ch.correct) cls += ' ok';
        else if (idx === answeredIdx) cls += ' bad';
        else cls += ' dim';
      }
      return `<button class="${cls}" data-cidx="${idx}" type="button" ${answered ? 'disabled' : ''}>
        <span class="m-num">${idx + 1}</span>
        <span class="m-ctext">${esc(ch.gloss)}</span>
      </button>`;
    }).join('');

    const revealHtml = answered && example
      ? `<div class="m-ex">
          <div class="m-ex-src">${formatExample(example.src, card.text, 'highlight')}</div>
          ${example.tgt ? `<div class="m-ex-tgt">${esc(example.tgt)}</div>` : ''}
        </div>`
      : '';

    const footerHtml = answered
      ? `<div class="m-act">
          <button id="mnextbtn" class="m-primary" type="button">${correct ? 'Next (Enter) →' : 'Got it · Next (Enter) →'}</button>
          <button id="meditbtn" class="m-ghost" type="button" title="Edit English meaning">✎ Gloss</button>
          <button id="mignbtn" class="m-ghost" type="button" title="Ignore proper noun / typo (X)">🚫 Ignore</button>
        </div>`
      : `<div class="m-act">
          <button id="mignbtn" class="m-ghost" type="button" title="Banish proper noun or transcription error (X)">🚫 Ignore (X)</button>
          <button id="meditbtn" class="m-ghost" type="button" title="Set custom meaning">✎ Edit Gloss</button>
        </div>`;

    el.innerHTML = `
      <div class="m-wrap">
        <div class="m-meta">
          <span class="badge">${langMeta.flag} ${esc(card.showName)}</span>
          <span class="badge">×${card.count} · ${nLabel}</span>
          <span class="badge">${stMeta.label}</span>
          ${boostTag}
        </div>
        <div class="m-prompt">${promptHtml}</div>
        <div class="m-choices">${choicesHtml}</div>
        ${revealHtml}
        ${footerHtml}
      </div>
    `;

    el.querySelectorAll('.m-choice').forEach(btn => {
      btn.onpointerdown = e => {
        e.preventDefault();
        api.answerMedia(Number(btn.dataset.cidx));
      };
    });
    const spkBtn = document.getElementById('mspk');
    if (spkBtn) spkBtn.onpointerdown = e => { e.preventDefault(); api.replayMediaAudio(); };
    const listenBtn = document.getElementById('mlistenbtn');
    if (listenBtn) listenBtn.onpointerdown = e => { e.preventDefault(); api.replayMediaAudio(); };
    const nextBtn = document.getElementById('mnextbtn');
    if (nextBtn) nextBtn.onclick = () => api.nextStep();
    const ignBtn = document.getElementById('mignbtn');
    if (ignBtn) ignBtn.onclick = () => api.ignoreMediaTerm(card);
    const editBtn = document.getElementById('meditbtn');
    if (editBtn) editBtn.onclick = () => api.editMediaGloss(card);
  }

  let libFilter = 'all';
  let libQuery = '';
  let libStatusMsg = '';
  let pendingMdText = '';
  let pendingFilename = '';

  function renderLibraryStage(el, st, api) {
    const shows = getShowsList(st);
    const activeShowId = st.activeShowId || 'all';
    const cards = getAllReadyCards(st, activeShowId).filter(c => {
      if (libFilter === 'words' && c.n !== 1) return false;
      if (libFilter === 'chunks' && c.n < 2) return false;
      if (libQuery) {
        const q = libQuery.toLowerCase();
        return c.text.toLowerCase().includes(q) || c.gloss.toLowerCase().includes(q);
      }
      return true;
    });

    const langOpts = TrancyParser.SUPPORTED_LANGUAGES
      .map(l => `<option value="${l.code}">${l.flag} ${esc(l.label)}</option>`)
      .join('');

    const showTargetOpts = [
      '<option value="__new__">+ Create New Show</option>',
      ...shows.map(s => `<option value="${esc(s.id)}" ${s.id === activeShowId ? 'selected' : ''}>Add to: ${esc(s.name)} (${s.episodeCount} ep)</option>`)
    ].join('');

    const showChips = [
      `<button class="lib-chip ${activeShowId === 'all' ? 'on' : ''}" data-sid="all" type="button">🌐 All (${getAllReadyCards(st, 'all').length})</button>`,
      ...shows.map(s => {
        const meta = TrancyParser.getLangMeta(s.lang);
        const cnt = TrancyParser.getShowReadyTerms(s, new Set(st.mediaIgnored || []), st.mediaMinCount || 2).length;
        return `<span class="lib-chip-wrap">
          <button class="lib-chip ${activeShowId === s.id ? 'on' : ''}" data-sid="${esc(s.id)}" type="button">${meta.flag} ${esc(s.name)} · ${s.episodeCount}ep (${cnt})</button>
          <button class="lib-del" data-del="${esc(s.id)}" type="button" title="Delete show">×</button>
        </span>`;
      })
    ].join('');

    el.innerHTML = `
      <div class="lib-wrap">
        <div class="tr-head">
          <div class="tr-stats">
            <strong>📺 Media Decks</strong>
            <span>${shows.length} show${shows.length === 1 ? '' : 's'} · ${cards.length} ready cards</span>
          </div>
          <div class="tr-controls">
            <button id="libsync" class="badge" type="button">🔄 Sync Code</button>
            <button id="libback" class="badge" type="button">▶ Back to Play</button>
          </div>
        </div>

        <div class="lib-import" id="libdrop">
          <div class="lib-row">
            <label class="m-primary lib-file-btn">
              📂 Choose Trancy .md
              <input id="libfile" type="file" accept=".md,.txt,text/markdown,text/plain" hidden>
            </label>
            <select id="libtarget" class="lib-inp">${showTargetOpts}</select>
            <input id="libname" class="lib-inp" placeholder="Show name (auto from file)" value="${esc(pendingFilename)}">
            <select id="liblang" class="lib-inp">${langOpts}</select>
          </div>
          <textarea id="libpaste" class="lib-paste" rows="2" placeholder="Or drag & drop a Trancy .md file here, or paste its markdown text...">${esc(pendingMdText)}</textarea>
          <div class="lib-row lib-row-end">
            <span class="lib-status" id="libstatus">${esc(libStatusMsg || 'Frequencies merge across episodes. Single-occurrence typos stay filtered out.')}</span>
            <button id="libimportbtn" class="m-primary" type="button">⚡ Import Episode</button>
          </div>
        </div>

        ${shows.length ? `<div class="lib-shows">${showChips}</div>` : ''}

        <div class="lib-filter-row">
          <div class="seg" id="libfseg">
            <button data-lf="all" class="${libFilter === 'all' ? 'on' : ''}" type="button">All</button>
            <button data-lf="words" class="${libFilter === 'words' ? 'on' : ''}" type="button">1-Word</button>
            <button data-lf="chunks" class="${libFilter === 'chunks' ? 'on' : ''}" type="button">2-3 Words</button>
          </div>
          <input id="libsearch" class="tr-search" placeholder="Filter terms..." value="${esc(libQuery)}">
        </div>

        <div class="lib-list">
          ${cards.slice(0, 120).map(c => {
            const p = (st.mediaProgress && st.mediaProgress[c.cardKey]) || null;
            const stLbl = p && p.streak >= 3 ? '🎧' : p && p.streak >= 1 ? '📖' : '🆕';
            return `<div class="lib-item">
              <div class="lib-item-main">
                <span class="lib-cnt">×${c.count}</span>
                <span class="lib-term">${esc(c.text)}</span>
                <span class="lib-gloss">${esc(c.gloss)}</span>
              </div>
              <div class="lib-item-acts">
                <span title="Mastery stage">${stLbl}</span>
                <button class="lib-mini" data-edit="${esc(c.cardKey)}" type="button" title="Edit gloss">✎</button>
                <button class="lib-mini" data-ign="${esc(c.cardKey)}" type="button" title="Ignore">🚫</button>
              </div>
            </div>`;
          }).join('') || '<div class="lib-empty-note">Upload a Trancy .md file above to generate flashcards ranked most-common to least-common.</div>'}
        </div>
      </div>
    `;

    const backBtn = document.getElementById('libback');
    if (backBtn) backBtn.onclick = () => api.closeLibrary();
    const syncBtn = document.getElementById('libsync');
    if (syncBtn) syncBtn.onclick = () => api.openSyncPrompt();

    const targetSel = document.getElementById('libtarget');
    const nameInp = document.getElementById('libname');
    const langSel = document.getElementById('liblang');
    const pasteEl = document.getElementById('libpaste');
    const fileInp = document.getElementById('libfile');
    const dropEl = document.getElementById('libdrop');

    const syncTargetVisibility = () => {
      const isNew = !targetSel || targetSel.value === '__new__';
      if (nameInp) nameInp.style.display = isNew ? '' : 'none';
      if (langSel) langSel.style.display = isNew ? '' : 'none';
    };
    syncTargetVisibility();
    if (targetSel) targetSel.onchange = syncTargetVisibility;

    const loadFileText = (fileName, text) => {
      pendingMdText = text || '';
      const parsed = TrancyParser.parseTrancyMarkdown(pendingMdText);
      const detected = TrancyParser.detectLanguage(parsed.pairs);
      pendingFilename = parsed.title !== 'Imported Episode' ? parsed.title : fileName.replace(/\.[^.]+$/, '');
      if (pasteEl) pasteEl.value = pendingMdText;
      if (nameInp && !nameInp.value.trim()) nameInp.value = pendingFilename;
      if (langSel) langSel.value = detected;
      libStatusMsg = `Loaded ${parsed.pairs.length} lines (${parsed.collapsedLoops} loops cleaned) · Detected ${TrancyParser.getLangMeta(detected).label}`;
      const statusEl = document.getElementById('libstatus');
      if (statusEl) statusEl.textContent = libStatusMsg;
    };

    if (fileInp) {
      fileInp.onchange = () => {
        const f = fileInp.files && fileInp.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => loadFileText(f.name, String(reader.result || ''));
        reader.readAsText(f);
      };
    }

    if (dropEl) {
      dropEl.ondragover = e => { e.preventDefault(); dropEl.classList.add('drag'); };
      dropEl.ondragleave = () => dropEl.classList.remove('drag');
      dropEl.ondrop = e => {
        e.preventDefault();
        dropEl.classList.remove('drag');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => loadFileText(f.name, String(reader.result || ''));
        reader.readAsText(f);
      };
    }

    const importBtn = document.getElementById('libimportbtn');
    if (importBtn) {
      importBtn.onclick = () => {
        const md = (pasteEl ? pasteEl.value : pendingMdText).trim();
        if (!md) {
          libStatusMsg = 'Choose or paste a Trancy .md file first.';
          const statusEl = document.getElementById('libstatus');
          if (statusEl) statusEl.textContent = libStatusMsg;
          return;
        }
        const targetId = targetSel ? targetSel.value : '__new__';
        const res = api.importTrancy({
          mdText: md,
          showId: targetId === '__new__' ? null : targetId,
          name: nameInp ? nameInp.value.trim() : '',
          lang: langSel ? langSel.value : ''
        });
        pendingMdText = '';
        pendingFilename = '';
        libStatusMsg = `Imported "${res.stats.title}": ${res.stats.readyWords} words + ${res.stats.readyChunks} chunks ready!`;
        api.redraw();
      };
    }

    el.querySelectorAll('.lib-chip[data-sid]').forEach(btn => {
      btn.onclick = () => api.selectShow(btn.dataset.sid);
    });
    el.querySelectorAll('.lib-del[data-del]').forEach(btn => {
      btn.onclick = () => api.deleteShow(btn.dataset.del);
    });
    el.querySelectorAll('#libfseg button').forEach(btn => {
      btn.onclick = () => { libFilter = btn.dataset.lf; api.redraw(); };
    });
    const searchInp = document.getElementById('libsearch');
    if (searchInp) {
      searchInp.oninput = e => {
        libQuery = e.target.value;
        api.redraw();
        const ni = document.getElementById('libsearch');
        if (ni) { ni.focus(); ni.setSelectionRange(libQuery.length, libQuery.length); }
      };
    }
    el.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => {
        const found = cards.find(c => c.cardKey === btn.dataset.edit);
        if (found) api.editMediaGloss(found);
      };
    });
    el.querySelectorAll('[data-ign]').forEach(btn => {
      btn.onclick = () => {
        const found = cards.find(c => c.cardKey === btn.dataset.ign);
        if (found) api.ignoreMediaTerm(found);
      };
    });
  }

  return {
    esc,
    speakLang,
    getShowsList,
    getAllReadyCards,
    pickTrackForTurn,
    pickNextMediaStep,
    renderMediaStage,
    renderLibraryStage
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MediaEngine;
}