/* 07 The NPU. The measurement that makes this a Snapdragon application.
   Numbers: README / docs/CONCURRENCY.md (CPU contention) and docs/AIHUB.md (device farm). */
(() => {
  const { E, P, inout, clamp, lerp, el, svg, S, words, hash, noise1 } = R;
  const T0 = 72;
  // Chart: RTF 0..2 across X0..X1.
  const X0 = 260, X1 = 1660, PX = (X1 - X0) / 2;
  const RX = X0 + PX;                           // the real-time line, RTF 1.0
  const ROWS = [430, 612], BH = 66;
  const CROSS = 6.0;                            // bar two breaks through the line (global 78.0)
  const CHIP = 11.8, FLY = 13.2, LANDED = 14.0, GRID = 15.4, NUM = 17.0, NUM_LAND = 18.0, DEV = 19.8, END = 23.6;
  // Chip, on the left half.
  const CX0 = 330, CY0 = 300, CS = 560;
  const BLOCKS = {
    cpu: { x: CX0 + 40, y: CY0 + 40, w: 280, h: 230, label: "CPU" },
    gpu: { x: CX0 + 340, y: CY0 + 40, w: 180, h: 230, label: "GPU" },
    npu: { x: CX0 + 40, y: CY0 + 300, w: 480, h: 220, label: "Hexagon NPU" },
  };
  const DEVICES = [["Snapdragon X2 Elite", 13.47], ["Snapdragon X Plus 8-Core", 26.76], ["Snapdragon X Elite", 27.56]];

  R.scene({
    id: "npu", start: T0, dur: 24, post: 0.1,
    build(root, sc) {
      // Header: the chapter's question, which later becomes its answer.
      sc.head = el("div", "np-head", root);
      sc.headA = el("div", "np-head-a", sc.head);
      sc.headAW = words(sc.headA, "Why it needs the **NPU**");
      sc.headB = el("div", "np-head-b", sc.head);
      sc.headBW = words(sc.headB, "Move Whisper's encoder to the **Hexagon NPU.**");

      // ---- chart ----
      const ch = el("div", "np-chart", root);
      sc.chart = ch;
      const s = svg("svg", { class: "np-svg", width: 1920, height: 1080, viewBox: "0 0 1920 1080" }, ch);
      sc.axis = svg("line", { x1: X0, y1: 730, x2: X1, y2: 730, stroke: "#2c3139", "stroke-width": 2 }, s);
      sc.ticks = [0, 0.5, 1, 1.5, 2].map((v) => {
        const g = svg("g", {}, s);
        svg("line", { x1: X0 + v * PX, y1: 730, x2: X0 + v * PX, y2: 742, stroke: "#3a414b", "stroke-width": 2 }, g);
        const tx = svg("text", { x: X0 + v * PX, y: 772, fill: "#8b919a", "font-size": 20, "text-anchor": "middle", "font-family": "Cascadia Mono, Consolas, monospace" }, g);
        tx.textContent = v.toFixed(1);
        return g;
      });
      sc.rt = svg("line", { x1: RX, y1: 330, x2: RX, y2: 730, stroke: "#ececec", "stroke-width": 2.5, "stroke-dasharray": "8 8", pathLength: 400 }, s);
      sc.rtLbl = el("div", "np-rt mono", ch, "real time · 1.0");
      sc.bars = ROWS.map((y, i) => {
        const b = el("div", "np-bar" + (i ? " two" : ""), ch);
        b.style.left = `${X0}px`; b.style.top = `${y}px`; b.style.height = `${BH}px`;
        const red = el("i", "red", b);
        const lbl = el("div", "np-bar-lbl", ch, i ? "<b>+</b> the Llama 3.2 glossary, same CPU" : "Whisper Small, alone on a CPU");
        lbl.style.left = `${X0}px`; lbl.style.top = `${y - 52}px`;
        const val = el("div", "np-val mono", ch);
        const ms = el("div", "np-ms mono", ch, i ? "12,400 ms per caption" : "3,276 ms per caption");
        return { b, red, lbl, val, ms, y };
      });
      sc.note = el("div", "np-note", ch);
      sc.noteW = words(sc.note, "Above **1.0**, the captions fall behind the lecturer.");
      sc.lose = el("div", "np-lose", ch);
      sc.loseW = words(sc.lose, "Two models. One set of cores. **The captions lose.**");
      // Backlog: captions waiting their turn.
      sc.backLbl = el("div", "np-backlbl mono", ch, "waiting");
      sc.backlog = [];
      for (let k = 0; k < 9; k++) {
        const c = el("div", "np-card", ch, "<i></i><i></i>");
        c._t = CROSS + 0.45 + k * 0.42;
        sc.backlog.push(c);
        R.cue(T0 + c._t, "drop", { k, soft: true });
      }

      // ---- chip ----
      const chip = el("div", "np-chipwrap", root);
      sc.chip = chip;
      const cs = svg("svg", { class: "np-svg", width: 1920, height: 1080, viewBox: "0 0 1920 1080" }, chip);
      const line = { fill: "none", stroke: "#3a414b", "stroke-width": 2.5, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 };
      sc.die = svg("rect", Object.assign({ x: CX0, y: CY0, width: CS, height: CS, rx: 28 }, line), cs);
      sc.pins = [];
      for (let k = 0; k < 14; k++) {
        const o = 50 + k * ((CS - 100) / 13);
        for (const [x1, y1, x2, y2] of [[CX0 + o, CY0 - 6, CX0 + o, CY0 - 26], [CX0 + o, CY0 + CS + 6, CX0 + o, CY0 + CS + 26], [CX0 - 6, CY0 + o, CX0 - 26, CY0 + o], [CX0 + CS + 6, CY0 + o, CX0 + CS + 26, CY0 + o]]) {
          sc.pins.push(svg("line", { x1, y1, x2, y2, stroke: "#2c3139", "stroke-width": 4, "stroke-linecap": "round", opacity: 0 }, cs));
        }
      }
      sc.blocks = {};
      for (const [k, b] of Object.entries(BLOCKS)) {
        const r = svg("rect", Object.assign({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 16 }, line, { stroke: k === "npu" ? "#00d68f" : "#3a414b" }), cs);
        const fill = svg("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 16, fill: k === "npu" ? "rgba(0,214,143,0.08)" : "rgba(255,255,255,0.02)", opacity: 0 }, cs);
        const lbl = el("div", "np-blk mono" + (k === "npu" ? " npu" : ""), chip, b.label);
        lbl.style.left = `${b.x + 20}px`; lbl.style.top = `${b.y + 18}px`;
        sc.blocks[k] = { r, fill, lbl, b };
      }
      sc.tagEnc = el("div", "np-tag enc", chip, "Whisper encoder");
      sc.tagLlm = el("div", "np-tag llm", chip, "Llama 3.2 glossary");
      sc.trail = svg("path", { fill: "none", stroke: "#00d68f", "stroke-width": 3, "stroke-dasharray": "2 10", "stroke-linecap": "round", opacity: 0 }, cs);
      sc.sil = el("div", "np-cap", chip);
      sc.silW = words(sc.sil, "The two models now sit on **separate silicon.**");

      // Right panel: 129 layers, then the number, then the devices.
      sc.grid = el("div", "np-grid", root);
      sc.cells = [];
      for (let k = 0; k < 129; k++) { const c = el("i", "", sc.grid); c._t = GRID + 0.2 + k * 0.0085 + hash(k, 12) * 0.12; sc.cells.push(c); }
      sc.gridLbl = el("div", "np-gridlbl mono", root);
      sc.num = el("div", "np-num mono", root, `<span class="v">0.00</span><span class="u">ms</span>`);
      sc.numV = sc.num.querySelector(".v");
      sc.numTop = el("div", "np-numtop mono", root, "Whisper encoder (tiny.en) · one 30 s window");
      sc.numBot = el("div", "np-numbot mono", root, `Snapdragon X2 Elite · Qualcomm AI Hub · job <span class="id">jglyo70e5</span>`);
      sc.devs = DEVICES.map(([name, ms], k) => {
        const d = el("div", "np-dev", root, `<div class="n">${name}</div><div class="track"><i></i></div><div class="v mono">${ms.toFixed(2)} ms</div><div class="l mono">129/129</div>`);
        d.style.top = `${720 + k * 64}px`;
        return { d, fill: d.querySelector(".track i"), ms, k };
      });
      sc.foot = el("div", "np-cap foot", root);
      sc.footW = words(sc.foot, "Device-farm numbers. The full pipeline hasn't run on a physical Snapdragon PC yet.");

      // Sound and light.
      R.cue(T0, "whoosh", { dir: 0, soft: true });
      R.cue(T0 + 1.5, "whoosh", { dir: -1, soft: true });
      R.cue(T0 + 2.7, "grow");
      R.cue(T0 + 5.0, "grow", { long: true });
      R.cue(T0 + CROSS, "crash");
      R.cue(T0 + CROSS, "tapestop");
      R.glitch(T0 + CROSS, 0.4, 1);
      R.shake(T0 + CROSS, 0.5, 16);
      R.flash(T0 + CROSS, 0.3, "#ff3b6b", 0.35);
      R.ripple(T0 + CROSS, RX, ROWS[1] + BH / 2, 1.1, 1100);
      R.cue(T0 + 11.0, "whoosh", { dir: 1 });
      R.cue(T0 + CHIP, "build");
      R.cue(T0 + FLY, "whoosh", { dir: 1, up: true });
      R.cue(T0 + LANDED, "land");
      R.shake(T0 + LANDED, 0.3, 6);
      R.ripple(T0 + LANDED, CX0 + 280, CY0 + 410, 0.9, 900);
      R.flash(T0 + LANDED, 0.25, "#00d68f", 0.25);
      R.cue(T0 + GRID, "sweep");
      R.cue(T0 + NUM, "count");
      R.cue(T0 + NUM_LAND, "impact", { big: false });
      R.shake(T0 + NUM_LAND, 0.35, 9);
      R.ripple(T0 + NUM_LAND, 1430, 560, 1.1, 1300);
      R.flash(T0 + NUM_LAND, 0.3, "#00d68f", 0.3);
      DEVICES.forEach((_, k) => R.cue(T0 + DEV + k * 0.2, "blip", { k }));
      R.cue(T0 + END, "glitch");
      R.glitch(T0 + END + 0.05, 0.35, 1);
      R.light(T0, 960, 540, 700, 0.35);
      R.light(T0 + 2.6, 520, 460, 500, 0.5);
      R.light(T0 + CROSS - 0.2, RX, 640, 420, 0.6);
      R.light(T0 + CROSS + 0.3, RX, 640, 700, 1);
      R.light(T0 + 10.8, 960, 600, 700, 0.4);
      R.light(T0 + 13.0, CX0 + 180, CY0 + 150, 400, 0.6);
      R.light(T0 + LANDED, CX0 + 280, CY0 + 410, 420, 0.9);
      R.light(T0 + GRID + 0.5, 1430, 520, 480, 0.7);
      R.light(T0 + NUM_LAND, 1430, 560, 700, 1);
      R.light(T0 + 23, 1200, 700, 700, 0.5);
    },

    render(t, T) {
      const sc = this;
      // Header: in at the centre, then up to the corner; swaps to the answer as the chip is built.
      const hd = P(t, 1.5, 0.9, E.inOutExpo);
      S(sc.head, { x: lerp(960 - 170 - sc.headA.offsetWidth * 0.8, 0, hd), y: lerp(400, 0, hd), s: lerp(1.6, 1, hd) });
      const hl = (ws, a, b) => ws.forEach((w, i) => {
        const p = P(t, a + i * 0.06, 0.7, E.outExpo), q = P(t, b + i * 0.02, 0.3, E.inCubic);
        S(w, { o: Math.min(1, p * 1.4) * (1 - q), y: (1 - p) * 40 - q * 30, blur: (1 - p) * 8 + q * 5 });
      });
      hl(sc.headAW, 0.1, CHIP - 0.4);
      hl(sc.headBW, CHIP + 0.1, END - 0.3);

      // ---- chart ----
      const chartOut = P(t, 11.0, 0.7, E.inCubic);
      S(sc.chart, { o: 1 - chartOut, s: 1 + 0.08 * chartOut, blur: chartOut * 6 });
      sc.chart.style.transformOrigin = "960px 560px";
      const ax = P(t, 1.9, 0.8, E.outExpo);
      sc.axis.setAttribute("x2", (X0 + (X1 - X0) * ax).toFixed(1));
      sc.ticks.forEach((g, i) => g.setAttribute("opacity", P(t, 2.0 + i * 0.08, 0.4).toFixed(3)));
      const rtp = P(t, 2.2, 0.8, E.outExpo);
      sc.rt.setAttribute("stroke-dashoffset", ((1 - rtp) * 400).toFixed(1));
      sc.rt.setAttribute("opacity", rtp.toFixed(3));
      const hitFlash = Math.exp(-Math.max(0, t - CROSS) * 3) * (t >= CROSS ? 1 : 0);
      sc.rt.setAttribute("stroke", hitFlash > 0.05 ? "#ff3b6b" : "#ececec");
      S(sc.rtLbl, { o: P(t, 2.4, 0.5), x: RX - 120, y: 290 });
      const vals = [
        0.409 * P(t, 2.7, 1.0, E.outExpo),
        t < CROSS ? P(t, 5.0, CROSS - 5.0, E.inOutCubic) : 1 + 0.55 * P(t, CROSS, 0.5, E.outExpo),
      ];
      sc.bars.forEach((b, i) => {
        const v = vals[i];
        const lbl = P(t, i ? 4.5 : 2.3, 0.6, E.outExpo);
        S(b.lbl, { o: lbl, y: (1 - lbl) * 16 });
        S(b.b, { w: Math.max(0.01, v * PX) });
        const over = Math.max(0, v - 1);
        S(b.red, { w: over * PX });
        b.red.style.left = `${PX}px`;
        const shown = t > (i ? 5.0 : 2.7);
        b.val.textContent = v.toFixed(2);
        S(b.val, { o: shown ? 1 : 0, x: X0 + v * PX + 22, y: b.y + 2 });
        b.val.style.color = i && v > 1 ? "#ff3b6b" : "#ececec";
        S(b.ms, { o: P(t, i ? CROSS + 0.4 : 3.6, 0.5), x: X0 + v * PX + 24, y: b.y + BH + 8 });
      });
      sc.noteW.forEach((w, i) => {
        const p = P(t, 2.9 + i * 0.05, 0.6, E.outExpo), q = P(t, CROSS + 0.8, 0.3, E.inCubic);
        S(w, { o: Math.min(1, p * 1.5) * (1 - q), y: (1 - p) * 24, blur: (1 - p) * 6 });
      });
      sc.loseW.forEach((w, i) => {
        const p = P(t, CROSS + 1.2 + i * 0.06, 0.6, E.outExpo), q = P(t, 10.9, 0.3, E.inCubic);
        S(w, { o: Math.min(1, p * 1.5) * (1 - q), y: (1 - p) * 34 - q * 20, blur: (1 - p) * 8 });
      });
      S(sc.backLbl, { o: P(t, CROSS + 0.4, 0.4) });
      sc.backlog.forEach((c, k) => {
        const p = P(t, c._t, 0.5, E.outBack);
        const jitter = noise1(t * 2 + k, 7) * 3;
        S(c, { o: Math.min(1, p * 2), x: 1712 + jitter + (k % 2) * 8, y: 690 - k * 44 - (1 - p) * 60 });
      });

      // ---- chip ----
      const chipIn = P(t, CHIP - 0.2, 0.4);
      const chipOut = P(t, END - 0.1, 0.4, E.inCubic);
      S(sc.chip, { o: chipIn * (1 - chipOut) });
      sc.die.setAttribute("stroke-dashoffset", (1 - P(t, CHIP, 0.9, E.inOutCubic)).toFixed(3));
      sc.pins.forEach((p, i) => p.setAttribute("opacity", P(t, CHIP + 0.5 + (i % 14) * 0.02, 0.3).toFixed(3)));
      Object.values(sc.blocks).forEach(({ r, fill, lbl }, i) => {
        const p = P(t, CHIP + 0.4 + i * 0.15, 0.7, E.inOutCubic);
        r.setAttribute("stroke-dashoffset", (1 - p).toFixed(3));
        fill.setAttribute("opacity", P(t, CHIP + 0.9 + i * 0.15, 0.5).toFixed(3));
        S(lbl, { o: P(t, CHIP + 0.8 + i * 0.15, 0.4) });
      });
      // NPU block lights up when the encoder lands.
      const glow = Math.exp(-Math.max(0, t - LANDED) * 2.2) * (t >= LANDED ? 1 : 0);
      sc.blocks.npu.fill.setAttribute("fill", `rgba(0,214,143,${(0.08 + 0.3 * glow).toFixed(3)})`);
      // Tags: the encoder flies from the CPU to the NPU on an arc.
      const cpu = BLOCKS.cpu, npu = BLOCKS.npu;
      const ax0 = cpu.x + 24, ay0 = cpu.y + 90, ax1 = npu.x + 24, ay1 = npu.y + 110;
      const f = P(t, FLY, LANDED - FLY, E.inOutCubic);
      const fx = lerp(ax0, ax1, f) + Math.sin(f * Math.PI) * 180, fy = lerp(ay0, ay1, f) - Math.sin(f * Math.PI) * 40;
      const tagIn = P(t, CHIP + 1.1, 0.5, E.outBack);
      S(sc.tagEnc, { x: fx, y: fy, s: tagIn * (1 + 0.12 * Math.sin(f * Math.PI)), o: Math.min(1, tagIn) });
      sc.tagEnc.classList.toggle("on-npu", t >= LANDED);
      S(sc.tagLlm, { x: cpu.x + 24, y: cpu.y + 150, s: P(t, CHIP + 1.25, 0.5, E.outBack), o: P(t, CHIP + 1.25, 0.3) });
      // Trail behind the flight.
      if (t > FLY && t < LANDED + 1.2) {
        const pts = [];
        for (let k = 0; k <= 24; k++) {
          const u = (k / 24) * f;
          pts.push(`${(lerp(ax0, ax1, u) + Math.sin(u * Math.PI) * 180 + 90).toFixed(1)},${(lerp(ay0, ay1, u) - Math.sin(u * Math.PI) * 40 + 22).toFixed(1)}`);
        }
        sc.trail.setAttribute("d", "M " + pts.join(" L "));
        sc.trail.setAttribute("opacity", (0.8 * (1 - P(t, LANDED + 0.3, 0.8))).toFixed(3));
      } else sc.trail.setAttribute("opacity", 0);
      sc.silW.forEach((w, i) => {
        const p = P(t, LANDED + 0.25 + i * 0.05, 0.6, E.outExpo), q = P(t, DEV - 0.4, 0.3, E.inCubic);
        S(w, { o: Math.min(1, p * 1.5) * (1 - q), y: (1 - p) * 34 - q * 20, blur: (1 - p) * 8 });
      });

      // Right panel: the 129 layers.
      const gIn = P(t, GRID, 0.6, E.outExpo);
      // The layers collapse into the number they add up to.
      const gUp = P(t, NUM - 0.25, 0.6, E.inExpo);
      S(sc.grid, { o: gIn * (1 - gUp), y: (1 - gIn) * 30 + gUp * 90, s: 1 - 0.8 * gUp, blur: gUp * 6 });
      let lit = 0;
      sc.cells.forEach((c) => { const on = t >= c._t; if (on) lit++; c.className = on ? (t - c._t < 0.15 ? "on hot" : "on") : ""; });
      sc.gridLbl.innerHTML = `<b>${lit}</b> / 129 layers on the NPU`;
      S(sc.gridLbl, { o: gIn * (1 - gUp) * (1 - chipOut), y: (1 - gIn) * 20 });
      // The number.
      const nIn = P(t, NUM, NUM_LAND - NUM, E.outExpo);
      const val = 13.47 * nIn;
      sc.numV.textContent = val.toFixed(2);
      const pop = Math.exp(-Math.max(0, t - NUM_LAND) * 5) * (t >= NUM_LAND ? 1 : 0);
      S(sc.num, { o: P(t, NUM, 0.2) * (1 - chipOut), s: 1 + 0.1 * pop, y: -60 * P(t, DEV - 0.4, 0.8, E.inOutExpo) });
      sc.num.classList.toggle("landed", t >= NUM_LAND);
      S(sc.numTop, { o: P(t, NUM_LAND - 0.3, 0.5) * (1 - chipOut), y: -60 * P(t, DEV - 0.4, 0.8, E.inOutExpo) });
      S(sc.numBot, { o: P(t, NUM_LAND + 0.2, 0.5) * (1 - chipOut), y: -60 * P(t, DEV - 0.4, 0.8, E.inOutExpo) });
      // Devices.
      sc.devs.forEach(({ d, fill, ms, k }) => {
        const p = P(t, DEV + k * 0.2, 0.5, E.outExpo);
        S(d, { o: p * (1 - chipOut), x: (1 - p) * 40 });
        S(fill, { sx: (ms / 27.56) * P(t, DEV + k * 0.2 + 0.1, 0.9, E.outExpo) });
      });
      sc.footW.forEach((w, i) => {
        const p = P(t, DEV + 0.5 + i * 0.03, 0.6, E.outExpo);
        S(w, { o: Math.min(1, p * 1.5) * (1 - chipOut), y: (1 - p) * 20 });
      });
    },
  });
})();
