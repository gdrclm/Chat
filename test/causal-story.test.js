import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,E} from './rpg-fixture.mjs';
const config={world:'Ночной город, где воспоминания продаются в стеклянных флаконах. Я прихожу в закрытую лавку за своим потерянным прошлым.',character:'Мира — хозяйка лавки.',player:'Путник без воспоминаний, с треснувшим компасом в кармане.'};
const initial=()=>E.opening(config,E.fresh()).memory;
const play=(commands,m=initial())=>commands.reduce((r,text)=>E.reply(config,r.memory,text),{memory:m});
const memory=m=>m.entities.find(e=>e.memoryStory);
const mira=m=>Object.values(m.world.npcs).find(n=>n.name==='Мира');
const graph=m=>m.world.causality;
const physical=m=>JSON.stringify({entities:m.entities.map(e=>[e.id,e.location,e.destroyed,e.opened]),location:m.world.player.location,money:m.world.player.money});
for(const command of ['Возвращаю флакон','Возвращаю флакон Мире','Возвращаю Мире флакон','Отдаю флакон Мире','Передаю флакон обратно Мире'])test('physical restitution resolves the obligation for '+command,()=>{
 const before=play(['Мира, открой ларец','Беру флакон','Извини']).memory;assert.ok(mira(before).grievances.some(g=>g.kind==='theft'&&!g.resolved));const r=E.reply(config,before,command);
 assert.equal(r.results[0].code,'property_returned');assert.equal(memory(r.memory).location,mira(r.memory).id);assert.ok(mira(r.memory).grievances.every(g=>g.resolved));assert.ok(graph(r.memory).threads.some(t=>t.kind==='reparation'&&t.status==='completed'));
 const restored=E.restore(config,JSON.parse(JSON.stringify(r.memory)));assert.deepEqual(restored.world,r.memory.world);
});
for(const name of ['ящик с инструментами','«ящик с инструментами»','инструменты'])test('full names and aliases preserve object identity: '+name,()=>{
 const m=play(['Выхожу','Иду в город','Иду в мастерскую']).memory,r=E.reply(config,m,'Осматриваю '+name);assert.equal(r.results[0].code,'object_studied');assert.match(r.text,/плоскогубцы/);assert.equal(r.results[0].action.semantic.sourceId,undefined);
});
for(const command of ['Да','Да, берусь','Согласен помочь с ремонтом'])test('acceptance answers the actual pending offer: '+command,()=>{
 const m=play(['Выхожу','Иду в город','Иду в мастерскую','Ищу работу']).memory,r=E.reply(config,m,command);assert.equal(r.results.length,1);assert.equal(r.results[0].code,'job_accepted');assert.equal(r.memory.world.loops.work.status,'accepted');
});
for(const command of ['Как вернуть мою память?','Мира, я пришёл вернуть свои воспоминания. Что мне делать?','Ты можешь помочь вернуть прошлое?','Хочу вернуть свои воспоминания'])test('the premise leads to available approaches: '+command,()=>{
 const r=play([command]);assert.equal(r.results[0].code,'memory_routes_explained');assert.match(r.text,/доступ|открыть ларец/);assert.match(r.text,/монет/);assert.equal(memory(r.memory).memoryStory.previewed,false);
});
test('amnesia is a personal disclosure and past speech does not repeat a physical act',()=>{
 let r=play(['Здравствуйте','Я не помню своего имени']);assert.equal(r.results[0].code,'amnesia_acknowledged');assert.ok(mira(r.memory).memory.playerNameUnknown);assert.doesNotMatch(r.text,/Вы этого не делаете/);
 const before=play(['Выхожу','Иду в город','Иду в мастерскую']).memory;const after=E.reply(config,before,'Я прочитал объявление. Вам нужна помощь с ремонтом?');assert.equal(after.results[0].code,'action_reported');assert.equal(after.results[1].code,'job_offered');assert.equal(physical(before),physical(after.memory));
});
test('a legal preview reveals a stable concrete memory without transferring property',()=>{
 const m=play(['Мира, открой ларец']).memory,r=E.reply(config,m,'Смотрю воспоминание');assert.equal(r.results[0].code,'memory_experienced');assert.equal(memory(r.memory).location,memory(m).location);assert.equal(memory(r.memory).ownerId,memory(m).ownerId);assert.equal(mira(r.memory).grievances.length,0);assert.match(r.text,/Вы видите себя/);assert.match(r.text,/Сохранить|Отпустить/);
 assert.ok(!E.opening(config,E.fresh()).text.includes(memory(r.memory).memoryStory.text));const restored=E.restore(config,JSON.parse(JSON.stringify(r.memory)));assert.deepEqual(memory(restored).memoryStory,memory(r.memory).memoryStory);
});
test('a stage number cannot substitute for actually experiencing a memory',()=>{
 const m=play(['Мира, открой ларец']).memory;m.stage=999;const r=E.reply(config,m,'Сохраняю воспоминание');assert.equal(r.results[0].code,'memory_not_experienced');assert.equal(r.memory.facts.decision,undefined);
});
test('retaining and releasing produce distinct persistent consequences',()=>{
 const before=play(['Мира, открой ларец','Смотрю воспоминание']).memory,keep=E.reply(config,before,'Сохраняю воспоминание'),release=E.reply(config,before,'Отпускаю воспоминание');
 assert.equal(memory(keep.memory).memoryStory.active,true);assert.equal(memory(release.memory).memoryStory.active,false);assert.notEqual(keep.memory.facts.decision,release.memory.facts.decision);
 const loaded=E.restore(config,JSON.parse(JSON.stringify(release.memory)));assert.equal(E.reply(config,loaded,'Смотрю воспоминание').results[0].code,'memory_released');assert.equal(E.reply(config,loaded,'Сохраняю воспоминание').results[0].code,'memory_decision_committed');
 assert.ok(graph(keep.memory).nodes.some(n=>n.rule==='informed_choice'&&n.causes.length>=2));
});
test('permission, price and content are different questions',()=>{
 let r=play(['Мира, открой ларец','Чьё воспоминание во флаконе?']);assert.equal(r.results[0].code,'item_owner_explained');r=E.reply(config,r.memory,'Сколько стоит флакон?');assert.equal(r.results[0].code,'item_price_explained');assert.match(r.text,/2 монет/);
 r=E.reply(config,r.memory,'Как воспользоваться флаконом?');assert.equal(r.results[0].code,'item_method_explained');assert.equal(memory(r.memory).memoryStory.previewed,false);
 r=E.reply(config,r.memory,'Можно взять флакон?');assert.equal(r.results[0].code,'memory_permission_granted');r=E.reply(config,r.memory,'Беру флакон');assert.equal(mira(r.memory).grievances.length,0);
});
test('remote or hidden sources do not reveal their contents through questions',()=>{
 const m=play(['Выхожу','Иду в город']).memory,r=E.reply(config,m,'Как вернуть мою память?');assert.equal(r.results[0].code,'memory_interlocutor_absent');assert.doesNotMatch(r.text,/Вы видите себя/);assert.equal(memory(r.memory).memoryStory.previewed,false);
});
test('a damaged item stays an open need until the physical repair occurs',()=>{
 const f=fixture(),cart=f.item('тележка',{material:'wood',durability:20},f.m.place,{ownerId:f.actor().id});f.item('ремонтный инструмент',{functions:['repair']});f.item('доска',{material:'wood'});f.run('Осматриваю тележку');assert.ok(graph(f.m).threads.some(t=>t.subjectId===cart.id&&t.status==='open'));
 const observed=structuredClone(f.m);f.run('Ремонтирую тележку');assert.equal(f.entity(cart).physical.durability,100);assert.ok(graph(f.m).threads.some(t=>t.kind==='repair'&&t.status==='completed'));assert.ok(graph(f.m).threads.some(t=>t.kind==='reciprocity'&&t.ownerId===f.actor().id));
 const counter=E.reply(f.config,observed,'Не ремонтирую тележку');assert.equal(counter.memory.entities.find(e=>e.id===cart.id).physical.durability,20);assert.ok(!graph(counter.memory).threads.some(t=>t.kind==='reciprocity'));
});
test('a broken mechanism with full generic durability is not prematurely repaired',()=>{
 const r=play(['Выхожу','Иду в город','Иду в мастерскую','Осматриваю механизм']);const t=graph(r.memory).threads.find(t=>t.kind==='repair');assert.equal(t.status,'open');assert.ok(!graph(r.memory).nodes.some(n=>n.rule==='need_satisfied'));
});
test('the story graph stays grounded, acyclic and unchanged by querying options',()=>{
 const r=play(['Мира, открой ларец','Можно взять флакон?','Беру флакон','Смотрю воспоминание','Сохраняю воспоминание']);const before=JSON.stringify(r.memory);E.story(r.memory);E.searchActions(r.memory,'');assert.equal(JSON.stringify(r.memory),before);
 const seen=new Set();for(const n of graph(r.memory).nodes){assert.ok(!seen.has(n.id));for(const cause of n.causes)assert.ok(seen.has(cause),n.rule+' references absent or future cause '+cause);seen.add(n.id);}
});
test('failed actions and waiting cannot manufacture repaired needs or shared work',()=>{
 const f=fixture();f.run('Ремонтирую несуществующую машину','Жду','Жду');assert.ok(!graph(f.m).nodes.some(n=>['need_satisfied','shared_result_creates_reciprocity','work_creates_reputation'].includes(n.rule)));
});
test('story suggestions follow the repair stage and leave a way to walk away',()=>{
 let r=play(['Выхожу','Иду в город','Иду в мастерскую','Ищу работу','Да']);let choices=E.searchActions(r.memory,'');assert.equal(choices[0].command,'Осматриваю механизм');assert.ok(choices.some(o=>o.kind==='move'));
 r=E.reply(config,r.memory,'Осматриваю механизм');choices=E.searchActions(r.memory,'');assert.equal(choices[0].command,'Проверяю комплект деталей');
 r=E.reply(config,r.memory,'Проверяю комплект деталей');assert.equal(E.searchActions(r.memory,'')[0].command,'Где найти проволоку?');
});
test('the city book has readable content and the market explains actual prices',()=>{
 let r=play(['Выхожу','Иду в город','Иду на рынок','Что у тебя можно купить?']);assert.equal(r.results[0].code,'stock_explained');assert.match(r.text,/книга|проволоки/);
 r=E.reply(config,r.memory,'О чём эта книга?');assert.equal(r.results[0].code,'item_contents_explained');assert.match(r.text,/служебные проходы/);assert.doesNotMatch(r.text,/предмет можно переносить/);
});
test('garden descriptions refer to real inspectable surroundings',()=>{
 const r=play(['Иду в сад','Заглядываю за заросли']);assert.equal(r.results[0].status,'success');assert.match(r.text,/дорожк/);assert.ok(r.memory.entities.some(e=>e.localKey==='garden-bench'));
});
test('an interface choice binds the selected instance and never bypasses a changed world',()=>{
 const f=fixture(),one=f.item('ящик',{},f.m.place),two=f.item('ящик',{},f.m.place);const options=E.searchActions(f.m,'ящик',10).filter(o=>o.kind==='inspect');assert.ok(options.some(o=>o.targetId===one.id));const option=options.find(o=>o.targetId===two.id);assert.ok(option);const r=E.reply(f.config,f.m,option.command,option);assert.equal(r.results[0].status,'success');assert.equal(r.results[0].action.targetId,two.id);
 const stale=structuredClone(f.m);stale.entities.find(e=>e.id===two.id).destroyed=true;const blocked=E.reply(f.config,stale,option.command,option);assert.equal(blocked.results[0].code,'option_expired');assert.equal(blocked.memory.entities.find(e=>e.id===one.id).location,f.m.place);
});
test('a loan creates a causal obligation and its actual return closes that obligation',()=>{
 const f=fixture(),tool=f.item('молоток',{material:'metal'},f.actor().id,{ownerId:f.actor().id});f.run('Одолжи молоток');assert.equal(f.last.results[0].code,'loan_granted');const loan=graph(f.m).threads.find(t=>t.kind==='return_loan'&&t.subjectId===tool.id);assert.ok(loan);f.run('Возвращаю молоток');const done=graph(f.m).threads.find(t=>t.id===loan.id);assert.equal(done.status,'completed');assert.ok(graph(f.m).nodes.find(n=>n.id===done.resultId).causes.includes(loan.causeId));
});
test('the generated social opportunity uses the actual owner and an available tool',()=>{
 const f=fixture();f.item('тележка',{material:'wood',durability:20},f.m.place,{ownerId:f.actor().id});f.item('ремонтный инструмент',{functions:['repair']});f.item('доска',{material:'wood'});f.item('плоскогубцы',{},f.actor().id,{ownerId:f.actor().id,kind:'tool'});f.run('Осматриваю тележку','Ремонтирую тележку','Обсудить взаимную помощь с Мирой');assert.equal(f.last.results[0].code,'reciprocity_offered');assert.match(f.last.text,/плоскогубцы/);assert.doesNotMatch(f.last.text,/одолжить «ларец»/);
});
test('an outcome in a different world creates a different grounded causal episode',()=>{
 const first=fixture({character:'Лада — хозяйка мастерской.'}),second=fixture({character:'Антон — хранитель.'});for(const [f,label] of [[first,'стол'],[second,'тележка']]){f.item(label,{material:'wood',durability:20},f.m.place,{ownerId:f.actor(f.config.character.split(' ')[0]).id});f.item('ремонтный инструмент',{functions:['repair']});f.item('доска',{material:'wood'});f.run('Осматриваю '+label,'Ремонтирую '+label);const t=graph(f.m).threads.find(t=>t.kind==='repair');assert.equal(f.m.entities.find(e=>e.id===t.subjectId).label,label);assert.equal(f.m.world.npcs[t.ownerId].name,f.config.character.split(' ')[0]);assert.ok(graph(f.m).nodes.some(n=>n.rule==='need_satisfied'));}
 assert.notDeepEqual(graph(first.m).threads,graph(second.m).threads);
});
for(const command of ['Можно сохранить воспоминание?','Что будет, если отпустить воспоминание?','Хочу отпустить воспоминание','Не сохраняю воспоминание','Где посмотреть воспоминание?','Хочу посмотреть своё воспоминание','Можно купить флакон?'])test('discussing or planning the memory cannot commit a physical choice: '+command,()=>{
 const m=play(['Мира, открой ларец','Смотрю воспоминание']).memory,r=E.reply(config,m,command);assert.equal(memory(r.memory).memoryStory.decision,null);assert.equal(memory(r.memory).memoryStory.active,true);assert.equal(r.memory.world.player.money,m.world.player.money);
});
test('a new conflict blocks an old reciprocal offer without removing its causal history',()=>{
 const f=fixture();f.item('тележка',{material:'wood',durability:20},f.m.place,{ownerId:f.actor().id});f.item('ремонтный инструмент',{functions:['repair']});f.item('доска',{material:'wood'});f.run('Осматриваю тележку','Ремонтирую тележку');const offer=graph(f.m).threads.find(t=>t.kind==='reciprocity');assert.ok(offer);f.run('Оскорбляю Миру','Обсудить взаимную помощь с Мирой');assert.equal(f.last.results[0].code,'favor_conflict');assert.ok(graph(f.m).threads.some(t=>t.id===offer.id));
});
test('content questions do not bypass the seal on an unread source',()=>{
 const r=play(['О чём запечатанное письмо?']);assert.equal(r.results[0].code,'item_contents_explained');assert.match(r.text,/запечатан/);assert.doesNotMatch(r.text,/Если вы читаете это письмо/);
});
test('asking how a craftsman chose the profession is a conversation, not a hammer reference',()=>{
 const r=play(['Выхожу','Иду в город','Иду в мастерскую','Спасибо за работу. Как ты стал мастером?']);assert.ok(r.results.some(v=>v.conversation?.topicId==='occupation.motivation'));assert.doesNotMatch(r.text,/молоток.*пока здесь/);
});
test('a new checkable goal continues the released-memory branch through a recorded cause',()=>{
 const r=play(['Мира, открой ларец','Смотрю воспоминание','Отпускаю воспоминание','Ставлю цель: заработать 10 монет']);assert.equal(r.results[0].code,'goal_created');const t=graph(r.memory).threads.find(t=>t.kind==='aftermath');assert.equal(t.status,'completed');const node=graph(r.memory).nodes.find(n=>n.id===t.resultId);assert.equal(node.rule,'chosen_goal_continues_story');assert.ok(node.causes.includes(t.causeId));
});
test('a positive story outcome is not recreated by repeating the same observation',()=>{
 const f=fixture();f.item('тележка',{material:'wood',durability:20},f.m.place,{ownerId:f.actor().id});f.item('ремонтный инструмент',{functions:['repair']});f.item('доска',{material:'wood'});f.run('Осматриваю тележку','Ремонтирую тележку');const before=graph(f.m).nodes.filter(n=>n.rule==='need_satisfied').length;f.run('Осматриваю тележку','Осматриваю тележку');assert.equal(graph(f.m).nodes.filter(n=>n.rule==='need_satisfied').length,before);
});
test('a fitted pin still needs testing before the repair can generate social consequences',()=>{
 let r=play(['Выхожу','Иду в город','Иду в мастерскую','Ищу работу','Да','Осматриваю механизм','Проверяю комплект деталей','Иду в город','Иду на улицу','Осматриваю решётку','Приподнимаю решётку','Беру проволоку','Иду в город','Иду в мастерскую','Изготавливаю штифт','Устанавливаю штифт']);assert.equal(graph(r.memory).threads.find(t=>t.kind==='repair').status,'open');assert.ok(!graph(r.memory).threads.some(t=>t.kind==='reciprocity'));
 r=E.reply(config,r.memory,'Проверяю ход механизма');assert.equal(graph(r.memory).threads.find(t=>t.kind==='repair').status,'completed');assert.ok(graph(r.memory).threads.some(t=>t.kind==='reciprocity'));
});
test('the advertised garden seat supports the action without inventing another object',()=>{
 const r=play(['Иду в сад','Сажусь на садовую скамью']);assert.equal(r.results[0].status,'success');assert.equal(r.memory.world.player.body.posture,'sitting');assert.equal(r.memory.entities.filter(e=>e.localKey==='garden-bench').length,1);
});
test('content upgrades add missing stock once and never respawn a purchased item',()=>{
 const m=initial();delete m.world.causality;const id=m.entities.find(e=>e.stockOwner&&/проволок/.test(e.label)).id;m.entities=m.entities.filter(e=>e.id!==id);const restored=E.restore(config,JSON.parse(JSON.stringify(m)));assert.equal(restored.entities.filter(e=>e.id===id).length,1);restored.entities.find(e=>e.id===id).location='inventory';const again=E.restore(config,JSON.parse(JSON.stringify(restored)));assert.equal(again.entities.find(e=>e.id===id).location,'inventory');assert.equal(again.entities.filter(e=>e.id===id).length,1);
});
test('a remembered place guides the next step without tracking a remote NPC omnisciently',()=>{
 const m=play(['Мира, открой ларец','Смотрю воспоминание','Сохраняю воспоминание']).memory;const witness=memory(m).memoryStory.witnessId;const originalPlace=memory(m).memoryStory.placeId;m.world.npcs[witness].location=m.world.locations.find(l=>l.name==='сад').id;
 const r=E.reply(config,m,'Где найти свидетеля?');assert.equal(r.results[0].code,'witness_location_remembered');assert.ok(r.text.includes(m.world.locations.find(l=>l.id===originalPlace).name));assert.doesNotMatch(r.text,/«сад»/);assert.ok(E.story(m).options.some(o=>/месту из воспоминания/.test(o.label)));
});
test('legacy memory decisions survive migration without restoring a released record',()=>{
 const m=initial();delete m.world.causality;delete memory(m).memoryStory;m.facts.decision='отпустить';m.stage=3;const restored=E.restore(config,JSON.parse(JSON.stringify(m)));assert.equal(memory(restored).memoryStory.decision,'release');assert.equal(memory(restored).memoryStory.active,false);assert.equal(E.reply(config,restored,'Смотрю воспоминание').results[0].code,'memory_released');
});
test('a witness distinguishes a recommendation from their own shared work',()=>{
 const m=play(['Мира, открой ларец','Смотрю воспоминание','Сохраняю воспоминание']).memory;const witness=m.world.npcs[memory(m).memoryStory.witnessId];witness.location=m.world.player.location;witness.memory.confirmedRecommendation='proof:recommendation';
 const r=E.reply(config,m,witness.name+', расспрашиваю свидетеля об обещании');assert.equal(r.results[0].code,'memory_witness_response');assert.match(r.text,/Рекомендация мастера подтверждает/);assert.doesNotMatch(r.text,/После нашей работы/);assert.ok(memory(r.memory).memoryStory.confirmedWitness);assert.ok(!E.story(r.memory).options.some(o=>o.command==='Расспрашиваю свидетеля об обещании'));
});
