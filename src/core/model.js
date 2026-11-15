/* ============ MODEL: data + pure logic (no DOM) ============ */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const WIN = [
  { id:'sea',      name:'Sea-facing',    sub:'Salt air, slow mornings',    mood:'tide',   noun:'tide',  trait:'Salt air',    word:'salty' },
  { id:'mountain', name:'Mountain',      sub:'Thin air, big views',        mood:'ember',  noun:'ridge', trait:'Thin air',    word:'high-air' },
  { id:'city',     name:'City at night', sub:'Neon, noise, late dinners',  mood:'dusk',   noun:'neon',  trait:'Night lights',word:'neon-lit' },
  { id:'forest',   name:'Forest edge',   sub:'Birdsong, green quiet',      mood:'forest', noun:'moss',  trait:'Green quiet', word:'green' }
];
const BAG = [
  { id:'journal',   name:'Journal',     hint:'Quiet hours' },
  { id:'swim',      name:'Swimsuit',    hint:'Salt & sun' },
  { id:'paperback', name:'Paperback',   hint:'One slow read' },
  { id:'camera',    name:'Camera',      hint:'Catch moments' },
  { id:'shoes',     name:'Trail shoes', hint:'Move a lot' },
  { id:'phones',    name:'Headphones',  hint:'Own soundtrack' },
  { id:'sketch',    name:'Sketchbook',  hint:'Look closely' },
  { id:'party',     name:'Party shirt', hint:'Meet people' }
];
const SOUND = [
  { id:'lofi',  name:'Low-tide lo-fi',    hint:'Soft loops, slow waves',      bars:[.35,.5,.62,.5,.38,.3,.42,.58,.7,.58,.44,.34,.4,.54,.64,.5,.38,.3] },
  { id:'brass', name:'Street-band brass', hint:'Loud, warm, spontaneous',     bars:[.5,.9,.4,.8,.95,.45,.85,.6,1,.5,.9,.4,.75,.95,.5,.8,.45,.7] },
  { id:'rain',  name:'Rain on the roof',  hint:'Quiet, close, cosy',          bars:[.22,.3,.18,.34,.2,.28,.16,.32,.24,.36,.18,.3,.22,.34,.16,.28,.2,.26] },
  { id:'synth', name:'Night-drive synths',hint:'Neon and an open road',       bars:[.28,.34,.4,.46,.52,.58,.66,.74,.82,.9,.82,.74,.66,.58,.5,.44,.38,.32] }
];
const FEEL = [
  { id:'rested',   label:'Rested',            role:'seeker' },
  { id:'inspired', label:'Inspired',          role:'dreamer' },
  { id:'free',     label:'Free',              role:'wanderer' },
  { id:'close',    label:'Close to someone',  role:'companion' },
  { id:'alive',    label:'Alive',             role:'chaser' },
  { id:'lighter',  label:'Lighter',           role:'drifter' },
  { id:'curious',  label:'Curious',           role:'explorer' },
  { id:'proud',    label:'Proud',             role:'climber' }
];
const STYLE = [
  { id:'bp',    name:'Backpacker',   desc:'Hostels, street food, buses',               mult:0.6 },
  { id:'comfy', name:'Comfortable',  desc:'Boutique stays, good dinners, the odd taxi',mult:1 },
  { id:'treat', name:'Treat myself', desc:'Design hotels, tasting menus, private guides', mult:1.9 }
];

/* ----- Five made-up destinations. Prices and best months are illustrative. -----
   win:   affinity 0-100 for [sea, mountain, city, forest]
   feel:  affinity for [rested, inspired, free, close, alive, lighter, curious, proud]
   sound: affinity for [lofi, brass, rain, synth]
   bag:   affinity for [journal, swim, paperback, camera, shoes, phones, sketch, party]
   cost:  [backpacker, comfortable, treat] per night / per day, USD per person
   months: fit by month, Jan..Dec, 0-100 (>=75 best, >=45 good)
   days:  8 day-templates (arrival, 6 middle days, departure). Stops listed by priority:
          [part of day (a morning, m midday, p afternoon, e evening), title, comfortable cost]. */
const DEST = [
  { id:'hoian', name:'Hoi An', country:'Vietnam', scene:'hoian', blurb:'Lantern-lit river town',
    win:[90,10,40,55], energy:32, feel:[95,60,70,70,35,80,60,30], sound:[90,40,80,30], bag:[80,95,90,70,30,50,80,35],
    cost:{ stay:[28,105,240], food:[14,45,95], trans:[4,9,22] },
    months:[60,88,95,90,66,25,22,22,20,18,20,55],
    days:[
      ['Arrive & unwind',[['m','Riverside check-in & walk',0],['e','Lantern-lit Old Town stroll',8],['p','Iced coffee in a courtyard café',4],['a','Airport pickup & scenic drive from Da Nang',12]]],
      ['Slow start',[['a','Sunrise tai chi, An Bang Beach',0],['p','Market visit & cooking class',38],['m','Banh mi at the central market',3],['e','Candle release on the river',6]]],
      ['Green & quiet',[['a','Bicycle through rice paddies',15],['p','Tailor fitting over tea',25],['m','Water-coconut grove lunch',9],['e','Quiet dinner in a garden house',16]]],
      ['Beach day',[['a','Lazy morning on the sand',0],['m','Cao lau lunch crawl',14],['p','Sunbed & fresh coconut',7],['e','Seafood by the shore',22]]],
      ['On the water',[['a','Basket-boat paddle',22],['e','Rooftop sunset drinks',18],['m','Coconut-forest lunch',10],['p','Lantern-making workshop',16]]],
      ['Hands-on',[['a','Pottery village workshop',20],['p','Spa afternoon',35],['m','Street-food walking tour',24],['e','Night-market browse',6]]],
      ['Open day',[['a','Rice-paper & noodle-making visit',18],['p','Thu Bon river ferry',4],['m','Vegetarian lunch in a quiet lane',9],['e','Live folk music night',12]]],
      ['Last light',[['a','Final coffee by the river',6],['p','Airport transfer',12],['a','Last stroll through the Old Town',0],['a','Souvenir silk & lanterns',22]]]
    ] },
  { id:'lisbon', name:'Lisbon', country:'Portugal', scene:'lisbon', blurb:'Hillside tiles, trams and the Tagus',
    win:[75,15,80,25], energy:50, feel:[70,75,75,85,60,70,75,45], sound:[65,60,45,55], bag:[60,80,60,85,40,70,70,60],
    cost:{ stay:[38,130,290], food:[20,55,110], trans:[5,11,25] },
    months:[25,32,70,72,88,90,70,62,92,85,45,28],
    days:[
      ['Arrive & unwind',[['m','Tram 28 ride to your Alfama stay',3],['e','Fado dinner in a tiny tavern',42],['p','Miradouro viewpoint at golden hour',0],['a','Airport metro & coffee in Chiado',5]]],
      ['Slow start',[['a','Pastel de nata at a corner bakery',3],['p','Wander Alfama’s back lanes',0],['m','Time Out Market lunch',18],['e','Rooftop sunset in Bairro Alto',16]]],
      ['River day',[['a','Belém Tower & the river path',10],['p','Pastéis de Belém & MAAT',14],['m','LX Factory lunch & bookshop',15],['e','Sunset sail on the Tagus',30]]],
      ['Sintra',[['a','Train to Sintra',6],['p','Quinta da Regaleira wells',12],['m','Pena Palace gardens',16],['e','Cascais seafood dinner',35]]],
      ['Seaside',[['a','Train to Cascais & coastal walk',5],['p','Sunbathe at Carcavelos',0],['m','Beach lunch at Guincho',20],['e','Sunset at Cabo da Roca',8]]],
      ['Slow Lisbon',[['a','Azulejo tile museum',8],['p','Secondhand shops in Príncipe Real',0],['m','Petiscos lunch in Graça',22],['e','Ginjinha & live jazz',20]]],
      ['Open day',[['a','Sleep in & a long breakfast',12],['p','Gulbenkian garden afternoon',10],['m','Sardine lunch in Alcântara',18],['e','Farewell dinner at a family kitchen',38]]],
      ['Last light',[['a','Final bica at a standing bar',2],['p','Airport transfer',15],['a','Last walk along the Tagus',0],['a','Tins & tiles to take home',20]]]
    ] },
  { id:'oaxaca', name:'Oaxaca', country:'Mexico', scene:'oaxaca', blurb:'Mezcal, markets and painted walls',
    win:[18,55,75,45], energy:62, feel:[50,88,72,68,88,62,92,58], sound:[38,95,42,48], bag:[58,28,52,85,50,58,92,75],
    cost:{ stay:[24,80,210], food:[13,38,85], trans:[4,8,20] },
    months:[80,85,82,70,45,30,40,40,40,60,90,85],
    days:[
      ['Arrive & unwind',[['m','Zócalo stroll & fresh nieve',4],['e','Mezcal tasting in a courtyard bar',22],['p','Nap in a shady patio',0],['a','Colectivo from the airport',6]]],
      ['Market morning',[['a','Mercado 20 de Noviembre breakfast',7],['p','Tlayuda & hot-chocolate lesson',32],['m','Walk Calle Alcalá to Santo Domingo',0],['e','Live music in the plaza',0]]],
      ['Ancient ruins',[['a','Monte Albán at opening time',9],['e','Rooftop dinner with city lights',26],['m','Lunch in Xoxocotlán',10],['p','Barro negro pottery village',14]]],
      ['Hands-on',[['a','Zapotec weaving in Teotitlán',28],['p','Mole class with a local cook',45],['m','Hierve el Agua viewpoint',12],['e','Taco crawl on the avenue',12]]],
      ['Slow day',[['a','Late coffee & a book in the patio',6],['e','Sunset at Cerro del Fortín',0],['p','Botanical garden guided walk',9],['m','Quesillo & memelas lunch',8]]],
      ['Out of town',[['a','Mezcal distillery in Matatlán',24],['p','Artisan workshops in Arrazola',15],['m','Lunch under the giant Tule tree',10],['e','Casual dinner with a view',20]]],
      ['Open day',[['a','Sunrise yoga in the botanical garden',10],['e','Farewell dinner of seven moles',34],['p','Textile shopping with no plan',0],['m','Street-corn & fruit-water lunch',6]]],
      ['Last light',[['a','Final cup of Oaxacan chocolate',4],['p','Airport colectivo',8],['a','Last Zócalo loop',0],['a','Mezcal & chocolate gifts',25]]]
    ] },
  { id:'kyoto', name:'Kyoto', country:'Japan', scene:'kyoto', blurb:'Temple gardens and tea-house lanes',
    win:[5,40,60,90], energy:40, feel:[80,90,50,60,40,75,85,70], sound:[75,25,90,35], bag:[85,10,80,90,60,40,95,15],
    cost:{ stay:[34,150,340], food:[22,60,130], trans:[7,14,30] },
    months:[40,45,70,95,78,35,30,25,50,80,96,45],
    days:[
      ['Arrive & unwind',[['m','Check in to a machiya near Gion',0],['e','Pontocho alley dinner',32],['p','Walk the edge of the Philosopher’s Path',0],['a','Haruka express from Kansai Airport',22]]],
      ['Slow start',[['a','Early Fushimi Inari gates',0],['p','Tea ceremony in Gion',28],['m','Kyoto-style udon lunch',9],['e','Evening stroll down Hanamikoji',0]]],
      ['Green & quiet',[['a','Arashiyama bamboo grove at dawn',0],['e','Riverside izakaya',28],['p','Tenryu-ji garden & moss walk',7],['m','Tofu lunch by the river',18]]],
      ['Temple day',[['a','Kinkaku-ji in morning light',4],['p','Nishiki Market tasting',20],['m','Ryoan-ji rock garden',5],['e','Quiet kaiseki-style dinner',55]]],
      ['Hands-on',[['a','Matcha-making workshop',30],['p','Indigo dyeing class',45],['m','Obanzai lunch',16],['e','Sento public bath',5]]],
      ['Nara day trip',[['a','Train to Nara',6],['e','Ramen back at Kyoto Station',10],['m','Deer park & Todai-ji',7],['p','Kasuga Taisha lantern path',0]]],
      ['Open day',[['a','Slow breakfast at a kissaten',8],['e','Sunset on the Kamo river bank',0],['p','Bookshops & ceramic studios',0],['m','Soba lunch',12]]],
      ['Last light',[['a','Final matcha at a tea house',6],['p','Airport transfer',22],['a','Last look at the river',0],['a','Tea & sweets to bring home',25]]]
    ] },
  { id:'reykjavik', name:'Reykjavik', country:'Iceland', scene:'reykjavik', blurb:'Hot pools, harbour light and long skies',
    win:[55,95,35,60], energy:58, feel:[60,80,85,50,75,75,70,85], sound:[55,35,60,85], bag:[60,40,55,90,95,60,45,30],
    cost:{ stay:[60,190,380], food:[32,75,140], trans:[8,16,40] },
    months:[40,45,50,55,70,92,95,90,65,45,30,42],
    days:[
      ['Arrive & unwind',[['m','Flybus & check in downtown',30],['e','Hot dog at Bæjarins Beztu',5],['p','Harbour walk',0],['a','Coffee on Laugavegur',6]]],
      ['Slow start',[['a','Laugardalslaug hot pools',8],['e','Hallgrímskirkja tower view',10],['p','Sun Voyager sculpture walk',0],['m','Fish-soup lunch at the harbour',22]]],
      ['Golden Circle',[['a','Þingvellir & Geysir day tour',85],['e','Dinner at a farm restaurant',48],['m','Gullfoss waterfall',0],['p','Secret Lagoon soak',32]]],
      ['Blue & black',[['a','Blue Lagoon soak',75],['e','Seafood supper in the old harbour',46],['p','Reykjanes lava-field drive',20],['m','Lagoon-side lunch',28]]],
      ['Whales & waves',[['a','Whale-watching from the Old Harbour',80],['e','Craft-beer flight',20],['m','Sea-view lunch',24],['p','Viðey Island ferry & walk',12]]],
      ['Slow city',[['a','Late breakfast & a book',14],['e','Sunset geothermal soak',32],['p','National Museum',15],['m','Bakery snack',8]]],
      ['Open day',[['a','Sunrise coast walk',0],['e','Aurora chase, season permitting',70],['p','Perlan observation deck',27],['m','Bakery lunch',12]]],
      ['Last light',[['a','Final skyr breakfast',9],['p','Airport Flybus',30],['a','Last harbour stroll',0],['a','Wool shop, one last browse',35]]]
    ] }
];

/* ----- Crowd reports (filled by the backend; empty until travelers share) ----- */
const CROWD = {};

/* ----- State ----- */
/* what an unanswered round falls back to (the game page can be left half-finished) */
const ANSWER_DEFAULTS = { window:'sea', energy:35, bag:['journal','swim','paperback'], sound:'lofi', feel:'rested' };
const S = {
  stage:'intro', reached:-1, cardSeen:false,
  ...ANSWER_DEFAULTS, bag:ANSWER_DEFAULTS.bag.slice(),
  budget:1800, style:'comfy', month:2, nights:7,
  dest:null, plan:null, adder:null
};
const ORDER = ['intro','game','card','budget','matches','planner'];

/* ----- Helpers ----- */
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const styleIdx = () => STYLE.findIndex(s => s.id === S.style);
const destById = id => DEST.find(d => d.id === id);

function energyLevel(e = S.energy){
  return e < 45 ? { key:'low',  per:2, pace:'Slow',   adj:'slow',   trait:'Unhurried',  label:'Low' }
       : e < 70 ? { key:'mid',  per:3, pace:'Steady', adj:'easy',   trait:'Easygoing',  label:'Steady' }
       :          { key:'high', per:4, pace:'Bright', adj:'lively', trait:'Full of go', label:'High' };
}
const energyWord = e => e < 15 ? 'Drained' : e < 45 ? 'Running low' : e < 70 ? 'Steady' : e < 90 ? 'Charged up' : 'Buzzing';

function archetype(){
  const w = WIN.find(x => x.id === S.window), f = FEEL.find(x => x.id === S.feel), lvl = energyLevel();
  return { w, f, lvl, mood:w.mood, name:`${lvl.pace}-${w.noun} ${f.role}`,
           traits:[f.label, w.trait, lvl.trait], headline:`A ${lvl.adj}, ${w.word} kind of trip.` };
}

/* ----- Day slots: a stop's clock time comes from its position in the day ----- */
const PARTS = ['a','m','p','e'];
const PART_WORD = { a:'morning', m:'midday', p:'afternoon', e:'evening' };
const SLOTS = { 1:[11], 2:[10,16], 3:[9,13,18], 4:[8.5,12.5,16,19.5], 5:[8,11,14,17,20] };
function slotHour(i, n){ return n <= 5 ? SLOTS[n][i] : Math.min(8 + i * 1.75, 21); }
function slotPart(h){ return h < 11 ? 'a' : h < 15 ? 'm' : h < 18 ? 'p' : 'e'; }
function fmtHour(h){
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60), ap = hh >= 12 ? 'pm' : 'am', h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2,'0')} ${ap}`;
}
const partGap = (a, b) => Math.abs(PARTS.indexOf(a) - PARTS.indexOf(b));

/* ----- Plans ----- */
function tplIndex(k, n){ return k === 0 ? 0 : k === n - 1 ? 7 : 1 + ((k - 1) % 6); }
function stopOf(d, t, i){ const s = d.days[t][1][i]; return { id:`${d.id}:${t}:${i}`, part:s[0], title:s[1], cost:s[2] }; }
function genPlan(d, n, per){
  const days = [];
  for (let k = 0; k < n; k++){
    const t = tplIndex(k, n), [title, stops] = d.days[t];
    const picks = stops.map((_, i) => stopOf(d, t, i)).slice(0, per);
    picks.sort((a, b) => PARTS.indexOf(a.part) - PARTS.indexOf(b.part));
    days.push({ title, stops:picks });
  }
  return { days };
}
function catalog(d){
  const out = [];
  d.days.forEach(([title, stops], t) => stops.forEach((_, i) => out.push({ ...stopOf(d, t, i), from:title })));
  return out;
}
const scaleCost = c => c === 0 ? 0 : Math.max(1, Math.round(c * STYLE[styleIdx()].mult));
const stopCost = s => s.custom ? s.cost : scaleCost(s.cost);
function planCost(d, plan){
  const n = plan.days.length, si = styleIdx();
  const stays = n * d.cost.stay[si], food = n * d.cost.food[si], trans = n * d.cost.trans[si];
  const stops = plan.days.reduce((t, day) => t + day.stops.reduce((u, s) => u + stopCost(s), 0), 0);
  return { stays, food, stops, trans, total:stays + food + stops + trans };
}

/* ----- Scoring: 50% feeling, 25% month, 25% budget ----- */
function feelScore(d){
  const wi = WIN.findIndex(x => x.id === S.window), fi = FEEL.findIndex(x => x.id === S.feel), so = SOUND.findIndex(x => x.id === S.sound);
  const bagVals = S.bag.map(b => d.bag[BAG.findIndex(x => x.id === b)]);
  const bag = bagVals.length ? bagVals.reduce((a, b) => a + b, 0) / bagVals.length : 50;
  const en = Math.max(0, 100 - Math.abs(S.energy - d.energy) * 1.3);
  const raw = .4 * d.win[wi] + .25 * en + .2 * d.feel[fi] + .1 * d.sound[so] + .05 * bag;
  return Math.round(40 + .6 * raw);
}
/* Traveler reports blend in: the more people report, the more weight (never above 50%). */
function crowdFor(d){
  const c = CROWD[d.id];
  if (!c || !c.n) return null;
  const share = (c.byFeel[S.feel] || 0) / c.total;                 // strength-weighted share naming my feeling
  const score = Math.round(40 + 60 * Math.min(1, share / .6));
  const w = .5 * c.n / (c.n + 6);
  const top = Object.entries(c.count).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { n:c.n, score, w, top };
}
function budgetScore(total){
  const r = total / S.budget;
  return Math.round(r <= 1 ? 100 - 55 * Math.max(0, r - .6) : Math.max(0, 78 - (r - 1) * 190));
}
function rank(){
  const per = energyLevel().per;
  return DEST.map(d => {
    const plan = genPlan(d, S.nights, per), cost = planCost(d, plan);
    const base = feelScore(d), crowd = crowdFor(d), feel = crowd ? Math.round(base * (1 - crowd.w) + crowd.score * crowd.w) : base;
    const month = d.months[S.month], budget = budgetScore(cost.total);
    return { d, plan, cost, feel, base, crowd, month, budget, match:Math.round(.5 * feel + .25 * month + .25 * budget) };
  }).sort((a, b) => b.match - a.match);
}
/* average daily spend across the five places for a style, at the current trip length */
function avgDaily(styleId){
  const keep = S.style; S.style = styleId;
  const per = energyLevel().per;
  const t = DEST.reduce((sum, d) => sum + planCost(d, genPlan(d, S.nights, per)).total / S.nights, 0) / DEST.length;
  S.style = keep; return t;
}

/* ----- Months ----- */
const mlevel = v => v >= 75 ? 2 : v >= 45 ? 1 : 0;       // 2 best, 1 good, 0 off
function bestRange(d){
  const idx = d.months.map((v, i) => mlevel(v) === 2 ? i : -1).filter(i => i >= 0);
  if (!idx.length) return null;
  const runs = []; let a = idx[0], b = idx[0];
  for (const i of idx.slice(1)){ if (i === b + 1) b = i; else { runs.push([a, b]); a = b = i; } }
  runs.push([a, b]);
  return runs.map(([x, y]) => x === y ? MONTHS[x] : `${MONTHS[x]}–${MONTHS[y]}`).join(', ');
}
