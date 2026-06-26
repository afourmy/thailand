// Thai flashcards: FSRS-scheduled review over the vocabulary in vocab.json.
//
// Each vocabulary word becomes two independent cards — Thai->English ("t2e")
// and English->Thai ("e2t") — each with its own FSRS state. All progress lives
// in localStorage (no backend, no cross-device sync). Audio follows the visible
// side: the front's language autoplays on render, the back's on reveal, and the
// speaker button replays whichever side is on screen; missing mp3s simply no-op.
//
// Exposes window.FLASHCARDS.init(), called from an inline <script> in
// flashcards.html so the page wires itself up on every SPA visit (the SPA
// loader only loads the .js file once, but inline scripts re-execute).
(function () {
  function init() {
  var DAY = 86400000;
  var DIRS = ["t2e", "e2t"];

  // ── Storage ────────────────────────────────────────────────────────────────
  var STATE_KEY = "thaiFsrsState";
  var CONFIG_KEY = "thaiFsrsConfig";
  var SUSPENDED_KEY = "thaiSuspended";

  function lsGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, v); } catch (e) {}
  }
  function loadJSON(k, fallback) {
    var raw = lsGet(k);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  var states = loadJSON(STATE_KEY, {}); // cardId -> FSRS card state
  var config = loadJSON(CONFIG_KEY, null) || {
    newPerDay: 15,
    direction: "both",
    listening: false,
    typeMode: false,
    day: null,
  };
  config.listening = !!config.listening;
  delete config.excluded; // frequency/topic include-filters were removed
  if (config.direction !== "e2t" && config.direction !== "t2e") config.direction = "both";
  // Type mode: on English→Thai cards, type the Thai (checked against the spelling)
  // instead of just self-rating recall. Migrate the old answerMode dropdown value.
  if (config.typeMode === undefined) config.typeMode = config.answerMode === "type";
  config.typeMode = !!config.typeMode;
  delete config.answerMode;
  // Show examples: when on (default), a revealed card shows its example sentences
  // inline; when off, a bubble icon on the card opens them in a modal instead.
  if (config.showExamples === undefined) config.showExamples = true;
  config.showExamples = !!config.showExamples;

  // Direction filter: which card directions are eligible for the queue and the
  // stat counts. "both" returns the full DIRS list; the others restrict to one.
  function activeDirs() {
    if (config.direction === "e2t") return ["e2t"];
    if (config.direction === "t2e") return ["t2e"];
    return DIRS;
  }

  function saveStates() { lsSet(STATE_KEY, JSON.stringify(states)); }
  function saveConfig() { lsSet(CONFIG_KEY, JSON.stringify(config)); }

  // Per-word indefinite suspension. Keyed by word.id so both directions are
  // suspended together. Shared with the vocabulary page (same key).
  var suspended = loadJSON(SUSPENDED_KEY, {});
  function saveSuspended() { lsSet(SUSPENDED_KEY, JSON.stringify(suspended)); }
  function isSuspended(word) { return suspended[word.id] === true; }

  // Custom decks. Shared with the vocabulary page (same key); the flashcards
  // page only reads/selects, deck creation/renaming lives on vocab. When a
  // custom deck is selected, the review pool is restricted to its members and
  // every stat below reflects only that subset.
  var DECK_KEY = "thaiDecks";
  var ALL_DECK_ID = "all";
  // Built-in dynamic decks defined by frequency. Membership is computed live
  // from each card's current frequency (never stored), so changing a card's
  // frequency or adding cards updates these decks automatically on reload.
  // Kept in sync with the same list in vocab.js.
  var FREQ_DECKS = [
    { id: "freq-beginner", name: "Beginner", freqs: ["everyday"] },
    { id: "freq-lower", name: "Lower Intermediate", freqs: ["everyday", "common"] },
    { id: "freq-upper", name: "Upper Intermediate", freqs: ["common", "occasional"] },
    { id: "freq-advanced", name: "Advanced", freqs: ["occasional", "rare"] },
  ];
  var FREQ_DECK_BY_ID = {};
  FREQ_DECKS.forEach(function (d) { FREQ_DECK_BY_ID[d.id] = d; });
  var deckStore = { decks: {}, order: [], currentId: ALL_DECK_ID };
  function loadDecks() {
    var data = loadJSON(DECK_KEY, null) || {};
    deckStore.decks = data.decks || {};
    deckStore.order = data.order || [];
    deckStore.currentId = data.currentId || "freq-beginner"; // default to the Beginner deck
    if (!deckStore.decks[ALL_DECK_ID]) {
      deckStore.decks[ALL_DECK_ID] = { id: ALL_DECK_ID, name: "All cards", members: {} };
    }
    // Inject the built-in frequency decks fresh (dynamic, never persisted).
    FREQ_DECKS.forEach(function (d) {
      deckStore.decks[d.id] = { id: d.id, name: d.name, members: {}, builtin: true, freqs: d.freqs };
    });
    // Order: All cards, then the frequency decks, then any custom decks.
    var customOrder = deckStore.order.filter(function (id) {
      return id !== ALL_DECK_ID && !FREQ_DECK_BY_ID[id] && deckStore.decks[id];
    });
    deckStore.order = [ALL_DECK_ID]
      .concat(FREQ_DECKS.map(function (d) { return d.id; }))
      .concat(customOrder);
    if (!deckStore.decks[deckStore.currentId]) deckStore.currentId = ALL_DECK_ID;
  }
  function saveDecks() {
    // Persist only user decks; built-in frequency decks are re-injected on load.
    var persist = { decks: {}, order: [], currentId: deckStore.currentId };
    Object.keys(deckStore.decks).forEach(function (id) {
      if (!deckStore.decks[id].builtin) persist.decks[id] = deckStore.decks[id];
    });
    persist.order = deckStore.order.filter(function (id) { return !FREQ_DECK_BY_ID[id]; });
    lsSet(DECK_KEY, JSON.stringify(persist));
  }
  function isFilteringDeck() { return deckStore.currentId !== ALL_DECK_ID; }
  function isCustomDeckSelected() {
    return deckStore.currentId !== ALL_DECK_ID && !FREQ_DECK_BY_ID[deckStore.currentId];
  }
  function deckHasWord(id, word) {
    if (id === ALL_DECK_ID) return true;
    var fd = FREQ_DECK_BY_ID[id];
    if (fd) return fd.freqs.indexOf(word.frequency) !== -1;
    return !!(deckStore.decks[id] && deckStore.decks[id].members[word.id]);
  }
  function passesDeck(word) {
    if (!isFilteringDeck()) return true;
    return deckHasWord(deckStore.currentId, word);
  }
  loadDecks();

  // Local-midnight day key, so a card due "today" rolls over at midnight.
  function dayKey(now) {
    var d = new Date(now || Date.now());
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  // Per-day session bookkeeping: which words were already reviewed today (to
  // bury siblings) and how many new cards have been introduced today.
  function today() {
    var key = dayKey();
    if (!config.day || config.day.key !== key) {
      config.day = { key: key, seen: {}, newCount: 0 };
      saveConfig();
    }
    return config.day;
  }

  // ── DOM ──────────────────────────────────────────────────────────────────
  var $ = function (id) { return document.getElementById(id); };
  var homeEl = $("fc-home");
  var reviewEl = $("fc-review");
  var doneEl = $("fc-done");

  function show(el) {
    [homeEl, reviewEl, doneEl].forEach(function (s) { s.hidden = s !== el; });
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escAttr(s) { return esc(s).replace(/"/g, "&quot;"); }

  // Audio is sharded across 256 subfolders (named "00".."ff") so no folder
  // grows too large. The bucket is a djb2 hash of the word id, so all of a word's
  // clips land together. Mirror of shard() in audio_paths.py / audioShard in vocab.js.
  function audioShard(id) {
    var h = 5381;
    for (var i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
    return ("0" + (h & 0xff).toString(16)).slice(-2);
  }
  // Audio lives on two public GitHub repos served via the jsDelivr CDN, split by
  // shard: shards 00-7f are in thailand-audio-1, 80-ff in thailand-audio-2. A
  // word's clips all share one shard, so they always resolve to the same repo.
  // Keep these constants identical in flashcards.js / vocab.js / audio_paths.py.
  var AUDIO_CDN_1 = "https://cdn.jsdelivr.net/gh/afourmy/thailand-audio-1@main/";
  var AUDIO_CDN_2 = "https://cdn.jsdelivr.net/gh/afourmy/thailand-audio-2@main/";
  function audioBaseFor(id) {
    return parseInt(audioShard(id), 16) < 0x80 ? AUDIO_CDN_1 : AUDIO_CDN_2;
  }

  // ── Example sentences ───────────────────────────────────────────────────────
  // Renders a word's per-meaning example sentences (see vocab.json "examples").
  // Each sentence shows a Thai and an English line, each with its own speaker
  // button. Audio follows a fixed naming convention keyed by word id + meaning
  // index + sentence index; those mp3s don't exist until generated, so the
  // buttons simply no-op (play() rejects) for now. Kept identical in vocab.js.
  var EX_SPEAKER_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
  function exAudioSrc(id, mi, si, en) {
    return audioBaseFor(id) + audioShard(id) + "/" + id + ".ex" + mi + "_" + si + (en ? ".en" : "") + ".mp3";
  }
  // The sentence list for one meaning group (shared by single- and multi-meaning
  // layouts). mi is the meaning index, used to address that group's audio files.
  function exSentencesHtml(g, wordId, mi) {
    var html = '<ul class="ex-list">';
    (g.sentences || []).forEach(function (s, si) {
      var thSrc = escAttr(exAudioSrc(wordId, mi, si, false));
      var enSrc = escAttr(exAudioSrc(wordId, mi, si, true));
      html += '<li class="ex-item">' +
        '<div class="ex-line ex-line--th">' +
          '<button class="ex-play" type="button" data-src="' + thSrc + '" aria-label="Play Thai sentence">' + EX_SPEAKER_SVG + '</button>' +
          '<span class="ex-th" lang="th">' + esc(s.thai || "") + '</span>' +
        '</div>' +
        '<div class="ex-line ex-line--en">' +
          '<button class="ex-play" type="button" data-src="' + enSrc + '" aria-label="Play English sentence">' + EX_SPEAKER_SVG + '</button>' +
          '<span class="ex-en">' + esc(s.en || "") + '</span>' +
        '</div>' +
      '</li>';
    });
    return html + '</ul>';
  }
  // A single meaning fills the frame directly; several meanings share one frame
  // with a tab per meaning (only the active meaning's sentences are shown).
  function buildExamplesHtml(word) {
    var groups = word.examples || [];
    if (!groups.length) return "";
    if (groups.length === 1) {
      return '<div class="ex-block"><div class="ex-meaning">' +
        exSentencesHtml(groups[0], word.id, 0) + '</div></div>';
    }
    var tabs = '<div class="ex-tabs" role="tablist">';
    var panels = '<div class="ex-panels">';
    groups.forEach(function (g, mi) {
      var on = mi === 0;
      var gloss = g.meaning || "";
      tabs += '<button type="button" class="ex-tab' + (on ? ' is-active' : '') +
        '" data-ex-tab="' + mi + '" role="tab" aria-selected="' + on +
        '" title="' + escAttr(gloss) + '"><span class="ex-tab-label">' + esc(gloss) +
        '</span></button>';
      panels += '<div class="ex-panel' + (on ? ' is-active' : '') +
        '" data-ex-panel="' + mi + '" role="tabpanel">' +
        exSentencesHtml(g, word.id, mi) + '</div>';
    });
    tabs += '</div>';
    panels += '</div>';
    return '<div class="ex-block ex-block--tabs">' + tabs + panels + '</div>';
  }
  // Activate the clicked meaning tab and reveal its panel.
  function switchExTab(tab) {
    var block = tab.closest(".ex-block--tabs");
    if (!block) return;
    var idx = tab.getAttribute("data-ex-tab");
    block.querySelectorAll(".ex-tab").forEach(function (t) {
      var on = t === tab;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on);
    });
    block.querySelectorAll(".ex-panel").forEach(function (p) {
      p.classList.toggle("is-active", p.getAttribute("data-ex-panel") === idx);
    });
  }

  // Speaker button for the word itself, by explicit src, played through the same
  // example-audio channel as the modal's sentence buttons. "" when absent.
  function exWordSpeakerBtn(src, label) {
    if (!src) return "";
    return '<button class="ex-play" type="button" data-src="' + escAttr(src) +
      '" aria-label="' + label + '">' + EX_SPEAKER_SVG + '</button>';
  }
  // Modal listing a word's example sentences (used when "Show examples" is off).
  // Closes on backdrop click, the ×, or Escape; mirrors the vocabulary page.
  function openExamplesModal(word) {
    stopExAudio();
    var thSpk = exWordSpeakerBtn(sideAudio(word, true), "Play Thai word");
    var enSpk = exWordSpeakerBtn(sideAudio(word, false), "Play English word");
    var backdrop = document.createElement("div");
    backdrop.className = "vocab-modal-backdrop ex-modal-backdrop";
    backdrop.innerHTML =
      '<div class="vocab-modal ex-modal">' +
        '<button class="ex-modal-close" type="button" aria-label="Close">&times;</button>' +
        '<div class="ex-modal-head">' +
          '<div class="ex-modal-line">' + thSpk + '<span class="ex-modal-thai" lang="th">' + esc(word.thai) + '</span></div>' +
          '<div class="ex-modal-line">' + enSpk + '<span class="ex-modal-en">' + esc(word.english) + '</span></div>' +
        '</div>' +
        buildExamplesHtml(word) +
      '</div>';
    document.body.appendChild(backdrop);
    function close() {
      stopExAudio();
      if (backdrop.parentNode) document.body.removeChild(backdrop);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop || e.target.closest(".ex-modal-close")) { close(); return; }
      var tab = e.target.closest(".ex-tab");
      if (tab) { stopExAudio(); switchExTab(tab); return; }
      var play = e.target.closest(".ex-play");
      if (play) playEx(play);
    });
  }

  // Independent audio channel for example sentences (separate from the card's
  // main speaker so the two never fight over one <audio>).
  var exAudio = null, exBtn = null;
  function stopExAudio() {
    if (exAudio) { exAudio.pause(); exAudio = null; }
    if (exBtn) { exBtn.classList.remove("playing"); exBtn = null; }
  }
  function playEx(btn) {
    var src = btn.getAttribute("data-src");
    if (!src) return;
    stopExAudio();
    exAudio = new Audio(src);
    exBtn = btn;
    btn.classList.add("playing");
    exAudio.addEventListener("ended", stopExAudio);
    exAudio.play().catch(stopExAudio);
  }

  // ── Data + card construction ───────────────────────────────────────────────
  var words = [];
  var wordById = {};
  // mp3 path for one side of a card, or "" if that side's audio wasn't generated.
  function sideAudio(word, thaiSide) {
    var has = thaiSide ? word.audio : word.audio_en;
    return has ? audioBaseFor(word.id) + audioShard(word.id) + "/" + word.id + (thaiSide ? "" : ".en") + ".mp3" : "";
  }

  // Preload a card's Thai + English audio (warm the browser cache) so its
  // autoplay is instant. Only existing files are fetched, each at most once.
  var warmed = {};
  function warmAudio(src) {
    if (!src || warmed[src]) return;
    warmed[src] = true;
    try { fetch(src).catch(function () { warmed[src] = false; }); }
    catch (e) { warmed[src] = false; }
  }
  function preloadCard(id) {
    if (!id) return;
    var info = parseId(id);
    if (!info || !info.word) return;
    warmAudio(sideAudio(info.word, true));   // Thai
    warmAudio(sideAudio(info.word, false));  // English
  }

  function cardId(word, dir) { return word.id + ":" + dir; }
  function getState(id) { return states[id] || window.FSRS.emptyCard(); }

  // The Thai-facing text and prompt/answer for a direction.
  function faces(word, dir) {
    if (dir === "t2e") {
      return { front: word.thai, back: word.english, frontThai: true };
    }
    return { front: word.english, back: word.thai, frontThai: false };
  }

  // ── Type mode ───────────────────────────────────────────────────────────────
  // The Thai field sometimes lists several acceptable spellings, separated by
  // commas or a spaced dash (e.g. "คอย, รอคอย"). Any of them counts as correct.
  function thaiVariants(thai) {
    return thai.split(/,|\s-\s/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }
  function normThai(s) { return (s || "").replace(/\s+/g, ""); }
  // True when the input matches any accepted spelling (ignoring whitespace).
  function isTypedCorrect(input, answer) {
    var inN = normThai(input);
    if (!inN) return false;
    return thaiVariants(answer).map(normThai).some(function (v) { return v === inN; });
  }

  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var ICON_CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // Reset the produce area between cards (hide it, clear the input + icon).
  function resetProduce() {
    var p = $("fc-produce");
    if (p) p.hidden = true;
    var inp = $("fc-type-input");
    if (inp) { inp.value = ""; inp.disabled = false; inp.hidden = true; inp.className = "fc-type-input"; }
    var icon = $("fc-type-icon");
    if (icon) { icon.hidden = true; icon.innerHTML = ""; icon.className = "fc-type-icon"; }
  }

  // ── Queue building ───────────────────────────────────────────────────────
  // One card per word per day (sibling burial). Due cards first (shuffled),
  // then up to the remaining new-card allowance. Excluded words contribute
  // nothing — their cards are effectively suspended until re-included.
  function buildQueue(now) {
    now = now || Date.now();
    var day = today();
    var dueCards = [];
    var newCards = [];

    words.forEach(function (word) {
      if (!passesDeck(word)) return;
      if (isSuspended(word)) return;
      if (day.seen[word.id]) return; // a direction was already done today

      // Among the word's directions, prefer a due card; else offer it as new.
      var dueHere = [];
      var newHere = [];
      activeDirs().forEach(function (dir) {
        var id = cardId(word, dir);
        var st = states[id];
        if (st && st.due != null && st.reps > 0) {
          if (st.due <= now) dueHere.push(id);
        } else {
          newHere.push(id);
        }
      });

      if (dueHere.length) {
        dueCards.push(pick(dueHere));
      } else if (newHere.length) {
        newCards.push(pick(newHere));
      }
    });

    shuffle(dueCards);
    shuffle(newCards);

    var allowance = Math.max(0, config.newPerDay - day.newCount);
    newCards = newCards.slice(0, allowance);

    return { due: dueCards, fresh: newCards, queue: dueCards.concat(newCards) };
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // ── Stats (mirror what Start would build) ──────────────────────────────────
  // Due / New are today's session counts; Left is the deck's remaining unseen
  // pool (cards never reviewed yet, not suspended), which decreases as new cards
  // get introduced. Suspended counts cards hidden via the per-card suspend button.
  function refreshStats() {
    var built = buildQueue();
    pendingQueue = built.queue;   // reused by startSession so the preloaded card matches
    preloadCard(built.queue[0]);  // warm the first card's audio before "Start studying"
    var suspended = 0;
    var left = 0;
    var dirs = activeDirs();
    words.forEach(function (word) {
      // When a custom deck is selected, words outside the deck aren't part of
      // the universe — they don't count as suspended, they're simply invisible.
      if (!passesDeck(word)) return;
      if (isSuspended(word)) {
        suspended += dirs.length;
        return;
      }
      dirs.forEach(function (dir) {
        var st = states[cardId(word, dir)];
        if (!st || st.reps === 0) left += 1;
      });
    });
    homeEl.querySelector('[data-stat="due"]').textContent = built.due.length;
    homeEl.querySelector('[data-stat="new"]').textContent = built.fresh.length;
    homeEl.querySelector('[data-stat="left"]').textContent = left;
    homeEl.querySelector('[data-stat="suspended"]').textContent = suspended;

    var empty = built.queue.length === 0;
    $("fc-start").hidden = empty;
    $("fc-home-note").hidden = !empty;
  }

  // ── Session state ──────────────────────────────────────────────────────────
  var queue = [];
  var pendingQueue = null; // queue built by refreshStats, reused by startSession
  var sessionTotal = 0;
  var reviewed = 0;
  var revealed = false;
  var wordBlurred = false; // listening mode: Thai front is blurred until peeked/revealed
  var curId = null;
  var currentAudio = null;

  function parseId(id) {
    var bits = id.split(":");
    var dir = bits.pop();
    return { word: wordById[bits.join(":")], dir: dir };
  }

  function startSession() {
    queue = pendingQueue ? pendingQueue.slice() : buildQueue().queue;
    sessionTotal = queue.length;
    reviewed = 0;
    if (!queue.length) return finishSession();
    show(reviewEl);
    nextCard();
  }

  function nextCard() {
    if (!queue.length) return finishSession();
    curId = queue.shift();
    revealed = false;
    renderCard();
  }

  function renderCard() {
    var info = parseId(curId);
    var word = info.word;
    var f = faces(word, info.dir);

    var frontEl = $("fc-front");
    var backEl = $("fc-back");
    var cardEl = $("fc-card");
    cardEl.className = "fc-card fc-card--freq-" + word.frequency;
    // Listening mode: blur the Thai prompt (t2e only) so the audio is the cue.
    wordBlurred = config.listening && f.frontThai;
    frontEl.className = "fc-card-face fc-card-front" + (f.frontThai ? " fc-thai" : " fc-en") + (wordBlurred ? " fc-blur" : "");
    frontEl.innerHTML = esc(f.front);
    backEl.className = "fc-card-face fc-card-back" + (f.frontThai ? " fc-en" : " fc-thai");
    backEl.innerHTML = esc(f.back);
    backEl.hidden = true;
    $("fc-divider").hidden = true;

    // Examples are hidden until the answer is revealed; reset any prior card's.
    stopExAudio();
    var exHost = $("fc-examples");
    if (exHost) { exHost.hidden = true; exHost.innerHTML = ""; }
    var exCardBtn = $("fc-ex-card-btn");
    if (exCardBtn) exCardBtn.hidden = true;

    // Speaker reflects the side currently on screen (the front, until reveal).
    var speak = $("fc-speak");
    var frontSrc = sideAudio(word, f.frontThai);
    speak.dataset.src = frontSrc;
    speak.hidden = !frontSrc;

    // Copy: before reveal, copies the visible (front) side; after reveal both
    // sides are visible so copying targets the Thai word (matching vocab Both).
    var copy = $("fc-copy");
    copy.hidden = false;
    copy.classList.remove("copied");
    copy.dataset.front = f.front;
    copy.dataset.thai = word.thai;

    // Type mode: only engages when the answer is Thai (English→Thai cards). On
    // Thai→English cards there's nothing to type, so the normal flow runs.
    resetProduce();
    var producing = config.typeMode && !f.frontThai;
    var showBtn = $("fc-show");
    if (producing) {
      $("fc-produce").hidden = false;
      var inp = $("fc-type-input");
      inp.hidden = false;
      inp.dataset.answer = word.thai;
      showBtn.textContent = "Check";
      // No auto-focus: the keyboard only appears when the user taps the field.
      // Still scroll it into view, since the card can push it below the fold.
      setTimeout(function () { inp.scrollIntoView({ block: "center" }); }, 0);
    } else {
      showBtn.textContent = "Show answer";
    }

    showBtn.hidden = false;
    $("fc-grades").hidden = true;

    updateProgress();

    // Autoplay the front side's audio (Thai for t2e, English for e2t).
    stopAudio();
    if (frontSrc) playAudio();

    // Warm the next card's audio (both files) while this one is on screen.
    preloadCard(queue[0]);
  }

  function suspendCurrent() {
    if (!curId) return;
    var info = parseId(curId);
    suspended[info.word.id] = true;
    saveSuspended();
    stopAudio();
    // Drop the current word's other direction from this session's queue too,
    // so we don't immediately show its sibling.
    var prefix = info.word.id + ":";
    queue = queue.filter(function (id) { return id.indexOf(prefix) !== 0; });
    nextCard();
  }

  function copyCurrent() {
    var btn = $("fc-copy");
    var text = revealed ? btn.dataset.thai : btn.dataset.front;
    if (!text) return;
    function done() {
      btn.classList.add("copied");
      setTimeout(function () { btn.classList.remove("copied"); }, 1000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        fallbackCopy(text); done();
      });
    } else {
      fallbackCopy(text); done();
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  function revealAnswer() {
    if (revealed) return;
    revealed = true;
    if (wordBlurred) { $("fc-front").classList.remove("fc-blur"); wordBlurred = false; }
    $("fc-back").hidden = false;
    $("fc-divider").hidden = false;
    $("fc-show").hidden = true;

    // Type mode: check the spelling against the accepted variants. A blank answer
    // just removes the field (no feedback); otherwise lock it and show a coloured
    // border + a check/cross icon. The grade buttons still appear (check is
    // feedback, not a grade).
    if (config.typeMode && !$("fc-type-input").hidden) {
      var inp = $("fc-type-input");
      if (!inp.value.trim()) {
        resetProduce();
      } else {
        var ok = isTypedCorrect(inp.value, inp.dataset.answer);
        inp.disabled = true;
        inp.blur();
        inp.className = "fc-type-input " + (ok ? "is-correct" : "is-wrong");
        var icon = $("fc-type-icon");
        icon.className = "fc-type-icon " + (ok ? "is-correct" : "is-wrong");
        icon.innerHTML = ok ? ICON_CHECK : ICON_CROSS;
        icon.hidden = false;
      }
    }

    // Fill projected intervals and reveal the grade buttons.
    var preview = window.FSRS.preview(getState(curId));
    var grades = $("fc-grades");
    grades.querySelectorAll(".fc-grade-ivl").forEach(function (span) {
      var g = +span.getAttribute("data-ivl");
      span.textContent = window.FSRS.formatInterval(preview[g]);
    });
    grades.hidden = false;

    // Autoplay the back (answer) side's audio — English for t2e, Thai for e2t —
    // and point the speaker at it so a manual press replays the side now shown.
    var info = parseId(curId);
    var f2 = faces(info.word, info.dir);
    var backSrc = sideAudio(info.word, !f2.frontThai);
    var speak = $("fc-speak");
    speak.dataset.src = backSrc;
    speak.hidden = !backSrc;
    if (backSrc) playAudio();

    // Examples on reveal: with the setting on, render them inline; with it off,
    // surface the card's bubble icon, which opens them in a modal on demand.
    var hasEx = info.word.examples && info.word.examples.length;
    var exHost = $("fc-examples");
    if (exHost) {
      if (hasEx && config.showExamples) {
        exHost.innerHTML = buildExamplesHtml(info.word);
        exHost.hidden = false;
      } else {
        exHost.hidden = true;
        exHost.innerHTML = "";
      }
    }
    var exCardBtn = $("fc-ex-card-btn");
    if (exCardBtn) exCardBtn.hidden = !(hasEx && !config.showExamples);
  }

  function grade(g) {
    if (!revealed) return;
    var info = parseId(curId);
    var prev = states[curId];
    var wasNew = !prev || prev.reps === 0;

    states[curId] = window.FSRS.review(prev, g, Date.now());

    var day = today();
    day.seen[info.word.id] = true; // bury the sibling direction for today
    if (wasNew) day.newCount += 1;
    saveStates();
    saveConfig();

    reviewed += 1;
    // "Again" comes back this session: a few cards later, or at the end.
    if (g === 1) {
      var pos = Math.min(queue.length, 3 + Math.floor(Math.random() * 3));
      queue.splice(pos, 0, curId);
    }
    nextCard();
  }

  // Shown only when the queue empties on its own (nothing left due today).
  function finishSession() {
    var sub = $("fc-done-sub");
    sub.textContent = reviewed
      ? "Reviewed " + reviewed + (reviewed === 1 ? " card." : " cards.")
      : "";
    show(doneEl);
  }

  // Leave the session early (the × button): graded cards are already saved, so
  // just return to the start screen with refreshed counts.
  function goHome() {
    resetProduce();
    stopExAudio();
    refreshStats();
    show(homeEl);
  }

  function updateProgress() {
    var done = sessionTotal - queue.length - 1; // current card not yet graded
    var pct = sessionTotal ? Math.max(0, (done / sessionTotal) * 100) : 0;
    $("fc-progress-bar").style.width = pct + "%";
    $("fc-remaining").textContent = (queue.length + 1) + " left";
  }

  // ── Audio ──────────────────────────────────────────────────────────────────
  function stopAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    $("fc-speak").classList.remove("playing");
  }
  function playAudio() {
    var speak = $("fc-speak");
    var src = speak.dataset.src;
    if (!src) return;
    stopAudio();
    currentAudio = new Audio(src);
    speak.classList.add("playing");
    currentAudio.addEventListener("ended", stopAudio);
    // Missing files (none generated yet) reject silently.
    currentAudio.play().catch(stopAudio);
  }

  // ── Settings UI (stepper) ──────────────────────────────────────────────────
  function wireSettings() {
    var newPerDayEl = $("fc-new-per-day");
    newPerDayEl.value = config.newPerDay;

    // Manual typing: accept any non-negative integer up to 999. Empty/garbage
    // is left untouched while typing (don't snap to 0 mid-edit); blur restores
    // the displayed value to the committed setting.
    newPerDayEl.addEventListener("input", function () {
      var v = parseInt(this.value, 10);
      if (isNaN(v) || v < 0) return;
      if (v > 99999) v = 99999;
      config.newPerDay = v;
      this.value = v;
      saveConfig();
      refreshStats();
    });
    newPerDayEl.addEventListener("blur", function () {
      this.value = config.newPerDay;
    });

    $("fc-settings").addEventListener("click", function (e) {
      var step = e.target.closest("button[data-step]");
      if (step) {
        config.newPerDay = Math.max(0, config.newPerDay + +step.getAttribute("data-step"));
        newPerDayEl.value = config.newPerDay;
        saveConfig();
        refreshStats();
      }
    });
  }

  // ── Deck picker ────────────────────────────────────────────────────────────
  // Populated from the shared store (created/named on the vocab page). Changing
  // the selection re-runs stats so Due / New / Left / Suspended reflect the
  // chosen deck immediately.
  function deckSize(id) {
    if (id === ALL_DECK_ID) return words.length;
    var fd = FREQ_DECK_BY_ID[id];
    if (fd) {
      return words.filter(function (w) { return fd.freqs.indexOf(w.frequency) !== -1; }).length;
    }
    return Object.keys(deckStore.decks[id].members).length;
  }
  function deckOptionLabel(id) {
    var n = deckSize(id);
    return esc(deckStore.decks[id].name) + " (" + n + " card" + (n === 1 ? "" : "s") + ")";
  }
  function renderDeckBar() {
    var sel = $("fc-deck-select");
    sel.innerHTML = deckStore.order.map(function (id) {
      return '<option value="' + esc(id) + '"' +
        (id === deckStore.currentId ? " selected" : "") + ">" +
        deckOptionLabel(id) + "</option>";
    }).join("");
  }
  function wireDeckBar() {
    $("fc-deck-select").addEventListener("change", function (e) {
      var id = e.target.value;
      if (!deckStore.decks[id]) id = ALL_DECK_ID;
      deckStore.currentId = id;
      saveDecks();
      refreshStats();
    });
  }

  // ── Direction picker ──────────────────────────────────────────────────────
  // Restricts the review pool (and the home-screen counts) to one direction or
  // the other, or keeps the default of mixing both.
  function renderDirectionSelect() {
    $("fc-direction-select").value = config.direction;
  }
  function wireDirectionSelect() {
    $("fc-direction-select").addEventListener("change", function (e) {
      var v = e.target.value;
      if (v !== "e2t" && v !== "t2e") v = "both";
      config.direction = v;
      saveConfig();
      refreshStats();
    });
  }

  // ── Listening mode ────────────────────────────────────────────────────────
  // Blurs the Thai prompt on t2e cards so the audio is the only cue; tap to peek.
  function renderListeningToggle() {
    $("fc-listening").checked = config.listening;
  }
  function wireListeningToggle() {
    $("fc-listening").addEventListener("change", function (e) {
      config.listening = e.target.checked;
      saveConfig();
    });
  }

  // Place a tooltip bubble (position: fixed) centred under its icon, then clamp
  // it to the viewport so it never runs off either edge — identical placement on
  // every device, regardless of where the icon sits in its row.
  function positionInfoBubble(info) {
    var bubble = info.querySelector(".fc-info-bubble");
    if (!bubble) return;
    var rect = info.getBoundingClientRect();
    var margin = 8;
    var vw = document.documentElement.clientWidth;
    var bw = bubble.offsetWidth;
    var left = rect.left + rect.width / 2 - bw / 2;
    if (left + bw > vw - margin) left = vw - margin - bw;
    if (left < margin) left = margin;
    bubble.style.left = left + "px";
    bubble.style.top = rect.bottom + 4 + "px";
  }

  // Info tooltips: visibility is CSS-driven (hover/focus on pointer devices,
  // a tap-toggled .show class on touch). These handlers just keep the bubble's
  // fixed position correct on each show. Stashed on window so a later init()
  // can detach the prior handlers (no zombie listeners).
  function wireInfoTooltips() {
    if (window.__fcInfoOver) document.removeEventListener("mouseover", window.__fcInfoOver);
    window.__fcInfoOver = function (e) {
      var info = e.target.closest && e.target.closest(".fc-info");
      if (info) positionInfoBubble(info);
    };
    document.addEventListener("mouseover", window.__fcInfoOver);

    if (window.__fcInfoFocus) document.removeEventListener("focusin", window.__fcInfoFocus);
    window.__fcInfoFocus = function (e) {
      var info = e.target.closest && e.target.closest(".fc-info");
      if (info) positionInfoBubble(info);
    };
    document.addEventListener("focusin", window.__fcInfoFocus);

    if (window.__fcInfoTap) document.removeEventListener("click", window.__fcInfoTap);
    window.__fcInfoTap = function (e) {
      // Touch only; on pointer devices CSS :hover drives the tooltip.
      if (window.matchMedia && !window.matchMedia("(hover: none)").matches) return;
      var btn = e.target.closest(".fc-info");
      var open = document.querySelector(".fc-info.show");
      if (open && open !== btn) open.classList.remove("show");
      if (btn) {
        e.preventDefault();
        var willShow = !btn.classList.contains("show");
        btn.classList.toggle("show");
        if (willShow) positionInfoBubble(btn);
      }
    };
    document.addEventListener("click", window.__fcInfoTap);
  }

  // ── Wiring ───────────────────────────────────────────────────────────────
  function wire() {
    $("fc-start").addEventListener("click", startSession);
    $("fc-home-link").addEventListener("click", goHome);
    $("fc-exit").addEventListener("click", goHome);
    $("fc-show").addEventListener("click", revealAnswer);

    // Tap the card to reveal (mobile-friendly); icon buttons don't reveal.
    $("fc-card").addEventListener("click", function (e) {
      if (e.target.closest("#fc-speak")) { playAudio(); return; }
      if (e.target.closest("#fc-copy")) { copyCurrent(); return; }
      if (e.target.closest("#fc-suspend")) { suspendCurrent(); return; }
      // Listening mode: while blurred, any tap on the card just peeks (un-blurs);
      // the next tap falls through to the normal reveal. (Show answer reveals
      // directly for anyone who wants to skip the peek.)
      if (wordBlurred) {
        $("fc-front").classList.remove("fc-blur");
        wordBlurred = false;
        return;
      }
      if (!revealed) revealAnswer();
    });

    $("fc-grades").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-grade]");
      if (btn) grade(+btn.getAttribute("data-grade"));
    });

    // Inline example sentences: meaning tabs + per-sentence speaker buttons.
    $("fc-examples").addEventListener("click", function (e) {
      var tab = e.target.closest(".ex-tab");
      if (tab) { stopExAudio(); switchExTab(tab); return; }
      var play = e.target.closest(".ex-play");
      if (play) playEx(play);
    });

    // Examples bubble on the card (shown when "Show examples" is off): opens the
    // word's example sentences in a modal.
    $("fc-ex-card-btn").addEventListener("click", function () {
      var info = parseId(curId);
      if (info && info.word) openExamplesModal(info.word);
    });

    // Type mode: no feedback while typing; Enter checks (reveals).
    $("fc-type-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !revealed) { e.preventDefault(); revealAnswer(); }
    });

    // Keyboard: space/enter reveals, 1-4 grade (desktop convenience).
    // Stashed on window so a subsequent init() (after SPA revisit) can detach
    // the prior closure's handler before installing the new one — otherwise
    // zombie listeners pile up and can fire on detached DOM.
    if (window.__fcKeydown) document.removeEventListener("keydown", window.__fcKeydown);
    window.__fcKeydown = function (e) {
      if (reviewEl.hidden) return;
      // An open examples modal owns the keyboard (its own Escape handler closes it).
      if (document.querySelector(".ex-modal-backdrop")) return;
      // While typing Thai, let the field own every key (space/Enter handled there).
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        revealAnswer();
      } else if (revealed && e.key >= "1" && e.key <= "4") {
        grade(+e.key);
      }
    };
    document.addEventListener("keydown", window.__fcKeydown);
  }

  // ── Type-mode setting ───────────────────────────────────────────────────────
  function renderTypeToggle() {
    $("fc-type-mode").checked = config.typeMode;
  }
  function wireTypeToggle() {
    $("fc-type-mode").addEventListener("change", function (e) {
      config.typeMode = e.target.checked;
      saveConfig();
    });
  }

  // ── Show-examples setting ────────────────────────────────────────────────────
  function renderExamplesToggle() {
    $("fc-show-examples").checked = config.showExamples;
  }
  function wireExamplesToggle() {
    $("fc-show-examples").addEventListener("change", function (e) {
      config.showExamples = e.target.checked;
      saveConfig();
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  var thisScript = document.querySelector('script[src$="flashcards.js"]');
  var dataUrl = thisScript ? new URL("vocab.json", thisScript.src).href : "vocab.json";

  fetch(dataUrl)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      words = data;
      words.forEach(function (w) { wordById[w.id] = w; });
      renderDeckBar();
      renderDirectionSelect();
      renderListeningToggle();
      renderTypeToggle();
      renderExamplesToggle();
      wireSettings();
      wireDeckBar();
      wireDirectionSelect();
      wireListeningToggle();
      wireTypeToggle();
      wireExamplesToggle();
      wireInfoTooltips();
      wire();
      refreshStats();
      show(homeEl);
    })
    .catch(function () {
      homeEl.hidden = false;
      homeEl.innerHTML = '<p class="vocab-empty">Could not load vocabulary data.</p>';
    });
  }

  window.FLASHCARDS = { init: init };
})();
