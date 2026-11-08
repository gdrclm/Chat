/* NPCs execute saved work queues through the same graph and finite inventories. */
(function(root){'use strict';
  function create(C){
    const {require:R,result:ok,props:P}=C;
    function say(s,n,text,trigger='npc_task'){return root.StoryMessages.say(s,{type:'npc',id:n.id,name:n.name},text,trigger);}
    function queue(s,n,type,data={}){
      const task={id:C.id(s,'task'),actorId:n.id,type,status:'pending',created:s.world.rpg.clock.minute,credit:0,history:[],...C.H.clone(data)};
      s.world.rpg.tasks.push(task);n.agency.tasks.push(task.id);C.event(s,'task_assigned',{taskId:task.id,actorId:n.id,type});return task;
    }
    function travel(s,n,to,task){
      if(n.location===to)return true;const path=C.route(s,n.location,to,n.id);
      if(!path){task.status='blocked';task.blockReason='route';return false;}
      const next=s.world.locations.find(l=>l.id===path[0]),from=n.location;
      const result=C.H.moveActor(s,n.id,next);if(result.status!=='success'){task.status='blocked';task.blockReason=result.code;return false;}
      task.history.push({type:'travel',from,to:next.id,time:s.world.rpg.clock.minute});C.event(s,'npc_travel',{npcId:n.id,from,to:next.id,taskId:task.id});return n.location===to;
    }
    function complete(s,n,t){
      t.status='completed';t.completed=s.world.rpg.clock.minute;n.agency.activity='idle';C.event(s,'task_completed',{taskId:t.id,npcId:n.id,type:t.type});
      if(t.reward){C.money(s,t.escrowAccount||'treasury',n.id,t.reward,'task_reward');t.paid=true;}
      const names={move:'прибыть к месту',escort:'проводить вас',guard:'охрана',watch:'наблюдение',search:'поиск вещи',search_person:'поиски человека',collect:'сбор вещей',craft:'изготовление '+t.product,repair:'ремонт '+C.item(s,t.itemId)?.label,message:'доставка сообщения',distract:'отвлечение',survey:'обследование',work:'работа с '+C.item(s,t.itemId)?.label};if(n.location===s.world.player.location)say(s,n,'Поручение «'+(t.label||names[t.type]||'совместное дело')+'» выполнено.');
      if(!n.conversation.relationshipCredits.includes(t.id)){n.conversation.relationshipCredits.push(t.id);C.H.social.change(s,n,{respect:1,reliability:1});}
    }
    function execute(s,n,t){
      if(['dead','incapacitated','detained'].includes(n.status)||n.agency.activity==='sleeping'){t.status='blocked';t.blockReason='actor_unavailable';return;}
      t.status='working';n.agency.activity=t.type;
      if(t.type==='move'||t.type==='escort'){if(travel(s,n,t.destinationId,t)){if(t.type==='escort'&&s.world.player.location!==t.destinationId){t.status='waiting';return;}complete(s,n,t);}return;}
      if(t.type==='guard'){if(travel(s,n,t.destinationId,t)){t.status='guarding';n.agency.guardingId=t.itemId;const e=C.item(s,t.itemId);if(!e||e.destroyed){t.status='failed';t.blockReason='object_lost';}}return;}
      if(t.type==='watch'){
        const watched=s.world.npcs[t.subjectId];if(!watched){t.status='failed';return;}
        if(watched.location!==n.location){const last=t.lastSeenLocation||t.destinationId;if(last&&travel(s,n,last,t))t.status='searching';return;}
        t.lastSeenLocation=watched.location;t.observations||=[];if(t.observations.at(-1)?.locationId!==watched.location)t.observations.push({locationId:watched.location,time:s.world.rpg.clock.minute});
        t.status='watching';C.event(s,'watch_report',{taskId:t.id,npcId:n.id,subjectId:watched.id,locationId:watched.location});return;
      }
      if(t.type==='search'||t.type==='collect'){
        t.remaining||=[...(t.itemIds||[])];const target=C.item(s,t.remaining[0]);
        if(!target){if(!t.remaining.length)complete(s,n,t);else{t.status='failed';t.blockReason='missing_item';}return;}
        if(target.location===n.id){t.remaining.shift();if(!t.remaining.length)complete(s,n,t);return;}
        if(C.available(s,target,n.id)&&!target.hidden&&(!target.ownerId||target.ownerId==='player'||target.ownerId===n.id)){
          if(!target.portable){t.status='blocked';t.blockReason='not_portable';return;}C.transfer(s,target,n.id);t.remaining.shift();if(!t.remaining.length)complete(s,n,t);return;
        }
        // Search visits known public rooms. A hidden target's coordinates are never a route oracle.
        t.searched||=[];if(!t.searched.includes(n.location))t.searched.push(n.location);
        if(t.targetKnown&&t.destinationId&&n.location!==t.destinationId){travel(s,n,t.destinationId,t);return;}
        const next=s.world.locations.find(l=>!t.searched.includes(l.id)&&C.route(s,n.location,l.id,n.id));
        if(next){travel(s,n,next.id,t);t.status='searching';}else{t.status='blocked';t.blockReason='not_found';}return;
      }
      if(t.type==='search_person'){
        const sought=s.world.npcs[t.subjectId];if(!sought){t.status='failed';return;}
        t.searched||=[];if(!t.searched.includes(n.location))t.searched.push(n.location);
        if(n.location===sought.location){sought.hidden=false;sought.status=sought.status==='missing'?'idle':sought.status;sought.dialogueState.status='present';C.event(s,'person_found',{npcId:sought.id,finderId:n.id,locationId:n.location});complete(s,n,t);return;}
        const next=s.world.locations.find(l=>!t.searched.includes(l.id)&&C.route(s,n.location,l.id,n.id));if(next)travel(s,n,next.id,t);else{t.status='blocked';t.blockReason='not_found';}return;
      }
      if(t.destinationId&&!travel(s,n,t.destinationId,t))return;
      if(t.type==='craft'){
        const recipe=C.api.equipment.recipe(s,t.product);t.worked=(t.worked||0)+5;if(t.worked<(recipe?.time||20))return;
        try{const made=C.api.equipment.make(s,t.product,n.id);t.resultItemId=made.id;if(t.recipientId){C.transfer(s,made,C.holder(s,t.recipientId));made.ownerId=t.recipientId;}complete(s,n,t);}catch(e){if(!e.rpgRejection)throw e;t.status='blocked';t.blockReason=e.code;}return;
      }
      if(t.type==='repair'){
        const e=C.item(s,t.itemId),tool=C.api.equipment.tool(s,'repair',n.id)||C.api.equipment.tool(s,'pliers',n.id);
        const material=C.accessibleItems(s,n.id).find(v=>v.location===n.id&&v.id!==e?.id&&(P(v).material===P(e).material||P(v).functions.includes('repair_material')));
        if(!e||!C.available(s,e,n.id)||!tool||!material){t.status='blocked';t.blockReason='missing_work_resources';return;}
        t.worked=(t.worked||0)+5;if(t.worked<(t.duration||30))return;C.consume(s,material);P(e).durability=P(e).maxDurability;P(e).condition='working';e.condition='repaired';C.event(s,'repaired',{itemId:e.id,actorId:n.id,taskId:t.id});complete(s,n,t);return;
      }
      if(t.type==='message'){
        const recipient=s.world.npcs[t.recipientId];if(!recipient||recipient.location!==n.location){if(recipient){t.destinationId=recipient.location;travel(s,n,t.destinationId,t);}else t.status='failed';return;}
        recipient.memory.messages||=[];recipient.memory.messages.push({from:'player',via:n.id,text:t.message,time:s.world.rpg.clock.minute});C.H.hear(s,recipient,C.H.proposition(s,t.message),'messenger:'+t.id,.6,true);complete(s,n,t);return;
      }
      if(t.type==='distract'){
        const target=s.world.npcs[t.subjectId];if(!target||target.location!==n.location){t.status='blocked';t.blockReason='subject_absent';return;}target.busyUntilTurn=Math.max(target.busyUntilTurn||0,s.turn+3);target.agency.distractedBy=n.id;C.event(s,'npc_distracted',{npcId:target.id,actorId:n.id,untilTurn:target.busyUntilTurn});complete(s,n,t);return;
      }
      if(t.type==='work'){
        const e=C.item(s,t.itemId);if(!e||!C.available(s,e,n.id)){t.status='blocked';t.blockReason='worksite_unavailable';return;}
        const work=P(e).work;if(!work||!['clean','sort','survey'].includes(work.type)){t.status='blocked';t.blockReason='work_method_undefined';return;}
        t.worked=(t.worked||0)+5;if(t.worked>=(t.duration||work.duration||30)){if(work.type==='clean')P(e).dirt=0;if(work.type==='sort')P(e).sorted=true;if(work.type==='survey'){n.researchKnowledge||={};n.researchKnowledge['survey:'+e.id]={sourceId:e.id,material:P(e).material,functions:[...P(e).functions]};}C.event(s,'work_completed',{npcId:n.id,itemId:e.id,method:work.type});complete(s,n,t);}return;
      }
      if(t.type==='survey'){
        t.checked||=[];const next=t.locations.find(id=>!t.checked.includes(id));if(!next){complete(s,n,t);return;}if(travel(s,n,next,t))t.checked.push(next);return;
      }
      t.status='blocked';t.blockReason='unsupported_task';
    }
    function npcList(s,text){return Object.values(s.world.npcs).filter(n=>C.H.words(text).map(C.H.stem).includes(C.H.stem(n.name)));}
    function handle(s,a){
      if(a.op==='task_status')return ok(s.world.rpg.tasks.map(t=>{const n=s.world.npcs[t.actorId];const names={move:'путь к месту',escort:'сопровождение',guard:'охрана',watch:'наблюдение',search:'поиск вещи',collect:'сбор вещей',craft:'изготовление '+t.product,repair:'ремонт',message:'доставка сообщения',work:'работа',survey:'обследование',distract:'отвлечение',search_person:'поиски человека'},statuses={pending:'ожидает',working:'выполняется',completed:'выполнено',blocked:'нужны условия для продолжения',failed:'неудача',cancelled:'отменено',waiting:'ожидание',guarding:'охраняет',watching:'наблюдает',searching:'ищет'};return n.name+': '+(names[t.type]||'поручение')+' — '+(statuses[t.status]||'в процессе')+(t.blockReason?' (проверьте доступ, материалы и инструменты)':'');}).join('\n')||'Поручений пока нет.','tasks_reported',{performed:false});
      const n=C.person(s,a,{explicit:true});R(n,'unknown_actor','Назовите исполнителя поручения.','clarification');C.agree(s,n);
      const destination=C.findPlace(s,a.destination||a.secondary||a.text),e=C.target(s,a,{absent:true});
      if(a.op==='companion'||a.op==='follow'){
        R(n.trust>=1||n.social.relationship.respect>=1,'companion_refused','Для долгого путешествия нужно знакомство и основание доверять.');n.agency.companion=true;n.agency.following='player';n.agency.activity='following';C.event(s,'companion_joined',{npcId:n.id});return ok(say(s,n,'Пойду с вами по доступным дорогам. Если путь перекроют, сообщу, где задержался.'),'companion_joined');
      }
      if(a.op==='invite'||a.op==='escort'){
        R(destination,'unknown_destination','Куда должен прийти персонаж?','clarification');R(C.route(s,n.location,destination.id,n.id),'no_route','До этого места нет доступного маршрута.');const t=queue(s,n,a.op==='invite'?'move':'escort',{destinationId:destination.id});if(a.op==='escort')n.agency.escortPlayer=true;return ok(say(s,n,'Иду к месту: '+destination.name+'.'),'npc_dispatched',{taskId:t.id});
      }
      if(a.op==='appointment'){
        R(destination,'unknown_destination','Для встречи нужно место.','clarification');const raw=a.text.match(/(?:в|к)\s*(\d{1,2})(?::(\d{2}))?/u);R(raw,'missing_appointment_time','Назовите игровое время, например «в 12:30».','clarification');const now=s.world.rpg.clock.minute,day=Math.floor(now/1440);let time=day*1440+Number(raw[1])*60+Number(raw[2]||0);if(time<now)time+=1440;const ap={id:C.id(s,'appointment'),npcId:n.id,locationId:destination.id,time,status:'scheduled'};s.world.rpg.appointments.push(ap);return ok(say(s,n,'Договорились. Постараюсь прийти по дороге к назначенному времени.'),'appointment_scheduled');
      }
      if(a.op==='guard'){R(e,'unknown_target','Что именно нужно охранять?','clarification');const location=s.world.locations.find(l=>l.name===e.location)||C.place(s);queue(s,n,'guard',{itemId:e.id,destinationId:location.id});return ok(say(s,n,'Буду охранять этот предмет, пока поручение не отменено.'),'guard_assigned');}
      if(a.op==='watch'||a.op==='distract'){
        const other=npcList(s,a.text).find(v=>v.id!==n.id);R(other,'unknown_subject','Назовите другого персонажа, за которым нужно наблюдать или которого нужно отвлечь.','clarification');queue(s,n,a.op,{subjectId:other.id,destinationId:other.location,lastSeenLocation:other.location});return ok(say(s,n,'Поручение понял. Я смогу действовать лишь там, куда сам доберусь.'),'npc_task_accepted');
      }
      if(a.op==='search_item'||a.op==='collect'){
        const items=C.match(s,a.text,{absent:true,all:true});R(items.length,'unknown_target','Какие существующие вещи нужно найти?','clarification');queue(s,n,a.op==='collect'?'collect':'search',{itemIds:items.map(v=>v.id),targetKnown:items.every(v=>v.known&&!v.hidden),destinationId:items[0].known&&!items[0].hidden?s.world.locations.find(l=>l.name===items[0].location)?.id:null});return ok(say(s,n,'Проверю доступные места. Чужие вещи без разрешения забирать не стану.'),'search_assigned');
      }
      if(a.op==='delegate'||a.op==='long_work'||a.op==='order_craft'||a.op==='blueprint_order'){
        let product=a.product||a.text.split(/(?:изготовить|сделать|создать|заказываю[^:]*:)\s*/iu).at(-1).split(/\s+(?:из|в|на|у)\s+/u)[0],type='work';
        const blueprint=C.match(s,a.text,{filter:v=>v.blueprint});if(a.op==='blueprint_order'){R(blueprint,'missing_blueprint','Нужно передать реальный чертёж.');product=blueprint.blueprint.name;if(!C.api.equipment.recipe(s,product))s.world.rpg.recipes.push(C.H.clone(blueprint.blueprint));C.transfer(s,blueprint,n.id);}
        if(/почин|ремонт/.test(C.norm(a.text)))type='repair';else if(a.op==='order_craft'||a.op==='blueprint_order'||C.api.equipment.recipe(s,product))type='craft';
        R(type!=='work'||e&&P(e).work,'undefined_work','Опишите проверяемую работу с существующим предметом: изготовление, ремонт, уборку, сортировку или обследование.','clarification');
        R(type==='work'||type==='craft'||e,'unknown_target','Нужен предмет работы.','clarification');const t=queue(s,n,type,{itemId:e?.id,product,destinationId:destination?.id||n.location,duration:C.amount(a.text,30),recipientId:'player',goalId:C.api.goals.active(s)?.id});return ok(say(s,n,'Записал этап работы. Мне нужны настоящие материалы и инструменты в месте выполнения.'),'work_delegated',{taskId:t.id});
      }
      if(a.op==='share_reward'){
        const t=s.world.rpg.tasks.filter(t=>t.actorId===n.id&&!t.paid).at(-1);R(t,'no_task','Сначала договоритесь о поручении.');R(!t.reward,'reward_already_escrowed','Для этого поручения награда уже зарезервирована.');const amount=C.amount(a.text,1);C.money(s,'player','treasury',amount,'task_escrow');t.reward=amount;t.escrowAccount='treasury';return ok('Доля награды зарезервирована. Она перейдёт исполнителю только после результата.','reward_shared');
      }
      if(a.op==='lend_tool'){
        R(e&&e.location==='inventory','tool_not_carried','Инструмент должен быть у вас.');C.transfer(s,e,n.id);n.agency.borrowedTools||=[];n.agency.borrowedTools.push(e.id);return ok('Инструмент передан исполнителю; принадлежность игроку сохранена.','work_tool_lent');
      }
      if(a.op==='teach'){
        const subject=C.skillName((a.text.split(':').slice(1).join(':')||a.text.match(/(?:навыку|навык|учиться|обучить|научи)\s+(.+)$/iu)?.[1]||n.profession||'craft').trim()),level=n.agency.skills[subject]||(/мастер|ремес|кузнец/.test(C.norm(n.description))?2:0);R(level>0,'teacher_lacks_skill','У персонажа нет подтверждённого знания этого навыка.');const old=C.skill(s,subject);R(old<level,'nothing_to_teach','Ваш уровень уже не ниже уровня наставника.');s.world.player.skills[subject]=old+1;n.agency.lessons=(n.agency.lessons||0)+1;return ok(say(s,n,'Разберём приём и повторим его на практике.'),'skill_learned',{time:30});
      }
      if(a.op==='help_problem'){
        const issue=n.agency.problem;R(issue?.condition,'no_defined_problem','У персонажа нет известной конкретной проблемы. Сначала расспросите его.');const g=C.api.goals.createGoal(s,issue.text,{condition:issue.condition});C.api.goals.arc(s,issue.text,g,'npc_problem');return ok(say(s,n,'Начнём с этой задачи. После её решения появится следующий этап.'),'personal_problem_started');
      }
      if(a.op==='introduce'){
        const other=npcList(s,a.text).find(v=>v.id!==n.id);R(other&&n.memory.knownNpcIds?.includes(other.id),'no_acquaintance','Персонаж не подтверждал знакомство с этим человеком.');other.memory.introductions||=[];other.memory.introductions.push({via:n.id,player:true});if(other.location===n.location){other.dialogueState.status='present';C.H.social.change(s,other,{trust:1});}return ok(say(s,n,'Я представлю вас как своего знакомого.'),'introduction_arranged');
      }
      if(a.op==='message'){
        const recipient=npcList(s,a.text).find(v=>v.id!==n.id),message=a.text.split(':').slice(1).join(':').trim();R(recipient&&message,'missing_message','Укажите отправителя, получателя и текст после двоеточия.','clarification');queue(s,n,'message',{recipientId:recipient.id,destinationId:recipient.location,message});return ok(say(s,n,'Передам, когда дойду до адресата.'),'message_dispatched');
      }
      if(a.op==='teamwork'||a.op==='shared_plan'){
        const people=npcList(s,a.text);R(people.length>=2,'need_team','Нужны хотя бы два согласных участника.','clarification');for(const p of people)C.agree(s,p);R(e||destination,'missing_team_objective','Нужен объект работы или место обследования.');const plan={id:C.id(s,'plan'),type:'team',participants:people.map(p=>p.id),tasks:[],status:'active'};for(const p of people){const t=queue(s,p,e&&P(e).durability<P(e).maxDurability?'repair':'survey',{itemId:e?.id,destinationId:destination?.id||p.location,locations:destination?[destination.id]:[p.location],planId:plan.id});plan.tasks.push(t.id);}s.world.rpg.plans.push(plan);return ok('Участники получили отдельные исполнимые этапы. План завершится после их результатов.','team_plan_started');
      }
      if(a.op==='contingency'){const t=s.world.rpg.tasks.filter(t=>t.actorId===n.id&&!['completed','failed'].includes(t.status)).at(-1);R(t,'no_task','Сначала нужно поручение.');t.contingency=/верни|возвращ/.test(C.norm(a.text))?'return':'alternate_route';t.originId=n.location;return ok(say(s,n,'Если возникнет препятствие, применю согласованный запасной вариант.'),'contingency_agreed');}
      if(a.op==='autonomous_plan'){R(n.agency.longGoal,'no_npc_goal','У персонажа нет описанной самостоятельной цели.');const t=queue(s,n,n.agency.longGoal.type,n.agency.longGoal);n.agency.longGoal.taskId=t.id;return ok('Персонаж приступает к собственной цели. Его действия продолжаются при течении времени.','npc_long_goal_started');}
      return null;
    }
    function tick(s,elapsed){
      const now=s.world.rpg.clock.minute;
      for(const ap of s.world.rpg.appointments.filter(a=>a.status==='scheduled')){
        const n=s.world.npcs[ap.npcId];if(now>=ap.time-20&&!ap.taskId)ap.taskId=queue(s,n,'move',{destinationId:ap.locationId,appointmentId:ap.id}).id;
        if(now>=ap.time){if(n.location===ap.locationId&&s.world.player.location===ap.locationId&&now<=ap.time+20){ap.status='attended';C.H.social.change(s,n,{reliability:1});C.event(s,'appointment_attended',{appointmentId:ap.id});}else if(now>ap.time+20){ap.status='missed';C.H.social.change(s,n,{reliability:-1});}}
      }
      for(const n of Object.values(s.world.npcs)){
        if(n.agency.companion&&n.location!==s.world.player.location&&elapsed>=2){const dummy={history:[],status:'pending'};travel(s,n,s.world.player.location,dummy);n.agency.followStatus=dummy.status==='blocked'?'blocked':'following';}
        n.agency.credit=(n.agency.credit||0)+elapsed;let budget=Math.min(288,Math.floor(n.agency.credit/5));n.agency.credit-=budget*5;
        while(budget-->0){const t=s.world.rpg.tasks.find(t=>t.actorId===n.id&&!['completed','failed','cancelled'].includes(t.status));if(!t)break;execute(s,n,t);if(t.status==='blocked'){if(t.contingency==='return'&&t.originId){t.type='move';t.destinationId=t.originId;t.contingency=null;t.status='pending';}break;}if(['guarding','watching','waiting'].includes(t.status))break;}
      }
      for(const plan of s.world.rpg.plans.filter(p=>p.type==='team'&&p.status==='active'))if(plan.tasks.every(id=>s.world.rpg.tasks.find(t=>t.id===id)?.status==='completed')){plan.status='completed';C.event(s,'teamwork_completed',{planId:plan.id});}
    }
    return {handle,tick,queue,execute,travel,npcList};
  }
  root.RpgAgency={create};
})(globalThis);
