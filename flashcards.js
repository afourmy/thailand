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

  // ── Labels (kept in step with vocab.js) ───────────────────────────────────
  var FREQ_ORDER = ["everyday", "common", "occasional", "rare"];
  var FREQ_LABEL = {
    everyday: "Everyday",
    common: "Common",
    occasional: "Occasional",
    rare: "Rare",
  };
  var TOPIC_LABEL = {
    personality: "Personality", emotions: "Emotions", family: "Family",
    health: "Health", general: "General", grammar: "Grammar",
    expressions: "Expressions", time: "Time", culture: "Culture",
    beliefs: "Beliefs", monarchy: "Monarchy", nature: "Nature",
    law: "Legal", economy: "Economy", transport: "Transport",
    weather: "Weather", travel: "Travel", food: "Food",
    slang: "Slang",
  };

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
    excluded: { frequency: { rare: true, occasional: true }, topic: {} },
    day: null,
  };
  config.excluded = config.excluded || { frequency: {}, topic: {} };
  config.excluded.frequency = config.excluded.frequency || {};
  config.excluded.topic = config.excluded.topic || {};
  if (config.direction !== "e2t" && config.direction !== "t2e") config.direction = "both";

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

  // ── Data + card construction ───────────────────────────────────────────────
  var words = [];
  var wordById = {};
  var audioBase = "audio/";
  // mp3 path for one side of a card, or "" if that side's audio wasn't generated.
  function sideAudio(word, thaiSide) {
    var has = thaiSide ? word.audio : word.audio_en;
    return has ? audioBase + word.id + (thaiSide ? "" : ".en") + ".mp3" : "";
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

  function isExcluded(word) {
    return (
      config.excluded.frequency[word.frequency] === true ||
      config.excluded.topic[word.topic] === true
    );
  }

  // The Thai-facing text and prompt/answer for a direction.
  function faces(word, dir) {
    if (dir === "t2e") {
      return { front: word.thai, back: word.english, frontThai: true };
    }
    return { front: word.english, back: word.thai, frontThai: false };
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
      if (isExcluded(word) || isSuspended(word)) return;
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
  // pool (cards never reviewed yet that aren't excluded), which decreases as
  // new cards get introduced. Excluded counts what filters hide right now.
  function refreshStats() {
    var built = buildQueue();
    pendingQueue = built.queue;   // reused by startSession so the preloaded card matches
    preloadCard(built.queue[0]);  // warm the first card's audio before "Start studying"
    var excluded = 0;
    var left = 0;
    var dirs = activeDirs();
    words.forEach(function (word) {
      // When a custom deck is selected, words outside the deck aren't part of
      // the universe — they don't count as excluded, they're simply invisible.
      if (!passesDeck(word)) return;
      if (isExcluded(word) || isSuspended(word)) {
        excluded += dirs.length;
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
    homeEl.querySelector('[data-stat="excluded"]').textContent = excluded;

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
    frontEl.className = "fc-card-face fc-card-front" + (f.frontThai ? " fc-thai" : " fc-en");
    frontEl.innerHTML = esc(f.front);
    backEl.className = "fc-card-face fc-card-back" + (f.frontThai ? " fc-en" : " fc-thai");
    backEl.innerHTML = esc(f.back);
    backEl.hidden = true;
    $("fc-divider").hidden = true;

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

    $("fc-show").hidden = false;
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
    $("fc-back").hidden = false;
    $("fc-divider").hidden = false;
    $("fc-show").hidden = true;

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

  // ── Settings UI (chips, stepper, font) ─────────────────────────────────────
  function presentTopics() {
    var counts = {};
    words.forEach(function (w) { counts[w.topic] = (counts[w.topic] || 0) + 1; });
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
  }

  function chipClass(dim, key, included) {
    if (!included) return "fc-chip fc-chip--off";
    return dim === "frequency" ? "fc-chip tag-freq freq-" + key : "fc-chip tag-topic";
  }

  function buildChips() {
    homeEl.querySelectorAll(".fc-chips").forEach(function (box) {
      var dim = box.getAttribute("data-dim");
      var keys = dim === "frequency"
        ? FREQ_ORDER.filter(function (k) { return words.some(function (w) { return w.frequency === k; }); })
        : presentTopics();
      var labelOf = dim === "frequency"
        ? function (k) { return FREQ_LABEL[k] || k; }
        : function (k) { return TOPIC_LABEL[k] || k; };
      box.innerHTML = keys.map(function (key) {
        var included = config.excluded[dim][key] !== true;
        return '<button type="button" class="' + chipClass(dim, key, included) +
          '" data-key="' + esc(key) + '">' + esc(labelOf(key)) + "</button>";
      }).join("");
    });
  }

  function setChip(dim, key, included) {
    if (included) delete config.excluded[dim][key];
    else config.excluded[dim][key] = true;
  }

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
        return;
      }

      var chip = e.target.closest(".fc-chip");
      if (chip) {
        var box = chip.closest(".fc-chips");
        var dim = box.getAttribute("data-dim");
        var key = chip.getAttribute("data-key");
        var included = config.excluded[dim][key] === true; // currently off -> turn on
        setChip(dim, key, included);
        chip.className = chipClass(dim, key, included);
        saveConfig();
        refreshStats();
        return;
      }

      var bulk = e.target.closest("button[data-bulk]");
      if (bulk) {
        // Bulk pills live inside <summary>; suppress the default toggle so the
        // collapsible filter stays in its current open/closed state.
        e.preventDefault();
        var group = bulk.closest(".fc-setting");
        var dim2 = group.getAttribute("data-dim");
        var on = bulk.getAttribute("data-bulk") === "all";
        group.querySelectorAll(".fc-chip").forEach(function (c) {
          setChip(dim2, c.getAttribute("data-key"), on);
          c.className = chipClass(dim2, c.getAttribute("data-key"), on);
        });
        saveConfig();
        refreshStats();
        return;
      }

    });
  }

  // ── Deck picker ────────────────────────────────────────────────────────────
  // Populated from the shared store (created/named on the vocab page). Changing
  // the selection re-runs stats so Due / New / Left / Excluded reflect the
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
      if (!revealed) revealAnswer();
    });

    $("fc-grades").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-grade]");
      if (btn) grade(+btn.getAttribute("data-grade"));
    });

    // Keyboard: space/enter reveals, 1-4 grade (desktop convenience).
    // Stashed on window so a subsequent init() (after SPA revisit) can detach
    // the prior closure's handler before installing the new one — otherwise
    // zombie listeners pile up and can fire on detached DOM.
    if (window.__fcKeydown) document.removeEventListener("keydown", window.__fcKeydown);
    window.__fcKeydown = function (e) {
      if (reviewEl.hidden) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        revealAnswer();
      } else if (revealed && e.key >= "1" && e.key <= "4") {
        grade(+e.key);
      }
    };
    document.addEventListener("keydown", window.__fcKeydown);
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  var thisScript = document.querySelector('script[src$="flashcards.js"]');
  var dataUrl = thisScript ? new URL("vocab.json", thisScript.src).href : "vocab.json";
  audioBase = thisScript ? new URL("audio/", thisScript.src).href : "audio/";

  fetch(dataUrl)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      words = data;
      words.forEach(function (w) { wordById[w.id] = w; });
      buildChips();
      renderDeckBar();
      renderDirectionSelect();
      wireSettings();
      wireDeckBar();
      wireDirectionSelect();
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
