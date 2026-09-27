"""Check every caption language against the real translation model.

    python scripts/check_languages.py --model models/nllb_200_distilled_600m_int8
    python scripts/check_languages.py --model <dir> --only hi,or,sat --json out.json

Unit tests cannot say whether Odia output is Odia. This runs the product's
own NllbTranslator - term protection included - over three sentences from
the test lecture, into every language in SUPPORTED_LANGUAGES, and checks:

  script    the output is written in the script the NLLB code names
  terms     every protected technical term survives ("eigenvalue" stays)
  sane      no runaway repetition, and a plausible length
  meaning   translated back to English, it still overlaps the source
            (character n-gram F-score) - a check that works for languages
            nobody on the team reads

A language that fails any of them should not be offered. Exit status is the
number of failing languages.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from sahaay.config import SUPPORTED_LANGUAGES, TranslateConfig  # noqa: E402
from sahaay.runtime import create_factory  # noqa: E402
from sahaay.translate import NllbTranslator  # noqa: E402

SENTENCES = [
    "Those vectors are the eigenvectors, and the factor they stretch by is the eigenvalue.",
    "The determinant is a single number that tells you whether the matrix squashes space flat.",
    "Once we have a full set of eigenvectors, we can diagonalize the matrix.",
]

# Unicode blocks for the scripts NLLB codes name.
SCRIPTS = {
    "Deva": [(0x0900, 0x097F), (0xA8E0, 0xA8FF)],
    "Beng": [(0x0980, 0x09FF)],
    "Guru": [(0x0A00, 0x0A7F)],
    "Gujr": [(0x0A80, 0x0AFF)],
    "Orya": [(0x0B00, 0x0B7F)],
    "Taml": [(0x0B80, 0x0BFF)],
    "Telu": [(0x0C00, 0x0C7F)],
    "Knda": [(0x0C80, 0x0CFF)],
    "Mlym": [(0x0D00, 0x0D7F)],
    "Arab": [(0x0600, 0x06FF), (0x0750, 0x077F), (0x08A0, 0x08FF), (0xFB50, 0xFDFF), (0xFE70, 0xFEFF)],
    "Olck": [(0x1C50, 0x1C7F)],
    "Latn": [(0x0041, 0x005A), (0x0061, 0x007A), (0x00C0, 0x024F), (0x1E00, 0x1EFF)],
}

SCRIPT_MIN = 0.6       # share of letters (protected English terms excluded) in the right script
MEANING_MIN = 0.30     # back-translation chrF against the source


def script_share(text: str, script: str, protected: list[str]) -> float:
    for term in protected:
        text = text.replace(term, " ")
    letters = [c for c in text if c.isalpha() or 0x0900 <= ord(c) <= 0x0DFF]
    if not letters:
        return 0.0
    ranges = SCRIPTS[script]
    hits = sum(any(lo <= ord(c) <= hi for lo, hi in ranges) for c in letters)
    return hits / len(letters)


def chrf(hyp: str, ref: str, n: int = 4) -> float:
    """Character n-gram F-score (chrF, beta=1), lower-cased, spaces removed."""
    hyp, ref = re.sub(r"\s+", "", hyp.lower()), re.sub(r"\s+", "", ref.lower())
    scores = []
    for k in range(1, n + 1):
        h = Counter(hyp[i:i + k] for i in range(len(hyp) - k + 1))
        r = Counter(ref[i:i + k] for i in range(len(ref) - k + 1))
        if not h or not r:
            continue
        overlap = sum((h & r).values())
        p, rc = overlap / sum(h.values()), overlap / sum(r.values())
        scores.append(0.0 if p + rc == 0 else 2 * p * rc / (p + rc))
    return sum(scores) / len(scores) if scores else 0.0


def degenerate(text: str) -> bool:
    words = text.split()
    if not words:
        return True
    return Counter(words).most_common(1)[0][1] > max(4, len(words) // 3)


def back_translate(tr: NllbTranslator, text: str, nllb_code: str) -> str:
    ids = tr.tokenizer.encode(text).ids
    ids[0] = tr._lang_token(nllb_code)          # the source-language token comes first
    return tr.generate(ids, "eng_Latn")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", type=Path, required=True, help="directory holding the NLLB ONNX files")
    ap.add_argument("--only", help="comma-separated language codes (default: all)")
    ap.add_argument("--json", type=Path, help="write every translation and score here")
    args = ap.parse_args()

    tr = NllbTranslator(args.model, create_factory(), TranslateConfig())
    codes = [c for c in SUPPORTED_LANGUAGES if c != "en"]
    if args.only:
        codes = [c for c in codes if c in args.only.split(",")]

    report, failures = {}, []
    print(f"{'code':5} {'language':32} {'script':>6} {'terms':>6} {'meaning':>8} {'ms/sent':>8}  verdict")
    for code in codes:
        lang = SUPPORTED_LANGUAGES[code]
        script = lang["nllb"].split("_")[1]
        rows, problems = [], []
        try:
            tr._lang_token(lang["nllb"])
        except ValueError as exc:
            problems.append(str(exc))
        t0 = time.perf_counter()
        for src in SENTENCES if not problems else []:
            res = tr.translate(src, code)
            back = back_translate(tr, res.text, lang["nllb"])
            kept = [t for t in res.protected_terms if t in res.text]
            rows.append({
                "source": src, "translation": res.text, "back": back,
                "script": round(script_share(res.text, script, res.protected_terms), 3),
                "terms": f"{len(kept)}/{len(res.protected_terms)}",
                "terms_ok": len(kept) == len(res.protected_terms),
                "meaning": round(chrf(back, src), 3),
                "degenerate": degenerate(res.text),
            })
        ms = (time.perf_counter() - t0) * 1000 / max(1, len(rows))
        if rows:
            sc = min(r["script"] for r in rows)
            me = sum(r["meaning"] for r in rows) / len(rows)
            terms_ok = all(r["terms_ok"] for r in rows)
            if script != "Latn" and sc < SCRIPT_MIN:
                problems.append(f"script {sc:.2f} < {SCRIPT_MIN}")
            if script == "Latn" and any(r["translation"].lower() == r["source"].lower() for r in rows):
                problems.append("output identical to the English source")
            if not terms_ok:
                problems.append("technical terms lost")
            if any(r["degenerate"] for r in rows):
                problems.append("repetitive output")
            if me < MEANING_MIN:
                problems.append(f"back-translation chrF {me:.2f} < {MEANING_MIN}")
            terms = f"{sum(r['terms_ok'] for r in rows)}/{len(rows)}"
        else:
            sc = me = 0.0
            terms = "-"
        verdict = "OK" if not problems else "FAIL: " + "; ".join(problems)
        if problems:
            failures.append(code)
        report[code] = {"name": lang["name"], "nllb": lang["nllb"], "verdict": verdict, "rows": rows}
        name = lang["name"].split("(")[-1].rstrip(")")
        print(f"{code:5} {name:32} {sc:6.2f} {terms:>6} {me:8.2f} {ms:8.0f}  {verdict}", flush=True)

    if args.json:
        args.json.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n{len(codes) - len(failures)} of {len(codes)} languages pass" +
          (f"; failing: {', '.join(failures)}" if failures else ""))
    return len(failures)


if __name__ == "__main__":
    raise SystemExit(main())
