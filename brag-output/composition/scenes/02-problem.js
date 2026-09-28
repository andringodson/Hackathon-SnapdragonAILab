/* 02 The problem. Three reasons cloud captioning fails this student, each with its own little machine. */
(() => {
  const { E, P, inout, clamp, lerp, el, svg, S, maskWords, scramble, hash, noise1 } = R;
  const T0 = 10;
  const CX = 1430, CY = 520;           // centre of the icon stage

  // [text, in, out]
  const LINES = [
    ["Cloud captioning struggles with the **mix.**", 0.3, 3.05],
    ["It bills by the **minute.**", 3.4, 6.3],
    ["And it needs a **network** the hall doesn't have.", 6.6, 9.5],
  ];

  R.scene({
    id: "problem", start: T0, dur: 10, post: 0.1,
    build(root, sc) {
      root.style.transformOrigin = "960px 540px";
      sc.lines = LINES.map(([text, a, b], k) => {
        const box = el("div", "prob-line", root);
        const eb = el("div", "prob-eyebrow mono", box, `<b>0${k + 1}</b><i></i>`);
        const tx = el("div", "prob-text", box);
        const ws = maskWords(tx, text);
        return { box, eb, bar: eb.querySelector("i"), ws, a, b };
      });

      // Icon stage (SVG, 900 x 900 centred on CX, CY).
      const s = svg("svg", { class: "prob-icons", viewBox: "-450 -450 900 900", width: 900, height: 900 }, root);
      s.style.left = `${CX - 450}px`; s.style.top = `${CY - 450}px`;

      // a) a dotted cloud
      const cloud = svg("g", {}, s);
      sc.cloud = cloud;
      const d = "M -250 90 C -330 90 -335 -20 -250 -25 C -250 -120 -130 -150 -80 -85 C -40 -190 150 -190 160 -60 C 250 -80 300 20 250 90 Z";
      sc.cloudPath = svg("path", { d, fill: "none", stroke: "#ececec", "stroke-width": 9, "stroke-linecap": "round", "stroke-dasharray": "0.1 19", opacity: 0.85 }, cloud);
      sc.cloudFill = svg("path", { d, fill: "rgba(77,184,255,0.035)", stroke: "none" }, cloud);
      // tokens: the mix goes in, noise comes out
      sc.tokens = ["determinant", "non-trivial", "Matrix", "solution"].map((txt, i) => {
        const g = el("div", "prob-token mono", root);
        g.textContent = txt;
        g._txt = txt;
        g._t = 0.55 + i * 0.52;
        g._y = CY + (i % 2 ? 26 : -34) + (i - 1.5) * 8;
        return g;
      });

      // b) a meter
      const meter = svg("g", {}, s);
      sc.meter = meter;
      svg("circle", { r: 170, fill: "none", stroke: "#1d2025", "stroke-width": 14 }, meter);
      sc.arc = svg("circle", { r: 170, fill: "none", stroke: "#ff3b6b", "stroke-width": 14, "stroke-linecap": "round", transform: "rotate(-90)", "stroke-dasharray": `0 ${2 * Math.PI * 170}` }, meter);
      for (let k = 0; k < 60; k++) {
        const a = (k / 60) * Math.PI * 2, r0 = k % 5 ? 196 : 190, r1 = 206;
        svg("line", { x1: Math.sin(a) * r0, y1: -Math.cos(a) * r0, x2: Math.sin(a) * r1, y2: -Math.cos(a) * r1, stroke: k % 5 ? "#2c3139" : "#8b919a", "stroke-width": k % 5 ? 2 : 3 }, meter);
      }
      sc.clock = el("div", "prob-clock mono", root);
      sc.clockLbl = el("div", "prob-clock-lbl mono", root, "minutes billed");

      // c) wi-fi
      const wifi = svg("g", { transform: "translate(0 40)" }, s);
      sc.wifi = wifi;
      sc.arcs = [80, 160, 240].map((r) => {
        const x = r * Math.sin(Math.PI / 4), y = 110 - r * Math.cos(Math.PI / 4);
        return svg("path", { d: `M ${-x} ${y} A ${r} ${r} 0 0 1 ${x} ${y}`, fill: "none", stroke: "#4db8ff", "stroke-width": 30, "stroke-linecap": "round" }, wifi);
      });
      sc.dot = svg("circle", { cx: 0, cy: 110, r: 21, fill: "#4db8ff" }, wifi);
      sc.slash = svg("line", { x1: -250, y1: -170, x2: 250, y2: 250, stroke: "#ff3b6b", "stroke-width": 20, "stroke-linecap": "round", "stroke-dasharray": "700", "stroke-dashoffset": "700" }, wifi);
      sc.noSig = el("div", "prob-nosig mono", root, "no signal");

      // Sound and light.
      R.cue(T0 + 0.3, "whoosh", { dir: 1 });
      sc.tokens.forEach((g) => R.cue(T0 + g._t + 0.62, "garble"));
      R.cue(T0 + 3.35, "whoosh", { dir: -1 });
      for (let k = 1; k <= 3; k++) R.cue(T0 + 3.5 + k * 0.9, "coin", { k });
      R.cue(T0 + 6.55, "whoosh", { dir: 1 });
      [7.5, 8.0, 8.5].forEach((t, k) => { R.cue(T0 + t, "drop", { k }); R.glitch(T0 + t, 0.16, 0.45); });
      R.cue(T0 + 8.95, "glitch");
      R.glitch(T0 + 8.95, 0.34, 1);
      R.shake(T0 + 8.95, 0.4, 10);
      R.cue(T0 + 6.0, "riser", { dur: 4.0 });
      R.cue(T0 + 9.55, "suck");
      R.light(T0 + 0.2, 600, 540, 520, 0.4);
      R.light(T0 + 2.0, CX, CY, 420, 0.55);
      R.light(T0 + 5.0, CX, CY, 360, 0.6);
      R.light(T0 + 8.9, CX, CY, 520, 0.8);
      R.light(T0 + 9.6, 960, 540, 200, 0.2);
      R.ripple(T0 + 8.95, CX, CY + 40, 1, 1000);
    },

    render(t, T) {
      const sc = this;
      // Implosion at the end: everything is sucked into the centre of the frame.
      const suck = P(t, 9.42, 0.5, E.inCubic);
      S(sc.root, { s: 1 - 0.85 * suck, o: 1 - suck, blur: suck * 10 });

      // Statements: rise out of a mask, hold, rise away.
      sc.lines.forEach((L) => {
        const on = t > L.a - 0.1 && t < L.b + 0.6;
        R.show(L.box, on);
        if (!on) return;
        L.ws.forEach((w, i) => {
          const p = P(t, L.a + i * 0.05, 0.7, E.outExpo);
          const q = P(t, L.b + i * 0.025, 0.4, E.inCubic);
          S(w, { y: (1 - p) * 120 - q * 120 });
        });
        S(L.eb, { o: P(t, L.a, 0.3) * (1 - P(t, L.b, 0.25)) });
        S(L.bar, { sx: P(t, L.a + 0.1, 0.8, E.outExpo) * (1 - P(t, L.b, 0.3, E.inCubic)) });
      });

      // a) cloud, 0.2 → 3.2
      const ca = inout(t, 0.2, 0.9, 3.05, 0.35, E.outBack, E.inCubic);
      sc.cloud.setAttribute("transform", `translate(0 ${(-10 + 10 * ca).toFixed(1)}) scale(${(0.7 + 0.3 * ca).toFixed(3)})`);
      sc.cloud.setAttribute("opacity", ca.toFixed(3));
      sc.cloudPath.setAttribute("stroke-dashoffset", (-t * 22).toFixed(1));
      sc.tokens.forEach((g, i) => {
        const u = (t - g._t) / 1.35;        // 0 → 1 across the stage
        if (u < 0 || u > 1 || t > 3.1) { S(g, { o: 0 }); return; }
        const x = lerp(CX - 360, CX + 470, E.inOutSine(u));
        const inside = Math.abs(x - CX) < 250;
        const out = x > CX + 60;
        g.textContent = out ? R.glyphs(g._txt, T, i + 11, R.LATIN) : g._txt;
        g.classList.toggle("bad", out);
        const edge = Math.min(u / 0.12, (1 - u) / 0.12, 1);
        S(g, { x: x - 110, y: g._y + noise1(t * 3 + i, 5) * (out ? 10 : 3), o: edge * (inside ? 0.25 : 1), blur: inside ? 5 : 0 });
      });

      // b) meter, 3.3 → 6.4
      const ma = inout(t, 3.3, 0.8, 6.3, 0.35, E.outBack, E.inCubic);
      sc.meter.setAttribute("opacity", ma.toFixed(3));
      sc.meter.setAttribute("transform", `scale(${(0.75 + 0.25 * ma).toFixed(3)}) rotate(${((1 - ma) * -40).toFixed(2)})`);
      const mins = Math.max(0, (t - 3.5) / 0.9);
      const frac = mins % 1;
      const C = 2 * Math.PI * 170;
      sc.arc.setAttribute("stroke-dasharray", `${(frac * C).toFixed(1)} ${C.toFixed(1)}`);
      const whole = Math.floor(mins);
      const pulse = Math.exp(-frac * 9) * (whole > 0 ? 1 : 0);
      const secs = Math.floor(mins * 60);
      sc.clock.textContent = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
      S(sc.clock, { o: ma, s: 1 + pulse * 0.08 });
      S(sc.clockLbl, { o: ma * 0.8 });
      sc.clock.style.color = pulse > 0.2 ? "#ff3b6b" : "#ececec";

      // c) wi-fi, 6.5 → 9.5
      const wa = inout(t, 6.5, 0.8, 9.45, 0.2, E.outBack, E.inCubic);
      sc.wifi.setAttribute("opacity", wa.toFixed(3));
      sc.wifi.setAttribute("transform", `translate(0 ${(40 + (1 - wa) * 60).toFixed(1)})`);
      [7.5, 8.0, 8.5].forEach((d, k) => {
        const arc = sc.arcs[2 - k];
        const q = P(t, d, 0.5, E.outCubic);
        arc.setAttribute("stroke", q > 0.05 ? "#2c3139" : "#4db8ff");
        arc.setAttribute("transform", `translate(0 ${(q * 26).toFixed(1)})`);
        arc.setAttribute("opacity", (1 - 0.55 * q).toFixed(3));
      });
      sc.dot.setAttribute("fill", t > 8.95 ? "#ff3b6b" : "#4db8ff");
      sc.slash.setAttribute("stroke-dashoffset", (700 * (1 - P(t, 8.95, 0.35, E.outExpo))).toFixed(1));
      const blink = t > 9.0 ? (Math.floor((t - 9.0) * 8) % 2 ? 0.35 : 1) : 0;
      S(sc.noSig, { o: blink * wa });
    },
  });
})();
