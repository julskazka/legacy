// Единое серверное хранилище голосов Cloudflare D1.
window.NASLEDIE_VOTES_API = 'https://nasledie-voting.gogina-jul.workers.dev';

// Храним последний подтверждённый ответ только для мгновенного подтверждения
// отправки. Общий рейтинг всегда приходит из единой серверной базы.
(function keepLastConfirmedVoteState(win) {
  'use strict';
  if (typeof win.fetch !== 'function') return;
  const api = win.NASLEDIE_VOTES_API.replace(/\/$/, '');
  const cacheKey = 'nasledie_confirmed_vote_state_v2';
  const nativeFetch = win.fetch.bind(win);
  const emptyState = {
    ok: true,
    counts: {},
    selected: null,
    endAt: '2026-11-21T20:59:00.000Z'
  };

  function save(payload) {
    if (!payload || !payload.ok || !payload.counts) return;
    try { win.localStorage.setItem(cacheKey, JSON.stringify(payload)); } catch (_) {}
  }

  function optimisticWrite(init) {
    let body;
    try { body = JSON.parse(init && init.body || '{}'); } catch (_) { return null; }
    if (!body.userId || !Number.isInteger(body.nomineeId)) return null;

    let payload = emptyState;
    try {
      const stored = JSON.parse(win.localStorage.getItem(cacheKey) || 'null');
      if (stored && stored.ok && stored.counts) payload = stored;
    } catch (_) {}
    payload = {
      ...payload,
      ok: true,
      selected: body.nomineeId
    };
    save(payload);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  win.fetch = async function votingFetch(input, init) {
    const url = typeof input === 'string' ? input : input && input.url || '';
    const isRead = url.startsWith(api + '/api/votes?');
    const isWrite = url === api + '/api/vote';
    if (!isRead && !isWrite) return nativeFetch(input, init);
    if (isWrite && win.navigator && typeof win.navigator.sendBeacon === 'function') {
      const optimistic = optimisticWrite(init);
      if (optimistic) {
        // sendBeacon быстро ставит запись в очередь даже внутри Notibot.
        // Обычный fetch дублирует её в фоне; повторный UPSERT того же голоса безопасен.
        const queued = win.navigator.sendBeacon(
          api + '/api/vote',
          new Blob([String(init && init.body || '')], { type: 'text/plain' })
        );
        if (queued) {
          nativeFetch(input, init)
            .then(result => result.ok ? result.clone().json().then(save) : null)
            .catch(() => {});
          return optimistic;
        }
      }
    }
    try {
      const result = await nativeFetch(input, init);
      if (result.ok) result.clone().json().then(save).catch(() => {});
      return result;
    } catch (error) {
      // Не подменяем общий рейтинг локальными данными. Код страницы оставит
      // последний показанный результат и повторит GET через три секунды.
      throw error;
    }
  };
})(window);

// В Notibot страница получает настоящий ID пользователя от приложения.
// В обычном браузере используем постоянный ID этого браузера, чтобы голосование
// работало без Notibot и переголосование заменяло прежний выбор.
(function enableStandaloneVoting(win) {
  'use strict';
  if (win.parent !== win || (win.notibot && typeof win.notibot.onUpdate === 'function')) return;

  const storageKey = 'nasledie_browser_voter_id_v1';
  let id = '';
  try { id = win.localStorage.getItem(storageKey) || ''; } catch (_) {}
  if (!id) {
    const random = win.crypto && typeof win.crypto.randomUUID === 'function'
      ? win.crypto.randomUUID()
      : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    id = 'web-' + random;
    try { win.localStorage.setItem(storageKey, id); } catch (_) {}
  }

  win.notibot = {
    onUpdate(callback) {
      if (typeof callback === 'function') callback({ id }, { platform: 'web' });
      return function unsubscribe() {};
    }
  };
})(window);
