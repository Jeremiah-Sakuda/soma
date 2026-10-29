'use client';
import {useEffect,useRef,useState} from 'react';

/** Audio progress supplies the clock while speaking. Manual changes get one
 * bounded replay; pausing settles to the checked state, never an idle loop. */
export function useExplorationMotion(key:string,playing:boolean,spokenProgress:number|null){
 const [reduced,setReduced]=useState(true),[manual,setManual]=useState({key,progress:1});
 const previous=useRef<string|null>(null);
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 useEffect(()=>{
  const changed=previous.current!==key;previous.current=reduced?null:key;
  if(reduced||playing||!changed){setManual({key,progress:1});return;}
  let frame=0;const began=performance.now();setManual({key,progress:0});
  const tick=(now:number)=>{const progress=Math.min(1,(now-began)/2400);setManual({key,progress});if(progress<1)frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[key,playing,reduced]);
 return reduced?1:playing?spokenProgress??0:manual.key===key?manual.progress:1;
}
