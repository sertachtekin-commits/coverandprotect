/* Characterization tests: capture how the flows behave TODAY, so a refactor of
   conversation state can be proved not to change anything a visitor would see. */
import fs from 'fs';
// The shipped file itself, no longer carved out of the include with a regex.
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
const probe = `;globalThis.__E={startFlow,advance,cancelFlow,startOver,get session(){return session;},
  rememberTravelFacts,estimateFor,recommendFor,FLOWS,setFact,said,
  get PROFILE(){return PROFILE;},forgetFacts,pricing:pricingNode};`;
new Function(sandbox + js.replace(/\}\)\(\);?\s*$/, probe + '})();'))();
const E = globalThis.__E;

let fail = 0;
const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fail++; };

/* Drive a flow, recording which questions it actually asks. `answers` is keyed
   by the question's profile field, which is what a step now names. */
function drive(flowKey, answers, keep) {
  if (!keep) E.forgetFacts();
  E.startFlow(flowKey);
  const asked = [];
  let guard = 0;
  while (E.session.flow && E.session.step < E.session.flow.steps.length && guard++ < 40) {
    const st = E.session.flow.steps[E.session.step];
    if (!st.f) break;
    asked.push(st.f);
    if (!(st.f in answers)) break;
    E.advance(answers[st.f]);
  }
  return { asked, data: Object.assign({}, E.PROFILE) };
}

console.log("--- every flow asks its questions in a fixed order ---");
const cases = {
  travel:    {travellers:"1", ages:"53", destination:"Florida", dates:"Nov 15 to Dec 10", plan:"Single"},
  supervisa: {whom:"Parent", travellers:"1", ages:"68", arrival:"Mar 2027", term:"1 year", coverage:"$100,000", preExisting:"No"},
  visitor:   {travellers:"1", ages:"44", arrival:"Jan 2027", duration:"3 months", coverage:"$100,000", preExisting:"No"},
  annual:    {travellers:"1", ages:"53", longestTrip:"21", usa:"Yes", preExisting:"No"},
  topup:     {baseEnd:"Dec 1", days:"20", age:"60", destination:"Mexico", usa:"No", preExisting:"No"},
  life:      {lifeGoal:"Family", policyType:"Term", coverage:"$500,000", age:"45", smoker:"No"},
  health:    {who:"Just me", currentPlan:"No", needs:"Dental"},
  group:     {company:"Acme", employees:"5", currentPlan:"No", priorities:"Health"},
};
const baseline = {};
for (const [flow, answers] of Object.entries(cases)) {
  const r = drive(flow, answers);
  baseline[flow] = r;
  ok(r.asked.length > 0, flow + ": asks [" + r.asked.join(" → ") + "]");
  const dupes = r.asked.filter((k, i) => r.asked.indexOf(k) !== i);
  ok(dupes.length === 0, flow + ": asks nothing twice" + (dupes.length ? " (repeated: " + dupes + ")" : ""));
}

console.log("\n--- answers already known are never asked for ---");
let r = drive("travel", {travellers:"1", ages:"53", destination:"Florida", dates:"Dec 18 departure 2 weeks", plan:"Single"});
ok(!r.asked.includes("days"), "trip length not asked when the dates answer states it");
ok(r.data.days === "14", "…and it was derived (" + r.data.days + ")");

console.log("\n--- pricing inputs derived from a completed flow ---");
drive("travel", cases.travel);
let n = E.pricing();
ok(n.age === 53 && n.days === 26, "travel: age 53, 26 days");
ok(n.usa === "yes", "travel: Florida priced as USA");
const est = E.estimateFor(n);
ok(est && est.r.low > 0, "travel: estimate " + (est ? "$" + est.r.low + "-$" + est.r.high : "none"));
const rec = E.recommendFor(n);
ok(!!rec.title, "travel: recommends " + rec.title);

drive("supervisa", cases.supervisa);
n = E.pricing();
ok(n.age === 68 && n.days === 365, "supervisa: age 68, 365 days");
const svEst = E.estimateFor(n);
ok(svEst && svEst.r.low > 0, "supervisa: estimate $" + (svEst ? svEst.r.low + "-$" + svEst.r.high : "none"));

drive("visitor", cases.visitor);
n = E.pricing();
ok(n.age === 44 && n.days === 90, "visitor: age 44, 90 days from '3 months'");

console.log("\n--- facts stated in passing reach the flow ---");
E.forgetFacts();
E.rememberTravelFacts("I am 61 and going to Arizona, just me");
r = drive("travel", {dates:"Nov 1 to Nov 20", plan:"Single"}, true);
ok(!r.asked.includes("ages"), "age stated in chat is not asked again");
ok(!r.asked.includes("destination"), "destination stated in chat is not asked again");
ok(!r.asked.includes("travellers"), "'just me' answers the traveller count");
ok(r.data.ages === "61" && r.data.destination === "Arizona", "…and both landed: age " + r.data.ages + ", " + r.data.destination);

E.forgetFacts();
E.rememberTravelFacts("I'm 61 going to Arizona for 3 weeks, just me");
r = drive("travel", {dates:"Nov 1 to Nov 21"}, true);
ok(!r.asked.includes("days"), "a trip length mentioned in chat is not asked for again");
ok(r.data.days === "21", "…it was read as 21 days");
E.forgetFacts();
E.rememberTravelFacts("61");
ok(E.PROFILE.days === undefined, "a message that is only a number is not mistaken for a trip length");
E.forgetFacts();
E.rememberTravelFacts("i am 68 and my mother needs super visa cover");
ok(E.PROFILE.days === undefined, "nor is an age in a sentence");

console.log("\n--- cancel keeps what you said; starting over does not ---");
E.forgetFacts();
E.setFact("ages", "61");
E.cancelFlow();
ok(E.PROFILE.ages === "61", "cancel stops the questions without forgetting the answers");
E.startOver();
ok(E.PROFILE.ages === undefined, "'start over' clears them, because it is a different quote");

console.log("\n--- a finished travel quote can actually be sent ---");
E.forgetFacts();
E.startFlow("travel");
for (const v of ["1","53","Florida","Nov 15 to Dec 10","Single"]) E.advance(v);
const steps = E.session.flow ? E.session.flow.steps : [];
const recIdx = steps.findIndex(st => st.t === "recommend");
ok(recIdx > -1 && E.session.step === recIdx, "it stops on the recommendation card");
E.session.step++;                                   // what the "Send my details" chip does
const after = steps[E.session.step];
ok(after && after.t === "contact", "and the next step is the contact form, not the card again");

console.log("\nBASELINE " + JSON.stringify(Object.fromEntries(
  Object.entries(baseline).map(([k, v]) => [k, v.asked.join(">")]))));
console.log(fail ? "\n" + fail + " FAILED" : "\nall characterization tests passed");
process.exit(fail ? 1 : 0);
