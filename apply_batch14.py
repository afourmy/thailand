"""Apply free-form `decisions` file batch 14 — eng edits, 1 thai edit, 1 split, deletes, freq lists."""

import json
import shutil
from pathlib import Path

HERE = Path(__file__).parent

ENG_EDITS = {
    "yt-c12-058": "to brush, to swipe, to dust",                                              # dropped "to sway"
    "yt-c12-059": "(literally) to weigh down (put a weight on sth); (fig) to hinder, to delay, to slow down",  # weigh->weight
    "yt-c14-040": "repetitive and dull, occurring again and again until it becomes boring, monotonous, tiresome",  # occuring->occurring
    "wlt-c02-030": "to dry in the sun, to expose sth to sunlight",
    "wlt-c02-064": "to lose (sth)",
    "wlt-c02-070": "unoccupied space, vacant place",
    "wlt-c03-015": "pass, entry card",
    "wlt-c03-049": "to go run an errand, to go out on business",
    "wlt-c03-074": "to look for, to search visually for something",
    "wlt-c04-074": "dark colored",
    "wlt-c04-079": "light yellow, pale yellow",
    "yt-c20-074": "to collapse, to fall apart (e.g system, society, empire)",
    "yt-c21-032": "to ambush, to raid, to launch a surprise attack",
    "wlt-c14-061": "Laos",
    "yt-c13-016": "simple yet elegant, sophisticated and classy in a simple way",
    "yt-c13-032": "to sway one's head (side-to-side, to express disbelief or disappointment)",
    "yt-c13-033": "to guess (neutral) - to guess, to predict (e.g games, quizzes) - to guess blindly, randomly",
    "yt-c13-077": "backward, outdated, behind the times",
    "yt-c13-079": "to stretch, to extend; to discriminate against, to look down on",
    "yt-c14-000": "to unlock, to open with a key (lit. to turn the key)",
    "yt-c14-035": "to collapse, to crash, to fall down violently; to destroy, to attack with force",
    "yt-c14-088": "to bounce, to spring back; (skin) firm, tight, not saggy",
    "yt-c15-003": "to target, to aim, to focus on",
    "wlt-c19-080": "to peek at, to secretly watch",
    "yt-c15-057": "(lit) to open slightly; (fig) to hint at, to reveal a little",
    "yt-c15-075": "(onomatopoeic verb) to boo, to shout loudly to show dislike",
    "yt-c15-066": "to pry, to lever up",
    "yt-c15-074": "to be unintentionally left out, to be omitted",
    "yt-c15-077": "to lose one's balance (physically), to lose control, to lose one's stability (emotionally)",
    "yt-c15-085": "to spin, to twirl, to rotate",
    "yt-c15-097": "to damage, to tarnish (usually reputation, social standing)",
    "yt-c16-035": "to solve, to figure out (e.g a problem, a puzzle); to turn, to operate",
    "yt-c16-048": "to affect, to shake, to impact (physically or emotionally)",
    "wlt-c05-060": "to amend, to revise",
    "wlt-c05-091": "coach, trainer",
    "wlt-c06-046": "to clarify, to explain in detail",
    "wlt-c06-048": "underwear, lingerie",
    "wlt-c06-069": "to slap, to strike with the open hand",
    "wlt-c08-032": "to look at closely, to observe",
    "wlt-c11-087": "destitute, poor",
}

# thai-field edit (english untouched)
THAI_EDITS = {
    "yt-c15-024": "กลิ่นสาบ",
}

# split: drop the middle form ยักไหล่; keep ยัก + พยักหน้า
SPLITS = {
    "yt-c13-063": [
        ("yt-c13-063", "ยัก", "to shrug, to move slightly"),
        ("yt-c13-063b", "พยักหน้า", "to nod one's head"),
    ],
}

DELETES = {
    "yt-c03-048", "t4k-c03-038", "wlt-c03-089", "wlt-c04-051", "yt-c20-095",
    "wlt-c13-036", "wlt-c13-053", "yt-c10-060", "wlt-c18-003", "wlt-c18-058",
    "wlt-c19-079", "wlt-c04-085",
    # line 65 bulk (countries / demonyms)
    "wlt-c13-081", "wlt-c13-090", "wlt-c13-091", "wlt-c13-094", "wlt-c13-096",
    "wlt-c14-004", "wlt-c14-003", "wlt-c14-008", "wlt-c14-023", "wlt-c14-024",
    "wlt-c14-076", "wlt-c14-078", "wlt-c14-072", "wlt-c15-001", "wlt-c15-008",
    "wlt-c15-010", "wlt-c15-011", "wlt-c15-012", "wlt-c15-013", "wlt-c15-019",
    "wlt-c15-004", "wlt-c15-044", "wlt-c15-095", "wlt-c16-058",
}

OCC_BULK = {
    "wlt-c01-093", "wlt-c04-054", "yt-c13-060", "yt-c14-028", "wlt-c18-044",
    "yt-c15-023", "yt-c15-035", "yt-c15-075", "yt-c15-082", "yt-c16-001", "yt-c16-004",
}
EVERYDAY_BULK = {"wlt-c02-086"}


def main():
    vocab_path = HERE / "vocab.json"
    log_path = HERE / "apply_log.txt"

    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in vocab}

    log = ["", "=" * 70,
           "Free-form decisions file batch 14 — eng edits, 1 thai edit, 1 split, deletes, freq lists", ""]

    eng_applied, missing = [], []
    for eid, eng in ENG_EDITS.items():
        if eid in by_id:
            by_id[eid]["english"] = eng
            eng_applied.append(eid)
            log.append(f"    edit {eid}.english = {eng!r}")
        else:
            missing.append(eid)

    for eid, thai in THAI_EDITS.items():
        if eid in by_id:
            by_id[eid]["thai"] = thai
            log.append(f"    edit {eid}.thai = {thai!r}")
        else:
            missing.append(eid)

    new_entries_by_source, split_missing = {}, []
    for src, parts in SPLITS.items():
        if src not in by_id:
            split_missing.append(src)
            continue
        base = by_id[src]
        clones = []
        for new_id, thai, eng in parts:
            c = dict(base)
            c["id"], c["thai"], c["english"] = new_id, thai, eng
            clones.append(c)
            log.append(f"    split {src} -> {new_id}: {thai} = {eng!r}")
        new_entries_by_source[src] = clones

    def set_freq(ids, value):
        done = []
        for eid in ids:
            if eid in by_id:
                by_id[eid]["frequency"] = value
                done.append(eid)
        log.append(f"    frequency {value} ({len(done)}): {', '.join(sorted(done))}")
        return done

    occ_applied = set_freq(OCC_BULK, "occasional")
    everyday_applied = set_freq(EVERYDAY_BULK, "everyday")

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

    log.append(f"Eng edits: {len(eng_applied)}  Thai edits: {len(THAI_EDITS)}  Splits: {len(new_entries_by_source)}  "
               f"Deletes: {len(deleted)}  occasional: {len(occ_applied)}  everyday: {len(everyday_applied)}")
    if missing:
        log.append(f"Skipped edits (not found): {', '.join(missing)}")
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

    print(f"Eng edits: {len(eng_applied)}; thai edits: {len(THAI_EDITS)}; splits: {len(new_entries_by_source)}; "
          f"deletes: {len(deleted)}; occasional: {len(occ_applied)}; everyday: {len(everyday_applied)}")
    if missing:
        print(f"Skipped edits (not found): {missing}")
    if split_missing:
        print(f"Skipped splits (not found): {split_missing}")
    if missing_deletes:
        print(f"Skipped deletes (not found): {missing_deletes}")
    print(f"vocab.json: {len(vocab)} -> {len(new_vocab)}  (backup: {backup.name})")


if __name__ == "__main__":
    main()
