import { NextRequest, NextResponse } from "next/server";
import { lintVennData } from "@/lib/zhipu";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data || !data.nodes || !Array.isArray(data.nodes)) {
      return NextResponse.json(
        { error: "请提供有效的维恩图数据" },
        { status: 400 }
      );
    }

    const issues = await lintVennData(data);
    return NextResponse.json({ issues });
  } catch (error) {
    console.error("Lint error:", error);
    const message = error instanceof Error ? error.message : "检查失败，请重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
