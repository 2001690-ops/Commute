import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {loadModule} from './compile.mjs';

const {manage,staff}=await harness();
const store=await loadModule('lib/attendance-store.ts');
const {d,rev}=await store.read();
const id='delegated-test',email='rmk7897@gmail.com';
globalThis.testEnv.ADMIN_EMPLOYEE_IDS=id;
globalThis.testEnv.DELEGATED_ADMIN_CREDENTIAL=JSON.stringify({employeeId:id,pin:'87654321',version:'test-email',email});

const salt=crypto.randomUUID(),invite='a'.repeat(64);
d.employees.push({id,name:'관리자 시험',active:true,inviteHash:await store.digest(invite),inviteVersion:1,passwordless:true,rates:[{date:'2020-01-01',rate:12500}],pin:{salt,hash:await store.hash('123456',salt)}});
d.employees.push({id:'ordinary',name:'직원 시험',active:true,inviteHash:await store.digest('b'.repeat(64)),inviteVersion:1,passwordless:true,rates:[],pin:{salt,hash:await store.hash('123456',salt)}});
await store.save(d,rev);

function post(route,body,headers={}){return route.POST(new Request('https://example.test/api',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)}));}
const employeeLogin=await post(staff,{action:'login',invite});assert.equal(employeeLogin.status,200);
const cookie=employeeLogin.headers.get('set-cookie').split(';')[0];
const ordinaryLogin=await post(staff,{action:'login',invite:'b'.repeat(64)});assert.equal(ordinaryLogin.status,200);
const ordinaryCookie=ordinaryLogin.headers.get('set-cookie').split(';')[0];
assert.equal((await post(staff,{action:'adminLogin',email,password:'87654321'},{cookie:ordinaryCookie})).status,403);
assert.equal((await post(staff,{action:'adminLogin',email:'other@example.test',password:'87654321'},{cookie})).status,401);
assert.equal((await post(staff,{action:'adminLogin',email,password:'123456'},{cookie})).status,401);

let res=await post(staff,{action:'adminLogin',email:email.toUpperCase(),password:'87654321'},{cookie});
assert.equal(res.status,200);
let {token}=await res.json();
let headers={'x-admin-token':token};
assert.equal((await manage.GET(new Request('https://example.test/api/manage?admin=1',{headers}))).status,200);
assert.equal((await manage.GET(new Request('https://example.test/api/manage'))).status,401);
assert.equal((await post(manage,{action:'login',pin:'123456'},headers)).status,403);

let persisted=await store.read();
const account=persisted.d.adminAccounts.find((a)=>a.email===email);
assert.ok(account,'first successful login migrates the account into the database');
assert.ok(account.salt&&account.hash);
assert.ok(!JSON.stringify(account).includes('87654321'));
assert.ok(!JSON.stringify(await (await manage.GET(new Request('https://example.test/api/manage?admin=1',{headers}))).json()).includes('adminAccounts'));

globalThis.testEnv.DELEGATED_ADMIN_CREDENTIAL='';
res=await post(manage,{action:'adminLogin',email,password:'87654321'});
assert.equal(res.status,200,'database credentials work without the legacy runtime secret or a staff invite cookie');
const directToken=(await res.json()).token;
const directHeaders={'x-admin-token':directToken};
assert.equal((await manage.GET(new Request('https://example.test/api/manage?admin=1',{headers:directHeaders}))).status,200);
assert.equal((await post(manage,{action:'adminLogin',email,password:'00000000'})).status,401);
globalThis.testEnv.DELEGATED_ADMIN_CREDENTIAL=JSON.stringify({employeeId:id,pin:'87654321',version:'test-email',email});
const disabled=await store.read();disabled.d.adminAccounts.find((a)=>a.email===email).active=false;await store.save(disabled.d,disabled.rev);
assert.equal((await post(manage,{action:'adminLogin',email,password:'87654321'})).status,401,'a disabled database account cannot be recreated from the legacy secret');
assert.equal((await manage.GET(new Request('https://example.test/api/manage?admin=1',{headers:directHeaders}))).status,401);
const enabled=await store.read();enabled.d.adminAccounts.find((a)=>a.email===email).active=true;delete enabled.d.failures['admin_id_'+await store.digest(email)];await store.save(enabled.d,enabled.rev);
globalThis.testEnv.DELEGATED_ADMIN_CREDENTIAL='';

const current=await store.read();current.d.employees.find((e)=>e.id===id).inviteVersion++;await store.save(current.d,current.rev);
assert.equal((await manage.GET(new Request('https://example.test/api/manage?admin=1',{headers:directHeaders}))).status,200,'admin sessions do not depend on an employee invite link');
globalThis.testEnv.ADMIN_EMPLOYEE_IDS='';
assert.equal((await manage.GET(new Request('https://example.test/api/manage?admin=1',{headers:directHeaders}))).status,401,'removing the admin role revokes database-backed sessions');
globalThis.testEnv.ADMIN_EMPLOYEE_IDS=id;

const key='admin_id_'+await store.digest(email);
const cleanFailures=await store.read();delete cleanFailures.d.failures[key];await store.save(cleanFailures.d,cleanFailures.rev);
for(let i=0;i<5;i++)assert.equal((await post(manage,{action:'adminLogin',email,password:'00000000'})).status,401);
assert.equal((await post(manage,{action:'adminLogin',email,password:'87654321'})).status,429);
const unlocked=await store.read();delete unlocked.d.failures[key];await store.save(unlocked.d,unlocked.rev);
res=await post(manage,{action:'adminLogin',email,password:'87654321'});assert.equal(res.status,200);
console.log('PASS: ID/password login, database credential migration, direct admin access, invite-independent sessions, role revocation, secret isolation and lockout');

