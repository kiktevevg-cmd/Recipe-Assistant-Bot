# Помощник по рецептам

Telegram-бот, который помогает с рецептами и заменой ингредиентов, используя AI (OpenAI GPT-4o-mini).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — запустить сервер + Telegram-бота
- `pnpm run typecheck` — проверка типов по всему проекту

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Telegram: grammY
- AI: OpenAI GPT-4o-mini

## Where things live

- `artifacts/api-server/src/bot/` — весь код Telegram-бота
  - `bot.ts` — регистрация команд, запуск polling
  - `handlers.ts` — обработчики команд и сообщений
  - `context.ts` — хранилище истории разговоров (в памяти, с TTL и LRU)
  - `openai.ts` — клиент OpenAI

## Required secrets

- `TELEGRAM_BOT_TOKEN` — токен бота от @BotFather
- `OPENAI_API_KEY` — ключ OpenAI API

## Bot commands

- `/start` — приветствие и справка
- `/recipe <блюдо>` — получить рецепт
- `/substitute <ингредиент>` — чем заменить ингредиент
- `/clear` — очистить историю разговора
- Естественный язык — бот понимает «рецепт борща», «чем заменить яйца» и т.д.

## Architecture decisions

- История разговора: кэш в памяти (Map, 10 пар на чат, TTL 24ч, max 5000 чатов) + персистентность в PostgreSQL. При первом сообщении после рестарта история подгружается из таблицы `chat_log` (`context.ts` → `hydrateFromDb`). `/clear` чистит и память, и строки в `chat_log`.
- Бот работает в режиме long polling (не webhook), что проще для Replit-окружения.
- grammY выбран как современный TypeScript-first фреймворк для Telegram.
- grammy и openai вынесены в external в esbuild (нативные зависимости не бандлятся).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
