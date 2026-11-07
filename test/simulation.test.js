import test from 'node:test';
import assert from 'node:assert/strict';
import '../simulation.js';
import '../engine.js';
const E=globalThis.StoryEngine;
const config={world:'Магическая лавка.',character:'Мира — хозяйка лавки. Хочет вернуть компас.',player:'Путник с компасом',canon:'Истина: виновник = Антон\nЦенный предмет: компас'};
const play=(c,...commands)=>commands.reduce((r,t)=>E.reply(c,r.memory,t),{memory:E.fresh()});
const person=(s,name='Мира')=>Object.values(s.world.npcs).find(n=>n.name===name);
const item=(s,label)=>s.entities.find(e=>e.label.includes(label));
const status=r=>r.outcome.status;

test('A: testimony plus an unwitnessed forged clue persuades the NPC without rewriting world truth',()=>{
 const r=play(config,'Лгу: виновник = Борис','Беру письмо','Незаметно подбрасываю письмо: виновник = Борис','Кто виноват?');
 const n=person(r.memory);assert.equal(n.beliefs['виновник'].value,'Борис');assert.ok(n.beliefs['виновник'].confidence>=.7);
 assert.equal(r.memory.world.facts['виновник'].value,'Антон');assert.equal(n.agenda.target,'Борис');assert.match(r.text,/Я считаю.*Борис/s);
});
test('A: repeating the same artifact does not create independent corroboration',()=>{
 const one=play(config,'Лгу: виновник = Борис','Беру письмо','Незаметно подбрасываю письмо: виновник = Борис');
 const after=E.reply(config,one.memory,'Показываю письмо');assert.equal(person(after.memory).beliefs['виновник'].confidence,person(one.memory).beliefs['виновник'].confidence);
});
test('A: observed evidence fabrication is not mistaken for an independent witness',()=>{
 const r=play(config,'Лгу: виновник = Борис','Беру письмо','Подбрасываю письмо: виновник = Борис');
 assert.equal(status(r),'partial_success');assert.ok(person(r.memory).beliefs['виновник'].confidence<.7);assert.ok(person(r.memory).grievances.some(g=>g.kind==='staged_evidence'));
});
test('A: NPC beliefs are not shared with a distant stranger',()=>{
 const r=play(config,'Лгу: виновник = Борис');assert.ok(person(r.memory).beliefs['виновник']);assert.equal(person(r.memory,'Ника').beliefs['виновник'],undefined);
});
test('B: proposed plan does not instantly move or open its target',()=>{
 const r=play(config,'Прошу Миру вынести ларец наружу, спрятать его и открыть позже');
 assert.equal(item(r.memory,'ларец').location,'лавка');assert.equal(item(r.memory,'ларец').opened,false);assert.equal(r.memory.world.plans[0].status,'proposed');
});
test('B: agreement carries and hides the actual chest; opening waits for a later signal',()=>{
 const r=play(config,'Прошу Миру вынести ларец наружу, спрятать его и открыть позже','Да');
 const e=item(r.memory,'ларец');assert.equal(e.location,'улица');assert.equal(e.hidden,true);assert.equal(e.opened,false);assert.equal(r.memory.place,'лавка');
 const task=r.memory.world.deferred[0];assert.equal(task.status,'pending');assert.equal(task.actor,person(r.memory).id);assert.equal(task.targetId,e.id);
});
test('B: deferred opening requires co-location and then runs with the NPC actual access',()=>{
 const p=play(config,'Прошу Миру вынести ларец наружу, спрятать его и открыть позже','Да');
 const remote=E.reply(config,p.memory,'Открываю ларец');assert.equal(status(remote),'refused');assert.equal(item(remote.memory,'ларец').opened,false);
 const arrive=E.reply(config,remote.memory,'Выхожу');const open=E.reply(config,arrive.memory,'Открываю ларец');
 assert.equal(status(open),'success');assert.equal(item(open.memory,'ларец').opened,true);assert.equal(open.memory.world.deferred[0].status,'completed');
});
test('B: moving a portable locked container does not change its lock',()=>{
 const r=play(config,'Беру ларец','Выношу ларец наружу');assert.equal(r.memory.place,'улица');assert.equal(item(r.memory,'ларец').location,'inventory');assert.equal(item(r.memory,'ларец').locked,true);assert.equal(item(r.memory,'ларец').opened,false);
});
test('C: conflict has a cause and survives leaving and returning',()=>{
 const r=play(config,'Ты идиот','Выхожу','Возвращаюсь','Помоги открыть ларец');
 const n=person(r.memory);assert.equal(status(r),'refused');assert.match(n.grievances[0].reason,/идиот/);assert.equal(n.grievances[0].resolved,false);
});
test('C: an apology alone leaves the specified repair condition pending',()=>{
 const r=play(config,'Ты идиот','Прости');assert.equal(status(r),'partial_success');assert.equal(person(r.memory).grievances[0].apology,true);assert.equal(person(r.memory).grievances[0].resolved,false);
});
test('C: apology and personally meaningful gift reconcile, preserving the record',()=>{
 const r=play(config,'Ты идиот','Прости','Дарю компас','Помоги открыть ларец','Да');
 const n=person(r.memory);assert.equal(n.grievances[0].resolved,true);assert.equal(n.reconciliations.length,1);assert.equal(item(r.memory,'ларец').opened,true);
});
test('C: a generic gift does not erase the cause of a conflict',()=>{
 const r=play(config,'Ты идиот','Беру письмо','Прости','Дарю письмо','Помоги открыть ларец');assert.equal(status(r),'refused');assert.equal(person(r.memory).grievances[0].resolved,false);
});
test('C: another NPC has independent reaction counters and no inherited conflict',()=>{
 const r=play(config,'Привет','Спасибо','Ты идиот','Выхожу','Иду в город','Иду на рынок','Привет');
 assert.equal(person(r.memory).seen.greet,1);assert.equal(person(r.memory,'Ника').seen.greet,1);assert.equal(person(r.memory,'Ника').trust,1);assert.equal(person(r.memory,'Ника').grievances.length,0);
});
test('D: a work/exploration/social loop can complete without solving the original mystery',()=>{
 const r=play(config,'Выхожу','Иду в город','Иду в мастерскую','Ищу работу','Да','Работаю','Работаю','Забираю плату','Иду в город','Иду на рынок','Исследую город','Покупаю цепочку');
 assert.equal(status(r),'success');assert.equal(r.memory.world.loops.work.status,'paid');assert.equal(r.memory.world.player.money,1);assert.ok(r.memory.inventory.includes('цепочка'));assert.ok(r.memory.world.loops.social.contacts.includes(person(r.memory,'Ника').id));assert.equal(item(r.memory,'ларец').opened,false);
});
test('D: one job cannot be paid twice',()=>{
 const r=play(config,'Выхожу','Иду в город','Иду в мастерскую','Ищу работу','Да','Работаю','Работаю','Забираю плату','Забираю плату');assert.equal(status(r),'refused');assert.equal(r.memory.world.player.money,3);
});
test('D: real graph transitions reject teleportation and unknown destinations',()=>{
 const r=play(config,'Иду на рынок');assert.equal(status(r),'refused');assert.equal(r.memory.place,'лавка');
 const unknown=E.reply(config,r.memory,'Иду на Марс');assert.equal(status(unknown),'clarification');assert.equal(unknown.memory.place,'лавка');
});
test('D: an authored locked exit follows the physical barrier state',()=>{
 const c={...config,canon:'Место: лавка\nПредметы: дверь\nПреграда: дверь\nЛокации: лавка, улица\nПереходы: лавка <-> улица [дверь]'};
 const closed=play(c,'Выхожу');assert.equal(status(closed),'refused');
 const opened=play(c,'Ломаю дверь','Выхожу');assert.equal(opened.memory.place,'улица');
});
test('E: a composed gift plan preserves origin, changes trust, and permits a separate help agreement',()=>{
 const made=play(config,'Осматриваюсь','Беру ключ','Превращаю ключ в украшение и дарю его, чтобы заслужить доверие');
 const key=item(made.memory,'ключ'),gift=item(made.memory,'украшение'),n=person(made.memory);
 assert.equal(key.destroyed,true);assert.ok(gift.lineage.includes(key.id));assert.equal(gift.location,n.id);assert.ok(n.trust>0);assert.equal(item(made.memory,'ларец').opened,false);
 assert.ok(made.outcome.effects.some(e=>e.type==='gift_received'));assert.ok(made.outcome.effects.some(e=>e.type==='cooperation_access'));
 const open=E.reply(config,E.reply(config,made.memory,'Помоги открыть ларец').memory,'Да');assert.equal(item(open.memory,'ларец').opened,true);
});
test('E: decorative transformation does not duplicate or secretly preserve the key function',()=>{
 const r=play(config,'Осматриваюсь','Беру ключ','Превращаю ключ в украшение','Открываю ларец');
 assert.equal(status(r),'refused');assert.deepEqual(item(r.memory,'украшение').unlocks,[]);assert.equal(item(r.memory,'ларец').opened,false);
});
test('P0: action analysis separates intention, goal, method and desired effect without mutating state',()=>{
 const m=E.restore(config,E.fresh()),snapshot=JSON.stringify(m);
 const a=E.analyze(config,m,'Превращаю ключ в украшение с помощью магии, чтобы заслужить доверие')[0];
 assert.equal(a.intent,'craft_gift');assert.equal(a.goal,'заслужить доверие');assert.equal(a.method,'магии');assert.equal(a.expectedEffect,'изменить отношение адресата');assert.equal(a.scope,'play');assert.equal(JSON.stringify(m),snapshot);
});
test('P0: the four outcomes are explicit and are backed by world effects',()=>{
 const success=play(config,'Беру письмо');assert.equal(status(success),'success');assert.ok(success.outcome.effects.some(e=>e.type==='item_location'));
 const cost=play(config,'Ломаю ларец');assert.equal(status(cost),'partial_success');
 const refused=play(config,'Открываю ларец');assert.equal(status(refused),'refused');assert.equal(item(refused.memory,'ларец').opened,false);
 const clarify=play(config,'Фиолетовый вторник');assert.equal(status(clarify),'clarification');assert.ok(clarify.analysis[0].expectedEffect);
});
test('P0: player assertions cannot spawn items, change world rules or move the world',()=>{
 const r=play(config,'У меня есть камертон','Запомни: магии нет','На самом деле мы на корабле');
 assert.equal(item(r.memory,'камертон'),undefined);assert.equal(r.memory.place,'лавка');assert.equal(r.memory.world.authorCanon.world,config.world);assert.equal(E.profile(r.memory.world.authorCanon).magic,true);
});
test('P0: author changes are explicit and do create new canon',()=>{
 const m=play(config,'Привет').memory;const changed={...config,canon:'Предметы: камертон\nПравила: магии нет'};
 const next=E.reframe(m,config,changed);assert.ok(item(next,'камертон'));assert.equal(next.world.authorCanon.canon,changed.canon);assert.equal(E.profile(changed).magic,false);
});
test('P0: restoring a save keeps NPC beliefs, cause of conflict, graph and scheduled work',()=>{
 const r=play(config,'Лгу: виновник = Борис','Ты идиот');const restored=E.restore(config,JSON.parse(JSON.stringify(r.memory)));
 assert.deepEqual(restored.world,r.memory.world);assert.equal(person(restored).beliefs['виновник'].value,'Борис');assert.ok(person(restored).grievances.length);assert.ok(E.map(restored).edges.length);
});

test('P0: refusal and clarification do not consume tools or advance a magical effect',()=>{
 const before=play(config,'Беру письмо').memory;
 for(const text of ['Превращаю письмо','Использую письмо']) {
  const r=E.reply(config,before,text);assert.equal(status(r),'clarification');assert.deepEqual(r.memory.entities,before.entities);assert.deepEqual(r.memory.inventory,before.inventory);assert.deepEqual(r.memory.clocks,before.clocks);
 }
});
test('P0: world consequences become knowledge only for actual witnesses',()=>{
 const r=play(config,'Беру письмо');const e=item(r.memory,'письмо'),main=person(r.memory),distant=person(r.memory,'Ника');
 assert.equal(main.beliefs['entity:'+e.id+':location'].value,'inventory');assert.equal(distant.beliefs['entity:'+e.id+':location'],undefined);
});
test('B: deferred task with failed prerequisites stays pending for a later repair',()=>{
 const c={...config,character:'Мира — осторожный путешественник'};
 const r=play(c,'Прошу Миру вынести ларец наружу, спрятать его и открыть позже','Да','Выхожу','Открываю ларец');
 assert.equal(status(r),'refused');assert.equal(r.memory.world.deferred[0].status,'pending');assert.equal(item(r.memory,'ларец').opened,false);
});
test('B: fixed doors cannot be carried as containers',()=>{
 const c={...config,canon:'Предметы: дверь'};const r=play(c,'Прошу Миру вынести дверь наружу');assert.equal(status(r),'refused');assert.equal(item(r.memory,'дверь').location,'лавка');
});
test('C: another NPC cannot consume a pending offer meant for the first one',()=>{
 const c={...config,canon:'Персонаж: Лада | лавка | вернуть книгу | книга'};
 const r=play(c,'Привет','Помоги открыть ларец','Говорю с Ладой','Да');assert.equal(item(r.memory,'ларец').opened,false);assert.equal(person(r.memory,'Лада').pending,null);assert.equal(person(r.memory).pending.kind,'npc-help');
});
test('D: a delivery contract uses real locations and a real parcel',()=>{
 const r=play(config,'Выхожу','Иду в город','Иду на рынок','Ищу работу','Да','Иду в город','Иду на площадь','Доставляю посылку','Иду в город','Иду на рынок','Забираю плату');
 assert.equal(status(r),'success');assert.equal(r.memory.world.player.money,3);const parcel=r.memory.entities.find(e=>e.id===r.memory.world.loops.work.parcelId);assert.equal(parcel.location,person(r.memory,'Лея').id);
});
test('D: a completed paid job can be followed by a new independent contract',()=>{
 const r=play(config,'Выхожу','Иду в город','Иду в мастерскую','Ищу работу','Да','Работаю','Работаю','Забираю плату','Ищу работу','Да');assert.equal(r.memory.world.loops.work.status,'accepted');assert.equal(r.memory.world.loops.work.serial,2);assert.equal(r.memory.world.player.money,3);
});
test('E: keeping the key teeth while crafting preserves the specific access affordance',()=>{
 const c={...config,player:'Путник с цепочкой',canon:'Вещи персонажа: книга'};
 const r=play(c,'Осматриваюсь','Беру ключ','Делаю украшение из ключа на цепочке, сохраняя зубцы','Открываю ларец');assert.equal(item(r.memory,'ларец').opened,true);assert.ok(item(r.memory,'украшение').unlocks.length);
});
test('migration: a v3 save gets independent NPCs and a graph without losing carried items',()=>{
 const old={version:3,turn:8,trust:2,tension:0,stage:1,configSig:JSON.stringify(['Магическая лавка.',config.character,config.player,config.canon]),place:'лавка',inventory:['компас'],entities:[{id:'compass',label:'компас',location:'inventory',kind:'tool',destroyed:false}],facts:{name:'Алекс'},seen:{greet:1},used:{},notes:[],journal:[],threads:[]};
 const r=E.restore(config,old);assert.equal(r.version,4);assert.equal(person(r).trust,2);assert.equal(person(r).seen.greet,1);assert.equal(person(r,'Ника').seen.greet,undefined);assert.ok(r.inventory.includes('компас'));assert.ok(E.map(r).exits.length);
});
test('migration: an incomplete v4 world can be normalized without freezing the game',()=>{
 const r=E.restore(config,{...E.fresh(),world:{schema:4,npcs:null}});assert.ok(E.reply(config,r,'Привет').text.includes('Мира'));
});

test('P0: another NPC does not inherit a private introduction or player goal',()=>{
 const r=play(config,'Меня зовут Алекс','Хочу найти брата','Выхожу','Иду в город','Иду на рынок','Привет');
 assert.doesNotMatch(r.text,/Алекс|брата/);assert.equal(person(r.memory,'Ника').memory.playerName,undefined);assert.equal(person(r.memory).memory.playerName,'Алекс');
});
test('E: physical completion and the intended social effect are evaluated separately',()=>{
 const r=play(config,'Ты идиот','Беру письмо','Дарю письмо чтобы заслужить доверие');assert.equal(r.results[0].status,'success');assert.equal(r.outcome.status,'partial_success');assert.equal(r.outcome.goalAssessment.status,'pending');assert.ok(person(r.memory).grievances.some(g=>!g.resolved));
});

test('A: a naturally phrased lie and planted clue use the same proposition as canon',()=>{
 const c={...config,canon:'Истина: монету украл Антон'};
 const r=play(c,'Лгу: монету украл Борис','Беру письмо','Незаметно подбрасываю письмо: монету украл Борис','Кто украл монету?');assert.equal(r.memory.world.facts['виновник'].value,'Антон');assert.equal(person(r.memory).beliefs['виновник'].value,'Борис');assert.match(r.text,/Я считаю.*Борис/s);
});
test('B: addressing the NPC by name does not accidentally execute the request as the player',()=>{
 const r=play(config,'Мира, вынеси ларец наружу, спрячь его и открой позже');assert.equal(r.memory.world.plans[0].actor,person(r.memory).id);assert.equal(item(r.memory,'ларец').location,'лавка');assert.equal(item(r.memory,'ларец').opened,false);assert.equal(r.memory.world.deferred.length,0);
 const moved=E.reply(config,r.memory,'Да');assert.equal(item(moved.memory,'ларец').location,'улица');assert.equal(item(moved.memory,'ларец').opened,false);
});

test('P0: magical movement cannot desynchronize the player from the location graph',()=>{
 const r=play(config,'Телепортируюсь на Марс');assert.equal(status(r),'clarification');assert.equal(r.memory.place,'лавка');assert.equal(r.memory.world.locations.find(l=>l.id===r.memory.world.player.location).name,r.memory.place);
});
