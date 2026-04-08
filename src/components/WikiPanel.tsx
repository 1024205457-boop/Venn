"use client";

import { useState, useEffect, useRef } from "react";
import type { VennNode, VennRelation, VennData } from "@/types/venn";
import { flattenNodes, findNodeById, estimateNodeDensity, densityLevel } from "@/types/venn";

interface LintIssue {
  type: "contradiction" | "duplicate" | "sparse";
  severity: "error" | "warning" | "info";
  nodeIds: string[];
  message: string;
  suggestion?: string;
}

interface Props {
  data: VennData;
  onDataChange: (data: VennData) => void;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
}

const COLORS = ["#93c5fd", "#f9a8d4", "#86efac", "#fde047", "#d8b4fe"];

function getNodeColor(nodeId: string, data: VennData): string {
  const idx = data.nodes.findIndex((n) => {
    if (n.id === nodeId) return true;
    if (n.children) return !!findNodeById(n.children, nodeId);
    return false;
  });
  return COLORS[Math.max(0, idx) % COLORS.length];
}

function getRelationsForNode(nodeId: string, data: VennData): { relation: VennRelation; otherNode: VennNode }[] {
  const results: { relation: VennRelation; otherNode: VennNode }[] = [];
  for (const rel of data.relations) {
    if (rel.sets.includes(nodeId)) {
      for (const otherId of rel.sets) {
        if (otherId !== nodeId) {
          const other = findNodeById(data.nodes, otherId);
          if (other) results.push({ relation: rel, otherNode: other });
        }
      }
    }
  }
  return results;
}

function updateNodeInTree(nodes: VennNode[], nodeId: string, updater: (node: VennNode) => VennNode): VennNode[] {
  return nodes.map((n) => {
    if (n.id === nodeId) return updater({ ...n });
    if (n.children && n.children.length > 0) {
      return { ...n, children: updateNodeInTree(n.children, nodeId, updater) };
    }
    return n;
  });
}

export default function WikiPanel({ data, onDataChange, selectedNodeId, onSelectNode }: Props) {
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [linting, setLinting] = useState(false);
  const [lintIssues, setLintIssues] = useState<LintIssue[] | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Sync active page with external selection
  useEffect(() => {
    if (selectedNodeId) {
      setActivePageId(selectedNodeId);
    }
  }, [selectedNodeId]);

  const flat = flattenNodes(data.nodes);
  const activeNode = activePageId ? findNodeById(data.nodes, activePageId) : null;

  function navigateTo(nodeId: string) {
    setActivePageId(nodeId);
    setEditingLabel(false);
    onSelectNode?.(nodeId);
    contentRef.current?.scrollTo(0, 0);
  }

  function handleFieldChange(nodeId: string, field: "description" | "notes" | "wikiContent", value: string) {
    const newNodes = updateNodeInTree(data.nodes, nodeId, (node) => ({
      ...node,
      [field]: value,
    }));
    onDataChange({ ...data, nodes: newNodes });
  }

  function handleLabelSave(nodeId: string) {
    if (!labelDraft.trim()) { setEditingLabel(false); return; }
    const newNodes = updateNodeInTree(data.nodes, nodeId, (node) => ({
      ...node,
      label: labelDraft.trim(),
    }));
    onDataChange({ ...data, nodes: newNodes });
    setEditingLabel(false);
  }

  function handleAddChild(parentId: string) {
    const newId = parentId + "_child_" + Date.now();
    const newChild: VennNode = { id: newId, label: "新概念", description: "", children: [] };
    const newNodes = updateNodeInTree(data.nodes, parentId, (node) => ({
      ...node,
      children: [...(node.children || []), newChild],
    }));
    onDataChange({ ...data, nodes: newNodes });
    navigateTo(newId);
  }

  function handleAddTopLevel() {
    const newId = "topic_" + Date.now();
    const newNode: VennNode = { id: newId, label: "新概念", description: "", children: [] };
    onDataChange({ ...data, nodes: [...data.nodes, newNode] });
    navigateTo(newId);
  }

  function handleDeleteNode(nodeId: string) {
    function removeFromTree(nodes: VennNode[]): VennNode[] {
      return nodes
        .filter((n) => n.id !== nodeId)
        .map((n) => n.children ? { ...n, children: removeFromTree(n.children) } : n);
    }
    const newNodes = removeFromTree(data.nodes);
    const newRelations = data.relations.filter((r) => !r.sets.includes(nodeId));
    onDataChange({ ...data, nodes: newNodes, relations: newRelations });
    setActivePageId(null);
  }

  function handleMergeNodes(keepId: string, removeId: string) {
    const keepNode = findNodeById(data.nodes, keepId);
    const removeNode = findNodeById(data.nodes, removeId);
    if (!keepNode || !removeNode) return;

    // Merge children: append removeNode's children to keepNode
    const mergedChildren = [
      ...(keepNode.children || []),
      ...(removeNode.children || []).filter(
        (rc) => !(keepNode.children || []).some((kc) => kc.id === rc.id)
      ),
    ];

    // Merge content: combine wikiContent/description
    const keepContent = keepNode.wikiContent || keepNode.description || "";
    const removeContent = removeNode.wikiContent || removeNode.description || "";
    const mergedContent = keepContent && removeContent && keepContent !== removeContent
      ? keepContent + "\n\n---\n（合并自「" + removeNode.label + "」）\n" + removeContent
      : keepContent || removeContent;

    // Update the kept node
    const newNodes = updateNodeInTree(data.nodes, keepId, (node) => ({
      ...node,
      children: mergedChildren,
      wikiContent: mergedContent || undefined,
    }));

    // Remove the other node
    function removeFromTree(nodes: VennNode[]): VennNode[] {
      return nodes
        .filter((n) => n.id !== removeId)
        .map((n) => n.children ? { ...n, children: removeFromTree(n.children) } : n);
    }
    const cleanedNodes = removeFromTree(newNodes);

    // Migrate relations: replace removeId with keepId, deduplicate
    const newRelations = data.relations
      .map((r) => {
        if (!r.sets.includes(removeId)) return r;
        const newSets = r.sets.map((s) => (s === removeId ? keepId : s));
        // Deduplicate sets
        const unique = [...new Set(newSets)];
        if (unique.length < 2) return null; // self-relation after merge
        return { ...r, sets: unique };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // Deduplicate relations with same sets
    const seen = new Set<string>();
    const dedupedRelations = newRelations.filter((r) => {
      const key = [...r.sets].sort().join(",");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    onDataChange({ ...data, nodes: cleanedNodes, relations: dedupedRelations });
    setActivePageId(keepId);

    // Remove the lint issue related to these nodes
    if (lintIssues) {
      setLintIssues(lintIssues.filter(
        (issue) => !(issue.nodeIds.includes(keepId) && issue.nodeIds.includes(removeId))
      ));
    }
  }

  async function handleLint() {
    setLinting(true);
    try {
      const res = await fetch("/api/lint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("检查失败");
      const result = await res.json();
      setLintIssues(result.issues);
    } catch {
      setLintIssues([]);
    } finally {
      setLinting(false);
    }
  }

  // Render a clickable link in text
  function renderLinkedText(text: string) {
    // Match [label] patterns as internal links
    const parts = text.split(/(\[[^\]]+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[([^\]]+)\]$/);
      if (match) {
        const linkLabel = match[1];
        // Find node by label
        const targetNode = flat.find((f) => f.node.label === linkLabel);
        if (targetNode) {
          return (
            <button
              key={i}
              onClick={() => navigateTo(targetNode.node.id)}
              className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
            >
              {linkLabel}
            </button>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page list */}
      <div className="flex-none border-b border-gray-800 p-3 max-h-[240px] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500">
            {data.title || "知识库"} · {flat.length} 个概念
          </div>
          <button
            onClick={handleLint}
            disabled={linting}
            className="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-yellow-400 hover:border-yellow-600 disabled:text-gray-600 disabled:border-gray-800 transition-colors"
          >
            {linting ? "检查中..." : "Lint 检查"}
          </button>
        </div>
        <div className="space-y-0.5">
          {flat.map(({ node, depth }) => {
            const color = getNodeColor(node.id, data);
            const isActive = node.id === activePageId;
            const density = densityLevel(estimateNodeDensity(node));
            return (
              <button
                key={node.id}
                onClick={() => navigateTo(node.id)}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors flex items-center gap-1.5 ${
                  isActive ? "bg-gray-800" : "hover:bg-gray-800/50"
                }`}
                style={{ paddingLeft: 8 + depth * 16 }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-none"
                  style={{ backgroundColor: density === "sparse" ? "#6b7280" : density === "moderate" ? "#eab308" : "#22c55e" }}
                />
                <span style={{ color: isActive ? color : "#d1d5db" }} className="truncate">
                  {node.label}
                </span>
                {node.children && node.children.length > 0 && (
                  <span className="text-gray-600 flex-none">({node.children.length})</span>
                )}
              </button>
            );
          })}
          {/* Add top-level concept */}
          <button
            onClick={handleAddTopLevel}
            className="w-full text-left px-2 py-1.5 rounded text-xs text-gray-600 hover:text-gray-300 hover:bg-gray-800/50 transition-colors flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full flex-none border border-dashed border-gray-600" />
            + 新增顶层概念
          </button>
        </div>
      </div>

      {/* Lint results */}
      {lintIssues && lintIssues.length > 0 && (
        <div className="flex-none border-b border-gray-800 p-3 max-h-[200px] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-yellow-400">
              发现 {lintIssues.length} 个问题
            </span>
            <button
              onClick={() => setLintIssues(null)}
              className="text-xs text-gray-600 hover:text-gray-400"
            >关闭</button>
          </div>
          <div className="space-y-1.5">
            {lintIssues.map((issue, i) => {
              const icon = issue.severity === "error" ? "!" : issue.severity === "warning" ? "?" : "i";
              const color = issue.severity === "error" ? "text-red-400 border-red-800 bg-red-900/20" : issue.severity === "warning" ? "text-yellow-400 border-yellow-800 bg-yellow-900/20" : "text-blue-400 border-blue-800 bg-blue-900/20";
              return (
                <div key={i} className={`text-xs p-2 rounded border ${color}`}>
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold flex-none">{icon}</span>
                    <div className="flex-1">
                      <div>{issue.message}</div>
                      {issue.suggestion && (
                        <div className="text-gray-500 mt-0.5">{issue.suggestion}</div>
                      )}
                      {issue.nodeIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {issue.nodeIds.map((nid) => {
                            const node = findNodeById(data.nodes, nid);
                            return node ? (
                              <button
                                key={nid}
                                onClick={() => navigateTo(nid)}
                                className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 hover:text-white transition-colors"
                              >
                                {node.label}
                              </button>
                            ) : null;
                          })}
                          {issue.type === "duplicate" && issue.nodeIds.length === 2 && (
                            <>
                              {issue.nodeIds.map((keepId, mi) => {
                                const removeId = issue.nodeIds[1 - mi];
                                const keepNode = findNodeById(data.nodes, keepId);
                                return keepNode ? (
                                  <button
                                    key={`merge-${keepId}`}
                                    onClick={() => handleMergeNodes(keepId, removeId)}
                                    className="px-1.5 py-0.5 rounded bg-orange-900/40 border border-orange-700 text-orange-300 hover:bg-orange-800/60 hover:text-orange-200 transition-colors"
                                  >
                                    保留「{keepNode.label}」合并
                                  </button>
                                ) : null;
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {lintIssues && lintIssues.length === 0 && (
        <div className="flex-none border-b border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-green-400">没有发现问题</span>
            <button
              onClick={() => setLintIssues(null)}
              className="text-xs text-gray-600 hover:text-gray-400"
            >关闭</button>
          </div>
        </div>
      )}

      {/* Page content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-4 min-h-0">
        {activeNode ? (
          <div className="space-y-4">
            {/* Title */}
            <div>
              {editingLabel ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={labelDraft}
                    onChange={(e) => setLabelDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLabelSave(activeNode.id);
                      if (e.key === "Escape") setEditingLabel(false);
                    }}
                    className="flex-1 text-base font-bold bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-blue-500"
                  />
                  <button onClick={() => handleLabelSave(activeNode.id)} className="text-xs text-blue-400">确定</button>
                  <button onClick={() => setEditingLabel(false)} className="text-xs text-gray-500">取消</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <h2
                    className="text-base font-bold cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ color: getNodeColor(activeNode.id, data) }}
                    onClick={() => { setEditingLabel(true); setLabelDraft(activeNode.label); }}
                    title="点击编辑标题"
                  >
                    {activeNode.label}
                  </h2>
                  <button
                    onClick={() => { if (confirm(`删除「${activeNode.label}」？`)) handleDeleteNode(activeNode.id); }}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                    title="删除"
                  >删除</button>
                </div>
              )}
            </div>

            {/* Children links */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500">子概念</span>
                <button
                  onClick={() => handleAddChild(activeNode.id)}
                  className="text-xs text-gray-600 hover:text-blue-400 transition-colors"
                >+ 添加</button>
              </div>
              {activeNode.children && activeNode.children.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {activeNode.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => navigateTo(child.id)}
                      className="text-xs px-2 py-1 rounded-md border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
                    >
                      {child.label}
                      {child.children && child.children.length > 0 && (
                        <span className="text-gray-600 ml-1">+{child.children.length}</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-600">暂无子概念</div>
              )}
            </div>

            {/* Parent link */}
            {(() => {
              const parentEntry = flat.find((f) => f.node.children?.some((c) => c.id === activeNode.id));
              if (!parentEntry) return null;
              return (
                <div>
                  <div className="text-xs text-gray-500 mb-1">上级概念</div>
                  <button
                    onClick={() => navigateTo(parentEntry.node.id)}
                    className="text-xs px-2 py-1 rounded-md border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white transition-colors"
                  >
                    ← {parentEntry.node.label}
                  </button>
                </div>
              );
            })()}

            {/* Relations */}
            {(() => {
              const rels = getRelationsForNode(activeNode.id, data);
              if (rels.length === 0) return null;
              return (
                <div>
                  <div className="text-xs text-gray-500 mb-1.5">交叉关系</div>
                  <div className="space-y-1.5">
                    {rels.map(({ relation, otherNode }, i) => (
                      <div key={i} className="text-xs bg-gray-800/50 rounded-lg p-2 border border-gray-700/50">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-gray-500">与</span>
                          <button
                            onClick={() => navigateTo(otherNode.id)}
                            className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                          >
                            {otherNode.label}
                          </button>
                          {relation.label && (
                            <span className="text-gray-500">· {relation.label}</span>
                          )}
                        </div>
                        {relation.sharedConcepts.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {relation.sharedConcepts.map((c, ci) => (
                              <span key={ci} className="px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Content */}
            <div>
              <div className="text-xs text-gray-500 mb-1">详细内容</div>
              <textarea
                value={activeNode.wikiContent || activeNode.description || activeNode.notes || ""}
                onChange={(e) => handleFieldChange(activeNode.id, "wikiContent", e.target.value)}
                placeholder="在此编写详细的知识内容..."
                className="w-full h-48 bg-gray-800/50 border border-gray-700 rounded-lg p-2 text-xs text-gray-300 resize-y focus:outline-none focus:border-gray-500 placeholder:text-gray-600 leading-relaxed"
              />
            </div>

            {/* Density indicator */}
            {(() => {
              const density = estimateNodeDensity(activeNode);
              const level = densityLevel(density);
              const barColor = level === "sparse" ? "#6b7280" : level === "moderate" ? "#eab308" : "#22c55e";
              const levelLabel = level === "sparse" ? "稀疏" : level === "moderate" ? "适中" : "丰富";
              return (
                <div className="pt-2 border-t border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">知识密度</span>
                    <span className="text-xs" style={{ color: barColor }}>{density} 字 · {levelLabel}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-600">
            <div className="text-center text-xs">
              <p className="mb-1">选择左侧的概念</p>
              <p>或在维恩图中点击节点</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
