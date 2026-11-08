import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('standalone file contains executable engine and no external assets',()=>{
 const html=readFileSync(new URL('../play.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=|fetch\s*\(|@import/);
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 assert.equal(scripts.length,16);
 for(const code of scripts) new vm.Script(code);
 const context=vm.createContext({});for(const code of scripts.slice(0,-1))vm.runInContext(code,context);
 const result=context.StoryEngine.reply({world:'Лес',character:'Мира — сдержанная',player:'Путник'},null,'Осматриваюсь');
 assert.equal(result.memory.stage,0);
 assert.ok(html.indexOf('<script>')>html.indexOf('id="chat"'));
});
