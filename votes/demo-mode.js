/* Учебная симуляция рейтинга. Включается только с ?demo=1.
   Не создаёт и не изменяет записи голосов на сервере. */
(function (win) {
  'use strict';

  const active = new URLSearchParams(win.location.search).get('demo') === '1';
  const favorites = [18, 1, 14, 11, 20]; // Исаадаева, Бернштейн, Мальцева, Ступина, Сыса
  const startsAt = Date.parse('2026-11-19T23:32:00+03:00');
  const endsAt = Date.parse('2026-11-21T23:59:00+03:00');

  function progress(now) {
    const time = typeof now === 'number' ? now : Date.now();
    return Math.max(0, Math.min(1, (time - startsAt) / (endsAt - startsAt)));
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
    return Math.max(real, Math.floor(real + (target - real) * progress(now)));
  }

  function mountNotice() {
    if (!active) return;
    const style = win.document.createElement('style');
    style.textContent = '.demo-caption{font-size:13px;line-height:1.45;color:#cbbba7;text-align:center;margin:4px auto 14px;max-width:700px;padding:0 10px}';
    win.document.head.appendChild(style);

    // Keep the educational simulation clearly identified, without a large card.
    const note = win.document.createElement('p');
    note.className = 'demo-caption';
    note.setAttribute('role', 'note');
    note.textContent = 'Демо: счётчики и рейтинг смоделированы.';
    const nomineesHeading = win.document.querySelector('#page-nominees .section-head');
    if (nomineesHeading) nomineesHeading.insertAdjacentElement('afterend', note);

    const rankingSubtitle = win.document.querySelector('.ranking-sub');
    if (rankingSubtitle) {
      rankingSubtitle.textContent = 'Учебная симуляция ТОП-5: результаты изменяются по времени и не являются реальными итогами голосования.';
    }
  }

  win.NasledieDemo = Object.freeze({active, count, progress, mountNotice});
})(window);
