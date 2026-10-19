# iPhone Apple 健康 → LiZi Life

首版网页支持导入与仓库读取，不会自动创建系统快捷指令。先让手动链路成功，再启用自动化，避免“计划运行”被误认为“数据已上传”。

## 1. 确认来源

小米手环8 → 小米运动健康 → Apple 健康。打开小米运动健康等待同步，在 Apple 健康查看睡眠、步数、心率各项最新记录和来源。可读字段以 Apple 健康实际存在的数据为准，不能假定所有手环指标都会同步。

## 2. 创建免费快捷指令

名称建议 `LiZi 健康同步`，与 App 设置保持一致。

1. 获取当前日期，按北京时间生成日期文本 YYYY-MM-DD，并计算昨日。
2. “查找健康样本”：读取昨日00:00至今日00:00步数，固定可信来源，避免手机与手环相加。需核对与健康 App 展示是否一致，不要假定原始样本求和等于系统去重总数。
3. 睡眠读取昨晚18:00至本次运行时间。仅合并实际睡眠区间，跨来源重叠要合并；不要将“在床上”或总睡眠与阶段再次相加。结果归属醒来日。发现午睡或跨日期补传时按醒来日期处理。
4. 心率可取昨日有效样本均值，存 averageHeartRate；只有来源明确提供静息心率才填 restingHeartRate。没有静息记录就省略。
5. 建“字典”：date、generatedAt、source、coverage、metrics，格式参照 App 设置中的健康示例。时间戳采用 ISO8601，带时区。不要把睡眠小时填进 sleepMinutes。
6. 昨日步数和今日醒来的睡眠分别生成各自日期对象；可组成数组，使用“获取文本”转 JSON，保存至 iCloud Drive/Shortcuts/lizi-health/。先检查保存后的文件内容，再导入 App。

> 原始睡眠区间合并及多来源步数去重需要额外逻辑。第一轮只导出一个可信来源的摘要，对比 Apple 健康后再扩大范围。不得将示例数值用作真实健康数据。

## 3. 验证后直接写私有 GitHub

尽量使用仅允许访问目标仓库、Contents: Read and write 的 fine-grained PAT。不要把真实 token 填入可分享的快捷指令模板或截图。

对每个日期对象：

1. GET `https://api.github.com/repos/liziyaaa/lizi_life`，确认 private=true；不通过则停止。
2. GET `https://api.github.com/repos/liziyaaa/lizi_life/contents/data/health/YYYY-MM-DD.json?ref=main`。
3. 404 代表待创建；200 时获取 sha，将已有 content 进行 Base64解码、解析字典并合并本次有效 metrics。保留未覆盖字段、核查日期。401/403/网络错误需停止并显示失败，不能当作文件不存在。
4. UTF-8 JSON 文本 → Base64编码（不换行）。
5. 用“获取 URL 内容” PUT 同一 contents 路径。请求头 `Authorization: Bearer <token>`、`Accept: application/vnd.github+json`、`X-GitHub-Api-Version: 2022-11-28`、`Content-Type: application/json`。
6. JSON 请求体包含 message（例如 health: update 2026-10-19）、branch=main、content（上一步编码），以及更新已有文件时的 sha。
7. 只有200/201才通知成功。409需重新GET、合并后重试；其他错误保留iCloud备份并通知补传。
8. App 点“立即同步”，检查数据日期、生成时间、数值与来源。

## 4. 再配置每天自动化

可保留此前建议的09:00“时间”个人自动化，选择立即运行。但健康访问可能受锁屏、授权、手环同步、网络等影响，不能保证无人值守每次成功；保留主屏幕手动入口。解锁并打开小米运动健康后手动补跑，是必要的第一版回退方式。

只同步到私有仓库；GitHub Pages 发布内容只能包含界面文件。不要将健康 JSON 写入 app/ 或 dist/。
