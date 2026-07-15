const g="kw_pulse_token",o=t=>document.querySelector(t),p=o("[data-pl-gate]"),b=o("[data-pl-gate-err]"),u=o("[data-pl-body]"),d=o("[data-pl-note]"),w=o("[data-pl-funnel]"),v=o("[data-pl-list]"),_=o("[data-pl-updated]"),i=o("[data-pl-redis]"),k=o("[data-pl-count]"),L=o("[data-pl-window]"),h=o("[data-pl-signout]"),A={connected:{label:"● database connected",cls:"is-ok"},unreachable:{label:"● database not reachable",cls:"is-bad"},"not-configured":{label:"● database not configured",cls:"is-bad"}},S={landed:"cool",started:"cool",contact:"mid",details:"mid",obstacle:"warm",submitted:"good",booked:"good"},r=t=>(t||"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]);function M(t){const e=Math.max(0,Math.round((Date.now()-t)/1e3));if(e<60)return`${e}s ago`;const n=Math.round(e/60);if(n<60)return`${n}m ago`;const a=Math.round(n/60);return a<24?`${a}h ago`:`${Math.round(a/24)}d ago`}function x(t){const e=Math.max(0,Math.round(((t.updatedAt||0)-(t.landedAt||0))/1e3));return e<60?`${e}s`:`${Math.round(e/60)}m`}function R(){try{return localStorage.getItem(g)||""}catch{return""}}function f(t){try{t?localStorage.setItem(g,t):localStorage.removeItem(g)}catch{}}function $(t){p.hidden=!1,u.hidden=!0,h.hidden=!0,t&&(b.textContent=t,b.hidden=!1)}function C(t){const e=t.length?t[0].count:0;w.innerHTML=t.map((n,a)=>{const s=a>0?t[a-1].count:n.count,c=e?Math.round(n.count/e*100):0,l=s-n.count,T=s?Math.round(l/s*100):0,y=S[n.stage]||"cool";return`
        <div class="pl-frow">
          <div class="pl-fmeta">
            <span class="pl-flabel">${r(n.label)}</span>
            <span class="pl-fnum">${n.count}</span>
          </div>
          <div class="pl-fbar"><span class="pl-ffill pl-tone--${y}" style="width:${Math.max(c,n.count?3:0)}%"></span></div>
          <div class="pl-fdrop">${a>0&&l>0?`↓ ${l} left here (${T}%)`:a===0?"":"—"}</div>
        </div>`}).join("")}function I(t){if(k.textContent=t.length?`· ${t.length}`:"",!t.length){v.innerHTML='<p class="pl-empty">No visitors in the last 7 days yet.</p>';return}v.innerHTML=t.map(e=>{const n=S[e.stage]||"cool",a=e.name||e.email||e.phone||"Anonymous",s=[e.email,e.phone].filter(Boolean).join(" · "),c=[e.customers,e.jobs&&`${e.jobs}/mo`].filter(Boolean).join(" · "),l=e.source||e.referrer||"direct";return`
        <div class="pl-row">
          <div class="pl-row__main">
            <span class="pl-who">${r(a)}</span>
            <span class="pl-badge pl-tone--${n}">${r(H(e.stage))}</span>
          </div>
          <div class="pl-row__sub">
            ${s?`<span>${r(s)}</span>`:""}
            ${e.website?`<span>${r(e.website)}</span>`:""}
            ${c?`<span>${r(c)}</span>`:""}
          </div>
          ${e.obstacle?`<div class="pl-row__gripe">“${r(e.obstacle)}”</div>`:""}
          <div class="pl-row__foot">
            <span title="where they came from">from: ${r(l)}</span>
            <span>${x(e)} on page</span>
            <span>${M(e.updatedAt||0)}</span>
          </div>
        </div>`}).join("")}const U={landed:"Landed",started:"Typed name",contact:"On contact",details:"Gave details",obstacle:"Final question",submitted:"At calendar",booked:"Booked"},H=t=>U[t]||t;async function m(){const t=R();if(!t){$();return}let e;try{e=await fetch(`/api/pulse?token=${encodeURIComponent(t)}`,{cache:"no-store"})}catch{d.textContent="Could not reach the server. Retrying on next refresh.",d.hidden=!1;return}if(e.status===401){f(""),$("That password didn’t work. Try again.");return}if(e.status===503){p.hidden=!0,u.hidden=!0,h.hidden=!0,d.innerHTML="The dashboard is off. Set a <code>PULSE_TOKEN</code> environment variable in Vercel, redeploy, then reload this page.",d.hidden=!1;return}if(!e.ok){d.textContent=`Server error (${e.status}).`,d.hidden=!1;return}const n=await e.json();d.hidden=!0,p.hidden=!0,u.hidden=!1,h.hidden=!1;const a=Array.isArray(n.journeys)?n.journeys:[];C(Array.isArray(n.funnel)?n.funnel:[]),I(a),L.textContent="· last 7 days",_.textContent=`Updated ${new Date().toLocaleTimeString()}`;const s=A[n.redisStatus];s?(i.textContent=s.label,i.className=`pl-redis ${s.cls}`,i.hidden=!1,n.redisStatus!=="connected"&&(d.innerHTML="The booking database isn’t connected, so nothing can be recorded. Add an Upstash Redis in Vercel (Storage), set <code>UPSTASH_REDIS_REST_URL</code> + <code>UPSTASH_REDIS_REST_TOKEN</code>, and redeploy.",d.hidden=!1)):i.hidden=!0}p.addEventListener("submit",t=>{t.preventDefault();const n=(document.getElementById("pl-token").value||"").trim();n&&(f(n),b.hidden=!0,m())});o("[data-pl-refresh]").addEventListener("click",()=>m());h.addEventListener("click",()=>{f(""),$()});const E=new URLSearchParams(location.search).get("token");E&&(f(E),history.replaceState(null,"",location.pathname));m();setInterval(()=>{u.hidden||m()},2e4);
