import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
async function load(path){const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
const {requestJson,completeSavedAction}=await load('lib/client-requests.ts');
const {copyInvitation,invitationText}=await load('lib/invite-clipboard.ts');
const invite={invite:'test-token',success:true};let shown=null,refreshWarning=false;
await completeSavedAction(invite,value=>{shown=value},async()=>{throw TypeError('Failed to fetch')},()=>{refreshWarning=true});assert.equal(shown,invite);assert.equal(refreshWarning,true);
assert.deepEqual(await requestJson('/test',{},async()=>Response.json({success:true})),{success:true});
await assert.rejects(()=>requestJson('/test',{},async()=>{throw TypeError('Failed to fetch')}),e=>!e.message.includes('Failed to fetch')&&e.message.includes('연결'));
await assert.rejects(()=>requestJson('/test',{},async()=>Response.json({error:'다시 로그인해 주세요.'},{status:401})),e=>e.status===401&&e.message==='다시 로그인해 주세요.');
await assert.rejects(()=>requestJson('/test',{},async()=>new Response('<html>login</html>')),/서버 응답/);
let fallbackCalls=0,actual='';const fallback=text=>{fallbackCalls++;actual=text;return true};
assert.equal(await copyInvitation('https://test.invalid/staff#invite=test',{writeText:async()=>{throw Error('denied')}},fallback),true);assert.equal(fallbackCalls,1);assert.equal(actual,invitationText('https://test.invalid/staff#invite=test'));
assert.equal(await copyInvitation('https://test.invalid/staff#invite=test',undefined,()=>false),false);
assert.equal(await copyInvitation('https://test.invalid/staff#invite=test',{writeText:async text=>{actual=text}},()=>{throw Error('must not run')}),true);
console.log('PASS: successful invite survives refresh failure; readable network/auth errors; denied clipboard falls back; manual-copy state; modern clipboard success.');
