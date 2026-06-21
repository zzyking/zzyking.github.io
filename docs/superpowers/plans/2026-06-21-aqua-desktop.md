# Aqua Desktop Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the single-column "paper" homepage into an interactive Mac OS X (Aqua) desktop: each résumé section becomes a draggable Aqua window, packed in a masonry bento, under a translucent menu bar and above a reflective Dock.

**Architecture:** Static, no-build, vanilla JS. `#desktop` uses **CSS columns** for masonry packing (3→2→1 columns by breakpoint). Dragging a window's title bar **frees** it to absolute positioning (coords captured at grab time) so it floats above the column flow — no hardcoded coordinates, naturally responsive. A `WindowManager` tracks focus/z-order and open/min/zoom/close state; a `DragController` handles pointer dragging. Window title bars display the section name, so the in-body `<h2>` becomes visually-hidden (kept for a11y). Content typography is reused from `css/style.css`; chrome lives in new `css/desktop.css` + `js/desktop.js`.

**Tech Stack:** HTML, CSS (gradients, columns, backdrop-filter), vanilla JS (Pointer Events, setInterval). Verification via Playwright scripts (no unit-test framework in this repo).

**Branch:** `redesign/aqua-desktop` (already created).

---

## Verification harness (used by every task)

No test runner exists. Use Playwright. Chromium is already installed for the npx-cached Playwright at:
`/Users/king/.npm/_npx/9833c18b2d85bc59/node_modules/playwright`

Create `/tmp/shot_aqua.cjs` once (not committed):

```js
const PW = '/Users/king/.npm/_npx/9833c18b2d85bc59/node_modules/playwright';
const { chromium } = require(PW);
(async () => {
  const url = 'file:///Users/king/Documents/GitHub/zzyking.github.io/index.html';
  const b = await chromium.launch();
  const wide = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 });
  await wide.goto(url, { waitUntil: 'networkidle' }).catch(()=>{});
  await wide.waitForTimeout(1200);
  await wide.screenshot({ path: '/tmp/aqua_wide.png', fullPage: true });
  const mob = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await mob.goto(url, { waitUntil: 'networkidle' }).catch(()=>{});
  await mob.waitForTimeout(1200);
  await mob.screenshot({ path: '/tmp/aqua_mobile.png', fullPage: true });
  await b.close();
  console.log('shots: /tmp/aqua_wide.png /tmp/aqua_mobile.png');
})();
```

Run: `node /tmp/shot_aqua.cjs` then Read the PNGs to judge. Functional checks use locator APIs only (`textContent`, `boundingBox`, `isVisible`, `getAttribute`, `count`, `innerText`) — never page-script evaluation, which the repo's security hook rejects.

---

## File Structure

- **Modify** `index.html` — replace `<main class="paper">…</main>` with: `#menubar`, `#desktop` (7 `.window`s), `#dock`. Keep `<head>` links (+ add `desktop.css`, `desktop.js`). Keep visit-ping `<script>`.
- **Create** `css/desktop.css` — wallpaper, menu bar, dock, window chrome (Aqua title bar + traffic lights), masonry/free positioning, responsive.
- **Modify** `css/style.css` — neutralize old page shell (`body` centering/dark bg, `.paper`, `.vintage-footer` if dropped); KEEP content rules (`h2`, `h3.subheading`, `.entry`, `.news`, `.tech-badge`, `.about-personal`, links, `.me`, etc.). Add `.visually-hidden`.
- **Create** `js/desktop.js` — clock, WindowManager, DragController, traffic-light actions, Window menu, responsive guard.

Reused as-is: `fonts/`, `images/icon-*.svg`, `images/*texture*.png`, `css/textures.css`.

---

## Task 1: Restructure index.html into the desktop shell

**Files:**
- Modify: `index.html`
- Create: `css/desktop.css` (empty), `js/desktop.js` (empty)

- [ ] **Step 1: Create empty new asset files**

```bash
cd /Users/king/Documents/GitHub/zzyking.github.io
: > css/desktop.css
: > js/desktop.js
```

- [ ] **Step 2: Add new asset link in `<head>`**

In `index.html`, after the existing `<link rel="stylesheet" href="css/style.css">` line, add:

```html
  <link rel="stylesheet" href="css/desktop.css">
```

- [ ] **Step 3: Replace the page body structure**

Replace the entire `<body> … </body>`. The pattern for EVERY window is identical — title bar (3 lights + centered title) then a `.window-body` wrapping the OLD section content **with its `<h2>` given `class="visually-hidden"`** (the title bar now shows the name). Keep `h3.subheading`, `.entry`, `.news`, lists, badges exactly as they are.

Full content shown for About + News; windows 3–7 follow the same wrap (see Step 3b):

```html
<body>
  <div id="menubar">
    <span class="mb-apple" aria-hidden="true"></span>
    <span class="mb-name">Zeyuan Zang</span>
    <nav class="mb-menus" aria-label="Sections">
      <button class="mb-item" data-focus="win-about">About</button>
      <button class="mb-item" data-focus="win-pubs">Research</button>
      <button class="mb-item" data-focus="win-projects">Projects</button>
      <button class="mb-item mb-window-menu" aria-haspopup="true">Window &#9662;</button>
    </nav>
    <span class="mb-spacer"></span>
    <span class="mb-clock" id="clock" aria-live="off">--:--</span>
  </div>

  <main id="desktop">

    <section class="window" id="win-about" aria-labelledby="about-heading">
      <div class="titlebar">
        <span class="lights"><button class="light close" aria-label="Close About"></button><button class="light min" aria-label="Minimize About"></button><button class="light zoom" aria-label="Zoom About"></button></span>
        <span class="title">About Me</span>
      </div>
      <div class="window-body">
        <h2 id="about-heading" class="visually-hidden">About Me</h2>
        <p class="about-subtitle">B.Eng. Student @ BUPT &nbsp;&#8226;&nbsp; Incoming Ph.D. @ ZGCA</p>
        <p>
          I am a 4<sup>th</sup>-year undergraduate student majoring in Computer Science and Technology at the
          <strong><a href="https://future.bupt.edu.cn/" target="_blank">School of Future</a>, Beijing University of Posts and Telecommunications (BUPT)</strong>, currently
          conducting research on Large Vision-Language Models (LVLMs) at the Center of Intelligence Science and Technology
          (CIST), advised by <strong>Prof. Xiaojie Wang</strong>.
        </p>
        <p style="margin-bottom: -5px">My current research interests include:</p>
        <ul>
          <li>Boosting reasoning abilities of Large Vision-Language Models (LVLMs)</li>
          <li>Vision-Language representation learning</li>
          <li>Novel architectures inspired by cognitive heuristics</li>
          <li>Improving LVLMs' reliability with high-quality data</li>
        </ul>
        <p class="about-personal">
          Outside the lab, I am a classical music enthusiast and enjoy tennis and golf.
        </p>
      </div>
    </section>

    <section class="window" id="win-news" aria-labelledby="news-heading">
      <div class="titlebar">
        <span class="lights"><button class="light close" aria-label="Close News"></button><button class="light min" aria-label="Minimize News"></button><button class="light zoom" aria-label="Zoom News"></button></span>
        <span class="title">News</span>
      </div>
      <div class="window-body">
        <h2 id="news-heading" class="visually-hidden">News</h2>
        <ul class="news">
          <li><span class="news-date">2026.01</span> <span class="news-text">Joined <a href="https://www.bjzgca.edu.cn/en/" target="_blank">Zhongguancun Academy</a> as a research intern, working on multimodal post-training data synthesis for physics.</span></li>
          <li><span class="news-date">2025.09</span> <span class="news-text">Admitted to the direct Ph.D. program at <a href="https://www.bjzgca.edu.cn/en/" target="_blank">Zhongguancun Academy</a>.</span></li>
          <li><span class="news-date">2025.09</span> <span class="news-text"><em>Reading Images Like Texts</em> accepted to <strong>ICLR 2026</strong>.</span></li>
          <li><span class="news-date">2025.07</span> <span class="news-text"><em>VL-DynaRefine</em> accepted to <strong>ACM MM 2025</strong>; HADAR on display at WSIS+20 &amp; AI for Good Summit, Geneva.</span></li>
        </ul>
      </div>
    </section>

    <!-- windows 3-7 inserted here (Step 3b) -->

  </main>

  <nav id="dock" aria-label="Links">
    <a class="dock-item" href="mailto:zangzeyuan@bupt.edu.cn" data-label="Email"><i class="fa-solid fa-envelope"></i></a>
    <a class="dock-item" href="https://github.com/zzyking" target="_blank" rel="noopener noreferrer" data-label="GitHub"><i class="fa-brands fa-github"></i></a>
    <a class="dock-item" href="https://scholar.google.com/citations?user=flMNVJcAAAAJ" target="_blank" rel="noopener noreferrer" data-label="Scholar"><i class="fa-brands fa-google-scholar"></i></a>
    <a class="dock-item" href="https://twitter.com/KingZang2" target="_blank" rel="noopener noreferrer" data-label="X"><i class="fa-brands fa-x-twitter"></i></a>
    <a class="dock-item" href="https://www.linkedin.com/in/zeyuan-zang-958b67279/" target="_blank" rel="noopener noreferrer" data-label="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>
    <a class="dock-item" href="http://kingz.space/" target="_blank" rel="noopener noreferrer" data-label="kingz.space">
      <svg class="kz-icon" viewBox="0 0 270 270" fill="none" aria-hidden="true"><path d="M86.4004 11H183.6C198.902 11 209.718 11.0086 218.171 11.6992C226.495 12.3793 231.555 13.6656 235.521 15.6865C243.612 19.8091 250.191 26.3875 254.313 34.4785C256.334 38.445 257.621 43.5049 258.301 51.8291C258.991 60.2818 259 71.0977 259 86.4004V183.6C259 198.902 258.991 209.718 258.301 218.171C257.621 226.495 256.334 231.555 254.313 235.521C250.191 243.612 243.612 250.191 235.521 254.313C231.555 256.334 226.495 257.621 218.171 258.301C209.718 258.991 198.902 259 183.6 259H86.4004C71.0977 259 60.2818 258.991 51.8291 258.301C43.5049 257.621 38.445 256.334 34.4785 254.313C26.3875 250.191 19.8091 243.612 15.6865 235.521C13.6656 231.555 12.3793 226.495 11.6992 218.171C11.0086 209.718 11 198.902 11 183.6V86.4004C11 71.0977 11.0086 60.2818 11.6992 51.8291C12.3793 43.5049 13.6656 38.445 15.6865 34.4785C19.8091 26.3875 26.3875 19.8091 34.4785 15.6865C38.445 13.6656 43.5049 12.3793 51.8291 11.6992C60.2818 11.0086 71.0977 11 86.4004 11Z" stroke="currentColor" stroke-width="22"/><path d="M203.662 47.4344C217.8 47.4336 227.119 62.0689 221.269 74.8378L202.651 105.951L202.544 106.135L180.255 145.067L142.078 210.32L139.519 214.469C132.965 225.089 117.979 226.277 109.834 216.821L109.693 216.66L52.7805 153.134C45.0224 144.474 45.7405 131.168 54.3854 123.393L54.5517 123.243L107.474 71.5999C118.169 61.1636 122.303 57.2257 126.94 54.4383C131.278 51.8307 135.995 49.9104 140.921 48.7469C146.186 47.5032 151.895 47.4353 166.838 47.4353L194.5 47.4347L203.662 47.4344Z" stroke="currentColor" stroke-width="22"/></svg>
    </a>
  </nav>

  <script src="js/desktop.js"></script>
  <script>
    (function () {
      var endpoint = "https://zzyking-visit-log.zangking001.workers.dev/img/p";
      var params = new URLSearchParams({ path: window.location.pathname, ref: document.referrer || "", ts: String(Date.now()) });
      var img = new Image();
      img.src = endpoint + "?" + params.toString();
      window.__visitPing = img;
    })();
  </script>
</body>
```

- [ ] **Step 3b: Insert windows 3–7 by wrapping the existing content**

For each remaining section in the committed `index.html` (commit `78ec020`), copy its inner HTML verbatim into a `.window-body`, set the outer tag to `<section class="window" id="…" aria-labelledby="…">`, set its `<h2>` to `class="visually-hidden"`, and prepend the matching `.titlebar`. Use these ids/titles:

| id | title | source section |
|---|---|---|
| `win-pubs` | Research & Publications | "Research & Publications" (keep `h3.subheading` "Research Grants" + all `.entry`) |
| `win-experience` | Research Experience | "Research Experience" (5 `.entry`) |
| `win-projects` | Selected Projects | "Selected Projects" (3 `.entry`) |
| `win-education` | Education | "Education" (2 `.entry`) |
| `win-tech` | Tech Stack | "Tech Stack" (`.skills-grid` + all `.tech-badge`) |

Title bar template (swap NAME twice):

```html
      <div class="titlebar">
        <span class="lights"><button class="light close" aria-label="Close NAME"></button><button class="light min" aria-label="Minimize NAME"></button><button class="light zoom" aria-label="Zoom NAME"></button></span>
        <span class="title">NAME</span>
      </div>
```

- [ ] **Step 4: Verify content parity**

Run: `node /tmp/shot_aqua.cjs` → Read `/tmp/aqua_wide.png`. Expected: all 7 sections' text present (unstyled/stacked is fine here — no desktop.css rules yet). Confirm nothing was dropped vs the previous version.

- [ ] **Step 5: Commit**

```bash
git add index.html css/desktop.css js/desktop.js
git commit -m "Restructure homepage into desktop window shell"
```

---

## Task 2: Wallpaper + base desktop & window layout (CSS)

**Files:**
- Modify: `css/desktop.css`, `css/style.css`

- [ ] **Step 1: Neutralize the old page shell in `css/style.css`**

Replace the `body { … }` rule (the one with flex centering + dark background, after the `@font-face` blocks) with:

```css
body {
    margin: 0;
    padding: 0;
    min-height: 100vh;
    font-family: "Linux Libertine", "Linux Libertine O", "Georgia", "Times New Roman", "Noto Serif CJK SC", serif;
    color: var(--text-main);
}
```

Add a visually-hidden utility at the end of `style.css`:

```css
.visually-hidden {
    position: absolute !important;
    width: 1px; height: 1px;
    margin: -1px; padding: 0; border: 0;
    clip: rect(0 0 0 0); clip-path: inset(50%);
    overflow: hidden; white-space: nowrap;
}
```

Leave `.paper`, `body::after`, `.vintage-footer` rules in place for now (unused; removed in Task 9).

- [ ] **Step 2: Write base desktop + window CSS in `css/desktop.css`**

```css
/* ===== Aqua Desktop ===== */
:root {
  --mb-h: 26px;      /* menu bar height */
  --dock-h: 78px;    /* dock reserve at bottom */
}

html, body { background: #0a3a8c; }

/* Aqua blue wallpaper */
body {
  min-height: 100vh;
  background:
    radial-gradient(120% 90% at 50% -10%, #8fc2ff 0%, #2f7be0 38%, #1858b8 70%, #0e3f93 100%) fixed;
  background-color: #1858b8;
}
/* vignette */
body::before {
  content: ""; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: radial-gradient(circle, transparent 45%, rgba(0,0,0,0.45) 100%);
}

/* Desktop canvas: masonry via CSS columns */
#desktop {
  position: relative;
  z-index: 1;
  column-count: 3;
  column-gap: 22px;
  max-width: 1320px;
  margin: 0 auto;
  padding: calc(var(--mb-h) + 22px) 22px calc(var(--dock-h) + 22px);
  box-sizing: border-box;
}

/* Window box */
.window {
  display: block;
  break-inside: avoid;
  margin: 0 0 22px;
  background: #f7f4ea;               /* warm paper body */
  background-image: var(--paper-texture-img);
  border: 1px solid rgba(0,0,0,0.35);
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.25);
  overflow: hidden;
}

/* Freed (dragged) windows float above the column flow */
.window.free {
  position: absolute;
  margin: 0;
  width: var(--w, 360px);
  z-index: var(--z, 10);
}

.window-body { padding: 16px 20px 20px; }
.window-body > :first-child { margin-top: 0; }
.window-body .about-subtitle {
  margin: 0 0 12px; text-align: center; font-style: italic;
  color: var(--text-meta); font-family: "Georgia", serif;
}
```

- [ ] **Step 3: Verify**

Run: `node /tmp/shot_aqua.cjs` → Read `/tmp/aqua_wide.png`. Expected: blue Aqua wallpaper; 7 warm windows packed into 3 masonry columns filling the width (no title bars yet). `/tmp/aqua_mobile.png` will look cramped (fixed in Task 8) — acceptable now.

- [ ] **Step 4: Commit**

```bash
git add css/desktop.css css/style.css
git commit -m "Add Aqua wallpaper and masonry window layout"
```

---

## Task 3: Window chrome — Aqua title bar + traffic lights (CSS)

**Files:**
- Modify: `css/desktop.css`

- [ ] **Step 1: Append title bar + traffic-light CSS**

```css
/* Title bar (Aqua pinstripe) */
.titlebar {
  position: relative;
  display: flex; align-items: center;
  height: 22px; padding: 0 10px;
  cursor: grab; user-select: none;
  background:
    repeating-linear-gradient(180deg, rgba(255,255,255,0.55) 0 1px, rgba(255,255,255,0) 1px 2px),
    linear-gradient(to bottom, #f6f6f6, #d7d7d7);
  border-bottom: 1px solid rgba(0,0,0,0.28);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
}
.window.dragging .titlebar { cursor: grabbing; }

.titlebar .title {
  position: absolute; left: 0; right: 0; text-align: center;
  font-family: "Lucida Grande", -apple-system, "Helvetica Neue", sans-serif;
  font-size: 12px; font-weight: 600; color: #3a3a3a;
  text-shadow: 0 1px 0 rgba(255,255,255,0.8);
  pointer-events: none;
}

/* Traffic lights */
.lights { position: relative; z-index: 1; display: inline-flex; gap: 8px; }
.light {
  width: 12px; height: 12px; padding: 0; border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.4);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.8), 0 1px 1px rgba(0,0,0,0.2);
  cursor: pointer; background-position: center;
}
.light.close { background: radial-gradient(circle at 35% 30%, #ff9a93, #e0463b 70%); }
.light.min   { background: radial-gradient(circle at 35% 30%, #ffd479, #e0a02a 70%); }
.light.zoom  { background: radial-gradient(circle at 35% 30%, #9fe88a, #3da12f 70%); }
.light:focus-visible { outline: 2px solid rgba(255,255,255,0.9); outline-offset: 1px; }

/* Inactive window: desaturate title bar + dim lights */
.window:not(.active) .titlebar { background: linear-gradient(to bottom, #eee, #dcdcdc); }
.window:not(.active) .light { filter: saturate(0.25) opacity(0.7); }

/* Active window lift */
.window.active { box-shadow: 0 16px 40px rgba(0,0,0,0.45), 0 3px 10px rgba(0,0,0,0.3); }

/* Zoomed window: wider when freed */
.window.zoomed.free { width: min(680px, 90vw); }
```

- [ ] **Step 2: Verify**

Run: `node /tmp/shot_aqua.cjs` → Read `/tmp/aqua_wide.png`. Expected: every window has a pinstriped title bar, centered title, and three gel lights (red/amber/green) at left. (All look "inactive" until JS sets `.active` — fine.)

- [ ] **Step 3: Commit**

```bash
git add css/desktop.css
git commit -m "Add Aqua title bar and traffic-light window chrome"
```

---

## Task 4: Menu bar + live clock (CSS + JS)

**Files:**
- Modify: `css/desktop.css`, `js/desktop.js`

- [ ] **Step 1: Append menu bar CSS**

```css
/* Menu bar */
#menubar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
  height: var(--mb-h);
  display: flex; align-items: center; gap: 14px; padding: 0 12px;
  font-family: "Lucida Grande", -apple-system, "Helvetica Neue", sans-serif;
  font-size: 13px; color: #1c1c1c;
  background: linear-gradient(to bottom, rgba(255,255,255,0.92), rgba(232,232,232,0.86));
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(0,0,0,0.25);
  box-shadow: 0 1px 0 rgba(255,255,255,0.7);
}
.mb-apple { font-family: -apple-system, "Helvetica Neue", sans-serif; font-size: 15px; }
.mb-name { font-weight: 700; }
.mb-menus { display: flex; gap: 4px; }
.mb-item { font: inherit; color: inherit; background: none; border: 0; padding: 2px 8px; border-radius: 4px; cursor: pointer; }
.mb-item:hover { background: #3b73ff; color: #fff; }
.mb-spacer { flex: 1; }
.mb-clock { font-variant-numeric: tabular-nums; }

/* Window menu dropdown */
.mb-window-menu { position: relative; }
#window-menu-list {
  position: fixed; top: var(--mb-h); z-index: 1001;
  min-width: 180px; padding: 4px;
  background: rgba(245,245,245,0.97);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  border: 1px solid rgba(0,0,0,0.25); border-top: 0;
  border-radius: 0 0 6px 6px; box-shadow: 0 8px 20px rgba(0,0,0,0.3);
  list-style: none; margin: 0; display: none;
}
#window-menu-list.open { display: block; }
#window-menu-list button {
  display: flex; justify-content: space-between; gap: 12px; width: 100%;
  font: inherit; text-align: left; background: none; border: 0;
  padding: 5px 10px; border-radius: 4px; cursor: pointer; color: #1c1c1c;
}
#window-menu-list button:hover { background: #3b73ff; color: #fff; }
#window-menu-list .wm-state { opacity: 0.6; font-size: 11px; }
```

- [ ] **Step 2: Start `js/desktop.js` with an init guard + clock**

```js
(() => {
  'use strict';
  const desktop = document.getElementById('desktop');
  if (!desktop) return;

  /* ---- Clock ---- */
  const clockEl = document.getElementById('clock');
  function tickClock() {
    if (!clockEl) return;
    const d = new Date();
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    clockEl.textContent = days[d.getDay()] + ' ' + h + ':' + m + ' ' + ampm;
  }
  tickClock();
  setInterval(tickClock, 10000);

  /* later tasks append here, inside this IIFE */
  window.__aqua = { desktop };
})();
```

- [ ] **Step 3: Verify clock renders**

Create `/tmp/check_clock.cjs`:

```js
const PW = '/Users/king/.npm/_npx/9833c18b2d85bc59/node_modules/playwright';
const { chromium } = require(PW);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file:///Users/king/Documents/GitHub/zzyking.github.io/index.html', { waitUntil: 'networkidle' }).catch(()=>{});
  await p.waitForTimeout(800);
  const txt = await p.locator('#clock').textContent();
  console.log('clock =', JSON.stringify(txt));
  await b.close();
  if (!/\d{1,2}:\d{2}\s(AM|PM)/.test(txt)) { console.error('CLOCK FAIL'); process.exit(1); }
  console.log('CLOCK OK');
})();
```

Run: `node /tmp/check_clock.cjs`. Expected: prints a real time and `CLOCK OK`. Also run `node /tmp/shot_aqua.cjs` and Read `/tmp/aqua_wide.png`: menu bar pinned at top with apple glyph + name + items + clock.

- [ ] **Step 4: Commit**

```bash
git add css/desktop.css js/desktop.js
git commit -m "Add Aqua menu bar with live clock"
```

---

## Task 5: Dock (CSS)

**Files:**
- Modify: `css/desktop.css`

- [ ] **Step 1: Append Dock CSS**

```css
/* Dock */
#dock {
  position: fixed; left: 50%; bottom: 10px; transform: translateX(-50%);
  z-index: 1000;
  display: flex; align-items: flex-end; gap: 10px; padding: 8px 12px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(210,224,245,0.4));
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.6);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.8);
}
.dock-item {
  position: relative; width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  color: #1b3a6b; text-decoration: none; border-radius: 11px;
  border: 1px solid rgba(0,0,0,0.12);
  background: linear-gradient(to bottom, #ffffff, #dfe7f2);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.25);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}
.dock-item i { font-size: 22px; }
.dock-item .kz-icon { width: 22px; height: 22px; }
.dock-item:hover {
  transform: translateY(-10px) scale(1.18);
  box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 8px 16px rgba(0,0,0,0.3);
}
.dock-item::after {
  content: attr(data-label);
  position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
  padding: 2px 8px; font-family: "Lucida Grande", -apple-system, sans-serif; font-size: 11px;
  color: #fff; background: rgba(0,0,0,0.75); border-radius: 5px; white-space: nowrap;
  opacity: 0; pointer-events: none; transition: opacity 0.12s ease;
}
.dock-item:hover::after { opacity: 1; }
```

- [ ] **Step 2: Verify**

Run: `node /tmp/shot_aqua.cjs` → Read `/tmp/aqua_wide.png`. Expected: glossy translucent Dock centered at the bottom with 6 gel icon tiles.

- [ ] **Step 3: Commit**

```bash
git add css/desktop.css
git commit -m "Add reflective Aqua Dock with contact tiles"
```

---

## Task 6: Drag + click-to-focus (JS)

**Files:**
- Modify: `js/desktop.js`

- [ ] **Step 1: Append WindowManager + DragController inside the IIFE** (replace the `window.__aqua = { desktop };` line with the block below, which ends with an updated export)

```js
  /* ---- Window manager (focus / z-order) ---- */
  const windows = Array.from(desktop.querySelectorAll('.window'));
  let zTop = 10;

  function focusWindow(win) {
    windows.forEach(w => w.classList.remove('active'));
    win.classList.add('active');
    zTop += 1;
    win.style.setProperty('--z', zTop);
    if (win.classList.contains('free')) win.style.zIndex = zTop;
  }

  // free a column-flow window into absolute positioning at its current spot
  function freeWindow(win) {
    if (win.classList.contains('free')) return;
    const dRect = desktop.getBoundingClientRect();
    const wRect = win.getBoundingClientRect();
    const left = wRect.left - dRect.left + desktop.scrollLeft;
    const top = wRect.top - dRect.top + desktop.scrollTop;
    win.style.setProperty('--w', wRect.width + 'px');
    win.classList.add('free');
    win.style.left = left + 'px';
    win.style.top = top + 'px';
  }

  windows.forEach(win => {
    win.addEventListener('mousedown', () => focusWindow(win), true);
  });

  /* ---- Drag controller (Pointer Events) ---- */
  let dragState = null;
  function isDraggable() { return window.matchMedia('(min-width: 821px)').matches; }

  windows.forEach(win => {
    const bar = win.querySelector('.titlebar');
    bar.addEventListener('pointerdown', (e) => {
      if (!isDraggable()) return;
      if (e.target.closest('.light')) return;   // lights handled separately
      e.preventDefault();
      focusWindow(win);
      freeWindow(win);
      dragState = {
        win,
        startX: e.clientX, startY: e.clientY,
        originLeft: parseFloat(win.style.left) || 0,
        originTop: parseFloat(win.style.top) || 0,
        maxLeft: desktop.clientWidth - win.offsetWidth,
      };
      win.classList.add('dragging');
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!dragState || dragState.win !== win) return;
      let nl = dragState.originLeft + (e.clientX - dragState.startX);
      let nt = dragState.originTop + (e.clientY - dragState.startY);
      nl = Math.max(0, Math.min(nl, Math.max(0, dragState.maxLeft)));
      nt = Math.max(0, nt);
      win.style.left = nl + 'px';
      win.style.top = nt + 'px';
    });
    function endDrag(e) {
      if (!dragState || dragState.win !== win) return;
      win.classList.remove('dragging');
      try { bar.releasePointerCapture(e.pointerId); } catch (_) {}
      dragState = null;
    }
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);
  });

  if (windows[0]) focusWindow(windows[0]);   // focus first window on load

  window.__aqua = { desktop, windows, focusWindow, freeWindow };
```

- [ ] **Step 2: Verify drag + focus functionally**

Create `/tmp/check_drag.cjs`:

```js
const PW = '/Users/king/.npm/_npx/9833c18b2d85bc59/node_modules/playwright';
const { chromium } = require(PW);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto('file:///Users/king/Documents/GitHub/zzyking.github.io/index.html', { waitUntil: 'networkidle' }).catch(()=>{});
  await p.waitForTimeout(800);
  const win = p.locator('#win-news');
  const bar = p.locator('#win-news .titlebar');
  const before = (await win.boundingBox()).x;
  const box = await bar.boundingBox();
  await p.mouse.move(box.x + 40, box.y + 11);
  await p.mouse.down();
  await p.mouse.move(box.x + 240, box.y + 160, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(200);
  const cls = await win.getAttribute('class');
  const after = (await win.boundingBox()).x;
  await b.close();
  const freed = cls.includes('free'), active = cls.includes('active');
  console.log({ freed, active, before, after });
  if (!freed || !active || Math.abs(after - before) < 50) { console.error('DRAG FAIL'); process.exit(1); }
  console.log('DRAG OK');
})();
```

Run: `node /tmp/check_drag.cjs`. Expected: `freed:true, active:true`, moved by at least 50px, prints `DRAG OK`.

- [ ] **Step 3: Commit**

```bash
git add js/desktop.js
git commit -m "Add window drag and click-to-focus"
```

---

## Task 7: Traffic-light actions + Window menu (JS + CSS)

**Files:**
- Modify: `js/desktop.js`, `css/desktop.css`

- [ ] **Step 1: Append actions inside the IIFE** (insert after the drag block, immediately before the `window.__aqua = …` export line)

```js
  /* ---- Traffic-light actions ---- */
  function closeWindow(win) { win.classList.add('is-closed'); rebuildWindowMenu(); }
  function openWindow(win) { win.classList.remove('is-closed', 'is-min'); focusWindow(win); rebuildWindowMenu(); }
  function minimizeWindow(win) { win.classList.add('is-min'); rebuildWindowMenu(); }
  function zoomWindow(win) {
    if (!win.classList.contains('free')) freeWindow(win);
    win.classList.toggle('zoomed');
    focusWindow(win);
  }

  windows.forEach(win => {
    win.querySelector('.light.close').addEventListener('click', (e) => { e.stopPropagation(); closeWindow(win); });
    win.querySelector('.light.min').addEventListener('click',   (e) => { e.stopPropagation(); minimizeWindow(win); });
    win.querySelector('.light.zoom').addEventListener('click',  (e) => { e.stopPropagation(); zoomWindow(win); });
  });

  /* ---- Menu bar: focus shortcuts + Window menu ---- */
  document.querySelectorAll('.mb-item[data-focus]').forEach(btn => {
    btn.addEventListener('click', () => {
      const win = document.getElementById(btn.dataset.focus);
      if (win) openWindow(win);
    });
  });

  const winMenuBtn = document.querySelector('.mb-window-menu');
  let winMenuList = null;
  function rebuildWindowMenu() {
    if (!winMenuList) return;
    winMenuList.replaceChildren();
    windows.forEach(win => {
      const title = win.querySelector('.title').textContent;
      const closed = win.classList.contains('is-closed');
      const min = win.classList.contains('is-min');
      const li = document.createElement('li');
      const btn = document.createElement('button');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = title;
      const stateSpan = document.createElement('span');
      stateSpan.className = 'wm-state';
      stateSpan.textContent = closed ? 'closed' : (min ? 'min' : 'open');
      btn.append(nameSpan, stateSpan);
      btn.addEventListener('click', () => { openWindow(win); toggleWinMenu(false); });
      li.appendChild(btn);
      winMenuList.appendChild(li);
    });
  }
  function toggleWinMenu(force) {
    const open = force !== undefined ? force : !winMenuList.classList.contains('open');
    winMenuList.classList.toggle('open', open);
    if (open) { winMenuList.style.left = winMenuBtn.getBoundingClientRect().left + 'px'; }
  }
  if (winMenuBtn) {
    winMenuList = document.createElement('ul');
    winMenuList.id = 'window-menu-list';
    document.body.appendChild(winMenuList);
    rebuildWindowMenu();
    winMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleWinMenu(); });
    document.addEventListener('click', () => toggleWinMenu(false));
  }
```

- [ ] **Step 2: Append closed/min state CSS to `css/desktop.css`**

```css
.window.is-closed { display: none; }
.window.is-min { display: none; }   /* minimized: hidden from canvas, reachable via Window menu */
```

- [ ] **Step 3: Verify actions functionally**

Create `/tmp/check_actions.cjs`:

```js
const PW = '/Users/king/.npm/_npx/9833c18b2d85bc59/node_modules/playwright';
const { chromium } = require(PW);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto('file:///Users/king/Documents/GitHub/zzyking.github.io/index.html', { waitUntil: 'networkidle' }).catch(()=>{});
  await p.waitForTimeout(800);
  await p.click('#win-news .light.close');
  const closed = !(await p.locator('#win-news').isVisible());
  await p.click('.mb-window-menu');
  await p.waitForTimeout(150);
  const items = p.locator('#window-menu-list button');
  const n = await items.count();
  let reopened = false;
  for (let i = 0; i < n; i++) {
    const t = await items.nth(i).innerText();
    if (t.includes('News')) { await items.nth(i).click(); reopened = true; break; }
  }
  await p.waitForTimeout(150);
  const visible = await p.locator('#win-news').isVisible();
  await p.click('#win-about .light.zoom');
  const zoomed = (await p.locator('#win-about').getAttribute('class')).includes('zoomed');
  await b.close();
  console.log({ closed, reopened, visible, zoomed });
  if (!closed || !reopened || !visible || !zoomed) { console.error('ACTIONS FAIL'); process.exit(1); }
  console.log('ACTIONS OK');
})();
```

Run: `node /tmp/check_actions.cjs`. Expected: all true, prints `ACTIONS OK`.

- [ ] **Step 4: Commit**

```bash
git add js/desktop.js css/desktop.css
git commit -m "Add traffic-light actions and Window menu"
```

---

## Task 8: Responsive — single-column cards ≤820px (CSS + JS)

**Files:**
- Modify: `css/desktop.css`, `js/desktop.js`

- [ ] **Step 1: Append responsive CSS**

```css
@media (max-width: 1100px) { #desktop { column-count: 2; } }

@media (max-width: 820px) {
  #desktop {
    column-count: 1; max-width: 560px;
    padding: calc(var(--mb-h) + 16px) 14px calc(var(--dock-h) + 16px);
  }
  /* force any freed window back into flow */
  .window.free {
    position: static !important; width: auto !important;
    left: auto !important; top: auto !important; z-index: auto !important;
  }
  .window.zoomed.free { width: auto !important; }
  .titlebar { cursor: default; }
  #menubar .mb-menus { display: none; }     /* name + clock only */
  #dock { gap: 6px; padding: 6px 8px; bottom: 8px; }
  .dock-item { width: 38px; height: 38px; }
  .dock-item i { font-size: 19px; }
  .dock-item:hover { transform: none; }     /* no magnify on touch */
}
```

- [ ] **Step 2: Guard drag/free on resize in `js/desktop.js`**

Add immediately after `function isDraggable() { … }`:

```js
  // Below the breakpoint, collapse any freed windows back to flow.
  function syncResponsive() {
    if (!isDraggable()) {
      windows.forEach(w => {
        w.classList.remove('free', 'zoomed', 'dragging');
        w.style.left = w.style.top = w.style.zIndex = '';
      });
    }
  }
  window.addEventListener('resize', syncResponsive);
  syncResponsive();
```

- [ ] **Step 3: Verify mobile layout + drag disabled**

Run: `node /tmp/shot_aqua.cjs` → Read `/tmp/aqua_mobile.png`. Expected: single column of Aqua cards, menu bar = name + clock only, compact dock, no horizontal overflow.

Create `/tmp/check_mobile.cjs`:

```js
const PW = '/Users/king/.npm/_npx/9833c18b2d85bc59/node_modules/playwright';
const { chromium } = require(PW);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('file:///Users/king/Documents/GitHub/zzyking.github.io/index.html', { waitUntil: 'networkidle' }).catch(()=>{});
  await p.waitForTimeout(600);
  const win = p.locator('#win-news');
  const bar = p.locator('#win-news .titlebar');
  const box = await bar.boundingBox();
  await p.mouse.move(box.x + 30, box.y + 11); await p.mouse.down();
  await p.mouse.move(box.x + 120, box.y + 200, { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(150);
  const freed = (await win.getAttribute('class')).includes('free');
  const vp = p.viewportSize();
  const bodyW = (await p.locator('body').boundingBox()).width;
  const overflow = bodyW > vp.width + 1;
  await b.close();
  console.log({ freed, overflow });
  if (freed || overflow) { console.error('MOBILE FAIL'); process.exit(1); }
  console.log('MOBILE OK');
})();
```

Run: `node /tmp/check_mobile.cjs`. Expected: `freed:false, overflow:false`, prints `MOBILE OK`.

- [ ] **Step 4: Commit**

```bash
git add css/desktop.css js/desktop.js
git commit -m "Add responsive single-column fallback and drag guard"
```

---

## Task 9: Polish, dead-code cleanup, content parity & final verification

**Files:**
- Modify: `css/style.css`, `index.html`

- [ ] **Step 1: Remove dead page-shell rules from `css/style.css`**

Delete the now-unused blocks the desktop replaces: `.paper`, `.paper::before`, `body::after`, and `.vintage-footer*` + `@keyframes heartbeat` (footer was dropped in the restructure). Keep all content rules (`h2`, `h3.subheading`, `.entry*`, `.news*`, `.tech-badge*`, `.about-personal`, `.me`, `sup`, `aside`, link rules). Check whether contact-chip rules are still used: `grep -n "contact-chip\|contact-info" index.html` — if no matches, delete `.contact-info`, `.contact-chip*` rules too.

- [ ] **Step 2: Confirm content parity against the previous version**

```bash
cd /Users/king/Documents/GitHub/zzyking.github.io
git show 78ec020:index.html > /tmp/old.html
python3 -c "import re; t=open('/tmp/old.html').read(); print('old words:', len(re.sub(r'<[^>]+>',' ',t).split()))"
python3 -c "import re; t=open('index.html').read(); print('new words:', len(re.sub(r'<[^>]+>',' ',t).split()))"
```

Expected: counts are close (new slightly higher: title bars + subtitle + menu/dock labels). Skim that all 7 sections, all publications, grants, projects, experience, the HADAR awards lines, and tech badges are present.

- [ ] **Step 3: Final visual + functional pass**

Run: `node /tmp/shot_aqua.cjs`. Read `/tmp/aqua_wide.png` and `/tmp/aqua_mobile.png`. Checklist:
- Wide: blue wallpaper, menu bar + clock, masonry windows fill the width (no large empty bands), Dock at bottom, title bars + lights, first window active-lifted.
- Mobile: single column, no overflow, simplified bar, compact dock.

Re-run all functional checks:

```bash
node /tmp/check_clock.cjs && node /tmp/check_drag.cjs && node /tmp/check_actions.cjs && node /tmp/check_mobile.cjs
```

Expected: all four print `… OK`.

- [ ] **Step 4: Commit**

```bash
git add css/style.css index.html
git commit -m "Remove dead page-shell CSS and finalize Aqua desktop"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** Aqua wallpaper → T2; window chrome/title bar/lights → T3; 7 windows → T1; menu bar + clock → T4; Dock (6 tiles, no CV) → T5; drag + focus → T6; zoom/min/close + Window menu (content never lost) → T7; responsive ≤820px single column → T8; reuse style.css typography + sepia badges + visit-ping → T1–2; a11y visually-hidden h2 + aria-labels → T1–2; JS-off degradation (content lives in normal DOM, not JS-generated) → inherent; no avatar / no CV / Aqua-only → honored; dead-code cleanup → T9. Out-of-scope items (layout persistence, genie animation, graphite) excluded.

**Placeholder scan:** Windows 3–7 use a mechanical "wrap existing content verbatim" instruction with an explicit id/title table and the exact source commit (`78ec020`) — not a vague placeholder. All CSS/JS steps contain complete code.

**Name consistency:** ids `win-about/news/pubs/experience/projects/education/tech`; `data-focus` targets (`win-about/win-pubs/win-projects`) exist. JS fns (`focusWindow/freeWindow/closeWindow/openWindow/minimizeWindow/zoomWindow/rebuildWindowMenu/toggleWinMenu/isDraggable/syncResponsive`) defined once, referenced consistently. CSS classes (`.window/.free/.zoomed/.active/.dragging/.is-closed/.is-min/.titlebar/.lights/.light/.dock-item`) align across HTML/CSS/JS.
