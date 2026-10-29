// Versioned document storage: bound every row well below D1's 2 MB limit.
// A D1 batch publishes the revision and chunks atomically; failed CAS writes
// cannot publish chunks or delete the winning generation.
const CHUNK_CHARS=250000;
export function documentChunks(text:string){
 const result:string[]=[];
 for(let offset=0;offset<text.length;){
  let end=Math.min(offset+CHUNK_CHARS,text.length);
  const last=text.charCodeAt(end-1);
  if(end<text.length&&last>=0xd800&&last<=0xdbff)end--;
  result.push(text.slice(offset,end));offset=end;
 }
 return result;
}
export async function readDocument(db:any,initial:()=>any){
 for(let attempt=0;attempt<2;attempt++){
  const result=await db.batch([
   db.prepare('SELECT payload,revision FROM attendance_store WHERE id=1'),
   db.prepare("SELECT c.part,c.payload FROM attendance_chunks c JOIN attendance_store s ON s.id=1 AND c.generation=json_extract(s.payload,'$.generation') ORDER BY c.part")
  ]);
  const row=result[0].results[0];
  if(!row){await db.prepare('INSERT OR IGNORE INTO attendance_store (id,payload,revision) VALUES (1,?,0)').bind(JSON.stringify(initial())).run();continue;}
  const header=JSON.parse(row.payload);
  if(header.storageVersion!==2)return {d:header,rev:row.revision};
  const chunks=result[1].results;
  if(!Number.isInteger(header.chunks)||header.chunks<1||chunks.length!==header.chunks||chunks.some((c:any,i:number)=>c.part!==i))throw Error('저장된 자료가 불완전합니다. 복구 담당자에게 문의해 주세요.');
  return {d:JSON.parse(chunks.map((c:any)=>c.payload).join('')),rev:row.revision};
 }
 throw Error('저장소를 초기화하지 못했습니다. 다시 시도해 주세요.');
}
export async function saveDocument(db:any,d:any,rev:number){
 const chunks=documentChunks(JSON.stringify(d)),generation=crypto.randomUUID();
 const header=JSON.stringify({storageVersion:2,generation,chunks:chunks.length});
 const guard='EXISTS (SELECT 1 FROM attendance_store WHERE id=1 AND revision=? AND payload=?)';
 const statements=[db.prepare('UPDATE attendance_store SET payload=?,revision=revision+1 WHERE id=1 AND revision=?').bind(header,rev)];
 chunks.forEach((payload,part)=>statements.push(db.prepare('INSERT INTO attendance_chunks(generation,part,payload) SELECT ?,?,? WHERE '+guard).bind(generation,part,payload,rev+1,header)));
 statements.push(db.prepare('DELETE FROM attendance_chunks WHERE generation<>? AND '+guard).bind(generation,rev+1,header));
 const result=await db.batch(statements);
 if(!result[0].meta.changes)throw Error('다른 기기에서 기록이 변경되었습니다. 다시 시도해 주세요.');
}
