import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
buildSync({entryPoints:['counter/worker.ts'],outfile:'counter/.wrangler/auth-test/worker.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
const {privateKey,publicKey}=await generateKeyPair('RS256');
const jwk={...await exportJWK(publicKey),kid:'test-key',alg:'RS256',use:'sig'};
const mf=new Miniflare({modules:true,scriptPath:'counter/.wrangler/auth-test/worker.js',compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{ALLOWED_ORIGIN:'https://shishiba389.github.io',GOOGLE_CLIENT_ID:'test-audience',ADMIN_GOOGLE_EMAIL:'owner@gmail.com'},ratelimits:{ACCOUNT_RATE_LIMITER:{simple:{limit:1000,period:60}},SPIN_RATE_LIMITER:{simple:{limit:1000,period:60}}},outboundService:async(request)=>{
 assert.equal(new URL(request.url).hostname,'www.googleapis.com');return Response.json({keys:[jwk]},{headers:{'Cache-Control':'public,max-age=3600'}});
}});
try{
 const db=await mf.getD1Database('DB');
 await db.prepare('CREATE TABLE totals(id INTEGER PRIMARY KEY,spins INTEGER)').run();await db.prepare('INSERT INTO totals VALUES(1,123)').run();
 await db.exec((await readFile('counter/migrations/0002_profiles.sql','utf8')).replace(/\n/g,' '));
 // Seed the shared cache without Origin, then verify browser CORS still works.
 const publicCount=await mf.dispatchFetch('https://api.example/spins');
 assert.equal((await publicCount.json()).count,123);
 const browserCount=await mf.dispatchFetch('https://api.example/spins',{headers:{Origin:'https://shishiba389.github.io'}});
 assert.equal(browserCount.headers.get('Access-Control-Allow-Origin'),'https://shishiba389.github.io');
 assert.equal((await browserCount.json()).count,123);
 assert.equal((await mf.dispatchFetch('https://api.example/spins',{headers:{Origin:'https://evil.example'}})).status,403);
 const token=async(sub,extra={},aud='test-audience',expires='1h')=>new SignJWT(extra).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject(sub).setAudience(aud).setIssuer('https://accounts.google.com').setIssuedAt().setExpirationTime(expires).sign(privateKey);
 const a=await token('alice'),b=await token('bob'),admin=await token('owner',{email:'owner@gmail.com',email_verified:true});
 const call=(path,token,method='GET',body)=>mf.dispatchFetch('https://api.example'+path,{method,headers:{Origin:'https://shishiba389.github.io',...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal((await call('/profile')).status,401);
 assert.equal((await call('/profile',await token('alice',{},'wrong'))).status,401);
 assert.equal((await call('/profile',await token('alice',{},'test-audience','-1h'))).status,401);
 assert.equal((await call('/profile',a.slice(0,-12)+'tampered')).status,401);
 assert.equal((await call('/admin/summary',a)).status,403);
 assert.equal((await call('/admin/summary',await token('fake',{email:'owner@gmail.com',email_verified:false}))).status,403);
 const initial=await (await call('/profile',a)).json();assert.equal(initial.profile.revision,0);assert.equal(initial.admin,false);
 const profile={disabled:[0],custom:[{id:crypto.randomUUID(),name:'Món riêng',price:55,veg:true}],revision:0};
 const saved=await (await call('/profile',a,'PUT',profile)).json();assert.equal(saved.profile.revision,1);
 assert.equal((await call('/profile',a,'PUT',profile)).status,409);
 assert.deepEqual((await (await call('/profile',b)).json()).profile.custom,[]);
 assert.equal((await call('/profile',a,'PUT',{...saved.profile,custom:[{...profile.custom[0],price:-1}]})).status,400);
 assert.equal((await call('/profile',a,'PUT',{...saved.profile,user_sub:'bob'})).status,400);
 assert.equal((await call('/profile',a,'PUT',{...saved.profile,custom:Array(51).fill(profile.custom[0])})).status,400);
 const summary=await (await call('/admin/summary',admin)).json();assert.equal(summary.profiles,1);assert.equal(summary.count,123);assert.equal(summary.customFoods,1);
 const cors=await mf.dispatchFetch('https://api.example/profile',{method:'OPTIONS',headers:{Origin:'https://shishiba389.github.io'}});assert.equal(cors.status,204);assert.match(cors.headers.get('Access-Control-Allow-Headers'),/Authorization/);
 assert.equal((await mf.dispatchFetch('https://api.example/profile',{headers:{Origin:'https://evil.example'}})).status,403);
 await call('/profile',a,'DELETE');assert.equal((await (await call('/profile',a)).json()).profile.revision,0);
 assert.equal((await (await call('/admin/summary',admin)).json()).profiles,0);
 console.log('PASS: real signed JWT validation, wrong audience/expiry/signature, admin authorization, per-user isolation, CAS conflicts, validation, delete, CORS, D1 summary.');
}finally{await mf.dispose()}
