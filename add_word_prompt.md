# Adding a word

Everything needed to add a new word to the deck: create the card, choose its frequency, write example sentences, generate audio, and commit. The vocabulary lives in `vocab.json`, a flat JSON array of word objects. A finished card looks like:

```json
{
  "id": "new-216",
  "thai": "คำ",
  "english": "word; a mouthful (of food)",
  "frequency": "everyday",
  "examples": [ ... ],
  "audio": true,
  "audio_en": true
}
```

`id`, `thai`, `english`, and `frequency` are written by hand. `examples` is written by hand too (see below). The `audio` / `audio_en` flags are set by the audio generator, not by hand.

## 1. Create the card

- **id**: manually added words use the `new-N` scheme. Find the current highest `new-N` in `vocab.json` and use the next number (they run `new-1` upward). The id is arbitrary but must be unique.
- **thai**: the headword. Use normal Thai spacing (no spaces inside a word; a space only at a real phrase boundary, since a space becomes a spoken pause in the audio).
- **english**: the gloss(es). Separate distinct meanings with a semicolon: `"word; a mouthful (of food)"` is a two-meaning card. Comma-separated forms inside one segment are synonyms of the same meaning.
- Optional `thai_tts` / `english_tts`: the text the audio generator speaks instead of the display text, for fixing a bad clip. It holds either a phonetic respelling (homographs whose isolated reading is wrong, e.g. `"พลาว"` so เพลา "to lessen" is read *plao*, not *phee-laa*) or the same text with a zero-width space marking a word boundary Azure gets wrong. Every such fix goes here; the display fields are never altered for the audio's sake. See the audio-fixing sections of `CLAUDE.md` before using these.

## 2. Choose the `frequency`

`frequency` is one of `everyday`, `common`, `occasional`, `rare`. Pick it by how much the word is really **spoken** in Thai, never by whether Thais would recognize it (a native recognizes thousands of words they would never say). The categories exist to protect one use case: talking with Thai friends and watching Thai news, without saying something a real Thai person would find weird or bookish.

Spoken Thai is broader than casual chat: journalists, TV anchors, radio and podcast hosts, and their guests speak a somewhat formal Thai that still counts. A word is written-only if it lives mostly in books, documents, and other text. Crucially, the test is a person **talking** (anchor, host, interviewee, guest). Text that merely gets *read out* does not count: PA and recorded announcements, legal warnings, signage, forms, ceremony scripts. A word that survives only in those places is `rare`, no matter how often you hear it (มิฉะนั้น, เป็นอันขาด, บัดนี้ are `rare`; anchors talking say หากไม่, ไม่เช่นนั้น, ห้ามเด็ดขาด, ตอนนี้).

### The four categories

- **everyday**: used literally every day. One day of talking with a Thai friend and you will use or hear it. (กิน, ไป, อร่อย, แต่ว่า, เคย)
- **common**: normal casual conversation with friends, informal spoken Thai. Not necessarily daily, but raises no eyebrows in a chat. (แหงสิ, จุ้นจ้าน, ฉลุย)
- **occasional**: formal but still regularly spoken, the news-and-broadcast register. Heard on TV news, radio, podcasts, and in speeches. A friend might find it stiff in casual chat, but an anchor says it naturally. (เผยแพร่, คมนาคม, วิกฤตการณ์, ประชามติ)
- **rare**: not really spoken at all. Literary/novel vocabulary, official-document and legal language, announcement and signage formulas, scripture and monk-register religious words, royal vocabulary (ราชาศัพท์). Even broadcasters rarely say them; they are read from text. (ทว่า, ทันใด, มิฉะนั้น, พระราชกฤษฎีกา, ราชโองการ)

### Decide in this order

1. Would it inevitably come up in one ordinary day of chatting with a friend? Yes: `everyday`.
2. Would a Thai say it naturally in casual conversation, without sounding bookish or stiff? Yes: `common`.
3. Even if too formal for a chat, would an anchor, host, or guest actually *say* it while talking on TV news, radio, or a podcast, with some regularity? Yes: `occasional`. (Not enough: that it could appear in a news script, or gets read out over a loudspeaker.)
4. Otherwise: `rare`.

### Edge cases

- **Ubiquity beats register.** The category measures how often the word is really heard and used in spoken Thai as a whole, not how casual it sounds. A slightly formal word that is everywhere is still `everyday` (สามารถ, ต้องการ are everyday even though ได้, อยาก are the casual synonyms). Never demote just because a shorter synonym exists.
- **Demote from everyday only when the word itself is seldom said**: another word owns the daily slot (ทีวี displaces โทรทัศน์), or it is dated/dramatic (ลาก่อน), textbook-only (งานอดิเรก), or a written connector (จึง). "A bit formal" or "topical rather than daily" are not reasons (วัฒนธรรม, เป้าหมาย, ทันที, สำเร็จ stay everyday).
- **Formal is not the same as written.** Do not put a word in `rare` just because it is formal; if anchors and hosts really say it, it is `occasional`. `rare` is for essentially text-only words.
- **Religious and royal words are not automatically rare.** Words ordinary people say (ทำบุญ, ใส่บาตร, ไหว้พระ) get judged by the normal spoken tests. `rare` is for the scripture/ceremony/monk-register and royal-register vocabulary that laypeople recognize but do not say.
- **Slang and crude words** follow the same spoken tests; register (polite vs crude) does not matter, only how often the word is really spoken.
- **When torn between two adjacent categories**, ask: "if I used this with a Thai friend at dinner, would they find it weird?" and "would I plausibly hear it on the evening news this week?". If genuinely borderline, flag it instead of silently picking.

## 3. Write example sentences

A word in isolation doesn't teach much, since meaning lives in context. Each card gets a few example sentences showing how the word is actually used.

**Sanity-check the card first.** Before writing any sentences, check *every* one of its meanings (the semicolon-separated senses in `english`) against two tests: (1) the Thai word and that English gloss genuinely correspond, and (2) you can realistically produce a Thai sentence with a faithful English translation where *both* read as natural, idiomatic language. The whole card has to pass: if even one meaning fails either test, skip the entire card (leave it with no `examples` field), do not generate sentences for any of its meanings, and do not adjust a gloss to make it fit. When adding many at once, collect every skipped card and report it, for each, which meaning failed and which test: gloss doesn't match the Thai (test 1), or the meaning is genuine but can't be put into a natural bilingual sentence pair (test 2). Never invent or reword a translation to get a card to pass.

The sentences should:

- **Sound natural, in both languages.** Every Thai sentence AND its English translation must be something a native speaker would actually say in everyday life, not merely grammatically correct. Avoid stiff, textbook, or word-for-word phrasings (e.g. a literal "type me a message" instead of the natural "text me"). If the most faithful translation comes out unnatural in English, reword it or pick a different example, so both the Thai and the English are genuinely idiomatic. Real usage is the bar, not grammatical correctness.
- **Match the word's register.** An informal, casual word belongs in informal spoken Thai; a formal word appears in a more formal setting.
- **Be as short and simple as possible.** The goal is to spotlight the target word, not bury it in a long sentence.
- **Use easy surrounding vocabulary.** Keep the rest of the sentence simple (matching the word's level of formality) so the target word is the only piece the learner might not know.
- **Cover every distinct meaning.** Meanings are separated by semicolons in the gloss. Give **two** example sentences per meaning, each showing something different (a different context, collocation, or grammatical role), not the same usage twice. Two per meaning is the default, always; never decide on your own to give a single example. If a card genuinely seems unable to take a second distinct sentence, do not give it one yourself: leave it unfinished and flag it. The only candidates for a single example are headwords that are themselves a complete fixed expression or whole sentence (e.g. `นกเขาขันตอนเช้า`), where the whole clause can't be re-shown in a meaningfully different second context. A single example must never be applied to an ordinary word, and never to a single verb (a verb always varies by who does it, to whom, and in what situation, so two different sentences are always possible even for a crude or "single-act" verb like `โม๊ก`, `เอากัน`, `กินตับ`: just write two).
- **Never use the em dash character (—)** in the sentences or translations. Use commas, colons, parentheses, or separate sentences.
- **Use normal Thai spacing.** A space between two Thai words becomes a spoken pause in the audio. When an example is really two short sentences (e.g. `เค้กอร่อยมาก ขออีกคำ`), separate them with a single space for a natural pause; never put a space inside a single clause. (Spaces around numbers or Latin text, like `40 นิ้ว`, are fine and add no pause.)

### Output format

`examples` is a list of meaning groups, in the same order as the meanings in `english`. Each group has a `meaning` label (copied from the matching semicolon-separated segment of `english`; for a single-meaning word use the whole `english`) and a list of `sentences`:

```json
{
  "id": "new-216",
  "thai": "คำ",
  "english": "word; a mouthful (of food)",
  "frequency": "everyday",
  "examples": [
    {
      "meaning": "word",
      "sentences": [
        { "thai": "คำนี้แปลว่าอะไร", "en": "What does this word mean?" },
        { "thai": "เขาพูดแค่ไม่กี่คำ", "en": "He only said a few words." }
      ]
    },
    {
      "meaning": "a mouthful (of food)",
      "sentences": [
        { "thai": "ขอชิมคำนึงได้ไหม", "en": "Can I have a bite?" },
        { "thai": "เค้กอร่อยมาก ขออีกคำ", "en": "The cake is so good, one more bite." }
      ]
    }
  ]
}
```

Do not add any other fields to the sentences by hand. The audio generator adds `audio_src` / `audio_en_src` to each sentence itself, as provenance; leave those to it.

### After writing (or after each batch of ten, when adding many)

1. **Second pass.** Re-read everything you wrote and check for translation issues and any discrepancy between the Thai and the English: each pair should mean the same thing, nothing added, dropped, or mismatched.
2. **Stop only if there's something to decide.** Two things trigger a stop-and-wait: **skipped cards** (report which meaning failed which test), and **one-example candidates** (fixed whole-sentence headwords only, never ordinary words or single verbs). Leave those cards unfinished and ask. If neither list applies, do not stop, continue to the steps below.

## 4. Generate audio

Credentials come from `.tts-credentials`. Audio is sharded across 256 folders and split between two sibling repos (`thailand-audio-1` for shards 00-7f, `thailand-audio-2` for 80-ff); the generators write the files and set the flags for you.

- **Word audio:** `source .tts-credentials && python3 gen_audio.py --id <word-id>`. Synthesizes the Thai and English pronunciation of the headword, writes `<shard>/<id>.mp3` and `<id>.en.mp3`, and sets `"audio"` / `"audio_en": true` so the page shows the speaker button. Idempotent (skips existing clips); add `--force` to regenerate after editing the `thai`/`english`/`_tts` text.
- **Example audio:** `source .tts-credentials && python3 gen_example_audio.py` (or `--id <word-id>` for one word). Synthesizes a Thai and an English clip per sentence, inserts the spoken pauses from the spacing, and records the exact text spoken so a later edit to a sentence is detected and only that clip regenerated. Run it again after any sentence change.

If a generated clip is mispronounced (segmentation or homograph error), see the audio-fixing sections of `CLAUDE.md`. Both fixes (ZWSP hint, phonetic respelling) live in `thai_tts`, never in the display fields.

## 5. Commit

**Commit all three repos (never push).** `git add` and `git commit` in the main `thailand` repo (the `vocab.json` change) and in both audio repos `thailand-audio-1` and `thailand-audio-2` (the new clips). Commits stay local until pushed by hand.
