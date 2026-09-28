"""The hosted site must keep representing the product.

web/ is a copy of the product UI plus a replay harness. Copies rot: someone
fixes a rendering bug in sahaay/ui/app.js, nobody re-runs the build, and the
public demo keeps the bug while claiming to be the application. These tests
make that a CI failure instead of a stale website.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "scripts"))

WEB = REPO_ROOT / "web"
UI = REPO_ROOT / "sahaay" / "ui"


def test_web_build_is_up_to_date():
    """web/ matches what scripts/build_web.py would generate right now."""
    import build_web

    stale = [
        path.relative_to(REPO_ROOT).as_posix()
        for path, content in build_web.expected_files().items()
        if not path.exists() or path.read_text(encoding="utf-8") != content
    ]
    assert not stale, (
        "web/ is out of date with sahaay/ui/: " + ", ".join(stale) +
        "\nrun: python scripts/build_web.py"
    )


def test_demo_uses_the_products_own_javascript():
    """Not a reimplementation - the same file, byte for byte."""
    assert (WEB / "static" / "app.js").read_bytes() == (UI / "app.js").read_bytes()
    assert (WEB / "static" / "style.css").read_bytes() == (UI / "style.css").read_bytes()


def test_replay_shim_loads_before_the_app():
    """app.js reaches for fetch and WebSocket as soon as it is evaluated.

    If replay.js were second, boot() would fire a real request at /api/status
    on a static host, get a 404, and the page would show an error toast.
    """
    html = (WEB / "demo" / "index.html").read_text(encoding="utf-8")
    assert html.index("replay.js") < html.index("app.js")


def test_demo_page_has_no_absolute_asset_paths():
    """The server mounts the UI at /static; the site nests it one level down."""
    html = (WEB / "demo" / "index.html").read_text(encoding="utf-8")
    assert '"/static/' not in html


def test_every_listed_recording_exists_and_parses():
    index = json.loads((WEB / "sessions.json").read_text(encoding="utf-8"))
    assert index["sessions"], "the demo ships no recordings; run scripts/record_demo.py"

    for entry in index["sessions"]:
        path = WEB / entry["file"]
        assert path.exists(), f"sessions.json lists {entry['file']}, which is missing"
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["events"], f"{entry['file']} contains no events"


@pytest.mark.parametrize("path", sorted(WEB.glob("session.*.json")), ids=lambda p: p.name)
def test_recording_is_a_plausible_session(path: Path):
    """A recording has to be a session, not just well-formed JSON."""
    data = json.loads(path.read_text(encoding="utf-8"))
    kinds = {e["kind"] for e in data["events"]}

    assert "caption" in kinds, "no captions - nothing to replay"
    assert "status" in kinds, "no status event - the device badge would stay blank"

    # Timestamps drive the replay. Out of order, captions would arrive
    # backwards; all-zero, the whole lecture would land in one frame.
    times = [e["t"] for e in data["events"]]
    assert times == sorted(times), "events are not in chronological order"
    assert times[-1] > 0, "every event carries the same timestamp"

    for event in data["events"]:
        if event["kind"] == "caption":
            assert event.get("text", "").strip(), "empty caption text"
            assert "index" in event, "caption without an index cannot be matched"


@pytest.mark.parametrize("path", sorted(WEB.glob("session.*.json")), ids=lambda p: p.name)
def test_recording_carries_no_local_paths(path: Path):
    """Nothing from the recording machine should ship to a public site.

    The notes event includes the path a session was saved to, which on a
    development machine is a home directory.
    """
    raw = path.read_text(encoding="utf-8")
    for leak in ("C:\\\\Users", "/home/", "/Users/"):
        assert leak not in raw, f"{path.name} leaks a local path ({leak})"


@pytest.mark.parametrize("path", sorted(WEB.glob("session.*.json")), ids=lambda p: p.name)
def test_recording_is_translated_into_its_own_language(path: Path):
    """A demo recording labelled Odia must show Odia, on every line.

    The picker offers one recording per language, so a recording that is
    half untranslated, or in the wrong script, is a false claim about the
    product. Real recordings only: a mock one says so on the page.
    """
    from check_languages import SCRIPTS

    from sahaay.config import SUPPORTED_LANGUAGES

    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("mode") != "real":
        pytest.skip("mock recording")
    code = path.name.split(".")[1]
    assert code in SUPPORTED_LANGUAGES, f"{path.name} is for a language the app does not offer"
    script = SUPPORTED_LANGUAGES[code]["nllb"].split("_")[1]

    captions = {e["index"] for e in data["events"] if e["kind"] == "caption"}
    translations = [e for e in data["events"] if e["kind"] == "translation"]
    assert {e["index"] for e in translations} == captions, "some captions were never translated"
    assert not any(e.get("passthrough") for e in translations), "recorded without the translation model"

    ranges = SCRIPTS[script]
    for e in translations:
        letters = [c for c in e["text"] if c.isalpha() and not c.isascii()]
        if script == "Latn":
            continue
        share = sum(any(lo <= ord(c) <= hi for lo, hi in ranges) for c in letters) / max(1, len(letters))
        assert share >= 0.8, f"line {e['index']} is not in {script}: {e['text'][:60]}"


@pytest.mark.parametrize("path", sorted(WEB.glob("session.*.json")), ids=lambda p: p.name)
def test_recording_is_paced_like_a_lecture(path: Path):
    """No two-minute blank screen at the start, or silence in the middle.

    Recorded two at a time on a 13 GB laptop, the machine swapped: Nepali's
    first caption came 286 s in and Maithili sat silent for 239 s. Those were
    real runs, but of an overloaded recorder, not of the product - and a
    visitor would assume the demo was broken.
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("mode") != "real":
        pytest.skip("mock recording")
    caps = [e["t"] for e in data["events"] if e["kind"] == "caption"]
    assert caps[0] <= 40, f"first caption {caps[0]:.0f} s in"
    assert max(b - a for a, b in zip(caps, caps[1:], strict=False)) <= 30, "a silent stretch over 30 s"
    assert data["duration_s"] - caps[-1] <= 45, "the replay idles long after the lecture ends"


class TestLiveBuild:
    """The browser build is the product's UI with inference underneath.

    It has the same drift risk as the replay page and one extra: the seeded
    glossary is exported to JSON, and a change to SEED_GLOSSARY that is not
    re-exported leaves the site explaining a vocabulary the app no longer has.
    """

    def test_the_live_page_exists_and_loads_its_own_transport(self):
        html = (WEB / "live" / "index.html").read_text(encoding="utf-8")
        assert "live.js" in html
        assert html.index("live.js") < html.index("app.js"), (
            "live.js installs the fetch and WebSocket stubs app.js reaches for "
            "on boot; loading it second means app.js talks to a server that is "
            "not there."
        )

    def test_the_live_page_is_the_products_own_ui(self):
        live = (WEB / "live" / "index.html").read_text(encoding="utf-8")
        for element in ('id="captions"', 'id="glossary"', 'id="toggle"', 'id="level"'):
            assert element in live, f"{element} missing - the UI was reimplemented"

    def test_the_exported_glossary_matches_the_python_one(self):
        from sahaay.llm import SEED_GLOSSARY

        shipped = json.loads((WEB / "static" / "glossary.json").read_text(encoding="utf-8"))
        assert shipped == SEED_GLOSSARY, (
            "web/static/glossary.json is stale; run python scripts/build_web.py"
        )

    def test_the_live_page_says_what_it_cannot_do(self):
        """It runs Whisper, not the pipeline. The page has to say so."""
        landing = (WEB / "index.html").read_text(encoding="utf-8")
        assert "not" in landing and "NPU" in landing
        assert "translate" in landing.lower() or "translation" in landing.lower()

    BROWSER_JS = ("live.js", "whisper-worker.js", "translate-worker.js")

    def test_the_runtime_is_pinned_wherever_it_is_loaded(self):
        """A floating major version can break a page mid-presentation."""
        loaders = 0
        for name in self.BROWSER_JS:
            js = (WEB / "static" / name).read_text(encoding="utf-8")
            for ref in re.findall(r"@huggingface/transformers[^\"'\s]*", js):
                loaders += 1
                assert re.fullmatch(r"@huggingface/transformers@\d+\.\d+\.\d+", ref), f"{name}: {ref}"
        assert loaders >= 2, "the workers no longer load a pinned runtime"

    def test_the_browser_never_uploads_audio(self):
        """The whole claim. Nothing may POST audio anywhere."""
        for name in self.BROWSER_JS:
            js = (WEB / "static" / name).read_text(encoding="utf-8")
            for pattern in ("FormData", "uploadAudio", "audio/wav"):
                assert pattern not in js, f"{name} references {pattern}"

    def test_whisper_runs_off_the_main_thread(self):
        """On the main thread it froze the page up to 2 s per caption."""
        js = (WEB / "static" / "live.js").read_text(encoding="utf-8")
        assert 'new Worker("../static/whisper-worker.js"' in js
        assert "pipeline(" not in js, "live.js runs a model on the main thread again"


class TestLivePerformance:
    """The browser build's speed fixes, pinned so they cannot quietly regress.

    Each of these was measured with scripts/bench_live.py before it was kept;
    these tests only guard that the mechanism is still there.
    """

    def _js(self) -> str:
        return (WEB / "static" / "live.js").read_text(encoding="utf-8")

    def test_the_model_starts_loading_when_the_page_opens(self):
        """Cold, Start used to take 55 s to become 'listening'."""
        js = self._js()
        handler = js[js.index('addEventListener("DOMContentLoaded"'):]
        assert "loadModel()" in handler, "Whisper is no longer preloaded on page open"

    def test_a_backlog_is_merged_not_dropped(self):
        """Whisper's encoder pays for 30 s whatever it is given."""
        js = self._js()
        match = re.search(r"MERGE_MAX_S\s*=\s*([\d.]+)", js)
        assert match, "the merge limit is gone"
        assert float(match.group(1)) < 30, "a merged call must fit Whisper's 30 s window"

    def test_speech_onset_keeps_pre_roll(self):
        """An energy gate fires after the first consonant of a word."""
        assert re.search(r"PREROLL_FRAMES\s*=\s*\d+", self._js())

    def test_the_site_is_cross_origin_isolated(self):
        """Without isolation WebAssembly gets one thread and one core."""
        cfg = json.loads((REPO_ROOT / "vercel.json").read_text(encoding="utf-8"))
        headers = {
            h["key"]: h["value"]
            for rule in cfg["headers"] if rule["source"] == "/(.*)"
            for h in rule["headers"]
        }
        assert headers.get("Cross-Origin-Opener-Policy") == "same-origin"
        # credentialless, not require-corp: huggingface.co sends no
        # Cross-Origin-Resource-Policy header, so require-corp would block
        # the model weights and the page would never caption.
        assert headers.get("Cross-Origin-Embedder-Policy") == "credentialless"

    def test_isolation_comes_with_blob_scripts_or_nothing_captions(self):
        """The combination that would have shipped a dead page.

        Isolation makes ONNX Runtime pick its multi-threaded build, which
        loads its worker module from a blob: URL. Without blob: in script-src
        that import is refused and the page reports "no available backend
        found" - on every Chrome and Firefox visitor, since those are the
        browsers that honour the isolation header. Safari would have worked,
        which is the only reason it might not have been noticed.

        Caught by scripts/bench_live.py before it was deployed.
        """
        cfg = json.loads((REPO_ROOT / "vercel.json").read_text(encoding="utf-8"))
        headers = {h["key"]: h["value"] for r in cfg["headers"] for h in r["headers"]}
        if "Cross-Origin-Embedder-Policy" in headers:
            script_src = next(
                d for d in headers["Content-Security-Policy"].split(";")
                if d.strip().startswith("script-src")
            )
            assert "blob:" in script_src.split(), (
                "cross-origin isolation without blob: in script-src breaks threaded WASM"
            )

    def test_isolation_did_not_open_the_policy_up(self):
        """Threads needed new headers, not a looser CSP."""
        cfg = json.loads((REPO_ROOT / "vercel.json").read_text(encoding="utf-8"))
        csp = next(
            h["value"] for rule in cfg["headers"] for h in rule["headers"]
            if h["key"] == "Content-Security-Policy"
        )
        assert "form-action 'none'" in csp
        connect = next(d for d in csp.split(";") if d.strip().startswith("connect-src"))
        assert " * " not in f" {connect} ", "connect-src must not allow posting anywhere"


class TestSiteFineTune:
    """Fixes from the 28 Sep 2026 Lighthouse and translation passes (docs/TUNING.md)."""

    def _live(self) -> str:
        return (WEB / "live" / "index.html").read_text(encoding="utf-8")

    def test_the_live_page_paints_its_own_controls_and_hint(self):
        """Swapped in after the first paint they moved the app (CLS 0.31 on a phone),
        and app.js had already saved the desktop's hint as the one to show."""
        live = self._live()
        assert 'id="live-source-select"' in live, "the source picker is injected after first paint again"
        assert 'id="live-bar"' in live, "the progress bar is injected after first paint again"
        assert "A browser tab</b>" in live, "/live carries the desktop's idle hint"
        js = (WEB / "static" / "live.js").read_text(encoding="utf-8")
        assert "empty.innerHTML" not in js, "live.js swaps the hint at runtime again"

    def test_the_hosted_pages_describe_themselves_and_defer_their_scripts(self):
        for page in ("demo", "live"):
            html = (WEB / page / "index.html").read_text(encoding="utf-8")
            assert '<meta name="description"' in html, f"/{page} has no description"
            assert '<script src="../static/app.js" defer></script>' in html, f"/{page} blocks rendering on app.js"

    def test_translation_streams_and_its_backlog_rule_sees_the_backlog(self):
        js = (WEB / "static" / "translate-worker.js").read_text(encoding="utf-8")
        assert "TextStreamer" in js and 'type: "partial"' in js, "translations no longer stream"
        # A translation blocks the worker; unless it yields between jobs, the
        # captions that arrived meanwhile stay undelivered and MAX_BACKLOG never fires.
        loop = js[js.index("async function drain"):]
        assert "setTimeout(resolve, 0)" in loop, "the worker no longer yields between translations"
        # Padded batches came back in the wrong script (measured); one at a time.
        assert "MAX_BATCH" not in js
        app = (UI / "app.js").read_text(encoding="utf-8")
        assert 'classList.toggle("partial"' in app, "a streaming line is not marked as partial"

    def test_the_two_workers_do_not_oversubscribe_the_cores(self):
        """Whisper 8 + translation 6 threads on 12 cores slowed both (docs/TUNING.md)."""
        js = (WEB / "static" / "live.js").read_text(encoding="utf-8")
        assert "whisperThreads" in js and "translatorThreads(" in js

    def test_the_landing_page_share_card_hero_and_film_exist(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        card = re.search(r'og:image" content="https://sahaay-offline\.vercel\.app/(static/[\w.-]+)"', html)
        assert card and (WEB / card.group(1)).exists(), "the share card is missing"
        for src in re.findall(r"(static/hero-\d+\.webp)", html):
            assert (WEB / src).exists(), f"{src} is in the srcset but not on disk"
        assert 'preload="none"' in html, "the film must not download with the page"
        for src in re.findall(r'(?:src|poster)="(static/showreel[\w.-]*)"', html):
            assert (WEB / src).exists(), f"{src} is missing"
