import {readFile,writeFile} from 'node:fs/promises';
const entries=JSON.parse(await readFile(new URL('../test/action-catalog-fixtures.json',import.meta.url),'utf8'));
if(entries.length!==325||new Set(entries.map(e=>e.id)).size!==325||entries.some(e=>!e.scenarios?.length))throw Error('Need all 325 passing scenarios.');
const catalog=entries.map(({id,description,scenarios})=>{const scenario=scenarios[0],completed=scenario.commands.filter((c,i)=>scenario.results[i]?.some(r=>['success','partial_success'].includes(r.status)));return {id,description,examples:[...new Set((completed.length?completed:scenario.commands).filter(c=>!/^Пропускаю время /u.test(c)))].slice(-8)};});
await writeFile(new URL('../action-catalog.js',import.meta.url),'/* Numbered audit capabilities and examples from their passing acceptance scenarios. */\n(function(root){\'use strict\';\n  const entries='+JSON.stringify(catalog,null,2)+';\n  root.ActionCatalog={entries,byId:Object.fromEntries(entries.map(entry=>[entry.id,entry]))};\n})(globalThis);\n');
console.log('Prepared 325 capability examples.');
