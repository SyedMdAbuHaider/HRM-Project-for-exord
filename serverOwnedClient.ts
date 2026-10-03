const API_BASE=(import.meta.env.VITE_HRM_API_URL||'').replace(/\/$/,'');

class Builder {
  table:string; method:'GET'|'POST'|'PATCH'|'DELETE'='GET'; fields='*'; filters:[string,string,string][]=[]; orderBy?:string; orderDesc=false; limitN?:number; body:any; singleMode:'none'|'single'|'maybe'='none';
  constructor(table:string){this.table=table;}
  select(fields='*'){this.fields=fields;this.method='GET';return this;}
  eq(c:string,v:any){this.filters.push(['eq',c,String(v)]);return this;}
  neq(c:string,v:any){this.filters.push(['neq',c,String(v)]);return this;}
  gt(c:string,v:any){this.filters.push(['gt',c,String(v)]);return this;}
  gte(c:string,v:any){this.filters.push(['gte',c,String(v)]);return this;}
  lt(c:string,v:any){this.filters.push(['lt',c,String(v)]);return this;}
  lte(c:string,v:any){this.filters.push(['lte',c,String(v)]);return this;}
  in(c:string,v:any[]){this.filters.push(['in',c,v.join(',')]);return this;}
  order(c:string,o:any={}){this.orderBy=c;this.orderDesc=o.ascending===false;return this;}
  limit(n:number){this.limitN=n;return this;}
  single(){this.singleMode='single';return this;}
  maybeSingle(){this.singleMode='maybe';return this;}
  insert(body:any){this.method='POST';this.body=Array.isArray(body)?body[0]:body;return this;}
  update(body:any){this.method='PATCH';this.body=body;return this;}
  delete(){this.method='DELETE';return this;}
  upsert(body:any,_opts?:any){this.method='POST';this.body=Array.isArray(body)?body[0]:body;return this;}
  async run(){
    const q=new URLSearchParams(); if(this.method==='GET'){q.set('select',this.fields);for(const [op,c,v] of this.filters)q.set(op+'['+c+']',v);if(this.orderBy)q.set('order',this.orderBy+'.'+(this.orderDesc?'desc':'asc'));if(this.limitN)q.set('limit',String(this.limitN));}
    if((this.method==='PATCH'||this.method==='DELETE')&&this.filters.length){const id=this.filters.find(x=>x[0]==='eq'&&x[1]==='id')?.[2];if(id)q.set('id',id);}
    const token=localStorage.getItem('exord_auth_token'); const headers:any={'Accept':'application/json'}; if(token)headers.Authorization='Bearer '+token; if(this.method==='POST'||this.method==='PATCH'){headers['Content-Type']='application/json';}
    const r=await fetch(API_BASE+'/api/v1/data/'+encodeURIComponent(this.table)+(q.toString()?'?'+q.toString():''),{method:this.method,headers,body:this.body===undefined?undefined:JSON.stringify(this.body)});
    const json=await r.json().catch(()=>({})); if(!r.ok){return {data:null,error:{message:json.error||('HTTP '+r.status),status:r.status}};}
    let data=json.data??null; if(this.singleMode!=='none'){if(this.singleMode==='single'&&Array.isArray(data)&&!data.length)return {data:null,error:{message:'No rows found',status:404}};data=Array.isArray(data)?(data[0]??null):data;}
    return {data,error:json.error??null};
  }
  then(resolve:any,reject:any){return this.run().then(resolve,reject);}
}

export const supabase={from:(table:string)=>new Builder(table),channel:(_name:string)=>({on:()=>({subscribe:()=>({})})}),removeChannel:async()=>({})};