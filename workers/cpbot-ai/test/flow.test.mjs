/* Drives the REAL flow engine out of _includes/cpbot.html with synchronous
   timers, so the step sequence under test is the shipped one, not a copy. */
import fs from 'fs';
const src = fs.readFileSync('../../../_includes/cpbot.html', 'utf8');
const js = src.match(/<script>([\s\S]*?)<\/script>/)[1];

const asked = [];
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
  var setTimeout=function(fn){fn();return 0;};   // make the engine synchronous
`;
const probe = `;globalThis.__E={startFlow,advance,get session(){return session;},
  get asked(){return globalThis.__asked;},parseDays};`;
new Function('__asked', sandbox + js.replace(/\}\)\(\);?\s*$/, probe + '})();'))(asked);
const E = globalThis.__E;

let fail = 0;
const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fail++; };

console.log("--- the exact conversation from the screenshot ---");
E.startFlow("travel");
E.advance("1");                              // How many travellers?
E.advance("53");                             // Traveller age(s)?
E.advance("Dominic republic");               // Destination?
const stepBefore = E.session.step;
E.advance("Dec 18 departure 2 weeks");       // Travel dates?

ok(E.session.data.dates === "Dec 18 departure 2 weeks", "the dates answer is stored");
ok(E.session.data.days === "14", "…and the trip length is derived from it (got " + E.session.data.days + ")");

const stepKey = E.session.flow.steps[E.session.step] && E.session.flow.steps[E.session.step].k;
ok(stepKey !== "days", "the flow does NOT ask the trip length again (next step: " + stepKey + ")");
ok(E.session.step > stepBefore + 1, "it skipped past the trip-length question entirely");

console.log("\n--- a bare date with no length still asks ---");
E.startFlow("travel");
E.advance("1"); E.advance("53"); E.advance("Florida");
E.advance("Nov 15");
ok(!E.session.data.days, "no length could be derived, so none was invented");
ok(E.session.flow.steps[E.session.step].k === "days", "and the trip length is asked — correctly this time");

console.log("\n--- a real date range fills it too ---");
E.startFlow("travel");
E.advance("1"); E.advance("53"); E.advance("Florida");
E.advance("Nov 15 to Dec 10");
ok(E.session.data.days === "26", "'Nov 15 to Dec 10' -> 26 days, no second question");
ok(E.session.flow.steps[E.session.step].k !== "days", "trip-length step skipped");

console.log(fail ? "\n" + fail + " FAILED" : "\nall flow tests passed");
process.exit(fail ? 1 : 0);
