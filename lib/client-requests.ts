export async function requestJson(url:string,init:RequestInit={},fetcher:typeof fetch=fetch){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
 let response:Response;
 try{response=await fetcher(url,{...init,cache:'no-store',signal:controller.signal});}
 catch{throw Error('연결이 끊겨 결과를 확인하지 못했습니다. 인터넷 연결을 확인해 주세요.');}
 finally{clearTimeout(timeout);}
 let data:any;try{data=await response.json();}catch{throw Error('서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');}
 if(!response.ok||data.error)throw Object.assign(Error(data.error||'요청을 처리하지 못했습니다.'),{status:response.status});
 return data;
}
export async function completeSavedAction<T>(result:T,onSaved:(value:T)=>void,refresh:()=>Promise<unknown>,onRefreshFailure:()=>void){
 onSaved(result);
 try{await refresh();}catch{onRefreshFailure();}
}
