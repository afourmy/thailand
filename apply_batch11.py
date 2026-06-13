"""Apply free-form `decisions` file batch 11 — per-line eng edits, deletes, 3 splits, 2 merges, freq lists."""

import json
import shutil
from pathlib import Path

HERE = Path(__file__).parent

# english-only edits: id -> new english
ENG_EDITS = {
    "tamago-l3-699": "fragile, frail",
    "tamago-l3-705": "to take revenge, to avenge",
    "tamago-l3-772": "to criticize, review, evaluate",
    "tamago-l3-802": "to twist, to wring out, to turn",
    "tamago-l3-822": "to be diligent, to be persistent, to practice regularly",
    "tamago-l3-858": "to pretend, to act like, to make a gesture (as if)",
    "tsl-077": "to ignore, to disregard, to turn a blind eye to",
    "tsl-168": "to wriggle, to squirm, to thrash",
    "tsl-228": "sustainable, long-lasting",
    "tsl-247": "sleeveless top (traditional Thai top)",
    "tsl-258": "to accept a job (contract), to work as a freelancer",
    "tsl-288": "to anticipate, to look forward to, to dream of",
    "tsl-323": "envelope",
    "thaipod-1150": "to open wide (e.g mouth, door)",
    "tsl-375": "foreign, out-of-place, alien",
    "tsl-422": "immediate, on-the-spot, in the moment",
    "tsl-491": "nude, pornographic images",
    "tsl-603": "physical education (P.E, at school), gymnastics",
    "tsl-504": "to cultivate, to breed, to implant",
    "tsl-453": "very heavy, crushingly heavy (literal or emotional)",
    "thaipod-0034": "pile, heap; division (e.g army)",
    "thaipod-0493": "to star in, to play the lead role (movie, show)",
    "thaipod-0988": "entrance exam, selection exam",
    "tsl-499": "consequence, aftermath, result",
    "tsl-618": "equivalent, comparable, evenly matched",
    "tsl-621": "scorpion; bloated, swollen",
    "tsl-635": "to support, to help out, to be mutually beneficial",
    "thaipod-0213": "request, application, petition",
    "thaipod-0279": "people (native from), inhabitants of",
    "thaipod-0272": "to admire, to compliment; to view (formal)",
    "thaipod-0319": "male lead actor",
    "thaipod-0320": "lead actor",
    "thaipod-0337": "amicably, peacefully, without troubles, on good terms",
    "thaipod-0356": "to contrast with, to clash with",
    "thaipod-0607": "to push forward, to promote, to drive forward",
    "thaipod-0628": "to bury; to embed, to implant",
    "tsl-607": "to make sth large fall (e.g a tree, a government), to topple, to bring down",
}

# merges: change survivor thai only; english + sources unchanged
MERGE_THAI = {
    "thaipod-0156": "คบ, คบหา",        # absorbs thaipod-0157
    "tamago-l3-619": "มีส่วน, มีส่วนร่วม",  # absorbs thaipod-0780
}

# deletes (plain removes + the absorbed merge cards)
DELETES = {
    "tamago-l3-686",   # ขึ้นบ้าน
    "tamago-l3-766",   # ลงมือทำ
    "tsl-084",         # คําบรรยาย, ซับ
    "tsl-081",         # หนังแนววิทยาศาสตร์
    "thaipod-0110",    # ก้มลง
    "thaipod-0011",    # กระจายอยู่
    "thaipod-0287",    # ชุดขาว
    "thaipod-0157",    # คบหา (merged into thaipod-0156)
    "thaipod-0780",    # มีส่วน (merged into tamago-l3-619)
}

# splits: source id -> [(new_id, thai, english), ...]; new card inherits freq/topic/sources
SPLITS = {
    "tsl-513": [
        ("tsl-513", "สูญเสีย", "to suffer a loss, to lose (sth important)"),
        ("tsl-513b", "สูญสิ้น", "to be irrecoverably lost, to be completely gone"),
    ],
    "tsl-619": [
        ("tsl-619", "ชดใช้", "to pay back, to make amends (for damage, wrongdoing)"),
        ("tsl-619b", "ชดเชย", "to compensate, to offset"),
    ],
    "tsl-091": [
        ("tsl-091", "ไปทำงานต่างประเทศ", "to go on a business trip abroad"),
        ("tsl-091b", "ไปทำงานต่างจังหวัด", "to go on a business trip to another province"),
    ],
}

OCC_BULK = {
    "tamago-l3-692", "tamago-l3-709", "tamago-l3-746", "tamago-l3-760", "tamago-l3-769",
    "tamago-l3-770", "tamago-l3-771", "tamago-l3-785", "tsl-059", "tsl-168", "tsl-174",
    "tsl-197", "tsl-216", "tsl-241", "tsl-247", "tsl-269", "tsl-274", "tsl-291",
    "thaipod-1239", "thaipod-1269", "tsl-320", "tsl-339", "tsl-378", "tsl-465",
    "tsl-450", "tsl-613",
}
RARE_BULK = {"tsl-394"}


def main():
    vocab_path = HERE / "vocab.json"
    log_path = HERE / "apply_log.txt"

    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in vocab}

    log = ["", "=" * 70,
           "Free-form decisions file batch 11 — eng edits, deletes, 3 splits, 2 merges, freq lists", ""]

    # english edits
    eng_applied, eng_missing = [], []
    for eid, eng in ENG_EDITS.items():
        if eid in by_id:
            by_id[eid]["english"] = eng
            eng_applied.append(eid)
            log.append(f"    edit {eid}.english = {eng!r}")
        else:
            eng_missing.append(eid)

    # merges (thai change on survivor)
    for eid, thai in MERGE_THAI.items():
        if eid in by_id:
            by_id[eid]["thai"] = thai
            log.append(f"    merge {eid}.thai = {thai!r}")
        else:
            eng_missing.append(eid)

    # splits: build new entries cloned from source, then replace in place
    new_entries_by_source = {}
    split_missing = []
    for src, parts in SPLITS.items():
        if src not in by_id:
            split_missing.append(src)
            continue
        base = by_id[src]
        clones = []
        for new_id, thai, eng in parts:
            c = dict(base)
            c["id"] = new_id
            c["thai"] = thai
            c["english"] = eng
            clones.append(c)
            log.append(f"    split {src} -> {new_id}: {thai} = {eng!r}")
        new_entries_by_source[src] = clones

    # frequency bulk
    occ_applied, rare_applied = [], []
    for eid in OCC_BULK:
        if eid in by_id:
            by_id[eid]["frequency"] = "occasional"
            occ_applied.append(eid)
    for eid in RARE_BULK:
        if eid in by_id:
            by_id[eid]["frequency"] = "rare"
            rare_applied.append(eid)
    log.append(f"    frequency occasional ({len(occ_applied)}): {', '.join(sorted(occ_applied))}")
    log.append(f"    frequency rare ({len(rare_applied)}): {', '.join(sorted(rare_applied))}")

    # rebuild vocab: drop deletes + split sources, expand splits in original position
    deleted = [eid for eid in DELETES if eid in by_id]
    missing_deletes = [eid for eid in DELETES if eid not in by_id]
    for eid in deleted:
        log.append(f"    delete {eid}")

    new_vocab = []
    for e in vocab:
        if e["id"] in DELETES:
            continue
        if e["id"] in new_entries_by_source:
            new_vocab.extend(new_entries_by_source[e["id"]])
        else:
            new_vocab.append(e)

    log.append(f"Eng edits: {len(eng_applied)}  Merges: {len(MERGE_THAI)}  "
               f"Splits: {len(new_entries_by_source)}  Deletes: {len(deleted)}")
    if eng_missing:
        log.append(f"Skipped (not found): {', '.join(eng_missing)}")
    if split_missing:
        log.append(f"Skipped splits (not found): {', '.join(split_missing)}")
    if missing_deletes:
        log.append(f"Skipped deletes (not found): {', '.join(missing_deletes)}")
    log.append(f"Vocab: {len(vocab)} -> {len(new_vocab)}")
    log.append("")

    backup = vocab_path.with_suffix(".json.bak")
    shutil.copy2(vocab_path, backup)
    vocab_path.write_text(json.dumps(new_vocab, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    existing = log_path.read_text(encoding="utf-8") if log_path.exists() else ""
    log_path.write_text(existing + "\n".join(log) + "\n", encoding="utf-8")

    print(f"Eng edits: {len(eng_applied)}; merges: {len(MERGE_THAI)}; "
          f"splits: {len(new_entries_by_source)}; deletes: {len(deleted)}")
    print(f"Freq -> occasional: {len(occ_applied)}; rare: {len(rare_applied)}")
    if eng_missing:
        print(f"Skipped (not found): {eng_missing}")
    if split_missing:
        print(f"Skipped splits: {split_missing}")
    if missing_deletes:
        print(f"Skipped deletes: {missing_deletes}")
    print(f"vocab.json: {len(vocab)} -> {len(new_vocab)}  (backup: {backup.name})")


if __name__ == "__main__":
    main()
