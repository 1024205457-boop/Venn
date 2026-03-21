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

规则：
1. 识别3-5个顶层概念类别（这些是主圆），优先选择文本中有相互交叉关系的概念作为顶层，这样维恩图才有意义
2. 顶层概念之间应该是并列的，如果A和B有交叉但不是从属关系，就都放在顶层
3. 在每个类别内，识别子概念作为children，子概念也可以有自己的children形成嵌套
4. 标签简洁，1-6个字
5. 只有当原文明确提到两个顶层集合有共同概念或技术时，才创建relation。不要强行创建泛泛的关系
6. relations的sets只能使用顶层nodes的id
7. 每个relation必须有一个label字段，用2-4个字概括交叉主题
8. description要包含原文中与该概念直接相关的关键语句
9. 所有label、description、sharedConcepts都用中文
10. 必须包含title字段（8字以内的总标题）和summary字段（一句话概括所有顶层概念之间的关系）
11. 去重：如果一个概念属于两个顶层集合的交叉（出现在sharedConcepts中），就不要再放到任何一个顶层集合的children里

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
