"""The browser's term protection must match the desktop's.

/live translates in the visitor's browser with web/static/terms.js, a port
of sahaay.translate.TermProtector. If the two drift, "eigenvalue" survives
translation in one and becomes "self value" in the other - the exact bug the
protector exists to prevent. This runs the JavaScript under Node on the same
sentences and compares what each protects. Skipped where Node is missing.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from sahaay.llm import SEED_GLOSSARY
from sahaay.translate import TermProtector

TERMS_JS = Path(__file__).resolve().parent.parent / "web" / "static" / "terms.js"

SENTENCES = [
    "Those vectors are the eigenvectors, and the factor they stretch by is the eigenvalue.",
    "The determinant is a single number that tells you whether the matrix squashes space flat.",
    "Once we have a full set of eigenvectors, we can diagonalize the matrix.",
    "We are diagonalizing it now; the eigenvalues were computed yesterday.",
    "SVD runs in 12 ms on the NPU at 45 TOPS, using 2.5 GB and 30% of the budget.",
    "The LayerNorm and BatchNorm layers must be 0 for a solution to exist.",
    "Backpropagation, overfitting and quantization are next week, with latency and throughput.",
    "Nothing technical here at all, just an ordinary sentence.",
    "Diagonalization turns a hard repeated multiplication into a simple one.",
]

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="Node.js not installed")


def normalise(text: str) -> str:
    # Sentinel numbering follows the order of equal-length spans, which is
    # set order in Python; compare the structure, not the numbers.
    return re.sub(r"Qx\d+z", "Qx#z", text)


def run_js() -> list[dict]:
    script = (
        "const { TermProtector } = require(process.argv[1]);"
        "const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));"
        "const p = new TermProtector(input.terms);"
        "const out = input.sentences.map((s) => {"
        "  const [text, mapping] = p.protect(s);"
        "  return { text, spans: Object.values(mapping), restored: TermProtector.restore(text, mapping) };"
        "});"
        "process.stdout.write(JSON.stringify(out));"
    )
    res = subprocess.run(
        ["node", "-e", script, str(TERMS_JS)],
        input=json.dumps({"terms": list(SEED_GLOSSARY), "sentences": SENTENCES}),
        capture_output=True, text=True, encoding="utf-8", check=True,
    )
    return json.loads(res.stdout)


@pytest.fixture(scope="module")
def js_results():
    return run_js()


@pytest.mark.parametrize("i", range(len(SENTENCES)), ids=[s[:30] for s in SENTENCES])
def test_same_spans_protected(js_results, i):
    py_text, py_map = TermProtector(extra_terms=list(SEED_GLOSSARY)).protect(SENTENCES[i])
    js = js_results[i]
    assert sorted(js["spans"]) == sorted(py_map.values())
    assert normalise(js["text"]) == normalise(py_text)


@pytest.mark.parametrize("i", range(len(SENTENCES)), ids=[s[:30] for s in SENTENCES])
def test_js_round_trip(js_results, i):
    assert js_results[i]["restored"] == SENTENCES[i]


def test_the_terms_that_matter_are_protected(js_results):
    spans = {s for r in js_results for s in r["spans"]}
    for term in ("eigenvectors", "eigenvalue", "determinant", "diagonalize", "SVD", "eigenvalues",
                 "Diagonalization", "diagonalizing"):
        assert term in spans
