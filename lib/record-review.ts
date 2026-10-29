import {addDays} from './workforce';
export const shiftSnapshot=(s:any)=>JSON.stringify({id:s.id,employeeId:s.employeeId,start:s.start,end:s.end,breaks:s.breaks});
export function requireShiftReview(existing:any,expected:any){
 if(existing&&expected!==shiftSnapshot(existing))throw Error('근무 기록이 변경되었습니다. 목록을 새로고침하고 변경 전후를 다시 확인해 주세요.');
 if(!existing&&expected)throw Error('근무 기록을 찾을 수 없습니다. 목록을 새로고침해 주세요.');
}
export function affectedPayMonths(date:string){
 const weekday=new Date(date+'T00:00:00Z').getUTCDay();
 const holiday=addDays(date,(7-weekday)%7);
 return [...new Set([date.slice(0,7),holiday.slice(0,7)])];
}
export function assertPayMonthsOpen(d:any,date:string){
 if(affectedPayMonths(date).some(month=>d.closed[month]))throw Error('이 근무의 급여 또는 주휴수당이 마감됐습니다. 관련 월의 마감을 취소한 후 수정해 주세요.');
}
export function invalidatePayMonths(d:any,id:string,date:string){
 assertPayMonthsOpen(d,date);
 for(const month of affectedPayMonths(date)){
  const adjustment=d.adjustments[id+'_'+month];
  if(adjustment){adjustment.reviewed=false;adjustment.taxConfirmed=false;}
 }
}
