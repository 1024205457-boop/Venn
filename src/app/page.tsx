"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { VennNode, VennData, Project } from "@/types/venn";
import { estimateDataDensity } from "@/types/venn";

const VennDiagram = dynamic(() => import("@/components/VennDiagram"), {
  ssr: false,
});
const WikiPanel = dynamic(() => import("@/components/WikiPanel"), {
  ssr: false,
});

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

const BIO_EXAMPLE_TEXT = `总主题：组成细胞的生物大分子。以下三类大分子是并列关系，都以碳骨架为基础，通过脱水缩合聚合、水解降解。

蛋白质：由20种氨基酸脱水缩合形成肽链。子概念包括：蛋白质结构（一级序列、二级折叠、三级空间构象、四级亚基组装）、蛋白质功能分类（结构蛋白、酶、转运蛋白、信号蛋白、防御蛋白）、氨基酸分类（按R基团极性分为非极性、不带电极性、带正电、带负电四类）。

糖类：由单糖聚合而成。子概念包括：单糖（葡萄糖、果糖、半乳糖）、双糖（蔗糖、麦芽糖、乳糖）、多糖（淀粉——植物储能、糖原——动物储能、纤维素——植物细胞壁结构）。

脂质：不溶于水、溶于有机溶剂的生物分子。子概念包括：脂肪（甘油+脂肪酸，储能）、磷脂（构成细胞膜双分子层）、类固醇（胆固醇、性激素）、蜡（防水保护）。

蛋白质和糖类的交叉：糖蛋白（细胞表面识别、信号传导）。
蛋白质和脂质的交叉：脂蛋白（血液转运脂质）、膜蛋白（嵌入磷脂双分子层）。
糖类和脂质的交叉：糖脂（细胞膜成分，参与细胞间通讯和免疫识别）。`;

const TEMPLATES = [
  { label: "学科对比", placeholder: "比较有机化学、无机化学和物理化学的研究对象、核心方法和交叉领域..." },
];

export default function Home() {
  const [text, setText] = useState("");
  const [vennData, setVennData] = useState<VennData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showProjects, setShowProjects] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deepAnalyzing, setDeepAnalyzing] = useState(false);
  const [mode, setMode] = useState<"collect" | "organize">("collect");
  const [maxLevels, setMaxLevels] = useState(3);
  const [expanding, setExpanding] = useState(false);
  const [expandedText, setExpandedText] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [sidePanel, setSidePanel] = useState<"input" | "wiki">("input");
  const [wikiSelectedNodeId, setWikiSelectedNodeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load project list
  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } catch { /* ignore */ }
  }

  async function handleAnalyze() {
    const input = text.trim();
    if (!input) return;

    if (mode === "collect" && !expandedText) {
      // Step 1: expand keywords to descriptive text
      setExpanding(true);
      setError("");
      try {
        const res = await fetch("/api/expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: input }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "展开失败");
        }
        const data = await res.json();
        setExpandedText(data.text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "出错了，请重试");
      } finally {
        setExpanding(false);
      }
      return;
    }

    // Step 2 (collect with expanded text) or organize mode: generate venn diagram
    const analyzeText = expandedText || input;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: analyzeText, mode: expandedText ? "organize" : mode, maxLevels }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "分析失败");
      }
      const data: VennData = await res.json();
      setVennData(data);
      if (expandedText) {
        setText(expandedText);
        setExpandedText(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "出错了，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    if (name.endsWith(".txt") || name.endsWith(".md")) {
      // Read text files client-side
      const content = await file.text();
      setText(content);
    } else if (name.endsWith(".docx")) {
      // Send docx to server for parsing
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("文件解析失败");
        const data = await res.json();
        setText(data.text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "文件上传失败");
      }
    } else {
      setError("不支持的文件格式，请使用 .txt、.md 或 .docx");
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  }

  async function handleSave() {
    if (!vennData) return;
    setSaving(true);
    try {
      if (currentProjectId) {
        // Update existing
        await fetch(`/api/projects/${currentProjectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, data: vennData }),
        });
      } else {
        // Create new
        const name = vennData.title || "未命名维恩图";
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, text, data: vennData }),
        });
        const data = await res.json();
        setCurrentProjectId(data.id);
      }
      await fetchProjects();
    } catch {
      setError("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenProject(project: Project) {
    setText(project.text);
    setVennData(JSON.parse(project.data));
    setCurrentProjectId(project.id);
    setError("");
  }

  async function handleDeleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("确定删除这个维恩图吗？")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (currentProjectId === id) {
      setCurrentProjectId(null);
      setText("");
      setVennData(null);
    }
    await fetchProjects();
  }

  async function handleDeepAnalyze(nodeId: string, inputText: string) {
    if (!vennData) return;
    setDeepAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "分析失败");
      }
      const result: VennData = await res.json();
      // Merge: set result.nodes as children of the target node
      function setChildrenInTree(nodes: VennNode[]): VennNode[] {
        return nodes.map((n) => {
          if (n.id === nodeId) {
            return { ...n, children: [...(n.children || []), ...result.nodes] };
          }
          if (n.children && n.children.length > 0) {
            return { ...n, children: setChildrenInTree(n.children) };
          }
          return n;
        });
      }
      setVennData({ ...vennData, nodes: setChildrenInTree(vennData.nodes) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "深入分析失败");
    } finally {
      setDeepAnalyzing(false);
    }
  }

  /** 判断另一个 VennData 是否可以与当前图合并：顶层节点 label 集合一致即可 */
  function canMergeWith(other: VennData): boolean {
    if (!vennData) return false;
    const currentLabels = vennData.nodes.map((n) => n.label.trim()).sort().join(",");
    const otherLabels = other.nodes.map((n) => n.label.trim()).sort().join(",");
    return currentLabels === otherLabels;
  }

  /** 合并两个维恩图：交叉结构保持当前图不变，智能合并节点内容和交叉概念 */
  function handleMergeProject(project: Project) {
    if (!vennData) return;
    const other = JSON.parse(project.data) as VennData;

    // 深度合并两棵子树：按 label 匹配同名节点，不同名的追加
    function mergeChildren(kept: VennNode[], incoming: VennNode[]): VennNode[] {
      const result = kept.map((k) => ({ ...k, children: k.children ? [...k.children] : [] }));
      for (const inc of incoming) {
        const match = result.find((r) => r.label.trim() === inc.label.trim());
        if (match) {
          // 合并 content
          const kContent = match.wikiContent || match.description || "";
          const iContent = inc.wikiContent || inc.description || "";
          if (iContent && iContent !== kContent) {
            match.wikiContent = kContent
              ? kContent + "\n\n---\n（合并补充）\n" + iContent
              : iContent;
          }
          // 合并 description（如果当前为空则取对方的）
          if (!match.description && inc.description) {
            match.description = inc.description;
          }
          // 递归合并 children
          if (inc.children && inc.children.length > 0) {
            match.children = mergeChildren(match.children || [], inc.children);
          }
        } else {
          // 新节点，直接追加
          result.push({ ...inc, children: inc.children || [] });
        }
      }
      return result;
    }

    // 按 label 匹配顶层节点并合并
    const mergedNodes = mergeChildren(vennData.nodes, other.nodes);

    // 交叉结构保持当前图不变，只对匹配的 relation 合并 sharedConcepts
    const relLabelKey = (sets: string[], nodes: VennNode[]) =>
      sets.map((id) => nodes.find((n) => n.id === id)?.label?.trim() || "").sort().join(",");
    const mergedRelations = vennData.relations.map((rel) => {
      const relLabels = relLabelKey(rel.sets, vennData.nodes);
      // 找 other 中所有 sets 包含相同 label 组合的 relation（可能有多个）
      const matchingOtherRels = other.relations.filter((r) => {
        const oLabels = relLabelKey(r.sets, other.nodes);
        return oLabels === relLabels;
      });
      if (matchingOtherRels.length === 0) return rel;
      const allConcepts = [...rel.sharedConcepts];
      for (const oRel of matchingOtherRels) {
        for (const c of oRel.sharedConcepts) {
          if (!allConcepts.includes(c)) allConcepts.push(c);
        }
      }
      return { ...rel, sharedConcepts: allConcepts };
    });

    // 合并 summary
    const mergedSummary = vennData.summary && other.summary && vennData.summary !== other.summary
      ? vennData.summary + "；" + other.summary
      : vennData.summary || other.summary;

    setVennData({
      ...vennData,
      nodes: mergedNodes,
      relations: mergedRelations,
      summary: mergedSummary,
    });
    setShowProjects(false);
  }

  function handleNew() {
    setText("");
    setVennData(null);
    setCurrentProjectId(null);
    setError("");
    setShowProjects(false);
    setShowInsights(false);
  }

  async function handleSummarize() {
    if (!vennData) return;
    setSummarizing(true);
    setError("");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vennData),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "摘要生成失败");
      }
      const { insights } = await res.json();
      setVennData({ ...vennData, insights });
      setShowInsights(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "摘要生成失败");
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="flex-none border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight cursor-pointer" onClick={handleNew}>
            <span className="text-blue-400">Venn</span> AI
          </h1>
          <button
            onClick={() => { setShowProjects(!showProjects); }}
            className="text-xs px-3 py-1.5 rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            我的维恩图 {projects.length > 0 && `(${projects.length})`}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {vennData && (
            <>
              <button
                onClick={handleSummarize}
                disabled={summarizing}
                className="text-xs px-3 py-1.5 rounded-md bg-purple-700 text-white hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 transition-colors"
              >
                {summarizing ? "生成中..." : vennData.insights ? "更新摘要" : "生成摘要"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded-md bg-green-700 text-white hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 transition-colors"
              >
                {saving ? "保存中..." : currentProjectId ? "保存" : "保存到云端"}
              </button>
            </>
          )}
          <span className="text-xs text-gray-500">
            AI 概念维恩图生成器
          </span>
        </div>
      </header>

      {/* Project list drawer */}
      {showProjects && (
        <div className="flex-none border-b border-gray-800 bg-gray-900 max-h-[300px] overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-300">已保存的维恩图</span>
              <button onClick={handleNew} className="text-xs text-blue-400 hover:text-blue-300">+ 新建</button>
            </div>
            {projects.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">还没有保存的维恩图</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {projects.map((p) => {
                  const pData = JSON.parse(p.data) as VennData;
                  const isCurrent = currentProjectId === p.id;
                  const mergeable = vennData && !isCurrent && canMergeWith(pData);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleOpenProject(p)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isCurrent
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-gray-700 hover:border-gray-600 bg-gray-800/50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="text-sm font-medium text-gray-200 truncate flex-1">
                          {pData.title || p.name}
                        </div>
                        <button
                          onClick={(e) => handleDeleteProject(p.id, e)}
                          className="text-gray-600 hover:text-red-400 ml-2 text-xs"
                        >✕</button>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {pData.nodes.length} 个集合 · {new Date(p.updated_at).toLocaleDateString()}
                      </div>
                      {mergeable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`将「${pData.title || p.name}」的内容合并到当前图？`)) {
                              handleMergeProject(p);
                            }
                          }}
                          className="mt-1.5 w-full text-xs py-1 rounded bg-orange-700/50 border border-orange-600 text-orange-200 hover:bg-orange-600/50 transition-colors"
                        >
                          合并到当前
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="w-[400px] flex-none border-r border-gray-800 flex flex-col">
          {/* Side panel tabs: 新建 | 我的Wiki百科 */}
          {vennData && (
            <div className="flex-none border-b border-gray-800 px-4 pt-3 pb-0">
              <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setSidePanel("input")}
                  className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${sidePanel === "input" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
                >
                  新建
                </button>
                <button
                  onClick={() => setSidePanel("wiki")}
                  className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${sidePanel === "wiki" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
                >
                  我的Wiki百科
                </button>
              </div>
            </div>
          )}

          {/* Input panel */}
          {sidePanel === "input" && (
            <>
              <div className="p-4 flex-1 flex flex-col min-h-0" suppressHydrationWarning>
                {/* Mode toggle */}
                <div className="flex gap-1 mb-3 bg-gray-800 rounded-lg p-0.5" suppressHydrationWarning>
                  <button
                    onClick={() => { setMode("collect"); setExpandedText(null); }}
                    className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${mode === "collect" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
                  >
                    收集
                  </button>
                  <button
                    onClick={() => { setMode("organize"); setExpandedText(null); }}
                    className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${mode === "organize" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
                  >
                    整理
                  </button>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">
                    {mode === "collect" ? "输入关键词 / 标题" : "粘贴文档内容"}
                  </label>
                  <div className="flex items-center gap-2">
                    {mode === "organize" ? (
                      <>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          上传文件
                        </button>
                        <button
                          onClick={() => { setText(EXAMPLE_TEXT); setVennData(EXAMPLE_DATA); setError(""); setCurrentProjectId(null); }}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          AI示例
                        </button>
                        <button
                          onClick={() => { setText(BIO_EXAMPLE_TEXT); setVennData(null); setError(""); setCurrentProjectId(null); }}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          生物示例
                        </button>
                      </>
                    ) : (
                      <>
                        {TEMPLATES.map((t) => (
                          <button
                            key={t.label}
                            onClick={() => setText(t.placeholder)}
                            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                          >
                            {t.label}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <p className="text-xs text-gray-600 mb-2">
                  {mode === "collect"
                    ? expandedText
                      ? "AI 已展开关键词，你可以编辑后确认生成维恩图"
                      : "输入 2-3 个并列概念，AI 会帮你展开子概念和交叉关系"
                    : "支持 .txt / .md / .docx 格式，最大 5 万字。上传后自动转为纯文本，AI 将严格依据原文提取概念层级和交叉关系，不会自行扩展。"}
                </p>

                {/* Collect mode: show expanded text for editing */}
                {mode === "collect" && expandedText ? (
                  <>
                    <textarea
                      value={expandedText}
                      onChange={(e) => setExpandedText(e.target.value)}
                      className="flex-1 bg-gray-900 border border-blue-500/50 rounded-lg p-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      onClick={() => setExpandedText(null)}
                      className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors self-start"
                    >
                      返回修改关键词
                    </button>
                  </>
                ) : (
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={mode === "collect"
                      ? "例：机器学习、自然语言处理、计算机视觉"
                      : "在此粘贴笔记 / 文档内容，或点击上方「上传文件」导入..."}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600"
                  />
                )}

                {/* Max levels selector */}
                <div className="flex items-center justify-between mt-2 mb-1">
                  <span className="text-xs text-gray-500">生成层级</span>
                  <div className="flex gap-1">
                    {[2, 3].map((n) => (
                      <button
                        key={n}
                        onClick={() => setMaxLevels(n)}
                        className={`text-xs px-2.5 py-1 rounded-md transition-colors ${maxLevels === n ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}
                      >
                        {n}层
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={loading || expanding || (expandedText ? false : !text.trim())}
                  className={`mt-1 w-full py-2.5 ${expandedText ? "bg-green-600 hover:bg-green-500" : "bg-blue-600 hover:bg-blue-500"} disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium text-sm transition-colors`}
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
                      生成中...
                    </span>
                  ) : expanding ? (
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
                      AI 展开中...
                    </span>
                  ) : expandedText ? (
                    "确认生成维恩图"
                  ) : mode === "collect" ? (
                    "AI 展开"
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
                    识别到 {vennData.nodes.length} 个集合 / {vennData.relations.length} 组关联 · 知识量 {estimateDataDensity(vennData)} 字
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

              {/* AI Insights panel */}
              {vennData?.insights && showInsights && (
                <div className="border-t border-gray-800 p-4 max-h-[300px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-purple-400">知识摘要</span>
                    <button
                      onClick={() => setShowInsights(false)}
                      className="text-xs text-gray-600 hover:text-gray-400"
                    >收起</button>
                  </div>
                  <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap prose-sm">
                    {vennData.insights}
                  </div>
                </div>
              )}
              {vennData?.insights && !showInsights && (
                <div className="border-t border-gray-800 px-4 py-2">
                  <button
                    onClick={() => setShowInsights(true)}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    展开知识摘要
                  </button>
                </div>
              )}
            </>
          )}

          {/* Wiki panel */}
          {sidePanel === "wiki" && vennData && (
            <div className="flex-1 min-h-0">
              <WikiPanel
                data={vennData}
                onDataChange={setVennData}
                selectedNodeId={wikiSelectedNodeId}
                onSelectNode={setWikiSelectedNodeId}
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0" onClick={() => showProjects && setShowProjects(false)}>
          {vennData ? (
            <VennDiagram
              data={vennData}
              onDataChange={setVennData}
              onDeepAnalyze={handleDeepAnalyze}
              deepAnalyzing={deepAnalyzing}
              onOpenWiki={(nodeId) => {
                setWikiSelectedNodeId(nodeId);
                setSidePanel("wiki");
              }}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-600">
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
                <p className="text-sm">粘贴文本或上传文件，点击生成即可创建维恩图</p>
              </div>
              <div className="mt-12 space-y-3">
                <div className="flex items-center justify-center gap-2 opacity-50 hover:opacity-80 transition-opacity">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/John_Venn_2.jpg/250px-John_Venn_2.jpg"
                    alt="John Venn"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="text-xs text-gray-500">
                    致敬维恩图发明者{" "}
                    <a
                      href="https://en.wikipedia.org/wiki/John_Venn"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-300 underline"
                    >
                      John Venn (1834-1923)
                    </a>
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 opacity-50 hover:opacity-80 transition-opacity">
                  <img
                    src="https://avatars.githubusercontent.com/u/241138?v=4"
                    alt="Andrej Karpathy"
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-xs text-gray-500">
                    Wiki 模式基于{" "}
                    <a
                      href="https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-300 underline"
                    >
                      Andrej Karpathy 的 LLM Wiki
                    </a>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
