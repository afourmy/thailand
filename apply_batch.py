"""Apply free-form `decisions` file batch 10 — per-line edits + 2 bulk-freq lists, 1 merge, 12 deletes."""

import json
import shutil
from pathlib import Path

HERE = Path(__file__).parent

EDITS = {
    # english only
    "tamago-l12-343": {"english": "pronoun to refer to a girl of similar age (informal term, teasing or scolding tone)"},
    "tamago-l12-597": {"english": "stall, booth; blister pack (e.g pills); panel, board"},
    "tamago-l12-614": {"english": "to skip school, to skip class"},
    "tamago-l3-013": {"english": "to make a payment, to settle a bill"},
    "tamago-l3-080": {"english": "the people around"},
    "chula-l4-001": {"english": "dizzy, lightheaded"},
    "chula-l4-020": {"english": "influenza, flu"},
    "tamago-l3-125": {"english": "to compete for; to seize, to snatch"},
    "tamago-l3-163": {"english": "story, narrative"},
    "tamago-l3-344": {"english": "to compete for, to fight over; to grab, to seize"},
    "tamago-l3-355": {"english": "to claim, to assert; to quote, to cite; to give an excuse"},
    "tamago-l3-410": {"english": "reputation, hearsay, rumor, what people say"},
    "tamago-l3-420": {"english": "to glow, to emit light"},
    "tamago-l3-447": {"english": "wave"},
    "tamago-l3-397": {"english": "to avoid taking responsibility for a task and try to shift it to others"},
    "tamago-l3-398": {"english": "to persuade gently, to soothe; to sing a lullaby"},
    "tamago-l3-422": {"english": "to prank, to trick; to fake, to bluff"},
    "tamago-l3-600": {"english": "to seek out, search for, dig up; to pick carefully, to recruit"},
    "tamago-l3-620": {"english": "comfortable and happy, at ease"},
    "tamago-l3-631": {"english": "inferior, low"},
    "tamago-l3-650": {"english": "to form a group, to group up"},
    "tamago-l3-660": {"english": "to introduce (a topic, a presentation), to preface"},
    "tamago-l3-675": {"english": "gem, precious stone; to also be affected, to be involved indirectly"},
    "tamago-l3-393": {"english": "very obviously, clearly, 'right in front of you'"},
    # change thai + english
    "thai9k-002": {"thai": "เข้าร่วม", "english": "to join, attend, participate in"},
    # merge: fold tamago-l3-112 สมกับ into tamago-l3-409, keep survivor's english
    "tamago-l3-409": {"thai": "สม, สมกับ"},
}

OCC_BULK = {
    "tamago-l12-599", "tamago-l12-602", "tamago-l3-138", "tamago-l3-153", "tamago-l3-173",
    "tamago-l3-237", "tamago-l3-252", "tamago-l3-274", "tamago-l3-305", "tamago-l3-351",
    "tamago-l3-361", "tamago-l3-401", "tamago-l3-447", "tamago-l3-481", "tamago-l3-562",
    "tamago-l3-573", "tamago-l3-475", "tamago-l3-506", "tamago-l3-625", "tamago-l3-655",
    "tamago-l3-673", "tamago-l3-681",
}
EVERYDAY_BULK = {
    "tamago-l3-187", "chula-l4-045", "chula-l4-046", "tamago-l3-515",
}
for _id in OCC_BULK:
    EDITS.setdefault(_id, {})["frequency"] = "occasional"
for _id in EVERYDAY_BULK:
    EDITS.setdefault(_id, {})["frequency"] = "everyday"

DELETES = {
    "tamago-l12-616",  # โดนตัด
    "tamago-l3-191",   # อินเตอร์
    "tamago-l3-196",   # ตีกัน
    "tamago-l3-264",   # บูม
    "tamago-l3-269",   # บูธ
    "tamago-l3-329",   # เข้าหา
    "tamago-l3-373",   # จ้องดู
    "tamago-l3-477",   # ก้มเก็บ
    "tamago-l3-519",   # พูดมั่ว
    "tamago-l3-614",   # สานต่อ
    "tamago-l3-662",   # บุคคลสำคัญ
    "tamago-l3-112",   # สมกับ (merged into tamago-l3-409)
}
PARKS = set()

APPLIED_ROW_IDS = set()


def main():
    vocab_path = HERE / "vocab.json"
    decisions_path = HERE / "decisions.json"
    parked_path = HERE / "parked.json"
    log_path = HERE / "apply_log.txt"

    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in vocab}

    applied = []
    skipped = []
    for eid, fields in EDITS.items():
        if eid not in by_id:
            skipped.append(eid)
            continue
        for k, v in fields.items():
            by_id[eid][k] = v
        applied.append((eid, fields))

    parked = [by_id[eid] for eid in PARKS if eid in by_id]
    parked_doc = json.loads(parked_path.read_text(encoding="utf-8"))
    for entry in parked:
        parked_doc["entries"].append(entry)
    parked_path.write_text(
        json.dumps(parked_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    remove_ids = DELETES | PARKS
    deleted = [eid for eid in DELETES if eid in by_id]
    missing_deletes = [eid for eid in DELETES if eid not in by_id]
    new_vocab = [e for e in vocab if e["id"] not in remove_ids]

    log_lines = [
        "", "=" * 70,
        "Free-form decisions file batch 10 — per-line edits + 2 bulk-freq lists, 1 merge, 12 deletes", "",
    ]
    for eid, fields in applied:
        for k, v in fields.items():
            log_lines.append(f"    edit {eid}.{k} = {v!r}")
    if deleted:
        for eid in deleted:
            log_lines.append(f"    delete {eid}")
    if skipped:
        log_lines.append(f"Skipped edits (not found): {', '.join(skipped)}")
    if missing_deletes:
        log_lines.append(f"Skipped deletes (not found): {', '.join(missing_deletes)}")
    log_lines.append(f"Total field edits: {sum(len(f) for _, f in applied)}")
    log_lines.append(f"Cards edited: {len(applied)}")
    log_lines.append(f"Deletions: {len(deleted)}")
    log_lines.append(f"Vocab: {len(vocab)} -> {len(new_vocab)}")
    log_lines.append("")

    existing_log = log_path.read_text(encoding="utf-8") if log_path.exists() else ""
    log_path.write_text(existing_log + "\n".join(log_lines) + "\n", encoding="utf-8")

    backup = vocab_path.with_suffix(".json.bak")
    shutil.copy2(vocab_path, backup)
    vocab_path.write_text(
        json.dumps(new_vocab, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    doc = json.loads(decisions_path.read_text(encoding="utf-8"))
    before = len(doc["rows"])
    doc["rows"] = [r for r in doc["rows"] if r["row_id"] not in APPLIED_ROW_IDS]
    doc["total_rows"] = len(doc["rows"])
    decisions_path.write_text(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"Applied {sum(len(f) for _, f in applied)} field edits across {len(applied)} cards")
    print(f"Deleted ({len(deleted)}): {sorted(deleted)}")
    if skipped:
        print(f"Skipped edits: {skipped}")
    if missing_deletes:
        print(f"Skipped deletes: {missing_deletes}")
    print(f"vocab.json: {len(vocab)} -> {len(new_vocab)}")
    print(f"vocab.json backup: {backup.name}")


if __name__ == "__main__":
    main()
