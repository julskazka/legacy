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
    style.textContent = '.demo-notice{max-width:960px;margin:18px auto;padding:15px 20px;box-sizing:border-box;border:1px solid rgba(218,199,175,.7);border-radius:14px;background:#32231f;color:#f2dcbb;text-align:center;font-size:15px;line-height:1.55}.demo-notice strong{display:block;font-size:16px;margin-bottom:4px}.demo-notice span{opacity:.92}@media(max-width:650px){.demo-notice{margin:12px 14px;font-size:14px}}';
    win.document.head.appendChild(style);

    const note = win.document.createElement('div');
    note.className = 'demo-notice';
    note.setAttribute('role', 'note');
    note.innerHTML = '<strong>Учебный деморежим</strong><span>Количество голосов и ТОП-5 здесь смоделированы. Счётчики растут автоматически до 21 ноября, 23:59 МСК. Настоящая база голосов не изменяется.</span>';

    const hero = win.document.querySelector('.hero');
    if (hero) hero.insertAdjacentElement('afterend', note);

    const rankingSubtitle = win.document.querySelector('.ranking-sub');
    if (rankingSubtitle) {
      rankingSubtitle.textContent = 'Учебная симуляция ТОП-5: результаты изменяются по времени и не являются реальными итогами голосования.';
    }
  }

  win.NasledieDemo = Object.freeze({active, count, progress, mountNotice});
})(window);
