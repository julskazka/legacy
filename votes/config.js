// Адрес опубликованного обработчика GitHub-голосов; заполняется после его развёртывания.
window.NASLEDIE_VOTE_API_URL = '';
// После получения пользователя от Notibot перерисовать доступность кнопок.
window.addEventListener('notibot:update', () => { if(typeof window.render==='function') window.render(); });
