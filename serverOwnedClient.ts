type BuilderResult={data:any,error:any};

const API_BASE=(import.meta.env.VITE_HRM_API_URL||'').replace(/\/$/,'');

class Builder {
  table:string; method:'GET'|'POST'|'PATCH'|'DELETE'='GET'; fields='*'; filters:[string,string,string][]=[]; orderBy?:string; orderDesc=false; limitN?:number; body:any; onConflict?:string; singleMode:'none'|'single'|'maybe'='none';
  constructor(table:string){this.table=table;}
  select(fields='*'){this.fields=fields; if(this.method==='GET') this.method='GET'; return this;}
  eq(c:string,v:any){this.filters.push(['eq',c,String(v)]);return this;}
  neq(c:string,v:any){this.filters.push(['neq',c,String(v)]);return this;}
  gt(c:string,v:any){this.filters.push(['gt',c,String(v)]);return this;}
  gte(c:string,v:any){this.filters.push(['gte',c,String(v)]);return this;}
  lt(c:string,v:any){this.filters.push(['lt',c,String(v)]);return this;}
  lte(c:string,v:any){this.filters.push(['lte',c,String(v)]);return this;}
  in(c:string,v:any[]){this.filters.push(['in',c,v.join(',')]);return this;}
  is(c:string,v:any){this.filters.push(['is',c,String(v)]);return this;}
  ilike(c:string,v:any){this.filters.push(['ilike',c,String(v)]);return this;}
  order(c:string,o:any={}){this.orderBy=c;this.orderDesc=o.ascending===false;return this;}
  limit(n:number){this.limitN=n;return this;}
  single(){this.singleMode='single';return this;}
  maybeSingle(){this.singleMode='maybe';return this;}
  insert(body:any){this.method='POST';this.body=body;return this;}
  update(body:any){this.method='PATCH';this.body=body;return this;}
  delete(){this.method='DELETE';return this;}
  upsert(body:any,opts?:any){this.method='POST';this.body=body;this.onConflict=opts?.onConflict;return this;}
  async run(){
    const q=new URLSearchParams(); if(this.method==='GET'){q.set('select',this.fields);for(const [op,c,v] of this.filters)q.set(op+'['+c+']',v);if(this.orderBy)q.set('order',this.orderBy+'.'+(this.orderDesc?'desc':'asc'));if(this.limitN)q.set('limit',String(this.limitN));}
    if(this.method==='POST'&&this.onConflict)q.set('onConflict',this.onConflict); if(this.method==='PATCH'||this.method==='DELETE'){for(const [op,c,v] of this.filters)q.set(op+'['+c+']',v);}
    const token=localStorage.getItem('exord_auth_token'); const headers:any={'Accept':'application/json'}; if(token)headers.Authorization='Bearer '+token; if(this.method==='POST'||this.method==='PATCH'){headers['Content-Type']='application/json';}
    const r=await fetch(API_BASE+'/api/v1/data/'+encodeURIComponent(this.table)+(q.toString()?'?'+q.toString():''),{method:this.method,headers,body:this.body===undefined?undefined:JSON.stringify(this.body)});
    const json=await r.json().catch(()=>({})); if(!r.ok){return {data:null,error:{message:json.error||('HTTP '+r.status),status:r.status}};}
    let data:any=json.data??null; if(this.singleMode!=='none'){if(this.singleMode==='single'&&Array.isArray(data)&&!data.length)return {data:null,error:{message:'No rows found',status:404}};data=Array.isArray(data)?(data[0]??null):data;}
    return {data,error:json.error??null};
  }
  then<TResult1=BuilderResult,TResult2=never>(onfulfilled?:((value:BuilderResult)=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2>{return this.run().then(onfulfilled,onrejected);}
}

export const supabase={from:(table:string)=>new Builder(table),channel:(_name:string)=>({on:()=>({subscribe:()=>({})})}),removeChannel:async()=>({})};