/* Select knowledge, evaluate disclosure, compose a voice, then remember the actual exchange. */
(function(root){
  'use strict';
  function create(H){
    const {norm,clone,emit,log,dialogue,npc,here,openGrievances,social}=H;
    const Topics=root.ConversationTopics,Memory=root.ConversationMemory,Bio=root.NpcBiography,Personality=root.NpcPersonality;
    const current=(s,n)=>s.world.locations.find(place=>place.id===n.location);
    function init(s,config){Bio.init(s,config);for(const n of Object.values(s.world.npcs)){const m=Memory.init(n);if(n.secretRevealed)for(const fact of n.biography.facts.secret||[])if(!m.disclosedFacts.includes(fact.id))m.disclosedFacts.push(fact.id);}}
    function activePerson(s,a){return s.world.npcs[a.recipientId]||npc(s);}
    function playerAnswer(s,n,c){
      const m=n?.conversation,pending=m?.pendingNpcQuestion,text=String(c.originalText||c.text).trim();
      if(!pending||!dialogue.active(s,n)||s.turn-pending.askedTurn>12)return null;
      if(/^(?:не хочу (?:отвечать|говорить)|не скажу|это личное|не буду отвечать|пока не хочу|нет)[.! ]*$/iu.test(text))return {type:pending.type,declined:true,text};
      if(pending.type==='player_name'&&['custom','name'].includes(c.intent)&&(!c.semantic?.recognized||c.semantic.intent==='TALK')){
        const name=text.match(/^(?:меня зовут|мо[её] имя|зови меня|можете звать меня)\s+([А-ЯЁA-Z][а-яёa-z-]{1,35})(?:[.! ]|$)/u)?.[1]||text.match(/^([А-ЯЁA-Z][а-яёa-z-]{1,35})[.! ]*$/u)?.[1];
        if(name&&!['Привет','Спасибо','Извини','Хорошо','Ладно','Жду','Почему','Осматриваюсь','Нет','Да'].includes(name))return {type:pending.type,value:name,text};
      }
      if(pending.type==='player_goal'&&(/^(?:я\s+)?(?:ищу|хочу найти|хочу вернуть|мне нужно|моя цель|пришел за|пришла за)/iu.test(text)||c.intent==='custom'&&!/[?]/u.test(text)&&text.split(/\s+/).length<12&&!c.semantic?.unsupportedVerb))return {type:pending.type,value:text.replace(/^(?:я )?(?:ищу|хочу найти|моя цель\s*[:—]?|мне нужно)\s*/iu,'').replace(/[.!]+$/u,''),text};
      if(['motivation','intentions'].includes(pending.type)&&['custom','talk','goal'].includes(c.intent)&&!/[?]/u.test(text)&&!c.semantic?.unsupportedVerb)return {type:pending.type,value:text,text};
      return null;
    }
    function prepare(s,c,a){
      const mode=c.semantic?.mode,text=c.originalText||c.text,n=activePerson(s,a);
      if(a.recipientId==='player'||mode==='report'||['request_npc','request_plan','request_permission','claim','plant_evidence','show','give','borrow','rent','return_property','compensate','confess','promise','find_job','deliver_job','collect_pay','end_dialogue'].includes(a.intent))return;
      if(n?.conversation.pendingNpcQuestion&&(!dialogue.active(s,n)||s.turn-n.conversation.pendingNpcQuestion.askedTurn>4))n.conversation.pendingNpcQuestion=null;
      const answer=playerAnswer(s,n,c);
      if(answer){a.conversation={kind:'player_answer',...answer};a.intent='conversation_answer';c.intent='talk';c.speech=true;c.hypothetical=false;c.negated=false;a.negated=false;c.conversation=a.conversation;return;}
      if(mode==='negated'||c.negated)return;
      if(c.intent==='greet'&&a.recipientId!=='player'&&['execute','attempt'].includes(mode||'execute')){a.conversation={kind:'greeting',topicId:'name',raw:text};c.conversation=a.conversation;return;}
      let query=text;if(c.speech){const quoted=text.match(/[«"]([^»"]+)[»"]/u);if(quoted)query=quoted[1];}
      const context=n?.conversation||{};const request=Topics.resolve(query,{...context,activeTopic:dialogue.active(s,n)?context.activeTopic:null,people:Object.values(s.world.npcs)});
      if(!request)return;
      if(c.hypothetical&&!(request.confidence===1&&mode==='question')&&request.followUp!=='disagree'||['intention','hypothetical'].includes(mode)&&request.followUp!=='disagree')return;
      if(c.semantic?.recognized&&!['TALK'].includes(c.semantic.intent)&&!(request.confidence===1&&mode==='question')&&!(request.topicId==='address'&&/на ты|обращаться/iu.test(text)))return;
      if(['attack','threat','insult','destroy','burn','use','move','return','take','drop','repair','work','approach','inspect','canon'].includes(a.intent)&&!c.question&&!c.speech)return;
      if(n?.conversation)n.conversation.pendingNpcQuestion=null;
      a.conversation={kind:'question',...request,raw:text};c.conversation=a.conversation;a.intent='question';a.topicId=request.topicId;c.intent='question';c.question=true;c.speech=true;c.hypothetical=false;
      // An explicitly named interlocutor is selected from actual NPCs, never invented.
      const addressed=String(text).match(/^([^,:«»]{1,35})\s*[:,]\s*(.+)$/u);
      if(addressed){const person=Object.values(s.world.npcs).find(person=>root.StorySpatial.same(person.name,addressed[1]));if(person)a.recipientId=person.id;}
    }
    function dynamicFact(n,id,text,depth=0){return Bio.fact(n,id,text,{depth,source:'current-life'});}
    function known(n,id){return n.biography.facts[id]||[];}
    function knownItem(s,n,e){return Boolean(e&&!e.destroyed&&(e.location===n.id||e.ownerId===n.id&&e.location===current(s,n)?.name||e.known&&!e.hidden&&e.location===current(s,n)?.name||n.beliefs['entity:'+e.id+':location']));}
    function conflictText(s,n){
      const g=openGrievances(n)[0];if(!g)return 'Я не готов продолжать эту беседу.';
      const item=s.entities.find(e=>e.id===g.requiredItemId)?.label||g.requiredItem;
      if(g.kind==='theft')return g.reparation?'Вещь возвращена. Нужно ещё признать причину нашей ссоры.':'Сначала верните '+(item?'«'+item+'»':'взятую вещь')+'. Я помню, что произошло.';
      if(g.compensation)return 'Сначала нужно возместить ущерб: '+g.compensation+' монеты.';
      if(g.kind==='broken_promise')return 'Вы не выполнили обещание. Мне нужно увидеть, что на ваши слова снова можно положиться.';
      return 'Я помню причину нашей ссоры: '+g.reason+'. Признать её и исправить последствия важнее новых разговоров.';
    }
    function getNpcKnowledge(s,n,request){
      const id=request.topicId,place=current(s,n),m=n.conversation;
      let field=id;
      if(request.followUp){
        const parent=id?.split('.')[0];
        if(request.followUp==='reason')field=parent==='occupation'||parent==='work'?'occupation.motivation':parent+'.reason';
        else if(request.followUp==='past')field=known(n,parent+'.past').length?parent+'.past':['occupation','work','career'].includes(parent)?'previous_work':parent==='home'?'old_home':parent+'.past';
        else if(request.followUp==='personal_experience')field=parent+'.personal_experience';
        else if(request.followUp==='next')field=parent+'.next';
        else if(request.followUp==='elaborate'){
          const options=Object.entries(n.biography.facts).filter(([key])=>key.startsWith(parent+'.')&&key!==id&&!/secret|private/.test(key)).flatMap(([,facts])=>facts);
          const extra=options.filter(f=>!m.disclosedFacts.includes(f.id));
          return {status:extra.length?'known':m.lastClaim?'known':'unknown',facts:extra.length?extra:m.lastClaim?[m.lastClaim]:[],elaboration:!extra.length,field:parent};
        }else if(request.followUp==='certainty')return {status:m.lastClaim?'known':'unknown',facts:m.lastClaim?[m.lastClaim]:[],certainty:true,field:id};
        else if(request.followUp==='disagree')return {status:'known',facts:[dynamicFact(n,id,'Вы можете не соглашаться. Я не принимаю решения за вас; договорённость возникает только с вашего согласия.')],field:id};
      }
      if(known(n,field).length)return {status:'known',facts:known(n,field),field};
      if(!Bio.applicable(n,field))return {status:'not_applicable',facts:[],field};
      if(request.followUp)return {status:'unknown',facts:[],field};
      let text=null;
      if(id==='identity')text='Я — '+n.name+'. '+(known(n,'occupation')[0]?.text||'Сейчас я нахожусь здесь: '+place.name+'.');
      else if(id==='address')text='Можно обращаться ко мне по имени: '+n.name+'. '+(n.personality.assertiveness>.7&&n.trust<1?'Пока предпочитаю обращаться друг к другу на «вы».':'На «ты» можно, если вам так удобнее.');
      else if(id==='place'){
        if(n.identity.role==='memory_merchant'&&place.id===n.identity.originLocationId)text='Это лавка воспоминаний. Здесь торгуют воспоминаниями'+(/флакон/.test(norm(s.world.authorCanon.world))?', заключёнными во флаконы.':'.');
        else if(/мастерск/.test(norm(place.name)))text='Это мастерская. Здесь чинят вещи и делают детали для механизмов.';
        else if(/рынок/.test(norm(place.name)))text='Это рынок: здесь обмениваются товарами и договариваются о доставке.';
        else if(/площад/.test(norm(place.name)))text='Это площадь, где сходятся пути и встречаются местные жители.';
        else if(/лавк/.test(norm(place.name)))text='Это лавка. Сюда приходят за покупками и обменом.';
        else text=root.StoryNarrator.locationDescription(place.scene?.description||'',place.name);
      }else if(id==='surroundings'){
        const routes=s.world.edges.filter(edge=>edge.from===n.location&&!edge.sourceId).map(edge=>s.world.locations.find(place=>place.id===edge.to)?.name).filter(Boolean);text=routes.length?'Отсюда есть дороги: '+routes.join(', ')+'.':'Известного пути отсюда я не назову.';
      }else if(id==='people'||id==='notables'||id==='acquaintances'){
        const people=Object.values(s.world.npcs).filter(other=>other.id!==n.id&&(other.location===n.location||Object.hasOwn(n.social.profile.loyalties,other.id)||Object.values(n.social.knowledge).some(k=>k.reporterId===other.id)));
        const mentioned=Object.values(s.world.npcs).find(other=>other.id!==n.id&&root.StorySpatial.same((request.raw.match(/(?:знаете|знаешь|относитесь к|относишься к)\s+([^?!.]+)/iu)||[])[1]||'',other.name));
        const who=mentioned?people.filter(other=>other.id===mentioned.id):people;
        text=who.length?'Мне знакомы: '+who.map(other=>other.name+(n.social.profile.loyalties[other.id]===-1?' — мы не ладим':n.social.profile.loyalties[other.id]===1?' — мы союзники':'')).join(', ')+'.':null;
      }else if(id==='rules')text=n.social.profile.propertyRespect>=.5?'Здесь стоит спрашивать разрешение на чужие вещи и уважать личные границы.':'Сперва выясните, кто за что отвечает, и не считайте чужое согласие само собой разумеющимся.';
      else if(id==='availability'||id==='busy')text=n.social.attention==='busy'?'Сейчас я занят своим делом. На короткий вопрос время найдётся.':'Сейчас я могу немного поговорить.';
      else if(id==='trust'){
        const frame=Personality.frame(n);
        text=frame==='afraid'?'Я боюсь вас. Это не означает, что я вам доверяю.':frame==='hostile'||frame==='conflict'?conflictText(s,n):frame==='suspicious'?'У меня есть подозрения. Пока мне нужны подтверждённые поступки, а не заверения.':frame==='reconciled'?'Мы уладили причину ссоры, но я всё ещё осторожен. Доверие восстанавливается поступками.':n.trust>=3?'Я вам доверяю: для этого уже есть основания.':n.trust>0?'Я к вам расположен, но пока не готов доверить всё.':'Мы ещё мало знакомы. Пока я не могу говорить о личном доверии.';
      }else if(id==='impression')text=n.social.relationship.respect>=3&&n.trust<1?'Вы производите впечатление умелого человека. Но уважение к умению ещё не означает доверия.':n.social.relationship.affection>=2?'Мне приятно с вами говорить, хотя личные границы остаются.':n.social.relationship.suspicion>=2?'Ваши намерения пока вызывают вопросы.':'Мы только знакомимся. Я не спешу судить о вас.';
      else if(id==='conflicts')text=openGrievances(n).length?conflictText(s,n):n.grievances.length?'У нас были разногласия. Причина улажена, но я помню её.':'Между нами нет незавершённой ссоры.';
      else if(id==='mood')text=n.social.relationship.fear>=3?'Мне тревожно рядом с вами.':n.tension>=3?'Я сейчас напряжён.':openGrievances(n).length?'Мне трудно говорить спокойно после нашей ссоры.':'Сейчас я спокоен и могу поговорить.';
      else if(id==='worry')text=openGrievances(n).length?conflictText(s,n):'Сейчас я думаю о том, как '+n.motive+'.';
      else if(id==='help')text=n.identity.role==='craftsman'?'Если хотите помочь с мастерской, можно обсудить работу. Решение и договор нужно принять отдельно.':'Можете помочь мне с тем, что для меня важно: '+n.motive+'. Сначала договоримся о конкретном шаге.';
      else if(id==='expectations')text=n.social.relationship.reliability<0?'От вас я жду прежде всего выполнения уже данных обещаний.':'Мне важно, чтобы слова совпадали с делом. Если захотите помочь, обсудим конкретный шаг.';
      else if(id==='unfinished'){
        const promises=s.world.social.promises.filter(p=>p.recipientId===n.id&&p.status!=='fulfilled');text=promises.length?'Между нами остались обещания: '+promises.map(p=>p.text).join('; ')+'.':null;
      }else if(id==='rumors'){
        const entries=Object.values(n.social.knowledge).filter(k=>k.source==='report'||k.source==='witness').slice(-2);
        text=entries.length?entries.map(k=>{const event=s.world.social.events.find(e=>e.id===k.eventId),item=s.entities.find(e=>e.id===k.targetId)?.label||'вещи';return (k.source==='report'?'Мне рассказали':'Я заметил')+': '+(event?.type==='theft'?'пропала «'+item+'»':event?.type==='damage'?'повреждена «'+item+'»':'было неприятное происшествие')+'.';}).join(' '):null;
      }else if(id==='changes'){
        const observed=Object.values(n.beliefs).filter(b=>b.key.startsWith('entity:')&&b.key.endsWith(':condition')&&b.value==='repaired');text=observed.length?'Из того, что я видел: неисправная вещь снова работает.':null;
      }else if(id==='tools'){
        const e=s.entities.find(e=>e.id===request.targetId)||s.entities.find(e=>e.ownerId===n.id&&e.kind==='tool'&&knownItem(s,n,e));text=e&&knownItem(s,n,e)?'В моём деле используется «'+e.label+'». '+(e.description||'О назначении именно этой вещи больше сведений у меня нет.'):null;
      }else if(id==='obstacles'){
        const item=s.entities.find(e=>e.ownerId===n.id&&e.localKey==='mechanism'&&e.location===place.name&&!e.destroyed);text=item&&item.condition!=='repaired'?'Работе мешает неисправный механизм. Причину можно изучить на месте.':null;
      }
      return {status:text?'known':'unknown',facts:text?[dynamicFact(n,id,text,['trust','conflicts','impression','mood','availability','busy'].includes(id)?0:Topics.topic(id).depth)]:[],field};
    }
    function evidenceKnown(s,n,label){
      const e=s.entities.find(e=>root.StorySpatial.same(e.label,label));if(!e)return false;
      if(Object.values(n.researchKnowledge||{}).some(f=>f.sourceId===e.id))return true;
      return Object.values(n.beliefs).some(b=>Object.entries(b.sources||{}).some(([source,weight])=>(source==='genuine:'+e.id||source==='evidence:'+e.id)&&weight>0));
    }
    function evaluateDisclosure(s,n,topic,knowledge){
      const frame=Personality.frame(n),p=n.personality,r=n.social.relationship;
      if(frame==='hostile')return {mode:'refusal',frame,close:p.assertiveness>.6||p.patience<.4};
      if(knowledge.status==='not_applicable')return {mode:'not_applicable',frame};
      if(knowledge.status!=='known')return {mode:'unknown',frame};
      const accepted=[],withheld=[];
      for(const fact of knowledge.facts){
        if(n.conversation.disclosedFacts.includes(fact.id)){accepted.push(fact);continue;}
        const policy=fact.policy||{},depth=fact.depth??topic.depth;
        if(policy.invalid){withheld.push(fact);continue;}
        let allowed=true;
        const score=n.trust+.35*r.affection+.25*r.respect-.7*r.suspicion-.65*r.hostility;
        const threshold=depth<=1?-2:depth*.85+(1-p.openness)*1.6-.5*p.warmth;
        const explicitConditions=!policy.guarded&&['trust','affection','respect','evidence','decision','debt','deal','fear'].some(key=>policy[key]!==undefined);
        if(depth>=2&&!explicitConditions&&score<threshold)allowed=false;
        if(frame==='afraid'&&depth>=2)allowed=false;
        if(frame==='conflict'&&depth>=2)allowed=false;
        for(const [key,value]of Object.entries(policy))if(['trust','respect','affection'].includes(key)&&(key==='trust'?n.trust:r[key])<value)allowed=false;
        if(policy.evidence&&!evidenceKnown(s,n,policy.evidence))allowed=false;
        if(policy.decision&&s.facts.decision!==policy.decision)allowed=false;
        if(policy.debt&&!n.memory.debt)allowed=false;
        if(policy.deal&&!s.world.plans.some(plan=>plan.status==='completed'&&plan.actor===n.id&&String(plan.text||'').includes(policy.deal)))allowed=false;
        if(policy.guarded){
          const primary=s.entities.find(e=>e.source==='scene'&&e.kind==='clue');
          const proof=primary&&evidenceKnown(s,n,primary.label);
          const deed=n.conversation.relationshipCredits.some(id=>id.startsWith('work:'));
          if(!proof&&!deed&&!n.memory.debt)allowed=false;
        }
        if(policy.protects&&!policy.decision)allowed=false;
        if(policy.fear!==undefined&&r.fear>=policy.fear&&!policy.protects)allowed=true;
        (allowed?accepted:withheld).push(fact);
      }
      if(accepted.length)return {mode:'truthful',frame,facts:accepted};
      const cover=withheld.find(f=>f.policy?.cover),evasion=withheld.find(f=>f.policy?.evasion);
      return {mode:cover?'lie':evasion||p.directness<.3?'evasion':'withheld',frame,cover:cover?.policy.cover,evasion:evasion?.policy.evasion||(p.directness<.3?'Не ко всякой теме я сейчас готов подступиться. Давайте пока оставим её.':null)};
    }
    function canAsk(n,type){const m=n.conversation;return n.personality.curiosity>=.6&&n.personality.sociability>.25&&!m.askedQuestions[type]&&!m.declinedQuestions.includes(type)&&!['hostile','conflict','afraid'].includes(Personality.frame(n));}
    function continuation(s,n,request){
      const m=n.conversation;
      if(request.kind!=='greeting'&&['name','identity'].includes(request.topicId)&&n.personality.sociability<.6&&Personality.frame(n)==='neutral')return '';
      if(m.pendingNpcQuestion||s.turn-m.lastInitiativeTurn<(n.personality.impulsivity>.75?2:3))return '';
      if(!n.memory.playerName&&canAsk(n,'player_name')&&['name','identity','acquaintance'].includes(request.topicId))return Memory.ask(n,'player_name','А как зовут вас?',s.turn);
      if(!n.memory.playerGoal&&canAsk(n,'player_goal')&&['presence','place','goal','occupation'].includes(request.topicId))return Memory.ask(n,'player_goal','А что ищете вы?',s.turn);
      if(n.memory.playerGoal&&canAsk(n,'motivation')&&['goal','plans','help'].includes(request.topicId))return Memory.ask(n,'motivation','Вы говорили, что хотите '+n.memory.playerGoal+'. Почему это для вас важно?',s.turn);
      return '';
    }
    function availableActions(n){
      const frame=Personality.frame(n),r=n.social.relationship;
      if(frame==='hostile')return ['end_conversation','discuss_reparation'];
      if(frame==='conflict')return ['ask_public','discuss_reparation','apologize'];
      if(frame==='afraid')return ['ask_public','deescalate'];
      return ['ask_public',...(n.trust>=1&&r.suspicion<2?['ask_personal','request_advice']:[]),...(n.trust>=3&&r.reliability>=0?['ask_confidential','propose_joint_work']:[]),'end_conversation'];
    }
    function replyResult(s,n,request,parts,mode,facts=[],extra={}){
      const m=n.conversation,repeat=m.discussedTopics[request.topicId]?.truthfulCount||0,novel=facts.some(f=>!m.disclosedFacts.includes(f.id));
      const speech=Personality.compose({npc:n,parts,topic:request.topicId,repeat,mode,relationship:Personality.frame(n)});
      const follow=mode==='truthful'&&repeat===0?continuation(s,n,request):'';if(follow)speech.text+=' '+follow;
      const response={mode,facts,claim:mode==='truthful'?facts[0]||null:null};Memory.remember(n,request,response,s.turn);
      emit(s,'conversation_response',n.id,null,{topicId:request.topicId,facet:request.followUp||request.facet||null,responseMode:mode,factIds:facts.map(f=>f.id),availableActions:availableActions(n)});
      const token=dialogue.say(s,n,speech.text,'conversation',{manner:speech.manner});
      if(extra.close)dialogue.close(s,'hostile');
      if(request.topicId==='secret'&&mode==='truthful'){n.secretRevealed=true;s.secretRevealed=true;s.facts.secret=facts[0]?.text;n.memory.secret=facts[0]?.text;}
      return {status:mode==='refusal'?'refused':'success',code:'conversation_'+mode,text:token,conversation:{topicId:request.topicId,mode,followUp:request.followUp||null,availableActions:availableActions(n)},performed:true,completed:true,information:{novel:mode==='truthful'&&novel,discoveries:[],opportunities:availableActions(n)},effects:[]};
    }
    function handle(s,p,c,a){
      const request=a.conversation;if(!request)return null;
      const n=npc(s);if(!n||!here(s,n))return {status:'refused',code:'npc_absent',text:'Рядом нет собеседника, которому можно задать этот вопрос.',effects:[]};
      if(!dialogue.active(s,n))dialogue.start(s,n,'player_addressed');
      if(request.kind==='player_answer'){
        const type=request.type;Memory.answer(n,type,request.text,s.turn,request.declined);
        let text='Хорошо, не буду настаивать.';
        if(!request.declined){
          if(type==='player_name'){n.memory.playerName=request.value;s.facts.name=request.value;log(s,'fact','Имя героя: '+request.value);text='Запомню: '+request.value+'.';}
          if(type==='player_goal'){n.memory.playerGoal=request.value;s.facts.goal=request.value;text='Вы ищете '+request.value+'. Я услышал, что для вас важно.';}
          if(type==='intentions'){n.memory.playerIntentions=request.value;text='Ваше объяснение я услышал. Доверие будут определять поступки.';}
          if(type==='motivation'){n.memory.playerMotivation=request.value;text='Я запомню, почему для вас это важно.';}
          n.memory.heardNotes||=[];if(!n.memory.heardNotes.includes(request.text))n.memory.heardNotes.push(request.text);n.memory.heardNotes=n.memory.heardNotes.slice(-50);
        }
        emit(s,'conversation_player_answer',n.id,null,{type,value:request.declined?null:request.value,declined:Boolean(request.declined)});
        return {status:'success',code:request.declined?'conversation_answer_declined':'conversation_answer_remembered',text:dialogue.say(s,n,text,'conversation'),conversation:{mode:'player_answer',topicId:type},effects:[]};
      }
      if(request.kind==='greeting'){
        const count=s.seen.greet||0;s.seen.greet=count+1;if(count===0&&!openGrievances(n).length)social.change(s,n,{trust:1});
        if(['hostile','conflict'].includes(Personality.frame(n)))return replyResult(s,n,request,[n.name+'.',conflictText(s,n)],Personality.frame(n)==='hostile'?'refusal':'withheld',[],{close:Personality.frame(n)==='hostile'&&n.personality.assertiveness>.6});
        const fact=known(n,'name')[0],occupation=known(n,'occupation')[0];
        return replyResult(s,n,request,[(count?'Снова здравствуйте.':'Здравствуйте.')+' Я — '+n.name+'.',...(!count&&occupation?[occupation.text]:[])],'truthful',[fact]);
      }
      if(request.contextRequired)return replyResult(s,n,{...request,topicId:'unresolved'},['Уточните, к какой нашей теме относится этот вопрос.'],'unknown');
      const topic=Topics.topic(request.topicId),knowledge=getNpcKnowledge(s,n,{...request,targetId:a.targetId});
      const disclosure=evaluateDisclosure(s,n,topic,knowledge),frame=disclosure.frame;
      if(disclosure.mode==='refusal')return replyResult(s,n,request,[conflictText(s,n)],'refusal',[],{close:disclosure.close});
      if(disclosure.mode==='not_applicable')return replyResult(s,n,request,[n.identity.kind==='machine'?'Ко мне это не относится: у искусственного разума нет человеческой биографии.':'У меня иное устройство жизни. Этот человеческий опыт ко мне не относится.'],'not_applicable');
      if(disclosure.mode==='lie')return replyResult(s,n,request,[disclosure.cover],'lie');
      if(disclosure.mode==='evasion')return replyResult(s,n,request,[disclosure.evasion],'evasion');
      if(disclosure.mode==='withheld')return replyResult(s,n,request,[frame==='conflict'?conflictText(s,n):request.topicId==='secret'?'Я не готов раскрыть эту тайну. Одного расположения недостаточно; важны обстоятельства и обязательства перед другими.':'Об этом я знаю, но сейчас не готов говорить с вами так откровенно.'],'withheld');
      if(disclosure.mode==='unknown'){
        const special={age:'Точного возраста не назову — у меня нет достоверной даты.',tenure:'Точного срока или даты открытия я не знаю.',origin:'О своей родине мне сейчас нечего рассказать.',family:'О семье мне пока нечего рассказать.',friends:'Я пока не могу назвать близких друзей.',rumors:'Нового, что мне действительно известно, пока нет.',secret:'У меня нет тайны, о которой я мог бы рассказать.'};
        const text=request.followUp?'К теме «'+Topics.topic(request.topicId).label.toLowerCase()+'» это относится, но таких подробностей я не знаю.':special[request.topicId]||'О теме «'+topic.label.toLowerCase()+'» у меня нет сведений, которые я мог бы сообщить.';
        return replyResult(s,n,request,[text],'unknown');
      }
      let facts=(disclosure.facts||knowledge.facts).slice(0,n.personality.openness>.65?2:1),parts=facts.map(f=>f.text);
      if(request.topicId==='name'){
        parts=['Меня зовут '+n.name+'.'];
        if(frame==='trusted'){
          const extra=known(n,'name.private').filter(f=>evaluateDisclosure(s,n,topic,{status:'known',facts:[f]}).mode==='truthful');if(extra.length){facts=[...facts,...extra];parts.push(extra[0].text);}
        }
        if(frame==='suspicious'&&n.personality.caution>.5)parts.push(Memory.ask(n,'intentions','Зачем вам моё имя?',s.turn));
        if(frame==='friendly')parts.push('Мне приятно с вами говорить.');
        if(frame==='conflict')parts.push(conflictText(s,n));
      }
      if(knowledge.certainty&&facts[0])parts=['Это '+(facts[0].source==='current-life'?'то, что мне сейчас известно.':'то, что я знаю о себе или уже наблюдал.')+' '+facts[0].text];
      if(knowledge.elaboration)parts.push('Других подробностей к этому ответу у меня пока нет.');
      if(n.social.cautious&&request.topicId==='name')parts.push('Нашу прежнюю ссору я помню, хотя её причина улажена.');
      return replyResult(s,n,request,parts,'truthful',facts);
    }
    function observe(s,before,c,a,r){
      const work=s.world.loops.work,n=s.world.npcs[work.employer];
      if(!n||!here(s,n)||!['completed','paid'].includes(work.status)||!work.id)return;
      const credit='work:'+work.id,m=n.conversation;
      if(m.relationshipCredits.includes(credit)||before.work?.status===work.status||openGrievances(n).length)return;
      m.relationshipCredits.push(credit);social.change(s,n,{trust:1,respect:1,reliability:1});emit(s,'conversation_shared_experience',n.id,null,{kind:'completed_work',workId:work.id});
    }
    function unknown(s,p,c,a){
      const n=npc(s);if(!n||!here(s,n))return {status:'refused',code:'npc_absent',text:'Рядом нет собеседника.',effects:[]};
      const request={kind:'question',topicId:'unresolved',raw:c.originalText||c.text};
      return replyResult(s,n,request,['Не уверен, о чём именно вы спрашиваете. Уточните тему или свяжите вопрос с тем, что мы уже обсуждали.'],'unknown');
    }
    return {init,prepare,handle,observe,unknown,getNpcKnowledge,evaluateDisclosure,availableActions};
  }
  root.StoryConversation={create};
})(globalThis);
