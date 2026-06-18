"""Apply free-form `decisions` file batch 15 — eng edits, 2 collapses, 4 splits, deletes, freq lists, 1 update+park."""

import json
import shutil
from pathlib import Path

HERE = Path(__file__).parent

ENG_EDITS = {
    "yt-c16-068": "to support (physically), to keep from falling, to steady sth (e.g help someone walk, or keep sth steady)",
    "yt-c17-007": "to guard, to escort, to protect someone",
    "yt-c17-018": "side benefit, unintended but beneficial result",
    "yt-c17-023": "to punch a time card (in order to clock in) - to tap a card",
    "yt-c17-074": "to facilitate, to support, to be conducive to (formal)",
    "yt-c17-093": "to crouch, to prostrate",
    "yt-c17-095": "to vibrate, to tremble, to shake",
    "yt-c18-009": "to focus intensely, to concentrate, to pay close attention",
    "yt-c18-033": "to clean up, to clear up, to sort out, to tidy up (e.g tasks, mess, problems, etc)",
    "yt-c18-056": "to nod off, to doze off, to fall asleep briefly",
    "yt-c18-073": "to lay across, to drape, to sling over",
    "yt-c21-047": "to groan, to moan (e.g heavy work, sex)",
    "yt-c21-059": "to pay a visit, to visit (formal)",
    "yt-c21-054": "to drive, to propel, to move forward",
    "yt-c20-096": "to retaliate, to get even (light revenge, e.g when someone teases you)",
    "t4k-c06-075": "college, specialized educational institution (often smaller than university)",
    "t4k-c07-038": "to attack forward, to advance (e.g army, chess piece)",
    "t4k-c09-053": "district chief, district officer",
    "t4k-c11-128": "very small, tiny, miniature",
    "t4k-c11-131": "to stroke, to rub gently (gently glide the hand over a surface, e.g cat, skin)",
    "yt-c19-000": "to overlap, to span across",
    "yt-c19-028": "chubby, plump",
    "yt-c19-035": "to lure, to entice, to bait - to trick, to deceive by luring",
    "yt-c19-046": "to miss an appointment, to not show up as scheduled; to default, to fail to meet a contractual obligation (e.g loan)",
    "yt-c20-039": "to suddenly and completely cut sth out (e.g lose weight, quit smoking)",   # typo: weigh->weight
    "yt-c20-071": "to snatch, to grab, to steal (quick, sudden action)",
    "yt-c21-042": "to give one's approval, to give consent",
    "yt-c22-002": "lenient, accommodating, to compromise",                                    # typo: accomodating->accommodating
    "yt-c22-005": "to estimate, to predict, to infer",                                        # reworded
    "yt-c22-016": "inaccurate, off, incorrect, to be slightly off",
    "yt-c22-022": "to give background information, to recap previous events, to retell the context",
    "yt-c22-037": "to suppress, to suspend, to put a stop to",
    "yt-c22-039": "to announce, to declare, to make a statement",
    "yt-c22-051": "stuffy, poorly ventilated, cramped (enclosed space with no flow, no way out)",
    "yt-c22-072": "delinquent child, misbehaving and troublesome kid",
    "yt-c22-073": "to tread, to stomp on, to trample",
    "yt-c22-084": "to sustain, to maintain, to support sth so it does not worsen or collapse",
    "wlt-c01-011": "fake, counterfeit",
    "wlt-c01-019": "to excuse oneself, to make excuses",
    "wlt-c01-035": "to misunderstand",
    "wlt-c01-046": "worker, laborer (manual or industrial work)",
    "wlt-c04-008": "to go back, to come back",
    "wlt-c04-035": "to stand up, to get up",
    "wlt-c04-088": "coat, sweater, warm jacket",
    "wlt-c05-040": "small box, small case",
    "wlt-c05-073": "brooch",
    "wlt-c06-023": "beautiful, good-looking, pretty",
    "wlt-c06-026": "to write down, to record, to take note",
    "wlt-c06-045": "fisherman (people who fish for a living)",
    "wlt-c06-092": "to touch (lightly)",
    "wlt-c06-093": "dressing table (table with a mirror used for makeup and grooming)",
    "wlt-c06-096": "to move backward, to retreat, to step back",
    "yt-c23-032": "to flip to the other side, to turn inside out",                            # reworded
    "wlt-c07-004": "airman, air force personnel",                                             # typo: personel->personnel
    "wlt-c07-035": "to compare with, to match against",
    "wlt-c07-070": "to estimate, to assess, to evaluate",
    "wlt-c07-072": "to face, to encounter",
    "wlt-c07-085": "to see someone off, to deliver someone or something",
    "wlt-c08-014": "to lean against",
    "wlt-c08-027": "file (physical or on a computer)",
    "wlt-c08-086": "kindergarten, preschool",
    "wlt-c08-093": "to become lower, to diminish",
    "wlt-c09-011": "circuit (e.g electrical)",
    "wlt-c09-028": "to converse, to have a conversation",
    "wlt-c09-049": "faded (color), dye bleeding (when washed)",                               # reworded
    "wlt-c09-053": "maximum, highest",
    "wlt-c09-073": "to divide",
    "wlt-c08-062": "wrinkled, crumpled",
    "wlt-c08-079": "to dismantle, to tear down",
    "wlt-c08-099": "order, sequence, to arrange in order",
    "wlt-c09-012": "objective, purpose, goal",
    "wlt-c09-015": "to analyze",
    "wlt-c09-089": "to refer to, to cite, to quote",
    "wlt-c10-048": "to limit, to restrict",
    "wlt-c10-082": "to fill, to refill, to add",
    "wlt-c10-084": "to withdraw, to pull out",
    "wlt-c11-028": "to record, to note",
    "wlt-c11-031": "to wound, to cut",
    "wlt-c15-021": "box, case",
    "wlt-c15-071": "cabinet, cupboard",
    "wlt-c15-073": "bucket",
    "wlt-c16-023": "cinema",
    "wlt-c16-029": "field (e.g sports field, airport, etc)",
    "wlt-c18-023": "to drown, to sink",
    "wlt-c18-025": "tickly, to tickle",
    "wlt-c18-036": "car mechanic (technician who repairs cars)",
    "wlt-c18-043": "to drive very fast, to race",
    "wlt-c18-089": "toxic, poisonous",
    "wlt-c17-046": "to treat, to cure, to take care of",
    "wlt-c19-030": "code (e.g postal, security)",
    "t4k-c01-014": "to care for, to look after",
    "wlt-c09-087": "to record (audio, video); to press, to compress, to pack",
    "wlt-c09-099": "to support financially, to patronize a business",
    "wlt-c10-050": "to prosper, to develop, to flourish",
    "wlt-c11-019": "to bring; to lead, to guide",
    "wlt-c11-033": "man, male",
    "wlt-c11-038": "to hold a meeting",
    "wlt-c11-050": "to go to meet, to visit someone",
    "wlt-c11-053": "bedsheet",
    "wlt-c11-062": "fan (device)",
    "wlt-c11-075": "angle, corner",
    "wlt-c11-089": "to maintain, to confirm",
    "wlt-c11-091": "excellent, great; to visit someone",
    "wlt-c11-093": "to disturb, to bother",
    "wlt-c11-097": "level",
    "wlt-c12-013": "difficult, hard",
    "wlt-c12-033": "perfect, whole, complete",
    "wlt-c12-042": "to end, to come to an end",
    "wlt-c12-046": "gold (color)",
    "wlt-c12-049": "shirt (worn in formal settings)",
    "wlt-c12-086": "warm",
}

# collapse multi-form -> single form (thai + english)
COLLAPSE = {
    "yt-c17-001": ("ทิ่ม", "to poke, to jab, to stab lightly with something pointed"),
    "wlt-c06-064": ("บำรุง", "to nourish, to maintain, to improve condition (e.g health, skin, machine)"),
}

# splits: source id -> [(new_id, thai, english), ...]
SPLITS = {
    "yt-c16-054": [
        ("yt-c16-054", "เร่ร่อน", "to wander from place to place without a fixed residence"),
        ("yt-c16-054b", "คนเร่ร่อน", "vagrant, homeless person"),
    ],
    "wlt-c07-001": [
        ("wlt-c07-001", "ทนทาน", "durable, resistant"),
        ("wlt-c07-001b", "ถาวร", "permanent, long-lasting"),
    ],
    "yt-c20-051": [
        ("yt-c20-051", "ชัก", "to pull, to draw"),
        ("yt-c20-051b", "ชักจะ", "to begin, to start"),
    ],
    "yt-c17-069": [
        ("yt-c17-069", "เพี้ยน", "distorted, off, weird, slightly wrong"),
        ("yt-c17-069b", "ร้องเพลงเพี้ยน", "to sing off-key"),
    ],
}

# update english, then park (move to parked.json, remove from vocab)
PARK = {
    "yt-c21-023": "to put on a false appearance, to try to impress others",
}

DELETES = {
    "t4k-c06-054", "t4k-c06-057", "t4k-c06-064", "t4k-c07-093", "t4k-c08-078",
    "t4k-c08-088", "t4k-c09-022", "t4k-c09-026", "t4k-c09-030", "t4k-c11-046",
    "t4k-c11-095", "wlt-c01-034", "wlt-c04-012", "yt-c23-028", "wlt-c07-060",
    "wlt-c08-016", "wlt-c18-026", "wlt-c18-064", "wlt-c18-065", "wlt-c19-018",
    "wlt-c11-074", "wlt-c12-007",
}

OCC_BULK = {"yt-c17-038", "yt-c17-074", "wlt-c06-093"}
EVERYDAY_BULK = {"wlt-c11-019", "wlt-c11-050"}


def main():
    vocab_path = HERE / "vocab.json"
    parked_path = HERE / "parked.json"
    log_path = HERE / "apply_log.txt"

    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in vocab}

    log = ["", "=" * 70,
           "Free-form decisions file batch 15 — eng edits, 2 collapses, 4 splits, deletes, freq, 1 update+park", ""]

    eng_applied, missing = [], []
    for eid, eng in ENG_EDITS.items():
        if eid in by_id:
            by_id[eid]["english"] = eng
            eng_applied.append(eid)
            log.append(f"    edit {eid}.english = {eng!r}")
        else:
            missing.append(eid)

    for eid, (thai, eng) in COLLAPSE.items():
        if eid in by_id:
            by_id[eid]["thai"], by_id[eid]["english"] = thai, eng
            log.append(f"    collapse {eid} -> {thai} = {eng!r}")
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
        done = [eid for eid in ids if eid in by_id]
        for eid in done:
            by_id[eid]["frequency"] = value
        log.append(f"    frequency {value} ({len(done)}): {', '.join(sorted(done))}")
        return done

    occ_applied = set_freq(OCC_BULK, "occasional")
    everyday_applied = set_freq(EVERYDAY_BULK, "everyday")

    # update english then park
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

    new_vocab = []
    for e in vocab:
        if e["id"] in remove_ids:
            continue
        if e["id"] in new_entries_by_source:
            new_vocab.extend(new_entries_by_source[e["id"]])
        else:
            new_vocab.append(e)

    log.append(f"Eng edits: {len(eng_applied)}  Collapses: {len(COLLAPSE)}  Splits: {len(new_entries_by_source)}  "
               f"Deletes: {len(deleted)}  Parked: {len(parked_ids)}  occasional: {len(occ_applied)}  everyday: {len(everyday_applied)}")
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

    print(f"Eng edits: {len(eng_applied)}; collapses: {len(COLLAPSE)}; splits: {len(new_entries_by_source)}; "
          f"deletes: {len(deleted)}; parked: {len(parked_ids)}; occasional: {len(occ_applied)}; everyday: {len(everyday_applied)}")
    if missing:
        print(f"Skipped edits (not found): {missing}")
    if split_missing:
        print(f"Skipped splits (not found): {split_missing}")
    if missing_deletes:
        print(f"Skipped deletes (not found): {missing_deletes}")
    print(f"vocab.json: {len(vocab)} -> {len(new_vocab)}  (backup: {backup.name})")


if __name__ == "__main__":
    main()
