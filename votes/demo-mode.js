/* Test-only fixed display values. Real votes always come from Amvera.
   Active only for ?demo=1; no updates to server vote totals. */
(function (win) {
  'use strict';

  const active = new URLSearchParams(win.location.search).get('demo') === '1';
  const fixedCounts = Object.freeze({
    18: 1575, // Ирина Исаадаева
    1: 1545,  // Юлия Бернштейн
    14: 1515, // Елена Мальцева
    11: 1485, // Анна Ступина
    20: 1455  // Ольга Сыса
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
