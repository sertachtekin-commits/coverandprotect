import fs from 'fs';
const src = fs.readFileSync('../../../_includes/cpbot.html','utf8');
const js = src.match(/<script>([\s\S]*?)<\/script>/)[1];

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
  var FormData=function(){this.d={};this.append=function(k,v){this.d[k]=v;};};
`;
// Export the internals we want to exercise.
const probe = `
  ;globalThis.__T = {AI_TOOLS, get AIP(){return AIP;}, set AIP(v){AIP=v;},
    aiAdvisorRequired, aiMissing, aiNode, estimateFor, recommendFor, estSupervisa, estVisitor, needsAdvisor};
`;
const patched = js.replace(/\}\)\(\);?\s*$/, probe + '})();');
new Function(sandbox + patched)();
const T = globalThis.__T;

let fail=0; const ok=(c,m)=>{console.log((c?"  PASS  ":"  FAIL  ")+m); if(!c)fail++;};
const reset=(o)=>{ for(const k of Object.keys(T.AIP)) delete T.AIP[k]; Object.assign(T.AIP,o||{}); };

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
ok(T.AIP.age===68 && T.AIP.product==="supervisa", "earlier fields survive a later partial save");

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
ok(T.aiNode().usa==="yes", "Florida is detected as USA coverage");

console.log("\n--- create_lead requires real contact details ---");
reset({product:"supervisa", age:68});
ok(T.AI_TOOLS.create_lead({}).error==="missing_contact", "refuses without name/contact");
ok(T.AI_TOOLS.create_lead({name:"Ayse", contact:"a@b.ca"}).sent===true, "sends when both are given");

console.log("\n--- scripted flow gate (the pre-existing path that used to reach checkout) ---");
ok(T.needsAdvisor("Yes, recent changes")===true, "'Yes, recent changes' now needs an advisor");
ok(T.needsAdvisor("Not sure")===true, "'Not sure' now needs an advisor");
ok(T.needsAdvisor("Yes, stable")===false, "'Yes, stable' still goes straight through");
ok(T.needsAdvisor("No")===false, "'No' still goes straight through");

console.log(fail? "\n"+fail+" FAILED" : "\nall tool tests passed");
process.exit(fail?1:0);
