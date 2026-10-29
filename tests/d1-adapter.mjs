import {readFileSync} from 'node:fs';
export function migrate(sql){
 sql.exec(readFileSync('drizzle/0000_neat_nekra.sql','utf8'));
 sql.exec(readFileSync('drizzle/0001_document_chunks.sql','utf8'));
}
export function d1(sql){
 const prepare=query=>{
  const statement=sql.prepare(query);let values=[];
  const run=()=>{
   for(const value of values)if(typeof value==='string'&&Buffer.byteLength(value)>2000000)throw Error('D1 row/string size limit');
   if(statement.columns().length){const results=statement.all(...values);return {results,meta:{changes:0}};}
   const r=statement.run(...values);return {results:[],meta:{changes:Number(r.changes)}};
  };
  return {bind(...v){values=v;return this;},async first(){return statement.get(...values)||null;},async run(){return run();},execute:run};
 };
 return {prepare,async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.execute());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
export function documentPayload(sql){
 const raw=sql.prepare('SELECT payload FROM attendance_store WHERE id=1').get()?.payload;
 if(!raw)return null;
 const header=JSON.parse(raw);
 return header.storageVersion===2?sql.prepare('SELECT payload FROM attendance_chunks WHERE generation=? ORDER BY part').all(header.generation).map(r=>r.payload).join(''):raw;
}
