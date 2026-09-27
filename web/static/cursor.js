/* Cursor follower: a dot that tracks the pointer exactly and a ring that
   eases after it, grows over anything clickable, tightens while the button
   is held and pulses on release.

   The native cursor stays. This is feedback, not a replacement, and hiding
   the real cursor breaks text selection and every OS accessibility setting
   that enlarges it.

   Same budget as matrix.js: transform and opacity only, so the compositor
   does the work, and the loop stops as soon as the ring catches up. Skipped
   entirely on touch screens and for prefers-reduced-motion. */

(() => {
  "use strict";

  if (!window.matchMedia("(pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const css = `
  .cx-dot, .cx-ring { position: fixed; left: 0; top: 0; pointer-events: none; z-index: 2147483000;
    border-radius: 50%; will-change: transform; opacity: 0; transition: opacity .3s; }
  .cx-dot { width: 6px; height: 6px; margin: -3px 0 0 -3px; background: #4db8ff; box-shadow: 0 0 10px rgba(77,184,255,.8); }
  .cx-ring { width: 34px; height: 34px; margin: -17px 0 0 -17px; }
  .cx-ring i { position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid rgba(236,236,236,.55);
    transition: transform .28s cubic-bezier(.2,.7,.2,1), border-color .28s, background-color .28s; }
  .cx-on .cx-dot, .cx-on .cx-ring { opacity: 1; }
  .cx-hover .cx-ring i { transform: scale(1.65); border-color: rgba(77,184,255,.9); background-color: rgba(77,184,255,.07); }
  .cx-text .cx-ring i { transform: scale(.55); border-color: rgba(236,236,236,.3); }
  .cx-down .cx-ring i { transform: scale(.8); border-color: #4db8ff; background-color: rgba(77,184,255,.16); }
  .cx-ring b { position: absolute; inset: 0; border-radius: 50%; border: 2px solid #4db8ff; opacity: 0; }
  .cx-ring.cx-pulse b { animation: cx-pulse .5s cubic-bezier(.2,.7,.2,1); }
  @keyframes cx-pulse { from { opacity: .9; transform: scale(1); } to { opacity: 0; transform: scale(2.4); } }
  `;

  const style = document.createElement("style");
  style.textContent = css;
  const dot = document.createElement("div");
  dot.className = "cx-dot";
  const ring = document.createElement("div");
  ring.className = "cx-ring";
  ring.append(document.createElement("i"), document.createElement("b"));
  dot.setAttribute("aria-hidden", "true");
  ring.setAttribute("aria-hidden", "true");

  const root = document.documentElement;
  const pos = { x: -100, y: -100 }, ring_ = { x: -100, y: -100 };
  let running = false;

  const CLICKABLE = "a, button, select, summary, label, [role='button'], .kpi, .stage, .stat";
  const TEXT = "input, textarea, p, li, td, code, pre";

  function loop() {
    ring_.x += (pos.x - ring_.x) * 0.2;
    ring_.y += (pos.y - ring_.y) * 0.2;
    ring.style.transform = `translate3d(${ring_.x}px, ${ring_.y}px, 0)`;
    if (Math.abs(pos.x - ring_.x) + Math.abs(pos.y - ring_.y) > 0.3) requestAnimationFrame(loop);
    else running = false;
  }

  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pos.x = e.clientX;
    pos.y = e.clientY;
    dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    root.classList.add("cx-on");
    const t = e.target instanceof Element ? e.target : null;
    const hot = !!(t && t.closest(CLICKABLE));
    root.classList.toggle("cx-hover", hot);
    root.classList.toggle("cx-text", !hot && !!(t && t.closest(TEXT)));
    if (!running) { running = true; requestAnimationFrame(loop); }
  }, { passive: true });

  addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") root.classList.add("cx-down");
  }, { passive: true });
  addEventListener("pointerup", () => {
    root.classList.remove("cx-down");
    ring.classList.remove("cx-pulse");
    void ring.offsetWidth;          // restart the animation on every click
    ring.classList.add("cx-pulse");
  }, { passive: true });

  document.addEventListener("mouseleave", () => root.classList.remove("cx-on"));
  root.addEventListener("mouseleave", () => root.classList.remove("cx-on"));

  function start() {
    document.head.append(style);
    document.body.append(dot, ring);
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
