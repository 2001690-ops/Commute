'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

// The native top layer keeps the editor outside calendar overflow/stacking contexts.
export default function ModalLayer({children,onClose}:{children:ReactNode,onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),closeRef=useRef(onClose);
 closeRef.current=onClose;
 useEffect(()=>{
  const dialog=ref.current;
  if(!dialog)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const root=document.documentElement,overflow=root.style.overflow;
  const cancel=(event:Event)=>{event.preventDefault();closeRef.current();};
  dialog.addEventListener('cancel',cancel);
  dialog.showModal();
  root.style.overflow='hidden';
  return ()=>{
   dialog.removeEventListener('cancel',cancel);
   if(dialog.open)dialog.close();
   root.style.overflow=overflow;
   previous?.focus({preventScroll:true});
  };
 },[]);
 if(typeof document==='undefined')return null;
 return createPortal(<dialog ref={ref} className="modal-layer no-print" aria-label="근무 설정" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>{children}</dialog>,document.body);
}
