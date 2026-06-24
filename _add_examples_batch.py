#!/usr/bin/env python3
"""One-off: add example sentences to a batch of everyday words in vocab.json."""
import json, shutil, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
VOCAB = HERE / "vocab.json"

BATCH = {
    "wlt-c04-077": [
        {"meaning": "to brush teeth", "sentences": [
            {"thai": "แปรงฟันวันละสองครั้ง", "en": "Brush your teeth twice a day."},
            {"thai": "เด็กๆต้องสีฟันให้สะอาด", "en": "Kids have to brush their teeth well."},
        ]},
    ],
    "wlt-c04-091": [
        {"meaning": "one hundred (100)", "sentences": [
            {"thai": "อันนี้ราคาหนึ่งร้อยบาท", "en": "This one costs one hundred baht."},
            {"thai": "มีคนมางานเกือบหนึ่งร้อยคน", "en": "Almost a hundred people came to the event."},
        ]},
    ],
    "wlt-c04-092": [
        {"meaning": "pot (cooking)", "sentences": [
            {"thai": "ต้มน้ำในหม้อใบใหญ่", "en": "Boil the water in the big pot."},
            {"thai": "หม้อข้าวไฟฟ้าเสียแล้ว", "en": "The rice cooker is broken."},
        ]},
    ],
    "wlt-c04-093": [
        {"meaning": "doctor", "sentences": [
            {"thai": "ไม่สบายก็ไปหาหมอเถอะ", "en": "If you're not feeling well, go see a doctor."},
            {"thai": "หมอบอกให้พักผ่อนเยอะๆ", "en": "The doctor told me to get lots of rest."},
        ]},
    ],
    "wlt-c05-010": [
        {"meaning": "to want to get (sth)", "sentences": [
            {"thai": "ฉันอยากได้โทรศัพท์เครื่องใหม่", "en": "I want a new phone."},
            {"thai": "วันเกิดนี้อยากได้อะไร", "en": "What do you want for your birthday?"},
        ]},
    ],
    "wlt-c05-012": [
        {"meaning": "'don't do that yet!', 'hold on!'", "sentences": [
            {"thai": "อย่าเพิ่งไป รอฉันด้วย", "en": "Don't go yet, wait for me."},
            {"thai": "อย่าเพิ่งบอกใครนะ", "en": "Don't tell anyone just yet."},
        ]},
    ],
    "wlt-c05-013": [
        {"meaning": "where is it?", "sentences": [
            {"thai": "ห้องน้ำอยู่ที่ไหน", "en": "Where is the bathroom?"},
            {"thai": "ตอนนี้เธออยู่ที่ไหน", "en": "Where are you right now?"},
        ]},
    ],
    "wlt-c05-015": [
        {"meaning": "to leave from", "sentences": [
            {"thai": "ฉันออกจากบ้านตอนเจ็ดโมง", "en": "I leave home at seven."},
            {"thai": "รถไฟออกจากสถานีแล้ว", "en": "The train has left the station."},
        ]},
    ],
    "wlt-c05-016": [
        {"meaning": "anything", "sentences": [
            {"thai": "กินอะไรก็ได้ ฉันไม่เรื่องมาก", "en": "Anything's fine to eat, I'm not picky."},
            {"thai": "เลือกอะไรก็ได้ที่ชอบ", "en": "Pick anything you like."},
        ]},
    ],
    "wlt-c05-020": [
        {"meaning": "this week", "sentences": [
            {"thai": "อาทิตย์นี้ฉันงานยุ่งมาก", "en": "I'm really busy with work this week."},
            {"thai": "อาทิตย์นี้มีวันหยุดด้วย", "en": "There's a holiday this week too."},
        ]},
    ],
}


def main():
    words = json.loads(VOCAB.read_text(encoding="utf-8"))
    by_id = {w["id"]: w for w in words}
    missing = [i for i in BATCH if i not in by_id]
    if missing:
        sys.exit("Missing ids: %s" % missing)
    already = [i for i in BATCH if by_id[i].get("examples")]
    if already:
        sys.exit("Already have examples: %s" % already)
    shutil.copy2(VOCAB, VOCAB.with_suffix(".json.bak"))
    for cid, ex in BATCH.items():
        by_id[cid]["examples"] = ex
    VOCAB.write_text(json.dumps(words, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Added examples to %d words." % len(BATCH))


if __name__ == "__main__":
    main()
