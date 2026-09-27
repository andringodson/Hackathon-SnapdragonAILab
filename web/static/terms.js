/* Technical-term protection for translation, in the browser.
 *
 * A line-for-line port of sahaay.translate.TermProtector, so /live keeps
 * "eigenvalue" as eigenvalue in exactly the cases the desktop app does:
 * acronyms, CamelCase, numbers with units, and the seeded STEM vocabulary
 * (with plurals and -ed/-ing). Spans are swapped for sentinels the model
 * leaves alone, then put back. tests/test_terms_js.py runs this file under
 * Node against the Python original, so the two cannot drift.
 *
 * A plain script, not a module: the translation worker imports it for its
 * side effect (globalThis.SahaayTerms) and Node requires it.
 */
(function (root) {
  "use strict";

  const UNITS =
    "ms|us|ns|s|min|h|Hz|kHz|MHz|GHz|" +
    "mm|cm|m|km|nm|um|" +
    "mg|g|kg|" +
    "V|mV|A|mA|W|kW|J|kJ|N|Pa|kPa|" +
    "K|C|F|" +
    "b|B|KB|MB|GB|TB|bit|bits|byte|bytes|" +
    "TOPS|FLOPS|px|dB|deg|rad";

  const ACRONYM = /\b[A-Z]{2,6}\b/g;
  const CAMEL = /\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/g;
  const NUMERIC = new RegExp(`\\b\\d+(?:\\.\\d+)?(?:\\s?(?:${UNITS})|%)?\\b`, "g");
  const WORD = /[A-Za-z][A-Za-z-]{3,}/g;
  const SENTINEL = (i) => `Qx${i}z`;

  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  class TermProtector {
    constructor(extraTerms) {
      this.extra = new Set((extraTerms || []).map((t) => t.toLowerCase()));
    }

    isProtected(word) {
      const w = word.toLowerCase().replace(/^-+|-+$/g, "");
      if (this.extra.has(w)) return true;
      for (const suffix of ["s", "es", "ed", "ing"]) {
        if (!w.endsWith(suffix)) continue;
        const stem = w.slice(0, -suffix.length);
        if (this.extra.has(stem) || this.extra.has(stem + "e")) return true;
      }
      // "diagonalization" -> "diagonalize"
      for (const suffix of ["ization", "isation", "izations", "isations"]) {
        if (w.endsWith(suffix) && this.extra.has(w.slice(0, -suffix.length) + "ize")) return true;
      }
      return w.endsWith("ices") && this.extra.has(w.slice(0, -4) + "ix");
    }

    protect(text) {
      const spans = [];
      for (const re of [ACRONYM, CAMEL, NUMERIC]) {
        for (const m of text.matchAll(re)) spans.push(m[0]);
      }
      for (const m of text.matchAll(WORD)) {
        if (this.isProtected(m[0])) spans.push(m[0]);
      }

      const mapping = {};
      let out = text;
      // Longest first, so "SVD matrix" is not half-replaced.
      const unique = [...new Set(spans)].sort((a, b) => b.length - a.length);
      unique.forEach((span, i) => {
        const token = SENTINEL(i);
        mapping[token] = span;
        out = out.replace(new RegExp(`(?<![A-Za-z0-9_])${escape(span)}(?![A-Za-z0-9_])`, "g"), token);
      });
      return [out, mapping];
    }

    static restore(text, mapping) {
      for (const [token, original] of Object.entries(mapping)) {
        // Models sometimes alter the sentinel's case or spacing.
        text = text.replace(new RegExp(escape(token), "gi"), () => original);
        text = text.replace(new RegExp(escape(token.replace("z", " z")), "gi"), () => original);
      }
      return text;
    }
  }

  // Translation loops: sahaay.translate.collapse_loops, same patterns. Four
  // or more repeats of a word run become two (Indian languages reduplicate
  // on purpose - "بار بار" is "repeatedly"), a syllable repeated four or more
  // times becomes one. \p{Nd} rather than \d: Python's \d covers every
  // script's digits, and "१००००" must stay ten thousand.
  const LOOP_WORDS = /(^|\s)(\S+(?:\s+\S+){0,5}?)(?:\s+\2){3,}(?=\s|$)/gu;
  const LOOP_CHARS = /([^\s\p{Nd}]{1,6}?)\1{3,}/gu;

  function collapseLoops(text) {
    return text.replace(LOOP_CHARS, "$1").replace(LOOP_WORDS, "$1$2 $2").trim();
  }

  const api = { TermProtector, collapseLoops };
  root.SahaayTerms = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : self);
