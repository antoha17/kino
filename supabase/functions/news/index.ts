// Серверная функция `news`: раз в неделю ищет в интернете свежие фильмы и сериалы
// и кладёт 4 штуки в таблицу news — одни на всех. Вызывается расписанием (pg_cron, по пятницам)
// с секретом x-cron-secret, либо владельцем из «Статистики» (кнопка «Обновить новинки»).
// Использует ключ OPENAI_API_KEY из секретов Supabase и модель, выбранную в «Статистике».
import { createClient } from "npm:@supabase/supabase-js@2";

const PRICES: Record<string, [number, number]> = { "gpt-6.2-sol": [2, 10], "gpt-6.1-terra": [0.5, 2.5] };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const norm = (s: string) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/g, "");

function weekLabel(d = new Date()) {
  const m = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const from = new Date(d.getTime() - 6 * 864e5);
  return from.getMonth() === d.getMonth() ? `${from.getDate()}–${d.getDate()} ${m[d.getMonth()]}` : `${from.getDate()} ${m[from.getMonth()]} – ${d.getDate()} ${m[d.getMonth()]}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method" });
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return json(500, { code: "no_key" });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: s } = await sb.from("app_settings").select("owner_id, ai_model, cron_secret").eq("id", 1).single();
  if (!s) return json(500, { code: "server" });

  // Кто вызывает: расписание (по секрету) или владелец
  const cron = req.headers.get("x-cron-secret");
  let ok = !!(cron && s.cron_secret && cron === s.cron_secret);
  if (!ok) {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: who } = await sb.auth.getUser(token);
    ok = !!(who?.user && who.user.id === s.owner_id);
  }
  if (!ok) return json(403, { code: "forbidden" });

  // Записываем итог в news (app = "status"), чтобы владелец увидел, чем закончилось.
  const status = async (msg: string) => {
    await sb.from("news").delete().eq("app", "status");
    await sb.from("news").insert({ app: "status", week: msg.slice(0, 400), items: [] });
  };
  const job = async () => {
  const model = "gpt-6.1-terra";   // поиск новинок — всегда дешёвой моделью: поиск читает много страниц
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Сегодня ${today}. Найди в интернете 6 фильмов и сериалов, которые вышли за последние 10 дней или выходят на этой неделе: в кинотеатрах России или в российских онлайн-кинотеатрах (Кинопоиск, Okko, Иви, Wink, Start, Premier, KION) — новые фильмы, новые сериалы или новые сезоны. Выбирай то, что обсуждают и что хорошо оценивают, разных жанров. Только реально вышедшее, проверь даты. Никаких ссылок и пометок об источниках в ответе.

Ответь строго по одному JSON-объекту на строку, без массива и без текста вокруг. Внутри строк не используй прямые кавычки ", только «ёлочки». Формат:
{"title":"название в российском прокате","original":"оригинальное название","year":2026,"kind":"film или series","genre":"жанр коротко","actors":"2-3 актёра","length":"например 1 ч 50 мин или 8 серий","hook":"завязка в одном предложении без спойлеров","where":"только название: «В кино» или название онлайн-кинотеатра, без ссылок"}`;

    const base = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com";
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 140000);
    let r: Response;
    try { r = await fetch(base + "/v1/responses", {
      method: "POST", signal: ctl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, tools: [{ type: "web_search" }], input: prompt, max_output_tokens: 4000 }),
    }); } catch (e) { return status(ctl.signal.aborted ? "поиск занял слишком долго" : "нет связи с OpenAI"); } finally { clearTimeout(timer); }
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      console.error("openai", r.status, detail);
      return status(`ошибка OpenAI ${r.status}: ${detail}`);
    }
    const j = await r.json();
    let text = typeof j.output_text === "string" ? j.output_text : "";
    if (!text && Array.isArray(j.output)) {
      for (const o of j.output) for (const c of (o.content || [])) if (c.type === "output_text" && c.text) text += c.text + "\n";
    }
    const items: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const raw of text.split("\n")) {
      const line = raw.trim().replace(/^```(json)?/, "").replace(/```$/, "").replace(/,\s*$/, "");
      const a = line.indexOf("{"), b = line.lastIndexOf("}");
      if (a < 0 || b < a) continue;
      try {
        const x = JSON.parse(line.slice(a, b + 1));
        const n = norm(x.title);
        if (!n || seen.has(n)) continue;
        x.where = String(x.where || "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/https?:\/\/\S+/g, "").replace(/[()]/g, "").trim(); seen.add(n); x.kind = x.kind === "series" ? "series" : "film"; items.push(x);
      } catch { /* битая строка */ }
      if (items.length >= 4) break;
    }
    const u = j.usage || {};
    const [pi, po] = PRICES[model];
    await sb.from("usage").insert({ user_id: null, app: "kino", kind: "news", model,
      in_tokens: u.input_tokens || 0, out_tokens: u.output_tokens || 0,
      cost_usd: ((u.input_tokens || 0) * pi + (u.output_tokens || 0) * po) / 1e6 });
    if (!items.length) return status("ИИ не вернул ни одной новинки");

    await sb.from("news").insert({ app: "kino", week: weekLabel(), items });
    // старые подборки старше двух месяцев не нужны
    await sb.from("news").delete().lt("created_at", new Date(Date.now() - 60 * 864e5).toISOString());
    await status(`готово: ${items.length} новинки`);
  };
  // Поиск в интернете может идти до пары минут: отвечаем сразу, а работа идёт в фоне.
  const run = job().catch(async (e) => { console.error("news job", e); await status("ошибка: " + String(e).slice(0, 200)); });
  // @ts-ignore: EdgeRuntime есть в Supabase
  if (typeof EdgeRuntime !== "undefined") { EdgeRuntime.waitUntil(run); return json(202, { started: true }); }
  await run;
  return json(200, { started: true });
});
