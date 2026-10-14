import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { manifest, payload, release, registry, unchanged, sha256, policy } from '../scripts/validation.mjs';
const example={"schema_version":"1.0","id":"starter-idle","version":"0.1.0","display_name":"Starter Idle","description":"不主动发出命令的接口示例，用于开发起步，不是正式参赛者。","authors":["kexinoh"],"license":"Apache-2.0","source_repository":"https://github.com/ra2-agent/agent-template","protocol":"ra-arena-full-info-v1","runtime":"rust-inprocess","entrypoint":"src/lib.rs","deterministic":true,"capabilities":{"network":false,"filesystem":false,"subprocess":false},"resources":{"expected_memory_mb":256,"notes":"引擎内运行；内存声明是参考，v1 没有可靠的逐 Agent CPU/内存计量。"}};
test('valid manifest and invalid capability/unknown keys/identity',()=>{
  assert.equal(manifest(structuredClone(example)).id,'starter-idle');
  for(const mutate of [m=>m.capabilities.network=true,m=>m.extra=true,m=>m.id='../escape',m=>m.version='01.0.0',m=>m.authors=[]]){
    const m=structuredClone(example);mutate(m);assert.throws(()=>manifest(m));
  }
});
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'ra2-agent-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'agent.json'),JSON.stringify(example));fs.writeFileSync(path.join(root,'src/lib.rs'),'// source');fs.writeFileSync(path.join(root,'README.md'),'readme');fs.writeFileSync(path.join(root,'LICENSE'),'license');return root;}
test('complete checksums detect corruption, omission and unexpected files',t=>{
  const dir=fixture(t);fs.writeFileSync(path.join(dir,'checksums.json'),JSON.stringify(payload(dir)));release(dir);
  fs.writeFileSync(path.join(dir,'src/lib.rs'),'// changed');assert.throws(()=>release(dir));
  fs.writeFileSync(path.join(dir,'checksums.json'),JSON.stringify(payload(dir)));release(dir);
  fs.writeFileSync(path.join(dir,'extra.txt'),'extra');assert.throws(()=>release(dir));
});
test('binary files, build scripts and hidden configuration are rejected',t=>{
  for(const [file,data] of [['build.rs','fn main() {}'],['binary.rs',Buffer.from([0])],['.cargo/config.toml','[build]']]){
    const dir=fixture(t);fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.writeFileSync(path.join(dir,file),data);assert.throws(()=>payload(dir));
  }
});
test('symbolic payload links are rejected',t=>{const dir=fixture(t);try{fs.symlinkSync(path.join(dir,'README.md'),path.join(dir,'link.md'));}catch(e){if(e.code==='EPERM'){t.skip('symlink permission unavailable');return;}throw e;}assert.throws(()=>payload(dir));});
test('historical versions cannot be changed or deleted',t=>{const base=fixture(t),head=fixture(t);unchanged(base,head,'src');fs.writeFileSync(path.join(head,'src/lib.rs'),'changed');assert.throws(()=>unchanged(base,head,'src'));});
test('external authors cannot edit trusted validators',t=>{
  const base=fixture(t),head=fixture(t);for(const r of [base,head]){fs.mkdirSync(path.join(r,'scripts'));fs.writeFileSync(path.join(r,'scripts/check.mjs'),'trusted');}
  fs.writeFileSync(path.join(head,'scripts/check.mjs'),'untrusted');const old=process.env.PR_AUTHOR;process.env.PR_AUTHOR='community-member';try{assert.throws(()=>policy(base,head,'agent-template'));}finally{if(old===undefined)delete process.env.PR_AUTHOR;else process.env.PR_AUTHOR=old;}
});
