// FSRS-5 spaced-repetition scheduler.
//
// Self-contained, no dependencies. Exposes a small pure API on window.FSRS:
//   FSRS.emptyCard()                -> fresh, never-reviewed card state
//   FSRS.review(card, grade, now)   -> new card state after a rating
//   FSRS.preview(card, now)         -> { 1: days, 2: days, 3: days, 4: days }
//   FSRS.formatInterval(days)       -> short human label ("Now", "4d", "2mo")
//
// Grades follow the Anki/FSRS convention: 1 = Again, 2 = Hard, 3 = Good,
// 4 = Easy. A card's scheduling state is the pair (stability, difficulty);
// "stability" is the number of days at which recall probability falls to the
// request retention (0.9), which is why an interval comes out close to it.
(function () {
  // Published FSRS-5 default weights (19 parameters). Not personally optimised;
  // optimisation needs a corpus of past reviews we don't have yet.
  var W = [
    0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
    1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898,
    0.51655, 0.6621,
  ];

  var REQUEST_RETENTION = 0.9;
  var MAX_INTERVAL = 36500; // 100 years, the practical ceiling
  var DECAY = -0.5;
  var FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // 19/81 for DECAY = -0.5
  var S_MIN = 0.01;
  var DAY = 86400000;

  function clampD(d) {
    return Math.min(10, Math.max(1, d));
  }

  function initDifficulty(grade) {
    return clampD(W[4] - Math.exp(W[5] * (grade - 1)) + 1);
  }

  function initStability(grade) {
    return Math.max(S_MIN, W[grade - 1]);
  }

  // Linear-damped change plus mean reversion toward the "Easy first rating"
  // difficulty, so difficulty drifts back to centre over many reviews.
  function nextDifficulty(d, grade) {
    var deltaD = -W[6] * (grade - 3);
    var damped = d + (deltaD * (10 - d)) / 9;
    return clampD(W[7] * initDifficulty(4) + (1 - W[7]) * damped);
  }

  function retrievability(elapsedDays, stability) {
    return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
  }

  function nextRecallStability(d, s, r, grade) {
    var hardPenalty = grade === 2 ? W[15] : 1;
    var easyBonus = grade === 4 ? W[16] : 1;
    return (
      s *
      (1 +
        Math.exp(W[8]) *
          (11 - d) *
          Math.pow(s, -W[9]) *
          (Math.exp((1 - r) * W[10]) - 1) *
          hardPenalty *
          easyBonus)
    );
  }

  function nextForgetStability(d, s, r) {
    return (
      W[11] *
      Math.pow(d, -W[12]) *
      (Math.pow(s + 1, W[13]) - 1) *
      Math.exp((1 - r) * W[14])
    );
  }

  function intervalDays(stability) {
    var ivl = (stability / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1);
    return Math.min(MAX_INTERVAL, Math.max(1, Math.round(ivl)));
  }

  function emptyCard() {
    return {
      state: "new",
      stability: null,
      difficulty: null,
      due: null,
      lastReview: null,
      reps: 0,
      lapses: 0,
    };
  }

  // Pure: returns a new state object, never mutates the input.
  function review(card, grade, now) {
    now = now || Date.now();
    var prev = card || emptyCard();
    var wasNew = prev.reps === 0 || prev.stability == null;

    var stability, difficulty;
    if (wasNew) {
      difficulty = initDifficulty(grade);
      stability = initStability(grade);
    } else {
      var elapsedDays = Math.max(0, (now - prev.lastReview) / DAY);
      var r = retrievability(elapsedDays, prev.stability);
      difficulty = nextDifficulty(prev.difficulty, grade);
      stability =
        grade === 1
          ? nextForgetStability(prev.difficulty, prev.stability, r)
          : nextRecallStability(prev.difficulty, prev.stability, r, grade);
    }
    stability = Math.max(S_MIN, stability);

    var next = {
      stability: stability,
      difficulty: difficulty,
      lastReview: now,
      reps: prev.reps + 1,
      lapses: prev.lapses + (grade === 1 && !wasNew ? 1 : 0),
    };
    if (grade === 1) {
      // Keep a lapsed card due today; the session re-queues it for immediate
      // practice rather than waiting a full day.
      next.due = now;
      next.state = "relearning";
    } else {
      next.due = now + intervalDays(stability) * DAY;
      next.state = "review";
    }
    return next;
  }

  // Projected days-until-due for each grade, for the labels under the buttons.
  function preview(card, now) {
    now = now || Date.now();
    var out = {};
    for (var grade = 1; grade <= 4; grade++) {
      var res = review(card, grade, now);
      out[grade] = Math.max(0, Math.round((res.due - now) / DAY));
    }
    return out;
  }

  function formatInterval(days) {
    if (days <= 0) return "Now";
    if (days < 30) return days + "d";
    if (days < 365) return Math.round(days / 30) + "mo";
    return (days / 365).toFixed(days < 365 * 10 ? 1 : 0) + "y";
  }

  window.FSRS = {
    emptyCard: emptyCard,
    review: review,
    preview: preview,
    formatInterval: formatInterval,
  };
})();
