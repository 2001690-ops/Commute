let loading:Promise<void>|null=null;
export async function shareKakao(key:string,url:string){
 if(!key)throw Error('카카오 JavaScript 키가 설정되지 않았습니다. 링크를 복사해 카카오톡으로 보내 주세요.');
 if(!loading)loading=new Promise((resolve,reject)=>{if((window as any).Kakao){resolve();return;}const s=document.createElement('script');s.src='https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js';s.integrity='sha384-BGX7Wb16GmRFagri4bLJV2DgipVZaU2AI812GZtHtHzzDQJnfHasDXN5houxv45w';s.crossOrigin='anonymous';s.onload=()=>resolve();s.onerror=()=>{s.remove();loading=null;reject(Error('카카오 공유 도구를 불러오지 못했습니다. 링크 복사를 이용해 주세요.'))};document.head.appendChild(s)});
 await loading;const kakao=(window as any).Kakao;if(kakao.isInitialized())kakao.cleanup();kakao.init(key);
 kakao.Share.sendDefault({objectType:'text',text:'연덕갈비 직원 출퇴근\n개인 초대 링크입니다. 개인 링크를 열고 출근·휴게·퇴근을 기록하세요.',link:{mobileWebUrl:url,webUrl:url},buttonTitle:'출퇴근 기록하기'});
}
