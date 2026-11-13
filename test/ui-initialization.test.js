import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const standalone=readFileSync(new URL('../play.html',import.meta.url),'utf8');

test('all static UI selectors in app.js refer to actual elements',()=>{
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  const queried=[...app.matchAll(/document\.querySelector\(['"]#([\w-]+)['"]\)/g)].map(m=>m[1]);
  const missing=[...new Set(queried.filter(id=>!ids.has(id)))];
  assert.deepEqual(missing,[],'missing ids break render() before page handlers are registered');
  for(const page of ['chat','world','settings'])assert.ok(ids.has(page+'-page'));
  for(const control of ['open-world','open-settings','close-world','close-settings'])assert.ok(ids.has(control));
});

test('standalone bundle contains the same UI and no stale page references',()=>{
  assert.match(standalone,/id="open-world"/);
  assert.match(standalone,/id="open-settings"/);
  assert.match(standalone,/id="command-suggestions"/);
  assert.doesNotMatch(standalone,/document\.querySelector\(['"]#conversation-summary['"]\)/);
  assert.doesNotMatch(standalone,/document\.querySelector\(['"]#action-search['"]\)/);
});
