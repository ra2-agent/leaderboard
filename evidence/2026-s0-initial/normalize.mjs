import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { calculate } from '../../scripts/rating-engine.mjs';

export function parseReport(text) {
  // Every raw Arena seed is a u64 JSON number. Quote it before JSON.parse can round it.
  return JSON.parse(text.replace(/("seed"\s*:\s*)(\d+)(?=\s*[,}])/g, '$1"$2"'));
}

export function normalize(report, season, mapping, evidence, playedAt) {
  assert.equal(report.protocol, season.protocol);
  assert.equal(report.source_revision, season.engine.commit);
  assert.equal(report.source_dirty, false);
  assert.equal(report.config.trace, true);
  assert.equal(report.config.summary_only, false);
  assert.deepEqual(report.config.scenarios, season.scenarios);
  assert.deepEqual(report.config.elo, season.rating);
  assert.deepEqual(report.config.npcs.map(id => mapping[id]), season.roster.map(row => row.key));
  for (const key of ['max_ticks', 'max_commands_per_tick']) assert.equal(report.config[key], season[key]);
  const expected = report.config.npcs.length * (report.config.npcs.length - 1) * report.config.scenarios.length * report.config.rounds;
  assert.equal(report.matches.length, expected, 'Incomplete tournament');
  const pairs = [], scenarioHashes = new Map();
  for (let i = 0; i < report.matches.length; i += 2) {
    const first = report.matches[i], second = report.matches[i + 1];
    assert.deepEqual(second.spec.seats, [...first.spec.seats].reverse());
    assert.equal(first.spec.seed, second.spec.seed);
    assert.equal(first.spec.scenario, second.spec.scenario);
    const games = [first, second].map((game, j) => {
      assert.equal(game.protocol, season.protocol);
      if (!scenarioHashes.has(game.spec.scenario)) scenarioHashes.set(game.spec.scenario, game.rules_hash);
      assert.equal(game.rules_hash, scenarioHashes.get(game.spec.scenario), 'Scenario rule hash changed within the tournament');
      assert.equal(game.spec.max_ticks, season.max_ticks);
      assert.equal(game.spec.max_commands_per_tick, season.max_commands_per_tick);
      assert.equal(game.spec.trace, true);
      assert.equal(game.frames.length, game.ticks, 'Missing replay frames');
      assert.equal(typeof game.spec.seed, 'string', 'Seed was not parsed losslessly');
      assert(['win', 'draw', 'loss'].includes(game.score));
      const winner = game.score === 'draw' ? 'draw' : (game.score === 'win') === (j === 0) ? 'a' : 'b';
      return { seed: game.spec.seed, a_seat: j === 0 ? 'left' : 'right', winner, reason: game.termination, ticks: game.ticks, final_hash: game.final_hash };
    });
    pairs.push({ id: `s0-initial-${String(i / 2 + 1).padStart(4, '0')}`, scenario: first.spec.scenario, agents: first.spec.seats.map(id => mapping[id]), games, evidence });
  }
  const batch = {
    schema_version: '1.0', sequence: 1, season: season.season, submitted_by: 'kexinoh', played_at: playedAt,
    environment: { engine_commit: season.engine.commit, engine_dirty: false, protocol: season.protocol, rules_sha256: season.rules_sha256, scenario_pool_sha256: season.scenario_pool_sha256, max_ticks: season.max_ticks, max_commands_per_tick: season.max_commands_per_tick },
    pairs,
  };
  // Recompute from outcomes, then cross-check with Arena; never copy its Elo into the ledger.
  const result = calculate(season, [batch]);
  for (const [ratings, arena] of [[result.leaderboard, report.leaderboard], ...Object.entries(result.by_scenario).map(([scene, rows]) => [rows, report.by_scenario[scene]])]) {
    for (const row of ratings) {
      const original = arena.find(r => mapping[r.npc] === row.key);
      assert(original, `Missing Arena rating for ${row.key}`);
      assert(Math.abs(row.elo - original.elo) < 0.000001, 'Elo differs from match outcomes');
      for (const key of ['wins', 'draws', 'losses']) assert.equal(row[key], original[key]);
    }
  }
  return batch;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [evidenceCommit] = process.argv.slice(2);
  assert.match(evidenceCommit ?? '', /^[a-f0-9]{40}$/);
  const directory = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(directory, '../..');
  const bytes = fs.readFileSync(path.join(directory, 'report.json.gz'));
  const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
  const season = JSON.parse(fs.readFileSync(path.join(root, 'data/season.json'), 'utf8'));
  const evidence = { url: `https://raw.githubusercontent.com/ra2-agent/leaderboard/${evidenceCommit}/evidence/2026-s0-initial/report.json.gz`, sha256: createHash('sha256').update(bytes).digest('hex') };
  const batch = normalize(parseReport(gunzipSync(bytes).toString('utf8')), season, read('roster-mapping.json'), evidence, read('manifest.json').played_at);
  fs.writeFileSync(path.join(root, 'data/matches/000001-initial-round-robin.json'), `${JSON.stringify(batch, null, 2)}\n`);
  console.log(`Normalized ${batch.pairs.length} mirrored pairs with lossless u64 seeds`);
}
