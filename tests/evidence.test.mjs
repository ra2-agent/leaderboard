import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { normalize, parseReport } from '../evidence/2026-s0-initial/normalize.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'evidence/2026-s0-initial');
const read = name => fs.readFileSync(path.join(directory, name));
const json = name => JSON.parse(read(name));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = json('manifest.json');

test('public evidence files retain every recorded SHA-256 including raw and compressed traces', () => {
  for (const [file, expected] of Object.entries(manifest.files)) assert.equal(sha256(read(file)), expected, file);
  assert.equal(sha256(read('report.json.gz')), manifest.compressed_report_sha256);
  assert.equal(sha256(gunzipSync(read('report.json.gz'))), manifest.raw_report_sha256);
});
test('frozen scenario and rule fingerprints resolve to actual stored source bytes', () => {
  const pool = json('scenario-pool.json');
  for (const [file, expected] of Object.entries(pool.files)) assert.equal(sha256(read(file)), expected, file);
  const parts = pool.rules_bundle.order.map(read);
  assert.deepEqual(parts.map(bytes => bytes.length), pool.rules_bundle.lengths);
  assert.equal(sha256(Buffer.concat(parts)), manifest.rules_sha256);
  assert.equal(sha256(read('scenario-pool.json')), manifest.scenario_pool_sha256);
});
test('all 360 mirrored ledger entries regenerate exactly from the public replay archive', () => {
  const season = JSON.parse(fs.readFileSync(path.join(root, 'data/season.json'), 'utf8'));
  const batch = JSON.parse(fs.readFileSync(path.join(root, 'data/matches/000001-initial-round-robin.json'), 'utf8'));
  assert.equal(batch.pairs[0].evidence.sha256, manifest.compressed_report_sha256);
  assert(batch.pairs.every(pair => pair.evidence.url === batch.pairs[0].evidence.url));
  const report = parseReport(gunzipSync(read('report.json.gz')).toString('utf8'));
  assert.deepEqual(normalize(report, season, json('roster-mapping.json'), batch.pairs[0].evidence, manifest.played_at), batch);
  assert.equal(report.matches.length, 720);
  assert.equal(batch.pairs.length, 360);
});
