/* Whisper for /live, in a worker.
 *
 * It used to run on the page's main thread. ONNX Runtime's WebAssembly
 * backend computes synchronously, so every caption froze the page for its
 * whole inference: measured at 16 freezes and 19 s blocked across a 63 s
 * lecture, the longest 2.0 s. Clicks, the caption list, the level meter and
 * the audio frames themselves waited behind it. Here, nothing waits.
 *
 * The loading logic is unchanged from live.js: probe for a WebGPU adapter
 * rather than try/catch the pipeline, pick precision per backend by
 * measurement, and pay graph setup with a warm-up before the lecture.
 */

const TRANSFORMERS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5";
const MODEL = "onnx-community/whisper-base";
const RATE = 16000;

let transcriber = null;
let loading = null;
// Inferences run one at a time, in order: the session is not re-entrant, and
// the warm-up must finish before the first real caption uses the graph.
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

async function webgpuAvailable() {
  if (!("gpu" in navigator)) return false;
  try {
    return Boolean(await navigator.gpu.requestAdapter());
  } catch (_) {
    return false;
  }
}

function load(threads) {
  if (!loading) {
    loading = (async () => {
      const t0 = performance.now();
      const { pipeline, env } = await import(TRANSFORMERS);
      const tImport = performance.now();
      env.allowLocalModels = false;
      const wasm = env.backends && env.backends.onnx && env.backends.onnx.wasm;
      if (wasm && self.crossOriginIsolated) wasm.numThreads = threads;

      const backend = (await webgpuAvailable()) ? "webgpu" : "wasm";
      // Precision per backend, measured by scripts/bench_live.py (see the
      // table in docs/TUNING.md): fp32 encoder + q4 decoder on the GPU,
      // q8 on the CPU, with q8 / fp32 as the fallbacks.
      const dtypes = backend === "webgpu"
        ? [{ encoder_model: "fp32", decoder_model_merged: "q4" }, "q8"]
        : ["q8", "fp32"];
      let failure = null;
      for (const dtype of dtypes) {
        try {
          transcriber = await pipeline("automatic-speech-recognition", MODEL, {
            device: backend,
            dtype,
            progress_callback: (p) => {
              if (p && p.status === "progress" && p.total) {
                postMessage({ type: "progress", file: p.file, loaded: p.loaded, total: p.total });
              }
            },
          });
          break;
        } catch (err) {
          failure = err;
        }
      }
      if (!transcriber) throw failure || new Error("Whisper would not load");
      const tLoad = performance.now();
      const timings = { import_ms: Math.round(tImport - t0), load_ms: Math.round(tLoad - tImport) };
      // Ready now, warm in the background. The warm-up pays graph setup
      // (2.1-2.3 s measured) and used to hold Start back for all of it. It
      // is queued first, so it still finishes before the first caption - the
      // first sentence cannot end sooner than a second of speech plus 0.7 s
      // of pause - and nobody waits for it.
      serial(() => transcriber(new Float32Array(RATE)).then(() => {
        timings.warmup_ms = Math.round(performance.now() - tLoad);
        postMessage({ type: "warm", timings });
      }));
      postMessage({ type: "ready", backend, threads: (wasm && wasm.numThreads) || 1, timings });
    })().catch((err) => {
      loading = null;
      postMessage({ type: "error", message: String((err && err.message) || err) });
    });
  }
  return loading;
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === "load") {
    load(m.threads);
  } else if (m.type === "run") {
    try {
      await load(m.threads);
      const out = await serial(() => transcriber(m.audio, { return_timestamps: false }));
      postMessage({ type: "result", id: m.id, text: (out && out.text) || "" });
    } catch (err) {
      postMessage({ type: "result", id: m.id, error: String((err && err.message) || err) });
    }
  }
};
