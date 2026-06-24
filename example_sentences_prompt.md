Each word in the deck comes with an English and a Thai translation. But a word in isolation doesn't teach much, since meaning lives in context. So once a card is revealed, I want to show a few example sentences that help the learner see how the word is actually used.

These sentences should:

- **Sound natural** - they should reflect how a native Thai speaker would genuinely use the word in everyday life.
- **Match the word's register** - an informal, casual word belongs in a sentence written in informal spoken Thai; a formal word should appear in a more formal setting.
- **Be as short and simple as possible** - the goal is to spotlight the target word, not bury it in a long sentence. If a brief sentence can demonstrate the meaning, use it.
- **Use easy surrounding vocabulary** - keep the rest of the sentence simple (again, matching the word's level of formality), so the learner can understand almost everything, and the word being taught is the only piece they might not yet know.
- **Cover every distinct meaning of the word** - a word's meanings are separated by semicolons in the translation: "A, B, C; D, E" means the word has two meanings (one is *A, B, C*, the other is *D, E*). Provide at least two example sentences per meaning, and make each one show something different (a different context, collocation, or grammatical role) rather than restating the same usage twice. This applies even to a word with a single straightforward meaning: give it at least two distinct sentences too.
- **Never use the em dash character (—)** in the sentences or the English translations. Use commas, colons, parentheses, or separate sentences instead.
- **Use normal Thai spacing.** Thai has no spaces between words, so use a space only at a real phrase or sentence boundary. The audio is generated from this same text, and a space between two Thai words becomes a spoken pause: so when an example is really two short sentences (e.g. `เค้กอร่อยมาก ขออีกคำ`), separate them with a single space to get a natural pause, and never put a space inside a single clause. (Spaces around numbers or Latin text, like `40 นิ้ว`, are fine and won't add a pause.)

In short: keep the sentences simple, make sure they sound like something a native speaker would naturally say (natural Thai for the Thai, natural English for the translation), and always remember that this is a language-learning app built to help learners.

When you are done generating, make a second pass over everything you wrote to check that there are no translation issues and no discrepancies between the Thai and the English: every Thai sentence and its translation should mean the same thing, with nothing added, dropped, or mismatched.

Once the sentences are finalized and checked, generate the audio for them by running `gen_example_audio.py`. It synthesizes a Thai and an English clip per sentence, inserts the spoken pauses described above, and records the exact text it spoke (so a later edit to a sentence is detected and only that clip is regenerated). Run it again after any sentence change.
