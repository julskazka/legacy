# НАСЛЕДИЕ XXI века — голосование

Страница голосования: https://julskazka.github.io/legacy/

Всё постоянное хранение голосов — в GitHub: [votes/votes.json](https://github.com/julskazka/legacy/blob/main/votes/votes.json).

Запись без стороннего сервера подготовлена через [GitHub Actions](https://github.com/julskazka/legacy/actions/workflows/save-vote.yml); скрипт записи: `votes/apply-vote.mjs`.

**Настройка на стороне Notibot ещё требуется**: отправка авторизованного `workflow_dispatch` через защищённую сторону Notibot. GitHub Pages не умеет самостоятельно изменять файлы репозитория, а OAuth/PAT нельзя публиковать в HTML.

Точные параметры запроса и права токена: [votes/README.md](votes/README.md).

Голосование до 21 ноября 2026, 23:59 МСК. Один пользователь Notibot → один голос за одного номинанта; при новом выборе прежний заменяется. Без подтверждения записи в GitHub страница не должна показывать успех.
