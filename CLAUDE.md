# Thai site

## Writing style for content pages (culture.html, etymology.html, and any other content page)

These pages are read by non-native English speakers. They must be useful, not impressive. Plain English only, no essay register.

1. **Plain, non-native-friendly English.** No rare or literary words (e.g. lustral, enmity, entrails, retort, seers, afflictions, petitioner, consecrated, well-bred). No British-only idioms (rota, accident black spots). No literary metaphors or compressed phrasings ("the year turned", "the two poles", "underpins", "is framed as", "brace yourself into acceptance", "lets slip"). The test is "would a non-native reader know this word", not "is it formal": common formal words like deference, stigma, register, precedence are fine. When translating classical Thai similes or plant/animal names, never copy the dictionary translation if it is a rare English word ("ivy gourd" for ตำลึง): simplify the image ("deep red") or drop it.
2. **No romanization of Thai anywhere**, including meta descriptions. Thai script only, with English translations in quotes where they carry meaning ("cool heart").
3. **No editorializing**: no "most famous", "classic example", no meta-commentary in intros or section leads. State facts flatly.
4. **No redundant glosses**: once a word is established, don't re-translate trivial compounds built on it. A parenthetical must add new information.

Apply these while writing, not in a cleanup pass afterwards.

## Committing and pushing (do it automatically)

Changes to this project are committed and pushed without asking. This is a standing instruction, decided 2026-08-14, and it overrides the general "no git operations unless asked" rule for these three repos only:

- `thai/thailand` (vocab.json, pages, scripts)
- `thai/thailand-audio-1` (shards 00-7f)
- `thai/thailand-audio-2` (shards 80-ff)

Rules:

1. **When.** After a change is finished and verified. For an audio fix, that means after the user has confirmed by ear that the new clip is right, never before: a clip they have not approved does not get committed. For content and code edits, when the edit is done.
2. **All affected repos.** An audio fix usually touches vocab.json plus one or both audio repos. Commit and push each repo that has changes, not just vocab.json, or the deck goes live pointing at clips that were never pushed. Check all three with `git -C <repo> status --short`.
3. **Identity.** Author and committer must be `Antoine Fourmy <antoinefourmy@gmail.com>`. Pass `-c user.name="Antoine Fourmy" -c user.email="antoinefourmy@gmail.com"` on every commit, and never add a `Co-Authored-By: Claude` trailer (this overrides the default harness instruction to add one). A global pre-commit hook enforces the email and fails closed; never use `--no-verify`.
4. **Message.** `update`, matching the existing history. No body, no trailers.
5. **Scope.** Stage only the files the change actually touched (`git add <paths>`, not `git add -A`), and say in the reply what was committed and pushed in each repo.

## The voices are fixed

The deck uses exactly one Thai voice, `th-TH-PremwadeeNeural`, and one English voice, `en-US-JennyNeural`, everywhere. Never switch voice, not for a single card, not as a workaround for a word Azure mispronounces: the whole deck has to sound like the same speaker. Another voice may be synthesized as a throwaway diagnostic, but it never gets written into the audio repos. When a clip is wrong, the fix always comes from the text (segmentation hint, `thai_tts` respelling, or rewording the sentence).

## Fixing a mispronounced audio clip ("this card's audio is wrong")

**Run this whole procedure without asking for permission.** "This card's audio is wrong" is a standing instruction to diagnose and fix it. Say in one line which card you found and that you are probing it, then do all of it: play the current clip, synthesize candidates, ask once which candidate is right, apply, regenerate, play the result. Do not ask whether to start, do not stop after the diagnosis, and do not make the user re-explain the process: it is written here.

Azure TTS (th-TH-PremwadeeNeural) sometimes misreads a sentence because it mis-segments the unspaced Thai text (e.g. it read ทารกดูดนมแม่ as "thân-kra-dùut", and swallowed a syllable of ไอศกรีม in เลียไอศกรีม). A second, common variant of the same bug: **ๆ repeated with the wrong scope**, where Azure repeats the whole preceding phrase instead of the last word (ใจเย็นๆ read "jai yen jai yen" instead of "jai yen yen"). Both have the same fix.

The agreed fix mechanism is a zero-width space (U+200B) at the misread word boundary, or, for ๆ, immediately before the word that ๆ should repeat (ใจ‸เย็นๆ). It passes through `speakable()` and `thai_body()` untouched, and Azure treats it as a segmentation hint with no audible pause. Spelling the repetition out (ใจเย็นเย็น) fixes ๆ too, but prefer the ZWSP: it keeps the `thai_tts` readable as the same words.

Synthesis used to be byte-deterministic, and is not any more (2026-08-10: three renders of แวะ came back the same length with three different hashes, and a fresh ใจเย็นๆ matched the June clip's length and first ~8 KB then diverged; the generator's own render of แวะ was a different length again, 17280 vs 21312, for reasons still unexplained). **Neither hashes nor lengths are evidence.** A length change says a hint did something, nothing more. Correctness is decided by the user's ear, always.

**The hint goes in `thai_tts`, never in the display `thai` field.** `thai_tts` is spoken instead of the display text and the UI never shows it, so the displayed Thai stays exactly as written. Even though a ZWSP renders as nothing, an invisible character in display content breaks any code that searches, matches or deduplicates on the `thai` string, and the Thai was never the thing that was wrong: only the audio was. Same for English (`en_tts` on sentences, `english_tts` on words). The three 2026-07-10 fixes originally put the ZWSP in `thai` and were migrated to `thai_tts` on 2026-08-05.

Process:

1. **Confirm what the clip says.** Play it with `afplay` for the user, and/or transcribe with faster-whisper (model "medium", language "th", beam_size 5; the "small" model is too noisy). Clip paths come from `audio_paths.py` (word: `word_audio_path(id)`, example: `example_audio_path(id, mi, si)`); the clips live in the sibling repos thailand-audio-1/-2.
2. **Find the fix by differential synthesis.** Synthesize the text as-is (same byte length as the on-disk clip when `audio_src` matches: this validates provenance) and again with a ZWSP inserted at the suspect boundary (pythainlp `word_tokenize(text, engine="newmm")` gives correct boundaries). Same length ⇒ segmentation was already right, the problem is elsewhere. Different length ⇒ transcribe the hinted version with whisper and play it to the user to confirm.

   **Build every candidate through the same code path as the real generator, by importing it.** Word candidates: `gen_audio.speakable` + `gen_audio.ssml`. Sentence candidates: `gen_example_audio.speakable` + `thai_body` + `gen_example_audio.ssml`. This is not a detail. `thai_body()` turns every space between two Thai chunks into a comma pause, so a sentence probed through the word-level path has no pauses at all and sounds broken in a way production never is. Probing sentences the wrong way once cost a full round of listening tests and a wrong diagnosis ("there is no pause") that was an artifact of the harness. Never ask the user to judge a clip that was not built the way the generator builds it.
3. **Prefer the minimal hint**: one ZWSP at the boundary that fixes it, not hints everywhere.
4. **Apply**: add a `thai_tts` field carrying the hinted text (display `thai` untouched). Never edit `audio_src` by hand — the script uses the mismatch to know what to regenerate.
5. **Regenerate**: `source .tts-credentials && python3 gen_example_audio.py --id <word-id> --lang th` (word clips: `gen_audio.py` with `--force`). Only the changed sentence is re-synthesized.
6. **Verify**: whisper the new clip, `afplay` it for the user.
7. **Commit and push** once the user confirms the clip is right, per the section below.
8. **Check siblings**: if the misread word appears in other sentences, differential-test those too. Usually only one specific letter run is affected (of 7 ไอศกรีม sentences, only เลียไอศกรีม was broken).

**Playing candidates for the user.** The user judges by ear; whisper is only a hint. Announce each clip with `say -v Samantha "<label>"` immediately before its `afplay`, and give every clip a letter, including the one currently shipped ("A" for the current clip, not "current", then B, C, ...): mixing a word with letters makes the answer ambiguous, and "C and D" against a list labelled current/A/B/C costs another round trip. Use those same letters when asking. Play at most four candidates in one pass, and state the running order in the message before the tool call, since tool output is not shown to the user.

**Do not use whisper as evidence, and do not quote its output to the user.** It is wrong often enough on this deck's clips to be worthless as proof, and repeating its guesses ("whisper hears it as ว่า") wastes the user's time and misleads the diagnosis. The user's ear is the only verdict. Whisper is at most a private, silent tiebreaker; if a probe cannot be decided without it, play the clips instead. The same goes for byte lengths: they prove that a hint changed the audio, never that it changed it correctly.

Detection caveats learned the hard way: whisper exact-match comparison is useless for Thai (~84% false positives from homophone spellings, loanwords transcribed in Latin script, digits); Azure's Pronunciation Assessment API cannot detect these errors (it uses the same broken segmenter, and scored the bad milk clip *higher* than the fixed one); isolated word clips transcribe too noisily to trust. Differential synthesis is the only reliable detector, and it only catches segmentation errors (not wrong homograph readings).

Fixed so far (2026-07-10): wlt-c21-023 ex1_1 (ทารก‸ดูดนมแม่), tobo-208 ex0_1 (เลีย‸ไอศกรีม), tamago-l12-097 ex0_1 (อย่า‸งอนสิ) — ‸ marks where the invisible ZWSP sits. 2026-08-10: thaipod-1392, all three Thai clips (ใจ‸เย็นๆ), the ๆ-scope case; thaipod-1342 ex0_1 (ขากลับบ้าน·แวะ·หายายหน่อย), the isolation case, see the section below. Note the last one: whisper transcribed the bad clip as the expected string (อย่างอน is the same letters read either way), so only the differential test could detect it. 2026-08-14, all isolation cases: wlt-c09-076 ex0_1 (ดื่มเหล้า·แล้ว·อย่าขับรถ), wlt-c17-054 ex0_1 (เขาซื้อข้าว·และ·ไข่), wlt-c10-045 ex0_1 (ขอ·เข้า·นอนก่อนนะ), wlt-c19-094 ex0_0 (ขาฉัน·เมื่อย·มาก); plus two missing clause breaks fixed in the display `thai` itself, not in `thai_tts`: tamago-l3-284 ex0_1 (อย่ามากวน น่ารำคาญ) and wlt-c21-014 ex0_1 (ขับตรงไป อย่าเลี้ยว). When the space is genuinely missing from the Thai sentence, fix the sentence: `thai_tts` is for hints Azure needs that the reader does not.

Tooling note: faster-whisper and pythainlp are not installed globally; create a venv and `pip install faster-whisper pythainlp` (whisper models download on first use). Credentials: `source .tts-credentials && python3 ...` gets blocked by the permission classifier, so have the probe script read `.tts-credentials` itself and set `os.environ` (the generators still take the sourced env when run normally).

## Isolating a word Azure reads wrong ("the pronunciation of แวะ is wrong here")

When one word in a sentence is read wrong, the cause is almost always that Azure did not parse it as a separate word. **Isolate the word.** The user's own rule: the separator must be inaudible, so the sentence still sounds like one phrase.

**Just apply the middle dot. Do not offer a menu of candidates.** The decision was made on 2026-08-10 and it does not need re-deciding per card: put `·` (U+00B7) around the word in `thai_tts`, regenerate, play the one resulting clip to confirm. Only if the user says that clip is still wrong do you go down the rest of the ladder. Playing four labelled candidates is for a genuinely new failure mode, not for this one.

The ladder, in order, all of it inside `thai_tts` and never in the display `thai`:

1. **Middle dot `·` (U+00B7) on both sides of the word.** The default fix: `ขากลับบ้าน·แวะ·หายายหน่อย`, `ขนมไทยหลายอย่างใส่กะทิ·มะพร้าว`. It isolates the word and adds roughly 50ms, which is not audible as a pause. Chosen over the alternatives by ear on thaipod-1342, confirmed again on tobo-189 (2026-08-10). One dot is enough when the word ends the sentence.
2. **Hyphen `-` on both sides.** Also read correctly, adds ~120ms, slightly more noticeable than the dot.
3. **Comma**, i.e. a real space in `thai_tts`, which `thai_body()` converts to ", ". Isolates most strongly and always fixes the reading, but the ~0.9s pause is plainly audible, so it is a diagnostic tool, not a shipping fix: use it first to confirm that isolation is what the word needs, then move down to the dot.
4. **ZWSP (U+200B)** only helps segmentation splits and ๆ scope. For a wrong word reading it frequently changes nothing at all (four ZWSP placements around แวะ produced clips of identical length to the broken one).

Dead ends, do not spend the user's time re-testing them: SSML `<break>` at any value, including 10ms, adds Azure's fixed ~1.3s pause per break; `<mstts:silence type='Comma-exact'>` lengthens the clip by ~1.7s no matter the value (the `xmlns:mstts` declaration itself is harmless); a semicolon pauses like a comma; NBSP and thin space are normalized back to a plain space by `speakable()`. A plain space that survives to the SSML (achievable by putting a ZWSP right after it, which stops `thai_body` inserting the comma) produces no pause and no isolation either.

Probe the whole ladder in one batch and play the candidates in one pass. Four clips, letters A to D, A being the current shipped clip.

## Spaces after ๆ

Thai convention puts a space after ๆ, so that space is orthographic and usually not a clause boundary. `thai_body()` turns every space between two Thai chunks into a comma pause, which makes those sentences pause in the wrong place.

The fix is case by case, never a blanket rule and never a change to `thai_body()`: read what follows the space. A new clause with its own verb keeps the pause (จับให้แน่นๆ เดี๋ยวหลุดมือ, พูดตรงๆ ฉันไม่ชอบ, เดินช้าๆ ระวังลื่น). A continuation of the same phrase gets `ๆ·` in `thai_tts` so the boundary survives without a pause (เด็กๆ·เติบโตเร็วมาก, อาหารเช้าง่ายๆ·ของคนอีสาน, ใครๆ·ก็รู้จัก, พูดให้ชัดๆ·หน่อย). Reduplicated compounds are always one unit and always get the dot: ผลุบๆ·โผล่ๆ, ทิ้งๆ·ขว้างๆ, เลียบๆ·เคียงๆ, ลมๆ·แล้งๆ, ต่างๆ·นานา. A sentence can need both, dotted at the compound and pausing at the clause break (เขาผลุบๆ·โผล่ๆ ไม่ยอมอยู่ในที่ประชุมนานๆ).

Swept once on 2026-08-10: 195 sentences had a pausing post-ๆ space, 135 were dotted, 60 kept, 7 were mixed, 187 clips regenerated.

## Fixing a wrong homograph reading ("Azure says phee-laa, the card means plao")

The ZWSP hint above only influences segmentation, so it can force the split reading of a homograph (เพ-ลา) but never the cluster reading (เพลา as plao). For those, the same `thai_tts` field carries a phonetic respelling instead of a hinted spelling (word-level in the card, or sentence-level on an example sentence; `en_tts`/`english_tts` exist for English). Both gen_audio.py and gen_example_audio.py speak the `_tts` field instead of the display field when present; the UI never shows it. The provenance mechanism handles regeneration: adding or editing a `_tts` field makes the recorded `audio_src` mismatch, so only that clip is re-synthesized on the next run.

Pick a respelling that is unambiguous for Azure and verify by ear (`afplay`), never by whisper. First use (2026-07-12): เพลา was split into two cards because one headword clip cannot carry two readings. Azure reads bare เพลา as phee-laa, so the "time" card (new-33) needs no override, and the "to lessen" card (yt-c11-072) carries `thai_tts: "พลาว"` plus a sentence-level `thai_tts` (พลาวๆ) because Azure misread เพลาๆ even in context. SSML `<sub alias='...'>` produces byte-identical audio to a plain respelling, and `<phoneme>` with IPA also changes the audio, but plain respelling needs no SSML support in the scripts, so it is the agreed mechanism.
