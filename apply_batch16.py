"""Apply free-form `decisions` file batch 16 — 3 dedup deletes."""

import json
import shutil
from pathlib import Path

HERE = Path(__file__).parent

DELETES = {
    "yt-c17-069",     # เพี้ยน (dup; keep thaipod-1242)
    "tamago-l3-643",  # ชักจะ (dup; keep yt-c20-051b)
    "tamago-l12-178", # ถาวร (dup; keep wlt-c07-001b)
}


def main():
    vocab_path = HERE / "vocab.json"
    log_path = HERE / "apply_log.txt"

    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in vocab}

    deleted = [eid for eid in DELETES if eid in by_id]
    missing_deletes = [eid for eid in DELETES if eid not in by_id]
    new_vocab = [e for e in vocab if e["id"] not in DELETES]

    log = ["", "=" * 70, "Free-form decisions file batch 16 — 3 dedup deletes", ""]
    for eid in deleted:
        log.append(f"    delete {eid}")
    if missing_deletes:
        log.append(f"Skipped deletes (not found): {', '.join(missing_deletes)}")
    log.append(f"Vocab: {len(vocab)} -> {len(new_vocab)}")
    log.append("")

    backup = vocab_path.with_suffix(".json.bak")
    shutil.copy2(vocab_path, backup)
    vocab_path.write_text(json.dumps(new_vocab, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    existing = log_path.read_text(encoding="utf-8") if log_path.exists() else ""
    log_path.write_text(existing + "\n".join(log) + "\n", encoding="utf-8")

    print(f"Deleted ({len(deleted)}): {sorted(deleted)}")
    if missing_deletes:
        print(f"Skipped deletes (not found): {missing_deletes}")
    print(f"vocab.json: {len(vocab)} -> {len(new_vocab)}  (backup: {backup.name})")


if __name__ == "__main__":
    main()
