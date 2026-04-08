import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProject, deleteProject } from "@/lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, text, data } = body;

  const updates: { name?: string; text?: string; data?: string } = {};
  if (name !== undefined) updates.name = name;
  if (text !== undefined) updates.text = text;
  if (data !== undefined) updates.data = JSON.stringify(data);

  updateProject(id, updates);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteProject(id);
  return NextResponse.json({ ok: true });
}
