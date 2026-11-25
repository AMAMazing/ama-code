// ---------- Language-Agnostic Trancy .md Ingestion, Denoiser & Offline Gloss Aligner ----------
const TrancyParser = (() => {
  const AMP = String.fromCharCode(38);
  const SUPPORTED_LANGUAGES = [
    { code: 'es-MX', label: 'Spanish (LatAm)', flag: '🇲🇽' },
    { code: 'es-ES', label: 'Spanish (Spain)', flag: '🇪🇸' },
    { code: 'th-TH', label: 'Thai', flag: '🇹🇭' },
    { code: 'ja-JP', label: 'Japanese', flag: '🇯🇵' },
    { code: 'ko-KR', label: 'Korean', flag: '🇰🇷' },
    { code: 'fr-FR', label: 'French', flag: '🇫🇷' },
    { code: 'de-DE', label: 'German', flag: '🇩🇪' },
    { code: 'pt-BR', label: 'Portuguese', flag: '🇧🇷' },
    { code: 'it-IT', label: 'Italian', flag: '🇮🇹' },
    { code: 'zh-CN', label: 'Chinese (Mandarin)', flag: '🇨🇳' },
    { code: 'ru-RU', label: 'Russian', flag: '🇷🇺' },
    { code: 'vi-VN', label: 'Vietnamese', flag: '🇻🇳' },
    { code: 'ar-SA', label: 'Arabic', flag: '🇸🇦' },
    { code: 'hi-IN', label: 'Hindi', flag: '🇮🇳' },
    { code: 'nl-NL', label: 'Dutch', flag: '🇳🇱' },
    { code: 'tr-TR', label: 'Turkish', flag: '🇹🇷' },
    { code: 'en-US', label: 'English', flag: '🇺🇸' }
  ];

  // Common English function words excluded as standalone glosses unless no content word fits
  const EN_STOP = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'of', 'at', 'by', 'for', 'with', 'to', 'from',
    'in', 'on', 'it', 'its', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'that',
    'this', 'these', 'those', 'he', 'she', 'they', 'them', 'we', 'us', 'you', 'your', 'i', 'me',
    'my', 'his', 'her', 'their', 'our', 'as', 'do', 'does', 'did', 'has', 'have', 'had', 'will',
    'would', 'can', 'could', 'so', 'than', 'then', 'there', 'here', 'just', 'not', 'no', 'yes'
  ]);

  // Ultra-common target-language glue words that make poor standalone 1-gram flashcards (still allowed inside 2/3-grams!)
  const GENERIC_SINGLE_STOP = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o', 'e', 'u',
    'a', 'en', 'que', 'se', 'le', 'lo', 'su', 'sus', 'es', 'por', 'con', 'para', 'no', 'si', 'sí',
    'le', 'les', 'du', 'des', 'et', 'ou', 'un', 'une', 'au', 'aux', 'ce', 'il', 'je', 'tu', 'ne',
    'der', 'die', 'das', 'und', 'ein', 'eine', 'zu', 'im', 'am', 'ist', 'ich', 'er', 'sie', 'es',
    'il', 'lo', 'gli', 'di', 'da', 'che', 'non', 'per', 'con', 'un', 'una', 'ed',
    'o', 'os', 'as', 'um', 'uma', 'do', 'da', 'dos', 'das', 'em', 'na', 'no', 'que', 'se', 'e',
    'the', 'and', 'of', 'to', 'in', 'a', 'is', 'it', 'that', 'for'
  ]);

  const SPACELESS_PREFIXES = ['th', 'ja', 'zh', 'lo', 'km', 'my'];

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, AMP + 'amp;')
      .replace(/</g, AMP + 'lt;')
      .replace(/>/g, AMP + 'gt;')
      .replace(/"/g, AMP + 'quot;');
  }

  function isSpacelessLang(lang) {
    const l = String(lang || '').toLowerCase();
    return SPACELESS_PREFIXES.some(p => l.startsWith(p));
  }

  function normalizeText(str) {
    return String(str || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeKey(str) {
    return normalizeText(str)
      .toLowerCase()
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  }

  function parseTrancyMarkdown(mdText) {
    const lines = String(mdText || '').split(/\r?\n/);
    let title = '';
    const rawPairs = [];
    let pendingSrc = [];

    const flushPending = tgt => {
      const src = normalizeText(pendingSrc.join(' '));
      pendingSrc = [];
      if (!src) return;
      rawPairs.push({ src, tgt: normalizeText(tgt || '') });
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('#')) {
        if (!title) title = normalizeText(line.replace(/^#+\s*/, ''));
        continue;
      }
      if (line.startsWith('>')) {
        const tgt = line.replace(/^>+\s*/, '');
        if (pendingSrc.length) {
          flushPending(tgt);
        } else if (rawPairs.length) {
          rawPairs[rawPairs.length - 1].tgt = normalizeText(rawPairs[rawPairs.length - 1].tgt + ' ' + tgt);
        }
        continue;
      }
      // Strip common timestamp prefixes like [00:12] or 00:12:04 if pasted from subtitle tools
      const cleaned = line.replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\]?\s*[-–]?\s*/, '');
      if (!cleaned) continue;
      if (pendingSrc.length) {
        flushPending('');
      }
      pendingSrc.push(cleaned);
    }
    if (pendingSrc.length) flushPending('');

    // ASR Loop Denoiser: collapse consecutive identical normalized lines (e.g., 30x "¡Uno!")
    const pairs = [];
    let collapsedLoops = 0;
    let lastNorm = '';
    for (const p of rawPairs) {
      const nk = normalizeKey(p.src);
      if (!nk) continue;
      if (nk === lastNorm) {
        collapsedLoops++;
        continue;
      }
      lastNorm = nk;
      pairs.push(p);
    }

    return {
      title: title || 'Imported Episode',
      pairs,
      rawLineCount: rawPairs.length,
      collapsedLoops
    };
  }

  function detectLanguage(pairs) {
    const sample = pairs.slice(0, 60).map(p => p.src).join(' ');
    if (/[\u0E00-\u0E7F]/.test(sample)) return 'th-TH';
    if (/[\u3040-\u30FF]/.test(sample)) return 'ja-JP';
    if (/[\uAC00-\uD7AF]/.test(sample)) return 'ko-KR';
    if (/[\u4E00-\u9FFF]/.test(sample)) return 'zh-CN';
    if (/[\u0400-\u04FF]/.test(sample)) return 'ru-RU';
    if (/[\u0600-\u06FF]/.test(sample)) return 'ar-SA';
    if (/[\u0900-\u097F]/.test(sample)) return 'hi-IN';

    const low = ' ' + sample.toLowerCase() + ' ';
    const score = words => words.reduce((acc, w) => acc + (low.includes(' ' + w + ' ') ? 1 : 0), 0);
    const scores = [
      ['es-MX', score(['que', 'los', 'las', 'por', 'para', 'pero', 'aquí', 'está', 'más', 'con', 'todo']) + (/[¡¿ñ]/.test(low) ? 4 : 0)],
      ['fr-FR', score(['les', 'des', 'que', 'dans', 'pour', 'pas', 'mais', 'avec', 'vous', 'est', 'une']) + (/[çœ]/.test(low) ? 3 : 0)],
      ['de-DE', score(['der', 'die', 'das', 'und', 'nicht', 'mit', 'ich', 'ist', 'ein', 'auf', 'für']) + (/[ßäöü]/.test(low) ? 3 : 0)],
      ['pt-BR', score(['que', 'não', 'com', 'para', 'uma', 'por', 'mais', 'está', 'você', 'isso']) + (/[ãõç]/.test(low) ? 4 : 0)],
      ['it-IT', score(['che', 'non', 'per', 'con', 'una', 'sono', 'della', 'anche', 'questo', 'più'])],
      ['vi-VN', /[ăđơưạảấầẩẫậ]/.test(low) ? 6 : 0]
    ];
    scores.sort((a, b) => b[1] - a[1]);
    return scores[0][1] >= 2 ? scores[0][0] : 'es-MX';
  }

  function tokenizeLine(text, lang) {
    const clean = normalizeText(text);
    const tokens = [];
    let clauseIdx = 0;
    const spaceless = isSpacelessLang(lang);
    const shortLang = String(lang || 'en').split('-')[0];

    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      try {
        const seg = new Intl.Segmenter(shortLang, { granularity: 'word' });
        let prevEndedSentence = true;
        let seenWordInClause = 0;
        for (const part of seg.segment(clean)) {
          const s = part.segment;
          if (!part.isWordLike) {
            if (/[.,!?;:¡¿—–\n]/.test(s)) {
              clauseIdx++;
              seenWordInClause = 0;
            }
            if (/[.!?¡¿]/.test(s)) prevEndedSentence = true;
            continue;
          }
          if (/^\d+$/.test(s)) continue;
          const norm = s.toLowerCase();
          if (!spaceless && norm.length < 2) {
            prevEndedSentence = false;
            seenWordInClause++;
            continue;
          }
          const isUpper = !spaceless && s[0] !== s[0].toLowerCase() && s[0] === s[0].toUpperCase();
          const isCapMid = Boolean(isUpper && !prevEndedSentence && seenWordInClause > 0);
          tokens.push({ raw: s, norm, isCapMid, clauseIdx });
          prevEndedSentence = false;
          seenWordInClause++;
        }
        return tokens;
      } catch (e) {}
    }

    // Fallback tokenizer
    const parts = clean.split(/([.,!?;:¡¿—–]+|\s+)/);
    let prevEndedSentence = true;
    let seenWordInClause = 0;
    for (const p of parts) {
      if (!p || /^\s+$/.test(p)) continue;
      if (/^[.,!?;:¡¿—–]+$/.test(p)) {
        clauseIdx++;
        seenWordInClause = 0;
        if (/[.!?¡¿]/.test(p)) prevEndedSentence = true;
        continue;
      }
      const word = p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (!word || /^\d+$/.test(word)) continue;
      const norm = word.toLowerCase();
      if (!spaceless && norm.length < 2) { prevEndedSentence = false; seenWordInClause++; continue; }
      const isUpper = !spaceless && word[0] !== word[0].toLowerCase() && word[0] === word[0].toUpperCase();
      tokens.push({ raw: word, norm, isCapMid: Boolean(isUpper && !prevEndedSentence && seenWordInClause > 0), clauseIdx });
      prevEndedSentence = false;
      seenWordInClause++;
    }
    return tokens;
  }

  function tokenizeEnglish(text) {
    const clean = normalizeText(text).toLowerCase();
    const matches = clean.match(/[a-z][a-z']*/g) || [];
    return matches.filter(w => w.length >= 2 || w === 'i');
  }

  function inferGlossesForBatch(candidates, pairs) {
    // Build corpus-wide English 1-gram and 2-gram document frequencies for Dice alignment
    const engDocFreq = new Map();
    const pairEngTokens = pairs.map(p => {
      const words = tokenizeEnglish(p.tgt);
      const unique = new Set();
      for (let i = 0; i < words.length; i++) {
        unique.add(words[i]);
        if (i + 1 < words.length) unique.add(words[i] + ' ' + words[i + 1]);
        if (i + 2 < words.length) unique.add(words[i] + ' ' + words[i + 1] + ' ' + words[i + 2]);
      }
      for (const tok of unique) engDocFreq.set(tok, (engDocFreq.get(tok) || 0) + 1);
      return { words, unique, cleanTgt: normalizeText(p.tgt) };
    });

    for (const item of candidates.values()) {
      const lineIdxs = [...item.lineIdxs];
      const termLines = lineIdxs.length;
      if (!termLines) continue;

      // 1. Short exact-line match (e.g., "¡Otra vez!" -> "Again!")
      let exactSnippet = '';
      for (const idx of lineIdxs) {
        const srcClean = normalizeKey(pairs[idx].src);
        const tgtClean = pairEngTokens[idx].cleanTgt.replace(/^["'¡¿]+|["'.,!?]+$/g, '').trim();
        if (tgtClean && tgtClean.length <= 42 && srcClean && item.key.length / srcClean.length >= 0.58) {
          if (!exactSnippet || tgtClean.length < exactSnippet.length) exactSnippet = tgtClean;
        }
      }
      if (exactSnippet) {
        item.gloss = exactSnippet;
        continue;
      }

      // 2. Cross-line Dice alignment when term appears in >= 2 lines
      if (termLines >= 2) {
        const coFreq = new Map();
        for (const idx of lineIdxs) {
          for (const tok of pairEngTokens[idx].unique) {
            coFreq.set(tok, (coFreq.get(tok) || 0) + 1);
          }
        }
        let bestTok = '';
        let bestScore = 0;
        for (const [tok, co] of coFreq.entries()) {
          if (co < 2) continue;
          const parts = tok.split(' ');
          if (parts.length === 1 && EN_STOP.has(tok)) continue;
          if (parts.length > 1 && parts.every(w => EN_STOP.has(w))) continue;
          const df = engDocFreq.get(tok) || co;
          const dice = (2 * co) / (termLines + df);
          const phraseMatchBonus = parts.length === item.n ? 1.18 : (parts.length <= item.n + 1 ? 1.0 : 0.82);
          const score = dice * phraseMatchBonus;
          if (score > bestScore) {
            bestScore = score;
            bestTok = tok;
          }
        }
        if (bestTok && bestScore >= 0.28) {
          item.gloss = bestTok;
          continue;
        }
      }

      // 3. Fallback: pick shortest clean translation snippet from its examples
      const sortedEx = lineIdxs
        .map(idx => pairEngTokens[idx].cleanTgt)
        .filter(Boolean)
        .sort((a, b) => a.length - b.length);
      if (sortedEx.length) {
        const raw = sortedEx[0];
        item.gloss = raw.length > 56 ? raw.slice(0, 53).trim() + '…' : raw;
      }
    }
  }

  function makeShowId(name, lang) {
    const slug = normalizeKey(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'show';
    return `${String(lang || 'xx').slice(0, 5).toLowerCase()}-${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  function ingestTrancyIntoShow(existingShow, mdText, options = {}) {
    const parsed = parseTrancyMarkdown(mdText);
    const lang = options.lang || (existingShow && existingShow.lang) || detectLanguage(parsed.pairs);
    const name = (options.name && options.name.trim()) || (existingShow && existingShow.name) || parsed.title || 'My Show';
    const spaceless = isSpacelessLang(lang);
    const joiner = spaceless ? '' : ' ';

    const batch = new Map();
    const record = (key, displayText, n, lineIdx, isProper) => {
      if (!key) return;
      let entry = batch.get(key);
      if (!entry) {
        entry = {
          key,
          text: displayText,
          n,
          count: 0,
          properHits: 0,
          totalHits: 0,
          lineIdxs: new Set(),
          gloss: ''
        };
        batch.set(key, entry);
      }
      entry.totalHits++;
      if (isProper) entry.properHits++;
      if (!entry.lineIdxs.has(lineIdx)) {
        entry.lineIdxs.add(lineIdx);
        entry.count++;
      }
    };

    parsed.pairs.forEach((pair, lineIdx) => {
      const toks = tokenizeLine(pair.src, lang);
      for (let i = 0; i < toks.length; i++) {
        const t1 = toks[i];
        // 1-grams: skip generic glue words unless spaceless script
        if (spaceless || !GENERIC_SINGLE_STOP.has(t1.norm)) {
          record(t1.norm, t1.norm, 1, lineIdx, t1.isCapMid);
        }
        // 2-grams within same clause
        if (i + 1 < toks.length && toks[i + 1].clauseIdx === t1.clauseIdx) {
          const t2 = toks[i + 1];
          const k2 = t1.norm + joiner + t2.norm;
          const bothStop = !spaceless && GENERIC_SINGLE_STOP.has(t1.norm) && GENERIC_SINGLE_STOP.has(t2.norm);
          if (!bothStop) {
            record(k2, t1.norm + joiner + t2.norm, 2, lineIdx, t1.isCapMid && t2.isCapMid);
          }
        }
        // 3-grams within same clause
        if (i + 2 < toks.length && toks[i + 2].clauseIdx === t1.clauseIdx) {
          const t2 = toks[i + 1];
          const t3 = toks[i + 2];
          const k3 = t1.norm + joiner + t2.norm + joiner + t3.norm;
          const allStop = !spaceless && GENERIC_SINGLE_STOP.has(t1.norm) && GENERIC_SINGLE_STOP.has(t2.norm) && GENERIC_SINGLE_STOP.has(t3.norm);
          if (!allStop) {
            record(k3, k3, 3, lineIdx, t1.isCapMid && t3.isCapMid);
          }
        }
      }
    });

    // Keep 3-grams only if repeated >= 2 times in this episode (prevents bloating storage with rare 3-grams)
    for (const [k, v] of batch.entries()) {
      if (v.n === 3 && v.count < 2) batch.delete(k);
    }

    inferGlossesForBatch(batch, parsed.pairs);

    const baseShow = existingShow
      ? {
          ...existingShow,
          name,
          lang,
          episodes: [...(existingShow.episodes || [])],
          terms: { ...(existingShow.terms || {}) }
        }
      : {
          id: makeShowId(name, lang),
          name,
          lang,
          episodeCount: 0,
          episodes: [],
          terms: {},
          updatedAt: Date.now()
        };

    baseShow.episodes.push({
      title: parsed.title,
      importedAt: Date.now(),
      lineCount: parsed.pairs.length
    });
    if (baseShow.episodes.length > 60) baseShow.episodes = baseShow.episodes.slice(-60);
    baseShow.episodeCount = (existingShow ? existingShow.episodeCount || 0 : 0) + 1;
    baseShow.updatedAt = Date.now();

    let newTerms = 0;
    let updatedTerms = 0;

    for (const [k, b] of batch.entries()) {
      const examples = [...b.lineIdxs]
        .map(idx => parsed.pairs[idx])
        .sort((a, c) => Math.abs(a.src.length - 56) - Math.abs(c.src.length - 56))
        .slice(0, 3)
        .map(p => ({ src: p.src.slice(0, 220), tgt: p.tgt.slice(0, 220) }));

      const batchProper = b.totalHits > 0 ? b.properHits / b.totalHits : 0;
      const prev = baseShow.terms[k];
      if (!prev) {
        newTerms++;
        baseShow.terms[k] = {
          text: b.text,
          n: b.n,
          count: b.count,
          gloss: b.gloss,
          customGloss: '',
          properScore: Number(batchProper.toFixed(2)),
          examples
        };
      } else {
        updatedTerms++;
        const mergedCount = prev.count + b.count;
        const blendedProper = ((prev.properScore || 0) * prev.count + batchProper * b.count) / mergedCount;
        // Prefer shorter, cleaner inferred gloss when count increases
        const betterGloss = (!prev.gloss || (b.gloss && b.gloss.length < prev.gloss.length && b.count >= 2))
          ? b.gloss
          : prev.gloss;
        const mergedEx = [...(prev.examples || [])];
        for (const ex of examples) {
          if (mergedEx.length >= 3) break;
          if (!mergedEx.some(m => m.src === ex.src)) mergedEx.push(ex);
        }
        baseShow.terms[k] = {
          ...prev,
          count: mergedCount,
          gloss: betterGloss,
          properScore: Number(blendedProper.toFixed(2)),
          examples: mergedEx
        };
      }
    }

    // Prune stored terms to top 450 (always keeping all count >= 2 first, then top singletons for cross-episode promotion)
    const entries = Object.entries(baseShow.terms);
    if (entries.length > 450) {
      entries.sort((a, b) => {
        const ta = a[1], tb = b[1];
        if (tb.count !== ta.count) return tb.count - ta.count;
        return ta.n - tb.n;
      });
      baseShow.terms = Object.fromEntries(entries.slice(0, 450));
    }

    const ready = getShowReadyTerms(baseShow, new Set(), options.minCount || 2);
    return {
      show: baseShow,
      stats: {
        title: parsed.title,
        pairsCount: parsed.pairs.length,
        collapsedLoops: parsed.collapsedLoops,
        newTerms,
        updatedTerms,
        readyCards: ready.length,
        readyWords: ready.filter(t => t.n === 1).length,
        readyChunks: ready.filter(t => t.n >= 2).length
      }
    };
  }

  function getShowReadyTerms(show, ignoredSet = new Set(), minCount = 2) {
    if (!show || !show.terms) return [];
    const list = [];
    for (const [key, term] of Object.entries(show.terms)) {
      if (!term || !term.text) continue;
      if (ignoredSet.has(key) || ignoredSet.has(`${show.id}::${key}`)) continue;
      if (term.count < minCount) continue;
      if ((term.properScore || 0) >= 0.7 && !term.customGloss) continue;
      const gloss = (term.customGloss || term.gloss || '').trim();
      if (!gloss) continue;
      list.push({
        key,
        cardKey: `${show.id}::${key}`,
        showId: show.id,
        showName: show.name,
        lang: show.lang,
        text: term.text,
        n: term.n,
        count: term.count,
        gloss,
        examples: term.examples || []
      });
    }
    list.sort((a, b) => (a.n - b.n) || (b.count - a.count) || a.text.localeCompare(b.text));
    return list;
  }

  function getLangMeta(code) {
    const found = SUPPORTED_LANGUAGES.find(l => l.code === code) ||
                  SUPPORTED_LANGUAGES.find(l => l.code.split('-')[0] === String(code || '').split('-')[0]);
    return found || { code: code || 'es-MX', label: code || 'Language', flag: '🌐' };
  }

  return {
    SUPPORTED_LANGUAGES,
    escapeHtml,
    parseTrancyMarkdown,
    detectLanguage,
    tokenizeLine,
    ingestTrancyIntoShow,
    getShowReadyTerms,
    getLangMeta
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrancyParser;
}