import {createHash} from 'node:crypto';

export const SCREENSHOT_MAX_BYTES=512*1024;
export const SCREENSHOT_MAX_DIMENSION=1600;
export class ScreenshotInputError extends Error {readonly status=422;readonly code='screenshot_invalid';constructor(){super('Use a PNG or JPEG screenshot up to 1600 pixels per side and 512 KB.');}}
export type ScreenshotInput={dataUrl:string;mimeType:'image/png'|'image/jpeg';width:number;height:number;bytes:number;sha256:string};
/** Header/size validation only, never an image decoder or a filesystem/network
 * loader. The browser normalizes selected uploads through its canvas first. */
export function parseScreenshotDataUrl(value:unknown):ScreenshotInput{
 const fail=():never=>{throw new ScreenshotInputError();};
 if(typeof value!=='string'||value.length>SCREENSHOT_MAX_BYTES*4/3+100)fail();
 const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value as string);if(!match)fail();
 const bytes=Buffer.from(match![2],'base64');if(!bytes.length||bytes.length>SCREENSHOT_MAX_BYTES||bytes.toString('base64')!==match![2])fail();
 let width=0,height=0;
 if(match![1]==='png'){
  if(bytes.length<45||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR'||bytes.toString('ascii',bytes.length-8,bytes.length-4)!=='IEND')fail();
  width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);
 }else{
  if(bytes.length<12||bytes.readUInt16BE(0)!==0xffd8||bytes.readUInt16BE(bytes.length-2)!==0xffd9)fail();
  let offset=2;
  while(offset+4<=bytes.length){
   if(bytes[offset++]!==255)fail();while(bytes[offset]===255)offset++;
   const marker=bytes[offset++];if(marker===0xda||marker===0xd9)break;
   if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
   if(offset+2>bytes.length)fail();const length=bytes.readUInt16BE(offset);if(length<2||offset+length>bytes.length)fail();
   if(marker===0xc0||marker===0xc2){if(length<8||bytes[offset+2]!==8)fail();height=bytes.readUInt16BE(offset+3);width=bytes.readUInt16BE(offset+5);break;}
   offset+=length;
  }
 }
 if(width<1||height<1||width>SCREENSHOT_MAX_DIMENSION||height>SCREENSHOT_MAX_DIMENSION)fail();
 return {dataUrl:value as string,mimeType:match![1]==='png'?'image/png':'image/jpeg',width,height,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
