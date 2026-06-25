import { deleteTask, getTask, updateTask } from "@/lib/db";
import { TASK_QUADRANTS, TASK_STATUSES, type TaskInput } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const statusValues = new Set(TASK_STATUSES.map((item) => item.value));
const quadrantValues = new Set(TASK_QUADRANTS.map((item) => item.value));

function normalizePatch(body: Partial<TaskInput>) {
  const patch: Partial<TaskInput> = {};

  for (const key of ["brandName", "projectCode", "projectName", "taskCategory", "assigner", "assignee", "note"] as const) {
    if (typeof body[key] === "string") {
      patch[key] = body[key].trim();
    }
  }

  if (typeof body.shareUrl === "string") {
    const url = body.shareUrl.trim();
    if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
      return { error: "shareUrl 必須是 http 或 https 開頭的網址" };
    }
    patch.shareUrl = url;
  }

  if (typeof body.dueAt === "string") {
    const due = new Date(body.dueAt);
    if (Number.isNaN(due.getTime())) return { error: "dueAt is invalid" };
    patch.dueAt = due.toISOString();
  }

  if (body.status) {
    if (!statusValues.has(body.status)) return { error: "status is invalid" };
    patch.status = body.status;
  }

  if (body.quadrant) {
    if (!quadrantValues.has(body.quadrant)) return { error: "quadrant is invalid" };
    patch.quadrant = body.quadrant;
  }

  return { patch };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const task = await getTask(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ task });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as Partial<TaskInput>;
  const normalized = normalizePatch(body);

  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const task = await updateTask(id, normalized.patch);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ task });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await deleteTask(id);
  return NextResponse.json({ ok: true });
}
