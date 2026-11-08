/* Compose a whole turn from grounded result blocks, independently from action execution. */
(function(root){
  'use strict';
  const clean=text=>String(text||'').trim();
  const normalized=text=>clean(text).toLowerCase().replace(/\s+/g,' ');
  function locationDescription(text,name){
    const sentences=clean(text).match(/[^.!?]+[.!?]?/g)||[];
    const ambient=sentences.filter(line=>!/^\s*(?:я|мы)\s+(?:прихожу|пришел|пришла|пришли|приходим|вхожу|вошел|вошла|прибыл|прибыла|прибыли|оказываюсь|оказались|ищу|ищем|хочу|хотим)(?=\s|[,.!?]|$)/iu.test(line.trim()));
    return ambient.join(' ').replace(/\s+/g,' ').trim()||'Место: '+name+'.';
  }
  function compose({intro='',results=[],event=''}){
    const blocks=[];
    if(clean(intro))blocks.push({kind:'intro',speaker:{type:'narrator'},trigger:'story_start',effects:[],text:clean(intro)});
    for(let index=0;index<results.length;index++){
      const result=results[index];const next=results[index+1];
      const nextSurvey=next?.status==='success'&&next.action?.dependsOnPrevious&&['INSPECT','SEARCH'].includes(next.action.semantic?.intent)&&next.action.semantic.locationId&&(next.narration?.some(block=>block.kind==='location')||next.code==='already_observed');
      const narration=result.narration||[{kind:'action',text:result.text}];
      for(const block of narration){
        if(nextSurvey&&block.phase==='arrival'&&block.locationId===next.action.semantic.locationId)continue;
        if(block.kind==='location'&&clean(intro).includes(clean(block.text)))continue;
        if(!clean(block.text))continue;
        const previous=blocks.at(-1);
        if(previous&&previous.speaker?.type===(block.speaker?.type||'narrator')&&previous.speaker?.id===block.speaker?.id&&previous.kind===block.kind&&previous.locationId===block.locationId&&normalized(previous.text)===normalized(block.text))continue;
        blocks.push({speaker:{type:'narrator'},trigger:'action_result',effects:[],...block,text:clean(block.text),stepIndex:index});
      }
    }
    if(Array.isArray(event))blocks.push(...event);else if(clean(event))blocks.push({kind:'event',speaker:{type:'narrator'},trigger:'world_event',text:clean(event),effects:[]});
    return {text:root.StoryMessages?root.StoryMessages.plain(blocks):blocks.map(block=>block.text).join('\n\n'),blocks};
  }
  root.StoryNarrator={locationDescription,compose};
})(globalThis);
