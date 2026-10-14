import { requireThat as ok, keys, text, hash, commit, agentKey } from './validation.mjs';

export function configuration(c) {
  keys(c,['schema_version','season','status','protocol','engine','rules_sha256','scenario_pool_sha256','scenarios','max_ticks','max_commands_per_tick','rating','maintainers','roster'],'season');
  ok(c.schema_version==='1.0' && text(c.season,1,80) && /^[a-z0-9-]+$/.test(c.season),'invalid season');
  ok(['setup','open','closed'].includes(c.status) && c.protocol==='ra-arena-full-info-v1','invalid season status/protocol');
  keys(c.engine,['repository','commit'],'engine');
  ok(c.engine.repository==='https://github.com/rust-alert/ra2.exe','unsupported engine repository');
  ok(Array.isArray(c.scenarios) && c.scenarios.length>0 && new Set(c.scenarios).size===c.scenarios.length && c.scenarios.every(s=>['duel-v1','economy-v1','skirmish-v1'].includes(s)),'invalid scenarios');
  for(const n of [c.max_ticks,c.max_commands_per_tick])ok(Number.isSafeInteger(n)&&n>0,'invalid budget');
  keys(c.rating,['initial','k','scale','provisional_games'],'rating');
  ok(c.rating.initial===1500 && c.rating.k===32 && c.rating.scale===400 && c.rating.provisional_games===20,'unsupported Elo v1 parameters');
  ok(Array.isArray(c.maintainers) && c.maintainers.length===1 && c.maintainers[0]==='kexinoh','maintainer changes require protocol review');
  ok(Array.isArray(c.roster),'invalid roster');
  const roster=new Set();
  for(const row of c.roster) {
    keys(row,['key','registry_commit','checksums_sha256'],'roster entry');
    ok(agentKey(row.key)&&commit(row.registry_commit)&&hash(row.checksums_sha256)&&!roster.has(row.key),'invalid/duplicate roster entry');roster.add(row.key);
  }
  if(c.status==='setup')ok(c.engine.commit===null && c.rules_sha256===null && c.scenario_pool_sha256===null,'setup fingerprints must be null');
  else ok(commit(c.engine.commit)&&hash(c.rules_sha256)&&hash(c.scenario_pool_sha256),'season requires frozen source and content hashes');
  return roster;
}
export function update(a,b,score,c) {
  const expected=1/(1+10**((b-a)/c.scale)); const delta=c.k*(score-expected);
  return [a+delta,b-delta];
}
function entry(key,initial) { return {key,elo:initial,games:0,wins:0,draws:0,losses:0}; }
function score(winner) { return winner==='a'?1:winner==='draw'?0.5:0; }
function record(table, a, b, games, rating) {
  if(!table.has(a))table.set(a,entry(a,rating.initial)); if(!table.has(b))table.set(b,entry(b,rating.initial));
  const one=table.get(a),two=table.get(b);
  [one.elo,two.elo]=update(one.elo,two.elo,games.reduce((n,g)=>n+score(g.winner),0)/2,rating);
  for(const g of games) { one.games++;two.games++;if(g.winner==='draw'){one.draws++;two.draws++;}else if(g.winner==='a'){one.wins++;two.losses++;}else{one.losses++;two.wins++;} }
}
function rows(table,c) {
  return [...table.values()].sort((a,b)=>b.elo-a.elo || (a.key<b.key?-1:a.key>b.key?1:0)).map((r,i)=>({...r,rank:i+1,elo:Number(r.elo.toFixed(6)),score_rate:(r.wins+r.draws/2)/r.games,provisional:r.games<c.provisional_games}));
}
export function calculate(c, batches) {
  const roster=configuration(c), ids=new Set(), signatures=new Set(), general=new Map(), scenes=new Map(c.scenarios.map(s=>[s,new Map()]));
  ok(Array.isArray(batches),'batches must be array');
  if(c.status==='setup')ok(batches.length===0,'setup season cannot contain matches');
  const sorted=[...batches].sort((a,b)=>a.sequence-b.sequence); let pairs=0;
  for(let i=0;i<sorted.length;i++) {
    const batch=sorted[i];
    keys(batch,['schema_version','sequence','season','submitted_by','played_at','environment','pairs'],'batch');
    ok(batch.schema_version==='1.0' && batch.sequence===i+1 && batch.season===c.season,'batch sequence must be contiguous from 1 and match season');
    ok(c.maintainers.includes(batch.submitted_by),'only a maintainer may attest results');
    ok(typeof batch.played_at==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(batch.played_at) && Number.isFinite(Date.parse(batch.played_at)),'played_at requires ISO timestamp with timezone');
    const env=batch.environment;
    keys(env,['engine_commit','engine_dirty','protocol','rules_sha256','scenario_pool_sha256','max_ticks','max_commands_per_tick'],'environment');
    ok(env.engine_dirty===false,'dirty engine cannot be ranked');
    for(const key of ['protocol','rules_sha256','scenario_pool_sha256','max_ticks','max_commands_per_tick'])ok(env[key]===c[key],'environment mismatch: '+key);
    ok(env.engine_commit===c.engine.commit,'engine commit mismatch');
    ok(Array.isArray(batch.pairs)&&batch.pairs.length>0,'empty batch');
    for(const pair of batch.pairs) {
      keys(pair,['id','scenario','agents','games','evidence'],'pair');
      ok(text(pair.id,1,100)&&/^[a-zA-Z0-9-]+$/.test(pair.id)&&!ids.has(pair.id),'invalid/duplicate pair ID');ids.add(pair.id);
      ok(c.scenarios.includes(pair.scenario),'scenario outside season');
      ok(Array.isArray(pair.agents)&&pair.agents.length===2&&pair.agents[0]!==pair.agents[1]&&pair.agents.every(a=>roster.has(a)),'unknown/self Agent pairing');
      ok(Array.isArray(pair.games)&&pair.games.length===2,'requires two mirrored games');
      keys(pair.evidence,['url','sha256'],'evidence');
      let url;try{url=new URL(pair.evidence.url);}catch{throw new Error('invalid evidence URL');}
      ok(url.protocol==='https:'&&!url.username&&!url.password&&hash(pair.evidence.sha256),'requires HTTPS evidence URL and SHA-256');
      for(let j=0;j<2;j++) {
        const g=pair.games[j];keys(g,['seed','a_seat','winner','reason','ticks','final_hash'],'game');
        ok(typeof g.seed==='string'&&/^(0|[1-9][0-9]*)$/.test(g.seed)&&g.seed.length<=20&&BigInt(g.seed)<=18446744073709551615n,'seed requires canonical u64 decimal string');
        ok(['left','right'].includes(g.a_seat)&&['a','b','draw'].includes(g.winner),'invalid side or winner');
        ok(['elimination','tick_limit','mutual_elimination'].includes(g.reason),'invalid termination');
        ok(Number.isSafeInteger(g.ticks)&&g.ticks>=1&&g.ticks<=c.max_ticks,'invalid ticks');
        ok(typeof g.final_hash==='string'&&/^[a-f0-9]{16,64}$/.test(g.final_hash),'invalid final state hash');
        if(g.reason==='elimination')ok(g.winner!=='draw','elimination must identify a winner');
        else ok(g.winner==='draw','timeout/mutual elimination must be draw');
        if(g.reason==='tick_limit')ok(g.ticks===c.max_ticks,'timeout must reach tick budget');
      }
      ok(pair.games[0].seed===pair.games[1].seed&&pair.games[0].a_seat!==pair.games[1].a_seat,'pair must share seed and swap sides');
      const sig=JSON.stringify([pair.scenario,pair.games[0].seed,[...pair.agents].sort()]);
      ok(!signatures.has(sig),'duplicate scenario/seed/agents');signatures.add(sig);
      record(general,...pair.agents,pair.games,c.rating);record(scenes.get(pair.scenario),...pair.agents,pair.games,c.rating);pairs++;
    }
  }
  return {schema_version:'1.0',season:c.season,status:c.status,batches:batches.length,pairs,games:pairs*2,leaderboard:rows(general,c.rating),by_scenario:Object.fromEntries([...scenes].map(([s,t])=>[s,rows(t,c.rating)]))};
}
