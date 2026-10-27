import { cp, mkdir, lstat, access, readFile, rename } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),hostIndex=args.indexOf('--host'),host=hostIndex>=0?args[hostIndex+1]:undefined;
const targets={agents:join(homedir(),'.agents','skills','autopilot'),codex:join(homedir(),'.codex','skills','autopilot'),claude:join(homedir(),'.claude','skills','autopilot')};
const targetArg=args.indexOf('--target');
if(targetArg>=0&&(!args[targetArg+1]||args[targetArg+1].startsWith('--'))) throw Error('--target requires a directory');
const target=targetArg>=0?resolve(args[targetArg+1]||''):targets[host];
async function run() {
  if(!target) throw Error('Use --host agents|codex|claude or --target <skill-directory>. Add --replace to back up and replace an existing skill.');
  if(basename(target)!=='autopilot'||target===join(root,'skills','autopilot')) throw Error('Choose a destination folder named autopilot outside the source skill.');
  let existing=false;
  let backup;
  try {await access(target,constants.F_OK);existing=true;} catch {}
  if(existing) {
    if((await lstat(target)).isSymbolicLink()) throw Error('Refusing to replace a symlink; install into its intended real directory explicitly.');
    if(!args.includes('--replace')) throw Error('Skill already exists; use --replace after reviewing the new package.');
    const previous=await readFile(join(target,'SKILL.md'),'utf8');
    if(!/^name:\s*autopilot\s*$/m.test(previous))throw Error('Existing directory is not an Autopilot skill; refusing to move it.');
    const backupArg=args.indexOf('--backup-dir');
    const backupRoot=backupArg>=0?resolve(args[backupArg+1]||''):join(homedir(),'.autopilot','backups');
    backup=join(backupRoot,(host||'custom')+'-'+randomUUID());
    await mkdir(dirname(backup),{recursive:true});
  }
  await mkdir(dirname(target),{recursive:true});
  const staging=join(dirname(target),'.autopilot-staging-'+randomUUID());
  await cp(join(root,'skills','autopilot'),staging,{recursive:true,errorOnExist:true,force:false});
  if(existing)await rename(target,backup);
  try {await rename(staging,target);} catch(error){if(existing)await rename(backup,target);throw error;}
  if(backup)console.log('Previous skill backed up outside skill discovery: '+backup);
  console.log('Installed: '+target+'\nRestart the agent if its skill list is cached.\nFirst use: /autopilot <your goal> or “Use Autopilot to <your goal>”.\nResearch: /autopilot research max <question and requested output>.\nFirst run discovers your stack and tools, saves local context, and explains the selected setup.\nHelp: node "'+join(target,'scripts','autopilot.mjs')+'" help\nNo plugins, account connections, or paid services were installed.');
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
