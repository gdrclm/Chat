"""4.4: real speaker roles, contact, witnessed theft, restitution and registered meta events."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

html=(Path(__file__).resolve().parents[1]/'play.html').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width,height in [(390,844),(360,640)]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
        context.route('https://story.test/**',lambda route:route.fulfill(status=200,content_type='text/html',body=html))
        page=context.new_page();errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('dialog',lambda dialog:dialog.accept())
        page.goto('https://story.test/')
        def memory():return json.loads(page.evaluate("localStorage.getItem('between-lines-offline-v2')"))['memory']
        def send(text):
            page.locator('#message').fill(text);page.locator('#send').tap()
            assert page.locator('#send').is_enabled()
            return page.locator('article.assistant').last
        last=send('Осматриваюсь')
        assert last.locator('[data-speaker=npc]').count()==0
        assert memory()['world']['activeNpcId'] is None
        assert 'Нет собеседника' in page.locator('#memory').inner_text()
        last=send('Привет')
        assert last.locator('[data-speaker=npc] small').inner_text()=='Мира'
        assert 'Мира' in page.locator('#memory').inner_text()
        send('Отхожу от прилавка')
        assert memory()['place']=='лавка' and memory()['world']['activeNpcId'] is None
        assert send('Жду').locator('[data-speaker=npc]').count()==0
        before=memory()['world']['npcs'][memory()['world']['primaryNpcId']]['memory']
        last=send('Квантовать ларец')
        assert last.locator('[data-speaker=developer] small').inner_text()=='РАЗРАБОТЧИК'
        assert last.locator('[data-speaker=npc]').count()==0
        assert memory()['world']['npcs'][memory()['world']['primaryNpcId']]['memory']==before
        assert send('Квантовать ларец').locator('[data-speaker=developer]').count()==0
        for command in ['Выхожу на улицу','Иду в город','Иду в мастерскую']:
            assert send(command).locator('[data-speaker=npc]').count()==0
        assert 'Нет собеседника' in page.locator('#memory').inner_text()
        last=send('Беру молоток мастера')
        assert last.locator('[data-speaker=npc] small').inner_text()=='Илья'
        m=memory();theft=next(e for e in m['world']['social']['events'] if e['type']=='theft')
        assert theft['witnesses'] and m['world']['activeNpcId'] is None
        assert 'Нет собеседника' in page.locator('#memory').inner_text()
        owner=m['world']['npcs'][theft['ownerId']]
        assert owner['trust']<0 and owner['social']['relationship']['suspicion']>0
        send('Ищу работу');assert memory()['lastOutcome']['results'][0]['code']=='unresolved_conflict'
        send('Возвращаю молоток');send('Извини')
        m=memory();owner=m['world']['npcs'][theft['ownerId']]
        assert next(g for g in owner['grievances'] if g['kind']=='theft')['resolved']
        assert owner['social']['cautious'] and owner['trust']<0
        count=page.locator('article').count();labels=page.locator('.utterance small').all_text_contents()
        page.reload();assert page.locator('article').count()==count
        assert page.locator('.utterance small').all_text_contents()==labels
        assert memory()['world']['npcs'][owner['id']]['social']['cautious']
        page.locator('#open-settings').tap()
        page.locator('[name=canon]').fill('Мета-событие: проход | лавка | потайная дверь | архив | 2')
        page.locator('#settings button').tap()
        page.locator('#open-settings').tap();page.locator('#reset').tap();page.locator('#close-settings').tap()
        send('Жду');last=send('Жду')
        assert last.locator('[data-speaker=developer]').count()==1
        assert 'потайная дверь' in last.inner_text()
        assert len(memory()['world']['developer']['fired'])==1
        page.screenshot(path=f'/tmp/chat-44-voices-{width}.png')
        send('Открываю потайную дверь и иду в архив')
        assert memory()['place']=='архив'
        assert page.evaluate('document.documentElement.scrollHeight<=innerHeight+1')
        assert not errors,errors
        print(f'PASS {width}x{height}: three voices, contact and suspension, theft witness, restitution, saved speaker roles, real meta passage, no page scroll')
        context.close()
    browser.close()
