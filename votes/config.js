// GitHub Actions stores votes in this repository, no external worker is used.
// IMPORTANT: workflow_dispatch requires authentication on the trusted Notibot
// side. A public GitHub Pages page MUST NOT contain a GitHub token.
// Until that Notibot-side request is configured, do not claim a vote was saved.
window.NASLEDIE_VOTE_API_URL = '';
window.addEventListener('notibot:update', () => {
  if (typeof window.render === 'function') window.render();
});
