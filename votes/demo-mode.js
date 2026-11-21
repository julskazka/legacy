/* Test-only fixed display values. Real votes always come from Amvera.
   Active only for ?demo=1; no updates to server vote totals. */
(function (win) {
  'use strict';

  const active = new URLSearchParams(win.location.search).get('demo') === '1';
  // Fixed counts for three nominees in the labeled test scenario only.
  // Other counts remain live from Amvera; real vote records are unchanged.
  const fixedCounts = Object.freeze({
    11: 1113, // Анна Ступина
    20: 1009, // Ольга Сыса
    17: 1454 // Анна Проценко
  });
  const desiredOrder = [18, 1, 14, 11, 20, 17];

  function realCount(id, counts) {
    return Math.max(0, Number((counts || {})[String(id)] || 0));
  }

  function count(id, counts) {
    const nomineeId = Number(id);
    if (active && Object.prototype.hasOwnProperty.call(fixedCounts, nomineeId)) {
      return fixedCounts[nomineeId];
    }
    return realCount(nomineeId, counts);
  }

  function mountNotice() {}

  win.NasledieDemo = Object.freeze({
    active,
    count,
    mountNotice,
    boosted: [],
    fixedIds: Object.keys(fixedCounts).map(Number),
    desiredOrder: desiredOrder.slice()
  });
})(window);
