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
        maxTop: desktop.clientHeight - win.offsetHeight,
      };
      win.classList.add('dragging');
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!dragState || dragState.win !== win) return;
      let nl = dragState.originLeft + (e.clientX - dragState.startX);
      let nt = dragState.originTop + (e.clientY - dragState.startY);
      nl = Math.max(0, Math.min(nl, Math.max(0, dragState.maxLeft)));
      nt = Math.max(0, Math.min(nt, Math.max(0, dragState.maxTop)));
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

  /* ---- Traffic-light actions ---- */
  function closeWindow(win) { win.classList.add('is-closed'); rebuildWindowMenu(); }
  function openWindow(win) {
    win.classList.remove('is-closed', 'is-min');
    if (win.classList.contains('free')) {
      const maxLeft = Math.max(0, desktop.clientWidth - win.offsetWidth);
      const maxTop = Math.max(0, desktop.clientHeight - win.offsetHeight);
      const curLeft = parseFloat(win.style.left) || 0;
      const curTop = parseFloat(win.style.top) || 0;
      win.style.left = Math.max(0, Math.min(curLeft, maxLeft)) + 'px';
      win.style.top = Math.max(0, Math.min(curTop, maxTop)) + 'px';
    }
    focusWindow(win);
    rebuildWindowMenu();
  }
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

  window.__aqua = { desktop, windows, focusWindow, freeWindow };
})();
