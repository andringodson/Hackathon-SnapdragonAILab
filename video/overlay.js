// Installed as an init script on every page while recording: a visible
// cursor, a black cover for cuts between pages, the title and end cards, and
// an "offline" tag for the moment the network is cut. Nothing here changes
// what the app does; captions are burned in later by assemble.py.
(() => {
  const LOGO = `<svg viewBox="0 0 64 64"><rect x="1.5" y="1.5" width="61" height="61" rx="16" fill="#050607" stroke="#23272d" stroke-width="3"/><g fill="none" stroke-linecap="round" stroke-width="4.5"><path d="M16 27v10" stroke="#ececec"/><path d="M24 19v26" stroke="#4db8ff"/><path d="M32 24v16" stroke="#ececec"/><path d="M41 26h9" stroke="#ececec" stroke-opacity=".6"/><path d="M41 38h5" stroke="#ececec" stroke-opacity=".6"/></g></svg>`;
  const css = `
  html { scroll-behavior: auto !important; }
  #vx-black { position: fixed; inset: 0; background: #000; z-index: 10000; pointer-events: none; transition: opacity .55s ease; }
  #vx-black.off { opacity: 0; pointer-events: none; }
  .vx-card { position: fixed; inset: 0; z-index: 10001; display: grid; place-items: center; text-align: center; pointer-events: none;
    background: #000; transition: opacity .8s cubic-bezier(.2,.7,.2,1); font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif; }
  .vx-card.off { opacity: 0; }
  .vx-card .in { display: grid; justify-items: center; gap: 16px; transition: transform .9s cubic-bezier(.2,.7,.2,1); }
  .vx-card.off .in { transform: translateY(8px) scale(.99); }
  .vx-card .mark { width: 96px; height: 96px; filter: drop-shadow(0 0 28px rgba(77,184,255,.28)); }
  .vx-card .mark svg { width: 100%; height: 100%; display: block; }
  .vx-eyebrow { font-size: 14px; font-weight: 600; letter-spacing: .24em; text-transform: uppercase; color: #4db8ff; margin: 6px 0 0; }
  .vx-card h1 { font-size: 88px; font-weight: 600; line-height: 1; letter-spacing: -.02em; color: #ececec; margin: 0; }
  .vx-sub { font-size: 24px; line-height: 1.45; color: #9aa1ab; margin: 0; max-width: 860px; }
  .vx-rule { width: 64px; height: 1px; background: linear-gradient(90deg, transparent, #4db8ff, transparent); margin: 4px 0; }
  .vx-by { font-size: 18px; font-weight: 500; color: #ececec; letter-spacing: .05em; margin: 0; }
  .vx-links { display: grid; gap: 12px; margin-top: 6px; }
  .vx-links p { margin: 0; font-size: 20px; color: #dcdfe4; }
  .vx-links span { display: inline-block; min-width: 170px; text-align: right; margin-right: 18px; font-weight: 600; font-size: 13px;
    letter-spacing: .18em; text-transform: uppercase; color: #4db8ff; }
  #vx-cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; z-index: 9500; pointer-events: none;
    border: 1.5px solid rgba(236,236,236,.9); box-shadow: 0 0 0 5px rgba(77,184,255,.18), 0 0 20px rgba(77,184,255,.35); opacity: 0; transition: opacity .4s; }
  #vx-cursor.on { opacity: 1; }
  html.cx-on #vx-cursor { display: none; }   /* the site's own cursor ring is showing */
  #vx-cursor::after { content: ""; position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px; border-radius: 50%; background: #ececec; }
  #vx-cursor .pulse { position: absolute; inset: -2px; border-radius: 50%; border: 2px solid rgba(77,184,255,.95); opacity: 0; }
  #vx-cursor.click .pulse { animation: vx-pulse .55s ease-out; }
  @keyframes vx-pulse { from { opacity: 1; transform: scale(.6); } to { opacity: 0; transform: scale(2.6); } }
  #vx-offline { position: fixed; top: 86px; left: 50%; z-index: 9400; transform: translate(-50%, -12px); opacity: 0; pointer-events: none;
    display: flex; align-items: center; gap: 10px; padding: 10px 18px; border-radius: 999px; background: #140606; border: 1px solid #ff5c5c;
    color: #ffb4b4; font: 600 15px/1 "Segoe UI", sans-serif; letter-spacing: .06em; transition: opacity .4s, transform .4s cubic-bezier(.2,.7,.2,1); }
  #vx-offline.on { opacity: 1; transform: translate(-50%, 0); }
  #vx-offline i { width: 9px; height: 9px; border-radius: 50%; background: #ff5c5c; box-shadow: 0 0 10px #ff5c5c; }
  `;

  function install() {
    document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
    const black = Object.assign(document.createElement("div"), { id: "vx-black" });
    const cur = Object.assign(document.createElement("div"), { id: "vx-cursor" });
    cur.append(Object.assign(document.createElement("i"), { className: "pulse" }));
    const off = Object.assign(document.createElement("div"), { id: "vx-offline" });
    off.innerHTML = "<i></i>NETWORK DISCONNECTED";
    const title = Object.assign(document.createElement("div"), { id: "vx-title", className: "vx-card off" });
    title.innerHTML = `<div class="in"><div class="mark">${LOGO}</div>
      <p class="vx-eyebrow">Snapdragon&reg; AI Lab Build &amp; Present Challenge 2026</p>
      <h1>Sahaay</h1>
      <p class="vx-sub">Live lecture captions, Indian-language translation and a jargon glossary, running entirely on the laptop.</p>
      <div class="vx-rule"></div><p class="vx-by">Andrin Godson</p></div>`;
    const end = Object.assign(document.createElement("div"), { id: "vx-end", className: "vx-card off" });
    end.innerHTML = `<div class="in"><div class="mark">${LOGO}</div>
      <h1>Thank you</h1><div class="vx-rule"></div>
      <div class="vx-links"><p><span>Try it live</span>sahaay-offline.vercel.app</p>
      <p><span>Recorded session</span>sahaay-offline.vercel.app/demo</p></div>
      <p class="vx-by" style="margin-top:14px">A Hackathon Project by AndrinGodson</p></div>`;
    document.body.append(black, title, end, off, cur);

    addEventListener("mousemove", (e) => {
      cur.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      cur.classList.add("on");
    }, { passive: true });
    addEventListener("mousedown", () => {
      cur.classList.remove("click"); void cur.offsetWidth; cur.classList.add("click");
    });
  }

  window.__reveal = () => document.getElementById("vx-black").classList.add("off");
  window.__cover = () => document.getElementById("vx-black").classList.remove("off");
  window.__title = (on) => document.getElementById("vx-title").classList.toggle("off", !on);
  window.__end = () => document.getElementById("vx-end").classList.remove("off");
  window.__offline = () => document.getElementById("vx-offline").classList.add("on");

  // Eased scroll to a heading (by its text) or a selector.
  window.__glide = (target, offset = 90, ms = 1400) => {
    let el = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim().startsWith(target));
    if (!el) { try { el = document.querySelector(target); } catch (e) { el = null; } }
    if (!el) return false;
    const from = scrollY, to = Math.max(0, el.getBoundingClientRect().top + scrollY - offset);
    const t0 = performance.now();
    const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      scrollTo(0, from + (to - from) * ease(k));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return true;
  };

  // Centre of an element, for pointing the cursor at it.
  window.__box = (sel, fx = 0.5, fy = 0.5) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width * fx, y: r.top + r.height * fy };
  };

  if (document.body) install();
  else document.addEventListener("DOMContentLoaded", install, { once: true });
})();
