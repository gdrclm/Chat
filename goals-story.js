/* Checkable goals, player-authored plans, recoverable arcs and state-derived endings. */
(function(root){'use strict';
  function create(C){
    const {require:R,result:ok}=C;
    const active=s=>s.world.rpg.goals.find(g=>g.id===s.world.rpg.primaryGoalId)||s.world.rpg.goals.find(g=>g.status==='active');
    function condition(s,type,target,extra={}){return {type,targetId:target?.id||target||null,...extra};}
    function satisfied(s,c){
      if(!c)return false;
      const e=C.item(s,c.targetId),n=s.world.npcs[c.targetId];
      if(c.type==='acquire')return Boolean(e&&!e.destroyed&&e.location==='inventory');
      if(c.type==='reach')return s.world.player.location===c.targetId;
      if(c.type==='find_person')return Boolean(n&&!n.hidden&&n.dialogueState.status!=='undiscovered');
      if(c.type==='repair')return Boolean(e&&!e.destroyed&&(e.condition==='repaired'||C.props(e).durability===C.props(e).maxDurability));
      if(c.type==='craft')return s.entities.some(e=>!e.destroyed&&C.same(e.label,c.label)&&e.location==='inventory'&&e.source==='rpg-crafted');
      if(c.type==='earn')return s.world.player.money>=c.amount;
      if(c.type==='deliver')return Boolean(e&&e.location===c.recipientId||!e&&c.label&&s.entities.some(v=>!v.destroyed&&C.same(v.label,c.label)&&v.location===c.recipientId));
      if(c.type==='deliver_place')return Boolean(e&&e.location===s.world.locations.find(l=>l.id===c.locationId)?.name);
      if(c.type==='heal')return Boolean(n&&n.health>=(c.health||3)&&!Object.values(n.body.injuries).some(v=>v>0));
      if(c.type==='work')return Boolean(e&&C.props(e).work?.completed);
      if(c.type==='reconcile')return Boolean(n&&!C.openConflicts(n));
      if(c.type==='case')return s.world.rpg.cases.some(v=>v.id===c.targetId&&v.status==='closed');
      if(c.type==='rescue')return Boolean(n&&n.health>0&&!['incapacitated','dead','missing'].includes(n.status)&&!n.hidden&&n.agency.rescued);
      if(c.type==='rank')return Boolean(s.world.rpg.memberships.player?.some(m=>m.factionId===c.targetId&&m.rank>=c.rank));
      if(c.type==='task')return s.world.rpg.tasks.some(t=>t.id===c.targetId&&t.status==='completed');
      if(c.type==='decision')return s.world.rpg.settlement.decisions.some(d=>d.id===c.targetId||d.choice===c.value);
      return false;
    }
    function infer(s,text,a={}){
      const q=C.norm(text),n=C.person(s,{...a,text},{explicit:true}),e=C.target(s,{...a,text},{absent:true}),location=C.findPlace(s,a.destination||text.replace(/^.*?(?:попасть|добраться|дойти|прийти)\s+/iu,''));
      if(/заработ|накоп|получить.*монет/.test(q))return condition(s,'earn',null,{amount:C.amount(text,10)});
      if(/почин|восстанов|ремонт/.test(q)){R(e,'unknown_goal_target','Какой существующий предмет нужно починить?','clarification');return condition(s,'repair',e);}
      if(/изготов|сделать|создать/.test(q)){const label=a.product||text.replace(/^.*?(?:изготовить|сделать|создать)\s+/iu,'');R(C.api.equipment.recipe(s,label),'unknown_goal_recipe','Нужен известный рецепт или чертёж.','clarification');return condition(s,'craft',null,{label});}
      if(/помир|примир/.test(q)){R(n,'unknown_goal_person','С кем вы хотите примириться?','clarification');return condition(s,'reconcile',n);}
      if(/спасти|защитить/.test(q)){R(n,'unknown_goal_person','Кого нужно спасти?','clarification');return condition(s,'rescue',n);}
      if(/достав|вернуть.*(?:мире|илье|нике|лее)/.test(q)){const recipe=s.world.rpg.recipes.concat(C.api.equipment.recipes).find(r=>q.includes(C.norm(r.name)));R(n&&(e||recipe),'unknown_delivery_goal','Нужны существующий предмет или известное изделие и конкретный получатель.','clarification');return condition(s,'deliver',e,{recipientId:n.id,...(!e?{label:recipe.name}:{})});}
      if(/найти|отыск|поиски/.test(q)&&n)return condition(s,'find_person',n);
      if(/получить|найти|забрать|добыть/.test(q)){R(e,'unknown_goal_target','Что именно вы хотите найти? Нужен существующий предмет или известный персонаж.','clarification');return condition(s,'acquire',e);}
      if(location)return condition(s,'reach',location);
      R(false,'uncheckable_goal','Уточните проверяемый результат: найти человека или вещь, добраться до места, изготовить, доставить, починить или заработать сумму.','clarification');
    }
    function createGoal(s,text,a={}){
      const c=a.condition||infer(s,text,a),goal={id:C.id(s,'goal'),text,condition:c,status:'active',created:s.world.rpg.clock.minute,objectives:[],history:[],cause:s.currentActionId};
      const e=C.item(s,c.targetId),n=s.world.npcs[c.targetId],location=c.type==='reach'?s.world.locations.find(l=>l.id===c.targetId):e&&s.world.locations.find(l=>l.name===e.location)||n&&!n.hidden&&s.world.locations.find(l=>l.id===n.location);
      if(location&&location.id!==s.world.player.location){const path=C.route(s,s.world.player.location,location.id);if(path)for(const id of path)goal.objectives.push({id:C.id(s,'objective'),text:'Добраться: '+s.world.locations.find(l=>l.id===id).name,condition:condition(s,'reach',id),status:'pending'});}
      if(c.type==='find_person'&&n?.hidden)goal.objectives.push({id:C.id(s,'objective'),text:'Собрать сведения и обследовать реальные места',condition:{type:'find_person',targetId:n.id},status:'pending'});
      goal.objectives.push({id:C.id(s,'objective'),text:'Достичь результата: '+text,condition:c,status:'pending'});
      s.world.rpg.goals.push(goal);s.world.rpg.primaryGoalId||=goal.id;s.facts.goal=text;C.event(s,'goal_created',{goalId:goal.id,condition:c,objectives:goal.objectives.map(o=>o.id)});return goal;
    }
    function arc(s,text,goal,source='player_initiative'){
      const a={id:C.id(s,'arc'),title:text,goalId:goal?.id||null,status:'active',chapter:1,source,choices:[],events:[],consequences:[],created:s.world.rpg.clock.minute,locationId:s.world.player.location};s.world.rpg.arcs.push(a);C.event(s,'arc_started',{arcId:a.id,goalId:a.goalId,source});return a;
    }
    function activeArc(s){return [...s.world.rpg.arcs].reverse().find(a=>['active','recovering'].includes(a.status))||s.world.rpg.arcs.at(-1);}
    function recordChoice(s,a,type,data){const choice={id:C.id(s,'choice'),type,...data,time:s.world.rpg.clock.minute};a.choices.push(choice);C.event(s,'story_choice',{arcId:a.id,...choice});return choice;}
    function handle(s,a){
      let goal=active(s),story=activeArc(s);const text=a.payload||a.text.split(':').slice(1).join(':').trim()||a.targetQuery||a.text;
      if(a.op==='goal_create'){goal=createGoal(s,text,a);return ok('Создана проверяемая цель: '+goal.text+'. Промежуточных шагов: '+goal.objectives.length+'.','goal_created',{goalId:goal.id});}
      if(a.op==='subgoals'){R(goal,'no_active_goal','Сначала нужна проверяемая цель.');const parts=text.split(/\s*;\s*|\s+затем\s+/iu).filter(Boolean);R(parts.length>=1,'no_subgoals','Укажите промежуточные результаты.','clarification');for(const part of parts)goal.objectives.push({id:C.id(s,'objective'),text:part,condition:infer(s,part,a),status:'pending'});return ok('Промежуточные задачи добавлены с отдельными условиями выполнения.','objectives_added');}
      if(a.op==='prioritize'){const selected=s.world.rpg.goals.find(g=>g.id===a.goalId||C.same(g.text,text));R(selected,'unknown_goal','Выберите существующую цель.','clarification');R(selected.status==='active','goal_inactive','Эта цель уже не активна.');s.world.rpg.primaryGoalId=selected.id;return ok('Главная задача теперь: '+selected.text+'.','goal_prioritized');}
      if(a.op==='goal_change'){R(goal,'no_active_goal','Нет текущей цели для пересмотра.');goal.status='superseded';goal.history.push({type:'superseded',time:s.world.rpg.clock.minute});const next=createGoal(s,text,a);next.predecessorId=goal.id;s.world.rpg.primaryGoalId=next.id;return ok('Прежняя цель сохранена в истории. Новая: '+next.text+'.','goal_changed');}
      if(a.op==='abandon_plot'||a.op==='abandon_goal_ending'){
        if(goal){goal.status='abandoned';goal.history.push({type:'abandoned',time:s.world.rpg.clock.minute});}
        if(story){recordChoice(s,story,'abandon',{goalId:goal?.id});story.status='resolved';story.outcome='abandoned';}
        const needs=s.entities.find(e=>!e.destroyed&&C.props(e).durability<C.props(e).maxDurability&&e.ownerId);if(needs){const alternative=createGoal(s,'Починить '+needs.label,{condition:condition(s,'repair',needs)});arc(s,'Дело вместо прежней загадки',alternative,'abandonment');}
        else{s.world.rpg.settlement.decisions.push({id:C.id(s,'decision'),choice:'independent_life',time:s.world.rpg.clock.minute});const next=createGoal(s,'Заработать 3 монеты',{condition:condition(s,'earn',null,{amount:s.world.player.money+3})});arc(s,'Самостоятельная жизнь',next,'abandonment');}
        return ok('Вы отказываетесь от прежней линии. Решения и долги сохраняются; начата доступная самостоятельная линия.','plot_abandoned');
      }
      if(a.op==='ask_routes'){
        R(goal,'no_active_goal','Сначала нужно определить цель.');const n=C.person(s,a);C.agree(s,n);const methods=[];
        if(['repair','craft'].includes(goal.condition.type)){methods.push('найти материалы и выполнить работу самостоятельно');if(['craftsman','inventor'].includes(n.identity.role))methods.push('согласовать заказ мастеру');}
        else if(goal.condition.type==='find_person')methods.push('обследовать доступные места','собрать свидетельства и поручить участникам разные маршруты');
        else methods.push('пройти доступным маршрутом и проверить условия','подготовить ресурсы или поручить часть работы исполнителю');
        goal.alternatives=methods;C.H.dialogue.start(s,n);return ok(C.H.dialogue.say(s,n,'Есть способы: '+methods.map((x,i)=>(i+1)+') '+x).join('; ')+'. Выберите конкретные действия.','source_shared'),'goal_routes_suggested');
      }
      if(a.op==='personal_plan'||a.op==='joint_project'||a.op==='own_arc'){
        R(goal,'no_active_goal','Сначала создайте проверяемую цель.');const n=a.op==='joint_project'?C.agree(s,C.person(s,a)):null;const plan={id:C.id(s,'personal-plan'),goalId:goal.id,actorIds:['player',...(n?[n.id]:[])],resources:C.match(s,a.text,{all:true}).map(e=>e.id),deadline:s.world.rpg.clock.minute+C.amount(a.text,180),steps:goal.objectives.map(o=>({objectiveId:o.id,actorId:'player',status:'pending'})),status:'active'};s.world.rpg.plans.push(plan);
        if(a.op==='own_arc'||!s.world.rpg.arcs.some(v=>v.goalId===goal.id))story=arc(s,goal.text,goal);
        return ok('План создан: участники, реальные ресурсы, этапы и срок записаны.','personal_plan_created',{planId:plan.id});
      }
      if(a.op==='goal_progress'){R(goal,'no_active_goal','Главная цель пока не выбрана.');const done=goal.objectives.filter(o=>o.status==='completed').length;return ok('Цель: '+goal.text+'. Выполнено '+done+'/'+goal.objectives.length+'. Подтверждённые действия: '+goal.history.filter(h=>h.type==='progress').map(h=>h.actionId).join(', ')+'.','goal_progress_report');}
      if(a.op==='initiative_job'||a.op==='solve_problem'){
        const e=C.target(s,a,{absent:false})||s.entities.find(e=>e.location===s.place&&C.props(e).durability<C.props(e).maxDurability);R(e,'no_observed_problem','Нужна существующая обнаруженная проблема, а не объявленная поломка.');R(C.props(e).durability<C.props(e).maxDurability||e.condition==='damaged','not_a_problem','Эта вещь не повреждена.');goal=createGoal(s,'Восстановить '+e.label,{condition:condition(s,'repair',e)});arc(s,'Личная инициатива: '+e.label,goal,'observed_problem');return ok('Вы сами берётесь за реальную проблему. Создана задача с проверяемым результатом.','initiative_task_created');
      }
      if(a.op==='bounty'){
        R(goal,'no_active_goal','За какую существующую цель назначается награда?');const amount=C.amount(a.text,3);C.money(s,'player','treasury',amount,'bounty_escrow');goal.bounty={amount,escrow:true,claimed:false};C.event(s,'bounty_posted',{goalId:goal.id,amount});return ok('Награда '+amount+' монеты внесена в залог. Выплата зависит от реального выполнения.','bounty_posted');
      }
      if(a.op==='recover_goal'||a.op==='continue_failure'){
        R(goal&&['failed','superseded'].includes(goal.status)||story&&story.status==='failed','no_failed_goal','Нет проваленной задачи для восстановления.');const previous=goal;const next=createGoal(s,text&&text!==a.text?text:previous.text,{condition:previous.condition});next.predecessorId=previous.id;s.world.rpg.primaryGoalId=next.id;next.recovery=true;const nextArc=arc(s,'Восстановление после неудачи',next,'failure');if(story)nextArc.predecessorId=story.id;return ok('Начата линия восстановления. Неудача и её последствия не стёрты.','recovery_started');
      }
      if(a.op==='begin_arc'||a.op==='side_story'){
        if(!goal)goal=createGoal(s,text,a);story=arc(s,text||goal.text,goal,a.op==='side_story'?'discovered_problem':'player_initiative');return ok('Начата самостоятельная история: '+story.title+'.','story_arc_started');
      }
      if(a.op==='next_conflict'||a.op==='help_consequence'||a.op==='ally_conflict'){
        R(story&&story.status==='resolved'||s.stage>=3,'previous_arc_unfinished','Нужно завершить предыдущий значимый этап.');const n=C.person(s,a)||Object.values(s.world.npcs).find(n=>n.location===s.world.player.location);R(n,'no_story_participant','Для нового конфликта нужен существующий участник.');
        const conflictGoal=createGoal(s,'Заработать на новое совместное дело',{condition:condition(s,'earn',null,{amount:s.world.player.money+3})});s.world.rpg.primaryGoalId=conflictGoal.id;const next=arc(s,a.op==='ally_conflict'?'Разные цели союзников':'Цена прежней помощи',conflictGoal,'previous_outcome');next.predecessorId=story?.id;next.counterpartyId=n.id;next.dilemma={offer:'продолжить совместное дело',alternative:'заработать самостоятельно',incompatibleGoal:n.motive};next.chapter=(story?.chapter||1)+1;return ok('У прежнего решения появилось продолжение: '+n.name+' предлагает дело со своей целью «'+n.motive+'». Можно согласиться или выбрать самостоятельный путь.','consequent_conflict_created');
      }
      if(a.op==='relationship_chapter'){
        const n=C.person(s,a);C.agree(s,n);R(n.trust>=2||n.social.relationship.respect>=2,'relationship_not_ready','Для этой совместной главы пока нет оснований.');const next=arc(s,'Совместное дело с '+n.name,goal,'relationship');next.counterpartyId=n.id;next.chapter=2;return ok('Отношения открыли главу совместной истории. Её результат ещё нужно получить действиями.','relationship_chapter_opened');
      }
      if(a.op==='choose_side'){
        R(story,'no_active_arc','Сначала нужен существующий конфликт.');const faction=s.world.rpg.factions.find(f=>C.same(f.name,a.targetQuery||a.text));R(faction,'unknown_faction','Какую существующую сторону вы выбираете?','clarification');recordChoice(s,story,'side',{factionId:faction.id});story.sideId=faction.id;faction.reputation.player=(faction.reputation.player||0)+1;for(const other of s.world.rpg.factions.filter(f=>f.id!==faction.id&&(f.relations[faction.id]||0)<0))other.reputation.player=(other.reputation.player||0)-1;return ok('Вы выбрали сторону. Связанные группы учитывают этот поступок.','story_side_chosen');
      }
      if(a.op==='intervene'){
        const people=Object.values(s.world.npcs).filter(n=>n.location===s.world.player.location&&C.openConflicts(n));R(people.length,'no_local_conflict','Рядом нет известного конфликта для вмешательства.');story||=arc(s,'Вмешательство в местный конфликт',goal,'npc_conflict');recordChoice(s,story,'intervention',{participants:people.map(n=>n.id)});for(const n of people)n.agency.activity='negotiating';return ok('Участники отвлеклись на ваше вмешательство; для решения нужен конкретный договор или возмещение.','conflict_intervened');
      }
      if(a.op==='refuse_offer'){
        const plan=s.world.rpg.plans.find(p=>p.status==='offered'||p.status==='active');R(plan||s.pending,'no_offer','Нет существующего предложения для отказа.');if(plan)plan.status='refused';s.pending=null;const next=createGoal(s,'Заработать самостоятельно',{condition:condition(s,'earn',null,{amount:s.world.player.money+3})});arc(s,'Альтернатива отклонённому делу',next,'refusal');return ok('Предложение отклонено. Долги сохранены, открыт самостоятельный путь.','story_offer_refused');
      }
      if(a.op==='conceal_discovery'){
        const e=C.target(s,a,{inventory:true});R(e,'missing_discovery','Нужно открытие на реальном носителе при вас.');e.concealed=true;C.props(e).concealed=true;story||=arc(s,'Сохранённое открытие',goal,'private_discovery');recordChoice(s,story,'conceal',{itemId:e.id});return ok('Носитель скрыт. NPC не получают сведения, которых не наблюдали.','discovery_concealed');
      }
      if(a.op==='lie_completion'){
        const contract=s.world.rpg.contracts.find(c=>['accepted','active'].includes(c.status));R(contract,'no_contract','Нужен настоящий принятый заказ.');R(!contract.fulfilled&&!C.api.goals.satisfied(s,contract.condition),'already_fulfilled','Заказ действительно выполнен; ложного отчёта здесь нет.');const n=s.world.npcs[contract.employerId];C.agree(s,n);contract.reportedComplete=true;contract.auditAt=s.world.rpg.clock.minute+30;contract.reporterId='player';C.event(s,'false_completion_report',{contractId:contract.id,employerId:n.id});return ok('Вы сообщили о выполнении. Это утверждение, которое заказчик проверит позже.','completion_lie_recorded');
      }
      if(a.op==='rescue'){
        const n=C.person(s,a,{explicit:true});R(n&&n.location===s.world.player.location,'person_not_reached','Нужно добраться до пострадавшего.');R(n.health>0&&n.status!=='dead','person_dead','Погибшего нельзя объявить спасённым без предусмотренного правила.');const threat=s.world.rpg.arcs.find(v=>v.threat?.npcId===n.id&&!v.threat.resolved),hazard=s.entities.find(e=>e.location===s.place&&(C.props(e).burning||C.props(e).lit&&C.props(e).temperature>=150));R(threat||hazard||n.status==='missing'||n.body.injuries&&Object.keys(n.body.injuries).length,'no_confirmed_threat','Нет установленной угрозы этому персонажу.');R(!hazard,'hazard_unresolved','Сначала устраните физическую угрозу, например огонь.');if(threat)threat.threat.resolved=true;n.agency.rescued=true;n.hidden=false;n.status='active';C.H.dialogue.notice(s,n);C.event(s,'npc_rescued',{npcId:n.id});return ok('Причина опасности устранена; '+n.name+' спасён и остаётся в мире.','npc_rescued');
      }
      if(a.op==='npc_fate'){
        const n=C.person(s,a,{explicit:true});R(n,'unknown_person','О чьей судьбе идёт речь?','clarification');const related=s.world.rpg.events.filter(e=>e.npcId===n.id||e.actorId===n.id);R(related.length>=2,'insufficient_history','Нужна история нескольких реальных поступков.');n.agency.fate=n.status==='dead'?'lost':n.agency.rescued?'rescued':n.trust>=2?'ally':n.social.relationship.hostility>=3?'opponent':'independent';return ok('Судьба '+n.name+' по совершённым поступкам: '+n.agency.fate+'.','npc_fate_established');
      }
      if(a.op==='negotiate_ending'){
        R(story,'no_active_arc','Нет истории для завершения.');const n=C.person(s,a);C.agree(s,n);R(n.trust>=1||n.social.relationship.respect>=2,'agreement_not_reached','Пока нет оснований для устойчивого соглашения.');story.status='resolved';story.outcome='negotiated';recordChoice(s,story,'agreement',{npcId:n.id});if(goal)goal.status='resolved_by_agreement';return ok('Арка завершена договором; физические задачи и прежние последствия не объявлены исчезнувшими.','arc_negotiated');
      }
      if(a.op==='reputation_event'){
        const faction=s.world.rpg.factions.find(f=>(f.reputation.player||0)>=2);R(faction,'no_reputation_basis','Нужна накопленная репутация у существующей группы.');const next=arc(s,'Приглашение от '+faction.name,goal,'reputation');next.factionId=faction.id;return ok('Группа учитывает репутацию и предлагает новую историю.','reputation_story_started');
      }
      if(a.op==='location_change'){
        R(story&&story.status==='resolved','arc_unfinished','Нужно завершить связанную историю.');const location=s.world.locations.find(l=>l.id===story.locationId)||C.place(s);location.environment.improvement=(location.environment.improvement||0)+1;location.environment.descriptionAfter=story.outcome==='negotiated'?'Место стало общей площадкой для согласованных дел.':'Здесь заметны результаты завершённой истории.';story.consequences.push({type:'location_improved',locationId:location.id});s.world.rpg.settlement.infrastructure++;return ok('Завершённая история устойчиво изменила место; результат сохраняется.','location_transformed');
      }
      if(a.op==='finale'){
        R(s.world.rpg.arcs.some(a=>['resolved','failed'].includes(a.status)),'no_completed_arc','Сначала завершите хотя бы одну арку: результатом, договором или осознанным отказом.');const state={goals:s.world.rpg.goals.map(g=>({id:g.id,status:g.status})),arcs:s.world.rpg.arcs.map(a=>({id:a.id,outcome:a.outcome||a.status})),relations:Object.values(s.world.npcs).map(n=>({id:n.id,trust:n.trust,health:n.health,conflicts:n.grievances.filter(g=>!g.resolved).length})),cases:s.world.rpg.cases.map(c=>({id:c.id,status:c.status,verdict:c.verdict})),decisions:C.H.clone(s.world.rpg.settlement.decisions),money:s.world.player.money,locationId:s.world.player.location};
        const endings=state.arcs.map(a=>a.outcome);const ending=endings.includes('negotiated')?'agreement':state.relations.some(n=>n.trust>=3)?'alliance':endings.includes('abandoned')?'new_path':state.relations.some(n=>n.conflicts>0)?'unsettled_cost':'independent';s.world.rpg.ending={id:C.id(s,'ending'),kind:ending,state,time:s.world.rpg.clock.minute};return ok('Финал: '+({agreement:'договор изменил ход истории',alliance:'история привела к устойчивому союзу',new_path:'герой отказался от прежнего пути и выбрал новый',unsettled_cost:'результат достигнут ценой незавершённых конфликтов',independent:'герой завершил дело самостоятельно'}[ending])+'. Учтены отношения, расследования, цели и решения мира.','story_ended');
      }
      return null;
    }
    function tick(s){
      for(const goal of s.world.rpg.goals.filter(g=>g.status==='active')){
        for(const objective of goal.objectives.filter(o=>o.status==='pending'))if(satisfied(s,objective.condition)){objective.status='completed';objective.completed=s.world.rpg.clock.minute;goal.history.push({type:'progress',objectiveId:objective.id,actionId:s.currentActionId||'world',time:s.world.rpg.clock.minute});}
        if(satisfied(s,goal.condition)){goal.status='completed';goal.completed=s.world.rpg.clock.minute;C.event(s,'goal_completed',{goalId:goal.id});if(goal.bounty?.escrow&&!goal.bounty.claimed){const task=s.world.rpg.tasks.find(t=>t.goalId===goal.id&&t.status==='completed');if(task)C.money(s,'treasury',task.actorId,goal.bounty.amount,'bounty_paid');else C.money(s,'treasury','player',goal.bounty.amount,'bounty_returned');goal.bounty.claimed=true;}}
      }
      for(const arc of s.world.rpg.arcs.filter(a=>a.status==='active')){
        const goal=s.world.rpg.goals.find(g=>g.id===arc.goalId);if(goal?.status==='completed'){arc.status='resolved';arc.outcome='objective_completed';arc.completed=s.world.rpg.clock.minute;C.event(s,'arc_resolved',{arcId:arc.id,goalId:goal.id});}
        if(arc.threat&&!arc.threat.resolved&&s.world.rpg.clock.minute>=arc.threat.deadline){const n=s.world.npcs[arc.threat.npcId];if(n){n.health=Math.max(0,n.health-(arc.threat.damage||1));if(!n.health)n.status='incapacitated';}arc.status='failed';arc.outcome='missed_deadline';if(goal)goal.status='failed';C.event(s,'threat_realized',{arcId:arc.id,npcId:n?.id});}
      }
      for(const contract of s.world.rpg.contracts.filter(c=>c.auditAt&&s.world.rpg.clock.minute>=c.auditAt&&!c.auditDone)){contract.auditDone=true;if(!contract.fulfilled){const n=s.world.npcs[contract.employerId];C.H.social.record(s,'deception',{id:'audit:'+contract.id,actor:'player',text:'Ложный отчёт о заказе'},{targetId:contract.itemId||n.id,ownerId:n.id,onlyObserverId:n.id});contract.status='disputed';}}
    }
    return {handle,tick,createGoal,active,condition,satisfied,infer,arc,activeArc,recordChoice};
  }
  root.RpgGoals={create};
})(globalThis);
