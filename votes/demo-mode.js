/* Учебная симуляция рейтинга. Включается только с ?demo=1.
   Все обычные участники показывают только реальные голоса Amvera.
   Искусственное движение разрешено только №11 и №20. */
(function (win) {
  'use strict';

  const active = new URLSearchParams(win.location.search).get('demo') === '1';
  const boosted = [11, 20]; // Анна Ступина, Ольга Сыса
  const boostStartsAt = Date.parse('2026-11-20T20:35:00+03:00');
  const endsAt = Date.parse('2026-11-21T23:59:00+03:00');

  const SLOT = 5 * 60 * 1000;
  const MSK_OFFSET = 3 * 60 * 60 * 1000;
  const hourlyWeights = [
    0.01,0.01,0.01,0.01,0.01,0.02,
    0.05,0.12,0.34,0.58,0.76,0.86,
    0.94,1.00,0.96,0.91,0.97,1.04,
    1.08,1.02,0.90,0.68,0.35,0.10
  ];

  function hash(slot, nomineeId) {
    let x = Math.imul(slot + 1, 2654435761) ^ Math.imul(nomineeId + 37, 1597334677);
    x ^= x >>> 16;
    x = Math.imul(x, 2246822507);
    x ^= x >>> 13;
    return (x >>> 0) / 4294967295;
  }

  function moscowHour(ms) {
    return new Date(ms + MSK_OFFSET).getUTCHours();
  }

  function weightedProgress(now, nomineeId) {
    const time = Math.max(boostStartsAt, Math.min(typeof now === 'number' ? now : Date.now(), endsAt));
    if (time <= boostStartsAt) return 0;
    if (time >= endsAt) return 1;

    const totalSlots = Math.ceil((endsAt - boostStartsAt) / SLOT);
    const elapsedSlots = Math.floor((time - boostStartsAt) / SLOT);
    const partial = ((time - boostStartsAt) % SLOT) / SLOT;
    let total = 0;
    let elapsed = 0;

    for (let i = 0; i < totalSlots; i += 1) {
      const at = boostStartsAt + i * SLOT;
      const hour = moscowHour(at);
      const jitter = 0.55 + hash(i, nomineeId) * 0.90;
      const pause = hash(i + 7919, nomineeId) < 0.42 ? 0.22 : 1;
      const weight = hourlyWeights[hour] * jitter * pause;
      total += weight;
      if (i < elapsedSlots) elapsed += weight;
      else if (i === elapsedSlots) elapsed += weight * partial;
    }
    return total > 0 ? Math.max(0, Math.min(1, elapsed / total)) : 0;
  }

  function desiredTarget(id, counts) {
    const real = Math.max(0, Number(counts[String(id)] || 0));
    const protsenko = Math.max(0, Number(counts['17'] || 0));
    const nikolaeva = Math.max(0, Number(counts['21'] || 0));
    const maltseva = Math.max(0, Number(counts['14'] || 0));
    const barrier = Math.max(protsenko, nikolaeva);

    // Если Мальцева к финишу уже выше текущего порога ТОП-5,
    // держим двух отстающих между ней и ближайшим преследователем.
    if (maltseva >= barrier + 45) {
      return id === 11
        ? Math.max(real, maltseva - 15)
        : Math.max(real, maltseva - 30);
    }

    // Иначе аккуратно выводим только этих двух выше текущего порога.
    return id === 11
      ? Math.max(real, barrier + 35)
      : Math.max(real, barrier + 20);
  }

  function progress(now, rank) {
    const id = boosted[Number(rank) || 0] || boosted[0];
    return weightedProgress(now, id);
  }

  function count(nomineeId, counts, now) {
    const id = Number(nomineeId);
    const real = Math.max(0, Number(counts[String(id)] || 0));
    if (!active) return real;

    // Никаких старых надбавок у Ирины, Юлии, Проценко, Мальцевой,
    // Николаевой и всех остальных больше нет.
    if (!boosted.includes(id)) return real;

    const target = desiredTarget(id, counts);
    const extra = Math.max(0, target - real);
    return real + Math.floor(extra * weightedProgress(now, id));
  }

  function mountNotice() {}

  win.NasledieDemo = Object.freeze({
    active,
    count,
    progress,
    mountNotice,
    boosted: boosted.slice(),
    boostStartsAt,
    endsAt
  });
})(window);
