'use strict';
let user=null;
let adminMode=false;
const shortcut=location.pathname.startsWith('/s/')?location.pathname.slice(3):null;
if(shortcut)document.querySelector('link[rel="manifest"]').href='/manifest/'+encodeURIComponent(shortcut);
const el=id=>document.getElementById(id);
const show=(id,visible)=>{el(id).hidden=!visible;};
function notice(message){el('notice').textContent=message;}
async function api(path,data){
  const options=data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':user?.csrf||''},body:JSON.stringify(data)};
  const response=await fetch(path,options);
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'요청을 처리하지 못했습니다.');
  return result;
}
async function refresh(){
  user=(await api('/api/me')).user;
  if(shortcut&&user){
    try{await api('/api/shortcut/'+encodeURIComponent(shortcut));}
    catch(error){show('workPanel',false);show('records',false);show('adminTools',false);el('rows').replaceChildren();show('loginPanel',false);show('account',true);throw error;}
  }
  const authorized=Boolean(adminMode&&user?.role==='admin');
  show('employee',!adminMode);show('admin',adminMode);
  el('mode').textContent=adminMode?'직원 화면':'관리자 모드';
  document.title='연덕갈비 출퇴근 · '+(adminMode?'관리자':'직원용');
  show('loginPanel',!user||(adminMode&&user.role!=='admin'));
  el('loginTitle').textContent=adminMode?'관리자 로그인':'직원 로그인';
  show('account',!!user);
  el('identity').textContent=user?user.display_name+' 님'+(user.role==='admin'?' · 관리자 계정':''):'';
  show('workPanel',authorized||(!adminMode&&user?.role==='employee'));
  show('employeeChoice',authorized);show('adminTools',authorized);
  show('records',authorized||(!adminMode&&user?.role==='employee'));
  el('rows').replaceChildren();
  if(authorized){
    const employees=(await api('/api/employees')).items.filter(e=>e.active);
    const select=el('work').elements.employee_id;select.replaceChildren();
    for(const employee of employees){const option=document.createElement('option');option.value=employee.id;option.textContent=employee.display_name;select.append(option);}
    el('shortcutEmployee').replaceChildren(...Array.from(select.options,option=>option.cloneNode(true)));
  }
  if(authorized||(!adminMode&&user?.role==='employee')){
    const records=(await api('/api/attendance')).items;
    for(const record of records){
      const tr=document.createElement('tr');
      for(const value of [record.display_name,record.work_date,record.start_time,record.end_time,record.break_minutes+'분',Math.floor(record.minutes/60)+'시간 '+record.minutes%60+'분']){
        const td=document.createElement('td');td.textContent=value;tr.append(td);
      }
      el('rows').append(tr);
    }
  }
}
function action(task){return async event=>{event.preventDefault();const button=event.submitter||event.currentTarget;button.disabled=true;notice('');try{await task(event);}catch(error){notice(error.message);}finally{button.disabled=false;}};}
el('mode').addEventListener('click',action(async()=>{adminMode=!adminMode;await refresh();}));
el('login').addEventListener('submit',action(async event=>{
  const form=event.currentTarget;
  await api('/api/login',Object.fromEntries(new FormData(form)));
  form.reset();await refresh();
  if(adminMode&&user?.role!=='admin')notice('관리자 계정으로 로그인해 주세요.');
}));
el('logout').addEventListener('click',action(async()=>{await api('/api/logout',{});user=null;adminMode=false;await refresh();}));
el('work').addEventListener('submit',action(async event=>{
  const data=Object.fromEntries(new FormData(event.currentTarget));
  data.break_minutes=Number(data.break_minutes);data.confirmed=!!data.confirmed;
  if(adminMode)data.employee_id=Number(data.employee_id);else delete data.employee_id;
  await api('/api/attendance',data);await refresh();notice('근무 기록을 저장했습니다.');
}));
el('newEmployee').addEventListener('submit',action(async event=>{
  const form=event.currentTarget;const data=Object.fromEntries(new FormData(form));data.hourly_rate=Number(data.hourly_rate);
  await api('/api/employees',data);form.reset();await refresh();notice('직원을 등록했습니다.');
}));
el('backup').addEventListener('click',action(async()=>{const result=await api('/api/backup',{});notice('백업 완료: '+result.filename);}));
function clearShortcut(){el('shortcutResult').hidden=true;el('shortcutUrl').value='';el('shortcutQr').removeAttribute('src');}
el('shortcutEmployee').addEventListener('change',clearShortcut);
for(const operation of ['issue','revoke','view'])el('shortcut'+operation).addEventListener('click',action(async()=>{
  clearShortcut();const path='/api/employees/'+el('shortcutEmployee').value+'/shortcut';
  const result=operation==='view'?await api(path):await api(path+'/'+operation,{});
  if(result.url){el('shortcutUrl').value=result.url;el('shortcutQr').src=path+'/qr';show('shortcutResult',true);}
  notice(operation==='revoke'?'바로가기를 회수했습니다. 계정 로그인 권한은 유지됩니다.':'바로가기는 해당 직원의 로그인이 필요합니다.');
}));
el('logout').addEventListener('click',clearShortcut);
let installPrompt;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;show('installApp',true);});
el('installApp').addEventListener('click',action(async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;show('installApp',false);}}));
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>notice('홈 화면 설치 준비에 실패했습니다. 온라인으로 계속 이용할 수 있습니다.'));
el('work').elements.work_date.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
refresh().catch(error=>notice(error.message));
