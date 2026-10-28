// Run with: node --test test_app.js
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

async function screen({data={},answers=[],responses=[]}={}){
  const elements=new Map(),posts=[],prompts=[];
  function element(){return {hidden:false,disabled:false,value:'',textContent:'',elements:{employee_id:{replaceChildren(){},append(){}},work_date:{}},listeners:{},replaceChildren(){},append(){},addEventListener(name,fn){this.listeners[name]=fn;}};}
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element};
  const context=vm.createContext({document,Intl,Date,Number,Boolean,Error,FormData:class{constructor(form){return Object.entries(form.data);}},window:{confirm(message){prompts.push(message);return answers.shift()??false;}},async fetch(path,options){
    let body={},ok=true;
    if(options?.method==='POST'){
      posts.push(JSON.parse(options.body));const reply=responses.shift()||{};
      ok=reply.ok!==false;body=reply.body||{ok:true};
    }else if(path==='/api/me')body={user:{id:1,role:'admin',display_name:'관리자',csrf:'test'}};
    else body={items:[]};
    return {ok,json:async()=>body};
  }});
  vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  vm.runInContext('adminMode=true',context);
  const form=document.getElementById('work');
  form.data={employee_id:'2',work_date:'2026-10-28',start_time:'16:00',end_time:'22:00',break_minutes:'30',confirmed:'on',...data};
  const button={disabled:false};
  await form.listeners.submit({preventDefault(){},currentTarget:form,submitter:button});
  assert.equal(button.disabled,false);
  return {posts,prompts,notice:document.getElementById('notice').textContent};
}
const conflict={ok:false,body:{code:'attendance_conflict',revision:'1:old',existing:{display_name:'직원A',work_date:'2026-10-28',start_time:'16:00',end_time:'21:00',break_minutes:30}}};

test('cancel edit keeps existing record: no retry',async()=>{
  const r=await screen({responses:[conflict],answers:[false]});
  assert.equal(r.posts.length,1);assert.match(r.prompts[0],/직원A/);assert.match(r.prompts[0],/기존: 16:00 → 21:00/);assert.match(r.prompts[0],/변경: 16:00 → 22:00/);
});
test('confirmed edit sends exact reviewed revision',async()=>{
  const r=await screen({responses:[conflict,{}],answers:[true]});
  assert.equal(r.posts.length,2);assert.equal(r.posts[1].expected_revision,'1:old');assert.match(r.notice,/저장했습니다/);
});
test('stale edit is stopped and requires a new review',async()=>{
  const r=await screen({responses:[conflict,conflict],answers:[true]});
  assert.equal(r.posts.length,2);assert.equal(r.prompts.length,1);assert.match(r.notice,/기록이 변경/);
});
test('reversed times are blocked without a request',async()=>{
  const r=await screen({data:{end_time:'15:00'}});assert.equal(r.posts.length,0);assert.match(r.notice,/다음 날 퇴근/);
});
test('cancel long shift sends no request',async()=>{
  const r=await screen({data:{end_time:'15:00',next_day:'on'},answers:[false]});assert.equal(r.posts.length,0);assert.match(r.prompts[0],/23시간 0분/);
});
test('confirmed long shift sends overnight and confirmation flags',async()=>{
  const r=await screen({data:{end_time:'15:00',next_day:'on'},answers:[true]});assert.equal(r.posts.length,1);assert.equal(r.posts[0].next_day,true);assert.equal(r.posts[0].long_shift_confirmed,true);
});
test('ordinary overnight shift needs no long shift confirmation',async()=>{
  const r=await screen({data:{start_time:'22:00',end_time:'02:00',next_day:'on'}});assert.equal(r.posts.length,1);assert.equal(r.prompts.length,0);assert.equal(r.posts[0].next_day,true);
});
