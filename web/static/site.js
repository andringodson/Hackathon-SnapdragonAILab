/* Landing-page motion: sections glitch in as they are scrolled to, and
   every pointer action gets an answer - buttons lean toward the cursor,
   cards light up under it, the product shot tilts to follow it, and a
   click ripples from where it landed.

   Loaded at the end of <body> without defer, so it runs before first paint:
   sections below the fold are hidden before anyone can see them pop. With
   JavaScript off, nothing is hidden. All motion is transform, opacity and
   CSS custom properties, written at most once per frame. */

(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  /* ---------- glitch-in on scroll ---------- */

  const sections = [...document.querySelectorAll(".sec")];
  if (!reduced && "IntersectionObserver" in window) {
    const fold = window.innerHeight * 0.92;
    sections.forEach((s) => {
      if (s.getBoundingClientRect().top > fold) s.classList.add("pre");
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.remove("pre");
        e.target.classList.add("in");
        io.unobserve(e.target);
        countUp(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.05 });
    sections.forEach((s) => { if (s.classList.contains("pre")) io.observe(s); });
  }

  /* ---------- key numbers count up the first time they are seen ---------- */

  function countUp(scope) {
    if (reduced) return;
    scope.querySelectorAll("[data-count]").forEach((el) => {
      if (el.dataset.done) return;
      el.dataset.done = "1";
      const target = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.dec || "0", 10);
      const unit = el.dataset.unit || "";
      const t0 = performance.now(), ms = 1100;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        const v = target * (1 - Math.pow(1 - k, 3));
        el.textContent = v.toFixed(dec) + unit;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  const kpis = document.querySelector(".kpis");
  if (kpis) setTimeout(() => countUp(kpis), 450);

  /* ---------- scroll progress and the active section in the nav ---------- */

  const bar = document.querySelector(".progress span");
  const links = new Map([...document.querySelectorAll(".top-links a[href^='#']")]
    .map((a) => [a.getAttribute("href").slice(1), a]));
  let scrollQueued = false;
  function onScroll() {
    scrollQueued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    let current = null;
    for (const s of sections) {
      if (s.getBoundingClientRect().top < innerHeight * 0.35) current = s.id;
    }
    links.forEach((a, id) => a.classList.toggle("here", id === current));
  }
  addEventListener("scroll", () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  if (reduced) return;

  /* ---------- click ripple on buttons ---------- */

  document.addEventListener("pointerdown", (e) => {
    const btn = e.target instanceof Element && e.target.closest(".btn");
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const rip = document.createElement("span");
    rip.className = "rip";
    rip.style.left = `${e.clientX - r.left}px`;
    rip.style.top = `${e.clientY - r.top}px`;
    btn.append(rip);
    rip.addEventListener("animationend", () => rip.remove(), { once: true });
  });

  if (!finePointer) return;

  /* ---------- pointer-driven effects, batched to one write per frame ---------- */

  let pending = null;
  function frame() {
    const e = pending;
    pending = null;
    if (!e) return;

    // Magnetic buttons: lean a little toward the cursor.
    const btn = e.target instanceof Element && e.target.closest(".btn, .top-cta");
    document.querySelectorAll(".btn.mag, .top-cta.mag").forEach((b) => {
      if (b !== btn) { b.classList.remove("mag"); b.style.setProperty("--tx", "0px"); b.style.setProperty("--ty", "0px"); }
    });
    if (btn) {
      const r = btn.getBoundingClientRect();
      btn.classList.add("mag");
      btn.style.setProperty("--tx", `${((e.clientX - r.left) / r.width - 0.5) * 10}px`);
      btn.style.setProperty("--ty", `${((e.clientY - r.top) / r.height - 0.5) * 8}px`);
    }

    // Spotlight: the card under the cursor lights up where the cursor is.
    const lit = e.target instanceof Element && e.target.closest(".card, .kpi, .stat, .stage");
    if (lit) {
      const r = lit.getBoundingClientRect();
      lit.style.setProperty("--mx", `${e.clientX - r.left}px`);
      lit.style.setProperty("--my", `${e.clientY - r.top}px`);
    }

    // The product shot tilts toward the cursor while it is on screen.
    if (shot) {
      const r = shot.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) {
        const x = (e.clientX - (r.left + r.width / 2)) / innerWidth;
        const y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
        shot.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
        shot.style.setProperty("--rx", `${(-y * 7).toFixed(2)}deg`);
        shot.style.setProperty("--mx", `${e.clientX - r.left}px`);
        shot.style.setProperty("--my", `${e.clientY - r.top}px`);
      }
    }
  }

  const shot = document.querySelector(".shot-frame");
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    if (!pending) requestAnimationFrame(frame);
    pending = e;
  }, { passive: true });

  document.documentElement.addEventListener("mouseleave", () => {
    if (shot) { shot.style.setProperty("--rx", "0deg"); shot.style.setProperty("--ry", "0deg"); }
  });
})();
