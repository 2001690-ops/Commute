import {migrate,d1,documentPayload} from './d1-adapter.mjs';
// Isolated API test runtime using real in-memory SQLite. No production access.
import {registerHooks,createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const require=createRequire(import.meta.url),ts=require('typescript');
const sqlite=new DatabaseSync(':memory:');
export const testSql=sqlite;
migrate(sqlite);
export const env={OWNER_EMAIL:'owner@example.test'};
export const database={get payload(){return documentPayload(sqlite)},set payload(value){sqlite.exec('DELETE FROM attendance_chunks');if(value===null)sqlite.exec('DELETE FROM attendance_store');else sqlite.prepare('INSERT INTO attendance_store(id,payload,revision) VALUES(1,?,0) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(value)},get revision(){return sqlite.prepare('SELECT revision FROM attendance_store WHERE id=1').get()?.revision??0},set revision(value){sqlite.prepare('UPDATE attendance_store SET revision=? WHERE id=1').run(value)}};
env.DB=d1(sqlite);
globalThis.__attendanceTestEnv=env;
registerHooks({resolve(s,c,next){if(s==='cloudflare:workers')return {url:'data:text/javascript,export const env=globalThis.__attendanceTestEnv',shortCircuit:true};if(s.startsWith('.')&&c.parentURL?.startsWith('file:')){const u=new URL(s,c.parentURL);if(existsSync(fileURLToPath(u)+'.ts'))return {url:u.href+'.ts',shortCircuit:true};}return next(s,c);},load(u,c,next){if(u.endsWith('.ts'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(u),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,shortCircuit:true};return next(u,c);}});
const RealDate=Date;let instant='2026-11-02T03:00:00Z';
globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[instant]))}static now(){return RealDate.parse(instant)}};
export function setNow(value){instant=value}
export function state(){return JSON.parse(database.payload)}
export function reset(value){database.payload=value?JSON.stringify(value):null;database.revision=0}

