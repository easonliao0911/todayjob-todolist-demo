import { format, formatDistanceToNowStrict } from "date-fns";
import { zhTW } from "date-fns/locale";
import { TASK_QUADRANTS, TASK_STATUSES, type Task, type TaskQuadrant, type TaskStatus } from "./types";

const ONE_DAY = 24 * 60 * 60 * 1000;

export function getStatusMeta(status: TaskStatus) {
  return TASK_STATUSES.find((item) => item.value === status) ?? TASK_STATUSES[0];
}

export function getQuadrantMeta(quadrant: TaskQuadrant) {
  return TASK_QUADRANTS.find((item) => item.value === quadrant) ?? TASK_QUADRANTS[0];
}

export function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "yyyy/MM/dd HH:mm");
}

export function toDatetimeLocalValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

export function fromDatetimeLocalValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function getDeadlineSignal(task: Pick<Task, "dueAt" | "status">, now = new Date()) {
  if (task.status === "completed") {
    return {
      label: "已完成",
      tone: "neutral",
      detail: "已結束追蹤",
    } as const;
  }

  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) {
    return {
      label: "未設定",
      tone: "neutral",
      detail: "缺少期限",
    } as const;
  }

  const diff = due.getTime() - now.getTime();
  if (diff < 0) {
    return {
      label: "已逾期",
      tone: "overdue",
      detail: formatDistanceToNowStrict(due, { locale: zhTW, addSuffix: true }),
    } as const;
  }

  if (diff < ONE_DAY) {
    return {
      label: "24小時內",
      tone: "red",
      detail: formatDistanceToNowStrict(due, { locale: zhTW, addSuffix: true }),
    } as const;
  }

  const days = Math.ceil(diff / ONE_DAY);
  if (days >= 14) {
    return { label: "綠燈", tone: "green", detail: `剩 ${days} 天` } as const;
  }

  if (days >= 7) {
    return { label: "黃燈", tone: "yellow", detail: `剩 ${days} 天` } as const;
  }

  if (days >= 2) {
    return { label: "橘燈", tone: "orange", detail: `剩 ${days} 天` } as const;
  }

  return { label: "紅燈", tone: "red", detail: `剩 ${days} 天` } as const;
}

export function buildEmailNotificationTemplate(
  task: Task,
  options: { recipientEmail?: string; dashboardUrl?: string } = {},
) {
  const dueAt = formatDateTime(task.dueAt);
  const projectLine = [task.projectCode, task.projectName].filter(Boolean).join(" ");
  const linkLine = task.shareUrl ? `\n工作表單連結：${task.shareUrl}` : "";
  const noteLine = task.note || "-";
  const dashboardLine = options.dashboardUrl ? `\n儀表板：${options.dashboardUrl}` : "";
  const subjectParts = ["今日事今日畢", task.brandName || task.projectName || "專案工作", task.taskCategory];
  const subject = subjectParts.filter(Boolean).join("｜");

  const body = `Hi ${task.assignee},

你收到新的專案工作，關於「${task.taskCategory}」的請求協助。

專案資訊：
廠商：${task.brandName || "-"}
專案：${projectLine || "-"}
工作類別：${task.taskCategory}
工作層級：${getQuadrantMeta(task.quadrant).label}
目前狀態：${getStatusMeta(task.status).label}
預計完成時間：${dueAt}

分工資訊：
專案業務：${task.assigner}
專案執行：${task.assignee}

工作內容：
${noteLine}${linkLine}${dashboardLine}

請上儀表板確認工作內容與進度。`;

  return {
    recipientName: task.assignee,
    recipientEmail: options.recipientEmail?.trim() ?? "",
    subject,
    body,
  };
}

