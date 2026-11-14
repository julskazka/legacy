# НАСЛЕДИЕ XXI века — голосование

Страница голосования: https://julskazka.github.io/legacy/

Голоса хранятся только в GitHub: [votes/votes.json](votes/votes.json).

HTML отправляет Telegram ID из Notibot и ID номинанта непосредственно через GitHub REST API. Один участник — один действующий голос; при повторном выборе он заменяется.

**Кнопки сохранения заработают после заполнения токена в [votes/config.js](votes/config.js).** Сейчас токен пуст; GitHub не принимает неавторизованную запись.

Подробности: [votes/README.md](votes/README.md). Голосование до 21 ноября 2026, 23:59 МСК.
