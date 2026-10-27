import test from 'node:test';
import assert from 'node:assert/strict';
import {publicUrl,fetchBytes} from '../web/remote.mjs';
test('remote mode rejects insecure, local, credentialed or malformed URLs',()=>{for(const u of ['http://example.com','https://localhost/x','https://127.0.0.1/x','https://u:p@example.com','file:///x','bad'])assert.throws(()=>publicUrl(u));assert.equal(publicUrl('https://example.com/x').hostname,'example.com');});
test('bounded fetch rejects non-success and declared oversized responses',async()=>{await assert.rejects(fetchBytes('https://example.com',10,async()=>new Response('bad',{status:403})),/rate limited/);await assert.rejects(fetchBytes('https://example.com',2,async()=>new Response('abcd',{headers:{'content-length':'4'}})),/size limit/);});
test('bounded fetch rejects oversized streaming responses',async()=>{await assert.rejects(fetchBytes('https://example.com',2,async()=>new Response('abcd')),/size limit/);});
test('bounded fetch returns exact bytes',async()=>{const r=await fetchBytes('https://example.com',10,async()=>new Response('abc'));assert.equal(new TextDecoder().decode(r),'abc');});
test('URL requests refuse local hostnames and do not follow redirects',async()=>{for(const u of ['https://intranet/x','https://server.home.arpa/x'])assert.throws(()=>publicUrl(u));await fetchBytes('https://example.com',10,async(_url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');return new Response('ok');});});
