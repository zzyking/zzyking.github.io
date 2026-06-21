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
