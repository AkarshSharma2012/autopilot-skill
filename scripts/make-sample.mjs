import {generateKeyPairSync} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {signPayload} from '../skills/autopilot/scripts/autopilot.mjs';
import {sha256,base64} from '../skills/autopilot/scripts/lib/protocol.mjs';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const id={privateKey:privateKey.export({type:'pkcs8',format:'pem'}),publicKey:base64(publicKey.export({type:'spki',format:'der'}))};
const receipt=await signPayload({kind:'file',name:'sample.txt',normalization:'exact-bytes-v1',digest:await sha256(await readFile(new URL('../web/sample.txt',import.meta.url)))},id);
await writeFile(new URL('../web/sample.autopilot.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
console.log('Public example receipt generated. Ephemeral private key was not saved.');
