import { NextRequest, NextResponse } from "next/server";
import { expandKeywords } from "@/lib/zhipu";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "请输入关键词" }, { status: 400 });
    }

    const expanded = await expandKeywords(text.trim());
    return NextResponse.json({ text: expanded });
  } catch (error) {
    console.error("Expand error:", error);
    const message = error instanceof Error ? error.message : "展开失败，请重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
