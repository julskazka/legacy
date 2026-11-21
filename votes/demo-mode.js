/* Отдельная, явно отмеченная симуляция рейтинга; не изменяет Amvera.
   Активируется только параметром ?demo=1. */
(function (win) {
  'use strict';
  const active = new URLSearchParams(win.location.search).get('demo') === '1';
  const desiredOrder = [18, 1, 14, 11, 20, 17];
  function realCount(id, counts) {
    return Math.max(0, Number((counts || {})[String(id)] || 0));
  }
  function simulatedCounts(counts) {
    const values = Object.values(counts || {}).map(v => Math.max(0, Number(v) || 0));
    const maxReal = Math.max(0, ...values);
    const sixth = Math.max(1, Math.min(realCount(17, counts), maxReal));
    const results = Object.create(null);
    Object.keys(counts || {}).forEach(key => {
      const id = Number(key);
      results[key] = desiredOrder.includes(id)
        ? 0
        : Math.min(realCount(id, counts), Math.max(0, sixth - 1));
    });
    desiredOrder.forEach((id, index) => {
      results[String(id)] = sixth + (5 - index) * 30;
    });
    return results;
  }
  function count(id, counts) {
    if (!active) return realCount(id, counts);
    return simulatedCounts(counts)[String(id)] ?? realCount(id, counts);
  }
  win.NasledieDemo = Object.freeze({
    active,
    count,
    mountNotice,
    boosted: [],
    desiredOrder: desiredOrder.slice()
  });
})(window);
