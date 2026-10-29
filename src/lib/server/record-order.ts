/** Exact ranks retain legacy integer positions without floating-point gap exhaustion. */
export type RecordOrder = number | string;
type Fraction = { n: bigint; d: bigint };
function fraction(value: RecordOrder): Fraction {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return { n: BigInt(value), d: 1n };
  if (typeof value === 'string' && /^-?\d+\/[1-9]\d*$/.test(value)) {
    const [n,d]=value.split('/').map(BigInt); return {n,d};
  }
  throw new Error('Invalid persisted record order.');
}
export function compareRecordOrder(a: RecordOrder,b: RecordOrder): number {
  const left=fraction(a),right=fraction(b),difference=left.n*right.d-right.n*left.d;
  return difference<0n?-1:difference>0n?1:0;
}
function rank(n: bigint,d: bigint): RecordOrder {
  let a=n<0n?-n:n,b=d;while(b){const remainder=a%b;a=b;b=remainder;}
  n/=a;d/=a;
  if(d===1n&&n>=BigInt(Number.MIN_SAFE_INTEGER)&&n<=BigInt(Number.MAX_SAFE_INTEGER))return Number(n);
  return `${n}/${d}`;
}
function between(low:RecordOrder|undefined,high:RecordOrder|undefined,index:number,count:number):RecordOrder {
  const step=BigInt(index+1),span=BigInt(count+1);
  if(low===undefined&&high===undefined)return index;
  if(low===undefined){const h=fraction(high!);return rank(h.n-(span-step)*h.d,h.d);}
  if(high===undefined){const l=fraction(low);return rank(l.n+step*l.d,l.d);}
  const l=fraction(low),h=fraction(high);
  return rank(l.n*h.d*(span-step)+h.n*l.d*step,l.d*h.d*span);
}

/** Retain the longest ordered set of existing positions; rank only inserts or moves. */
export function retainRecordOrder<T extends {order:RecordOrder}>(records:Record<string,T>,previous:Record<string,T>):void {
  const ids=Object.keys(records),tails:number[]=[],parents=new Map<number,number>();
  for(let index=0;index<ids.length;index++){
    const old=previous[ids[index]];if(!old)continue;
    let low=0,high=tails.length;
    while(low<high){const mid=(low+high)>>>1;if(compareRecordOrder(previous[ids[tails[mid]]].order,old.order)<0)low=mid+1;else high=mid;}
    parents.set(index,low?tails[low-1]:-1);tails[low]=index;
  }
  const anchors:number[]=[];let cursor=tails.at(-1)??-1;
  while(cursor>=0){anchors.push(cursor);cursor=parents.get(cursor)??-1;}anchors.reverse();
  let start=0,last:RecordOrder|undefined;
  for(const end of [...anchors,ids.length]){
    const next=end<ids.length?previous[ids[end]].order:undefined;
    for(let index=start;index<end;index++)records[ids[index]].order=between(last,next,index-start,end-start);
    if(end<ids.length){records[ids[end]].order=next!;last=next;}
    start=end+1;
  }
}
