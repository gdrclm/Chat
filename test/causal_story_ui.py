"""Narrative contracts from the playtest, through the real UI on both builds."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, subprocess, os
root=Path(__file__).resolve().parents[1];out=root/'work'/'causal-development';out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','server.js'],cwd=root,env={**os.environ,'PORT':'3102'},stdout=subprocess.DEVNULL)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for source in [True,False]:
   context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
   if not source:context.route('https://story.test/**',lambda r:r.fulfill(status=200,content_type='text/html',body=(root/'play.html').read_text()))
   page=context.new_page();errors=[];trace=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   page.goto('http://127.0.0.1:3102/' if source else 'https://story.test/');page.wait_for_selector('article.assistant')
   def save():return page.evaluate("JSON.parse(localStorage.getItem('between-lines-offline-v2'))")
   def memory():return save()['memory']
   def artifact():return next(e for e in memory()['entities'] if e.get('memoryStory'))
   def send(text):
    page.locator('#message').fill(text);page.locator('#send').tap();assert page.locator('#send').is_enabled()
    m=memory();trace.append({'input':text,'reply':page.locator('article.assistant').last.inner_text(),'codes':[v['code'] for v in m['lastOutcome']['results']]});(out/('causal-source-trace.json' if source else 'causal-standalone-trace.json')).write_text(json.dumps(trace,ensure_ascii=False,indent=2));return m['lastOutcome']['results'][0]['code']
   assert memory()['turn']==0
   assert send('Я не помню своего имени')=='amnesia_acknowledged'
   assert send('Как вернуть мою память?')=='memory_routes_explained'
   assert send('Мира, открой ларец, пожалуйста')=='npc_opened'
   assert send('Сохраняю воспоминание')=='memory_not_experienced'
   send('Беру флакон');assert any(g['kind']=='theft' and not g['resolved'] for n in memory()['world']['npcs'].values() for g in n['grievances'])
   send('Извини');assert send('Отдаю флакон Мире')=='property_returned'
   assert all(g['resolved'] for n in memory()['world']['npcs'].values() for g in n['grievances'])
   page.reload();assert send('Покажи воспоминание')=='memory_experienced'
   assert artifact()['memoryStory']['text'] in page.locator('article.assistant').last.inner_text()
   assert send('Отпускаю воспоминание')=='memory_decided'
   page.reload();assert send('Сохраняю воспоминание')=='memory_decision_committed';assert send('Смотрю воспоминание')=='memory_released'
   # Start the alternate branch through the user-facing reset.
   page.locator('#open-settings').tap();page.locator('#reset').tap();page.locator('#close-settings').tap()
   send('Как вернуть мою память?');send('Мира, открой ларец, пожалуйста');assert send('Можно взять флакон?')=='memory_permission_granted';send('Беру флакон');send('Смотрю воспоминание');send('Сохраняю воспоминание')
   witness=artifact()['memoryStory']['witnessId']
   assert not any(g for n in memory()['world']['npcs'].values() for g in n['grievances'])
   send('Выхожу');send('Иду в город');send('Иду в мастерскую')
   assert send('Осматриваю ящик с инструментами')=='object_studied'
   assert send('Я прочитал объявление. Вам нужна помощь с ремонтом?')=='action_reported'
   assert memory()['lastOutcome']['results'][-1]['code']=='job_offered'
   assert send('Да, берусь')=='job_accepted';assert len(memory()['lastOutcome']['results'])==1
   assert page.locator('#situation-actions button').first.inner_text()=='Определить поломку'
   page.locator('#situation-actions button').first.tap();assert page.locator('#situation-actions button').first.inner_text()=='Проверить, чего не хватает'
   page.locator('#situation-actions button').first.tap();assert page.locator('#situation-actions button').first.inner_text()=='Узнать, где искать материал'
   page.locator('#situation-actions button').first.tap();assert 'водостока' in page.locator('article.assistant').last.inner_text()
   send('Выхожу');assert memory()['place']=='город';send('Иду на улицу');send('Осматриваю решётку водостока');send('Приподнимаю решётку');send('Беру проволоку');send('Иду в город');send('Иду в мастерскую')
   assert page.locator('#situation-actions button').first.inner_text()=='Изготовить штифт'
   for expected in ['Установить изготовленную деталь','Проверить результат ремонта','Получить заработанные монеты']:
    page.locator('#situation-actions button').first.tap();assert page.locator('#situation-actions button').first.inner_text()==expected
   page.locator('#situation-actions button').first.tap();assert memory()['world']['player']['money']==3
   graph=memory()['world']['causality'];assert any(t['kind']=='repair' and t['status']=='completed' for t in graph['threads']);assert any(t['kind']=='reciprocity' for t in graph['threads']);assert any(n['rule']=='work_creates_reputation' for n in graph['nodes'])
   send('Иду в город');send('Иду на рынок');send('Показываю Нике рекомендацию мастера');assert send('Что у тебя можно купить?')=='stock_explained'
   assert send('О чём эта книга?')=='item_contents_explained';send('Покупаю книгу');send('Читаю купленную книгу');assert 'служебные проходы' in page.locator('article.assistant').last.inner_text();assert memory()['world']['player']['money']==2
   if memory()['world']['npcs'][witness]['name']=='Илья':send('Иду в город');send('Иду в мастерскую')
   elif memory()['world']['npcs'][witness]['name']=='Лея':send('Иду в город');send('Иду на площадь');send('Показываю Лее рекомендацию мастера')
   assert send('Расспрашиваю свидетеля об обещании')=='memory_witness_response'
   assert artifact()['memoryStory']['confirmedWitness']
   assert any(t['kind']=='aftermath' and t['status']=='completed' for t in memory()['world']['causality']['threads'])
   page.locator('#open-world').tap();assert 'последствие состоялось' in page.locator('#causal-threads').inner_text();page.locator('#close-world').tap()
   assert not errors,errors;assert page.evaluate('document.documentElement.scrollHeight <= innerHeight + 2')
   page.screenshot(path=str(out/('causal-source.png' if source else 'causal-standalone.png')))
   (out/('causal-source-trace.json' if source else 'causal-standalone-trace.json')).write_text(json.dumps(trace,ensure_ascii=False,indent=2))
   print(json.dumps({'build':'source' if source else 'standalone','turns':memory()['turn'],'causal_nodes':len(memory()['world']['causality']['nodes']),'threads':len(memory()['world']['causality']['threads']),'errors':errors,'result':'PASS'},ensure_ascii=False),flush=True)
   context.close()
  browser.close()
finally:server.terminate();server.wait()
