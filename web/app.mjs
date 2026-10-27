import {MAX_BYTES,verifyReceipt,isPng,stripPngReceipt,markers} from './protocol.mjs';
import {publicUrl,fetchBytes,githubRepository} from './remote.mjs';
const $=id=>document.getElementById(id);
let mode='file',previewUrl;
const titles={trusted:'Trusted key. Matching artifact.','self-signed':'Signed, with an unknown signer.',marker:'An attribution marker is present.',unknown:'The origin is unknown.',mismatch:'The artifact has changed.',invalid:'The receipt could not be verified.',error:'We could not inspect this artifact.'};
function show(result){
  $('result').dataset.status=result.status;
  $('result-label').textContent=result.status.toUpperCase().replace('-',' ');
  $('result-title').textContent=titles[result.status]||'Inspection complete';
  $('result-message').textContent=result.message;
  $('result-limit').textContent=result.limitation||'A receipt authenticates a signer’s declaration and matching bytes. It cannot prove which tools created the content.';
  const dl=$('result-details');dl.replaceChildren();
  for(const [key,label] of [['id','Receipt ID'],['fingerprint','Signer fingerprint · SHA-256'],['createdAt','Signed at'],['revision','Repository revision']])if(result[key]){
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=result[key];dl.append(dt,dd);
  }
  dl.hidden=!dl.children.length;
}
const tabs=[...document.querySelectorAll('[data-mode]')];
function activate(tab){mode=tab.dataset.mode;for(const t of tabs){const selected=t===tab;t.setAttribute('aria-selected',selected);t.tabIndex=selected?0:-1;$('panel-'+t.dataset.mode).hidden=!selected;}}
for(const tab of tabs){tab.addEventListener('click',()=>activate(tab));tab.addEventListener('keydown',e=>{const i=tabs.indexOf(tab);let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;if(next!==undefined){e.preventDefault();activate(tabs[next]);tabs[next].focus();}});}
$('artifact').addEventListener('change',()=>{
  const file=$('artifact').files[0];$('file-name').textContent=file?file.name:'No file selected';
  if(previewUrl)URL.revokeObjectURL(previewUrl);$('image-preview').hidden=true;
  if(file&&file.size<=MAX_BYTES&&['image/png','image/jpeg','image/webp'].includes(file.type)){previewUrl=URL.createObjectURL(file);$('image-preview').src=previewUrl;$('image-preview').hidden=false;}
});
$('receipt').addEventListener('change',async()=>{const file=$('receipt').files[0];if(file){if(file.size>300000){show({status:'error',message:'Receipt exceeds 300 KB'});return;}$('receipt-json').value=await file.text();}});
async function inspect(data,receipt){
  if(data.length>MAX_BYTES)throw Error('Artifact exceeds 32 MiB');
  if(!receipt&&isPng(data))receipt=stripPngReceipt(data).receipt;
  if(!receipt){const found=markers(new TextDecoder().decode(data.slice(0,1024*1024)));return found.length?{status:'marker',message:'Found '+found.join(', ')+'. Supply the receipt to verify the claim.'}:{status:'unknown',message:'No signed receipt found. This does not tell us whether Autopilot was used.'};}
  if(receipt.payload?.kind!=='file')throw Error('This input needs a file receipt. Use repository URL mode for a repository receipt.');
  return verifyReceipt(receipt,data,$('trust-key').value.trim()||undefined);
}
$('verify-button').addEventListener('click',async()=>{
  const button=$('verify-button');button.disabled=true;button.textContent='Inspecting…';
  try{
    const receiptText=$('receipt-json').value.trim();if(receiptText.length>300000)throw Error('Receipt exceeds 300 KB');
    const receipt=receiptText?JSON.parse(receiptText):undefined;let result;
    if(mode==='file'){const file=$('artifact').files[0];if(!file)throw Error('Choose a file first.');if(file.size>MAX_BYTES)throw Error('Artifact exceeds 32 MiB');result=await inspect(new Uint8Array(await file.arrayBuffer()),receipt);}
    else if(mode==='text'){
      if(!$('artifact-text').value)throw Error('Paste text or code first.');
      result=await inspect(new TextEncoder().encode($('artifact-text').value),receipt);
    }else{
      const url=publicUrl($('artifact-url').value);
      if(url.hostname==='github.com'){
        const repo=await githubRepository(url.href);result=await verifyReceipt(repo.receipt,repo.files,$('trust-key').value.trim()||undefined);result.revision=repo.revision;
      }else result=await inspect(await fetchBytes(url.href),receipt);
    }
    show(result);
  }catch(e){show({status:'error',message:e.message==='Failed to fetch'?'This URL could not be read. It may block browser access (CORS), be offline, or require authentication. Download the original and use File or image.':e.message});}
  finally{button.disabled=false;button.innerHTML='Inspect artifact <span aria-hidden="true">↗</span>';}
});
$('demo-button').addEventListener('click',async()=>{
  try{
    const [sample,receipt]=await Promise.all([fetch('./sample.txt').then(r=>r.text()),fetch('./sample.autopilot.json').then(r=>r.json())]);
    activate($('tab-text'));$('artifact-text').value=sample;$('receipt-json').value=JSON.stringify(receipt,null,2);$('trust-key').value='';$('receipt').value='';
    show(await inspect(new TextEncoder().encode(sample),receipt));
  }catch(e){show({status:'error',message:e.message});}
});
$('copy-prompt').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('install-prompt').textContent);$('copy-prompt').textContent='Copied';}catch{$('copy-prompt').textContent='Select and copy the setup text above';}});
