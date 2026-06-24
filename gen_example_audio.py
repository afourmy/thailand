#!/usr/bin/env python3
"""Generate Thai + English MP3s for example sentences with Azure AI Speech.

Reads thai/vocab.json and, for every word that has an "examples" array, synthesizes
one Thai and one English clip per sentence, writing them under thai/audio/ using the
naming convention the flashcard/vocab UI expects (see exAudioSrc in flashcards.js /
vocab.js):

  audio/<shard>/<id>.ex<mi>_<si>.mp3      Thai sentence
  audio/<shard>/<id>.ex<mi>_<si>.en.mp3   English sentence

where <mi> is the 0-based meaning index, <si> the 0-based sentence index, and <shard>
is a 2-hex-digit bucket of the word id (see audio_paths.py).

After synthesizing a clip, the exact spoken text is recorded back onto the sentence
object as "audio_src" (Thai) / "audio_en_src" (English) -- the same provenance
mechanism the word entries use. A clip is regenerated when its mp3 is missing OR
when the recorded text no longer matches the current sentence (so editing a sentence
and re-running picks up the change). Otherwise it's skipped. The UI always renders
the per-sentence speaker buttons, so no audio flag is needed; missing files no-op.

Credentials come from the environment (see thai/.tts-credentials):
  AZURE_SPEECH_KEY     your Speech resource key
  AZURE_SPEECH_REGION  e.g. southeastasia, eastus

Usage:
  source thai/.tts-credentials && python3 thai/gen_example_audio.py
  source thai/.tts-credentials && python3 thai/gen_example_audio.py --id chula-l6-185
  source thai/.tts-credentials && python3 thai/gen_example_audio.py --lang th --force
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

import audio_paths

HERE = Path(__file__).resolve().parent
VOCAB = HERE / "vocab.json"
AUDIO_DIR = HERE / "audio"

# Same neural voices as gen_audio.py, for a consistent sound across the app.
LANGS = {
    "th": {"key": "thai", "voice": "th-TH-PremwadeeNeural", "xmllang": "th-TH", "suffix": ""},
    "en": {"key": "en",   "voice": "en-US-JennyNeural",     "xmllang": "en-US", "suffix": ".en"},
}

OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3"

def speakable(text):
    return re.sub(r"\s+", " ", text or "").strip()


def _is_thai(ch):
    return "\u0e00" <= ch <= "\u0e7f"


def thai_body(text):
    """Escaped SSML body that inserts a short pause at spaces separating two
    Thai-script chunks (clause/sentence boundaries). Thai writes no spaces between
    words, so a space marks a boundary, but Azure renders a bare space with no pause
    at all. A comma is used to add the pause rather than an SSML <break>: a <break>
    (at any time/strength, even 0ms) forces an unnaturally long ~1.3s sentence
    pause, whereas a comma yields a natural ~0.35s pause. Spaces around numerals or
    Latin text (e.g. "40 นิ้ว", "500 บาท") are left as-is, since a pause there would
    sound wrong. The comma lives only in the synthesized SSML, not in the displayed
    sentence or its recorded audio_src."""
    tokens = [t for t in text.split(" ") if t]
    parts = []
    for i, tok in enumerate(tokens):
        if i:
            prev = tokens[i - 1]
            joiner = ", " if _is_thai(prev[-1]) and _is_thai(tok[0]) else " "
            parts.append(joiner)
        parts.append(escape(tok))
    return "".join(parts)


def ssml(body, voice, xmllang):
    return (
        "<speak version='1.0' xml:lang='" + xmllang + "'>"
        "<voice name='" + voice + "'>" + body + "</voice>"
        "</speak>"
    )


def synth(body, voice, xmllang, key, region):
    url = "https://" + region + ".tts.speech.microsoft.com/cognitiveservices/v1"
    req = urllib.request.Request(
        url,
        data=ssml(body, voice, xmllang).encode("utf-8"),
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
            "User-Agent": "thai-vocab-tts",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--id", metavar="WORD_ID", help="only this word id (default: all with examples)")
    ap.add_argument("--lang", choices=("th", "en", "both"), default="both",
                    help="which audio to generate (default both)")
    ap.add_argument("--force", action="store_true",
                    help="re-synthesize even if the mp3 already exists")
    args = ap.parse_args()

    key = os.environ.get("AZURE_SPEECH_KEY")
    region = os.environ.get("AZURE_SPEECH_REGION")
    if not key or not region:
        sys.exit("Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (e.g. `source thai/.tts-credentials`).")

    selected = ["th", "en"] if args.lang == "both" else [args.lang]
    words = json.loads(VOCAB.read_text(encoding="utf-8"))
    targets = [w for w in words if w.get("examples") and (not args.id or w["id"] == args.id)]
    if args.id and not targets:
        sys.exit("No word with id %r has examples." % args.id)

    n_clips = sum(len(g.get("sentences", [])) for w in targets for g in w["examples"])
    print("%d word(s), %d sentence(s), %d clip(s); languages: %s"
          % (len(targets), n_clips, n_clips * len(selected), ", ".join(selected)))
    AUDIO_DIR.mkdir(exist_ok=True)

    # Provenance key on the sentence object, per language.
    SRC_KEY = {"th": "audio_src", "en": "audio_en_src"}

    changed = False
    failures = []
    for word in targets:
        for mi, group in enumerate(word["examples"]):
            for si, sent in enumerate(group.get("sentences", [])):
                for lc in selected:
                    cfg = LANGS[lc]
                    src_key = SRC_KEY[lc]
                    out = AUDIO_DIR / audio_paths.example_audio_rel(
                        word["id"], mi, si, en=(lc == "en"))
                    spoken = speakable(sent.get(cfg["key"], ""))
                    if not spoken:
                        print("skip (empty %s):" % lc, out.name)
                        continue
                    # Up to date when the file exists and matches the recorded text.
                    if out.exists() and not args.force and sent.get(src_key) == spoken:
                        print("skip (up to date):", out.name)
                        continue
                    try:
                        body = thai_body(spoken) if lc == "th" else escape(spoken)
                        audio = synth(body, cfg["voice"], cfg["xmllang"], key, region)
                        out.parent.mkdir(parents=True, exist_ok=True)
                        out.write_bytes(audio)
                        sent[src_key] = spoken  # record exactly what was synthesized
                        changed = True
                        print("wrote:", out.name, "(%d bytes)" % len(audio), spoken)
                    except urllib.error.HTTPError as e:
                        body = e.read().decode("utf-8", "replace")[:300]
                        failures.append((out.name, e.code, body))
                        print("FAIL:", out.name, e.code, body)
                    except Exception as e:  # noqa: BLE001 - report and continue
                        failures.append((out.name, "?", str(e)))
                        print("FAIL:", out.name, e)

    if changed:
        VOCAB.write_text(
            json.dumps(words, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("updated vocab.json (audio_src / audio_en_src)")

    if failures:
        print("\n%d failed:" % len(failures))
        for fid, code, body in failures:
            print(" ", fid, code, body)
        sys.exit(1)
    print("done")


if __name__ == "__main__":
    main()
