# Голосование «НАСЛЕДИЕ XXI века»

Публичная страница: https://julskazka.github.io/legacy/

## Архитектура (15.11.2026)

- Публичная страница получает идентификатор из Notibot.
- Запросы к GitHub Contents API для votes/votes.json перенаправляются через votes/config.js на серверный обработчик Vercel.
- API: https://nasledie-voting-api.vercel.app/api/votes
- В Vercel переменная окружения GITHUB_VOTES_TOKEN (Production) должна содержать действующий fine-grained PAT для julskazka/legacy с Contents: Read and write. В GitHub Pages и JavaScript **не публиковать** токен.
- votes/votes.json — единственный реестр голосов: один ID → один текущий номинант; повторный голос заменяет прежний.
- При конфликте SHA клиент должен повторить запрос после чтения новой версии.
- Голосование заканчивается 21 ноября 2026 в 23:59 МСК.

## Подключение

1. Откройте https://vercel.com/ → проект nas​ledie-voting-api (название: nasledie-voting-api) → Settings → Environment Variables.
2. Добавьте GITHUB_VOTES_TOKEN с действительным токеном GitHub, область Production.
3. Redeploy последнего Production deployment, чтобы новая переменная окружения была доступна обработчику.
4. Протестируйте голосование на https://julskazka.github.io/legacy/ и убедитесь, что votes/votes.json обновился.

Если API возвращает 503 «Server token is not configured», переменная не задана. Ошибка GitHub 401 означает нерабочий токен в переменной; замените значение в Vercel, а не в GitHub.

**Ограничение:** сервер скрывает токен, но само по себе это не доказывает, что присланный Telegram ID действительно принадлежит голосующему. Для защиты от подмены требуется проверять подписанный идентификатор Notibot на сервере.
