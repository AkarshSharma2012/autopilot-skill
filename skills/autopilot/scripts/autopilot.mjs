#!/usr/bin/env node
import { readFile, writeFile, mkdir, lstat, realpath, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname, relative, basename, extname } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, sign, createPublicKey, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PROTOCOL, MAX_BYTES, canonical, sha256, base64, fingerprint, verifyReceipt, isPng, stripPngReceipt, embedPngReceipt, safePath, isRepoEligible } from './lib/protocol.mjs';

const MANIFESTS=['package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','bun.lock','pyproject.toml','requirements.txt','setup.py','uv.lock','poetry.lock','Cargo.toml','Cargo.lock','go.mod','go.sum','pom.xml','build.gradle','composer.json','composer.lock','Gemfile','Gemfile.lock','pubspec.yaml','pubspec.lock','global.json','CMakeLists.txt','Makefile','Package.swift','default.project.json','wally.toml','AGENTS.md','CLAUDE.md'];
export async function setup(project) {
  const root=await realpath(project), files=[];
  const rootEntries=await readdir(root,{withFileTypes:true});
  const discovered=rootEntries.filter(e=>e.isFile()&&/\.(csproj|fsproj|sln|tf)$/.test(e.name)).map(e=>e.name);
  for(const name of [...MANIFESTS,...discovered].sort()) {
    const p=join(root,name);
    if(existsSync(p) && (await lstat(p)).isFile()) files.push({name,sha256:await sha256(await readFile(p))});
  }
  const manifests=files.map(f=>f.name), stacks=[];
  for(const [name,stack] of [['package.json','JavaScript / TypeScript'],['pyproject.toml','Python'],['requirements.txt','Python'],['Cargo.toml','Rust'],['go.mod','Go'],['pom.xml','Java'],['build.gradle','JVM'],['composer.json','PHP'],['Gemfile','Ruby'],['pubspec.yaml','Dart / Flutter'],['global.json','.NET'],['CMakeLists.txt','C / C++']]) if(manifests.includes(name)) stacks.push(stack);
  if(manifests.some(n=>/\.(csproj|fsproj|sln)$/.test(n)))stacks.push('.NET');
  if(manifests.some(n=>n.endsWith('.tf')))stacks.push('Terraform');
  if(manifests.includes('Package.swift'))stacks.push('Swift');
  if(manifests.includes('default.project.json')||manifests.includes('wally.toml'))stacks.push('Roblox / Luau');
  let packages=[], testScripts=[];
  if(manifests.includes('package.json')) {
    const p=JSON.parse((await readFile(join(root,'package.json'),'utf8')).replace(/^\uFEFF/,''));
    packages=Object.keys({...p.dependencies,...p.devDependencies}).sort();
    testScripts=Object.keys(p.scripts||{}).filter(x=>/test|check|build|lint|typecheck/.test(x));
  }
  const profilePath=join(root,'.autopilot','context.json');
  await safeDirectory(dirname(profilePath));
  let old;
  if(existsSync(profilePath)) { await assertRegular(profilePath); old=JSON.parse(await readFile(profilePath,'utf8')); }
  const detection={manifests:files,stacks:[...new Set(stacks)],packages,testScripts};
  const profile={schema:1,...detection,environmentFingerprint:await sha256(canonical(detection)),capabilities:old?.capabilities||[],provenance:'detached-receipts',notes:'Agent must supplement with observed host tools. No configuration implies live connectivity.'};
  if(!old||canonical(old)!==canonical(profile)) await writeFile(profilePath,JSON.stringify(profile,null,2)+'\n',{flag:'w',mode:0o600});
  return {profile:profilePath,changed:!old||old.environmentFingerprint!==profile.environmentFingerprint,stacks:profile.stacks,guide:['Use /autopilot <goal>, or say: Use Autopilot to <goal>.','Research: /autopilot research max <question and deliverable>.','Your agent must inventory its exposed tools and explain selected capabilities.','Run the CLI help command or ask Autopilot help for usage and receipts.']};
}
async function safeDirectory(path) {
  const full=resolve(path); let current=full;
  while(true) {
    if(existsSync(current) && (await lstat(current)).isSymbolicLink()) throw Error('Refusing a symlink directory');
    const parent=dirname(current); if(parent===current) break; current=parent;
  }
  await mkdir(full,{recursive:true,mode:0o700});
}
async function assertRegular(path) { const s=await lstat(path); if(!s.isFile()||s.isSymbolicLink()||s.size>MAX_BYTES) throw Error('Expected a regular file up to 32 MiB: '+basename(path)); }
async function readArtifact(path) { await assertRegular(path); return readFile(path); }
export async function identity(directory=join(homedir(),'.autopilot','identity')) {
  await safeDirectory(directory);
  const privatePath=join(directory,'private.pem'),publicPath=join(directory,'public.pem');
  if(!existsSync(privatePath)) {
    const {privateKey,publicKey}=generateKeyPairSync('ed25519');
    await writeFile(privatePath,privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});
    await writeFile(publicPath,publicKey.export({type:'spki',format:'pem'}),{flag:'wx',mode:0o644});
  }
  await assertRegular(privatePath);
  const privateKey=await readFile(privatePath,'utf8');
  const publicKey=base64(createPublicKey(privateKey).export({type:'spki',format:'der'}));
  return {privateKey,publicKey,publicPath};
}
export async function signPayload(fields,id) {
  const payload={protocol:PROTOCOL,algorithm:'Ed25519',claim:'Created with the Autopilot workflow',id:randomUUID(),createdAt:new Date().toISOString(),...fields};
  return {payload,publicKey:id.publicKey,signature:sign(null,Buffer.from(canonical(payload)),id.privateKey).toString('base64')};
}
async function writeNew(path,content) { await safeDirectory(dirname(resolve(path))); await writeFile(path,content,{flag:'wx',mode:0o644}); }
export async function seal(file,options={}) {
  const original=await readArtifact(file);
  if(options.embedPng&&!isPng(original)) throw Error('--embed-png requires PNG');
  const id=await identity(options.identity);
  const normalized=options.embedPng?stripPngReceipt(original).data:original;
  const receipt=await signPayload({kind:'file',name:basename(file),digest:await sha256(normalized),normalization:options.embedPng?'png-without-autopilot-chunk-v1':'exact-bytes-v1'},id);
  const receiptPath=options.output||file+'.autopilot.json';
  await writeNew(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  let markedFile;
  if(options.embedPng) { markedFile=file.slice(0,-extname(file).length)+'.autopilot.png'; await writeNew(markedFile,embedPngReceipt(original,receipt)); }
  return {receipt:receiptPath,markedFile,marker:'AP1:'+receipt.payload.id,fingerprint:await fingerprint(id.publicKey),publicKey:id.publicPath};
}
export async function repositoryFiles(root,{requireClean=false}={}) {
  const directory=await realpath(root);
  const flagged=execFileSync('git',['-C',directory,'ls-files','-v','-z'],{encoding:'utf8',maxBuffer:1024*1024}).split('\0').filter(Boolean).some(entry=>(entry[0]==='S'||/[a-z]/.test(entry[0]))&&isRepoEligible(entry.slice(2)));
  if(flagged)throw Error('Clear assume-unchanged and skip-worktree flags on eligible files before verification.');
  const entries=execFileSync('git',['-C',directory,'ls-files','--stage','-z'],{encoding:'utf8',maxBuffer:1024*1024}).split('\0').filter(Boolean).map(entry=>{
    const match=/^(\d+) ([a-f0-9]+) (\d)\t([\s\S]+)$/.exec(entry);
    if(!match||match[3]!=='0')throw Error('Resolve unmerged index entries before sealing.');
    return {mode:match[1],oid:match[2],path:match[4]};
  }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const dirty=new Set(execFileSync('git',['-C',directory,'diff','--name-only','-z'],{encoding:'utf8',maxBuffer:1024*1024}).split('\0').filter(Boolean));
  if(requireClean&&[...dirty].some(isRepoEligible))throw Error('Stage eligible changes before sealing; receipts bind to the Git index blobs.');
  const files=[]; let total=0;
  for(const {path,mode,oid} of entries) {
    if(!isRepoEligible(path)) continue;
    if(!['100644','100755'].includes(mode))throw Error('Repository symlinks and submodules are unsupported.');
    if(!safePath(path)) throw Error('Unsafe tracked path');
    const full=join(directory,path); await assertRegular(full);
    const real=await realpath(full);
    if(relative(directory,real).startsWith('..')) throw Error('Tracked path escapes project');
    const data=dirty.has(path)?await readFile(full):execFileSync('git',['-C',directory,'cat-file','blob',oid],{maxBuffer:MAX_BYTES}); total+=data.length;
    if(total>MAX_BYTES||files.length>=1000) throw Error('Repository receipt limit: 1000 files / 32 MiB total');
    files.push({path,size:data.length,sha256:await sha256(data)});
  }
  if(!files.length) throw Error('No eligible Git-tracked files');
  return files;
}
export async function sealRepository(project,options={}) {
  const files=await repositoryFiles(project,{requireClean:true}),id=await identity(options.identity);
  const receipt=await signPayload({kind:'repo',files,digest:await sha256(canonical(files))},id);
  const path=options.output||join(project,'.autopilot','provenance.json');
  await writeNew(path,JSON.stringify(receipt,null,2)+'\n');
  return {receipt:path,files:files.length,fingerprint:await fingerprint(id.publicKey)};
}
export async function verifyFile(file,receiptPath,trustPath) {
  const data=await readArtifact(file);
  const receipt=receiptPath?JSON.parse(await readArtifact(receiptPath)):isPng(data)?stripPngReceipt(data).receipt:undefined;
  if(!receipt) return {status:'unknown',message:'No signed receipt found. Origin cannot be determined.'};
  if(receipt.payload?.kind!=='file') return {status:'invalid',message:'Expected a file receipt'};
  return verifyReceipt(receipt,data,trustPath?await readFile(trustPath,'utf8'):undefined);
}
export async function main(argv=process.argv.slice(2)) {
  const [command,...args]=argv,opts={};
  for(let i=0;i<args.length;i++) {
    if(!args[i].startsWith('--')) throw Error('Expected --option');
    const k=args[i].slice(2); if(k==='embed-png') opts[k]=true;
    else { if(!args[i+1]||args[i+1].startsWith('--')) throw Error('Missing value for --'+k); opts[k]=args[++i]; }
  }
  let result;
  if(command==='help') result={usage:['/autopilot <goal>','/autopilot research low|medium|high|max <question>','Use Autopilot to <goal> (hosts without slash commands)'],firstRun:'Your agent discovers the stack and actual tools, saves a local profile, and explains its selected setup.',cli:['setup --project <folder>','key [--identity <private-folder>]','seal --file <artifact> [--embed-png] [--output <receipt>]','verify --file <artifact> [--receipt <receipt>] [--trust <public.pem>]','seal-repo --project <git-repo> [--output <receipt>]','verify-repo --project <git-repo> [--receipt <receipt>] [--trust <public.pem>]','badge --receipt <receipt> --output <badge.svg>'],limits:'Skills use capabilities exposed by the host. A signature proves matching bytes and a declaration, not how content was generated. No private files are uploaded.'};
  else if(command==='setup') result=await setup(resolve(opts.project||'.'));
  else if(command==='key') { const id=await identity(opts.identity); result={publicKey:id.publicPath,fingerprint:await fingerprint(id.publicKey)}; }
  else if(command==='seal') { if(!opts.file) throw Error('--file is required'); result=await seal(resolve(opts.file),{identity:opts.identity,output:opts.output,embedPng:opts['embed-png']}); }
  else if(command==='seal-repo') result=await sealRepository(resolve(opts.project||'.'),opts);
  else if(command==='verify') { if(!opts.file) throw Error('--file is required'); result=await verifyFile(resolve(opts.file),opts.receipt,opts.trust); }
  else if(command==='verify-repo') {
    const project=resolve(opts.project||'.'),receipt=JSON.parse(await readArtifact(opts.receipt||join(project,'.autopilot','provenance.json')));
    if(receipt.payload?.kind!=='repo') throw Error('Expected repository receipt');
    result=await verifyReceipt(receipt,await repositoryFiles(project),opts.trust?await readFile(opts.trust,'utf8'):undefined);
  } else if(command==='badge') {
    const receipt=JSON.parse(await readArtifact(opts.receipt));
    if(!/^[0-9a-f-]{36}$/.test(receipt.payload?.id)) throw Error('Invalid receipt id');
    const marker='AP1:'+receipt.payload.id;
    await writeNew(opts.output||'autopilot-badge.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="440" height="72" role="img" aria-label="Autopilot attribution; receipt required"><rect width="440" height="72" rx="12" fill="#153e63"/><text x="18" y="28" fill="white" font-family="sans-serif" font-size="15">Created with Autopilot · verify the receipt</text><text x="18" y="52" fill="#c1e9f7" font-family="monospace" font-size="12">${marker}</text></svg>\n`);
    result={marker,output:opts.output||'autopilot-badge.svg'};
  } else throw Error('Commands: setup, key, seal, seal-repo, verify, verify-repo, badge. See README for options.');
  console.log(JSON.stringify(result,null,2));
  if(['invalid','mismatch'].includes(result.status)) process.exitCode=1;
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) main().catch(error=>{console.error(error.message);process.exitCode=1;});
