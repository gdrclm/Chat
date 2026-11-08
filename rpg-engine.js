/* Compose domain systems without replacing the existing parser, world or NPC contact model. */
(function(root){'use strict';
  function create(H){
    const C=root.RpgCore.create(H),api={};C.api=api;
    api.physics=root.RpgPhysics.create(C);api.investigation=root.RpgInvestigation.create(C);api.equipment=root.RpgCrafting.create(C);
    api.goals=root.RpgGoals.create(C);api.life=root.RpgLife.create(C);api.agency=root.RpgAgency.create(C);api.economy=root.RpgEconomy.create(C);api.society=root.RpgSociety.create(C);api.genre=root.RpgGenre.create(C);
    function init(s,config){C.init(s,config);for(const module of Object.values(api))module.init?.(s,config);}
    function prepare(s,c,a){
      const parsed=c.semantic?.rpg||root.StoryActionResolver.resolve(c.originalText||c.text,{memory:s});if(!parsed)return;
      if(['report','speech'].includes(c.semantic?.mode)&&c.semantic?.intent!=='RPG')return;
      a.rpg={...parsed,mode:c.semantic?.mode||'execute'};a.intent='rpg_'+parsed.op;a.intention=parsed.op;
      const target=C.match(s,parsed.targetQuery||parsed.targetFallback||parsed.text,{hidden:false});if(target)a.targetId=target.id;
      if(parsed.secondary){const other=C.match(s,parsed.secondary,{filter:e=>e.id!==target?.id});if(other)a.rpg.secondaryId=other.id;const place=C.findPlace(s,parsed.secondary);if(place)a.rpg.destinationId=place.id;}
      const n=C.H.findNpc(s,parsed.text);if(n){a.rpg.npcId=n.id;a.recipientId=n.id;}
      if(c.semantic?.actor&&c.semantic.actor!=='player'){const actor=C.H.findNpc(s,c.semantic.actor);a.rpg.actorId=actor?.id||null;a.rpg.requestedActor=c.semantic.actor;if(actor){a.rpg.npcId=actor.id;a.recipientId=actor.id;}}
      a.rpg.targetId=target?.id||null;a.targetLabel=target?.label||null;c.rpg=a.rpg;
    }
    function mode(s,c,a){
      if(!a.rpg)return null;const m=a.rpg.mode;
      if(c.semantic?.condition&&['execute','attempt','request'].includes(m)){const condition=c.semantic.condition,n=C.H.findNpc(s,condition.name),matches=n&&(condition.attention==='asleep'?n.social.attention==='asleep'||n.agency.activity==='sleeping':n.social.attention==='busy'||n.busyUntilTurn>=s.turn);if(!matches)return C.result('Указанное условие сейчас не выполнено. Действие не начато.','condition_unmet',{status:'refused',performed:false,completed:false});}
      if(['negated','hypothetical','intention','report','speech'].includes(m))return C.result(m==='negated'?'Вы отказываетесь выполнять это действие.':'Замысел сохранён, но физическое действие не выполнено.','rpg_'+m,{performed:false});
      if(m==='question'&&!a.rpg.informational)return C.result('Это вопрос о возможности действия. Для выполнения нужна отдельная команда и доступные предметы.','rpg_capability_question',{performed:false});
      return null;
    }
    function handle(s,c,a){
      if(!a.rpg)return null;const request={...a.rpg,text:a.text,targetId:a.targetId};
      const backup=C.H.clone({entities:s.entities,inventory:s.inventory,world:s.world,clocks:s.clocks,stage:s.stage,facts:s.facts,trust:s.trust,tension:s.tension,focus:s.focus,place:s.place,previousPlace:s.previousPlace,npcPresent:s.npcPresent,pending:s.pending});
      try{
        if(request.requestedActor&&request.system!=='agency'){
          const n=s.world.npcs[request.actorId];C.agree(s,n);const type=request.system==='equipment'&&request.op.startsWith('craft')?'craft':request.system==='equipment'&&request.op==='repair'?'repair':null;
          C.require(type,'unsupported_actor_task','Для этого поручения пока нет самостоятельного способа исполнения NPC. Герой не выполняет его вместо персонажа.','clarification');
          const task=api.agency.queue(s,n,type,{product:request.product,itemId:request.targetId,destinationId:n.location,recipientId:'player'});return C.result('Персонаж принял поручение в очередь. Ему потребуются собственные материалы и инструменты.','requested_task_queued',{taskId:task.id,time:2});
        }
        const module=api[request.system];C.require(module,'unknown_system','Система этого действия недоступна.','clarification');const answer=module.handle(s,request);C.require(answer,'unknown_rpg_operation','Этот способ ещё не имеет исполнимого правила.','clarification');
        C.syncInventory(s);answer.rpg={system:request.system,operation:request.op};answer.time??=request.informational?1:5;return answer;
      }catch(error){if(!error.rpgRejection)throw error;Object.assign(s,backup);C.H.bind(s,s.world.boundNpcId);return {status:error.status,code:error.code,text:error.text,performed:false,completed:false,effects:[],rpg:{system:request.system,operation:request.op}};}
    }
    function guard(s,c,a){
      if(a.rpg||c.negated||c.hypothetical)return null;
      const reject=(code,text)=>C.result(text,code,{status:'refused',performed:false,completed:false}),e=C.item(s,a.targetId),p=C.props(e);
      if(a.intent==='take'&&(p.anchored||p.tiedTo))return reject('item_physically_secured','Предмет закреплён или привязан. Сначала освободите крепление.');
      if(a.intent==='close'&&(p.heldBy||p.wedgedBy&&!C.item(s,p.wedgedBy)?.destroyed))return reject('door_held_open','Дверь удерживается или подперта. Сначала уберите упор или освободите руку.');
      if(['move','return'].includes(a.intent)){const to=s.world.locations.find(l=>l.id===a.destinationId)||C.findPlace(s,c.semantic?.destination||c.text),link=to&&s.world.edges.find(v=>v.from===s.world.player.location&&v.to===to.id);if(link?.rpg?.blocked||C.props(C.item(s,link?.barrierId)).blocked||link?.rpg?.private&&s.world.locations.find(l=>l.id===link.to)?.ownerId!=='player'||link?.rpg?.minimumRank&&!s.world.rpg.memberships.player?.some(m=>m.status!=='expelled'&&m.rank>=link.rpg.minimumRank&&(!link.rpg.factionId||m.factionId===link.rpg.factionId)))return reject('access_condition_failed','Переход перекрыт или требует действующего статуса.');if(s.world.player.body.injuries.legs&&/бег|быстр/.test(c.lower))return reject('leg_injury','Травма ног мешает быстрому переходу.');}
      if(['buy','bargain','find_job'].includes(a.intent)&&C.H.npc(s)?.agency.shopClosed)return reject('shop_closed','Сейчас заведение закрыто по расписанию.');
      if(a.intent==='magic'&&s.world.rpg.enabled.magic&&s.world.player.body.mana<2)return reject('mana_exhausted','Не хватает магической энергии. Её можно восстановить отдыхом.');
      return null;
    }
    function beforeSocial(s,before,c,a,r){
      if(r.performed===false)return;
      if(a.rpg?.op==='pickpocket'){const n=C.person(s,a.rpg,{explicit:true});if(n&&s.world.player.permissions?.[n.id]?.search)a.authorizedItemIds=s.entities.filter(e=>e.location==='inventory'&&before.entities.some(old=>old.id===e.id&&old.location===n.id)).map(e=>e.id);}
      if(a.intent==='buy'&&r.status==='success')for(const e of s.entities){const old=before.entities.find(v=>v.id===e.id);if(old&&s.world.npcs[old.location]&&e.location==='inventory'){e.ownerId='player';const n=s.world.npcs[old.location];n.finance.money+=Math.max(0,before.player.money-s.world.player.money);}}
    }
    function after(s,before,c,a,r){
      for(const e of s.entities)C.annotate(s,e);
      if(a.intent==='magic'&&r.performed!==false&&r.status==='success')s.world.player.body.mana=Math.max(0,s.world.player.body.mana-2);
      C.syncInventory(s);
      if(r.performed!==false&&!r.skipped&&r.status!=='clarification'&&r.status!=='refused')s.world.rpg.clock.minute+=r.time??(a.conversation?1:a.intent==='wait'?10:2);
      if(before.player.location!==s.world.player.location){const b=s.world.player.body;b.posture='standing';b.elevation=0;b.position={x:0,y:0,z:0};delete b.coverId;delete b.supportId;C.event(s,'access',{actorId:'player',locationId:s.world.player.location,public:true});}
      for(const record of s.currentMessages||[])if(record.speaker.type==='npc')C.event(s,'utterance',{npcId:record.speaker.id,locationId:s.world.npcs[record.speaker.id]?.location,text:record.text});
      for(const e of s.entities){const old=before.entities.find(v=>v.id===e.id);if(old&&old.location!==e.location&&!s.world.player.equipment.worn.map(id=>C.item(s,id)?.label||'').some(label=>/перчат/.test(C.norm(label)))){P(e).fingerprints||=[];if(!P(e).fingerprints.includes(a.actor||'player'))P(e).fingerprints.push(a.actor||'player');}}
      for(const e of s.entities){const old=before.entities.find(v=>v.id===e.id);if(old&&old.location!==e.location&&!e.history.some(row=>row.cause===s.currentActionId))e.history.push({turn:s.turn,time:s.world.rpg.clock.minute,from:old.location,to:e.location,ownerId:e.ownerId||null,cause:s.currentActionId});}
      for(const module of Object.values(api))module.after?.(s,a,r,before);
      function P(e){return C.props(e);}
    }
    function tick(s){
      const clock=s.world.rpg.clock,elapsed=Math.max(0,clock.minute-clock.lastTick);clock.lastTick=clock.minute;clock.day=Math.floor(clock.minute/1440);
      for(const name of ['physics','life','agency','economy','society','genre','investigation','equipment','goals'])api[name].tick?.(s,elapsed);C.syncInventory(s);
    }
    function visible(s,n,a){return api.physics.visible(s,n,a);}
    function suggestions(s){
      if(!s.world?.rpg)return ['Осматриваюсь'];
      const commands=['Осматриваюсь','Проверяю время'],local=C.accessibleItems(s).filter(e=>e.location===s.place),carried=s.entities.filter(e=>e.location==='inventory'&&!e.destroyed),n=Object.values(s.world.npcs).find(n=>C.H.dialogue.here(s,n));
      for(const e of local){const p=C.props(e);if((p.functions||[]).includes('seat')||/стул|табурет|скам/.test(C.norm(e.label)))commands.push('Сажусь на '+e.label);if(p.durability<p.maxDurability)commands.push('Оцениваю повреждение '+e.label,'Диагностирую '+e.label);if(p.portal&&/окно/.test(C.norm(e.label)))commands.push('Смотрю через окно '+e.label);}
      if(n){commands.push('Как вас зовут?','Чем вы занимаетесь?');if(api.economy.needs(s,n).length)commands.push('Устраиваюсь на работу у '+n.name);if(n.trust>=1)commands.push('Приглашаю в спутники '+n.name);if(n.agency.problem)commands.push('Предлагаю помочь с личной проблемой '+n.name);}
      for(const recipe of [...s.world.rpg.recipes,...api.equipment.recipes]){const used={};let possible=true;for(const part of recipe.ingredients){const [name,count]=String(part).split('*'),item=carried.find(e=>C.same(e.label,name));if(!item){possible=false;break;}used[item.id]=(used[item.id]||0)+Number(count||1);if(used[item.id]>C.qty(item))possible=false;}if(possible&&(recipe.tools||[]).every(name=>api.equipment.tool(s,name)))commands.push('Мастерю '+recipe.name);}
      const book=carried.find(e=>C.props(e).spells?.length);if(book)for(const name of C.props(book).spells){const p=api.genre.spell(s,name);if(p&&!s.world.player.spells.includes(p.id))commands.push('Изучаю заклинание из книги '+p.name);}
      if(s.world.rpg.goals.some(g=>g.status==='active'))commands.push('Проверяю прогресс цели');if(s.world.rpg.tasks.length)commands.push('Проверяю поручения');
      return [...new Set(commands)].slice(0,14);
    }
    function effects(s,before,a){
      if(!before.rpg)return;
      if(JSON.stringify(before.player.body)!==JSON.stringify(s.world.player.body))H.emit(s,'player_body_changed','player',before.player.body,s.world.player.body,a.id);
      if(JSON.stringify(before.player.equipment)!==JSON.stringify(s.world.player.equipment))H.emit(s,'equipment_changed','player',before.player.equipment,s.world.player.equipment,a.id);const types=['goals','tasks','contracts','cases','arcs','businesses','factions'];
      for(const type of types)if(JSON.stringify(before.rpg[type])!==JSON.stringify(s.world.rpg[type]))H.emit(s,'rpg_'+type+'_changed',type,before.rpg[type],s.world.rpg[type],a.id);
      if(before.rpg.clock.minute!==s.world.rpg.clock.minute)H.emit(s,'rpg_time','clock',before.rpg.clock.minute,s.world.rpg.clock.minute,a.id);
      for(const e of s.entities){const old=before.entities.find(v=>v.id===e.id);if(old&&JSON.stringify(old.physical)!==JSON.stringify(e.physical))H.emit(s,'physical_properties_changed',e.id,old.physical,e.physical,a.id);}
      for(const e of s.entities){const old=before.entities.find(v=>v.id===e.id);if(!old)continue;for(const key of ['quantity','ownerId'])if(old[key]!==e[key]){H.emit(s,'item_'+key,e.id,old[key],e[key],a.id);H.truth(s,'entity:'+e.id+':'+key,e[key],'event',a.id);}}
    }
    return {C,api,init,prepare,mode,handle,guard,beforeSocial,after,tick,visible,effects,suggestions,identify:api.life.identify};
  }
  root.StoryRpg={create};
})(globalThis);
