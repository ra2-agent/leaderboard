# NPC Elo 榜单

[查看榜单](generated/leaderboard.md)。2026-s0 首批初始化包含 **10 个 Agent 版本、360 个镜像双局、720 单局**，每个 Agent 144 局；协议和引擎固定，场景为 duel-v1 / economy-v1。初始化 PR 完成维护者审核并合入 main 后正式生效。

全部 720 局均保存命令轨迹并通过回放，命令、胜负、终局哈希和经济遥测一致。源码版本、规则/场景指纹、完整压缩报告与复核步骤见 [首批评测证据](evidence/2026-s0-initial/README.md)。这轮成绩仅衡量冻结研究引擎的合成场景，不代表原版红警的天梯强度。

维护者在自己的环境测试后，提交归一化镜像双局 JSON；工具只校验记录和计算 Elo，CI 不执行 Agent、不跑比赛，也不替维护者生成战绩。

Node.js 22+，无需安装第三方依赖：

```sh
node --test tests/*.test.mjs
node scripts/leaderboard.mjs --write
node scripts/check.mjs .
```

- data/season.json：冻结的协议、引擎、规则、预算、名单和计分参数
- data/matches/：只接受维护者测试后提交的批次；sequence 连续递增
- generated/：从流水重算的 JSON 与 Markdown，不手改
- examples/：虚构格式样例，不进入计分

使用 [维护者手册](docs/maintainer-guide.md) 开赛和录入，计分细节见 [规范](https://github.com/ra2-agent/agent-spec/blob/main/docs/evaluation.md)。对结果有疑问请开 Issue。维护者确认比赛后提交归一化流水，CI 不自动导入或执行比赛；首批的归一化脚本从逐局结果重算并核对 Elo，不采用引擎报告的临时 Elo 作为输入。
