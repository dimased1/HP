/*
Cloudflare Workers app: "Ежедневный Пророк" с локальными магическими новостями, курсом галеонов и гороскопом.
- Генерирует выдуманную газету раз в сутки, кэшируется в KV на 24 часа
- Модель: gpt-4o-mini (через OpenAI Responses API)
- Язык: JavaScript (Workers runtime)
*/

function getDateStr(d = new Date()) {
  const day = d.getUTCDate();
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${day} ${months[d.getUTCMonth()]}`;
}

async function callOpenAI(prompt, env) {
  const body = {
    model: 'gpt-4o-mini',
    input: prompt,
    temperature: 0.9,
    max_output_tokens: 1000
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
  try {
    if (data.output && data.output.length) {
      const contents = data.output.flatMap(o => o.content || []);
      const textParts = contents
        .filter(c => c.type === 'output_text' && c.text)
        .map(c => c.text);
      if (textParts.length) return textParts.join('\n\n');
    }
  } catch (e) {}
  if (data.choices && data.choices[0]) {
    const ch = data.choices[0];
    if (ch.message && (ch.message.content || ch.message.role)) {
      if (typeof ch.message.content === 'string') return ch.message.content;
      if (ch.message.content && ch.message.content.parts) return ch.message.content.parts.join('\n');
    }
  }
  return JSON.stringify(data);
}

function buildPromptForDate(dateStr) {
  return `Ты — генератор выдуманных газетных сводок. Создай JSON-объект для ежедневного выпуска "Ежедневный Пророк". Я живу в Великобритании. Максимально креативно, но серьезным тоном.
Дата в поле "date": "${dateStr}" (формат D месяц на русском).

Строго JSON, структура:
{
  "date": "${dateStr}",
  "overview": "Очень краткое описание дня (одно предложение)",
  "Sensation": "Очень краткая сенсация (5-10 слов)",
  "news": [
    { "id": "1", "title(капс-локом)": "...", "description": "60–90 слов. Волшебная новость наиболее близкая к книжкам Гарри Поттера. Сенсационная" },
    { "id": "2", "title": "...", "description": "15-25 слов. Локальная магическая новость Шотландии" },
    { "id": "3", "title": "...", "description": "15–25 слов. Короткая магическая новость про хогвартс или министерство магии, животных и так далее" }
  ],
  "magic_tip": "Короткий магический совет (одно предложение)",
  "galleon_rate": "Курс галеона сегодня: X галеонов за фунт",
  "horoscope": "Краткий гороскоп на день для магов до 10 слов" 
}
Требования:
- Заголовки 5–8 слов.
- Новость №1 длиннее, остальные короче.
- Все новости — магические и локализованные.
- Никакого текста вне JSON.`;
}

function extractJson(text) {
  const fenced = text.replace(/```(?:json\n)?([\s\S]*?)```/g, '$1');
  const first = fenced.indexOf('{');
  const last = fenced.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) return fenced.slice(first, last + 1);
  return fenced;
}

async function generateAndStore(dateStr, env) {
  const prompt = buildPromptForDate(dateStr);
  const raw = await callOpenAI(prompt, env);
  const jsonText = extractJson(raw);
  let parsed;
  try { parsed = JSON.parse(jsonText); } catch(e) {
    parsed = { date: dateStr, overview: '', news: [], magic_tip: '', galleon_rate: '', horoscope: '', raw_text: raw };
  }
  const toStore = { created_at: new Date().toISOString(), payload: parsed };
  await env.DAILY_KV.put(`daily:${dateStr}`, JSON.stringify(toStore));
  return toStore;
}

async function getOrCreateForDate(dateStr, env) {
  const key = `daily:${dateStr}`;
  const item = await env.DAILY_KV.get(key);
  if (item) {
    try {
      const parsed = JSON.parse(item);
      const created = new Date(parsed.created_at);
      if (getDateStr(created) === dateStr) return parsed;
    } catch(e){}
  }
  return await generateAndStore(dateStr, env);
}

async function handleFetch(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const today = getDateStr();

  if (path === '/all') {
    const data = await getOrCreateForDate(today, env);
    return new Response(JSON.stringify(data.payload, null, 2), { headers: { 'Content-Type': 'application/json' } });
  }
  

  if (path === '/today') {
    const data = await getOrCreateForDate(today, env);
    const payload = data.payload;
    const summary = { date: payload.date || today, overview: payload.overview || '', titles: payload.news ? payload.news.map(n => ({ id: n.id, title: n.title })) : [] };
    return new Response(JSON.stringify(summary, null, 2), { headers: { 'Content-Type': 'application/json' } });
  }
if (path === '/update') {
  const data = await generateAndStore(today, env);
  return new Response(JSON.stringify(data.payload, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
  if (path.startsWith('/section/')) {
    const section = path.replace('/section/', '').toLowerCase();
    const data = await getOrCreateForDate(today, env);
    const payload = data.payload;
    if (section === 'overview') return new Response(JSON.stringify({ overview: payload.overview }), { headers: { 'Content-Type': 'application/json' } });
    if (section === 'magic') return new Response(JSON.stringify({ magic_tip: payload.magic_tip }), { headers: { 'Content-Type': 'application/json' } });
    if (section === 'galleon') return new Response(JSON.stringify({ galleon_rate: payload.galleon_rate }), { headers: { 'Content-Type': 'application/json' } });
    if (section === 'horoscope') return new Response(JSON.stringify({ horoscope: payload.horoscope }), { headers: { 'Content-Type': 'application/json' } });
    if (section.startsWith('news')) {
      const idx = parseInt(section.replace('news',''),10);
      if (!isNaN(idx) && payload.news && payload.news[idx-1]) return new Response(JSON.stringify(payload.news[idx-1], null, 2), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  }

  return new Response('OK — Ежедневный Пророк. Endpoints: /all, /today, /section/:name', { headers: { 'Content-Type': 'text/plain' } });
}

async function handleScheduled(env) {
  const today = getDateStr();
  return await getOrCreateForDate(today, env);
}

export default {
  async fetch(request, env) { try { return await handleFetch(request, env); } catch(e) { return new Response(`Server error: ${e.message}`, { status: 500 }); } },
  async scheduled(controller, env, ctx) { try { await handleScheduled(env); } catch(e) { console.error('Scheduled error', e); } }
};
