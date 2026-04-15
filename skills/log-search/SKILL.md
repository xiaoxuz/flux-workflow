---
name: log-search
description: >
  日志搜索与分析。当用户需要搜索服务日志、查看错误日志、排查异常堆栈、
  按关键词或 traceID 检索日志时使用。支持 Go/PHP/Mesh 各类日志类型。
context: fork
allowed-tools: plugin_zyb-observability_mcp-gateway__log_query_range, plugin_zyb-observability_mcp-gateway__trace_query, plugin_zyb-observability_mcp-gateway__trace_ids_query, plugin_zyb-observability_mcp-gateway__metric_query, plugin_zyb-observability_mcp-gateway__devops_get_services_by_git, plugin_zyb-observability_mcp-gateway__devops_service_info_by_ns_name
---

# 日志搜索

## 支持文件

- [observability-fields.md](${CLAUDE_SKILL_DIR}/../observability-fields.md) 说明 **cluster / namespace / app** 等通用字段含义；解析用户描述的「某集群某服务」时**建议先读**。
- 本目录下的 [log-search.md](${CLAUDE_SKILL_DIR}/log-search.md) 包含 `tp`（日志类型）和 `query`（检索表达式）的语法与示例。**`tp` 如何取值**以 **步骤 1「`tp` 的处理」** 为准；**`query` 是否为空、如何写管道**以 **步骤 3** 为准，**构建非空 `query` 前必须先读取该文件**（与其中「`query` 可为空」等说明交叉引用）。
- 需要从日志联动追踪时，参考 [trace.md](${CLAUDE_SKILL_DIR}/../trace-search/trace.md) 了解 RequestID 四段结构和 TraceID 的提取方法。

## 执行流程

### 1. 参数提取

从用户请求中提取关键参数：
- **cluster**: 集群名称
- **namespace**: 命名空间
- **app**: 服务名称
- **tp**: 日志类型（见下文「`tp` 的处理」；需在 **namespace / app**（及建议 **cluster**）确定后再定）
- **query**: 检索表达式（**取值与空串规则见步骤 3**；发起 `log_query_range` 前最终确定即可）
- **时间范围**: 如"最近30分钟"、"最近1小时"等

#### 缺 **namespace / app** 或 **cluster** 时

日志检索必须能锁定「哪套服务、哪个集群」。若用户未给出 **namespace** 与 **app**，或未给出 **cluster**：

1. 在当前仓库语境下**优先**按 [observability-fields.md — DevOps MCP 反查](${CLAUDE_SKILL_DIR}/../observability-fields.md#devops-mcp-resolve)，用 `devops_get_services_by_git`（结合 `git remote get-url origin` 等）补齐 **namespace / app**，用 `devops_service_info_by_ns_name` 从返回的 `service.clusters` 中选定或请用户选择 **cluster**。
2. 若反查不可用、多结果歧义、或仍缺 **时间范围** 等，再**主动向用户确认**。

#### `tp` 的处理

在 **namespace / app**（及 **cluster**，若已确定）就绪后，再处理日志类型 **`tp`**：

##### `tp` 规则

按下面顺序取值即可；**凡提到「用指标列 `tp`」均指下一小节同一套 PromQL**。

1. 用户**已给出字面 `tp`**（如 `ser
2. ver.log`）→ **直接使用**。
2. 用户**完全未提 `tp`** → **默认 `tp` 为空**（不按单一日志类型过滤，覆盖该服务下可用全部 `tp`；与 [log-search.md](${CLAUDE_SKILL_DIR}/log-search.md)「`tp` 可为空」一致）。若噪声大或需要收窄，再走到下面 3 / 4。
3. 用户只描述**业务意图**而未给字面 `tp`（如「错误日志」「出流量」「Mesh」）→ 先对照 [log-search.md](${CLAUDE_SKILL_DIR}/log-search.md) 中的 **tp 与场景映射**（如 Go 业务 `server.log`、RAL `module.log`、Mesh `service-mesh.log` 等）**推断**；仍不确定则 **`tp` 置空**先查一轮，或走 4。
4. 需要**列表供用户选 `tp`**，或 2 / 3 仍无法收窄 → 用 **`metric_query`** + 下一小节 PromQL 得到 `tp` 集合，整理成列表请用户勾选；指标无数据或不全时，再辅以 log-search.md 的常见 `tp` 说明。

##### 用指标发现当前服务有哪些 `tp`（需已具备 `namespace` + `app`）

数据源 **`db=6`**，见 [metrics.md](${CLAUDE_SKILL_DIR}/../metric-query/metrics.md)「日志相关指标」。

```promql
count(pod_log_count_total{cluster=~"$cluster",namespace="$namespace",app=~"$app"}) by (tp)
```

从每条序列的 **`tp` 标签**整理成列表。

##### 向用户确认 `tp` 时的话术要点

1. 说明 **默认 `tp` 为空 = 查询所有日志类型**（不按单一 `tp` 收窄）。
2. 若用户希望只查某一类日志，请其从 **指标返回的 `tp` 列表**中选择；若指标无数据或列表不完整，再辅以 [log-search.md](${CLAUDE_SKILL_DIR}/log-search.md) 中的常见 `tp` 说明。

### 2. 生成时间戳

根据提取的时间范围，使用 Bash 工具计算时间戳：

```bash
# 当前 Unix 秒级时间戳
$(date +%s)

# N 分钟前：shell 算术（macOS / Linux 通用）。示例 30 分钟，按需改前面的数字
$((endTime - 30 * 60))

# 时间戳转人类可读（验证用）。macOS（BSD）用 -r；GNU/Linux 用 date -d @1774929297
date -r 1774929297 "+%Y-%m-%d %H:%M:%S"
```

**验证检查清单**：
1. ✅ `endTime` 不能大于当前时间（不能查询未来数据）
2. ✅ `startTime` 必须小于 `endTime`
3. ✅ 时间戳必须是 Unix 秒级（10 位数字），不是毫秒（13 位）
4. ✅ 单次查询时间窗口 `endTime - startTime <= 3600`（不能超过 1 小时）

**输出格式**：`时间范围: 2026-03-31 11:24:57 ~ 2026-03-31 11:54:57 (startTime=1774927497, endTime=1774929297)`


### 3. 构建 `query` 并发起 `log_query_range`

**！！！重要！！！ `query` 必须是「类 Shell 管道」的完整表达式，不能只填裸关键词。** 调用 `log_query_range` 时，**禁止**把 `query` 设成单独的检索关键词（如 `"ERROR"`、`"panic"`、`"529e4c6f60ad60d9"`）。要按内容过滤时，**必须**写成 `grep …`，例如筛错误级别用 **`grep ERROR`**，而不是传 **`ERROR`**。

**`query` 取值（在本步决定，再传入 `log_query_range`）：**

1. 用户已给出**可落地的检索条件**（关键词、TraceID/RequestID 片段、明确错误码、URI、错误/异常日志 等）→ 按 [log-search.md](${CLAUDE_SKILL_DIR}/log-search.md) 写成类 Shell 管道字符串（`grep` / `grep -E` / 管道组合等）。
2. 从**业务意图**无法稳定翻译成第 1 条中的表达式（例如仅「查看最近10min日志」「返回10条日志」且没有具体串可 grep）→ **`query` 允许为空**：不传内容过滤，依赖 **时间窗 + `tp` + `limit`** 抽样浏览；若结果过杂，再请用户补充关键词或收窄 `tp`/时间后再查一轮。
3. **禁止**为「非空而非空」：在没有可靠模式时臆造宽泛 `grep`（如只 `grep e`）不如 **`query` 置空** + 控制 `limit` 与阅读摘要。

**非空 `query`** 须在阅读 [log-search.md](${CLAUDE_SKILL_DIR}/log-search.md) 后按该文件语法编写。常见形态速查（细节以 log-search.md 为准）：
- 关键词匹配：`grep keyword`
- 多条件：`grep keyword1 | grep keyword2`
- 排除条件：`grep keyword | grep -v noise`
- 正则匹配：`grep -E "cost=[0-9]{4,}."`
- 后处理：支持 `awk`、`jq`、`wc`、`sort`、`uniq`

**常见查询场景**（将示例中的字面量换成用户给出的真实串；路径含 `?` `&` 等时优先 `grep -F`）：

- **查询notice / accesslog / 访问日志，三者含义相同**：`grep notice`或 `grep accesslog`。
- **查询错误 / 异常**：`grep ERROR`，或略宽一点 `grep -Ei 'error|exception|fatal'`。
- **查询panic / 致命**：`grep panic`、`grep 'runtime error'`，或 `grep -Ei 'panic|fatal'`。
- **查询TraceID / RequestID**：直接 `grep 'be54b69366f3ae97'`（示例 ID，换成真实值）；若日志里带字段名，可用 `grep requestId | grep 'be54b69366f3ae97'`或 `grep request_id | grep '…'`。RequestID 四段时**第 1 段即 TraceID**，见 [trace.md](${CLAUDE_SKILL_DIR}/../trace-search/trace.md)。
- **查询某个 URI**：`grep '/api/v1/your/path'`，某个URI的请求日志`grep accesslog | grep '/api/v1/your/path'`。
- **查询业务错误码（`errNo`）**：业务 JSON 日志里常见 **`errNo`** 字段，**一般不为 0 表示发生异常**。**查指定码**：`grep -F '\"errNo\":-1'`（把 `-1` 换成目标值）；**粗筛非 0**：`grep errNo | grep -vF '\"errNo\":0'`。个别服务若用 `errno` / `code` / `businessCode` 等，仍按**真实字段名**替换即可。
- **查询 HTTP 状态码**：Mesh日志里常见 **`upstream_stat`**（表示服务返回状态码）**定码**：`grep -F '"upstream_stat":"502"'`（换成目标码）。**筛 5xx**：`grep -E '"upstream_stat":"5[0-9]{2}"'`。若日志为 **`httpCode`** 或其它字段名表示状态码，按字段替换即可；Go **notice** 日志里若直接带状态码，可用 `grep notice | grep -F '"responseStatus":502'` 或 `grep accesslog | grep -F '"responseStatus":502'`。

**⚠️ 注意！** `query` 是一个完整字符串，**语法上等价于一条可执行的 grep 管道**（必须以 `grep` / `grep -E` / `grep -F` 等开头），**不是** LogQL，也**不是**裸搜索词。

用步骤 1～2 已确定的 **cluster、namespace、app、tp、startTime、endTime** 与本步确定的 **`query`**，按步骤 4 的 **limit** 策略调用 `log_query_range`。

### 4. 控制返回量（防止 context 溢出）

本 skill 以 `context: fork` 模式运行，原始日志数据留在 subagent 上下文中，仅将分析结论返回主对话。即便如此，仍应控制单次查询量以提高效率：

**limit 分级策略**：
- **首次查询**：`limit=50`，快速判断日志量级和错误模式
- **需要更多上下文**：`limit=200`，获取更完整的错误分布
- **全量排查**：`limit=500~1000`，仅在用户明确需要或前两轮不足以定位问题时使用
- **绝不在首次查询就使用** `limit=10000`

**缩小检索范围的优先级**（优于增大 limit）：
1. 收窄时间范围（如 30 分钟 → 5 分钟）
2. 增加 query 过滤条件（多加 grep 管道）
3. 精确 tp（如从 `server.log` 收窄到 `server.log.wf` 只看错误）
4. 最后才考虑增大 limit

### 5. 查询约束

- 可查范围：仅支持最近 **7 天内**的日志
- **单次查询时间窗口不能超过 1 小时**：`endTime - startTime <= 3600`，超出会报错 `查询时间范围不能超过1小时`
- 默认返回 200 条，最大 10000 条
- 单次查询上限约 1 TB

#### 自动分片：当用户需要查询超过 1 小时的日志

如果用户要求的时间范围超过 1 小时（如"最近 3 小时""今天的日志"），需要将时间范围拆分为多个 **≤ 1 小时** 的窗口，逐片查询后合并分析：

1. **从最近的时间片开始**（问题通常在最近时段更容易复现）
2. **每片使用相同的 tp 和 query 条件**
3. **根据首片结果决定是否继续查下一片**：
   - 如果首片已找到足够的错误模式 → 可先分析，不必查完所有片
   - 如果首片为空或数据不足 → 继续查更早的时间片
4. **合并结果时注意去重和时间线衔接**

**示例**：用户要求"最近 3 小时"，当前时间为 T：
- 第 1 片：`[T-1h, T]`（最近 1 小时，优先查）
- 第 2 片：`[T-2h, T-1h]`（需要时再查）
- 第 3 片：`[T-3h, T-2h]`（需要时再查）

### 6. 结果分析与返回

由于以 fork 模式运行，返回给主对话的内容应为**精炼的分析结论**，而非原始日志。返回内容须包含：

1. **概况**：命中多少条日志，时间分布情况
2. **错误归类**：将错误按类型/关键词分组，列出 Top N 错误及各自出现次数
3. **关键日志摘录**：仅摘录最具代表性的 3~5 条原始日志（含时间戳），而非全量粘贴
4. **时间线**：错误首次出现 → 高峰 → 是否恢复
5. **关联线索**：提取到的 RequestID / TraceID（供后续联动追踪）
6. **结论与建议**：根因判断、下一步排查方向

### 7. 日志联动追踪

日志中常包含可用于关联分布式追踪的 ID 字段（详见 [trace.md](${CLAUDE_SKILL_DIR}/../trace-search/trace.md)）：

**各类日志中的 ID 字段**：
- RAL 出流量日志（`module.log` / `ral-worker.log`）→ 字段名 `requestId`，格式为 `trace:span:parent:flags`
- Mesh 日志（`service-mesh.log` / `mesh-out.log`）→ 字段名 `request_id`，格式同上
- 业务日志（`server.log`）→ 框架 notice 中通常也会打印 `requestId`

**从日志提取 TraceID 并联动追踪**：
1. 在日志中找到 `requestId` 或 `request_id` 字段值，例如 `be54b69366f3ae97:682e19ae26880ce3:d5256426af9ade78:1`
2. 取冒号分隔的**第 1 段**即为 **TraceID**（如 `be54b69366f3ae97`）
3. 使用 `trace_query` 工具传入该 TraceID，即可拉取完整调用链
4. 或使用 `trace_ids_query` 在同时间窗口内按条件搜索相关链路

**建议**：当日志中发现错误或异常时，主动提取 RequestID/TraceID 并建议用户进一步查看完整调用链，快速定位跨服务的故障路径。
