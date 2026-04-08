export interface VennNode {
  id: string;
  label: string;
  description?: string;
  notes?: string;
  wikiContent?: string;
  collapsed?: boolean;
  children?: VennNode[];
}

export interface VennRelation {
  sets: string[];
  label?: string;
  sharedConcepts: string[];
}

export interface VennData {
  title?: string;
  summary?: string;
  insights?: string;
  nodes: VennNode[];
  relations: VennRelation[];
}

export interface Project {
  id: string;
  name: string;
  text: string;
  data: string; // JSON string of VennData
  created_at: number;
  updated_at: number;
}

/** 快速估算节点的知识密度（字符数） */
export function estimateNodeDensity(node: VennNode): number {
  let count = (node.label || "").length
    + (node.description || "").length
    + (node.notes || "").length
    + (node.wikiContent || "").length;
  if (node.children) {
    for (const child of node.children) {
      count += estimateNodeDensity(child);
    }
  }
  return count;
}

/** 估算整个维恩图的总知识量 */
export function estimateDataDensity(data: VennData): number {
  let count = (data.title || "").length
    + (data.summary || "").length
    + (data.insights || "").length;
  for (const node of data.nodes) {
    count += estimateNodeDensity(node);
  }
  for (const rel of data.relations) {
    count += (rel.label || "").length;
    for (const c of rel.sharedConcepts) {
      count += c.length;
    }
  }
  return count;
}

/** 在树中查找节点 */
export function findNodeById(nodes: VennNode[], id: string): VennNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** 扁平化所有节点（含 parentId） */
export interface FlatNode {
  node: VennNode;
  parentId: string | null;
  depth: number;
}

export function flattenNodes(nodes: VennNode[], parentId: string | null = null, depth = 0): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    result.push({ node, parentId, depth });
    if (node.children) {
      result.push(...flattenNodes(node.children, node.id, depth + 1));
    }
  }
  return result;
}

/** 知识密度等级：稀疏/适中/丰富 */
export function densityLevel(charCount: number): "sparse" | "moderate" | "rich" {
  if (charCount < 20) return "sparse";
  if (charCount < 100) return "moderate";
  return "rich";
}
