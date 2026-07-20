# Frequency re-categorization pass

Every word in `vocab.json` has a `frequency` field with one of four values: `everyday`, `common`, `occasional`, `rare`. Many words are currently mislabeled, for example formal or written-Thai words sitting in `common` or `occasional` when they belong in `rare`, or the other way around. This is the procedure for re-checking the label of every word in the deck.

## My use case (the whole point of the categories)

I like to talk to Thai people in daily life, and I like to watch the news in Thai. What I never want is to say something that a real Thai person in daily life either would not understand, or would understand but would find "weird", because it is not a word people actually use in conversation (bookish, too formal, whatever). The categories exist to protect me from that: they tell me which words are safe to say to a friend, which are news-register, and which are book-only.

So the test for every word is about **spoken** Thai, never about whether Thais would recognize the word. A native speaker recognizes thousands of words they would never say. Understanding is not the bar; real spoken usage is.

One important nuance: spoken Thai is broader than casual chat. Journalists, TV news anchors, radio hosts, and podcast presenters speak a somewhat formal Thai, and that still counts as spoken Thai. A word is only "written Thai" if it lives mostly in books, official documents, and other text, and is not really said out loud even by broadcasters.

## The four categories

- **everyday**: words used literally every day. If you spend one day talking with a Thai friend, you WILL end up using or hearing this word. (กิน, ไป, อร่อย, แต่ว่า, เคย)
- **common**: words used commonly as part of a normal, casual conversation with friends. Informal spoken Thai. You would not necessarily hear them every single day, but they raise no eyebrows in a chat. (แหงสิ, จุ้นจ้าน, ฉลุย)
- **occasional**: formal words BUT still regularly used in spoken Thai. This is the news-and-broadcast register: words you can hear on TV news, radio, podcasts, Thai PBS, in speeches and announcements. A friend might find them stiff in a casual chat, but a news anchor says them naturally. (เผยแพร่, คมนาคม, วิกฤตการณ์, ประชามติ)
- **rare**: everything that is not really used in spoken Thai at all. Literary words (mostly found in books and novels), official-document and legal language, religious words, royal words. Even broadcasters rarely say them; they are encountered in text. (ทว่า, ทันใด, พระราชกฤษฎีกา, ราชโองการ)

## How to decide (apply the questions in this order)

1. **Would this word inevitably come up in one ordinary day of chatting with a friend?** Yes: `everyday`.
2. **Would a Thai person say this naturally in a casual conversation with friends, without it sounding bookish or stiff?** Yes: `common`.
3. **Even if it is too formal for a chat, do you regularly hear it spoken on TV news, radio, or podcasts?** Yes: `occasional`. The word must actually be *said aloud* in broadcasts with some regularity, not merely be the kind of word that could appear in a news script.
4. **Otherwise**: `rare`. This is where all predominantly written words go: literary vocabulary, novel and essay language, official and legal terminology, scripture and monk-register religious vocabulary, royal vocabulary (ราชาศัพท์).

Edge cases:

- **Formal is not the same as written.** Do not demote a word to `rare` just because it is formal; if anchors and hosts really say it, it is `occasional`. Demote it when it is essentially text-only.
- **Religious and royal words are not automatically rare.** Words from religious life that ordinary people say in conversation (ทำบุญ, ใส่บาตร, ไหว้พระ) are judged by the normal spoken tests like any other word. `rare` is for the scripture / ceremony / monk-register and royal-register vocabulary that laypeople recognize but do not say.
- **Slang and crude words** follow the same spoken tests; register (polite vs crude) does not matter, only how often the word is really spoken.
- **When torn between two adjacent categories**, ask: "if I used this word with a Thai friend at dinner, would they find it weird?" and "would I plausibly hear this on the evening news this week?". If it is genuinely borderline, flag it for me instead of silently picking one.

## Procedure

Work through `vocab.json` in batches of 50 words, in deck order. For each word, judge the current `frequency` against the rules above.

- Do **not** edit `vocab.json` yourself. Instead, collect proposals in a working file named `frequency` (same style as the `decisions` file), one entry per word whose label looks wrong:

  ```
  ทว่า
    new-100 [rare <- ok] (skip, this one is fine: do not list correct words)

  เสื่อมโทรม
    new-144 [occasional -> rare?] 'to deteriorate, to decline, to become run down'
    note: one-line reason: where the word actually lives (chat / broadcast / text)
  ```

  i.e. for each proposed change: the Thai, the id, `current -> proposed`, the gloss, and a one-line `note:` saying where the word actually lives. Words whose current label is right are simply not listed.

- After each batch, tell me briefly how many words you checked and how many proposals you added, and continue to the next batch without waiting, unless a batch contains words you flagged as genuinely borderline, in which case stop and ask.
- When the whole deck has been swept, I will go through the `frequency` file, mark my decisions, and only then do we apply the approved changes to `vocab.json` in one merge, like the previous `decisions` batches.
- Frequency is the only thing under review: do not touch glosses, examples, ids, or anything else, and do not use this pass to propose removals or renames. If you notice a different kind of problem, mention it to me separately instead of putting it in the file.
