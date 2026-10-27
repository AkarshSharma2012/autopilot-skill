import {MAX_BYTES,isRepoEligible,sha256} from './protocol.mjs';
export function publicUrl(value) {
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||/\.(local|localhost|internal|home\.arpa|test|invalid)$/.test(u.hostname)||/^([\d.]+|\[.*\])$/.test(u.hostname)) throw Error('Use a public HTTPS URL without credentials.');
  return u;
}
export async function fetchBytes(url,limit=MAX_BYTES,fetcher=fetch) {
  publicUrl(url);
  const res=await fetcher(url,{signal:AbortSignal.timeout(20000),credentials:'omit',referrerPolicy:'no-referrer',redirect:'error'});
  if(!res.ok) throw Error(res.status===403||res.status===429?'Public API access is restricted or rate limited. Try again later.':'URL returned HTTP '+res.status);
  if(Number(res.headers.get('content-length'))>limit) throw Error('Download exceeds size limit');
  const reader=res.body.getReader(),parts=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('Download exceeds size limit');parts.push(value);}}
  catch(e){await reader.cancel();throw e;}
  const data=new Uint8Array(size);let offset=0;for(const p of parts){data.set(p,offset);offset+=p.length;}return data;
}
async function json(url,fetcher) {return JSON.parse(new TextDecoder().decode(await fetchBytes(url,2*1024*1024,fetcher)));}
export async function githubRepository(value,fetcher=fetch) {
  const url=publicUrl(value),parts=url.pathname.replace(/\/$/,'').split('/').filter(Boolean);
  if(url.hostname!=='github.com'||parts.length!==2||parts.some(p=>!(/^[A-Za-z0-9_.-]+$/.test(p))||p==='.'||p==='..')) throw Error('Use the root URL of a public GitHub repository.');
  const [owner,rawRepo]=parts,repo=rawRepo.replace(/\.git$/,''),api=`https://api.github.com/repos/${owner}/${repo}`;
  const info=await json(api,fetcher),commit=await json(api+'/commits/'+encodeURIComponent(info.default_branch),fetcher);
  if(!/^[a-f0-9]{40}$/.test(commit.sha)) throw Error('GitHub did not return a valid immutable revision');
  const raw=`https://raw.githubusercontent.com/${owner}/${repo}/${commit.sha}/`;
  const receipt=await json(raw+'.autopilot/provenance.json',fetcher);
  if(receipt.payload?.kind!=='repo') throw Error('Repository has no supported signed repository receipt.');
  const tree=await json(api+'/git/trees/'+commit.sha+'?recursive=1',fetcher);
  if(tree.truncated||!Array.isArray(tree.tree)) throw Error('Repository inventory is incomplete; verify locally instead.');
  const entries=tree.tree.filter(e=>e.type==='blob'&&isRepoEligible(e.path)).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(!entries.length||entries.length>1000||entries.some(e=>e.mode==='120000')||entries.reduce((n,e)=>n+(e.size||0),0)>MAX_BYTES) throw Error('Repository exceeds verifier limits or contains symlinks. Use the local CLI.');
  if(tree.tree.some(e=>e.type==='commit')) throw Error('Submodules need local verification.');
  const files=[];let total=0;
  for(let i=0;i<entries.length;i+=4){
    const group=await Promise.all(entries.slice(i,i+4).map(async(e)=>{
      const data=await fetchBytes(raw+e.path.split('/').map(encodeURIComponent).join('/'),MAX_BYTES,fetcher);total+=data.length;
      if(total>MAX_BYTES) throw Error('Repository download exceeds 32 MiB');
      return {path:e.path,size:data.length,sha256:await sha256(data)};
    })); files.push(...group);
  }
  return {receipt,files,revision:commit.sha};
}
