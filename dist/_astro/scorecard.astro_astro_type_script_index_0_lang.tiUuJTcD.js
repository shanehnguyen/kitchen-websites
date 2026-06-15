import{s as k}from"./site.config.CHWT99MY.js";const v=k.callLengthMinutes;const s=a=>String(a??"").replace(/[&<>"']/g,h=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[h]),c=(a,h)=>{try{window.kwTrack?.(a,h||{})}catch{}},O=()=>{try{return crypto.randomUUID()}catch{return`sc-${Date.now()}-${Math.round(performance.now())}`}},Y=()=>{const a=window.location.search;return a&&a.indexOf("utm_")>-1?`/book${a}`:"/book"},P=a=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a);function B(){const a=document.querySelector("[data-sc-root]");if(!a)return;const h=Array.from(a.querySelectorAll("[data-sc-screen]")),r=t=>{h.forEach(o=>{o.hidden=o.dataset.scScreen!==t});const e=a.querySelector(`[data-sc-screen="${t}"] [data-focus]`);requestAnimationFrame(()=>e?.focus()),window.scrollTo({top:0,behavior:"smooth"})};let f=O(),n=null,w={placeId:"",name:""},m="";a.querySelector("[data-start]")?.addEventListener("click",()=>{c("ScorecardStarted"),r("identify")});const S=a.querySelector("[data-ac-input]"),l=a.querySelector("[data-ac-list]");let _,$="";const y=t=>{if(l){if(!t.length){l.innerHTML="",l.hidden=!0;return}l.innerHTML=t.map(e=>`<button type="button" class="sc-ac__item" data-place-id="${s(e.placeId)}" data-place-name="${s(e.primary)}">
             <span class="sc-ac__primary">${s(e.primary)}</span>
             ${e.secondary?`<span class="sc-ac__secondary">${s(e.secondary)}</span>`:""}
           </button>`).join(""),l.hidden=!1}};S?.addEventListener("input",()=>{const t=S.value.trim();if(window.clearTimeout(_),t.length<3){y([]);return}_=window.setTimeout(async()=>{if(t!==$){$=t;try{const o=await(await fetch("/api/places-autocomplete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:t,sessionToken:f})})).json();if(o.degraded){y([]);return}y(o.suggestions||[])}catch{y([])}}},250)}),l?.addEventListener("click",t=>{const e=t.target.closest("[data-place-id]");e&&(w={placeId:e.dataset.placeId||"",name:e.dataset.placeName||""},c("ScorecardIdentified",{name:w.name}),q())}),a.querySelectorAll("[data-manual-link]").forEach(t=>t.addEventListener("click",e=>{e.preventDefault(),r("manual")}));async function q(){r("loading");try{const e=await(await fetch("/api/scorecard",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({placeId:w.placeId,sessionToken:f})})).json();if(f=O(),!e.ok||e.degraded||!e.profile){r("manual");return}n=e,I(),r("hook"),c("ScorecardHook",{band:e.segment?.band})}catch{r("manual")}}function I(){const t=a.querySelector("[data-hook]");t&&n&&(t.textContent=n.hook)}a.querySelector("[data-hook-next]")?.addEventListener("click",()=>r("gate"));const T=a.querySelector("[data-gate-form]"),u=a.querySelector("[data-gate-status]");T?.addEventListener("submit",async t=>{t.preventDefault();const e=new FormData(T);if(!e.get("company")?.trim()){if(m=String(e.get("email")||"").trim(),!P(m)){p(u,"That email doesn’t look right.");return}if(!e.get("consent")){p(u,"Please tick the box so I can send it.");return}u&&(u.hidden=!1,u.textContent=""),C(!1),c("ScorecardEmail",{band:n?.segment?.band}),j(),r("result"),c("ScorecardResult",{band:n?.segment?.band})}});const x=a.querySelector("[data-manual-form]"),d=a.querySelector("[data-manual-status]");x?.addEventListener("submit",async t=>{t.preventDefault();const e=new FormData(x);if(e.get("company")?.trim())return;const o=String(e.get("email")||"").trim(),g=String(e.get("business")||"").trim();if(!g){p(d,"Add your business name.");return}if(!P(o)){p(d,"That email doesn’t look right.");return}if(!e.get("consent")){p(d,"Please tick the box so I can send it.");return}d&&(d.hidden=!1,d.textContent="Sending…");try{await fetch("/api/score-submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"scorecard",manual:!0,email:o,business:g,city:String(e.get("city")||"").trim()})})}catch{}c("ScorecardEmail",{via:"manual"}),r("manualDone")});async function C(t){if(n)try{await fetch("/api/score-submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"scorecard",manual:t,email:m,business:n.profile.name,band:n.segment.band,worst:n.segment.worst,reviews:n.profile.reviews,rating:n.profile.rating,topReviews:n.top?.reviews??""})})}catch{}}const D=t=>t==="fail"?"Fix this":"Tighten",A=t=>`
    <li class="sc-grade sc-grade--${t.status}">
      <div class="sc-grade__head">
        <span class="sc-grade__chip">${D(t.status)}</span>
        <span class="sc-grade__label">${s(t.label)}</span>
      </div>
      <p class="sc-grade__value">${s(t.value)}</p>
      <p class="sc-grade__why">${s(t.why)}</p>
      ${t.fix?`<p class="sc-grade__fix"><span class="sc-grade__fixlabel">The fix:</span> ${s(t.fix)}</p>`:""}
    </li>`;function j(){const t=a.querySelector("[data-result-host]");if(!t||!n)return;const e=n,o=e.profile,g=e.top&&o.reviews!==null&&o.reviews<e.top.reviews?" sc-num--alarm":"",R=o.rating!==null&&o.rating>0&&o.rating<4?" sc-num--alarm":"",b=[];b.push(`<tr class="sc-table__me">
        <th scope="row">${s(o.name)} <span class="sc-table__tag">you</span></th>
        <td class="sc-num${g}">${o.reviews??"—"}</td>
        <td class="sc-num${R}">${o.rating?o.rating.toFixed(1):"—"}</td>
      </tr>`),e.competitors.forEach(i=>{b.push(`<tr>
          <th scope="row">${s(i.name)}</th>
          <td class="sc-num">${i.reviews}</td>
          <td class="sc-num">${i.rating?i.rating.toFixed(1):"—"}</td>
        </tr>`)});const G=e.competitors.length?`<div class="sc-tablewrap">
          <table class="sc-table">
            <thead><tr><th scope="col">Kitchen &amp; bath near you</th><th scope="col">Reviews</th><th scope="col">Stars</th></tr></thead>
            <tbody>${b.join("")}</tbody>
          </table>
        </div>`:"",L=e.audit.map(A).join(""),H=e.passing.length?`<p class="sc-doing"><span class="sc-doing__label">What you’re already doing right:</span> ${s(e.passing.join(", "))}.</p>`:"";let E="";if(e.website){const i=e.website.items.map(A).join(""),N=e.website.passing.length?`<p class="sc-doing"><span class="sc-doing__label">Already working:</span> ${s(e.website.passing.join(", "))}.</p>`:"";E=`
        <section class="sc-section">
          <h3 class="sc-section__h">Your website</h3>
          <p class="sc-section__sub">The profile gets her to click. The site is where that click becomes a booked job, or doesn’t.</p>
          ${i?`<ul class="sc-grades">${i}</ul>`:""}
          ${N}
        </section>`}const M=`
      <div class="sc-tease">
        <p class="sc-tease__h">What this tool can’t see, but the call shows you</p>
        <p class="sc-tease__body">Which exact searches you’re showing up for and which you’re missing, how many people find you and call versus click away, and where you rank across your whole service area. That’s owner-only data, and it’s where the real money’s hiding.</p>
      </div>`,K=e.verdict.key==="strong"?`This is the automated read, directional, not the last word. Your Google’s already done its job, so on the call I pull your live site apart the way a homeowner reads it and show you exactly where the click stops turning into a call. That’s what the ${v} minutes is for.`:`This is the automated read, directional, not the last word. On the call I pull the live side-by-side, find the exact spots they’re beating you, and hand you the fix in writing. That’s what the ${v} minutes is for.`;t.innerHTML=`
      <div class="sc-verdict sc-verdict--${s(e.verdict.key)}">
        <p class="sc-verdict__eyebrow mono">Your scorecard</p>
        <h2 class="sc-verdict__h" data-focus tabindex="-1">${s(e.verdict.headline)}</h2>
        <p class="sc-verdict__sub">${s(e.verdict.sub)}</p>
      </div>
      ${G}
      <section class="sc-section">
        <h3 class="sc-section__h">Your Google Business Profile, graded</h3>
        <p class="sc-section__sub">Worst first. Each line is a homeowner you can stop losing.</p>
        <ul class="sc-grades">${L}</ul>
        ${H}
      </section>
      ${E}
      ${M}
      <p class="sc-math">${s(e.math)}</p>
      <div class="sc-cta">
        <p class="sc-cta__copy">${s(K)}</p>
        <a class="btn btn--primary btn--lg" href="${Y()}" data-book>Book the ${v}-minute call <span aria-hidden="true">→</span></a>
        <p class="sc-cta__second">A copy of this scorecard is on its way to ${s(m)}.</p>
      </div>
      <p class="sc-sig">— ${s(k.founder)}, ${s(k.brand)}</p>
    `,t.querySelector("[data-book]")?.addEventListener("click",()=>c("BookClicked",{via:"scorecard",band:e.segment.band}))}function p(t,e){t&&(t.hidden=!1,t.textContent=e)}r("start")}B();
