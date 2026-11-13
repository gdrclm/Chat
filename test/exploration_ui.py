"""Mobile 4.1 regression: local research, repeat visits, real repair, quiet default UI."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
html=(root/'play.html').read_text()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width,height in [(390,844),(360,640)]:
        c=b.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
        c.route('https://story.test/**',lambda route:route.fulfill(status=200,content_type='text/html',body=html))
        page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('https://story.test/')
        def send(text):
            page.locator('#message').fill(text);page.locator('#send').tap()
            return page.locator('article.assistant').last.inner_text()
        def state():return json.loads(page.evaluate("localStorage.getItem('between-lines-offline-v2')"))['memory']
        send('Осматриваюсь');send('Беру письмо');send('Открываю письмо')
        send('Выхожу');send('Осматриваю решётку');send('Приподнимаю решётку');send('Беру проволоку');send('Иду в город')
        text=send('Осматриваюсь');assert 'доске объявлений' in text and 'печати' not in text
        first=state();text=send('Исследую город');assert 'Пути из локации:' in text and 'Видно:' in text
        assert state()['world']['loops']['exploration']['discoveries']==first['world']['loops']['exploration']['discoveries']
        send('Изучаю знак');send('Иду в мастерскую');assert 'верстак' in send('Осмотреть мастерскую')
        assert 'сначала нужно туда перейти' in send('Исследую город')
        send('Что означает знак?');send('Ищу работу');send('Да')
        send('Осматриваю механизм');send('Проверяю хватает ли деталей')
        before=state()['inventory'];send('Можно сделать штифт из проволоки?');assert state()['inventory']==before
        send('Предлагаю Илье изготовить его вместе');send('Да');send('Устанавливаю штифт');send('Проверяю ход механизма')
        send('Забираю плату');send('Иду в город');send('Иду на рынок');send('Показываю рекомендацию');send('Покупаю молоток')
        assert state()['world']['player']['money']==1
        send('Иду в город');send('Иду на улицу');send('Осматриваю фонарь')
        page.locator('#open-world').tap()
        expect(page.locator('#map-exits').get_by_role('button',name='мастерская →',exact=True)).to_be_visible()
        page.locator('#map-exits').get_by_role('button',name='мастерская →',exact=True).tap()
        assert 'работает собранный механизм' in send('Осмотреть мастерскую')
        assert page.locator('article .outcome-label').count()==0
        assert page.locator('article details').count()==0
        assert page.evaluate('document.documentElement.scrollHeight<=window.innerHeight+1')
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
        page.screenshot(path=f'/tmp/chat-41-play-{width}.png')
        page.locator('#open-settings').tap();page.locator('#debug-view').check();page.locator('#close-settings').tap()
        assert page.locator('article .outcome-label').count()>0
        assert page.locator('article details').count()>0
        page.locator('#open-settings').tap();page.locator('#debug-view').uncheck();page.locator('#close-settings').tap()
        page.reload();assert page.locator('article .outcome-label').count()==0
        expect(page.locator('#story-title')).to_have_text('Мастерская')
        assert 'Пути из локации:' in send('Осмотреть мастерскую')
        assert not errors,errors
        print(f'PASS 4.1 {width}x{height}: local facts, repeated research, hidden material, cooperative repair, recommendation, shortcut, quiet/debug UI and reload')
        c.close()
    b.close()
