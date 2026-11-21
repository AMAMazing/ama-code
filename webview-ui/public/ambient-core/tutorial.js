// ---------- Tutorial Dataset (Pure Onboarding — Revision Removed) ----------
const CORE = [
  ['i', 'ม'], ['i', 'า'], ['w', 'มา', 'maa', 'to come'], ['i', 'น'], ['w', 'นา', 'naa', 'rice field'],
  ['w', 'มานา', 'maanaa', 'Thai has no spaces: maa·naa runs together.'], ['i', 'ก'], ['w', 'กา', 'gaa', 'crow'], ['i', 'ี'],
  ['w', 'มี', 'mee', 'to have'], ['w', 'มีนา', 'meenaa', 'March (or: has a rice field)']
];

const ORDER = ['ด', 'บ', 'ต', 'ป', 'ส', 'ร', 'เ', 'โ', 'ุ', 'ู'];

const WORDS = [
  ['ดี', 'dee', 'good'], ['มานี', 'maanee', 'Manee (a name)'], ['บาน', 'baan', 'to bloom'],
  ['ตา', 'taa', 'eye'], ['ตี', 'tee', 'to hit'], ['ปา', 'paa', 'to throw'], ['ปี', 'pee', 'year'],
  ['สี', 'see', 'color'], ['สาม', 'saam', 'three'], ['รา', 'raa', 'mold'], ['รี', 'ree', 'oval'],
  ['เกม', 'gaym', 'game'], ['โต', 'toh', 'big'], ['โสม', 'sohm', 'ginseng'], ['ดุ', 'du', 'fierce'],
  ['ดู', 'duu', 'to watch'], ['ปู', 'puu', 'crab']
];

function buildTutorialDeck() {
  const known = new Set(CORE.filter(s => s[0] === 'i').map(s => s[1]));
  const used = new Set(CORE.filter(s => s[0] === 'w').map(s => s[1]));
  const deck = [...CORE];

  function addWords() {
    for (const w of WORDS) {
      if (used.has(w[0])) continue;
      if ([...w[0]].every(c => known.has(c))) {
        used.add(w[0]);
        deck.push(['w', ...w]);
      }
    }
  }

  addWords();

  ORDER.forEach(c => {
    deck.push(['i', c]);
    known.add(c);
    addWords();
  });

  return deck;
}

const TUT_DECK = buildTutorialDeck();
const TUT_ALL = [...CORE.filter(s => s[0] === 'w').map(s => s.slice(1)), ...WORDS];
