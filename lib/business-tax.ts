import {monthSummary} from './workforce';

// Reference calculation for confirmed withholding-subject business income.
// Each tax is truncated to 10 won; this is not a tax filing or income classification.
export function localIncomeTax(incomeTax:number){
 if(!Number.isSafeInteger(incomeTax)||incomeTax<0||incomeTax>10000000000)throw Error('소득세를 원 단위로 확인해 주세요.');
 return Math.floor(incomeTax/100)*10;
}

export function businessTaxes(gross:number){
 if(!Number.isSafeInteger(gross)||gross<0||gross>10000000000)throw Error('계산할 총지급액을 확인해 주세요.');
 const incomeTax=Math.floor(gross*3/1000)*10;
 const localTax=localIncomeTax(incomeTax);
 return {gross,incomeTax,localTax,totalTax:incomeTax+localTax};
}

export function reviewBusinessTaxes(d:any,e:any,month:string,draft:any,now=new Date().toISOString()){
 if(!e)throw Error('직원을 선택해 주세요.');
 const extra=Number(draft.extra||0),weeklyHours=Number(draft.weeklyHours||0);
 if(!Number.isFinite(extra)||extra<0||extra>100000000||!Number.isFinite(weeklyHours)||weeklyHours<0||weeklyHours>300)throw Error('수당과 주휴시간을 확인해 주세요.');
 const key=e.id+'_'+month;
 const preview={...d,adjustments:{...d.adjustments,[key]:{...d.adjustments[key],extra,weeklyOverride:!!draft.weeklyOverride,weeklyHours}}};
 return businessTaxes(monthSummary(preview,e,month,now).gross);
}

