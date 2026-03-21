export interface VennNode {
  id: string;
  label: string;
  description?: string;
  children?: VennNode[];
}

export interface VennRelation {
  sets: string[]; // ids of overlapping sets
  label: string; // 交叉区域的概括性标题
  sharedConcepts: string[];
}

export interface VennData {
  title?: string;
  summary?: string;
  nodes: VennNode[];
  relations: VennRelation[];
}

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || process.env.zhipu_api_key || "";
const ZHIPU_MODEL = process.env.ZHIPU_MODEL || process.env.zhipu_model || "glm-4-flash";

export async function analyzeConcepts(text: string): Promise<VennData> {
  const prompt = `你是一个概念分析引擎。根据以下文档/文本，提取关键概念及其层级关系，组织成嵌套维恩图结构。

## 核心原则（最重要，必须严格遵守）

P1. 维恩图的本质是表达"并列概念之间的交叉关系"。顶层nodes必须是同一层级的并列概念，绝不能把包含关系的概念放在同一层。
  - 正确：机器学习、自然语言处理、计算机视觉（三者并列，有交叉）
  - 错误：地球村、你、我（"你"和"我"被"地球村"包含，不是并列关系）
  - 如果A包含B，则B必须是A的child，绝不能和A并列放在顶层

P2. 先判断概念间的关系类型，再决定结构：
  - 包含/从属关系 → 父子（parent-child）
  - 并列且有共享部分 → 同层 + relation
  - 并列但无共享 → 同层，不创建relation
  - 如果文本中所有概念都是从属于同一个大概念的，那这个大概念就是title，其下的并列子概念才是顶层nodes

P3. 交叉必须有实质内容。只有原文明确提到两个概念有共同的子概念、技术、方法时才创建relation。不要因为两个概念"可能相关"就强行创建交叉。没有交叉的维恩图也是合法的。

P4. 去重严格执行：如果一个概念出现在relation的sharedConcepts中，就不能再出现在任何顶层node的children里。

## 结构规则

1. 识别3-5个顶层概念类别作为主圆，优先选择有两两交叉的并列概念
2. 在每个类别内识别子概念作为children，子概念也可以有自己的children形成嵌套（最多3层）
3. 标签简洁，1-6个字
4. relations的sets只能使用顶层nodes的id
5. 每个relation必须有label字段（2-4字概括交叉主题）
6. description要包含原文中与该概念直接相关的关键信息
7. 所有label、description、sharedConcepts都用中文
8. 必须包含title字段（8字以内总标题）和summary字段（一句话概括所有顶层概念的关系）
9. 每个children数组建议2-4个元素，避免过多导致图形拥挤

## 示例

输入："机器学习是AI的算法基础，核心学习范式包括监督学习、无监督学习和强化学习。自然语言处理研究计算机理解人类语言，核心任务包括分词、命名实体识别。机器学习和自然语言处理的交叉：Transformer和BERT是ML在NLP中的应用。"

正确分析：
- 机器学习和自然语言处理是并列关系（都是AI子领域）→ 放顶层
- 监督学习是机器学习的子概念 → 放在机器学习的children里
- Transformer同时属于ML和NLP → 放在relation的sharedConcepts里，不放任何一个的children

错误示例：
- 把"AI"和"机器学习"都放顶层（AI包含机器学习，是从属关系）
- 把"Transformer"同时放在机器学习的children和relation的sharedConcepts里（去重违规）

仅返回有效JSON，格式如下：
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
}

文档内容：
${text}`;

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
