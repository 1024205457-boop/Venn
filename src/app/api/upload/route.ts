import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  let text = "";

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    text = await file.text();
  } else if (name.endsWith(".docx")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    return NextResponse.json({ error: "Unsupported file type. Use .txt, .md or .docx" }, { status: 400 });
  }

  return NextResponse.json({ text, filename: file.name });
}
