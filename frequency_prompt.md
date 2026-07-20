# Frequency re-categorization pass

Every word in `vocab.json` has a `frequency` field with one of four values: `everyday`, `common`, `occasional`, `rare`. Many words are currently mislabeled, for example formal or written-Thai words sitting in `common` or `occasional` when they belong in `rare`, or the other way around. This is the procedure for re-checking the label of every word in the deck.

## My use case (the whole point of the categories)

I like to talk to Thai people in daily life, and I like to watch the news in Thai. What I never want is to say something that a real Thai person in daily life either would not understand, or would understand but would find "weird", because it is not a word people actually use in conversation (bookish, too formal, whatever). The categories exist to protect me from that: they tell me which words are safe to say to a friend, which are news-register, and which are book-only.

So the test for every word is about **spoken** Thai, never about whether Thais would recognize the word. A native speaker recognizes thousands of words they would never say. Understanding is not the bar; real spoken usage is.

One important nuance: spoken Thai is broader than casual chat. Journalists, TV news anchors, radio hosts, and podcast presenters speak a somewhat formal Thai, and that still counts as spoken Thai. A word is only "written Thai" if it lives mostly in books, official documents, and other text, and is not really said out loud even by broadcasters.

The test is a person **talking**: an anchor, a host, an interviewee, a guest. Text that merely gets *read out* is not speech for this purpose. PA and recorded announcements, legal warnings, signage, forms, and ceremony scripts do NOT count, no matter how often I hear them. A word that survives only in those places is `rare`, because I could never use it with a Thai person without sounding like a loudspeaker. (มิฉะนั้น, เป็นอันขาด, บัดนี้ are `rare` for exactly this reason: anchors talking say หากไม่, ไม่เช่นนั้น, ห้ามเด็ดขาด, ตอนนี้.)

## The four categories

- **everyday**: words used literally every day. If you spend one day talking with a Thai friend, you WILL end up using or hearing this word. (กิน, ไป, อร่อย, แต่ว่า, เคย)
- **common**: words used commonly as part of a normal, casual conversation with friends. Informal spoken Thai. You would not necessarily hear them every single day, but they raise no eyebrows in a chat. (แหงสิ, จุ้นจ้าน, ฉลุย)
- **occasional**: formal words BUT still regularly used in spoken Thai. This is the news-and-broadcast register: words you can hear on TV news, radio, podcasts, Thai PBS, and in speeches. A friend might find them stiff in a casual chat, but a news anchor says them naturally. (เผยแพร่, คมนาคม, วิกฤตการณ์, ประชามติ)
- **rare**: everything that is not really used in spoken Thai at all. Literary words (mostly found in books and novels), official-document and legal language, announcement and signage formulas, religious words, royal words. Even broadcasters rarely say them; they are encountered in text, or read out from it. (ทว่า, ทันใด, มิฉะนั้น, พระราชกฤษฎีกา, ราชโองการ)

## How to decide (apply the questions in this order)

1. **Would this word inevitably come up in one ordinary day of chatting with a friend?** Yes: `everyday`.
2. **Would a Thai person say this naturally in a casual conversation with friends, without it sounding bookish or stiff?** Yes: `common`.
3. **Even if it is too formal for a chat, would an anchor, host, or guest say it while talking on TV news, radio, or a podcast?** Yes: `occasional`. The word must actually be *said* by someone speaking, with some regularity. Not enough: that it could appear in a news script, or that it gets read out over a loudspeaker.
4. **Otherwise**: `rare`. This is where all predominantly written words go: literary vocabulary, novel and essay language, official and legal terminology, announcement and signage formulas, scripture and monk-register religious vocabulary, royal vocabulary (ราชาศัพท์).

Edge cases:

- **Ubiquity beats register.** The categories measure how often a word is really heard and used in spoken Thai as a whole (chat, service encounters, announcements, TV), not how casual it sounds. A slightly formal word that is everywhere is still `everyday`: สามารถ and ต้องการ are everyday, even though ได้ and อยาก are the more casual synonyms, because a day of Thai life is full of them. Never demote a word merely because a shorter or more casual synonym exists.
- **Demote from everyday only when the word itself is seldom said.** That happens when another word owns the daily slot so this one is displaced in speech (ทีวี displaces โทรทัศน์, ทิชชู่ displaces กระดาษชำระ, เซเว่น displaces ร้านสะดวกซื้อ), or the word is dated or dramatic (ลาก่อน, เหลือเกิน), or textbook-only (งานอดิเรก), or a written connector (จึง). "It is a bit formal" or "it is topical rather than literally daily" are NOT reasons: วัฒนธรรม, เป้าหมาย, สถานที่, ทันที, สำเร็จ all stay everyday.
- **Both directions matter equally.** Lots of words sitting in `common` (and some in `occasional`) are heard constantly and belong in `everyday`. When sweeping those categories, look for promotions just as actively as demotions. When torn between everyday and common for a word you hear all the time, lean everyday.
- **Formal is not the same as written.** Do not demote a word to `rare` just because it is formal; if anchors and hosts really say it, it is `occasional`. Demote it when it is essentially text-only.
- **Religious and royal words are not automatically rare.** Words from religious life that ordinary people say in conversation (ทำบุญ, ใส่บาตร, ไหว้พระ) are judged by the normal spoken tests like any other word. `rare` is for the scripture / ceremony / monk-register and royal-register vocabulary that laypeople recognize but do not say.
- **Slang and crude words** follow the same spoken tests; register (polite vs crude) does not matter, only how often the word is really spoken.
- **When torn between two adjacent categories**, ask: "if I used this word with a Thai friend at dinner, would they find it weird?" and "would I plausibly hear this on the evening news this week?". If it is genuinely borderline, flag it for me instead of silently picking one.

## Procedure

Work through `vocab.json` in batches of 20 words, in deck order. For each word, judge the current `frequency` against the rules above.

- Do **not** edit `vocab.json` yourself. Instead, collect proposals in a working file named `frequency`. Each proposal is one line, with a single blank line between proposals:

  ```
  new-144 เสื่อมโทรม occasional -> rare | 'to deteriorate, to decline, to become run down' | heard in flood/economy TV reports, but mostly report language

  new-157 ทันใด occasional -> rare | 'suddenly, immediately (literary)' | novel narration, nobody says it
  ```

  The proposal line is: the id, the Thai, `current -> proposed`, the gloss in quotes, and a short reason saying where the word actually lives (chat / broadcast / text). Words whose current label is right are simply not listed.

  Name the concrete home in that reason: "anchor copy", "traffic report", "menu", "police report", "song lyric", "notice on a wall". Do not write "written register" as a catch-all, it blurs the one boundary that matters, since a word read out in announcements and a word an anchor actually says land in different categories.

- **How I decide:** I **delete** the lines I do not accept. I write nothing. When I am done, every proposal line still in the file is accepted, so the merge step must apply exactly the lines that remain (extra blank lines left behind by deletions mean nothing).
- After each batch, tell me briefly how many words you checked and how many proposals you added, and continue to the next batch without waiting, unless a batch contains words you flagged as genuinely borderline, in which case stop and ask.
- When the whole deck has been swept, I will go through the `frequency` file typing `y` where I agree, and only then do we apply the accepted lines to `vocab.json` in one merge, like the previous `decisions` batches.
- Frequency is the only thing under review: do not touch glosses, examples, ids, or anything else, and do not use this pass to propose removals or renames. If you notice a different kind of problem, mention it to me separately instead of putting it in the file.
