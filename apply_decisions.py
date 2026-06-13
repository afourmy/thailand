"""Apply decisions.json (the 'to be <adjective>' batch).

Per-row instruction:
  'apply'                  -> english = proposal
  'no' / 'skip' / blank    -> leave unchanged
  ...'<text>'... (quoted)  -> english = the quoted text (custom rewrite)
Anything else -> reported as UNHANDLED and nothing is written.
"""

import json
import shutil
from pathlib import Path

HERE = Path(__file__).parent
vocab_path = HERE / "vocab.json"
decisions_path = HERE / "decisions.json"
log_path = HERE / "apply_log.txt"

vocab = json.loads(vocab_path.read_text(encoding="utf-8"))
by_id = {e["id"]: e for e in vocab}
doc = json.loads(decisions_path.read_text(encoding="utf-8"))

edits = {}      # id -> new english
skipped = []
unhandled = []

for r in doc["rows"]:
    rid = r["row_id"]
    instr = (r["instruction"] or "").strip()
    low = instr.lower()
    if low == "apply":
        edits[rid] = r["proposal"]
    elif "'" in instr:  # custom rewrite, e.g. "make it 'X'", "no should be 'X'"
        qs = [i for i, c in enumerate(instr) if c == "'"]
        edits[rid] = instr[qs[0] + 1:qs[-1]]
    elif low in ("no", "skip", ""):
        skipped.append(rid)
    else:
        unhandled.append((rid, instr))

if unhandled:
    print("UNHANDLED instructions — nothing written. Resolve these first:")
    for rid, t in unhandled:
        print("  ", rid, "->", repr(t))
    raise SystemExit(1)

# apply
applied = []
for rid, eng in edits.items():
    if rid in by_id:
        by_id[rid]["english"] = eng
        applied.append((rid, eng))

# backup + write
shutil.copy2(vocab_path, vocab_path.with_suffix(".json.bak"))
vocab_path.write_text(json.dumps(vocab, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# log
lines = ["", "=" * 70, "Decisions batch — 'to be <adjective>' -> '<adjective>' (adjective cleanup)", ""]
for rid, eng in applied:
    lines.append(f"    edit {rid}.english = {eng!r}")
lines.append(f"Edits: {len(applied)}    Skipped (no/blank): {len(skipped)}")
lines.append("")
existing = log_path.read_text(encoding="utf-8") if log_path.exists() else ""
log_path.write_text(existing + "\n".join(lines) + "\n", encoding="utf-8")

# clear decisions.json back to empty template
doc["rows"] = []
doc["total_rows"] = 0
decisions_path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(f"Applied {len(applied)} english edits; skipped {len(skipped)} (no/blank).")
print("vocab.json backup: vocab.json.bak ; decisions.json cleared.")
