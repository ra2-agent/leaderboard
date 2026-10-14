import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const [engineArg, registryArg, buildArg] = process.argv.slice(2);
assert(engineArg && registryArg && buildArg, 'Usage: node prepare-runner.mjs <engine checkout> <agents checkout> <build directory>');
const engine = path.resolve(engineArg), registry = path.resolve(registryArg), build = path.resolve(buildArg);
const git = (...args) => execFileSync('git', args, { cwd: engine, encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', 'HEAD'), '189a5e2b3d7e8afaaf5d1a868cb9f15d0464f938');
assert.equal(git('status', '--porcelain'), '', 'Engine must be clean');
fs.mkdirSync(path.join(build, 'src'), { recursive: true });
fs.copyFileSync(fileURLToPath(new URL('./runner.rs', import.meta.url)), path.join(build, 'src/main.rs'));
// Pin all dependency versions to the engine lockfile before adding this runner.
const recordedLock = fileURLToPath(new URL('./runner-Cargo.lock', import.meta.url));
fs.copyFileSync(fs.existsSync(recordedLock) ? recordedLock : path.join(engine, 'Cargo.lock'), path.join(build, 'Cargo.lock'));
const tomlPath = (value) => JSON.stringify(value.replaceAll('\\', '/'));
fs.writeFileSync(path.join(build, 'Cargo.toml'), `[package]\nname = "season-runner"\nversion = "0.1.0"\nedition = "2024"\npublish = false\n\n[dependencies]\nra-arena = { path = ${tomlPath(path.join(engine, 'projects/tooling/ra-arena'))} }\nra-engine = { path = ${tomlPath(path.join(engine, 'projects/engine/ra-engine'))} }\nserde_json = "1"\n\n[profile.release]\nopt-level = 3\ncodegen-units = 1\nlto = true\nstrip = "symbols"\npanic = "abort"\n\n[profile.arena]\ninherits = "release"\ncodegen-units = 16\nlto = false\nincremental = true\n`);
fs.mkdirSync(path.join(build, '.cargo'), { recursive: true });
fs.writeFileSync(path.join(build, '.cargo/config.toml'), `[env]\nAGENT_REGISTRY_DIR = ${tomlPath(registry)}\nRA_ENGINE_DIR = ${tomlPath(engine)}\n`);
console.log(`Prepared runner in ${build}; build from this directory with the pinned engine Rust toolchain.`);
