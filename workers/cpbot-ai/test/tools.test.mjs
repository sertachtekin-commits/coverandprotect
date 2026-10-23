import fs from 'fs';
// The shipped file itself, no longer carved out of the include with a regex.
const js = fs.readFileSync(new URL('../../../cpbot.js', import.meta.url), 'utf8');

// Minimal stubs so the IIFE can define itself without a DOM.
const sandbox = `
  var __node=()=>({style:{},value:'',textContent:'',dataset:{},
    setAttribute(){},appendChild(){},removeChild(){},remove(){},focus(){},addEventListener(){},
    classList:{add(){},remove(){},contains:()=>false},
    set onclick(v){}, get onclick(){return null;},
    scrollTop:0,scrollHeight:0,insertAdjacentHTML(){}});
  var document={createElement:__node,createTextNode:__node,addEventListener(){},
    body:__node(),documentElement:__node(),
    querySelector:__node,querySelectorAll:()=>[],getElementById:__node};
  var window={addEventListener(){},location:{pathname:'/',search:''}};
  var localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  var location=window.location;
  var navigator={userAgent:''};
  var fetch=async()=>({ok:true,json:async()=>({})});
  var __lastForm=null;
  var FormData=function(){this.d={};__lastForm=this;this.append=function(k,v){this.d[k]=v;};};
`;
// Export the internals we want to exercise.
const probe = `
  ;globalThis.__T = {AI_TOOLS, get PROFILE(){return PROFILE;}, get SAID(){return SAID;},
    setFact, getFact, said, forgetFacts, pricingNode, usaFlag, normPre,
    startFlow, advance, get session(){return session;},
    aiAdvisorRequired, aiMissing, estimateFor, recommendFor, estSupervisa, estVisitor, needsAdvisor,
    parseDays, missingForEstimate, isUSA, aiFormat,
    logLine, transcript, SRC, srcLink, get CPLOG(){return CPLOG;},
    lastLead:function(){return __lastForm&&__lastForm.d;}};
`;
const patched = js.replace(/\}\)\(\);?\s*$/, probe + '})();');
new Function(sandbox + patched)();
const T = globalThis.__T;

let fail=0; const ok=(c,m)=>{console.log((c?"  PASS  ":"  FAIL  ")+m); if(!c)fail++;};
/* The AI's field names go in through save_profile, exactly as the model sends
   them, so these tests exercise the real mapping rather than poking the store. */
const reset=(o)=>{ T.forgetFacts(); if(o&&Object.keys(o).length) T.AI_TOOLS.save_profile(o); };

console.log("--- the agent can actually quote ---");
reset({}); 
let r = T.AI_TOOLS.save_profile({product:"supervisa", age:68, pre_existing:"none"});
ok(r.saved===true, "save_profile records what the visitor said");
ok(r.still_needed.length===0, "Super Visa needs no 'days' (defaults to 365): "+JSON.stringify(r.still_needed));
r = T.AI_TOOLS.estimate_premium();
ok(r.illustrative_estimate===true, "estimate_premium returns a real band");
ok(r.low>0 && r.high>r.low, "band is sane: "+r.say_exactly);
ok(/not a quote/i.test(r.disclaimer), "band carries the not-a-quote disclaimer");

console.log("\n--- memory: never re-ask ---");
r = T.AI_TOOLS.save_profile({destination:"India"});
ok(T.PROFILE.age==="68" && T.PROFILE.product==="supervisa", "earlier fields survive a later partial save");

console.log("\n--- the number comes with its reasons ---");
reset({product:"travel", age:61, days:21, destination:"Arizona", pre_existing:"stable"});
let pd = T.AI_TOOLS.estimate_premium();
ok(/illustrative range only, not a quote/i.test(pd.disclaimer), "the not-a-quote wording travels with the number");
ok(Array.isArray(pd.price_drivers) && pd.price_drivers.length > 0, "price_drivers explains the band: " + JSON.stringify(pd.price_drivers));
ok(/USA/.test(pd.price_drivers[0]), "the USA loading is named first, because it is the biggest single driver");
ok(pd.price_drivers.some(d => /stable pre-existing/.test(d)), "the stable-condition loading is named too");
reset({product:"travel", age:61, days:21, destination:"Portugal", pre_existing:"none"});
pd = T.AI_TOOLS.estimate_premium();
ok(!pd.price_drivers.some(d => /USA/.test(d)), "a non-US trip is not told it is paying for the USA");
ok(!pd.price_drivers.some(d => /pre-existing/.test(d)), "nor is someone with no conditions");


console.log("\n--- SAFETY: recent medical change must never reach a buy link ---");
reset({product:"visitor", age:70, days:180, pre_existing:"recent_change"});
ok(T.aiAdvisorRequired()===true, "recent_change flags advisor_required");
r = T.AI_TOOLS.estimate_premium();
ok(r.advisor_required===true && r.no_price===true, "no price is produced");
ok(r.low===undefined, "no number leaks in the payload");
r = T.AI_TOOLS.recommend_path();
ok(r.advisor_required===true && r.no_link===true && r.url===undefined, "no buy URL is produced");

reset({product:"visitor", age:70, days:180, pre_existing:"not_sure"});
ok(T.AI_TOOLS.estimate_premium().no_price===true, "'not sure' is treated the same way");

console.log("\n--- regression: 'stable' still prices, and is NOT confused with 'recent' ---");
reset({product:"visitor", age:70, days:180, pre_existing:"stable"});
const stable = T.AI_TOOLS.estimate_premium();
ok(stable.illustrative_estimate===true, "stable conditions still get an estimate");
reset({product:"visitor", age:70, days:180, pre_existing:"none"});
const none = T.AI_TOOLS.estimate_premium();
ok(stable.low > none.low, "stable is loaded above none ("+stable.low+" vs "+none.low+"), i.e. cond actually applied");

console.log("\n--- incomplete profile asks rather than inventing ---");
reset({product:"travel"});
r = T.AI_TOOLS.estimate_premium();
ok(r.error==="missing_fields" && r.still_needed.includes("age"), "missing age -> asks, no number: "+JSON.stringify(r.still_needed));

console.log("\n--- routing ---");
reset({product:"supervisa", age:65, pre_existing:"none", wants_monthly:true});
r = T.AI_TOOLS.recommend_path();
ok(/TruStone/i.test(r.title), "monthly payment routes to TruStone: "+r.title);
reset({product:"travel", age:45, days:14, destination:"Florida", pre_existing:"none"});
r = T.AI_TOOLS.recommend_path();
ok(!!r.url, "travel abroad gets a buy path: "+r.title);
ok(T.pricingNode().usa==="yes", "Florida is detected as USA coverage");

console.log("\n--- the lead carries its product in the subject line ---");
/* The Gmail sorter reads the product out of the subject. "Chat sales agent"
   alone told it nothing, so every agent lead landed in "Needs review". */
const subjectFor = (p) => { reset({product:p, age:61, days:21});
  const fd = T.AI_TOOLS.create_lead({name:"Ayse", contact:"a@b.ca"}) && T.lastLead(); return fd._subject; };
ok(/Super Visa/.test(subjectFor("supervisa")), "supervisa -> " + subjectFor("supervisa"));
ok(/Visitor to Canada/.test(subjectFor("visitor")), "visitor -> " + subjectFor("visitor"));
ok(/Travel insurance/.test(subjectFor("travel")), "travel -> " + subjectFor("travel"));
ok(/Annual multi-trip/.test(subjectFor("annual")), "annual -> " + subjectFor("annual"));
ok(/Top-up travel insurance/.test(subjectFor("topup")), "topup -> " + subjectFor("topup"));
reset({age:61, days:21});
ok(/General enquiry/.test(subjectFor(undefined)), "unknown product says so rather than guessing");
reset({product:"travel", age:61, days:21});
T.AI_TOOLS.create_lead({name:"Ayse", contact:"a@b.ca", note:"call after 6pm"});
ok(T.lastLead().notes === "call after 6pm",
   "the visitor's note is sent as 'notes', the field the sorter actually reads");

console.log("\n--- create_lead requires real contact details ---");
reset({product:"supervisa", age:68});
ok(T.AI_TOOLS.create_lead({}).error==="missing_contact", "refuses without name/contact");
ok(T.AI_TOOLS.create_lead({name:"Ayse", contact:"a@b.ca"}).sent===true, "sends when both are given");

console.log("\n--- scripted flow gate (the pre-existing path that used to reach checkout) ---");
ok(T.needsAdvisor("Yes, recent changes")===true, "'Yes, recent changes' now needs an advisor");
ok(T.needsAdvisor("Not sure")===true, "'Not sure' now needs an advisor");
ok(T.needsAdvisor("Yes, stable")===false, "'Yes, stable' still goes straight through");
ok(T.needsAdvisor("No")===false, "'No' still goes straight through");

console.log("\n--- trip length: the input that silently killed the quote ---");
const D = T.parseDays;
ok(isNaN(D("nov 15")), "'nov 15' alone is still not a length (it is one date)");
ok(D("nov 15 to dec 10")===26, "'nov 15 to dec 10' -> 26 days (got "+D("nov 15 to dec 10")+")");
ok(D("Nov 15 - Dec 10")===26, "'Nov 15 - Dec 10' -> 26");
ok(D("15 Nov to 10 Dec")===26, "'15 Nov to 10 Dec' -> 26");
ok(D("Jul 1-15")===15, "'Jul 1-15' -> 15 (same-month range still works)");
ok(D("dec 20 to jan 5")===17, "year rollover 'dec 20 to jan 5' -> 17 (got "+D("dec 20 to jan 5")+")");
ok(D("2 weeks")===14, "'2 weeks' -> 14");
ok(D("3 months")===90, "'3 months' -> 90");
ok(D("14 days")===14, "'14 days' -> 14");
ok(D("14")===14, "a bare '14' -> 14 (the new trip-length question)");
ok(isNaN(D("next winter")), "unparseable stays unparseable rather than guessing");

console.log("\n--- the exact conversation from the screenshots now prices ---");
const facts=(o)=>{ T.forgetFacts(); for(const k of Object.keys(o)) T.setFact(k,o[k]); return T.pricingNode(); };
let ctx = facts({product:"travel", ages:"53", destination:"florida", dates:"nov 15", plan:"Single"});
ok(isNaN(ctx.days), "before: 'nov 15' gave no trip length, so no price");
ok(T.estimateFor(ctx)===null, "…and estimateFor returned null — the silent failure");
ok(T.missingForEstimate(ctx).join()==="how many days the trip is", "…now it says what is missing: "+T.missingForEstimate(ctx).join());
ctx = facts({product:"travel", ages:"53", destination:"florida", dates:"nov 15", days:"14", plan:"Single"});
ok(ctx.days===14, "after: the trip-length answer supplies the days");
const e = T.estimateFor(ctx);
ok(e && e.r.low>0, "after: a real estimate comes back — "+(e?("$"+e.r.low+" - $"+e.r.high):"none"));
ok(ctx.usa==="yes", "Florida is priced as USA coverage (was understated ~20% before)");
ok(/trip/.test(e.label) && !/top-up/.test(e.label), "a single trip is not labelled a top-up: "+e.label);
ok(T.isUSA("florida")==="yes" && T.isUSA("Orlando")==="yes" && T.isUSA("Arizona")==="yes", "US destinations detected by name");
ok(T.isUSA("Mexico")==="no" && T.isUSA("Portugal")==="no", "non-US destinations are not loaded");
ctx = facts({product:"travel", ages:"53", destination:"florida", dates:"nov 15 to dec 10", plan:"Single"});
ok(ctx.days===26, "dates alone still work when they are a real range");
ctx = facts({product:"travel", ages:"53", destination:"Mexico", days:"14", usa:"yes"});
ok(ctx.usa==="yes", "an explicit USA answer wins over the guess from the destination");

console.log("\n--- ONE STORE: there is nothing to copy into the guided flow ---");
reset({product:"travel", age:53, days:14, destination:"florida", travel_dates:"nov 15", pre_existing:"none", travellers:1});
/* The guided flow asks a step only when its field is unknown, so "what would
   the travel flow still ask?" is exactly the set of its fields the agent's save
   did not reach. (The step sequence itself is driven for real in flow.test.mjs
   and characterize.test.mjs, which stub timers; this file has none.) */
const wouldAsk = [];
T.startFlow("travel");
for (const st of T.session.flow.steps) { if (st.f && !T.getFact(st.f)) wouldAsk.push(st.f); }
ok(!wouldAsk.includes("ages") && !wouldAsk.includes("age"), "the flow would not ask the age the agent already saved");
ok(!wouldAsk.includes("days") && !wouldAsk.includes("dates"), "nor the dates or the trip length");
ok(!wouldAsk.includes("travellers"), "nor the traveller count");
ok(wouldAsk.join()==="plan", "the only thing left to ask is the one thing not yet known: "+(wouldAsk.join()||"nothing"));
const seeded = T.pricingNode();
ok(seeded.days===14 && seeded.age===53, "and it can price straight away");
ok(T.estimateFor(seeded)!==null, "…producing an estimate without re-asking anything");

console.log("\n--- the visitor's own wording survives for the lead email ---");
reset({product:"supervisa", age:68});
T.setFact("preExisting","Yes, recent changes");
ok(T.PROFILE.preExisting==="recent_change", "the answer is stored in one canonical form for the safety gate");
ok(T.said("preExisting")==="Yes, recent changes", "…and in the visitor's words for the email");
ok(T.aiAdvisorRequired()===true, "…and the gate fires on it");
ok(T.normPre("Not sure")==="not_sure" && T.needsAdvisor(T.normPre("Not sure"))===true,
   "'Not sure' normalises to not_sure and still fires the gate");
ok(T.normPre("Yes, stable")==="stable" && T.needsAdvisor(T.normPre("Yes, stable"))===false,
   "'Yes, stable' normalises to stable and does not");

console.log("\n--- a repeated answer is usable, not an error ---");
ok(T.parseDays("i told already starting nov 15 2 weeks")===14, "the exact sentence from the screenshot -> 14 days");
ok(T.parseDays("starting nov 15 for 2 weeks")===14, "'starting nov 15 for 2 weeks' -> 14");

console.log("\n--- AI replies render as text, not raw markdown ---");
const F = T.aiFormat;
ok(F("check it [here](buy-online.html?pickup=1)").includes('<a href="buy-online.html?pickup=1">here</a>'),
   "the exact link from the screenshot becomes a real link");
ok(!F("check it [here](buy-online.html?pickup=1)").includes("[here]"), "no raw markdown left on screen");
ok(F("**$55 - $125**").includes("<b>$55 - $125</b>"), "bold renders");
ok(F("a\nb").includes("<br>"), "newlines still break lines");

console.log("\n--- a reply can never link somewhere we did not intend ---");
ok(F("go [here](https://evil.example/pay)")==="go here", "foreign link is stripped to plain text");
ok(!F("go [here](javascript:alert(1))").includes("<a"), "javascript: URL produces no link");
ok(!F("go [x](data:text/html,y)").includes("<a"), "data: URL produces no link");
ok(!F("[a](//evil.example/x)").includes("<a"), "protocol-relative //host is rejected — it resolves off-site");
ok(!F("[a](https://coverandprotect.ca.evil.example/x)").includes("<a"), "a lookalike domain is rejected");
ok(F("[x](https://coverandprotect.ca/buy-online.html)").includes("<a href="), "our own https pages are allowed");
ok(F("[x](/instant-quote.html)").includes("<a href="), "root-relative pages are allowed");
ok(!F("<img src=x onerror=alert(1)>").includes("<img"), "raw HTML in a reply is still escaped");

console.log("\n--- (1) the conversation is recorded for the lead email ---");
T.CPLOG.length = 0;
T.logLine("Visitor", "my mother is 68");
T.logLine("Assistant", "<b>Great</b> \u2014 what are the dates?");
let tr = T.transcript();
ok(tr.includes("Visitor: my mother is 68"), "what the visitor said is captured");
ok(tr.includes("Assistant: Great"), "what the assistant said is captured");
ok(!tr.includes("<b>"), "markup is stripped so the email is readable");
T.CPLOG.length = 0;
ok(T.transcript() === "", "an empty conversation adds nothing to the lead");
for (let i = 0; i < 200; i++) T.logLine("Visitor", "line " + i);
ok(T.CPLOG.length <= 80, "the log is capped (" + T.CPLOG.length + ") so a long chat cannot bloat the email");
ok(T.transcript().length <= 6000, "and the attached text is capped at 6000 chars");
T.CPLOG.length = 0;
T.logLine("Visitor", "x".repeat(900));
ok(T.CPLOG[0].length <= 420, "a single huge paste is truncated");

console.log("\n--- (3) answers cite the page they came from ---");
ok(T.srcLink("preexisting").includes("blog-travel-insurance-pre-existing-conditions.html"),
   "pre-existing answer cites the stability-period guide");
ok(T.srcLink("monthly").includes("super-visa-monthly-payment.html"), "monthly answer cites the monthly page");
ok(T.srcLink("quote") === "", "topics with no natural source cite nothing rather than guessing");
ok(T.srcLink("preexisting").startsWith("<div"), "the citation renders as markup, not raw text");
ok(Object.keys(T.SRC).length >= 30, "most topics have a source (" + Object.keys(T.SRC).length + ")");

console.log(fail? "\n"+fail+" FAILED" : "\nall tool tests passed");
process.exit(fail?1:0);
