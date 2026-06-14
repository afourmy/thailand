"""Apply free-form `decisions` file batch 12 — eng edits, deletes, 1 merge, freq list."""

import json
import shutil
from pathlib import Path

HERE = Path(__file__).parent

# english-only edits: id -> new english  (line 14 thaipod-1150 deliberately omitted)
ENG_EDITS = {
    "tsl-619b": "to compensate, to make up for, to offset",
    "thaipod-0748": "illustration, diagram",
    "thaipod-0453": "souvenir, keepsake",
    "thaipod-0868": "waterfront, along the coast",
    "thaipod-0873": "to see through someone's intentions, to read someone's game",
    "thaipod-0919": "to set the course, to establish an approach",
    "thaipod-0920": "academic major (university)",
    "thaipod-0982": "to wear, to put on (formal)",
    "thaipod-1028": "colorful; (fig) liveliness, vibrancy",
    "thaipod-1032": "to stem from, to result from, to be a continuation of",
    "thaipod-0888": "to slip through (underneath), to go under",
    "tobo-400": "insurance, guarantee",
    "thaipod-0961": "truthful, realistic, lifelike",
    "thaipod-1055": "to frown, to look grumpy, sulky face",
    "thaipod-1179": "outline, structure (e.g of a plan, a book)",
    "thaipod-1199": "to dry off, to wipe the body",
    "thaipod-1229": "in secret, confidentially",
    "thaipod-1242": "distorted, strange, off; derived from",
    "thaipod-1263": "to attack, to take action against, to target",
    "thaipod-1285": "to try one's luck, to make a guess, to try fortune-telling",
    "thaipod-1360": "curve, arc",
    "tobo-102": "contract, agreement, promise",
    "tobo-151": "square",
    "tobo-307": "to torture, to torment; to be in agony, to suffer",
    "tobo-331": "excuse, justification",
    "tobo-358": "to interrupt, to disturb the flow",
    "yt-c01-079": "to cling to, to stick to",
    "yt-c01-080": "to calm down, to settle down (about a situation)",
    "yt-c01-015": "reasonable, logical",
    "yt-c01-059": "to hold (e.g a position), to maintain, to preserve",
    "yt-c01-091": "city center, downtown",
    "yt-c01-093": "to imitate, to mimic",
    "yt-c02-014": "powerful, mighty",
    "yt-c02-011": "to mock, to imitate in a mocking way, to ridicule",
    "yt-c02-026": "to eliminate, to disqualify, to screen out",
    "yt-c03-087": "folder, file",
    "yt-c03-088": "to clip, to pinch, to clamp",
    "yt-c04-005": "to criticize, to judge, to comment",
    "yt-c03-007": "hundred; to string, to thread (idea of connecting items in a sequence)",
    "yt-c03-040": "to clap (hands), to applaud",
    "yt-c04-006": "to roll, to curl, roll, classifier for rolled items (e.g toilet paper)",
    "yt-c03-049": "over and over, in quick succession, repeatedly, non-stop",
    "yt-c04-012": "to insert in, to slip into (an object, usually a small space)",
    "yt-c05-012": "showerhead",
    "yt-c04-019": "to swipe, to wipe, to cut across (quick motion)",
    "yt-c04-084": "to tighten, to constrict, to fasten, to bind tightly",
    "yt-c04-086": "to let loose, to slacken, to relax, to drop (make sth less tight, and let sth hang)",
    "yt-c05-003": "to swipe (e.g a credit card), to slide (e.g zipper)",
    "yt-c05-036": "to rub, to crush, to scrub (repeated movement)",
    "yt-c05-056": "to lift, to raise; a round (e.g in a boxing match)",
}

# merge: survivor tobo-509 thai change; english + sources unchanged; absorbs thaipod-0824
MERGE_THAI = {
    "tobo-509": "รอด, รอดชีวิต",
}

DELETES = {
    "t4k-c02-037",   # สูญเสีย (dup)
    "yt-c06-029",    # ชดเชย (dup)
    "yt-c22-041",    # ชดใช้ (dup)
    "thaipod-0805",  # ยื่นออกไป
    "thaipod-0909",  # ล้อมรอบอยู่
    "tobo-188",      # สายเคเบิล
    "yt-c01-081",    # ชีวิตรอด
    "thaipod-1083",  # หันมา
    "thaipod-0824",  # รอด (merged into tobo-509)
}

OCC_BULK = {
    "thaipod-0746", "thaipod-0860", "thaipod-0868", "thaipod-0882", "thaipod-1156",
    "thaipod-1031", "thaipod-1032", "tobo-424", "thaipod-1060", "thaipod-1157",
    "thaipod-1089", "thaipod-1179", "thaipod-1248", "thaipod-1363", "yt-c05-052",
    "yt-c03-021", "yt-c03-070", "yt-c05-008", "yt-c05-007", "yt-c05-006",
    "yt-c05-005", "yt-c04-079", "yt-c05-022", "yt-c05-015",
}


def main():
    vocab_path = HERE / "vocab.json"
    log_path = HERE / "apply_log.txt"

    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in vocab}

    log = ["", "=" * 70,
           "Free-form decisions file batch 12 — eng edits, deletes, 1 merge, freq list", ""]

    eng_applied, missing = [], []
    for eid, eng in ENG_EDITS.items():
        if eid in by_id:
            by_id[eid]["english"] = eng
            eng_applied.append(eid)
            log.append(f"    edit {eid}.english = {eng!r}")
        else:
            missing.append(eid)

    for eid, thai in MERGE_THAI.items():
        if eid in by_id:
            by_id[eid]["thai"] = thai
            log.append(f"    merge {eid}.thai = {thai!r}")
        else:
            missing.append(eid)

    occ_applied = []
    for eid in OCC_BULK:
        if eid in by_id:
            by_id[eid]["frequency"] = "occasional"
            occ_applied.append(eid)
    log.append(f"    frequency occasional ({len(occ_applied)}): {', '.join(sorted(occ_applied))}")

    deleted = [eid for eid in DELETES if eid in by_id]
    missing_deletes = [eid for eid in DELETES if eid not in by_id]
    for eid in deleted:
        log.append(f"    delete {eid}")
    new_vocab = [e for e in vocab if e["id"] not in DELETES]

    log.append(f"Eng edits: {len(eng_applied)}  Merges: {len(MERGE_THAI)}  "
               f"Deletes: {len(deleted)}  -> occasional: {len(occ_applied)}")
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

    print(f"Eng edits: {len(eng_applied)}; merges: {len(MERGE_THAI)}; deletes: {len(deleted)}; "
          f"-> occasional: {len(occ_applied)}")
    if missing:
        print(f"Skipped edits (not found): {missing}")
    if missing_deletes:
        print(f"Skipped deletes (not found): {missing_deletes}")
    print(f"vocab.json: {len(vocab)} -> {len(new_vocab)}  (backup: {backup.name})")


if __name__ == "__main__":
    main()
