/* Shared entities, quantities, transactions, world properties and causal records. */
(function(root){
  'use strict';
  function create(H){
    const {norm,hash,clone,emit,findNpc,findLocation,makeNpc,moveActor,dialogue,social,conversation}=H;
    const same=(a,b)=>root.StorySpatial.same(a,b);
    const number=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
    const id=(s,kind)=>'rpg:'+kind+':'+s.world.rpg.nextId++;
    const result=(text,code='rpg_completed',extra={})=>({status:'success',code,text,performed:true,completed:true,effects:[],...extra});
    const require=(condition,code,text,status='refused')=>{if(!condition)throw {rpgRejection:true,status,code,text};};
    const place=(s,actor='player')=>s.world.locations.find(l=>l.id===(actor==='player'?s.world.player.location:s.world.npcs[actor]?.location));
    const holder=(s,actor='player')=>actor==='player'?'inventory':actor;
    const item=(s,id)=>s.entities.find(e=>e.id===id);
    function available(s,e,actor='player',includeHidden=false){return Boolean(e&&!e.destroyed&&(e.location===holder(s,actor)||e.location===place(s,actor)?.name||s.world.npcs[e.location]?.location===place(s,actor)?.id)&&H.containerAccess(s,e)&&(includeHidden||!e.hidden));}
    function qty(e){return Math.max(0,number(e?.quantity,1));}
    function props(e){return e?.physical||{};}
    function weight(s,actor='player'){return s.entities.filter(e=>e.location===holder(s,actor)&&!e.destroyed).reduce((sum,e)=>sum+props(e).mass*qty(e),0);}
    function accessibleItems(s,actor='player'){return s.entities.filter(e=>available(s,e,actor));}
    function match(s,text,options={}){
      const {actor='player',absent=false,inventory=false,all=false}=options;
      const lexeme=word=>{const stem=H.stem(word).replace(/ь$/u,'');return {досок:'доск',палок:'палк',камн:'камен',ножей:'нож',стульев:'стул'}[stem]||stem;};
      const q=norm(text||'').replace(/\b(?:rpg|item)\b/g,''),tokens=H.words(q).map(lexeme);
      let candidates=s.entities.filter(e=>!e.destroyed&&(absent||available(s,e,actor,Boolean(options.hidden)))&&(!inventory||e.location===holder(s,actor)));
      if(options.filter)candidates=candidates.filter(options.filter);
      const ranked=candidates.map(e=>{let score=0;for(const label of [e.label,...(e.aliases||[]),e.id]){const key=norm(label);score=Math.max(score,(same(key,q)?40:q.includes(key)?20+key.length:0)+H.words(key).map(lexeme).filter(word=>word.length>=2&&tokens.includes(word)).length*4);}return {e,score};}).filter(v=>v.score>0).sort((a,b)=>b.score-a.score);
      const ordinal=Math.max(0,number(q.match(/(?:номер|экземпляр|№)\s*(\d+)/u)?.[1],/втор(?:ой|ую|ого)/u.test(q)?2:/трет(?:ий|ью|ьего)/u.test(q)?3:1)-1);
      if(ranked.length)return all?ranked.map(v=>v.e):ranked[Math.min(ranked[0].score===ranked[1]?.score?ordinal:0,ranked.length-1)].e;
      if(/(?:^|\s)(?:его|ее|ним|ней|нему|ней|нем|это|этот|туда|им)(?=[\s,.!?]|$)/u.test(q))return item(s,s.focus)||null;
      return all?[]:null;
    }
    function target(s,c,options={}){const found=c.targetId&&item(s,c.targetId);return found&&(!options.inventory||found.location==='inventory')&&(options.absent||available(s,found,options.actor||'player'))?found:match(s,c.text,options);}
    function person(s,c,options={}){
      const n=s.world.npcs[c.npcId]||findNpc(s,c.text,Boolean(options.local));
      return n||(!options.explicit?s.world.npcs[s.world.activeNpcId]||H.npc(s):null);
    }
    function findPlace(s,text){const tokens=H.words(text).map(H.stem);return findLocation(s,text)||s.world.locations.find(l=>same(l.name,String(text).replace(/^(?:в|на|к|до|из)\s+/iu,'')))||s.world.locations.filter(l=>H.words(l.name).every(w=>tokens.includes(H.stem(w)))).sort((a,b)=>b.name.length-a.name.length)[0];}
    function route(s,from,to,actor='player'){
      if(from===to)return [];
      const queue=[[from,[]]],visited=new Set([from]);
      while(queue.length){const [at,path]=queue.shift();for(const edge of s.world.edges.filter(e=>e.from===at)){
        const door=item(s,edge.barrierId);if(door&&!door.destroyed&&(door.locked&&!door.opened||door.openingDegree==='slightly'||door.physical?.blocked))continue;
        if(edge.rpg?.blocked||edge.rpg?.private&&s.world.locations.find(l=>l.id===edge.to)?.ownerId!==actor||edge.rpg?.minimumRank&&!(s.world.rpg.memberships[actor]?.some(m=>m.status!=='expelled'&&m.rank>=edge.rpg.minimumRank&&(!edge.rpg.factionId||m.factionId===edge.rpg.factionId))))continue;
        if(edge.to===to)return [...path,edge.to];if(!visited.has(edge.to)){visited.add(edge.to);queue.push([edge.to,[...path,edge.to]]);}
      }}return null;
    }
    function syncInventory(s){
      const carried=s.entities.filter(e=>e.location==='inventory'&&!e.destroyed&&qty(e)>0);const labels=new Set(carried.map(e=>e.label));
      s.inventory=s.inventory.filter(label=>labels.has(label));for(const e of carried)if(!s.inventory.includes(e.label))s.inventory.push(e.label);
      s.world.player.inventoryIds=carried.map(e=>e.id);s.world.player.load=weight(s);s.world.player.overloaded=s.world.player.load>s.world.player.body.capacity;
    }
    function transfer(s,e,to,amount=qty(e),cause=null){
      require(e&&amount>0&&amount<=qty(e),'invalid_quantity','Нет такого количества предмета.');
      let moved=e;if(amount<qty(e)){e.quantity=qty(e)-amount;moved=clone(e);moved.id=id(s,'item');moved.quantity=amount;moved.aliases=[...(moved.aliases||[]),moved.id];s.entities.push(moved);}
      const before=moved.location;moved.location=to;delete moved.containerId;delete moved.supportId;moved.hidden=false;moved.known=true;
      moved.history||=[];moved.history.push({turn:s.turn,time:s.world.rpg.clock.minute,from:before,to,ownerId:moved.ownerId||null,cause:cause||s.currentActionId});
      emit(s,'rpg_item_transferred',moved.id,before,{to,quantity:amount},cause);syncInventory(s);return moved;
    }
    function consume(s,e,amount=1){require(e&&qty(e)>=amount,'insufficient_material','Недостаточно материала.');e.quantity=qty(e)-amount;if(!e.quantity){e.destroyed=true;e.location='consumed';}syncInventory(s);}
    function add(s,label,options={}){
      const e=H.addEntity(s,label,{id:id(s,'item'),known:true,hidden:false,portable:true,source:'rpg-crafted',location:'inventory',quantity:1,...options});annotate(s,e);syncInventory(s);return e;
    }
    function money(s,from,to,amount,reason,cause=null){
      amount=number(amount);require(amount>0,'invalid_price','Сумма должна быть положительной.');
      const account=who=>who==='player'?s.world.player:s.world.npcs[who]?.finance||s.world.rpg.accounts[who];
      const source=account(from),dest=account(to);require(source&&dest,'unknown_account','Участник расчёта не найден.');require(source.money>=amount,'insufficient_money','Недостаточно монет: нужно '+amount+', доступно '+source.money+'.');
      source.money-=amount;dest.money+=amount;const entry={id:id(s,'payment'),from,to,amount,reason,cause:cause||s.currentActionId,time:s.world.rpg.clock.minute};s.world.rpg.ledger.push(entry);emit(s,'rpg_payment',entry.id,null,entry,cause);H.truth(s,'player:money',s.world.player.money);return entry;
    }
    function annotate(s,e){
      e.quantity??=1;e.history||=[];
      if(!e.physical){
        const text=norm(e.label),metal=/ключ|нож|меч|молот|штифт|монет|брон|болт|гвозд|металл|проволок|механизм/.test(text),wood=/стол|стул|дерев|палк|доск|ларец|сундук|кровать|лестниц/.test(text),cloth=/ткан|рубах|плащ|одежд|бинт/.test(text),glass=/стекл|флакон|бутыл|зеркал/.test(text),paper=/письм|бумаг|записк|книг|чертеж|документ/.test(text);
        e.physical={material:metal?'metal':wood?'wood':cloth?'cloth':glass?'glass':paper?'paper':'stone',mass:/стул|кресл|скам/.test(text)?7:e.kind==='fixed'?20:e.kind==='barrier'?10:paper?.1:metal?1:1,volume:1,size:e.kind==='fixed'?2:1,temperature:20,durability:100,maxDurability:100,flammability:wood?.7:cloth?.9:paper?1:0,wetness:0,quality:1,wear:0,friction:.5,anchored:e.kind==='fixed'&&!e.movable&&!/стол|стул|кровать|шкаф|скам/.test(text),height:/стол/.test(text)?.8:/стул/.test(text)?.5:1,width:1,length:1,hollow:/бутыл|чашк|ящик|ларец|сундук|сосуд|сумк/.test(text),capacity:/сумк|сундук/.test(text)?20:/бутыл|чашк/.test(text)?2:0,functions:[],parts:[],position:{x:2+(s.entities.indexOf(e)%5)*1.5,y:Math.floor(s.entities.indexOf(e)/5)*2,z:0}};
      }
      const p=e.physical;p.functions||=[];p.parts||=[];p.position||={x:0,y:0,z:0};
      e.provenance||={created:s.world.rpg?.clock.minute||540,origin:e.location,creator:e.source==='player'?'player':e.ownerId||null};
    }
    function values(text){
      const out={};for(const segment of String(text||'').split(';')){const at=segment.indexOf('=');if(at<0)continue;const key=segment.slice(0,at).trim(),raw=segment.slice(at+1).trim();if(raw==='true'||raw==='да')out[key]=true;else if(raw==='false'||raw==='нет')out[key]=false;else if(raw&&!Number.isNaN(Number(raw)))out[key]=Number(raw);else if(raw.startsWith('[')||raw.startsWith('{')){try{out[key]=JSON.parse(raw);}catch{out[key]=raw;}}else out[key]=raw;}return out;
    }
    const skillNames={ремесло:'craft',ремонт:'repair',скрытность:'stealth',лазание:'climbing',плавание:'swimming',атлетика:'athletics',метание:'throwing',пилотирование:'piloting',программирование:'engineering',взлом:'hacking',археология:'archaeology',мореходство:'sailing',магия:'magic',алхимия:'alchemy',бой:'combat',подделка:'forgery'};
    const skillName=name=>skillNames[norm(name).trim()]||name;
    const materialLabel=value=>({wood:'дерево',metal:'металл',stone:'камень',cloth:'ткань',fiber:'волокно',wax:'воск',glass:'стекло',paper:'бумага',ore:'руда',sand:'песок',food:'пища',powder:'порошок'}[value]||value);
    const functionLabel=value=>({lever:'усиление рычага',pry:'поддевание',cut:'резание',light:'освещение',ignite:'разведение огня',seat:'сиденье',bed:'место для сна',container:'хранение',lockpick:'вскрытие замков',device:'управляемый механизм',moving_device:'подвижный механизм',repair:'ремонт',radio:'радиосвязь',magnify:'увеличение',protect_fragile:'защита хрупких вещей',vehicle:'перевозка',hammer:'работа молотком',saw:'пиление',pliers:'обработка металла',write:'письмо',food:'питание',heat:'нагрев',tie:'связывание',climb:'подъём',strike:'нанесение удара'}[value]||value);
    function authoredProperties(e,data){
      const materials={дерево:'wood',металл:'metal',ткань:'cloth',камень:'stone',воск:'wax',бумага:'paper',стекло:'glass',вода:'water',песок:'sand',волокно:'fiber',руда:'ore'};
      const aliases={масса:'mass',объем:'volume',размер:'size',высота:'height',ширина:'width',длина:'length',материал:'material',температура:'temperature',прочность:'durability',горючесть:'flammability',вместимость:'capacity',качество:'quality',износ:'wear',закреплен:'anchored',полый:'hollow',функции:'functions',детали:'parts'};
      for(const [key,value]of Object.entries(data))e.physical[aliases[norm(key)]||key]=value;
      e.physical.material=materials[norm(e.physical.material)]||e.physical.material;
      for(const key of ['portable','quantity','price','opened','locked','hidden','known','writtenText'])if(data[key]!==undefined)e[key]=data[key];
    }
    function init(s,config){
      s.world.rpg||={version:1,nextId:1,clock:{minute:540,day:0,lastTick:540},enabled:{needs:false,magic:H.profile(config).magic,technology:/станци|космо|компьютер/.test(norm(config.world))},goals:[],plans:[],tasks:[],appointments:[],recipes:[],blueprints:[],links:[],traces:[],observations:[],experiments:[],maps:[],ledger:[],accounts:{treasury:{money:100}},contracts:[],loans:[],businesses:[],cases:[],arcs:[],factions:[],memberships:{},rumors:[],debates:[],agreements:[],events:[],effects:[],spells:[],summons:[],traps:[],combat:{active:false,participants:[],pending:[]},settlement:{prosperity:0,infrastructure:0,decisions:[]}};
      s.world.player.body||={height:1.75,width:.5,mass:70,capacity:30,strength:10,posture:'standing',elevation:0,health:10,maxHealth:10,stamina:100,hunger:0,thirst:0,warmth:50,mana:10,maxMana:10,breath:100,illness:null,injuries:{},cleanliness:100,size:1};
      s.world.player.equipment||={left:null,right:null,worn:[],pockets:{},secured:[]};s.world.player.skills||={};s.world.player.spells||=[];
      for(const n of Object.values(s.world.npcs)){n.finance||={money:10};n.agency||={companions:[],activity:'working',tasks:[],skills:{},schedule:[],homeId:null};n.body||={stamina:100,posture:'standing',health:n.health||3,injuries:{},height:1.75,width:.5};if(!n.agency.skillsInitialized){const skills={craftsman:{craft:2,repair:2},inventor:{engineering:2,repair:2},scholar:{archaeology:2},healer:{medicine:2},guard:{combat:2},traveler:{tracking:2}};n.agency.skills={...(skills[n.identity.role]||{}),...n.agency.skills};n.agency.skillsInitialized=true;}}
      for(const e of s.entities)annotate(s,e);
      for(const l of s.world.locations)l.environment||={light:1,temperature:20,depth:0,current:0,slope:0,ceiling:3,weather:'clear'};
      if(!s.world.rpg.authorInitialized){
        for(const line of String(config.canon||'').split('\n')){const at=line.indexOf(':');if(at<0)continue;const key=norm(line.slice(0,at)).trim(),args=line.slice(at+1).split('|').map(v=>v.trim());
          if(key==='механики'){for(const flag of args[0].split(',')){if(/выжив|потребност/.test(norm(flag)))s.world.rpg.enabled.needs=true;if(/техник/.test(norm(flag)))s.world.rpg.enabled.technology=true;if(/магия/.test(norm(flag)))s.world.rpg.enabled.magic=true;}}
          if(key==='предмет'){const actor=findNpc(s,args[1]),location=actor?.id||(/^(?:герой|инвентарь|inventory)$/iu.test(args[1])?'inventory':findPlace(s,args[1])?.name);if(location){const data=values(args[2]),owner=findNpc(s,data.owner||'');const e=add(s,args[0],{source:'author',location,kind:data.kind||'prop',ownerId:data.owner==='герой'||location==='inventory'?'player':owner?.id||actor?.id||null});authoredProperties(e,data);}}
          if(key==='свойства'){const e=match(s,args[0],{absent:true});if(e)authoredProperties(e,values(args[1]));}
          if(key==='среда'){const l=findPlace(s,args[0]);if(l)Object.assign(l.environment,values(args[1]));}
          if(key==='рецепт'){const data=values(args[2]);s.world.rpg.recipes.push({id:'recipe:'+hash(args[0]),name:args[0],ingredients:(args[1]||'').split(',').map(v=>v.trim()),functions:data.functions||[],tools:data.tools||[],output:data.output||{},time:data.time||20});}
          if(key==='распорядок'){const n=findNpc(s,args[0]);if(n)n.agency.schedule.push({...values(args[1]),locationId:findPlace(s,args[2])?.id||n.location});}
          if(key==='портал'){const e=match(s,args[0],{absent:true}),from=findPlace(s,args[1]),to=findPlace(s,args[2]);if(e&&from&&to){e.physical.portal={from:from.id,to:to.id,...values(args[3])};}}
          if(key==='след'){const l=findPlace(s,args[0]);if(l)s.world.rpg.traces.push({id:id(s,'trace'),locationId:l.id,...values(args[1]),created:s.world.rpg.clock.minute,discovered:false});}
          if(key==='организация'){s.world.rpg.factions.push({id:id(s,'faction'),name:args[0],members:(args[1]||'').split(',').map(name=>findNpc(s,name.trim())?.id).filter(Boolean),reputation:{},relations:{},rules:values(args[2]),rank:0,treasury:20});}
          if(key==='заклинание'){s.world.rpg.spells.push({id:id(s,'spell'),name:args[0],effect:args[1],...values(args[2])});}
          if(key==='деньги'){const account=/^(?:герой|игрок)$/iu.test(args[0])?s.world.player:findNpc(s,args[0])?.finance;if(account)account.money=Math.max(0,number(args[1]));}
          if(key==='навыки героя'){for(const [key,value]of Object.entries(values(args[0])))s.world.player.skills[skillName(key)]=number(value);}
          if(key==='тело героя'){const data=values(args[0]);for(const key of ['height','width','mass','capacity','strength'])if(data[key]>0)s.world.player.body[key]=number(data[key]);}
          if(key==='навыки npc'){const n=findNpc(s,args[0]);if(n)for(const [key,value]of Object.entries(values(args[1])))n.agency.skills[skillName(key)]=number(value);}
          if(key==='состояние npc'){const n=findNpc(s,args[0]);if(n){const data=values(args[1]);for(const key of ['hidden','status','health','maxHealth'])if(data[key]!==undefined)n[key]=data[key];for(const key of ['official','corruptible','romanceBoundary','animal','darkvision','trueSight'])if(data[key]!==undefined)n.agency[key]=data[key];}}
          if(key==='показание npc'){const n=findNpc(s,args[0]);if(n){const data=values(args[2]),prop=H.proposition(s,args[1]);n.beliefs[prop.key]={...prop,confidence:data.confidence||1,sources:{[data.source||'author-testimony:'+n.id]:1},certainty:'known',eventTime:data.time};}}
        }
        // References are resolved after objects and organisations have been declared.
        for(const line of String(config.canon||'').split('\n')){const at=line.indexOf(':');if(at<0)continue;const key=norm(line.slice(0,at)).trim(),args=line.slice(at+1).split('|').map(v=>v.trim()),n=findNpc(s,args[0]);
          if(['задача npc','проблема npc','спрос npc','потребность npc'].includes(key)&&n){const data=values(args[2]||args[1]),target=match(s,data.item||data.предмет||'',{absent:true}),person=findNpc(s,data.person||data.персонаж||''),destination=findPlace(s,data.destination||data.место||'');if(target)data.itemId=target.id;if(person)data.patientId=person.id;if(destination)data.destinationId=destination.id;
            if(key==='задача npc'){n.agency.longGoal={type:data.type||'work',itemId:data.itemId,destinationId:data.destinationId||n.location,duration:data.duration||30,product:data.product};if(data.start)C.api.agency.queue(s,n,n.agency.longGoal.type,n.agency.longGoal);}
            if(key==='проблема npc')n.agency.problem={text:args[1],condition:{type:data.type||'repair',targetId:target?.id||person?.id,...(destination?{locationId:destination.id}:{})}};
            if(key==='спрос npc'){n.agency.demand||=[];n.agency.demand.push({product:args[1],price:data.price||3});}
            if(key==='потребность npc'){n.agency.needs||=[];n.agency.needs.push({text:args[1],type:data.type||'repair',itemId:data.itemId,patientId:data.patientId,destinationId:data.destinationId,amount:data.amount||3,health:data.health||3});}
          }
          if(key==='территория'){const l=findPlace(s,args[0]),data=values(args[1]);if(l){l.ownerId=data.owner==='герой'?'player':findNpc(s,data.owner||'')?.id||l.ownerId;Object.assign(l.environment,data);const f=s.world.rpg.factions.find(f=>same(f.name,data.faction||''));for(const edge of s.world.edges.filter(e=>e.to===l.id))edge.rpg={...(edge.rpg||{}),minimumRank:data.minimumRank||0,factionId:f?.id,private:data.visitors===false};}}
        }
        s.world.rpg.authorInitialized=true;
      }
      syncInventory(s);
    }
    function event(s,type,data,options={}){const entry={id:id(s,type),type,time:s.world.rpg.clock.minute,turn:s.turn,cause:s.currentActionId||'world',...clone(data),...options};s.world.rpg.events.push(entry);s.world.rpg.events=s.world.rpg.events.slice(-300);emit(s,'rpg_'+type,entry.id,null,entry);return entry;}
    function addNpc(s,name,location,description,motive){const n=makeNpc(name,location,description,motive,'');s.world.npcs[n.id]=n;social.init(s,s.world.authorCanon);dialogue.init(s);conversation.init(s,s.world.authorCanon);n.finance||={money:10};n.agency||={activity:'idle',tasks:[],schedule:[],skills:{}};n.body||={stamina:100,posture:'standing',injuries:{}};event(s,'npc_created',{npcId:n.id,locationId:location});return n;}
    function edge(s,from,to,options={}){for(const [a,b]of [[from,to],[to,from]]){const old=s.world.edges.find(e=>e.from===a&&e.to===b&&e.barrierId===(options.barrierId||null));if(!old)s.world.edges.push({from:a,to:b,barrierId:null,...clone(options)});else if(options.rpg)old.rpg={...(old.rpg||{}),...clone(options.rpg)};}event(s,'passage_created',{from,to,...options});}
    function amount(text,fallback=1){return number(String(text||'').match(/(?:^|\s)(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',','.'),fallback);}
    function skill(s,name,actor='player'){return number((actor==='player'?s.world.player.skills:s.world.npcs[actor]?.agency.skills)?.[name]);}
    function agree(s,n){require(n&&n.location===s.world.player.location,'npc_absent','Нужно встретиться с исполнителем.');require(!['dead','incapacitated'].includes(n.status)&&n.agency.activity!=='sleeping','npc_unavailable','Этот персонаж сейчас не может действовать.');require(!openConflicts(n),'unresolved_conflict','Сначала нужно уладить конфликт с '+n.name+'.');return n;}
    function openConflicts(n){return n.grievances?.some(g=>!g.resolved);}
    const C={H,norm,same,number,id,result,require,place,holder,item,available,qty,props,weight,accessibleItems,match,target,person,findPlace,route,syncInventory,transfer,consume,add,money,annotate,values,init,event,addNpc,edge,amount,skill,skillName,materialLabel,functionLabel,agree,openConflicts};return C;
  }
  root.RpgCore={create};
})(globalThis);
