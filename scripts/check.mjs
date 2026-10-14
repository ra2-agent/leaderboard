import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { manifest, registry, policy, readJson, requireThat as ok } from './validation.mjs';
import { checkOutput } from './leaderboard.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(process.argv[2] || base);
policy(base,root,'leaderboard');
const schema=readJson(path.join(root,'schemas/agent.schema.json'));
ok(schema.$schema==='https://json-schema.org/draft/2020-12/schema','unsupported schema draft');



if(base!==root && fs.existsSync(path.join(base,'data/season.json'))) {
  const before=readJson(path.join(base,'data/season.json')), after=readJson(path.join(root,'data/season.json'));
  const hadMatches=fs.readdirSync(path.join(base,'data/matches')).some(n=>n.endsWith('.json'));
  if(hadMatches){
    const frozen=c=>Object.fromEntries(Object.entries(c).filter(([k])=>!['status','roster'].includes(k)));
    assert.deepEqual(frozen(after),frozen(before),'rated season environment is frozen; start a new season');
    for(const row of before.roster)assert.deepEqual(after.roster.find(r=>r.key===row.key),row,'existing roster identities are immutable');
    ok(after.status!=='setup','cannot reset a rated season to setup');
  }
}
checkOutput(root);
console.log('leaderboard: static checks passed (no Agent executed).');
