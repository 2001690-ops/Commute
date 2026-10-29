'use client';
import {useState} from 'react';
import {displayedWork} from '../../lib/payroll-display';
import {dailyRecords,rateAt} from '../../lib/workforce';
const money=(n:number)=>Math.round(n).toLocaleString('ko-KR');
const week=['일','월','화','수','목','금','토'];
export default function PayrollCalendar({data,month,rows}:{data:any,month:string,rows:any[]}){
 const [employeeId,setEmployeeId]=useState('');
 const people=data.employees||[];
 const id=employeeId||people[0]?.id||'';
 const person=people.find((e:any)=>e.id===id);
 const records=dailyRecords(data,month).filter((r:any)=>r.employeeId===id);
 const byDate=new Map(records.map((r:any)=>[r.date,r]));
 const [y,m]=month.split('-').map(Number);
 const offset=new Date(Date.UTC(y,m-1,1)).getUTCDay();
 const days=new Date(Date.UTC(y,m,0)).getUTCDate();
 const cells=Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>i-offset+1);
 const detail=(d:number)=>{
  const date=`${month}-${String(d).padStart(2,'0')}`;
  const r:any=byDate.get(date);
  const {hours,actual}=displayedWork(r);
  const wage=hours*rateAt(person,date);
  return {r,hours,wage,actual};
 };
 const total=cells.filter(d=>d>=1&&d<=days).reduce((a,d)=>a+detail(d).wage,0);
 return <section className="card payroll-calendar-card" aria-label="직원별 일별 급여 달력">
  <div className="payroll-calendar-heading"><div><h2>일별 근무·급여 달력</h2><p className="muted">사진처럼 날짜별 근무시간과 예상 기본급을 표시합니다.</p></div><div className="payroll-calendar-controls"><label>직원 선택<select value={id} onChange={e=>setEmployeeId(e.target.value)}>{people.map((e:any)=><option value={e.id} key={e.id}>{e.name}</option>)}</select></label></div></div>
  <div className="payroll-calendar-summary"><strong>{m}/{y}</strong><span>표시된 일별 기본급 합계 <b>₩{money(total)}</b></span></div>
  <div className="payroll-calendar-grid">{week.map((w,i)=><div className={'payroll-calendar-weekday '+(i===0?'sun':i===6?'sat':'')} key={w}>{w}</div>)}{cells.map((d,i)=>{
   if(d<1||d>days)return <div className="payroll-calendar-day empty" key={i}/>;
   const {r,hours,wage,actual}=detail(d);
   return <div className="payroll-calendar-day" key={i}><span className={'payroll-calendar-date '+(i%7===0?'sun':i%7===6?'sat':'')}>{d}</span>{r&&hours>0?<><span className={'payroll-calendar-hours '+(actual?'actual':'planned')}>{Number(hours.toFixed(2))}시간</span><span className="payroll-calendar-wage">{money(wage)}원</span></>:<span className="payroll-calendar-off">{r?'근무시간 없음':'—'}</span>}</div>;
  })}</div>
  <p className="hint">일별 금액은 기록된 실제 근로시간(없으면 예정시간) × 해당일 기본시급으로 계산한 참고값입니다. 휴게시간은 근로시간에서 제외됩니다. 주휴수당·추가수당·세금·가불은 아래 급여 정산표에서 별도로 계산하며, 미확인 예정근무는 확정 급여가 아닙니다.</p>
 </section>;
}

