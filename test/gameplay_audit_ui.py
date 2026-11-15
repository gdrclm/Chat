"""Browser regressions for audit 6.0: source server and standalone build."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, subprocess
root=Path(__file__).resolve().parents[1]
(root/'work').mkdir(exist_ok=True)
server=subprocess.Popen(['node','server.js'],cwd=root,env={**__import__('os').environ,'PORT':'3101'},stdout=subprocess.DEVNULL)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for source in [True,False]:
   context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
   if not source:
    context.route('https://story.test/**',lambda route:route.fulfill(status=200,content_type='text/html',body=(root/'play.html').read_text()))
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   page.goto('http://127.0.0.1:3101/' if source else 'https://story.test/');page.wait_for_selector('article.assistant')
   def saved():return page.evaluate("JSON.parse(localStorage.getItem('between-lines-offline-v2'))")
   def memory():return saved()['memory']
   def send(text):
    page.locator('#message').fill(text);page.locator('#send').tap();assert page.locator('#send').is_enabled()
   assert memory()['turn']==0
   assert 'Вы находитесь' in page.locator('article.assistant').first.inner_text()
   assert 'прошл' in page.locator('#current-situation').inner_text()
   assert 0<page.locator('#situation-actions button').count()<=6
   page.locator('#message').focus();assert page.locator('#command-suggestions button').count()>0
   page.locator('#message').fill('о');assert page.locator('#command-suggestions button').count()>0
   page.locator('#message').fill('');page.locator('#message').press('Escape')
   first=page.locator('article.assistant').first
   link=first.locator('.context-term').filter(has_text='запечатанное письмо').first
   assert link.count()==1;link.tap();historical=first.locator('.context-panel p').inner_text()
   page.evaluate("window.auditFirst=document.querySelector('article.assistant')")
   send('Осматриваюсь')
   assert page.evaluate("window.auditFirst===document.querySelector('article.assistant')")
   assert first.locator('.context-panel p').inner_text()==historical
   for command in ['Открываю ларец','Прошу Миру открыть ларец','Закрываю ларец','Открываю ларец с помощью серебряного ключа']:send(command)
   send('Подхватываю запечатанное письмо');assert any(e['label']=='запечатанное письмо' and e['location']=='inventory' for e in memory()['entities'])
   send('Выхожу')
   assert first.locator('.context-term').filter(has_text='запечатанное письмо').count()==1
   page.reload();first=page.locator('article.assistant').first
   first.locator('.context-term').filter(has_text='запечатанное письмо').tap()
   assert first.locator('.context-panel p').inner_text()==historical
   assert first.locator('.context-draft').count()==0 or all('письмо' in t for t in first.locator('.context-draft').all_text_contents())
   send('Возвращаюсь');send('Говорю с Мирой')
   topics=[]
   for question in ['Как вас зовут?','Что это за место?','Чем занимаетесь?','Откуда вы родом?','Что здесь разрешено?','Здесь безопасно?','Кто здесь живёт?','Что любите есть?','Чай или кофе?','Как проводите свободное время?']:
    send(question);results=memory()['lastOutcome']['results'];topics.append(next((v.get('conversation',{}).get('topicId') for v in results if v.get('conversation')),None))
   assert len(set(t for t in topics if t))==10,topics
   send('Телепатически передвигаю гору');assert 'Можно попробовать' in page.locator('article.assistant').last.inner_text()
   assert page.locator('#situation-actions button').count()>0
   while memory()['turn']<20:send('Осматриваюсь')
   assert page.locator('#settings-page').is_hidden()
   for command in ['Выхожу','Иду в город','Иду в мастерскую','Осматриваюсь','Незаметно беру молоток мастера','Жду','Жду','Жду']:send(command)
   theft=next(e for e in memory()['world']['social']['events'] if e['type']=='theft')
   owner=next(n for n in memory()['world']['npcs'].values() if n['name']=='Илья')
   assert owner['social']['relationship']['suspicion']>0 and owner['social']['knowledge'].get(theft['id'])
   send('Иду в город');send('Возвращаюсь')
   assert 'После вашего отсутствия' in page.locator('article.assistant').last.inner_text()
   snapshot=saved();(root/'work'/'audit-save.json').write_text(json.dumps(snapshot,ensure_ascii=False))
   page.locator('#open-settings').tap();page.locator('#import').set_input_files(str(root/'work'/'audit-save.json'))
   assert memory()['turn']==snapshot['memory']['turn']
   page.locator('#story-preset').select_option('craft');page.locator('#start-preset').tap()
   assert page.locator('#settings-page').is_hidden();assert memory()['turn']==0
   send('Сажусь');assert memory()['world']['player'].get('pendingAction')
   page.reload();send('табурет');assert memory()['lastOutcome']['results'][0]['status']=='success'
   send('Встаю')
   send('Ставлю цель: починить тележку');send('Устраиваюсь на работу у Ильи');send('Ремонтирую тележку');send('Требую оплату услуги')
   assert memory()['world']['rpg']['goals'][0]['status']=='completed'
   assert memory()['world']['player']['money']>10
   assert page.evaluate('document.documentElement.scrollHeight <= innerHeight + 2')
   assert not errors,errors
   page.screenshot(path=str(root/'work'/('audit-source.png' if source else 'audit-standalone.png')))
   probe=saved()
   mentions=[{'key':f'entity:historical:{i}','type':'entity','id':f'historical:{i}','label':f'синий ящик {i}','forms':[f'синий ящик {i}'],'description':'Известное описание в момент сообщения.'} for i in range(9)]
   probe['messages']=[{'role':'assistant','content':'. '.join(m['label'] for m in mentions)+'. Синий. Ящик.','mentions':mentions}]
   page.evaluate("data=>localStorage.setItem('between-lines-offline-v2',JSON.stringify(data))",probe);page.reload()
   assert page.locator('.context-term').count()==9
   assert all(t.startswith('синий ящик ') for t in page.locator('.context-term').all_text_contents())
   probe['messages'][0].pop('mentions')
   page.evaluate("data=>localStorage.setItem('between-lines-offline-v2',JSON.stringify(data))",probe);page.reload()
   assert page.locator('.context-term').count()==0
   assert not errors,errors
   print(json.dumps({'mode':'source' if source else 'standalone','topics':topics,'turn':memory()['turn'],'errors':errors,'result':'PASS'},ensure_ascii=False),flush=True)
   context.close()
  browser.close()
finally:server.terminate();server.wait()
