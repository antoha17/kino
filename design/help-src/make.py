import base64, sys
S = sys.argv[1]
def b64(p): return base64.b64encode(open(p, 'rb').read()).decode()
F = '/home/user/kino/fonts/'
fonts = ''
for fam, f, w in [('Manrope', 'manrope', '200 800'), ('Unbounded', 'unbounded', '200 900')]:
    for sub in ['cyrillic', 'latin']:
        fonts += f"@font-face{{font-family:{fam};src:url(data:font/woff2;base64,{b64(F+f+'-'+sub+'-wght-normal.woff2')}) format('woff2');font-weight:{w}}}\n"
defs = open(S + '/defs.svg').read()

I = {  # иконки в стиле приложений
 'spark': '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/>',
 'dice': '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
 'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 'play': '<path d="M7 4.5v15l12-7.5z"/>',
 'book': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
 'up': '<path d="M7 10v11"/><path d="M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 8a2 2 0 0 1-1.9 1.4H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z"/>',
 'down': '<path d="M17 14V3"/><path d="M9 18.1 10 14H4.2a2 2 0 0 1-1.9-2.6l2.3-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.8a2 2 0 0 0-1.8 1.1L12 22a3.1 3.1 0 0 1-3-3.9z"/>',
 'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
 'plus': '<path d="M12 5v14M5 12h14"/>',
 'target': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 'phone': '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
 'key': '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
 'chat': '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
 'eye': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 'x': '<path d="M6 6l12 12M18 6 6 18"/>',
 'cart': '<path d="M3 4h2l2.4 11h11L21 7H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
}
def ic(n): return f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">{I[n]}</svg>'

APPS = {
 'kino': dict(
   title='Что <span class="ac">посмотреть</span>', name='Что посмотреть', acc='#ffb547', acc2='#ff6b5b', sel='#3a2c14', glow='#3a2440', on='#1a1200',
   art=open(S + '/art-kino.svg').read(),
   lead='Подбирает фильмы и сериалы под ваше настроение и вкус. Три варианта за пару нажатий, с объяснением, почему именно вам.',
   kinds=['Всё равно', 'Фильм', 'Сериал'], kinds_label='Что смотрим',
   moods=['Напряжённо', 'Неожиданный финал', 'Посмеяться', 'Лёгкое', 'Криминал', 'Залипнуть'],
   similar='«Во все тяжкие»', item='фильм или сериал', items='фильмы и сериалы',
   acts=[('clock', 'Позже', 'отложить в «Посмотреть позже»'), ('play', 'Смотрю', 'уже начали смотреть: сразу в «Смотрю сейчас»'),
         ('eye', 'Видел', 'уже смотрели, ИИ больше не предложит'), ('up', 'Понравилось', 'ИИ учтёт и подберёт похожее'), ('down', 'Не моё', 'ИИ больше такое не предложит')],
   links='<b>Трейлер</b>: значки YouTube, VK Видео и Rutube сразу ищут трейлер на русском.',
   extra=('spark', 'Новинки недели', 'Каждую пятницу на главном экране приложения появляется строка с 3–4 свежими фильмами и сериалами. Нажмите на неё, чтобы раскрыть. Кнопка «Позже» добавит фильм в ваш список, крестик скроет его.'),
   later='Посмотреть позже', now='Смотрю сейчас', start_ic='play', fin='Досмотрел', seen='Видел',
   progress='Смотрите сколько угодно. Закончили — нажмите «Досмотрел».',
   add_examples=['посоветовали Шерлок', 'смотрю Декстер', 'видел Фарго, не понравилось'],
   q=['Что любите смотреть?', 'Чего не хочется?', 'Что смотрите чаще?', 'Что для вас важно?', 'Что уже понравилось?'],
 ),
 'knigi': dict(
   title='Что <span class="ac">почитать</span>', name='Что почитать', acc='#5ee0b0', acc2='#38b6d6', sel='#123327', glow='#12382f', on='#03251a',
   art=open(S + '/art-knigi.svg').read(),
   lead='Подбирает книги и аудиокниги под ваше настроение и вкус. Три варианта за пару нажатий, с объяснением, почему именно вам.',
   kinds=['Всё равно', 'Художественная', 'Нон-фикшн'], kinds_label='Что ищем',
   moods=['Захватывающий сюжет', 'Неожиданная развязка', 'Лёгкое и короткое', 'Реальные истории', 'Психология', 'Прокачать себя', 'Про деньги и работу', 'ИИ и технологии'],
   similar='«Код да Винчи» или любимый фильм', item='книгу', items='книги',
   acts=[('clock', 'Позже', 'отложить в «Хочу прочитать»'), ('book', 'Читаю', 'уже начали читать: сразу в «Читаю сейчас»'),
         ('check', 'Читал', 'уже читали, ИИ больше не предложит'), ('up', 'Зашло', 'ИИ учтёт и подберёт похожее'), ('down', 'Не моё', 'ИИ больше такое не предложит')],
   links='<b>Где купить</b>: нажмите, и появятся Литрес, Читай-город, Ozon, Яндекс Маркет. Рядом <b>Отзывы LiveLib</b>.',
   extra=('book', 'Аудиокниги', 'Выберите «Формат книги: Аудиокнига», и приложение предлагает книги с хорошей аудиоверсией и пишет, кто читает и сколько часов.'),
   later='Хочу прочитать', now='Читаю сейчас', start_ic='book', fin='Дочитал', seen='Прочитал',
   progress='Можно переключить «Читаю» или «Слушаю». Закончили — нажмите «Дочитал».',
   add_examples=['посоветовали Три товарища', 'читаю 1984', 'прочитал Атомные привычки, понравилось'],
   q=['Как вы относитесь к чтению?', 'Что больше нравится?', 'Что интересно?', 'Какой формат удобнее?', 'Что мешает дочитать?', 'Что уже понравилось?'],
 ),
}

CSS = '''
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{background:#0f0d12}
body{font-family:Manrope,sans-serif;color:#f3eee6}
.page{width:210mm;height:296.8mm;break-inside:avoid;position:relative;overflow:hidden;padding:16mm 15mm;page-break-after:always;
  background:radial-gradient(80% 32% at 90% 0%,var(--glow) 0%,transparent 70%),#0f0d12}
.page:last-child{page-break-after:auto}
h1,h2,h3{font-family:Unbounded,sans-serif;font-weight:600;letter-spacing:-.02em}
.ac{color:var(--acc)}
.mut{color:#a59fae}
.kicker{font-weight:700;font-size:9pt;letter-spacing:.22em;text-transform:uppercase;color:#a59fae}
h1{font-size:34pt;line-height:1.05;margin-top:4mm}
.lead{font-size:12.5pt;line-height:1.5;color:#d9d3e0;margin-top:6mm;max-width:150mm}
h2{font-size:19pt;line-height:1.15}
.sec{margin-top:8mm}
.sec-t{font-weight:700;font-size:8.5pt;letter-spacing:.2em;text-transform:uppercase;color:#a59fae;margin:5.5mm 0 2.5mm}
.card{background:#1a1720;border:1px solid #2e2836;border-radius:5mm;padding:5mm}
.card h3{font-size:12pt;font-weight:600}
.card p,.card li{font-size:10pt;line-height:1.55;color:#c9c2d1}
.card p+p{margin-top:2mm}
.card h3+p{margin-top:2mm}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm}
.feat{display:flex;gap:3.5mm;align-items:flex-start}
.ico{width:10mm;height:10mm;border-radius:3mm;background:var(--sel);color:var(--acc);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ico svg{width:5.5mm;height:5.5mm}
.feat h3{font-size:11pt;line-height:1.25}
.feat p{font-size:9.5pt;line-height:1.5;color:#b9b2c2;margin-top:1.2mm}
.n{font-family:Unbounded;font-weight:700;font-size:16pt;color:var(--acc);line-height:1}
.chips{display:flex;flex-wrap:wrap;gap:2mm}
.chip{font-size:9.5pt;padding:1.8mm 3.4mm;border-radius:99px;border:1px solid #3a3342;color:#e6e0ec}
.chip.on{background:var(--acc);border-color:var(--acc);color:var(--on);font-weight:700}
.btn{display:inline-flex;align-items:center;gap:1.5mm;font-size:9pt;font-weight:700;padding:1.6mm 3mm;border-radius:2.5mm;background:#231f2b;border:1px solid #332d3d;color:#f3eee6}
.btn svg{width:3.8mm;height:3.8mm;color:var(--acc)}
.btn.main{background:linear-gradient(135deg,var(--acc),var(--acc2));color:var(--on);border:0}
.btn.acc{background:var(--sel);color:var(--acc)}
.flow{display:flex;align-items:stretch;gap:2mm}
.flow .st{flex:1;background:#1a1720;border:1px solid #2e2836;border-radius:4mm;padding:3.5mm}
.flow .st b{display:block;font-family:Unbounded;font-weight:600;font-size:10pt;line-height:1.25}
.flow .st span{display:block;font-size:8.8pt;line-height:1.45;color:#b9b2c2;margin-top:1.2mm}
.flow .ar{display:flex;align-items:center;color:#6f6878;font-size:14pt}
.acts{display:grid;grid-template-columns:repeat(5,1fr);gap:2.5mm}
.act{background:#231f2b;border:1px solid #332d3d;border-radius:3mm;padding:3mm 2mm;text-align:center}
.act svg{width:5.5mm;height:5.5mm;color:var(--acc)}
.act b{display:block;font-size:9.5pt;margin-top:1mm}
.act span{display:block;font-size:8pt;line-height:1.35;color:#a59fae;margin-top:1mm}
.why{margin-top:3mm;font-size:9.5pt;line-height:1.5;color:#e6dfd2;background:rgba(255,255,255,.05);border-left:2.5px solid var(--acc);padding:2.5mm 3.5mm;border-radius:0 2.5mm 2.5mm 0}
.tip{display:flex;gap:3mm;align-items:flex-start;font-size:10pt;line-height:1.5;color:#c9c2d1}
.tip+.tip{margin-top:2.5mm}
.tip i{font-style:normal;color:var(--acc);font-weight:800}
.foot{position:absolute;left:15mm;right:15mm;bottom:10mm;display:flex;justify-content:space-between;font-size:8.5pt;color:#6f6878}
.q{font-size:9.5pt;color:#c9c2d1;line-height:1.7}
'''

def page(inner, n, a): return f'<section class="page">{inner}<div class="foot"><span>{a["name"]} · как пользоваться</span><span>{n} / 3</span></div></section>'

def build(k):
    a = APPS[k]
    acts = ''.join(f'<div class="act">{ic(i)}<b>{t}</b><span>{d}</span></div>' for i, t, d in a['acts'])
    p1 = f'''
  <div class="kicker">Инструкция</div>
  <h1>{a["title"]}</h1>
  <div class="lead">{a["lead"]}</div>
  <div style="display:flex;justify-content:center;margin-top:5mm">{a["art"].replace('width="68mm"', 'width="95mm"')}</div>

  <div class="sec-t">Как это работает</div>
  <div class="flow">
    <div class="st"><div class="n">1</div><b>Вы выбираете настроение</b><span>Пара кнопок: что хочется прямо сейчас.</span></div><div class="ar">→</div>
    <div class="st"><div class="n">2</div><b>ИИ подбирает 3 варианта</b><span>Учитывает ваш вкус и всё, что вы отметили.</span></div><div class="ar">→</div>
    <div class="st"><div class="n">3</div><b>Вы отмечаете</b><span>Каждая отметка делает подбор точнее.</span></div>
  </div>
  <div class="card" style="margin-top:5mm">
    <h3>Откуда берутся варианты</h3>
    <p>Подбор делает искусственный интеллект. Он знает {a["items"]} и при каждом подборе смотрит на три вещи: ваш вкус, ваши отметки (что понравилось, что нет, что уже {"видели" if k=="kino" else "прочитали"}) и то, что вы выбрали перед подбором: {"фильм или сериал и настроение" if k=="kino" else "жанр, формат и настроение"}. По ним он предлагает варианты и объясняет, почему они подойдут именно вам.</p>
    <p>То, что уже есть в вашем списке, приложение больше никогда не предложит. Поэтому чем больше вы отмечаете, тем точнее и свежее подборки.</p>
  </div>
  <div class="card feat" style="margin-top:4mm"><div class="ico">{ic(a["extra"][0])}</div><div><h3>{a["extra"][1]}</h3><p>{a["extra"][2]}</p></div></div>'''
    p2 = f'''
  <div class="kicker">Шаг 1</div><h2>Начало</h2>
  <div class="grid3 sec" style="margin-top:5mm">
    <div class="card feat" style="display:block"><div class="ico">{ic("phone")}</div><h3 style="margin-top:3mm">Поставьте на экран</h3><p class="mut" style="font-size:9.3pt;line-height:1.5;margin-top:1.5mm">iPhone: Safari → «Поделиться» → «На экран „Домой“». Android: откройте ссылку в браузере (из Telegram можно скопировать и вставить) → меню ⋮ или ≡ → «Установить приложение». Подсказка есть в самом приложении.</p></div>
    <div class="card feat" style="display:block"><div class="ico">{ic("key")}</div><h3 style="margin-top:3mm">Создайте аккаунт</h3><p class="mut" style="font-size:9.3pt;line-height:1.5;margin-top:1.5mm">Откройте ссылку-приглашение, укажите почту и придумайте пароль. Список хранится в аккаунте и одинаков на телефоне и компьютере.</p></div>
    <div class="card feat" style="display:block"><div class="ico">{ic("target")}</div><h3 style="margin-top:3mm">Расскажите о вкусе</h3><p class="mut" style="font-size:9.3pt;line-height:1.5;margin-top:1.5mm">При первом входе приложение задаст {len(a["q"])} коротких вопросов. Из ответов ИИ составит описание вашего вкуса, а поправить его можно в любой момент.</p></div>
  </div>

  <div class="kicker" style="margin-top:6mm">Шаг 2</div><h2>Вкладка «Подобрать»</h2>
  <div class="sec-t">{a["kinds_label"]} и настроение</div>
  <div class="chips">{''.join(f'<span class="chip{" on" if i==0 else ""}">{c}</span>' for i,c in enumerate(a["kinds"]))}</div>
  <div class="chips" style="margin-top:2.5mm">{''.join(f'<span class="chip{" on" if i==0 else ""}">{c}</span>' for i,c in enumerate(a["moods"]))}</div>
  <p class="q" style="margin-top:3mm">По желанию впишите «Похоже на…», например {a["similar"]}. Затем нажмите <span class="btn main">Подобрать 3 варианта</span> или <span class="btn">{ic("dice")}Удиви</span> — один неожиданный вариант.</p>

  <div class="sec-t">Карточка варианта</div>
  <div class="card">
    <div class="why" style="margin-top:0">Название, год, завязка без спойлеров и пояснение «почему именно вам»: чем вариант связан с вашим вкусом.</div>
    <p style="margin-top:3mm">Под пояснением кнопки. Нажмите одну, и карточка исчезнет, а отметка попадёт в ваш список:</p>
    <div class="acts" style="margin-top:3mm">{acts}</div>
    <p style="margin-top:3mm">{a["links"]}</p>
    <p>Не подошло? Кнопка <b>«Не то, ещё варианты»</b> даст новые без повторов.</p>
  </div>
'''
    p3 = f'''
  <div class="kicker">Шаг 3</div><h2>Вкладка «Мой список»</h2>
  <div class="sec-t">Путь {"фильма" if k=="kino" else "книги"} по разделам</div>
  <div class="flow">
    <div class="st"><b>{a["later"]}</b><span>Отложенное. Кнопка <span class="btn acc" style="padding:.6mm 2mm;font-size:8pt">Начать</span> переносит дальше.</span></div><div class="ar">→</div>
    <div class="st"><b>{a["now"]}</b><span>{a["progress"]}</span></div><div class="ar">→</div>
    <div class="st"><b>{a["fin"]}</b><span>Приложение спросит «Как вам?»</span></div><div class="ar">→</div>
    <div class="st"><b>Понравилось</b><span>и сразу подбор похожего</span><b style="margin-top:2mm">Не зашло</b><span>похожее ИИ больше не предложит</span></div>
  </div>
  <p class="q" style="margin-top:3mm">Ещё есть раздел «{a["seen"]}» для того, что уже было раньше. Все разделы сворачиваются: нажмите на заголовок. Крестик <span class="btn" style="padding:.6mm 1.8mm">{ic("x")}</span> убирает запись из списка.</p>

  <div class="grid2" style="margin-top:6mm">
    <div class="card feat"><div class="ico">{ic("plus")}</div><div><h3>Добавить {a["item"]}</h3><p>Посоветовали или уже {"смотрели" if k=="kino" else "читали"}? Откройте вкладку «Мой список», напишите в поле вверху своими словами, как в примерах ниже, и нажмите <b>«Сохранить»</b>. ИИ сам поймёт название и положит запись в нужный раздел. Текст можно надиктовать с клавиатуры.</p>
      <p style="margin-top:2mm">{"<br>".join("«"+e+"»" for e in a["add_examples"])}</p></div></div>
    <div class="card feat"><div class="ico">{ic("target")}</div><div><h3>Мой вкус</h3><p>Короткий текст о том, что вам нравится. Приложение учитывает его при каждом подборе. Чтобы поправить, нажмите на текст, допишите или исправьте его и нажмите <b>«Сохранить»</b>. Отметки «Понравилось» и «Не моё» ИИ учитывает и без этого.</p></div></div>
  </div>

  <div class="sec-t">Чтобы ничего не упустить</div>
  <div class="card">
    <div class="tip"><i>1</i><span>Сразу добавьте то, что уже {"видели" if k=="kino" else "читали"} и помните: так ИИ не будет это предлагать и лучше поймёт ваш вкус.</span></div>
    <div class="tip"><i>2</i><span>Отмечайте каждую карточку, даже если вариант не подошёл: «Не моё» тоже помогает подбору.</span></div>
    <div class="tip"><i>3</i><span>После «{a["fin"]}» обязательно ответьте «Как вам?» — это самая ценная отметка.</span></div>
    <div class="tip"><i>4</i><span>Вкус поменялся? Допишите пару слов в разделе «Мой вкус», чтобы описание не устаревало.</span></div>
    <div class="tip"><i>5</i><span>Вопрос или идея? На вкладке «Мой список» вверху есть кнопка <b>«Написать»</b>: так можно связаться с автором.</span></div>
    <div class="tip"><i>6</i><span>Нравится приложение? Рядом с «Написать» есть кнопка <b>«Поблагодарить»</b>: можно отправить автору любую сумму. Это по желанию, пользоваться приложением можно и без этого.</span></div>
  </div>'''
    html = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>{a["name"]} — как пользоваться</title>
<style>{fonts}:root{{--acc:{a["acc"]};--acc2:{a["acc2"]};--sel:{a["sel"]};--glow:{a["glow"]};--on:{a["on"]}}}{CSS}</style></head><body>{defs}
{page(p1,1,a)}{page(p2,2,a)}{page(p3,3,a)}</body></html>'''
    open(f'{S}/{k}.html', 'w').write(html)

for k in APPS: build(k)
print('ok')
