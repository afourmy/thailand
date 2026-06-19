"""Apply free-form `decisions` file batch 18 — eng edits, 1 update+park, 4 removes."""

import json
import shutil
from pathlib import Path

HERE = Path(__file__).parent

ENG_EDITS = {
    "wlt-c12-083": "to live, to reside; to depend on, to rely on",
    "wlt-c12-086": "warm, to warm up, to heat up",
    "wlt-c12-089": "department, bureau, government agency",
    "wlt-c13-009": "mark, line, to mark, to draw a line; 100 grams",
    "wlt-c13-030": "to check (loanword)",
    "wlt-c13-048": "to contact, to get in touch with",
    "wlt-c13-093": "to introduce; to advise, to suggest",
    "wlt-c14-000": "ancient, old, archaic",
    "wlt-c14-007": "to change, to transform, to alter",
    "wlt-c14-046": "to cooperate, to collaborate, to work together",
    "wlt-c14-058": "to fall down, to topple; to collapse",
    "wlt-c14-062": "number, numeral; (informal) math",
    "wlt-c14-066": "to leave out, to omit, to skip",
    "wlt-c14-091": "yard (~0.91m)",
    "wlt-c14-089": "to show, to display",
    "wlt-c15-075": 'to overlap, to stack on top; to press, to run over, to crush; slash ("/")',
    "wlt-c16-084": "to invite, to suggest someone to do something",
    "wlt-c16-096": "building (e.g large, concrete)",
    "wlt-c21-029": "to meet, to encounter",
    "t4k-c01-008": "source, origin",
    "t4k-c01-012": "to offer, to propose",
    "t4k-c01-013": "clear, easy to comprehend",
    "t4k-c01-019": "list of; individual; item; case, instance",
    "t4k-c01-023": "believable, credible",
    "t4k-c01-027": "to resemble, to look like",
    "t4k-c01-028": "to help, to assist",
    "t4k-c01-031": "official; formal",
    "t4k-c01-052": "to carry out, to perform, to conduct",
    "t4k-c01-056": "adjacent, close; intimate",
    "t4k-c01-062": "energy, power",
    "t4k-c01-084": "bad, evil, harmful",
    "t4k-c01-091": "order, command",
    "t4k-c01-047": "related, connected",
    "t4k-c01-082": "to fight, to struggle",
    "t4k-c02-006": "to know how to do, to be skilled at; to pretend, to feign",
    "t4k-c02-009": "to stack, to overlap",
    "t4k-c02-016": "unit (of measurement)",
    "t4k-c02-017": "office, bureau, institution",
    "t4k-c02-018": "close, intimate",
    "t4k-c02-020": "far, distant, remote",
    "t4k-c02-025": "stream, flow; (fig) trend, wave",
    "t4k-c02-029": "various, many kinds",
    "t4k-c02-032": "to apply, to spread on a surface (e.g paint, cream)",
    "t4k-c02-034": "to hunt",
    "t4k-c02-040": "to protect, to defend",
    "t4k-c02-042": "blocked, clogged, obstructed; ton (unit)",
    "t4k-c02-047": "place, location",
    "t4k-c02-048": "to exceed, to go beyond; futuristic, advanced, cutting-edge",
    "t4k-c02-050": "aspect, point of view",
    "t4k-c02-051": "words, speech",
    "t4k-c02-056": "secret, hidden; to sharpen (e.g knife)",
    "t4k-c02-060": "to digest, to break down; smaller part, minor, sub-",
    "t4k-c02-070": "to establish, to set up",
    "t4k-c02-071": "to cause, to give rise to",
    "t4k-c02-073": "rank, status, dignity, prestige",
    "t4k-c02-083": 'to add; plus ("+"), positive',
    "t4k-c02-084": "twisted, crooked, bent",                       # reworded (dropped "(slang) lame, uncool")
    "t4k-c02-098": "to think of, to recall, to remember",
    "t4k-c03-011": "to press",
    "t4k-c03-016": "to surround, to encircle; to besiege",
}

# update english, then park (move to parked.json, remove from vocab)
PARK = {
    "wlt-c12-092": "round, circular; large bottle of whisky",
}

DELETES = {
    "wlt-c13-033",  # ซาอุดีอาระเบีย
    "wlt-c19-016",  # ไม่ติด
    "t4k-c01-054",  # เข้าสู่
    "t4k-c02-035",  # กล่าวถึง
}


def main():
    vocab_path = HERE / "vocab.json"
    parked_path = HERE / "parked.json"
    log_path = HERE / "apply_log.txt"

    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in vocab}

    log = ["", "=" * 70, "Free-form decisions file batch 18 — eng edits, 1 update+park, 4 removes", ""]

    eng_applied, missing = [], []
    for eid, eng in ENG_EDITS.items():
        if eid in by_id:
            by_id[eid]["english"] = eng
            eng_applied.append(eid)
            log.append(f"    edit {eid}.english = {eng!r}")
        else:
            missing.append(eid)

    parked_doc = json.loads(parked_path.read_text(encoding="utf-8"))
    parked_ids = set()
    for eid, eng in PARK.items():
        if eid in by_id:
            by_id[eid]["english"] = eng
            parked_doc["entries"].append(by_id[eid])
            parked_ids.add(eid)
            log.append(f"    update+park {eid} (english = {eng!r})")
        else:
            missing.append(eid)
    parked_path.write_text(json.dumps(parked_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    remove_ids = DELETES | parked_ids
    deleted = [eid for eid in DELETES if eid in by_id]
    missing_deletes = [eid for eid in DELETES if eid not in by_id]
    for eid in deleted:
        log.append(f"    delete {eid}")
    new_vocab = [e for e in vocab if e["id"] not in remove_ids]

    log.append(f"Eng edits: {len(eng_applied)}  Parked: {len(parked_ids)}  Deletes: {len(deleted)}")
    if missing:
        log.append(f"Skipped edits (not found): {', '.join(missing)}")
    if missing_deletes:
        log.append(f"Skipped deletes (not found): {', '.join(missing_deletes)}")
    log.append(f"Vocab: {len(vocab)} -> {len(new_vocab)}")
    log.append("")

    backup = vocab_path.with_suffix(".json.bak")
    shutil.copy2(vocab_path, backup)
    vocab_path.write_text(json.dumps(new_vocab, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    existing = log_path.read_text(encoding="utf-8") if log_path.exists() else ""
    log_path.write_text(existing + "\n".join(log) + "\n", encoding="utf-8")

    print(f"Eng edits: {len(eng_applied)}; parked: {len(parked_ids)}; deletes: {len(deleted)}")
    if missing:
        print(f"Skipped edits (not found): {missing}")
    if missing_deletes:
        print(f"Skipped deletes (not found): {missing_deletes}")
    print(f"vocab.json: {len(vocab)} -> {len(new_vocab)}  (backup: {backup.name})")


if __name__ == "__main__":
    main()
