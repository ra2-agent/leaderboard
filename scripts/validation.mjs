import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

export function requireThat(test, message) { if (!test) throw new Error(message); }
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
export function keys(value, expected, label) {
  requireThat(value && typeof value === 'object' && !Array.isArray(value), label + ': expected object');
  requireThat(Object.keys(value).sort().join('|') === [...expected].sort().join('|'), label + ': unexpected or missing fields');
}
export function text(value, min, max) { return typeof value === 'string' && value.length >= min && value.length <= max; }
export const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) && !/^0+$/.test(value);
export const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) && !/^0+$/.test(value);
export const agentKey = value => typeof value === 'string' && /^[a-z][a-z0-9-]{2,47}@(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(value);
export function manifest(value) {
  keys(value, ['schema_version','id','version','display_name','description','authors','license','source_repository','protocol','runtime','entrypoint','deterministic','capabilities','resources'], 'manifest');
  requireThat(value.schema_version === '1.0' && agentKey(value.id + '@' + value.version), 'manifest: invalid schema, ID or version');
  requireThat(text(value.display_name,1,80) && text(value.description,1,1000), 'manifest: name or description');
  requireThat(Array.isArray(value.authors) && value.authors.length > 0 && new Set(value.authors).size === value.authors.length && value.authors.every(a=>typeof a === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(a)), 'manifest: authors');
  requireThat(['Apache-2.0','MIT','BSD-3-Clause'].includes(value.license), 'manifest: license');
  requireThat(typeof value.source_repository === 'string' && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.source_repository), 'manifest: source repository');
  requireThat(value.protocol === 'ra-arena-full-info-v1' && value.runtime === 'rust-inprocess' && value.entrypoint === 'src/lib.rs' && value.deterministic === true, 'manifest: unsupported interface');
  keys(value.capabilities, ['network','filesystem','subprocess'], 'capabilities');
  requireThat(Object.values(value.capabilities).every(v=>v===false), 'manifest: unsupported capabilities');
  keys(value.resources, ['expected_memory_mb','notes'], 'resources');
  requireThat(Number.isInteger(value.resources.expected_memory_mb) && value.resources.expected_memory_mb > 0 && value.resources.expected_memory_mb <= 65536 && text(value.resources.notes,1,1000), 'manifest: resource declaration');
  return value;
}
export function files(root) {
  const output=[];
  function visit(dir, prefix) {
    for (const item of fs.readdirSync(dir,{withFileTypes:true})) {
      if (item.name === '.git') continue;
      requireThat(!item.isSymbolicLink(), 'symlinks forbidden: ' + prefix + item.name);
      const rel=prefix+item.name;
      if(item.isDirectory()) visit(path.join(dir,item.name),rel+'/');
      else { requireThat(item.isFile(),'special file forbidden: '+rel); output.push(rel); }
    }
  }
  requireThat(!fs.lstatSync(root).isSymbolicLink(),'symlink root forbidden');
  visit(root,''); return output.sort();
}
export function payload(directory) {
  const list=files(directory); let total=0;
  for (const file of list) {
    requireThat(file.split('/').every(v=>/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(v)) && (file==='LICENSE' || /\.(rs|toml|lock|md|txt|json)$/.test(file)) && !file.split('/').includes('build.rs'), 'unsupported payload: ' + file);
    const bytes=fs.readFileSync(path.join(directory,file)); total+=bytes.length;
    requireThat(bytes.length<=2*1024*1024 && !bytes.includes(0) && Buffer.from(bytes.toString('utf8')).equals(bytes), 'invalid or oversized text: '+file);
  }
  requireThat(total<=20*1024*1024,'release exceeds 20 MiB');
  for (const expected of ['agent.json','README.md','LICENSE','src/lib.rs']) requireThat(list.includes(expected),'missing '+expected);
  manifest(readJson(path.join(directory,'agent.json')));
  return Object.fromEntries(list.filter(n=>n!=='checksums.json').map(n=>[n,sha256(fs.readFileSync(path.join(directory,n)))]));
}
export function release(directory) {
  const expected=payload(directory), actual=readJson(path.join(directory,'checksums.json'));
  requireThat(actual && typeof actual === 'object' && !Array.isArray(actual),'invalid checksums');
  assert.deepEqual(actual,expected,'checksums must cover exactly every payload file');
  return manifest(readJson(path.join(directory,'agent.json')));
}
export function registry(root) {
  const dir=path.join(root,'agents'); let count=0;
  requireThat(fs.existsSync(dir),'missing agents/');
  for (const item of fs.readdirSync(dir,{withFileTypes:true})) {
    if(item.name === '.gitkeep') continue;
    requireThat(item.isDirectory() && !item.isSymbolicLink() && /^[a-z][a-z0-9-]{2,47}$/.test(item.name),'invalid Agent directory');
    const versions=fs.readdirSync(path.join(dir,item.name),{withFileTypes:true});
    requireThat(versions.length>0,'empty Agent directory');
    for (const version of versions) {
      requireThat(version.isDirectory() && !version.isSymbolicLink() && agentKey(item.name+'@'+version.name),'invalid version directory');
      const data=release(path.join(dir,item.name,version.name));
      requireThat(data.id===item.name && data.version===version.name,'directory and manifest identity differ'); count++;
    }
  }
  return count;
}
export function unchanged(base, head, prefix) {
  if (!fs.existsSync(path.join(base,prefix))) return;
  for (const file of files(path.join(base,prefix))) {
    if(file==='.gitkeep')continue;
    const next=path.join(head,prefix,file), previous=path.join(base,prefix,file);
    requireThat(fs.existsSync(next) && fs.lstatSync(next).isFile() && sha256(fs.readFileSync(previous))===sha256(fs.readFileSync(next)), 'historical release changed: '+prefix+'/'+file);
  }
}
export function policy(base, head, mode) {
  if(path.resolve(base)===path.resolve(head))return;
  if(mode==='agents')unchanged(base,head,'agents');
  const author=process.env.PR_AUTHOR;
  if(!author || author==='kexinoh')return;
  const protectedPaths=['.github/','scripts/','schemas/','package.json','package-lock.json'];
  if(mode==='leaderboard')protectedPaths.push('data/','generated/','tests/');
  const protectedFile=file=>protectedPaths.some(p=>p.endsWith('/')?file.startsWith(p):file===p);
  const left=files(base).filter(protectedFile), right=files(head).filter(protectedFile);
  assert.deepEqual(left,right,'protected files may only be changed by a maintainer');
  for(const file of left)requireThat(sha256(fs.readFileSync(path.join(base,file)))===sha256(fs.readFileSync(path.join(head,file))), 'maintainer-only path: '+file);
}
