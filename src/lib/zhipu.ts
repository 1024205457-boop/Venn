export type { VennNode, VennRelation, VennData } from "@/types/venn";
import type { VennNode, VennData } from "@/types/venn";

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || process.env.zhipu_api_key || "";
const ZHIPU_MODEL = process.env.ZHIPU_MODEL || process.env.zhipu_model || "glm-4-flash";

export type AnalyzeMode = "collect" | "organize";

export async function analyzeConcepts(text: string, mode: AnalyzeMode = "organize", maxLevels: number = 3): Promise<VennData> {
  const commonRules = `## 核心原则（最重要，必须严格遵守）

P1. 维恩图的本质是表达"并列概念之间的交叉关系"。顶层nodes必须是同一层级的并列概念，绝不能把包含关系的概念放在同一层。
  - 正确：机器学习、自然语言处理、计算机视觉（三者并列，有交叉）
  - 错误：地球村、你、我（"你"和"我"被"地球村"包含，不是并列关系）
  - 如果A包含B，则B必须是A的child，绝不能和A并列放在顶层

P2. 先判断概念间的关系类型，再决定结构：
  - 包含/从属关系 → 父子（parent-child）
  - 并列且有共享部分 → 同层 + relation
  - 并列但无共享 → 同层，不创建relation
  - 如果文本中所有概念都是从属于同一个大概念的，那这个大概念就是title，其下的并列子概念才是顶层nodes

P4. 去重严格执行：如果一个概念出现在relation的sharedConcepts中，就不能再出现在任何顶层node的children里。

## 结构规则

1. 识别3-5个顶层概念类别作为主圆，优先选择有两两交叉的并列概念
2. 每个顶层node必须有children数组且不能为空——在每个类别内识别子概念作为children，子概念也可以有自己的children形成嵌套（最多${maxLevels}层，即顶层为第1层，children为第2层${maxLevels >= 3 ? "，children的children为第3层" : "，不要再生成更深层级"}）
3. 标签简洁，1-6个字
4. relations的sets只能使用顶层nodes的id
5. 每个relation必须有label字段（2-4字概括交叉主题）
6. description要包含与该概念直接相关的关键信息
7. 所有label、description、sharedConcepts都用中文
8. 必须包含title字段（8字以内总标题）和summary字段（一句话概括所有顶层概念的关系）
9. 每个children数组建议2-4个元素，避免过多导致图形拥挤`;

  const jsonFormat = `仅返回有效JSON，格式如下：
{
  "title": "总标题",
  "summary": "一句话概括所有概念的关系",
  "nodes": [
    {
      "id": "unique_id",
      "label": "类别名称",
      "description": "简要描述",
      "children": [
        {
          "id": "child_id",
          "label": "子概念",
          "description": "简要描述",
          "children": []
        }
      ]
    }
  ],
  "relations": [
    {
      "sets": ["id1", "id2"],
      "label": "交叉领域概括",
      "sharedConcepts": ["共享概念1", "共享概念2"]
    }
  ]
}`;

  let prompt: string;

  if (mode === "collect") {
    prompt = `你是一个知识拓展引擎。用户提供了2-3个并列概念的关键词或标题，请基于你的知识，为每个概念生成完整的子概念层级和概念间的交叉关系，组织成嵌套维恩图结构。

${commonRules}

## 收集模式特有规则（必须严格遵守）

### 顶层nodes的确定
- 用户输入中提到的具体事物/技术/学科名称就是顶层nodes（维恩图的主圆）
- 例如用户输入"对比 React、Vue 和 Angular"，则 React、Vue、Angular 就是三个顶层nodes
- 例如用户输入"蛋白质、糖类、核酸、脂质"，则这四个就是顶层nodes
- 如果用户还提到了一个包含所有这些概念的上位概念（如"前端框架"、"生物大分子"），那个上位概念应该作为title，而非顶层node

### 什么是children，什么是顶层
- "设计理念"、"核心特性"、"适用场景"、"组成成分"、"功能分类"这类属性维度是每个主圆内部的children，绝不能作为顶层nodes
- 简单判断：如果A是B的一个方面/属性/维度，A应该是B的child
- 反过来：如果A和B是同类事物的不同实例（React和Vue都是框架，蛋白质和糖类都是大分子），它们才是并列的顶层nodes

### 内容填充
- 为每个顶层概念补充2-4个核心子概念作为children
- 主动识别概念之间的交叉关系，生成有意义的relations和sharedConcepts
- description要写出该概念的核心定义或关键特征

## 示例

输入："对比 React、Vue 和 Angular 的设计理念、核心特性和生态"

正确：
- title: "前端三大框架"
- 顶层nodes: React、Vue、Angular（三个具体框架）
- React的children: 虚拟DOM、JSX、单向数据流
- React和Vue的交叉: 组件化、响应式更新

错误：
- 把"设计理念"、"核心特性"、"生态"作为三个顶层nodes（这是属性维度，不是具体事物）

${jsonFormat}

用户输入的关键词/标题：
${text}`;
  } else {
    prompt = `你是一个概念分析引擎。根据以下文档/文本，提取关键概念及其层级关系，组织成嵌套维恩图结构。

${commonRules}

## 整理模式特有规则（必须严格遵守）

### 忠于原文
P3. 严格忠于原文。只提取文本中已有的概念和关系，不要自行补充、推理、扩展任何文本中没有提到的信息。如果原文没提到交叉关系，就不创建relation。没有交叉的维恩图也是合法的。

### 识别文档结构
- 如果文档明确写了"总主题"或整体标题，将其作为title
- 如果文档描述了几个并列的具体事物（如蛋白质、糖类、核酸、脂质），这些就是顶层nodes
- 如果文档用"A和B的交叉"、"A与B的共同点"等表述，直接提取为relation
- 如果文档用"子概念包括"、"分为"、"包括"等表述，直接提取为children

### 去重
P4. 如果一个概念出现在relation的sharedConcepts中（如"糖蛋白"），就不能再出现在任何顶层node的children里。

## 示例

输入："总主题：生物大分子。蛋白质：由氨基酸组成。子概念包括蛋白质结构、蛋白质功能分类。糖类：由单糖组成。子概念包括单糖、双糖、多糖。蛋白质和糖类的交叉：糖蛋白。"

正确分析：
- title: "生物大分子"
- 顶层nodes: 蛋白质、糖类（并列的具体事物）
- 蛋白质的children: 蛋白质结构、蛋白质功能分类
- relation: 蛋白质∩糖类，sharedConcepts: ["糖蛋白"]

错误：
- 把"生物大分子"和"蛋白质"都放顶层（生物大分子包含蛋白质，是从属关系）
- 把"糖蛋白"放在蛋白质的children里又放在sharedConcepts里（去重违规）

${jsonFormat}

文档内容：
${text}`;
  }

  const res = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ZHIPU_API_KEY}`,
    },
    body: JSON.stringify({
      model: ZHIPU_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`智谱 API 调用失败: ${res.status} ${err}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [
    null,
    content,
  ];
  const jsonStr = jsonMatch[1].trim();

  return JSON.parse(jsonStr) as VennData;
}

/** 将 VennData 序列化为可读的结构描述文本 */
function serializeVennData(data: VennData): string {
  function describeNode(node: { id: string; label: string; description?: string; notes?: string; wikiContent?: string; children?: VennNode[] }, depth = 0): string {
    const indent = "  ".repeat(depth);
    let text = `${indent}- ${node.label}`;
    if (node.description) text += `：${node.description}`;
    if (node.wikiContent) text += `\n${indent}  [详细内容] ${node.wikiContent.slice(0, 200)}${node.wikiContent.length > 200 ? "..." : ""}`;
    if (node.notes) text += `（笔记：${node.notes}）`;
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        text += "\n" + describeNode(child, depth + 1);
      }
    }
    return text;
  }

  let structureText = `标题：${data.title || "无"}\n概要：${data.summary || "无"}\n\n`;
  structureText += "## 概念层级\n";
  for (const node of data.nodes) {
    structureText += describeNode(node) + "\n";
  }
  structureText += "\n## 交叉关系\n";
  for (const rel of data.relations) {
    structureText += `- ${rel.sets.join(" ∩ ")}：${rel.label || ""}（${rel.sharedConcepts.join("、")}）\n`;
  }
  return structureText;
}

/** 生成维恩图的结构化知识摘要（借鉴 Claude Code 的摘要模板） */
export async function summarizeVennData(data: VennData): Promise<string> {
  const structureText = serializeVennData(data);

  const prompt = `你是一个知识分析引擎。请根据以下维恩图的结构数据，生成一份结构化的知识摘要。

## 维恩图数据
${structureText}

## 输出格式（严格按以下 4 个部分输出，使用 Markdown）

### 核心概念
列出最重要的 3-5 个概念及其一句话定义，按重要性排序。

### 交叉关系
总结最有价值的交叉点，解释这些交叉为什么重要。

### 知识缺口
识别当前图中信息稀疏或缺失的区域：
- 哪些节点缺少描述或子概念？
- 哪些可能的交叉关系尚未被覆盖？

### 关键洞察
从整体结构中提炼 2-3 条非显而易见的发现或学习建议。

请用中文输出，简洁精炼，总字数控制在 500 字以内。`;

  const res = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ZHIPU_API_KEY}`,
    },
    body: JSON.stringify({
      model: ZHIPU_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`智谱 API 调用失败: ${res.status} ${err}`);
  }

  const result = await res.json();
  return result.choices[0].message.content;
}

/** 收集模式第一步：根据关键词生成结构化描述文本，供用户编辑后再生成维恩图 */
export async function expandKeywords(keywords: string): Promise<string> {
  const prompt = `你是一个知识拓展引擎。用户提供了几个并列概念的关键词，请基于你的知识，为每个概念生成结构化的描述文本。

## 输出格式要求（严格遵守）

用自然语言段落描述，格式参考以下示例：

总主题：[一个简短的总标题]。以下几个概念是并列关系，[简要说明它们的共同点]。

[概念A]：[概念A的核心定义]。子概念包括：[子概念1]（简述）、[子概念2]（简述）、[子概念3]（简述）。

[概念B]：[概念B的核心定义]。子概念包括：[子概念1]（简述）、[子概念2]（简述）、[子概念3]（简述）。

[概念A]和[概念B]的交叉：[说明交叉领域和共享概念]。

## 规则
- 每个概念生成2-4个子概念，子概念也可以有自己的子概念
- 主动识别概念之间的交叉关系
- 用中文输出
- 只输出描述文本，不要输出JSON
- 不要用Markdown标题格式，用纯段落文本

用户输入的关键词：
${keywords}`;

  const res = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ZHIPU_API_KEY}`,
    },
    body: JSON.stringify({
      model: ZHIPU_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`智谱 API 调用失败: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

/** Lint：对知识库做健康检查（借鉴 Karpathy LLM Wiki 的 Lint 操作） */
export interface LintIssue {
  type: "contradiction" | "duplicate" | "sparse";
  severity: "error" | "warning" | "info";
  nodeIds: string[];
  message: string;
  suggestion?: string;
}

export async function lintVennData(data: VennData): Promise<LintIssue[]> {
  const structureText = serializeVennData(data);

  const prompt = `你是一个知识库质量检查引擎（Lint）。请对以下维恩图知识库进行健康检查，找出问题。

## 维恩图数据
${structureText}

## 检查项（按优先级排列）

1. **矛盾/冲突（contradiction）**：两个节点的描述或内容存在事实性矛盾，或者对同一概念给出了不一致的定义。这是最严重的问题。
2. **内容重复（duplicate）**：两个节点的内容高度相似（>70%），可能应该合并。注意区分：同领域但不同子方向不算重复，只有内容实质相同才算。
3. **内容稀疏（sparse）**：节点缺少描述、没有子概念、或详细内容为空。

注意：不要检查交叉关系相关的问题（如缺失交叉关系、孤立节点等），只关注上面三项。

## 输出格式（严格 JSON 数组）

仅返回 JSON 数组，每个元素格式：
{
  "type": "contradiction" | "duplicate" | "sparse",
  "severity": "error" | "warning" | "info",
  "nodeIds": ["涉及的节点id1", "节点id2"],
  "message": "问题描述（中文，一句话）",
  "suggestion": "建议的修复方式（中文，一句话）"
}

severity 规则：
- contradiction → error
- duplicate → error
- sparse → warning（如果是顶层节点）或 info（如果是叶子节点）

如果没有任何问题，返回空数组 []。
只返回确实存在的问题，不要为了输出而凑数。`;

  const res = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ZHIPU_API_KEY}`,
    },
    body: JSON.stringify({
      model: ZHIPU_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`智谱 API 调用失败: ${res.status} ${err}`);
  }

  const result = await res.json();
  const content = result.choices[0].message.content;

  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
  const jsonStr = jsonMatch[1].trim();

  return JSON.parse(jsonStr) as LintIssue[];
}
