/* Drives the REAL flow engine out of _includes/cpbot.html with synchronous
   timers, so the step sequence under test is the shipped one, not a copy. */
import fs from 'fs';
// The shipped file itself, no longer carved out of the include with a regex.
const js = fs.readFileSync(new URL('../../../cpbot.js', import.meta.url), 'utf8');

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
const probe = `;globalThis.__E={startFlow,advance,forgetFacts,get session(){return session;},
  get PROFILE(){return PROFILE;},get asked(){return globalThis.__asked;},parseDays};`;
new Function('__asked', sandbox + js.replace(/\}\)\(\);?\s*$/, probe + '})();'))(asked);
const E = globalThis.__E;

let fail = 0;
const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fail++; };

console.log("--- the exact conversation from the screenshot ---");
E.forgetFacts();
E.startFlow("travel");
E.advance("1");                              // How many travellers?
E.advance("53");                             // Traveller age(s)?
E.advance("Dominic republic");               // Destination?
const stepBefore = E.session.step;
E.advance("Dec 18 departure 2 weeks");       // Travel dates?

ok(E.PROFILE.dates === "Dec 18 departure 2 weeks", "the dates answer is stored");
ok(E.PROFILE.days === "14", "…and the trip length is derived from it (got " + E.PROFILE.days + ")");

const stepKey = E.session.flow.steps[E.session.step] && E.session.flow.steps[E.session.step].f;
ok(stepKey !== "days", "the flow does NOT ask the trip length again (next step: " + stepKey + ")");
ok(E.session.step > stepBefore + 1, "it skipped past the trip-length question entirely");

console.log("\n--- a bare date with no length still asks ---");
E.forgetFacts();
E.startFlow("travel");
E.advance("1"); E.advance("53"); E.advance("Florida");
E.advance("Nov 15");
ok(!E.PROFILE.days, "no length could be derived, so none was invented");
ok(E.session.flow.steps[E.session.step].f === "days", "and the trip length is asked — correctly this time");

console.log("\n--- a real date range fills it too ---");
E.forgetFacts();
E.startFlow("travel");
E.advance("1"); E.advance("53"); E.advance("Florida");
E.advance("Nov 15 to Dec 10");
ok(E.PROFILE.days === "26", "'Nov 15 to Dec 10' -> 26 days, no second question");
ok(E.session.flow.steps[E.session.step].f !== "days", "trip-length step skipped");

console.log("\n--- the flow remembers across a restart, so nothing is asked twice ---");
E.startFlow("travel");
ok(E.session.flow.steps[E.session.step].f !== "travellers",
   "re-entering the flow resumes rather than starting the questions over");

console.log(fail ? "\n" + fail + " FAILED" : "\nall flow tests passed");
process.exit(fail ? 1 : 0);
