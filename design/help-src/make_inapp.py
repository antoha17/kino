# Собирает инструкцию для показа внутри приложения (help/help.html) — крупный текст под экран телефона.
# Тексты те же, что в PDF (make.py). Запуск: python3 make_inapp.py <папка со скриптами>
import sys, importlib.util
S = sys.argv[1]
spec = importlib.util.spec_from_file_location("mk", S + "/make.py"); src = open(S + "/make.py").read()
# берём только словари APPS и I, без генерации PDF
ns = {"__name__": "x", "sys": sys}
exec(src.split("CSS = '''")[0].replace("S = sys.argv[1]", f"S = {S!r}"), ns)
APPS, I = ns["APPS"], ns["I"]
def ic(n): return f'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">{I[n]}</svg>'

for k, a in APPS.items():
    seen_word = "смотрели" if k == "kino" else "читали"
    acts = "".join(f'<li>{ic(i)}<div><b>{t}</b><span>{d}</span></div></li>' for i, t, d in a["acts"])
    h = f'''<div class="hv">
<h1>Как пользоваться</h1>
<p class="hv-lead">{a["lead"]}</p>

<h2><span>1</span>Как это работает</h2>
<p>Вы выбираете настроение, искусственный интеллект подбирает 3 варианта, вы отмечаете. Он учитывает «Мой вкус» и всё, что вы отметили, и пишет, почему вариант подойдёт именно вам.</p>
<p>То, что уже есть в вашем списке, больше не предлагается. Чем больше отметок, тем точнее подборки.</p>

<h2><span>2</span>Начало</h2>
<ul class="hv-list">
<li>{ic("phone")}<div><b>Поставьте на экран</b><span>iPhone: Safari → «Поделиться» → «На экран „Домой“». Android: Chrome → меню ⋮ → «Установить приложение».</span></div></li>
<li>{ic("key")}<div><b>Аккаунт</b><span>Регистрация по ссылке-приглашению: почта и пароль. Список одинаковый на телефоне и компьютере.</span></div></li>
<li>{ic("target")}<div><b>Анкета вкуса</b><span>При первом входе {len(a["q"])} вопросов кнопками. Из ответов получится «Мой вкус».</span></div></li>
</ul>

<h2><span>3</span>Вкладка «Подобрать»</h2>
<p>Выберите «{a["kinds_label"]}» и настроение, по желанию впишите «Похоже на…». Нажмите <b>«Подобрать 3 варианта»</b> или <b>«Удиви»</b> — один неожиданный вариант.</p>
<p>На карточке кнопки. Нажмите одну — карточка исчезнет, отметка попадёт в список:</p>
<ul class="hv-list">{acts}</ul>
<p>Не подошло? <b>«Не то, ещё варианты»</b> даст новые без повторов.</p>
<div class="hv-card">{ic(a["extra"][0])}<div><b>{a["extra"][1]}</b><span>{a["extra"][2]}</span></div></div>

<h2><span>4</span>Вкладка «Мой список»</h2>
<ol class="hv-path">
<li><b>{a["later"]}</b> — отложенное. Кнопка «Начать» переносит дальше.</li>
<li><b>{a["now"]}</b> — {a["progress"][0].lower() + a["progress"][1:]}</li>
<li><b>{a["fin"]}</b> → приложение спросит «Как вам?»: «Понравилось» (и сразу подбор похожего) или «Не зашло».</li>
</ol>
<p>Раздел «{a["seen"]}» — для того, что было раньше. Разделы сворачиваются нажатием на заголовок, вверху есть поиск по списку.</p>
<div class="hv-card">{ic("plus")}<div><b>Добавить {a["item"]}</b><span>Посоветовали или уже {seen_word}? Напишите как есть, например «{a["add_examples"][0]}», и нажмите «Сохранить».</span></div></div>
<div class="hv-card">{ic("target")}<div><b>Мой вкус</b><span>Уходит в каждый подбор. Можно править вручную или кнопками «По моим отметкам» и «Своими словами».</span></div></div>

<h2><span>5</span>Чтобы ничего не упустить</h2>
<ol class="hv-tips">
<li>Сразу добавьте то, что уже {seen_word}.</li>
<li>Отмечайте каждую карточку — «Не моё» тоже помогает.</li>
<li>После «{a["fin"]}» отвечайте «Как вам?».</li>
<li>Иногда жмите «По моим отметкам» в «Моём вкусе».</li>
<li>Вопрос или идея — кнопка «Написать» вверху «Моего списка».</li>
</ol>
</div>'''
    open(f"/home/user/{k}/help/help.html", "w").write(h)
print("ok")
