'use client';
import {useState} from 'react';
import ModalLayer from './modal-layer';
export default function ContractReader({body,title='근로계약서',onClose}:{body:string,title?:string,onClose:()=>void}){
 const [size,S]=useState(18);
 return <ModalLayer onClose={onClose}><section className="modal contract-reader" aria-label={title}><div className="reader-toolbar"><h2>{title}</h2><div className="inline"><button type="button" className="secondary" disabled={size<=16} onClick={()=>S(size-2)} aria-label="글자 작게">가−</button><button type="button" className="secondary" disabled={size>=28} onClick={()=>S(size+2)} aria-label="글자 크게">가＋</button><button type="button" className="primary" onClick={onClose}>닫기</button></div></div><div className="reader-body" tabIndex={0} aria-label="계약서 본문"><pre style={{fontSize:size}}>{body}</pre></div></section></ModalLayer>;
}

