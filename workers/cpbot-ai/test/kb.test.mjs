/* The 36 written answers were reachable only by tapping a chip. Everything a
   visitor typed went to the model, which could not see them — so the curated,
   advisor-checked wording sat unused, its source citations never appeared, and
   when the Worker was unreachable the visitor got a canned line instead of the
   answer sitting in the same file. */
import fs from 'fs';

const js = fs.readFileSync(new URL('../../../cpbot.js', import.meta.url), 'utf8');
const sandbox = `
  var __n=()=>({style:{},value:'',textContent:'',dataset:{},setAttribute(){},appendChild(){},
    removeChild(){},remove(){},focus(){},addEventListener(){},
    classList:{add(){},remove(){},contains:()=>false},
    set onclick(v){},get onclick(){return null;},scrollTop:0,scrollHeight:0,insertAdjacentHTML(){}});
  var document={createElement:__n,createTextNode:__n,addEventListener(){},body:__n(),
    documentElement:__n(),querySelector:__n,querySelectorAll:()=>[],getElementById:__n};
  var window={addEventListener(){},location:{pathname:'/',search:''}};
  var localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  var location=window.location; var navigator={userAgent:''};
  var fetch=async()=>({ok:true,json:async()=>({})});
  var FormData=function(){this.append=function(){};};
  var setTimeout=function(fn){fn();return 0;};
`;
new Function(sandbox + js.replace(/\}\)\(\);?\s*$/,
  ';globalThis.__K={AI_TOOLS,kbSearch,KB,LBL,SRC,KB_MIN_SCORE};})();'))();
const K = globalThis.__K;

let fail = 0;
const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fail++; };

/* Questions people actually type, and things that must not be mistaken for them. */
const REAL = [
  'how much does super visa insurance cost','what is the stability period','can I pay monthly',
  'do I get a refund if the visa is refused','does OHIP cover my visitors','what is a top-up',
  'is there an age limit','what does it cover','how long does super visa insurance last',
  'my mother has diabetes, is she covered','what is the minimum income to sponsor',
  'what deductible should I choose','is trip cancellation included','i am a snowbird going to florida',
  'what happens if I need to make a claim','annual multi trip plan','do you cover visitors to canada',
  'how do I apply','are you licensed','is super visa insurance expensive',
];
const CHITCHAT = ['hello','hi there','thanks','ok','can you write me a poem','who won the hockey game'];

const answered = REAL.filter(q => K.kbSearch(q, 1).length);
ok(answered.length === REAL.length,
   `every real question finds a written answer (${answered.length}/${REAL.length})` +
   (answered.length === REAL.length ? '' : ' — missed: ' + REAL.filter(q => !K.kbSearch(q,1).length).join('; ')));

const chatty = CHITCHAT.filter(q => K.kbSearch(q, 1).length);
ok(chatty.length === 0,
   'a greeting is not answered with an insurance topic' + (chatty.length ? ` — matched: ${chatty.join('; ')}` : ''));

console.log("\n--- the model can read them ---");
const r = K.AI_TOOLS.lookup_kb({ question: 'what is the stability period' });
ok(r.found === true, 'lookup_kb finds the topic');
ok(/stable|stability/i.test(r.answers[0].answer), 'and returns the site\'s own wording');
ok(r.answers[0].source_page === '/travel-insurance-stability-period.html',
   `and the page to cite (${r.answers[0].source_page})`);
ok(r.use_this_wording === true, 'and tells the model to use it rather than its own');

const none = K.AI_TOOLS.lookup_kb({ question: 'who won the hockey game' });
ok(none.found === false, 'and says so plainly when nothing is written');
ok(/general knowledge/i.test(none.note || ''), '…with what to do instead');

console.log("\n--- a pricing question gets prices, not an overview ---");
/* rank() sums matched keyword lengths, so the supervisa topic's long
   "super visa insurance" beat cost's short "cost" on every pricing question
   that named the product — their single most-asked question returned a
   definition instead of a price. */
for (const q of ['how much does super visa insurance cost','what does super visa insurance cost',
                 'super visa insurance price','is super visa insurance expensive']) {
  ok(K.kbSearch(q, 1)[0] === 'cost', `"${q}" -> ${K.LBL[K.kbSearch(q,1)[0]] || 'nothing'}`);
}
ok(K.kbSearch('travel insurance for my trip', 1)[0] !== 'cost',
   'and a travel question is not hijacked by the Super Visa cost topic');

console.log("\n--- the safety topics are all reachable ---");
for (const [q, want] of [
  ['what is the stability period', 'stability'],
  ['my mother has diabetes', 'preexisting'],
  ['do I get a refund if refused', 'refund'],
]) {
  const got = K.kbSearch(q, 2);
  ok(got.includes(want), `"${q}" -> ${got.map(i => K.LBL[i] || i).join(', ') || 'nothing'}`);
}

console.log(fail ? `\n${fail} FAILED` : "\nall knowledge-base tests passed");
process.exit(fail ? 1 : 0);
