"""Browser acceptance of A–E through the actual standalone game's forms and map."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
html=(root/'play.html').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    context.route('https://story.test/**',lambda route:route.fulfill(status=200,content_type='text/html',body=html))
    page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda d:d.accept())
    page.goto('https://story.test/')
    def send(text):
        page.locator('#message').fill(text);page.locator('#send').tap()
        assert page.locator('#send').is_enabled()
        return page.locator('article.assistant').last.inner_text()
    def data():return json.loads(page.evaluate("localStorage.getItem('between-lines-offline-v2')"))['memory']
    def reset():
        page.locator('#open-settings').tap();page.locator('#reset').tap();page.locator('#close-settings').tap()
    def go(name):
        page.locator('#open-world').tap()
        page.locator('#map-exits').get_by_role('button',name=name+' →',exact=True).tap()
        assert page.locator('#world-page').is_hidden()
    page.locator('#open-settings').tap()
    page.locator('[name=world]').fill('Магическая лавка.')
    page.locator('[name=character]').fill('Мира — хозяйка лавки. Хочет вернуть компас.')
    page.locator('[name=player]').fill('Путник с компасом')
    page.locator('[name=canon]').fill('Истина: виновник = Антон\nЦенный предмет: компас')
    page.locator('#debug-view').check()
    page.locator('#settings button').tap()
    send('Лгу: виновник = Борис');send('Беру письмо');send('Незаметно подбрасываю письмо: виновник = Борис')
    assert 'Я считаю' in send('Кто виноват?')
    m=data();main=m['world']['npcs'][m['world']['primaryNpcId']]
    assert main['beliefs']['виновник']['value']=='Борис'
    assert m['world']['facts']['виновник']['value']=='Антон'
    page.locator('#open-world').tap();assert 'Борис' in page.locator('#belief-records').text_content();page.locator('#close-world').tap()
    reset()
    send('Прошу Миру вынести ларец наружу, спрятать его и открыть позже');send('Да')
    m=data();chest=next(e for e in m['entities'] if e['label']=='ларец')
    assert chest['location']=='улица' and not chest['opened'] and m['place']=='лавка'
    page.locator('#message').fill('черновик')
    go('улица');assert page.locator('#message').input_value()=='черновик'
    page.locator('#message').fill('')
    assert 'Ларец открывается' in send('Открываю ларец')
    assert data()['world']['deferred'][0]['status']=='completed'
    reset()
    send('Ты идиот');go('улица');go('лавка')
    send('Помоги открыть ларец')
    assert page.locator('article.assistant .outcome-label').last.inner_text()=='Отказ'
    send('Прости');assert page.locator('article.assistant .outcome-label').last.inner_text()=='Частичный успех'
    send('Дарю компас');send('Помоги открыть ларец');send('Да')
    m=data();assert m['world']['npcs'][m['world']['primaryNpcId']]['grievances'][0]['resolved']
    reset();go('улица');send('Осматриваю решётку');send('Приподнимаю решётку');send('Беру проволоку');go('город');go('мастерская')
    send('Ищу работу');send('Да');send('Осматриваю механизм');send('Проверяю хватает ли деталей');send('Изготавливаю штифт');send('Устанавливаю штифт');send('Проверяю ход механизма');send('Забираю плату')
    assert data()['world']['player']['money']==3
    go('город');go('рынок');send('Покупаю цепочку')
    assert data()['world']['player']['money']==1
    reset();send('Осматриваюсь');send('Беру ключ');send('Превращаю ключ в украшение и дарю его, чтобы заслужить доверие')
    m=data();gift=next(e for e in m['entities'] if e['label']=='украшение')
    assert gift['lineage'] and gift['location']==m['world']['primaryNpcId']
    page.locator('article.assistant details').last.locator('summary').tap()
    assert 'Цель: заслужить доверие' in page.locator('article.assistant details').last.inner_text()
    assert page.evaluate('document.documentElement.scrollHeight<=window.innerHeight+1')
    count=page.locator('article').count();page.reload();assert page.locator('article').count()==count
    assert not errors,errors
    page.screenshot(path='/tmp/chat-simulation-v4.png')
    print('PASS mobile A–E: false belief vs truth, carried/deferred chest, conflict repair, graph/jobs/buying, causal gift, status/intent UI, persisted reload')
    browser.close()
