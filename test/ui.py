"""Offline browser fixture: verifies the shipped HTML, storage, settings and saves."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

root = Path(__file__).resolve().parents[1]
html = (root / 'play.html').read_text()
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True)
    # All fixture requests are fulfilled locally; no external website is contacted.
    context.route('https://story.test/**',lambda route:route.fulfill(status=200,content_type='text/html',body=html))
    page=context.new_page();errors=[];dialogs=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('dialog',lambda dialog:(dialogs.append(dialog.message),dialog.accept()))
    page.goto('https://story.test/')
    def send(text):
        page.locator('#message').fill(text);page.locator('#send').tap()
        assert page.locator('#send').is_enabled()
        return page.locator('article.assistant').last.inner_text()
    send('Меня зовут Алекс. Хочу найти брата.')
    send('Осматриваюсь, затем беру письмо и открываю его')
    before=page.locator('article').count()
    page.locator('#open-settings').tap()
    page.locator('[name=world]').fill('Обычная кухня. Магии нет.')
    page.locator('[name=character]').fill('Анна — добрая хозяйка. Хочет приготовить ужин.')
    page.locator('[name=canon]').fill('Предметы: ложка, чашка, закрытый шкаф\nСекрет: ждёт старого друга')
    page.locator('#settings button').tap()
    assert not dialogs,'Changing settings must not reset the story with a confirmation'
    assert page.locator('article').count()==before+1
    assert page.locator('#story-title').inner_text()=='Кухня'
    assert 'ложка' in send('Беру ложку')
    assert 'магия не установлена' in send('Превращаю ложку в дракона')
    assert 'Алекс' in send('Помнишь меня?')
    count=page.locator('article').count()
    saved=json.loads(page.evaluate("localStorage.getItem('between-lines-offline-v2')"))
    assert saved['memory']['version']==3
    assert 'ложка' in saved['memory']['inventory']
    page.reload()
    assert page.locator('article').count()==count
    assert 'ложка' in page.locator('#memory').inner_text()
    page.locator('#open-settings').tap()
    assert page.locator('[name=world]').input_value()=='Обычная кухня. Магии нет.'
    assert 'Алекс' in page.locator('#journal').inner_text()
    with page.expect_download() as download_info:
        page.locator('#export').tap()
    download=download_info.value
    path='/tmp/narrative-ui-save.json';download.save_as(path)
    assert json.loads(Path(path).read_text())['memory']['facts']['name']=='Алекс'
    page.locator('#reset').tap()
    page.locator('#close-settings').tap()
    assert page.locator('article').count()==0
    page.locator('#open-settings').tap()
    page.locator('#import').set_input_files(path)
    assert page.locator('#status').inner_text()=='История загружена.'
    page.locator('#close-settings').tap()
    assert page.locator('article').count()==count
    page.locator('#message').fill('Беру чашку')
    page.locator('#message').press('Enter')
    assert 'чашка' in page.locator('article.assistant').last.inner_text()
    assert not errors,errors
    page.screenshot(path='/tmp/narrative-mobile-v3.png')
    print('PASS mobile flow: compound actions, live world/NPC changes, history, localStorage reload, export, reset, import, keyboard send')
    browser.close()
