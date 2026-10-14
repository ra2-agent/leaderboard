import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { calculate } from './rating-engine.mjs';
import { readJson, requireThat as ok } from './validation.mjs';
const home=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function table(rows){if(!rows.length)return '尚无有效比赛。\n';return '| 排名 | Agent | Elo | 局数 | 胜 | 和 | 负 | 得分率 | 状态 |\n|---|---|---:|---:|---:|---:|---:|---:|---|\n'+rows.map(r=>'| '+[r.rank,r.key,r.elo.toFixed(2),r.games,r.wins,r.draws,r.losses,(r.score_rate*100).toFixed(1)+'%',r.provisional?'暂定':'已达20局'].join(' | ')+' |').join('\n')+'\n';}
export function output(root){
  const config=readJson(path.join(root,'data/season.json')),dir=path.join(root,'data/matches');
  const entries=fs.readdirSync(dir,{withFileTypes:true});
  ok(entries.every(e=>e.name==='.gitkeep'||(e.isFile()&&!e.isSymbolicLink()&&/^[0-9]{6}-[a-z0-9-]+\.json$/.test(e.name))),'unexpected match file or directory');
  const batches=entries.filter(e=>e.name.endsWith('.json')).map(e=>{const b=readJson(path.join(dir,e.name));ok(e.name.startsWith(String(b.sequence).padStart(6,'0')+'-'),'filename and batch sequence differ');return b;});
  const result=calculate(config,batches);
  const md='# 红色警戒 NPC Elo\n\n赛季：'+result.season+'；状态：'+result.status+'；有效双局：'+result.pairs+'；单局：'+result.games+'。\n\n初始1500，K=32，每个镜像双局更新一次；小于20单局标记暂定。此榜仅用于相同引擎、协议与规则的赛季。\n\n'+table(result.leaderboard)+'\n'+Object.entries(result.by_scenario).map(([name,rows])=>'## '+name+'\n\n'+table(rows)).join('\n')+'\n由原始战绩确定性生成；没有比赛时不显示虚构排名。\n';
  return {'leaderboard.json':JSON.stringify(result,null,2)+'\n','leaderboard.md':md};
}
export function checkOutput(root){for(const [name,content]of Object.entries(output(root)))assert.equal(fs.readFileSync(path.join(root,'generated',name),'utf8'),content,'generated/'+name+' is stale; run node scripts/leaderboard.mjs --write');}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=home;
  if(process.argv.includes('--write')){fs.mkdirSync(path.join(root,'generated'),{recursive:true});for(const [name,content]of Object.entries(output(root)))fs.writeFileSync(path.join(root,'generated',name),content);console.log('Rebuilt Elo from recorded matches; no Agent executed.');}
  else{checkOutput(root);console.log('Generated standings match source records.');}
}
