const m="kw_pulse_token",o=e=>document.querySelector(e),i=o("[data-pl-gate]"),g=o("[data-pl-gate-err]"),p=o("[data-pl-body]"),d=o("[data-pl-note]"),T=o("[data-pl-funnel]"),$=o("[data-pl-list]"),k=o("[data-pl-updated]"),L=o("[data-pl-count]"),M=o("[data-pl-window]"),u=o("[data-pl-signout]"),y={landed:"cool",started:"cool",contact:"mid",details:"mid",obstacle:"warm",submitted:"good",booked:"good"},s=e=>(e||"").replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t]);function S(e){const t=Math.max(0,Math.round((Date.now()-e)/1e3));if(t<60)return`${t}s ago`;const n=Math.round(t/60);if(n<60)return`${n}m ago`;const a=Math.round(n/60);return a<24?`${a}h ago`:`${Math.round(a/24)}d ago`}function _(e){const t=Math.max(0,Math.round(((e.updatedAt||0)-(e.landedAt||0))/1e3));return t<60?`${t}s`:`${Math.round(t/60)}m`}function A(){try{return localStorage.getItem(m)||""}catch{return""}}function h(e){try{e?localStorage.setItem(m,e):localStorage.removeItem(m)}catch{}}function v(e){i.hidden=!1,p.hidden=!0,u.hidden=!0,e&&(g.textContent=e,g.hidden=!1)}function x(e){const t=e.length?e[0].count:0;T.innerHTML=e.map((n,a)=>{const r=a>0?e[a-1].count:n.count,c=t?Math.round(n.count/t*100):0,l=r-n.count,w=r?Math.round(l/r*100):0,E=y[n.stage]||"cool";return`
        <div class="pl-frow">
          <div class="pl-fmeta">
            <span class="pl-flabel">${s(n.label)}</span>
            <span class="pl-fnum">${n.count}</span>
          </div>
          <div class="pl-fbar"><span class="pl-ffill pl-tone--${E}" style="width:${Math.max(c,n.count?3:0)}%"></span></div>
          <div class="pl-fdrop">${a>0&&l>0?`↓ ${l} left here (${w}%)`:a===0?"":"—"}</div>
        </div>`}).join("")}function C(e){if(L.textContent=e.length?`· ${e.length}`:"",!e.length){$.innerHTML='<p class="pl-empty">No visitors in the last 7 days yet.</p>';return}$.innerHTML=e.map(t=>{const n=y[t.stage]||"cool",a=t.name||t.email||t.phone||"Anonymous",r=[t.email,t.phone].filter(Boolean).join(" · "),c=[t.customers,t.jobs&&`${t.jobs}/mo`].filter(Boolean).join(" · "),l=t.source||t.referrer||"direct";return`
        <div class="pl-row">
          <div class="pl-row__main">
            <span class="pl-who">${s(a)}</span>
            <span class="pl-badge pl-tone--${n}">${s(B(t.stage))}</span>
          </div>
          <div class="pl-row__sub">
            ${r?`<span>${s(r)}</span>`:""}
            ${t.website?`<span>${s(t.website)}</span>`:""}
            ${c?`<span>${s(c)}</span>`:""}
          </div>
          ${t.obstacle?`<div class="pl-row__gripe">“${s(t.obstacle)}”</div>`:""}
          <div class="pl-row__foot">
            <span title="where they came from">from: ${s(l)}</span>
            <span>${_(t)} on page</span>
            <span>${S(t.updatedAt||0)}</span>
          </div>
        </div>`}).join("")}const I={landed:"Landed",started:"Typed name",contact:"On contact",details:"Gave details",obstacle:"Final question",submitted:"Submitted",booked:"Booked"},B=e=>I[e]||e;async function f(){const e=A();if(!e){v();return}let t;try{t=await fetch(`/api/pulse?token=${encodeURIComponent(e)}`,{cache:"no-store"})}catch{d.textContent="Could not reach the server. Retrying on next refresh.",d.hidden=!1;return}if(t.status===401){h(""),v("That password didn’t work. Try again.");return}if(t.status===503){i.hidden=!0,p.hidden=!0,u.hidden=!0,d.innerHTML="The dashboard is off. Set a <code>PULSE_TOKEN</code> environment variable in Vercel, redeploy, then reload this page.",d.hidden=!1;return}if(!t.ok){d.textContent=`Server error (${t.status}).`,d.hidden=!1;return}const n=await t.json();d.hidden=!0,i.hidden=!0,p.hidden=!1,u.hidden=!1;const a=Array.isArray(n.journeys)?n.journeys:[];x(Array.isArray(n.funnel)?n.funnel:[]),C(a),M.textContent="· last 7 days",k.textContent=`Updated ${new Date().toLocaleTimeString()}`}i.addEventListener("submit",e=>{e.preventDefault();const n=(document.getElementById("pl-token").value||"").trim();n&&(h(n),g.hidden=!0,f())});o("[data-pl-refresh]").addEventListener("click",()=>f());u.addEventListener("click",()=>{h(""),v()});const b=new URLSearchParams(location.search).get("token");b&&(h(b),history.replaceState(null,"",location.pathname));f();setInterval(()=>{p.hidden||f()},2e4);
