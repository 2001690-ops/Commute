'use client';
import {useState} from 'react';
import {Share2} from 'lucide-react';
export default function InviteShare({url,onCopy}:{url:string,kakaoKey?:string,onCopy:()=>void}){
 const [notice,N]=useState(''),[busy,B]=useState(false);
 async function share(){if(busy)return;N('');B(true);try{if(navigator.share){await navigator.share({title:'연덕갈비 직원 출퇴근',text:'본인만 사용하는 개인 초대 링크입니다.',url});}else{await onCopy();N('공유 기능을 사용할 수 없어 링크를 복사했습니다. 카카오톡 1:1 대화에 붙여넣어 보내 주세요.');}}catch(e:any){if(e.name!=='AbortError')N('공유창을 열지 못했습니다. 위의 링크 복사 버튼을 이용해 주세요.');}finally{B(false);}}
 return <div className="invite-share"><button type="button" className="secondary wide" disabled={busy} onClick={share}><Share2 size={17}/>{busy?'공유창 여는 중…':'공유'}</button>{notice&&<p className="hint" role="status">{notice}</p>}</div>;
}

