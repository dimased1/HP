# 📜 Daily Prophet — Cloudflare Workers App

*Magical daily newspaper generator (Harry-Potter-inspired), powered by OpenAI and Workers KV.*

## ✨ Overview

**Daily Prophet** is a Cloudflare Workers application that generates a fully fictional magical newspaper once per day.
Each issue includes:

* Local magical news (UK/Scotland focus)
* A daily overview
* A short magical sensation headline
* A galleon exchange rate
* A magical tip
* A brief horoscope

All generated content is **stored in Workers KV for 24 hours** to keep one consistent issue per day.
Content is produced using **OpenAI Responses API (model: gpt-5.1)**.

---

## 🧩 Features

* 🌅 **Daily Issue Generation** — auto-generated JSON with multiple news items.
* 🧠 **OpenAI Integration** — uses `gpt-5.1` to craft structured magical content.
* 📦 **Caching in KV** — one issue per calendar day (UTC), automatically reused.
* 🔄 **Scheduled Worker Support** — regenerates content daily via Cron trigger.
* ⚡ **Lightweight API** — multiple endpoints to access sections of the newspaper.
* 🇬🇧 **Localized** — uses Russian text with UK/Scotland magical context.

---

## 🛠️ Tech Stack

* **Cloudflare Workers (JavaScript)**
* **Cloudflare Workers KV**
* **OpenAI Responses API**
* **ES Modules**

---

## 🔗 API Endpoints

### `GET /all`

Returns the full JSON payload for today’s generated issue.

### `GET /today`

Returns a lightweight summary:

* date
* overview
* only titles of the news items

### `GET /update`

Forces regeneration of today’s issue and overwrites KV.

### `GET /section/:name`

Returns specific sections:

| Path                 | Result                |
| -------------------- | --------------------- |
| `/section/overview`  | Daily overview        |
| `/section/magic`     | Magical tip           |
| `/section/galleon`   | Galleon exchange rate |
| `/section/horoscope` | Horoscope             |
| `/section/news1`     | News item #1          |
| `/section/news2`     | News item #2          |
| `/section/news3`     | News item #3          |

---

## ⚙️ Setup

### 1. Clone the project

```bash
git clone <repo-url>
cd daily-prophet
```

### 2. Configure environment

Add your OpenAI key and KV binding in `wrangler.toml`:

```toml
[vars]
OPENAI_API_KEY = "your_openai_key"

[kv_namespaces]
binding = "DAILY_KV"
id = "your_kv_namespace_id"
```

### 3. Run locally

```bash
wrangler dev
```

### 4. Deploy

```bash
wrangler publish
```

---

## ⏱ Scheduled Cron (Optional)

Add to `wrangler.toml`:

```toml
[triggers]
crons = ["0 0 * * *"]
```

This regenerates the daily issue at midnight UTC.

---

## 📁 Project Structure

```
worker.js
README.md
wrangler.toml
```

* Main logic lives in a single Worker script.
* KV stores objects like:

```
daily:<date> => {
  created_at: "...",
  payload: { ...generated JSON... }
}
```

---

## 🧙‍♂️ How It Works

1. On first request each day, Worker generates the issue via OpenAI.
2. JSON is cleaned and parsed via `extractJson()`.
3. Result is saved in KV for reuse.
4. All endpoints read from KV and return appropriate fragments.

---

## 📜 License

MIT License.

---

---

# 📜 Ежедневный Пророк — Cloudflare Workers приложение

*Магическая ежедневная газета в стиле Гарри Поттера, сгенерированная с помощью OpenAI.*

## ✨ Описание

**Ежедневный Пророк** — это приложение Cloudflare Workers, генерирующее полностью выдуманный выпуск газеты раз в сутки.
Каждый выпуск содержит:

* локальные магические новости (с фокусом на Великобританию и Шотландию)
* краткий обзор дня
* сенсацию в одном предложении
* курс галеона
* магический совет
* гороскоп

Выпуск **кэшируется в Workers KV на 24 часа**, чтобы в течение суток был один и тот же номер.

Контент создаётся через **OpenAI Responses API (модель: gpt-5.1)**.

---

## 🧩 Возможности

* 🌅 **Ежедневное генерирование** — структурированный JSON-выпуск.
* 🧠 **Интеграция с OpenAI** — модель создаёт художественные магические новости.
* 📦 **KV-кэширование** — один выпуск на дату, перегенерация только раз в день.
* 🔄 **Поддержка Cron** — автоматическое обновление по расписанию.
* ⚡ **Удобное API** — доступ ко всем разделам газеты.
* 🇬🇧 **Локализация** — текст на русском, но с британским магическим контекстом.

---

## 🔗 API

### `GET /all`

Полный JSON-выпуск за сегодня.

### `GET /today`

Краткая сводка:

* дата
* overview
* только заголовки новостей

### `GET /update`

Принудительная перегенерация сегодняшнего выпуска.

### `GET /section/:name`

Возвращает конкретные разделы:

| Путь                 | Что возвращает    |
| -------------------- | ----------------- |
| `/section/overview`  | Краткий обзор дня |
| `/section/magic`     | Магический совет  |
| `/section/galleon`   | Курс галеона      |
| `/section/horoscope` | Гороскоп          |
| `/section/news1`     | Новость №1        |
| `/section/news2`     | Новость №2        |
| `/section/news3`     | Новость №3        |

---

## ⚙️ Установка

### 1. Клонировать проект

```bash
git clone <repo-url>
cd daily-prophet
```

### 2. Настроить окружение

В `wrangler.toml` прописать ключ OpenAI и KV-хранилище:

```toml
[vars]
OPENAI_API_KEY = "your_openai_key"

[kv_namespaces]
binding = "DAILY_KV"
id = "your_kv_namespace_id"
```

### 3. Запуск локально

```bash
wrangler dev
```

### 4. Деплой

```bash
wrangler publish
```

---

## ⏱ Cron-расписание

Добавить в `wrangler.toml`:

```toml
[triggers]
crons = ["0 0 * * *"]
```

Выпуск будет обновляться ежедневно в 00:00 UTC.

---

## 📁 Структура проекта

```
worker.js
README.md
wrangler.toml
```

KV хранит записи вида:

```
daily:<date> => {
  created_at: "...",
  payload: { ...JSON... }
}
```

---

## 🧙 Как работает

1. При первом запросе за день Worker обращается к OpenAI и генерирует выпуск.
2. JSON извлекается и приводится в порядок.
3. Сохраняется в KV.
4. Все API-эндпоинты читают данные из KV.

---

## 📜 Лицензия

MIT License.

---

Если нужно — могу сгенерировать **README в Markdown с заголовками, эмодзи, таблицами, Badges**, либо добавить **пример ответа API**.
