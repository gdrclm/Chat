/* Physical acts, limited witness knowledge and individual judgements are separate records. */
(function(root){
  'use strict';
  function create(H){
    const {norm,words,stem,clone,emit,truth,log,findNpc,matchEntity,dialogue,conflict,openGrievances,moveActor,reconcile,flush,bind}=H;
    const clamp=(v,min=-5,max=5)=>Math.max(min,Math.min(max,v));
    const here=(s,n)=>dialogue.here(s,n);
    const fields=config=>String(config.canon||'').split('\n').map(line=>{const at=line.indexOf(':');return at<0?[]:[norm(line.slice(0,at)),line.slice(at+1).trim()];}).filter(row=>row.length);
    function profile(n){
      const q=norm(n.description+' '+n.motive),rogue=/вор|плут|контрабанд|разбой/.test(q),timid=/робк|трус|боязл|пуглив/.test(q),violent=/жесток|воин|разбой|боец/.test(q);
      return {lawfulness:rogue?.15:.8,propertyRespect:rogue?.35:.85,violenceTolerance:violent?.8:.15,forgiveness:/добр|мягк|милосерд/.test(q)?.8:.4,courage:timid?.15:violent?.9:.65,gossip:/молчалив|скрытн/.test(q)?.1:.65,taboos:[],loyalties:{}};
    }
    function init(s,config){
      s.world.social||={events:[],promises:[],reports:[],cases:[],laws:[],guards:[],zones:[],nextId:1};
      for(const n of Object.values(s.world.npcs)){
        n.social||={profile:profile(n),relationship:{respect:0,fear:0,suspicion:0,hostility:0,affection:0,reliability:0},knowledge:{},expected:{},missing:[],lastReactionTurn:-1,attention:/мастерск/.test(norm(s.world.locations.find(l=>l.id===n.location)?.name))?'busy':'watching'};
        n.health??=3;n.status||='active';
      }
      if(s.world.socialVersion===1)return;
      const owner=Object.values(s.world.npcs).find(n=>n.id===s.world.primaryNpcId&&/хозяйк|владел|хранител|сторож/.test(norm(n.description)));
      for(const e of s.entities){
        e.ownerId??=e.stockOwner||s.world.npcs[e.location]?.id||(e.location==='inventory'?'player':null)||(owner&&e.kind==='barrier'&&e.source==='scene'&&e.location===s.startPlace?owner.id:null);
        e.permissions||={};
      }
      for(const [key,value]of fields(config)){
        const args=value.split('|').map(v=>v.trim());
        if(key==='владелец'){
          const e=s.entities.find(e=>norm(e.label)===norm(args[0]))||matchEntity(s,args[0],true),n=findNpc(s,args[1]||'');if(e&&n)e.ownerId=n.id;
        }
        if(key==='внимание'){const n=findNpc(s,args[0]);if(n)n.social.attention=/спит/.test(norm(args[1]))?'asleep':/занят|отверн/.test(norm(args[1]))?'busy':'watching';}
        if(key==='мораль'){
          const n=findNpc(s,args[0]);if(n)for(const pair of (args[1]||'').split(/[;,]/)){const [name,raw]=pair.split('=').map(v=>v.trim());const aliases={законность:'lawfulness',собственность:'propertyRespect',насилие:'violenceTolerance',прощение:'forgiveness',смелость:'courage',слухи:'gossip'};const attr=aliases[norm(name)]||name;if(attr in n.social.profile&&Number.isFinite(Number(raw)))n.social.profile[attr]=clamp(Number(raw),0,1);}
        }
        if(key==='лояльность'){const a=findNpc(s,args[0]),b=findNpc(s,args[1]);if(a&&b)a.social.profile.loyalties[b.id]=/враг/.test(norm(args[2]))?-1:1;}
        if(key==='запрет npc'){const n=findNpc(s,args[0]);if(n)n.social.profile.taboos=(args[1]||'').split(',').map(norm);}
        if(key==='закрытая зона'){const place=s.world.locations.find(l=>norm(l.name)===norm(args[0])),n=findNpc(s,args[1]);if(place&&n)s.world.social.zones.push({locationId:place.id,ownerId:n.id});}
        if(key==='страж'){const n=findNpc(s,args[0]);if(n)s.world.social.guards.push(n.id);}
        if(key==='закон'){const place=s.world.locations.find(l=>norm(l.name)===norm(args[0])),fine=Number((args[2]||'').match(/\d+/)?.[0]);if(place&&fine)s.world.social.laws.push({locationId:place.id,type:({кража:'theft',порча:'damage',нападение:'assault'})[norm(args[1])]||norm(args[1]),fine});}
      }
      for(let depth=0;depth<8;depth++)for(const e of s.entities)if(!e.ownerId&&e.containerId)e.ownerId=s.entities.find(parent=>parent.id===e.containerId)?.ownerId||null;
      for(const e of s.entities)if(e.ownerId&&s.world.npcs[e.ownerId])s.world.npcs[e.ownerId].social.expected[e.id]=e.location;
      s.world.socialVersion=1;
    }
    function permitted(s,e,right='use'){
      if(!e?.ownerId||e.ownerId==='player')return true;
      if(e.loan?.borrowerId==='player'&&!e.loan.returned&&(!e.loan.deadline||s.turn<=e.loan.deadline)&&['take','use'].includes(right))return true;
      if(e.permissions?.player?.includes(right))return true;
      const p=s.world.player.permissions?.[e.ownerId];return Boolean(p?.private&&e.private||p?.tools&&['bench','tools','mechanism'].includes(e.localKey));
    }
    function visible(s,n,a){
      if(!here(s,n)||n.social.attention==='asleep')return false;
      const text=norm(a.text||''),stealth=/незаметно|тайно|скрытно|пока .*работает/.test(text)||a.semantic?.variant==='steal'&&a.semantic?.manner?.includes('скрытно');
      if(s.facts.hidden)return false;
      return !(stealth&&n.social.attention==='busy');
    }
    function change(s,n,delta){
      const before={trust:n.trust,...n.social.relationship};
      for(const [key,value]of Object.entries(delta))if(key==='trust')n.trust=clamp(n.trust+value);else if(key in n.social.relationship)n.social.relationship[key]=clamp(n.social.relationship[key]+value,['fear','suspicion','hostility'].includes(key)?0:-5,5);
      if(n.id===s.world.boundNpcId)s.trust=n.trust;
      emit(s,'relationship_changed',n.id,before,{trust:n.trust,...n.social.relationship});
    }
    function say(s,n,text,trigger='witness_event'){return dialogue.say(s,n,text,trigger);}
    function reaction(s,n,event,knowledge){
      if(!here(s,n)||n.social.lastReactionTurn===s.turn)return;
      const known=knowledge.actorId==='player',item=s.entities.find(e=>e.id===event.targetId),label=item?.label||'имущество';
      const lines={theft:known?'Я видел, как вы забрали «'+label+'» без разрешения. Верните вещь.':'Здесь пропала вещь. Я пока не знаю, кто её забрал.',theft_attempt:'Я заметил попытку забрать чужую вещь. Остановитесь.',damage:'Вы повредили «'+label+'». Нужно исправить ущерб или возместить его.',assault:'Не подходите. Я буду защищаться.',threat:'После угроз я не стану вам доверять.',insult:'Так со мной разговаривать не нужно.',deception:'Теперь у меня есть основание не доверять прежним словам.',broken_promise:'Вы не выполнили обещание в согласованный срок.',trespass:'Здесь закрытая зона. У вас нет разрешения.',unauthorized_use:'Это чужие инструменты. Сначала договоритесь с владельцем.',framing:'Я вижу попытку выдать подставное свидетельство за независимое доказательство.',complicity:'Я запомню, что вы помогли участнику нарушения.'};
      if(n.social.profile.courage<.4&&event.ownerId!==n.id){emit(s,'silent_social_reaction',n.id,null,{eventId:event.id});return;}
      let text=lines[knowledge.understoodAs||event.type]||lines[event.type];if(!text)return;
      if(!known&&event.type==='damage')text='«'+label+'» повреждён. Я пока не знаю, кто это сделал.';
      if(knowledge.source==='report')text='Мне рассказали о вашем поступке. Я не видел его сам; хочу объяснений.';
      if(['theft','theft_attempt'].includes(event.type)&&event.ownerId!==n.id)text=n.social.profile.propertyRespect<.5?'Ловко. Но свои ценные вещи я при вас оставлять не буду.':'Я заметил, как вы берёте чужое. Владелец должен об этом узнать.';
      n.social.lastReactionTurn=s.turn;say(s,n,text);emit(s,'npc_social_reaction',n.id,null,{eventId:event.id,source:knowledge.source});
    }
    function evaluate(s,n,event,knowledge){
      event.evaluations||={};if(event.evaluations[n.id])return;
      if(!knowledge.actorId){n.social.alert=true;return;}
      if(knowledge.actorId!=='player'){n.social.opinions||={};n.social.opinions[knowledge.actorId]={eventId:event.id,type:event.type,source:knowledge.source,trust:-1,turn:s.turn};event.evaluations[n.id]={turn:s.turn,source:knowledge.source,actorId:event.actorId};return;}
      const p=n.social.profile,own=event.ownerId===n.id,loyalty=p.loyalties[event.ownerId]||0,priorTrust=n.trust;
      let delta={};
      if(['theft','theft_attempt','damage','unauthorized_use','trespass'].includes(event.type)){
        const condemns=own||loyalty>0||p.propertyRespect>=.5||p.lawfulness>=.8||p.taboos.includes(event.type);
        delta=condemns?{trust:own?-2:-1,respect:-1,suspicion:own?2:1,hostility:own?1:0,affection:-1}:{respect:loyalty<0?1:0,suspicion:own?1:0};
      }else if(event.type==='assault')delta={trust:-2,fear:p.courage<.4?3:1,hostility:p.violenceTolerance>.6?3:2,respect:-1,affection:-2};
      else if(event.type==='threat')delta={trust:-1,fear:p.courage<.4?2:1,hostility:p.courage>.7?2:1,respect:-1};
      else if(event.type==='insult')delta={respect:-1,hostility:1,affection:-1};
      else if(event.type==='broken_promise')delta={trust:-1,reliability:-2,suspicion:1};
      else delta={trust:-1,respect:-1,suspicion:2,reliability:-1};
      if(p.taboos.includes(event.type)){delta.trust=(delta.trust||0)-1;delta.hostility=(delta.hostility||0)+1;}
      change(s,n,delta);event.evaluations[n.id]={turn:s.turn,source:knowledge.source,priorTrust,delta};
      if(own||['assault','threat','insult','deception','framing','broken_promise'].includes(event.type)){
        let g=openGrievances(n).find(g=>(g.kind===event.type||event.type==='framing'&&g.kind==='staged_evidence')&&g.turn===s.turn);
        g||=conflict(s,n,event.type,event.type+': '+(s.entities.find(e=>e.id===event.targetId)?.label||event.reason||'поступок героя'));
        if(!g.socialEventId)g.socialEventId=event.id;
        if(['theft','damage','unauthorized_use','trespass'].includes(event.type)){g.requiredItemId=event.targetId;g.requiredItem=s.entities.find(e=>e.id===event.targetId)?.label||'возмещение';g.compensation=event.type==='damage'?(s.entities.find(e=>e.id===event.targetId)?.price||3):0;g.trustBefore=priorTrust;if(event.type==='theft'&&event.propertyReturned)g.reparation=true;}
      }
      if(['theft','damage','assault','trespass','unauthorized_use'].includes(event.type)){n.social.accessRestricted=true;emit(s,'access_restricted',n.id,null,{eventId:event.id});}
      reaction(s,n,event,knowledge);
      if(event.type==='insult'&&s.world.activeNpcId===n.id)dialogue.close(s,'insulted');
      if(event.type==='assault'&&n.social.profile.courage<.4&&n.health>0){
        const exit=s.world.edges.find(edge=>edge.from===n.location&&!s.entities.find(e=>e.id===edge.barrierId&&e.locked&&!e.opened));
        if(exit){const target=s.world.locations.find(place=>place.id===exit.to);const r=moveActor(s,n.id,target);if(r.status==='success')emit(s,'npc_fled',n.id,null,{eventId:event.id,destination:target.id});}
      }
    }
    function learn(s,n,event,source='witness',actorKnown=true,reporterId=null){
      const old=n.social.knowledge[event.id];if(old&&old.confidence>= (source==='report'?.75:1))return;
      const knowledge={eventId:event.id,source,reporterId,actorId:actorKnown?(source==='property_identified'?'player':event.actorId):null,targetId:event.targetId,confidence:source==='report'?.75:source==='property_identified'?.8:actorKnown?1:.3,turn:s.turn,understoodAs:event.type};
      n.social.knowledge[event.id]=knowledge;emit(s,'social_knowledge',n.id,old||null,knowledge);
      if(!old?.actorId&&knowledge.actorId)evaluate(s,n,event,knowledge);
    }
    function record(s,type,a,options={}){
      const data=s.world.social,existing=data.events.find(event=>event.cause===a.id&&event.type===type&&event.targetId===options.targetId);if(existing)return existing;
      const event={id:'social:'+data.nextId++,type,actorId:a.actor||'player',targetId:options.targetId||a.targetId||null,ownerId:options.ownerId||null,locationId:s.world.player.location,witnesses:[],detected:false,resolved:false,turn:s.turn,cause:a.id,evaluations:{},...options};
      data.events.push(event);data.events=data.events.slice(-160);
      for(const n of Object.values(s.world.npcs)){
        if(options.onlyObserverId&&options.onlyObserverId!==n.id)continue;
        const direct=options.directId===n.id&&here(s,n)&&n.social.attention!=='asleep';
        if(direct||visible(s,n,a)){event.witnesses.push(n.id);learn(s,n,event,'witness',true);}
      }
      event.detected=event.witnesses.length>0;emit(s,'social_event',event.id,null,event,a.id);return event;
    }
    function object(s,a,c){return s.entities.find(e=>e.id===a.targetId)||matchEntity(s,c.text,true);}
    function handle(s,p,c,a){
      if(c.hypothetical||c.negated||['intention','question','hypothetical','negated','report','speech'].includes(c.semantic?.mode))return null;
      const e=object(s,a,c),n=s.world.npcs[a.recipientId]||s.world.npcs[s.world.boundNpcId];
      if(['borrow','rent'].includes(a.intent)){
        const owner=e&&s.world.npcs[e.ownerId];if(!e||!owner)return {status:'clarification',code:'missing_loan_item',text:'Какую принадлежащую персонажу вещь вы просите одолжить?',effects:[]};
        if(!here(s,owner))return {status:'refused',code:'owner_absent',text:'Владельца сейчас нет рядом.',effects:[]};
        dialogue.start(s,owner);if((openGrievances(owner).length||owner.social.accessRestricted)&&!(owner.social.coercedUntil>=s.turn&&owner.social.profile.courage<.4))return {status:'refused',code:'unresolved_conflict',text:say(s,owner,'После случившегося я пока не готов одалживать вещи.','permission_request'),effects:[]};
        if(owner.social.cautious&&!/под присмотром/.test(norm(c.text)))return {status:'refused',code:'supervision_required',text:say(s,owner,'После случившегося ценные инструменты одолжу только под присмотром.','permission_request'),effects:[]};
        if(!e.portable||![s.place,owner.id].includes(e.location))return {status:'refused',code:'loan_unavailable',text:'Эту вещь сейчас нельзя передать.',effects:[]};
        const rent=a.intent==='rent',fee=1;
        if(rent&&s.world.player.money<fee)return {status:'refused',code:'insufficient_rent',text:'Аренда на пять ходов стоит одну монету. При вас недостаточно денег.',effects:[]};
        if(rent){s.world.player.money-=fee;truth(s,'player:money',s.world.player.money);}
        e.loan={ownerId:owner.id,borrowerId:'player',turn:s.turn,returned:false,...(rent?{rental:true,fee,deadline:s.turn+5}:{})};e.location='inventory';e.hidden=false;e.known=true;if(!s.inventory.includes(e.label))s.inventory.push(e.label);s.focus=e.id;
        emit(s,'loan_granted',e.id,null,e.loan,a.id);return {status:'success',code:rent?'rental_granted':'loan_granted',text:say(s,owner,rent?'Аренда «'+e.label+'» оплачена на пять ходов. После этого нужно вернуть вещь.':'Одолжу «'+e.label+'». Владельцем остаюсь я; верните после работы.','permission_request'),effects:[]};
      }
      if(a.intent==='return_property'){
        if(!e||e.location!=='inventory'||!e.ownerId||e.ownerId==='player')return {status:'refused',code:'nothing_to_return',text:'При вас нет названной чужой вещи.',effects:[]};
        const owner=s.world.npcs[e.ownerId],quiet=/незаметно|тайно/.test(norm(c.originalText||c.text));const expected=owner.social.expected[e.id];
        if(!here(s,owner)&&expected!==s.place)return {status:'refused',code:'return_elsewhere',text:'Нужно добраться до владельца или места, где он оставил вещь.',effects:[]};
        e.location=quiet?s.place:here(s,owner)?owner.id:s.place;e.concealed=false;s.inventory=s.inventory.filter(v=>v!==e.label);if(e.loan)e.loan.returned=true;
        const observed=here(s,owner)&&visible(s,owner,a);
        if(observed){for(const g of openGrievances(owner))if(g.requiredItemId===e.id&&['theft','unauthorized_use'].includes(g.kind))g.reparation=true;}else e.returnPendingOwner=true;
        if(observed&&openGrievances(owner).some(g=>g.apology&&g.reparation)){if(s.world.boundNpcId!==owner.id){flush(s);bind(s,owner.id);}reconcile(s,owner);}
        for(const event of s.world.social.events.filter(event=>event.type==='theft'&&event.targetId===e.id))event.propertyReturned=true;
        if(!quiet&&here(s,owner)){dialogue.start(s,owner);say(s,owner,'«'+e.label+'» возвращён. Это важно, но я помню, что произошло.','reparation');}
        emit(s,'property_returned',e.id,'inventory',e.location,a.id);return {status:'success',code:'property_returned',text:'Вы возвращаете «'+e.label+'». Владение не меняется; вещь больше не у вас.',effects:[]};
      }
      if(a.intent==='compensate'){
        if(!n||!here(s,n))return {status:'refused',code:'npc_absent',text:'Для компенсации нужно встретиться с пострадавшим.',effects:[]};
        const g=openGrievances(n).find(g=>g.compensation>0&&!g.reparation);if(!g)return {status:'clarification',code:'no_damage_debt',text:'Не установлено, какой ущерб и в каком размере нужно возместить.',effects:[]};
        const amount=Number((c.text.match(/\d+/)||[])[0]||g.compensation);if(amount<=0||s.world.player.money<amount)return {status:'refused',code:'insufficient_compensation',text:'Нужно выплатить '+amount+' монеты. При вас: '+s.world.player.money+'.',effects:[]};
        s.world.player.money-=amount;g.compensation=Math.max(0,g.compensation-amount);g.reparation=g.compensation===0;truth(s,'player:money',s.world.player.money);
        if(g.reparation&&g.apology)reconcile(s,n);
        emit(s,'damage_compensated',n.id,null,{amount,conflictId:g.id},a.id);return {status:g.compensation?'partial_success':'success',code:g.compensation?'partial_compensation':'compensated',completed:true,text:say(s,n,g.compensation?'Часть компенсации получена. Осталось возместить '+g.compensation+' монеты.':'Компенсация получена. Доверие не возвращается сразу; нам ещё нужно обсудить случившееся.','reparation'),effects:[]};
      }
      if(a.intent==='pay_fine'){
        const item=s.world.social.cases.find(item=>item.status==='unpaid'&&here(s,s.world.npcs[item.guardId]));
        if(!item)return {status:'refused',code:'no_local_fine',text:'Здесь нет уполномоченного стража с назначенным вам штрафом.',effects:[]};
        if(s.world.player.money<item.fine)return {status:'refused',code:'insufficient_fine',text:'Не хватает монет для уплаты штрафа.',effects:[]};
        s.world.player.money-=item.fine;item.status='paid';item.paidTurn=s.turn;truth(s,'player:money',s.world.player.money);emit(s,'fine_paid',item.id,null,{amount:item.fine},a.id);
        return {status:'success',code:'fine_paid',text:'Штраф уплачен: '+item.fine+' монеты. Возврат имущества и отношения с пострадавшим остаются отдельными обязательствами.',effects:[]};
      }
      if(a.intent==='report_event'){
        if(!n||!here(s,n))return {status:'refused',code:'npc_absent',text:'Получателя сообщения нет рядом.',effects:[]};
        const event=[...s.world.social.events].reverse().find(e=>e.actorId!=='player'&&e.witnesses.includes('player'));
        if(!event)return {status:'clarification',code:'no_witnessed_event',text:'У вас нет зафиксированного наблюдения, которое можно подтвердить. Непроверенную версию можно сообщить как обычное утверждение.',effects:[]};
        learn(s,n,event,'report',true,'player');s.world.social.reports.push({eventId:event.id,from:'player',to:n.id,turn:s.turn});
        return {status:'success',code:'event_reported',text:say(s,n,'Я услышал рассказ. Это сообщение свидетеля, а не моё собственное наблюдение.'),effects:[]};
      }
      if(a.intent==='complicity'){
        const offender=findNpc(s,c.text,true),event=[...s.world.social.events].reverse().find(e=>offender&&e.actorId===offender.id&&e.detected&&!e.resolved);
        if(!event||!here(s,offender))return {status:'clarification',code:'no_offender_context',text:'Для помощи нарушителю нужен существующий поступок и находящийся рядом участник. Кого и каким способом вы хотите прикрыть?',effects:[]};
        record(s,'complicity',a,{targetId:offender.id,ownerId:event.ownerId,relatedEventId:event.id});change(s,offender,{trust:1,respect:1});
        return {status:'success',code:'offender_protected',text:'Вы выступаете на стороне '+offender.name+'. Это укрепляет вашу связь с участником нарушения; свидетели запоминают соучастие.',effects:[]};
      }
      if(a.intent==='confess'){
        const event=[...s.world.social.events].reverse().find(event=>event.actorId==='player'&&(!n||event.ownerId===n.id)&&!event.resolved);
        if(!event||!n||!here(s,n))return {status:'clarification',code:'missing_confession_context',text:'В каком конкретном поступке и перед кем вы признаётесь?',effects:[]};
        dialogue.start(s,n);learn(s,n,event,'confession',true);event.confessed=true;return {status:'success',code:'confessed',text:say(s,n,'Вы признались. Теперь я знаю, что произошло; нужно ещё исправить последствия.','reparation'),effects:[]};
      }
      if(a.intent==='promise'){
        if(!n||!here(s,n))return {status:'refused',code:'npc_absent',text:'Здесь некому дать обещание.',effects:[]};
        const deadline=c.text.match(/через\s+(\d+)\s+ход/iu);const promise={id:'promise:'+s.world.social.nextId++,actorId:'player',recipientId:n.id,text:c.originalText||c.text,targetId:e?.id||null,condition:/верну|возвра/.test(norm(c.text))?'return':null,deadline:deadline?s.turn+Number(deadline[1]):null,status:'pending'};s.world.social.promises.push(promise);s.facts.promise=promise.text;
        return {status:'success',code:'promise_recorded',text:say(s,n,'Обещание я запомню. Надёжность покажут ваши действия.'),effects:[]};
      }
      const text=norm(c.originalText||c.text),target=findNpc(s,text,true)||(/тебя|тебе|тобой|нападаю|атакую/.test(text)?n:null);
      if(target&&(!e||/оскорб|угрожа|убью/.test(text))&&(['attack','threat'].includes(a.intent)||/угрожа/.test(text))){
        const type=/угрожа|убью/.test(text)?'threat':'assault';if(!here(s,target))return {status:'refused',code:'npc_absent',text:'Персонаж находится в другом месте.',effects:[]};
        target.tension=Math.min(5,target.tension+2);if(target.id===s.world.boundNpcId)s.tension=target.tension;
        if(type==='assault')target.health=Math.max(0,target.health-1);
        record(s,type,a,{targetId:target.id,ownerId:target.id,directId:target.id});if(type==='threat'&&target.social.profile.courage<.4)target.social.coercedUntil=s.turn+2;
        if(target.health===0){target.status='incapacitated';dialogue.close(s,'assaulted');}
        return {status:'success',code:type==='assault'?'npc_attacked':'npc_threatened',text:type==='assault'?target.name+' получает удар и отступает. Нападение имеет реальные последствия.':'Вы угрожаете '+target.name+'. Страх не означает доверия.',socialHandled:true,effects:[]};
      }
      if(a.intent==='take'&&e?.ownerId&&!permitted(s,e,'take')&&s.world.npcs[e.location]){
        const holder=s.world.npcs[e.location];if(visible(s,holder,a)){record(s,'theft_attempt',a,{targetId:e.id,ownerId:e.ownerId});return {status:'refused',code:'theft_blocked',text:'Владелец удерживает «'+e.label+'»; забрать её из рук не удалось.',effects:[]};}
        a.allowTakingHeld=true;
      }
      return null;
    }
    function after(s,before,c,a,r){
      if(r.socialHandled)return;
      const acted=!['refused','clarification'].includes(r.status)&&r.performed!==false;
      if(acted)for(const e of s.entities){const old=before.entities.find(old=>old.id===e.id);if(!old)continue;
        if(e.location==='inventory'&&old.location!=='inventory'){
          if(e.ownerId&&!permitted(s,e,'take')){e.concealed=/незаметно|тайно|скрытно/.test(norm(a.text))||Boolean(s.facts.hidden);record(s,'theft',a,{targetId:e.id,ownerId:e.ownerId});}
          else if(!e.ownerId)e.ownerId='player';
        }
        if(e.ownerId&&e.ownerId!=='player'&&!old.destroyed&&e.destroyed)record(s,'damage',a,{targetId:e.id,ownerId:e.ownerId});
        if(a.intent==='give'&&old.location==='inventory'&&s.world.npcs[e.location]&&(!e.ownerId||e.ownerId==='player'))e.ownerId=e.location;
        if(a.intent==='use'&&a.targetId===e.id&&e.ownerId&&!permitted(s,e,'use'))record(s,'unauthorized_use',a,{targetId:e.id,ownerId:e.ownerId});
      }
      if(acted&&a.intent==='insult'){const n=s.world.npcs[a.recipientId];if(n&&here(s,n))record(s,'insult',a,{targetId:n.id,ownerId:n.id,directId:n.id});}
      if(acted&&['move','return'].includes(a.intent)&&before.player.location!==s.world.player.location){
        for(const n of Object.values(s.world.npcs))if(n.location===before.player.location&&!['incapacitated','dead'].includes(n.status))for(const g of openGrievances(n))if(['trespass','unauthorized_use'].includes(g.kind))g.reparation=true;const zone=s.world.social.zones.find(zone=>zone.locationId===s.world.player.location);if(zone&&!s.world.player.permissions?.[zone.ownerId]?.zone)record(s,'trespass',a,{targetId:zone.locationId,ownerId:zone.ownerId});}
      if(acted&&a.intent==='plant_evidence'){
        const e=s.entities.find(e=>e.id===a.targetId);if(e?.evidence?.witnessedBy?.length)record(s,'framing',a,{targetId:e.id,ownerId:null});
      }
      if(acted&&a.intent==='claim'){
        const n=s.world.npcs[a.recipientId];if(n&&here(s,n)){
          const known=Object.values(n.beliefs).find(b=>b.certainty==='known'&&b.sources?.canon&&s.facts.claim&&norm(s.facts.claim).includes(b.key)&&!norm(s.facts.claim).includes(norm(b.value)));
          if(known)record(s,'deception',a,{targetId:n.id,ownerId:n.id,onlyObserverId:n.id,reason:'Версия противоречит известному свидетелю факту.'});
        }
      }
      if(acted&&a.intent==='show'){
        const shown=s.entities.find(e=>e.id===a.targetId),recipient=s.world.npcs[a.recipientId];
        if(shown&&recipient&&here(s,recipient)&&shown.location==='inventory'&&!shown.loan){
          const theft=[...s.world.social.events].reverse().find(event=>event.type==='theft'&&event.targetId===shown.id&&event.ownerId===recipient.id&&!event.propertyReturned);
          if(theft&&recipient.social.knowledge[theft.id]?.source==='missing')learn(s,recipient,theft,'property_identified',true);
        }
        const carrier=s.entities.find(e=>e.id===a.targetId),n=s.world.npcs[a.recipientId];
        if(carrier?.evidence?.authenticity==='genuine'&&n&&here(s,n)){
          const prop=carrier.evidence.proposition;
          const old=before.npcBeliefs?.[n.id]?.[prop.key];
          if(old?.sources?.player&&norm(old.value)!==norm(prop.value)){
            n.beliefs[prop.key]={...prop,confidence:1,certainty:'known',sources:{['genuine:'+carrier.id]:1},turn:s.turn};delete n.agenda;
            record(s,'deception',a,{targetId:carrier.id,ownerId:n.id,onlyObserverId:n.id,reason:'Подлинный источник опроверг прежние слова.'});
          }
        }
      }
      for(const n of Object.values(s.world.npcs))for(const g of n.grievances){
        if(g.resolved&&g.socialEventId){const event=s.world.social.events.find(event=>event.id===g.socialEventId);if(event)event.resolved=true;n.social.cautious=true;}
      }
    }
    function permitsObservation(s,n,e,a){
      const events=s.world.social.events.filter(event=>event.cause===a.id&&event.targetId===e.id&&['theft','damage'].includes(event.type));
      return events.length?events.some(event=>event.witnesses.includes(n.id)):!e.concealed&&visible(s,n,a);
    }
    function tick(s){
      for(const n of Object.values(s.world.npcs)){
        if(['incapacitated','dead'].includes(n.status)||n.social.attention==='asleep')continue;
        for(const [id,expected]of Object.entries(n.social.expected)){
          const e=s.entities.find(e=>e.id===id);
          if(e?.returnPendingOwner&&e.location===expected&&here(s,n)){delete e.returnPendingOwner;for(const g of openGrievances(n))if(g.requiredItemId===e.id&&['theft','unauthorized_use'].includes(g.kind))g.reparation=true;emit(s,'returned_property_found',e.id,null,{ownerId:n.id});}
          if(!e||n.social.missing.includes(id)||e.location===expected||e.location===n.id||e.loan&&!e.loan.returned)continue;
          const event=[...s.world.social.events].reverse().find(event=>event.type==='theft'&&event.targetId===id&&!event.propertyReturned);if(!event||s.turn-event.turn<2||s.world.locations.find(loc=>loc.id===n.location)?.name!==expected)continue;
          if(n.social.knowledge[event.id]?.actorId){n.social.missing.push(id);continue;}
          n.social.missing.push(id);n.social.alert=true;n.social.attention='watching';n.social.knowledge[event.id]||={eventId:event.id,source:'missing',actorId:null,targetId:id,confidence:.3,turn:s.turn};
          if(here(s,n))change(s,n,{suspicion:1});
          emit(s,'property_missing_discovered',n.id,null,{targetId:id,eventId:event.id});reaction(s,n,event,n.social.knowledge[event.id]);
        }
        for(const event of s.world.social.events.filter(event=>event.ownerId===n.id&&event.type==='damage'&&!n.social.knowledge[event.id]&&s.turn-event.turn>=2)){
          const item=s.entities.find(e=>e.id===event.targetId);if(!item||item.location!==s.world.locations.find(loc=>loc.id===n.location)?.name)continue;
          learn(s,n,event,'damage_discovered',false);n.social.alert=true;reaction(s,n,event,n.social.knowledge[event.id]);
        }
        for(const knowledge of Object.values(n.social.knowledge).filter(k=>k.actorId&&k.source==='witness'&&s.turn-k.turn>=2)){
          const event=s.world.social.events.find(e=>e.id===knowledge.eventId),owner=event&&s.world.npcs[event.ownerId];
          if(!owner||owner.id===n.id||owner.location!==n.location||n.social.profile.gossip<.5||owner.social.knowledge[event.id]?.actorId||!here(s,n)||owner.social.attention==='asleep')continue;
          learn(s,owner,event,'report',true,n.id);s.world.social.reports.push({eventId:event.id,from:n.id,to:owner.id,turn:s.turn});
        }
      }
      for(const promise of s.world.social.promises.filter(p=>p.status==='pending')){
        const e=s.entities.find(e=>e.id===promise.targetId);if(promise.condition==='return'&&e?.ownerId===promise.recipientId&&(e.location===promise.recipientId||e.loan?.returned)){promise.status='fulfilled';continue;}
        if(promise.condition&&promise.deadline!==null&&s.turn>promise.deadline){promise.status='broken';const a={id:promise.id,actor:'player',text:promise.text,targetId:promise.targetId};const event=record(s,'broken_promise',a,{ownerId:promise.recipientId,targetId:promise.targetId,witnesses:[],onlyObserverId:promise.recipientId});const n=s.world.npcs[promise.recipientId];learn(s,n,event,'promise',true);}
      }
      for(const event of s.world.social.events){
        const law=s.world.social.laws.find(law=>law.type===event.type&&law.locationId===event.locationId);if(!law||s.world.social.cases.some(item=>item.eventId===event.id))continue;
        const guard=s.world.social.guards.map(id=>s.world.npcs[id]).find(n=>n?.social.knowledge[event.id]?.actorId==='player');if(guard){const item={id:'case:'+s.world.social.nextId++,eventId:event.id,guardId:guard.id,fine:law.fine,status:'unpaid'};s.world.social.cases.push(item);emit(s,'fine_registered',item.id,null,item);}
      }
      for(const e of s.entities.filter(e=>e.loan?.rental&&!e.loan.returned&&!e.loan.overdue&&s.turn>e.loan.deadline)){
        e.loan.overdue=true;const owner=s.world.npcs[e.ownerId];const event=record(s,'broken_promise',{id:'rental:'+e.id+':'+e.loan.turn,actor:'player',text:'Нарушен срок аренды'},{targetId:e.id,ownerId:e.ownerId,onlyObserverId:e.ownerId});learn(s,owner,event,'agreement',true);
      }
      if(s.world.activeNpcId&&!here(s,s.world.npcs[s.world.activeNpcId]))dialogue.close(s,'separated');
    }
    const OwnershipSystem={permitted},WitnessSystem={visible},RelationshipSystem={change},SocialEventSystem={record,learn},SuspicionSystem={tick},ReputationSystem={learn},ReparationSystem={handle},NPCReactionSystem={reaction};
    return {init,handle,after,tick,visible,permitted,permitsObservation,record,learn,change,OwnershipSystem,WitnessSystem,RelationshipSystem,SocialEventSystem,SuspicionSystem,ReputationSystem,ReparationSystem,NPCReactionSystem};
  }
  root.StorySocial={create};
})(globalThis);
