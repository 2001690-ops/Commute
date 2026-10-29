import {registerHooks} from 'node:module';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&c.parentURL?.startsWith('file:')){const u=new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(fileURLToPath(u)+ext))return {url:u.href+ext,shortCircuit:true};}return next(s,c);},load(u,c,next){if(/\.tsx?$/.test(u))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(u),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};return next(u,c);}});
const TaxCalculator=(await import('../app/components/tax-calculator.tsx')).default;
const props={form:{taxMethod:'business_3_3',businessIncomeConfirmed:false,incomeTax:0,localTax:0},preview:{gross:1000000,incomeTax:30000,localTax:3000,totalTax:33000},onChange(){}};
const auto=renderToStaticMarkup(React.createElement(TaxCalculator,props));
assert(auto.includes('1,000,000'));assert(auto.includes('33,000'));assert(auto.includes('readOnly'));assert(auto.includes('required'));assert(auto.includes('사업소득'));
const manual=renderToStaticMarkup(React.createElement(TaxCalculator,{...props,form:{...props.form,taxMethod:'manual'}}));
assert(manual.includes('입력한 소득세로 지방소득세 계산'));assert(!manual.includes('계산 기준 총지급액'));
console.log('PASS automatic/manual tax UI, full basis, separate fields, consent and calculated values.');

