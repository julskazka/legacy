// Единая база голосов Cloudflare D1 в локальном хранилище Amvera.
window.NASLEDIE_VOTES_API = 'https://nasledie-vote-julskazka.msk1.amvera.tech';

// В обычном браузере используем fetch.
// Внутри Notibot/WebView используем JSONP для чтения и iframe-form для записи:
// такие запросы не зависят от CORS/fetch-ограничений встроенного браузера.
(function installVotingTransport(win) {
  'use strict';
  if (typeof win.fetch !== 'function') return;

  const api = String(win.NASLEDIE_VOTES_API || '').replace(/\/$/, '');
  const nativeFetch = win.fetch.bind(win);
  // Один и тот же отказоустойчивый транспорт используем и в обычном
  // браузере, и в WebView приложения. WebView может быть верхним окном,
  // поэтому проверка win.parent !== win сама по себе ненадёжна.
  const embedded = false;
  const cacheKey = 'nasledie_confirmed_vote_state_v2';

  function save(payload) {
    if (!payload || !payload.ok || !payload.counts) return;
    try { win.localStorage.setItem(cacheKey, JSON.stringify(payload)); } catch (_) {}
  }

  function response(payload) {
    return new Response(JSON.stringify(payload), {
      status: payload && payload.ok === false ? 400 : 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  function parseVote(init) {
    try {
      const body = JSON.parse(init && init.body || '{}');
      return body && body.userId && Number.isInteger(body.nomineeId) ? body : null;
    } catch (_) {
      return null;
    }
  }

  function randomId(prefix) {
    const part = win.crypto && typeof win.crypto.randomUUID === 'function'
      ? win.crypto.randomUUID().replace(/-/g, '')
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return prefix + part;
  }

  function jsonpRead(url, signal) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url, win.location.href);
      const callbackName = '__nasledie_nv_' + randomId('').slice(0, 48);
      const callbackPath = 'window.' + callbackName;
      let done = false;
      let script;
      let timer;

      function cleanup() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (script && script.parentNode) script.parentNode.removeChild(script);
        try { delete win[callbackName]; } catch (_) { win[callbackName] = undefined; }
        if (signal) signal.removeEventListener('abort', onAbort);
      }
      function fail(error) {
        cleanup();
        reject(error);
      }
      function onAbort() {
        fail(new DOMException('Request aborted', 'AbortError'));
      }

      win[callbackName] = payload => {
        cleanup();
        if (payload && payload.ok) save(payload);
        resolve(response(payload));
      };

      parsed.pathname = parsed.pathname.replace(/\/api\/votes$/, '/api/votes.js');
      parsed.searchParams.set('callback', callbackPath);

      script = win.document.createElement('script');
      script.async = true;
      script.src = parsed.toString();
      script.onerror = () => fail(new TypeError('Не удалось загрузить данные голосования.'));
      timer = setTimeout(() => fail(new Error('Сервер голосования не ответил.')), 7000);
      if (signal) {
        if (signal.aborted) return onAbort();
        signal.addEventListener('abort', onAbort, { once: true });
      }
      (win.document.head || win.document.documentElement).appendChild(script);
    });
  }

  function iframeVote(body, signal) {
    return new Promise((resolve, reject) => {
      const requestId = randomId('nv_').slice(0, 96);
      const frameName = randomId('nasledie_vote_frame_').slice(0, 96);
      const iframe = win.document.createElement('iframe');
      const form = win.document.createElement('form');
      let done = false;
      let timer;

      iframe.name = frameName;
      iframe.style.display = 'none';
      iframe.setAttribute('aria-hidden', 'true');

      form.method = 'POST';
      form.action = api + '/api/vote-form';
      form.target = frameName;
      form.style.display = 'none';

      const fields = {
        userId: body.userId,
        nomineeId: String(body.nomineeId),
        requestId
      };
      Object.keys(fields).forEach(name => {
        const input = win.document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = fields[name];
        form.appendChild(input);
      });

      function cleanup() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        win.removeEventListener('message', onMessage);
        if (signal) signal.removeEventListener('abort', onAbort);
        setTimeout(() => {
          if (form.parentNode) form.parentNode.removeChild(form);
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 0);
      }
      function fail(error) {
        cleanup();
        reject(error);
      }
      function onAbort() {
        fail(new DOMException('Request aborted', 'AbortError'));
      }
      function onMessage(event) {
        const data = event.data;
        if (!data || data.source !== 'nasledie-voting' || data.requestId !== requestId) return;
        cleanup();
        const payload = data.payload || { ok: false, error: 'Пустой ответ сервера.' };
        if (payload.ok) save(payload);
        resolve(response(payload));
      }

      win.addEventListener('message', onMessage);
      if (signal) {
        if (signal.aborted) return onAbort();
        signal.addEventListener('abort', onAbort, { once: true });
      }
      timer = setTimeout(() => fail(new Error('Сервер не подтвердил голос.')), 7000);

      (win.document.body || win.document.documentElement).appendChild(iframe);
      (win.document.body || win.document.documentElement).appendChild(form);
      form.submit();
    });
  }

  async function confirmVote(body, signal) {
    const url = api + '/api/votes?userId=' + encodeURIComponent(body.userId) + '&fresh=' + Date.now();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
      try {
        const r = embedded
          ? await jsonpRead(url, signal)
          : await nativeFetch(url, { cache: 'no-store', signal });
        const payload = await r.json();
        if (r.ok && payload && payload.ok && Number(payload.selected) === body.nomineeId) {
          save(payload);
          return response(payload);
        }
      } catch (error) {
        if (signal && signal.aborted) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('Сервер не подтвердил голос.');
  }

  win.fetch = function votingFetch(input, init) {
    const url = typeof input === 'string' ? input : input && input.url || '';
    const isRead = url.startsWith(api + '/api/votes?');
    const isWrite = url === api + '/api/vote';

    if (!isRead && !isWrite) return nativeFetch(input, init);

    if (isRead) {
      // Сначала пробуем обычный fetch. Во встроенном браузере быстро
      // переключаемся на JSONP, если чтение ответа запрещено окружением.
      if (!embedded) {
        return nativeFetch(input, init).then(result => {
          if (result.ok) result.clone().json().then(save).catch(() => {});
          return result;
        });
      }
      return new Promise((resolve, reject) => {
        let failures = 0;
        let lastError;
        const failed = error => {
          failures += 1;
          lastError = error;
          if (failures === 2) reject(lastError);
        };
        nativeFetch(input, init).then(result => {
          if (!result.ok) throw new Error('HTTP ' + result.status);
          result.clone().json().then(save).catch(() => {});
          resolve(result);
        }).catch(failed);
        setTimeout(() => jsonpRead(url, init && init.signal).then(resolve, failed), 150);
      });
    }

    const body = parseVote(init);
    if (!body) return Promise.reject(new Error('Неверные данные голоса.'));

    if (!embedded) {
      return nativeFetch(input, init).then(async result => {
        if (result.ok) {
          const payload = await result.clone().json().catch(() => null);
          save(payload);
        }
        return result;
      });
    }

    // В WebView ответ на cross-origin POST может быть недоступен, хотя сам POST
    // успешно отправлен. Поэтому отправляем несколькими безопасными способами,
    // а успех подтверждаем отдельным чтением из D1.
    try {
      if (win.navigator && typeof win.navigator.sendBeacon === 'function') {
        win.navigator.sendBeacon(
          api + '/api/vote',
          new Blob([String(init && init.body || '')], { type: 'text/plain' })
        );
      }
    } catch (_) {}

    nativeFetch(input, init).then(async result => {
      if (result && result.ok) {
        const payload = await result.clone().json().catch(() => null);
        save(payload);
      }
    }).catch(() => {});

    // Если WebView блокирует обычный POST целиком, пробуем form POST как второй канал.
    setTimeout(() => {
      iframeVote(body, init && init.signal).catch(() => {});
    }, 250);

    return confirmVote(body, init && init.signal);
  };
})(window);

// В Notibot страница получает настоящий ID пользователя от приложения.
// В обычном браузере используем постоянный ID этого браузера.
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
