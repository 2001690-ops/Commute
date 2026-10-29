import {migrate,d1} from './d1-adapter.mjs';
import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';import {loadModule} from './compile.mjs';
export async function harness(){const sql=new DatabaseSync(':memory:');migrate(sql);const db=d1(sql);globalThis.testEnv={DB:db,OWNER_EMAIL:'owner@example.test'};const manage=await loadModule('app/api/manage/route.ts'),staff=await loadModule('app/api/staff/route.ts');const ownerHeaders={'oai-authenticated-user-email':'owner@example.test','oai-authenticated-user-id':'site-owner-test'};return {sql,manage,staff,ownerHeaders};}

