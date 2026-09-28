/* Caption translation for /live, in a worker.
 *
 * The same model the desktop app ships - NLLB-200 distilled 600M - at the
 * smallest quantisation transformers.js publishes (q8: a 419 MB encoder and
 * a 475 MB decoder, cached by the browser after the first download; the 4-bit
 * builds are larger, because the 256k-word vocabulary is not quantised). It is
 * only fetched when a visitor picks a language, never on page load.
 *
 * It runs here, off the main thread, so the page stays responsive while a
 * sentence is translated, and with the cores Whisper leaves free (live.js):
 * the English caption is what the student reads live, and translation
 * follows it, as it does on the desktop.
 *
 * Each caption is streamed: shown word by word as it is decoded, so the line
 * starts appearing about a second after its turn comes instead of when the
 * last word is done. Captions are translated one at a time. Batching them
 * was tried and measured worse on both counts: with padding, the shorter
 * sentences of a batch came back partly in the wrong script, and three
 * queued captions took 23 s instead of 12.
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
let Streamer = null;
let loading = null;
let protector = null;
let busy = false;
const queue = [];

function load(threads) {
  if (!loading) {
    loading = (async () => {
      const glossary = await (await fetch("glossary.json")).json();
      protector = new self.SahaayTerms.TermProtector(Object.keys(glossary));

      const { pipeline, env, TextStreamer } = await import(TRANSFORMERS);
      Streamer = TextStreamer;
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

/** Finished text for display: placeholders back to terms, loops collapsed. */
function finish(text, mapping) {
  return self.SahaayTerms.collapseLoops(self.SahaayTerms.TermProtector.restore(text, mapping));
}

async function drain() {
  if (busy || !translator) return;
  busy = true;
  try {
    for (;;) {
      // A translation holds this thread until its last word, so captions
      // that arrived meanwhile are still undelivered messages. Let them in
      // first: until they were, the backlog rule below never saw more than
      // one caption, and a backlog grew without limit in the browser.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const job = queue.shift();
      if (!job) break;
      const t0 = performance.now();
      const [text, mapping] = protector.protect(job.text);
      // A loop runs to the token limit and holds up every caption behind it
      // (41-50 s each, measured). No real translation needed more than 2.5x
      // the input's tokens, so cap at 3x + 16, as the desktop does.
      const inputTokens = translator.tokenizer(text).input_ids.dims.at(-1);
      let sofar = "";
      const streamer = new Streamer(translator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (piece) => {
          if (!piece) return;
          sofar += piece;
          // Never show half a placeholder; the streamer already holds back half-words.
          const shown = finish(sofar, mapping).replace(/\s*Qx\d*$/i, "").trim();
          if (shown) postMessage({ type: "partial", id: job.id, code: job.code, text: shown });
        },
      });
      const out = await translator(text, {
        src_lang: "eng_Latn",
        tgt_lang: job.nllb,
        max_new_tokens: Math.min(256, 3 * inputTokens + 16),
        streamer,
      });
      postMessage({
        type: "translation",
        id: job.id,
        code: job.code,
        text: finish(out[0].translation_text, mapping),
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
    // A new language makes whatever is waiting in the old one stale: it would
    // hold the switch up by about five seconds a caption.
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].nllb !== m.nllb) postMessage({ type: "dropped", id: queue.splice(i, 1)[0].id });
    }
    queue.push(m);
    while (queue.length > MAX_BACKLOG) postMessage({ type: "dropped", id: queue.shift().id });
    drain();
  }
};
