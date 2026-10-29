// Local workerd/D1 integration. Never connects to a remote database.
import {createRequire} from 'node:module';
import {readFileSync,realpathSync} from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const require=createRequire(realpathSync('node_modules/wrangler/bin/wrangler.js'));
const {Miniflare}=require('miniflare');
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("local test")}}',d1Databases:{DB:'commute-review-local'},compatibilityDate:'2026-05-15'});
try{
 const db=await mf.getD1Database('DB');
 for(const name of ['0000_neat_nekra','0001_document_chunks'])await db.exec(readFileSync('drizzle/'+name+'.sql','utf8').replace(/\s+/g,' '));
 const code=ts.transpileModule(readFileSync('lib/store-document.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const {readDocument,saveDocument}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const initial=()=>({employees:[],audit:[],sessions:[]});
 let row=await readDocument(db,initial);
 const payload={...initial(),audit:Array.from({length:18},(_,i)=>({at:'2026-10-29',text:String(i)+'한글😀'.repeat(40000)}))};
 assert(Buffer.byteLength(JSON.stringify(payload))>2000000);
 await saveDocument(db,payload,row.rev);
 assert.deepEqual((await readDocument(db,initial)).d,payload);
 const rows=await db.prepare('SELECT length(CAST(payload AS BLOB)) AS bytes FROM attendance_chunks').all();
 assert(rows.results.every(r=>r.bytes<2000000));
 await assert.rejects(saveDocument(db,initial(),row.rev),/다른 기기/);
 assert.deepEqual((await readDocument(db,initial)).d,payload);
 console.log('PASS local workerd/D1: '+Buffer.byteLength(JSON.stringify(payload))+' UTF-8 bytes, '+rows.results.length+' bounded rows, consistent read, stale writer rejected');
}finally{await mf.dispose();}
