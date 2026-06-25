export const TASK_STATUSES = [
  { value: "not_started", label: "未開始" },
  { value: "in_progress", label: "進行中" },
  { value: "waiting_review", label: "待確認" },
  { value: "completed", label: "已完成" },
] as const;

export const TASK_QUADRANTS = [
  { value: "urgent_important", label: "緊急而且重要", shortLabel: "緊急而且重要" },
  { value: "urgent_not_important", label: "緊急但不重要", shortLabel: "緊急但不重要" },
  { value: "important_not_urgent", label: "重要但不緊急", shortLabel: "重要但不緊急" },
  { value: "not_important_not_urgent", label: "不重要不緊急", shortLabel: "不重要不緊急" },
] as const;

export const PERSON_ROLES = [
  { value: "assigner", label: "專案業務" },
  { value: "assignee", label: "專案執行" },
  { value: "both", label: "兩者皆可" },
] as const;

export const NOTIFICATION_TYPES = [
  { value: "new_task", label: "新工作通知" },
  { value: "task_update", label: "工作更新通知" },
  { value: "deadline_reminder", label: "期限提醒通知" },
] as const;

export const NOTIFICATION_STATUSES = [
  { value: "pending", label: "待寄出" },
  { value: "generated", label: "已產生" },
  { value: "sent", label: "已寄出" },
  { value: "failed", label: "失敗" },
] as const;

export const TASK_SORT_OPTIONS = [
  { value: "due_asc", label: "期限近到遠" },
  { value: "status", label: "狀態集中" },
  { value: "level", label: "工作層級" },
  { value: "assignee", label: "專案執行" },
  { value: "category", label: "工作類別" },
  { value: "updated_desc", label: "最近更新" },
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number]["value"];
export type TaskQuadrant = (typeof TASK_QUADRANTS)[number]["value"];
export type TaskSort = (typeof TASK_SORT_OPTIONS)[number]["value"];
export type PersonRole = (typeof PERSON_ROLES)[number]["value"];
export type SettingType = "person" | "category";
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]["value"];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]["value"];

export type Task = {
  id: string;
  brandName: string;
  projectCode: string;
  projectName: string;
  taskCategory: string;
  assigner: string;
  assignee: string;
  dueAt: string;
  note: string;
  shareUrl: string;
  quadrant: TaskQuadrant;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type TaskInput = {
  brandName: string;
  projectCode: string;
  projectName: string;
  taskCategory: string;
  assigner: string;
  assignee: string;
  dueAt: string;
  note: string;
  shareUrl: string;
  quadrant: TaskQuadrant;
  status: TaskStatus;
};

export type SettingOption = {
  id: string;
  type: SettingType;
  label: string;
  role: PersonRole | null;
  email: string;
  sortOrder: number;
  active: boolean;
};

export type SettingsPayload = {
  people: SettingOption[];
  categories: SettingOption[];
};

export type NotificationRecord = {
  id: string;
  taskId: string;
  recipientName: string;
  recipientEmail: string;
  notificationType: NotificationType;
  status: NotificationStatus;
  subject: string;
  body: string;
  createdAt: string;
};

export const DEFAULT_PEOPLE: Array<{ label: string; role: PersonRole; sortOrder: number }> = [];

export const DEFAULT_CATEGORIES = [
  "製作結案報告",
  "素材製作發包",
  "廣編稿",
  "新聞稿",
  "外出拍攝",
  "客戶溝通",
  "外發請款",
  "開立發票",
  "結帳",
  "短影音發包製作",
  "上刊截圖",
].map((label, index) => ({ label, sortOrder: (index + 1) * 10 }));

export const DEFAULT_TASK_INPUT: TaskInput = {
  brandName: "",
  projectCode: "",
  projectName: "",
  taskCategory: "製作結案報告",
  assigner: "BD-001",
  assignee: "Eason",
  dueAt: "",
  note: "",
  shareUrl: "",
  quadrant: "urgent_important",
  status: "not_started",
};
