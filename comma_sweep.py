"""Convert thai ' - ' -> ', ' for multi-form entries with a single english gloss. DRY RUN by default."""

import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
vocab_path = HERE / "vocab.json"

# Candidates = thai has ' - ' AND english has no ' - '. Exclude these (keep ' - '):
HOLD_BACK = {
    "yt-c04-015",   # user already chose to keep ' - '
    "yt-c09-071",   # term - definition (the five precepts), not synonyms
    "tsl-022",      # strawberry ; (slang) to lie  -> different words
    "yt-c07-060",   # transliteration ; transliterated word -> verb vs noun
    "yt-c15-069",   # ปัง/ปั๊วะ ; two nuances -> review
    "yt-c16-054",   # to wander ; vagrant -> verb vs noun
    "wlt-c01-010",  # what time ; (slang) not gonna happen -> different
    "tsl-091",      # abroad / another province -> different destinations
    "yt-c19-050",   # หน้านา may be typo for หน้าหนา -> review
    "yt-c21-013",   # เรื่องบัดสี/พลอดรัก gloss mismatch -> review
    "yt-c22-045",   # พอมึงตาย may be typo for พ่อมึงตาย -> review
}


def main():
    apply = "--apply" in sys.argv
    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))

    changes = []
    for e in vocab:
        if " - " in e["thai"] and " - " not in e["english"] and e["id"] not in HOLD_BACK:
            after = e["thai"].replace(" - ", ", ")
            changes.append((e["id"], e["thai"], after, e["english"]))

    for eid, before, after, eng in changes:
        print(f"{eid:16} {before}  ->  {after}   | {eng}")
    print()
    print(f"Conversions: {len(changes)}   (held back: {len(HOLD_BACK)})")

    if apply:
        import shutil

        by_id = {e["id"]: e for e in vocab}
        for eid, before, after, eng in changes:
            by_id[eid]["thai"] = after
        backup = vocab_path.with_suffix(".json.bak")
        shutil.copy2(vocab_path, backup)
        vocab_path.write_text(
            json.dumps(vocab, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        log = HERE / "apply_log.txt"
        existing = log.read_text(encoding="utf-8") if log.exists() else ""
        lines = ["", "=" * 70, "Separator sweep — thai ' - ' -> ', ' for single-gloss multi-form entries", ""]
        for eid, before, after, eng in changes:
            lines.append(f"    {eid}: {before!r} -> {after!r}")
        lines.append(f"Total conversions: {len(changes)}")
        lines.append("")
        log.write_text(existing + "\n".join(lines) + "\n", encoding="utf-8")
        print(f"APPLIED. Backup: {backup.name}")


if __name__ == "__main__":
    main()
