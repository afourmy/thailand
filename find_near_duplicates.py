"""Find near-duplicate Thai vocabulary entries that exact-equality checks would miss.

Strategies are split into HIGH-CONFIDENCE (likely real duplicates) and SOFT signals
(useful for review but noisy). The noisy Thai-orthographic checks (tone-strip,
substring containment, Levenshtein) are gated by English-meaning overlap, since Thai
has many homographs and shared morphemes that aren't true synonyms.

HIGH-CONFIDENCE:
  [1] NORMALIZED_THAI        — Thai identical after stripping whitespace/punct/paren content.
  [2] PAREN_KEPT_THAI        — Thai identical after dropping just the paren brackets
                                 (catches "(บาด)แผล" vs "บาดแผล").
  [3] TONE_STRIP + ENG_MATCH — tone-marks-stripped Thai matches AND English meanings overlap.
  [4] SUBSTR + ENG_OVERLAP   — one Thai contained in another AND English meanings overlap.
  [5] LEV<=2 + ENG_OVERLAP   — small edit distance AND English meanings overlap.

SOFT (manual review needed):
  [6] SAME_ENGLISH           — same raw English, different Thai.
  [7] SAME_ENGLISH_NORM      — same normalized English, raw English differs.
"""

import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

VOCAB_PATH = Path(__file__).parent / "vocab.json"


# ---- Thai normalization ------------------------------------------------------

THAI_TONE_MARKS = {
    "่",  # mai ek
    "้",  # mai tho
    "๊",  # mai tri
    "๋",  # mai chattawa
    "์",  # thanthakhat (cancellation mark)
    "ํ",  # nikhahit
    "๎",  # yamakkan
}

_WS_PUNCT = re.compile(r"[\s​⁠\.\,\(\)\[\]\{\}\?\!\-–—/'\"]+")
_PAREN_BLOCK = re.compile(r"\s*\([^)]*\)\s*")
_PAREN_BRACKETS_ONLY = re.compile(r"[\(\)]")


def normalize_thai(text: str) -> str:
    """Strip whitespace, zero-width chars, punctuation, AND parenthetical asides."""
    text = _PAREN_BLOCK.sub("", text)
    text = _WS_PUNCT.sub("", text)
    return unicodedata.normalize("NFC", text)


def normalize_thai_keep_parens(text: str) -> str:
    """Strip whitespace and paren BRACKETS but keep the content inside them.
    So '(บาด)แผล' -> 'บาดแผล'."""
    text = _PAREN_BRACKETS_ONLY.sub("", text)
    text = _WS_PUNCT.sub("", text)
    return unicodedata.normalize("NFC", text)


def strip_tone_marks(text: str) -> str:
    normalized = normalize_thai(text)
    return "".join(ch for ch in normalized if ch not in THAI_TONE_MARKS)


# ---- English normalization ---------------------------------------------------

_ARTICLES = {"a", "an", "the"}
_ENG_STOPWORDS = _ARTICLES | {
    "to", "be", "of", "in", "on", "at", "with", "for", "and", "or", "is",
    "are", "as", "by", "from", "that", "this", "it", "its", "into", "out",
    "up", "down", "e", "g", "eg", "etc", "ie", "i.e",
}


def normalize_english(text: str) -> str:
    """Lowercase, drop 'to ' verb prefix, drop articles, sort comma-split synonyms."""
    text = text.lower().strip()
    text = _PAREN_BLOCK.sub("", text)
    parts = [p.strip() for p in text.split(",") if p.strip()]
    cleaned = []
    for part in parts:
        if part.startswith("to "):
            part = part[3:]
        tokens = [t for t in re.split(r"\s+", part) if t and t not in _ARTICLES]
        if tokens:
            cleaned.append(" ".join(tokens))
    return " | ".join(sorted(set(cleaned)))


def english_tokens(text: str) -> set:
    """Set of meaningful English content tokens."""
    text = text.lower()
    text = _PAREN_BLOCK.sub(" ", text)
    text = re.sub(r"[^a-z\s]", " ", text)
    return {tok for tok in text.split() if tok and tok not in _ENG_STOPWORDS}


def english_synonyms(text: str) -> set:
    """Comma-separated synonyms, normalized individually."""
    text = text.lower().strip()
    text = _PAREN_BLOCK.sub("", text)
    out = set()
    for part in text.split(","):
        part = part.strip()
        if part.startswith("to "):
            part = part[3:]
        toks = [t for t in re.split(r"\s+", part) if t and t not in _ARTICLES]
        if toks:
            out.add(" ".join(toks))
    return out


def english_similar(a: str, b: str) -> bool:
    """True if English meanings overlap meaningfully — generous gate, for tone-strip checks.

    Match if any normalized synonym is shared OR 2+ content tokens overlap.
    """
    if english_synonyms(a) & english_synonyms(b):
        return True
    toks_a = english_tokens(a)
    toks_b = english_tokens(b)
    if not toks_a or not toks_b:
        return False
    overlap = toks_a & toks_b
    if len(overlap) >= 2:
        return True
    smaller = min(len(toks_a), len(toks_b))
    if overlap and len(overlap) / smaller >= 0.5:
        return True
    return False


def english_strict_match(a: str, b: str) -> bool:
    """Stricter gate: require a full normalized synonym to be shared.

    Avoids token-only matches like 'paper' ⊂ 'toilet paper' that don't indicate
    a synonym relationship. Use for noisier strategies (substring, Levenshtein).
    """
    return bool(english_synonyms(a) & english_synonyms(b))


# ---- Levenshtein with early cap ---------------------------------------------

def levenshtein(a: str, b: str, cap: int = 3) -> int:
    if a == b:
        return 0
    if abs(len(a) - len(b)) > cap:
        return cap + 1
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i] + [0] * len(b)
        best = curr[0]
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
            if curr[j] < best:
                best = curr[j]
        if best > cap:
            return cap + 1
        prev = curr
    return prev[-1]


# ---- Strategy implementations ------------------------------------------------

def group_by_key(entries, key_fn):
    buckets = defaultdict(list)
    for entry in entries:
        k = key_fn(entry)
        if k:
            buckets[k].append(entry)
    return {k: v for k, v in buckets.items() if len(v) > 1}


def find_normalized_thai_dups(entries):
    return group_by_key(entries, lambda e: normalize_thai(e["thai"]))


def find_paren_kept_dups(entries):
    """Buckets where Thai matches with paren brackets stripped but content kept,
    AND where that match is NOT already captured by normalize_thai (otherwise
    NORMALIZED_THAI is already showing it)."""
    norm_paren = group_by_key(entries, lambda e: normalize_thai_keep_parens(e["thai"]))
    out = {}
    for key, items in norm_paren.items():
        # require that at least two of them differ under the *fully* paren-stripping
        # normalization — otherwise this is just NORMALIZED_THAI
        full_norms = {normalize_thai(it["thai"]) for it in items}
        if len(full_norms) > 1:
            out[key] = items
    return out


def find_tone_strip_eng_dups(entries):
    """Tone-stripped Thai matches AND at least one pair in the group has overlapping English."""
    buckets = group_by_key(entries, lambda e: strip_tone_marks(e["thai"]))
    out = {}
    for key, items in buckets.items():
        # ignore if all are exact same Thai
        if len({normalize_thai(it["thai"]) for it in items}) < 2:
            continue
        # require at least one pair with similar English
        matched = []
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                if english_similar(items[i]["english"], items[j]["english"]):
                    matched.append((items[i], items[j]))
        if matched:
            out[key] = matched
    return out


def find_thai_substring_eng_pairs(entries, max_len_delta=4, min_short_len=3):
    """One Thai is contained in another (length delta small) AND English meanings overlap."""
    by_norm = defaultdict(list)
    for entry in entries:
        by_norm[normalize_thai(entry["thai"])].append(entry)

    norms = sorted(by_norm.keys(), key=len)
    by_len = defaultdict(list)
    for norm in norms:
        by_len[len(norm)].append(norm)

    pairs = []
    seen = set()
    for short_norm in norms:
        if len(short_norm) < min_short_len:
            continue
        for long_len in range(len(short_norm) + 1, len(short_norm) + max_len_delta + 1):
            for long_norm in by_len.get(long_len, ()):
                if short_norm not in long_norm:
                    continue
                key = (short_norm, long_norm)
                if key in seen:
                    continue
                seen.add(key)
                for s in by_norm[short_norm]:
                    for l in by_norm[long_norm]:
                        if s["id"] == l["id"]:
                            continue
                        if english_strict_match(s["english"], l["english"]):
                            pairs.append((s, l))
    return pairs


def find_levenshtein_eng_pairs(entries, min_len_for_d1=3, min_len_for_d2=6):
    """Edit-distance candidates AND English overlap."""
    by_norm = defaultdict(list)
    for entry in entries:
        norm = normalize_thai(entry["thai"])
        if norm:
            by_norm[norm].append(entry)

    deletion_index = defaultdict(set)
    for norm in by_norm:
        if len(norm) < min_len_for_d1:
            continue
        deletion_index[norm].add(norm)
        for i in range(len(norm)):
            deletion_index[norm[:i] + norm[i + 1 :]].add(norm)
        if len(norm) >= min_len_for_d2:
            for i in range(len(norm)):
                for j in range(i + 1, len(norm)):
                    deletion_index[norm[:i] + norm[i + 1 : j] + norm[j + 1 :]].add(norm)

    candidate = set()
    for _, words in deletion_index.items():
        if len(words) < 2:
            continue
        words_list = sorted(words)
        for i in range(len(words_list)):
            for j in range(i + 1, len(words_list)):
                candidate.add((words_list[i], words_list[j]))

    out = []
    for a, b in candidate:
        d = levenshtein(a, b, cap=2)
        max_d = 1 if min(len(a), len(b)) < min_len_for_d2 else 2
        if d == 0 or d > max_d:
            continue
        for ea in by_norm[a]:
            for eb in by_norm[b]:
                if ea["id"] == eb["id"]:
                    continue
                if english_strict_match(ea["english"], eb["english"]):
                    out.append((ea, eb, d))
    return out


THAI_PREFIXES = ["อย่าง", "การ", "ความ"]


def find_thai_prefix_pairs(entries, prefixes=None):
    """Root/prefixed-form pairs where one Thai is a known morphological prefix + the other.

    E.g. โดดเด่น / อย่างโดดเด่น, ดี / ความดี, กิน / การกิน.
    No English gate — the prefix list is specific enough and these pairs always
    warrant human review regardless of English overlap.
    """
    if prefixes is None:
        prefixes = THAI_PREFIXES
    by_norm = defaultdict(list)
    for entry in entries:
        norm = normalize_thai(entry["thai"])
        if norm:
            by_norm[norm].append(entry)

    pairs = []
    seen = set()
    for norm, long_entries in list(by_norm.items()):
        for prefix in prefixes:
            if not norm.startswith(prefix):
                continue
            root = norm[len(prefix):]
            if len(root) < 2:
                continue
            short_entries = by_norm.get(root)
            if not short_entries:
                continue
            for long_entry in long_entries:
                for short_entry in short_entries:
                    if long_entry["id"] == short_entry["id"]:
                        continue
                    key = tuple(sorted([long_entry["id"], short_entry["id"]]))
                    if key in seen:
                        continue
                    seen.add(key)
                    pairs.append((short_entry, long_entry, prefix))
    return pairs


def find_same_english_dups(entries):
    buckets = group_by_key(entries, lambda e: e["english"].strip())
    # Strip out groups whose Thai are all identical (caught by NORMALIZED_THAI)
    return {
        k: v
        for k, v in buckets.items()
        if len({normalize_thai(it["thai"]) for it in v}) > 1
    }


def find_same_english_norm_dups(entries):
    buckets = group_by_key(entries, lambda e: normalize_english(e["english"]))
    out = {}
    for k, items in buckets.items():
        if len({it["english"].strip() for it in items}) < 2:
            continue
        if len({normalize_thai(it["thai"]) for it in items}) < 2:
            continue
        out[k] = items
    return out


# ---- Reporting ---------------------------------------------------------------

def fmt_entry(entry):
    return f"{entry['thai']:<22} {entry['english']:<55} [{entry['id']}]"


def section(title):
    return f"\n{'=' * 90}\n{title}\n{'=' * 90}"


def render_summary(entries):
    n1 = len(find_normalized_thai_dups(entries))
    n2 = len(find_paren_kept_dups(entries))
    n3 = len(find_tone_strip_eng_dups(entries))
    n4 = len(find_thai_substring_eng_pairs(entries))
    n5 = len(find_levenshtein_eng_pairs(entries))
    n6 = len(find_same_english_dups(entries))
    n7 = len(find_same_english_norm_dups(entries))
    n8 = len(find_thai_prefix_pairs(entries))
    return (
        f"Total entries: {len(entries)}\n"
        f"HIGH-CONFIDENCE:\n"
        f"  [1] NORMALIZED_THAI groups:       {n1}\n"
        f"  [2] PAREN_KEPT_THAI groups:       {n2}\n"
        f"  [3] TONE_STRIP + ENG_MATCH:       {n3}\n"
        f"  [4] SUBSTR + ENG_OVERLAP pairs:   {n4}\n"
        f"  [5] LEV<=2 + ENG_OVERLAP pairs:   {n5}\n"
        f"  [8] THAI_PREFIX pairs:            {n8}\n"
        f"SOFT (manual review):\n"
        f"  [6] SAME_ENGLISH groups:          {n6}\n"
        f"  [7] SAME_ENGLISH_NORM groups:     {n7}\n"
    )


def render_report(entries):
    out = []

    out.append(section("[1] NORMALIZED_THAI — same Thai after stripping whitespace/punct/parens"))
    groups = find_normalized_thai_dups(entries)
    out.append(f"Found {len(groups)} groups.")
    for key, items in sorted(groups.items()):
        out.append(f"\n  '{key}':")
        for it in items:
            out.append(f"    {fmt_entry(it)}")

    out.append(section("[2] PAREN_KEPT_THAI — '(บาด)แผล' vs 'บาดแผล' style"))
    groups = find_paren_kept_dups(entries)
    out.append(f"Found {len(groups)} groups.")
    for key, items in sorted(groups.items()):
        out.append(f"\n  key '{key}':")
        for it in items:
            out.append(f"    {fmt_entry(it)}")

    out.append(section("[3] TONE_STRIP + ENG_MATCH — spelling/tone variants with same meaning"))
    groups = find_tone_strip_eng_dups(entries)
    out.append(f"Found {len(groups)} groups.")
    for key, pairs in sorted(groups.items()):
        out.append(f"\n  base '{key}':")
        seen_ids = set()
        for a, b in pairs:
            for it in (a, b):
                if it["id"] not in seen_ids:
                    out.append(f"    {fmt_entry(it)}")
                    seen_ids.add(it["id"])

    out.append(section("[4] SUBSTR + ENG_OVERLAP — one Thai contains another, meanings match"))
    pairs = find_thai_substring_eng_pairs(entries)
    out.append(f"Found {len(pairs)} pairs.")
    for short, long_ in sorted(pairs, key=lambda p: (p[0]["thai"], p[1]["thai"])):
        out.append(f"\n  '{short['thai']}' ⊂ '{long_['thai']}':")
        out.append(f"    {fmt_entry(short)}")
        out.append(f"    {fmt_entry(long_)}")

    out.append(section("[5] LEV<=2 + ENG_OVERLAP — small edit distance, meanings match"))
    pairs = find_levenshtein_eng_pairs(entries)
    out.append(f"Found {len(pairs)} pairs.")
    for a, b, d in sorted(pairs, key=lambda p: (p[2], p[0]["thai"], p[1]["thai"])):
        out.append(f"\n  d={d} '{a['thai']}' ~ '{b['thai']}':")
        out.append(f"    {fmt_entry(a)}")
        out.append(f"    {fmt_entry(b)}")

    out.append(section("[8] THAI_PREFIX — root / prefix+root pairs (อย่าง, การ, ความ)"))
    pairs = find_thai_prefix_pairs(entries)
    out.append(f"Found {len(pairs)} pairs.")
    for short, long_, prefix in sorted(pairs, key=lambda p: (p[2], p[0]["thai"])):
        out.append(f"\n  [{prefix}] '{short['thai']}' / '{long_['thai']}':")
        out.append(f"    {fmt_entry(short)}")
        out.append(f"    {fmt_entry(long_)}")

    out.append(section("[6] SAME_ENGLISH — identical raw English, different Thai (review)"))
    groups = find_same_english_dups(entries)
    out.append(f"Found {len(groups)} groups.")
    for key, items in sorted(groups.items()):
        out.append(f"\n  english '{key}':")
        for it in items:
            out.append(f"    {fmt_entry(it)}")

    out.append(section("[7] SAME_ENGLISH_NORM — English matches after normalization (review)"))
    groups = find_same_english_norm_dups(entries)
    out.append(f"Found {len(groups)} groups.")
    for key, items in sorted(groups.items()):
        out.append(f"\n  normalized '{key}':")
        for it in items:
            out.append(f"    {fmt_entry(it)}")

    return "\n".join(out)


# ---- Decisions file generation ----------------------------------------------

SECTION_ORDER = [
    "NORMALIZED_THAI",
    "PAREN_KEPT_THAI",
    "TONE_STRIP_ENG",
    "SUBSTR_ENG",
    "LEV_ENG",
    "THAI_PREFIX",
    "SAME_ENGLISH",
    "SAME_ENGLISH_NORM",
]
SECTION_PRIORITY = {name: i for i, name in enumerate(SECTION_ORDER)}


def collect_decision_rows(entries):
    """Collect every flagged group/pair into unique rows keyed by sorted ID-set.

    Same set of IDs surfaced by multiple categories collapses into one row whose
    `categories` field lists each trigger. Different ID-sets stay as separate rows
    (a 3-way group and a 2-way pair within it are genuinely different relationships).
    """
    by_idset = {}

    def add(items, category, key_str):
        ids = tuple(sorted(it["id"] for it in items))
        if ids not in by_idset:
            by_idset[ids] = {
                "ids": ids,
                "categories": [],
                "entries": {it["id"]: it for it in items},
                "priority": SECTION_PRIORITY[category],
            }
        by_idset[ids]["categories"].append({"name": category, "key": key_str})
        # update entries map (in case different sections surfaced different entry objects)
        for it in items:
            by_idset[ids]["entries"].setdefault(it["id"], it)
        if SECTION_PRIORITY[category] < by_idset[ids]["priority"]:
            by_idset[ids]["priority"] = SECTION_PRIORITY[category]

    for key, items in find_normalized_thai_dups(entries).items():
        add(items, "NORMALIZED_THAI", key)

    for key, items in find_paren_kept_dups(entries).items():
        add(items, "PAREN_KEPT_THAI", key)

    # Section 3: tone-strip + eng-match — emit each english-similar pair as a 2-id row.
    for key, pair_list in find_tone_strip_eng_dups(entries).items():
        for a, b in pair_list:
            add([a, b], "TONE_STRIP_ENG", key)

    for s, l in find_thai_substring_eng_pairs(entries):
        add([s, l], "SUBSTR_ENG", f"{s['thai']} ⊂ {l['thai']}")

    for a, b, d in find_levenshtein_eng_pairs(entries):
        add([a, b], "LEV_ENG", f"d={d}: {a['thai']} ~ {b['thai']}")

    for short, long_, prefix in find_thai_prefix_pairs(entries):
        add([short, long_], "THAI_PREFIX", f"{prefix}+: {short['thai']} / {long_['thai']}")

    for key, items in find_same_english_dups(entries).items():
        add(items, "SAME_ENGLISH", key)

    for key, items in find_same_english_norm_dups(entries).items():
        add(items, "SAME_ENGLISH_NORM", key)

    # Sort by priority (highest-confidence first), then by first ID for stability.
    rows = sorted(by_idset.values(), key=lambda r: (r["priority"], r["ids"]))
    return rows


def build_decisions_doc(entries):
    rows_data = collect_decision_rows(entries)
    rows_out = []
    for i, row in enumerate(rows_data, start=1):
        entry_objs = [row["entries"][eid] for eid in row["ids"]]
        rows_out.append({
            "row_id": f"row-{i:05d}",
            "categories": row["categories"],
            "entries": [
                {
                    "id": e["id"],
                    "thai": e["thai"],
                    "english": e["english"],
                    "topic": e.get("topic", ""),
                    "frequency": e.get("frequency", ""),
                    "sources": e.get("sources", []),
                }
                for e in entry_objs
            ],
            "instruction": "",
        })
    return {
        "version": "2",
        "generated_from": "vocab.json",
        "schema": {
            "instruction": "Free-text English describing what you want done with these "
                            "entries. Examples: 'keep the first one and delete the rest', "
                            "'merge sources into yt-c09-019 and add (banana) to its english', "
                            "'they're actually different — change the second english to ...'. "
                            "Leave blank to skip the row. Hand the file back to Claude to "
                            "process the instructions.",
            "categories": "Which detector(s) flagged this row, for context. Read-only.",
            "entries": "Full entry data for context. Read-only.",
        },
        "total_rows": len(rows_out),
        "rows": rows_out,
    }


def write_decisions_file(path: Path, entries, overwrite: bool):
    if path.exists() and not overwrite:
        sys.exit(f"Refusing to overwrite {path} — pass --overwrite to replace it.")
    doc = build_decisions_doc(entries)
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {doc['total_rows']} decision rows to {path}")


# ---- CLI --------------------------------------------------------------------

def main():
    entries = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    args = sys.argv[1:]

    # --decisions <path>      generate decisions file
    # --overwrite             allow overwriting an existing decisions file
    # --summary               counts only
    # (default)               full text report
    if "--decisions" in args:
        idx = args.index("--decisions")
        if idx + 1 >= len(args):
            sys.exit("--decisions requires a filepath argument")
        target = Path(args[idx + 1])
        overwrite = "--overwrite" in args
        write_decisions_file(target, entries, overwrite=overwrite)
        return

    print(render_summary(entries))
    if "--summary" in args:
        return
    print(render_report(entries))


if __name__ == "__main__":
    main()
