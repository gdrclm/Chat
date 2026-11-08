from pathlib import Path
from playwright.sync_api import sync_playwright
import json
html=(Path(__file__).resolve().parents[1]/'play.html').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width,height in [(390,844),(360,640),(320,568)]:
  context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
  context.route('https://story.test/**',lambda route:route.fulfill(status=200,content_type='text/html',body=html))
  page=context.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)));page.on('dialog',lambda dialog:dialog.accept())
  page.goto('https://story.test/')
  def memory():return json.loads(page.evaluate("localStorage.getItem('between-lines-offline-v2')"))['memory']
  def send(text):
   page.locator('#message').fill(text);page.locator('#send').tap()
   outcome=memory()['lastOutcome'];assert outcome['results'][0]['status']=='success',(text,outcome['results'][0]['code'],page.locator('article.assistant').last.inner_text())
   assert page.locator('#send').is_enabled()
  page.locator('#open-settings').tap();page.locator('#story-preset').select_option('craft');page.locator('#apply-preset').tap();page.locator('#settings button[type=submit]').tap()
  page.locator('#open-settings').tap();page.locator('#reset').tap();page.locator('#close-settings').tap()
  send('Осматриваюсь');page.locator('#open-world').tap();page.locator('#suggested-actions button').filter(has_text='Сажусь на табурет').tap()
  assert memory()['world']['player']['body']['posture']=='sitting'
  page.reload();assert memory()['world']['player']['body']['posture']=='sitting';send('Встаю')
  send('Ставлю цель: починить тележку');send('Начинаю собственную историю');send('Устраиваюсь на работу у Ильи');send('Ремонтирую тележку');send('Требую оплату услуги')
  assert memory()['world']['player']['money']>10
  send('Приглашаю в спутники Илью');send('Иду в город');assert next(n for n in memory()['world']['npcs'].values() if n['name']=='Илья')['location']==memory()['world']['player']['location']
  send('Передаю часть палки 1 Илье');send('Передаю часть камня 1 Илье');send('Поручаю Илье изготовить рычаг');send('Пропускаю время 20')
  assert any(e['label']=='рычаг' and e['location']=='inventory' for e in memory()['entities'])
  send('Завершаю приключение');ending=memory()['world']['rpg']['ending']['id'];page.reload();assert memory()['world']['rpg']['ending']['id']==ending
  page.locator('#open-world').tap();assert 'готово' in page.locator('#rpg-tasks').inner_text();assert 'завершено' in page.locator('#rpg-arcs').inner_text();page.locator('#open-actions').tap()
  assert page.locator('#action-catalog > li').count()==325
  page.locator('#action-search').fill('112');assert page.locator('#action-catalog > li').count()==1
  assert 'слепку' in page.locator('#action-catalog').inner_text()
  page.locator('#action-catalog summary').tap();assert page.locator('#action-catalog details p').count()>0
  page.locator('#close-actions').tap();page.locator('#close-world').tap()
  assert page.evaluate('document.documentElement.scrollHeight <= innerHeight + 2')
  assert not errors,errors
  page.screenshot(path=f'/tmp/chat-60-mobile-{width}.png');context.close();print('6.0 mobile',width,height,'PASS',flush=True)
 browser.close()
