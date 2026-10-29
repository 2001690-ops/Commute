'use client';
import {useEffect,useState} from 'react';

export default function ScheduleDatePicker({value,onChange,closedMonths=[],selectedDates,disabledDates=[]}:{value:string,onChange:(date:string)=>void,closedMonths?:string[],selectedDates?:string[],disabledDates?:string[]}){
 const [month,M]=useState((value||new Date().toISOString().slice(0,10)).slice(0,7));
 useEffect(()=>{if(value && !selectedDates)M(value.slice(0,7));},[value,selectedDates]);
 const year=Number(month.slice(0,4)), index=Number(month.slice(5))-1;
 const start=new Date(Date.UTC(year,index,1)).getUTCDay(), count=new Date(Date.UTC(year,index+1,0)).getUTCDate();
 function move(n:number){M(new Date(Date.UTC(year,index+n,1)).toISOString().slice(0,7))}
 const blocked=closedMonths.includes(month);
 return <fieldset className="schedule-date-picker"><legend>{selectedDates?'복사할 날짜 선택 · '+selectedDates.length+'일':'근무 날짜 선택 · '+value}</legend>
 {!selectedDates&&<label style={{display:'block',marginBottom:12}}>선택한 근무 날짜<input aria-label="선택한 근무 날짜" type="date" value={value||''} disabled={blocked} onChange={e=>{if(e.target.value&&!closedMonths.includes(e.target.value.slice(0,7))&&!disabledDates.includes(e.target.value))onChange(e.target.value)}}/></label>}
 <div className="calendar-heading"><button type="button" aria-label="날짜 선택 이전 달" onClick={()=>move(-1)}>‹</button><b>{year}년 {index+1}월</b><button type="button" aria-label="날짜 선택 다음 달" onClick={()=>move(1)}>›</button></div><div className="date-picker-grid">{['일','월','화','수','목','금','토'].map(v=><span key={v}>{v}</span>)}{Array.from({length:start},(_,i)=><span key={'empty'+i}/>)}{Array.from({length:count},(_,i)=>{const date=month+'-'+String(i+1).padStart(2,'0'),chosen=selectedDates?selectedDates.includes(date):date===value;return <button type="button" key={date} disabled={blocked||disabledDates.includes(date)} aria-label={date} aria-pressed={chosen} className={chosen?'chosen':''} style={{userSelect:'none'}} onClick={()=>onChange(date)}>{i+1}</button>})}</div>{blocked&&<small>급여 마감된 달은 선택할 수 없습니다.</small>}</fieldset>
}

