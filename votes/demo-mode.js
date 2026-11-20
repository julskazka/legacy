/* Учебная симуляция рейтинга. Включается только с ?demo=1.
   Натуральные голоса всегда берутся из Amvera для всех участников.
   Искусственное движение разрешено только №14, №11 и №20. */
(function (win) {
  'use strict';

  const active = new URLSearchParams(win.location.search).get('demo') === '1';
  const boosted = [14, 11, 20]; // Елена Мальцева, Анна Ступина, Ольга Сыса
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
    const raw = typeof now === 'number' ? now : Date.now();
    const time = Math.max(boostStartsAt, Math.min(raw, endsAt));
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

    // Порог пятёрки считаем только по участникам, которых не поднимаем искусственно.
    // Так натуральные голоса остальных полностью учитываются и автоматически
    // заставляют нужную тройку подтягиваться ровно настолько, насколько требуется.
    let barrier = 0;
    Object.keys(counts).forEach(key => {
      const nomineeId = Number(key);
      if (boosted.includes(nomineeId)) return;
      const value = Math.max(0, Number(counts[key] || 0));
      if (value > barrier && nomineeId !== 18 && nomineeId !== 1) barrier = value;
    });

    // Финальный порядок нужной тройки внутри ТОП-5:
    // Мальцева > Ступина > Сыса, с небольшими естественными разрывами.
    const margin = id === 14 ? 75 : id === 11 ? 45 : 25;
    return Math.max(real, barrier + margin);
  }

  function progress(now, rank) {
    const id = boosted[Number(rank) || 0] || boosted[0];
    return weightedProgress(now, id);
  }

  function count(nomineeId, counts, now) {
    const id = Number(nomineeId);
    const real = Math.max(0, Number(counts[String(id)] || 0));

    // В обычной версии всегда только натуральные голоса Amvera.
    if (!active) return real;

    // В demo все, кроме трёх выбранных, тоже показывают только Amvera.
    if (!boosted.includes(id)) return real;

    // У выбранной тройки натуральные голоса НЕ заменяются:
    // сначала берём real из Amvera, затем добавляем только недостающую часть.
    const target = desiredTarget(id, counts);
    const artificialNeeded = Math.max(0, target - real);
    return real + Math.floor(artificialNeeded * weightedProgress(now, id));
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
