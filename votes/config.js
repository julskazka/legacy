// Server-side votes are stored in Cloudflare D1, never in browser storage or GitHub.
window.NASLEDIE_VOTES_API = 'https://nasledie-voting.gogina-jul.workers.dev';

// Notibot's embedded browser can stall on direct cross-origin fetch. Keep normal
// fetch first, then use browser navigation transports with a verified server reply.
// The fallback is scoped ONLY to this voting API.
(function installVotingTransport(win) {
  'use strict';
  const base = String(win.NASLEDIE_VOTES_API || '').replace(/\/$/, '');
  if (!base || typeof win.fetch !== 'function' || win.__nasledieTransportInstalled) return;
  win.__nasledieTransportInstalled = true;
  const nativeFetch = win.fetch.bind(win);
  const apiOrigin = new URL(base).origin;
  let counter = 0;
  const unique = () => 'nv_' + Date.now().toString(36) + '_' + (++counter) + '_' + Math.random().toString(36).slice(2, 9);
  const response = (payload) => new Response(JSON.stringify(payload), {
    status: payload && payload.ok ? 200 : 400,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

  function readViaScript(originalUrl, originalSignal) {
    return new Promise((resolve, reject) => {
      const callback = '__nasledie_' + unique();
      const script = document.createElement('script');
      let finished = false;
      const finish = (error, value) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (originalSignal) originalSignal.removeEventListener('abort', onAbort);
        delete win[callback];
        script.remove();
        if (error) reject(error); else resolve(response(value));
      };
      const onAbort = () => finish(new DOMException('Request aborted', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('Не удалось получить результаты из Notibot.')), 7200);
      win[callback] = data => finish(null, data);
      script.onerror = () => finish(new Error('Не удалось загрузить ответ голосования.'));
      const src = new URL(base + '/api/votes.js');
      src.searchParams.set('userId', new URL(originalUrl).searchParams.get('userId') || '');
      src.searchParams.set('callback', 'window.' + callback);
      src.searchParams.set('_', unique());
      script.src = src.href;
      if (originalSignal) {
        if (originalSignal.aborted) { onAbort(); return; }
        originalSignal.addEventListener('abort', onAbort, { once: true });
      }
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function writeViaForm(init) {
    let body;
    try { body = JSON.parse(init && init.body || '{}'); }
    catch (_) { return Promise.reject(new Error('Неверные данные для голосования.')); }
    if (!body.userId || !Number.isInteger(body.nomineeId)) {
      return Promise.reject(new Error('Не указан ID пользователя или номинанта.'));
    }
    return new Promise((resolve, reject) => {
      const rid = unique();
      const frame = document.createElement('iframe');
      const form = document.createElement('form');
      frame.name = rid;
      frame.style.display = 'none';
      frame.setAttribute('aria-hidden', 'true');
      form.style.display = 'none';
      form.method = 'POST';
      form.enctype = 'application/x-www-form-urlencoded';
      form.action = base + '/api/vote-form';
      form.target = rid;
      let finished = false;
      const signal = init && init.signal;
      const cleanup = () => {
        clearTimeout(timer);
        win.removeEventListener('message', onMessage);
        if (signal) signal.removeEventListener('abort', onAbort);
        form.remove();
        setTimeout(() => frame.remove(), 100);
      };
      const finish = (err, value) => {
        if (finished) return;
        finished = true;
        cleanup();
        if (err) reject(err); else resolve(response(value));
      };
      const onAbort = () => finish(new DOMException('Request aborted', 'AbortError'));
      const onMessage = (event) => {
        if (event.source !== frame.contentWindow) return;
        if (event.origin !== apiOrigin && event.origin !== 'null') return;
        const msg = event.data;
        if (!msg || msg.source !== 'nasledie-voting' || msg.requestId !== rid) return;
        finish(null, msg.payload);
      };
      const timer = setTimeout(() => finish(new Error('Сервер не подтвердил запись голоса.')), 7400);
      for (const [key, value] of Object.entries({
        userId: body.userId, nomineeId: body.nomineeId, requestId: rid
      })) {
        const field = document.createElement('input');
        field.type = 'hidden'; field.name = key; field.value = String(value);
        form.appendChild(field);
      }
      win.addEventListener('message', onMessage);
      if (signal) {
        if (signal.aborted) { onAbort(); return; }
        signal.addEventListener('abort', onAbort, { once: true });
      }
      document.body.appendChild(frame);
      document.body.appendChild(form);
      try { form.submit(); }
      catch (error) { finish(error); }
    });
  }

  function writeViaBeacon(init) {
    if (!win.navigator || typeof win.navigator.sendBeacon !== 'function') return null;
    let body;
    try { body = JSON.parse(init && init.body || '{}'); }
    catch (_) { return null; }
    if (!body.userId || !Number.isInteger(body.nomineeId)) return null;

    const sent = win.navigator.sendBeacon(
      base + '/api/vote',
      new Blob([JSON.stringify(body)], { type: 'text/plain' })
    );
    if (!sent) return null;

    // Notibot may block cross-origin fetch while still allowing beacon + script.
    // Read the saved value back from D1 before reporting success to the voter.
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const verify = () => {
        readViaScript(base + '/api/votes?userId=' + encodeURIComponent(body.userId))
          .then(async result => {
            const payload = await result.json();
            if (payload && payload.ok && Number(payload.selected) === body.nomineeId) {
              resolve(response(payload));
              return;
            }
            if (Date.now() - started < 6500) {
              setTimeout(verify, 350);
              return;
            }
            reject(new Error('Сервер не подтвердил запись голоса.'));
          })
          .catch(error => {
            if (Date.now() - started < 6500) setTimeout(verify, 350);
            else reject(error);
          });
      };
      setTimeout(verify, 150);
    });
  }

  win.fetch = async function votingFetch(input, init) {
    const requestUrl = typeof input === 'string' ? input : input && input.url;
    const url = typeof requestUrl === 'string' ? requestUrl : '';
    const isVotes = url.startsWith(base + '/api/votes?');
    const isVote = url === base + '/api/vote' && (init && init.method || 'GET').toUpperCase() === 'POST';
    if (!isVotes && !isVote) return nativeFetch(input, init);
    const originalSignal = init && init.signal;
    const abort = new AbortController();
    const onAbort = () => abort.abort();
    if (originalSignal) {
      if (originalSignal.aborted) throw new DOMException('Request aborted', 'AbortError');
      originalSignal.addEventListener('abort', onAbort, { once: true });
    }
    const timer = setTimeout(() => abort.abort(), 3100);
    try {
      return await nativeFetch(input, { ...init, signal: abort.signal });
    } catch (error) {
      if (originalSignal && originalSignal.aborted) throw error;
      console.warn('Voting: primary fetch failed, trying embedded-browser fallback.', error);
      if (!isVote) return readViaScript(url, originalSignal);
      return writeViaBeacon(init || {}) || writeViaForm(init || {});
    } finally {
      clearTimeout(timer);
      if (originalSignal) originalSignal.removeEventListener('abort', onAbort);
    }
  };
})(window);
