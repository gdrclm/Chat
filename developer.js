/* A metanarrative voice. Ordinary comments have no authority to alter physical state. */
(function(root){
  'use strict';
  const technical=new Set(['unsupported_action','unknown_intent','unsupported_method','unknown_repair_method','unsupported_npc_action','unsupported_transformation']);
  function create(H){
    const {emit,addEntity,hash}=H;
    function init(s,config){
      s.world.developer||={lastTurn:-20,seen:{},registered:[],fired:[]};
      if(s.world.developer.initialized)return;
      for(const line of String(config.canon||'').split('\n')){
        const m=line.match(/^Мета-событие\s*:\s*проход\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*(\d+)\s*$/iu);
        if(m)s.world.developer.registered.push({id:'meta:'+hash(line),kind:'passage',location:m[1].trim(),door:m[2].trim(),destination:m[3].trim(),notBefore:Number(m[4])});
      }
      s.world.developer.initialized=true;
    }
    function note(s,code,text){
      const dev=s.world.developer;dev.seen[code]=(dev.seen[code]||0)+1;
      if(s.turn-dev.lastTurn<3)return 'Этот способ пока не удалось выполнить. Уточните действие или выберите другой подход.';
      dev.lastTurn=s.turn;
      const line=dev.seen[code]>2?'Ты настойчивее моего словаря. '+text:text;
      return root.StoryMessages.say(s,{type:'developer',id:'developer'},line,'technical_clarification');
    }
    function route(s,c,a,r){
      if(!technical.has(r.code))return r;
      s.currentMessages=(s.currentMessages||[]).filter(row=>row.speaker.type!=='npc');
      r.text=note(s,r.code,r.code==='unsupported_action'?'Действие «'+c.semantic.unsupportedVerb+'» я пока не умею разбирать. Объясни цель и способ, и попробуем уточнить замысел.':r.text);
      r.narration=null;r.performed=false;return r;
    }
    function fire(s,id){
      const dev=s.world.developer,event=dev.registered.find(event=>event.id===id);
      if(!event||dev.fired.includes(id)||s.turn<event.notBefore||s.place!==event.location)return {status:'refused',code:'meta_event_not_authorized',text:'Нет разрешённого события для такого вмешательства.',effects:[]};
      const from=s.world.locations.find(place=>place.name===event.location);let to=s.world.locations.find(place=>place.name===event.destination);
      if(!from)return {status:'refused',code:'meta_event_not_authorized',text:'Место события отсутствует.',effects:[]};
      if(!to){to={id:'loc:'+hash(event.destination),name:event.destination,aliases:[],visits:0,scene:{description:'Место: '+event.destination+'.',features:[],background:[],observed:{},discoveries:{},events:[],revision:0}};s.world.locations.push(to);}
      const door=addEntity(s,event.door,{id:id+':door',kind:'barrier',location:from.name,known:true,locked:false,portable:false,source:'developer-event'});
      for(const [a,b]of [[from,to],[to,from]])if(!s.world.edges.some(edge=>edge.from===a.id&&edge.to===b.id))s.world.edges.push({from:a.id,to:b.id,barrierId:door.id});
      dev.fired.push(id);const effect=emit(s,'registered_developer_event',id,null,{doorId:door.id,from:from.id,to:to.id},'developer:'+id);
      const speech=root.StoryMessages.say(s,{type:'developer',id:'developer'},'Минуту. У этой стены обнаружился проход, который я придерживал для особого случая.','registered_meta_event',{effects:[effect.id]});
      return {status:'success',code:'meta_event_applied',text:speech+'\nНа стене становится видна «'+door.label+'». Теперь здесь есть проход в место «'+to.name+'».',effects:[effect],performed:true,completed:true,action:{id:'developer:'+id,actor:'developer',intent:'registered_event',scope:'author_registered',goal:'',semantic:{mode:'registered_event'}}};
    }
    function tick(s){const event=s.world.developer.registered.find(event=>!s.world.developer.fired.includes(event.id)&&s.turn>=event.notBefore&&s.place===event.location);return event?fire(s,event.id):null;}
    return {init,note,route,fire,tick};
  }
  root.DeveloperIntervention={create};
})(globalThis);
