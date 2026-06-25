import { createTask, listTasks } from "@/lib/db";
import { TASK_QUADRANTS, TASK_STATUSES, type TaskInput } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const statusValues = new Set(TASK_STATUSES.map((item) => item.value));
const quadrantValues = new Set(TASK_QUADRANTS.map((item) => item.value));

function normalizeTaskInput(body: Partial<TaskInput>) {
  const required = ["brandName", "projectCode", "projectName", "taskCategory", "assigner", "assignee", "dueAt"];
  for (const key of required) {
    if (!String(body[key as keyof TaskInput] ?? "").trim()) {
      return { error: `${key} is required` };
    }
  }

  const due = new Date(String(body.dueAt));
  if (Number.isNaN(due.getTime())) {
    return { error: "dueAt is invalid" };
  }

  if (!statusValues.has(body.status ?? "not_started")) {
    return { error: "status is invalid" };
  }

  if (!quadrantValues.has(body.quadrant ?? "urgent_important")) {
    return { error: "quadrant is invalid" };
  }

  const shareUrl = String(body.shareUrl ?? "").trim();
  if (shareUrl && !shareUrl.startsWith("http://") && !shareUrl.startsWith("https://")) {
    return { error: "shareUrl 必須是 http 或 https 開頭的網址" };
  }

  return {
    input: {
      brandName: String(body.brandName).trim(),
      projectCode: String(body.projectCode).trim(),
      projectName: String(body.projectName).trim(),
      taskCategory: String(body.taskCategory).trim(),
      assigner: String(body.assigner).trim(),
      assignee: String(body.assignee).trim(),
      dueAt: due.toISOString(),
      note: String(body.note ?? "").trim(),
      shareUrl,
      quadrant: body.quadrant ?? "urgent_important",
      status: body.status ?? "not_started",
    } satisfies TaskInput,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tasks = await listTasks({
    status: searchParams.get("status") ?? undefined,
    assigner: searchParams.get("assigner") ?? undefined,
    assignee: searchParams.get("assignee") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    quadrant: searchParams.get("quadrant") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
  });

  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<TaskInput>;
  const normalized = normalizeTaskInput(body);

  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const task = await createTask(normalized.input);
  return NextResponse.json({ task }, { status: 201 });
}
