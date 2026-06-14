"""Apply free-form `decisions` file batch 13 — eng edits, 2 splits, easy->everyday + occasional + rare lists."""

import json
import shutil
from pathlib import Path

HERE = Path(__file__).parent

ENG_EDITS = {
    "yt-c04-086": "to let loose, to slacken, to relax, to drop (make sth less tight, or let sth hang)",
    "yt-c05-060": "to get past (e.g a difficulty), to rise above, to overcome",
    "yt-c05-088": "to cover, to wrap (usually with a cloth, e.g blanket)",
    "yt-c06-012": "to pick up a habit, to get used to a behavior",
    "yt-c06-017": "public image, reputation, public perception",
    "yt-c06-020": "to tie, to bind, to bundle",
    "yt-c06-066": "to wiggle, to twitch, to move slightly back and forth",
    "yt-c06-079": "to shake, to sway, to move back and forth, to shift",
    "yt-c07-012": "to decay, to rot, to deteriorate, rotten",
    "yt-c07-013": "to extend, to add on, to renovate (by expansion)",
    "yt-c07-017": "to insist, to maintain firmly, to stand one's ground",          # fixed: "on one's" -> "one's"
    "yt-c07-073": "rushed, in a hurry, hastily",                                    # fixed: dropped "hasten", "hury"->"hurry"
    "yt-c07-076": "to combine, to be put together",
    "yt-c08-004": "to carry on oneself; (fig) innate, ingrained",
    "yt-c08-005": "to reveal the answer, to provide the solution (e.g tests, exercises)",
    "yt-c08-026": "to blink, to flicker (e.g eyes, light)",
    "yt-c09-073": "to go against, to go in the opposite direction; to repeat, to review",
    "yt-c08-037": "half, hemisphere, side (one of two parts)",
    "yt-c08-039": "to trim hair, to snip the end of the hair",
    "yt-c08-048": "to reinforce, to emphasize, to underscore",
    "yt-c08-075": "to supplement, to reinforce, to enhance",
    "yt-c09-008": "prejudice, bias",
    "yt-c09-053": "alone, by oneself, independently (without others)",
    "wlt-c07-068": "to behave, to conduct oneself (formal)",
    "wlt-c12-023": "object, material",
    "yt-c09-082": "to cram, to shove, to force sth into a tight space",
    "yt-c09-085": "bright colors, vivid colors",
    "yt-c10-019": "to support, to prop up, to bolster",
    "yt-c11-080": "to slow down, to decelerate, to delay",
    "yt-c10-087": "aspect - angle, viewpoint - point of view, perspective",
    "yt-c10-086": "to trick, to fool, to pretend - to deceive, to lure - to scam, to defraud, to deceive",
    "yt-c10-015": "rational, logical, reasonable, 'it makes sense'",
    "wlt-c12-077": "to explain",
    "wlt-c05-079": "strong, robust",
    "wlt-c08-025": "(playing) cards",
    "yt-c11-000": "to be knocked out, to pass out (lose consciousness, usually in a fight)",
    "yt-c11-007": "to move swiftly, to drive quickly, to speed along; to glide, to sail",
    "yt-c11-015": "to ventilate, to allow air circulation",
    "yt-c11-083": "public response, reception, feedback from people",
    "yt-c11-091": "similar, matching, identical, to correspond, to be the same",
    "yt-c12-003": "mysterious, secretive",
    "yt-c12-005": "to say, to state, to mention (formal)",
    "wlt-c05-059": "to correct, to fix, to revise",
    "wlt-c07-074": "factor",
    "wlt-c08-073": "system",
    "wlt-c10-043": "to multiply",
    "yt-c11-053": "to herd, to round up (animals)",
    "yt-c12-054": "to tease, to provoke, to entice",
}

# splits: source id -> [(new_id, thai, english), ...]; new card inherits freq/topic/sources
SPLITS = {
    "yt-c12-030": [
        ("yt-c12-030", "เกี่ยว", "related to, concerning; to harvest, to reap; to hook, to link, to entangle"),
        ("yt-c12-030b", "เก็บเกี่ยว", "to harvest crops (e.g rice, wheat)"),
    ],
    "yt-c12-032": [
        ("yt-c12-032", "บกพร่อง", "defective, lacking, flawed"),
        ("yt-c12-032b", "ข้อบกพร่อง", "defect, flaw"),
    ],
}

# "easy:" list -> everyday
EVERYDAY_BULK = {
    "wlt-c06-079", "yt-c03-084", "wlt-c09-074", "wlt-c09-079", "wlt-c10-038",
    "wlt-c10-057", "wlt-c10-062", "wlt-c10-092", "wlt-c11-010", "wlt-c11-013",
    "wlt-c11-014", "wlt-c11-021", "wlt-c11-022", "wlt-c11-042", "wlt-c12-000",
    "wlt-c12-025", "wlt-c12-029", "wlt-c12-023", "wlt-c12-045", "wlt-c12-072",
    "wlt-c12-077", "wlt-c05-079", "wlt-c06-070", "wlt-c06-089", "wlt-c08-060",
    "wlt-c05-059",
}

OCC_BULK = {
    "yt-c05-069", "yt-c05-086", "yt-c06-039", "yt-c06-050", "yt-c06-061",
    "yt-c07-089", "yt-c08-023", "yt-c11-035", "yt-c11-015", "wlt-c07-073",
}

# rare: first entry has no id -> resolved by thai to yt-c08-036
RARE_BULK = {"yt-c08-036", "yt-c09-060"}


def main():
    vocab_path = HERE / "vocab.json"
    log_path = HERE / "apply_log.txt"

    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in vocab}

    log = ["", "=" * 70,
           "Free-form decisions file batch 13 — eng edits, 2 splits, easy->everyday + occasional + rare", ""]

    eng_applied, missing = [], []
    for eid, eng in ENG_EDITS.items():
        if eid in by_id:
            by_id[eid]["english"] = eng
            eng_applied.append(eid)
            log.append(f"    edit {eid}.english = {eng!r}")
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

    everyday_applied = set_freq(EVERYDAY_BULK, "everyday")
    occ_applied = set_freq(OCC_BULK, "occasional")
    rare_applied = set_freq(RARE_BULK, "rare")

    new_vocab = []
    for e in vocab:
        if e["id"] in new_entries_by_source:
            new_vocab.extend(new_entries_by_source[e["id"]])
        else:
            new_vocab.append(e)

    log.append(f"Eng edits: {len(eng_applied)}  Splits: {len(new_entries_by_source)}  "
               f"everyday: {len(everyday_applied)}  occasional: {len(occ_applied)}  rare: {len(rare_applied)}")
    if missing:
        log.append(f"Skipped edits (not found): {', '.join(missing)}")
    if split_missing:
        log.append(f"Skipped splits (not found): {', '.join(split_missing)}")
    log.append(f"Vocab: {len(vocab)} -> {len(new_vocab)}")
    log.append("")

    backup = vocab_path.with_suffix(".json.bak")
    shutil.copy2(vocab_path, backup)
    vocab_path.write_text(json.dumps(new_vocab, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    existing = log_path.read_text(encoding="utf-8") if log_path.exists() else ""
    log_path.write_text(existing + "\n".join(log) + "\n", encoding="utf-8")

    print(f"Eng edits: {len(eng_applied)}; splits: {len(new_entries_by_source)}; "
          f"everyday: {len(everyday_applied)}; occasional: {len(occ_applied)}; rare: {len(rare_applied)}")
    if missing:
        print(f"Skipped edits (not found): {missing}")
    if split_missing:
        print(f"Skipped splits (not found): {split_missing}")
    print(f"vocab.json: {len(vocab)} -> {len(new_vocab)}  (backup: {backup.name})")


if __name__ == "__main__":
    main()
