/** Representative inspection poses; the narrated chapter still starts at its boundary. */
export function strokePreview(phase:number){return [90,270,368,630][Math.max(0,Math.min(3,phase))];}
export function displayedAngle(degrees:number,snapshot:boolean){return snapshot?strokePreview(degrees===720?3:Math.floor(degrees/180)):degrees;}
