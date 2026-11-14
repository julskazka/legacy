// Временное решение по запросу владельца: запись напрямую из HTML в GitHub.
// Вставьте fine-grained GitHub PAT с правом Contents: Read and write
// только для репозитория julskazka/legacy. БЕЗ него браузер не может записывать
// votes/votes.json. В публичном файле токен доступен всем посетителям.
// Если токен будет автоматически отозван GitHub, сохранение прекратится.
window.NASLEDIE_GITHUB_TOKEN = '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';

window.addEventListener('notibot:update', () => {
  if (typeof window.render === 'function') window.render();
});
