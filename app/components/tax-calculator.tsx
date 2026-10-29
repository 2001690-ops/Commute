'use client';
import {localIncomeTax} from '../../lib/business-tax';
const won=(n:number)=>n.toLocaleString('ko-KR');
export default function TaxCalculator({form,preview,onChange}:{form:any,preview:any,onChange:(patch:any)=>void}){
 const auto=form.taxMethod==='business_3_3';
 return <div className="tax-calculator">
  <label>세금 계산 방식<select value={auto?'business_3_3':'manual'} onChange={e=>onChange({taxMethod:e.target.value,businessIncomeConfirmed:false,taxConfirmed:false,reviewed:false})}>
   <option value="manual">근로소득 등 — 확인한 세액 직접 입력</option>
   <option value="business_3_3">사업소득 해당자 — 3.3% 참고 자동계산</option>
  </select></label>
  {auto&&<><p className="hint">원천징수 대상 사업소득으로 확인한 경우에만 사용하세요. 일반·일용 근로소득에 일괄 적용하지 않습니다. 실제 지급액 전체를 기준으로 계산합니다.</p>
   <label className="checkbox"><input type="checkbox" required checked={!!form.businessIncomeConfirmed} onChange={e=>onChange({businessIncomeConfirmed:e.target.checked,taxConfirmed:false})}/>원천징수 대상 사업소득에 해당함을 확인했습니다.</label>
   {preview?.error?<p role="alert">{preview.error}</p>:<p>계산 기준 총지급액: <b>{won(preview?.gross||0)}원</b><br/><small>기본급 + 반영된 주휴수당 + 추가수당 · 가불과 기타 공제를 빼기 전 금액</small></p>}
  </>}
  <label>소득세 {auto?'(3% 자동계산)':'(확인한 금액)'}<input type="number" min="0" required readOnly={auto} value={auto?(preview?.incomeTax??''):form.incomeTax} onChange={e=>onChange({incomeTax:e.target.value,taxConfirmed:false})}/></label>
  <label>지방소득세 {auto?'(소득세의 10% 자동계산)':'(확인한 금액)'}<input type="number" min="0" required readOnly={auto} value={auto?(preview?.localTax??''):form.localTax} onChange={e=>onChange({localTax:e.target.value,taxConfirmed:false})}/></label>
  {!auto&&<button type="button" className="secondary" onClick={()=>{const income=Number(form.incomeTax);if(Number.isSafeInteger(income)&&income>=0&&income<=10000000000)onChange({localTax:localIncomeTax(income),taxConfirmed:false});}}>입력한 소득세로 지방소득세 계산</button>}
  {auto&&!preview?.error&&<p role="status">세금 합계: <b>{won(preview?.totalTax||0)}원</b> · 세목별 10원 미만 버림<br/><small>월 총액 기준 참고 계산입니다. 지급 건별 정산과 최종 신고세액은 확인해 주세요. 직원의 기존 소득·신고 분류는 자동 변경하지 않습니다.</small></p>}
 </div>;
}

