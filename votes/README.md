# Голосование «НАСЛЕДИЕ XXI века»

Страница: https://julskazka.github.io/legacy/

## Где хранятся голоса

- Страница GitHub Pages получает пользовательский ID через Notibot.
- Cloudflare Worker принимает запросы голосования и сохраняет их в базе Cloudflare D1.
- Один ID = одна действующая запись. Переголосование заменяет предыдущего номинанта.
- В GitHub хранятся исходный HTML и JavaScript, а не оперативные голоса. Для голосования GitHub-токен и Vercel не нужны.
- Код Worker: [cloudflare-voting/worker.js](../cloudflare-voting/worker.js)
- Пошаговое развёртывание: [cloudflare-voting/README.md](../cloudflare-voting/README.md)
- Окончание: **21 ноября 2026 года, 23:59 МСК** (`2026-11-21T20:59:00.000Z`).

## Подключение после создания Worker

Откройте [votes/config.js](./config.js) и укажите адрес вашего Cloudflare Worker:

```js
window.NASLEDIE_VOTES_API = 'https://nasledie-voting.<ВАШ_SUBDOMAIN>.workers.dev';
```

Для проверки откройте `https://nasledie-voting.<ВАШ_SUBDOMAIN>.workers.dev/api/health`: должен вернуться JSON с `"ok":true` и `"database":"connected"`.

После установки адреса проверьте голосование через Notibot и сохранение голоса в D1. Не публикуйте ключи или секреты в `config.js`.

**Ограничение защиты:** пока Worker принимает ID из браузерного клиента без криптографической проверки подписи Notibot. Ограничение CORS не защищает от подмены ID напрямую через API.
