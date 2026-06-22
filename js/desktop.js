(() => {
  'use strict';
  const desktop = document.getElementById('desktop');
  if (!desktop) return;

  const windows = Array.from(desktop.querySelectorAll('.window'));
  const menubar = document.getElementById('menubar');
  const dockMin = document.getElementById('dock-min');
  const dockSep = document.getElementById('dock-sep');

  /* ---- Clock (minute-aligned) ---- */
  const clockEl = document.getElementById('clock');
  function tickClock() {
    if (!clockEl) return;
    const d = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    clockEl.textContent = days[d.getDay()] + ' ' + h + ':' + m + ' ' + ampm;
  }
  function loopClock() {
    tickClock();
    const now = new Date();
    const ms = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 30;
    setTimeout(loopClock, Math.max(1000, ms));
  }
  loopClock();

  /* ---- Mode guard ---- */
  const mq = window.matchMedia('(min-width: 821px)');
  function isDesktopMode() { return mq.matches; }

  /* ---- Focus / z-order ---- */
  let zTop = 10;
  function focusWindow(win) {
    windows.forEach(w => w.classList.remove('active'));
    win.classList.add('active');
    zTop += 1;
    win.style.zIndex = zTop;
  }

  /* ---- Layout engine: measure column flow, then freeze to absolute ----
     This turns the masonry into a real desktop: once frozen, closing or
     minimizing a window leaves a hole instead of repacking the others. */
  function unfreeze(win) {
    win.classList.remove('free', 'zoomed', 'dragging');
    win.style.left = win.style.top = win.style.width = win.style.zIndex = '';
    delete win.dataset.w0;
  }

  function layoutDesktop() {
    if (!isDesktopMode()) {
      windows.forEach(unfreeze);
      desktop.style.height = '';
      return;
    }
    // Only (re)tile windows that are currently on the canvas.
    const live = windows.filter(w =>
      !w.classList.contains('is-closed') && !w.classList.contains('is-min'));
    live.forEach(unfreeze);
    desktop.style.height = '';

    // Pass 1: measure every window's natural column-flow rect.
    const dRect = desktop.getBoundingClientRect();
    const measures = live.map(w => {
      const r = w.getBoundingClientRect();
      return { w, left: r.left - dRect.left, top: r.top - dRect.top, width: r.width, height: r.height };
    });

    // Pass 2: freeze geometry (width + left), grouping windows by column.
    // CSS multi-column balancing leaves uneven gaps between stacked windows
    // (e.g. 22px in a full column, ~40px in a shorter one), so we re-stack
    // each column to a uniform gap below.
    const GAP = 22;
    const cols = new Map();
    measures.forEach(m => {
      m.w.classList.add('free');
      m.w.style.left = m.left + 'px';
      m.w.style.width = m.width + 'px';
      m.w.style.top = m.top + 'px';
      const key = Math.round(m.left);
      if (!cols.has(key)) cols.set(key, []);
      cols.get(key).push(m);
    });

    // Pass 3: re-stack each column using the real frozen heights. Reading
    // offsetHeight after the width is pinned gives the true rendered height,
    // so every inter-window gap lands at exactly GAP (the natural-flow
    // heights can disagree with the frozen render and skew the spacing).
    let maxBottom = 0;
    cols.forEach(list => {
      list.sort((a, b) => a.top - b.top);
      let cursor = null;                       // bottom of the previous window
      list.forEach(m => {
        const top = cursor === null ? m.top : cursor + GAP;
        m.w.style.top = top + 'px';
        cursor = top + m.w.offsetHeight;
        maxBottom = Math.max(maxBottom, cursor);
      });
    });
    desktop.style.height = (maxBottom + 24) + 'px';
  }

  /* ---- Drag (Pointer Events) ---- */
  let dragState = null;
  windows.forEach(win => {
    win.addEventListener('pointerdown', () => focusWindow(win));

    const bar = win.querySelector('.titlebar');
    bar.addEventListener('pointerdown', (e) => {
      if (!isDesktopMode()) return;
      if (e.target.closest('.light')) return;     // traffic lights handled separately
      if (!win.classList.contains('free')) layoutDesktop();
      e.preventDefault();
      dragState = {
        win,
        startX: e.clientX, startY: e.clientY,
        originLeft: parseFloat(win.style.left) || 0,
        originTop: parseFloat(win.style.top) || 0,
        maxLeft: Math.max(0, desktop.clientWidth - win.offsetWidth),
        maxTop: Math.max(0, desktop.clientHeight - win.offsetHeight),
      };
      win.classList.add('dragging');
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!dragState || dragState.win !== win) return;
      let nl = dragState.originLeft + (e.clientX - dragState.startX);
      let nt = dragState.originTop + (e.clientY - dragState.startY);
      nl = Math.max(0, Math.min(nl, dragState.maxLeft));
      nt = Math.max(0, Math.min(nt, dragState.maxTop));
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

  /* ---- Dock: minimized-window tiles ---- */
  function updateDockSep() {
    if (dockSep && dockMin) dockSep.style.display = dockMin.children.length ? '' : 'none';
  }
  function addDockTile(win) {
    if (!dockMin || dockMin.querySelector('[data-win="' + win.id + '"]')) return;
    const title = win.querySelector('.title').textContent;
    const btn = document.createElement('button');
    btn.className = 'dock-min-item';
    btn.setAttribute('data-win', win.id);
    btn.setAttribute('data-label', title);
    btn.setAttribute('aria-label', 'Restore ' + title);
    const text = document.createElement('span');
    text.className = 'dml-text';
    text.textContent = title;
    btn.appendChild(text);
    btn.addEventListener('click', () => openWindow(win));
    dockMin.appendChild(btn);
    updateDockSep();
  }
  function removeDockTile(win) {
    if (!dockMin) return;
    const tile = dockMin.querySelector('[data-win="' + win.id + '"]');
    if (tile) tile.remove();
    updateDockSep();
  }

  /* ---- Traffic-light actions ---- */
  function clampIntoView(win) {
    const maxLeft = Math.max(0, desktop.clientWidth - win.offsetWidth);
    const maxTop = Math.max(0, desktop.clientHeight - win.offsetHeight);
    win.style.left = Math.max(0, Math.min(parseFloat(win.style.left) || 0, maxLeft)) + 'px';
    win.style.top = Math.max(0, Math.min(parseFloat(win.style.top) || 0, maxTop)) + 'px';
  }
  function closeWindow(win) { win.classList.add('is-closed'); rebuildWindowMenu(); }
  function minimizeWindow(win) {
    if (win.classList.contains('is-min')) return;
    win.classList.add('is-min');
    addDockTile(win);
    rebuildWindowMenu();
  }
  function openWindow(win) {
    win.classList.remove('is-closed', 'is-min');
    removeDockTile(win);
    if (isDesktopMode()) {
      if (win.classList.contains('free')) clampIntoView(win);
      else layoutDesktop();
    }
    focusWindow(win);
    win.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    rebuildWindowMenu();
  }
  function zoomWindow(win) {
    if (!isDesktopMode()) return;
    if (!win.classList.contains('free')) layoutDesktop();
    if (win.classList.contains('zoomed')) {
      win.classList.remove('zoomed');
      if (win.dataset.w0) { win.style.width = win.dataset.w0; delete win.dataset.w0; }
    } else {
      win.dataset.w0 = win.style.width;
      const target = Math.min(680, window.innerWidth * 0.9);
      win.style.width = target + 'px';
      win.classList.add('zoomed');
      clampIntoView(win);
    }
    focusWindow(win);
  }

  windows.forEach(win => {
    win.querySelector('.light.close').addEventListener('click', (e) => { e.stopPropagation(); closeWindow(win); });
    win.querySelector('.light.min').addEventListener('click', (e) => { e.stopPropagation(); minimizeWindow(win); });
    win.querySelector('.light.zoom').addEventListener('click', (e) => { e.stopPropagation(); zoomWindow(win); });
  });

  /* ---- Menu bar: inline section shortcuts ---- */
  document.querySelectorAll('.mb-item[data-focus]').forEach(btn => {
    btn.addEventListener('click', () => {
      const win = document.getElementById(btn.dataset.focus);
      if (win) openWindow(win);
    });
  });

  /* ---- Window dropdown (shown only when the inline menu is collapsed) ---- */
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
    if (!winMenuList) return;
    const open = force !== undefined ? force : !winMenuList.classList.contains('open');
    winMenuList.classList.toggle('open', open);
    if (open && winMenuBtn) winMenuList.style.left = winMenuBtn.getBoundingClientRect().left + 'px';
  }
  if (winMenuBtn) {
    winMenuList = document.createElement('ul');
    winMenuList.id = 'window-menu-list';
    document.body.appendChild(winMenuList);
    rebuildWindowMenu();
    winMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleWinMenu(); });
    document.addEventListener('click', () => toggleWinMenu(false));
  }

  /* ---- Collapse the inline menu to a single "Window" dropdown when it
         no longer fits the menu bar width ---- */
  function syncMenu() {
    if (!menubar) return;
    menubar.classList.remove('collapsed');
    if (menubar.scrollWidth > menubar.clientWidth + 1) {
      menubar.classList.add('collapsed');
    }
  }

  /* ---- Init + re-layout triggers ---- */
  function refresh() { layoutDesktop(); syncMenu(); }

  // Hide the canvas while booting: the serif body font loads with
  // `font-display: swap`, so the page first paints with fallback metrics
  // (different window heights) and our absolute pins briefly mismatch it
  // — e.g. a taller window above overlapping the one below. We lay out once
  // now, then again once the real fonts are applied, and only then reveal.
  desktop.classList.add('booting');
  let revealed = false;
  function reveal() { if (revealed) return; revealed = true; desktop.classList.remove('booting'); }

  refresh();
  if (windows[0]) focusWindow(windows[0]);

  // Authoritative layout + reveal happen once the real fonts are in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { refresh(); reveal(); });
  } else {
    refresh(); reveal();
  }
  // Re-layout on full load (late images, cached fonts) without gating reveal on it.
  window.addEventListener('load', refresh);
  // Safety net: never stay hidden if the fonts promise stalls.
  setTimeout(() => { refresh(); reveal(); }, 1500);

  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(refresh, 120); });

  /* ---- Self-heal: re-stack when a window's height changes after the freeze.
         Frozen windows are pinned to absolute coords, so anything that grows a
         window *after* layout — lazy content, or browser extensions injecting
         badges (e.g. EasyScholar adding impact-factor tags to publications) —
         would otherwise let a taller window crowd the one pinned below it.
         A ResizeObserver re-runs the layout so the column re-stacks to a clean
         gap. Re-stacking only moves windows (no size change), so it can't loop;
         we debounce it and skip while a drag is in progress. ---- */
  if (window.ResizeObserver) {
    let ro_t;
    const ro = new ResizeObserver((entries) => {
      if (dragState) return;                 // don't fight an active drag
      // Only a window resting in its column should re-stack. Ignore size
      // changes we caused ourselves — the 0x0 collapse from close/minimize
      // (must leave a hole, not repack) and the width change from zoom/drag
      // (must persist, not snap back to the column).
      const live = entries.some(e => {
        const c = e.target.classList;
        return !c.contains('is-closed') && !c.contains('is-min')
            && !c.contains('zoomed') && !c.contains('dragging');
      });
      if (!live) return;
      clearTimeout(ro_t);
      ro_t = setTimeout(() => { if (!dragState) refresh(); }, 150);
    });
    windows.forEach(w => ro.observe(w));
  }

  window.__aqua = { desktop, windows, focusWindow, layoutDesktop, openWindow, minimizeWindow, closeWindow };
})();
