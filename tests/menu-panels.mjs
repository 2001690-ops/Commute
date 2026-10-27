import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&c.parentURL?.startsWith('file:')){const u=new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(fileURLToPath(u)+ext))return {url:u.href+ext,shortCircuit:true};}return next(s,c);},load(u,c,next){if(/\.tsx?$/.test(u))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(u),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};return next(u,c);}});

const Panel=(await import('../app/components/workforce-panel.tsx')).default;
const data={employees:[{id:'e',name:'검증직원',active:true,rates:[{date:'2020-01-01',rate:12000}],hireDate:'2020-01-01',agreedWeeklyHours:20}],shifts:[],adjustments:{},closed:{},audit:[],patterns:[],scheduleOverrides:[],advances:[],contracts:[],settings:{communityUrl:'https://open.kakao.com/test'}};
for(const page of ['overview','schedule','payroll','reporting','contracts','profiles','retirement','settings']){
 const html=renderToStaticMarkup(React.createElement(Panel,{data,page,month:'2026-10',setMonth(){},action:async()=>true,navigate(){},onRefresh(){}}));
 assert.ok(html.length>200,page);assert.ok(!html.includes('단톡방'),page);assert.ok(!html.includes('https://open.kakao.com/test'),page);
}
console.log('PASS: all administrator panels render with existing employee data and no group-chat entry');
