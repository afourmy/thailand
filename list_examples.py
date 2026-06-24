#!/usr/bin/env python3
"""Regenerate example_sentences_done.md, the index of which vocab.json entries have
example sentences. Derived entirely from vocab.json, so it can't drift. Run after
adding or editing example sentences.

Usage:
  python3 list_examples.py
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
VOCAB = HERE / "vocab.json"
OUT = HERE / "example_sentences_done.md"


def main():
    words = json.loads(VOCAB.read_text(encoding="utf-8"))
    done = [w for w in words if w.get("examples")]
    lines = [
        "# Words with example sentences",
        "",
        "Tracks which vocab.json entries have an `examples` field "
        "(see example_sentences_prompt.md for the spec). "
        "Regenerate with `python3 list_examples.py`.",
        "",
        "**Total: %d words**" % len(done),
        "",
    ]
    for w in done:
        n = sum(len(g.get("sentences", [])) for g in w["examples"])
        lines.append("- `%s` : %s (%s) : %d meaning(s), %d sentences"
                      % (w["id"], w["thai"], w["english"], len(w["examples"]), n))
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote %s (%d words)" % (OUT.name, len(done)))


if __name__ == "__main__":
    main()
