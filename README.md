# LiZi Life · 个人状态站

手机优先的健康、训练与工作记录 PWA。纯静态页面，通过 GitHub Contents API 与私有仓库交换状态。无第三方统计、外部字体或 AI API 调用。健康 / 计划 / 日常记录按日期拆分。

## 第一版

- 今日：精力、疲劳、酸痛、心情；当日三件事；连接状态。
- 健康：标准 JSON 导入、手动补记、七天睡眠 / 步数趋势；缺失保持未知。
- 训练：完成 / 部分完成 / 未完成；逐组重量次数、余力、时长、原因与感受；带出同名动作历史。
- 工作：最多三件事、实际结果、卡点、待讨论问题。
- 复盘：七天记录、晚间复盘、复制给 ChatGPT 的摘要。
- 计划：读取建议、采纳 / 调整 / 跳过；不会覆盖已有任务或冒充训练完成。
- 数据：立即本机保存、30秒合并上传、前台120秒读取、离线补传、备份恢复、三方合并及同条记录冲突处理。
- 安装：Safari 分享 → 添加到主屏幕；Service Worker 缓存静态资源供离线使用。

## 发布

1. 保持此仓库 **Private**，数据不能放进公开仓库。
2. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
3. Actions → Deploy Pages → Run workflow。成功后的网址通常为 `https://liziyaaa.github.io/lizi_life/`，以运行返回的部署 URL 为准。
4. 若私有仓库无法启用 Pages，需要 GitHub Pro / 支持的组织套餐。**不要为发布将数据仓库改为公开**。也可以将 `npm run build` 生成的 `dist` 部署至独立静态主机，仅发布界面。

构建严格白名单复制 `app/` 的十个静态文件。`data/`、README、文档、凭据均不会进入 Pages artifact。日常数据更新不触发 Pages 构建。不要把发布来源改成整个 main 分支的根目录。

## 首次连接

打开 App 的设置，填入 `liziyaaa/lizi_life`、`main` 和 **仅此仓库 Contents: Read and write** 的 fine-grained PAT。默认密钥仅存在 sessionStorage；勾选记住则保留在本机 localStorage。密钥不包含在数据备份和 GitHub 提交中。

换仓库会切换独立本机数据空间；旧空间不会删除。服务器在每次同步前检查目标仓库私有性。GitHub 网络或权限失败时记录仍留在本机；显示的“同步成功”必须来自真实 API 成功结果。单设备使用优先；多设备同时修改同一条记录会提示人工解决冲突。

## 与 ChatGPT 协作

授权 GitHub 连接器访问该私有仓库后：

- 读取 `data/days/YYYY-MM-DD.json`，含 checkin/task/workout/question/reflection/planResponse。
- 读取 `data/health/YYYY-MM-DD.json`，健康汇总，不上传每秒心率原始样本。
- 写入 `data/plans/YYYY-MM-DD.json`，格式见 [数据协议](docs/data-contract.md)。
- 读取应直接按文件路径，不依赖 GitHub 代码搜索索引。用户授权写建议后才更新对应计划文件。

网页不会自动通知 ChatGPT。定时任务是否能使用连接器需要另行实测，首版没有暗中配置定时任务或计费 AI 调用。网页本身不能使用 HealthKit；见 [快捷指令接入](docs/health-shortcut.md)。

## 本地验证

无需安装依赖，Node 22+：

```sh
npm run check
npm test
npm run build
```

将 `dist` 用任意静态服务器打开。测试覆盖数据验证、缺失值、时区、备份、三方合并、GitHub mock 同步 / 冲突 / 鉴权及发布内容白名单。真实 iPhone 健康授权、锁屏自动化、GitHub token 和 Pages 发布需要在对应设备 / 账号验证。

## 边界

本机存储不是云备份，清除浏览器数据会清除本机记录；建议先同步或导出。页面对所有访问者相同，但个人数据只经授权访问私有仓库。静态网页中的密钥对当前设备上的脚本可见，请仅在可信的私人设备使用并定期轮换。
