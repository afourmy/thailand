(function () {
  // Apply the saved theme as early as possible to avoid a flash of the wrong one.
  try {
    document.documentElement.setAttribute(
      "data-theme",
      localStorage.getItem("theme") || "light"
    );
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }

  // This site (afourmy.github.io/thailand) is the standalone Thai app. To keep the
  // integrated "full menu" view, the non-Thai sections cross-link back to the main
  // site at afourmy.github.io via absolute URLs; the Thai pages are local.
  var SITE = "https://afourmy.github.io";

  var menu = [
    { en: "Mathematics", cssClass: "submenu-sections", columns: [
      [
        { href: SITE + "/math/groups.html", en: "Groups" },
        { href: SITE + "/math/suites.html", en: "Sequences" },
        { href: SITE + "/math/fonctions-usuelles.html", en: "Standard Functions" },
        { href: SITE + "/math/continuite.html", en: "Continuity" },
        { href: SITE + "/math/derivation.html", en: "Differentiation" },
        { href: SITE + "/math/complexes.html", en: "Complex Numbers" },
      ],
      [
        { href: SITE + "/math/ensembles.html", en: "Sets" },
        { href: SITE + "/math/bases.html", en: "Foundations" },
        { href: SITE + "/math/arithmetique.html", en: "Arithmetic" },
        { href: SITE + "/math/anneaux-corps.html", en: "Rings and Fields" },
        { href: SITE + "/math/polynomes.html", en: "Polynomials" },
        { href: SITE + "/math/denombrement.html", en: "Combinatorics" },
      ],
      [
        { href: SITE + "/math/topologie.html", en: "Topology" },
        { href: SITE + "/math/linear-algebra.html", en: "Linear Algebra" },
        { href: SITE + "/math/matrices.html", en: "Matrices" },
        { href: SITE + "/math/determinants.html", en: "Determinants" },
        { href: SITE + "/math/reduction.html", en: "Reduction" },
        { href: SITE + "/math/probabilites.html", en: "Probability" },
      ]
    ]},
    { en: "Computer Science", columns: [
      [
        { href: SITE + "/cs/algorithmics.html", en: "Algorithmics" },
        { href: SITE + "/cs/automata.html", en: "Formal Languages" },
        { href: SITE + "/cs/graph-theory.html", en: "Graph Theory" },
      ]
    ]},
    { en: "Bioinformatics", columns: [
      [
        { href: SITE + "/bio/genomics.html", en: "Genomics" },
        { href: SITE + "/bio/transcriptomics.html", en: "Transcriptomics" },
        { href: SITE + "/bio/proteomics.html", en: "Proteomics" },
      ]
    ]},
    { en: "Thailand", columns: [
      [
        { href: "index.html", en: "Vocabulary" },
        { href: "etymology.html", en: "Etymology" },
        { href: "flashcards.html", en: "Flashcards" },
      ]
    ]},
    { en: "Projects", columns: [
      [
        { href: SITE + "/projects/tsp.html", en: "Traveling Salesman Problem" },
        { href: SITE + "/projects/swap.html", en: "Wavelength Assignment Problem" },
        { href: SITE + "/projects/computational-genomics.html", en: "Computational Genomics" },
      ]
    ]},
    { en: "Books", columns: [
      [
        { href: SITE + "/books/aops.html", en: "The Art of Problem Solving" },
        { href: SITE + "/books/bioinformatics-algorithms.html", en: "Bioinformatics Algorithms" },
        { href: SITE + "/books/long-form-math-textbook.html", en: "A Long-Form Mathematics Textbook" },
      ]
    ]},
  ];

  // Compute relative prefix from current page to site root.
  // nav.js is at the root, so we find how many directory levels deep we are.
  var scripts = document.querySelectorAll('script[src$="nav.js"]');
  var prefix = "";
  if (scripts.length) {
    var src = scripts[scripts.length - 1].getAttribute("src");
    // Count how many "../" are in the script src to determine depth
    var parts = src.split("/");
    for (var i = 0; i < parts.length - 1; i++) {
      if (parts[i] === "..") prefix += "../";
    }
  }

  // Absolute (cross-site) hrefs are used as-is; only local hrefs get the
  // root-relative prefix.
  function withPrefix(href) {
    return /^https?:\/\//.test(href) ? href : prefix + href;
  }

  // This site defaults to the thai-only "app" view: a stripped nav (just the
  // Thai links + the theme and Thai-font toggles). The full site menu (with the
  // other subjects cross-linking back to the main site) is shown only when a
  // ?full=1 query is present, which the main website's Thailand links carry.
  var fullMenu = (location.search || "").indexOf("full=1") !== -1;

  function esc(s) {
    return s.replace(/&/g, "&amp;");
  }

  var html = '<nav><div class="nav-inner">';
  if (fullMenu) {
    html += '<a href="' + SITE + '/index.html" class="nav-link nav-home">Home</a>';
  }

  // Hamburger button (mobile only; CSS hides it on desktop).
  html += '<button class="nav-toggle" id="navToggle" aria-label="Toggle menu">';
  html += '<span></span><span></span><span></span>';
  html += '</button>';

  // Mobile-only flex spacer: pushes the toggles + theme toggle to the right of
  // the bar (hamburger stays left). Hidden on desktop (see CSS).
  html += '<div class="nav-spacer" aria-hidden="true"></div>';

  // Thai font toggle (shown only on Thai pages). Placed OUTSIDE .nav-links so
  // that on mobile it stays visible in the top bar instead of being hidden in
  // the hamburger dropdown. On desktop the .lang-toggle rule still positions
  // it absolutely at left: 1.5rem, unchanged from before.
  html += '<div class="lang-toggle" id="thai-font-toggle" style="display:none">';
  html += '<button id="thai-font-sarabun" data-font="sarabun" class="active">Sarabun</button>';
  html += '<button id="thai-font-noto" data-font="noto">Noto Sans</button>';
  html += '</div>';

  // Collapsible menu: the hamburger shows/hides these on mobile without
  // affecting the desktop layout.
  html += '<div class="nav-links" id="navLinks">';

  if (!fullMenu) {
    // Default: thai-only app. Just the Thai section's links (the menu array
    // above stays the single source of truth), local with no query so browsing
    // stays in the app. No Home, no other sections.
    var thaiSection = null;
    for (var ts = 0; ts < menu.length; ts++) {
      if (menu[ts].en === "Thailand") { thaiSection = menu[ts]; break; }
    }
    if (thaiSection) {
      var tcol = thaiSection.columns[0];
      for (var tk = 0; tk < tcol.length; tk++) {
        var tlink = tcol[tk];
        html += '<a href="' + withPrefix(tlink.href) + '" class="nav-link nav-link--app" data-path="' + esc(tlink.href) + '">' + esc(tlink.en) + '</a>';
      }
    }
  } else {
    // Full site menu (arrived from the main website via ?full=1). Other subjects
    // link back to the main site (absolute URLs); the local Thai links carry
    // ?full=1 so the integrated full menu is preserved while browsing Thai pages.
    for (var m = 0; m < menu.length; m++) {
      var item = menu[m];
      html += '<div class="nav-item">';
      html += '<a href="#" class="nav-link" onclick="return false;">' + esc(item.en) + '</a>';
      html += '<div class="submenu' + (item.cssClass ? " " + item.cssClass : "") + '">';
      for (var c = 0; c < item.columns.length; c++) {
        html += '<ul class="submenu-col">';
        var col = item.columns[c];
        for (var i = 0; i < col.length; i++) {
          var link = col[i];
          var href = withPrefix(link.href);
          if (!/^https?:\/\//.test(link.href)) href += "?full=1";
          html += '<li><a href="' + href + '" data-path="' + esc(link.href) + '">' + esc(link.en) + '</a></li>';
        }
        html += '</ul>';
      }
      html += '</div></div>';
    }
  }

  html += '</div>'; // close .nav-links

  // Theme toggle (right side)
  html += '<button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">';
  html += '<span class="toggle-track">';
  html += '<svg class="icon-sun" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2"/><line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2"/><line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2"/><line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2"/></svg>';
  html += '<svg class="icon-moon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
  html += '<span class="toggle-thumb"></span>';
  html += '</span>';
  html += '</button>';
  html += '</div></nav>';

  // Insert nav at the beginning of <body>
  var container = document.createElement("div");
  container.innerHTML = html;
  var nav = container.firstChild;
  document.body.insertBefore(nav, document.body.firstChild);

  // Theme toggle: flip data-theme on <html> and remember the choice.
  var themeToggle = nav.querySelector("#themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next =
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "light"
          : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (e) {}
    });
  }

  // Mobile menu: the hamburger shows/hides the collapsible nav; tapping a
  // category expands its submenu (accordion); tapping a real link closes it.
  var navToggle = nav.querySelector("#navToggle");
  var navLinks = nav.querySelector("#navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var open = navLinks.classList.toggle("open");
      navToggle.classList.toggle("active", open);
    });
    navLinks.addEventListener("click", function (e) {
      var topLink = e.target.closest(".nav-item > .nav-link");
      if (topLink) {
        topLink.parentNode.classList.toggle("open");
        return;
      }
      if (e.target.closest(".submenu a[href]")) {
        navLinks.classList.remove("open");
        navToggle.classList.remove("active");
      }
    });
  }

  // Highlight the top-level item whose submenu contains the current page.
  // Exposed globally so SPA navigation can refresh it after each page change.
  function strip(url) {
    return url.split("#")[0].split("?")[0];
  }
  window.setActiveNav = function () {
    // Compare against the stable data-path (e.g. "etymology.html") rather
    // than the anchor's resolved .href.
    var path = strip(window.location.pathname);
    var items = nav.querySelectorAll(".nav-item");
    for (var k = 0; k < items.length; k++) {
      var topLink = items[k].querySelector(".nav-link");
      var links = items[k].querySelectorAll(".submenu a");
      var match = false;
      for (var l = 0; l < links.length; l++) {
        var p = links[l].getAttribute("data-path");
        if (p && path.endsWith(p)) { match = true; break; }
      }
      if (topLink) topLink.classList.toggle("nav-active", match);
    }
    // Thai-only app: flat links carry their own data-path.
    var appLinks = nav.querySelectorAll("a.nav-link--app[data-path]");
    for (var a2 = 0; a2 < appLinks.length; a2++) {
      var ap = appLinks[a2].getAttribute("data-path");
      appLinks[a2].classList.toggle("nav-active", !!(ap && path.endsWith(ap)));
    }
  };
  window.setActiveNav();

  // Thai font toggle: shown only on Thai pages, persisted in localStorage.
  // Every page on this site is a Thai page, so it always shows.
  var thaiFontToggleEl = nav.querySelector("#thai-font-toggle");
  window.applyThaiFont = function (font) {
    document.body.setAttribute("data-thai-font", font);
    if (thaiFontToggleEl) {
      thaiFontToggleEl.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-font") === font);
      });
    }
    try { localStorage.setItem("thaiFont", font); } catch (e) {}
  };
  window.updateThaiFont = function () {
    if (thaiFontToggleEl) thaiFontToggleEl.style.display = "";
  };
  if (thaiFontToggleEl) {
    thaiFontToggleEl.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-font]");
      if (btn) window.applyThaiFont(btn.getAttribute("data-font"));
    });
  }
  try {
    window.applyThaiFont(localStorage.getItem("thaiFont") || "sarabun");
  } catch (e) {
    window.applyThaiFont("sarabun");
  }
  window.updateThaiFont();
})();
