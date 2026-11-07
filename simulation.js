/* Authoritative world simulation. No DOM, network, or language-model dependency. */
(function (root) {
  'use strict';
  root.StorySimulation = { create(H) {
    const {clean,norm,words,stem,hash,clone,profile,matchEntity,addEntity,log,voice,resolveBarrier}=H;
    const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
    const statuses=['success','partial_success','refused','clarification'];
    const result=(status,code,text)=>({status,code,text,effects:[]});
    const ok=(text,code='completed')=>result('success',code,text);
    const no=(text,code='precondition_failed')=>result('refused',code,text);
    const ask=(text,code='ambiguous_action')=>result('clarification',code,text);
    const partial=(text,code='cost_or_incomplete')=>result('partial_success',code,text);
    const number=v=>Number.isFinite(v)?v:0;
    const rawFields=text=>clean(text).split('\n').map(line=>{const i=line.indexOf(':');return i>0?[norm(line.slice(0,i)),clean(line.slice(i+1))]:[];}).filter(v=>v.length);
    const field=(config,key)=>rawFields(config.canon).find(([k])=>k===key)?.[1]||'';
    const npc=s=>s.world?.npcs?.[s.world.activeNpcId]||null;
    const loc=s=>s.world.locations.find(l=>l.id===s.world.player.location);
    const byLoc=(s,id)=>s.world.locations.find(l=>l.id===id);
    const here=(s,n)=>Boolean(n&&n.location===s.world.player.location);
    function findLocation(s,text) {
      const q=norm(text).replace(/^(?:в|на|к|из)\s+/,'').replace(/[.!?]+$/,'');
      if(/^(?:наружу|снаружи|улицу|выход)$/.test(q))return byLoc(s,s.world.outdoorId);
      const tokens=words(q).map(stem);
      return s.world.locations.find(l=>norm(l.name)===q || l.aliases?.some(a=>norm(a)===q)) || s.world.locations.find(l=>words(l.name).map(stem).some(w=>w.length>=3&&tokens.includes(w)));
    }
    function addLocation(world,name,aliases=[]) {
      let value=world.locations.find(l=>norm(l.name)===norm(name));
      if(!value){value={id:'loc:'+hash(norm(name)),name:clean(name),aliases,visits:0};world.locations.push(value);}return value;
    }
    function edge(world,a,b,barrier=null) {
      if(!world.edges.some(e=>e.from===a.id&&e.to===b.id))world.edges.push({from:a.id,to:b.id,barrierId:barrier});
      if(!world.edges.some(e=>e.from===b.id&&e.to===a.id))world.edges.push({from:b.id,to:a.id,barrierId:barrier});
    }
    function namesMatch(a,b) {
      return norm(a)===norm(b) || words(a).map(stem).some(w=>w.length>=3&&words(b).map(stem).includes(w));
    }
    function findNpc(s,text,localOnly=false) {
      const candidates=Object.values(s.world.npcs).filter(n=>!localOnly||here(s,n));
      return candidates.find(n=>namesMatch(n.name,text));
    }
    function makeNpc(name,location,description,motive,cherished,access=[]) {
      return {id:'npc:'+hash(norm(name)),name,location,description,motive,cherished,access,trust:0,tension:0,seen:{},used:{},memory:{},beliefs:{},grievances:[],reconciliations:[],pending:null,secretRevealed:false,contacts:0};
    }
    function proposition(s,text) {
      const value=clean(text).replace(/^[\s:«»"—-]+|[\s.!?«»"]+$/g,'');
      let m=value.match(/^(.{1,90}?)\s*=\s*(.{1,100})$/u);
      if(m)return {key:norm(m[1]),value:clean(m[2]),text:value};
      m=value.match(/(?:украл[аи]?|похитил[аи]?|взял[аи]?)\s+([А-ЯЁ][а-яё-]+)/u);
      const before=value.match(/([А-ЯЁ][а-яё-]+)\s+(?:украл[аи]?|похитил[аи]?|взял[аи]?)/u);
      const named=m?.[1]||before?.[1]||value.match(/(?:вор|винов(?:ен|на|ник))\s*[—:=]?\s*([А-ЯЁ][а-яё-]+)/u)?.[1];
      if(named)return {key:'виновник',value:named,text:value};
      const item=matchEntity(s,value,true);
      m=value.match(/\sу\s+([А-ЯЁ][а-яё-]+)/u);
      if(item&&m)return {key:'owner:'+item.id,value:m[1],text:value};
      return {key:'statement:'+hash(norm(value)),value:true,text:value};
    }
    function emit(s,type,subject,before,after,cause,extra={}) {
      const event={id:'event:'+s.world.nextEvent++,turn:s.turn,type,subject,before:clone(before??null),after:clone(after??null),cause:cause||s.currentActionId||'system',...extra};
      s.world.events.push(event);s.world.events=s.world.events.slice(-240);return event;
    }
    function truth(s,key,value,source='event',cause) {
      const before=s.world.facts[key]?.value;
      if(JSON.stringify(before)===JSON.stringify(value))return;
      s.world.facts[key]={value:clone(value),source,turn:s.turn,cause:cause||s.currentActionId||'author'};
      if(source!=='canon')emit(s,'world_fact',key,before,value,cause);
    }
    function init(s,p,config) {
      const reusable=s.world?.schema===4&&Array.isArray(s.world.locations)&&Array.isArray(s.world.edges)&&s.world.player&&s.world.npcs&&Array.isArray(s.world.events)&&Array.isArray(s.world.deferred)&&s.world.locations.some(l=>l.id===s.world.player.location);
      if(reusable && JSON.stringify(s.world.authorCanon)===JSON.stringify(config)) { bind(s,s.world.activeNpcId);s.place=byLoc(s,s.world.player.location).name;presence(s);return; }
      const old=s.world;const previousPlace=s.place;
      const w={schema:4,authorCanon:clone(config),locations:[],edges:[],npcs:{},activeNpcId:null,player:{location:null,previousLocation:null,counters:{},variants:{},money:0},facts:{},events:[],nextEvent:1,plans:[],deferred:[],loops:{work:{status:'idle',serial:0},exploration:{visited:[],discoveries:[]},social:{contacts:[]}},storyUsed:{}};
      s.world=w;
      const start=addLocation(w,p.place);w.startId=start.id;
      const supplied=field(config,'локации');
      if(supplied)for(const name of supplied.split(/[,|]/).filter(Boolean))addLocation(w,name);
      const routes=field(config,'переходы');
      if(routes) {
        for(const route of routes.split(/;|\|/)) {
          const m=route.trim().match(/^(.+?)\s*(?:<->|↔|->|→)\s*([^\[]+?)(?:\s*\[([^\]]+)\])?$/);
          if(!m)continue;
          const a=addLocation(w,m[1].trim()),b=addLocation(w,m[2].trim());
          const barrier=m[3]?matchEntity(s,m[3],true):null;edge(w,a,b,barrier?.id||null);
        }
      } else if(supplied) {
        const nodes=w.locations;for(let i=1;i<nodes.length;i++)edge(w,nodes[i-1],nodes[i]);
      } else {
        const outside=addLocation(w,'улица',['наружу','снаружи','улицу']);edge(w,start,outside);
        const garden=addLocation(w,'сад',['саду']);edge(w,start,garden);
        const city=addLocation(w,'город',['городу','городе']);edge(w,outside,city);
        for(const name of ['рынок','мастерская','площадь'])edge(w,city,addLocation(w,name));
      }
      w.outdoorId=(w.locations.find(l=>norm(l.name)==='улица')||w.locations.find(l=>l.id!==start.id))?.id||start.id;
      const current=findLocation(s,previousPlace)||start;w.player.location=current.id;current.visits++;
      if(previousPlace&&previousPlace!==current.name) {s.previousPlace=null;}s.place=current.name;
      const owner=/(?:^|[^а-я])(?:хозяйк|владел|хранител|сторож)/.test(norm(config.character));
      const access=field(config,'доступ персонажа');
      const main=makeNpc(p.name,start.id,config.character,p.motive,field(config,'ценный предмет')||p.motive,[]);
      main.access=s.entities.filter(e=>e.kind==='barrier'&&(owner||access&&namesMatch(e.label,access))).map(e=>e.id);
      main.trust=number(s.trust);main.tension=number(s.tension);main.seen=clone(s.seen||{});main.used=clone(s.used||{});main.pending=clone(s.pending||null);main.secretRevealed=Boolean(s.secretRevealed);
      main.secret=p.secret;
      if(!old)for(const k of ['secret','debt','lastGift','proposal','claim','topic'])if(s.facts[k]!==undefined)main.memory[k]=s.facts[k];
      w.npcs[main.id]=main;w.primaryNpcId=main.id;w.activeNpcId=main.id;
      const extra=rawFields(config.canon).filter(([k])=>k==='персонаж');
      for(const [,line]of extra) {
        const [name,place,motive,cherished]=line.split('|').map(v=>v.trim());
        const node=findLocation(s,place);if(!name||!node)continue;
        const value=makeNpc(name,node.id,name+' — местный житель',motive||'найти надёжного союзника',cherished||'',[]);w.npcs[value.id]=value;
      }
      if(!extra.length) {
        for(const [name,place,motive,cherished]of [['Илья','мастерская','починить инструменты','молоток'],['Ника','рынок','доставить письма','письмо'],['Лея','площадь','собрать городские истории','книга']]) {
          const node=findLocation(s,place);if(!node)continue;const n=makeNpc(name,node.id,name+' — доброжелательный житель города',motive,cherished,[]);if(!w.npcs[n.id])w.npcs[n.id]=n;
        }
      }
      if(reusable)for(const [id,n]of Object.entries(w.npcs))if(old.npcs[id]) {
        const before=old.npcs[id];Object.assign(n,{trust:before.trust,tension:before.tension,seen:clone(before.seen),used:clone(before.used),beliefs:clone(before.beliefs),grievances:clone(before.grievances),reconciliations:clone(before.reconciliations),memory:clone(before.memory)});
      }
      for(const e of s.entities) {
        if(e.location==='npc')e.location=main.id;
        annotate(s,e,p);
      }
      const npcItems=field(config,'вещи персонажа');
      if(npcItems)for(const label of npcItems.split(/[,|]/))addEntity(s,label,{location:main.id,source:'canon'});
      for(const [,text]of rawFields(config.canon).filter(([k])=>k==='истина')) {const fact=proposition(s,text);truth(s,fact.key,fact.value,'canon');}
      for(const [key,text]of rawFields(config.canon).filter(([k])=>k.startsWith('знает '))) {
        const observer=findNpc(s,key.slice(6));if(observer){const fact=proposition(s,text);observer.beliefs[fact.key]={...fact,confidence:1,sources:{canon:1},certainty:'known'};}
      }
      for(const [,line]of rawFields(config.canon).filter(([k])=>k==='доказательство')) {
        const [label,...payload]=line.split('|');const e=matchEntity(s,label,true);
        if(e&&payload.length)e.evidence={proposition:proposition(s,payload.join('|').trim()),authenticity:'genuine',witnessedBy:[]};
      }
      const market=findLocation(s,'рынок');const merchant=market&&Object.values(w.npcs).find(n=>n.location===market.id);
      if(merchant)for(const [label,price]of [['молоток',3],['цепочка',2],['книга',2]]) {
        addEntity(s,label,{id:'stock:'+hash(label),location:merchant.id,source:'stock',kind:'tool',portable:true,price,stockOwner:merchant.id});
      }
      for(const e of s.entities){annotate(s,e,p);syncEntityTruth(s,e,'canon');}
      w.loops.exploration.visited.push(current.id);bind(s,main.id);presence(s);
    }
    function annotate(s,e,p) {
      if(e.portable===undefined)e.portable=!['fixed','barrier'].includes(e.kind)||/ларец|сундук|ящик|шкатулк/.test(norm(e.label));
      if(!Array.isArray(e.lineage))e.lineage=[];
      if(!Array.isArray(e.unlocks))e.unlocks=e.label===p.tool?s.entities.filter(v=>v.kind==='barrier'&&v.source==='scene').map(v=>v.id):[];
    }
    const memoryKeys=['secret','debt','lastGift','proposal','claim','topic'];
    function flush(s) {
      const n=npc(s);if(!n)return;
      n.trust=Math.max(-5,Math.min(5,number(s.trust)));n.tension=Math.max(0,Math.min(5,number(s.tension)));n.seen=clone(s.seen);n.used=clone(s.used);n.pending=clone(s.pending);n.secretRevealed=Boolean(s.secretRevealed);
      for(const key of memoryKeys){if(s.facts[key]!==undefined)n.memory[key]=clone(s.facts[key]);else delete n.memory[key];}
    }
    function bind(s,id) {
      const n=s.world.npcs[id];
      s.world.activeNpcId=n?id:null;
      s.trust=n?.trust||0;s.tension=n?.tension||0;s.seen=n?n.seen:s.world.player.counters;s.used=n?n.used:s.world.player.variants;s.pending=n?.pending||null;s.secretRevealed=Boolean(n?.secretRevealed);
      for(const key of memoryKeys){delete s.facts[key];if(n?.memory[key]!==undefined)s.facts[key]=clone(n.memory[key]);}
      s.npcPresent=here(s,n);
    }
    function presence(s) {
      const current=npc(s);if(here(s,current)){s.npcPresent=true;return;}
      const local=Object.values(s.world.npcs).find(n=>here(s,n));bind(s,local?.id||null);
    }
    function npcProfile(s,config,fallback) {
      const n=npc(s);if(!n)return fallback;
      if(n.id===s.world.primaryNpcId)return {...fallback,name:n.name,motive:n.motive,secret:n.secret||fallback.secret};
      const value=profile({...config,character:n.description,canon:''});return {...value,name:n.name,motive:n.motive,secret:n.secret||'у каждого здесь есть своя причина оставаться в городе'};
    }
    function openGrievances(n){return (n?.grievances||[]).filter(g=>!g.resolved);}
    function conflict(s,n,kind,reason) {
      const last=openGrievances(n).find(g=>g.kind===kind&&g.reason===reason);if(last)return last;
      const g={id:'conflict:'+s.world.nextEvent+':'+n.id,kind,reason,turn:s.turn,resolved:false,apology:false,reparation:false,requiredItem:n.cherished||null};n.grievances.push(g);
      emit(s,'conflict',n.id,null,g);log(s,'conflict',n.name+': '+reason);return g;
    }
    function meaningful(s,n,e) {
      const labels=[e.label,...e.lineage.map(id=>s.entities.find(v=>v.id===id)?.label||'')].join(' ');
      return Boolean(n.cherished&&words(n.cherished).map(stem).some(w=>w.length>=3&&words(labels).map(stem).includes(w)));
    }
    function reconcile(s,n) {
      let count=0;for(const g of openGrievances(n))if(g.apology&&g.reparation){g.resolved=true;g.resolvedTurn=s.turn;count++;}
      if(!count)return false;
      n.reconciliations.push({turn:s.turn,conflicts:n.grievances.filter(g=>g.resolvedTurn===s.turn).map(g=>g.id)});s.trust=Math.max(1,s.trust);s.tension=Math.max(0,s.tension-2);
      emit(s,'reconciliation',n.id,null,n.reconciliations.at(-1));log(s,'reconciliation',n.name+': причина конфликта признана и выполнено условие примирения.');return true;
    }
    function syncEntityTruth(s,e,source='event') {
      for(const key of ['location','opened','locked','destroyed','hidden'])truth(s,'entity:'+e.id+':'+key,e[key]??false,source);
    }
    function snapshot(s){return clone({entities:s.entities,inventory:s.inventory,clocks:s.clocks,stage:s.stage,player:s.world.player,relationships:Object.values(s.world.npcs).map(n=>({id:n.id,trust:n.trust,tension:n.tension,location:n.location})),facts:s.world.facts});}
    function observeProperty(s,e,key,value,action) {
      for(const n of Object.values(s.world.npcs)) {
        const ownItem=e.location===n.id;
        const isHere=n.location===s.world.player.location;
        const actorHere=action.actor===n.id;
        const visible=e.location===byLoc(s,n.location)?.name&&!e.hidden;
        if(!ownItem&&!actorHere&&!(isHere&&!s.facts.hidden&&!e.hidden&&(visible||e.location==='inventory')))continue;
        const factKey='entity:'+e.id+':'+key;
        const source='observation:'+action.id;
        const old=n.beliefs[factKey];
        if(JSON.stringify(old?.value)===JSON.stringify(value))continue;
        const belief={key:factKey,value:clone(value??false),text:e.label+': '+key+' = '+String(value??false),confidence:1,certainty:'known',sources:{[source]:1},turn:s.turn};
        n.beliefs[factKey]=belief;emit(s,'npc_observation',n.id,old||null,belief,action.id,{subjectId:e.id});
      }
    }
    function effects(s,before,action) {
      for(const e of s.entities) {
        annotate(s,e,profile(s.world.authorCanon));
        const old=before.entities.find(v=>v.id===e.id);if(!old){
          if(e.source==='magic'&&!e.lineage.length)e.lineage=before.entities.filter(v=>!v.destroyed&&s.entities.find(x=>x.id===v.id)?.destroyed).flatMap(v=>[v.id,...(v.lineage||[])]);
          emit(s,'entity_created',e.id,null,e,action.id);}
        else for(const key of ['location','opened','locked','destroyed','hidden','label'])if(JSON.stringify(old[key])!==JSON.stringify(e[key])){emit(s,'item_'+key,e.id,old[key],e[key],action.id);observeProperty(s,e,key,e[key],action);}
        syncEntityTruth(s,e);
      }
      for(const n of Object.values(s.world.npcs)) {
        const old=before.relationships.find(v=>v.id===n.id);if(!old)continue;
        for(const key of ['trust','tension','location'])if(old[key]!==n[key])emit(s,'npc_'+key,n.id,old[key],n[key],action.id);
      }
      for(const key of ['danger','discovery'])if(before.clocks[key]!==s.clocks[key]){emit(s,'clock_'+key,key,before.clocks[key],s.clocks[key],action.id);truth(s,'clock:'+key,s.clocks[key]);}
      if(before.player.location!==s.world.player.location)emit(s,'player_move','player',before.player.location,s.world.player.location,action.id);
      return s.world.events.filter(e=>e.cause===action.id);
    }
    function analyze(s,config,c,fullText=c.text) {
      const lower=c.lower;let intent=c.intent;
      const directed=c.text.match(/(?:прошу|говорю|сообщаю|отдаю|дарю|передаю|спрашиваю|оскорбляю|обращаюсь к|говорю с)\s+([А-Яа-яЁё-]+(?:\s+[А-Яа-яЁё-]+)?)/iu)?.[1];
      const direct=c.text.match(/^([А-Яа-яЁё-]+)[:,]\s*(?:вынеси|перенеси|унеси|спрячь|открой)/iu);
      let receiver=direct?findNpc(s,direct[1]):directed?findNpc(s,directed):null;
      const unresolvedRecipient=Boolean((direct||directed&&/^[А-ЯЁ]/u.test(directed))&&!receiver);
      if(/(?:говорю с|обращаюсь к|знакомлюсь с)/.test(lower)) {intent='select_npc';receiver=findNpc(s,c.text);}
      if(/^(?:я )?(?:лгу|вру|обманываю|сообщаю|утверждаю|заявляю)/.test(lower))intent='claim';
      if(c.intent==='canon'||c.intent==='lie')intent='claim';
      if(c.intent==='magic'&&/телепорт/.test(lower))intent='move';
      if(/прошу.*(?:прочитать|изучить|посмотреть)/.test(lower))intent='show';
      if(/подбрасыва|подделыва|фабрикую/.test(lower))intent='plant_evidence';
      if((/^(?:я )?(?:прошу|договариваюсь|предлагаю|попросить)/.test(lower)||direct)&&/вынест|вынеси|перенест|перенеси|унест|унеси|спрят|спряч|открой позже|открыть позже/.test(lower))intent='request_plan';
      if(/^(?:я )?(?:выношу|переношу|уношу|тащу|несу)\s/.test(lower))intent='carry';
      if(/покупаю|куплю/.test(lower))intent='buy';
      if(/ищу работу|найти работу|есть работа|нужна работа|ищу подработку|хочу работать/.test(lower))intent='find_job';
      if(/^(?:я )?(?:работаю|чиню инструменты|помогаю в мастерской|выполняю работу)/.test(lower))intent='work';
      if(/забираю (?:плату|зарплату)|получаю (?:плату|зарплату)|плати за работу/.test(lower))intent='collect_pay';
      if(/доставляю|вручаю посылку/.test(lower))intent='deliver_job';
      if(/осматриваю город|исследую город|исследую район|изучаю город|ищу знакомства/.test(lower))intent='explore';
      if(/^(?:я )?(?:делаю|мастерю|изготавливаю|переделываю|превращаю).*?(?:кулон|украшение|браслет|ожерелье)/.test(lower))intent='craft_gift';
      let primary=['take','drop','give','use','combine'].includes(intent)?c.text.split(/\s+(?:в|на|под|за|через|чтобы)\s+/iu)[0]:c.text;
      if(intent==='craft_gift')primary=(c.text.match(/из\s+([^,.!?]+?)(?=\s+(?:на|с помощью|чтобы|как)|[,.;!?]|$)/iu)?.[1]||c.text.split(/\s+(?:в|как)\s+/iu)[0]).replace(/украшение|кулон|браслет|ожерелье/giu,'');
      const target=matchEntity(s,primary,true);
      if(intent===c.intent&&c.intent==='hide'&&target)intent='hide_item';
      if(/позже|когда вернемся|когда вернусь|через \d+ ход/.test(lower)&&intent!=='request_plan'&&['open','hide_item','carry'].includes(intent))intent='defer';
      if(c.hypothetical||c.negated)intent=c.intent;
      const explicitGoal=fullText.match(/(?:чтобы|с целью|ради того чтобы)\s+([^,.!?]+)/iu)?.[1];
      const goal=clean(explicitGoal||s.facts.goal||'');
      const method=clean(c.text.match(/(?:с помощью|используя|посредством)\s+([^,.!?]+)/iu)?.[1]||(/^(?:прошу|договариваюсь)/.test(lower)?'договорённость':/незаметно/.test(lower)?'скрытно':intent==='craft_gift'?(/превращаю/.test(lower)&&profile(config).magic?'преобразование':'ремесло'):intent));
      let expectedEffect=/довер|располож|примир/.test(norm(goal))?'изменить отношение адресата':intent==='claim'||intent==='plant_evidence'?'изменить убеждение адресата':intent==='move'||intent==='return'?'оказаться в соседней локации':intent==='request_plan'?'согласовать перенос, укрытие и отложенный шаг':intent==='open'?'получить доступ к содержимому':goal||'получить результат указанного действия';
      if(c.negated)expectedEffect='воздержаться от действия';
      return {id:'action:'+s.turn+':'+s.world.nextEvent+':'+hash(c.text),actor:'player',intent,intention:intent,targetId:target?.id||null,targetLabel:target?.label||null,recipientId:receiver?.id||s.world.activeNpcId,unresolvedRecipient,goal,goalSource:explicitGoal?'explicit':goal?'player-context':'unspecified',method,expectedEffect,text:c.text,scope:'play',hypothetical:c.hypothetical,negated:c.negated};
    }
    function accessible(s,e,actor='player') {
      if(!e||e.destroyed)return false;
      const actorLocation=actor==='player'?s.world.player.location:s.world.npcs[actor]?.location;
      return e.location===(actor==='player'?'inventory':actor) || e.location===byLoc(s,actorLocation)?.name;
    }
    function adjacent(s,from,to) {return s.world.edges.find(e=>e.from===from&&e.to===to);}
    function blocked(s,e) {const item=e?.barrierId&&s.entities.find(v=>v.id===e.barrierId);return item&&!item.opened&&item.locked&&!item.destroyed&&!item.bypassed;}
    function exits(s,from=s.world.player.location) {return s.world.edges.filter(e=>e.from===from).map(e=>({...byLoc(s,e.to),blocked:blocked(s,e)}));}
    function routeRefusal(s) {return exits(s).map(l=>l.name+(l.blocked?' (заперто)':'')).join(', ')||'нет известных выходов';}
    function moveActor(s,actor,destination) {
      const from=actor==='player'?s.world.player.location:s.world.npcs[actor]?.location;
      const link=adjacent(s,from,destination.id);
      if(!link)return no('Прямого перехода нет. Доступные выходы: '+(actor==='player'?routeRefusal(s):exits(s,from).map(l=>l.name).join(', '))+'.','no_route');
      if(blocked(s,link))return no('Переход заперт. Сначала откройте преграду или найдите реальный обход.','route_blocked');
      if(actor!=='player'){s.world.npcs[actor].location=destination.id;return ok('Персонаж переходит: '+destination.name+'.');}
      flush(s);s.world.player.previousLocation=from;s.world.player.location=destination.id;s.previousPlace=byLoc(s,from).name;s.place=destination.name;s.facts.hidden=false;destination.visits++;
      if(!s.world.loops.exploration.visited.includes(destination.id))s.world.loops.exploration.visited.push(destination.id);
      presence(s);return ok(`Вы переходите: ${destination.name}. ${s.npcPresent?'Здесь: '+npc(s).name+'.':'Поблизости нет знакомого собеседника.'} Выходы: ${routeRefusal(s)}.`,'moved');
    }
    function destination(s,text) {
      if(/наружу|снаружи/.test(norm(text)))return byLoc(s,s.world.outdoorId);
      const m=text.match(/(?:в|на|к)\s+([^,.!?]+?)(?=\s+(?:и |потом|затем|чтобы)|[,;.!?]|$)/iu);
      return m?findLocation(s,m[1]):null;
    }
    function hear(s,n,prop,source,weight,linkedToPlayer=false) {
      const old=n.beliefs[prop.key];
      if(old?.sources?.[source]!==undefined||Object.values(old?.hypotheses||{}).some(h=>h.sources?.[source]!==undefined))return old;
      if(old&&norm(old.value)!==norm(prop.value)&&old.certainty==='known'&&old.sources?.canon) {emit(s,'belief_rejected',n.id,prop,old);return old;}
      const hypotheses=clone(old?.hypotheses||{});
      if(old&&!Object.keys(hypotheses).length)hypotheses[norm(old.value)]={value:old.value,text:old.text,sources:{...old.sources},confidence:old.confidence};
      const candidateKey=norm(prop.value);const candidate=hypotheses[candidateKey]||{value:prop.value,text:prop.text,sources:{},confidence:0};
      if(linkedToPlayer&&own(candidate.sources,'player'))weight=0;
      candidate.sources[source]=weight;
      let remaining=1;for(const amount of Object.values(candidate.sources))remaining*=1-amount;candidate.confidence=Math.min(.97,1-remaining);
      hypotheses[candidateKey]=candidate;
      const winner=Object.values(hypotheses).sort((a,b)=>b.confidence-a.confidence)[0];
      const confidence=winner.confidence;
      const belief={key:prop.key,value:winner.value,text:winner.text,confidence,sources:winner.sources,hypotheses,turn:s.turn,certainty:confidence>=.7?'convinced':'tentative'};
      n.beliefs[prop.key]=belief;emit(s,'belief_changed',n.id,old||null,belief);
      if(confidence>=.7&&prop.key==='виновник') {n.agenda={type:'investigate',target:belief.value,cause:source};emit(s,'npc_intention',n.id,null,n.agenda);}
      return belief;
    }
    function observeEvidence(s,n,e) {
      if(!e?.evidence||e.destroyed||!(e.location===n.id||e.location==='inventory'&&here(s,n)||e.location===byLoc(s,n.location)?.name))return null;
      const meta=e.evidence;
      if(meta.witnessedBy?.includes(n.id)) {
        hear(s,n,meta.proposition,'evidence:'+e.id,0,true);
        conflict(s,n,'staged_evidence','Вы пытались выдать подброшенную улику за независимое подтверждение.');
        if(n.id===s.world.activeNpcId){s.trust=Math.max(-5,s.trust-1);s.tension++;}
        return voice(s,npcProfile(s,s.world.authorCanon,profile(s.world.authorCanon)),'Я видел, откуда появилась эта улика. Она не подтверждает вашу версию независимо.');
      }
      const belief=hear(s,n,meta.proposition,'evidence:'+e.id,.68,false);
      return `${n.name} изучает «${e.label}». ${belief.confidence>=.7?'Теперь версия кажется убедительной':'Пока это только предположение'}: ${belief.text}.`;
    }
    function canUnlock(s,n,e) {return n.access.includes(e.id)||s.entities.some(v=>!v.destroyed&&v.location===n.id&&v.unlocks?.includes(e.id));}
    function npcOpen(s,p,n,e,cause) {
      if(!accessible(s,e,n.id))return no('Предмет находится не там, где персонаж.','target_not_present');
      if(e.opened)return ok('Предмет уже открыт.','already_open');
      if(openGrievances(n).length)return no(n.name+' помнит конфликт и не соглашается помогать до примирения.','unresolved_conflict');
      if(e.locked&&!canUnlock(s,n,e))return no(n.name+': подходящего ключа или права доступа у меня нет.','npc_has_no_access');
      const old=s.place;s.place=byLoc(s,n.location).name;const text=resolveBarrier(s,p,e,'помощь '+n.name);s.place=old;return ok(text,'npc_opened');
    }
    function makeDeferred(s,actor,e,text,planId) {
      const task={id:'task:'+s.world.nextEvent++,actor,targetId:e.id,intent:'open',location:actor==='player'?s.world.player.location:s.world.npcs[actor].location,notBeforeTurn:s.turn+1,trigger:/когда вернемся|когда вернусь/.test(norm(text))?'arrival':'manual',status:'pending',planId:planId||null};
      s.world.deferred.push(task);emit(s,'deferred_scheduled',task.id,null,task);return task;
    }
    function requestPlan(s,p,c,a,e,n) {
      if(!n||!here(s,n))return no('Здесь нет персонажа, с которым можно договориться.','npc_absent');
      if(!e)return ask('Какой предмет вы просите перенести?','missing_target');
      if(!e.portable)return no('Этот объект закреплён. Его нельзя просто вынести.','not_portable');
      if(!accessible(s,e)||e.hidden)return no('Предмет сейчас недоступен для переноса.','target_not_present');
      if(openGrievances(n).length||s.trust<0)return no(voice(s,p,'После нашего конфликта я не стану брать на себя такой план. Сначала обсудим причину.'),'unresolved_conflict');
      const dest=destination(s,c.text)||byLoc(s,s.world.outdoorId);
      const steps=[{intent:'carry',targetId:e.id,destinationId:dest.id}];
      if(/спрят|спряч|скрыть/.test(c.lower))steps.push({intent:'hide',targetId:e.id});
      if(/откр/.test(c.lower))steps.push({intent:/позже|когда|потом/.test(c.lower)?'defer':'open',targetId:e.id});
      const plan={id:'plan:'+s.world.nextEvent++,actor:n.id,goal:a.goal,expectedEffect:a.expectedEffect,steps,status:'proposed',cause:a.id,text:c.text};s.world.plans.push(plan);s.pending={kind:'world-plan',id:plan.id};
      return ok(voice(s,p,`Предлагаю так: вынести «${e.label}» в место «${dest.name}»${steps.some(v=>v.intent==='hide')?', спрятать там':''}${steps.some(v=>v.intent==='defer')?', а открыть по отдельному сигналу позже':''}. Подтверждаете?`),'plan_proposed');
    }
    function acceptPlan(s,p,n,plan) {
      if(!n||!here(s,n)||plan.actor!==n.id)return no('Договорённость относится к другому персонажу или месту.','wrong_participant');
      if(openGrievances(n).length)return no('Непримирённый конфликт мешает выполнить договорённость.','unresolved_conflict');
      const lines=[];plan.status='executing';let failed=false;
      for(const step of plan.steps) {
        const e=s.entities.find(v=>v.id===step.targetId);let r;
        if(!e||e.destroyed)r=no('Предмет больше недоступен.','target_not_present');
        else if(step.intent==='carry') {
          const dest=byLoc(s,step.destinationId);
          if(!e.portable||!accessible(s,e,n.id)&&e.location!=='inventory')r=no('Невозможно взять предмет для переноса.');
          else {
            r=moveActor(s,n.id,dest);
            if(r.status==='success'){s.inventory=s.inventory.filter(v=>v!==e.label);e.location=dest.name;emit(s,'npc_carried_item',e.id,null,{location:dest.name,actor:n.id},plan.cause);r=ok(n.name+' переносит «'+e.label+'»: '+dest.name+'.');}
          }
        } else if(step.intent==='hide') {e.hidden=true;e.hiddenBy=n.id;e.known=true;r=ok(n.name+' скрывает предмет, сохраняя его целым.');}
        else if(step.intent==='defer') {makeDeferred(s,n.id,e,plan.text,plan.id);r=ok('Открытие отложено. Сам предмет ещё закрыт.');}
        else r=npcOpen(s,p,n,e,plan.id);
        step.status=r.status;lines.push(r.text);if(r.status==='refused'||r.status==='clarification'){failed=true;break;}
      }
      plan.status=failed?'partial':'completed';s.pending=null;flush(s);emit(s,'plan_result',plan.id,'proposed',plan);presence(s);
      return failed?partial(lines.join('\n'),'plan_incomplete'):ok(lines.join('\n'),'plan_completed');
    }
    function observeHere(s) {
      const lines=[];for(const n of Object.values(s.world.npcs).filter(v=>here(s,v)))for(const e of s.entities.filter(v=>v.location===s.place&&!v.hidden&&v.evidence)) {
        if(!n.beliefs[e.evidence.proposition.key]?.sources?.['evidence:'+e.id]){const line=observeEvidence(s,n,e);if(line)lines.push(line);}
      }return lines;
    }
    function handle(s,p,c,config,a) {
      let n=npc(s);const e=s.entities.find(v=>v.id===a.targetId);
      if(c.hypothetical||c.negated)return null;
      if(a.unresolvedRecipient)return ask('К какому из существующих персонажей вы обращаетесь?','unknown_recipient');
      if(a.recipientId&&a.recipientId!==s.world.activeNpcId) {
        const receiver=s.world.npcs[a.recipientId];
        if(!here(s,receiver))return no('Персонаж '+receiver.name+' находится в другом месте. Разговор и передача отсюда невозможны.','npc_absent');
        flush(s);bind(s,receiver.id);n=receiver;p=npcProfile(s,config,p);
      }
      if(a.intent==='select_npc') {
        const target=findNpc(s,c.text,true);if(!target)return no('Здесь нет персонажа с таким именем.','npc_absent');
        flush(s);bind(s,target.id);return ok('Вы обращаетесь к '+target.name+'.','npc_selected');
      }
      if(a.intent==='move'||a.intent==='return') {
        if(/телепорт/.test(c.lower)&&!p.magic)return no('В этом мире магия не установлена.','magic_forbidden');
        const target=a.intent==='return'?byLoc(s,s.world.player.previousLocation):destination(s,c.text)||(/ухожу|выхожу|покидаю|уйти|до свидания/.test(c.lower)?byLoc(s,s.world.outdoorId):null);
        if(!target)return ask('Куда идти? Известные выходы: '+routeRefusal(s)+'.','unknown_destination');
        const r=moveActor(s,'player',target);if(r.status==='success')r.text+='\n'+observeHere(s).join('\n');return r;
      }
      if(a.intent==='claim') {
        const text=c.text.replace(/^(?:запомни|факт|правило|лгу|вру|обманываю|сообщаю|утверждаю|заявляю)\s*[:—-]?\s*(?:что\s+)?/iu,'');
        if(!clean(text))return ask('Какую версию вы сообщаете?','missing_claim');
        s.facts.note=text;s.notes.push(text);s.notes=s.notes.slice(-50);s.facts.claim=text;
        emit(s,'player_statement','player',null,{text,recipient:here(s,n)?n.id:null});log(s,'claim','Слова игрока: '+text);
        if(!n||!here(s,n))return ok('Вы записываете свою версию: '+text+'. Это сообщение игрока; факты и правила мира остаются прежними.','statement_recorded');
        const prop=proposition(s,text),belief=hear(s,n,prop,'player',Math.max(.2,Math.min(.65,.45+s.trust*.04)));
        return ok(voice(s,p,`Я запомню вашу версию: ${prop.text}. ${belief.confidence>=.7?'Она кажется убедительной.':'Пока я не могу считать её доказанной.'}`),'claim_heard');
      }
      if(a.intent==='plant_evidence'||(c.intent==='write'&&/[:«]/.test(c.text))) {
        const paper=e||s.entities.find(v=>v.location==='inventory'&&['clue','prop'].includes(v.kind)&&/бумаг|письм|записк/.test(norm(v.label)));
        if(!paper||paper.location!=='inventory'||paper.destroyed)return no('Для такой улики нужен реальный носитель при вас: записка, письмо или бумага.','missing_evidence_carrier');
        const payload=c.text.match(/[:«]\s*([^»]+)/u)?.[1];
        if(!payload&&!paper.evidence)return ask('Что именно должно быть написано на улике?','missing_evidence_content');
        const witnesses=Object.values(s.world.npcs).filter(v=>here(s,v)&&!s.facts.hidden&&!/незаметно|тайно/.test(c.lower)).map(v=>v.id);
        if(payload)paper.evidence={proposition:proposition(s,payload),authenticity:'fabricated',createdBy:'player',witnessedBy:witnesses};
        if(/подбрасыва/.test(c.lower)){paper.location=s.place;paper.hidden=false;s.inventory=s.inventory.filter(v=>v!==paper.label);}
        emit(s,'evidence_created',paper.id,null,paper.evidence);log(s,'evidence','На носителе '+paper.label+' записана версия: '+paper.evidence.proposition.text);
        let text='Улика существует как предмет. Её текст не становится правдой мира. ';
        if(witnesses.length)text+='Персонаж заметил ваши манипуляции; независимого подтверждения не получилось.';
        else text+='Происхождение не замечено присутствующими.';
        if(paper.location===s.place)text+='\n'+observeHere(s).join('\n');
        return witnesses.length?partial(text,'evidence_origin_observed'):ok(text,'evidence_planted');
      }
      if(a.intent==='show'&&e?.evidence) {
        if(!n||!here(s,n))return no('Некому показать улику.','npc_absent');
        if(!accessible(s,e))return no('Улика недоступна.','target_not_present');
        return ok(observeEvidence(s,n,e),'evidence_observed');
      }
      if(c.intent==='inspect'&&e?.evidence) {
        if(!accessible(s,e))return no('Улика находится в другом месте.','target_not_present');
        return ok('На «'+e.label+'» записано: '+e.evidence.proposition.text+'. Это содержание носителя, а не доказанная истина.','evidence_read');
      }
      if(c.intent==='question'&&/кто украл|кто винов|кто вор|во что веришь|твоя версия|считаешь винов|кто взял/.test(c.lower)) {
        if(!n||!here(s,n))return no('Рядом нет собеседника.','npc_absent');
        const belief=n.beliefs['виновник']||Object.values(n.beliefs).at(-1);
        if(!belief)return ok(voice(s,p,'У меня пока нет версии, которую я могу обосновать.'),'belief_unknown');
        return ok(voice(s,p,(belief.confidence>=.7?'Я считаю':'Я пока предполагаю')+': '+belief.text+'. Основание — то, что мне сообщили и что я видел.'),'belief_reported');
      }
      if(a.intent==='request_plan')return requestPlan(s,p,c,a,e,n);
      if(c.intent==='agree'&&s.pending?.kind==='world-plan') {
        const plan=s.world.plans.find(v=>v.id===s.pending.id);return plan?acceptPlan(s,p,n,plan):ask('Предложение больше не найдено.');
      }
      if(a.intent==='carry') {
        if(!e)return ask('Какой предмет переносить?','missing_target');
        if(!e.portable)return no('Предмет закреплён и не переносится целиком.','not_portable');
        if(!accessible(s,e))return no('Сначала доберитесь до предмета.','target_not_present');
        const dest=destination(s,c.text);if(!dest)return ask('В какую из известных локаций переносить предмет?','unknown_destination');
        const r=moveActor(s,'player',dest);if(r.status!=='success')return r;
        e.location='inventory';e.hidden=false;s.focus=e.id;if(!s.inventory.includes(e.label))s.inventory.push(e.label);
        return ok(`Вы переносите «${e.label}»: ${dest.name}. Предмет всё ещё закрыт, если вы его не открывали.`,'item_carried');
      }
      if(a.intent==='hide_item') {
        if(!accessible(s,e))return no('Предмет недоступен для укрытия.','target_not_present');
        if(e.location==='inventory'){s.inventory=s.inventory.filter(v=>v!==e.label);e.location=s.place;}
        e.hidden=true;e.hiddenBy='player';e.known=true;s.focus=e.id;emit(s,'item_hidden',e.id,false,true);return ok('Вы скрываете «'+e.label+'» здесь. Состояние замка и содержимое не меняются.','item_hidden');
      }
      if(a.intent==='defer') {
        if(!e)return ask('Какой предмет и по какому сигналу открыть позже?','missing_target');
        if(!accessible(s,e))return no('Нельзя отложить действие с недоступным предметом.','target_not_present');
        makeDeferred(s,'player',e,c.text);return ok('Открытие «'+e.label+'» отложено. Для выполнения скажите явно: «Открываю '+e.label+'».','action_deferred');
      }
      if(a.intent==='craft_gift') {
        if(!e||!accessible(s,e)||e.location!=='inventory')return no('Для переделки нужен исходный предмет при вас.','missing_material');
        const magical=/превращаю/.test(c.lower)&&p.magic;
        const hasTools=s.entities.some(v=>v.location==='inventory'&&!v.destroyed&&/цепоч|проволок|инструмент|нож/.test(norm(v.label)))||/мастерск/.test(norm(s.place));
        if(!magical&&!hasTools)return no('Для такой переделки нужны инструменты, цепочка или мастерская. Предмет не меняется от одного названия.','missing_tools');
        const preserve=/не меняя|сохраняя|на цепоч|как кулон/.test(c.lower);
        const form=c.text.match(/(?:в|как)\s+(кулон|украшение|браслет|ожерелье)/iu)?.[1]||'украшение';
        const value=addEntity(s,form,{id:'crafted:'+s.world.nextEvent++,location:'inventory',source:'crafted',kind:'prop',portable:true,lineage:[e.id,...e.lineage],unlocks:preserve?[...e.unlocks]:[],craftedEffort:1,planGoal:a.goal});
        if(preserve){
          const chain=s.entities.find(v=>v.id!==e.id&&v.location==='inventory'&&!v.destroyed&&/цепоч|шнур/.test(norm(v.label)));
          if(chain){value.lineage.push(chain.id);chain.destroyed=true;chain.location='transformed';s.inventory=s.inventory.filter(v=>v!==chain.label);}
        }
        e.destroyed=true;e.location='transformed';s.inventory=s.inventory.filter(v=>v!==e.label);s.inventory.push(value.label);s.focus=value.id;
        emit(s,'transformation',value.id,e.id,{label:value.label,lineage:value.lineage,unlocks:value.unlocks});log(s,'creation',e.label+' переделан в '+value.label);
        return ok(`Вы создаёте «${value.label}» из «${e.label}». ${preserve?'Функциональная часть сохранена.':'Прежняя функция ключа не сохранена.'} Происхождение и работа над подарком запомнятся.`,'gift_crafted');
      }
      if(c.intent==='give') {
        if(!n||!here(s,n))return no('Рядом нет адресата.','npc_absent');
        if(!e||e.location!=='inventory'||e.destroyed)return no('Этого предмета у вас нет.','item_not_owned');
        const important=meaningful(s,n,e),effort=Boolean(e.craftedEffort);e.location=n.id;s.inventory=s.inventory.filter(v=>v!==e.label);s.facts.lastGift=e.label;s.focus=e.id;
        const before=s.trust;s.trust=Math.min(5,s.trust+(important?2:1));
        if(important)for(const g of openGrievances(n))g.reparation=true;
        const repaired=reconcile(s,n);
        emit(s,'gift_received',n.id,null,{itemId:e.id,lineage:e.lineage,meaningful:important,crafted:effort,expectedEffect:a.expectedEffect});
        const eligible=s.trust>=1&&!openGrievances(n).length;emit(s,'cooperation_access',n.id,before>=1,{eligible,reason:repaired?'reconciliation':important?'meaningful_gift':'gift'},a.id);
        log(s,'item','Передано '+n.name+': '+e.label);
        return ok(voice(s,p,repaired?'Вы признали причину ссоры и принесли важную для меня вещь. Я готов снова помогать, хотя случившееся не забыто.':openGrievances(n).length?'Подарок я принял, но причина нашей ссоры ещё не устранена. Нужны и извинение, и важный для меня поступок.':important?'Этот подарок связан с тем, что для меня важно. Я это запомню и готов обсудить помощь.':effort?'Вы сделали это специально, и я вижу вложенное усилие. Теперь к вашей просьбе я отнесусь внимательнее.':'Спасибо за подарок. Что вы хотите обсудить?'),'gift_received');
      }
      if(c.intent==='apology'&&n&&openGrievances(n).length) {
        for(const g of openGrievances(n))g.apology=true;
        s.trust=Math.min(5,s.trust+1);s.tension=Math.max(1,s.tension-1);const repaired=reconcile(s,n);
        return repaired?ok(voice(s,p,'Извинение и поступок приняты. Мы можем продолжить.'),'reconciled'):partial(voice(s,p,`Я услышал извинение. Причина ссоры — «${openGrievances(n)[0].reason}». Покажите серьёзность намерения: для меня важно ${n.cherished||n.motive}.`),'reconciliation_pending');
      }
      if(['help','bargain'].includes(c.intent)||c.intent==='question'&&/секрет|откроешь|поможешь/.test(c.lower)) {
        if(n&&openGrievances(n).length)return no(voice(s,p,'Я помню, почему мы поссорились. Сначала признайте причину и выполните условие примирения.'),'unresolved_conflict');
      }
      if(c.intent==='help'&&e?.kind==='barrier'&&s.trust>=1&&n) {
        if(!canUnlock(s,n,e))return no(voice(s,p,'Я готов помочь, но у меня нет подходящего ключа. Доверие само по себе замок не открывает.'),'npc_has_no_access');
      }
      if(c.intent==='agree'&&s.pending?.kind==='npc-help') {
        const target=s.entities.find(v=>v.id===s.pending.id);s.pending=null;
        if(!target||!n)return no('Предмет или персонаж сейчас недоступен.','target_not_present');
        const r=npcOpen(s,p,n,target,a.id);if(r.status==='success')s.facts.debt=n.motive;return r;
      }
      if(c.intent==='open'&&e) {
        const task=s.world.deferred.find(v=>v.status==='pending'&&v.targetId===e.id);
        if(task&&task.actor!=='player') {
          const actor=s.world.npcs[task.actor];if(s.turn<task.notBeforeTurn)return no('Согласованный срок ещё не наступил.','not_due');
          if(!here(s,actor))return no('Нужно находиться рядом с исполнителем отложенного действия.','npc_absent');
          const r=npcOpen(s,p,actor,e,a.id);task.lastOutcome=r.status;if(r.status==='success'){task.status='completed';task.completedTurn=s.turn;}emit(s,'deferred_result',task.id,null,{status:task.status,outcome:r.status});return r;
        }
      }
      if(a.intent==='buy') {
        if(!n||!here(s,n))return no('Здесь нет продавца.','no_seller');
        const item=s.entities.find(v=>v.stockOwner===n.id&&v.location===n.id&&namesMatch(v.label,c.text));
        if(!item)return ask('В продаже: '+s.entities.filter(v=>v.stockOwner===n.id&&v.location===n.id).map(v=>v.label+' — '+v.price).join(', ')+'.','unknown_product');
        if(s.world.player.money<item.price)return no('Не хватает монет. Цена: '+item.price+'.','insufficient_money');
        s.world.player.money-=item.price;item.location='inventory';if(!s.inventory.includes(item.label))s.inventory.push(item.label);
        truth(s,'player:money',s.world.player.money);return ok('Вы покупаете «'+item.label+'» за '+item.price+' монеты.','purchased');
      }
      if(a.intent==='find_job') {
        if(!n||!here(s,n)||!['рынок','мастерская','площадь'].some(v=>norm(s.place).includes(v)))return no('Работу предлагают на рынке, в мастерской или на площади. До них нужно дойти по карте.','no_employer_here');
        if(openGrievances(n).length)return no(voice(s,p,'До примирения я не стану предлагать вам работу.'),'unresolved_conflict');
        const work=s.world.loops.work;
        if(['accepted','ready','completed'].includes(work.status))return ask('У вас уже есть работа. Завершите или получите оплату, прежде чем брать следующую.','job_in_progress');
        const type=/мастерск/.test(norm(s.place))?'repair':'delivery';
        Object.assign(work,{id:'job:'+ ++work.serial,employer:n.id,type,status:'offered',progress:0,reward:3,paid:false});s.pending={kind:'job-offer',id:work.id};
        return ok(voice(s,p,type==='repair'?'Есть работа: две части ремонта инструментов. За обе — три монеты. Берётесь?':'Нужно отнести посылку Лее на площадь. За доставку — три монеты. Берётесь?'),'job_offered');
      }
      if(c.intent==='agree'&&s.pending?.kind==='job-offer') {
        const work=s.world.loops.work;if(work.employer!==n?.id)return no('Предложение относится к другому нанимателю.','wrong_participant');
        work.status='accepted';s.pending=null;
        if(work.type==='delivery'){const parcel=addEntity(s,'посылка '+work.id,{id:work.id+':parcel',location:'inventory',kind:'prop',portable:true,source:'job'});s.inventory.push(parcel.label);work.parcelId=parcel.id;}
        return ok('Работа принята. '+(work.type==='repair'?'Начните ремонт в мастерской.':'Посылка при вас; получатель — Лея на площади.'),'job_accepted');
      }
      if(a.intent==='work') {
        const w=s.world.loops.work;
        if(w.status!=='accepted'||w.type!=='repair')return no('Сначала договоритесь о подходящей работе.','no_active_job');
        if(!here(s,s.world.npcs[w.employer]))return no('Работа выполняется в мастерской нанимателя.','wrong_workplace');
        if(w.lastWorkTurn===s.turn)return no('Вторую часть работы нужно сделать отдельным ходом.','work_needs_time');
        w.lastWorkTurn=s.turn;w.progress++;if(w.progress>=2)w.status='completed';
        return w.status==='completed'?ok('Обе части ремонта готовы. Теперь можно забрать плату.','job_completed'):partial('Первая часть ремонта готова. Осталась вторая.','job_progress');
      }
      if(a.intent==='deliver_job') {
        const w=s.world.loops.work,target=findNpc(s,'Лея',true),parcel=s.entities.find(v=>v.id===w.parcelId);
        if(w.status!=='accepted'||!parcel||parcel.location!=='inventory')return no('При вас нет активной посылки по договору.','no_delivery');
        if(!target)return no('Получателя нет здесь. Лея находится на площади.','recipient_absent');
        parcel.location=target.id;s.inventory=s.inventory.filter(v=>v!==parcel.label);w.status='completed';return ok('Лея принимает посылку. Вернитесь к нанимателю за оплатой.','delivery_completed');
      }
      if(a.intent==='collect_pay') {
        const w=s.world.loops.work;
        if(w.status!=='completed'||w.paid)return no('Неоплаченной завершённой работы нет.','nothing_to_pay');
        if(!here(s,s.world.npcs[w.employer]))return no('За оплатой нужно вернуться к нанимателю.','employer_absent');
        w.paid=true;w.status='paid';s.world.player.money+=w.reward;truth(s,'player:money',s.world.player.money);return ok('Вы получаете '+w.reward+' монеты. Оплата этого договора выдана один раз.','job_paid');
      }
      if(a.intent==='explore') {
        const exploration=s.world.loops.exploration;
        const id='discovery:'+s.world.player.location;
        if(!exploration.discoveries.includes(id)){exploration.discoveries.push(id);log(s,'exploration','Исследовано место: '+s.place);}
        const locals=Object.values(s.world.npcs).filter(v=>here(s,v));
        for(const person of locals)if(!s.world.loops.social.contacts.includes(person.id)){s.world.loops.social.contacts.push(person.id);person.contacts++;}
        return ok(`Место: ${s.place}. ${locals.length?'Здесь можно познакомиться: '+locals.map(v=>v.name).join(', ')+'.':'Знакомых здесь пока нет.'} Выходы: ${routeRefusal(s)}. Основная загадка не меняется от этого выбора.`,'area_explored');
      }
      return null;
    }
    function after(s,p,c,a,r) {
      const n=npc(s);
      if(n&&here(s,n)&&!c.hypothetical&&!c.negated) {
        if(/меня зовут|мое имя|зови меня/.test(c.lower)&&s.facts.name){n.memory.playerName=s.facts.name;hear(s,n,{key:'player:name',value:s.facts.name,text:'Игрок представился: '+s.facts.name},'player:identity',.6);}
        if(/хочу|моя цель|мне нужно|собираюсь/.test(c.lower)&&s.facts.goal&&!c.question)n.memory.playerGoal=s.facts.goal;
        if(['insult','threat','attack'].includes(c.intent)&&r.status!=='clarification'&&r.status!=='refused'&&!r.text.includes('не нападение на собеседника'))conflict(s,n,c.intent,c.text);
        if((['greet','identity','talk','comfort'].includes(c.intent)||['select_npc','find_job'].includes(a.intent))&&!s.world.loops.social.contacts.includes(n.id))s.world.loops.social.contacts.push(n.id);
      }
      if(c.intent==='open'&&r.status==='success')for(const task of s.world.deferred)if(task.targetId===a.targetId&&task.actor==='player'&&task.status==='pending'&&s.entities.find(e=>e.id===task.targetId)?.opened){task.status='completed';task.completedTurn=s.turn;}
      flush(s);presence(s);
    }
    function runDue(s,p) {
      const lines=[];
      for(const task of s.world.deferred.filter(v=>v.status==='pending'&&v.trigger==='arrival'&&s.turn>=v.notBeforeTurn&&v.location===s.world.player.location)) {
        if(task.actor==='player')continue;
        const actor=s.world.npcs[task.actor],target=s.entities.find(v=>v.id===task.targetId);
        if(!actor||!target||!here(s,actor))continue;
        const before=snapshot(s);const previousCause=s.currentActionId;s.currentActionId=task.id;
        const r=npcOpen(s,p,actor,target,task.id);task.lastOutcome=r.status;
        if(r.status==='success'){task.status='completed';task.completedTurn=s.turn;}emit(s,'deferred_result',task.id,null,{status:task.status,outcome:r.status},task.id);lines.push({...r,action:{id:task.id,actor:task.actor,intent:'open',intention:'open',targetId:task.targetId,goal:'исполнить отложенное действие',method:'договорённость',expectedEffect:'получить доступ',scope:'play'},effects:effects(s,before,{id:task.id})});s.currentActionId=previousCause;
      }return lines;
    }
    function assessGoal(s,results) {
      const relevant=results.filter(r=>r.action?.goalSource==='explicit');
      if(!relevant.length)return null;
      const goal=norm(relevant[0].action.goal);
      if(!/довер|примир/.test(goal))return {status:'unverified',goal:relevant[0].action.goal,reason:'Не всякий долгосрочный замысел имеет автоматическую проверку.'};
      const recipient=[...relevant].reverse().find(r=>r.action.intent==='give')?.action.recipientId||relevant[0].action.recipientId;
      const n=s.world.npcs[recipient];
      const achieved=Boolean(n&&n.trust>=1&&!openGrievances(n).length);
      return {status:achieved?'achieved':'pending',goal:relevant[0].action.goal,recipientId:recipient,observedTrust:n?.trust??null,openConflicts:openGrievances(n).map(g=>g.id),reason:achieved?'Достигнуты условия сотрудничества.':'Предмет мог быть передан, но требуемое доверие пока не достигнуто.'};
    }
    function map(s){return {current:s.world.player.location,locations:s.world.locations.map(v=>({...v,people:Object.values(s.world.npcs).filter(n=>n.location===v.id).map(n=>n.name)})),edges:clone(s.world.edges),exits:exits(s)};}
    return {init,analyze,handle,after,flush,bind,presence,npc,npcProfile,openGrievances,snapshot,effects,runDue,map,assessGoal,proposition,emit,truth,annotate,statuses,result};
  }};
})(globalThis);
