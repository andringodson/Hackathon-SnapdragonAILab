/* Caption translation for /live, in a worker.
 *
 * The same model the desktop app ships - NLLB-200 distilled 600M - at the
 * smallest quantisation transformers.js publishes (q8: a 419 MB encoder and
 * a 475 MB decoder, cached by the browser after the first download). It is
 * only fetched when a visitor picks a language, never on page load.
 *
 * It runs here, off the main thread, so the page stays responsive while a
 * sentence is translated, and with a capped thread count so Whisper keeps
 * most of the CPU: the English caption is what the student reads live, and
 * translation catches up at the next pause, as it does on the desktop.
 *
 * Under pressure the oldest waiting caption is dropped rather than queued
 * forever - the desktop pipeline's rule, because a translation that arrives
 * a minute late is worse than none.
 */
import "./terms.js";

const TRANSFORMERS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5";
const MODEL = "Xenova/nllb-200-distilled-600M";
const MAX_BACKLOG = 3;

let translator = null;
let loading = null;
let protector = null;
let busy = false;
const queue = [];

function load(threads) {
  if (!loading) {
    loading = (async () => {
      const glossary = await (await fetch("glossary.json")).json();
      protector = new self.SahaayTerms.TermProtector(Object.keys(glossary));

      const { pipeline, env } = await import(TRANSFORMERS);
      env.allowLocalModels = false;
      const wasm = env.backends && env.backends.onnx && env.backends.onnx.wasm;
      if (wasm && self.crossOriginIsolated) wasm.numThreads = threads;

      translator = await pipeline("translation", MODEL, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p) => {
          if (p && p.status === "progress" && p.total) {
            postMessage({ type: "progress", file: p.file, loaded: p.loaded, total: p.total });
          }
        },
      });
      // The first call compiles kernels; do it before a caption is waiting.
      await translator("Warm up.", { src_lang: "eng_Latn", tgt_lang: "hin_Deva", max_new_tokens: 8 });
      postMessage({ type: "ready", threads: (wasm && wasm.numThreads) || 1 });
    })().catch((err) => {
      loading = null;
      postMessage({ type: "error", message: String((err && err.message) || err) });
    });
  }
  return loading;
}

async function drain() {
  if (busy || !translator) return;
  busy = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      const t0 = performance.now();
      const [text, mapping] = protector.protect(job.text);
      const out = await translator(text, {
        src_lang: "eng_Latn",
        tgt_lang: job.nllb,
        max_new_tokens: 256,
      });
      postMessage({
        type: "translation",
        id: job.id,
        code: job.code,
        text: self.SahaayTerms.TermProtector.restore(out[0].translation_text, mapping),
        ms: Math.round(performance.now() - t0),
        terms: Object.values(mapping),
      });
    }
  } catch (err) {
    postMessage({ type: "error", message: String((err && err.message) || err) });
  } finally {
    busy = false;
  }
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === "load") {
    await load(m.threads);
    drain();
  } else if (m.type === "translate") {
    queue.push(m);
    while (queue.length > MAX_BACKLOG) postMessage({ type: "dropped", id: queue.shift().id });
    drain();
  }
};
