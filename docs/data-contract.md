# 数据协议 v1

所有日期为北京时间（Asia/Shanghai）自然日，时间戳使用含时区 ISO 8601。路径 date 必须与内容 date 一致。

## 日常记录：data/days/YYYY-MM-DD.json

```json
{"schemaVersion":1,"date":"2026-10-19","records":{"checkin":{"id":"checkin","type":"checkin","date":"2026-10-19","updatedAt":"2026-10-19T12:00:00Z","body":{"energy":3,"fatigue":2,"soreness":1,"mood":3,"note":"示例，不是真实记录"}}}}
```

id 为 1–180 个字母、数字、下划线或连字符。同记录更新保留 id。移除使用 `deleted:true` 墓碑，不硬删除。updatedAt 是记录更新时间，不等于健康采样时间。

类型与 body：

| type | body |
| --- | --- |
| checkin | energy/fatigue/soreness/mood：1–5 整数；note：文字 |
| task | title/project/result/blocker：文字；done：布尔 |
| workout | name、status（完成/部分完成/未完成）、duration（分钟文字或空）、rir（0–10文字或空）、sets：[{weight:重量kg文字或空,reps:次数文字}]、note、reason |
| question | text、resolved：布尔 |
| reflection | text |
| planResponse | planId、status（已采纳/调整后采纳/跳过）、note |

Web 对日文件使用 base/local/remote 三方合并，不同记录自动合并；同一记录有并行改动时不覆盖，保留本机并提示处理。PUT 带最新 sha；409 重新拉取合并，最多3次。连接器修改日记录时也应先取最新 sha，只修改目标记录，避免整体替换丢失其他记录。建议由 AI 只写 plans，减少写入冲突。

## 健康摘要：data/health/YYYY-MM-DD.json

```json
{"schemaVersion":1,"date":"2026-10-19","generatedAt":"2026-10-19T12:00:00Z","source":"Apple Health / Shortcuts","coverage":{"start":"2026-10-19T00:00:00+08:00","end":"2026-10-20T00:00:00+08:00"},"metrics":{"sleepMinutes":420,"steps":6500,"restingHeartRate":62}}
```

metrics 可选字段：sleepMinutes（分钟）、steps（步）、restingHeartRate / averageHeartRate（次/分）、weightKg（kg）、activeEnergyKcal（kcal）。至少一项，未知字段应省略或 null，不能填0。静息心率不能由全天心率均值冒充。generatedAt 是摘要生成时间；coverage 是采样窗口。每个指标的实际覆盖期有差异时请拆分对应日期并在 source 注明来源策略。

睡眠归属醒来日，步数归属采样自然日。例如10月19日晨同步：10月18日全天步数写18日，18日晚至19日早睡眠写19日。当天刚生成摘要不意味着数据完整；手环未同步时应补传更新。导入 JSON 可以是单对象，也可以是最多366个对象的数组。

Web 与快捷指令都可更新健康文件，按 generatedAt 较新版本保留整份摘要。快捷指令更新时应先 GET 并合并同日期已有 metrics，再 PUT；不可用新的一项指标清掉其他项。首版人工补记后，设备重新同步可能以较新摘要替换它。

## AI 建议：data/plans/YYYY-MM-DD.json

```json
{"schemaVersion":1,"id":"plan-2026-10-19-1","date":"2026-10-19","generatedAt":"2026-10-19T12:00:00Z","basedOn":"实际读取日期、健康生成时间及日文件 commit/blob SHA","summary":"根据实际记录生成的建议","tasks":["一个明确可验收的行动"],"exercises":[{"name":"快走","sets":1,"reps":"20分钟，按身体感受调整"}]}
```

id 最多150个字母、数字、下划线或连字符。tasks 最多3项；exercises 最多30项。改版建议使用新 id；已采纳反馈按旧 planId 保留，不误认为新计划已采纳。App 自动读取当前日期计划。导入建议仅缓存本机，云端建议由 ChatGPT 连接器写入。

每次分析必须先读取实际文件并在 basedOn 说明依据；缺失记录是未知，不等于没有运动或任务失败。禁止将样例内容当作个人事实。第一版无诊断评分、无自动分析状态声明。

## 本机备份

设置可导出带 app=lizi-life、schemaVersion=1、days/health/plans 的 JSON，不含密钥。恢复合并时同 id 用备份记录替换本机版本，恢复前要求用户确认已备份。恢复结果进入待上传队列。
