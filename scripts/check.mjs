import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=process.cwd();
async function walk(dir) {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    if(['.git','.autopilot','dist','node_modules','.openai'].includes(entry.name)) continue;
    const path=resolve(dir,entry.name);
    if(entry.isDirectory()) await walk(path);
    else {
      const content=await readFile(path,'utf8');
      if(/-----BEGIN (?:PRIVATE|RSA PRIVATE|EC PRIVATE) KEY-----/.test(content)) throw Error('Private key found in public tree: '+entry.name);
      if(/C:\\Users\\|gh[pousr]_[A-Za-z0-9]{20,}/.test(content)) throw Error('Private path or credential found: '+entry.name);
    }
  }
}
await walk(root);console.log('Public source checks passed.');
