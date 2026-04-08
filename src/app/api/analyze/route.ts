import { NextRequest, NextResponse } from "next/server";
import { analyzeConcepts, AnalyzeMode } from "@/lib/zhipu";

export async function POST(request: NextRequest) {
  try {
    const { text, mode, maxLevels } = await request.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide text to analyze" },
        { status: 400 }
      );
    }

    if (text.length > 50000) {
      return NextResponse.json(
        { error: "Text too long. Please limit to 50,000 characters." },
        { status: 400 }
      );
    }

    const analyzeMode: AnalyzeMode = mode === "collect" ? "collect" : "organize";
    const levels = maxLevels === 2 ? 2 : 3;
    const data = await analyzeConcepts(text.trim(), analyzeMode, levels);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Analysis error:", error);
    const message = error instanceof Error ? error.message : "Failed to analyze text. Please try again.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
