import assert from 'node:assert/strict';
for(const f of ['spatial','narrator','messages','dialogue','developer','social','conversation-topics','npc-personality','conversation-memory','npc-biography','conversation-engine','action-catalog','rpg-core','physical-system','investigation-system','equipment-crafting','action-resolver','goals-story','npc-agency','economy-system','society-system','life-combat','genre-system','extended-actions','rpg-engine','semantic','scenes','simulation','engine'])await import('../'+f+'.js');
export const E=globalThis.StoryEngine;
export function fixture(extra={}){
  const config={world:'Город. Лавка, мастерская и рынок.',character:'Мира — хозяйка лавки.',player:'Путник',canon:'',...extra};
  const trace={config,commands:[],results:[]};if(globalThis.capabilityTrace)globalThis.capabilityTrace.push(trace);
  let memory=E.restore(config,E.fresh()),last=null,seq=0;
  const actor=(name='Мира')=>Object.values(memory.world.npcs).find(n=>n.name===name);
  function item(label,physical={},location='inventory',attributes={}){
    const e={id:'fixture:item:'+seq++,label,aliases:[label],kind:'prop',portable:true,known:true,hidden:false,destroyed:false,location,source:'author',ownerId:location==='inventory'?'player':null,quantity:1,history:[],...attributes};
    e.physical={material:'wood',mass:1,volume:1,size:1,height:1,width:1,length:1,temperature:20,durability:100,maxDurability:100,flammability:0,wetness:0,quality:1,wear:0,friction:.5,anchored:false,hollow:false,capacity:0,functions:[],parts:[],position:{x:2,y:0,z:0},...physical};memory.entities.push(e);if(location==='inventory')memory.inventory.push(label);return e;
  }
  function run(...commands){for(const command of commands){last=E.reply(config,memory,command);memory=last.memory;trace.commands.push(command);trace.results.push(last.results.map(r=>({code:r.code,status:r.status})));assert.doesNotMatch(last.text,/\uE000|undefined|NaN/);assert.ok(Number.isFinite(memory.world.player.body.stamina));}return last;}
  function pass(command){const r=run(command);assert.equal(r.results[0].status,'success',command+' → '+r.results[0].code+': '+r.text);return r;}
  const entity=id=>memory.entities.find(e=>e.id===(id.id||id));
  const local=(name='Мира')=>{const n=actor(name);n.location=memory.world.player.location;return n;};
  function place(name){const l=memory.world.locations.find(l=>l.name===name);assert.ok(l,'fixture location '+name);memory.world.player.location=l.id;memory.place=l.name;return l;}
  return {config,actor,item,run,pass,entity,local,place,get m(){return memory;},get last(){return last;},save(){memory=E.restore(config,JSON.parse(JSON.stringify(memory)));return memory;}};
}
export const props=e=>e.physical;
export function research(f){return f.m.world.rpg.research;}
export function currentCase(f){return f.m.world.rpg.cases.at(-1);}
export function sources(f,name='Мира'){
  f.pass('Составляю список подозреваемых');const n=f.actor(name),ca=currentCase(f);
  for(let i=0;i<2;i++){const e=f.item('улика '+i,{material:'paper'});ca.evidence.push({id:'proof:'+i,sourceId:e.id,rootSourceId:e.id,kind:'physical',proposition:{key:'виновник',value:n.name,text:n.name+' виновник'},confidence:.8,time:540+i});}return ca;
}
