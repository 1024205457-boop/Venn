"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const VennDiagram = dynamic(() => import("@/components/VennDiagram"), {
  ssr: false,
});

interface VennNode {
  id: string;
  label: string;
  description?: string;
  children?: VennNode[];
}

interface VennRelation {
  sets: string[];
  label: string;
  sharedConcepts: string[];
}

interface VennData {
  title?: string;
  summary?: string;
  nodes: VennNode[];
  relations: VennRelation[];
}

const EXAMPLE_TEXT = `机器学习是AI的算法基础，核心学习范式包括监督学习、无监督学习和强化学习，基础步骤有数据预处理、特征工程和优化算法。
自然语言处理研究计算机理解和生成人类语言，核心任务分为语言理解（分词、命名实体识别、情感分析）、机器翻译和问答系统。
计算机视觉研究计算机理解图像和视频，核心任务包括图像识别（图像分类、人脸识别）、目标检测和图像分割。
机器学习和自然语言处理的交叉：Transformer架构和预训练-微调范式（BERT、GPT）是机器学习方法在NLP中的核心应用。
机器学习和计算机视觉的交叉：CNN、ResNet、YOLO和ViT等深度学习模型是机器学习方法在CV中的核心应用。
自然语言处理和计算机视觉的交叉：多模态融合技术连接了语言与视觉，产生了图文生成、视觉问答和图像描述等应用。`;

const EXAMPLE_DATA: VennData = {
  title: "人工智能三大核心领域",
  summary: "机器学习提供算法基础，自然语言处理和计算机视觉是其两大应用方向，三者在深度学习和多模态技术上深度交叉",
  nodes: [
    {
      id: "ml", label: "机器学习",
      description: "AI的算法基础，为NLP和CV提供核心训练方法与优化框架",
      children: [
        {
          id: "ml_methods", label: "学习范式",
          description: "机器学习按标注数据的使用方式分为三大范式",
          children: [
            { id: "ml_supervised", label: "监督学习", description: "利用标注数据学习输入到输出的映射", children: [] },
            { id: "ml_unsupervised", label: "无监督学习", description: "从无标注数据中发现隐藏结构与模式", children: [] },
            { id: "ml_reinforcement", label: "强化学习", description: "通过与环境交互的奖惩信号学习最优策略", children: [] },
          ],
        },
        { id: "ml_preprocessing", label: "数据预处理", description: "清洗、标准化、增强等数据准备步骤", children: [] },
        { id: "ml_feature", label: "特征工程", description: "从原始数据中提取和构造有效特征", children: [] },
        { id: "ml_optimization", label: "优化算法", description: "梯度下降、Adam等参数优化方法", children: [] },
      ],
    },
    {
      id: "nlp", label: "自然语言处理",
      description: "研究计算机理解和生成人类语言的技术，依赖机器学习提供的模型训练能力",
      children: [
        {
          id: "nlp_understanding", label: "语言理解",
          description: "让机器理解文本含义的核心任务",
          children: [
            { id: "nlp_segment", label: "分词", description: "将连续文本切分为词语单元", children: [] },
            { id: "nlp_ner", label: "命名实体识别", description: "识别文本中的人名、地名、机构名等实体", children: [] },
            { id: "nlp_sentiment", label: "情感分析", description: "判断文本的情感倾向（正面/负面/中性）", children: [] },
          ],
        },
        { id: "nlp_translation", label: "机器翻译", description: "将文本从一种语言自动翻译为另一种语言", children: [] },
        { id: "nlp_qa", label: "问答系统", description: "根据问题从知识库或文档中检索或生成答案", children: [] },
      ],
    },
    {
      id: "cv", label: "计算机视觉",
      description: "研究计算机理解和分析图像/视频的技术，依赖机器学习提供的特征学习能力",
      children: [
        {
          id: "cv_recognition", label: "图像识别",
          description: "计算机视觉中判断图像内容的核心任务",
          children: [
            { id: "cv_classification", label: "图像分类", description: "判断整张图像属于哪个类别", children: [] },
            { id: "cv_face", label: "人脸识别", description: "识别和验证图像中的人脸身份", children: [] },
          ],
        },
        { id: "cv_detection", label: "目标检测", description: "定位图像中物体的位置并识别类别", children: [] },
        { id: "cv_segmentation", label: "图像分割", description: "将图像每个像素分配到对应的语义类别", children: [] },
      ],
    },
  ],
  relations: [
    {
      sets: ["ml", "nlp"], label: "语言模型",
      sharedConcepts: ["Transformer", "BERT", "GPT", "预训练-微调"],
    },
    {
      sets: ["ml", "cv"], label: "视觉模型",
      sharedConcepts: ["CNN", "ResNet", "YOLO", "ViT"],
    },
    {
      sets: ["nlp", "cv"], label: "多模态融合",
      sharedConcepts: ["图文生成", "视觉问答", "图像描述"],
    },
  ],
};

export default function Home() {
  const [text, setText] = useState("");
  const [vennData, setVennData] = useState<VennData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze() {
    const input = text.trim();
    if (!input) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "分析失败");
      }

      const data: VennData = await res.json();
      setVennData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "出错了，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="flex-none border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-blue-400">Venn</span> AI
        </h1>
        <span className="text-xs text-gray-500">
          AI 概念维恩图生成器
        </span>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="w-[400px] flex-none border-r border-gray-800 flex flex-col">
          <div className="p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-300">
                粘贴文档内容
              </label>
              <button
                onClick={() => { setText(EXAMPLE_TEXT); setVennData(EXAMPLE_DATA); setError(""); }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                加载示例
              </button>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="在此粘贴文档、词典或任何文本，AI 将自动提取概念并生成嵌套维恩图..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600"
            />

            <button
              onClick={handleAnalyze}
              disabled={loading || !text.trim()}
              className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium text-sm transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  分析中...
                </span>
              ) : (
                "生成维恩图"
              )}
            </button>

            {error && (
              <p className="mt-2 text-red-400 text-xs">{error}</p>
            )}
          </div>

          {vennData && (
            <div className="border-t border-gray-800 p-4 max-h-[200px] overflow-y-auto">
              <p className="text-xs text-gray-500 mb-2">
                识别到 {vennData.nodes.length} 个集合 / {vennData.relations.length} 组关联
              </p>
              <div className="flex flex-wrap gap-1.5">
                {vennData.nodes.map((node, i) => (
                  <span
                    key={node.id}
                    className="text-xs px-2 py-1 rounded-full border"
                    style={{
                      borderColor: [
                        "#3b82f6", "#ec4899", "#22c55e", "#eab308", "#a855f7",
                      ][i % 5],
                      color: [
                        "#3b82f6", "#ec4899", "#22c55e", "#eab308", "#a855f7",
                      ][i % 5],
                    }}
                  >
                    {node.label}
                    {node.children ? ` (${node.children.length})` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0">
          {vennData ? (
            <VennDiagram data={vennData} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-600">
              <div className="text-center">
                <svg
                  className="mx-auto mb-4 w-16 h-16 opacity-30"
                  viewBox="0 0 100 100"
                  fill="none"
                >
                  <circle cx="38" cy="45" r="30" stroke="currentColor" strokeWidth="2" />
                  <circle cx="62" cy="45" r="30" stroke="currentColor" strokeWidth="2" />
                  <circle cx="50" cy="65" r="30" stroke="currentColor" strokeWidth="2" />
                </svg>
                <p className="text-sm">粘贴文本后点击生成，即可创建维恩图</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
