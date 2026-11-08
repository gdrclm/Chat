"""4.3 acceptance: greetings, local frames, parts, composition and restored focus."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

html = (Path(__file__).resolve().parents[1] / 'play.html').read_text()
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height in [(390, 844), (360, 640)]:
        context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
        context.route('https://story.test/**', lambda route: route.fulfill(status=200, content_type='text/html', body=html))
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('https://story.test/')

        def state():
            return json.loads(page.evaluate("localStorage.getItem('between-lines-offline-v2')"))['memory']

        def send(text):
            page.locator('#message').fill(text)
            page.locator('#send').tap()
            assert page.locator('#send').is_enabled()
            return page.locator('article.assistant').last.inner_text()

        text = send('Поприветствовать Миру')
        assert 'Здравствуйте' in text and 'настройк' not in text
        memory = state()
        npc_id = memory['world']['primaryNpcId']
        assert memory['world']['npcs'][npc_id]['seen']['greet'] == 1
        text = send('Мира, поздоровайся')
        memory = state()
        assert memory['world']['npcs'][npc_id]['seen']['greet'] == 1
        assert memory['world']['npcs'][npc_id]['memory']['outgoingGreetings']['player'] == 1
        result = memory['lastOutcome']['results'][0]
        assert result['action']['actor'] == npc_id and result['action']['recipientId'] == 'player'
        text = send('Выйти на улицу и осмотреться')
        assert text.count('Узкая улица соединяет') == 1
        assert text.count('Видно:') == 1
        before = state()
        location_id = before['world']['player']['location']
        visits = next(place for place in before['world']['locations'] if place['id'] == location_id)['visits']
        text = send('Подойти к стене лавки и изучать')
        memory = state()
        assert memory['place'] == 'улица'
        assert memory['world']['player']['attention']['part'] == 'wall'
        assert memory['world']['player']['attention']['surface'] == 'exterior'
        assert memory['world']['player']['attention']['parentId'] == memory['world']['startId']
        assert next(place for place in memory['world']['locations'] if place['id'] == location_id)['visits'] == visits
        assert len(memory['entities']) == len(before['entities'])
        assert 'Вы переходите' not in text and 'обстановка изменилась' not in text
        page.reload()
        assert 'Новых сведений' in send('Изучить')
        assert state()['place'] == 'улица'
        send('Подойти к фонарю и осмотреть его')
        memory = state()
        assert 'street.mark' in memory['world']['player']['research']['knowledge']
        assert memory['place'] == 'улица'
        text = send('Войти в лавку')
        assert state()['place'] == 'лавка'
        assert 'Я прихожу' not in text
        assert 'position' not in state()['world']['player']
        send('Осмотреться')
        send('Подойти к стене и изучить')
        assert 'обстановка изменилась' not in send('Оглядеться')
        text = send('Подойти к крышке ларца и изучить')
        assert state()['world']['player']['attention']['part'] == 'lid'
        assert not next(e for e in state()['entities'] if e['label'] == 'ларец')['opened']
        assert 'флакон' not in text
        page.screenshot(path=f'/tmp/chat-43-spatial-{width}.png')
        text = send('Ломаю ларец, затем осмотреться')
        memory = state()
        assert memory['lastOutcome']['results'][0]['completed']
        assert memory['lastOutcome']['results'][1]['status'] == 'success'
        assert 'обстановка изменилась' in text and 'флакон' in text
        assert page.locator('article .outcome-label').count() == 0
        assert page.evaluate('document.documentElement.scrollHeight <= innerHeight + 1')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        assert not errors, errors
        print(f'PASS spatial {width}x{height}: GREET roles, local approach, owner/part focus, reload, single scene description, actual damage and one-screen layout')
        context.close()
    browser.close()
