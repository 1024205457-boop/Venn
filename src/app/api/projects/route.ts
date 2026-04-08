import { NextRequest, NextResponse } from "next/server";
import { listProjects, createProject } from "@/lib/db";

export async function GET() {
  const projects = listProjects();
  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, text, data } = body;

  if (!name || !data) {
    return NextResponse.json({ error: "name and data are required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  createProject({ id, name, text: text || "", data: JSON.stringify(data), created_at: now, updated_at: now });

  return NextResponse.json({ id });
}
