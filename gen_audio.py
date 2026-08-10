#!/usr/bin/env python3
"""Generate Thai + English pronunciation MP3s with Azure AI Speech, one per word.

Reads thai/vocab.json, synthesizes audio for the chosen language(s), writes
thai/audio/<shard>/<id>.mp3 (Thai) and thai/audio/<shard>/<id>.en.mp3 (English),
where <shard> is a 2-hex-digit bucket of the word id (see audio_paths.py), and flags
each word with "audio" / "audio_en": true so the page shows a speaker button only
where audio exists.

Provenance, as in gen_example_audio.py: the text a clip was synthesized from is
recorded as "audio_src" (Thai) / "audio_en_src" (English), and a clip is rebuilt
when that recorded text no longer matches the card. Editing a gloss therefore
refreshes its audio on the next run; without this check a card edited after
synthesis kept saying the old wording forever (found 2026-08-10: 41 English and 6
Thai word clips stale, three of them still saying "sth" for "something"). Clips
made before the check existed have no recorded source, so they cannot be verified:
they are left alone and counted at the end, and only --force rebuilds them.

The text spoken is the full field value -- all comma / dash separated forms are
read -- with any parenthetical "(...)" removed, since parentheses are
annotations, not pronunciation.

A word may carry an optional "thai_tts" / "english_tts" field: a phonetic
respelling spoken instead of the display text, for homographs whose isolated
default reading is wrong (e.g. "พลาว" so เพลา "to lessen" is read plao, not
phee-laa). It affects synthesis only; the page still shows the normal field.

Credentials come from the environment (see thai/.tts-credentials):
  AZURE_SPEECH_KEY     your Speech resource key
  AZURE_SPEECH_REGION  e.g. southeastasia, eastus

Usage:
  source thai/.tts-credentials && python3 thai/gen_audio.py --frequency everyday --all
  source thai/.tts-credentials && python3 thai/gen_audio.py --lang en -n 25
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

import audio_paths

HERE = Path(__file__).resolve().parent  # .../thai
VOCAB = HERE / "vocab.json"

# Per-language synthesis config.
LANGS = {
    "th": {
        "field": "thai",
        "voice": "th-TH-PremwadeeNeural",  # Thai neural voice (female)
        "xmllang": "th-TH",
        "suffix": "",          # audio/<id>.mp3
        "flag": "audio",
        "src": "audio_src",
    },
    "en": {
        "field": "english",
        "voice": "en-US-JennyNeural",      # English neural voice (female)
        "xmllang": "en-US",
        "suffix": ".en",       # audio/<id>.en.mp3
        "flag": "audio_en",
        "src": "audio_en_src",
    },
}

# 24 kHz / 96 kbps mono mp3: high quality for speech, small files.
OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3"

PAREN = re.compile(r"\s*\([^)]*\)")


def speakable(text):
    """Full text (all forms kept), with parenthetical "(...)" annotations removed."""
    return re.sub(r"\s+", " ", PAREN.sub("", text)).strip()


def ssml(text, voice, xmllang):
    return (
        "<speak version='1.0' xml:lang='" + xmllang + "'>"
        "<voice name='" + voice + "'>" + escape(text) + "</voice>"
        "</speak>"
    )


def synth(text, voice, xmllang, key, region, max_retries=6):
    url = "https://" + region + ".tts.speech.microsoft.com/cognitiveservices/v1"
    data = ssml(text, voice, xmllang).encode("utf-8")
    headers = {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
        "User-Agent": "thai-vocab-tts",
    }
    for attempt in range(max_retries + 1):
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            # 429 = rate limited, 5xx = transient: wait and retry (honor Retry-After).
            if e.code in (429, 500, 503) and attempt < max_retries:
                retry_after = e.headers.get("Retry-After")
                wait = float(retry_after) if retry_after else min(2 ** attempt, 30)
                print("  rate limited (%d), waiting %.1fs (retry %d/%d)..."
                      % (e.code, wait, attempt + 1, max_retries))
                time.sleep(wait)
                continue
            raise


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-n", "--count", type=int, default=10,
                    help="number of words from the top of the deck (default 10)")
    ap.add_argument("--all", action="store_true", help="process every word")
    ap.add_argument("--id", metavar="WORD_ID", help="only this word id")
    ap.add_argument("--force", action="store_true",
                    help="re-synthesize even if the mp3 already exists")
    ap.add_argument("--frequency", metavar="FREQ",
                    help="only words with this frequency (e.g. everyday)")
    ap.add_argument("--lang", choices=("th", "en", "both"), default="both",
                    help="which audio to generate (default both)")
    ap.add_argument("--delay", type=float, default=0.4,
                    help="seconds to pause after each synthesized clip, to stay "
                         "under the API rate limit (default 0.4)")
    args = ap.parse_args()

    key = os.environ.get("AZURE_SPEECH_KEY")
    region = os.environ.get("AZURE_SPEECH_REGION")
    if not key or not region:
        sys.exit("Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION "
                 "(e.g. `source thai/.tts-credentials`).")

    selected = ["th", "en"] if args.lang == "both" else [args.lang]

    words = json.loads(VOCAB.read_text(encoding="utf-8"))
    pool = words
    if args.frequency:
        pool = [w for w in pool if w.get("frequency") == args.frequency]
    if args.id:
        pool = [w for w in pool if w["id"] == args.id]
    targets = pool if args.all else pool[: args.count]
    filters = ", ".join(
        f for f in ("frequency=%s" % args.frequency if args.frequency else "",
                    "id=%s" % args.id if args.id else "") if f)
    print("%d candidate words%s; languages: %s" % (
        len(targets),
        " (%s)" % filters if filters else "",
        ", ".join(selected)))

    changed = False
    failures = []
    unverifiable = 0
    for word in targets:
        for lc in selected:
            cfg = LANGS[lc]
            src_key = cfg["src"]
            out = Path(audio_paths.word_audio_path(word["id"], en=(lc == "en")))
            spoken = speakable(word.get(cfg["field"] + "_tts") or word.get(cfg["field"], ""))
            recorded = word.get(src_key)
            ok = out.exists()
            # Up to date when the file exists and was made from the current text.
            # A clip with no recorded source predates this check, so it cannot be
            # verified: leave it alone and report it, rather than re-synthesizing
            # the whole deck or silently trusting it.
            if ok and not args.force and recorded == spoken:
                print("skip (up to date):", out.name)
            elif ok and not args.force and recorded is None:
                unverifiable += 1
            else:
                if not spoken:
                    print("skip (empty %s):" % lc, word["id"])
                    continue
                try:
                    audio = synth(spoken, cfg["voice"], cfg["xmllang"], key, region)
                    out.parent.mkdir(parents=True, exist_ok=True)
                    out.write_bytes(audio)
                    ok = True
                    print("wrote:", out.name, "(%d bytes)" % len(audio), spoken)
                    if word.get(src_key) != spoken:
                        word[src_key] = spoken
                        changed = True
                    time.sleep(args.delay)
                except urllib.error.HTTPError as e:
                    body = e.read().decode("utf-8", "replace")[:300]
                    ok = False
                    failures.append((out.name, e.code, body))
                    print("FAIL:", out.name, e.code, body)
                except Exception as e:  # noqa: BLE001 - report and continue
                    ok = False
                    failures.append((out.name, "?", str(e)))
                    print("FAIL:", out.name, e)
            if ok and not word.get(cfg["flag"]):
                word[cfg["flag"]] = True
                changed = True

    if changed:
        VOCAB.write_text(
            json.dumps(words, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print("updated vocab.json (audio flags / audio_src)")

    if unverifiable:
        print("%d clip(s) have no recorded source text and were left alone; "
              "re-run with --force to rebuild them from the current text."
              % unverifiable)

    if failures:
        print("\n%d failed:" % len(failures))
        for fid, code, body in failures:
            print(" ", fid, code, body)
        sys.exit(1)


if __name__ == "__main__":
    main()
