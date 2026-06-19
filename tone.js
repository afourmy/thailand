// Thai tone practice: record yourself saying a word, then overlay your pitch
// contour against the reference TTS audio and score how well the shape matches.
//
// Everything runs in the browser. Both the reference mp3 and the microphone
// recording are decoded with the Web Audio API, downsampled to 16 kHz, and run
// through the same McLeod (MPM/autocorrelation) pitch tracker. Each contour is
// normalised to semitones relative to its OWN median, so a synthetic reference
// voice and the learner's voice are compared by tone *shape*, not absolute Hz.
//
// Exposes window.TONE.init(), called from an inline <script> in tone.html so the
// page wires itself up on load (matching flashcards.js / vocab.js conventions).
(function () {
  // ── Tunables ───────────────────────────────────────────────────────────────
  var TARGET_SR = 16000;     // resample everything to this before pitch tracking
  var FRAME_S = 0.04;        // 40 ms analysis frame
  var HOP_S = 0.01;          // 10 ms hop
  var F0_MIN = 70, F0_MAX = 400;
  var RMS_GATE = 0.012;      // below this a frame is treated as silence
  var CLARITY_MIN = 0.45;    // NSDF peak must clear this to count as voiced
  var N_RESAMPLE = 64;       // points on the normalised-time comparison axis
  var MAX_REC_MS = 4000;     // hard cap on a single recording
  var FREQ_KEY = "thaiToneFreq";

  var FREQ_ORDER = ["everyday", "common", "occasional", "rare"];
  var FREQ_LABEL = {
    everyday: "Everyday", common: "Common",
    occasional: "Occasional", rare: "Rare",
  };

  // ── DOM helpers ─────────────────────────────────────────────────────────────
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── State ───────────────────────────────────────────────────────────────────
  var words = [];            // full vocab.json
  var pool = [];             // words with audio, passing the frequency filter
  var allAudio = [];         // every word with audio (for the filter to draw from)
  var current = null;
  var audioBase = "audio/";
  var freqOn = {};           // frequency -> bool (which frequencies are included)
  var refCache = {};         // word.id -> reference semitone array (or null)
  var audioCtx = null;
  var refAudioEl = null, youAudioEl = null, youURL = null;
  var lastYouContour = null; // raw {t,f0} contour of the most recent recording

  // Mic recording
  var mediaStream = null, recorder = null, recChunks = [], recTimer = null, recording = false;

  // ── Web Audio ───────────────────────────────────────────────────────────────
  function ctx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  // Linear resample of one channel to TARGET_SR.
  function resample(data, srcSr) {
    if (srcSr === TARGET_SR) return data;
    var ratio = TARGET_SR / srcSr;
    var outLen = Math.round(data.length * ratio);
    var out = new Float32Array(outLen);
    for (var i = 0; i < outLen; i++) {
      var x = i / ratio;
      var i0 = Math.floor(x), i1 = Math.min(i0 + 1, data.length - 1);
      var frac = x - i0;
      out[i] = data[i0] * (1 - frac) + data[i1] * frac;
    }
    return out;
  }

  function decodeToMono16k(arrayBuf) {
    return ctx().decodeAudioData(arrayBuf).then(function (buf) {
      var mono = buf.getChannelData(0);
      // average channels if stereo, for a cleaner contour
      if (buf.numberOfChannels > 1) {
        var ch1 = buf.getChannelData(1);
        var mix = new Float32Array(mono.length);
        for (var i = 0; i < mono.length; i++) mix[i] = 0.5 * (mono[i] + ch1[i]);
        mono = mix;
      }
      return resample(mono, buf.sampleRate);
    });
  }

  // ── Pitch detection (McLeod Pitch Method on the NSDF) ───────────────────────
  function detectF0(buf, sr) {
    var n = buf.length, i, j;
    var sumsq = 0;
    for (i = 0; i < n; i++) sumsq += buf[i] * buf[i];
    if (Math.sqrt(sumsq / n) < RMS_GATE) return NaN; // silence

    var minLag = Math.max(2, Math.floor(sr / F0_MAX));
    var maxLag = Math.min(n - 1, Math.floor(sr / F0_MIN));
    if (maxLag <= minLag) return NaN;

    var nsdf = new Float32Array(maxLag + 1);
    for (var lag = minLag; lag <= maxLag; lag++) {
      var ac = 0, m = 0, lim = n - lag;
      for (j = 0; j < lim; j++) {
        var a = buf[j], b = buf[j + lag];
        ac += a * b;
        m += a * a + b * b;
      }
      nsdf[lag] = m > 0 ? (2 * ac / m) : 0;
    }

    // Collect the local maxima of each positive hump of the NSDF.
    var peaks = [], pos = false, curMax = -Infinity, curLag = -1;
    for (lag = minLag; lag <= maxLag; lag++) {
      var v = nsdf[lag];
      if (!pos) {
        if (v > 0) { pos = true; curMax = v; curLag = lag; }
      } else {
        if (v > curMax) { curMax = v; curLag = lag; }
        if (v <= 0) { if (curLag > 0) peaks.push(curLag); pos = false; curMax = -Infinity; curLag = -1; }
      }
    }
    if (pos && curLag > 0) peaks.push(curLag);
    if (!peaks.length) return NaN;

    var maxVal = -Infinity;
    for (i = 0; i < peaks.length; i++) if (nsdf[peaks[i]] > maxVal) maxVal = nsdf[peaks[i]];
    if (maxVal < CLARITY_MIN) return NaN; // not periodic enough -> unvoiced

    // MPM: pick the FIRST peak that reaches 90% of the strongest one.
    var thresh = 0.9 * maxVal, chosen = -1;
    for (i = 0; i < peaks.length; i++) {
      if (nsdf[peaks[i]] >= thresh) { chosen = peaks[i]; break; }
    }
    if (chosen < 1 || chosen >= maxLag) return NaN;

    // Parabolic interpolation for sub-sample lag precision.
    var y0 = nsdf[chosen - 1], y1 = nsdf[chosen], y2 = nsdf[chosen + 1];
    var denom = y0 - 2 * y1 + y2;
    var shift = denom !== 0 ? 0.5 * (y0 - y2) / denom : 0;
    var f0 = sr / (chosen + shift);
    if (f0 < 60 || f0 > 500) return NaN;
    return f0;
  }

  // Frame the signal and return an array of {t, f0} (f0 NaN when unvoiced).
  function contour(samples, sr) {
    var frame = Math.round(sr * FRAME_S);
    var hop = Math.round(sr * HOP_S);
    var out = [];
    for (var s = 0; s + frame <= samples.length; s += hop) {
      out.push({ t: s / sr, f0: detectF0(samples.subarray(s, s + frame), sr) });
    }
    // 3-point median smoothing over voiced values, to drop octave-jump outliers.
    var f = out.map(function (p) { return p.f0; });
    for (var i = 1; i < out.length - 1; i++) {
      var a = f[i - 1], b = f[i], c = f[i + 1];
      if (isNaN(a) || isNaN(b) || isNaN(c)) continue;
      out[i].f0 = a + b + c - Math.max(a, b, c) - Math.min(a, b, c); // median of 3
    }
    return out;
  }

  // ── Comparison ──────────────────────────────────────────────────────────────
  // Restrict to the voiced span, interpolate across gaps, normalise time to
  // [0,1] and pitch to semitones relative to the contour's median. Returns a
  // Float32Array of length N_RESAMPLE, or null if too little voicing.
  function toSemitoneCurve(c) {
    var v = c.filter(function (p) { return !isNaN(p.f0); });
    if (v.length < 4) return null;
    var t0 = v[0].t, t1 = v[v.length - 1].t;
    if (t1 - t0 < 0.08) return null;

    var fs = v.map(function (p) { return p.f0; }).slice().sort(function (a, b) { return a - b; });
    var median = fs[Math.floor(fs.length / 2)];

    var out = new Float32Array(N_RESAMPLE);
    for (var k = 0; k < N_RESAMPLE; k++) {
      var t = t0 + (k / (N_RESAMPLE - 1)) * (t1 - t0);
      // find surrounding voiced points
      var lo = v[0], hi = v[v.length - 1];
      for (var j = 0; j < v.length; j++) {
        if (v[j].t <= t) lo = v[j];
        if (v[j].t >= t) { hi = v[j]; break; }
      }
      var f0;
      if (hi.t === lo.t) f0 = lo.f0;
      else {
        var frac = (t - lo.t) / (hi.t - lo.t);
        // interpolate in log domain (semitone-linear)
        f0 = Math.exp(Math.log(lo.f0) * (1 - frac) + Math.log(hi.f0) * frac);
      }
      out[k] = 12 * Math.log(f0 / median) / Math.LN2;
    }
    return out;
  }

  function pearson(a, b) {
    var n = a.length, ma = 0, mb = 0, i;
    for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    var num = 0, da = 0, db = 0;
    for (i = 0; i < n; i++) {
      var x = a[i] - ma, y = b[i] - mb;
      num += x * y; da += x * x; db += y * y;
    }
    if (da === 0 || db === 0) return 0;
    return num / Math.sqrt(da * db);
  }

  function rmse(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) { var d = a[i] - b[i]; s += d * d; }
    return Math.sqrt(s / a.length);
  }

  function describeShape(curve) {
    var net = curve[curve.length - 1] - curve[0];
    if (net > 1.5) return "rising";
    if (net < -1.5) return "falling";
    return "level";
  }

  // ── Reference contour (cached per word) ─────────────────────────────────────
  function refUrl(word) { return audioBase + word.id + ".mp3"; }

  function getRefCurve(word) {
    if (refCache[word.id] !== undefined) return Promise.resolve(refCache[word.id]);
    return fetch(refUrl(word))
      .then(function (r) { if (!r.ok) throw new Error("no audio"); return r.arrayBuffer(); })
      .then(decodeToMono16k)
      .then(function (samples) {
        var curve = toSemitoneCurve(contour(samples, TARGET_SR));
        refCache[word.id] = curve;
        return curve;
      })
      .catch(function () { refCache[word.id] = null; return null; });
  }

  // ── Rendering: the word card ────────────────────────────────────────────────
  function freqTag(word) {
    var el = $("tone-freq-tag");
    if (word.frequency && FREQ_LABEL[word.frequency]) {
      el.textContent = FREQ_LABEL[word.frequency];
      el.className = "tone-freq-tag tone-freq-tag--" + word.frequency;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function loadWord(word) {
    current = word;
    $("tone-card").hidden = false;
    $("tone-word").textContent = word.thai;
    $("tone-en").textContent = word.english || "";
    freqTag(word);
    resetResult();
    // warm the reference contour in the background
    getRefCurve(word);
  }

  function resetResult() {
    $("tone-result").hidden = true;
    $("tone-play-you").hidden = true;
    setStatus("");
    lastYouContour = null;
    if (youURL) { URL.revokeObjectURL(youURL); youURL = null; }
  }

  function setStatus(msg, isErr) {
    var el = $("tone-status");
    el.textContent = msg || "";
    el.classList.toggle("tone-status--err", !!isErr);
  }

  function randomWord() {
    if (!pool.length) { setStatus("No words match this filter.", true); return; }
    var w = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && current && w.id === current.id) w = pool[(pool.indexOf(w) + 1) % pool.length];
    loadWord(w);
  }

  // ── Playback ────────────────────────────────────────────────────────────────
  function playRef() {
    if (!current) return;
    if (!refAudioEl) refAudioEl = new Audio();
    refAudioEl.src = refUrl(current);
    refAudioEl.play().catch(function () { setStatus("Could not play the reference audio.", true); });
  }

  function playYou() {
    if (!youURL) return;
    if (!youAudioEl) youAudioEl = new Audio();
    youAudioEl.src = youURL;
    youAudioEl.play().catch(function () {});
  }

  // ── Recording ───────────────────────────────────────────────────────────────
  function startRecording() {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setStatus("Recording isn't supported in this browser.", true);
      return;
    }
    setStatus("Requesting microphone…");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      mediaStream = stream;
      recChunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = function (e) { if (e.data.size) recChunks.push(e.data); };
      recorder.onstop = onRecordingStop;
      recorder.start();
      recording = true;
      $("tone-record").classList.add("tone-btn--recording");
      $("tone-record").querySelector(".tone-rec-label").textContent = "Stop";
      setStatus("Recording… say the word, then tap to stop.");
      recTimer = setTimeout(function () { if (recording) stopRecording(); }, MAX_REC_MS);
    }).catch(function () {
      setStatus("Microphone access was blocked.", true);
    });
  }

  function stopRecording() {
    if (!recording) return;
    recording = false;
    clearTimeout(recTimer);
    try { recorder.stop(); } catch (e) {}
    $("tone-record").classList.remove("tone-btn--recording");
    $("tone-record").querySelector(".tone-rec-label").textContent = "Record";
  }

  function onRecordingStop() {
    if (mediaStream) { mediaStream.getTracks().forEach(function (t) { t.stop(); }); mediaStream = null; }
    var blob = new Blob(recChunks, { type: recChunks[0] ? recChunks[0].type : "audio/webm" });
    if (youURL) URL.revokeObjectURL(youURL);
    youURL = URL.createObjectURL(blob);
    $("tone-play-you").hidden = false;
    setStatus("Analysing…");

    blob.arrayBuffer()
      .then(decodeToMono16k)
      .then(function (samples) {
        lastYouContour = contour(samples, TARGET_SR);
        var youCurve = toSemitoneCurve(lastYouContour);
        if (!youCurve) { setStatus("Didn't catch a clear voice. Try again, a bit louder.", true); return; }
        return getRefCurve(current).then(function (refCurve) {
          if (!refCurve) { setStatus("No reference contour available for this word yet.", true); return; }
          showComparison(refCurve, youCurve);
        });
      })
      .catch(function () { setStatus("Could not analyse the recording. Try again.", true); });
  }

  // ── Scoring + chart ─────────────────────────────────────────────────────────
  function showComparison(ref, you) {
    setStatus("");
    var r = pearson(ref, you);
    var err = rmse(ref, you);
    var score = Math.round(100 * (0.6 * Math.max(0, r) + 0.4 * Math.max(0, 1 - err / 6)));
    score = Math.max(0, Math.min(100, score));

    var verdict, cls;
    if (score >= 80) { verdict = "Great match"; cls = "good"; }
    else if (score >= 60) { verdict = "Close"; cls = "ok"; }
    else if (score >= 40) { verdict = "Off"; cls = "off"; }
    else { verdict = "Way off"; cls = "bad"; }

    var scoreEl = $("tone-score");
    scoreEl.textContent = score;
    scoreEl.className = "tone-score tone-score--" + cls;
    $("tone-verdict").textContent = verdict;

    var refShape = describeShape(ref), youShape = describeShape(you);
    var hint = $("tone-hint");
    if (refShape === youShape) {
      hint.textContent = "Reference trends " + refShape + ", and so does yours.";
    } else {
      hint.textContent = "Reference trends " + refShape + ", but yours trends " + youShape + ".";
    }

    $("tone-result").hidden = false;
    drawChart(ref, you);
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function drawChart(ref, you) {
    var canvas = $("tone-canvas");
    var wrap = canvas.parentNode;
    var dpr = window.devicePixelRatio || 1;
    var cssW = wrap.clientWidth, cssH = 220;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + "px";
    var g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);

    var padL = 38, padR = 12, padT = 14, padB = 22;
    var plotW = cssW - padL - padR, plotH = cssH - padT - padB;

    // y-range across both curves, symmetric-ish with padding
    var lo = Infinity, hi = -Infinity, i;
    for (i = 0; i < ref.length; i++) { lo = Math.min(lo, ref[i], you[i]); hi = Math.max(hi, ref[i], you[i]); }
    if (!isFinite(lo)) { lo = -6; hi = 6; }
    var pad = Math.max(2, (hi - lo) * 0.15);
    lo -= pad; hi += pad;
    if (hi - lo < 4) { var mid = (hi + lo) / 2; lo = mid - 2; hi = mid + 2; }

    function X(k) { return padL + (k / (ref.length - 1)) * plotW; }
    function Y(st) { return padT + (1 - (st - lo) / (hi - lo)) * plotH; }

    var border = cssVar("--border") || "#e0e0e0";
    var muted = cssVar("--text-muted") || "#777";

    // axes + zero (median) gridline
    g.strokeStyle = border; g.lineWidth = 1;
    g.beginPath(); g.moveTo(padL, padT); g.lineTo(padL, padT + plotH); g.lineTo(padL + plotW, padT + plotH); g.stroke();
    if (0 >= lo && 0 <= hi) {
      g.strokeStyle = border; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(padL, Y(0)); g.lineTo(padL + plotW, Y(0)); g.stroke();
      g.setLineDash([]);
    }
    // y labels (semitones)
    g.fillStyle = muted; g.font = "11px system-ui, sans-serif"; g.textAlign = "right"; g.textBaseline = "middle";
    [Math.ceil(lo), 0, Math.floor(hi)].forEach(function (st) {
      if (st < lo || st > hi) return;
      g.fillText((st > 0 ? "+" : "") + st, padL - 6, Y(st));
    });
    g.save(); g.translate(11, padT + plotH / 2); g.rotate(-Math.PI / 2);
    g.textAlign = "center"; g.fillText("semitones", 0, 0); g.restore();
    g.textAlign = "left"; g.textBaseline = "top";
    g.fillText("time →", padL, padT + plotH + 6);

    function line(curve, color, width) {
      g.strokeStyle = color; g.lineWidth = width; g.lineJoin = "round"; g.lineCap = "round";
      g.beginPath();
      for (var k = 0; k < curve.length; k++) {
        var x = X(k), y = Y(curve[k]);
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    line(ref, cssVar("--accent-strong") || "#003366", 2.5);
    line(you, "#e0803a", 2.5);
  }

  // ── Filter chips + word pool ────────────────────────────────────────────────
  function rebuildPool() {
    pool = allAudio.filter(function (w) { return freqOn[w.frequency]; });
  }

  function buildChips() {
    var host = $("tone-freq-chips");
    host.innerHTML = "";
    FREQ_ORDER.forEach(function (key) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "fc-chip" + (freqOn[key] ? "" : " fc-chip--off");
      b.setAttribute("data-freq", key);
      b.textContent = FREQ_LABEL[key];
      b.addEventListener("click", function () {
        freqOn[key] = !freqOn[key];
        // never allow an empty filter
        if (!FREQ_ORDER.some(function (k) { return freqOn[k]; })) freqOn[key] = true;
        b.classList.toggle("fc-chip--off", !freqOn[key]);
        try { localStorage.setItem(FREQ_KEY, JSON.stringify(freqOn)); } catch (e) {}
        rebuildPool();
      });
      host.appendChild(b);
    });
  }

  function buildDatalist() {
    var dl = $("tone-datalist");
    dl.innerHTML = allAudio.map(function (w) {
      return '<option value="' + esc(w.thai) + '">' + esc(w.english || "") + "</option>";
    }).join("");
  }

  function trySearch(value) {
    var v = (value || "").trim();
    if (!v) return;
    var hit = allAudio.filter(function (w) { return w.thai === v; });
    if (!hit.length) {
      var low = v.toLowerCase();
      hit = allAudio.filter(function (w) {
        return w.thai.indexOf(v) !== -1 || (w.english || "").toLowerCase().indexOf(low) !== -1;
      });
    }
    if (hit.length) loadWord(hit[0]);
    else setStatus("No word with audio matches “" + v + "”.", true);
  }

  // ── Wiring ──────────────────────────────────────────────────────────────────
  function wire() {
    $("tone-random").addEventListener("click", randomWord);
    $("tone-play-ref").addEventListener("click", playRef);
    $("tone-play-you").addEventListener("click", playYou);
    $("tone-record").addEventListener("click", function () {
      ctx(); // unlock audio on user gesture
      if (recording) stopRecording(); else startRecording();
    });

    var search = $("tone-search");
    search.addEventListener("change", function () { trySearch(search.value); });
    search.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { trySearch(search.value); }
    });

    window.addEventListener("resize", function () {
      if (!$("tone-result").hidden && current && lastYouContour) {
        var ref = refCache[current.id], you = toSemitoneCurve(lastYouContour);
        if (ref && you) drawChart(ref, you);
      }
    });
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  function init() {
    var thisScript = document.querySelector('script[src$="tone.js"]');
    var dataUrl = thisScript ? new URL("vocab.json", thisScript.src).href : "vocab.json";
    audioBase = thisScript ? new URL("audio/", thisScript.src).href : "audio/";

    // restore the saved frequency filter (default: all on)
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(FREQ_KEY)); } catch (e) {}
    FREQ_ORDER.forEach(function (k) { freqOn[k] = saved && k in saved ? !!saved[k] : true; });
    if (!FREQ_ORDER.some(function (k) { return freqOn[k]; })) FREQ_ORDER.forEach(function (k) { freqOn[k] = true; });

    fetch(dataUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        words = data;
        allAudio = words.filter(function (w) { return w.audio; });
        rebuildPool();
        buildChips();
        buildDatalist();
        wire();
        randomWord();
      })
      .catch(function () { setStatus("Could not load the vocabulary.", true); });
  }

  window.TONE = { init: init };
})();
