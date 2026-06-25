import { createNotificationRecord, getTask, listNotificationRecords } from "@/lib/db";
import {
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
  type NotificationStatus,
  type NotificationType,
} from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const notificationTypes = new Set(NOTIFICATION_TYPES.map((item) => item.value));
const notificationStatuses = new Set(NOTIFICATION_STATUSES.map((item) => item.value));

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as NotificationStatus | null;

  if (status && !notificationStatuses.has(status)) {
    return NextResponse.json({ error: "status is invalid" }, { status: 400 });
  }

  const records = await listNotificationRecords({
    taskId: searchParams.get("taskId") ?? undefined,
    status: status ?? undefined,
  });

  return NextResponse.json({ records });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    taskId?: string;
    recipientName?: string;
    recipientEmail?: string;
    notificationType?: NotificationType;
    status?: NotificationStatus;
    subject?: string;
    body?: string;
  };
  const taskId = body.taskId?.trim();
  const recipientName = body.recipientName?.trim();
  const subject = body.subject?.trim();
  const messageBody = body.body?.trim();
  const notificationType = body.notificationType ?? "new_task";
  const status = body.status ?? "generated";

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  if (!recipientName) {
    return NextResponse.json({ error: "recipientName is required" }, { status: 400 });
  }

  if (!subject || !messageBody) {
    return NextResponse.json({ error: "subject and body are required" }, { status: 400 });
  }

  if (!notificationTypes.has(notificationType)) {
    return NextResponse.json({ error: "notificationType is invalid" }, { status: 400 });
  }

  if (!notificationStatuses.has(status)) {
    return NextResponse.json({ error: "status is invalid" }, { status: 400 });
  }

  const task = await getTask(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const record = await createNotificationRecord({
    taskId,
    recipientName,
    recipientEmail: body.recipientEmail ?? "",
    notificationType,
    status,
    subject,
    body: messageBody,
  });

  return NextResponse.json({ record }, { status: 201 });
}
