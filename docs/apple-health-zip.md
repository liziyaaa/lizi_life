# Apple 健康完整 ZIP 调研（2026-10-20）

当前 v1.3.0 只支持健康 JSON 导入，尚未实现 ZIP/XML 解析。以下为已核对的格式与后续设计，不能视作现有功能。

## 导出与常见内容

在 iPhone「健康」中打开头像，选择「导出所有健康数据」，保存生成的 ZIP。Apple 官方说明导出健康及健身数据为 XML。

常见压缩包含 apple_health_export/export.xml、export_cda.xml；若用户确有对应数据，还可能包含 electrocardiograms/ 下的 CSV 和 workout-routes/ 下的 GPX。不能假定每个文件和指标都存在。

原始记录可含数据类型、sourceName/sourceVersion、device、unit、creationDate、startDate、endDate 和 value。它们不是现成的可信日汇总。

## 适合本项目的导入流程（待实现）

完整ZIP由用户手动选择，在设备内按流解压 export.xml；用 Worker 解析，提供进度和取消。不要一次构造整个 XML DOM。ZIP大小不能等同解压后内存开销。

先显示检测到的指标、来源、日期范围和缺失情况，再由用户选择导入日期及各指标优先来源，最后生成按日JSON同步到私有仓库。只上传必要日摘要，原ZIP、心电波形和GPS轨迹不默认上传。

步数按来源和时间区间处理，禁止把手机、手环的重叠记录直接相加；精确重复和部分重叠分别处理，部分重叠的估算必须明示。睡眠排除卧床/清醒区间、合并重复睡眠阶段，跨午夜按睡眠段处理并归属醒来日。静息心率与普通心率分开。重复导入保持幂等，不能把缺失补成零。

需要用用户实际导出的ZIP核对目录名、字段、设备来源、体量，再验证日汇总与健康App显示的差异。导出不会补齐第三方设备未写入Apple健康的数据。手动导出方案的数据时效取决于最近一次导入。

## 来源

- Apple官方导出说明：https://support.apple.com/en-ca/guide/iphone/iph5ede58c3d/ios
- 原始导出ZIP的实测目录：https://alexwlchan.net/2023/adding-watch-locations/
- 开源转换器与原始记录字段示例：https://github.com/muquit/applehealth2csv
