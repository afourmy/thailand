"""Apply free-form `decisions` file batch 17 — create 2 new cards."""

import json
import shutil
from pathlib import Path

HERE = Path(__file__).parent

NEW_CARDS = [
    {
        "id": "new-1",
        "thai": "ยาปฏิชีวนะ",
        "english": "antibiotics",
        "frequency": "common",
        "topic": "general",
        "sources": ["manual"],
    },
    {
        "id": "new-2",
        "thai": "จูน",
        "english": 'to fine-tune, to adjust, to calibrate (loanword, from "tune")',
        "frequency": "common",
        "topic": "general",
        "sources": ["manual"],
    },
]


def main():
    vocab_path = HERE / "vocab.json"
    log_path = HERE / "apply_log.txt"

    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))
    existing_ids = {e["id"] for e in vocab}

    collisions = [c["id"] for c in NEW_CARDS if c["id"] in existing_ids]
    if collisions:
        raise SystemExit(f"ID collision, nothing written: {collisions}")

    new_vocab = vocab + NEW_CARDS

    log = ["", "=" * 70, "Free-form decisions file batch 17 — create 2 new cards", ""]
    for c in NEW_CARDS:
        log.append(f"    create {c['id']}: {c['thai']} = {c['english']!r}")
    log.append(f"Vocab: {len(vocab)} -> {len(new_vocab)}")
    log.append("")

    backup = vocab_path.with_suffix(".json.bak")
    shutil.copy2(vocab_path, backup)
    vocab_path.write_text(json.dumps(new_vocab, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    existing = log_path.read_text(encoding="utf-8") if log_path.exists() else ""
    log_path.write_text(existing + "\n".join(log) + "\n", encoding="utf-8")

    print(f"Created {len(NEW_CARDS)} cards: {[c['id'] for c in NEW_CARDS]}")
    print(f"vocab.json: {len(vocab)} -> {len(new_vocab)}  (backup: {backup.name})")


if __name__ == "__main__":
    main()
