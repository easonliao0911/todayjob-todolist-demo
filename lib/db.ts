import { createClient, type Client, type InArgs } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PEOPLE,
  type NotificationRecord,
  type NotificationStatus,
  type NotificationType,
  type PersonRole,
  type SettingOption,
  type SettingsPayload,
  type SettingType,
  type Task,
  type TaskInput,
  type TaskQuadrant,
  type TaskStatus,
} from "./types";

const dataDir = path.join(process.cwd(), "data");
const databasePath = path.join(dataDir, "today-job-to-do-list.db");
const databaseUrl = process.env.LIBSQL_URL ?? `file:${databasePath}`;
const authToken = process.env.LIBSQL_AUTH_TOKEN;

let client: Client | null = null;
let initialized = false;

function getClient() {
  if (!process.env.LIBSQL_URL && !existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (!client) {
    client = createClient({ url: databaseUrl, authToken });
  }

  return client;
}

export async function ensureDatabase() {
  if (initialized) return getClient();

  const db = getClient();
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        brand_name TEXT NOT NULL,
        project_code TEXT NOT NULL,
        project_name TEXT NOT NULL,
        task_category TEXT NOT NULL,
        assigner TEXT NOT NULL,
        assignee TEXT NOT NULL,
        due_at TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        share_url TEXT NOT NULL DEFAULT '',
        quadrant TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_started',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee)`,
      `CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        role TEXT,
        email TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(type, label)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_settings_type ON settings(type, active, sort_order)`,
      `CREATE TABLE IF NOT EXISTS notification_records (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        recipient_email TEXT NOT NULL DEFAULT '',
        notification_type TEXT NOT NULL,
        status TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_notification_records_task_id ON notification_records(task_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_notification_records_status ON notification_records(status, created_at)`,
    ],
    "write",
  );

  await runMigrations(db);
  await seedDefaultSettings(db);
  initialized = true;
  return db;
}

async function runMigrations(db: Client) {
  const settingsColumns = await db.execute("PRAGMA table_info(settings)");
  const hasSettingsEmail = settingsColumns.rows.some((row) => String((row as Record<string, unknown>).name) === "email");

  if (!hasSettingsEmail) {
    await db.execute("ALTER TABLE settings ADD COLUMN email TEXT NOT NULL DEFAULT ''");
  }
}

async function seedDefaultSettings(db: Client) {
  const now = new Date().toISOString();

  for (const item of DEFAULT_PEOPLE) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO settings (id, type, label, role, email, sort_order, active, created_at, updated_at)
            VALUES (?, 'person', ?, ?, '', ?, 1, ?, ?)`,
      args: [randomUUID(), item.label, item.role, item.sortOrder, now, now],
    });
  }

  for (const item of DEFAULT_CATEGORIES) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO settings (id, type, label, role, email, sort_order, active, created_at, updated_at)
            VALUES (?, 'category', ?, NULL, '', ?, 1, ?, ?)`,
      args: [randomUUID(), item.label, item.sortOrder, now, now],
    });
  }
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    brandName: String(row.brand_name ?? ""),
    projectCode: String(row.project_code ?? ""),
    projectName: String(row.project_name ?? ""),
    taskCategory: String(row.task_category ?? ""),
    assigner: String(row.assigner ?? ""),
    assignee: String(row.assignee ?? ""),
    dueAt: String(row.due_at ?? ""),
    note: String(row.note ?? ""),
    shareUrl: String(row.share_url ?? ""),
    quadrant: String(row.quadrant ?? "urgent_important") as TaskQuadrant,
    status: String(row.status ?? "not_started") as TaskStatus,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

function rowToSetting(row: Record<string, unknown>): SettingOption {
  return {
    id: String(row.id),
    type: String(row.type) as SettingType,
    label: String(row.label ?? ""),
    role: row.role ? (String(row.role) as PersonRole) : null,
    email: String(row.email ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    active: Number(row.active ?? 0) === 1,
  };
}

function rowToNotificationRecord(row: Record<string, unknown>): NotificationRecord {
  return {
    id: String(row.id),
    taskId: String(row.task_id ?? ""),
    recipientName: String(row.recipient_name ?? ""),
    recipientEmail: String(row.recipient_email ?? ""),
    notificationType: String(row.notification_type ?? "new_task") as NotificationType,
    status: String(row.status ?? "generated") as NotificationStatus,
    subject: String(row.subject ?? ""),
    body: String(row.body ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listTasks(filters: {
  status?: string;
  assigner?: string;
  assignee?: string;
  category?: string;
  quadrant?: string;
  search?: string;
  sort?: string;
}) {
  const db = await ensureDatabase();
  const where: string[] = [];
  const args: InArgs = [];

  if (filters.status) {
    where.push("status = ?");
    args.push(filters.status);
  }

  if (filters.assigner) {
    where.push("assigner = ?");
    args.push(filters.assigner);
  }

  if (filters.assignee) {
    where.push("assignee = ?");
    args.push(filters.assignee);
  }

  if (filters.category) {
    where.push("task_category = ?");
    args.push(filters.category);
  }

  if (filters.quadrant) {
    where.push("quadrant = ?");
    args.push(filters.quadrant);
  }

  if (filters.search) {
    where.push(`(
      brand_name LIKE ?
      OR project_code LIKE ?
      OR project_name LIKE ?
      OR task_category LIKE ?
      OR assigner LIKE ?
      OR assignee LIKE ?
      OR note LIKE ?
    )`);
    const keyword = `%${filters.search}%`;
    args.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
  }

  const result = await db.execute({
    sql: `SELECT * FROM tasks ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY ${getTaskOrderBy(filters.sort)}`,
    args,
  });

  return result.rows.map((row) => rowToTask(row as Record<string, unknown>));
}

function getTaskOrderBy(sort: string | undefined) {
  const activeFirst = "CASE WHEN status = 'completed' THEN 1 ELSE 0 END ASC";
  const statusOrder =
    "CASE status WHEN 'not_started' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'waiting_review' THEN 2 WHEN 'completed' THEN 3 ELSE 9 END";
  const levelOrder =
    "CASE quadrant WHEN 'urgent_important' THEN 0 WHEN 'urgent_not_important' THEN 1 WHEN 'important_not_urgent' THEN 2 WHEN 'not_important_not_urgent' THEN 3 ELSE 9 END";
  const direction = sort?.endsWith("_desc") ? "DESC" : "ASC";

  switch (sort) {
    case "status":
      return `${statusOrder} ASC, due_at ASC, ${levelOrder} ASC, updated_at DESC`;
    case "status_asc":
    case "status_desc":
      return `${statusOrder} ${direction}, due_at ASC, ${levelOrder} ASC, updated_at DESC`;
    case "level":
      return `${activeFirst}, ${levelOrder} ASC, due_at ASC, updated_at DESC`;
    case "level_asc":
    case "level_desc":
      return `${levelOrder} ${direction}, due_at ASC, ${statusOrder} ASC, updated_at DESC`;
    case "assignee":
      return `${activeFirst}, assignee COLLATE NOCASE ASC, due_at ASC, ${levelOrder} ASC`;
    case "vendor_asc":
    case "vendor_desc":
      return `brand_name COLLATE NOCASE ${direction}, project_code COLLATE NOCASE ${direction}, due_at ASC, updated_at DESC`;
    case "category_asc":
    case "category_desc":
      return `task_category COLLATE NOCASE ${direction}, due_at ASC, ${levelOrder} ASC, updated_at DESC`;
    case "assign_asc":
    case "assign_desc":
      return `assigner COLLATE NOCASE ${direction}, assignee COLLATE NOCASE ${direction}, due_at ASC, updated_at DESC`;
    case "due_desc":
    case "deadline_desc":
      return `due_at DESC, updated_at DESC`;
    case "due_asc":
    case "deadline_asc":
      return `due_at ASC, updated_at DESC`;
    case "link_asc":
      return `CASE WHEN share_url = '' THEN 1 ELSE 0 END ASC, share_url COLLATE NOCASE ASC, due_at ASC`;
    case "link_desc":
      return `CASE WHEN share_url = '' THEN 0 ELSE 1 END ASC, share_url COLLATE NOCASE DESC, due_at ASC`;
    case "category":
      return `${activeFirst}, task_category COLLATE NOCASE ASC, due_at ASC, ${levelOrder} ASC`;
    case "updated_desc":
      return `${activeFirst}, updated_at DESC, due_at ASC`;
    default:
      return `${activeFirst}, due_at ASC, updated_at DESC`;
  }
}

export async function getTask(id: string) {
  const db = await ensureDatabase();
  const result = await db.execute({
    sql: "SELECT * FROM tasks WHERE id = ? LIMIT 1",
    args: [id],
  });

  const row = result.rows[0];
  if (!row) return null;
  return rowToTask(row as Record<string, unknown>);
}

export async function createTask(input: TaskInput) {
  const db = await ensureDatabase();
  const now = new Date().toISOString();
  const id = randomUUID();
  const completedAt = input.status === "completed" ? now : null;

  await db.execute({
    sql: `INSERT INTO tasks (
      id, brand_name, project_code, project_name, task_category, assigner, assignee,
      due_at, note, share_url, quadrant, status, created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.brandName,
      input.projectCode,
      input.projectName,
      input.taskCategory,
      input.assigner,
      input.assignee,
      input.dueAt,
      input.note,
      input.shareUrl,
      input.quadrant,
      input.status,
      now,
      now,
      completedAt,
    ],
  });

  return getTask(id);
}

export async function updateTask(id: string, patch: Partial<TaskInput>) {
  const existing = await getTask(id);
  if (!existing) return null;

  const db = await ensureDatabase();
  const nextStatus = patch.status ?? existing.status;
  const now = new Date().toISOString();
  const completedAt =
    nextStatus === "completed" ? existing.completedAt ?? now : patch.status ? null : existing.completedAt;

  const next: TaskInput = {
    brandName: patch.brandName ?? existing.brandName,
    projectCode: patch.projectCode ?? existing.projectCode,
    projectName: patch.projectName ?? existing.projectName,
    taskCategory: patch.taskCategory ?? existing.taskCategory,
    assigner: patch.assigner ?? existing.assigner,
    assignee: patch.assignee ?? existing.assignee,
    dueAt: patch.dueAt ?? existing.dueAt,
    note: patch.note ?? existing.note,
    shareUrl: patch.shareUrl ?? existing.shareUrl,
    quadrant: patch.quadrant ?? existing.quadrant,
    status: nextStatus,
  };

  await db.execute({
    sql: `UPDATE tasks SET
      brand_name = ?,
      project_code = ?,
      project_name = ?,
      task_category = ?,
      assigner = ?,
      assignee = ?,
      due_at = ?,
      note = ?,
      share_url = ?,
      quadrant = ?,
      status = ?,
      updated_at = ?,
      completed_at = ?
    WHERE id = ?`,
    args: [
      next.brandName,
      next.projectCode,
      next.projectName,
      next.taskCategory,
      next.assigner,
      next.assignee,
      next.dueAt,
      next.note,
      next.shareUrl,
      next.quadrant,
      next.status,
      now,
      completedAt,
      id,
    ],
  });

  return getTask(id);
}

export async function deleteTask(id: string) {
  const db = await ensureDatabase();
  await db.execute({ sql: "DELETE FROM tasks WHERE id = ?", args: [id] });
}

export async function listSettings(): Promise<SettingsPayload> {
  const db = await ensureDatabase();
  const result = await db.execute({
    sql: `SELECT * FROM settings WHERE active = 1 ORDER BY type ASC, sort_order ASC, label ASC`,
    args: [],
  });

  const settings = result.rows.map((row) => rowToSetting(row as Record<string, unknown>));
  return {
    people: settings.filter((item) => item.type === "person"),
    categories: settings.filter((item) => item.type === "category"),
  };
}

export async function createSetting(input: { type: SettingType; label: string; role?: PersonRole | null; email?: string }) {
  const db = await ensureDatabase();
  const now = new Date().toISOString();
  const countResult = await db.execute({
    sql: "SELECT COUNT(*) AS count FROM settings WHERE type = ?",
    args: [input.type],
  });
  const count = Number(countResult.rows[0]?.count ?? 0);
  const id = randomUUID();

  await db.execute({
    sql: `INSERT INTO settings (id, type, label, role, email, sort_order, active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(type, label) DO UPDATE SET
            active = 1,
            role = excluded.role,
            email = excluded.email,
            updated_at = excluded.updated_at`,
    args: [
      id,
      input.type,
      input.label.trim(),
      input.type === "person" ? input.role ?? "both" : null,
      input.type === "person" ? input.email?.trim() ?? "" : "",
      (count + 1) * 10,
      now,
      now,
    ],
  });
}

export async function updateSetting(
  id: string,
  patch: { label?: string; role?: PersonRole | null; email?: string; active?: boolean },
) {
  const db = await ensureDatabase();
  const existing = await db.execute({ sql: "SELECT * FROM settings WHERE id = ? LIMIT 1", args: [id] });
  const row = existing.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const next = {
    label: patch.label?.trim() || String(row.label ?? ""),
    role:
      String(row.type) === "person"
        ? patch.role ?? ((row.role ? String(row.role) : "both") as PersonRole)
        : null,
    email: String(row.type) === "person" ? patch.email?.trim() ?? String(row.email ?? "") : "",
    active: typeof patch.active === "boolean" ? (patch.active ? 1 : 0) : Number(row.active ?? 1),
  };

  await db.execute({
    sql: "UPDATE settings SET label = ?, role = ?, email = ?, active = ?, updated_at = ? WHERE id = ?",
    args: [next.label, next.role, next.email, next.active, new Date().toISOString(), id],
  });

  return listSettings();
}

export async function listNotificationRecords(filters: { taskId?: string; status?: NotificationStatus } = {}) {
  const db = await ensureDatabase();
  const where: string[] = [];
  const args: InArgs = [];

  if (filters.taskId) {
    where.push("task_id = ?");
    args.push(filters.taskId);
  }

  if (filters.status) {
    where.push("status = ?");
    args.push(filters.status);
  }

  const result = await db.execute({
    sql: `SELECT * FROM notification_records ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY created_at DESC`,
    args,
  });

  return result.rows.map((row) => rowToNotificationRecord(row as Record<string, unknown>));
}

export async function createNotificationRecord(input: {
  taskId: string;
  recipientName: string;
  recipientEmail?: string;
  notificationType: NotificationType;
  status: NotificationStatus;
  subject: string;
  body: string;
}) {
  const db = await ensureDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO notification_records (
            id, task_id, recipient_name, recipient_email, notification_type, status, subject, body, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.taskId,
      input.recipientName.trim(),
      input.recipientEmail?.trim() ?? "",
      input.notificationType,
      input.status,
      input.subject.trim(),
      input.body,
      now,
    ],
  });

  const result = await db.execute({
    sql: "SELECT * FROM notification_records WHERE id = ? LIMIT 1",
    args: [id],
  });
  const row = result.rows[0];
  return rowToNotificationRecord(row as Record<string, unknown>);
}

