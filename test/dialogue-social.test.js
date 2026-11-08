import test from 'node:test';
import assert from 'node:assert/strict';
for(const f of ['spatial','narrator','messages','dialogue','developer','social','conversation-topics','npc-personality','conversation-memory','npc-biography','conversation-engine','action-catalog','rpg-core','physical-system','investigation-system','equipment-crafting','action-resolver','goals-story','npc-agency','economy-system','society-system','life-combat','genre-system','extended-actions','rpg-engine','semantic','scenes','simulation','engine'])await import('../'+f+'.js');
const E=globalThis.StoryEngine;
const base={world:'Магическая лавка.',character:'Мира — хозяйка лавки.',player:'Путник',canon:''};
const play=(commands,c=base,m=E.fresh())=>commands.reduce((r,t)=>E.reply(c,r.memory,t),{memory:m});
const npc=(m,name='Мира')=>Object.values(m.world.npcs).find(n=>n.name===name);
const owned=(m)=>m.entities.find(e=>e.localKey==='hammer');
const workshop=(c=base)=>play(['Выхожу на улицу','Иду в город','Иду в мастерскую'],c).memory;
const voices=r=>r.messages.filter(m=>m.speaker.type==='npc');
const event=(r,type='theft')=>r.memory.world.social.events.find(e=>e.type===type);
for(const command of ['Осматриваюсь','Оглядываюсь','Подхожу к Мире','Жду','Осматриваю ларец','Можно открыть ларец?','Хочу открыть ларец','Не открываю ларец','Улыбаюсь','Танцую'])test('presence does not open dialogue: '+command,()=>{
 const r=play([command]);assert.equal(r.memory.world.activeNpcId,null);assert.equal(voices(r).length,0);assert.equal(npc(r.memory).trust,0);
});
for(const command of ['Привет','Здравствуй, Мира','Кто ты?','Спрашиваю Миру о её цели','Говорю с Мирой'])test('direct contact opens dialogue: '+command,()=>{
 const r=play([command]);assert.equal(r.memory.world.activeNpcId,npc(r.memory).id);assert.equal(npc(r.memory).dialogueState.status,'active');
});
test('notice, contact, suspension and return survive saves',()=>{
 let r=play(['Осматриваюсь']);assert.equal(npc(r.memory).dialogueState.status,'noticed');
 r=E.reply(base,r.memory,'Привет');const greeted=npc(r.memory);assert.equal(greeted.dialogueState.status,'active');
 r=E.reply(base,r.memory,'Отхожу от прилавка');assert.equal(r.memory.place,'лавка');assert.equal(r.memory.world.activeNpcId,null);
 r=E.reply(base,r.memory,'Жду');assert.equal(voices(r).length,0);
 r=E.reply(base,r.memory,'Выхожу на улицу');r=E.reply(base,r.memory,'Возвращаюсь');assert.equal(r.memory.world.activeNpcId,null);assert.equal(voices(r).length,0);
 const saved=E.restore(base,JSON.parse(JSON.stringify(r.memory)));assert.equal(saved.world.activeNpcId,null);assert.ok(npc(saved).dialogueState.contactTurn);
 r=E.reply(base,saved,'Привет');assert.equal(r.memory.world.activeNpcId,greeted.id);assert.ok(npc(r.memory).seen.greet>=2);
});
test('old presence pointer migrates without inventing contact',()=>{
 const m=E.restore(base,E.fresh());delete m.world.dialogueVersion;delete npc(m).dialogueState;m.world.activeNpcId=npc(m).id;
 const saved=E.restore(base,m);assert.equal(saved.world.activeNpcId,null);assert.equal(npc(saved).dialogueState.status,'undiscovered');
});
test('save in active conversation restores active contact',()=>{
 const m=play(['Привет']).memory;const saved=E.restore(base,JSON.parse(JSON.stringify(m)));assert.equal(saved.world.activeNpcId,npc(saved).id);assert.equal(npc(saved).dialogueState.status,'active');
});
test('insult closes conversation and retains its reason',()=>{
 const r=play(['Привет','Оскорбляю Миру']);assert.equal(r.memory.world.activeNpcId,null);assert.ok(npc(r.memory).grievances.some(g=>g.kind==='insult'));assert.ok(npc(r.memory).social.relationship.hostility>0);
});
test('leaving prevents a distant NPC from speaking',()=>{
 const r=play(['Привет','Выхожу на улицу','Жду']);assert.equal(voices(r).length,0);assert.equal(npc(r.memory).dialogueState.status,'ended');
});
test('observing public workshop is silent; personal boundary is a justified initiative',()=>{
 const m=workshop();let r=E.reply(base,m,'Осматриваю верстак');assert.equal(voices(r).length,0);
 r=E.reply(base,m,'Осматриваю личный ящик');assert.ok(voices(r).some(v=>v.trigger==='private_boundary'));assert.equal(r.memory.world.activeNpcId,null);
});
test('technical voice has no physical authority or NPC memory',()=>{
 const m=play(['Привет']).memory,n=npc(m),heard=structuredClone(n.memory),items=structuredClone(m.entities),beliefs=structuredClone(n.beliefs);
 const r=E.reply(base,m,'Квантовать ларец');assert.equal(r.outcome.status,'clarification');assert.equal(voices(r).length,0);assert.ok(r.messages.some(v=>v.speaker.type==='developer'));
 assert.deepEqual(npc(r.memory).memory,heard);assert.deepEqual(npc(r.memory).beliefs,beliefs);assert.deepEqual(r.memory.entities,items);assert.equal(r.memory.world.developer.fired.length,0);
 assert.ok(!JSON.stringify(r).includes('\\ue000'));
});
test('developer has a cooldown and returns as a separate speaker',()=>{
 let r=play(['Квантовать ларец']);assert.equal(r.messages.filter(v=>v.speaker.type==='developer').length,1);
 r=E.reply(base,r.memory,'Квантовать ларец');assert.equal(r.messages.filter(v=>v.speaker.type==='developer').length,0);
 r=play(['Жду','Квантовать ларец'],base,r.memory);assert.equal(r.messages.filter(v=>v.speaker.type==='developer').length,1);
});
test('registered developer event creates an actual once-only passage',()=>{
 const c={...base,canon:'Мета-событие: проход | лавка | потайная дверь | архив | 2'};
 let r=play(['Жду'],c);assert.equal(r.memory.world.developer.fired.length,0);r=E.reply(c,r.memory,'Жду');
 assert.ok(r.messages.some(v=>v.speaker.type==='developer'&&v.trigger==='registered_meta_event'));assert.equal(r.memory.world.developer.fired.length,1);
 const door=r.memory.entities.find(e=>e.label==='потайная дверь');assert.ok(door);assert.ok(r.outcome.effects.some(e=>e.type==='registered_developer_event'));
 r=E.reply(c,r.memory,'Открываю потайную дверь и иду в архив');assert.equal(r.memory.place,'архив');assert.equal(r.memory.world.developer.fired.length,1);
});
test('unwitnessed theft changes ownership location but no NPC belief or trust',()=>{
 const m=workshop(),n=npc(m,'Илья'),before=n.trust;const r=E.reply(base,m,'Незаметно беру молоток мастера');
 assert.equal(owned(r.memory).location,'inventory');assert.equal(owned(r.memory).ownerId,n.id);assert.deepEqual(event(r).witnesses,[]);assert.equal(npc(r.memory,'Илья').trust,before);assert.equal(voices(r).length,0);
 assert.equal(npc(r.memory,'Илья').beliefs['entity:'+owned(m).id+':location']?.value,undefined);
});
test('exact conditional theft reads real attention instead of declaring it',()=>{
 const m=workshop();let r=E.reply(base,m,'Пока Илья работает, я незаметно забираю его молоток');assert.equal(owned(r.memory).location,'inventory');assert.deepEqual(event(r).witnesses,[]);
 npc(m,'Илья').social.attention='watching';r=E.reply(base,m,'Пока Илья работает, я незаметно забираю его молоток');assert.equal(r.results[0].code,'condition_unmet');assert.notEqual(owned(r.memory).location,'inventory');
});
test('attentive owner sees loose-property theft and initiates without a dialogue',()=>{
 const m=workshop();npc(m,'Илья').social.attention='watching';const r=E.reply(base,m,'Незаметно беру молоток мастера');const n=npc(r.memory,'Илья');
 assert.equal(owned(r.memory).location,'inventory');assert.ok(event(r).witnesses.includes(n.id));assert.ok(n.trust<0);assert.ok(n.social.relationship.suspicion>0);assert.ok(voices(r).some(v=>v.speaker.id===n.id&&v.trigger==='witness_event'));assert.equal(r.memory.world.activeNpcId,null);
});
test('attempt to steal from attentive hands fails with social consequences',()=>{
 const m=workshop(),n=npc(m,'Илья');n.social.attention='watching';owned(m).location=n.id;
 const r=E.reply(base,m,'Беру молоток мастера');assert.equal(r.results[0].code,'theft_blocked');assert.equal(owned(r.memory).location,n.id);assert.ok(event(r,'theft_attempt'));assert.ok(npc(r.memory,'Илья').trust<0);
});
test('discovery of missing property is delayed and does not identify the thief',()=>{
 let r=play(['Незаметно беру молоток мастера','Жду','Жду'],base,workshop());const n=npc(r.memory,'Илья'),e=event(r);
 assert.equal(n.social.knowledge[e.id].source,'missing');assert.equal(n.social.knowledge[e.id].actorId,null);assert.equal(n.trust,0);assert.ok(n.social.relationship.suspicion>0);assert.ok(voices(r).some(v=>/не знаю/.test(v.text)));
});
test('third party knows theft before the owner; hearsay requires actual encounter',()=>{
 const m=workshop(),owner=npc(m,'Илья'),witness=npc(m,'Ника');witness.location=m.world.player.location;
 let r=E.reply(base,m,'Незаметно беру молоток мастера');const e=event(r);assert.deepEqual(e.witnesses,[witness.id]);assert.equal(npc(r.memory,'Илья').social.knowledge[e.id],undefined);assert.equal(npc(r.memory,'Ника').social.knowledge[e.id].source,'witness');
 npc(r.memory,'Ника').location=r.memory.world.outdoorId;r=play(['Жду','Жду'],base,r.memory);assert.equal(npc(r.memory,'Илья').social.knowledge[e.id].actorId,null);
 npc(r.memory,'Ника').location=r.memory.world.player.location;r=E.reply(base,r.memory,'Жду');const k=npc(r.memory,'Илья').social.knowledge[e.id];assert.equal(k.source,'report');assert.equal(k.reporterId,witness.id);assert.equal(k.confidence,.75);assert.equal(r.memory.world.social.reports.length,1);
 r=E.reply(base,r.memory,'Жду');assert.equal(r.memory.world.social.reports.length,1);
});
test('different loyalties and moralities produce different assessments',()=>{
 const m=workshop(),owner=npc(m,'Илья'),witness=npc(m,'Ника');witness.location=m.world.player.location;witness.social.profile={...witness.social.profile,lawfulness:.1,propertyRespect:.1,loyalties:{[owner.id]:-1}};
 const r=E.reply(base,m,'Незаметно беру молоток мастера');assert.ok(npc(r.memory,'Ника').social.relationship.respect>0);assert.equal(npc(r.memory,'Илья').trust,0);assert.ok(voices(r).some(v=>/Ловко/.test(v.text)));
});
test('loan keeps ownership and permits use without theft',()=>{
 let r=play(['Одолжи молоток'],base,workshop());assert.equal(r.results[0].code,'loan_granted');assert.equal(owned(r.memory).location,'inventory');assert.ok(owned(r.memory).loan);assert.equal(event(r),undefined);
 r=E.reply(base,r.memory,'Возвращаю молоток');assert.equal(r.results[0].code,'property_returned');assert.ok(owned(r.memory).loan.returned);assert.equal(owned(r.memory).location,npc(r.memory,'Илья').id);
});
test('rental charges real money and tracks a separate owner and expiry',()=>{
 const m=workshop();m.world.player.money=2;let r=E.reply(base,m,'Арендую молоток');assert.equal(r.results[0].code,'rental_granted');assert.equal(r.memory.world.player.money,1);assert.equal(owned(r.memory).loan.rental,true);
 r=play(Array(6).fill('Жду'),base,r.memory);assert.ok(owned(r.memory).loan.overdue);assert.ok(event(r,'broken_promise'));assert.ok(npc(r.memory,'Илья').social.relationship.reliability<0);
});
test('apology alone cannot erase theft; restitution retains history and caution',()=>{
 const m=workshop();npc(m,'Илья').social.attention='watching';const prior=npc(m,'Илья').trust;
 let r=play(['Беру молоток мастера','Извини'],base,m);const g=npc(r.memory,'Илья').grievances.find(g=>g.kind==='theft');assert.equal(g.resolved,false);assert.equal(owned(r.memory).location,'inventory');
 r=play(['Возвращаю молоток','Извини'],base,r.memory);const n=npc(r.memory,'Илья');assert.ok(n.grievances.find(g=>g.kind==='theft').resolved);assert.ok(n.trust<prior);assert.ok(n.social.cautious);assert.ok(event(r).propertyReturned);
});
test('confession changes only the listener knowledge and does not repay theft',()=>{
 let r=play(['Незаметно беру молоток мастера','Признаюсь в краже'],base,workshop());const e=event(r),n=npc(r.memory,'Илья');assert.equal(n.social.knowledge[e.id].source,'confession');assert.equal(n.social.knowledge[e.id].actorId,'player');assert.equal(owned(r.memory).location,'inventory');assert.ok(!n.grievances.find(g=>g.kind==='theft').resolved);
});
test('damage is physical, linked to compensation and refusal of future work',()=>{
 const m=workshop();let r=E.reply(base,m,'Ломаю молоток мастера');assert.ok(owned(r.memory).destroyed);assert.ok(event(r,'damage'));
 r=E.reply(base,r.memory,'Ищу работу');assert.equal(r.outcome.status,'refused');
 r=E.reply(base,r.memory,'Компенсирую ущерб');assert.equal(r.results[0].code,'insufficient_compensation');r.memory.world.player.money=5;
 r=E.reply(base,r.memory,'Компенсирую ущерб');assert.equal(r.memory.world.player.money,2);assert.equal(npc(r.memory,'Илья').grievances.find(g=>g.kind==='damage').reparation,true);
});
for(const command of ['Не беру молоток','Хочу взять молоток','Можно взять молоток?','Не возвращаю молоток'])test('nonactions have no social event: '+command,()=>{
 const r=E.reply(base,workshop(),command);assert.equal(r.memory.world.social.events.length,0);assert.notEqual(owned(r.memory).location,'inventory');
});
test('assault alters health, hostility and fear and remains in history',()=>{
 const m=workshop();let r=E.reply(base,m,'Бью Илью');const n=npc(r.memory,'Илья');assert.equal(n.health,2);assert.ok(n.social.relationship.hostility>0);assert.ok(n.social.relationship.fear>0);assert.ok(event(r,'assault'));assert.ok(r.outcome.effects.some(e=>e.type==='npc_health'));
});
test('timid NPC flees through a real route after assault',()=>{
 const m=workshop();npc(m,'Илья').social.profile.courage=.1;const from=npc(m,'Илья').location,r=E.reply(base,m,'Бью Илью');assert.notEqual(npc(r.memory,'Илья').location,from);assert.ok(r.memory.world.edges.some(e=>e.from===from&&e.to===npc(r.memory,'Илья').location));assert.equal(r.memory.world.activeNpcId,null);
});
test('broken promise is known to recipient and never to unrelated bystanders',()=>{
 let r=play(['Одолжи молоток','Обещаю вернуть молоток через 1 ход','Жду','Жду'],base,workshop());const e=event(r,'broken_promise');assert.ok(e);assert.equal(npc(r.memory,'Илья').social.knowledge[e.id].actorId,'player');assert.equal(npc(r.memory,'Ника').social.knowledge[e.id],undefined);
});
test('known contradictory assertion exposes deception without consulting omniscient canon',()=>{
 const c={...base,canon:'Истина: виновник = Антон\nЗнает Мира: виновник = Антон'};let r=play(['Сообщаю: виновник = Борис'],c);assert.ok(event(r,'deception'));assert.equal(npc(r.memory).beliefs['виновник'].value,'Антон');
 r=play(['Сообщаю: виновник = Борис'],{...c,canon:'Истина: виновник = Антон'});assert.equal(event(r,'deception'),undefined);assert.equal(npc(r.memory).beliefs['виновник'].value,'Борис');
});
test('laws require authored rule and a real informed guard',()=>{
 const c={...base,canon:'Страж: Илья\nЗакон: мастерская | кража | штраф=2'};const m=workshop(c);npc(m,'Илья').social.attention='watching';m.world.player.money=3;
 let r=E.reply(c,m,'Беру молоток мастера');assert.equal(r.memory.world.social.cases.length,1);r=E.reply(c,r.memory,'Плачу штраф');assert.equal(r.results[0].code,'fine_paid');assert.equal(r.memory.world.player.money,1);assert.equal(r.memory.world.social.cases[0].status,'paid');assert.ok(!event(r).resolved);
 const ordinary=E.reply(base,workshop(),'Беру молоток мастера');assert.equal(ordinary.memory.world.social.cases.length,0);
});
test('structured utterances retain speaker, cause and effects without opaque tokens',()=>{
 const m=workshop();npc(m,'Илья').social.attention='watching';const r=E.reply(base,m,'Беру молоток мастера');for(const row of r.messages){assert.ok(['narrator','npc','developer'].includes(row.speaker.type));assert.equal(typeof row.trigger,'string');assert.ok(Array.isArray(row.effects));assert.ok(!/[\uE000\uE001]/u.test(row.text));}
 const saved=E.restore(base,JSON.parse(JSON.stringify(r.memory)));assert.deepEqual(saved.world.social.events,r.memory.world.social.events);
});
test('a permission request starts contact and uses the NPC speaker',()=>{
 const r=E.reply(base,workshop(),'Прошу разрешения пользоваться инструментами');assert.equal(r.results[0].code,'permission_granted');assert.equal(r.memory.world.activeNpcId,npc(r.memory,'Илья').id);assert.ok(voices(r).some(v=>/Разрешаю/.test(v.text)));
});
test('return after apology reconciles without needing a second apology',()=>{
 const m=workshop();npc(m,'Илья').social.attention='watching';const r=play(['Беру молоток мастера','Извини','Возвращаю молоток'],base,m);assert.ok(npc(r.memory,'Илья').grievances.find(g=>g.kind==='theft').resolved);assert.ok(npc(r.memory,'Илья').trust<0);
});
test('valuable loans require supervision after restitution',()=>{
 const m=workshop();npc(m,'Илья').social.attention='watching';let r=play(['Беру молоток мастера','Возвращаю молоток','Извини','Одолжи молоток'],base,m);assert.equal(r.results[0].code,'supervision_required');
 r=E.reply(base,r.memory,'Одолжи молоток под присмотром');assert.equal(r.results[0].code,'loan_granted');
});
test('private morality taboo differs from a permissive attitude toward theft',()=>{
 const m=workshop(),owner=npc(m,'Илья'),w=npc(m,'Ника');w.location=m.world.player.location;w.social.profile={...w.social.profile,lawfulness:0,propertyRespect:0,loyalties:{[owner.id]:-1},taboos:['theft']};
 const r=E.reply(base,m,'Незаметно беру молоток мастера');assert.ok(npc(r.memory,'Ника').trust<0);assert.ok(npc(r.memory,'Ника').social.relationship.hostility>0);
});
test('a timid NPC can comply with a loan under fear without becoming trusting',()=>{
 const m=workshop();npc(m,'Илья').social.profile.courage=.1;const r=play(['Угрожаю Илье','Одолжи молоток'],base,m);assert.equal(r.results[0].code,'loan_granted');assert.ok(npc(r.memory,'Илья').social.relationship.fear>0);assert.ok(npc(r.memory,'Илья').trust<0);assert.equal(owned(r.memory).location,'inventory');
});
test('a hidden return is real but does not announce the thief',()=>{
 let r=play(['Незаметно беру молоток мастера','Незаметно возвращаю молоток','Жду','Жду'],base,workshop());const n=npc(r.memory,'Илья');assert.equal(owned(r.memory).location,'мастерская');assert.equal(n.trust,0);assert.equal(n.social.knowledge[event(r).id],undefined);assert.equal(r.memory.world.activeNpcId,null);
});
test('showing the missing property supplies evidence rather than remote omniscience',()=>{
 let r=play(['Незаметно беру молоток мастера','Жду','Жду','Показываю молоток мастера'],base,workshop());const n=npc(r.memory,'Илья'),k=n.social.knowledge[event(r).id];assert.equal(k.source,'property_identified');assert.equal(k.actorId,'player');assert.equal(k.confidence,.8);assert.ok(n.trust<0);
});
test('unwitnessed damage is discovered without knowing the culprit',()=>{
 const m=workshop();let r=play(['Незаметно ломаю молоток мастера','Жду','Жду'],base,m);const e=event(r,'damage'),n=npc(r.memory,'Илья');assert.ok(owned(r.memory).destroyed);assert.deepEqual(e.witnesses,[]);assert.equal(n.social.knowledge[e.id].source,'damage_discovered');assert.equal(n.social.knowledge[e.id].actorId,null);assert.equal(n.trust,0);assert.ok(voices(r).some(v=>/не знаю/.test(v.text)));
});
test('an incapacitated owner cannot see, speak, or prevent taking an item',()=>{
 const m=workshop(),n=npc(m,'Илья');n.status='incapacitated';n.health=0;owned(m).location=n.id;let r=E.reply(base,m,'Беру молоток мастера');assert.equal(owned(r.memory).location,'inventory');assert.equal(voices(r).length,0);assert.deepEqual(event(r).witnesses,[]);
});
test('registered closed zone causes a real trespass event after an actual transition',()=>{
 const c={...base,canon:'Закрытая зона: мастерская | Илья'};const r=play(['Выхожу на улицу','Иду в город','Иду в мастерскую'],c);assert.equal(r.memory.place,'мастерская');assert.ok(event(r,'trespass'));assert.ok(npc(r.memory,'Илья').trust<0);
});
test('speaker composition preserves independent NPC utterances with identical text',()=>{
 const rows=['Мира','Ника'].map((name,index)=>({status:'success',narration:[{kind:'speech',speaker:{type:'npc',id:'npc:'+index,name},text:'Остановитесь.',trigger:'witness_event',effects:[]}]}));const r=globalThis.StoryNarrator.compose({results:rows});assert.equal(r.blocks.length,2);assert.match(r.text,/Мира[\s\S]*Ника/);
});
test('genuine local evidence exposes a previous lie while hidden truth alone does not',()=>{
 const c={...base,player:'Путник с запиской',canon:'Истина: виновник = Антон\nДоказательство: записка | виновник = Антон'};let r=play(['Лгу: виновник = Борис','Показываю записку'],c);assert.ok(event(r,'deception'));assert.equal(npc(r.memory).beliefs['виновник'].value,'Антон');assert.equal(npc(r.memory).beliefs['виновник'].certainty,'known');
});

test('partial compensation reports and retains the remaining real debt',()=>{
 const m=workshop();m.world.player.money=5;let r=play(['Ломаю молоток мастера','Компенсирую ущерб на 1 монету'],base,m);
 assert.equal(r.results[0].code,'partial_compensation');assert.equal(r.outcome.status,'partial_success');assert.equal(r.memory.world.player.money,4);assert.equal(npc(r.memory,'Илья').grievances.find(g=>g.kind==='damage').compensation,2);assert.match(r.text,/Осталось возместить 2/);
});
