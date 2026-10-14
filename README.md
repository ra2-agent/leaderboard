# NPC Elo 榜单

[查看正式榜单](generated/leaderboard.md)。当前赛季 2026-s0 处于 setup：尚无正式参赛名单、比赛或排名。

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

使用 [维护者手册](docs/maintainer-guide.md) 开赛和录入，计分细节见 [规范](https://github.com/ra2-agent/agent-spec/blob/main/docs/evaluation.md)。对结果有疑问请开 Issue。当前只提供人工录入，不会自动导入引擎报告的临时 Elo。
