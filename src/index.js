/*
Cloudflare Workers app: "Ежедневный Пророк"
- Генерирует выдуманную газету раз в сутки, кэшируется в KV на 24 часа
- Модель: gpt-4o-mini (через OpenAI Responses API)
- Язык: JavaScript (Workers runtime)

Требуемые привязки (в wrangler.toml):
- kv_namespaces: { binding = "DAILY_KV", id = "<KV_NAMESPACE_ID>" }
- vars: OPENAI_API_KEY
- triggers: cron="0 7 * * *"  (пример: каждый день в 07:00 UTC — настройте как нужно)

Endpoints:
- GET /all           -> возвращает весь JSON-объект ежедневного выпуска
- GET /section/:name -> возвращает конкретный раздел (например, /section/1news)
- GET /today         -> быстрое представление (дата и заголовки)

KV хранит ключ в формате daily:YYYY-MM-DD
*/

// -------------------------
// Utility: формат даты (YYYY-MM-DD)
function getDateStr(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// -------------------------
// OpenAI call (Responses API) — модель: gpt-4o-mini
async function callOpenAI(prompt, env) {
  const body = {
    model: 'gpt-4o-mini',
    input: prompt,
    // optional: max tokens, temperature
    temperature: 0.9,
    max_output_tokens: 800
  };

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const data = await res.json();
  // Responses API may nest text in data.output[0].content[0].text or similar.
  // We'll try a few fallbacks.
  try {
    // Newer responses API: data.output[0].content -> array of {type:'output_text', text: '...'}
    if (data.output && data.output.length) {
      const contents = data.output.flatMap(o => o.content || []);
      const textParts = contents
        .filter(c => c.type === 'output_text' && c.text)
        .map(c => c.text);
      if (textParts.length) return textParts.join('\n\n');
    }
  } catch (e) {
    // ignore fallback
  }

  // Legacy fallback: data.choices[0].message.content
  if (data.choices && data.choices[0]) {
    const ch = data.choices[0];
    if (ch.message && (ch.message.content || ch.message.role)) {
      if (typeof ch.message.content === 'string') return ch.message.content;
      if (ch.message.content && ch.message.content.parts) return ch.message.content.parts.join('\n');
    }
  }

  // Last resort: stringify
  return JSON.stringify(data);
}

// -------------------------
// Prompt builder (in Russian) — просим строго структурированный JSON
function buildPromptForDate(dateStr) {
  return `Ты — генератор выдуманных газетных сводок. Создай JSON-объект для ежедневного выпуска \"Ежедневный Пророк\" на дату ${dateStr} (используй русский язык). Строго верни только JSON без лишних комментариев, со следующей структурой:
{
  "date": "YYYY-MM-DD",
  "overview": "Краткое общее описание дня (1-2 предложения)",
  "news": [
    { "id": "1", "title": "...", "description": "30-40 слов" },
    { "id": "2", "title": "...", "description": "30-40 слов" },
    { "id": "3", "title": "...", "description": "30-40 слов" }
  ],
  "magic_tip": "Короткий магический совет (одним предложением)"
}

Требования к выводу JSON:
- Поле date обязательно — тот же ${dateStr}
- Описания: около 30-40 слов каждое (не короче 25 и не длиннее 50 слов)
- Никакого дополнительного текста вне JSON
- Заголовки — 5-8 слов максимум

Готовься, что этот JSON будет полезен API-клиентам — строгая JSON-валидация будет выполнена на стороне сервера.`;
}

// -------------------------
// Формирование и сохранение в KV
async function generateAndStore(dateStr, env) {
  const prompt = buildPromptForDate(dateStr);
  const raw = await callOpenAI(prompt, env);

  // Попробуем распарсить JSON из ответа — иногда модель оборачивает JSON в ```
  const jsonText = extractJson(raw);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    // если не удалось распарсить — положим текст как поле raw_text
    parsed = {
      date: dateStr,
      overview: '',
      news: [],
      magic_tip: '',
      raw_text: raw
    };
  }

  // Сохраняем в KV вместе с meta timestamp
  const toStore = {
    created_at: new Date().toISOString(),
    payload: parsed
  };

  await env.DAILY_KV.put(`daily:${dateStr}`, JSON.stringify(toStore));
  return toStore;
}

// Утилита: извлекает JSON-подстроку из текста
function extractJson(text) {
  // убираем ```json ... ``` или ``` ... ```
  const fenced = text.replace(/```(?:json\n)?([\s\S]*?)```/g, '$1');

  // найдем первый { и последний }
  const first = fenced.indexOf('{');
  const last = fenced.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return fenced.slice(first, last + 1);
  }
  // fallback: возвращаем весь текст
  return fenced;
}

// -------------------------
// Получить из KV или сгенерировать
async function getOrCreateForDate(dateStr, env) {
  const key = `daily:${dateStr}`;
  const item = await env.DAILY_KV.get(key);
  if (item) {
    try {
      const parsed = JSON.parse(item);
      // считаем актуальным, если был создан в тот же день (UTC)
      const created = new Date(parsed.created_at);
      if (getDateStr(created) === dateStr) {
        return parsed;
      }
    } catch (e) {
      // ignore и сгенерируем заново
    }
  }

  // генерируем и сохраняем
  return await generateAndStore(dateStr, env);
}

// -------------------------
// HTTP handlers
async function handleFetch(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const today = getDateStr();

  if (path === '/all') {
    const data = await getOrCreateForDate(today, env);
    return new Response(JSON.stringify(data.payload, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (path === '/today') {
    const data = await getOrCreateForDate(today, env);
    const payload = data.payload;
    const summary = {
      date: payload.date || today,
      overview: payload.overview || '',
      titles: payload.news ? payload.news.map(n => ({ id: n.id, title: n.title })) : []
    };
    return new Response(JSON.stringify(summary, null, 2), { headers: { 'Content-Type': 'application/json' } });
  }

  if (path.startsWith('/section/')) {
    const section = path.replace('/section/', '').toLowerCase();
    const data = await getOrCreateForDate(today, env);
    const payload = data.payload;

    // поддерживаем несколько секций: overview, news1, news2, news3, magic
    if (section === 'overview') {
      return new Response(JSON.stringify({ overview: payload.overview }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (section === 'magic') {
      return new Response(JSON.stringify({ magic_tip: payload.magic_tip }), { headers: { 'Content-Type': 'application/json' } });
    }

    // newsN
    if (section.startsWith('news')) {
      const idx = parseInt(section.replace('news', ''), 10);
      if (!isNaN(idx) && payload.news && payload.news[idx - 1]) {
        return new Response(JSON.stringify(payload.news[idx - 1], null, 2), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    return new Response('Not found', { status: 404 });
  }

  return new Response('OK — Ежедневный Пророк. Endpoints: /all, /today, /section/:name', { headers: { 'Content-Type': 'text/plain' } });
}

// -------------------------
// Scheduled (cron) handler — будет вызываться автоматически по триггеру в wrangler.toml
async function handleScheduled(env) {
  const today = getDateStr();
  // Генерируем и сохраняем (если уже есть на дату — генерация пропустится внутри getOrCreateForDate)
  const stored = await getOrCreateForDate(today, env);
  return stored;
}

// -------------------------
// Экспорт: поддержка fetch и scheduled
export default {
  async fetch(request, env) {
    try {
      return await handleFetch(request, env);
    } catch (e) {
      return new Response(`Server error: ${e.message}`, { status: 500 });
    }
  },
  // scheduled signature: (controller, env, ctx) in some runtimes — здесь мы поддержим простой вызов
  async scheduled(controller, env, ctx) {
    try {
      await handleScheduled(env);
    } catch (e) {
      // логирование
      console.error('Scheduled error', e);
    }
  }
};

/*
---------------------------------------
Пример wrangler.toml (файл проекта):

name = "daily-prophet"
main = "./cloudflare-daily-prophet-worker.js"
compatibility_date = "2025-12-01"

[vars]
OPENAI_API_KEY = "@openai_api_key"  # рекомендуем хранить в секретах wrangler

[[kv_namespaces]]
binding = "DAILY_KV"
id = "<KV_NAMESPACE_ID>"

# Cron trigger — пример: каждый день в 07:00 UTC
[triggers]
cron = [ "0 7 * * *" ]

# Дополнительно: маршруты, среда публикации и т.д.
---------------------------------------

Инструкции по развертыванию:
1. Создайте KV namespace: `wrangler kv:namespace create DAILY_KV`
2. Добавьте ID в wrangler.toml
3. Сохраните ваш OPENAI_API_KEY в переменных окружения/секретах: `wrangler secret put OPENAI_API_KEY`
4. `wrangler publish`

Замечания и улучшения:
- Можно добавить валидацию конечного JSON (проверить длину описаний в словах)
- Можно кешировать не только в KV, но и в Cache API для очень быстрых ответов
- Таймзона: тут используется UTC; если в проекте нужна локальная дата — скорректируйте getDateStr
*/
