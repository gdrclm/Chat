/* Local reference frames. Features and object parts are not loose inventory objects. */
(function(root){
  'use strict';
  const norm=value=>String(value||'').toLowerCase().replace(/ё/g,'е').trim();
  const words=value=>norm(value).match(/[а-яa-z0-9-]+/g)||[];
  const key=word=>/^лар(?:ец|ц)/.test(word)?'ларец':/^двер(?:ь|и|ью|ей|ям|ями|ях)?$/.test(word)?'двер':word.replace(/(?:иями|ями|ами|ого|ему|ому|ыми|ими|ов|ев|ей|ия|ию|ие|ий|ый|ой|ая|яя|ую|юю|ам|ям|ах|ях|ом|ем|а|я|ы|и|у|ю|е|о|ь)$/u,'');
  const same=(a,b)=>{const left=words(a).map(key),right=words(b).map(key);return left.length>0&&left.length===right.length&&left.every(w=>right.includes(w));};
  const parts={стен:{part:'wall',target:'стена'},пол:{part:'floor',target:'пол'},потолок:{part:'ceiling',target:'потолок'},крышк:{part:'lid',target:'крышка'},ручк:{part:'handle',target:'ручка'},ножк:{part:'leg',target:'ножка'},поверхност:{part:'surface',target:'поверхность'}};
  function descriptor(text){
    const source=norm(text).replace(/^(?:к|ко|до|вплотную к|поближе к)\s+/u,'');
    const tokens=words(source);const index=tokens.findIndex(t=>parts[key(t)]);
    if(index<0||index>2)return null;
    const spec=parts[key(tokens[index])];
    return {...spec,parent:tokens.slice(index+1).join(' ')||null,relation:'part_of',targetText:source,scope:'local'};
  }
  function location(memory,text){return memory.world.locations.find(place=>[place.name,...(place.aliases||[])].some(name=>same(text,name)))||null;}
  function entities(memory,text){
    const query=words(text).map(key);
    return memory.entities.filter(entity=>[entity.label,...(entity.aliases||[])].some(label=>{
      const labels=words(label).map(key);return query.length>0&&query.every(w=>labels.includes(w));
    }));
  }
  function featureRefs(memory){return memory.world.locations.flatMap(place=>place.scene?.background||[]);}
  function bind(memory,step){
    const spec=step.part?step:descriptor(step.target);
    if(!spec?.part)return null;
    const all=featureRefs(memory),here=memory.world.player.location;
    if(['wall','floor','ceiling'].includes(spec.part)){
      const owner=spec.parent&&location(memory,spec.parent);
      if(spec.parent&&!owner)return {error:'unknown_parent',parent:spec.parent};
      const authored=entities(memory,spec.target).filter(e=>!owner||e.location===owner.name);
      const actual=authored.filter(e=>e.location===memory.place);if(actual.length===1)return {reference:entityRef(actual[0])};
      let refs=all.filter(ref=>ref.part===spec.part&&(!owner||ref.parentId===owner.id));
      const local=refs.filter(ref=>ref.viewLocationId===here);if(local.length)refs=local;
      if(!owner){const own=refs.filter(ref=>ref.parentId===here);if(own.length)refs=own;else refs=local;}
      if(refs.length>1&&refs.some(ref=>ref.parentId!==refs[0].parentId))return {error:'ambiguous_target'};
      return refs[0]?{reference:{...refs[0]}}:{error:'unknown_spatial_target'};
    }
    let parents=spec.parent?entities(memory,spec.parent):memory.focus?memory.entities.filter(e=>e.id===memory.focus):[];
    const local=parents.filter(e=>[memory.place,'inventory',memory.world.activeNpcId].includes(e.location));if(local.length)parents=local;
    if(parents.length!==1)return {error:parents.length?'ambiguous_target':'unknown_parent',parent:spec.parent};
    const parent=parents[0],label=norm(parent.label);
    const supported=spec.part==='surface'||spec.part==='lid'&&/ларец|сундук|ящик|шкатулк|сейф|короб|банка/.test(label)||spec.part==='handle'&&/двер|шкаф|окно|ящик/.test(label)||spec.part==='leg'&&/стол|стул|верстак/.test(label)&&!/без нож|нет нож/.test(label+' '+norm(parent.description));
    if(!supported)return {error:'unsupported_part',parent:parent.label};
    return {reference:{kind:'part',id:'part:'+parent.id+':'+spec.part,part:spec.part,target:spec.target,label:spec.target+' — '+parent.label,parentId:parent.id,parentKind:'entity'}};
  }
  function entityRef(entity){return {kind:'entity',id:entity.id,targetId:entity.id,label:entity.label};}
  function create(H){
    const {clone,hash,log,emit,containerAccess}=H;
    const interior=place=>/лавк|комнат|мастерск|кухн|таверн|отсек|модуль|убежищ|бункер|дом|офис|корпус|склад|кафе/.test(norm(place.name));
    function init(s){
      if(s.world.spatialVersion===1)return;
      for(const place of s.world.locations){
        const scene=place.scene;scene.background=[];
        if(place.id===s.world.startId)scene.description=root.StoryNarrator.locationDescription(scene.description,place.name);
        const add=(owner,part,target,surface)=>scene.background.push({kind:'feature',id:'feature:'+owner.id+':'+surface+':'+part+':'+place.id,part,target,label:target+' — '+owner.name,parentId:owner.id,parentKind:'location',viewLocationId:place.id,surface});
        if(interior(place))for(const [part,target]of [['wall','стена'],['floor','пол'],['ceiling','потолок']])add(place,part,target,'interior');
        else if(/стен/.test(norm(scene.description)))add(place,'wall','стена','exterior');
        if(!interior(place))for(const edge of s.world.edges.filter(edge=>edge.from===place.id)){
          const owner=s.world.locations.find(node=>node.id===edge.to);if(owner&&interior(owner))add(owner,'wall','стена','exterior');
        }
      }
      s.world.spatialVersion=1;
    }
    function access(s,ref,actor='player'){
      const at=actor==='player'?s.world.player.location:s.world.npcs[actor]?.location;
      if(ref.kind==='feature')return ref.viewLocationId===at;
      const parent=s.entities.find(e=>e.id===(ref.kind==='part'?ref.parentId:ref.id));
      const place=s.world.locations.find(place=>place.id===at);
      if(!parent||parent.hidden||!parent.known||!containerAccess(s,parent))return false;
      if([place?.name,actor==='player'?'inventory':actor].includes(parent.location))return true;
      return parent.kind==='barrier'&&s.world.edges.some(edge=>edge.from===at&&edge.barrierId===parent.id);
    }
    function failure(step){
      const code=step.referenceError||'unknown_spatial_target';
      const text=code==='unknown_parent'?'Не найден владелец или опорный объект «'+(step.parent||step.target||'')+'».':code==='ambiguous_target'?'Здесь есть несколько подходящих целей. Уточните, к какой вы обращаетесь.':code==='unsupported_part'?'У этого объекта не установлена такая часть.':'Такого элемента в доступном окружении нет. Назовите существующий объект или часть помещения.';
      return {status:'clarification',code,text,effects:[]};
    }
    function approach(s,step,actor='player'){
      const ref=step.targetRef;if(!ref)return failure(step);
      if(!access(s,ref,actor))return {status:'refused',code:'target_elsewhere',text:'К «'+ref.label+'» отсюда не подойти. Нужно сначала добраться до этого места или открыть доступ.',effects:[]};
      const observer=actor==='player'?s.world.player:s.world.npcs[actor];
      const at=actor==='player'?s.world.player.location:observer.location;
      const samePosition=observer.position?.near===ref.id&&observer.position?.locationId===at;
      const before=clone(observer.position||null);observer.position={locationId:at,near:ref.id};observer.attention=clone(ref);
      if(actor==='player')s.focus=ref.kind==='entity'?ref.id:null;
      if(!samePosition)emit(s,'local_approach',actor,before,observer.position,undefined,{reference:clone(ref)});
      const subject=actor==='player'?'Вы':observer.name;
      return {status:'success',code:samePosition?'already_near':'approached',text:samePosition?subject+' уже рядом с «'+ref.label+'». Можно изучить эту цель.':subject+' '+(actor==='player'?'подходите':'подходит')+' к «'+ref.label+'». Теперь её можно рассмотреть вблизи.',effects:[],information:{novel:false,discoveries:[],opportunities:['изучить '+ref.label]}};
    }
    function inspect(s,step){
      const ref=step.targetRef;if(!ref)return failure(step);
      if(!access(s,ref))return {status:'refused',code:'target_elsewhere',text:'«'+ref.label+'» не доступна с этой стороны. Перейдите в подходящее место.',effects:[]};
      const parent=ref.kind==='part'?s.entities.find(e=>e.id===ref.parentId):null;
      let description=ref.kind==='feature'?(ref.surface==='exterior'?'Вы рассматриваете наружную поверхность. ':'Вы рассматриваете часть помещения. ')+'Ничего необычного на «'+ref.label+'» не обнаружено.':parent?.destroyed?'Эта часть «'+parent.label+'» повреждена вместе с предметом.':ref.part==='lid'?'Крышка «'+parent.label+'» '+(parent.opened?'открыта':'закрыта')+'. Осмотр внешней части не раскрывает содержимое.':ref.part==='handle'?'Ручка «'+parent.label+'» позволяет взяться за него. Сам осмотр не открывает и не отпирает предмет.':'Вы изучаете «'+ref.label+'». Дополнительных особенностей этой части не задано.';
      if(step.method==='listen')description='Вы прислушиваетесь к «'+ref.label+'». Новых звуков здесь не установлено.';
      const state=hash(JSON.stringify([parent?.opened,parent?.locked,parent?.destroyed,description]));
      const observations=s.world.player.research.observations,id='spatial:'+ref.id+':'+(step.method||'examine');
      const fresh=observations[id]!==state;observations[id]=state;s.world.player.attention=clone(ref);s.focus=null;
      if(fresh)log(s,'observation',description);
      return {status:'success',code:fresh?'part_observed':'already_observed',text:fresh?description:'Новых сведений о «'+ref.label+'» нет. Состояние этой части не изменилось.',effects:[],information:{novel:fresh,sourceId:ref.id,locationId:s.world.player.location,discoveries:[]}};
    }
    return {init,approach,inspect};
  }
  root.StorySpatial={key,same,descriptor,location,entities,bind,entityRef,create};
})(globalThis);
