"""Generate decisions.json for the 'to be <adjective>' -> '<adjective>' cleanup.

Only ADJECTIVE cards are kept (hand-classified). Verbs/events/nouns/modals and
phrase-only glosses ('to be born', 'to be in charge, to govern', 'to be a
passenger', 'to be able to', 'to be in jail') are excluded.
instruction is pre-filled with 'apply' so review is by exception.
"""

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
vocab = json.loads((HERE / "vocab.json").read_text(encoding="utf-8"))

# Adjective cards to keep (the rest of the 'to be ...' set are verbs/events/nouns)
KEEP = {
    "chula-l5-116", "chula-l5-268", "chula-l6-271",
    "tamago-l12-096", "tamago-l12-121", "tamago-l12-186", "tamago-l12-283",
    "tamago-l12-309", "tamago-l12-482", "tamago-l12-522", "tamago-l12-542",
    "tamago-l3-009", "tamago-l3-065", "tamago-l3-082", "tamago-l3-124",
    "tamago-l3-313",
    "tamago-l3-324", "tamago-l3-327", "tamago-l3-342", "tamago-l3-491",
    "tamago-l3-520", "tamago-l3-537", "tamago-l3-592", "tamago-l3-613",
    "tamago-l3-765",
    "tsl-007", "tsl-106", "tsl-114",
    "thaipod-0757", "thaipod-1159", "thaipod-1226", "thaipod-1234",
    "yt-c01-075", "yt-c07-024", "yt-c07-030", "yt-c09-055", "yt-c11-092",
    "yt-c15-074", "yt-c20-018", "yt-c21-090", "yt-c22-016", "yt-c22-098",
    "wlt-c02-085", "wlt-c02-094", "wlt-c03-042", "wlt-c03-089", "wlt-c06-063",
    "wlt-c09-053", "wlt-c10-066", "wlt-c11-047", "wlt-c12-072", "wlt-c12-074",
    "wlt-c13-086", "wlt-c14-050", "wlt-c14-096", "wlt-c14-098", "wlt-c15-035",
    "wlt-c15-039", "wlt-c15-086", "wlt-c16-021", "wlt-c16-031", "wlt-c16-047",
    "wlt-c17-081", "wlt-c17-083", "wlt-c18-088", "wlt-c19-013", "wlt-c19-014",
    "wlt-c19-020", "wlt-c19-021", "wlt-c19-045", "wlt-c19-058", "wlt-c19-089",
    "wlt-c20-004", "wlt-c20-020", "wlt-c20-034", "wlt-c20-050", "wlt-c20-074",
    "wlt-c21-003", "wlt-c21-054", "wlt-c21-071",
    "t4k-c04-022", "t4k-c06-031", "t4k-c06-071",
}


def strip_tobe(s):
    s = re.sub(r"^[Tt]o be ", "", s)
    s = re.sub(r"([,;] )to be ", r"\1", s)
    return s


matches = [e for e in vocab if e["english"].startswith("to be ")]
by_id = {e["id"]: e for e in vocab}

missing = [k for k in KEEP if k not in by_id]
if missing:
    print("!! KEEP ids not found (typo?):", missing)

rows = []
for e in matches:
    if e["id"] not in KEEP:
        continue
    rows.append({
        "row_id": e["id"],
        "issue_type": "translation",
        "comment": "Adjective glossed 'to be ...'; proposal drops 'to be' (your preference).",
        "proposal": strip_tobe(e["english"]),
        "instruction": "apply",
        "entries": [
            {k: e[k] for k in ("id", "thai", "english", "frequency", "topic", "sources")}
        ],
    })

doc = {
    "version": "2",
    "generated_from": "vocab.json",
    "schema": {
        "issue_type": "Category of the issue: 'translation', 'typo', or 'frequency'.",
        "comment": "Explanation of the problem. Read-only.",
        "proposal": "Suggested new english. Pre-filled; edit in place if you want a different value.",
        "instruction": "'apply' to use the proposal, 'skip' to leave unchanged, or a custom instruction. Pre-filled with 'apply'.",
        "entries": "Full entry data for context. Read-only.",
    },
    "total_rows": len(rows),
    "rows": rows,
}
(HERE / "decisions.json").write_text(
    json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

print(f"KEPT (adjectives): {len(rows)}    DROPPED (not adjectives): {len(matches) - len(rows)}")
print()
print("=== DROPPED (verify I didn't wrongly drop an adjective) ===")
for e in matches:
    if e["id"] not in KEEP:
        print(f"  {e['id']:16} {e['thai']:16} {strip_tobe(e['english'])}")
