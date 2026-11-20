/* «Что посмотреть» — логика приложения.
   Интерфейс и промпты перенесены из прототипа (артефакт Claude).
   Хранение: пока в браузере (localStorage); на шаге 2 добавится синхронизация через Supabase.
   ИИ: через серверную функцию Supabase `ai` (шаг 3); пока сервер не подключён — понятное сообщение. */
"use strict";

const APP = "kino";
const CFG = window.APP_CONFIG || {};
const LS_KEY = "kino.v1";

const state = { profile: "", items: [] };
let news = null;             // «Новинки недели» — придут с сервера
let shownThisVisit = [];     // что уже предлагали в этот раз
let current = [];            // текущие карточки подбора
let busy = false, picking = false, saveTimer = null;
const openGroups = new Set();

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s||"").toLowerCase().replace(/ё/g,"е").replace(/[^a-zа-я0-9]/g,"");
const KIND = {film:"Фильм", series:"Сериал"};

/* ---------- иконки (единый контурный стиль) ---------- */
const P = {
  spark:'<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/><path d="M19 3v4M17 5h4"/>',
  play:'<path d="M7 4.5v15l12-7.5z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  up:'<path d="M7 10v11"/><path d="M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 8a2 2 0 0 1-1.9 1.4H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z"/>',
  down:'<path d="M17 14V3"/><path d="M9 18.1 10 14H4.2a2 2 0 0 1-1.9-2.6l2.3-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.8a2 2 0 0 0-1.8 1.1L12 22a3.1 3.1 0 0 1-3-3.9z"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  dice:'<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/>',
  film:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/>',
  heart:'<path d="M12 20s-7-4.4-9.2-8.6C1.3 8.5 2.9 5 6.3 5c2 0 3.2 1.1 3.9 2.1L12 9l1.8-1.9C14.5 6.1 15.7 5 17.7 5c3.4 0 5 3.5 3.5 6.4C19 15.6 12 20 12 20z"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  chev:'<path d="M6 9l6 6 6-6"/>',
  share:'<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  squarePlus:'<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>',
  pagemenu:'<rect x="3" y="4" width="7" height="5.5" rx="1.3" fill="currentColor" stroke="none"/><path d="M4 13h12M4 16.5h16M4 20h11"/>',
  dots:'<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  vdots:'<circle cx="12" cy="5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="19" r="1.3" fill="currentColor"/>',
  install:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 7.5v6M9.5 11l2.5 2.5 2.5-2.5M8 21h8"/>'
};
const IC = (n, sw) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw||1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const ARR = `<span class="arr">${IC("chev",2)}</span>`;
const VERD = {later:"Позже", watching:"Смотрю", liked:"Понравилось", seen:"Видел", disliked:"Не моё"};
const VIC = {later:"clock", watching:"play", liked:"up", seen:"eye", disliked:"down"};

function toast(t,ms){const el=$("#toast");el.textContent=t;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),ms||2400)}

/* ---------- хранение ---------- */
function localLoad(){try{const s=JSON.parse(localStorage.getItem(LS_KEY)||"null");if(s){state.profile=s.profile||"";state.items=s.items||[]}}catch(e){}}
function localSave(){try{localStorage.setItem(LS_KEY,JSON.stringify({profile:state.profile,items:state.items,updated:Date.now()}))}catch(e){}}
function save(){ clearTimeout(saveTimer); saveTimer=null; localSave(); if(window.Sync) Sync.schedule(); }
function saveSoon(){ localSave(); clearTimeout(saveTimer); saveTimer=setTimeout(save,900); }

/* ---------- записи списка ---------- */
function findItem(title){const n=norm(title);return state.items.find(i=>norm(i.title)===n)}
function setVerdict(rec, verdict){
  let it = findItem(rec.title);
  if(it){
    it.verdict = verdict; it.ts = Date.now();
    if(rec.note && !it.note) it.note = rec.note;
  } else {
    it = {title:rec.title, year:rec.year||"", kind:rec.kind==="series"?"series":"film", verdict, ts:Date.now(),
          note:rec.note||"", hook:rec.hook||"", actors:rec.actors||""};
    state.items.unshift(it);
  }
  if(verdict==="watching" && it.kind==="series"){
    if(rec.season) it.season=+rec.season;
    if(rec.episode) it.episode=+rec.episode;
    if(!it.season) it.season=1;
    if(!it.episode) it.episode=1;
  }
  save(); renderList();
  return it;
}
function removeItem(title){state.items=state.items.filter(i=>norm(i.title)!==norm(title));save();renderList()}

/* ---------- вкладки и чипы ---------- */
function showTab(name){
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on",x.dataset.tab===name));
  $("#pick").classList.toggle("hidden",name!=="pick");
  $("#list").classList.toggle("hidden",name!=="list");
  if(name==="list") renderList();
  window.scrollTo({top:0});
}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
document.querySelectorAll(".wrap .chips").forEach(g=>g.addEventListener("click",e=>{
  const c=e.target.closest(".chip");if(!c)return;
  g.querySelectorAll(".chip").forEach(x=>x.classList.toggle("on",x===c));
}));
const val = id => document.querySelector(`#${id} .chip.on`).dataset.v;

/* ---------- ИИ (через серверную функцию) ---------- */
const AI = {
  leftToday: null,   // сколько подборов осталось сегодня (присылает сервер; null — без лимита)
  ready(){ return !!(CFG.supabaseUrl && CFG.supabaseAnonKey && CFG.aiEnabled); },
  async _post(body, signal){
    if(!this.ready()) throw {code:"no_server"};
    const token = window.Auth && Auth.token && Auth.token();
    if(!token) throw {code:"login"};
    let r;
    try{
      r = await fetch(CFG.supabaseUrl.replace(/\/$/,"") + "/functions/v1/ai", {
        method:"POST", signal,
        headers:{"Content-Type":"application/json", apikey:CFG.supabaseAnonKey, Authorization:"Bearer "+token},
        body: JSON.stringify({app:APP, ...body})
      });
    }catch(e){ if(e && e.name==="AbortError") throw {code:"cancelled"}; throw {code:"network"}; }
    if(!r.ok){
      let code = r.status===401?"login":r.status===403?"disabled":r.status===429?"limit":"server";
      try{ const j=await r.json(); if(j && j.code) code=j.code; }catch(e){}
      throw {code};
    }
    const left = r.headers.get("x-left-today");
    this.leftToday = left === null || left === "" ? null : +left;
    return r;
  },
  // Потоковый ответ: текст приходит кусочками, onText({delta}) вызывается на каждый кусочек.
  async stream(prompt, {signal, onText, kind}={}){
    const r = await this._post({prompt, kind:kind||"pick", stream:true}, signal);
    const reader = r.body.getReader(), dec = new TextDecoder();
    let all = "";
    try{
      for(;;){
        const {done, value} = await reader.read();
        if(done) break;
        const delta = dec.decode(value, {stream:true});
        all += delta; onText && onText({delta});
      }
    }catch(e){ if(e && e.name==="AbortError") throw {code:"cancelled"}; throw e; }
    return {text: all};
  },
  async ask(prompt, {kind}={}){
    const r = await this._post({prompt, kind:kind||"quick", stream:false});
    const j = await r.json();
    return {text: j.text || ""};
  }
};
function parseJSON(t){
  const a=t.indexOf("{"), b=t.lastIndexOf("}");
  if(a<0||b<a) throw new Error("no json");
  return JSON.parse(t.slice(a,b+1));
}
function aiError(e){
  const c = e && e.code;
  return c==="no_server" ? "Подбор заработает, когда подключим сервер. Список уже можно вести."
       : c==="login" ? "Войдите, чтобы пользоваться подбором"
       : c==="disabled" ? "Доступ отключён владельцем приложения"
       : c==="limit" ? "На сегодня подборы закончились. Завтра будут новые"
       : c==="month_limit" ? "Лимит подборов на этот месяц закончился. Напишите автору приложения"
       : c==="global_limit" ? "Подбор временно недоступен. Напишите автору приложения"
       : c==="provider_busy" ? "ИИ сейчас перегружен. Попробуйте через минуту"
       : c==="no_key" || c==="provider" || c==="bad_model" ? "ИИ сейчас недоступен. Попробуйте позже или напишите автору"
       : c==="network" ? "Нет связи с сервером. Проверьте интернет"
       : c==="empty" ? "Новых вариантов не нашлось. Попробуйте другое настроение или «Похоже на…»"
       : "Не получилось. Попробуйте ещё раз";
}

/* ---------- подбор ---------- */
function listBy(v){return state.items.filter(i=>i.verdict===v).map(i=>i.title+(i.year?` (${i.year})`:"")+(i.note?` — ${i.note}`:"")).join("; ")||"—"}

function buildPrompt(count, surprise){
  const kind = val("kinds");
  const kindTxt = kind==="film"?"только фильмы":kind==="series"?"только сериалы":"фильмы или сериалы";
  const sim = $("#similar").value.trim();
  const exclude = [...state.items.map(i=>i.title), ...shownThisVisit, ...((news&&news.items)||[]).map(i=>i.title)].join("; ") || "—";
  return `Ты — личный советчик по кино для одного человека. Подбери ровно ${count} ${count===1?"вариант":"варианта"}: ${kindTxt}.

Его вкус (написал сам): ${state.profile || "не указан"}
Понравилось: ${listBy("liked")}
Смотрит сейчас: ${listBy("watching")}
Не понравилось: ${listBy("disliked")}

${surprise
  ? "Режим «Удиви меня»: один неочевидный вариант, который он вряд ли знает, но который очень вероятно ему зайдёт. Учитывай его вкус."
  : `Настроение сейчас: ${val("moods")}.`}
${sim ? `Хочется чего-то похожего на: ${sim}.` : ""}

НЕ предлагай (уже видел, в списке или уже предлагали): ${exclude}

Правила:
- только реально существующие фильмы и сериалы;
- названия как в российском прокате;
- разные по жанру и стилю, не три одинаковых;
- все варианты РАЗНЫЕ, ни одного повтора и ничего из списка «НЕ предлагай»;
- без спойлеров.

Ответь строго по одному JSON-объекту на строку (каждый объект целиком на одной строке), без массива, без нумерации и без текста вокруг. Внутри строк не используй прямые кавычки ", только «ёлочки». Формат каждой строки:
{"title":"русское название","original":"оригинальное название","year":2010,"kind":"film или series","genre":"жанр коротко","actors":"2-3 известных актёра","length":"например 2 ч 5 мин или 5 сезонов","hook":"завязка в одном предложении","why":"1-2 предложения, почему именно ему, со ссылкой на его вкус"}`;
}

function isNew(x){
  if(!x || !x.title) return false;
  const n = norm(x.title);
  return !findItem(x.title) && !current.some(y=>norm(y.title)===n) && !shownThisVisit.some(t=>norm(t)===n);
}
// Читает ответ построчно (JSON Lines), показывает карточки по мере появления,
// останавливает запрос, когда набралось нужное число новых вариантов.
async function askStream(prompt, want, onRec){
  const ctl = new AbortController();
  let pending = "", got = 0;
  const eat = raw => {
    if(got>=want) return;
    const line = raw.trim().replace(/^```(json)?/,"").replace(/```$/,"").replace(/,\s*$/,"").trim();
    const a = line.indexOf("{"), b = line.lastIndexOf("}");
    if(a<0 || b<a) return;
    let x; try{ x = JSON.parse(line.slice(a,b+1)); }catch(e){ return; }
    if(!isNew(x)) return;
    onRec(x); got++;
    if(got>=want) ctl.abort();
  };
  try{
    await AI.stream(prompt, {kind:"pick", signal:ctl.signal,
      onText:({delta})=>{ const lines=(pending+delta).split("\n"); pending=lines.pop(); lines.forEach(eat); }});
    if(pending.trim()) eat(pending);
  }catch(e){
    if(!(e && e.code==="cancelled")){ if(pending.trim()) eat(pending); if(!got) throw e; }
  }
  return got;
}

async function pick(surprise){
  if(busy) return;
  if(!AI.ready()){ $("#results").innerHTML = `<div class="status">${aiError({code:"no_server"})}</div>`; return; }
  busy = true; picking = true; $("#go").disabled = $("#surprise").disabled = true;
  const count = surprise?1:3; lastSurprise=!!surprise; resultsShown=false;
  current = [];
  $("#results").innerHTML = `<div class="status"><span class="dots">Думаю, что вам понравится</span></div>`;
  $("#results").scrollIntoView({behavior:"smooth",block:"start"});
  try{
    for(let attempt=0; attempt<2 && current.length<count; attempt++){
      await askStream(buildPrompt(count+2, surprise), count-current.length, x=>{
        x.kind = (x.kind==="series"?"series":"film");
        shownThisVisit.push(x.title);
        current.push(x);
        renderResults();
      });
    }
    if(!current.length) throw {code:"empty"};
  }catch(e){
    if(!current.length) $("#results").innerHTML = `<div class="status">${aiError(e)}</div>`;
  }finally{
    busy=false; picking=false; $("#go").disabled = $("#surprise").disabled = false;
    if(current.length){ countPick(); renderResults(); }
  }
}
/* «Нравятся подборки?» — иногда под результатами: после 10 удачных подборов,
   и снова не раньше чем через 30 дней после того, как человек закрыл карточку или нажал «Поблагодарить». */
const THANKS_KEY = APP + ".thanksCard", PICKS_KEY = APP + ".picksDone";
function countPick(){ try{ localStorage.setItem(PICKS_KEY, String((+localStorage.getItem(PICKS_KEY) || 0) + 1)); }catch(e){} }
function maybeThanksCard(){
  const link = $("#thanksLink"); if(!link || link.classList.contains("hidden")) return;
  let picks = 0, last = 0;
  try{ picks = +localStorage.getItem(PICKS_KEY) || 0; last = +localStorage.getItem(THANKS_KEY) || 0; }catch(e){}
  if(picks < 10 || Date.now() - last < 30 * 864e5) return;
  $("#results").insertAdjacentHTML("beforeend", `<div class="thanks-card">${IC("heart")}<div class="tc-t"><b>Нравятся подборки?</b><p>Можно поблагодарить автора. Это помогает приложению работать дальше.</p><a href="#" id="tcGo">Поблагодарить</a></div><button class="tc-x" id="tcX" aria-label="Закрыть">${IC("x")}</button></div>`);
  const done = () => { try{ localStorage.setItem(THANKS_KEY, String(Date.now())); }catch(e){} const c=$(".thanks-card"); if(c) c.remove(); };
  $("#tcX").onclick = done; $("#tcGo").addEventListener("click", e => { e.preventDefault(); $("#thanksLink").click(); setTimeout(done, 300); });
}
$("#go").onclick=()=>pick(false);
$("#surprise").onclick=()=>pick(true);
// Кнопка «Подобрать» прилипает к низу экрана; когда прилипла, под ней фон, чтобы не просвечивали чипы.
(() => {
  const bar = document.querySelector("#pick > .btns"); if(!bar) return;
  const check = () => {
    const r = bar.getBoundingClientRect(), gap = parseFloat(getComputedStyle(bar).bottom) || 10;
    bar.classList.toggle("stuck", r.height > 0 && r.bottom >= window.innerHeight - gap - 1);
  };
  addEventListener("scroll", check, {passive:true}); addEventListener("resize", check);
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => setTimeout(check, 50)));
  setTimeout(check, 300);
})();


// Значки площадок (простые монограммы в фирменных цветах): ссылка ведёт на поиск по названию.
const SITES = {
  yt:  {n:"YouTube",       bg:"#ff0033", fg:"#fff", g:'<svg viewBox="0 0 24 24" width="12" height="12"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>', u:q=>"https://www.youtube.com/results?search_query="+q},
  vk:  {n:"VK Видео",      bg:"#0077ff", fg:"#fff", g:"VK", u:q=>"https://vk.com/video?q="+q},
  rt:  {n:"Rutube",        bg:"#100943", fg:"#fff", g:"R",  u:q=>"https://rutube.ru/search/?query="+q},
  lit: {n:"Литрес",        bg:"#ff4c00", fg:"#fff", g:"Л",  u:q=>"https://www.litres.ru/search/?q="+q},
  cg:  {n:"Читай-город",   bg:"#ff6a00", fg:"#fff", g:"ЧГ", u:q=>"https://www.chitai-gorod.ru/search?phrase="+q},
  oz:  {n:"Ozon",          bg:"#005bff", fg:"#fff", g:"O",  u:q=>"https://www.ozon.ru/search/?text="+q},
  ym:  {n:"Яндекс Маркет", bg:"#ffcc00", fg:"#1a1a1a", g:"М", u:q=>"https://market.yandex.ru/search?text="+q}
};
const site = (k, q) => { const x = SITES[k]; return `<a class="site" href="${x.u(q)}" target="_blank" rel="noopener" title="${x.n}" aria-label="${x.n}" style="background:${x.bg};color:${x.fg}">${x.g}</a>`; };
function links(x, small){
  const tq = encodeURIComponent(`${x.title} ${x.year||""} трейлер на русском`.replace(/\s+/g," "));
  return `<div class="links${small?" sm":""}"><span class="lk">Трейлер</span>${["yt","vk","rt"].map(k=>site(k,tq)).join("")}</div>`;
}

function card(x, i, src){
  const it = findItem(x.title);
  const v = it && it.verdict;
  const acts = x.kind==="series" ? ["later","watching","liked","disliked"] : ["later","liked","seen","disliked"];
  return `<div class="card ${v?"done":""}">
    <span class="kind">${KIND[x.kind]||""}${x.genre?" · "+esc(x.genre):""}</span>
    <h3>${esc(x.title)}</h3>
    <div class="meta">${esc(x.year||"")}${x.original&&x.original!==x.title?" · "+esc(x.original):""}${x.length?" · "+esc(x.length):""}</div>
    ${x.actors?`<div class="meta">В ролях: ${esc(x.actors)}</div>`:""}
    ${x.where?`<div class="meta">Где смотреть: ${esc(x.where)}</div>`:""}
    <div class="hook">${esc(x.hook||"")}</div>
    ${x.why?`<div class="why">${esc(x.why)}</div>`:""}
    <div class="acts">
      ${acts.map(k=>`<button class="act ${v===k?"sel":""}" data-src="${src}" data-i="${i}" data-k="${k}">${IC(VIC[k])}${VERD[k]}</button>`).join("")}
    </div>
    ${links(x)}
  </div>`;
}

let resultsShown=false, lastSurprise=false;
function renderResults(){
  if(!current.length){
    // все карточки разобраны — предлагаем следующие
    $("#results").innerHTML = resultsShown && !picking ? `<div class="status">Все варианты разобраны</div><div class="btns"><button class="btn ghost" style="flex:1" id="more">Ещё варианты</button></div>` : "";
    const mb=$("#more"); if(mb) mb.onclick=()=>pick(lastSurprise);
    return;
  }
  resultsShown=true;
  $("#results").innerHTML = current.map((x,i)=>card(x,i,"r")).join("") + (picking ? `<div class="status"><span class="dots">Подбираю ещё</span></div>` : `<div class="btns"><button class="btn ghost" style="flex:1" id="more">Не то, ещё варианты</button></div>
  ${AI.leftToday !== null && AI.leftToday <= 5 ? `<div class="note left-note">${AI.leftToday ? "Сегодня осталось подборов: " + AI.leftToday : "На сегодня подборы закончились"}</div>` : ""}
  <div class="note">Видели? Отметьте «Понравилось» или «Не моё». Чем больше отметок, тем точнее подборка.</div>`);
  if(!picking) maybeThanksCard();
  const mb=$("#more"); if(mb) mb.onclick=()=>pick(lastSurprise);
}

function nextFriday(){
  const d=new Date(); d.setDate(d.getDate()+((5-d.getDay()+7)%7));
  return d.toLocaleDateString("ru-RU",{day:"numeric",month:"long"});
}
// «Где смотреть» коротко: без ссылок и пояснений, только название сервиса
const shortWhere = w => String(w||"").replace(/\(\s*\[[^\]]*\]\([^)]*\)\s*\)/g,"").replace(/\[([^\]]*)\]\([^)]*\)/g,"$1").replace(/https?:\/\/\S+/g,"").split(/\s[—–-]\s|[.;(]/)[0].trim();
// «Новинки недели» — компактная полоска: название, тип и где смотреть. Нажатие раскрывает завязку.
const newsHidden = new Set(JSON.parse((()=>{ try{ return localStorage.getItem("kino.newsHidden")||"[]"; }catch(e){ return "[]"; } })()));
function renderNews(){
  const el=$("#news");
  if(!news || !news.items || !news.items.length){ el.innerHTML=""; return; }
  const list = news.items.map((x,i)=>{x.kind=x.kind==="series"?"series":"film";return [x,i]}).filter(([x])=>!findItem(x.title) && !newsHidden.has(norm(x.title)));
  if(!list.length){ el.innerHTML=""; return; }
  el.innerHTML = `<details class="news-box" ${newsOpen?"open":""}><summary><span class="nh">${IC("spark")}Новинки недели</span><small>${esc(news.week||"")}</small>${ARR}</summary>
    ${list.map(([x,i])=>`<div class="news-row">
      <div class="nt"><b>${esc(x.title)}</b><span>${[KIND[x.kind], x.genre, shortWhere(x.where)].filter(Boolean).map(esc).join(" · ")}</span>
        ${x.hook?`<p>${esc(x.hook)}</p>`:""}</div>
      <div class="na"><button class="act-mini" data-n="${i}" data-k="later" title="Посмотреть позже">${IC("clock")}Позже</button><button class="act-mini x" data-n="${i}" data-k="hide" title="Не интересно" aria-label="Не интересно">${IC("x")}</button></div>
    </div>`).join("")}</details>`;
}
let newsOpen = false;
$("#news").addEventListener("toggle", e => { if(e.target.classList.contains("news-box")) newsOpen = e.target.open; }, true);
$("#news").addEventListener("click", e => {
  const b = e.target.closest(".act-mini"); if(!b) return;
  const x = news.items[+b.dataset.n]; if(!x) return;
  if(b.dataset.k === "hide"){ newsHidden.add(norm(x.title)); try{ localStorage.setItem("kino.newsHidden", JSON.stringify([...newsHidden].slice(-60))); }catch(e){} renderNews(); return; }
  setVerdict(x, "later"); toast("Добавил в «Посмотреть позже»"); renderNews();
});

function onAct(e){
  const b=e.target.closest(".act");if(!b)return;
  const src=b.dataset.src, x = src==="n" ? news.items[+b.dataset.i] : current[+b.dataset.i];
  if(!x) return;
  setVerdict(x,b.dataset.k);
  toast(b.dataset.k==="later"?"Добавил в «Посмотреть позже»":b.dataset.k==="watching"?"Добавил в «Смотрю сейчас»":"Запомнил");
  // отмеченная карточка плавно исчезает
  const el=b.closest(".card"); if(el) el.classList.add("gone");
  setTimeout(()=>{ if(src==="r") current=current.filter(y=>y!==x); renderResults(); renderNews(); },260);
}
$("#results").addEventListener("click",onAct);

/* ---------- мой список ---------- */
// После «Досмотрел / Дочитал / Посмотрел» спрашиваем: понравилось или нет.
const asking = new Set();
function rateRow(i){
  const t = `data-t="${esc(i.title)}"`;
  return `<div class="rate"><span>Как вам?</span><button ${t} data-k="fin-up">${IC("up")}Понравилось</button><button ${t} data-k="fin-down">${IC("down")}Не зашло</button></div>`;
}
const EMPTY = {"watching": "Здесь будет то, что вы сейчас смотрите", "liked": "Здесь будет то, что понравилось", "disliked": "Здесь будет то, что не понравилось. Такое больше не предложу", "seen": "Здесь будет то, что уже видели"};

function renderList(){
  const later = state.items.filter(i=>i.verdict==="later").length;
  $("#laterCnt").textContent = later?later:"";
  if($("#list").classList.contains("hidden")) return;
  const groups=[["watching",IC("play")+"Смотрю сейчас"],["later",IC("clock")+"Посмотреть позже"],["liked",IC("up")+"Понравилось"],["disliked",IC("down")+"Не зашло"],["seen",IC("eye")+"Видел"]];
  const t = i => `data-t="${esc(i.title)}"`;
  const del = i => `<button ${t(i)} data-k="del" title="Убрать" aria-label="Убрать">${IC("x")}</button>`;
  const yr = i => i.year?` <span class="yr">${esc(i.year)}</span>`:"";
  const q = norm(($("#listQ")||{}).value||"");
  const hit = i => !q || norm([i.title,i.author,i.note,i.original].filter(Boolean).join(" ")).includes(q);
  const open = k => (q || openGroups.has(k))?"open":"";
  $("#lists").innerHTML = groups.map(([k,name])=>{
    const arr = state.items.filter(i=>i.verdict===k && hit(i));
    if(q && !arr.length) return "";
    let body;
    if(!arr.length && k!=="later"){
      body = `<div class="empty">${EMPTY[k]}</div>`;
    } else if(k==="watching"){
      body = arr.map(i=>`
      <div class="row watch"><div class="top"><div class="t"><b>${esc(i.title)}</b>${i.note?`<div>${esc(i.note)}</div>`:""}</div>
        <div class="mini">${del(i)}</div></div>
        <div class="prog"><button class="fin" ${t(i)} data-k="ask">${IC("check")}Досмотрел</button></div>${asking.has(norm(i.title))?rateRow(i):""}</div>`).join("");
    } else if(k==="later"){
      body = arr.length ? arr.map(i=>`<div class="row stack"><div class="top"><div class="t"><b>${esc(i.title)}</b>${yr(i)}
        <div>${KIND[i.kind]||""}${i.note?" · "+esc(i.note):""}${i.hook?" · "+esc(i.hook):""}</div></div>
        <div class="mini"><button ${t(i)} data-k="watching" class="start" title="Перенести в «Смотрю сейчас»"><span>Начать</span></button>${del(i)}</div></div>${asking.has(norm(i.title))?rateRow(i):""}${links(i,true)}</div>`).join("")
        : `<div class="empty">Пока пусто. Добавляйте из подборок или то, что посоветовали</div>`;
    } else {
      body = arr.map(i=>`<div class="row"><div class="t"><b>${esc(i.title)}</b>${yr(i)}
        <div>${KIND[i.kind]||""}${i.note?" · "+esc(i.note):""}</div></div>
        <div class="mini">${del(i)}</div></div>`).join("");
    }
    return `<details class="sec fold" data-g="${k}" ${open(k)}><summary><h2>${name} <small>${arr.length||""}</small>${ARR}</h2></summary>${body}</details>`;
  }).join("") || `<div class="empty" style="margin-top:12px">По запросу «${esc($("#listQ").value.trim())}» ничего не нашлось</div>`;
}
$("#listQ").addEventListener("input", () => renderList());
// Поиск по списку: поле поднимается к верху экрана, чтобы найденное было видно над клавиатурой.
(() => {
  const q = $("#listQ"), box = q.closest(".list-search");
  const up = () => box.scrollIntoView({block: "start"});
  q.addEventListener("focus", () => { document.body.classList.add("searching"); up(); setTimeout(up, 350); });
  q.addEventListener("input", up);
  q.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); q.blur(); } });   // «Найти» убирает клавиатуру
  q.addEventListener("blur", () => { if(!q.value.trim()) document.body.classList.remove("searching"); });
})();
$("#lists").addEventListener("toggle",e=>{
  const d=e.target; if(!d.dataset||!d.dataset.g) return;
  d.open ? openGroups.add(d.dataset.g) : openGroups.delete(d.dataset.g);
},true);
$("#lists").addEventListener("click",e=>{
  const b=e.target.closest("button[data-k]");if(!b)return;
  const k=b.dataset.k, it=findItem(b.dataset.t);
  if(k==="del") return removeItem(b.dataset.t);
  if(k==="ep+"||k==="ep-"||k==="s+"){
    if(!it) return;
    if(k==="ep+") it.episode=(it.episode||1)+1;
    if(k==="ep-") it.episode=Math.max(1,(it.episode||1)-1);
    if(k==="s+"){ it.season=(it.season||1)+1; it.episode=1; }
    it.ts=Date.now(); renderList(); saveSoon(); return;
  }
  if(k==="ask"){ const n=norm(b.dataset.t); asking.has(n)?asking.delete(n):asking.add(n); renderList(); return; }
  if(k==="fin-down"){ asking.delete(norm(b.dataset.t)); setVerdict({title:b.dataset.t},"disliked"); toast("Перенёс в «Не зашло». Такое больше не предложу"); return; }
  if(k==="fin-up"){
    asking.delete(norm(b.dataset.t));
    setVerdict({title:b.dataset.t},"liked");
    toast("Поздравляю! Подбираю, что смотреть дальше");
    $("#similar").value=b.dataset.t;
    document.querySelectorAll("#kinds .chip").forEach(c=>c.classList.toggle("on",c.dataset.v==="series"));
    showTab("pick"); pick(false); return;
  }
  setVerdict({title:b.dataset.t}, k);
  toast(k==="watching"?"Перенёс в «Смотрю сейчас»":k==="liked"?"Перенёс в «Понравилось»":k==="disliked"?"Перенёс в «Не зашло»":"Запомнил");
});

/* ---------- быстро добавить (текст; голос — через микрофон на клавиатуре телефона) ---------- */
// Записи из списка, похожие на фразу (общее слово в названии). Их отдаём ИИ, чтобы он узнал уже добавленное.
function similarItems(text){
  // слово сравниваем по первым 5 буквам, чтобы «виновного» нашло «Виновный»
  const words = t => String(t||"").toLowerCase().replace(/ё/g,"е").split(/[^a-zа-я0-9]+/).filter(w=>w.length>=3).map(w=>w.slice(0,5));
  const tw = new Set(words(text)), nt = norm(text);
  return state.items.filter(i => { const n = norm(i.title); return (n.length>=2 && nt.includes(n)) || words(i.title).some(w=>tw.has(w)); }).slice(0,15);
}
const SEC_NAME = {watching:"Смотрю сейчас", later:"Посмотреть позже", liked:"Понравилось", disliked:"Не зашло", seen:"Видел"};
async function quickAdd(){
  const text=$("#quick").value.trim(); if(!text) return;
  const near = similarItems(text);
  const nearHint = near.length ? `\nВ его списке уже есть похожие: ${near.map(i=>"«"+i.title+"»").join("; ")}. Если фраза про одну из них, верни её название точно как здесь.` : "";
  const btn=$("#addBtn"); btn.disabled=true; btn.textContent="Сохраняю…";
  let rec=null;
  if(AI.ready()){
    try{
      const r = await AI.ask(`Человек ведёт личный список фильмов и сериалов. Он написал или надиктовал фразу: «${text}».${nearHint}
Определи, о каком фильме или сериале речь, и что он хочет отметить.
Ответь только JSON-объектом без текста вокруг:
{"title":"название как в российском прокате (исправь опечатки и ошибки распознавания речи)","year":2014,"kind":"film или series","verdict":"later (посоветовали / хочу посмотреть) | watching (начал смотреть сериал) | liked (посмотрел, понравилось) | disliked (не понравилось)","season":null,"episode":null,"note":"кто посоветовал или короткая заметка из фразы, иначе пустая строка"}`, {kind:"quick"});
      rec = parseJSON(r.text);
    }catch(e){ rec=null; }
  }
  if(!rec || !rec.title) rec = {title:text.replace(/^[«"]|[»"]$/g,""), verdict:"later", kind:"film"};
  const v = ["later","watching","liked","disliked"].includes(rec.verdict)?rec.verdict:"later";
  const old = findItem(rec.title), was = old && old.verdict;
  $("#quick").value="";
  btn.disabled=false; btn.textContent="Сохранить";
  if(old && (was===v || v==="later")){
    // Уже в списке. Просто «посоветовали» не переносит из «Понравилось» и других разделов назад в «позже».
    toast(`«${old.title}» уже есть в списке: «${SEC_NAME[was]||VERD[was]}»`, 4000);
    return;
  }
  setVerdict(rec, v);
  if(old) toast(`«${old.title}» уже был в «${SEC_NAME[was]||""}», перенёс в «${SEC_NAME[v]}»`, 4000);
  else toast(`«${rec.title}» → ${VERD[v]}`);
}
// «+» при пустом поле — ставит курсор в поле (как будто нажали на поле); с текстом — добавляет.
$("#addBtn").onclick=()=>{ if(!$("#quick").value.trim()){ $("#quick").focus(); return; } quickAdd(); };
document.querySelector(".add-card").addEventListener("click",e=>{ if(!e.target.closest("button")) $("#quick").focus(); });
$("#quick").addEventListener("keydown",e=>{if(e.key==="Enter")quickAdd()});

$("#saveProfile").onclick=()=>{state.profile=$("#profile").value.trim();save();toast("Сохранил")};

/* ---------- подсказка «Установить на экран» ---------- */
const Install = (() => {
  let deferred = null;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
  const isAndroid = /Android/.test(ua);
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone===true;
  const SEEN = APP+".installHint";
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; if($(".sheet")) show(currentTab); });
  window.addEventListener("appinstalled", () => { close(); toast("Готово! Приложение на экране"); });
  let currentTab = isIOS ? "ios" : isAndroid ? "android" : "desktop";

  const steps = {
    ios: [
      `Откройте эту страницу в <b>Safari</b> (в других браузерах на iPhone пункта может не быть).`,
      `Нажмите «Поделиться» ${IC("share")} внизу экрана. В новых iOS сначала нажмите значок ${IC("pagemenu")} слева в адресной строке, а там «Поделиться».`,
      `Пролистайте и выберите «На экран „Домой“» ${IC("squarePlus")}.`,
      `Нажмите «Добавить». Иконка появится рядом с остальными приложениями.`
    ],
    android: [
      `Откройте ссылку в <b>браузере</b> телефона: Chrome, Samsung Internet, Яндекс или любом другом. Если она открылась внутри Telegram, скопируйте ссылку и вставьте её в браузер.`,
      `Откройте меню браузера: три точки ${IC("vdots")} вверху или три полоски <b>≡</b> внизу.`,
      `Выберите «Установить приложение» или «Добавить на главный экран». В Samsung Internet: «Добавить страницу на» → «Главный экран».`,
      `Если на новой иконке есть маленький значок браузера, это просто закладка. Удалите её и выберите «Установить приложение».`
    ],
    desktop: [
      `Откройте страницу в <b>Chrome</b>, <b>Яндекс Браузере</b> или <b>Edge</b>.`,
      `Нажмите значок установки ${IC("install")} справа в адресной строке или откройте меню браузера → «Установить приложение».`,
      `В Safari на Mac: меню «Файл» → «Добавить в Dock».`
    ]
  };
  function show(tab){
    currentTab = tab || currentTab;
    const native = deferred && currentTab!=="ios";
    $("#sheet").innerHTML = `<div class="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shTitle">
      <h3 id="shTitle">Поставьте приложение на экран</h3>
      <p>Так оно будет открываться одним нажатием, как обычное приложение: без браузера и адресной строки.</p>
      <div class="seg chips">${[["ios","iPhone"],["android","Android"],["desktop","Компьютер"]].map(([k,n])=>`<button class="chip ${k===currentTab?"on":""}" data-os="${k}">${n}</button>`).join("")}</div>
      ${native?`<div class="btns"><button class="btn main" id="shInstall">Установить</button></div><p>Или вручную:</p>`:""}
      <ol>${steps[currentTab].map(s=>`<li><span>${s}</span></li>`).join("")}</ol>
      <div class="btns"><button class="btn ghost" style="flex:1" id="shClose">Понятно</button></div>
    </div></div>`;
    $(".sheet-bg").onclick = e => { if(e.target.classList.contains("sheet-bg")) close(); };
    $("#shClose").onclick = close;
    $(".sheet .seg").onclick = e => { const c=e.target.closest("[data-os]"); if(c) show(c.dataset.os); };
    const ib = $("#shInstall");
    if(ib) ib.onclick = async () => { const d=deferred; deferred=null; d.prompt(); try{ await d.userChoice; }catch(e){} close(); };
  }
  function close(){ $("#sheet").innerHTML = ""; try{ localStorage.setItem(SEEN,"1"); }catch(e){} }
  function maybeAuto(){
    if(standalone()) { $("#howInstall").classList.add("hidden"); return; }
    // Полоска вверху «Подобрать», пока приложение открыто в браузере на телефоне.
    if(isIOS || isAndroid){
      $("#pick").insertAdjacentHTML("afterbegin", `<button class="install-bar" id="installBar">${IC("squarePlus")}<span>Поставьте приложение на экран телефона</span><b>Как</b></button>`);
      $("#installBar").onclick = () => show();
    }
    let seen = false; try{ seen = !!localStorage.getItem(SEEN); }catch(e){}
    if(seen) return;
    // Окно с инструкцией — один раз, когда человек уже вошёл и прошёл анкету (не поверх входа).
    const t = setInterval(() => {
      const b = document.body.classList;
      if(b.contains("gated") || b.contains("onb-open") || $(".sheet")) return;
      clearInterval(t); show();
    }, 1500);
  }
  return {show, maybeAuto};
})();
$("#howInstall").onclick = () => Install.show();

/* ---------- анкета «Мой вкус» (общий модуль taste.js) ---------- */
const TASTE_CFG = {
 "subject": "фильмы и сериалы",
 "questions": [
  {
   "id": "like",
   "t": "Что любите смотреть?",
   "multi": true,
   "opts": [
    "Комедии",
    "Триллеры",
    "Детективы",
    "Драмы",
    "Фантастика",
    "Боевики",
    "Криминал",
    "Мультфильмы",
    "Документальное",
    "Исторические"
   ],
   "plain": "Люблю: {}."
  },
  {
   "id": "dislike",
   "t": "Чего не хочется?",
   "multi": true,
   "opts": [
    "Ужасы",
    "Мелодрамы",
    "Мюзиклы",
    "Аниме",
    "Тяжёлые драмы",
    "Слишком длинные сериалы"
   ],
   "plain": "Не хочется: {}."
  },
  {
   "id": "format",
   "t": "Что смотрите чаще?",
   "multi": false,
   "opts": [
    "Фильмы",
    "Сериалы",
    "И то и другое"
   ],
   "plain": "Смотрю чаще: {}."
  },
  {
   "id": "important",
   "t": "Что для вас важно?",
   "multi": true,
   "opts": [
    "Известные актёры",
    "Неожиданный финал",
    "Держит в напряжении",
    "Посмеяться",
    "Не грузит",
    "Высокий рейтинг"
   ],
   "plain": "Важно: {}."
  },
  {
   "id": "fav",
   "t": "Что уже понравилось?",
   "text": true,
   "ph": "Например: Во все тяжкие, Достать ножи",
   "plain": "Понравилось: {}."
  }
 ],
 "marks": [
  [
   "liked",
   "Понравилось"
  ],
  [
   "disliked",
   "Не зашло"
  ],
  [
   "watching",
   "Смотрит сейчас"
  ],
  [
   "seen",
   "Уже видел"
  ],
  [
   "later",
   "Хочет посмотреть"
  ]
 ]
};

/* iPhone: запрет масштабирования щипком (Safari игнорирует запрет в настройках страницы) */
["gesturestart","gesturechange"].forEach(t => document.addEventListener(t, e => e.preventDefault(), {passive:false}));
let lastTouchEnd = 0;
document.addEventListener("touchend", e => { const n = Date.now(); if(n - lastTouchEnd < 300 && !e.target.closest("button,a,input,textarea,select,summary,label")) e.preventDefault(); lastTouchEnd = n; }, {passive:false});

/* Раскрыли раздел — он плавно поднимается к верху экрана, чтобы было видно больше записей.
   Свернули — экран возвращается туда, где был. Срабатывает только от нажатия на заголовок. */
(function foldScroll(){
  let tapped = null;
  document.addEventListener("click", e => { const s = e.target.closest("details > summary"); tapped = s ? s.parentElement : null; }, true);
  document.addEventListener("toggle", e => {
    const d = e.target;
    if(!(d instanceof HTMLDetailsElement) || d !== tapped) return;
    tapped = null;
    if(d.open){
      d.dataset.backY = String(window.scrollY);
      requestAnimationFrame(() => {
        const safe = parseFloat(getComputedStyle(d.querySelector("summary")).top) || 6;
        const top = d.getBoundingClientRect().top + window.scrollY - safe;
        // поднимаем, только если раскрытое не помещается на экране
        if(d.id === "adminLink" || d.getBoundingClientRect().bottom > window.innerHeight) window.scrollTo({top, behavior: "smooth"});
      });
    } else if(d.dataset.backY){
      const y = +d.dataset.backY; delete d.dataset.backY;
      if(window.scrollY > y) window.scrollTo({top: y, behavior: "smooth"});
    }
  }, true);
})();

/* «Новинки недели»: общие на всех, обновляются сервером по пятницам */
const NEWS_KEY = "kino.news";
try{ news = JSON.parse(localStorage.getItem(NEWS_KEY) || "null"); }catch(e){}
window.onLogin = async sb => {
  try{
    const {data, error} = await sb.rpc("public_news", {a: "kino"});
    if(error || !data) return;
    news = data; try{ localStorage.setItem(NEWS_KEY, JSON.stringify(data)); }catch(e){}
    renderNews();
  }catch(e){}
};

/* Инструкция: открывается прямо в приложении (картинки страниц), без перехода во внешний просмотрщик */
$("#helpBtn").onclick = () => {
  const box = document.createElement("div"); box.className = "help-view";
  box.innerHTML = `<div class="status"><span class="dots">Загружаю</span></div><button class="help-close" aria-label="Закрыть">${IC("x")}</button>`;
  fetch("help/help.html").then(r => r.text()).then(t => { box.querySelector(".status").outerHTML = t; }).catch(() => { box.querySelector(".status").textContent = "Нет связи. Попробуйте позже"; });
  document.body.appendChild(box); document.body.style.overflow = "hidden";
  box.querySelector(".help-close").onclick = () => { box.remove(); document.body.style.overflow = ""; };
};

/* ---------- запуск ---------- */
function renderAll(){ $("#profile").value = state.profile; renderList(); renderNews(); }
$("#surprise").innerHTML = IC("dice") + "<span>Удиви</span>";
$("#addBtn").textContent = "Сохранить";
$("#tasteTitle").insertAdjacentHTML("afterbegin", IC("target"));
$("#tasteTitle").insertAdjacentHTML("beforeend", ARR);
localLoad(); renderAll();
Install.maybeAuto();

/* Автообновление: при открытии и при возврате в приложение проверяем новую версию в фоне. */
if("serviceWorker" in navigator && location.protocol!=="file:"){
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  // Новая версия включается незаметно: не перезагружаем экран у человека на глазах,
  // а ждём, когда приложение свернут. При следующем открытии уже будет новая версия.
  let pending = false;
  const reloadNow = () => { if(reloaded) return; reloaded = true; location.reload(); };
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if(!hadController) return;
    if(document.visibilityState === "hidden") reloadNow(); else pending = true;
  });
  document.addEventListener("visibilitychange", () => { if(pending && document.visibilityState === "hidden") reloadNow(); });
  navigator.serviceWorker.register("sw.js", {updateViaCache:"none"}).then(reg => {
    const check = () => reg.update().catch(()=>{});
    document.addEventListener("visibilitychange", () => { if(document.visibilityState==="visible") check(); });
  }).catch(()=>{});
}
