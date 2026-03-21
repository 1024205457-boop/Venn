import { NextRequest, NextResponse } from "next/server";
import { analyzeConcepts } from "@/lib/zhipu";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

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

    const data = await analyzeConcepts(text.trim());
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
