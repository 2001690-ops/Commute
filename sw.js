'use strict';
// Deliberately network-only: never persist sessions, employee pages or API data.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><title>인터넷 연결 필요</title><p>인터넷 연결 후 다시 열어 주세요. 근태 기록은 온라인에서만 가능합니다.</p></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
