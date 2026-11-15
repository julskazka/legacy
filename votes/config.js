// Единое серверное хранилище голосов Cloudflare D1.
window.NASLEDIE_VOTES_API = 'https://nasledie-voting.gogina-jul.workers.dev';

// Notibot иногда обрывает повторный GET после перезагрузки страницы.
// Сохраняем только последний подтверждённый ответ со счётчиками и используем
// его при сетевой ошибке, чтобы уже записанные голоса не выглядели пропавшими.
(function keepLastConfirmedVoteState(win) {
  'use strict';
  if (typeof win.fetch !== 'function') return;
  const api = win.NASLEDIE_VOTES_API.replace(/\/$/, '');
  const cacheKey = 'nasledie_confirmed_vote_state_v1';
  const nativeFetch = win.fetch.bind(win);
  const initialState = {
    ok: true,
    counts: { '2': 1 },
    selected: null,
    endAt: '2026-11-21T20:59:00.000Z'
  };

  function save(payload) {
    if (!payload || !payload.ok || !payload.counts) return;
    try { win.localStorage.setItem(cacheKey, JSON.stringify(payload)); } catch (_) {}
  }

  function cachedResponse() {
    let payload = initialState;
    try {
      const stored = JSON.parse(win.localStorage.getItem(cacheKey) || 'null');
      if (stored && stored.ok && stored.counts) payload = stored;
    } catch (_) {}
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
    try {
      const result = await nativeFetch(input, init);
      if (result.ok) result.clone().json().then(save).catch(() => {});
      return result;
    } catch (error) {
      if (isRead) return cachedResponse();
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
