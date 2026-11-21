// ---------- Complete Thai Phonetic Alphabet, True-Spoken Lexicon & Syllable Parser ----------
const U = {
  // Original Tutorial Core (Intuitive English phonetics: no confusing 'ph'=F or 'th'=think)
  'ม': ['m', 'M sound. Loop in front.'],
  'า': ['aa', 'Long “ah”. A tall pole after the letter.'],
  'น': ['n', 'N sound. A curl up top, like a snail.'],
  'ก': ['g', 'Hard G/K sound (as in go). A bent hook with no loop.'],
  'ี': ['ee', 'Long “ee” (as in see). A hat on top of the letter.'],
  'ด': ['d', 'D sound. A tiny flag tucked inside.'],
  'บ': ['b', 'B sound. A round bucket with a flat lid.'],
  'ต': ['t', 'Crisp T. Like ด with a notched roof.'],
  'ป': ['p', 'Crisp P. Like บ with a tall rising stem.'],
  'ส': ['s', 'S sound. A curling cat with a tail up top.'],
  'ร': ['r', 'Rolled R (or -N at end). A curving wave.'],
  'เ': ['ay', '“ay” as in bay. Written before, spoken after.'],
  'โ': ['oh', '“oh” as in go. Tall hook written before, spoken after.'],
  'ุ': ['u', 'Short “oo” (as in book). One tiny peg below.'],
  'ู': ['uu', 'Long “oo” (as in moon). A little shoe below.'],

  // Extended Consonants & Vowels for 2000+ Emoji Mode
  'ง': ['ng', 'NG sound (as in sing). A simple leaning hook.'],
  'ย': ['y', 'Y sound. Two little waves on the left wall.'],
  'ว': ['w', 'W sound (or “ua/w” glide). A single upright curl.'],
  'ล': ['l', 'L sound (or -N at end). Like ส without the top tail.'],
  'อ': ['aw', 'Silent vowel carrier at start, or “aw” vowel (as in saw).'],
  'ห': ['h', 'H sound (or silent tone helper before ม/น/ง/ย/ร/ล/ว).'],
  'ช': ['ch', 'CH sound. Like บ with a tail flaring top-right.'],
  'พ': ['p', 'P sound (breathier P). Loops inside like a W.'],
  'ฟ': ['f', 'F sound. Like พ with a tall rising tail.'],
  'ค': ['k', 'K sound. Loop points inward under an arch.'],
  'ข': ['k', 'K sound. A narrow cup with a curl.'],
  'จ': ['j', 'J sound. Loop in the middle slope.'],
  'ซ': ['s', 'S sound. Like ช with a notched head.'],
  'ท': ['t', 'T sound (breathier T). Two arches like an M.'],
  'ธ': ['t', 'T sound. Flag-like top, no front loop.'],
  'ถ': ['t', 'T sound. Like ก with a loop inside.'],
  'ผ': ['p', 'P sound. Loop faces inside.'],
  'ฝ': ['f', 'F sound. Like ผ with a tall tail.'],
  'ศ': ['s', 'S sound. Like ค with a tail on top.'],
  'ษ': ['s', 'S sound. Like บ with a crossbar inside.'],
  'ฮ': ['h', 'H sound. Curly top tail.'],
  'ฉ': ['ch', 'CH sound. Loop at the bottom right.'],
  'ญ': ['y', 'Y sound (or -N at end). Wide arch with a small shoe.'],
  'ณ': ['n', 'N sound. Double arch with a tail loop.'],

  // Remaining 11 Thai Consonants & Symbols for 100% Coverage
  'ภ': ['p', 'P sound (or -P at end). Like ก with an outward loop.'],
  'ฆ': ['k', 'K sound. Notched head with M-like arches.'],
  'ฬ': ['l', 'L sound (or -N at end). Like พ with a curl up top.'],
  'ฌ': ['ch', 'CH sound. Like ณ with an inward head.'],
  'ฎ': ['d', 'D sound. Like ด with a curly tail below.'],
  'ฏ': ['t', 'Crisp T. Like ต with a notched tail below.'],
  'ฐ': ['t', 'T sound. Stacked base under a curled top.'],
  'ฑ': ['t', 'T/D sound. Notched head with two arches.'],
  'ฒ': ['t', 'T sound. Notched head with a coiled tail.'],
  'ฤ': ['ri', 'Vocalic “ri / rue” sound. Like ถ with a long tail.'],
  'ฯ': ['', 'Abbreviation symbol (Paiyan Noi).'],

  // Vowels & Tone Marks
  'ะ': ['a', 'Short “ah” sound. Two little droplets.'],
  'ั': ['a', 'Short “ah” vowel floating above.'],
  'ิ': ['i', 'Short “i” (as in bit) hat above the consonant.'],
  'ึ': ['ue', 'Short “ue” hat with a tiny circle.'],
  'ื': ['ue', 'Long “ue” hat with two vertical ticks.'],
  'แ': ['ae', 'Flat “a” (as in cat). Double เ before letter.'],
  'ไ': ['ai', '“ai” (as in Thai / eye). Tall zigzag before letter.'],
  'ใ': ['ai', '“ai” (as in Thai / eye). Swirled top before letter.'],
  'ำ': ['am', '“am” sound (as in yum). Small circle above + า.'],
  '็': ['o', 'Shortener mark (Mai Tai Khu) floating above.'],
  '่': ['', 'Low/falling tone mark (Mai Ek).'],
  '้': ['', 'Falling/high tone mark (Mai Tho).'],
  '๊': ['', 'High tone mark (Mai Tri).'],
  '๋': ['', 'Rising tone mark (Mai Chattawa).'],
  '์': ['', 'Silent marker (Karant)—mutes the letter underneath.']
};

const CONSONANTS = new Set([
  'ก','ข','ค','ฆ','ง','จ','ฉ','ช','ซ','ฌ','ญ','ฎ','ฏ','ฐ','ฑ','ฒ','ณ',
  'ด','ต','ถ','ท','ธ','น','บ','ป','ผ','ฝ','พ','ฟ','ภ','ม','ย','ร','ล',
  'ว','ศ','ษ','ส','ห','ฬ','อ','ฮ'
]);
const PRE_VOWELS = new Set(['เ','แ','โ','ไ','ใ']);
const TONES = new Set(['่','้','๊','๋']);
const HO_NAM_FOLLOWERS = new Set(['ง','ญ','น','ม','ย','ร','ล','ว']);

const FINAL_SOUND = {
  'ก':'k', 'ข':'k', 'ค':'k', 'ฆ':'k',
  'ง':'ng',
  'จ':'t', 'ช':'t', 'ซ':'t', 'ฌ':'t', 'ฎ':'t', 'ฏ':'t', 'ฐ':'t', 'ฑ':'t', 'ฒ':'t',
  'ด':'t', 'ต':'t', 'ถ':'t', 'ท':'t', 'ธ':'t', 'ศ':'t', 'ษ':'t', 'ส':'t',
  'ญ':'n', 'ณ':'n', 'น':'n', 'ร':'n', 'ล':'n', 'ฬ':'n',
  'บ':'p', 'ป':'p', 'พ':'p', 'ฟ':'p', 'ภ':'p',
  'ม':'m',
  'ย':'i',
  'ว':'w'
};

// Curated True-Spoken Lexicon for multi-syllable words, loanwords, and irregular Thai words.
// Format: 'Thai': 's1:rom1|s2:rom2' (or 'rom' for 1-syllable words).
// Ensures 100% natural English-ear pronunciation that matches the Thai TTS voice.
const SPOKEN_OVERRIDES = {
  // Tutorial Words
  'เกม': 'gaym',
  'โต': 'toh',
  'โสม': 'sohm',

  // Animals & Nature
  'แมว': 'maew',
  'ปลา': 'plaa',
  'เป็ด': 'pet',
  'ช้าง': 'chaang',
  'เต่า': 'tao',
  'ผึ้ง': 'pueng',
  'เสือ': 'suea',
  'สิงโต': 'สิง:sing|โต:toh',
  'กระต่าย': 'กระ:gra|ต่าย:taai',
  'วาฬ': 'waan',
  'โลมา': 'โล:loh|มา:maa',
  'หมึก': 'muek',
  'กุ้ง': 'gung',
  'หอย': 'hoi',
  'ทาก': 'taak',
  'ผีเสื้อ': 'ผี:pee|เสื้อ:suea',
  'หนอน': 'nawn',
  'แมงมุม': 'แมง:maeng|มุม:mum',
  'แมงป่อง': 'แมง:maeng|ป่อง:pawng',
  'ค้างคาว': 'ค้าง:kaang|คาว:kaaw',
  'นกฮูก': 'นก:nok|ฮูก:huuk',
  'อินทรี': 'อิน:in|ทรี:see',
  'หงส์': 'hong',
  'นกยูง': 'นก:nok|ยูง:yuung',
  'นกแก้ว': 'นก:nok|แก้ว:gaew',
  'จระเข้': 'จระ:ja-ra|เข้:kay',
  'กิ้งก่า': 'กิ้ง:ging|ก่า:gaa',
  'ไดโนเสาร์': 'ได:dai|โน:noh|เสาร์:sao',
  'ยีราฟ': 'ยี:yee|ราฟ:raap',
  'ม้าลาย': 'ม้า:maa|ลาย:laai',
  'กวาง': 'gwaang',
  'อูฐ': 'uut',
  'จิงโจ้': 'จิง:jing|โจ้:joh',
  'สลอธ': 'ส:sa|ลอธ:lawt',
  'นาก': 'naak',

  // Body & People
  'จมูก': 'จ:ja|มูก:muuk',
  'ปาก': 'paak',
  'กระดูก': 'กระ:gra|ดูก:duuk',
  'สมอง': 'ส:sa|มอง:mawng',
  'หัวใจ': 'หัว:hua|ใจ:jai',
  'ปอด': 'pawt',
  'เลือด': 'lueat',
  'ขา': 'kaa',
  'เท้า': 'tao',
  'แขน': 'kaen',
  'มือ': 'mue',
  'เด็ก': 'dek',
  'ชาย': 'chaai',
  'หญิง': 'ying',
  'ผู้ชาย': 'ผู้:puu|ชาย:chaai',
  'ผู้หญิง': 'ผู้:puu|หญิง:ying',
  'คนแก่': 'คน:kon|แก่:gae',
  'ทารก': 'ทา:taa|รก:rok',
  'ผู้ใหญ่': 'ผู้:puu|ใหญ่:yai',
  'ผมทอง': 'ผม:pom|ทอง:tawng',
  'เครา': 'krao',
  'สาว': 'saaw',
  'ยาย': 'yaai',

  // Clothing & Accessories
  'มงกุฎ': 'มง:mong|กุฎ:gut',
  'หมวก': 'muak',
  'แว่น': 'waen',
  'เนกไท': 'เนก:nek|ไท:tai',
  'เสื้อ': 'suea',
  'กางเกง': 'กาง:gaang|เกง:gayng',
  'ชุด': 'chut',
  'ถุงเท้า': 'ถุง:tung|เท้า:tao',
  'รองเท้า': 'รอง:rawng|เท้า:tao',
  'แหวน': 'waen',
  'เพชร': 'pet',
  'กระเป๋า': 'กระ:gra|เป๋า:pao',
  'ร่ม': 'rom',
  'ลิป': 'lip',
  'นาฬิกา': 'นา:naa|ฬิ:li|กา:gaa',

  // Fruits & Vegetables
  'แอปเปิล': 'แอป:aep|เปิล:poen',
  'กล้วย': 'gluay',
  'องุ่น': 'อ:a|งุ่น:ngun',
  'แตงโม': 'แตง:taeng|โม:moh',
  'ส้ม': 'som',
  'มะนาว': 'มะ:ma|นาว:naaw',
  'สับปะรด': 'สับ:sap|ปะ:pa|รด:rot',
  'มะม่วง': 'มะ:ma|ม่วง:muang',
  'พีช': 'peet',
  'เชอร์รี': 'เชอร์:choe|รี:ree',
  'สตรอว์เบอร์รี': 'สตรอว์:straw|เบอร์:boe|รี:ree',
  'กีวี': 'กี:gee|วี:wee',
  'มะเขือเทศ': 'มะ:ma|เขือ:kuea|เทศ:tayt',
  'มะพร้าว': 'มะ:ma|พร้าว:praaw',
  'อะโวคาโด': 'อะ:a|โว:woh|คา:kaa|โด:doh',
  'มะเขือ': 'มะ:ma|เขือ:kuea',
  'มันฝรั่ง': 'มัน:man|ฝ:fa|รั่ง:rang',
  'แครอท': 'แค:kae|รอท:rawt',
  'ข้าวโพด': 'ข้าว:kaaw|โพด:poht',
  'พริก': 'prik',
  'แตงกวา': 'แตง:taeng|กวา:gwaa',
  'ผัก': 'pak',
  'บรอกโคลี': 'บรอก:brawk|โค:koh|ลี:lee',
  'กระเทียม': 'กระ:gra|เทียม:tiam',
  'หัวหอม': 'หัว:hua|หอม:hawm',
  'เห็ด': 'het',
  'ถั่ว': 'tua',

  // Food & Drink
  'ขนมปัง': 'ข:ka|นม:nom|ปัง:pang',
  'ครัวซองต์': 'ครัว:krua|ซองต์:sawng',
  'ชีส': 'cheet',
  'เนื้อ': 'nuea',
  'น่องไก่': 'น่อง:nawng|ไก่:gai',
  'เบคอน': 'เบ:bay|คอน:kawn',
  'เบอร์เกอร์': 'เบอร์:boe|เกอร์:goe',
  'เฟรนช์ฟรายส์': 'เฟรนช์:fren|ฟรายส์:fraai',
  'พิซซ่า': 'พิซ:pit|ซ่า:saa',
  'ฮอทดอก': 'ฮอท:hawt|ดอก:dawk',
  'แซนด์วิช': 'แซนด์:saen|วิช:wit',
  'ทาโก้': 'ทา:taa|โก้:goh',
  'ไข่': 'kai',
  'ไข่ดาว': 'ไข่:kai|ดาว:daaw',
  'หม้อไฟ': 'หม้อ:maw|ไฟ:fai',
  'ชาม': 'chaam',
  'สลัด': 'ส:sa|ลัด:lat',
  'ป๊อปคอร์น': 'ป๊อป:pawp|คอร์น:kawn',
  'เนย': 'noei',
  'เกลือ': 'gluea',
  'เบนโตะ': 'เบน:ben|โตะ:to',
  'ข้าวปั้น': 'ข้าว:kaaw|ปั้น:pan',
  'ข้าว': 'kaaw',
  'บะหมี่': 'บะ:ba|หมี่:mee',
  'ซูชิ': 'ซู:suu|ชิ:chi',
  'กุ้งทอด': 'กุ้ง:gung|ทอด:tawt',
  'ไอศกรีม': 'ไอ:ai|ศ:sa|กรีม:greem',
  'โดนัท': 'โด:doh|นัท:nat',
  'คุกกี้': 'คุก:kuk|กี้:gee',
  'เค้ก': 'kayk',
  'เค้กชิ้น': 'เค้ก:kayk|ชิ้น:chin',
  'ช็อกโกแลต': 'ช็อก:chawk|โก:goh|แลต:laet',
  'ลูกอม': 'ลูก:luuk|อม:om',
  'อมยิ้ม': 'อม:om|ยิ้ม:yim',
  'น้ำผึ้ง': 'น้ำ:naam|ผึ้ง:pueng',
  'กาแฟ': 'กา:gaa|แฟ:fae',
  'น้ำผลไม้': 'น้ำ:naam|ผล:pon|ไม้:maai',
  'เบียร์': 'bia',
  'ไวน์': 'waai',
  'น้ำแข็ง': 'น้ำ:naam|แข็ง:kaeng',
  'ช้อน': 'chawn',
  'ส้อม': 'sawm',
  'มีด': 'meet',

  // Places & Transport
  'บ้าน': 'baan',
  'โรงเรียน': 'โรง:rohng|เรียน:rian',
  'โรงพยาบาล': 'โรง:rohng|พ:pa|ยา:yaa|บาล:baan',
  'ธนาคาร': 'ธ:ta|นา:naa|คาร:kaan',
  'โรงแรม': 'โรง:rohng|แรม:raem',
  'ร้านค้า': 'ร้าน:raan|ค้า:kaa',
  'ปราสาท': 'ปรา:praa|สาท:saat',
  'เต็นท์': 'ten',
  'สะพาน': 'สะ:sa|พาน:paan',
  'รถ': 'rot',
  'แท็กซี่': 'แท็ก:taek|ซี่:see',
  'รถบัส': 'รถ:rot|บัส:bat',
  'รถตำรวจ': 'รถ:rot|ตำ:tam|รวจ:ruat',
  'รถพยาบาล': 'รถ:rot|พ:pa|ยา:yaa|บาล:baan',
  'รถดับเพลิง': 'รถ:rot|ดับ:dap|เพลิง:ploeng',
  'จักรยาน': 'จักร:jak|ยาน:yaan',
  'สกู๊ตเตอร์': 'สกู๊ต:skoot|เตอร์:toe',
  'รถไฟ': 'รถ:rot|ไฟ:fai',
  'เครื่องบิน': 'เครื่อง:krueang|บิน:bin',
  'จรวด': 'จ:ja|รวด:ruat',
  'จานบิน': 'จาน:jaan|บิน:bin',
  'เฮลิคอปเตอร์': 'เฮ:hay|ลิ:li|คอป:kawp|เตอร์:toe',
  'เรือใบ': 'เรือ:ruea|ใบ:bai',
  'เรือ': 'ruea',
  'สมอ': 'ส:sa|มอ:maw',
  'น้ำมัน': 'น้ำ:naam|มัน:man',
  'ไฟจราจร': 'ไฟ:fai|จ:ja|รา:raa|จร:jawn',
  'แผนที่': 'แผน:paen|ที่:tee',
  'โมอาย': 'โม:moh|อาย:aai',

  // Weather, Nature & Plants
  'แดด': 'daet',
  'จันทร์': 'jan',
  'ดาว': 'daaw',
  'เมฆ': 'mayk',
  'ฝน': 'fon',
  'ฟ้าผ่า': 'ฟ้า:faa|ผ่า:paa',
  'หิมะ': 'หิ:hi|มะ:ma',
  'น้ำ': 'naam',
  'คลื่น': 'kluen',
  'รุ้ง': 'rung',
  'ภูเขาไฟ': 'ภู:puu|เขา:kao|ไฟ:fai',
  'ภูเขา': 'ภู:puu|เขา:kao',
  'เกาะ': 'gaw',
  'ทะเลทราย': 'ทะ:ta|เล:lay|ทราย:saai',
  'ต้นสน': 'ต้น:ton|สน:son',
  'ต้นไม้': 'ต้น:ton|ไม้:maai',
  'ต้นปาล์ม': 'ต้น:ton|ปาล์ม:paam',
  'กระบองเพชร': 'กระ:gra|บอง:bawng|เพชร:pet',
  'นาข้าว': 'นา:naa|ข้าว:kaaw',
  'ใบไม้': 'ใบ:bai|ไม้:maai',
  'ใบโคลเวอร์': 'ใบ:bai|โคล:kloh|เวอร์:woe',
  'กุหลาบ': 'กุ:gu|หลาบ:laap',
  'ทานตะวัน': 'ทาน:taan|ตะ:ta|วัน:wan',
  'ทิวลิป': 'ทิว:tiw|ลิป:lip',
  'ซากุระ': 'ซา:saa|กุ:gu|ระ:ra',
  'ชบา': 'ช:cha|บา:baa',

  // Sports, Games & Music
  'บอล': 'bawn',
  'บาส': 'baat',
  'รักบี้': 'รัก:rak|บี้:bee',
  'เบสบอล': 'เบส:bayt|บอล:bawn',
  'เทนนิส': 'เทน:ten|นิส:nit',
  'วอลเลย์บอล': 'วอล:wawn|เลย์:lay|บอล:bawn',
  'พูล': 'puun',
  'ปิงปอง': 'ปิง:ping|ปอง:pawng',
  'แบด': 'baet',
  'นวม': 'nuam',
  'กอล์ฟ': 'gawp',
  'ตกปลา': 'ตก:tok|ปลา:plaa',
  'สกี': 'ส:sa|กี:gee',
  'เป้า': 'pao',
  'ว่าว': 'waaw',
  'ลูกเต๋า': 'ลูก:luuk|เต๋า:tao',
  'จิ๊กซอว์': 'จิ๊ก:jik|ซอว์:saw',
  'ตุ๊กตาหมี': 'ตุ๊ก:tuk|ตา:taa|หมี:mee',
  'หน้ากาก': 'หน้า:naa|กาก:gaak',
  'ศิลปะ': 'ศิล:sin|ปะ:pa',
  'ด้าย': 'daai',
  'ไหมพรม': 'ไหม:mai|พรม:prom',
  'โน้ต': 'noht',
  'ไมค์': 'mai',
  'หูฟัง': 'หู:huu|ฟัง:fang',
  'แซกโซโฟน': 'แซก:saek|โซ:soh|โฟน:fohn',
  'กีตาร์': 'กี:gee|ตาร์:taa',
  'เปียโน': 'เปีย:pia|โน:noh',
  'ทรัมเป็ต': 'ทรัม:tram|เป็ต:pet',
  'ไวโอลิน': 'ไว:wai|โอ:oh|ลิน:lin',
  'กลอง': 'glawng',

  // Tech, Tools & Objects
  'มือถือ': 'มือ:mue|ถือ:tue',
  'คอม': 'kawm',
  'คีย์บอร์ด': 'คีย์:kee|บอร์ด:bawt',
  'จอ': 'jaw',
  'เครื่องพิมพ์': 'เครื่อง:krueang|พิมพ์:pim',
  'เมาส์': 'mao',
  'กล้อง': 'glawng',
  'วิดีโอ': 'วิ:wi|ดี:dee|โอ:oh',
  'ทีวี': 'ที:tee|วี:wee',
  'วิทยุ': 'วิท:wit|ยุ:yu',
  'เข็มทิศ': 'เข็ม:kem|ทิศ:tit',
  'นาฬิกาปลุก': 'นา:naa|ฬิ:li|กา:gaa|ปลุก:pluk',
  'นาฬิกาทราย': 'นา:naa|ฬิ:li|กา:gaa|ทราย:saai',
  'ถ่าน': 'taan',
  'ปลั๊ก': 'plak',
  'หลอดไฟ': 'หลอด:lawt|ไฟ:fai',
  'ไฟฉาย': 'ไฟ:fai|ฉาย:chaai',
  'เทียน': 'tian',
  'ถุงเงิน': 'ถุง:tung|เงิน:ngoen',
  'เงิน': 'ngoen',
  'บัตร': 'bat',
  'ตาชั่ง': 'ตา:taa|ชั่ง:chang',
  'ประแจ': 'ประ:pra|แจ:jae',
  'ค้อน': 'kawn',
  'อีเตอร์': 'อี:ee|เตอร์:toe',
  'เลื่อย': 'lueai',
  'น็อต': 'nawt',
  'เฟือง': 'fueang',
  'โซ่': 'soh',
  'แม่เหล็ก': 'แม่:mae|เหล็ก:lek',
  'ปืนฉีดน้ำ': 'ปืน:puen|ฉีด:cheet|น้ำ:naam',
  'ระเบิด': 'ระ:ra|เบิด:boet',
  'ประทัด': 'ประ:pra|ทัด:tat',
  'ขวาน': 'kwaan',
  'โล่': 'loh',
  'ดาบ': 'daap',
  'ลูกแก้ว': 'ลูก:luuk|แก้ว:gaew',
  'หลอดทดลอง': 'หลอด:lawt|ทด:tot|ลอง:lawng',
  'กล้องดูดาว': 'กล้อง:glawng|ดู:duu|ดาว:daaw',
  'กล้องจุลทรรศน์': 'กล้อง:glawng|จุล:jun|ทรรศน์:tat',
  'ยา': 'yaa',
  'พลาสเตอร์': 'พลาส:plaat|เตอร์:toe',
  'หูฟังแพทย์': 'หู:huu|ฟัง:fang|แพทย์:paet',
  'ประตู': 'ประ:pra|ตู:tuu',
  'กระจก': 'กระ:gra|จก:jok',
  'หน้าต่าง': 'หน้า:naa|ต่าง:taang',
  'เตียง': 'tiang',
  'โซฟา': 'โซ:soh|ฟา:faa',
  'เก้าอี้': 'เก้า:gao|อี้:ee',
  'ส้วม': 'suam',
  'ฝักบัว': 'ฝัก:fak|บัว:bua',
  'อ่างน้ำ': 'อ่าง:aang|น้ำ:naam',
  'ไม้กวาด': 'ไม้:maai|กวาด:gwaat',
  'ตะกร้า': 'ตะ:ta|กร้า:graa',
  'ทิชชู่': 'ทิช:tit|ชู่:chuu',
  'ถังน้ำ': 'ถัง:tang|น้ำ:naam',
  'สบู่': 'ส:sa|บู่:buu',
  'แปรงสีฟัน': 'แปรง:praeng|สี:see|ฟัน:fan',
  'ฟองน้ำ': 'ฟอง:fawng|น้ำ:naam',
  'กุญแจ': 'กุญ:gun|แจ:jae',
  'กล่อง': 'glawng',
  'จดหมาย': 'จด:jot|หมาย:maai',
  'ตู้จดหมาย': 'ตู้:tuu|จด:jot|หมาย:maai',
  'ดินสอ': 'ดิน:din|สอ:saw',
  'ปากกา': 'ปาก:paak|กา:gaa',
  'พู่กัน': 'พู่:puu|กัน:gan',
  'สีเทียน': 'สี:see|เทียน:tian',
  'สมุดโน้ต': 'ส:sa|มุด:mut|โน้ต:noht',
  'แฟ้ม': 'faem',
  'ปฏิทิน': 'ป:pa|ฏิ:ti|ทิน:tin',
  'หมุด': 'mut',
  'คลิป': 'klip',
  'ไม้บรรทัด': 'ไม้:maai|บรร:ban|ทัด:tat',
  'กรรไกร': 'กรร:gan|ไกร:grai',
  'แม่กุญแจ': 'แม่:mae|กุญ:gun|แจ:jae',
  'กระดิ่ง': 'กระ:gra|ดิ่ง:ding',
  'โทรโข่ง': 'โทร:toh|โข่ง:kohng',

  // Hearts, Expressions & Gestures
  'ใจส้ม': 'ใจ:jai|ส้ม:som',
  'ใจเหลือง': 'ใจ:jai|เหลือง:lueang',
  'ใจเขียว': 'ใจ:jai|เขียว:kiaw',
  'ใจฟ้า': 'ใจ:jai|ฟ้า:faa',
  'ใจม่วง': 'ใจ:jai|ม่วง:muang',
  'ใจดำ': 'ใจ:jai|ดำ:dam',
  'ใจขาว': 'ใจ:jai|ขาว:kaaw',
  'ใจน้ำตาล': 'ใจ:jai|น้ำ:naam|ตาล:taan',
  'อกหัก': 'อก:ok|หัก:hak',
  'ร้อย': 'roi',
  'โกรธ': 'groht',
  'ตูม': 'tuum',
  'เวียนหัว': 'เวียน:wian|หัว:hua',
  'เหงื่อ': 'nguea',
  'ลม': 'lom',
  'หลับ': 'lap',
  'โบกมือ': 'โบก:bohk|มือ:mue',
  'โอเค': 'โอ:oh|เค:kay',
  'สู้': 'suu',
  'ดีมาก': 'ดี:dee|มาก:maak',
  'แย่': 'yae',
  'หมัด': 'mat',
  'ปรบมือ': 'ปรบ:prop|มือ:mue',
  'ไหว้': 'waai',
  'ยิ้ม': 'yim',
  'ขำ': 'kam',
  'หลงรัก': 'หลง:long|รัก:rak',
  'เท่': 'tay',
  'ร้องไห้': 'ร้อง:rawng|ไห้:hai',
  'โมโห': 'โม:moh|โห:hoh',
  'ตกใจ': 'ตก:tok|ใจ:jai',
  'ง่วง': 'nguang',
  'ป่วย': 'puay',
  'ผี': 'pee',
  'เอเลี่ยน': 'เอ:ay|เลี่ยน:lian',
  'หุ่นยนต์': 'หุ่น:hun|ยนต์:yon',
  'อึ': 'ue',

  // People Base & Compound Roots
  'ฝ่ามือ': 'ฝ่า:faa|มือ:mue',
  'นิ้ว': 'niw',
  'หยุด': 'yut',
  'วัลแคน': 'วัล:wan|แคน:kaen',
  'สอง': 'sawng',
  'เลิฟ': 'loef',
  'ร็อก': 'rawk',
  'โทร': 'toh',
  'ซ้าย': 'saai',
  'ขวา': 'kwaa',
  'หนึ่ง': 'nueng',
  'กำปั้น': 'กำ:gam|ปั้น:pan',
  'ต่อย': 'toi',
  'หมัดซ้าย': 'หมัด:mat|ซ้าย:saai',
  'หมัดขวา': 'หมัด:mat|ขวา:kwaa',
  'ตบมือ': 'ตบ:top|มือ:mue',
  'ชูมือ': 'ชู:chuu|มือ:mue',
  'แบมือ': 'แบ:bae|มือ:mue',
  'ขอ': 'kaw',
  'เขียน': 'kian',
  'เล็บ': 'lep',
  'เซลฟี่': 'เซล:sayl|ฟี่:fee',
  'กล้าม': 'glaam',
  'งอน': 'ngawn',
  'ตกลง': 'ตก:tok|ลง:long',
  'ช่วย': 'chuay',
  'ยกมือ': 'ยก:yok|มือ:mue',
  'โค้ง': 'kohng',
  'กลุ้ม': 'glum',
  'ตำรวจ': 'ตำ:tam|รวจ:ruat',
  'นักสืบ': 'นัก:nak|สืบ:suep',
  'ทหาร': 'ท:ta|หาร:haan',
  'นินจา': 'นิน:nin|จา:jaa',
  'เจ้าชาย': 'เจ้า:jao|ชาย:chaai',
  'เจ้าหญิง': 'เจ้า:jao|หญิง:ying',
  'โพกหัว': 'โพก:pohk|หัว:hua',
  'หมวกจีน': 'หมวก:muak|จีน:jeen',
  'ฮิญาบ': 'ฮิ:hi|ญาบ:yaap',
  'สูท': 'suut',
  'เจ้าสาว': 'เจ้า:jao|สาว:saaw',
  'ท้อง': 'tawng',
  'นางฟ้า': 'นาง:naang|ฟ้า:faa',
  'ซานต้า': 'ซาน:saan|ต้า:taa',
  'แซนตี้': 'แซน:saen|ตี้:tee',
  'ฮีโร่': 'ฮี:hee|โร่:roh',
  'วายร้าย': 'วาย:waai|ร้าย:raai',
  'พ่อมด': 'พ่อ:paw|มด:mot',
  'ภูต': 'puut',
  'แวมไพร์': 'แวม:waem|ไพร์:paai',
  'เงือก': 'ngueak',
  'เอลฟ์': 'ayl',
  'เต้น': 'ten',
  'ดิสโก้': 'ดิส:dit|โก้:goh',
  'เดิน': 'doen',
  'คุกเข่า': 'คุก:kuk|เข่า:kao',
  'ยกเวท': 'ยก:yok|เวท:wayt',
  'เลี้ยงบอล': 'เลี้ยง:liang|บอล:bawn',
  'แฮนด์บอล': 'แฮนด์:haen|บอล:bawn',
  'ตีกอล์ฟ': 'ตี:tee|กอล์ฟ:gawp',
  'ขี่ม้า': 'ขี่:kee|ม้า:maa',
  'สมาธิ': 'ส:sa|มา:maa|ธิ:ti',
  'โต้คลื่น': 'โต้:toh|คลื่น:kluen',
  'ว่ายน้ำ': 'ว่าย:waai|น้ำ:naam',
  'โปโลน้ำ': 'โป:poh|โล:loh|น้ำ:naam',
  'พายเรือ': 'พาย:paai|เรือ:ruea',
  'ปีนผา': 'ปีน:peen|ผา:paa',
  'เสือภูเขา': 'เสือ:suea|ภู:puu|เขา:kao',
  'อาบน้ำ': 'อาบ:aap|น้ำ:naam',
  'นอน': 'nawn',

  // Compound Roots & Modifiers
  'ขาว': 'kaaw',
  'ครีม': 'kreem',
  'แทน': 'taen',
  'เข้ม': 'kem',
  'ตลก': 'ตะ:ta|ลก:lok',
  'ทอง': 'tawng',
  'ไม้': 'maai',
  'แสง': 'saeng',
  'เงา': 'ngao',
  'หมอก': 'mawk',
  'สายฟ้า': 'สาย:saai|ฟ้า:faa',
  'ดอกไม้': 'ดอก:dawk|ไม้:maai',
  'ผลไม้': 'ผล:pon|ไม้:maai',
  'ขนม': 'ข:ka|นม:nom',
  'แกง': 'gaeng',
  'เมือง': 'mueang',
  'เพลง': 'playng',
  'เสียง': 'siang',
  'ภาพ': 'paap',
  'ศิลป์': 'sin',
  'ป้าย': 'paai',
  'เลข': 'layk',
  'เหลี่ยม': 'liam',
  'เล็ก': 'lek',
  'ใหม่': 'mai',
  'เก่า': 'gao',
  'แดง': 'daeng',
  'เขียว': 'kiaw',
  'ม่วง': 'muang',
  'น้อย': 'noi',
  'ยาว': 'yaaw',
  'อุ่น': 'un',
  'เย็น': 'yen',
  'หวาน': 'waan',
  'เผ็ด': 'pet',
  'เค็ม': 'kem',
  'หอม': 'hawm',
  'เบา': 'bao',
  'แท้': 'tae',
  'เอก': 'ayk',
  'โท': 'toh',
  'ตรี': 'tree',
  'จัตวา': 'จัต:jat|ตะ:ta|วา:waa',
  'เจ็ด': 'jet',
  'แปด': 'paet',
  'เก้า': 'gao'
};

// Precompute longest-prefix keys so compound words (e.g. มือขาว, ตลกดี)
// automatically inherit exact syllable splits and spoken pronunciations.
const OVERRIDE_KEYS = Object.keys(SPOKEN_OVERRIDES).sort((a, b) => b.length - a.length);

// Formats combining vowels/tones with dotted circle or dash
const disp = c => ('ีุูัิึื็่้๊๋์ำ'.includes(c) ? '◌' : '') + c + ('เแโไใ'.includes(c) ? '–' : '');

// Literal 1:1 left-to-right cipher romanizer
function romanizeLiteral(th) {
  let out = '';
  for (const ch of th) {
    if (U[ch] && U[ch][0]) out += U[ch][0];
  }
  return out || 'thai';
}

function parseOverrideSpec(th, spec) {
  const chunks = spec.split('|');
  const syllables = [];
  let rom = '';
  for (const ch of chunks) {
    const idx = ch.indexOf(':');
    const sTh = idx >= 0 ? ch.slice(0, idx) : th;
    const sRom = (idx >= 0 ? ch.slice(idx + 1) : ch).replace(/-/g, '');
    rom += sRom;
    syllables.push({
      th: sTh,
      rom: sRom,
      parts: [`spoken “${sRom}”`]
    });
  }
  return { rom, syllables, notes: [] };
}

// Rule-based fallback analyzer for any Thai substring not in SPOKEN_OVERRIDES
function analyzeFallbackThai(th) {
  const raw = [...th].filter(c => U[c] !== undefined);
  if (!raw.length) return { rom: 'thai', syllables: [], notes: [] };

  // 1. Strip characters muted by Karant (์) while tracking original indices & muted letters
  const chars = [];
  const mutedList = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '์') {
      let muted = '';
      if (chars.length > 0 && !CONSONANTS.has(chars[chars.length - 1].ch)) {
        muted = chars.pop().ch + muted;
      }
      if (chars.length > 0 && CONSONANTS.has(chars[chars.length - 1].ch)) {
        muted = chars.pop().ch + muted;
      }
      if (muted) mutedList.push(muted + '์');
      continue;
    }
    if (TONES.has(raw[i]) || raw[i] === 'ฯ') continue;
    chars.push({ ch: raw[i], rawIdx: i });
  }

  let out = '';
  let i = 0;
  const n = chars.length;
  const syllables = [];
  const notes = [];
  const addNote = msg => {
    if (msg && !notes.includes(msg)) notes.push(msg);
  };

  const isClusterPair = (c1, c2) => {
    if (c2 === 'ร' && 'กขคตปพฟท'.includes(c1)) return true;
    if (c2 === 'ล' && 'กขคปผพฟบ'.includes(c1)) return true;
    if (c2 === 'ว' && 'กขค'.includes(c1)) return true;
    return false;
  };

  const isVowelSignAt = idx => {
    if (idx >= n) return false;
    const ch = chars[idx].ch;
    return !CONSONANTS.has(ch) && !PRE_VOWELS.has(ch);
  };

  while (i < n) {
    const startStep = i;
    const sylParts = [];
    let pre = null;

    if (PRE_VOWELS.has(chars[i].ch)) {
      pre = chars[i].ch;
      i++;
      if (i >= n) {
        const sRom = U[pre][0];
        out += sRom;
        syllables.push({
          th: raw.slice(chars[startStep].rawIdx).join(''),
          rom: sRom,
          parts: [`${disp(pre)}(${sRom})`]
        });
        break;
      }
    }

    if (chars[i].ch === 'ฤ') {
      out += 'ri';
      const endRaw = i + 1 < n ? chars[i + 1].rawIdx : raw.length;
      syllables.push({
        th: raw.slice(chars[startStep].rawIdx, endRaw).join(''),
        rom: 'ri',
        parts: ['ฤ(ri)']
      });
      i++;
      continue;
    }

    if (!CONSONANTS.has(chars[i].ch)) {
      const sRom = (pre ? U[pre][0] : '') + (U[chars[i].ch] ? U[chars[i].ch][0] : '');
      out += sRom;
      const endRaw = i + 1 < n ? chars[i + 1].rawIdx : raw.length;
      syllables.push({
        th: raw.slice(chars[startStep].rawIdx, endRaw).join(''),
        rom: sRom,
        parts: [`${disp(chars[i].ch)}(${sRom})`]
      });
      i++;
      continue;
    }

    // Initial consonant (check ทร->s, silent ห นำ, อย, or consonant cluster)
    let initSound = '';
    let initGlyph = '';
    const c1 = chars[i].ch;

    if (c1 === 'ท' && i + 1 < n && chars[i + 1].ch === 'ร' && (pre !== null || isVowelSignAt(i + 2))) {
      initSound = 's';
      initGlyph = 'ทร';
      sylParts.push('ทร(s)');
      addNote('ทร is spoken as “s”');
      i += 2;
    } else if (c1 === 'ห' && i + 1 < n && HO_NAM_FOLLOWERS.has(chars[i + 1].ch)) {
      const follower = chars[i + 1].ch;
      initSound = U[follower][0];
      initGlyph = 'ห' + follower;
      sylParts.push(`ห(silent)+${follower}(${initSound})`);
      addNote(`silent ห before ${follower}`);
      i += 2;
    } else if (c1 === 'อ' && i + 1 < n && chars[i + 1].ch === 'ย') {
      initSound = 'y';
      initGlyph = 'อย';
      sylParts.push('อย(y)');
      addNote('silent อ before ย');
      i += 2;
    } else if (
      i + 1 < n &&
      isClusterPair(c1, chars[i + 1].ch) &&
      (pre !== null ||
        (i + 2 < n &&
          (isVowelSignAt(i + 2) || chars[i + 2].ch === 'อ' || chars[i + 2].ch === 'ว')))
    ) {
      const c2 = chars[i + 1].ch;
      initSound = (c1 === 'อ' ? '' : U[c1][0]) + U[c2][0];
      initGlyph = c1 + c2;
      sylParts.push(`${initGlyph}(${initSound})`);
      i += 2;
    } else {
      initSound = c1 === 'อ' ? '' : U[c1][0];
      initGlyph = c1;
      if (c1 === 'อ') {
        sylParts.push('อ(silent carrier)');
        addNote('อ is a silent vowel carrier at start');
      } else {
        sylParts.push(`${c1}(${initSound})`);
      }
      i++;
    }

    let vowelSound = '';
    let vowelLabel = '';
    let hasExplicitVowel = false;

    // Compound & pre-posed vowels
    if (pre === 'เ') {
      if (i < n && chars[i].ch === 'า') {
        vowelSound = 'ao';
        vowelLabel = 'เ–า(ao)';
        hasExplicitVowel = true;
        addNote('เ–า combines → ao');
        i++;
        if (i < n && chars[i].ch === 'ะ') i++;
      } else if (i + 1 < n && chars[i].ch === 'ี' && chars[i + 1].ch === 'ย') {
        vowelSound = 'ia';
        vowelLabel = 'เ–ีย(ia)';
        hasExplicitVowel = true;
        addNote('เ–ีย combines → ia');
        i += 2;
      } else if (i + 1 < n && chars[i].ch === 'ื' && chars[i + 1].ch === 'อ') {
        vowelSound = 'uea';
        vowelLabel = 'เ–ือ(uea)';
        hasExplicitVowel = true;
        addNote('เ–ือ combines → uea');
        i += 2;
        if (i < n && chars[i].ch === 'ะ') i++;
      } else if (i + 1 < n && chars[i].ch === 'ิ' && CONSONANTS.has(chars[i + 1].ch)) {
        vowelSound = 'oe';
        vowelLabel = 'เ–ิ(oe)';
        hasExplicitVowel = true;
        addNote('เ–ิ combines → oe');
        i++;
      } else if (i < n && chars[i].ch === 'อ') {
        vowelSound = 'oe';
        vowelLabel = 'เ–อ(oe)';
        hasExplicitVowel = true;
        addNote('เ–อ combines → oe');
        i++;
      } else if (i < n && chars[i].ch === '็') {
        vowelSound = 'e';
        vowelLabel = 'เ–็(e)';
        hasExplicitVowel = true;
        addNote(`เ–็ = short e after ${initGlyph}`);
        i++;
      } else if (i < n && chars[i].ch === 'ะ') {
        vowelSound = 'e';
        vowelLabel = 'เ–ะ(e)';
        hasExplicitVowel = true;
        addNote(`เ–ะ = short e after ${initGlyph}`);
        i++;
      } else {
        vowelSound = 'ay';
        vowelLabel = 'เ–(ay)';
        hasExplicitVowel = true;
        addNote(`เ– is spoken “ay” after ${initGlyph}`);
      }
    } else if (pre === 'แ') {
      if (i < n && (chars[i].ch === '็' || chars[i].ch === 'ะ')) i++;
      vowelSound = 'ae';
      vowelLabel = 'แ–(ae)';
      hasExplicitVowel = true;
      addNote(`แ– is spoken “ae” after ${initGlyph}`);
    } else if (pre === 'โ') {
      if (i < n && chars[i].ch === 'ะ') {
        vowelSound = 'o';
        vowelLabel = 'โ–ะ(o)';
        i++;
      } else {
        vowelSound = 'oh';
        vowelLabel = 'โ–(oh)';
      }
      hasExplicitVowel = true;
      addNote(`โ– is spoken after ${initGlyph}`);
    } else if (pre === 'ไ' || pre === 'ใ') {
      vowelSound = 'ai';
      vowelLabel = `${pre}–(ai)`;
      hasExplicitVowel = true;
      if (i < n && chars[i].ch === 'ย') {
        vowelLabel = `${pre}–ย(ai)`;
        i++;
      }
      addNote(`${pre}– is spoken “ai” after ${initGlyph}`);
    }

    // Non-preposed vowels
    if (!hasExplicitVowel && i < n) {
      if (chars[i].ch === '็' && i + 1 < n && chars[i + 1].ch === 'อ') {
        vowelSound = 'aw';
        vowelLabel = '◌็อ(aw)';
        hasExplicitVowel = true;
        i += 2;
      } else if (chars[i].ch === 'ั' && i + 1 < n && chars[i + 1].ch === 'ว') {
        vowelSound = 'ua';
        vowelLabel = '◌ัว(ua)';
        hasExplicitVowel = true;
        addNote('◌ัว combines → ua');
        i += 2;
      } else if (chars[i].ch === 'ื' && i + 1 < n && chars[i + 1].ch === 'อ') {
        vowelSound = 'ue';
        vowelLabel = '◌ือ(ue)';
        hasExplicitVowel = true;
        addNote('◌ือ combines → ue');
        i += 2;
      } else if (!CONSONANTS.has(chars[i].ch) && !PRE_VOWELS.has(chars[i].ch)) {
        const vCh = chars[i].ch;
        vowelSound = U[vCh] ? U[vCh][0] : '';
        vowelLabel = `${disp(vCh)}(${vowelSound})`;
        hasExplicitVowel = true;
        i++;
        if (i < n && chars[i].ch === 'ะ') i++;
      } else if (
        chars[i].ch === 'อ' &&
        (i + 1 >= n || CONSONANTS.has(chars[i + 1].ch) || PRE_VOWELS.has(chars[i + 1].ch))
      ) {
        if (i + 1 < n && chars[i + 1].ch === 'ย') {
          vowelSound = 'o';
          vowelLabel = 'อ(o)';
          hasExplicitVowel = true;
          i++;
        } else {
          vowelSound = 'aw';
          vowelLabel = 'อ(aw)';
          hasExplicitVowel = true;
          addNote('อ acts as “aw” vowel');
          i++;
        }
      } else if (
        chars[i].ch === 'ว' &&
        i + 1 < n &&
        CONSONANTS.has(chars[i + 1].ch) &&
        !isVowelSignAt(i + 1)
      ) {
        vowelSound = 'ua';
        vowelLabel = 'ว(ua)';
        hasExplicitVowel = true;
        addNote('medial ว acts as “ua” vowel');
        i++;
      }
    }

    // Determine if next consonant is a syllable-final consonant
    let finalSound = '';
    let finalLabel = '';
    if (i < n && CONSONANTS.has(chars[i].ch) && !PRE_VOWELS.has(chars[i].ch)) {
      const cNext = chars[i].ch;
      const afterIdx = i + 1;
      const startsNextSyllable =
        cNext === 'ห' ||
        cNext === 'อ' ||
        (afterIdx < n &&
          (isVowelSignAt(afterIdx) ||
            chars[afterIdx].ch === 'อ' ||
            (chars[afterIdx].ch === 'ั' && afterIdx + 1 < n && chars[afterIdx + 1].ch === 'ว') ||
            (chars[afterIdx].ch === 'ว' && afterIdx + 1 < n && CONSONANTS.has(chars[afterIdx + 1].ch)) ||
            (isClusterPair(cNext, chars[afterIdx].ch) &&
              afterIdx + 1 < n &&
              (isVowelSignAt(afterIdx + 1) || chars[afterIdx + 1].ch === 'อ'))));

      if (!startsNextSyllable) {
        if (!hasExplicitVowel) {
          if (cNext === 'ร' && afterIdx < n && chars[afterIdx].ch === 'ร') {
            vowelSound = 'an';
            vowelLabel = 'รร(an)';
            hasExplicitVowel = true;
            i += 2;
            if (i < n && CONSONANTS.has(chars[i].ch) && !isVowelSignAt(i + 1)) {
              const cf = chars[i].ch;
              vowelSound = 'a';
              vowelLabel = 'รร(a)';
              finalSound = FINAL_SOUND[cf] || U[cf][0];
              finalLabel = `${cf}(-${finalSound})`;
              if (finalSound !== U[cf][0]) addNote(`final ${cf} → -${finalSound}`);
              i++;
            }
            addNote('รร = “an/a” vowel');
          } else {
            vowelSound = 'o';
            vowelLabel = "+'o'";
            hasExplicitVowel = true;
            finalSound = FINAL_SOUND[cNext] !== undefined ? FINAL_SOUND[cNext] : U[cNext][0];
            finalLabel = `${cNext}(-${finalSound})`;
            addNote(`implied 'o' between ${initGlyph}·${cNext}`);
            if (finalSound !== U[cNext][0]) addNote(`final ${cNext} → -${finalSound}`);
            i++;
          }
        } else {
          if (!(pre === 'เ' && vowelSound === 'ao') && vowelSound !== 'am' && vowelSound !== 'ai') {
            if (cNext === 'ย' && (vowelSound === 'ua' || vowelSound === 'aa' || vowelSound === 'a')) {
              finalSound = vowelSound === 'ua' ? 'y' : 'i';
            } else {
              finalSound = FINAL_SOUND[cNext] !== undefined ? FINAL_SOUND[cNext] : U[cNext][0];
            }
            finalLabel = `${cNext}(-${finalSound})`;
            if (finalSound !== U[cNext][0]) addNote(`final ${cNext} → -${finalSound}`);
            i++;
          }
        }
      }
    }

    if (!hasExplicitVowel) {
      vowelSound = c1 === 'อ' ? 'a' : 'a';
      vowelLabel = "+'a'";
      addNote(`implied 'a' after ${initGlyph}`);
    }

    if (vowelLabel) sylParts.push(vowelLabel);
    if (finalLabel) sylParts.push(finalLabel);

    const sylRom = initSound + vowelSound + finalSound;
    out += sylRom;

    const rawStart = chars[startStep].rawIdx;
    const rawEnd = i < n ? chars[i].rawIdx : raw.length;
    syllables.push({
      th: raw.slice(rawStart, rawEnd).join(''),
      rom: sylRom,
      parts: sylParts
    });
  }

  if (mutedList.length) {
    addNote(`${mutedList.join(', ')} muted by ์`);
  }

  return {
    rom: out || romanizeLiteral(th),
    syllables,
    notes
  };
}

// Structured Real Thai syllable & phonetic rule analyzer:
// Combines the curated True-Spoken Lexicon (supporting exact matches and compound words)
// with the syllable-aware rule parser.
function analyzeRealThai(th) {
  if (!th) return { rom: 'thai', syllables: [], notes: [] };

  if (SPOKEN_OVERRIDES[th]) {
    const res = parseOverrideSpec(th, SPOKEN_OVERRIDES[th]);
    const ruleNotes = analyzeFallbackThai(th).notes;
    return { rom: res.rom, syllables: res.syllables, notes: ruleNotes };
  }

  // Decompose compound words using longest-prefix lexicon matching
  let pos = 0;
  let matchedAny = false;
  const syllables = [];
  const notes = [];
  let rom = '';

  while (pos < th.length) {
    const rem = th.slice(pos);
    let matchedKey = null;
    for (const k of OVERRIDE_KEYS) {
      if (rem.startsWith(k)) {
        matchedKey = k;
        break;
      }
    }
    if (matchedKey) {
      matchedAny = true;
      const sub = parseOverrideSpec(matchedKey, SPOKEN_OVERRIDES[matchedKey]);
      rom += sub.rom;
      syllables.push(...sub.syllables);
      pos += matchedKey.length;
    } else {
      // Find next point where an override starts, or end of string
      let nextPos = th.length;
      for (let p = pos + 1; p < th.length; p++) {
        const tail = th.slice(p);
        if (OVERRIDE_KEYS.some(k => tail.startsWith(k))) {
          nextPos = p;
          break;
        }
      }
      const chunk = th.slice(pos, nextPos);
      const sub = analyzeFallbackThai(chunk);
      rom += sub.rom;
      syllables.push(...sub.syllables);
      for (const n of sub.notes) if (!notes.includes(n)) notes.push(n);
      pos = nextPos;
    }
  }

  if (matchedAny) {
    const ruleNotes = analyzeFallbackThai(th).notes;
    for (const n of ruleNotes) if (!notes.includes(n)) notes.push(n);
    return { rom, syllables, notes };
  }

  return analyzeFallbackThai(th);
}

// True Thai syllable-aware phonetic parser
function romanizeRealThai(th) {
  return analyzeRealThai(th).rom;
}

// Rich HTML hint generator for Real Thai mode:
// Shows spoken syllable chunks (in true reading order) + concise rule explanations
function explainRealThai(th) {
  const { syllables, notes } = analyzeRealThai(th);
  if (!syllables.length) {
    return `<p class="hint">${[...th].map(c => disp(c) + ' ' + (U[c][0] || 'silent')).join(' · ')}</p>`;
  }

  const sylChips = syllables
    .map(
      s =>
        `<span class="syl-chip"><strong class="syl-th">${s.th}</strong> → <span class="syl-rom">${s.rom}</span> <small class="syl-parts">${s.parts.join(' + ')}</small></span>`
    )
    .join('<span class="syl-sep">·</span>');

  const noteLine = notes.length
    ? `<div class="hint-rules">${notes.map(n => `<span class="rule-pill">💡 ${n}</span>`).join('')}</div>`
    : '';

  return `<div class="hint real-hint"><div class="syl-row">${sylChips}</div>${noteLine}</div>`;
}

// Deterministic phonetic romanizer for Wordle target strings
function romanizeThai(th, mode) {
  const m = mode || (typeof window !== 'undefined' && window.AMBIENT_PHONETICS_MODE) || 'real';
  return m === 'literal' ? romanizeLiteral(th) : romanizeRealThai(th);
}
