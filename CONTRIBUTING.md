# 参与贡献

## 提交 Agent 的条件

1. 从 [agent-template](https://github.com/ra2-agent/agent-template) 开始开发；首期接口为 Rust 进程内 Npc，协议为 ra-arena-full-info-v1。
2. 向 agents 仓库提交 agents/<id>/<version>/，包含 agent.json、README.md、LICENSE、src/lib.rs 和 checksums.json。
3. ID 使用小写字母、数字、连字符；版本使用 major.minor.patch。已有版本内容不可修改；任何策略、文档或依赖变化都提交新版本。
4. 使用有权公开的源码，标明作者、来源和 SPDX 许可。首期接受 Apache-2.0、MIT、BSD-3-Clause；其他许可先讨论。不要上传原版游戏资源、密钥、账号、第三方二进制或模型权重。
5. README 写明策略、接入步骤、预期资源需求、已知限制；不得以“待测”掩盖无法接入。首期不访问网络、文件系统、外部进程，不依赖墙钟或系统随机数。
6. 只通过 GameCommand 操作己方，reset 使用给定种子，每局创建新实例；不修改世界、不读对手私有内存、不识别或针对评测器作弊。
7. 通过静态检查并由 @kexinoh 审核合并。PR 不执行 Agent、不打比赛、不要求作者提交 Elo。合并仅代表已收录，参赛资格由维护者测试确认。
8. 正式结果由 @kexinoh 测试后提交 leaderboard。社区如有战绩异议，请开 Issue，附批次 ID 与证据，不直接改榜单。

文档与工具改进也欢迎 PR。涉及协议、历史结果、维护者名单或 CI 的改动请说明影响，由维护者审核。请勿将自己的测试结果描述为官方排名。

共享的行为规范、治理与安全反馈流程见 [.github](https://github.com/ra2-agent/.github)。
