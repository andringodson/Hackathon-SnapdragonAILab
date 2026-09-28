/* Sahaay, running in the visitor's browser.
 *
 * The desktop app's claim is that a student's lecture never leaves their
 * machine. A hosted demo normally contradicts that: you upload audio to a
 * server and it sends captions back. This page does not. Whisper is fetched
 * once from a CDN and executed here, in the tab, on the visitor's own
 * silicon - WebGPU where the browser has it, WASM where it does not. The
 * audio never goes anywhere.
 *
 * So this is the same argument as the product, on hardware anyone already
 * has, which is why it belongs on the public site while the pipeline itself
 * does not.
 *
 * Like replay.js, it swaps the transport and nothing else: app.js - the
 * product's own UI, copied byte for byte by scripts/build_web.py - boots
 * normally, asks for /api/status, opens a socket, and renders what arrives.
 * What arrives here is produced by real inference a few centimetres away
 * instead of by a recording.
 *
 * Translation into Indian languages is here too, with the model the desktop
 * app ships (NLLB-200, in translate-worker.js). It is about 900 MB, so it is
 * fetched only when a visitor picks a language, never on page load.
 *
 * What it is NOT: the desktop pipeline. There is no NPU in a browser, and no
 * system-audio loopback without the visitor sharing a tab. The banner says so
 * rather than letting the page imply otherwise.
 */

(function () {
  "use strict";

  const realFetch = window.fetch.bind(window);

  // Pinned rather than floating: a major version of the runtime landing
  // overnight must not be able to break a page someone is presenting from.
  const MODEL = "onnx-community/whisper-base";

  const RATE = 16000;
  const FRAME = 512;                 // 32 ms, same frame the product uses
  const SILENCE_FLUSH_MS = 700;      // sahaay/config.py AudioConfig
  const MIN_SEGMENT_S = 1.0;
  const MAX_SEGMENT_S = 12.0;
  const SPEECH_RMS = 0.012;          // energy gate; Silero is not worth 2 MB here
  const PREROLL_FRAMES = 10;         // 320 ms kept from before speech starts

  // Whisper's encoder always processes a full 30 s window, whatever length
  // of audio it is given - so two 3 s sentences cost two encoder passes, and
  // the same six seconds as one call cost one. When inference falls behind,
  // merging the backlog is nearly free throughput; dropping it, which this
  // did before, threw sentences away to save work that merging avoids.
  const MERGE_MAX_S = 27;            // stay inside the 30 s window
  const MERGE_GAP_S = 0.15;          // a breath between merged sentences
  const HARD_BACKLOG = 8;            // only past this is anything dropped

  const L = {
    socket: null,
    ctx: null,
    stream: null,
    node: null,
    transcriber: null,
    backend: "wasm",
    running: false,
    index: 0,
    glossary: null,
    seen: new Set(),
    firstWords: new Map(),   // caption index -> when its translation's first words showed
    // Segmentation state
    buffer: [],
    bufferLen: 0,
    silentFor: 0,
    speaking: false,
    queue: [],
    busy: false,
    levelSentAt: 0,
    pre: [],
    // Translation
    target: "en",
    languages: [],
    worker: null,
    workerReady: false,
    trFiles: {},
    lastCaption: null,
  };

  // Read-only timings, for scripts/bench_live.py and for anyone opening the
  // console. Changing nothing; measuring everything the visitor feels:
  // how long Start takes to become "listening", how long each caption took,
  // and how many segments were dropped because inference fell behind.
  const METRICS = {
    clickAt: 0, readyAt: 0, captions: [], dropped: 0, merged: 0, threads: 0,
    translations: [], translationsDropped: 0, translatorThreads: 0,
  };
  window.sahaayLive = METRICS;

  // Inference alone, on a clip the caller supplies, N times. The full-lecture
  // benchmark measures what a visitor feels, but on a laptop in use it is
  // too noisy to attribute a speed change to one cause; this isolates the
  // model call. Used by scripts/bench_live.py --inference.
  window.sahaayBench = async function (samples, runs) {
    await loadModel();
    const audio = Float32Array.from(samples);
    const times = [];
    for (let i = 0; i < runs; i++) {
      const t = performance.now();
      await L.transcriber(audio, { return_timestamps: false });
      times.push(performance.now() - t);
    }
    return {
      times,
      threads: METRICS.threads,
      isolated: self.crossOriginIsolated === true,
      backend: L.backend,
    };
  };

  /* ---------- talking to app.js ---------- */

  function json(body) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  function emit(event) {
    if (L.socket && L.socket.onmessage) {
      L.socket.onmessage({ data: JSON.stringify(event) });
    }
  }

  function status(text, tone) {
    const el = document.getElementById("live-status");
    if (el) {
      el.textContent = text ? text + " " : "";
      el.style.color = tone === "bad" ? "var(--danger)" : "";
    }
  }

  // Exported from sahaay/config.py by scripts/build_web.py, so the browser
  // offers exactly the languages the desktop app does.
  const languagesReady = realFetch("../static/languages.json")
    .then((r) => r.json())
    .then((list) => { L.languages = list; })
    .catch((err) => console.warn("no language list; captions only", err));

  function device() {
    // Honest about what is executing. The desktop badge names an ONNX
    // Runtime execution provider; this one names the browser backend, and
    // npu_active stays false because a browser has no Hexagon.
    const label = L.backend === "webgpu" ? "WebGPU (your GPU)" : "WASM (your CPU)";
    return {
      provider: L.backend === "webgpu" ? "WebGPU" : "WASM",
      provider_label: label,
      available_providers: L.backend === "webgpu" ? ["WebGPU", "WASM"] : ["WASM"],
      ort_version: "transformers.js",
      machine: navigator.platform || "browser",
      processor: navigator.userAgent.slice(0, 60),
      is_arm64: /arm|aarch64/i.test(navigator.userAgent),
      npu_active: false,
      fallback_reason: "Running in a browser: no Hexagon NPU.",
      qnn_hardware: null,
    };
  }

  /* ---------- fetch + WebSocket stubs ---------- */

  window.fetch = async function (input, init) {
    const url = String(typeof input === "string" ? input : input.url);
    if (!url.startsWith("/api/")) return realFetch(input, init);

    if (url === "/api/status") {
      await languagesReady;
      return json({
        running: L.running,
        mock: false,
        device: device(),
        target_language: L.target,
        // English first and selected: the translation model is only
        // downloaded when someone asks for a language.
        languages: [{ code: "en", name: "English (captions only)" }].concat(
          L.languages.map((l) => ({ code: l.code, name: l.name }))
        ),
      });
    }
    if (url === "/api/start") {
      try {
        await start();
        return json({ ok: true, running: true });
      } catch (err) {
        status(String((err && err.message) || err), "bad");
        return json({ ok: false, error: String((err && err.message) || err) });
      }
    }
    if (url === "/api/stop") {
      await stop();
      return json({ ok: true, running: false, saved: false });
    }
    if (url.startsWith("/api/language/")) {
      const code = decodeURIComponent(url.split("/").pop());
      setLanguage(code);
      return json({ ok: true, target_language: L.target });
    }
    return json({ ok: false, error: "not available in the browser build" });
  };

  class LiveSocket {
    constructor() {
      this.readyState = 1;
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;
      L.socket = this;
      setTimeout(() => this.onopen && this.onopen({}), 0);
    }
    send() {}
    close() {
      this.readyState = 3;
      // No onclose: app.js reconnects on close, and a reconnect loop
      // against a socket that does not exist would spin forever.
    }
  }
  window.WebSocket = LiveSocket;

  /* ---------- translation, in a worker ---------- */

  function languageName(code) {
    const l = L.languages.find((x) => x.code === code);
    return l ? l.name : code;
  }

  function setLanguage(code) {
    if (code === "en" || !L.languages.some((l) => l.code === code)) {
      L.target = "en";
      // Switching back while the model is still downloading cancels it.
      if (L.worker && !L.workerReady) {
        L.worker.terminate();
        L.worker = null;
        status("");
      }
      return;
    }
    L.target = code;
    startTranslator();
    // Show the switch on the line already on screen, not only the next one.
    if (L.lastCaption) translate(L.lastCaption.index, L.lastCaption.text);
  }

  function startTranslator() {
    if (L.worker) return;
    L.workerReady = false;
    L.trFiles = {};
    const worker = new Worker("../static/translate-worker.js", { type: "module" });
    L.worker = worker;
    const bar = document.getElementById("live-bar");
    status("downloading the translation model (NLLB-200, about 900 MB, once)…");

    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") {
        L.trFiles[m.file] = m;
        const files = Object.values(L.trFiles);
        const loaded = files.reduce((a, f) => a + f.loaded, 0);
        const total = files.reduce((a, f) => a + f.total, 0);
        const pct = total ? Math.round((loaded / total) * 100) : 0;
        if (bar) bar.style.width = pct + "%";
        status(`downloading the translation model (NLLB-200, ${Math.round(total / 1e6)} MB, once) ${pct}%`);
      } else if (m.type === "ready") {
        L.workerReady = true;
        METRICS.translatorThreads = m.threads;
        if (bar) bar.style.width = "100%";
        status(L.running ? "listening" : "translation ready");
      } else if (m.type === "partial") {
        // The words decoded so far, shown as they arrive; the finished line replaces them.
        if (m.code !== L.target) return;
        if (!L.firstWords.has(m.id)) L.firstWords.set(m.id, performance.now());
        emit({ kind: "translation", index: m.id, text: m.text, target_language: m.code, partial: true, passthrough: false });
      } else if (m.type === "translation") {
        METRICS.translations.push({
          index: m.id, code: m.code, ms: m.ms, at: performance.now(),
          first: L.firstWords.has(m.id) ? L.firstWords.get(m.id) : null,
        });
        L.firstWords.delete(m.id);
        emit({
          kind: "translation",
          index: m.id,
          text: m.text,
          target_language: m.code,
          latency_ms: m.ms,
          passthrough: false,
          protected_terms: m.terms,
        });
      } else if (m.type === "dropped") {
        METRICS.translationsDropped++;
      } else if (m.type === "error") {
        emit({ kind: "error", message: "Translation could not run here: " + m.message });
        status("");
        worker.terminate();
        L.worker = null;
        L.target = "en";
      }
    };
    worker.postMessage({ type: "load", threads: translatorThreads() });
  }

  /* ---------- one CPU, two models ---------- */
  // Whisper and the translator run in separate workers with separate thread
  // pools, so their thread counts add up. Measured on 12 cores over 100 s of
  // lecture into Hindi, translation streaming (Whisper + translator threads:
  // caption to first translated words median / p90, to the finished line
  // median / p90, Whisper RTF while translating):
  //   8 + 6   3.5 / 8.8 s   7.8 / 12.1 s   0.72   (14 threads on 12 cores)
  //   6 + 8   1.4 / 3.5 s   5.6 / 7.3 s    0.64
  //   7 + 5   1.5 / 3.4 s   5.9 / 7.4 s    0.60
  //   6 + 6   1.3 / 3.1 s   4.6 / 6.7 s    0.58
  //   8 + 4   1.4 / 4.1 s   5.1 / 7.8 s    0.49
  // Oversubscribing the cores slowed both models. Whisper keeps its threads -
  // the English caption is what is read live, and English-only needs them -
  // and the translator gets the cores that are left, from two to six.
  const TUNING = new URLSearchParams(location.search);   // ?wt=N&tt=N override, for tuning runs
  function whisperThreads() {
    const wt = Number(TUNING.get("wt"));
    return wt > 0 ? wt : Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  }
  function translatorThreads() {
    const tt = Number(TUNING.get("tt"));
    if (tt > 0) return tt;
    return Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - whisperThreads()));
  }

  function translate(index, text) {
    if (!L.worker) startTranslator();
    const l = L.languages.find((x) => x.code === L.target);
    if (!l) return;
    L.worker.postMessage({ type: "translate", id: index, text, code: l.code, nllb: l.nllb });
  }

  /* ---------- the glossary, same vocabulary as the desktop fallback ---------- */

  async function loadGlossary() {
    if (L.glossary) return;
    try {
      L.glossary = await (await realFetch("../static/glossary.json")).json();
    } catch (_) {
      L.glossary = {};
    }
  }

  // Ported from sahaay.llm.seed_entry. A lecture says "diagonalization";
  // the glossary stores "diagonalize", and exact lookup misses it.
  function seedEntry(word) {
    const w = word.toLowerCase().replace(/^-+|-+$/g, "");
    if (L.glossary[w]) return [w, L.glossary[w]];

    const candidates = [];
    for (const suffix of ["s", "es", "ed", "ing"]) {
      if (w.endsWith(suffix)) {
        const stem = w.slice(0, -suffix.length);
        candidates.push(stem, stem + "e");
      }
    }
    for (const [suffix, replacement] of [
      ["ization", "ize"], ["isation", "ise"], ["ation", "ate"],
    ]) {
      if (w.endsWith(suffix)) candidates.push(w.slice(0, -suffix.length) + replacement);
    }
    if (w.endsWith("ices")) candidates.push(w.slice(0, -4) + "ix");

    for (const c of candidates) {
      if (L.glossary[c]) return [c, L.glossary[c]];
    }
    return [w, null];
  }

  function explainJargon(text) {
    for (const word of text.match(/[A-Za-z][A-Za-z-]{3,}/g) || []) {
      const [canonical, explanation] = seedEntry(word);
      if (!explanation || L.seen.has(canonical)) continue;
      L.seen.add(canonical);
      emit({
        kind: "gloss",
        term: canonical,
        explanation,
        language: "en",
        source_line: text,
        latency_ms: 0,
        backend: "seeded vocabulary (in-browser)",
      });
    }
  }

  /* ---------- audio ---------- */

  async function openStream(sourceKind) {
    if (sourceKind === "tab") {
      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error("This browser cannot share tab audio. Use the microphone.");
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false },
      });
      if (!stream.getAudioTracks().length) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error(
          'No audio in that share. Re-pick the tab and tick "Also share tab audio".'
        );
      }
      // The video track is only the price of admission for tab audio.
      stream.getVideoTracks().forEach((t) => t.stop());
      return stream;
    }
    return navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  }

  function sourceKind() {
    const select = document.getElementById("live-source-select");
    return select ? select.value : "mic";
  }

  /* ---------- segmentation: the product's rules, in JS ---------- */

  function onFrame(frame) {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    const rms = Math.sqrt(sum / frame.length);

    const now = performance.now();
    if (now - L.levelSentAt >= 200) {
      L.levelSentAt = now;
      emit({ kind: "level", rms: Number(rms.toFixed(5)) });
    }

    const loud = rms > SPEECH_RMS;
    if (loud && !L.speaking) {
      // Speech onset. An energy gate fires late - the consonant that starts
      // a word is quieter than the vowel after it - so without this the
      // first word of a caption was sometimes lost ("morning everyone",
      // "matrix is a linear transformation"). The desktop segmenter keeps
      // 200 ms of pre-roll for the same reason; this keeps 320.
      L.speaking = true;
      for (const f of L.pre) {
        L.buffer.push(f);
        L.bufferLen += f.length;
      }
      L.pre = [];
    }
    if (loud) {
      L.silentFor = 0;
    } else if (L.speaking) {
      L.silentFor += (frame.length / RATE) * 1000;
    }

    if (L.speaking) {
      L.buffer.push(frame);
      L.bufferLen += frame.length;
    } else {
      L.pre.push(frame);
      if (L.pre.length > PREROLL_FRAMES) L.pre.shift();
    }

    const longEnough = L.bufferLen >= MIN_SEGMENT_S * RATE;
    const paused = L.silentFor >= SILENCE_FLUSH_MS;
    const full = L.bufferLen >= MAX_SEGMENT_S * RATE;

    if (L.speaking && ((paused && longEnough) || full)) flush();
    else if (paused && !longEnough) reset();
  }

  function reset() {
    L.buffer = [];
    L.bufferLen = 0;
    L.silentFor = 0;
    L.speaking = false;
  }

  function flush() {
    const audio = new Float32Array(L.bufferLen);
    let at = 0;
    for (const frame of L.buffer) {
      audio.set(frame, at);
      at += frame.length;
    }
    reset();
    L.queue.push(audio);
    drain();
  }

  async function drain() {
    if (L.busy || !L.queue.length) return;
    L.busy = true;
    // Only an absurd backlog loses anything. Below it, see merge below.
    while (L.queue.length > HARD_BACKLOG) {
      L.queue.shift();
      METRICS.dropped += 1;
    }

    // Behind? Take the whole backlog in one call. The encoder pays for 30 s
    // either way, so this turns "falling further behind" into "a slightly
    // longer caption, sooner". Keeping up, the queue holds one item and
    // nothing merges, so latency is untouched when there is headroom.
    let audio = L.queue.shift();
    const gap = new Float32Array(Math.round(MERGE_GAP_S * RATE));
    while (
      L.queue.length &&
      audio.length + gap.length + L.queue[0].length <= MERGE_MAX_S * RATE
    ) {
      const next = L.queue.shift();
      const joined = new Float32Array(audio.length + gap.length + next.length);
      joined.set(audio, 0);
      joined.set(gap, audio.length);
      joined.set(next, audio.length + gap.length);
      audio = joined;
      METRICS.merged += 1;
    }
    const index = L.index++;
    emit({ kind: "partial", text: "…", index });

    const started = performance.now();
    try {
      // No chunk_length_s: that routes the call through the long-audio
      // chunking path, and a segment here is never longer than MERGE_MAX_S,
      // which already fits Whisper's window whole.
      const out = await L.transcriber(audio, { return_timestamps: false });
      const text = (out && out.text ? out.text : "").trim();
      const ms = performance.now() - started;
      const seconds = audio.length / RATE;

      if (text && !/^[\s.]*$/.test(text)) {
        METRICS.captions.push({
          index,
          text,
          at: performance.now(),
          latency_ms: Math.round(ms),
          audio_s: Number(seconds.toFixed(2)),
        });
        emit({
          kind: "caption",
          index,
          text,
          language: "en",
          start_s: 0,
          latency_ms: Math.round(ms),
          rtf: Number((ms / 1000 / seconds).toFixed(3)),
          provider: device().provider,
        });
        L.lastCaption = { index, text };
        if (L.target !== "en") translate(index, text);
        emit({
          kind: "metric",
          uptime_s: 0,
          audio_seconds: seconds,
          realtime_factor: Number((ms / 1000 / seconds).toFixed(3)),
          stages: [],
        });
        await loadGlossary();
        explainJargon(text);
      }
    } catch (err) {
      emit({ kind: "error", message: "Transcription failed: " + err });
    } finally {
      L.busy = false;
      if (L.queue.length) drain();
    }
  }

  /* ---------- lifecycle ---------- */

  // One load, shared. The page starts it the moment it opens, so the minute
  // a first-time visitor used to wait after pressing Start - measured at
  // 55 s cold - is spent while they read the banner instead. Start then
  // awaits the same promise and is instant if it has finished.
  let modelPromise = null;
  function loadModel() {
    if (!modelPromise) {
      modelPromise = loadModelOnce().catch((err) => {
        modelPromise = null;   // let a retry try again
        throw err;
      });
    }
    return modelPromise;
  }

  // Whisper runs in web/static/whisper-worker.js. On this thread it froze
  // the page for up to 2 s per caption (19 s across a 63 s lecture), because
  // ONNX Runtime's WebAssembly backend computes synchronously. L.transcriber
  // keeps its old shape - an async function of audio - so everything that
  // calls it is unchanged; it now posts to the worker and awaits the reply.
  async function loadModelOnce() {
    if (L.transcriber) return;

    status("fetching Whisper (about 80 MB, cached after this)…");
    const progress = document.getElementById("live-bar");
    const threads = whisperThreads();
    const worker = new Worker("../static/whisper-worker.js", { type: "module" });
    const pending = new Map();
    const files = {};
    let nextId = 0;

    await new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === "progress") {
          files[m.file] = m;
          const all = Object.values(files);
          const loaded = all.reduce((a, f) => a + f.loaded, 0);
          const total = all.reduce((a, f) => a + f.total, 0);
          if (progress && total) progress.style.width = Math.round((loaded / total) * 100) + "%";
        } else if (m.type === "ready") {
          if (progress) progress.style.width = "100%";
          L.backend = m.backend;
          METRICS.threads = m.threads;
          METRICS.loadTimings = m.timings;
          resolve();
        } else if (m.type === "warm") {
          METRICS.loadTimings = m.timings;
        } else if (m.type === "error") {
          reject(new Error(m.message));
        } else if (m.type === "result") {
          const job = pending.get(m.id);
          pending.delete(m.id);
          if (job) (m.error ? job.reject(new Error(m.error)) : job.resolve({ text: m.text }));
        }
      };
      worker.onerror = (e) => reject(new Error(e.message || "Whisper worker failed"));
      worker.postMessage({ type: "load", threads });
    });

    L.transcriber = (audio) => new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      // Copied, not transferred: callers read audio.length afterwards.
      worker.postMessage({ type: "run", id, audio, threads });
    });
    if (!L.running) status("ready — press Start");
  }

  async function start() {
    METRICS.clickAt = performance.now();
    await loadModel();

    L.stream = await openStream(sourceKind());
    L.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: RATE });
    const source = L.ctx.createMediaStreamSource(L.stream);

    // Capture on the audio thread. Whisper blocks the main thread for
    // seconds at a time, and a ScriptProcessorNode - which delivers on the
    // main thread - simply stops recording while that happens: measured as
    // whole sentences missing from the transcript.
    let captured = false;
    if (L.ctx.audioWorklet) {
      try {
        await L.ctx.audioWorklet.addModule("../static/capture-worklet.js");
        L.node = new AudioWorkletNode(L.ctx, "sahaay-capture");
        L.node.port.onmessage = (e) => {
          if (L.running) onFrame(e.data);
        };
        captured = true;
      } catch (err) {
        console.warn("AudioWorklet unavailable, falling back", err);
      }
    }
    if (!captured) {
      // Older Safari. Loses audio under load, but captions beat nothing.
      L.node = L.ctx.createScriptProcessor(4096, 1, 1);
      L.node.onaudioprocess = (e) => {
        if (!L.running) return;
        const input = e.inputBuffer.getChannelData(0);
        for (let at = 0; at + FRAME <= input.length; at += FRAME) {
          onFrame(input.slice(at, at + FRAME));
        }
      };
    }

    source.connect(L.node);
    // Destination gain of zero: the node needs a sink, and routing the
    // microphone back to the speakers would make the room howl.
    const mute = L.ctx.createGain();
    mute.gain.value = 0;
    L.node.connect(mute);
    mute.connect(L.ctx.destination);

    L.running = true;
    reset();
    METRICS.readyAt = performance.now();
    status("listening");
    emit({ kind: "status", running: true, device: device() });
  }

  async function stop() {
    L.running = false;
    status("");
    if (L.node) L.node.disconnect();
    if (L.ctx) await L.ctx.close().catch(() => {});
    if (L.stream) L.stream.getTracks().forEach((t) => t.stop());
    L.node = L.ctx = L.stream = null;
    emit({ kind: "status", running: false, device: device() });
  }

  /* ---------- injected controls ---------- */

  function addSourcePicker() {
    // scripts/build_web.py writes the picker and the progress bar into the
    // page; this only fills in for a page built without them.
    if (document.getElementById("live-source-select")) return;
    const bar = document.querySelector(".bar-right");
    if (!bar) return;
    const wrap = document.createElement("label");
    wrap.className = "live-source";
    wrap.innerHTML =
      "<span>Listen to</span>" +
      '<select id="live-source-select">' +
      '<option value="mic">Microphone</option>' +
      '<option value="tab">A browser tab</option>' +
      "</select>";
    bar.insertBefore(wrap, bar.firstChild);

    const banner = document.querySelector(".live-banner");
    if (banner) {
      const bar2 = document.createElement("div");
      bar2.className = "live-progress";
      bar2.innerHTML = '<span id="live-bar"></span>';
      banner.appendChild(bar2);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    addSourcePicker();
    loadGlossary();

    // Start fetching and warming Whisper now, not on Start. A visitor
    // spends the first half-minute reading the banner; this spends it
    // downloading. Failures surface when Start awaits the same promise.
    loadModel().catch((err) => {
      console.warn("preload failed; Start will retry", err);
      status("");
    });
  });
})();
