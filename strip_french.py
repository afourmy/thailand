"""Strip French '(fr: ...)' glosses from english fields. DRY RUN by default."""

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
vocab_path = HERE / "vocab.json"

# Manual overrides for entries the generic rules can't handle cleanly:
#  - fr: joined to English by ' - ' inside one paren (keep the English, fix typo)
#  - a French phrase with no 'fr:' marker
OVERRIDES = {
    "yt-c03-053": "funeral wreath (circular arrangement of flowers)",
    "yt-c21-005": "to pry out, to pick out; to make sarcastic, snide remarks, to take a dig at someone",
}


def strip_fr(s: str) -> str:
    # Pass 1: ', fr: <french>' inside a combined parenthetical -> drop, keep the rest of the paren
    s = re.sub(r",\s*fr:[^)]*(?=\))", "", s)
    # Pass 2: standalone '(fr: <french>)' parentheticals -> remove entirely
    s = re.sub(r"\s*\(fr:[^)]*\)", "", s)
    # Cleanup: collapse spaces and fix stray punctuation spacing
    s = re.sub(r"\s{2,}", " ", s)
    s = re.sub(r"\s+([,;)])", r"\1", s)
    s = re.sub(r"\(\s+", "(", s)
    return s.strip()


def main():
    apply = "--apply" in sys.argv
    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))

    changes = []
    for e in vocab:
        before = e["english"]
        if "fr:" not in before and e["id"] not in OVERRIDES:
            continue
        after = OVERRIDES.get(e["id"], strip_fr(before))
        if after != before:
            changes.append((e["id"], before, after))

    leftovers = []
    for eid, before, after in changes:
        print(f"{eid}")
        print(f"   - {before}")
        print(f"   + {after}")
        if "fr:" in after or " fr " in after or "  " in after:
            leftovers.append(eid)

    print()
    print(f"Total entries changed: {len(changes)}")
    if leftovers:
        print(f"!! POSSIBLE LEFTOVERS to inspect: {leftovers}")
    else:
        print("No 'fr:'/double-space leftovers detected.")

    if apply:
        import shutil

        by_id = {e["id"]: e for e in vocab}
        for eid, before, after in changes:
            by_id[eid]["english"] = after
        backup = vocab_path.with_suffix(".json.bak")
        shutil.copy2(vocab_path, backup)
        vocab_path.write_text(
            json.dumps(vocab, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        log = HERE / "apply_log.txt"
        existing = log.read_text(encoding="utf-8") if log.exists() else ""
        lines = ["", "=" * 70, "French gloss sweep — removed '(fr: ...)' from english fields", ""]
        for eid, before, after in changes:
            lines.append(f"    {eid}: {before!r} -> {after!r}")
        lines.append(f"Total entries changed: {len(changes)}")
        lines.append("")
        log.write_text(existing + "\n".join(lines) + "\n", encoding="utf-8")
        print(f"\nAPPLIED. Backup: {backup.name}")


if __name__ == "__main__":
    main()
