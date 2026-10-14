# 2026-s0 首批评测证据

2026-10-15（Asia/Shanghai），10 个登记版本在 duel-v1 / economy-v1 各进行 4 轮镜像循环赛，主种子 42，共 360 个镜像双局、720 单局。每个 Agent 总计 144 局，各场景 72 局。双方每局最多 3000 tick、每拍最多 64 条命令；完整世界观测。候选版与 reference-v7 当前行为相同，只计入冻结的 reference-v7，tune-* 参数变体留在实验池。

实际编译并执行的是 agents 各版本 `src/lib.rs` 中的 Npc 入口。`roster-mapping.json` 保存 Arena 注册名与正式 `id@version` 的映射；`runner.rs` 逐一包含这些入口，未通过名字替换使用其他策略。初始 roster 的公开登记提交是 [73cb61ae](https://github.com/ra2-agent/agents/commit/73cb61ae6cf4c6cda371fdb884c63745d290004a)，其纳入 main 由 [agents#1](https://github.com/ra2-agent/agents/pull/1) 审核完成后生效。

引擎固定为 [189a5e2b](https://github.com/ra2-agent/rust-ra2/commit/189a5e2b3d7e8afaaf5d1a868cb9f15d0464f938)，运行前后均核对干净工作区。此评测不代表原版 RA2、战争迷雾或真实地图环境；小场景池的重复比赛也不等于同样数量的独立地图样本。

## 证据与指纹

- `report.json.gz`：完整原始 Arena JSON 的 gzip 压缩包，含全部 720 局命令轨迹。流水的 evidence SHA-256 对应压缩包本身；解压后的原始 SHA-256 另见 `manifest.json`，保留原始字节和完整 u64 种子。
- `manifest.json`：源码提交、版本清单摘要、编译器、依赖锁、二进制摘要及评测元数据。比赛时间来自原始报告写完时间，使用含时区 ISO 时间记录。
- `replay-verification.txt`：全部 720 局的回放核验结果；命令、胜负、终局哈希和经济遥测一致。
- `arena-regression.txt`：固定引擎的 30 项 Arena 回归测试结果；保留编译器原有警告。
- `fixtures/`、`scenario.rs`、`scenario-pool.json`：实际合成规则与场景源码，以及场景池摘要的固定输入。
- `config.json`、`runner.rs`、`prepare-runner.mjs`、两个 Cargo.lock：可重建驱动和比赛配置。
- `normalize.mjs`：本批次从逐局结果生成归一化流水的可复核脚本。先把原始 JSON 中的数字 seed 转成十进制字符串，再解析，避免 JS Number 丢失 u64 精度；严格核对镜像席位、环境、回放轨迹和完整局数。

`rules_sha256` 为实际 `rules-v1.ini` 原始字节紧接实际 `economy-v1.ini` 原始字节的 SHA-256。顺序、各文件字节数与单文件 SHA-256 记录在 `scenario-pool.json`；不使用引擎内部的非 SHA-256 `rules_hash` 替代。`scenario_pool_sha256` 是 `scenario-pool.json` 文件原始字节的 SHA-256，其内容覆盖场景定义源码、两个规则文件和本次配置的摘要。

## 核验与复跑

分别克隆 engine、agents 和本仓库，engine 切到上述固定提交，agents 切到上述登记提交。保持 engine 干净，安装 `manifest.json` 记录的 Rust nightly。以下以 Windows 为例，替换本机路径即可：

```powershell
$board = 'D:/work/leaderboard'
$engine = 'D:/work/rust-ra2'
$registry = 'D:/work/agents'
$build = "$board/.local/season-runner"
$evidence = "$board/evidence/2026-s0-initial"
node "$evidence/prepare-runner.mjs" $engine $registry $build
Set-Location $build
cargo +nightly build --locked --profile arena
$env:RA_ENGINE_DIR = $engine
node -e 'const fs=require("fs"),z=require("zlib");fs.writeFileSync("../initial-report.json",z.gunzipSync(fs.readFileSync("../../evidence/2026-s0-initial/report.json.gz")))'
./target/arena/season-runner.exe replay ../initial-report.json
./target/arena/season-runner.exe run "$evidence/config.json" ../rerun-report.json
```

本次生成与复核：`node evidence/2026-s0-initial/normalize.mjs <包含证据文件的完整 Git 提交>`，再运行 `node scripts/leaderboard.mjs --write`、`node scripts/check.mjs .` 与 `node --test tests/*.test.mjs`。流水从逐局胜负重新计算 Elo，再与 Arena 的场景与综合统计交叉核对；未直接把 Arena 临时 Elo 当作正式输入。

CI 仅执行静态校验与计分测试，不运行 Agent 或游戏。正式首批流水仅应在 agents 登记 PR 和 leaderboard 初始化 PR 完成维护者审核后合入 main。
