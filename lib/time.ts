export const day=(iso:string)=>new Date(Date.parse(iso)+9*3600000).toISOString().slice(0,10);
export function minutes(s:any){if(!s.end)return 0;return Math.max(0,(Date.parse(s.end)-Date.parse(s.start))/60000-(s.breaks||[]).reduce((a:number,b:any)=>a+(b.end?(Date.parse(b.end)-Date.parse(b.start))/60000:0),0));}
