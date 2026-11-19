// Серверная функция `ai` (Supabase Edge Function): единственное место, где используется ключ OpenAI.
// Приложение присылает сюда задание (prompt), функция:
//   1) проверяет, что человек вошёл, не отключён и не превысил лимиты (ai_gate в базе);
//   2) отправляет запрос в OpenAI моделью, выбранной владельцем в «Статистике»;
//   3) отдаёт ответ (для подбора — по кусочкам, сразу как он появляется);
//   4) записывает в журнал usage, сколько это стоило. Текст запросов и ответов не сохраняется.
//      Подбор записывается сразу, как только OpenAI начал отвечать (с примерной стоимостью):
//      приложение обрывает ответ, когда набралось 3 варианта, и запись в конце могла не успеть.
//      В конце, если сервер успевает, добавляется строка-поправка kind = "fix" с разницей до точной стоимости.
// Секрет OPENAI_API_KEY задаётся в Supabase → Edge Functions → Secrets. В коде ключа нет.
import { createClient } from "npm:@supabase/supabase-js@2";

// Цены за 1 млн токенов, $ (вход, выход). Модели, которых тут нет, выбрать нельзя.
const PRICES: Record<string, [number, number]> = {
  "gpt-6.2-sol": [2, 10],
  "gpt-6.1-terra": [0.5, 2.5],
};
const KINDS = ["pick", "quick", "taste", "test"] as const;
type Kind = typeof KINDS[number];
const MAX_PROMPT = 16000;                       // символов в задании
const MAX_OUT: Record<Kind, number> = { pick: 4000, quick: 1000, taste: 1500, test: 200 };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-left-today, x-model",
};
const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

const cost = (model: string, inT: number, outT: number) => {
  const [pi, po] = PRICES[model] ?? [0, 0];
  return (inT * pi + outT * po) / 1e6;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method" });

  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return json(500, { code: "no_key" });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Кто это
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who, error: whoErr } = await sb.auth.getUser(token);
  if (whoErr || !who?.user) return json(401, { code: "login" });
  const uid = who.user.id;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { code: "bad_request" }); }
  const app = body.app === "knigi" ? "knigi" : "kino";
  const stream = body.stream === true;
  const kind: Kind = (KINDS as readonly string[]).includes(String(body.kind)) ? body.kind as Kind : (stream ? "pick" : "quick");
  const prompt = String(body.prompt ?? "").slice(0, MAX_PROMPT);
  if (!prompt.trim()) return json(400, { code: "bad_request" });

  // 2. Можно ли
  const { data: gate, error: gateErr } = await sb.rpc("ai_gate", { uid, kind });
  if (gateErr || !gate) { console.error("ai_gate", gateErr); return json(500, { code: "server" }); }
  if (!gate.ok) return json(gate.code === "disabled" || gate.code === "forbidden" ? 403 : 429, { code: gate.code });
  let model: string = gate.model;
  if (kind === "test" && typeof body.model === "string" && PRICES[body.model]) model = body.model;
  if (!PRICES[model]) return json(500, { code: "bad_model" });

  const log = async (inT: number, outT: number, estimated: boolean, k: string = kind, usd?: number) => {
    const { error } = await sb.from("usage").insert({
      user_id: uid, app, kind: k, model, in_tokens: inT, out_tokens: outT,
      cost_usd: usd ?? cost(model, inT, outT), estimated,
    });
    if (error) console.error("usage insert", error);
  };

  // 3. Запрос в OpenAI
  const ctl = new AbortController();
  const started = Date.now();
  let r: Response;
  try {
    r = await fetch((Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com") + "/v1/chat/completions", {
      method: "POST",
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: MAX_OUT[kind],
        stream,
        ...(stream ? { stream_options: { include_usage: true } } : {}),
      }),
    });
  } catch (e) {
    console.error("openai fetch", e);
    return json(502, { code: "provider" });
  }
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 500);
    console.error("openai", r.status, detail);
    return json(502, { code: r.status === 429 ? "provider_busy" : "provider", ...(kind === "test" ? { detail } : {}) });
  }
  const headers = { ...CORS, "x-model": model, "x-left-today": gate.left_today == null ? "" : String(gate.left_today) };

  // Обычный ответ целиком (быстро добавить, мой вкус, проверка модели)
  if (!stream) {
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content ?? "";
    const u = j?.usage ?? {};
    await log(u.prompt_tokens ?? 0, u.completion_tokens ?? 0, false);
    return json(200, { text, model, ms: Date.now() - started }, headers);
  }

  // Подбор: передаём текст кусочками. Приложение может прервать запрос, когда набралось 3 варианта.
  const reader = r.body!.getReader();
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = "", outChars = 0, usage: { prompt_tokens: number; completion_tokens: number } | null = null, logged = false;
  // Сразу засчитываем подбор с примерной стоимостью (≈2,5 символа на токен для русского текста, ответ ≈450 токенов).
  const estIn = Math.ceil(prompt.length / 2.5), estOut = 450;
  await log(estIn, estOut, true);
  const finish = async () => {
    if (logged) return; logged = true;
    // Точные цифры, если OpenAI их прислал; иначе (ответ прервали) оценка по тому, что успели получить.
    const inT = usage ? usage.prompt_tokens : estIn;
    const outT = usage ? usage.completion_tokens : Math.ceil(outChars / 2.5);
    const diff = cost(model, inT, outT) - cost(model, estIn, estOut);
    if (inT !== estIn || outT !== estOut) await log(inT - estIn, outT - estOut, !usage, "fix", diff);
  };
  // Поправку дописываем «в фоне», чтобы обрыв со стороны приложения её не прерывал.
  const finishBg = () => {
    const p = finish();
    try { (globalThis as unknown as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(p); } catch { /* нет EdgeRuntime — просто ждём */ }
    return p;
  };
  const out = new ReadableStream<Uint8Array>({
    // Читаем ответ OpenAI, пока не появится текст для приложения (служебные куски без текста пропускаем).
    async pull(c) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) { await finishBg(); c.close(); return; }
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          let sent = false;
          for (const line of lines) {
            const l = line.trim();
            if (!l.startsWith("data:")) continue;
            const d = l.slice(5).trim();
            if (d === "[DONE]") continue;
            try {
              const j = JSON.parse(d);
              const t = j?.choices?.[0]?.delta?.content;
              if (t) { outChars += t.length; c.enqueue(enc.encode(t)); sent = true; }
              if (j?.usage) usage = j.usage;
            } catch { /* битая строка — пропускаем */ }
          }
          if (sent) return;
        }
      } catch (e) {
        if (!ctl.signal.aborted) console.error("stream", e);   // прерывание приложением — не ошибка
        await finishBg();
        try { c.close(); } catch { /* уже закрыт */ }
      }
    },
    async cancel() { ctl.abort(); await finishBg(); },
  });
  return new Response(out, { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
});
