/* Cover & Protect — "One form, every company" quote list for buy-online.html.
   Built 2026-11-10. The visitor enters their trip once; the widget shows the
   site's illustrative estimate range plus one card per insurer with the plan
   that fits and a live link to that insurer's own quote/application tool.
   It never invents a per-insurer price: real premiums come from the insurers'
   own tools, exactly like the rest of this page.

   SYNC WARNING: the estimate bands below are copied verbatim from cpbot.js
   (rate assumptions v2026.07), which must match travel-insurance-calculator.html.
   If the bands ever change, change all copies in the same commit. */
(function(){
  "use strict";
  var root=document.getElementById("cp-allquotes");
  if(!root) return;

  /* ---- insurer links (same links already used on buy-online.html) ---- */
  var INSTANT_QUOTE="instant-quote.html";
  var TUGO="https://shop.tugo.com/store/TEK200";
  var TS_UID="U2FsdGVkX18Cl0TFH2itazVulngtkJd49eydsVoM/hICwLjc6mYjw2Xms/0l0AVih/yZGuojBB4LWGyOSGzyCQ==";
  function ts(plan){return "https://www.trustonehealth.ca/cgi-bin/underwrite/start.pl?xxx:BrokerID=2765&xxx:Plan="+plan+"&xxx:UserLang=english&xxx:AgentID=0&uid="+TS_UID;}
  var RIMI_VISITOR="https://rimi-forms.policy-dashboard.com/en/arkrimivisitorstocanada?&sales_channel=online&tracking_code=STE101";
  var RIMI_CANUCK="https://rimi-forms.policy-dashboard.com/en/rimicanuckvoyage?&sales_channel=online&tracking_code=STE101";
  var FORMSPREE="https://formspree.io/f/mdajwykn";

  /* ---- estimate bands: verbatim copy from cpbot.js (v2026.07) ---- */
  var SV_BANDS=[{max:54,low:1000,high:1500},{max:59,low:1200,high:2000},{max:64,low:1500,high:2800},{max:69,low:2000,high:3800},{max:74,low:2800,high:5000},{max:200,low:4000,high:6000}];
  var AB_BANDS=[{max:39,shortLow:2.1,shortHigh:5.0,longLow:1.5,longHigh:3.0},{max:54,shortLow:3.6,shortHigh:7.9,longLow:2.3,longHigh:5.0},{max:64,shortLow:5.7,shortHigh:12.9,longLow:4.0,longHigh:9.3},{max:74,shortLow:10.0,shortHigh:22.9,longLow:7.3,longHigh:16.7},{max:200,shortLow:18.6,shortHigh:42.9,longLow:13.3,longHigh:30.0}];
  function pickBand(bands,age){for(var i=0;i<bands.length;i++){if(age<=bands[i].max)return bands[i];}return bands[bands.length-1];}
  function money(n){return "$"+Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,",");}
  function rStep(n,s){return Math.max(s,Math.round(n/s)*s);}
  function estAbroad(age,days,usa,stable){
    var b=pickBand(AB_BANDS,age);
    var blend=Math.min(1,Math.max(0,(days-7)/23));
    var dl=b.shortLow+(b.longLow-b.shortLow)*blend, dh=b.shortHigh+(b.longHigh-b.shortHigh)*blend;
    var f=(stable?1.25:1)*(usa?1.25:1);
    return {low:rStep(dl*days*f,5),high:rStep(dh*days*f,5)};
  }
  function estVisitor(age,days,stable){
    var b=pickBand(SV_BANDS,age);
    var f=(stable?1.25:1)*(age<40?0.85:1);
    return {low:rStep(b.low/365*days*f,10),high:rStep(b.high/365*days*f,10)};
  }
  function estSupervisa(age,stable){
    var b=pickBand(SV_BANDS,age);
    var f=(stable?1.25:1);
    return {low:rStep(b.low*f,50),high:rStep(b.high*f,50)};
  }
  /* ---- end verbatim copy ---- */

  function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

  var form=root.querySelector("form.cp-aq-form");
  var out=root.querySelector(".cp-aq-results");
  var prodEl=form.querySelector("[name=product]");
  var daysWrap=form.querySelector(".cp-aq-days");
  var usaWrap=form.querySelector(".cp-aq-usa");

  function syncVisibility(){
    var p=prodEl.value;
    daysWrap.style.display=(p==="supervisa")?"none":"";
    usaWrap.style.display=(p==="abroad")?"":"none";
  }
  prodEl.addEventListener("change",syncVisibility);
  syncVisibility();

  function card(o){
    var h='<div class="card cp-aq-card">';
    h+="<h3>"+esc(o.name)+"</h3>";
    if(o.badge) h+='<div class="cp-aq-badge">'+esc(o.badge)+"</div>";
    h+="<p>"+o.text+"</p>";
    if(o.unavailable){
      h+='<div class="cp-aq-no">'+esc(o.unavailable)+"</div>";
    }else{
      o.links.forEach(function(l){
        h+='<a class="btn '+(l.gold?"btn-gold":"btn-teal")+' cp-aq-btn" href="'+esc(l.url)+'" target="_blank" rel="noopener">'+esc(l.label)+"</a>";
      });
    }
    return h+"</div>";
  }

  function buildCards(p,age,days,usa,cond){
    var stable=(cond==="stable"), cards=[];
    if(p==="visitor"||p==="supervisa"){
      var sv=(p==="supervisa");
      cards.push({name:"21st Century (Manulife)",badge:"Instant quote on this site",
        text:(stable?"Enhanced plan covers stable pre-existing conditions. ":"")+"Runs right here — answer the health questions and see the real price before you pay.",
        links:[{label:"Get my instant quote →",url:INSTANT_QUOTE,gold:true}]});
      cards.push({name:"TuGo",badge:"$100,000+ coverage",
        text:"Comprehensive visitor plan from a Canadian travel specialist. Save the quote — TuGo emails you a link so you can finish later.",
        links:[{label:"Open the TuGo store →",url:TUGO}]});
      cards.push({name:"TruStone Health",badge:stable?"Covers stable pre-existing":"Often the lowest cost",
        text:stable?"With-pre-existing plan (conditions stable 365 days).":"No-pre-existing plan — the budget pick when there is nothing to declare."+(sv||days>=365?" Monthly payments available on a 1-year policy.":""),
        links:[{label:"Start TruStone application →",url:ts(stable?"ELVTCUW":"ELVTC")}]});
      cards.push({name:"RIMI Secure Travel",badge:"Underwritten by Lloyd's",
        text:stable?"Plan 2 covers stable pre-existing conditions.":"Standard and Enhanced levels; monthly plan available on 1-year policies.",
        links:[{label:"Open RIMI quote →",url:RIMI_VISITOR}]});
    }else{ /* abroad */
      cards.push({name:"21st Century (Manulife)",badge:"$10,000,000 coverage",
        text:"The highest limit on this page, at a fixed $10M. Instant quote runs right here.",
        links:[{label:"Get my instant quote →",url:INSTANT_QUOTE,gold:true}]});
      cards.push({name:"TuGo",badge:"$5,000,000 coverage",
        text:"Single-trip or annual multi-trip from a Canadian travel specialist.",
        links:[{label:"Open the TuGo store →",url:TUGO}]});
      if(stable){
        cards.push({name:"TruStone Health",badge:"Covers stable pre-existing",
          text:"Premier plan with pre-existing conditions covered (180-day stability), US$50 deductible per claim.",
          links:[{label:"Start TruStone application →",url:ts("ELOOC")}]});
      }else{
        cards.push({name:"TruStone Health",badge:"Often the lowest cost",
          text:"No-pre-existing plans: Value at $2,000,000 or Premier at $5,000,000 — same design, Value costs about 15% less.",
          links:[{label:"Value $2M →",url:ts("ELOOCVNP"),gold:true},{label:"Premier $5M →",url:ts("ELOOCNP")}]});
      }
      var rimi={name:"RIMI Canuck Voyage",badge:"$7,000,000 coverage",
        text:"Emergency medical for Canadians abroad, underwritten by Lloyd's.",
        links:[{label:"Open RIMI quote →",url:RIMI_CANUCK}]};
      if(age>=60&&age<=80&&days>60){
        rimi.unavailable="Not available for this trip — at ages 60 to 80, Canuck Voyage trips are limited to 60 days. The other companies above can cover "+days+" days.";
        rimi.links=[];
      }
      cards.push(rimi);
    }
    return cards;
  }

  form.addEventListener("submit",function(ev){
    ev.preventDefault();
    var p=prodEl.value;
    var age=parseInt(form.querySelector("[name=age]").value,10);
    var days=(p==="supervisa")?365:parseInt(form.querySelector("[name=days]").value,10);
    var usa=form.querySelector("[name=usa]").value==="yes";
    var cond=form.querySelector("[name=cond]").value;
    var html="";
    if(isNaN(age)||age<0||age>100||isNaN(days)||days<1){
      out.innerHTML='<div class="form-card cp-aq-warn">Please enter the traveller\u2019s age and the trip length so we can build your list.</div>';
      out.scrollIntoView({behavior:"smooth",block:"start"});
      return;
    }
    if(cond==="changed"){
      /* Same gate as the chat flows: a recent change or uncertainty routes to
         Sertac, never to a buy link — stability wording decides the claim. */
      html+='<div class="form-card cp-aq-warn"><h3>Talk to Sertac first — it protects your claim</h3>'+
        "<p>A recent medication, dosage or treatment change (or not being sure) can fall inside an insurer\u2019s stability period, and which company you pick changes the answer. Sertac checks the wording against the actual history before anything is bought — free, one call.</p>"+
        '<a class="btn btn-gold" href="tel:4373856173">Call 437-385-6173</a> '+
        '<a class="btn btn-teal" href="blog-travel-insurance-pre-existing-conditions.html">Why this matters</a></div>';
      out.innerHTML=html;
      out.scrollIntoView({behavior:"smooth",block:"start"});
      return;
    }
    var stable=(cond==="stable");
    var est=(p==="supervisa")?estSupervisa(age,stable)
           :(p==="visitor")?estVisitor(age,days,stable)
           :estAbroad(age,days,usa,stable);
    var label=(p==="supervisa")?"1 year · $100,000 coverage"
             :(p==="visitor")?days+"-day stay · $100,000 coverage"
             :days+"-day trip · emergency medical"+(usa?" · incl. USA":"");
    html+='<div class="form-card cp-aq-est">Illustrative estimate for this trip: <b>'+money(est.low)+" – "+money(est.high)+' CAD</b><br><span>'+
      esc(label)+" · age "+age+". Not a quote — each company's real price comes from its own tool below, from your full answers (assumptions v2026.07).</span></div>";
    html+='<div class="cards cp-aq-cards">';
    buildCards(p,age,days,usa,cond).forEach(function(c){html+=card(c);});
    html+="</div>";
    html+='<div class="form-card cp-aq-lead"><h3>Rather have Sertac run all of these for you?</h3>'+
      "<p>Send your name and a phone number or email. He runs every company above against your exact details and sends you the comparison — free, and the premium is the same as buying yourself.</p>"+
      '<form class="cp-aq-leadform"><input type="text" name="name" placeholder="Your name" required> '+
      '<input type="text" name="contact" placeholder="Phone or email" required> '+
      '<button type="submit" class="btn btn-gold">Send my details →</button> <span class="cp-aq-sent" role="status"></span></form></div>';
    out.innerHTML=html;

    var leadForm=out.querySelector(".cp-aq-leadform");
    leadForm.addEventListener("submit",function(e2){
      e2.preventDefault();
      var fd=new FormData();
      fd.append("name",leadForm.querySelector("[name=name]").value);
      var contact=leadForm.querySelector("[name=contact]").value;
      if(contact.indexOf("@")>-1) fd.append("email",contact); else fd.append("phone",contact);
      fd.append("details","All-companies quote list -- product: "+p+" | age: "+age+" | days: "+days+(p==="abroad"?(" | USA: "+(usa?"yes":"no")):"")+" | pre-existing: "+cond+" | estimate shown: "+money(est.low)+"-"+money(est.high));
      fd.append("source","Buy Online - all-companies form");
      fd.append("_subject","New quote request - "+(p==="supervisa"?"Super Visa":p==="visitor"?"Visitor to Canada":"Travel insurance")+" - All-companies form");
      fetch(FORMSPREE,{method:"POST",body:fd,headers:{"Accept":"application/json"}})
        .then(function(){leadForm.querySelector(".cp-aq-sent").textContent=" Sent — Sertac replies within 24 hours.";})
        .catch(function(){leadForm.querySelector(".cp-aq-sent").textContent=" Couldn't send — please call 437-385-6173.";});
    });
    out.scrollIntoView({behavior:"smooth",block:"start"});
  });
})();
