/* Учебная симуляция рейтинга. Включается только с ?demo=1.
   Реальные голоса берутся из Amvera. После контрольной точки искусственное
   движение остаётся только у двух отстающих участников нужной пятёрки. */
(function (win) {
  'use strict';

  const active = new URLSearchParams(win.location.search).get('demo') === '1';

  // Нужная пятёрка: Исаадаева, Бернштейн, Мальцева, Ступина, Сыса.
  const favorites = [18, 1, 14, 11, 20];

  // Искусственно двигаем дальше только двух отстающих.
  const boosted = [11, 20];

  // Последний живой POST /api/vote в выгруженных логах Amvera:
  // 2026-11-20 08:59:34 UTC = 11:59:34 МСК.
  const cutoffAt = Date.parse('2026-11-20T11:59:34+03:00');
  const endsAt = Date.parse('2026-11-21T23:59:00+03:00');

  // До cutoff старая симуляция уже успела добавить примерно столько.
  // Эти добавки фиксируем: они больше не растут у первых трёх.
  const frozenOffsets = {
    18: 76,
    1: 65,
    14: 53,
    11: 43,
    20: 32
  };

  // После cutoff добавочное движение только двум отстающим.
  // Темп небольшой и неровный, ночью почти тишина.
  const extraByDeadline = {
    11: 120,
    20: 190
  };

  const SLOT = 5 * 60 * 1000;
  const MSK_OFFSET = 3 * 60 * 60 * 1000;
  const hourlyWeights = [
    0.01, 0.01, 0.01, 0.01, 0.01, 0.02,
    0.05, 0.12, 0.35, 0.58, 0.74, 0.82,
    0.90, 0.96, 0.92, 0.88, 0.94, 1.00,
    1.05, 1.00, 0.88, 0.66, 0.34, 0.10
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
    const time = Math.max(cutoffAt, Math.min(typeof now === 'number' ? now : Date.now(), endsAt));
    if (time <= cutoffAt) return 0;
    if (time >= endsAt) return 1;

    const totalSlots = Math.ceil((endsAt - cutoffAt) / SLOT);
    const elapsedSlots = Math.floor((time - cutoffAt) / SLOT);
    const partial = ((time - cutoffAt) % SLOT) / SLOT;

    let total = 0;
    let elapsed = 0;

    for (let i = 0; i < totalSlots; i += 1) {
      const at = cutoffAt + i * SLOT;
      const hour = moscowHour(at);
      const jitter = 0.55 + hash(i, nomineeId) * 0.90;
      const quietGap = hash(i + 7919, nomineeId) < 0.38 ? 0.30 : 1;
      const weight = hourlyWeights[hour] * jitter * quietGap;
      total += weight;

      if (i < elapsedSlots) {
        elapsed += weight;
      } else if (i === elapsedSlots) {
        elapsed += weight * partial;
      }
    }

    return total > 0 ? Math.max(0, Math.min(1, elapsed / total)) : 0;
  }

  function progress(now, rank) {
    const nomineeId = boosted[Number(rank) || 0] || boosted[0];
    return weightedProgress(now, nomineeId);
  }

  function count(nomineeId, counts, now) {
    const id = Number(nomineeId);
    const real = Math.max(0, Number(counts[String(id)] || 0));
    if (!active) return real;

    if (!favorites.includes(id)) return real;

    // Сохраняем только ту искусственную прибавку, которая уже была
    // накоплена к последнему живому голосу.
    const frozen = Math.max(0, Number(frozenOffsets[id] || 0));
    let shown = real + frozen;

    // После cutoff искусственное движение есть только у №11 и №20.
    if (boosted.includes(id)) {
      const extra = Math.floor(
        Number(extraByDeadline[id] || 0) * weightedProgress(now, id)
      );
      shown += extra;
    }

    return shown;
  }

  function mountNotice() {}

  win.NasledieDemo = Object.freeze({
    active,
    count,
    progress,
    mountNotice,
    cutoffAt,
    boosted: boosted.slice()
  });
})(window);
