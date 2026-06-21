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
})();
