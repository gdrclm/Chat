"""5.0 acceptance through actual chat, author forms, map and persisted reload."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

html=(Path(__file__).resolve().parents[1]/'play.html').read_text()
canon='''Ценный предмет: компас
Манера NPC: Мира | sociability=0.7; curiosity=0.85; openness=0.35
Биография NPC: Мира | family | Моя сестра — Лада. | глубина=3
Биография NPC: Мира | previous_work | Раньше я переписывала книги. | глубина=1
Биография NPC: Мира | occupation.personal_experience | В трудную минуту мне помогла наставница. | глубина=1
Секрет: Антон подменил память.
Доказательство: записка | виновник = Антон
Раскрытие NPC: Мира | secret | доверие=3; улика=записка'''
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
        def person(name='Мира'):return next(n for n in memory()['world']['npcs'].values() if n['name']==name)
        def send(text):
            page.locator('#message').fill(text);page.locator('#send').tap()
            assert page.locator('#send').is_enabled()
            last=page.locator('article.assistant').last
            assert last.locator('[data-speaker=developer]').count()==0,text
            return last.inner_text()
        page.locator('#open-settings').tap()
        page.locator('[name=world]').fill('Город. В лавке продают воспоминания в стеклянных флаконах.')
        page.locator('[name=character]').fill('Мира — хозяйка лавки воспоминаний. Сдержанная и наблюдательная.')
        page.locator('[name=player]').fill('Путник с компасом и запиской')
        page.locator('[name=canon]').fill(canon)
        page.locator('#settings button').tap()
        assert 'Мира' in send('Как вас зовут?')
        assert person()['conversation']['pendingNpcQuestion']['type']=='player_name'
        send('Алекс');assert person()['memory']['playerName']=='Алекс'
        assert 'торгую воспоминаниями' in send('Кто вы?')
        assert 'лавка воспоминаний' in send('Что это за место?')
        assert 'торгую воспоминаниями' in send('Чем вы здесь занимаетесь?')
        assert 'Точного срока' in send('Вы давно здесь живёте?')
        assert 'Лада' not in send('Расскажите о семье')
        assert memory()['lastOutcome']['results'][0]['conversation']['mode']=='withheld'
        assert 'помогать людям' in send('Почему вы выбрали эту работу?')
        assert 'наставница' in send('А вам самой кто-нибудь помог?')
        assert 'переписывала книги' in send('А раньше?')
        before=person();count=page.locator('article').count()
        page.reload();assert page.locator('article').count()==count
        assert person()['biography']==before['biography'] and person()['personality']==before['personality']
        assert 'переписывала книги' in send('Вы уверены?')
        assert person()['conversation']['activeTopic']=='occupation.personal_experience'
        send('Привет');send('Спасибо');send('Спасибо');send('Дарю компас')
        assert person()['trust']>=4
        assert 'Лада' in send('Расскажите о семье')
        assert 'Антон' not in send('Расскажите секрет')
        assert not person()['secretRevealed']
        send('Показываю записку')
        assert 'Антон' in send('Расскажите секрет')
        assert person()['secretRevealed']
        trust=person()['trust']
        for _ in range(3):send('Как вас зовут?')
        assert person()['trust']==trust
        page.locator('#open-world').tap()
        assert 'Мира' in page.locator('#conversation-summary').inner_text()
        assert page.locator('#conversation-topics button').count()>0
        page.locator('#close-world').tap()
        for command in ['Выхожу на улицу','Иду в город','Иду в мастерскую']:send(command)
        assert memory()['world']['activeNpcId'] is None
        assert 'Илья' in send('Как вас зовут?')
        assert 'ремонтирую' in send('Чем вы занимаетесь?')
        assert 'Лада' not in send('Расскажите о семье')
        send('Беру молоток мастера')
        text=send('Вы мне доверяете?')
        assert 'верните' in text and 'молоток мастера' in text
        assert person('Илья')['trust']<0
        assert page.evaluate('document.documentElement.scrollHeight<=innerHeight+1')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors,errors
        page.screenshot(path=f'/tmp/chat-50-conversation-{width}.png')
        print(f'PASS {width}x{height}: grounded biography, reciprocal answer, contextual follow-ups and reload, personal disclosure, evidence-gated secret, no trust farming, independent NPC and known theft')
        context.close()
    browser.close()
