# Venn AI

用 AI 自动生成嵌套维恩图 + Wiki 知识库的笔记工具。

输入关键词或粘贴文档，AI 提取概念层级和交叉关系，生成可交互的嵌套维恩图。每个节点同时是一个 Wiki 页面，支持双向编辑——改维恩图更新 Wiki，改 Wiki 更新维恩图。

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-blue) ![D3.js](https://img.shields.io/badge/D3.js-7-orange) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8)

## 功能

**AI 维恩图生成**
- **收集模式**：输入 2-3 个关键词 → AI 展开为结构化描述 → 编辑确认 → 生成维恩图
- **整理模式**：粘贴文档或上传文件（.txt / .md / .docx）→ AI 提取概念和交叉关系
- 支持 2-3 层嵌套，子概念自动布局在父圆内部
- 交叉区域渲染共享概念，支持两两交叉和三交叉

**Wiki 知识库**
- 每个维恩图节点 = 一个 Wiki 页面
- 维恩图 ↔ Wiki 双向实时同步
- 点击维恩图节点跳转 Wiki，Wiki 编辑同步回维恩图
- 支持添加/删除/合并节点
- 基于 [Andrej Karpathy 的 LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 模式实现

**Lint 知识检查**
- AI 检测节点间内容矛盾、重复、稀疏
- 重复节点支持一键合并（保留选择 + 内容智能整合）

**维恩图合并**
- 顶层概念相同的两个维恩图可一键合并
- 交叉结构保持不变，子概念和内容智能整合

**其他**
- 项目保存/加载（SQLite）
- AI 知识摘要生成
- 节点折叠/展开
- 简洁模式（渐进式 zoom）/ 透视模式（全层级可见）
- 维恩图内直接新增节点（虚线圆 +）
- 深入分析：选中任意节点，粘贴文本生成子概念

## 快速开始

```bash
git clone https://github.com/1024205457-boop/Venn.git
cd Venn
npm install
```

创建 `.env.local`：

```
ZHIPU_API_KEY=your_api_key_here
```

AI 使用[智谱 GLM API](https://open.bigmodel.cn/)（默认 glm-4-flash 模型，免费额度足够体验）。

```bash
npm run dev
```

打开 http://localhost:3000

## 技术栈

- **前端**：Next.js 16 + React 19 + D3.js 7 + TailwindCSS 4
- **后端**：Next.js API Routes + better-sqlite3
- **AI**：智谱 GLM API（glm-4-flash）

## 致敬

<table>
  <tr>
    <td align="center">
      <a href="https://en.wikipedia.org/wiki/John_Venn">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/John_Venn_2.jpg/250px-John_Venn_2.jpg" width="60" style="border-radius:50%"><br>
        <b>John Venn</b>
      </a><br>
      <sub>维恩图发明者 (1834-1923)</sub>
    </td>
    <td align="center">
      <a href="https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f">
        <img src="https://avatars.githubusercontent.com/u/241138?v=4" width="60" style="border-radius:50%"><br>
        <b>Andrej Karpathy</b>
      </a><br>
      <sub>LLM Wiki 模式作者</sub>
    </td>
  </tr>
</table>

## License

MIT
