Each word in the deck comes with an English and a Thai translation. But a word in isolation doesn't teach much, since meaning lives in context. So once a card is revealed, I want to show a few example sentences that help the learner see how the word is actually used.

**Which words:** we now add example sentences to *common* words in the *general* topic only, i.e. words whose `frequency` field in `vocab.json` is `"common"` **and** whose `topic` field is `"general"`. The `everyday` words are already done; skip the other frequencies (`occasional`, `rare`) and every other topic for now. Work through the matching words that don't yet have an `examples` field, ten at a time (see `example_sentences_done.md` for what's already done).

**Sanity-check each card first.** Before writing any sentences for a card, and separately for *each* of its meanings (the semicolon-separated senses in `english`), confirm two things: (1) the Thai word and that English gloss genuinely correspond, and (2) you can realistically produce a Thai sentence with a faithful English translation where *both* read as natural, idiomatic language. If a meaning fails either test, do not generate sentences for it and do not adjust the gloss to make it fit. Generate sentences only for the meanings that pass, and collect every skipped meaning. When the batch is done, report the skipped ones to me with, for each, which test failed: the gloss doesn't match the Thai (test 1), or the meaning is genuine but can't be put into a natural bilingual sentence pair (test 2). If *all* of a card's meanings fail, skip the whole card (leave it with no `examples` field) and include it in the report. Do not invent or reword translations to get a card to pass.

These sentences should:

- **Sound natural, in both languages** - every Thai sentence AND its English translation must be something a native speaker would actually say in everyday life, not merely something grammatically correct. Avoid stiff, textbook, or word-for-word phrasings (e.g. a literal "type me a message" instead of the natural "text me"). If the most faithful translation comes out unnatural in English, reword it, or pick a different example sentence, so that both the Thai and the English are genuinely idiomatic. Grammatical correctness is not the bar; real usage is.
- **Match the word's register** - an informal, casual word belongs in a sentence written in informal spoken Thai; a formal word should appear in a more formal setting.
- **Be as short and simple as possible** - the goal is to spotlight the target word, not bury it in a long sentence. If a brief sentence can demonstrate the meaning, use it.
- **Use easy surrounding vocabulary** - keep the rest of the sentence simple (again, matching the word's level of formality), so the learner can understand almost everything, and the word being taught is the only piece they might not yet know.
- **Cover every distinct meaning of the word** - a word's meanings are separated by semicolons in the translation: "A, B, C; D, E" means the word has two meanings (one is *A, B, C*, the other is *D, E*). Provide at least two example sentences per meaning, and make each one show something different (a different context, collocation, or grammatical role) rather than restating the same usage twice. This applies even to a word with a single straightforward meaning: give it at least two distinct sentences too.
- **Never use the em dash character (—)** in the sentences or the English translations. Use commas, colons, parentheses, or separate sentences instead.
- **Use normal Thai spacing.** Thai has no spaces between words, so use a space only at a real phrase or sentence boundary. The audio is generated from this same text, and a space between two Thai words becomes a spoken pause: so when an example is really two short sentences (e.g. `เค้กอร่อยมาก ขออีกคำ`), separate them with a single space to get a natural pause, and never put a space inside a single clause. (Spaces around numbers or Latin text, like `40 นิ้ว`, are fine and won't add a pause.)

In short: keep the sentences simple, make sure they sound like something a native speaker would naturally say (natural Thai for the Thai, natural English for the translation), and always remember that this is a language-learning app built to help learners.

## Where the sentences go (output format)

The vocabulary lives in `vocab.json`: a flat JSON array of word objects, each with at least an `id`, a `thai`, and an `english` field. To add examples to a word, find its object by `id` and add an `examples` array to it.

`examples` is a list of meaning groups, in the same order as the meanings in the word's `english` field (meanings there are separated by semicolons). Each group has a `meaning` label and a list of `sentences`:

```json
{
  "id": "chula-l6-185",
  "thai": "คำ",
  "english": "word; a mouthful (of food)",
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

- `meaning` is the gloss for that one sense, copied from the matching semicolon-separated segment of the word's `english` (for `"word; a mouthful (of food)"` the two labels are `"word"` and `"a mouthful (of food)"`). For a word with a single meaning, use the whole `english` as the one label.
- Each group's `sentences` follow all the rules above (at least two per meaning, each `thai` with its `en` translation).
- Do not add any other fields to the sentences by hand. The audio generator adds `audio_src` / `audio_en_src` to each sentence itself, as provenance; leave those to it.

## When you are done

1. **Second pass.** Re-read everything you wrote and check there are no translation issues and no discrepancies between the Thai and the English: every Thai sentence and its translation should mean the same thing, with nothing added, dropped, or mismatched.
2. **Update the index.** Run `python3 list_examples.py` to regenerate `example_sentences_done.md` (the list of which words now have examples).
3. **Generate the audio.** Run `source .tts-credentials && python3 gen_example_audio.py`. It synthesizes a Thai and an English clip per sentence, inserts the spoken pauses described above, writes the files into the sharded `audio/` layout, and records the exact text it spoke (so a later edit to a sentence is detected and only that clip is regenerated). Run it again after any sentence change.
