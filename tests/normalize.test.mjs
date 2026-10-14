import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, parseReport } from '../evidence/2026-s0-initial/normalize.mjs';
import { update } from '../scripts/rating-engine.mjs';

const rating = { initial: 1500, k: 32, scale: 400, provisional_games: 20 };
function fixture(scores = ['win', 'loss']) {
  const season = { schema_version: '1.0', season: '2026-s0', status: 'open', protocol: 'ra-arena-full-info-v1', engine: { repository: 'https://github.com/ra2-agent/rust-ra2', commit: 'b'.repeat(40) }, rules_sha256: 'c'.repeat(64), scenario_pool_sha256: 'd'.repeat(64), scenarios: ['duel-v1'], max_ticks: 3000, max_commands_per_tick: 64, rating, maintainers: ['kexinoh'], roster: ['alpha@1.0.0', 'beta@1.0.0'].map(key => ({ key, registry_commit: 'e'.repeat(40), checksums_sha256: 'f'.repeat(64) })) };
  const mapping = { alpha: 'alpha@1.0.0', beta: 'beta@1.0.0' };
  const score = s => s === 'win' ? 1 : s === 'draw' ? 0.5 : 0;
  const actual = (score(scores[0]) + 1 - score(scores[1])) / 2;
  const elos = update(1500, 1500, actual, rating);
  const aWins = Number(scores[0] === 'win') + Number(scores[1] === 'loss');
  const draws = scores.filter(s => s === 'draw').length, aLosses = 2 - aWins - draws;
  const rows = [{ npc: 'alpha', elo: elos[0], wins: aWins, draws, losses: aLosses }, { npc: 'beta', elo: elos[1], wins: aLosses, draws, losses: aWins }];
  const matches = scores.map((score, i) => ({ protocol: season.protocol, rules_hash: 'fixture', score, termination: score === 'draw' ? 'tick_limit' : 'elimination', ticks: score === 'draw' ? 3000 : 1, final_hash: '0'.repeat(16), frames: Array(score === 'draw' ? 3000 : 1).fill({}), spec: { seats: i ? ['beta', 'alpha'] : ['alpha', 'beta'], seed: '18446744073709551615', scenario: 'duel-v1', max_ticks: 3000, max_commands_per_tick: 64, trace: true } }));
  const report = { protocol: season.protocol, source_revision: season.engine.commit, source_dirty: false, rules_hash: 'fixture', config: { npcs: ['alpha', 'beta'], scenarios: ['duel-v1'], rounds: 1, trace: true, summary_only: false, max_ticks: 3000, max_commands_per_tick: 64, elo: rating }, matches, leaderboard: rows, by_scenario: { 'duel-v1': rows } };
  const evidence = { url: 'https://example.org/report.json.gz', sha256: 'a'.repeat(64) };
  return { report, season, mapping, evidence };
}
const convert = f => normalize(f.report, f.season, f.mapping, f.evidence, '2026-10-15T00:00:00+08:00');

test('raw numeric u64 seeds survive parsing exactly', () => {
  const report = parseReport('{"config":{"seed":42},"matches":[{"spec":{"seed":18446744073709551615}},{"spec":{"seed":9007199254740993}}]}');
  assert.equal(report.matches[0].spec.seed, '18446744073709551615');
  assert.equal(report.matches[1].spec.seed, '9007199254740993');
});
test('winner follows Agent identity after seats exchange', () => {
  for (const scores of [['win', 'loss'], ['loss', 'win'], ['win', 'win'], ['draw', 'draw']]) {
    const games = convert(fixture(scores)).pairs[0].games;
    assert.deepEqual(games.map(g => g.a_seat), ['left', 'right']);
    const expected = scores.map((s, i) => s === 'draw' ? 'draw' : (s === 'win') === (i === 0) ? 'a' : 'b');
    assert.deepEqual(games.map(g => g.winner), expected);
  }
});
test('incomplete, mismatched or unmirrored games cannot enter the ledger', () => {
  for (const mutate of [f => f.report.matches.pop(), f => f.report.matches[1].spec.seed = '1', f => f.report.matches[1].spec.seats.reverse(), f => f.report.matches[1].spec.max_ticks = 1000]) {
    const f = fixture(); mutate(f); assert.throws(() => convert(f));
  }
});
test('dirty source and missing replay evidence are rejected', () => {
  for (const mutate of [f => f.report.source_dirty = true, f => f.report.matches[0].frames = [], f => f.report.config.trace = false]) {
    const f = fixture(); mutate(f); assert.throws(() => convert(f));
  }
});
test('tampered Arena standings cannot mask incorrect normalized outcomes', () => {
  const f = fixture(); f.report.leaderboard[0].elo += 1; assert.throws(() => convert(f));
});
