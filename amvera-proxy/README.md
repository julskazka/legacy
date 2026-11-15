# NASLEDIE voting proxy for Amvera

Small dependency-free HTTP proxy for the existing Cloudflare D1 voting API.
It keeps the current database and makes the API reachable through an Amvera
domain for users whose providers throttle or block `workers.dev`.

Deploy the contents of this directory as the root of one Amvera application.
The cheapest application tariff is sufficient for the voting period.
