import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {deflateSync} from 'node:zlib';
import {identity,seal,verifyFile,setup,sealRepository,repositoryFiles,main} from '../skills/autopilot/scripts/autopilot.mjs';
import {canonical,verifyReceipt,sha256,markers,stripPngReceipt,embedPngReceipt,safePath,isRepoEligible} from '../skills/autopilot/scripts/lib/protocol.mjs';

const temp=()=>mkdtemp(join(tmpdir(),'autopilot-test-'));
async function fixture(){const root=await temp(),file=join(root,'hello.txt');await writeFile(file,'Verified sample\n');return{root,file,id:join(root,'identity')};}
function crc(b){let c=0xffffffff;for(const n of b){c^=n;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4);data.copy(out,8);out.writeUInt32BE(crc(out.subarray(4,-4)),out.length-4);return out;}
export function png(){const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.from([0,35,100,200,255]))),chunk('IEND',Buffer.alloc(0))]);}
test('canonical JSON ignores object order, preserves array order',()=>{assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2}));assert.notEqual(canonical([1,2]),canonical([2,1]));});
test('file verifies as self-signed, then trusted through independent key',async()=>{const f=await fixture();const sealed=await seal(f.file,{identity:f.id});assert.equal((await verifyFile(f.file,sealed.receipt)).status,'self-signed');assert.equal((await verifyFile(f.file,sealed.receipt,sealed.publicKey)).status,'trusted');});
test('tampered bytes do not match a valid receipt',async()=>{const f=await fixture(),s=await seal(f.file,{identity:f.id});await writeFile(f.file,'Modified');assert.equal((await verifyFile(f.file,s.receipt)).status,'mismatch');});
test('mutated claim and signature fail instead of becoming trusted',async()=>{const f=await fixture(),s=await seal(f.file,{identity:f.id});const r=JSON.parse(await readFile(s.receipt));r.payload.createdAt='2026-01-01T00:00:00Z';assert.equal((await verifyReceipt(r,await readFile(f.file))).status,'invalid');r.payload.claim='Something else';assert.equal((await verifyReceipt(r,await readFile(f.file))).status,'invalid');});
test('wrong trusted key stays self-signed',async()=>{const f=await fixture(),s=await seal(f.file,{identity:f.id}),other=await identity(join(f.root,'other'));assert.equal((await verifyFile(f.file,s.receipt,other.publicPath)).status,'self-signed');});
test('missing receipt is unknown; markers alone confer no trust',async()=>{const f=await fixture();assert.equal((await verifyFile(f.file)).status,'unknown');assert.equal(markers('AP1:12345678-1234-1234-1234-123456789abc').length,1);});
test('PNG embeds metadata without changing original or image chunks',async()=>{const f=await fixture(),image=join(f.root,'image.png'),original=png();await writeFile(image,original);const s=await seal(image,{identity:f.id,embedPng:true});assert.deepEqual(await readFile(image),original);const marked=await readFile(s.markedFile);assert.deepEqual(Buffer.from(stripPngReceipt(marked).data),original);assert.equal((await verifyFile(s.markedFile)).status,'self-signed');assert.equal((await verifyFile(image)).status,'unknown');});
test('corrupt PNG and malformed receipts fail closed',async()=>{const corrupt=png();corrupt[30]^=1;assert.throws(()=>stripPngReceipt(corrupt),/checksum/);assert.equal((await verifyReceipt({},new Uint8Array())).status,'invalid');});
test('sealing refuses to overwrite an existing receipt or marked PNG',async()=>{const f=await fixture();await seal(f.file,{identity:f.id});await assert.rejects(seal(f.file,{identity:f.id}),/EEXIST/);});
test('first run adapts to stacks and refreshes only changed inputs',async()=>{const root=await temp();await writeFile(join(root,'pyproject.toml'),'[project]\nname="sample"');await writeFile(join(root,'Cargo.toml'),'[package]\nname="sample"');const first=await setup(root);assert.deepEqual(first.stacks.sort(),['Python','Rust']);assert.ok(first.guide.length);assert.equal((await setup(root)).changed,false);const path=join(root,'.autopilot','context.json'),profile=JSON.parse(await readFile(path));profile.capabilities=[{name:'native search',status:'available'}];await writeFile(path,JSON.stringify(profile));await writeFile(join(root,'Cargo.toml'),'[package]\nname="changed"');assert.equal((await setup(root)).changed,true);assert.equal(JSON.parse(await readFile(path)).capabilities[0].name,'native search');assert.ok(!JSON.parse(await readFile(path)).root);});
test('repo receipt catches added, removed and changed tracked files',async()=>{const root=await temp();execFileSync('git',['init',root]);await writeFile(join(root,'a.txt'),'A');await writeFile(join(root,'b.txt'),'B');execFileSync('git',['-C',root,'add','.']);const s=await sealRepository(root,{identity:join(await temp(),'keys')}),r=JSON.parse(await readFile(s.receipt));assert.equal((await verifyReceipt(r,await repositoryFiles(root))).status,'self-signed');await writeFile(join(root,'a.txt'),'changed');assert.equal((await verifyReceipt(r,await repositoryFiles(root))).status,'mismatch');await writeFile(join(root,'c.txt'),'C');execFileSync('git',['-C',root,'add','c.txt']);assert.equal((await verifyReceipt(r,await repositoryFiles(root))).status,'mismatch');execFileSync('git',['-C',root,'rm','--cached','b.txt']);assert.equal((await verifyReceipt(r,await repositoryFiles(root))).status,'mismatch');});
test('repo path exclusions and traversal handling',()=>{for(const path of ['../secret','/absolute','a\\b','x/../y','a:b'])assert.equal(safePath(path),false);for(const path of ['.autopilot/key','.openai/hosting.json','.env.local','folder/x.pem'])assert.equal(isRepoEligible(path),false);assert.equal(isRepoEligible('src/main.py'),true);});
test('oversized or duplicate-file receipt schema is invalid',async()=>{const f=await fixture(),s=await seal(f.file,{identity:f.id}),r=JSON.parse(await readFile(s.receipt));r.payload.kind='repo';r.payload.files=[{path:'../secret',size:0,sha256:await sha256('')}];assert.equal((await verifyReceipt(r,[])).status,'invalid');});
test('help is actionable without setting up a project',async()=>{const result=await main(['help']);assert.ok(result.usage.includes('/autopilot <goal>'));assert.ok(result.firstRun.includes('explains'));});
test('repo sealing hashes committed-form bytes under autocrlf and rejects unstaged changes',async()=>{
  const root=await temp();execFileSync('git',['init',root]);execFileSync('git',['-C',root,'config','core.autocrlf','true']);
  await writeFile(join(root,'line.txt'),'one\r\ntwo\r\n');execFileSync('git',['-C',root,'add','.']);
  const s=await sealRepository(root,{identity:join(await temp(),'keys')}),r=JSON.parse(await readFile(s.receipt));
  const indexed=execFileSync('git',['-C',root,'show',':line.txt']);
  assert.equal(r.payload.files[0].size,indexed.length);assert.equal(r.payload.files[0].sha256,await sha256(indexed));
  assert.equal((await verifyReceipt(r,await repositoryFiles(root))).status,'self-signed');
  await writeFile(join(root,'line.txt'),'changed\r\n');
  await assert.rejects(sealRepository(root,{identity:join(await temp(),'keys'),output:join(root,'new.json')}),/Stage eligible changes/);
  assert.equal((await verifyReceipt(r,await repositoryFiles(root))).status,'mismatch');
});
test('first-run JavaScript detection supports a UTF-8 BOM',async()=>{const root=await temp();await writeFile(join(root,'package.json'),'\uFEFF{"name":"test","scripts":{"test":"node --test"}}');assert.ok((await setup(root)).stacks.includes('JavaScript / TypeScript'));});
test('repo verification refuses flags that can hide working-tree changes',async()=>{const root=await temp();execFileSync('git',['init',root]);await writeFile(join(root,'a.txt'),'A');execFileSync('git',['-C',root,'add','.']);execFileSync('git',['-C',root,'update-index','--assume-unchanged','a.txt']);await writeFile(join(root,'a.txt'),'changed');await assert.rejects(repositoryFiles(root),/assume-unchanged/);});
