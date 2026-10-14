use std::{env, fs, io::BufWriter, process::Command};
use ra_arena::{ArenaConfig, BotRegistry, Report, replay_match, run_tournament};

mod starter_idle { include!(concat!(env!("AGENT_REGISTRY_DIR"), "/agents/starter-idle/0.1.0/src/lib.rs")); }
mod hard_baseline { include!(concat!(env!("AGENT_REGISTRY_DIR"), "/agents/hard-baseline-v1/1.0.0/src/lib.rs")); }
mod reference_v1 { include!(concat!(env!("AGENT_REGISTRY_DIR"), "/agents/reference-v1/1.0.0/src/lib.rs")); }
mod reference_v2 { include!(concat!(env!("AGENT_REGISTRY_DIR"), "/agents/reference-v2/1.0.0/src/lib.rs")); }
mod reference_v3 { include!(concat!(env!("AGENT_REGISTRY_DIR"), "/agents/reference-v3/1.0.0/src/lib.rs")); }
mod reference_v4 { include!(concat!(env!("AGENT_REGISTRY_DIR"), "/agents/reference-v4/1.0.0/src/lib.rs")); }
mod reference_v5 { include!(concat!(env!("AGENT_REGISTRY_DIR"), "/agents/reference-v5/1.0.0/src/lib.rs")); }
mod reference_v6 { include!(concat!(env!("AGENT_REGISTRY_DIR"), "/agents/reference-v6/1.0.0/src/lib.rs")); }
mod reference_v7 { include!(concat!(env!("AGENT_REGISTRY_DIR"), "/agents/reference-v7/1.0.0/src/lib.rs")); }
mod counter_retreat { include!(concat!(env!("AGENT_REGISTRY_DIR"), "/agents/counter-retreat-v1/1.0.0/src/lib.rs")); }

fn engine_revision() -> Result<String, Box<dyn std::error::Error>> {
    let engine = env::var("RA_ENGINE_DIR")?;
    let head = Command::new("git").args(["rev-parse", "HEAD"]).current_dir(&engine).output()?;
    let status = Command::new("git").args(["status", "--porcelain"]).current_dir(&engine).output()?;
    if !head.status.success() || !status.status.success() || !status.stdout.is_empty() {
        return Err("Engine checkout must be clean".into());
    }
    let revision = String::from_utf8(head.stdout)?.trim().to_owned();
    if revision != "189a5e2b3d7e8afaaf5d1a868cb9f15d0464f938" { return Err("Unexpected engine revision".into()); }
    Ok(revision)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let revision = engine_revision()?;
    match args.get(1).map(String::as_str) {
        Some("run") if args.len() == 4 => {
            let config: ArenaConfig = serde_json::from_slice(&fs::read(&args[2])?)?;
            let mut registry = BotRegistry::default();
            registry.register("starter-idle", || Box::new(starter_idle::StarterIdle))?;
            registry.register("hard-baseline-v1", || Box::new(hard_baseline::Agent))?;
            registry.register("reference-v1", || Box::new(reference_v1::Agent))?;
            registry.register("reference-v2", || Box::new(reference_v2::Agent))?;
            registry.register("reference-v3", || Box::new(reference_v3::Agent))?;
            registry.register("reference-v4", || Box::new(reference_v4::Agent))?;
            registry.register("reference-v5", || Box::new(reference_v5::Agent))?;
            registry.register("reference-v6", || Box::new(reference_v6::Agent))?;
            registry.register("reference-v7", || Box::new(reference_v7::Agent))?;
            registry.register("counter-retreat-v1", || Box::new(counter_retreat::Agent))?;
            println!("Running {} games using registered source entrypoints", config.match_count()?);
            let mut report = run_tournament(&registry, config)?;
            engine_revision()?;
            report.source_revision = Some(revision);
            report.source_dirty = Some(false);
            serde_json::to_writer(BufWriter::new(fs::File::create(&args[3])?), &report)?;
            println!("Saved {} games", report.matches.len());
        }
        Some("replay") if args.len() == 3 => {
            let report: Report = serde_json::from_slice(&fs::read(&args[2])?)?;
            if report.source_revision.as_deref() != Some(revision.as_str()) || report.source_dirty != Some(false) || report.matches.is_empty() || !report.config.trace {
                return Err("Report lacks clean source metadata or replay traces".into());
            }
            for (i, game) in report.matches.iter().enumerate() {
                replay_match(game).map_err(|e| format!("Game {}: {}", i + 1, e))?;
                if (i + 1) % 100 == 0 { println!("Verified {}/{} replays", i + 1, report.matches.len()); }
            }
            println!("Replay verification passed: {} games; commands, outcomes, state hashes and telemetry match", report.matches.len());
        }
        _ => return Err("Usage: season-runner run <config.json> <report.json> | replay <report.json>".into()),
    }
    Ok(())
}
