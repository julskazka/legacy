// GitHub token is no longer published. All requests for votes are routed via Vercel.
window.NASLEDIE_GITHUB_TOKEN = 'server-side-handler';
window.NASLEDIE_VOTES_API = 'https://nasledie-voting-api-julskazka-2025s-projects.vercel.app/api/votes';
(function(){
  const nativeFetch = window.fetch.bind(window);
  const target = /https:\/\/api\.github\.com\/repos\/julskazka\/legacy\/contents\/votes\/votes\.json(?:\?.*)?$/i;
  window.fetch = function(input, init){
    const url = typeof input === 'string' ? input : (input && input.url);
    if (!url || !target.test(url)) return nativeFetch(input, init);
    const opts = Object.assign({}, init || {});
    if (typeof Request !== 'undefined' && input instanceof Request) {
      const h = new Headers(input.headers);
      if (opts.headers) new Headers(opts.headers).forEach((v,k)=>h.set(k,v));
      h.delete('authorization');
      opts.headers=h;
      opts.method=opts.method || input.method;
      if (!opts.body && opts.method !== 'GET' && opts.method !== 'HEAD') opts.body=input.body;
    } else {
      const h = new Headers(opts.headers || {});
      h.delete('authorization');
      opts.headers=h;
    }
    return nativeFetch(window.NASLEDIE_VOTES_API, opts);
  };
})();
window.addEventListener('notibot:update', () => {
  if (typeof window.render === 'function') window.render();
});
