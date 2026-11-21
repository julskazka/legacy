/* Test-only fixed display values. Real votes always come from Amvera.
   Active only for ?demo=1; no updates to server vote totals. */
(function (win) {
  'use strict';

  const active = new URLSearchParams(win.location.search).get('demo') === '1';
  // Only nominee 17 is frozen in the separate test display.
  // All other nominee counts are read live from Amvera.
  const fixedCounts = Object.freeze({
    17: 1454
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
