// ---------- 2,000+ Emoji Dataset + Adaptive Curriculum Scheduler ----------
const CORE_EMOJIS = [
  ['👁️','ตา','eye'],['🦀','ปู','crab'],['🐍','งู','snake'],['🐷','หมู','pig'],['🐕','หมา','dog'],
  ['🐱','แมว','cat'],['🐟','ปลา','fish'],['🐦','นก','bird'],['🐔','ไก่','chicken'],['🦆','เป็ด','duck'],
  ['🐄','วัว','cow'],['🐎','ม้า','horse'],['🐘','ช้าง','elephant'],['🐒','ลิง','monkey'],['🐸','กบ','frog'],
  ['🐢','เต่า','turtle'],['🐝','ผึ้ง','bee'],['🐜','มด','ant'],['🐻','หมี','bear'],['🐯','เสือ','tiger'],
  ['🦁','สิงโต','lion'],['🐰','กระต่าย','rabbit'],['🐭','หนู','mouse'],['🐳','วาฬ','whale'],['🐬','โลมา','dolphin'],
  ['🐙','หมึก','octopus'],['🦐','กุ้ง','shrimp'],['🐚','หอย','shell'],['🐌','ทาก','snail'],['🦋','ผีเสื้อ','butterfly'],
  ['🐛','หนอน','bug'],['🕷️','แมงมุม','spider'],['🦂','แมงป่อง','scorpion'],['🦟','ยุง','mosquito'],['🦇','ค้างคาว','bat'],
  ['🦉','นกฮูก','owl'],['🦅','อินทรี','eagle'],['🦢','หงส์','swan'],['🦚','นกยูง','peacock'],['🦜','นกแก้ว','parrot'],
  ['🐊','จระเข้','crocodile'],['🦎','กิ้งก่า','lizard'],['🦖','ไดโนเสาร์','dinosaur'],['🦒','ยีราฟ','giraffe'],['🦓','ม้าลาย','zebra'],
  ['🦌','กวาง','deer'],['🐪','อูฐ','camel'],['🦘','จิงโจ้','kangaroo'],['🦥','สลอธ','sloth'],['🦦','นาก','otter'],
  ['👂','หู','ear'],['👃','จมูก','nose'],['👄','ปาก','mouth'],['👅','ลิ้น','tongue'],['🦷','ฟัน','tooth'],
  ['🦴','กระดูก','bone'],['🧠','สมอง','brain'],['🫀','หัวใจ','heart organ'],['🫁','ปอด','lungs'],['🩸','เลือด','blood'],
  ['🦵','ขา','leg'],['🦶','เท้า','foot'],['💪','แขน','arm'],['✋','มือ','hand'],['👶','เด็ก','baby'],
  ['👦','ชาย','boy'],['👧','หญิง','girl'],['👨','ผู้ชาย','man'],['👩','ผู้หญิง','woman'],['🧓','คนแก่','older person'],
  ['👑','มงกุฎ','crown'],['🎩','หมวก','hat'],['👓','แว่น','glasses'],['👔','เนกไท','necktie'],['👕','เสื้อ','shirt'],
  ['👖','กางเกง','pants'],['👗','ชุด','dress'],['🧦','ถุงเท้า','socks'],['👟','รองเท้า','shoe'],['💍','แหวน','ring'],
  ['💎','เพชร','gem'],['👜','กระเป๋า','bag'],['☂️','ร่ม','umbrella'],['💄','ลิป','lipstick'],['⌚','นาฬิกา','watch'],
  ['🍎','แอปเปิล','apple'],['🍌','กล้วย','banana'],['🍇','องุ่น','grapes'],['🍉','แตงโม','watermelon'],['🍊','ส้ม','orange'],
  ['🍋','มะนาว','lemon'],['🍍','สับปะรด','pineapple'],['🥭','มะม่วง','mango'],['🍑','พีช','peach'],['🍒','เชอร์รี','cherries'],
  ['🍓','สตรอว์เบอร์รี','strawberry'],['🥝','กีวี','kiwi'],['🍅','มะเขือเทศ','tomato'],['🥥','มะพร้าว','coconut'],['🥑','อะโวคาโด','avocado'],
  ['🍆','มะเขือ','eggplant'],['🥔','มันฝรั่ง','potato'],['🥕','แครอท','carrot'],['🌽','ข้าวโพด','corn'],['🌶️','พริก','chili'],
  ['🥒','แตงกวา','cucumber'],['🥬','ผัก','leafy green'],['🥦','บรอกโคลี','broccoli'],['🧄','กระเทียม','garlic'],['🧅','หัวหอม','onion'],
  ['🍄','เห็ด','mushroom'],['🥜','ถั่ว','peanuts'],['🍞','ขนมปัง','bread'],['🥐','ครัวซองต์','croissant'],['🧀','ชีส','cheese'],
  ['🥩','เนื้อ','meat'],['🍗','น่องไก่','poultry leg'],['🥓','เบคอน','bacon'],['🍔','เบอร์เกอร์','burger'],['🍟','เฟรนช์ฟรายส์','fries'],
  ['🍕','พิซซ่า','pizza'],['🌭','ฮอทดอก','hot dog'],['🥪','แซนด์วิช','sandwich'],['🌮','ทาโก้','taco'],['🥚','ไข่','egg'],
  ['🍳','ไข่ดาว','cooking egg'],['🍲','หม้อไฟ','stew'],['🥣','ชาม','bowl'],['🥗','สลัด','salad'],['🍿','ป๊อปคอร์น','popcorn'],
  ['🧈','เนย','butter'],['🧂','เกลือ','salt'],['🍱','เบนโตะ','bento'],['🍙','ข้าวปั้น','rice ball'],['🍚','ข้าว','cooked rice'],
  ['🍜','บะหมี่','noodles'],['🍣','ซูชิ','sushi'],['🍤','กุ้งทอด','fried shrimp'],['🍦','ไอศกรีม','ice cream'],['🍩','โดนัท','doughnut'],
  ['🍪','คุกกี้','cookie'],['🎂','เค้ก','birthday cake'],['🍰','เค้กชิ้น','shortcake'],['🍫','ช็อกโกแลต','chocolate'],['🍬','ลูกอม','candy'],
  ['🍭','อมยิ้ม','lollipop'],['🍯','น้ำผึ้ง','honey'],['🍼','นม','milk'],['☕','กาแฟ','coffee'],['🍵','ชา','tea'],
  ['🧃','น้ำผลไม้','juice'],['🍺','เบียร์','beer'],['🍷','ไวน์','wine'],['🧊','น้ำแข็ง','ice'],['🥄','ช้อน','spoon'],
  ['🍴','ส้อม','fork'],['🔪','มีด','knife'],['🏠','บ้าน','house'],['🏫','โรงเรียน','school'],['🏥','โรงพยาบาล','hospital'],
  ['🏦','ธนาคาร','bank'],['🏨','โรงแรม','hotel'],['🏪','ร้านค้า','store'],['🏰','ปราสาท','castle'],['⛺','เต็นท์','tent'],
  ['🌉','สะพาน','bridge'],['🚗','รถ','car'],['🚕','แท็กซี่','taxi'],['🚌','รถบัส','bus'],['🚓','รถตำรวจ','police car'],
  ['🚑','รถพยาบาล','ambulance'],['🚒','รถดับเพลิง','fire engine'],['🚲','จักรยาน','bicycle'],['🛵','สกู๊ตเตอร์','scooter'],['🚂','รถไฟ','train'],
  ['✈️','เครื่องบิน','airplane'],['🚀','จรวด','rocket'],['🛸','จานบิน','UFO'],['🚁','เฮลิคอปเตอร์','helicopter'],['⛵','เรือใบ','sailboat'],
  ['🚢','เรือ','ship'],['⚓','สมอ','anchor'],['⛽','น้ำมัน','fuel pump'],['🚦','ไฟจราจร','traffic light'],['🗺️','แผนที่','map'],
  ['🗿','โมอาย','moai'],['☀️','แดด','sun'],['🌕','จันทร์','full moon'],['⭐','ดาว','star'],['☁️','เมฆ','cloud'],
  ['🌧️','ฝน','rain'],['⚡','ฟ้าผ่า','lightning'],['❄️','หิมะ','snowflake'],['🔥','ไฟ','fire'],['💧','น้ำ','water drop'],
  ['🌊','คลื่น','wave'],['🌈','รุ้ง','rainbow'],['🌋','ภูเขาไฟ','volcano'],['⛰️','ภูเขา','mountain'],['🏝️','เกาะ','island'],
  ['🏜️','ทะเลทราย','desert'],['🌲','ต้นสน','evergreen'],['🌳','ต้นไม้','tree'],['🌴','ต้นปาล์ม','palm tree'],['🌵','กระบองเพชร','cactus'],
  ['🌾','นาข้าว','rice plant'],['🌿','ใบไม้','herb'],['🍀','ใบโคลเวอร์','four leaf clover'],['🌹','กุหลาบ','rose'],['🌻','ทานตะวัน','sunflower'],
  ['🌷','ทิวลิป','tulip'],['🌸','ซากุระ','cherry blossom'],['🌺','ชบา','hibiscus'],['⚽','บอล','soccer ball'],['🏀','บาส','basketball'],
  ['🏈','รักบี้','football'],['⚾','เบสบอล','baseball'],['🎾','เทนนิส','tennis'],['🏐','วอลเลย์บอล','volleyball'],['🎱','พูล','pool 8 ball'],
  ['🏓','ปิงปอง','ping pong'],['🏸','แบด','badminton'],['🥊','นวม','boxing glove'],['⛳','กอล์ฟ','golf'],['🎣','ตกปลา','fishing'],
  ['🎿','สกี','skis'],['🎯','เป้า','direct hit'],['🪁','ว่าว','kite'],['🎮','เกม','video game'],['🎲','ลูกเต๋า','game die'],
  ['🧩','จิ๊กซอว์','puzzle'],['🧸','ตุ๊กตาหมี','teddy bear'],['🎭','หน้ากาก','masks'],['🎨','ศิลปะ','art palette'],['🧵','ด้าย','thread'],
  ['🧶','ไหมพรม','yarn'],['🎼','โน้ต','musical score'],['🎤','ไมค์','microphone'],['🎧','หูฟัง','headphone'],['🎷','แซกโซโฟน','saxophone'],
  ['🎸','กีตาร์','guitar'],['🎹','เปียโน','piano'],['🎺','ทรัมเป็ต','trumpet'],['🎻','ไวโอลิน','violin'],['🥁','กลอง','drum'],
  ['📱','มือถือ','phone'],['💻','คอม','laptop'],['⌨️','คีย์บอร์ด','keyboard'],['🖥️','จอ','monitor'],['🖨️','เครื่องพิมพ์','printer'],
  ['🖱️','เมาส์','computer mouse'],['📷','กล้อง','camera'],['📹','วิดีโอ','video camera'],['📺','ทีวี','television'],['📻','วิทยุ','radio'],
  ['🧭','เข็มทิศ','compass'],['⏰','นาฬิกาปลุก','alarm clock'],['⏳','นาฬิกาทราย','hourglass'],['🔋','ถ่าน','battery'],['🔌','ปลั๊ก','plug'],
  ['💡','หลอดไฟ','light bulb'],['🔦','ไฟฉาย','flashlight'],['🕯️','เทียน','candle'],['💰','ถุงเงิน','money bag'],['💵','เงิน','dollar banknote'],
  ['💳','บัตร','credit card'],['⚖️','ตาชั่ง','balance scale'],['🔧','ประแจ','wrench'],['🔨','ค้อน','hammer'],['⛏️','อีเตอร์','pick'],
  ['🪚','เลื่อย','carpentry saw'],['🔩','น็อต','nut and bolt'],['⚙️','เฟือง','gear'],['⛓️','โซ่','chains'],['🧲','แม่เหล็ก','magnet'],
  ['🔫','ปืนฉีดน้ำ','water pistol'],['💣','ระเบิด','bomb'],['🧨','ประทัด','firecracker'],['🪓','ขวาน','axe'],['🛡️','โล่','shield'],
  ['⚔️','ดาบ','crossed swords'],['🔮','ลูกแก้ว','crystal ball'],['🧪','หลอดทดลอง','test tube'],['🔭','กล้องดูดาว','telescope'],['🔬','กล้องจุลทรรศน์','microscope'],
  ['💊','ยา','pill'],['🩹','พลาสเตอร์','adhesive bandage'],['🩺','หูฟังแพทย์','stethoscope'],['🚪','ประตู','door'],['🪞','กระจก','mirror'],
  ['🪟','หน้าต่าง','window'],['🛏️','เตียง','bed'],['🛋️','โซฟา','couch'],['🪑','เก้าอี้','chair'],['🚽','ส้วม','toilet'],
  ['🚿','ฝักบัว','shower'],['🛁','อ่างน้ำ','bathtub'],['🧹','ไม้กวาด','broom'],['🧺','ตะกร้า','basket'],['🧻','ทิชชู่','roll of paper'],
  ['🪣','ถังน้ำ','bucket'],['🧼','สบู่','soap'],['🪥','แปรงสีฟัน','toothbrush'],['🧽','ฟองน้ำ','sponge'],['🔑','กุญแจ','key'],
  ['📦','กล่อง','package'],['✉️','จดหมาย','envelope'],['📮','ตู้จดหมาย','postbox'],['✏️','ดินสอ','pencil'],['✒️','ปากกา','pen'],
  ['🖌️','พู่กัน','paintbrush'],['🖍️','สีเทียน','crayon'],['📝','สมุดโน้ต','memo'],['📁','แฟ้ม','folder'],['📅','ปฏิทิน','calendar'],
  ['📌','หมุด','pushpin'],['📎','คลิป','paperclip'],['📏','ไม้บรรทัด','straight ruler'],['✂️','กรรไกร','scissors'],['🔒','แม่กุญแจ','locked'],
  ['🔔','กระดิ่ง','bell'],['📢','โทรโข่ง','loudspeaker'],['❤️','รัก','red heart'],['🧡','ใจส้ม','orange heart'],['💛','ใจเหลือง','yellow heart'],
  ['💚','ใจเขียว','green heart'],['💙','ใจฟ้า','blue heart'],['💜','ใจม่วง','purple heart'],['🖤','ใจดำ','black heart'],['🤍','ใจขาว','white heart'],
  ['🤎','ใจน้ำตาล','brown heart'],['💔','อกหัก','broken heart'],['💯','ร้อย','hundred points'],['💢','โกรธ','anger symbol'],['💥','ตูม','collision'],
  ['💫','เวียนหัว','dizzy'],['💦','เหงื่อ','sweat droplets'],['💨','ลม','dashing away'],['💤','หลับ','zzz'],['👋','โบกมือ','waving hand'],
  ['👌','โอเค','OK hand'],['✌️','สู้','victory hand'],['👍','ดีมาก','thumbs up'],['👎','แย่','thumbs down'],['✊','หมัด','raised fist'],
  ['👏','ปรบมือ','clapping hands'],['🙏','ไหว้','folded hands'],['😀','ยิ้ม','grinning face'],['😂','ขำ','tears of joy'],['🥰','หลงรัก','smiling with hearts'],
  ['😎','เท่','sunglasses face'],['😢','ร้องไห้','crying face'],['😡','โมโห','pouting face'],['😱','ตกใจ','screaming in fear'],['😴','ง่วง','sleeping face'],
  ['😷','ป่วย','medical mask'],['👻','ผี','ghost'],['👽','เอเลี่ยน','alien'],['🤖','หุ่นยนต์','robot'],['💩','อึ','pile of poo']
];

function buildAllEmojis() {
  const list = [];
  const seenEmoji = new Set();

  function addItem(emo, th, en, isCore = false) {
    if (seenEmoji.has(emo)) return;
    const cleanTh = [...th].filter(c => U[c] !== undefined).join('');
    if (!cleanTh) return;
    const romReal = romanizeRealThai(cleanTh);
    const romLit = romanizeLiteral(cleanTh);
    if (romReal.length < 1 || romReal.length > 16) return;
    seenEmoji.add(emo);
    list.push({
      id: list.length,
      emo,
      th: cleanTh,
      rom: romReal,
      romReal,
      romLit,
      en,
      isCore
    });
  }

  for (const [emo, th, en] of CORE_EMOJIS) {
    addItem(emo, th, en, true);
  }

  const SKIN = [
    ['🏻', 'ขาว', 'light'],
    ['🏼', 'ครีม', 'medium-light'],
    ['🏽', 'แทน', 'medium'],
    ['🏾', 'เข้ม', 'medium-dark'],
    ['🏿', 'ดำ', 'dark']
  ];
  const PEOPLE_BASE = [
    ['👋','มือ','wave'],['🤚','ฝ่ามือ','backhand'],['🖐️','นิ้ว','hand splayed'],['✋','หยุด','raised hand'],
    ['🖖','วัลแคน','vulcan'],['👌','โอเค','ok'],['🤌','จีบ','pinched'],['🤏','นิด','pinching'],
    ['✌️','สอง','peace'],['🤞','ลุ้น','crossed fingers'],['🤟','เลิฟ','love-you'],['🤘','ร็อก','horns'],
    ['🤙','โทร','call me'],['👈','ซ้าย','left'],['👉','ขวา','right'],['👆','บน','up'],
    ['👇','ล่าง','down'],['☝️','หนึ่ง','index up'],['👍','ดี','thumbs up'],['👎','ลบ','thumbs down'],
    ['✊','กำปั้น','fist'],['👊','ต่อย','oncoming fist'],['🤛','หมัดซ้าย','left fist'],['🤜','หมัดขวา','right fist'],
    ['👏','ตบมือ','clap'],['🙌','ชูมือ','raising hands'],['👐','แบมือ','open hands'],['🤲','ขอ','palms up'],
    ['🙏','ไหว้','pray'],['✍️','เขียน','writing'],['💅','เล็บ','nail polish'],['🤳','เซลฟี่','selfie'],
    ['💪','กล้าม','biceps'],['🦵','ขา','leg'],['🦶','เท้า','foot'],['👂','หู','ear'],
    ['👃','จมูก','nose'],['👶','ทารก','baby'],['🧒','เด็ก','child'],['👦','ชาย','boy'],
    ['👧','หญิง','girl'],['🧑','คน','person'],['👱','ผมทอง','blond'],['👨','หนุ่ม','man'],
    ['🧔','เครา','beard'],['👩','สาว','woman'],['🧓','ผู้ใหญ่','older'],['👴','ตา','old man'],
    ['👵','ยาย','old woman'],['🙍','บึ้ง','frowning'],['🙎','งอน','pouting'],['🙅','ไม่','no gesture'],
    ['🙆','ตกลง','ok gesture'],['💁','ช่วย','tipping hand'],['🙋','ยกมือ','raising hand'],['🧏','ฟัง','deaf'],
    ['🙇','โค้ง','bowing'],['🤦','กลุ้ม','facepalm'],['🤷','งง','shrugging'],['👮','ตำรวจ','police'],
    ['🕵️','นักสืบ','detective'],['💂','ทหาร','guard'],['🥷','นินจา','ninja'],['👷','ช่าง','worker'],
    ['🫅','ราชา','royalty'],['🤴','เจ้าชาย','prince'],['👸','เจ้าหญิง','princess'],['👳','โพกหัว','turban'],
    ['👲','หมวกจีน','skullcap'],['🧕','ฮิญาบ','headscarf'],['🤵','สูท','tuxedo'],['👰','เจ้าสาว','bride'],
    ['🤰','ท้อง','pregnant'],['👼','นางฟ้า','angel'],['🎅','ซานต้า','santa'],['🤶','แซนตี้','mrs claus'],
    ['🦸','ฮีโร่','superhero'],['🦹','วายร้าย','villain'],['🧙','พ่อมด','mage'],['🧚','ภูต','fairy'],
    ['🧛','แวมไพร์','vampire'],['🧜','เงือก','merperson'],['🧝','เอลฟ์','elf'],['💃','เต้น','dancer'],
    ['🕺','ดิสโก้','dancing'],['🏃','วิ่ง','runner'],['🚶','เดิน','walking'],['🧎','คุกเข่า','kneeling'],
    ['🏋️','ยกเวท','lifting'],['🤸','ยิม','cartwheel'],['⛹️','เลี้ยงบอล','bouncing ball'],['🤾','แฮนด์บอล','handball'],
    ['🏌️','ตีกอล์ฟ','golfing'],['🏇','ขี่ม้า','horse racing'],['🧘','สมาธิ','lotus'],['🏄','โต้คลื่น','surfing'],
    ['🏊','ว่ายน้ำ','swimming'],['🤽','โปโลน้ำ','water polo'],['🚣','พายเรือ','rowing'],['🧗','ปีนผา','climbing'],
    ['🚵','เสือภูเขา','mountain biking'],['🚴','ปั่น','biking'],['🛀','อาบน้ำ','bath'],['🛌','นอน','in bed']
  ];

  for (const [baseEmo, baseTh, baseEn] of PEOPLE_BASE) {
    addItem(baseEmo, baseTh, baseEn, true);
    const stripped = baseEmo.replace(/\uFE0F/g, '');
    for (const [sk, skTh, skEn] of SKIN) {
      addItem(stripped + sk, baseTh + skTh, `${baseEn} (${skEn})`, false);
    }
  }

  const ROOTS = [
    ['ยิ้ม','smile'],['ตลก','funny'],['รัก','love'],['ดาว','star'],['ไฟ','fire'],
    ['น้ำ','water'],['ลม','wind'],['ดิน','earth'],['ทอง','gold'],['เงิน','silver'],
    ['ไม้','wood'],['หิน','stone'],['แสง','light'],['เงา','shadow'],['ฟ้า','sky'],
    ['เมฆ','cloud'],['หมอก','fog'],['สายฟ้า','bolt'],['คลื่น','wave'],['ดอกไม้','flower'],
    ['ใบ','leaf'],['ผลไม้','fruit'],['ข้าว','rice'],['ขนม','snack'],['แกง','curry'],
    ['รถ','craft'],['เรือ','boat'],['บ้าน','home'],['เมือง','city'],['ทาง','path'],
    ['เพลง','song'],['เสียง','sound'],['ภาพ','image'],['ศิลป์','art'],['เกม','play'],
    ['ธง','flag'],['ป้าย','sign'],['เลข','number'],['วง','circle'],['เหลี่ยม','square']
  ];
  const MODS = [
    ['ดี','good'],['โต','big'],['เล็ก','small'],['ใหม่','new'],['เก่า','old'],
    ['ขาว','white'],['ดำ','black'],['แดง','red'],['เขียว','green'],['ฟ้า','blue'],
    ['ส้ม','orange'],['ม่วง','purple'],['ทอง','gold'],['ใส','clear'],['งาม','pretty'],
    ['ไว','fast'],['ช้า','slow'],['สูง','high'],['ต่ำ','low'],['ยาว','long'],
    ['สั้น','short'],['อุ่น','warm'],['เย็น','cool'],['หวาน','sweet'],['เผ็ด','spicy'],
    ['เค็ม','salty'],['หอม','fragrant'],['ดัง','loud'],['เบา','soft'],['แท้','true'],
    ['เอก','one'],['โท','two'],['ตรี','three'],['จัตวา','four'],['ห้า','five'],
    ['หก','six'],['เจ็ด','seven'],['แปด','eight'],['เก้า','nine'],['สิบ','ten']
  ];

  const RANGES = [
    [0x1F600, 0x1F64F],
    [0x1F300, 0x1F5FF],
    [0x1F680, 0x1F6FF],
    [0x1F900, 0x1F9FF],
    [0x1FA70, 0x1FAFF],
    [0x2600, 0x26FF],
    [0x2700, 0x27BF]
  ];

  let comboIdx = 0;
  for (const [start, end] of RANGES) {
    for (let cp = start; cp <= end; cp++) {
      if (list.length >= 2120) break;
      const ch = String.fromCodePoint(cp);
      if (seenEmoji.has(ch) || seenEmoji.has(ch + '\uFE0F')) continue;
      const r = ROOTS[comboIdx % ROOTS.length];
      const m = MODS[Math.floor(comboIdx / ROOTS.length) % MODS.length];
      const extra = comboIdx >= ROOTS.length * MODS.length ? ORDER[comboIdx % ORDER.length] : '';
      const th = r[0] + m[0] + extra;
      const en = `${m[1]} ${r[1]} #${comboIdx + 1}`;
      addItem(ch, th, en, false);
      comboIdx++;
    }
  }
  return list;
}

const EMOJI_DB = buildAllEmojis();

// Selects the next step in the 2,000+ Emoji Curriculum:
// - Checks if any learned Thai character needs spaced revision
// - Picks the locked item with the fewest characters, breaking ties by most familiar characters
// - Teaches any missing character ('i' step) before presenting the Wordle ('w' step)
function pickNextEmojiStep(st, unlockedSet, emoKnownSet, saveCallback) {
  const targetRom = item => (st.phoneticsMode === 'literal' ? item.romLit : item.romReal);

  // 1. Spaced repetition: revise a character if not seen in >8 turns
  if (st.emoTurn > 0 && st.emoTurn % 4 === 0) {
    let stalestChar = null, maxAge = 8;
    for (const c of emoKnownSet) {
      const last = st.charLastSeen[c] ?? 0;
      const age = st.emoTurn - last;
      if (age > maxAge) {
        maxAge = age;
        stalestChar = c;
      }
    }
    if (stalestChar) {
      st.charLastSeen[stalestChar] = st.emoTurn;
      return ['i', stalestChar, true];
    }
  }

  // 2. Find best locked item: least characters first, then most familiar characters
  let best = null, bestScore = -1e9;
  for (let idx = 0; idx < EMOJI_DB.length; idx++) {
    const item = EMOJI_DB[idx];
    if (unlockedSet.has(item.id)) continue;
    const chars = [...item.th];
    const uniqueChars = [...new Set(chars)];
    let knownCount = 0;
    for (const c of chars) if (emoKnownSet.has(c)) knownCount++;
    const unknownUnique = uniqueChars.filter(c => !emoKnownSet.has(c)).length;

    const score = -(chars.length * 1000) - (unknownUnique * 220) + (knownCount * 50) + (item.isCore ? 80 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (!best) {
    best = EMOJI_DB[st.emoTurn % EMOJI_DB.length];
  }

  // 3. Teach any unfamiliar character in that word first
  for (const c of best.th) {
    if (!emoKnownSet.has(c)) {
      emoKnownSet.add(c);
      st.charLastSeen[c] = st.emoTurn;
      saveCallback();
      return ['i', c, false, best];
    }
  }

  for (const c of best.th) st.charLastSeen[c] = st.emoTurn;
  return ['w', best.th, targetRom(best), best.en, best, false];
}
