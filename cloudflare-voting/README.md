# Обработчик голосования НАСЛЕДИЕ XXI века на Cloudflare D1

Сайт: https://julskazka.github.io/legacy/

Этот каталог содержит Cloudflare Worker. Он хранит telegram/Notibot ID и выбор номинанта в D1, не в GitHub. Один ID имеет одну действующую запись, переголосование заменяет старый выбор.

## Настройка через браузер

1. Откройте https://dash.cloudflare.com/ → **Workers & Pages** → **D1 SQL database**. Создайте D1 базу с именем `nasledie-votes`.
2. В **Workers & Pages** создайте Worker `nasledie-voting` (Hello World → Deploy).
3. В новом Worker откройте **Edit code**, вставьте содержимое [worker.js](./worker.js), нажмите Deploy.
4. В Worker откройте **Bindings → Add binding → D1 database**, имя переменной `DB` (все заглавные), выберите базу `nasledie-votes`.
5. Откройте `https://<ваш адрес>.workers.dev/api/health`. Успех: `{"ok":true,"database":"connected",...}`. Для подготовки таблицы не нужны отдельные SQL-запросы.
6. Укажите адрес Worker (без /api/health) в [votes/config.js](../votes/config.js): `window.NASLEDIE_VOTES_API = 'https://<адрес>.workers.dev';`. Либо передайте URL ассистенту для подключения.

## API

- GET `/api/health` — проверка D1.
- GET `/api/votes?userId=tg:123` — возвращает счётчики и один выбранный номинант, не список всех Telegram ID.
- POST `/api/vote`, body `{"userId":"tg:123","nomineeId":1}` — записывает или заменяет голос.

Администратор может увидеть сохранённые данные через D1 Console:

```sql
SELECT voter_id, nominee_id, updated_at FROM votes ORDER BY updated_at DESC;
```

Конец голосования: 6 декабря 2026, 23:59 МСК.

Важно: полученный браузером ID Notibot сейчас не подтверждается криптографически на сервере. Для предотвращения подмены ID нужна подпись Notibot и её валидация в Worker. CORS ограничивает браузерный источник, но не решает проблему подмены ID.
