Each word in the deck comes with an English and a Thai translation. But a word in isolation doesn't teach much, since meaning lives in context. So once a card is revealed, I want to show a few example sentences that help the learner see how the word is actually used.

**Which words:** this is the procedure for newly added words. Every word already in the deck has its examples, so the words to work on are simply the ones that don't yet have an `examples` field, whatever their `frequency` (see `example_sentences_done.md` for what's already done). Work through them ten at a time.

**Sanity-check each card first.** Before writing any sentences for a card, check *every* one of its meanings (the semicolon-separated senses in `english`) against two tests: (1) the Thai word and that English gloss genuinely correspond, and (2) you can realistically produce a Thai sentence with a faithful English translation where *both* read as natural, idiomatic language. The whole card has to pass: if even one meaning fails either test, skip the entire card (leave it with no `examples` field), do not generate sentences for any of its meanings, and do not adjust a gloss to make it fit. Collect every skipped card and, when the batch is done, report them to me with, for each, which meaning failed and which test: the gloss doesn't match the Thai (test 1), or the meaning is genuine but can't be put into a natural bilingual sentence pair (test 2). Do not invent or reword translations to get a card to pass.

These sentences should:

- **Sound natural, in both languages** - every Thai sentence AND its English translation must be something a native speaker would actually say in everyday life, not merely something grammatically correct. Avoid stiff, textbook, or word-for-word phrasings (e.g. a literal "type me a message" instead of the natural "text me"). If the most faithful translation comes out unnatural in English, reword it, or pick a different example sentence, so that both the Thai and the English are genuinely idiomatic. Grammatical correctness is not the bar; real usage is.
- **Match the word's register** - an informal, casual word belongs in a sentence written in informal spoken Thai; a formal word should appear in a more formal setting.
- **Be as short and simple as possible** - the goal is to spotlight the target word, not bury it in a long sentence. If a brief sentence can demonstrate the meaning, use it.
- **Use easy surrounding vocabulary** - keep the rest of the sentence simple (again, matching the word's level of formality), so the learner can understand almost everything, and the word being taught is the only piece they might not yet know.
- **Cover every distinct meaning of the word** - a word's meanings are separated by semicolons in the translation: "A, B, C; D, E" means the word has two meanings (one is *A, B, C*, the other is *D, E*). Give two example sentences per meaning, and make each one show something different (a different context, collocation, or grammatical role) rather than restating the same usage twice. **Two per meaning is the default, always. Never decide on your own to give a single example.** If you think a card genuinely can't take a second distinct sentence, do **not** give it one yourself: flag it and raise it with me to decide (see the batch-completion step below), and leave that card unfinished for now. The only cards that are ever even candidates for a single example are those whose headword is itself a complete fixed expression or whole sentence (e.g. `นกเขาขันตอนเช้า`, "morning wood"), where the whole clause can't be re-shown in a meaningfully different second context. **A single example must never be applied to an ordinary word, and never to a single verb** - a verb always varies by who does it, to whom, and in what situation, so two genuinely different sentences are always possible, even for a crude, taboo, or "single-act" verb (e.g. `โม๊ก`, `เอากัน`, `กินตับ`): just write two, don't even flag those. Phrases that slot naturally into varied surrounding speech (e.g. `ขอคิดดูก่อน`, `จบข่าว`) also take two. When in doubt, write two.
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

## When you are done with each batch of ten

Do these after every batch of ten words, not only at the very end:

1. **Second pass.** Re-read everything you wrote and check there are no translation issues and no discrepancies between the Thai and the English: every Thai sentence and its translation should mean the same thing, with nothing added, dropped, or mismatched.
2. **Stop *only* if there's something for me to decide.** Two things trigger a stop-and-wait:
   - **Skipped cards.** If the sanity check skipped any card, report those (each with which meaning failed and which test: gloss mismatch, or can't be exemplified naturally), since I may clarify or correct a skipped card so it can be done.
   - **One-example candidates.** If any card looks like it genuinely can't take a second distinct sentence (only ever fixed whole-sentence expressions like `นกเขาขันตอนเช้า`, never ordinary words or single verbs), do **not** give it a single example on your own. Leave that card unfinished (no `examples` field yet) and flag it to me, so I can decide whether it gets one example, or tell you a second context to write.

   If either list is non-empty, report it and **wait for my reply** before doing anything else. If both are empty, do **not** stop and do **not** wait for confirmation: report the batch briefly and move straight on to the steps below.
3. **Update the index.** Run `python3 list_examples.py` to regenerate `example_sentences_done.md` (the list of which words now have examples).
4. **Generate the audio.** Run `source .tts-credentials && python3 gen_example_audio.py`. It synthesizes a Thai and an English clip per sentence, inserts the spoken pauses described above, writes the files into the sharded `audio/` layout, and records the exact text it spoke (so a later edit to a sentence is detected and only that clip is regenerated). Run it again after any sentence change.
5. **Commit all three repos (no push).** Once the audio is generated, `git add` and `git commit` in each of the three repositories: the main `thailand` repo (the `vocab.json` and index changes) and both audio repos `thailand-audio-1` and `thailand-audio-2` (the new clips). Never `git push`: commits stay local until I push them myself.
