import { NextRequest, NextResponse } from "next/server";
import { summarizeVennData } from "@/lib/zhipu";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data || !data.nodes || !Array.isArray(data.nodes)) {
      return NextResponse.json(
        { error: "请提供有效的维恩图数据" },
        { status: 400 }
      );
    }

    const insights = await summarizeVennData(data);
    return NextResponse.json({ insights });
  } catch (error) {
    console.error("Summary error:", error);
    const message = error instanceof Error ? error.message : "摘要生成失败，请重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
