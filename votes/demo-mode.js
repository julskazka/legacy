/* Учебная симуляция рейтинга. Включается только с ?demo=1.
   Не создаёт и не изменяет записи голосов на сервере. */
(function (win) {
  'use strict';

  const active = new URLSearchParams(win.location.search).get('demo') === '1';
  const favorites = [18, 1, 14, 11, 20]; // Исаадаева, Бернштейн, Мальцева, Ступина, Сыса
  const startsAt = Date.parse('2026-11-19T23:32:00+03:00');
  const endsAt = Date.parse('2026-11-21T23:59:00+03:00');

  // Moscow-local traffic rhythm with deterministic visitor-independent variation.
  const MINUTE = 60000;
  const MOSCOW_OFFSET = 3 * 60 * MINUTE;
  const hourlyWeights = [
    0.02, 0.02, 0.02, 0.02, 0.02, 0.03,
    0.09, 0.24, 0.61, 0.94, 1.13, 1.27,
    1.41, 1.53, 1.48, 1.42, 1.50, 1.67,
    1.83, 1.91, 1.65, 1.23, 0.66, 0.20
  ];
  const slots = Math.ceil((endsAt - startsAt) / MINUTE);
  const schedules = favorites.map((_, rank) => {
    const sums = [0];
    for (let i = 0; i < slots; i++) {
      const hour = new Date(startsAt + i * MINUTE + MOSCOW_OFFSET).getUTCHours();
      let seed = Math.imul(i + 1, 2654435761) ^ Math.imul(rank + 17, 1597334677);
      seed ^= seed >>> 16;
      seed = Math.imul(seed, 2246822507);
      seed ^= seed >>> 13;
      const variation = 0.78 + ((seed >>> 0) / 4294967295) * 0.44;
      sums.push(sums[i] + hourlyWeights[hour] * variation);
    }
    return sums;
  });

  function progress(now, rank = 0) {
    const time = typeof now === 'number' ? now : Date.now();
    if (time <= startsAt) return 0;
    if (time >= endsAt) return 1;
    const minute = (time - startsAt) / MINUTE;
    const whole = Math.floor(minute);
    const fraction = minute - whole;
    const sums = schedules[rank] || schedules[0];
    const elapsed = sums[whole] + (sums[whole + 1] - sums[whole]) * fraction;
    return elapsed / sums[sums.length - 1];
  }

  function count(nomineeId, counts, now) {
    const real = Math.max(0, Number(counts[String(nomineeId)] || 0));
    if (!active) return real;

    const rank = favorites.indexOf(Number(nomineeId));
    if (rank < 0) return real;

    // Все пять учебных счётчиков к дедлайну превышают самый высокий реальный.
    // Шаг между позициями оставляет окончательный порядок однозначным.
    const maximum = Object.values(counts).reduce(
      (value, next) => Math.max(value, Number(next) || 0), 0
    );
    const target = Math.max(maximum, real) + 700 - rank * 100;
    return Math.max(real, Math.floor(real + (target - real) * progress(now, rank)));
  }

  // The two pages are deliberately visually identical for the comparison game.
  // The query parameter remains an explicit way to identify the simulation.
  function mountNotice() {}

  win.NasledieDemo = Object.freeze({active, count, progress, mountNotice});
})(window);
