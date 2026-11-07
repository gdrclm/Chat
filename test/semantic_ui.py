"""Natural-language plans through the standalone app, including save/clarification and touch input."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
html = (root / 'play.html').read_text()
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height in [(390, 844), (360, 640)]:
        context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
        context.route('https://story.test/**', lambda route: route.fulfill(status=200, content_type='text/html', body=html))
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('dialog', lambda dialog: dialog.accept())
        page.goto('https://story.test/')

        def memory():
            return json.loads(page.evaluate("localStorage.getItem('between-lines-offline-v2')"))['memory']

        def send(text):
            page.locator('#message').fill(text)
            page.locator('#send').tap()
            assert page.locator('#send').is_enabled()
            return page.locator('article.assistant').last.inner_text()

        send('Выйти на улицу и осмотреться')
        state = memory()
        assert state['place'] == 'улица'
        assert state['world']['player']['location'] in state['world']['loops']['exploration']['observed']
        send('Вернуться')
        send('Спросить Миру, можно ли выйти и осмотреться')
        assert memory()['place'] == 'лавка'
        send('Можно открыть ларец?')
        assert not next(e for e in memory()['entities'] if e['label'] == 'ларец')['opened']
        send('Хочу открыть ларец')
        assert not next(e for e in memory()['entities'] if e['label'] == 'ларец')['opened']

        page.locator('#open-settings').tap()
        page.locator('[name=world]').fill('Комната с дверью. Магии нет.')
        page.locator('[name=character]').fill('Мира — путешественница.')
        page.locator('[name=player]').fill('Гость')
        page.locator('[name=canon]').fill(
            'Место: комната\nПредметы: ключ, дверь, ларец, стол\nПреграда: дверь\nИнструмент: ключ\n'
            'Локации: комната, улица, город\nПереходы: комната <-> улица [дверь]; улица <-> город\n'
            'Содержимое: ларец | флакон\nНа поверхности: стол | ключ')
        page.locator('#settings button').tap()
        page.locator('#open-settings').tap()
        page.locator('#reset').tap()
        page.locator('#close-settings').tap()
        send('Открыть дверь и выйти на улицу, затем осмотреться')
        state = memory()
        assert state['place'] == 'комната'
        assert all(result['skipped'] for result in state['lastOutcome']['results'][1:])
        assert not state['world']['loops']['exploration']['observed']
        send('Осмотреть флакон внутри ларца')
        assert memory()['lastOutcome']['status'] == 'refused'
        send('Со стола забрать ключ')
        send('Дверь открыть ключом')
        assert next(e for e in memory()['entities'] if e['label'] == 'дверь')['opened']
        send('Закрыть дверь')
        send('Отпереть дверь')
        state = memory()
        door = next(e for e in state['entities'] if e['label'] == 'дверь')
        assert not door['locked'] and not door['opened']
        send('Приоткрыть дверь и выйти на улицу')
        assert memory()['place'] == 'комната'
        send('Распахнуть её и выйти на улицу')
        assert memory()['place'] == 'улица'
        send('Пойду, затем оглядеться')
        assert memory()['world']['player']['pendingAction']['step']['intent'] == 'MOVE'
        page.reload()
        send('город')
        state = memory()
        assert state['place'] == 'город'
        assert state['world']['player']['location'] in state['world']['loops']['exploration']['observed']
        assert state['lastOutcome']['semanticPlan']['resumed']
        assert page.locator('article .outcome-label').count() == 0
        assert page.evaluate('document.documentElement.scrollHeight <= innerHeight + 1')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        assert not errors, errors
        page.screenshot(path=f'/tmp/chat-42-semantic-{width}.png')
        print(f'PASS semantic {width}x{height}: infinitives, dialogue scope, failure dependencies, contents, word order, opening modes, pronoun, saved clarification')
        context.close()
    browser.close()
