# Thai site

## Writing style for content pages (culture.html, etymology.html, and any other content page)

These pages are read by non-native English speakers. They must be useful, not impressive. Plain English only, no essay register.

1. **Plain, non-native-friendly English.** No rare or literary words (e.g. lustral, enmity, entrails, retort, seers, afflictions, petitioner, consecrated, well-bred). No British-only idioms (rota, accident black spots). No literary metaphors or compressed phrasings ("the year turned", "the two poles", "underpins", "is framed as", "brace yourself into acceptance", "lets slip"). The test is "would a non-native reader know this word", not "is it formal": common formal words like deference, stigma, register, precedence are fine. When translating classical Thai similes or plant/animal names, never copy the dictionary translation if it is a rare English word ("ivy gourd" for ตำลึง): simplify the image ("deep red") or drop it.
2. **No romanization of Thai anywhere**, including meta descriptions. Thai script only, with English translations in quotes where they carry meaning ("cool heart").
3. **No editorializing**: no "most famous", "classic example", no meta-commentary in intros or section leads. State facts flatly.
4. **No redundant glosses**: once a word is established, don't re-translate trivial compounds built on it. A parenthetical must add new information.

Apply these while writing, not in a cleanup pass afterwards.

## The voices are fixed

The deck uses exactly one Thai voice, `th-TH-PremwadeeNeural`, and one English voice, `en-US-JennyNeural`, everywhere. Never switch voice, not for a single card, not as a workaround for a word Azure mispronounces: the whole deck has to sound like the same speaker. Another voice may be synthesized as a throwaway diagnostic, but it never gets written into the audio repos. When a clip is wrong, the fix always comes from the text (segmentation hint, `thai_tts` respelling, or rewording the sentence).

## Fixing a mispronounced audio clip ("this card's audio is wrong")

Azure TTS (th-TH-PremwadeeNeural) sometimes misreads a sentence because it mis-segments the unspaced Thai text (e.g. it read ทารกดูดนมแม่ as "thân-kra-dùut", and swallowed a syllable of ไอศกรีม in เลียไอศกรีม). Synthesis is fully deterministic: the same text always produces byte-identical mp3, so re-running without changing the text reproduces the same error.

The agreed fix mechanism is a zero-width space (U+200B) at the misread word boundary. It passes through `speakable()` and `thai_body()` untouched, and Azure treats it as a segmentation hint with no audible pause (verified: identical audio to a real space, and identical audio to no hint at all when Azure's own segmentation already matches).

**The hint goes in `thai_tts`, never in the display `thai` field.** `thai_tts` is spoken instead of the display text and the UI never shows it, so the displayed Thai stays exactly as written. Even though a ZWSP renders as nothing, an invisible character in display content breaks any code that searches, matches or deduplicates on the `thai` string, and the Thai was never the thing that was wrong: only the audio was. Same for English (`en_tts` on sentences, `english_tts` on words). The three 2026-07-10 fixes originally put the ZWSP in `thai` and were migrated to `thai_tts` on 2026-08-05.

Process:

1. **Confirm what the clip says.** Play it with `afplay` for the user, and/or transcribe with faster-whisper (model "medium", language "th", beam_size 5; the "small" model is too noisy). Clip paths come from `audio_paths.py` (word: `word_audio_path(id)`, example: `example_audio_path(id, mi, si)`); the clips live in the sibling repos thailand-audio-1/-2.
2. **Find the fix by differential synthesis.** Synthesize the sentence as-is (must be byte-identical to the on-disk clip if `audio_src` matches — this validates provenance) and again with a ZWSP inserted at the suspect boundary (pythainlp `word_tokenize(text, engine="newmm")` gives correct boundaries). Bytes identical ⇒ segmentation was already right, the problem is elsewhere. Bytes differ ⇒ transcribe the hinted version with whisper and play it to the user to confirm it is now correct. Use the same SSML/voice/output format as `gen_example_audio.py`, credentials via `source .tts-credentials`.
3. **Prefer the minimal hint**: one ZWSP at the boundary that fixes it, not hints everywhere.
4. **Apply**: add a `thai_tts` field carrying the hinted text (display `thai` untouched). Never edit `audio_src` by hand — the script uses the mismatch to know what to regenerate.
5. **Regenerate**: `source .tts-credentials && python3 gen_example_audio.py --id <word-id> --lang th` (word clips: `gen_audio.py` with `--force`). Only the changed sentence is re-synthesized.
6. **Verify**: whisper the new clip, `afplay` it for the user. Remind them the fix goes live only after pushing the audio repo and vocab.json (no git operations unless asked).
7. **Check siblings**: if the misread word appears in other sentences, differential-test those too. Usually only one specific letter run is affected (of 7 ไอศกรีม sentences, only เลียไอศกรีม was broken).

Detection caveats learned the hard way: whisper exact-match comparison is useless for Thai (~84% false positives from homophone spellings, loanwords transcribed in Latin script, digits); Azure's Pronunciation Assessment API cannot detect these errors (it uses the same broken segmenter, and scored the bad milk clip *higher* than the fixed one); isolated word clips transcribe too noisily to trust. Differential synthesis is the only reliable detector, and it only catches segmentation errors (not wrong homograph readings).

Fixed so far (2026-07-10): wlt-c21-023 ex1_1 (ทารก‸ดูดนมแม่), tobo-208 ex0_1 (เลีย‸ไอศกรีม), tamago-l12-097 ex0_1 (อย่า‸งอนสิ) — ‸ marks where the invisible ZWSP sits. Note the last one: whisper transcribed the bad clip as the expected string (อย่างอน is the same letters read either way), so only the differential test could detect it.

Tooling note: faster-whisper and pythainlp are not installed globally; create a venv and `pip install faster-whisper pythainlp` (whisper models download on first use).

## Fixing a wrong homograph reading ("Azure says phee-laa, the card means plao")

The ZWSP hint above only influences segmentation, so it can force the split reading of a homograph (เพ-ลา) but never the cluster reading (เพลา as plao). For those, the same `thai_tts` field carries a phonetic respelling instead of a hinted spelling (word-level in the card, or sentence-level on an example sentence; `en_tts`/`english_tts` exist for English). Both gen_audio.py and gen_example_audio.py speak the `_tts` field instead of the display field when present; the UI never shows it. The provenance mechanism handles regeneration: adding or editing a `_tts` field makes the recorded `audio_src` mismatch, so only that clip is re-synthesized on the next run.

Pick a respelling that is unambiguous for Azure and verify by ear (`afplay`), never by whisper. First use (2026-07-12): เพลา was split into two cards because one headword clip cannot carry two readings. Azure reads bare เพลา as phee-laa, so the "time" card (new-33) needs no override, and the "to lessen" card (yt-c11-072) carries `thai_tts: "พลาว"` plus a sentence-level `thai_tts` (พลาวๆ) because Azure misread เพลาๆ even in context. SSML `<sub alias='...'>` produces byte-identical audio to a plain respelling, and `<phoneme>` with IPA also changes the audio, but plain respelling needs no SSML support in the scripts, so it is the agreed mechanism.
