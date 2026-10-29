export function validateShiftTime(start:string,end:string,breakMinutes:number,confirmed=false){
 const elapsed=(Date.parse(end)-Date.parse(start))/60000;
 if(!Number.isFinite(elapsed)||elapsed<=0||elapsed>=1440)throw Error('출퇴근 날짜와 시간을 확인해 주세요. 근무시간은 24시간 미만이어야 합니다.');
 if(!Number.isFinite(breakMinutes)||breakMinutes<0||breakMinutes>=elapsed)throw Error('휴게시간은 전체 근무시간보다 짧아야 합니다.');
 if(elapsed>720&&!confirmed)throw Error('12시간을 초과하는 근무입니다. 날짜와 시간을 확인하고 장시간 근무 확인을 선택해 주세요.');
 return elapsed;
}
export function scheduleTimes(date:string,start:string,end:string,nextDay:boolean){
 if(typeof nextDay!=='boolean')throw Error('다음 날 퇴근 여부를 확인해 주세요.');
 const from=new Date(date+'T'+start+':00+09:00').toISOString();
 const endDate=nextDay?new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10):date;
 const to=new Date(endDate+'T'+end+':00+09:00').toISOString();
 return {start:from,end:to};
}
