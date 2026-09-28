/* 06 Offline. The network goes off and the captions keep coming. Nothing gets out. */
(() => {
  const { E, P, inout, clamp, lerp, el, svg, S, words, hash, noise1 } = R;
  const T0 = 62;
  const D = window.DATA;
  const CLICK = 2.0;
  // Laptop screen on the stage.
  const SX = 330, SY = 175, SW = 900, SH = 570;
  // The device boundary packets cannot cross.
  const BX0 = 250, BY0 = 120, BX1 = 1310, BY1 = 850;
  // Captions on the laptop: [index, arrival].
  const CAPS = [[9, -0.2], [11, 0.9], [13, 2.75], [14, 3.9], [15, 5.05], [16, 6.2], [17, 7.35]];

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  R.scene({
    id: "offline", start: T0, dur: 10, post: 0.2,
    build(root, sc) {
      root.style.transformOrigin = "780px 480px";
      const s = svg("svg", { class: "of-svg", width: 1920, height: 1080, viewBox: "0 0 1920 1080" }, root);
      sc.svg = s;
      // Laptop, drawn on.
      const ln = { fill: "none", stroke: "#3a414b", "stroke-width": 3, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1, "stroke-linejoin": "round" };
      sc.draw = [
        svg("rect", Object.assign({ x: SX - 22, y: SY - 22, width: SW + 44, height: SH + 44, rx: 26 }, ln), s),
        svg("path", Object.assign({ d: `M ${SX - 110} ${SY + SH + 40} L ${SX + SW + 110} ${SY + SH + 40} L ${SX + SW + 70} ${SY + SH + 72} L ${SX - 70} ${SY + SH + 72} Z` }, ln), s),
        svg("path", Object.assign({ d: `M ${SX + SW / 2 - 90} ${SY + SH + 40} v 8 h 180 v -8` }, ln), s),
      ];
      sc.screenGlow = svg("rect", { x: SX, y: SY, width: SW, height: SH, rx: 8, fill: "#050608" }, s);
      // Boundary.
      sc.bound = svg("rect", { x: BX0, y: BY0, width: BX1 - BX0, height: BY1 - BY0, rx: 40, fill: "none", stroke: "#4db8ff", "stroke-width": 2, "stroke-dasharray": "10 12", pathLength: 1000, opacity: 0 }, s);
      sc.hits = [];
      sc.packets = [];
      const rr = R.rng(62);
      for (let i = 0; i < 26; i++) {
        const a = rr() * Math.PI * 2;
        const ox = SX + 120 + rr() * (SW - 240), oy = SY + 100 + rr() * (SH - 200);
        const dx = Math.cos(a), dy = Math.sin(a);
        // distance to the boundary along the direction
        const tx = dx > 0 ? (BX1 - ox) / dx : (BX0 - ox) / dx;
        const ty = dy > 0 ? (BY1 - oy) / dy : (BY0 - oy) / dy;
        const L = Math.min(tx, ty) - 6;
        const p = { t: 5.7 + i * 0.14 + rr() * 0.1, ox, oy, dx, dy, L, v: 900 + rr() * 500 };
        p.dot = svg("circle", { r: 8, fill: "#4db8ff" }, s);
        p.trail = svg("line", { stroke: "#4db8ff", "stroke-width": 5, "stroke-linecap": "round" }, s);
        p.hit = svg("circle", { r: 4, fill: "none", stroke: "#ff3b6b", "stroke-width": 3 }, s);
        sc.packets.push(p);
        if (i % 2 === 0) R.cue(T0 + p.t + p.L / p.v, "bounce", { k: i });
      }
      sc.boundLbl = el("div", "of-bound mono", root, "this device");
      sc.boundLbl.style.left = `${BX0 + 34}px`; sc.boundLbl.style.top = `${BY0 - 12}px`;

      // The app on the laptop.
      const app = el("div", "of-app", root);
      app.style.left = `${SX}px`; app.style.top = `${SY}px`; app.style.width = `${SW}px`; app.style.height = `${SH}px`;
      app.innerHTML = `<div class="of-head"><svg viewBox="0 0 64 64" width="30" height="30"><rect x="1.5" y="1.5" width="61" height="61" rx="16" fill="#050607" stroke="#23272d" stroke-width="3"/><g fill="none" stroke-linecap="round" stroke-width="4.5"><path d="M16 27v10" stroke="#ececec"/><path d="M24 19v26" stroke="#4db8ff"/><path d="M32 24v16" stroke="#ececec"/><path d="M41 26h9" stroke="#ececec" stroke-opacity=".6"/><path d="M41 38h5" stroke="#ececec" stroke-opacity=".6"/></g></svg><b>Sahaay</b><span class="of-lang">हिन्दी (Hindi)</span></div><div class="of-view"><ol class="of-list"></ol></div>`;
      sc.app = app;
      sc.list = app.querySelector(".of-list");
      sc.view = app.querySelector(".of-view");
      sc.caps = CAPS.map(([i, a]) => {
        const c = D.captions.find((x) => x.index === i);
        const li = el("li", "of-cap", sc.list, `<p class="s">${esc(c.text)}</p><p class="tr">${esc(c.tr)}</p>`);
        return { li, a, c };
      });
      const vh = sc.view.clientHeight;
      sc.scroll = sc.caps.map((cp) => Math.max(0, cp.li.offsetTop + cp.li.offsetHeight + 12 - vh));

      // Network panel.
      const net = el("div", "of-net", root);
      net.innerHTML = `<svg class="of-wifi" viewBox="-130 -110 260 170" width="150" height="98"><path d="M -85 -25 A 120 120 0 0 1 85 -25" /><path d="M -56 5 A 80 80 0 0 1 56 5" /><path d="M -28 33 A 40 40 0 0 1 28 33" /><circle cx="0" cy="55" r="11"/><line class="sl" x1="-110" y1="-95" x2="110" y2="80" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
        <div class="mono lbl">Network</div><div class="tog"><i></i></div><div class="state"></div>`;
      sc.net = net;
      sc.tog = net.querySelector(".tog");
      sc.knob = net.querySelector(".tog i");
      sc.state = net.querySelector(".state");
      sc.wifi = net.querySelector(".of-wifi");
      sc.slash = net.querySelector(".sl");

      // Cursor, in the product's style (sahaay/ui/cursor.js): a ring and a dot.
      sc.ring = el("div", "of-ring", root);
      sc.cdot = el("div", "of-cdot", root);
      sc.cpulse = el("div", "of-ring pulse", root);

      sc.l1 = el("div", "of-lower", root); sc.l1w = words(sc.l1, "Network off. **Captions keep coming.**");
      sc.l2 = el("div", "of-lower", root); sc.l2w = words(sc.l2, "No audio, no text, no account **leaves the machine.**");

      R.cue(T0, "whoosh", { dir: 0, soft: true });
      R.cue(T0 + 1.55, "hover");
      R.cue(T0 + CLICK, "click");
      R.cue(T0 + CLICK, "cut");
      R.glitch(T0 + CLICK, 0.42, 1.1);
      R.shake(T0 + CLICK, 0.45, 12);
      R.flash(T0 + CLICK, 0.25, "#ff3b6b", 0.3);
      R.ripple(T0 + CLICK, 1620, 560, 1, 1000);
      sc.caps.forEach((cp) => { if (cp.a > 0) R.cue(T0 + cp.a, "pop", { hi: cp.a > CLICK }); });
      R.cue(T0 + 5.3, "blip", { k: 3 });
      R.cue(T0 + 6.0, "riser", { dur: 4.0 });
      R.cue(T0 + 9.45, "whoosh", { dir: 0, up: true });
      R.light(T0, 780, 480, 600, 0.3);
      R.light(T0 + 1.6, 1600, 560, 360, 0.6);
      R.light(T0 + 2.4, 780, 460, 600, 0.35);
      R.light(T0 + 6.0, 780, 480, 800, 0.45);
      R.light(T0 + 9.5, 960, 540, 700, 0.6);
    },

    render(t, T) {
      const sc = this;
      const off = t >= CLICK;
      // Out: push through the laptop.
      const out = P(t, 9.45, 0.55, E.inCubic);
      S(sc.root, { s: 1 + 0.5 * out, o: 1 - out, blur: out * 8 });

      sc.draw.forEach((d, i) => d.setAttribute("stroke-dashoffset", (1 - P(t, 0.05 + i * 0.12, 0.9, E.inOutCubic)).toFixed(3)));
      const scr = P(t, 0.4, 0.6, E.outCubic);
      sc.screenGlow.setAttribute("opacity", scr.toFixed(3));
      S(sc.app, { o: scr });

      // Captions on the laptop.
      let scroll = 0;
      sc.caps.forEach((cp, n) => {
        const p = P(t, cp.a, 0.45, E.outCubic);
        S(cp.li, { o: p, y: (1 - p) * 12 });
        cp.li.classList.toggle("latest", t >= cp.a && (n === sc.caps.length - 1 || t < sc.caps[n + 1].a));
        if (t >= cp.a) scroll = lerp(n ? sc.scroll[n - 1] : 0, sc.scroll[n], P(t, cp.a, 0.55, E.outExpo));
      });
      sc.list.style.transform = `translateY(${-scroll}px)`;

      // Network panel.
      const np = P(t, 0.5, 0.8, E.outExpo);
      S(sc.net, { o: np, x: (1 - np) * 60 });
      const k = P(t, CLICK, 0.3, E.outBack);
      S(sc.knob, { x: lerp(74, 0, k) });
      sc.tog.classList.toggle("off", off);
      sc.state.textContent = off ? "Offline" : "Connected";
      sc.state.classList.toggle("off", off);
      sc.wifi.classList.toggle("off", off);
      sc.slash.setAttribute("stroke-dashoffset", (1 - P(t, CLICK + 0.05, 0.35, E.outExpo)).toFixed(3));

      // Cursor: glides in, hovers, clicks, leaves.
      const tx = 1620, ty = 560;            // the toggle
      const path = P(t, 0.7, 1.05, E.inOutCubic);
      const leave = P(t, 3.0, 0.9, E.inCubic);
      const cx = lerp(lerp(1840, tx, path), 1900, leave) + Math.sin(path * Math.PI) * -60;
      const cy = lerp(lerp(990, ty, path), 1100, leave);
      const hov = P(t, 1.5, 0.3, E.outCubic) * (1 - leave);
      const press = t >= CLICK && t < CLICK + 0.14 ? 1 : 0;
      const co = P(t, 0.6, 0.3) * (1 - leave);
      S(sc.ring, { x: cx - 20, y: cy - 20, s: (1 + 0.55 * hov) * (press ? 0.75 : 1), o: co });
      sc.ring.classList.toggle("hov", hov > 0.5);
      S(sc.cdot, { x: cx - 4, y: cy - 4, o: co });
      const pp = P(t, CLICK, 0.5, E.outCubic);
      S(sc.cpulse, { x: tx - 20, y: ty - 20, s: 1 + 2.4 * pp, o: t >= CLICK ? 1 - pp : 0 });

      // The boundary and the packets that bounce off it.
      const bd = P(t, 5.3, 0.9, E.inOutCubic);
      sc.bound.setAttribute("opacity", (0.75 * bd * (1 - out)).toFixed(3));
      sc.bound.setAttribute("stroke-dashoffset", (-t * 30).toFixed(1));
      S(sc.boundLbl, { o: bd });
      sc.packets.forEach((p) => {
        const dt = t - p.t;
        if (dt < 0 || dt > 2.4) { p.dot.setAttribute("opacity", 0); p.trail.setAttribute("opacity", 0); p.hit.setAttribute("opacity", 0); return; }
        const sdist = p.v * dt;
        const back = sdist > p.L;
        const d = back ? Math.max(0, 2 * p.L - sdist * 0.55 - p.L * 0.45) : sdist;
        const x = p.ox + p.dx * d, y = p.oy + p.dy * d;
        const fade = back ? Math.max(0, 1 - (sdist - p.L) / (p.L * 0.9)) : Math.min(1, dt / 0.12);
        p.dot.setAttribute("cx", x.toFixed(1)); p.dot.setAttribute("cy", y.toFixed(1));
        p.dot.setAttribute("opacity", fade.toFixed(3));
        p.dot.setAttribute("fill", back ? "#ff3b6b" : "#4db8ff");
        const tl = back ? -50 : 80;
        p.trail.setAttribute("x1", x.toFixed(1)); p.trail.setAttribute("y1", y.toFixed(1));
        p.trail.setAttribute("x2", (x - p.dx * tl).toFixed(1)); p.trail.setAttribute("y2", (y - p.dy * tl).toFixed(1));
        p.trail.setAttribute("stroke", back ? "#ff3b6b" : "#4db8ff");
        p.trail.setAttribute("opacity", (fade * 0.6).toFixed(3));
        const ht = (sdist - p.L) / p.v;
        if (ht >= 0 && ht < 0.5) {
          const hx = p.ox + p.dx * p.L, hy = p.oy + p.dy * p.L;
          p.hit.setAttribute("cx", hx.toFixed(1)); p.hit.setAttribute("cy", hy.toFixed(1));
          p.hit.setAttribute("r", (4 + 40 * (ht / 0.5)).toFixed(1));
          p.hit.setAttribute("opacity", (1 - ht / 0.5).toFixed(3));
        } else p.hit.setAttribute("opacity", 0);
      });

      const line = (ws, a, b) => ws.forEach((w, i) => {
        const p = P(t, a + i * 0.05, 0.6, E.outExpo), q = P(t, b + i * 0.02, 0.3, E.inCubic);
        S(w, { o: Math.min(1, p * 1.5) * (1 - q), y: (1 - p) * 34 - q * 24, blur: (1 - p) * 8 + q * 6 });
      });
      line(sc.l1w, 2.45, 5.35);
      line(sc.l2w, 5.6, 9.4);
    },
  });
})();
