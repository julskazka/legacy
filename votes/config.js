// Временное решение по запросу владельца: запись напрямую из HTML в GitHub.
// Вставьте fine-grained GitHub PAT с правом Contents: Read and write
// только для репозитория julskazka/legacy. БЕЗ него браузер не может записывать
// votes/votes.json. В публичном файле токен доступен всем посетителям.
// Если токен будет автоматически отозван GitHub, сохранение прекратится.
window.NASLEDIE_GITHUB_TOKEN = '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';

window.addEventListener('notibot:update', () => {
  if (typeof window.render === 'function') window.render();
});
