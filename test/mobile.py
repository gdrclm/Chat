"""Developer check: python3 test/mobile.py (requires Playwright and Chromium)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

html = (Path(__file__).resolve().parents[1] / 'play.html').read_text()
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height in [(390,844),(360,640),(320,568),(844,390),(390,380)]:
        page = browser.new_page(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
        errors=[]
        page.on('pageerror', lambda error: errors.append(str(error)))
        # Browser policy prohibits file:// here. Inline the actual single-file artifact.
        page.set_content(html)
        assert page.locator('#settings-page').is_hidden()
        page.locator('#message').fill('Меня зовут Алекс')
        page.locator('#send').tap()
        assert page.locator('article').count()==2
        assert 'Алекс' in page.locator('article.assistant').inner_text()
        for text in ['Осматриваюсь','Беру ключ','Открываю ларец','Помнишь меня?']:
            page.locator('#message').fill(text)
            page.locator('#send').tap()
        assert page.locator('article').count()==10
        assert 'Алекс' in page.locator('article.assistant').last.inner_text()
        assert page.evaluate('document.documentElement.scrollHeight <= window.innerHeight + 1')
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
        box=page.locator('#send').bounding_box()
        assert box['y']>=0 and box['y']+box['height']<=height+1
        assert page.locator('#messages').evaluate('(el)=>el.scrollHeight>el.clientHeight')
        page.locator('#open-settings').tap()
        assert page.locator('#chat-page').is_hidden()
        assert page.locator('#settings-page').is_visible()
        page.locator('#close-settings').tap()
        assert page.locator('article').count()==10
        assert not errors, errors
        page.screenshot(path=f'/tmp/chat-{width}-{height}.png')
        print(f'PASS {width}x{height}: touch send, replies, memory, navigation, scroll bounds')
        page.close()
    browser.close()
