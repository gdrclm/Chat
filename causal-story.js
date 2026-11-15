/* Grounded story opportunities: rules join actual needs, knowledge and consequences.
   The director never performs the proposed action or reveals an unobserved source. */
(function(root){'use strict';
  function create(H){
    const {norm,hash,clone,log,simulation:S}=H;
    const here=(s,n)=>S.dialogue.here(s,n);
    const entity=(s,id)=>s.entities.find(e=>e.id===id);
    const local=(s,e)=>Boolean(e&&!e.destroyed&&!e.hidden&&e.known&&S.containerAccess(s,e)&&([s.place,'inventory'].includes(e.location)||here(s,s.world.npcs[e.location])));
    const person=(s,text)=>Object.values(s.world.npcs).find(n=>H.words(text).map(H.stem).includes(H.stem(n.name)));
    const nearby=s=>s.world.npcs[s.world.activeNpcId]||Object.values(s.world.npcs).find(n=>here(s,n));
    const owner=(s,e)=>s.world.npcs[e?.ownerId];
    const known=(s,e)=>local(s,e)||e?.location==='inventory'&&!e.destroyed;
    const ok=(text,code,extra={})=>({status:'success',code,text,effects:[],...extra});
    const fail=(text,code,status='clarification')=>({status,code,text,effects:[],performed:false});
    function record(s,key,rule,causes,data={}){
      const graph=s.world.causality;
      let node=graph.nodes.find(n=>n.key===key);if(node)return node;
      node={id:'story:'+hash(key),key,rule,turn:s.turn,causes:[...new Set(causes)].filter(id=>graph.nodes.some(n=>n.id===id)),...clone(data)};
      graph.nodes.push(node);if(!['player_action','world_event','observed_information'].includes(rule)&&node.summary)log(s,'story',node.summary);return node;
    }
    function rootCause(s){return s.world.causality.nodes[0].id;}
    function memoryItem(s){return s.entities.find(e=>e.memoryStory);}
    function initiative(s){return s.world.causality;}
    function init(s,config,p){
      s.world.causality||={version:1,nodes:[],threads:[],seen:{},notified:{}};
      const graph=initiative(s);
      if(!graph.nodes.length)graph.nodes.push({id:'story:origin:'+hash(s.configSig),key:'origin',rule:'world_setup',causes:[],turn:s.turn,summary:'Исходные места, люди и предметы',subjects:[s.world.startId]});
      if(!graph.contentVersion){const seller=Object.values(s.world.npcs).find(n=>s.entities.some(e=>e.stockOwner===n.id));const id='stock:'+hash('моток проволоки');if(seller&&!entity(s,id))H.addEntity(s,'моток проволоки',{id,location:seller.id,source:'stock',kind:'tool',portable:true,known:true,hidden:false,price:1,stockOwner:seller.id,ownerId:seller.id,description:'Короткий моток мягкой проволоки; подходит для мелких деталей.'});if(seller&&!entity(s,id)?.physical){S.init(s,p,config);seller.social.expected[id]=seller.id;}graph.contentVersion=1;}
      // Only the default memory premise supplies a backstory. Author-defined content wins.
      const flask=s.entities.find(e=>e.source==='container-content'&&/флакон.*воспомин/u.test(norm(e.label)));
      if(flask&&/воспомин|потерян.*прошл|памят/u.test(norm(config.world+' '+config.player))){
        if(!flask.memoryStory){
          const witnesses=Object.values(s.world.npcs).filter(n=>n.id!==flask.ownerId);
          const witness=witnesses[parseInt(hash(s.configSig),36)%Math.max(1,witnesses.length)]||s.world.npcs[flask.ownerId];
          const place=s.world.locations.find(l=>l.id===witness?.location)||s.world.locations[0];
          const motives=['уберечь близкого человека от опасного воспоминания','сдержать обещание и вернуться за правдой','перестать скрываться от собственного решения'];
          const motive=motives[parseInt(hash(config.player),36)%motives.length];
          flask.memoryStory={id:'memory:'+flask.id,witnessId:witness?.id,placeId:place.id,motive,active:s.facts.decision!=='отпустить',previewed:false,decision:s.facts.decision==='сохранить'?'keep':s.facts.decision==='отпустить'?'release':null,
            text:'Вы видите себя в месте «'+place.name+'». '+(witness?witness.name+' принимает у вас запечатанное письмо. ':'')+'Вы сами просите сохранить этот эпизод отдельно: вы хотели '+motive+'. Перед тем как уйти, вы обещаете вернуться. Это ваш поступок, а не чужой рассказ.',
            stakes:'Сохранить — принять своё прежнее обещание и получить возможность расспросить свидетеля. Отпустить — опустошить флакон и начать новую историю; восстановить эту запись уже не получится.'};
        }
        flask.memoryStory.proofSourceId||=s.entities.find(v=>v.source==='scene'&&/письм/u.test(norm(v.label)))?.id||null;
        flask.description||='В стекле движется тусклый свет. Воспоминание принадлежит вашей истории, но сам флакон хранит '+(owner(s,flask)?.name||'его владелец')+'. Сначала договоритесь о доступе; затем можно посмотреть воспоминание.';
        flask.price??=2;
        for(const e of s.entities){
          if(e.source==='scene'&&e.kind==='clue'&&/письм/u.test(norm(e.label))&&!e.writtenText)e.writtenText='Если вы читаете это письмо, значит, всё-таки решили вернуться. Не пытайтесь угадать прошлое по чужим словам. Попросите хранителя показать запись во флаконе; решение о ней должно остаться вашим. Под печатью — знак разомкнутой шестерни.';
          if(e.source==='player'&&/компас/u.test(norm(e.label))){e.description||='Треснувший компас всё ещё держит север. На корпусе выцарапан знак разомкнутой шестерни. Можно сверить его с найденными метками или спросить о знаке местного мастера.';e.navigation=true;}
        }
      }
      for(const e of s.entities)if(e.source==='stock'&&/книг/u.test(norm(e.label))&&!e.writtenText){e.kind='clue';e.description='Небольшая книга городских ремёсел: на обложке изображена разомкнутая шестерня.';e.writtenText='Разомкнутой шестернёй мастера отмечают служебные проходы. Вход ищут у основания уличного фонаря, но чужой знак без объяснения легко принять за украшение. В книге оставлены поля для собственных наблюдений.';}
      // A saved physical restitution must not remain an impossible demand.
      for(const n of Object.values(s.world.npcs))for(const g of n.grievances||[]){const e=entity(s,g.requiredItemId);if(!g.resolved&&g.kind==='theft'&&e?.location===n.id&&e.history?.some(v=>v.from==='inventory'&&v.to===n.id)&&here(s,n)){g.reparation=true;if(g.apology){S.flush(s);S.bind(s,n.id);S.reconcile(s,n);}}}
    }
    function resolve(s,text){
      const q=norm(text).replace(/[«»"]/g,''),e=memoryItem(s),receiver=person(s,text),n=receiver||nearby(s);
      let op=null,id=null;
      const body=q.replace(/^([^,:]+)\s*[:,]\s*/u,(full,name)=>person(s,name)?'':full);
      if(/^(?:отмена|отменить уточнение|отменяю уточнение|другое действие)[.! ]*$/u.test(q))op='cancel';
      else if(/^(?:я )?(?:не помню|не знаю|забыл|забыла).*(?:имя|имени|прошл)/u.test(q))op='amnesia';
      else if(/^(?:да|согласен|согласна)(?:,?\s*(?:берусь|помогу|помочь с ремонтом))?[.! ]*$/u.test(q)&&s.pending?.kind==='job-offer')return null;
      else if(/взаимн.*помощ|ответн.*помощ/u.test(q))op='reciprocity';
      else if(/кто.*(?:вскр|откр|запечат).*письм/u.test(q))op='seal';
      else if(/[?]|^(?:покажи|покажите|расскажи)/u.test(q)&&/ассортимент|что.*(?:купить|прода|товар)|покажи.*товар/u.test(q))op='shop';
      else if(/(?:нужна|нужна ли).*помощь.*(?:ремонт|работ)|(?:спросить|спрашиваю).*(?:о ремонте|о доставке)/u.test(q))op='job';
      else if(e&&/^(?:я )?(?:сохраняю|сохранить|отпускаю|отпустить) воспомин/u.test(body))op=/отпус/u.test(q)?'release':'keep';
      else if(e&&/(?:флакон|воспомин)/u.test(q)&&/^(?:я )?(?:покупаю|куплю|купить у)/u.test(body))op='buy_memory';
      else if(e&&/(?:разреш|можно|позвол).*(?:взять|забрать|посмотреть|воспомин)|(?:прошу|попросить).*доступ.*воспомин/u.test(q))op='permission';
      else if(e&&/как.*(?:воспольз|использ|примен).*флакон/u.test(q)){op='method';id=e.id;}
      else if(e&&/^(?:я )?(?:посмотреть|смотрю|просматриваю|переживаю|использую|покажи|покажите|вспоминаю).*(?:воспомин|флакон|прошл)/u.test(body))op='experience';
      else if(e&&/(?:памят|воспомин|прошл)/u.test(q)&&/(?:мою|мои|мое|свою|свои|свое|вернуть|восстанов|утрачен|потерян|что.*делать|пришел|пришла)/u.test(q))op='premise';
      else if(/[?]|^(?:покажи|расскажи)/u.test(q)){
        const item=H.matchEntity(s,text,true);if(item&&known(s,item)){
          if(/чье|чей|кому.*принадлеж|владелец/u.test(q))op='owner';
          else if(/сколько.*(?:стоит|цен)|какая.*цена|цена/u.test(q))op='price';
          else if(/о чем|содержим|что.*(?:написано|внутри)/u.test(q))op='contents';
          else if(/как.*(?:использ|воспольз|примен)/u.test(q))op='method';
          if(op)id=item.id;
        }
      }
      if(!op&&/^(?:использую|проверяю направление по|смотрю куда указывает).*компас/u.test(q))op='compass';
      if(!op&&/где.*(?:проволок|материал)|(?:найти|поискать) проволоку/u.test(q)&&s.world.loops.work.status==='accepted')op='material';
      if(!op&&e?.memoryStory.previewed&&/где.*свидетел|как.*найти.*свидетел/u.test(q))op='witness_where';
      if(!op&&e?.memoryStory.previewed&&/что.*(?:обещ|тогда)|расспрашиваю.*свидетел|обещание|что.*(?:помнишь|помните).*прошл/u.test(q)&&n?.id===e.memoryStory.witnessId)op='witness';
      if(!op)return null;
      if(['experience','keep','release','buy_memory'].includes(op)&&/^(?:я )?(?:не |хочу |если |предполож|я бы)/u.test(q))return null;
      return {mode:'execute',steps:[{raw:text,intent:'LEGACY',recognized:false,mode:'execute',actor:'player',index:0,dependsOnPrevious:false,story:{op,targetId:id,recipientId:receiver?.id}}]};
    }
    function prepare(s,c,a){const proposed=c.semantic?.story||(!['report','negated','hypothetical','intention'].includes(c.semantic?.mode)&&resolve(s,c.originalText||c.text)?.steps[0].story);if(proposed){a.story=proposed;a.intent='story';a.recipientId=a.story.recipientId||a.recipientId;c.negated=false;c.hypothetical=false;}}
    function speech(s,n,text){if(!n||!here(s,n))return text;if(s.world.boundNpcId!==n.id){S.flush(s);S.bind(s,n.id);}S.dialogue.start(s,n,'player_addressed');return S.dialogue.say(s,n,text,'dialogue');}
    function access(s,e,n){return Boolean(e&&!e.destroyed&&!e.hidden&&S.containerAccess(s,e)&&([s.place,'inventory'].includes(e.location)||here(s,owner(s,e)))&&(!n||here(s,n)));}
    function authorize(s,e,n){if(!n||!here(s,n))return fail('Нужно встретиться с хранителем флакона и договориться о доступе.','memory_owner_absent','refused');if(S.openGrievances(n).length)return fail(speech(s,n,'Сначала уладим нашу ссору. Если вещь возвращена, я это признаю; осталось обсудить причину.'),'memory_conflict','refused');e.permissions||={};e.permissions.player=[...new Set([...(e.permissions.player||[]),'take','memory_view','memory_choice'])];e.memoryStory.accessGranted=true;return null;}
    function handle(s,p,c,a){
      if(!a.story)return null;
      const op=a.story.op,e=a.story.targetId?entity(s,a.story.targetId):memoryItem(s),n=s.world.npcs[a.story.recipientId]||owner(s,e)||nearby(s),graph=initiative(s);
      const tell=text=>speech(s,here(s,n)?n:null,text);
      if(op==='cancel'){delete s.world.player.pendingAction;return ok('Уточнение отменено. Можно выбрать другой замысел.','clarification_cancelled',{performed:false});}
      if(op==='amnesia'){s.facts.amnesia=true;if(n){n.memory.playerNameUnknown=true;n.conversation.pendingNpcQuestion=null;}return ok(tell('Тогда пока обойдёмся без имени. Я запомню, что вы его не знаете. '+(e?'Покажите письмо или попросите посмотреть воспоминание — начнём с того, что можно проверить.':'Можно начать с того, что вы помните о своём пути.')),'amnesia_acknowledged');}
      if(op==='job')return S.handle(s,p,{...c,text:'Ищу работу',lower:'ищу работу',semantic:null,intent:'find_job',question:false,speech:true},s.world.authorCanon,{...a,intent:'find_job',semantic:null,story:null});
      if(op==='seal')return ok(tell('След на печати говорит о повторном вскрытии, но сам по себе не называет человека. Можно сравнить знак с городской меткой или показать письмо тому, кто разбирается в печатях.'),'seal_explained',{performed:false});
      if(op==='reciprocity'){
        const helper=person(s,a.text)||nearby(s),favor=graph.threads.find(t=>t.kind==='reciprocity'&&t.ownerId===helper?.id&&t.status==='open');
        if(!helper||!here(s,helper)||!favor)return fail('Для взаимной помощи сначала нужно общее дело и человек, который знает о вашем результате.','no_shared_experience');
        if(S.openGrievances(helper).length)return fail(speech(s,helper,'Наш общий результат я помню, но сначала нужно уладить новую ссору.'),'favor_conflict','refused');
        const tool=s.entities.find(v=>v.ownerId===helper.id&&v.kind==='tool'&&v.portable&&!v.destroyed&&!v.stockOwner&&[s.place,helper.id].includes(v.location));
        return ok(speech(s,helper,'Я помню ваш поступок: '+favor.achievement+'. '+(tool?'Могу одолжить «'+tool.label+'» для следующего дела. Попросите об этом; после использования вещь нужно вернуть.':'Можно обсудить следующий совместный замысел или попросить совета о доступных мне вещах.')),'reciprocity_offered',{performed:false});
      }
      if(op==='shop'){
        const seller=person(s,a.text)||nearby(s),stock=s.entities.filter(v=>!v.destroyed&&v.stockOwner===seller?.id&&v.location===seller?.id);
        if(!seller||!here(s,seller))return fail('Рядом нет продавца. Можно найти торговца в известном месте.','seller_absent','refused');
        return ok(speech(s,seller,stock.length?'Сейчас в продаже: '+stock.map(v=>v.label+' — '+Math.max(1,v.price-(s.world.player.discounts?.[seller.id]||0))+' монет').join('; ')+'. Можно осмотреть товар до покупки.':'Сейчас у меня нет выставленных на продажу вещей.'),'stock_explained',{performed:false});
      }
      if(op==='compass'){const compass=s.entities.find(v=>/компас/u.test(norm(v.label))&&local(s,v));if(!compass)return fail('Компас должен быть при вас или рядом.','compass_absent','refused');const exits=S.map(s).exits.filter(v=>!v.blocked);return ok('Стрелка держит север; трещина мешает читать мелкую шкалу. '+(compass.description||'')+' Известные пути отсюда: '+(exits.map(v=>v.name).join(', ')||'пока не найдены')+'.','compass_used',{performed:false});}
      if(op==='material')return ok(speech(s,s.world.npcs[s.world.loops.work.employer],'Для штифта нужна проволока. Можно поискать подходящий обрезок на улице у водостока или спросить о материалах на рынке. Я разрешаю работать на моём верстаке; за найденный материал платить мне не нужно.'),'material_routes_explained',{performed:false});
      if(['owner','price','contents','method'].includes(op)){
        if(!access(s,e))return fail('Этот предмет сейчас нельзя рассмотреть отсюда.','item_not_here','refused');
        const holder=owner(s,e),text=op==='owner'?(e.memoryStory&&/воспомин/u.test(norm(a.text))?'Запись связана с вашим прошлым; сам флакон хранит '+(holder?.name||'его владелец')+'. О содержании можно узнать при просмотре.':holder?'Владелец вещи — '+holder.name+'. Разрешение посмотреть не означает передачу собственности.':e.ownerId==='player'?'Это ваша вещь.':'Владелец этой вещи пока неизвестен.')
          :op==='price'?(e.price?'Цена: '+Math.max(1,e.price-(s.world.player.discounts?.[e.stockOwner]||0))+' монет.':e.stockOwner?'Цену нужно уточнить у продавца.':'Предмет не выставлен на продажу.')
          :op==='contents'?(e.localFacts?.some(f=>f.requiresOpen)&&!e.opened?'Источник запечатан. Сначала нужно открыть его, чтобы прочитать содержимое.':e.writtenText||e.description||'У предмета нет читаемого текста. Можно осмотреть его устройство.')
          :e.memoryStory?'Сначала договоритесь с хранителем или получите доступ к флакону. Затем можно посмотреть воспоминание и решить его судьбу.':e.navigation?'Компасом можно сверить направление и известные пути.':e.writtenText?'Этот текст можно прочитать, показать другому человеку или сопоставить с найденной меткой.':'Опишите воздействие на другой доступный предмет: что вы хотите изменить с помощью этой вещи?';
        return ok(tell(text),'item_'+op+'_explained',{performed:false});
      }
      if(!e?.memoryStory)return fail('Для этого нужно найти источник воспоминания.','memory_source_missing');
      const memory=e.memoryStory;
      if(op==='premise'){
        if(!n||!here(s,n))return fail('Сейчас рядом нет хранителя, с которым можно обсудить прошлое. Можно вернуться к знакомому собеседнику.','memory_interlocutor_absent');
        s.facts.goal||='Вернуть своё прошлое';graph.desire={text:s.facts.goal,source:rootCause(s)};
        const text=memory.decision?'Вы уже выбрали '+(memory.decision==='keep'?'сохранить':'отпустить')+' это воспоминание. Теперь можно продолжить историю с последствиями своего решения.'
          :'Флакон хранит эпизод вашего прошлого. Попросите меня открыть ларец, затем посмотрите воспоминание вместе со мной. Можно договориться о доступе, купить флакон за '+e.price+' монеты или сначала заняться работой в городе. Брать чужую вещь без разрешения опасно для наших отношений.';
        return ok(tell(text),'memory_routes_explained',{performed:false});
      }
      if(op==='permission'){
        if(!access(s,e,n))return fail('Сначала нужно встретиться с хранителем и полностью открыть ларец. Можно попросить об этом.','memory_container_closed');
        const denied=authorize(s,e,n);if(denied)return denied;
        return ok(tell('Разрешаю взять флакон и посмотреть воспоминание. Решение сохранить или отпустить его — ваше. Сам флакон остаётся моей вещью, пока мы не договорились о покупке.'),'memory_permission_granted');
      }
      if(op==='buy_memory'){
        if(!access(s,e,n))return fail('Для покупки нужен доступный флакон и его владелец рядом.','memory_not_for_sale','refused');
        if(e.ownerId==='player')return ok('Флакон уже ваш; платить второй раз не нужно.','memory_already_owned',{performed:false});
        if(S.openGrievances(n).length)return fail(tell('Сначала уладим конфликт; покупка не заменяет возврат чужой вещи.'),'memory_conflict','refused');
        if(s.world.player.money<e.price)return fail(tell('Цена флакона — '+e.price+' монеты. У вас '+s.world.player.money+'. Можно заработать или попросить посмотреть запись здесь, без покупки.'),'memory_price_unmet','refused');
        const denied=authorize(s,e,n);if(denied)return denied;s.world.player.money-=e.price;e.ownerId='player';e.location='inventory';S.truth(s,'player:money',s.world.player.money);S.truth(s,'entity:'+e.id+':ownerId','player');delete e.containerId;if(!s.inventory.includes(e.label))s.inventory.push(e.label);
        S.emit(s,'memory_purchased',e.id,null,{price:e.price,ownerId:'player'},a.id);return ok('Вы покупаете флакон за '+e.price+' монеты. Он теперь ваш; можно посмотреть воспоминание.','memory_purchased');
      }
      if(op==='experience'){
        if(memory.decision==='release'||!memory.active)return fail('Запись отпущена: флакон пуст. Своё решение можно обсудить, но восстановить запись простым повтором нельзя.','memory_released','refused');
        if(!access(s,e))return fail('Источник пока недоступен. Можно попросить хранителя открыть ларец и показать воспоминание.','memory_container_closed');
        if(e.ownerId!=='player'&&!e.permissions?.player?.includes('memory_view')){const denied=authorize(s,e,n);if(denied)return denied;}
        const first=!memory.previewed;memory.previewed=true;memory.revealedTurn??=s.turn;
        const facts=s.world.player.research.knowledge;facts[memory.id]={key:memory.id,text:memory.text,sourceId:e.id,locationId:s.world.player.location,unlocks:['сохранить воспоминание','отпустить воспоминание']};
        if(first)S.emit(s,'memory_experienced',e.id,null,{memoryId:memory.id,witnessId:memory.witnessId},a.id);
        return ok(memory.text+'\n'+memory.stakes+' Можно также отложить решение и расспросить хранителя.','memory_experienced',{information:{novel:first,discoveries:first?[memory.id]:[]}});
      }
      if(op==='keep'||op==='release'){
        if(memory.decision){if(memory.decision!==op)return fail('Вы уже '+(memory.decision==='release'?'отпустили эту запись; пустой флакон не вернёт её.':'сохранили запись и приняли прежнее обещание. Обсудите последствия, прежде чем менять решение.'),'memory_decision_committed','refused');return ok('Это решение уже принято. Его последствия сохраняются.','memory_decision_repeated',{performed:false});}
        if(!memory.previewed)return fail('Сначала посмотрите само воспоминание. Решать, сохранить или отпустить неизвестную запись, пока рано.','memory_not_experienced');
        if(!access(s,e)||e.ownerId!=='player'&&!e.permissions?.player?.includes('memory_choice'))return fail('Для этого решения нужен доступ к флакону и согласие его хранителя.','memory_access_lost','refused');
        memory.decision=op;memory.active=op!=='release';s.facts.decision=op==='keep'?'сохранить':'отпустить';
        S.emit(s,'memory_decided',e.id,null,{decision:op,memoryId:memory.id},a.id);
        s.threads.push({id:'next-chapter',text:op==='keep'?'Расспросить свидетеля о прежнем обещании':'Выбрать новое дело, не возвращаясь к отпущенной записи',status:'open'});
        return ok(op==='keep'?'Вы сохраняете воспоминание. Теперь вы знаете, какое обещание дали. Свидетель эпизода — '+(s.world.npcs[memory.witnessId]?.name||'хранитель')+'; можно расспросить его, если встретитесь.':'Вы отпускаете запись. Свет в флаконе гаснет. Прежний эпизод больше нельзя пережить заново; вместо старого обязательства вы можете выбрать новое дело. Хранитель признаёт ваш выбор.','memory_decided');
      }
      if(op==='witness_where'){const place=s.world.locations.find(l=>l.id===memory.placeId);return ok('В записи свидетель связан с местом «'+(place?.name||'известное место')+'». Можно начать поиск там; о его нынешнем местонахождении стоит спросить при встрече.','witness_location_remembered',{performed:false});}
      if(op==='witness'){
        const witness=s.world.npcs[memory.witnessId];if(!here(s,witness))return fail('Этот свидетель сейчас в другом месте. Нужно встретиться с ним.','memory_witness_absent','refused');
        if(memory.decision==='release')return ok(speech(s,witness,'Я уважаю ваше решение не возвращаться к записи. Если хотите начать с нового дела, обсудим то, что требуется сейчас.'),'released_memory_respected');
        const sharedWork=witness.conversation.relationshipCredits.some(id=>id.startsWith('work:'))||s.world.loops.work.employer===witness.id&&s.world.loops.work.status==='paid';
        const recommendation=Boolean(witness.memory.confirmedRecommendation);
        const credit=recommendation||Object.values(witness.researchKnowledge||{}).some(k=>k.sourceId===memory.proofSourceId)||sharedWork;
        const basis=sharedWork?'После нашей работы я знаю, что вы умеете держать слово. ':recommendation?'Рекомендация мастера подтверждает ваш поступок. ':'Вы показали письмо с той же печатью; теперь я могу сопоставить источники. ';
        const confirmedFirst=credit&&!memory.confirmedWitness;
        if(confirmedFirst){memory.confirmedWitness=true;S.emit(s,'memory_witness_confirmed',witness.id,null,{memoryId:memory.id},a.id);}
        return ok(speech(s,witness,credit?basis+'О прежнем обещании поговорим открыто: вы хотели '+memory.motive+'. Дальше можно помочь тому, кому теперь недостаёт поддержки.':'Я был в том месте, но одного пересказа мало. Покажите письмо или рекомендацию, чтобы я связал ваше нынешнее обращение с прежним обещанием.'),'memory_witness_response',{performed:false,information:{novel:confirmedFirst,discoveries:confirmedFirst?['witness:'+memory.witnessId]:[]}});
      }
      return null;
    }
    function observe(s,before,a,r){
      const graph=initiative(s),successful=['success','partial_success'].includes(r.status)&&r.performed!==false;
      if(!successful&&!r.information?.novel)return;
      const antecedents=graph.threads.filter(t=>t.status==='open'&&(t.subjectId===a.targetId||t.itemId===a.targetId||t.ownerId===a.recipientId)).map(t=>t.causeId);
      const action=record(s,a.id,'player_action',[rootCause(s),...antecedents],{id:a.id,summary:a.text,subjects:[a.targetId,a.recipientId].filter(Boolean)});
      const sources=[];
      for(const effect of r.effects||[]){const node=record(s,effect.id,'world_event',[action.id],{id:effect.id,summary:effect.type,subjects:[effect.subject||effect.subjectId].filter(Boolean)});sources.push(node.id);}
      if(r.information?.novel)sources.push(record(s,'learn:'+a.id,'observed_information',[action.id],{summary:r.code,subjects:[a.targetId].filter(Boolean)}).id);
      const causes=sources.length?sources:[action.id];
      for(const e of s.entities){
        const observed=s.world.player.research.properties[e.id]||s.world.loops.exploration.observed.includes(e.id);
        const damaged=e.condition==='broken'||e.physical?.durability<e.physical?.maxDurability;
        if(known(s,e)&&observed&&damaged&&!graph.threads.some(t=>t.kind==='repair'&&t.subjectId===e.id)){
          const node=record(s,'need:'+e.id,'observed_damage',causes,{summary:'Нужен ремонт: '+e.label,subjects:[e.id]});graph.threads.push({id:node.id,kind:'repair',subjectId:e.id,ownerId:e.ownerId??null,repairMode:e.condition==='broken'||e.physical?.condition==='broken'?'condition':'durability',status:'open',causeId:node.id,text:'Можно изменить состояние «'+e.label+'», устранив поломку.'});
        }
      }
      for(const n of Object.values(s.world.npcs))for(const g of n.grievances||[]){
        let thread=graph.threads.find(t=>t.kind==='reparation'&&t.subjectId===g.id);
        if(!g.resolved&&!thread&&here(s,n)&&n.social.knowledge[g.socialEventId]){const node=record(s,'conflict:'+g.id,'known_conflict',causes,{summary:n.name+': нужно исправить последствия поступка',subjects:[n.id,g.requiredItemId].filter(Boolean)});thread={id:node.id,kind:'reparation',subjectId:g.id,ownerId:n.id,itemId:g.requiredItemId??null,status:'open',causeId:node.id,text:'Уладить конфликт: '+n.name};graph.threads.push(thread);}
        if(thread?.status==='open'&&g.resolved){const node=record(s,'reconciled:'+g.id,'restitution_changes_relationship',[thread.causeId,...causes],{summary:n.name+' признаёт исправление последствий',subjects:[n.id]});thread.status='completed';thread.resultId=node.id;}
      }
      for(const thread of graph.threads.filter(t=>t.kind==='repair'&&t.status==='open')){const e=entity(s,thread.subjectId);if(!e||e.destroyed){const blocked=record(s,'need-blocked:'+thread.id,'destruction_changes_need',[thread.causeId,...causes],{summary:'Вещь больше нельзя восстановить прежним способом: изменились условия дела.',subjects:[thread.subjectId]});thread.status='blocked';thread.resultId=blocked.id;continue;}if(e.condition==='repaired'||thread.repairMode==='durability'&&e.condition!=='broken'&&e.physical?.condition!=='broken'&&e.physical?.durability===e.physical?.maxDurability){const node=record(s,'repaired:'+e.id,'need_satisfied',[thread.causeId,...causes],{summary:'Поломка устранена: '+e.label,subjects:[e.id]});thread.status='completed';thread.resultId=node.id;const n=owner(s,e);if(n&&here(s,n)&&!S.openGrievances(n).length&&(n.beliefs['entity:'+e.id+':condition']?.value==='repaired'||s.world.loops.work.employer===n.id&&n.conversation.relationshipCredits.includes('work:'+s.world.loops.work.id))){const favor=record(s,'reciprocity:'+e.id,'shared_result_creates_reciprocity',[node.id],{summary:n.name+' готов обсудить ответную помощь после ремонта',subjects:[n.id,e.id]});if(!graph.threads.some(t=>t.id===favor.id))graph.threads.push({id:favor.id,kind:'reciprocity',ownerId:n.id,subjectId:e.id,causeId:favor.id,status:'open',locationId:s.world.player.location,achievement:'вы восстановили «'+e.label+'»',text:'Обсудить ответную помощь: '+n.name});}}}
      for(const item of s.entities.filter(e=>e.loan)){let t=graph.threads.find(t=>t.kind==='return_loan'&&t.subjectId===item.id);if(!item.loan.returned&&!t){const node=record(s,'loan:'+item.id+':'+item.loan.turn,'loan_creates_obligation',causes,{summary:'Вещь нужно вернуть владельцу после использования',subjects:[item.id,item.ownerId]});graph.threads.push({id:node.id,kind:'return_loan',subjectId:item.id,ownerId:item.ownerId,causeId:node.id,status:'open',text:'Вернуть одолженную вещь: '+item.label});}if(t&&item.loan.returned&&t.status==='open'){const node=record(s,'loan-returned:'+t.id,'obligation_fulfilled',[t.causeId,...causes],{summary:'Заём возвращён; совместное дело не оставило долга',subjects:[item.id,item.ownerId]});t.status='completed';t.resultId=node.id;}}
      const work=s.world.loops.work;
      if(['completed','paid'].includes(work.status)&&work.id){const recommendation=s.entities.find(e=>e.recommendation&&e.location==='inventory');if(recommendation){const fulfilled=graph.threads.find(t=>t.kind==='repair'&&t.status==='completed');const node=record(s,'work-contact:'+work.id,'work_creates_reputation',[...(fulfilled?[fulfilled.resultId]:[]),...causes],{summary:'Завершённая работа дала рекомендацию, которую можно показать другому человеку.',subjects:[work.employer,recommendation.id]});if(!graph.threads.some(t=>t.kind==='reputation'&&t.subjectId===work.id))graph.threads.push({id:node.id,kind:'reputation',subjectId:work.id,itemId:recommendation.id,causeId:node.id,status:'open',text:'Показать рекомендацию торговцу и проверить, какие возможности она откроет.'});}}
      if(r.code==='recommendation_used'){const thread=graph.threads.find(t=>t.kind==='reputation'&&t.status==='open');if(thread){const node=record(s,'reputation:'+thread.id,'reputation_changes_trade',[thread.causeId,...causes],{summary:'Подтверждённый поступок изменил условия торговли.',subjects:[a.recipientId]});thread.status='completed';thread.resultId=node.id;}}
      if(r.code==='goal_created'){const prior=graph.threads.find(t=>t.kind==='aftermath'&&t.status==='open'&&memoryItem(s)?.memoryStory.decision==='release');const goal=s.world.rpg.goals.at(-1);const node=record(s,'goal:'+goal.id,'chosen_goal_continues_story',[...(prior?[prior.causeId]:[]),...causes],{summary:'Новый замысел принят: '+goal.text,subjects:[goal.id]});if(prior){prior.status='completed';prior.resultId=node.id;}}
      if(['recommendation_seen','recommendation_used'].includes(r.code)){const n=S.npc(s);if(n?.memory.confirmedRecommendation){const proof=record(s,'proof:'+a.id,'proof_presented',causes,{summary:n.name+' получил подтверждение в предъявленной рекомендации.',subjects:[n.id,n.memory.confirmedRecommendation]});n.memory.confirmedRecommendationCause=proof.id;}}
      if(r.code==='memory_witness_response'&&memoryItem(s)?.memoryStory.confirmedWitness){const thread=graph.threads.find(t=>t.kind==='aftermath'&&t.status==='open');if(thread){const node=record(s,'testimony:'+thread.id,'source_confirmed_by_witness',[thread.causeId,...causes,s.world.npcs[memoryItem(s).memoryStory.witnessId]?.memory.confirmedRecommendationCause].filter(Boolean),{summary:'Свидетель связал найденное воспоминание с вашим подтверждённым поступком.',subjects:[memoryItem(s).memoryStory.witnessId]});thread.status='completed';thread.resultId=node.id;}}
      if(r.code==='memory_experienced'&&r.information?.novel){const e=memoryItem(s);record(s,'memory-known:'+e.id,'source_reveals_personal_goal',causes,{summary:'Прежнее обещание стало известно из источника.',subjects:[e.id,e.memoryStory.witnessId]});}
      if(r.code==='memory_decided'){const e=memoryItem(s),known=graph.nodes.find(n=>n.key==='memory-known:'+e.id);const node=record(s,'memory-choice:'+e.id,'informed_choice',[...(known?[known.id]:[]),...causes],{summary:'Выбрано: '+e.memoryStory.decision,subjects:[e.id]});graph.threads.push({id:node.id,kind:'aftermath',subjectId:e.id,causeId:node.id,status:'open',text:e.memoryStory.decision==='keep'?'Обсудить прежнее обещание со свидетелем':'Начать новое дело после отказа от прежней записи'});}
    }
    function options(s){
      const options=[],work=s.world.loops.work,e=memoryItem(s),graph=initiative(s);
      const add=(command,label,rank=80,reason='',targetId=null)=>{if(!options.some(v=>v.command===command))options.push({command,label:label||command,kind:'story',rank,reason,targetId});};
      if(s.world.player.pendingAction)add('Отменить уточнение','Выбрать другое действие',115,'Уточнение можно отменить');
      for(const n of Object.values(s.world.npcs).filter(n=>here(s,n)))for(const g of S.openGrievances(n)){const item=entity(s,g.requiredItemId);if(!g.reparation&&item?.location==='inventory')add('Возвращаю '+item.label+' '+n.name,'Вернуть: '+item.label,130,'Исправить последствия',item.id);if(!g.apology)add('Извиняюсь','Признать ошибку и извиниться',120);}
      if(work.status==='offered'&&here(s,s.world.npcs[work.employer])){add('Да','Принять работу',120);add('Нет','Отказаться от работы',115);}
      if(work.status==='accepted'&&here(s,s.world.npcs[work.employer])){
        const machine=s.entities.find(v=>v.localKey==='mechanism'&&v.location===s.place);
        const actual=s.world.player.research.knowledge;
        const diagnosis=Object.keys(actual).some(k=>k.includes('repair.diagnosis'));
        const missing=Object.keys(actual).some(k=>k.includes('repair.missing-pin'));
        const pin=s.entities.find(v=>v.location==='inventory'&&!v.destroyed&&/штифт/u.test(norm(v.label)));
        const wire=s.entities.find(v=>v.location==='inventory'&&!v.destroyed&&/проволок/u.test(norm(v.label)));
        if(machine?.pinInstalled)add('Проверяю ход механизма','Проверить результат ремонта',125);
        else if(pin)add('Устанавливаю штифт','Установить изготовленную деталь',125);
        else if(!diagnosis)add('Осматриваю механизм','Определить поломку',125);
        else if(!missing)add('Проверяю комплект деталей','Проверить, чего не хватает',125);
        else if(wire)add('Изготавливаю штифт из проволоки','Изготовить штифт',125);
        else add('Где найти проволоку?','Узнать, где искать материал',120);
      }
      if(work.status==='completed'&&here(s,s.world.npcs[work.employer]))add('Забираю плату','Получить заработанные монеты',130);
      if(e){const m=e.memoryStory,n=owner(s,e);
        if(access(s,e)&&m.previewed&&!m.decision){add('Сохраняю воспоминание','Сохранить: принять прежнее обещание',115);add('Отпускаю воспоминание','Отпустить: начать заново',113);}
        else if(access(s,e)&&!m.previewed&&!m.decision)add('Смотрю воспоминание','Посмотреть своё воспоминание',100);
        else if(n&&here(s,n)&&!m.previewed){const box=entity(s,e.containerId);if(box?.known&&!box.opened&&n.dialogueState?.status!=='undiscovered'&&n.access?.includes(box.id))add(n.name+', открой '+box.label+', пожалуйста','Попросить открыть: '+box.label,98);add('Как вернуть мою память?','Обсудить возвращение памяти',95);}
        if(m.previewed&&m.decision==='keep'&&!m.confirmedWitness&&!here(s,s.world.npcs[m.witnessId])){const queue=[[s.world.player.location,[]]],seen=new Set();let route=null;while(queue.length){const [at,path]=queue.shift();if(at===m.placeId){route=path;break;}if(seen.has(at))continue;seen.add(at);for(const edge of s.world.edges.filter(v=>v.from===at&&!v.hidden&&!v.rpg)){const barrier=entity(s,edge.barrierId);if(barrier?.locked&&!barrier.opened&&!barrier.destroyed)continue;queue.push([edge.to,[...path,edge.to]]);}}const next=route?.[0]&&S.map(s).exits.find(v=>v.id===route[0]||v.to===route[0]||s.world.locations.find(l=>l.name===v.name)?.id===route[0]);if(next&&!next.blocked)add('Иду в '+next.name,'К месту из воспоминания: '+next.name,90);add('Где найти свидетеля?','Вспомнить, где искать свидетеля',70);}
        if(m.previewed&&m.decision==='keep'&&!m.confirmedWitness&&here(s,s.world.npcs[m.witnessId]))add('Расспрашиваю свидетеля об обещании','Обсудить прежнее обещание',105);
      }
      for(const thread of graph.threads.filter(t=>t.status==='open'&&t.kind==='reciprocity')){const n=s.world.npcs[thread.ownerId];if(here(s,n))add('Обсудить взаимную помощь с '+n.name,'Обсудить ответную помощь: '+n.name,75,'Ваш общий результат');}
      for(const thread of graph.threads.filter(t=>t.status==='open'&&t.kind==='return_loan')){const item=entity(s,thread.subjectId),n=s.world.npcs[thread.ownerId];if(item?.location==='inventory'&&here(s,n))add('Возвращаю '+item.label+' '+n.name,'Вернуть одолженную вещь: '+item.label,85,'Выполнить обязательство');}
      for(const thread of graph.threads.filter(t=>t.status==='open'&&t.kind==='reputation')){const rec=entity(s,thread.itemId),seller=Object.values(s.world.npcs).find(n=>here(s,n)&&s.entities.some(e=>e.stockOwner===n.id));if(rec?.location==='inventory'&&seller)add('Показываю '+seller.name+' рекомендацию мастера','Показать рекомендацию и обсудить условия',110);}
      const seller=Object.values(s.world.npcs).find(n=>here(s,n)&&s.entities.some(e=>e.stockOwner===n.id));if(seller)add('Что можно купить?','Узнать товары и цены',65);
      for(const e of s.entities.filter(e=>local(s,e)&&e.location===s.place)){
        const observed=Boolean(s.world.player.research.properties[e.id]);if(!observed)add('Осматриваю '+e.label,'Осмотреть: '+e.label,55,'Новая деталь',e.id);
        if(e.localKey==='drain'&&s.world.sceneFlags?.['grate-moved']!==true&&Object.keys(s.world.player.research.knowledge).some(k=>k.includes('street.loose-grate')))add('Приподнимаю решётку','Проверить пространство под решёткой',90);
        if(e.localKey==='wire'&&e.known&&!e.hidden)add('Беру проволоку','Взять найденный материал',100);
      }
      return options.map(v=>({...v,kind:v.command.startsWith('Осматриваю ')?'inspect':v.command.startsWith('Иду в ')?'move':v.kind})).sort((a,b)=>b.rank-a.rank);
    }
    function situation(s){const graph=initiative(s),e=memoryItem(s),conflict=graph.threads.find(t=>t.kind==='reparation'&&t.status==='open');if(conflict)return conflict.text;const work=s.world.loops.work;if(work.status==='accepted')return 'Вы взялись за работу: устранить поломку и получить согласованную плату.';if(work.status==='completed')return 'Работа завершена. Осталось получить плату и решить, как использовать новый опыт.';if(e){const m=e.memoryStory;if(m.confirmedWitness)return 'Прежнее обещание подтверждено свидетелем. '+(graph.threads.find(t=>t.status==='open'&&t.kind!=='aftermath')?.text||'Можно выбрать следующее дело и опереться на приобретённые знания.');if(m.decision)return m.decision==='keep'?'Вы приняли прежнее обещание. Теперь можно узнать у свидетеля, что осталось сделать.':'Вы отпустили запись. Теперь можно выбрать дело, с которого начнётся новая история.';if(m.previewed)return 'Вы узнали о своём прежнем обещании. Решите, сохранить запись или отпустить её, зная цену.';return 'Вы ищете своё прошлое. Хранитель может показать запись; доступ можно обсудить без кражи.';}return graph.threads.find(t=>t.status==='open')?.text||s.facts.goal||null;}
    return {init,resolve,prepare,handle,observe,options,situation,record};
  }
  root.StoryCausality={create};
})(globalThis);
