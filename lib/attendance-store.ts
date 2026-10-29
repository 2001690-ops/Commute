import {env} from 'cloudflare:workers';
import {day} from './payroll';
export const initial=()=>({employees:[],shifts:[],adjustments:{},closed:{},audit:[],sessions:[],adminAccounts:[],admin:null,failures:{}} as any);
export async function hash(s:string,salt:string){let key=await crypto.subtle.importKey('raw',new TextEncoder().encode(s),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export const ok=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function read(){const db=env.DB!;let row:any=await db.prepare('SELECT payload,revision FROM attendance_store WHERE id=1').first();if(!row){await db.prepare('INSERT OR IGNORE INTO attendance_store (id,payload,revision) VALUES (1,?,0)').bind(JSON.stringify(initial())).run();row=await db.prepare('SELECT payload,revision FROM attendance_store WHERE id=1').first();}return {d:JSON.parse(row.payload),rev:row.revision};}
export async function save(d:any,rev:number){let r=await env.DB!.prepare('UPDATE attendance_store SET payload=?,revision=revision+1 WHERE id=1 AND revision=?').bind(JSON.stringify(d),rev).run();if(!r.meta.changes)throw Error('다른 기기에서 기록이 변경되었습니다. 다시 시도해 주세요.');}
export function employeeAdmin(e:any){return !!e?.active&&String((env as any).ADMIN_EMPLOYEE_IDS||'').split(',').map((v:string)=>v.trim()).includes(e.id);}
// Runtime secret is scoped to an already-authorized employee, never a role grant.
export function delegatedCredential(e:any){try{const c=JSON.parse(String((env as any).DELEGATED_ADMIN_CREDENTIAL||'null'));return employeeAdmin(e)&&c?.employeeId===e.id&&/^\d{8}$/.test(c.pin)&&typeof c.version==='string'&&(!c.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))?c:null;}catch{return null;}}
export async function verifyAdminPin(e:any,pin:string){const configured=delegatedCredential(e);if(configured)return /^\d{8}$/.test(pin)&&await hash(pin,e.pin.salt)===await hash(configured.pin,e.pin.salt);return /^\d{4,8}$/.test(pin)&&await hash(pin,e.pin.salt)===e.pin.hash;}
export async function authenticateAdmin(d:any,emailValue:any,passwordValue:any,requiredEmployeeId?:string){
 const email=String(emailValue||'').trim().toLowerCase(),password=String(passwordValue||'');
 d.failures=d.failures||{};d.adminAccounts=Array.isArray(d.adminAccounts)?d.adminAccounts:[];
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {status:401,error:'아이디 또는 비밀번호를 확인해 주세요.',modified:false};
 const key='admin_id_'+await digest(email),failure=d.failures[key];
 if(failure?.until>Date.now())return {status:429,error:'입력이 여러 번 일치하지 않았습니다. 5분 후 다시 시도해 주세요.',modified:false};
 const registered=d.adminAccounts.find((a:any)=>String(a.email||'').trim().toLowerCase()===email);
 let account=registered&&registered.active!==false?registered:null,employee:any=null,created=false,valid=false;
 if(registered?.active===false){employee=d.employees.find((e:any)=>e.id===registered.employeeId);}
 else if(account){
  employee=d.employees.find((e:any)=>e.id===account.employeeId&&e.active);
  if(employee&&employeeAdmin(employee)&&(!requiredEmployeeId||employee.id===requiredEmployeeId)&&password.length>=8&&password.length<=128){valid=await hash(password,account.salt)===account.hash;}
 }else{
  employee=d.employees.find((e:any)=>{const c=delegatedCredential(e);return e.active&&employeeAdmin(e)&&(!requiredEmployeeId||e.id===requiredEmployeeId)&&String(c?.email||'').trim().toLowerCase()===email;});
  if(employee&&password.length<=128&&await verifyAdminPin(employee,password)){
   const now=new Date().toISOString(),salt=crypto.randomUUID();
   account={id:crypto.randomUUID(),employeeId:employee.id,email,salt,hash:await hash(password,salt),active:true,createdAt:now,updatedAt:now};
   d.adminAccounts.push(account);valid=true;created=true;
  }
 }
 if(!valid){d.failures[key]={count:(failure?.count||0)+1,until:(failure?.count||0)>=4?Date.now()+300000:0};return {status:401,error:'아이디 또는 비밀번호를 확인해 주세요.',modified:true};}
 delete d.failures[key];return {status:200,employee,account,created,modified:true};
}
export function createAdminSession(d:any,employee:any,account:any){const token=crypto.randomUUID()+crypto.randomUUID();d.sessions=(d.sessions||[]).filter((s:any)=>s.expires>Date.now());d.sessions.push({token,employeeId:employee.id,adminAccountId:account.id,authMethod:'id-password',expires:Date.now()+8*3600000});return token;}
export function admin(d:any,req:Request){const t=req.headers.get('x-admin-token');if(!t)return false;return (d.sessions||[]).some((s:any)=>{if(s.token!==t||s.expires<=Date.now())return false;if(!s.employeeId)return owner(req);if(s.adminAccountId){const a=(d.adminAccounts||[]).find((v:any)=>v.id===s.adminAccountId&&v.active!==false);const e=d.employees.find((v:any)=>v.id===a?.employeeId&&v.active);return !!a&&!!e&&e.id===s.employeeId&&employeeAdmin(e);}const e=d.employees.find((e:any)=>e.id===s.employeeId);return employeeAdmin(e)&&s.credentialVersion===(delegatedCredential(e)?.version||undefined)&&!!e.inviteHash&&e.inviteVersion===s.inviteVersion;});}
export function clean(d:any){return {employees:d.employees.map(({pin,inviteHash,...e}:any)=>({...e,inviteEnabled:!!inviteHash})),shifts:d.shifts,adjustments:d.adjustments,closed:d.closed,audit:d.audit,kakaoJsKey:d.kakaoJsKey||'',patterns:d.patterns||[],scheduleOverrides:d.scheduleOverrides||[],advances:d.advances||[],contracts:d.contracts||[],settings:{...d.settings,payDay:'month_end'}};}
export function touch(d:any,id:string,month:string){let a=d.adjustments[id+'_'+month];if(a){a.reviewed=false;a.taxConfirmed=false;}}
export function num(v:any,max=100000000){const n=Number(v);if(!Number.isFinite(n)||n<0||n>max)throw Error('숫자 입력 범위를 확인해 주세요.');return n;}

export function owner(req:Request){const email=(env as any).OWNER_EMAIL;return !!email&&req.headers.get('oai-authenticated-user-email')?.toLowerCase()===email.toLowerCase()&&!!req.headers.get('oai-authenticated-user-id');}
export async function digest(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');}

export function clock(d:any,employeeId:string,kind:string,now:string){if(!['in','out','break','resume'].includes(kind))throw Error('잘못된 요청입니다.');let log='';let open=d.shifts.find((s:any)=>s.employeeId===employeeId&&!s.end);let activeBreak=open?.breaks.find((v:any)=>!v.end);if(kind==='in'){if(d.shifts.some((s:any)=>s.employeeId===employeeId&&s.end&&Date.parse(s.start)<=Date.parse(now)&&Date.parse(now)<Date.parse(s.end)))throw Error('다른 근무 기록과 시간이 겹칩니다.');if(open)throw Error('이미 출근한 상태입니다.');if(d.closed[day(now).slice(0,7)])throw Error('마감된 달입니다.');d.shifts.push({id:crypto.randomUUID(),employeeId:employeeId,start:now,end:null,breaks:[]});}else{if(!open)throw Error('먼저 출근을 기록해 주세요.');if(d.closed[day(open.start).slice(0,7)])throw Error('마감된 달입니다.');if(kind==='break'){if(activeBreak)throw Error('이미 휴게 중입니다.');open.breaks.push({start:now,end:null});}else if(kind==='resume'){if(!activeBreak)throw Error('휴게 중이 아닙니다.');activeBreak.end=now;}else if(kind==='out'){if(activeBreak)activeBreak.end=now;open.end=now;}else throw Error('잘못된 요청입니다.');}touch(d,employeeId,day(open?.start||now).slice(0,7));log=d.employees.find((e:any)=>e.id===employeeId).name+' '+({in:'출근',break:'휴게 시작',resume:'근무 복귀',out:'퇴근'} as any)[kind];return log;}

