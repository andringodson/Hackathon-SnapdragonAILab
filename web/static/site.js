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

  /* ---------- the product window: close, minimise, zoom ---------- */
  // Working macOS traffic lights on the hero screenshot. Zoom animates the
  // separate `translate` and `scale` properties from the window's place on
  // the page to its enlarged one, because `transform` carries the tilt.
  (function windowControls() {
    const figure = document.querySelector(".shot");
    const frame = figure && figure.querySelector(".shot-frame");
    if (!frame) return;
    const btnClose = figure.querySelector(".light-close");
    const btnMin = figure.querySelector(".light-min");
    const btnZoom = figure.querySelector(".light-zoom");
    const reopen = figure.querySelector(".shot-reopen");
    const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
    let backdrop = null;

    const centre = (r) => [r.left + r.width / 2, r.top + r.height / 2];
    function flip(first, last, ms) {
      if (reduced || !frame.animate) return;
      const [fx, fy] = centre(first), [lx, ly] = centre(last);
      frame.animate(
        [{ translate: `${fx - lx}px ${fy - ly}px`, scale: String(first.width / last.width) },
         { translate: "0px 0px", scale: "1" }],
        { duration: ms, easing: EASE }
      );
    }

    function zoom(on) {
      if (on === figure.classList.contains("zoomed")) return;
      const first = frame.getBoundingClientRect();
      if (on) {
        figure.style.minHeight = figure.getBoundingClientRect().height + "px";
        backdrop = document.createElement("div");
        backdrop.className = "shot-backdrop";
        backdrop.addEventListener("click", () => zoom(false));
        document.body.append(backdrop);
        requestAnimationFrame(() => backdrop && backdrop.classList.add("on"));
        figure.classList.remove("minimised");
        btnMin.setAttribute("aria-pressed", "false");
        figure.classList.add("zoomed");
        btnZoom.setAttribute("aria-label", "Restore the preview");
      } else {
        figure.classList.remove("zoomed");
        btnZoom.setAttribute("aria-label", "Enlarge the preview");
        const b = backdrop;
        backdrop = null;
        if (b) {
          b.classList.remove("on");
          setTimeout(() => b.remove(), reduced ? 0 : 350);
        }
        setTimeout(() => { figure.style.minHeight = ""; }, reduced ? 0 : 420);
      }
      btnZoom.setAttribute("aria-pressed", String(on));
      flip(first, frame.getBoundingClientRect(), 420);
    }

    btnZoom.addEventListener("click", () => zoom(!figure.classList.contains("zoomed")));
    figure.querySelector(".shot-bar").addEventListener("dblclick", (e) => {
      if (!e.target.closest(".light")) zoom(!figure.classList.contains("zoomed"));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && figure.classList.contains("zoomed")) zoom(false);
    });

    btnMin.addEventListener("click", () => {
      if (figure.classList.contains("zoomed")) zoom(false);
      const on = figure.classList.toggle("minimised");
      btnMin.setAttribute("aria-pressed", String(on));
      btnMin.setAttribute("aria-label", on ? "Restore the preview" : "Minimise the preview");
    });

    btnClose.addEventListener("click", () => {
      const done = () => {
        figure.classList.add("closed");
        figure.classList.remove("minimised");
        reopen.hidden = false;
        reopen.focus({ preventScroll: true });
      };
      if (figure.classList.contains("zoomed")) zoom(false);
      if (reduced || !frame.animate) return done();
      frame.animate([{ opacity: 1, scale: "1" }, { opacity: 0, scale: "0.92" }],
        { duration: 220, easing: EASE }).finished.then(done);
    });

    reopen.addEventListener("click", () => {
      figure.classList.remove("closed");
      reopen.hidden = true;
      btnMin.setAttribute("aria-pressed", "false");
      if (!reduced && frame.animate) {
        frame.animate([{ opacity: 0, scale: "0.92" }, { opacity: 1, scale: "1" }], { duration: 320, easing: EASE });
      }
      btnClose.focus({ preventScroll: true });
    });
  })();

  /* ---------- prefetch /live on intent ---------- */
  // A pointer over, or focus on, a link to /live is a strong hint of a click.
  // Fetch its small files then, so the page opens from cache. Never the model:
  // that is 80 MB and stays the visitor's choice.
  (function prefetchLive() {
    const links = document.querySelectorAll('a[href="live/"]');
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      for (const href of ["live/", "static/live.js", "static/app.js", "static/style.css",
                          "static/replay.css", "static/whisper-worker.js", "static/languages.json"]) {
        const l = document.createElement("link");
        l.rel = "prefetch";
        l.href = href;
        document.head.append(l);
      }
    };
    links.forEach((a) => {
      a.addEventListener("pointerenter", go, { once: true, passive: true });
      a.addEventListener("focus", go, { once: true });
      a.addEventListener("touchstart", go, { once: true, passive: true });
    });
  })();

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
    if (shot && !shot.closest(".zoomed")) {
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
