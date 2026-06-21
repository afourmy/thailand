"""Apply the free-form `decisions` file (batch 19).

Parses ./decisions directly (so the English is applied verbatim, not retyped):
  - gloss lines `ID thai: [thai '...':] eng '...'`  -> set english (+ thai if given)
  - the `remove card: ...` line                      -> delete those IDs

Dry run by default; pass --apply to write vocab.json (with a .bak backup).
"""

import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent
ID_RE = re.compile(r"[A-Za-z][A-Za-z0-9]*-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?")


def parse_english(line):
    """English is the last single-quoted run on the line (quotes/apostrophes
    inside are preserved). Uses the `eng '` marker, or the first quote after the
    colon for lines that omit `eng`."""
    marker = line.find("eng '")
    if marker != -1:
        start = marker + len("eng '")
    else:
        colon = line.find(":")
        q = line.find("'", colon)
        if colon == -1 or q == -1:
            return None
        start = q + 1
    end = line.rfind("'")
    if end <= start:
        return None
    return line[start:end]


def parse_thai(line):
    m = line.find("thai '")
    if m == -1:
        return None
    start = m + len("thai '")
    end = line.find("'", start)
    return line[start:end] if end != -1 else None


def parse_decisions(text):
    eng_edits, thai_edits, deletes = {}, {}, []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("remove card:"):
            ids = [t for t in ID_RE.findall(line[len("remove card:"):]) if any(c.isdigit() for c in t)]
            deletes.extend(ids)
            continue
        if "'" not in line:
            continue
        cid = line.split()[0]
        eng = parse_english(line)
        if eng is None:
            continue
        eng_edits[cid] = eng
        th = parse_thai(line)
        if th is not None:
            thai_edits[cid] = th
    return eng_edits, thai_edits, deletes


def main():
    apply = "--apply" in sys.argv
    vocab_path = HERE / "vocab.json"
    decisions = (HERE / "decisions").read_text(encoding="utf-8")
    eng_edits, thai_edits, deletes = parse_decisions(decisions)

    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in vocab}

    missing_edits = [i for i in eng_edits if i not in by_id]
    missing_deletes = [i for i in deletes if i not in by_id]
    dup_deletes = [i for i in deletes if i in eng_edits]

    print(f"Parsed: {len(eng_edits)} eng edits, {len(thai_edits)} thai edits, {len(deletes)} deletes.")
    if missing_edits:
        print(f"!! edit IDs not found ({len(missing_edits)}): {missing_edits}")
    if missing_deletes:
        print(f"!! delete IDs not found ({len(missing_deletes)}): {missing_deletes}")
    if dup_deletes:
        print(f"!! IDs in BOTH edit and delete: {dup_deletes}")
    print("\nSample English values (verify quoting):")
    for cid in ["tamago-l12-514", "tamago-l12-549", "yt-c10-051", "thaipod-0250", "yt-c12-049"]:
        if cid in eng_edits:
            print(f"  {cid}: {eng_edits[cid]!r}")
    for cid, th in thai_edits.items():
        print(f"  thai {cid}: {th!r}")

    if not apply:
        print("\nDRY RUN — nothing written. Re-run with --apply to write vocab.json.")
        return

    if missing_edits or missing_deletes:
        print("\nRefusing to apply while IDs are missing. Fix the decisions file first.")
        return

    log = ["", "=" * 70, "Free-form decisions file batch 19", ""]
    for cid, eng in eng_edits.items():
        by_id[cid]["english"] = eng
        log.append(f"    edit {cid}.english = {eng!r}")
    for cid, th in thai_edits.items():
        by_id[cid]["thai"] = th
        log.append(f"    edit {cid}.thai = {th!r}")

    remove_ids = set(deletes)
    new_vocab = [e for e in vocab if e["id"] not in remove_ids]
    for cid in deletes:
        log.append(f"    delete {cid}")
    log.append(f"Eng edits: {len(eng_edits)}  Thai edits: {len(thai_edits)}  Deletes: {len(deletes)}")
    log.append(f"Vocab: {len(vocab)} -> {len(new_vocab)}")
    log.append("")

    backup = vocab_path.with_suffix(".json.bak")
    shutil.copy2(vocab_path, backup)
    vocab_path.write_text(json.dumps(new_vocab, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    log_path = HERE / "apply_log.txt"
    existing = log_path.read_text(encoding="utf-8") if log_path.exists() else ""
    log_path.write_text(existing + "\n".join(log) + "\n", encoding="utf-8")

    print(f"\nApplied. vocab.json: {len(vocab)} -> {len(new_vocab)}  (backup: {backup.name})")


if __name__ == "__main__":
    main()
