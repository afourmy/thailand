// Exposes window.VOCAB.init(), called from an inline <script> in vocab.html so
// the page wires itself up on every SPA visit (the script tag is only loaded
// once by the SPA router, but inline scripts re-execute on each navigation).
(function () {
  function init() {
  var groupsEl = document.getElementById("vocab-groups");
  var countEl = document.getElementById("vocab-count");
  var searchEl = document.getElementById("vocab-search");
  var filterEl = document.getElementById("vocab-filter");
  var faceToggleEl = document.getElementById("face-toggle");
  var audioToggleEl = document.getElementById("audio-toggle");

  var words = [];
  var loaded = false;
  var mode = "frequency"; // grouping axis: always frequency (topic grouping was removed)
  // Independent visibility filters per dimension: { key: bool }. Built (all on)
  // once on load and kept while regrouping. Not saved to localStorage.
  var filters = { frequency: {}, topic: {} };
  var query = "";
  var face = "both"; // "both" | "thai" | "english"
  var AUDIO_LANG_KEY = "thaiAudioLang";
  var audioLang = "th"; // "th" | "en": which language the speaker button plays

  var FREQ_ORDER = ["everyday", "common", "occasional", "rare"];
  var FREQ_LABEL = {
    everyday: "Everyday",
    common: "Common",
    occasional: "Occasional",
    rare: "Rare",
  };
  var TOPIC_LABEL = {
    personality: "Personality",
    emotions: "Emotions",
    family: "Family",
    health: "Health",
    general: "General",
    grammar: "Grammar",
    expressions: "Expressions",
    time: "Time",
    culture: "Culture",
    beliefs: "Beliefs",
    monarchy: "Monarchy",
    nature: "Nature",
    law: "Legal",
    economy: "Economy",
    transport: "Transport",
    weather: "Weather",
    travel: "Travel",
    food: "Food",
    slang: "Slang",
  };

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escAttr(s) {
    return esc(s).replace(/"/g, "&quot;");
  }

  // Audio is sharded across 256 subfolders of audio/ (named "00".."ff") so no folder
  // grows too large. The bucket is a djb2 hash of the word id, so all of a word's
  // clips land together. Mirror of shard() in audio_paths.py / audioShard in flashcards.js.
  function audioShard(id) {
    var h = 5381;
    for (var i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
    return ("0" + (h & 0xff).toString(16)).slice(-2);
  }
  function wordAudioUrl(base, id, en) {
    return base + audioShard(id) + "/" + id + (en ? ".en" : "") + ".mp3";
  }

  // Small copy-to-clipboard control overlaid on flashcards (front shows a copy
  // glyph, switches to a check briefly after a successful copy via .copied).
  var COPY_BTN =
    '<button class="vocab-copy" type="button" aria-label="Copy word" title="Copy word">' +
    '<svg class="vocab-copy-i vocab-copy-i--copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
    '<svg class="vocab-copy-i vocab-copy-i--check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
    "</button>";

  // Suspend control: toggles indefinite suspension on the word. A suspended
  // card stays visible on this page with a soft-red background; the flashcards
  // page skips it. Shared state lives at localStorage["thaiSuspended"].
  // TRANSIENT (deck-review aid): the suspend button currently copies "<id> <thai>"
  // to the clipboard instead of suspending (see the handler). Restore aria-label
  // "Suspend word" / title "Suspend / Unsuspend" when reverting.
  var SUSPEND_BTN =
    '<button class="vocab-suspend" type="button" aria-label="Copy card ID + Thai" title="Copy card ID + Thai">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/></svg>' +
    "</button>";

  // Deck add/remove control: rendered only when a custom deck is selected.
  // The .in-deck modifier swaps the visible plus icon for a minus icon.
  var DECK_BTN_ADD_SVG =
    '<svg class="vocab-deck-i vocab-deck-i--add" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var DECK_BTN_REMOVE_SVG =
    '<svg class="vocab-deck-i vocab-deck-i--remove" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';

  // Speaker control: plays the word's Thai pronunciation (audio is Thai-only),
  // rendered only for words with a generated mp3 (see speakerBtn / word.audio).
  var SPEAKER_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';

  // Examples control: opens a modal with the word's example sentences, rendered
  // only for words that have an "examples" array in vocab.json.
  var EX_BTN_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  var currentAudio = null;
  var playingBtn = null;
  function stopAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (playingBtn) {
      playingBtn.classList.remove("playing");
      playingBtn = null;
    }
  }
  function playAudio(btn) {
    var th = btn.getAttribute("data-audio-th");
    var en = btn.getAttribute("data-audio-en");
    // Play the selected language, falling back to the other if it is missing.
    var src = audioLang === "en" ? (en || th) : (th || en);
    if (!src) return;
    stopAudio();
    currentAudio = new Audio(src);
    playingBtn = btn;
    btn.classList.add("playing");
    currentAudio.addEventListener("ended", stopAudio);
    currentAudio.play().catch(stopAudio);
  }

  // Play a single example-sentence file by its explicit src (one language at a
  // time), reusing the same audio channel + .playing highlight as the word
  // speaker so only one clip ever plays.
  function playExSrc(btn) {
    var src = btn.getAttribute("data-src");
    if (!src) return;
    stopAudio();
    currentAudio = new Audio(src);
    playingBtn = btn;
    btn.classList.add("playing");
    currentAudio.addEventListener("ended", stopAudio);
    currentAudio.play().catch(stopAudio);
  }

  // ── Example sentences ───────────────────────────────────────────────────────
  // Renders a word's per-meaning example sentences (see vocab.json "examples").
  // Each sentence shows a Thai and an English line, each with its own speaker
  // button. Audio follows a fixed naming convention keyed by word id + meaning
  // index + sentence index; those mp3s don't exist until generated, so the
  // buttons simply no-op (play() rejects) for now. Kept identical in flashcards.js.
  function exAudioSrc(base, id, mi, si, en) {
    return base + audioShard(id) + "/" + id + ".ex" + mi + "_" + si + (en ? ".en" : "") + ".mp3";
  }
  function buildExamplesHtml(word, base) {
    var groups = word.examples || [];
    if (!groups.length) return "";
    var multi = groups.length > 1;
    var html = '<div class="ex-block">';
    groups.forEach(function (g, mi) {
      html += '<div class="ex-meaning">';
      if (multi) {
        html += '<div class="ex-meaning-head">' +
          '<span class="ex-meaning-num">' + (mi + 1) + '</span>' +
          '<span class="ex-meaning-gloss">' + esc(g.meaning || "") + '</span>' +
          '</div>';
      }
      html += '<ul class="ex-list">';
      (g.sentences || []).forEach(function (s, si) {
        var thSrc = escAttr(exAudioSrc(base, word.id, mi, si, false));
        var enSrc = escAttr(exAudioSrc(base, word.id, mi, si, true));
        html += '<li class="ex-item">' +
          '<div class="ex-line ex-line--th">' +
            '<button class="ex-play" type="button" data-src="' + thSrc + '" aria-label="Play Thai sentence">' + SPEAKER_SVG + '</button>' +
            '<span class="ex-th" lang="th">' + esc(s.thai || "") + '</span>' +
          '</div>' +
          '<div class="ex-line ex-line--en">' +
            '<button class="ex-play" type="button" data-src="' + enSrc + '" aria-label="Play English sentence">' + SPEAKER_SVG + '</button>' +
            '<span class="ex-en">' + esc(s.en || "") + '</span>' +
          '</div>' +
        '</li>';
      });
      html += '</ul></div>';
    });
    return html + '</div>';
  }

  // Modal listing the word's example sentences. Closes on backdrop click, the ×,
  // or Escape; sentence speaker buttons play through playExSrc.
  // Speaker button for a word's own pronunciation, by explicit src (so it plays
  // through the same channel as the example buttons). "" when that file is absent.
  function wordSpeakerBtn(src, label) {
    if (!src) return "";
    return '<button class="ex-play" type="button" data-src="' + escAttr(src) +
      '" aria-label="' + label + '">' + SPEAKER_SVG + "</button>";
  }

  function openExamplesModal(word) {
    stopAudio();
    var thSpk = wordSpeakerBtn(word.audio ? wordAudioUrl(audioBase, word.id, false) : "", "Play Thai word");
    var enSpk = wordSpeakerBtn(word.audio_en ? wordAudioUrl(audioBase, word.id, true) : "", "Play English word");
    var backdrop = document.createElement("div");
    backdrop.className = "vocab-modal-backdrop ex-modal-backdrop";
    backdrop.innerHTML =
      '<div class="vocab-modal ex-modal">' +
        '<button class="ex-modal-close" type="button" aria-label="Close">&times;</button>' +
        '<div class="ex-modal-head">' +
          '<div class="ex-modal-line">' + thSpk + '<span class="ex-modal-thai" lang="th">' + esc(word.thai) + '</span></div>' +
          '<div class="ex-modal-line">' + enSpk + '<span class="ex-modal-en">' + esc(word.english) + '</span></div>' +
        '</div>' +
        buildExamplesHtml(word, audioBase) +
      '</div>';
    document.body.appendChild(backdrop);
    function close() {
      stopAudio();
      if (backdrop.parentNode) document.body.removeChild(backdrop);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop || e.target.closest(".ex-modal-close")) { close(); return; }
      var play = e.target.closest(".ex-play");
      if (play) playExSrc(play);
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function copyText(text, btn) {
    function done() {
      btn.classList.add("copied");
      setTimeout(function () {
        btn.classList.remove("copied");
      }, 1000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        fallbackCopy(text);
        done();
      });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  // Suspended-words state (shared with flashcards page). { wordId: true }.
  var SUSPENDED_KEY = "thaiSuspended";
  var suspended = {};
  function loadSuspended() {
    var raw = lsGet(SUSPENDED_KEY);
    if (!raw) return {};
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }
  function saveSuspended() {
    lsSet(SUSPENDED_KEY, JSON.stringify(suspended));
  }
  function isSuspended(word) { return suspended[word.id] === true; }

  // ── Custom decks ──────────────────────────────────────────────────────────
  // User-curated subsets of the vocabulary. The default "All cards" deck
  // implicitly contains every word (no membership map needed, no visual mark).
  // Custom decks track members by wordId; cards in the currently selected
  // custom deck get a green background and a minus button (instead of plus).
  // Persisted at localStorage["thaiDecks"].
  var DECK_KEY = "thaiDecks";
  var ALL_DECK_ID = "all";
  // Built-in dynamic decks defined by frequency. Membership is computed live
  // from each card's current frequency (never stored), so changing a card's
  // frequency or adding cards updates these decks automatically on reload.
  var FREQ_DECKS = [
    { id: "freq-beginner", name: "Beginner", freqs: ["everyday"] },
    { id: "freq-lower", name: "Lower Intermediate", freqs: ["everyday", "common"] },
    { id: "freq-upper", name: "Upper Intermediate", freqs: ["common", "occasional"] },
    { id: "freq-advanced", name: "Advanced", freqs: ["occasional", "rare"] },
  ];
  var FREQ_DECK_BY_ID = {};
  FREQ_DECKS.forEach(function (d) { FREQ_DECK_BY_ID[d.id] = d; });
  var decks = {};
  var deckOrder = [];
  var currentDeckId = ALL_DECK_ID;
  var deckOnly = true; // when true, hide cards not in the current custom deck; on by default

  function loadDecks() {
    var raw = lsGet(DECK_KEY);
    var data = null;
    if (raw) { try { data = JSON.parse(raw); } catch (e) { data = null; } }
    data = data || {};
    decks = data.decks || {};
    deckOrder = data.order || [];
    currentDeckId = data.currentId || "freq-beginner"; // default to the Beginner deck
    deckOnly = data.deckOnly !== false; // default on; only an explicit save of false disables it
    if (!decks[ALL_DECK_ID]) {
      decks[ALL_DECK_ID] = { id: ALL_DECK_ID, name: "All cards", members: {} };
    }
    // Inject the built-in frequency decks fresh (dynamic, never persisted).
    FREQ_DECKS.forEach(function (d) {
      decks[d.id] = { id: d.id, name: d.name, members: {}, builtin: true, freqs: d.freqs };
    });
    // Order: All cards, then the frequency decks, then any custom decks.
    var customOrder = deckOrder.filter(function (id) {
      return id !== ALL_DECK_ID && !FREQ_DECK_BY_ID[id] && decks[id];
    });
    deckOrder = [ALL_DECK_ID]
      .concat(FREQ_DECKS.map(function (d) { return d.id; }))
      .concat(customOrder);
    if (!decks[currentDeckId]) currentDeckId = ALL_DECK_ID;
  }
  function saveDecks() {
    // Persist only user decks; built-in frequency decks are re-injected on load.
    var persistDecks = {};
    Object.keys(decks).forEach(function (id) {
      if (!decks[id].builtin) persistDecks[id] = decks[id];
    });
    lsSet(DECK_KEY, JSON.stringify({
      decks: persistDecks,
      order: deckOrder.filter(function (id) { return !FREQ_DECK_BY_ID[id]; }),
      currentId: currentDeckId,
      deckOnly: deckOnly,
    }));
  }
  // "Custom" = an editable user deck (not All cards, not a built-in freq deck).
  function isCustomDeckSelected() {
    return currentDeckId !== ALL_DECK_ID && !FREQ_DECK_BY_ID[currentDeckId];
  }
  // Any deck that narrows the visible set (custom or frequency).
  function isFilteringDeck() { return currentDeckId !== ALL_DECK_ID; }
  function isInCurrentDeck(word) { // custom membership; drives the green +/- cue
    return isCustomDeckSelected() && decks[currentDeckId].members[word.id] === true;
  }
  // Membership used for filtering the view, including dynamic frequency decks.
  function deckHasWord(id, word) {
    if (id === ALL_DECK_ID) return true;
    var fd = FREQ_DECK_BY_ID[id];
    if (fd) return fd.freqs.indexOf(word.frequency) !== -1;
    return !!(decks[id] && decks[id].members[word.id]);
  }

  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }

  function matches(word) {
    if (!query) return true;
    var q = query.toLowerCase();
    return (
      word.thai.indexOf(query) !== -1 ||
      word.english.toLowerCase().indexOf(q) !== -1
    );
  }

  function thaiHtml(word, extra) {
    return '<div class="vocab-thai' + (extra || "") + '">' + esc(word.thai) + "</div>";
  }
  function enHtml(word, extra) {
    return '<div class="vocab-en' + (extra || "") + '">' + esc(word.english) + "</div>";
  }

  function speakerBtn(word) {
    if (!word.audio && !word.audio_en) return ""; // only where an mp3 exists
    var th = word.audio ? escAttr(wordAudioUrl(audioBase, word.id, false)) : "";
    var en = word.audio_en ? escAttr(wordAudioUrl(audioBase, word.id, true)) : "";
    return (
      '<button class="vocab-speak" type="button" aria-label="Play pronunciation"' +
      ' title="Play pronunciation" data-audio-th="' + th + '" data-audio-en="' + en + '">' +
      SPEAKER_SVG +
      "</button>"
    );
  }

  function deckBtnHtml(word) {
    if (!isCustomDeckSelected()) return "";
    var inDeck = isInCurrentDeck(word);
    var cls = "vocab-deck-btn" + (inDeck ? " in-deck" : "");
    var label = inDeck ? "Remove from deck" : "Add to deck";
    return (
      '<button class="' + cls + '" type="button" aria-label="' + label +
      '" title="' + label + '">' +
      DECK_BTN_ADD_SVG + DECK_BTN_REMOVE_SVG + "</button>"
    );
  }

  function exBtn(word) {
    if (!word.examples || !word.examples.length) return "";
    return (
      '<button class="vocab-ex-btn" type="button" aria-label="Example sentences"' +
      ' title="Example sentences">' + EX_BTN_SVG + "</button>"
    );
  }

  function toolsHtml(word) {
    return '<div class="vocab-tools">' + speakerBtn(word) + exBtn(word) + COPY_BTN + SUSPEND_BTN + deckBtnHtml(word) + '</div>';
  }

  function cardClasses(word, extra) {
    // Suspended (red) wins visually over in-deck (green); we just skip the
    // in-deck class on suspended cards so CSS ordering is irrelevant.
    var sus = isSuspended(word);
    return (
      "vocab-card" +
      (extra || "") +
      " vocab-card--freq-" + word.frequency +
      (sus ? " vocab-card--suspended" : "") +
      (!sus && isInCurrentDeck(word) ? " vocab-card--in-deck" : "")
    );
  }

  function card(word) {
    if (face === "both") {
      return (
        '<div class="' + cardClasses(word) + '" data-id="' + escAttr(word.id) +
        '" data-copy="' + escAttr(word.thai) + '">' +
        '<div class="vocab-body">' + thaiHtml(word) + enHtml(word) + '</div>' +
        toolsHtml(word) +
        "</div>"
      );
    }
    var front = face === "thai" ? thaiHtml(word) : enHtml(word, " vocab-prompt");
    var back =
      face === "thai"
        ? enHtml(word, " vocab-answer")
        : thaiHtml(word, " vocab-answer");
    var frontInner = '<div class="vocab-body">' + front + '</div>';
    var backInner  = '<div class="vocab-body">' + back + '</div>';
    var frontText = face === "thai" ? word.thai : word.english;
    var backText = face === "thai" ? word.english : word.thai;
    var tools = toolsHtml(word);
    return (
      '<div class="' + cardClasses(word, " vocab-card--flip") +
      '" data-id="' + escAttr(word.id) +
      '" data-front="' + escAttr(frontText) +
      '" data-back="' + escAttr(backText) +
      '">' +
      '<div class="vocab-flip-rotor">' +
        '<div class="vocab-face vocab-face--front">' + frontInner + tools + "</div>" +
        '<div class="vocab-face vocab-face--back">'  + backInner  + tools + "</div>" +
      "</div>" +
      '<div class="vocab-flip-ghost" aria-hidden="true">' +
        '<div class="vocab-face">' + frontInner + tools + "</div>" +
        '<div class="vocab-face">' + backInner  + tools + "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function buildGroups(list) {
    var buckets = {};
    list.forEach(function (word) {
      var key = mode === "frequency" ? word.frequency : word.topic;
      (buckets[key] = buckets[key] || []).push(word);
    });

    var keys;
    if (mode === "frequency") {
      keys = FREQ_ORDER.filter(function (k) {
        return buckets[k];
      });
    } else {
      // Topics ordered by size, largest first.
      keys = Object.keys(buckets).sort(function (a, b) {
        return buckets[b].length - buckets[a].length;
      });
    }

    return keys.map(function (key) {
      var label =
        mode === "frequency" ? FREQ_LABEL[key] : TOPIC_LABEL[key] || key;
      return { key: key, label: label, items: buckets[key] };
    });
  }

  // Distinct keys present for a dimension, in chip order: frequencies in
  // canonical order, topics largest-first (matching how topic mode sections).
  function keysForDim(dim) {
    if (dim === "frequency") {
      var present = {};
      words.forEach(function (word) {
        present[word.frequency] = true;
      });
      return FREQ_ORDER.filter(function (k) {
        return present[k];
      });
    }
    var counts = {};
    words.forEach(function (word) {
      counts[word.topic] = (counts[word.topic] || 0) + 1;
    });
    return Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    });
  }

  function labelForDim(dim, key) {
    return dim === "frequency"
      ? FREQ_LABEL[key] || key
      : TOPIC_LABEL[key] || key;
  }

  function chipColorClass(dim, key) {
    return dim === "frequency" ? "tag-freq freq-" + key : "tag-topic";
  }

  // A selected chip wears its tag color; a deselected one is muted.
  function applyChipState(btn, dim, on) {
    btn.className = on
      ? "vocab-chip " + chipColorClass(dim, btn.getAttribute("data-key"))
      : "vocab-chip vocab-chip--off";
  }

  // Build both chip rows (frequency and topic) from the data, all selected.
  function buildFilterBar() {
    filterEl.querySelectorAll(".vocab-filter-group[data-dim]").forEach(function (group) {
      var dim = group.getAttribute("data-dim");
      filters[dim] = {};
      group.querySelector(".vocab-filter-chips").innerHTML = keysForDim(dim)
        .map(function (key) {
          filters[dim][key] = true;
          return (
            '<button type="button" class="vocab-chip ' +
            chipColorClass(dim, key) +
            '" data-key="' +
            escAttr(key) +
            '">' +
            esc(labelForDim(dim, key)) +
            "</button>"
          );
        })
        .join("");
    });
  }

  // Shown only if both its frequency and its topic are still selected, and
  // (when "Only show deck cards" is on) the word is in the current custom deck.
  function passesFilter(word) {
    if (deckOnly && isFilteringDeck() && !deckHasWord(currentDeckId, word)) return false;
    return (
      filters.frequency[word.frequency] !== false &&
      filters.topic[word.topic] !== false
    );
  }

  // Lazy materialization: each group renders only its header + an empty,
  // height-reserved card container; the cards themselves are built on demand
  // when the group nears the viewport. Keeps the DOM small even with ~10k
  // entries, so search/filter re-renders stay snappy.
  var currentGroups = [];
  var currentList = [];
  var groupObserver = null;

  function teardownObserver() {
    if (groupObserver) {
      groupObserver.disconnect();
      groupObserver = null;
    }
  }

  function estimateGroupHeight(count) {
    var containerW = groupsEl.clientWidth || window.innerWidth || 800;
    var gap = 13; // ~0.8rem
    var minCol = 200;
    var cols = Math.max(1, Math.floor((containerW + gap) / (minCol + gap)));
    var rows = Math.ceil(count / cols);
    return rows * 92; // ~card height incl. gap
  }

  function materializeGroup(container) {
    if (container.dataset.materialized) return;
    var idx = parseInt(container.dataset.gi, 10);
    var items = currentGroups[idx] && currentGroups[idx].items;
    if (!items) return;
    container.innerHTML = items.map(card).join("");
    container.style.minHeight = "";
    container.dataset.materialized = "1";
  }

  // Drop a single card from the current view in place (quick fade, then remove)
  // instead of a full render(). Used when a card leaves the deck while "Only
  // show deck cards" is on — a full re-render would blank and rebuild the whole
  // list. Keeps currentList/currentGroups, the total count, and the group count
  // badge in sync, and clears the group/list if they become empty.
  function dropCardFromView(cardEl, wordId) {
    var section = cardEl.closest(".vocab-group");
    var container = cardEl.parentNode;
    cardEl.style.transition = "opacity 140ms ease";
    cardEl.style.opacity = "0";
    cardEl.style.pointerEvents = "none";
    setTimeout(function () {
      cardEl.remove();
      if (section && container && !container.querySelector(".vocab-card")) {
        section.remove();
      } else if (section) {
        var badge = section.querySelector(".vocab-group-count");
        if (badge) badge.textContent = String((parseInt(badge.textContent, 10) || 1) - 1);
      }
      currentList = currentList.filter(function (w) { return w.id !== wordId; });
      for (var i = 0; i < currentGroups.length; i++) {
        currentGroups[i].items = currentGroups[i].items.filter(function (w) {
          return w.id !== wordId;
        });
      }
      countEl.textContent =
        currentList.length + (currentList.length === 1 ? " word" : " words");
      if (!currentList.length) {
        currentGroups = [];
        groupsEl.innerHTML = '<p class="vocab-empty">No matching words.</p>';
      }
    }, 150);
  }

  function render() {
    if (!loaded) return;
    renderDeckSelector();
    currentList = words.filter(function (word) {
      return matches(word) && passesFilter(word);
    });
    var list = currentList;
    countEl.textContent =
      list.length + (list.length === 1 ? " word" : " words");

    teardownObserver();

    if (!list.length) {
      currentGroups = [];
      groupsEl.innerHTML = '<p class="vocab-empty">No matching words.</p>';
      return;
    }

    currentGroups = buildGroups(list);
    groupsEl.innerHTML = currentGroups
      .map(function (group, i) {
        var freqMod =
          mode === "frequency" ? " vocab-group--" + group.key : "";
        var minH = estimateGroupHeight(group.items.length);
        return (
          '<section class="vocab-group' + freqMod + '">' +
          '<h2 class="vocab-group-title">' +
          esc(group.label) +
          '<span class="vocab-group-count">' +
          group.items.length +
          "</span>" +
          "</h2>" +
          '<div class="vocab-cards" data-gi="' + i +
          '" style="min-height:' + minH + 'px"></div>' +
          "</section>"
        );
      })
      .join("");

    groupObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            materializeGroup(entry.target);
            groupObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "600px 0px" }
    );
    groupsEl.querySelectorAll(".vocab-cards").forEach(function (c) {
      groupObserver.observe(c);
    });
  }

  // One delegated handler for both rows: toggle a single chip, or flip a whole
  // row via its Select all / Unselect all. The dimension comes from the group.
  filterEl.addEventListener("click", function (e) {
    var group = e.target.closest(".vocab-filter-group[data-dim]");
    if (!group) return;
    var dim = group.getAttribute("data-dim");

    var chip = e.target.closest(".vocab-chip");
    if (chip) {
      var key = chip.getAttribute("data-key");
      filters[dim][key] = !filters[dim][key];
      applyChipState(chip, dim, filters[dim][key]);
      render();
      return;
    }

    var bulk = e.target.closest("button[data-bulk]");
    if (bulk) {
      var on = bulk.getAttribute("data-bulk") === "all";
      Object.keys(filters[dim]).forEach(function (k) {
        filters[dim][k] = on;
      });
      group.querySelectorAll(".vocab-chip").forEach(function (c) {
        applyChipState(c, dim, on);
      });
      render();
    }
  });

  var searchTimer = null;
  searchEl.addEventListener("input", function () {
    query = searchEl.value.trim();
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 500);
  });

  // Flip a card on click (single-side modes): a two-phase 3D turn. The front
  // rotates to its edge (90 deg); while invisible we swap the visible face and
  // jump to the opposite edge (-90 deg); then the new face rotates flat. Each
  // face only ever shows within +/-90 deg, so no backface-visibility is needed.
  var TURN_MS = 200;
  groupsEl.addEventListener("click", function (e) {
    // Speaker works in every mode, so handle it before any mode-specific return.
    var speakBtn = e.target.closest(".vocab-speak");
    if (speakBtn) {
      playAudio(speakBtn);
      return;
    }

    // Examples button: open the sentence modal for this card's word.
    var exBtnEl = e.target.closest(".vocab-ex-btn");
    if (exBtnEl) {
      var exCard = e.target.closest(".vocab-card");
      if (!exCard) return;
      var exId = exCard.getAttribute("data-id");
      var exWord = words.filter(function (w) { return w.id === exId; })[0];
      if (exWord) openExamplesModal(exWord);
      return;
    }

    // Suspend toggle: light-red background, no flip, no re-render.
    var suspendBtn = e.target.closest(".vocab-suspend");
    if (suspendBtn) {
      var sCard = e.target.closest(".vocab-card");
      if (!sCard) return;
      var id = sCard.getAttribute("data-id");
      if (!id) return;
      // TRANSIENT (deck-review aid): copy "<id> <thai>" to the clipboard instead
      // of suspending. Delete this block (down to the suspend toggle) to revert.
      var sWord = words.filter(function (w) { return w.id === id; })[0];
      copyText(sWord ? id + " " + sWord.thai : id, suspendBtn);
      return;
      // eslint-disable-next-line no-unreachable
      if (suspended[id]) {
        delete suspended[id];
        sCard.classList.remove("vocab-card--suspended");
        // Restore the green deck mark if this card is in the current deck.
        if (isCustomDeckSelected() && decks[currentDeckId].members[id]) {
          sCard.classList.add("vocab-card--in-deck");
        }
      } else {
        suspended[id] = true;
        sCard.classList.add("vocab-card--suspended");
        // Suspended (red) hides the in-deck (green) cue while suspended.
        sCard.classList.remove("vocab-card--in-deck");
      }
      saveSuspended();
      return;
    }

    // Deck add/remove: toggles membership in the currently selected custom
    // deck. Card gets green background while in deck. Suspended cards still
    // join the deck but show red until unsuspended.
    var deckBtn = e.target.closest(".vocab-deck-btn");
    if (deckBtn) {
      if (!isCustomDeckSelected()) return;
      var dCard = e.target.closest(".vocab-card");
      if (!dCard) return;
      var wid = dCard.getAttribute("data-id");
      if (!wid) return;
      var members = decks[currentDeckId].members;
      var nowIn;
      if (members[wid]) {
        delete members[wid];
        nowIn = false;
      } else {
        members[wid] = true;
        nowIn = true;
      }
      deckBtn.classList.toggle("in-deck", nowIn);
      var label = nowIn ? "Remove from deck" : "Add to deck";
      deckBtn.setAttribute("aria-label", label);
      deckBtn.setAttribute("title", label);
      if (!suspended[wid]) dCard.classList.toggle("vocab-card--in-deck", nowIn);
      saveDecks();
      renderDeckSelector(); // keep the deck's card count in the dropdown current
      // In "Only show deck cards" mode the removed card no longer belongs in the
      // list — fade just that one card out, instead of a full (blanking) render.
      if (deckOnly && !nowIn) dropCardFromView(dCard, wid);
      return;
    }

    // Copy button: works in both-mode (data-copy) and flip-mode (visible side).
    var copyBtn = e.target.closest(".vocab-copy");
    if (copyBtn) {
      var anyCard = e.target.closest(".vocab-card");
      if (!anyCard) return;
      var text = anyCard.classList.contains("vocab-card--flip")
        ? anyCard.getAttribute(anyCard.classList.contains("flipped") ? "data-back" : "data-front")
        : anyCard.getAttribute("data-copy");
      copyText(text, copyBtn);
      return;
    }

    var card = e.target.closest(".vocab-card--flip");
    if (!card) return;

    var rotor = card.querySelector(".vocab-flip-rotor");
    if (!rotor || rotor.dataset.turning) return; // ignore clicks mid-turn
    rotor.dataset.turning = "1";

    rotor.style.transition = "transform " + TURN_MS + "ms ease-in";
    rotor.style.transform = "rotateY(90deg)";

    setTimeout(function () {
      card.classList.toggle("flipped"); // swap faces while edge-on
      rotor.style.transition = "none";
      rotor.style.transform = "rotateY(-90deg)";
      void rotor.offsetWidth; // force reflow so the next change animates
      rotor.style.transition = "transform " + TURN_MS + "ms ease-out";
      rotor.style.transform = "rotateY(0deg)";
      setTimeout(function () {
        rotor.style.transition = "";
        delete rotor.dataset.turning;
      }, TURN_MS);
    }, TURN_MS);
  });

  // ── Display options (card face + what metadata to show), persisted ──
  function setFace(f, doRender) {
    face = f;
    faceToggleEl.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-face") === f);
    });
    lsSet("vocabFace", f);
    if (doRender) render();
  }

  faceToggleEl.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-face]");
    if (btn) setFace(btn.getAttribute("data-face"), true);
  });

  // Audio language for the speaker button. No re-render needed: button
  // visibility doesn't depend on language, only the file chosen at play time.
  function setAudioLang(lang) {
    audioLang = lang === "en" ? "en" : "th";
    audioToggleEl.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-audio") === audioLang);
    });
    lsSet(AUDIO_LANG_KEY, audioLang);
  }
  audioToggleEl.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-audio]");
    if (btn) setAudioLang(btn.getAttribute("data-audio"));
  });

  // ── Deck UI ───────────────────────────────────────────────────────────────
  var deckSelectEl = document.getElementById("deck-select");
  var deckInputEl = document.getElementById("deck-input");
  var deckViewActionsEl = document.getElementById("deck-view-actions");
  var deckRenameBtn = document.getElementById("deck-rename");
  var deckDeleteBtn = document.getElementById("deck-delete");
  var deckNewBtn = document.getElementById("deck-new");
  var deckOnlyEl = document.getElementById("deck-only");
  var deckOnlyLabelEl = document.getElementById("deck-only-label");
  var deckAddFilteredBtn = document.getElementById("deck-add-filtered");

  function deckSize(id) {
    if (id === ALL_DECK_ID) return words.length;
    var fd = FREQ_DECK_BY_ID[id];
    if (fd) {
      return words.filter(function (w) {
        return fd.freqs.indexOf(w.frequency) !== -1;
      }).length;
    }
    return Object.keys(decks[id].members).length;
  }
  function deckOptionLabel(id) {
    var n = deckSize(id);
    return esc(decks[id].name) + " (" + n + " card" + (n === 1 ? "" : "s") + ")";
  }

  function renderDeckSelector() {
    deckSelectEl.innerHTML = deckOrder
      .map(function (id) {
        return (
          '<option value="' + escAttr(id) + '"' +
          (id === currentDeckId ? " selected" : "") +
          ">" + deckOptionLabel(id) + "</option>"
        );
      })
      .join("");
    var custom = isCustomDeckSelected();
    deckRenameBtn.disabled = !custom;
    deckDeleteBtn.disabled = !custom;
    deckAddFilteredBtn.hidden = !custom;
    // The "Only show deck cards" toggle applies to any filtering deck.
    deckOnlyLabelEl.hidden = !isFilteringDeck();
    deckOnlyEl.checked = deckOnly;
  }

  // Inline rename: swap the select for a text input. Enter saves, Escape
  // cancels, and clicking away (blur) also saves — no extra buttons needed.
  function startRename() {
    if (!isCustomDeckSelected()) return;
    deckInputEl.value = decks[currentDeckId].name;
    deckSelectEl.hidden = true;
    deckInputEl.hidden = false;
    deckViewActionsEl.hidden = true;
    deckInputEl.focus();
    deckInputEl.select();
  }

  function endRename(save) {
    if (deckInputEl.hidden) return;
    if (save && isCustomDeckSelected()) {
      var name = deckInputEl.value.trim();
      if (name) {
        decks[currentDeckId].name = name;
        saveDecks();
      }
    }
    deckSelectEl.hidden = false;
    deckInputEl.hidden = true;
    deckViewActionsEl.hidden = false;
    renderDeckSelector();
  }

  deckSelectEl.addEventListener("change", function () {
    currentDeckId = deckSelectEl.value;
    if (!decks[currentDeckId]) currentDeckId = ALL_DECK_ID;
    saveDecks();
    renderDeckSelector();
    render();
  });

  deckNewBtn.addEventListener("click", function () {
    var id = "d" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    decks[id] = { id: id, name: "New deck", members: {} };
    deckOrder.push(id);
    currentDeckId = id;
    saveDecks();
    renderDeckSelector();
    render();
    startRename();
  });

  deckRenameBtn.addEventListener("click", function () { startRename(); });

  deckInputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); endRename(true); }
    else if (e.key === "Escape") { e.preventDefault(); endRename(false); }
  });
  deckInputEl.addEventListener("blur", function () { endRename(true); });

  function showConfirm(message, onConfirm, confirmLabel) {
    var backdrop = document.createElement("div");
    backdrop.className = "vocab-modal-backdrop";
    backdrop.innerHTML =
      '<div class="vocab-modal">' +
        '<div class="vocab-modal-msg">' + message + '</div>' +
        '<div class="vocab-modal-actions">' +
          '<button class="vocab-modal-cancel" type="button">Cancel</button>' +
          '<button class="vocab-modal-confirm" type="button">' + esc(confirmLabel || "Delete") + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(backdrop);
    function close() { document.body.removeChild(backdrop); }
    backdrop.querySelector(".vocab-modal-cancel").addEventListener("click", close);
    backdrop.querySelector(".vocab-modal-confirm").addEventListener("click", function () {
      close();
      onConfirm();
    });
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) close();
    });
  }

  deckDeleteBtn.addEventListener("click", function () {
    if (!isCustomDeckSelected()) return;
    var name = decks[currentDeckId].name;
    showConfirm('Delete deck “' + esc(name) + '”? This cannot be undone.', function () {
      delete decks[currentDeckId];
      deckOrder = deckOrder.filter(function (id) { return id !== currentDeckId; });
      currentDeckId = ALL_DECK_ID;
      saveDecks();
      renderDeckSelector();
      render();
    });
  });

  deckAddFilteredBtn.addEventListener("click", function () {
    if (!isCustomDeckSelected()) return;
    var members = decks[currentDeckId].members;
    currentList.forEach(function (word) { members[word.id] = true; });
    saveDecks();
    render();
  });

  deckOnlyEl.addEventListener("change", function () {
    deckOnly = deckOnlyEl.checked;
    saveDecks();
    render();
  });

  // Restore saved preferences before the first render.
  suspended = loadSuspended();
  loadDecks();
  renderDeckSelector();
  setFace(lsGet("vocabFace") || "both", false);
  setAudioLang(lsGet(AUDIO_LANG_KEY) || "th");

  // Resolve the data file next to this script, so it works both on a direct
  // visit and when the page is loaded via the site's SPA navigation (which
  // leaves the document base at the site root).
  var thisScript = document.querySelector('script[src$="vocab.js"]');
  var dataUrl = thisScript
    ? new URL("vocab.json", thisScript.src).href
    : "vocab.json";
  var audioBase = thisScript
    ? new URL("audio/", thisScript.src).href
    : "audio/";

  // ── Comprehension-coverage dashboard ────────────────────────────────────────
  // Reads the flashcards' FSRS state (shared localStorage, written by the
  // flashcards page) and shows, per frequency band, how much of that vocabulary
  // you actually retain. A word counts as "known" once a card reaches a stability
  // of MATURE_DAYS (recall holds at 3-week+ intervals); "learning" = reviewed but
  // not yet mature. Either direction (t2e / e2t) counts toward knowing the word.
  var FSRS_STATE_KEY = "thaiFsrsState";
  var MATURE_DAYS = 21;

  function loadFsrsState() {
    var raw = lsGet(FSRS_STATE_KEY);
    if (!raw) return {};
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }
  function wordStability(states, id) {
    var best = null;
    ["t2e", "e2t"].forEach(function (dir) {
      var c = states[id + ":" + dir];
      if (c && c.stability != null) best = Math.max(best == null ? 0 : best, c.stability);
    });
    return best;
  }
  function wordSeen(states, id) {
    var a = states[id + ":t2e"], b = states[id + ":e2t"];
    return !!((a && a.reps > 0) || (b && b.reps > 0));
  }

  function countUp(el, target) {
    var node = el.firstChild; // numeric text node (the "%" lives in a child span)
    if (target <= 0) { node.nodeValue = "0"; return; }
    var start = null, dur = 900;
    requestAnimationFrame(function step(ts) {
      if (start == null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      node.nodeValue = Math.round(target * (1 - Math.pow(1 - p, 3))); // ease-out
      if (p < 1) requestAnimationFrame(step);
    });
  }

  function renderCoverage() {
    var host = document.getElementById("cov-dash");
    if (!host) return;
    var states = loadFsrsState();

    var tally = {};
    FREQ_ORDER.forEach(function (f) { tally[f] = { total: 0, known: 0, learning: 0 }; });
    words.forEach(function (w) {
      var t = tally[w.frequency];
      if (!t) return;
      t.total += 1;
      var stab = wordStability(states, w.id);
      if (stab != null && stab >= MATURE_DAYS) t.known += 1;
      else if (wordSeen(states, w.id)) t.learning += 1;
    });

    var tiers = FREQ_ORDER.map(function (f) {
      var t = tally[f];
      var knownPct = t.total ? Math.round((t.known / t.total) * 100) : 0;
      var reachPct = t.total ? Math.round(((t.known + t.learning) / t.total) * 100) : 0;
      return (
        '<div class="cov-tier cov-tier--' + f + '">' +
          '<div class="cov-tier-head">' +
            '<span class="cov-tier-name">' + FREQ_LABEL[f] + '</span>' +
            '<span class="cov-tier-pct" data-pct="' + knownPct + '">0<span class="cov-pct-sign">%</span></span>' +
          '</div>' +
          '<div class="cov-track" role="img" aria-label="' + knownPct + '% known">' +
            '<div class="cov-fill cov-fill--learning" data-w="' + reachPct + '" style="width:0"></div>' +
            '<div class="cov-fill cov-fill--known" data-w="' + knownPct + '" style="width:0"></div>' +
          '</div>' +
          '<div class="cov-tier-foot"><strong>' + t.known + '</strong> known of ' + t.total +
            (t.learning ? ' <span class="cov-learning-n">+' + t.learning + ' learning</span>' : '') +
          '</div>' +
        '</div>'
      );
    }).join("");

    host.innerHTML =
      '<legend class="cov-dash-title">Progress</legend>' +
      '<div class="cov-grid">' + tiers + '</div>';
    host.hidden = false;

    requestAnimationFrame(function () {
      host.querySelectorAll(".cov-fill").forEach(function (el) {
        el.style.width = el.getAttribute("data-w") + "%";
      });
      host.querySelectorAll(".cov-tier-pct").forEach(function (el) {
        countUp(el, +el.getAttribute("data-pct"));
      });
    });
  }

  // ── Progress backup (export / import) ───────────────────────────────────────
  // All study progress and preferences live in localStorage with no backend, so
  // clearing the browser or switching devices loses everything. Export bundles
  // every relevant key into one JSON file; import restores them (after a
  // confirm, since it overwrites current progress) and reloads so both pages
  // re-read the fresh state.
  var BACKUP_KEYS = [
    "thaiFsrsState",      // FSRS card scheduling state (the core progress)
    "thaiFsrsConfig",     // flashcards settings + per-day session bookkeeping
    "thaiSuspended",      // suspended words
    "thaiDecks",          // custom decks
    "thaiAudioLang",      // vocab audio-language preference
    "vocabFace",          // vocab show-Thai/English/both preference
  ];
  var BACKUP_FORMAT = "thai-vocab-progress";

  function backupStatus(msg, isError) {
    var el = document.getElementById("backup-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  function exportProgress() {
    var data = {};
    var count = 0;
    BACKUP_KEYS.forEach(function (k) {
      var raw = lsGet(k);
      if (raw == null) return;
      // Store parsed values when possible so the file is human-readable.
      try { data[k] = JSON.parse(raw); } catch (e) { data[k] = raw; }
      count += 1;
    });
    var payload = {
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      data: data,
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var d = new Date();
    var stamp = d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
    var a = document.createElement("a");
    a.href = url;
    a.download = "thai-progress-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    backupStatus(count ? "Exported." : "Nothing to export yet.");
  }

  function applyImport(data) {
    // Replace only the keys the backup actually carries; leave others untouched.
    BACKUP_KEYS.forEach(function (k) {
      if (!(k in data)) return;
      var v = data[k];
      lsSet(k, typeof v === "string" ? v : JSON.stringify(v));
    });
    backupStatus("Restored. Reloading…");
    setTimeout(function () { location.reload(); }, 350);
  }

  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var payload;
      try { payload = JSON.parse(reader.result); }
      catch (e) { backupStatus("Not a valid backup file.", true); return; }
      if (!payload || payload.format !== BACKUP_FORMAT || !payload.data ||
          typeof payload.data !== "object") {
        backupStatus("Not a Thai-vocab backup file.", true); return;
      }
      var keys = BACKUP_KEYS.filter(function (k) { return k in payload.data; });
      if (!keys.length) { backupStatus("Backup has no progress data.", true); return; }
      var when = payload.exportedAt ? new Date(payload.exportedAt) : null;
      var whenStr = when && !isNaN(when) ? when.toLocaleDateString() : "an unknown date";
      showConfirm(
        "Restore progress from " + whenStr + "? This replaces your current " +
        "study progress and settings on this device.",
        function () { applyImport(payload.data); },
        "Restore"
      );
    };
    reader.onerror = function () { backupStatus("Could not read the file.", true); };
    reader.readAsText(file);
  }

  function wireBackup() {
    var exportBtn = document.getElementById("backup-export");
    var importBtn = document.getElementById("backup-import");
    var fileEl = document.getElementById("backup-file");
    if (!exportBtn || !importBtn || !fileEl) return;
    exportBtn.addEventListener("click", exportProgress);
    importBtn.addEventListener("click", function () { fileEl.click(); });
    fileEl.addEventListener("change", function () {
      var f = fileEl.files && fileEl.files[0];
      if (f) importProgress(f);
      fileEl.value = ""; // allow re-importing the same file
    });
  }

  fetch(dataUrl)
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      words = data;
      loaded = true;
      buildFilterBar();
      render();
      renderCoverage();
      wireBackup();
    })
    .catch(function () {
      groupsEl.innerHTML =
        '<p class="vocab-empty">Could not load vocabulary data.</p>';
    });
  }

  window.VOCAB = { init: init };
})();
