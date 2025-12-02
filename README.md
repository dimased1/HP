# 📜 Daily Prophet --- Cloudflare Workers App

*Magical daily newspaper generator powered by OpenAI and Workers KV.*

## ✨ Overview

**Daily Prophet** is a Cloudflare Workers application that generates a
fictional magical newspaper once per day.\
It includes: - Local magical news\
- Overview\
- Sensation headline\
- Galleon rate\
- Magical tip\
- Horoscope

------------------------------------------------------------------------

## 🧩 Features

-   Daily generation\
-   OpenAI Responses API (gpt-5.1)\
-   KV caching for 24 hours\
-   Cron scheduling\
-   Section-based API endpoints

------------------------------------------------------------------------

## 🔗 API Endpoints

### `GET /all`

Full JSON issue.

### `GET /today`

Short summary with titles.

### `GET /update`

Force regeneration.

### `GET /section/:name`

Returns specific content parts.

------------------------------------------------------------------------

## ⚙️ Setup

### Environment (`wrangler.toml`)

    [vars]
    OPENAI_API_KEY = "your_openai_key"

    [kv_namespaces]
    binding = "DAILY_KV"
    id = "your_kv_namespace_id"

------------------------------------------------------------------------

## 🇷🇺 Русская версия

# 📜 Ежедневный Пророк --- Cloudflare Workers приложение

## ✨ Описание

Генерация вымышленной магической газеты раз в сутки с использованием
OpenAI.

## 🔗 API

-   `/all` --- полный выпуск\
-   `/today` --- краткое содержание\
-   `/update` --- обновление выпуска\
-   `/section/*` --- доступ к разделам

## ⚙️ Установка

    wrangler dev
    wrangler publish

------------------------------------------------------------------------

MIT License.
