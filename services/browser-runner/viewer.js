'use strict';
(async()=>{
 const status=document.querySelector('#status'),canvas=document.querySelector('#screen'),tabs=document.querySelector('#tabs');
 const token=location.hash.slice(1);history.replaceState(null,'',location.pathname);
 try{
  const response=await fetch(location.pathname+'/bootstrap',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
  if(!response.ok)throw new Error();
  const socket=new WebSocket(location.origin.replace(/^http/,'ws')+location.pathname+'/socket');
  const send=data=>{if(socket.readyState===1)socket.send(JSON.stringify(data));};
  socket.onopen=()=>{status.textContent='Connected. Complete sign-in below, then return to Soma.';};
  socket.onclose=()=>{status.textContent='This private browser has ended. Return to Soma to continue or reconnect.';canvas.blur();};
  socket.onerror=()=>{status.textContent='The browser connection was interrupted. Return to Soma to reconnect.';};
  socket.onmessage=event=>{
   const data=JSON.parse(event.data);
   if(data.type==='frame'){const image=new Image();image.onload=()=>canvas.getContext('2d').drawImage(image,0,0,1280,800);image.src='data:image/jpeg;base64,'+data.data;}
   if(data.type==='tabs'){const selected=tabs.value,next=data.pages.map(p=>p.id+':'+p.origin).join('|');if(tabs.dataset.content!==next){tabs.replaceChildren(...data.pages.map(page=>{const option=document.createElement('option');option.value=page.id;option.textContent=page.origin;return option;}));if(data.pages.some(p=>p.id===selected))tabs.value=selected;tabs.dataset.content=next;}}
  };
  tabs.onchange=()=>send({type:'select',id:tabs.value});
  const point=event=>{const rect=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(1280,(event.clientX-rect.left)*1280/rect.width)),y:Math.max(0,Math.min(800,(event.clientY-rect.top)*800/rect.height))};};
  canvas.onmousedown=event=>{event.preventDefault();canvas.focus();send({type:'mouse',event:'mousePressed',...point(event)});};
  canvas.onmouseup=event=>send({type:'mouse',event:'mouseReleased',...point(event)});
  canvas.onmousemove=event=>{if(event.buttons)send({type:'mouse',event:'mouseMoved',...point(event)});};
  canvas.addEventListener('wheel',event=>{event.preventDefault();send({type:'wheel',deltaY:Math.max(-5000,Math.min(5000,event.deltaY))});},{passive:false});
  const modifiers=event=>(event.altKey?1:0)+(event.ctrlKey?2:0)+(event.metaKey?4:0)+(event.shiftKey?8:0);
  canvas.onkeydown=event=>{if(event.key==='Escape'){canvas.blur();return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='v')return;event.preventDefault();if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey)send({type:'text',text:event.key});else send({type:'key',event:'keyDown',key:event.key,code:event.code,keyCode:event.keyCode,modifiers:modifiers(event)});};
  canvas.onkeyup=event=>{if(event.key!=='Escape'){event.preventDefault();send({type:'key',event:'keyUp',key:event.key,code:event.code,keyCode:event.keyCode,modifiers:modifiers(event)});}};
  canvas.onpaste=event=>{event.preventDefault();const text=event.clipboardData?.getData('text')??'';if(text.length<=4096)send({type:'text',text});};
 }catch{status.textContent='This sign-in link is invalid or expired. Return to Soma and reconnect.';}
})();
