# 维护者手册

## 开启首个赛季

1. 使用已公开的 [ra2-agent/rust-ra2](https://github.com/ra2-agent/rust-ra2) 研究引擎，固定可公开克隆的完整40位提交 SHA，使用干净工作区。首个公开研究提交为 189a5e2b3d7e8afaaf5d1a868cb9f15d0464f938；具体赛季仍由维护者确认环境。
2. 审核 agents 已合并版本并手工测试接入；将 key（id@version）、registry_commit（agents 完整提交）、checksums_sha256（checksums.json 原始文件 SHA-256）加入 data/season.json 的 roster。更改策略必须新版本，旧版不继承分数。
3. 设置 engine.commit、rules_sha256、scenario_pool_sha256；场景池摘要应覆盖场景定义、合成内容与配置的固定清单。规则摘要为实际规则文件字节的 SHA-256，不是引擎自有的其他 hash。保存指纹所对应的内容及计算方法到测试证据中。
4. 核实双方 max_ticks=3000、max_commands_per_tick=64，场景为 duel-v1/economy-v1，改 status 为 open。首批结果后不可原地改变协议、引擎、规则、预算、场景和计分参数；变更这些条件另开赛季（把旧仓库状态固定为标签并保留归档，使用新分支/目录后适配工具）。

## 录入比赛

1. 使用隔离环境审查与构建社区源码。按实际引擎注册名记录正式 id@version 的映射；保留 Agent / 引擎源码提交和指纹。
2. 在本地执行镜像双局。保存原始报告或回放（公开 Release 附件或可长期获取的 HTTPS 地址），计算 SHA-256。双方席位必须交换，场景、seed 和预算相同。崩溃或评测失败不计分。
3. 复制 examples/batch.example.json 到 data/matches/000001-<说明>.json；替换全部虚构字段。sequence 从1连续递增，played_at 使用含时区的 ISO 时间，submitted_by 为维护者 GitHub 名。pair 的 a/b 始终指 agents 数组中的两个身份，第二局即使 A 在右边，winner 仍按该身份填写。
4. seed 用十进制字符串保存（支持完整 u64，不经过 JS Number）。每局写 ticks、终局哈希、winner（a/b/draw）、reason（elimination/tick_limit/mutual_elimination）。超时必须到 max_ticks 且记和，双方同时淘汰记和。
5. node scripts/leaderboard.mjs --write；node scripts/check.mjs .；node --test tests/*.test.mjs。提交批次及 generated 两个文件到 PR，写明测试来源后合并。工具累计赛季分数，不直接采用单次 ra-arena 循环赛的临时 Elo。

## 维护与纠错

社区只贡献 Agent 和提出战绩问题；维护者确认的结果才进入正式流水。若有错误，在 PR 说明原批次、修改原因和替代证据，修正原始数据后重算整个赛季；不要增加一条重复比赛来抵消。Git 历史保留旧值。

每个 Agent 的场景 Elo 独立计分，总榜按全部双局更新。无比赛的已登记 Agent 不显示排名。小于20单局为暂定，不说明统计置信度。排序同分时按 Agent key 排序，只是展示顺序。
