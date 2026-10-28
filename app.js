'use strict';
let user=null;
let adminMode=false;
const el=id=>document.getElementById(id);
const show=(id,visible)=>{el(id).hidden=!visible;};
function notice(message){el('notice').textContent=message;}
async function api(path,data){
  const options=data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':user?.csrf||''},body:JSON.stringify(data)};
  const response=await fetch(path,options);
  const result=await response.json();
  if(!response.ok){const error=new Error(result.error||'요청을 처리하지 못했습니다.');error.result=result;throw error;}
  return result;
}
async function refresh(){
  user=(await api('/api/me')).user;
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
  }
  if(authorized||(!adminMode&&user?.role==='employee')){
    const records=(await api('/api/attendance')).items;
    for(const record of records){
      const tr=document.createElement('tr');
      for(const value of [record.display_name,record.work_date,record.start_time,record.end_time+(record.end_time<=record.start_time?' (다음 날)':''),record.break_minutes+'분',Math.floor(record.minutes/60)+'시간 '+record.minutes%60+'분']){
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
  data.next_day=!!data.next_day;
  const clock=value=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
  const elapsed=clock(data.end_time)-clock(data.start_time)+(data.next_day?1440:0);
  if(elapsed<=0||elapsed>=1440)throw new Error('퇴근일과 시간을 확인하세요. 야간 근무는 다음 날 퇴근을 선택하고, 근무는 24시간 미만으로 입력하세요.');
  if(data.break_minutes>=elapsed)throw new Error('휴게시간은 근무시간보다 짧아야 합니다.');
  if(elapsed>720){
    if(!window.confirm(`${data.work_date} ${data.start_time} → ${data.next_day?'다음 날 ':''}${data.end_time}\n출근부터 퇴근까지 ${Math.floor(elapsed/60)}시간 ${elapsed%60}분입니다.\n날짜와 시간을 확인했으며 이대로 저장하시겠습니까?`))return;
    data.long_shift_confirmed=true;
  }
  try{await api('/api/attendance',data);}
  catch(error){
    if(!adminMode||error.result?.code!=='attendance_conflict')throw error;
    const previous=error.result.existing;
    const summary=(start,end,pause,nextDay)=>`${start} → ${nextDay?'다음 날 ':''}${end}, 휴게 ${pause}분`;
    const before=summary(previous.start_time,previous.end_time,previous.break_minutes,previous.end_time<=previous.start_time);
    const after=summary(data.start_time,data.end_time,data.break_minutes,data.next_day);
    if(!window.confirm(`${previous.display_name} · ${previous.work_date}\n기존: ${before}\n변경: ${after}\n기존 근무 기록을 수정하시겠습니까?`))return;
    data.expected_revision=error.result.revision;
    try{await api('/api/attendance',data);}
    catch(conflict){
      if(conflict.result?.code==='attendance_conflict')throw new Error('확인하는 동안 기록이 변경되었습니다. 다시 저장하여 최신 내용을 확인하세요.');
      throw conflict;
    }
  }
  await refresh();notice('근무 기록을 저장했습니다.');
}));
el('newEmployee').addEventListener('submit',action(async event=>{
  const form=event.currentTarget;const data=Object.fromEntries(new FormData(form));data.hourly_rate=Number(data.hourly_rate);
  await api('/api/employees',data);form.reset();await refresh();notice('직원을 등록했습니다.');
}));
el('backup').addEventListener('click',action(async()=>{const result=await api('/api/backup',{});notice('백업 완료: '+result.filename);}));
el('work').elements.work_date.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
refresh().catch(error=>notice(error.message));

