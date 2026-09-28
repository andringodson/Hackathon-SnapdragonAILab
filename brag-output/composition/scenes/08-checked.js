/* 08 Built to be checked. Six claims from the README, one per bar, cut on the downbeat. */
(() => {
  const { E, P, inout, clamp, lerp, el, svg, S, words, hash } = R;
  const T0 = 96, CARD = 2.0;

  const CARDS = [
    { head: "**400+** tests", sub: "run in CI on every push", vis: "dots" },
    { head: "Windows x86 · **ARM64** · Linux", sub: "the same suite on all three", vis: "lanes" },
    { head: "Offline is a **test**, not a claim.", sub: "a full session runs with every outbound socket blocked", vis: "sockets" },
    { head: "One script to **install.**", sub: "and --mock runs with nothing downloaded", vis: "term" },
    { head: "Runs in your **browser** too.", sub: "Whisper and NLLB-200, inside the tab", vis: "browser" },
    { head: "Notes when the **lecture ends.**", sub: "key points, a glossary and a five-question self-test", vis: "notes" },
  ];

  function visual(kind, box) {
    const v = {};
    if (kind === "dots") {
      const g = el("div", "ck-dots", box);
      v.dots = [];
      for (let i = 0; i < 400; i++) { const d = el("i", "", g); d._d = (i % 20) + Math.floor(i / 20); v.dots.push(d); }
    } else if (kind === "lanes") {
      v.lanes = ["Windows x86", "Windows ARM64", "Linux"].map((n) => {
        const l = el("div", "ck-lane", box, `<span class="n mono">${n}</span><span class="tr"><i></i></span><span class="ok">✓</span>`);
        return { l, fill: l.querySelector("i"), ok: l.querySelector(".ok") };
      });
    } else if (kind === "sockets") {
      // tests/test_offline.py: NetworkGuard patches socket.socket, runs a full session, asserts nothing tried.
      v.lines = [["tests/test_offline.py", ""], ["socket.socket → NetworkGuard", "patched"],
                 ["full session: ASR · translation · glossary · notes", "ran"], ["outbound connection attempts", "0"]].map(([c, x]) =>
        el("div", "ck-sock mono", box, `<span class="c">${c}</span><span class="x">${x}</span>`));
    } else if (kind === "term") {
      const w = el("div", "ck-term", box, `<div class="bar"><i></i><i></i><i></i><span class="mono">PowerShell</span></div><div class="body mono"><div class="l1"></div><div class="l2"></div></div>`);
      v.l1 = w.querySelector(".l1"); v.l2 = w.querySelector(".l2");
    } else if (kind === "browser") {
      const w = el("div", "ck-browser", box, `<div class="bar"><i></i><i></i><i></i><span class="url mono">sahaay-offline.vercel.app/live</span></div><div class="body"><div class="cap">Today we will start with eigenvalues and eigenvectors.</div><div class="tr">আজ আমরা eigenvalues এবং eigenvectors দিয়ে শুরু করব।</div><span class="rtf mono">RTF 0.5</span><span class="off mono">no upload</span></div>`);
      v.cap = w.querySelector(".cap"); v.tr = w.querySelector(".tr"); v.rtf = w.querySelector(".rtf"); v.off = w.querySelector(".off");
    } else if (kind === "notes") {
      const w = el("div", "ck-doc", box, `<div class="h1"># Eigenvalues and eigenvectors</div><div class="h2">## Key points</div><i></i><i></i><i class="s"></i><div class="h2">## Glossary</div><i></i><i class="s"></i><div class="h2">## Self-test</div><i></i><i class="s"></i>`);
      v.doc = w; v.rows = [...w.children];
    }
    return v;
  }

  R.scene({
    id: "checked", start: T0, dur: 12, post: 0.1,
    build(root, sc) {
      sc.cards = CARDS.map((c, k) => {
        const box = el("div", "ck-card", root);
        const vis = el("div", "ck-vis", box);
        const head = el("div", "ck-head", box);
        const hw = words(head, c.head);
        const sub = el("div", "ck-sub", box, c.sub);
        const a = k * CARD;
        R.cue(T0 + a, k === 0 ? "hit" : "cut", { k });
        if (k) R.glitch(T0 + a - 0.02, 0.14, 0.6);
        return { box, vis, head, hw, sub, a, kind: c.vis, v: visual(c.vis, vis) };
      });
      R.cue(T0 + 11.4, "riser", { dur: 0.6, short: true });
      for (let k = 0; k < 6; k++) R.light(T0 + k * CARD + 0.1, 960, 380, 520, 0.55);
      R.light(T0 + 11.9, 960, 540, 600, 0.4);
    },

    render(t, T) {
      const sc = this;
      sc.cards.forEach((c, k) => {
        const lt = t - c.a;
        const on = lt > -0.05 && lt < CARD + 0.02;
        R.show(c.box, on);
        if (!on) return;
        // Whip in from the right, whip out to the left.
        const inP = P(lt, 0, 0.32, E.outExpo);
        const outP = k === sc.cards.length - 1 ? P(lt, 1.8, 0.2, E.inCubic) : P(lt, 1.84, 0.16, E.inCubic);
        S(c.box, { x: (1 - inP) * 260 - outP * 300, skx: (1 - inP) * -10 + outP * 10, o: Math.min(1, inP * 3) * (1 - outP), blur: (1 - inP) * 10 + outP * 10 });
        c.hw.forEach((w, i) => {
          const p = P(lt, 0.02 + i * 0.035, 0.45, E.outExpo);
          S(w, { y: (1 - p) * 60, o: Math.min(1, p * 2) });
        });
        S(c.sub, { o: P(lt, 0.3, 0.4), y: (1 - P(lt, 0.3, 0.5, E.outExpo)) * 16 });
        const v = c.v;
        if (c.kind === "dots") {
          v.dots.forEach((d) => {
            const on2 = lt > 0.1 + d._d * 0.028;
            d.className = on2 ? (lt < 0.1 + d._d * 0.028 + 0.12 ? "on hot" : "on") : "";
          });
        } else if (c.kind === "lanes") {
          v.lanes.forEach((l, i) => {
            const p = P(lt, 0.15 + i * 0.12, 0.8, E.inOutCubic);
            S(l.fill, { sx: p });
            S(l.ok, { o: p >= 1 ? 1 : 0, s: 0.6 + 0.4 * P(lt, 0.95 + i * 0.12, 0.3, E.outBack) });
            S(l.l, { o: P(lt, 0.05 + i * 0.08, 0.25) });
          });
        } else if (c.kind === "sockets") {
          v.lines.forEach((l, i) => {
            const a = 0.1 + i * 0.22;
            S(l, { o: P(lt, a, 0.2) });
            l.classList.toggle("hit", lt > a + 0.18);
          });
        } else if (c.kind === "term") {
          const cmd1 = "PS> .\\install.ps1", cmd2 = "PS> .\\run.bat --mock";
          const n1 = Math.floor(clamp((lt - 0.1) / 0.5) * cmd1.length), n2 = Math.floor(clamp((lt - 0.85) / 0.5) * cmd2.length);
          const caret = Math.floor(lt * 4) % 2 ? "" : "▌";
          v.l1.textContent = cmd1.slice(0, n1) + (lt < 0.85 ? caret : "");
          v.l2.textContent = lt > 0.85 ? cmd2.slice(0, n2) + caret : "";
        } else if (c.kind === "browser") {
          S(v.cap, { o: P(lt, 0.3, 0.3) });
          S(v.tr, { o: P(lt, 0.7, 0.3), y: (1 - P(lt, 0.7, 0.4, E.outCubic)) * 8 });
          S(v.rtf, { o: P(lt, 0.9, 0.3) });
          S(v.off, { o: P(lt, 1.05, 0.3) });
        } else if (c.kind === "notes") {
          v.rows.forEach((r, i) => S(r, { o: P(lt, 0.12 + i * 0.06, 0.25), x: (1 - P(lt, 0.12 + i * 0.06, 0.4, E.outExpo)) * 20 }));
          S(v.doc, { ry: (1 - P(lt, 0, 0.6, E.outExpo)) * -40 });
        }
      });
    },
  });
})();
