'use client';

const money=(n:number)=>Math.round(n).toLocaleString('ko-KR');
const week=['일','월','화','수','목','금','토'];

export default function StaffPayrollCalendar({month,records,employeeName}:{month:string,records:any[],employeeName:string}){
 const [y,m]=month.split('-').map(Number);
 const offset=new Date(Date.UTC(y,m-1,1)).getUTCDay();
 const days=new Date(Date.UTC(y,m,0)).getUTCDate();
 const cells=Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>i-offset+1);
 const byDate=new Map((records||[]).map((r:any)=>[r.date,r]));
 const detail=(d:number)=>{
  const date=`${month}-${String(d).padStart(2,'0')}`;
  const r:any=byDate.get(date);
  const actual=Number(r?.hours||0);
  const planned=Number(r?.plannedHours||0);
  const hours=actual>0?actual:planned;
  const rate=Number(r?.rate||0);
  return {r,hours,rate,wage:hours*rate,actual:actual>0};
 };
 const total=cells.filter(d=>d>=1&&d<=days).reduce((sum,d)=>sum+detail(d).wage,0);
 return <section className="card payroll-calendar-card" aria-label="내 일별 근무·급여 달력">
  <div className="payroll-calendar-heading"><div><h2>내 일별 근무·급여 달력</h2><p className="muted">{employeeName}님의 근무 일정과 출퇴근 기록입니다.</p></div></div>
  <div className="payroll-calendar-summary"><strong>{y}년 {m}월</strong><span>표시된 일별 기본급 합계 <b>₩{money(total)}</b></span></div>
  <div className="payroll-calendar-grid">{week.map((w,i)=><div className={'payroll-calendar-weekday '+(i===0?'sun':i===6?'sat':'')} key={w}>{w}</div>)}{cells.map((d,i)=>{
   if(d<1||d>days)return <div className="payroll-calendar-day empty" key={i}/>;
   const {r,hours,rate,wage,actual}=detail(d);
   return <div className="payroll-calendar-day" key={i}><span className={'payroll-calendar-date '+(i%7===0?'sun':i%7===6?'sat':'')}>{d}</span>{r&&hours>0?<><span className={'payroll-calendar-hours '+(actual?'actual':'planned')}>{Number(hours.toFixed(2))}시간</span><span className="payroll-calendar-wage">{rate>0?money(wage)+'원':'시급 설정 필요'}</span></>:<span className="payroll-calendar-off">{r?'근무시간 없음':'—'}</span>}</div>;
  })}</div>
  <p className="hint">확인된 실제 근무시간이 있으면 실제 시간을, 없으면 예정시간을 표시합니다. 일별 금액은 기본시급 기준 참고값이며 주휴수당·추가수당·세금·가불은 아래 급여 내역과 별도로 확인하세요. 예정시간은 확정 급여가 아닙니다.</p>
 </section>;
}

