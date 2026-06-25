"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Clipboard,
  Clock3,
  Copy,
  Edit3,
  Filter,
  LinkIcon,
  ListPlus,
  Loader2,
  Mail,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  buildEmailNotificationTemplate,
  formatDateTime,
  fromDatetimeLocalValue,
  getDeadlineSignal,
  getQuadrantMeta,
  toDatetimeLocalValue,
} from "@/lib/format";
import {
  DEFAULT_TASK_INPUT,
  PERSON_ROLES,
  TASK_QUADRANTS,
  TASK_SORT_OPTIONS,
  TASK_STATUSES,
  type PersonRole,
  type SettingOption,
  type SettingsPayload,
  type Task,
  type TaskInput,
  type TaskQuadrant,
  type TaskStatus,
} from "@/lib/types";

type Filters = {
  search: string;
  status: string;
  assigner: string;
  assignee: string;
  category: string;
  quadrant: string;
  sort: string;
};

type DashboardView = "manager" | "business" | "executor";

type Toast = {
  tone: "success" | "error";
  message: string;
};

const emptySettings: SettingsPayload = {
  people: [],
  categories: [],
};

const defaultFilters: Filters = {
  search: "",
  status: "",
  assigner: "",
  assignee: "",
  category: "",
  quadrant: "",
  sort: "due_asc",
};

const DASHBOARD_VIEWS: Array<{
  value: DashboardView;
  label: string;
  description: string;
  personLabel: string;
}> = [
  {
    value: "manager",
    label: "主管派工",
    description: "全部工作",
    personLabel: "人員",
  },
  {
    value: "business",
    label: "專案業務",
    description: "依業務負責專案查看",
    personLabel: "專案業務",
  },
  {
    value: "executor",
    label: "專案執行",
    description: "依執行負責工作查看",
    personLabel: "專案執行",
  },
];

function getDashboardViewMeta(view: DashboardView) {
  return DASHBOARD_VIEWS.find((item) => item.value === view) ?? DASHBOARD_VIEWS[0];
}

function normalizeDashboardView(value: string | null): DashboardView {
  return value === "business" || value === "executor" || value === "manager" ? value : "manager";
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function defaultDueLocalValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  return toDatetimeLocalValue(date.toISOString());
}

function getDueDate(value: string) {
  return value.includes("T") ? value.split("T")[0] : "";
}

function getDueTime(value: string) {
  const time = value.includes("T") ? value.split("T")[1] : "";
  return time ? time.slice(0, 5) : "18:00";
}

function mergeDueDateTime(value: string, patch: { date?: string; time?: string }) {
  const date = patch.date ?? getDueDate(value);
  const time = patch.time ?? getDueTime(value);
  if (!date) return value;
  return `${date}T${time || "18:00"}`;
}

function buildBlankForm(settings: SettingsPayload): TaskInput {
  const assigner =
    settings.people.find((person) => person.role === "assigner" || person.role === "both")?.label ??
    DEFAULT_TASK_INPUT.assigner;
  const assignee =
    settings.people.find((person) => person.role === "assignee" || person.role === "both")?.label ??
    DEFAULT_TASK_INPUT.assignee;
  const category = settings.categories[0]?.label ?? DEFAULT_TASK_INPUT.taskCategory;

  return {
    ...DEFAULT_TASK_INPUT,
    assigner,
    assignee,
    taskCategory: category,
    dueAt: defaultDueLocalValue(),
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "操作失敗");
  }
  return payload;
}

function statusBadgeClass(status: TaskStatus) {
  switch (status) {
    case "not_started":
      return "border-slate-300 bg-slate-100 text-slate-700";
    case "in_progress":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "waiting_review":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
}

function quadrantBadgeClass(quadrant: TaskQuadrant) {
  switch (quadrant) {
    case "urgent_important":
      return "border-red-200 bg-red-50 text-red-800";
    case "urgent_not_important":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "important_not_urgent":
      return "border-indigo-200 bg-indigo-50 text-indigo-800";
    case "not_important_not_urgent":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
}

function deadlineBadgeClass(tone: string) {
  switch (tone) {
    case "green":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "yellow":
      return "border-yellow-200 bg-yellow-50 text-yellow-800";
    case "orange":
      return "border-orange-200 bg-orange-50 text-orange-800";
    case "red":
      return "border-red-200 bg-red-50 text-red-800";
    case "overdue":
      return "border-neutral-900 bg-neutral-900 text-white";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function metricToneClass(tone: "red" | "orange" | "blue" | "green") {
  switch (tone) {
    case "red":
      return "border-red-200 bg-red-50 text-red-800";
    case "orange":
      return "border-orange-200 bg-orange-50 text-orange-800";
    case "blue":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "green":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

const HEADER_SORTS = {
  vendor: { asc: "vendor_asc", desc: "vendor_desc" },
  category: { asc: "category_asc", desc: "category_desc" },
  assign: { asc: "assign_asc", desc: "assign_desc" },
  due: { asc: "due_asc", desc: "due_desc" },
  status: { asc: "status_asc", desc: "status_desc" },
  level: { asc: "level_asc", desc: "level_desc" },
  deadline: { asc: "deadline_asc", desc: "deadline_desc" },
  link: { asc: "link_asc", desc: "link_desc" },
} as const;

const SORT_LABELS: Record<string, string> = {
  vendor_asc: "廠商 / 專案 A-Z",
  vendor_desc: "廠商 / 專案 Z-A",
  category_asc: "工作類別 A-Z",
  category_desc: "工作類別 Z-A",
  assign_asc: "專案業務 A-Z",
  assign_desc: "專案業務 Z-A",
  due_asc: "期限近到遠",
  due_desc: "期限遠到近",
  status_asc: "狀態正序",
  status_desc: "狀態反序",
  level_asc: "工作層級正序",
  level_desc: "工作層級反序",
  deadline_asc: "期限提醒近到遠",
  deadline_desc: "期限提醒遠到近",
  link_asc: "有連結優先",
  link_desc: "無連結優先",
};

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy copy path for browsers that block clipboard permissions.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function TaskDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<SettingsPayload>(emptySettings);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [dashboardView, setDashboardView] = useState<DashboardView>("manager");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskInput>(() => buildBlankForm(emptySettings));
  const [toast, setToast] = useState<Toast | null>(null);

  const assigners = useMemo(
    () => settings.people.filter((person) => person.role === "assigner" || person.role === "both"),
    [settings.people],
  );
  const assignees = useMemo(
    () => settings.people.filter((person) => person.role === "assignee" || person.role === "both"),
    [settings.people],
  );
  const viewMeta = getDashboardViewMeta(dashboardView);
  const viewPeople = dashboardView === "business" ? assigners : dashboardView === "executor" ? assignees : settings.people;

  function scopeFiltersForView(view: DashboardView, person: string, nextFilters: Filters): Filters {
    if (view === "business") {
      return { ...nextFilters, assigner: person };
    }

    if (view === "executor") {
      return { ...nextFilters, assignee: person };
    }

    return nextFilters;
  }

  function updateDashboardUrl(view: DashboardView, person: string, nextFilters: Filters) {
    const params = new URLSearchParams();
    params.set("view", view);

    if (view !== "manager" && person) {
      params.set("person", person);
    }

    Object.entries(nextFilters).forEach(([key, value]) => {
      if (!value) return;
      if (view === "business" && key === "assigner") return;
      if (view === "executor" && key === "assignee") return;
      if (key === "sort" && value === defaultFilters.sort) return;
      params.set(key, value);
    });

    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  async function loadData(nextFilters = filters) {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    try {
      const [tasksPayload, settingsPayload] = await Promise.all([
        fetch(`/api/tasks?${params.toString()}`).then((response) => parseResponse<{ tasks: Task[] }>(response)),
        fetch("/api/settings").then((response) => parseResponse<{ settings: SettingsPayload }>(response)),
      ]);
      setTasks(tasksPayload.tasks);
      setSettings(settingsPayload.settings);
      setForm((current) => ({
        ...buildBlankForm(settingsPayload.settings),
        ...current,
        taskCategory: current.taskCategory || settingsPayload.settings.categories[0]?.label || "",
        assigner: current.assigner || settingsPayload.settings.people[0]?.label || "",
        assignee: current.assignee || settingsPayload.settings.people[0]?.label || "",
      }));
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "讀取資料失敗" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialView = normalizeDashboardView(params.get("view"));
    const initialPerson = params.get("person") ?? "";
    const initialFilters: Filters = scopeFiltersForView(initialView, initialPerson, {
      search: params.get("search") ?? "",
      status: params.get("status") ?? "",
      assigner: params.get("assigner") ?? "",
      assignee: params.get("assignee") ?? "",
      category: params.get("category") ?? "",
      quadrant: params.get("quadrant") ?? "",
      sort: params.get("sort") ?? defaultFilters.sort,
    });

    setDashboardView(initialView);
    setSelectedPerson(initialPerson);
    setFilters(initialFilters);
    updateDashboardUrl(initialView, initialPerson, initialFilters);
    void loadData(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (loading || dashboardView === "manager" || selectedPerson || viewPeople.length === 0) return;
    void applyDashboardPerson(viewPeople[0].label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardView, loading, selectedPerson, viewPeople]);

  const metrics = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const activeTasks = tasks.filter((task) => task.status !== "completed");
    return {
      dueToday: activeTasks.filter((task) => new Date(task.dueAt) <= todayEnd).length,
      dueInThreeDays: activeTasks.filter((task) => {
        const due = new Date(task.dueAt);
        return due > todayEnd && due <= threeDays;
      }).length,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      completed: tasks.filter((task) => task.status === "completed").length,
    };
  }, [tasks]);

  async function applyFilters(next: Filters) {
    const scoped = scopeFiltersForView(dashboardView, selectedPerson, next);
    setFilters(scoped);
    updateDashboardUrl(dashboardView, selectedPerson, scoped);
    await loadData(scoped);
  }

  async function applySort(sort: string) {
    await applyFilters({ ...filters, sort });
  }

  async function applyDashboardView(nextView: DashboardView, nextPerson?: string) {
    const nextPeople = nextView === "business" ? assigners : nextView === "executor" ? assignees : settings.people;
    const requestedPerson = nextPerson ?? selectedPerson;
    const person =
      nextView === "manager"
        ? ""
        : nextPeople.some((item) => item.label === requestedPerson)
          ? requestedPerson
          : nextPeople[0]?.label ?? "";
    const nextFilters = scopeFiltersForView(nextView, person, {
      ...filters,
      assigner: "",
      assignee: "",
    });

    setDashboardView(nextView);
    setSelectedPerson(person);
    setFilters(nextFilters);
    updateDashboardUrl(nextView, person, nextFilters);
    await loadData(nextFilters);
  }

  async function applyDashboardPerson(person: string) {
    const nextFilters = scopeFiltersForView(dashboardView, person, filters);
    setSelectedPerson(person);
    setFilters(nextFilters);
    updateDashboardUrl(dashboardView, person, nextFilters);
    await loadData(nextFilters);
  }

  async function clearCurrentViewFilters() {
    const nextFilters = scopeFiltersForView(dashboardView, selectedPerson, defaultFilters);
    setFilters(nextFilters);
    updateDashboardUrl(dashboardView, selectedPerson, nextFilters);
    await loadData(nextFilters);
  }

  const sortSelectOptions = useMemo(() => {
    if (TASK_SORT_OPTIONS.some((item) => item.value === filters.sort)) {
      return TASK_SORT_OPTIONS.map((item) => ({ value: item.value, label: item.label }));
    }

    return [
      { value: filters.sort, label: SORT_LABELS[filters.sort] ?? "自訂排列" },
      ...TASK_SORT_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
    ];
  }, [filters.sort]);
  const activeScopeLabel =
    dashboardView === "manager" ? "全部工作" : selectedPerson ? `${viewMeta.personLabel}：${selectedPerson}` : `${viewMeta.personLabel}：未選擇`;
  const headerSubtitle = `${viewMeta.label}看板｜${activeScopeLabel}`;

  function openCreateDrawer() {
    setEditingTask(null);
    setForm(buildBlankForm(settings));
    setDrawerOpen(true);
  }

  function openEditDrawer(task: Task) {
    setEditingTask(task);
    setForm({
      brandName: task.brandName,
      projectCode: task.projectCode,
      projectName: task.projectName,
      taskCategory: task.taskCategory,
      assigner: task.assigner,
      assignee: task.assignee,
      dueAt: toDatetimeLocalValue(task.dueAt),
      note: task.note,
      shareUrl: task.shareUrl,
      quadrant: task.quadrant,
      status: task.status,
    });
    setDrawerOpen(true);
  }

  function closeTaskDrawer() {
    setDrawerOpen(false);
    setEditingTask(null);
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData(event.currentTarget);
      const dueAtLocal = mergeDueDateTime(form.dueAt, {
        date: String(formData.get("dueDate") ?? getDueDate(form.dueAt)),
        time: String(formData.get("dueTime") ?? getDueTime(form.dueAt)),
      });
      const body: TaskInput = {
        ...form,
        dueAt: fromDatetimeLocalValue(dueAtLocal),
      };
      const response = await fetch(editingTask ? `/api/tasks/${editingTask.id}` : "/api/tasks", {
        method: editingTask ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      await parseResponse<{ task: Task }>(response);
      setDrawerOpen(false);
      setEditingTask(null);
      setToast({
        tone: "success",
        message: editingTask ? "工作已更新" : "工作已新增",
      });
      await loadData();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "儲存失敗" });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(task: Task, status: TaskStatus) {
    try {
      const payload = await parseResponse<{ task: Task }>(
        await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }),
      );
      setTasks((current) => current.map((item) => (item.id === task.id ? payload.task : item)));
      setToast({ tone: "success", message: "狀態已更新" });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "狀態更新失敗" });
    }
  }

  async function removeTask(task: Task) {
    if (!window.confirm(`確定刪除「${task.projectName}」這筆工作？`)) return;

    try {
      await parseResponse<{ ok: boolean }>(await fetch(`/api/tasks/${task.id}`, { method: "DELETE" }));
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setToast({ tone: "success", message: "工作已刪除" });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "刪除失敗" });
    }
  }

  function getTaskRecipient(task: Task) {
    return settings.people.find((person) => person.label === task.assignee);
  }

  function buildTaskEmailTemplate(task: Task) {
    const recipient = getTaskRecipient(task);
    const dashboardUrl = `${window.location.origin}${window.location.pathname}?view=executor&person=${encodeURIComponent(
      task.assignee,
    )}`;

    return buildEmailNotificationTemplate(task, {
      recipientEmail: recipient?.email ?? "",
      dashboardUrl,
    });
  }

  async function createNotificationLog(task: Task, template: ReturnType<typeof buildEmailNotificationTemplate>) {
    await parseResponse(
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          recipientName: template.recipientName,
          recipientEmail: template.recipientEmail,
          notificationType: "new_task",
          status: "generated",
          subject: template.subject,
          body: template.body,
        }),
      }),
    );
  }

  async function copyNotification(task: Task) {
    try {
      const template = buildTaskEmailTemplate(task);
      const copied = await writeClipboardText(
        `收件人：${template.recipientName}${template.recipientEmail ? ` <${template.recipientEmail}>` : "（尚未設定 Email）"}
主旨：${template.subject}

${template.body}`,
      );

      if (copied) {
        await createNotificationLog(task, template);
        setToast({ tone: "success", message: "Email 模板已複製，並已建立通知紀錄" });
      } else {
        setToast({ tone: "error", message: "無法複製，請手動選取 Email 模板" });
      }
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "通知紀錄建立失敗" });
    }
  }

  async function openEmailDraft(task: Task) {
    const template = buildTaskEmailTemplate(task);

    if (!template.recipientEmail) {
      setToast({ tone: "error", message: "請先在更新資料庫中補上專案執行 Email" });
      return;
    }

    try {
      await createNotificationLog(task, template);
      const mailto = `mailto:${encodeURIComponent(template.recipientEmail)}?subject=${encodeURIComponent(
        template.subject,
      )}&body=${encodeURIComponent(template.body)}`;
      window.location.href = mailto;
      setToast({ tone: "success", message: "Email 草稿已開啟，並已建立通知紀錄" });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Email 草稿建立失敗" });
    }
  }

  function handleSettingsChanged(next: SettingsPayload) {
    setSettings(next);
    setForm((current) => ({
      ...current,
      taskCategory: next.categories.some((item) => item.label === current.taskCategory)
        ? current.taskCategory
        : next.categories[0]?.label ?? "",
      assigner: next.people.some((item) => item.label === current.assigner)
        ? current.assigner
        : next.people[0]?.label ?? "",
      assignee: next.people.some((item) => item.label === current.assignee)
        ? current.assignee
        : next.people[0]?.label ?? "",
    }));
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto flex w-full max-w-[1480px] gap-5 px-4 py-5 lg:px-6">
        <aside className="hidden w-64 shrink-0 flex-col justify-between rounded-md border border-line bg-white p-4 shadow-sm 2xl:flex">
          <div>
            <div className="mb-7 flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-slate-900 text-white">
                <Clipboard size={20} strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-[15px] font-semibold leading-tight">Today Job</p>
                <p className="text-[12px] text-steel">To Do List</p>
              </div>
            </div>
            <nav className="space-y-1 text-[13px] font-medium text-slate-700">
              <button className="flex w-full items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-left text-white">
                <Clock3 size={16} />
                工作儀表板
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-slate-100"
              >
                <Settings size={16} />
                設定名單
              </button>
            </nav>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[12px] leading-5 text-slate-600">
            <p className="font-semibold text-slate-900">今日事今日畢</p>
            <p>Today Job To Do List</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-4 flex flex-col gap-3 rounded-md border border-line bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-[24px] font-semibold leading-tight tracking-normal">
                今日事今日畢，Today Job To Do List
              </h1>
              <p className="mt-1 text-[13px] text-steel">{headerSubtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
                <Settings size={16} />
                更新資料庫
              </Button>
              <Button onClick={openCreateDrawer}>
                <Plus size={16} />
                新增工作
              </Button>
            </div>
          </header>

          <section className="mb-4 rounded-md border border-line bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <Label>看板模式</Label>
                <div className="flex flex-wrap gap-2">
                  {DASHBOARD_VIEWS.map((view) => (
                    <button
                      key={view.value}
                      type="button"
                      onClick={() => void applyDashboardView(view.value)}
                      className={classNames(
                        "rounded-md border px-3 py-2 text-left text-[13px] transition",
                        dashboardView === view.value
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-line bg-white text-slate-700 hover:border-slate-900",
                      )}
                    >
                      <span className="block font-semibold">{view.label}</span>
                      <span className={classNames("block text-[11px]", dashboardView === view.value ? "text-slate-200" : "text-steel")}>
                        {view.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(180px,240px)_auto] sm:items-end">
                {dashboardView !== "manager" ? (
                  <FilterSelect
                    label={viewMeta.personLabel}
                    value={selectedPerson}
                    onChange={(value) => void applyDashboardPerson(value)}
                    options={viewPeople.map((item) => ({ value: item.label, label: item.label }))}
                    includeAll={false}
                  />
                ) : (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-600">
                    目前顯示全部工作
                  </div>
                )}
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
                  檢視模式，不代表登入權限
                </div>
              </div>
            </div>
          </section>

          <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard label="今日到期 / 已逾期" value={metrics.dueToday} tone="red" />
            <MetricCard label="3天內到期" value={metrics.dueInThreeDays} tone="orange" />
            <MetricCard label="進行中" value={metrics.inProgress} tone="blue" />
            <MetricCard label="已完成" value={metrics.completed} tone="green" />
          </section>

          <section className="mb-4 rounded-md border border-line bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-[2_1_260px]">
                <Label>搜尋</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={filters.search}
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void applyFilters(filters);
                    }}
                    placeholder="廠商、專案、工作類別、備註"
                    className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-[14px] outline-none transition focus:border-slate-900"
                  />
                </div>
              </div>

              <FilterSelect
                label="狀態"
                value={filters.status}
                onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
                options={TASK_STATUSES.map((item) => ({ value: item.value, label: item.label }))}
              />
              {dashboardView !== "executor" ? (
                <FilterSelect
                  label="專案執行"
                  value={filters.assignee}
                  onChange={(value) => setFilters((current) => ({ ...current, assignee: value }))}
                  options={assignees.map((item) => ({ value: item.label, label: item.label }))}
                />
              ) : null}
              {dashboardView !== "business" ? (
                <FilterSelect
                  label="專案業務"
                  value={filters.assigner}
                  onChange={(value) => setFilters((current) => ({ ...current, assigner: value }))}
                  options={assigners.map((item) => ({ value: item.label, label: item.label }))}
                />
              ) : null}
              <FilterSelect
                label="工作類別"
                value={filters.category}
                onChange={(value) => setFilters((current) => ({ ...current, category: value }))}
                options={settings.categories.map((item) => ({ value: item.label, label: item.label }))}
              />
              <FilterSelect
                label="工作層級"
                value={filters.quadrant}
                onChange={(value) => setFilters((current) => ({ ...current, quadrant: value }))}
                options={TASK_QUADRANTS.map((item) => ({ value: item.value, label: item.shortLabel }))}
              />
              <FilterSelect
                label="排列"
                value={filters.sort}
                onChange={(value) => {
                  void applySort(value);
                }}
                options={sortSelectOptions}
                includeAll={false}
              />

              <div className="ml-auto flex flex-wrap justify-end gap-2 self-end">
                <Button variant="secondary" onClick={() => void applyFilters(filters)}>
                  <Filter size={16} />
                  套用
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    void clearCurrentViewFilters();
                  }}
                >
                  <RefreshCcw size={16} />
                  清除
                </Button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-md border border-line bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-[15px] font-semibold">工作清單</p>
                <p className="text-[12px] text-steel">依上方排列設定閱讀，可把同一狀態或同一工作層級集中檢視</p>
              </div>
              {loading ? (
                <span className="flex items-center gap-2 text-[13px] text-steel">
                  <Loader2 size={15} className="animate-spin" />
                  更新中
                </span>
              ) : (
                <span className="text-[13px] text-steel">{tasks.length} 筆工作</span>
              )}
            </div>

            {tasks.length === 0 && !loading ? (
              <EmptyState onCreate={openCreateDrawer} />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full border-collapse text-left text-[13px]">
                  <thead className="bg-slate-50 text-[12px] font-semibold text-slate-500">
                    <tr>
                      <SortableTh
                        currentSort={filters.sort}
                        sortAsc={HEADER_SORTS.vendor.asc}
                        sortDesc={HEADER_SORTS.vendor.desc}
                        onSort={(sort) => void applySort(sort)}
                      >
                        廠商 / 專案
                      </SortableTh>
                      <SortableTh
                        currentSort={filters.sort}
                        sortAsc={HEADER_SORTS.category.asc}
                        sortDesc={HEADER_SORTS.category.desc}
                        onSort={(sort) => void applySort(sort)}
                      >
                        工作類別
                      </SortableTh>
                      <SortableTh
                        currentSort={filters.sort}
                        sortAsc={HEADER_SORTS.assign.asc}
                        sortDesc={HEADER_SORTS.assign.desc}
                        onSort={(sort) => void applySort(sort)}
                      >
                        專案分工
                      </SortableTh>
                      <SortableTh
                        currentSort={filters.sort}
                        sortAsc={HEADER_SORTS.due.asc}
                        sortDesc={HEADER_SORTS.due.desc}
                        onSort={(sort) => void applySort(sort)}
                      >
                        預計完成
                      </SortableTh>
                      <SortableTh
                        currentSort={filters.sort}
                        sortAsc={HEADER_SORTS.status.asc}
                        sortDesc={HEADER_SORTS.status.desc}
                        onSort={(sort) => void applySort(sort)}
                      >
                        狀態
                      </SortableTh>
                      <SortableTh
                        currentSort={filters.sort}
                        sortAsc={HEADER_SORTS.level.asc}
                        sortDesc={HEADER_SORTS.level.desc}
                        onSort={(sort) => void applySort(sort)}
                      >
                        工作層級
                      </SortableTh>
                      <SortableTh
                        currentSort={filters.sort}
                        sortAsc={HEADER_SORTS.deadline.asc}
                        sortDesc={HEADER_SORTS.deadline.desc}
                        onSort={(sort) => void applySort(sort)}
                      >
                        期限提醒
                      </SortableTh>
                      <SortableTh
                        currentSort={filters.sort}
                        sortAsc={HEADER_SORTS.link.asc}
                        sortDesc={HEADER_SORTS.link.desc}
                        onSort={(sort) => void applySort(sort)}
                      >
                        連結
                      </SortableTh>
                      <Th>操作</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => {
                      const quadrantMeta = getQuadrantMeta(task.quadrant);
                      const deadline = getDeadlineSignal(task);

                      return (
                        <tr key={task.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                          <Td>
                            <div className="max-w-[280px]">
                              <p className="font-semibold text-slate-950">{task.brandName}</p>
                              <p className="mt-1 text-[12px] text-steel">
                                {task.projectCode} · {task.projectName}
                              </p>
                              {task.note ? <p className="mt-2 line-clamp-2 text-[12px] text-slate-500">{task.note}</p> : null}
                            </div>
                          </Td>
                          <Td>
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-[12px] font-medium text-slate-700">
                              {task.taskCategory}
                            </span>
                          </Td>
                          <Td>
                            <div className="space-y-1 text-[12px]">
                              <p>
                                <span className="text-slate-400">專案業務</span> {task.assigner}
                              </p>
                              <p>
                                <span className="text-slate-400">專案執行</span> {task.assignee}
                              </p>
                            </div>
                          </Td>
                          <Td>
                            <p className="font-medium text-slate-900">{formatDateTime(task.dueAt)}</p>
                          </Td>
                          <Td>
                            <select
                              value={task.status}
                              onChange={(event) => void updateStatus(task, event.target.value as TaskStatus)}
                              className={classNames(
                                "h-8 rounded-md border px-2 text-[12px] font-semibold outline-none",
                                statusBadgeClass(task.status),
                              )}
                            >
                              {TASK_STATUSES.map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>
                          </Td>
                          <Td>
                            <Badge className={quadrantBadgeClass(task.quadrant)}>{quadrantMeta.shortLabel}</Badge>
                          </Td>
                          <Td>
                            <div className="space-y-1">
                              <Badge className={deadlineBadgeClass(deadline.tone)}>{deadline.label}</Badge>
                              <p className="text-[12px] text-steel">{deadline.detail}</p>
                            </div>
                          </Td>
                          <Td>
                            {task.shareUrl ? (
                              <a
                                href={task.shareUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[12px] font-medium text-slate-700 hover:border-slate-900"
                              >
                                <LinkIcon size={13} />
                                開啟
                              </a>
                            ) : (
                              <span className="text-[12px] text-slate-400">無</span>
                            )}
                          </Td>
                          <Td>
                            <div className="flex flex-wrap gap-1">
                              <IconButton label="複製 Email 模板" onClick={() => void copyNotification(task)}>
                                <Copy size={15} />
                              </IconButton>
                              <IconButton label="開啟郵件草稿" onClick={() => void openEmailDraft(task)}>
                                <Mail size={15} />
                              </IconButton>
                              <IconButton label="編輯" onClick={() => openEditDrawer(task)}>
                                <Edit3 size={15} />
                              </IconButton>
                              <IconButton label="刪除" tone="danger" onClick={() => void removeTask(task)}>
                                <Trash2 size={15} />
                              </IconButton>
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </div>

      <TaskDrawer
        open={drawerOpen}
        editing={Boolean(editingTask)}
        form={form}
        setForm={setForm}
        settings={settings}
        assigners={assigners}
        assignees={assignees}
        saving={saving}
        onClose={closeTaskDrawer}
        onSubmit={submitTask}
      />

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChanged={handleSettingsChanged}
        setToast={setToast}
      />

      {toast ? (
        <div
          className={classNames(
            "fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md px-4 py-3 text-[14px] font-medium shadow-panel",
            toast.tone === "success" ? "bg-slate-950 text-white" : "bg-red-700 text-white",
          )}
        >
          {toast.tone === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "red" | "orange" | "blue" | "green" }) {
  return (
    <div className="rounded-md border border-line bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-steel">{label}</p>
        <span className={classNames("rounded-md border px-2 py-1 text-[12px] font-semibold", metricToneClass(tone))}>
          追蹤
        </span>
      </div>
      <p className="mt-3 text-[30px] font-semibold leading-none">{value}</p>
    </div>
  );
}

function TaskDrawer({
  open,
  editing,
  form,
  setForm,
  settings,
  assigners,
  assignees,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: boolean;
  form: TaskInput;
  setForm: (updater: TaskInput | ((current: TaskInput) => TaskInput)) => void;
  settings: SettingsPayload;
  assigners: SettingOption[];
  assignees: SettingOption[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className={classNames("fixed inset-0 z-40 transition", open ? "pointer-events-auto" : "pointer-events-none")}>
      <div
        className={classNames("absolute inset-0 bg-slate-950/30 transition-opacity", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <aside
        className={classNames(
          "absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col bg-white shadow-panel transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-[18px] font-semibold">{editing ? "編輯工作" : "新增工作"}</p>
            <p className="mt-1 text-[13px] text-steel">所有欄位會儲存在資料庫</p>
          </div>
          <IconButton label="關閉" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="廠商名稱">
                <Input
                  required
                  value={form.brandName}
                  onChange={(value) => setForm((current) => ({ ...current, brandName: value }))}
                  placeholder="例如 桂香食堂"
                />
              </Field>
              <Field label="專案編號">
                <Input
                  required
                  value={form.projectCode}
                  onChange={(value) => setForm((current) => ({ ...current, projectCode: value }))}
                  placeholder="例如 DEMO-001"
                />
              </Field>
            </div>

            <Field label="專案名稱">
              <Input
                required
                value={form.projectName}
                onChange={(value) => setForm((current) => ({ ...current, projectName: value }))}
                placeholder="輸入專案名稱"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="工作類別">
                <Select
                  value={form.taskCategory}
                  onChange={(value) => setForm((current) => ({ ...current, taskCategory: value }))}
                  options={settings.categories.map((item) => ({ value: item.label, label: item.label }))}
                />
              </Field>
              <Field label="預計完成日期 / 時間">
                <div className="grid gap-2">
                  <input
                    required
                    name="dueDate"
                    type="date"
                    value={getDueDate(form.dueAt)}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dueAt: mergeDueDateTime(current.dueAt, { date: event.target.value }) }))
                    }
                    className="h-10 w-full rounded-md border border-line px-3 text-[14px] outline-none transition focus:border-slate-900"
                  />
                  <input
                    required
                    name="dueTime"
                    type="time"
                    step="900"
                    value={getDueTime(form.dueAt)}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dueAt: mergeDueDateTime(current.dueAt, { time: event.target.value }) }))
                    }
                    className="h-10 w-full rounded-md border border-line px-3 text-[14px] outline-none transition focus:border-slate-900"
                  />
                </div>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="專案業務">
                <Select
                  value={form.assigner}
                  onChange={(value) => setForm((current) => ({ ...current, assigner: value }))}
                  options={assigners.map((item) => ({ value: item.label, label: item.label }))}
                />
              </Field>
              <Field label="專案執行">
                <Select
                  value={form.assignee}
                  onChange={(value) => setForm((current) => ({ ...current, assignee: value }))}
                  options={assignees.map((item) => ({ value: item.label, label: item.label }))}
                />
              </Field>
            </div>

            <Field label="工作層級">
              <div className="grid gap-2 md:grid-cols-2">
                {TASK_QUADRANTS.map((quadrant) => (
                  <button
                    key={quadrant.value}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, quadrant: quadrant.value }))}
                    className={classNames(
                      "rounded-md border px-3 py-2 text-left text-[13px] font-semibold transition",
                      form.quadrant === quadrant.value
                        ? quadrantBadgeClass(quadrant.value)
                        : "border-line bg-white text-slate-600 hover:border-slate-900",
                    )}
                  >
                    {quadrant.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="狀態">
                <Select
                  value={form.status}
                  onChange={(value) => setForm((current) => ({ ...current, status: value as TaskStatus }))}
                  options={TASK_STATUSES.map((item) => ({ value: item.value, label: item.label }))}
                />
              </Field>
              <Field label="工作表單分享連結">
                <Input
                  value={form.shareUrl}
                  onChange={(value) => setForm((current) => ({ ...current, shareUrl: value }))}
                  placeholder="https://"
                />
              </Field>
            </div>

            <Field label="備註說明">
              <textarea
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                rows={5}
                placeholder="補充工作內容、注意事項、交付格式"
                className="w-full resize-none rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none transition focus:border-slate-900"
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {editing ? "儲存更新" : "新增工作"}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function SettingsPanel({
  open,
  settings,
  onClose,
  onChanged,
  setToast,
}: {
  open: boolean;
  settings: SettingsPayload;
  onClose: () => void;
  onChanged: (settings: SettingsPayload) => void;
  setToast: (toast: Toast) => void;
}) {
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personRole, setPersonRole] = useState<PersonRole>("both");
  const [categoryName, setCategoryName] = useState("");

  async function addSetting(type: "person" | "category") {
    const label = type === "person" ? personName.trim() : categoryName.trim();
    if (!label) return;

    try {
      const payload = await parseResponse<{ settings: SettingsPayload }>(
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            label,
            role: type === "person" ? personRole : undefined,
            email: type === "person" ? personEmail : undefined,
          }),
        }),
      );
      onChanged(payload.settings);
      setPersonName("");
      setPersonEmail("");
      setCategoryName("");
      setToast({ tone: "success", message: type === "person" ? "人員已新增" : "工作類別已新增" });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "新增失敗" });
    }
  }

  return (
    <div className={classNames("fixed inset-0 z-50 transition", open ? "pointer-events-auto" : "pointer-events-none")}>
      <div
        className={classNames("absolute inset-0 bg-slate-950/30 transition-opacity", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <section
        className={classNames(
          "absolute left-1/2 top-8 flex max-h-[calc(100vh-4rem)] w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-md border border-line bg-white shadow-panel transition",
          open ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0",
        )}
      >
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-[18px] font-semibold">更新資料庫</p>
            <p className="mt-1 text-[13px] text-steel">維護人員與工作類別，新增工作時會同步使用</p>
          </div>
          <IconButton label="關閉" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="grid min-h-0 gap-5 overflow-y-auto p-5 lg:grid-cols-2">
          <div className="rounded-md border border-line p-4">
            <p className="mb-3 text-[15px] font-semibold">設定人員名單</p>
            <div className="mb-4 grid gap-2 md:grid-cols-[1fr_1.2fr_140px_auto]">
              <Input value={personName} onChange={setPersonName} placeholder="輸入人員名稱" />
              <Input type="email" value={personEmail} onChange={setPersonEmail} placeholder="輸入 Email" />
              <Select
                value={personRole}
                onChange={(value) => setPersonRole(value as PersonRole)}
                options={PERSON_ROLES.map((role) => ({ value: role.value, label: role.label }))}
              />
              <Button type="button" onClick={() => void addSetting("person")}>
                <Plus size={16} />
                新增
              </Button>
            </div>
            <div className="space-y-2">
              {settings.people.map((person) => (
                <SettingRow key={person.id} item={person} onChanged={onChanged} setToast={setToast} />
              ))}
            </div>
          </div>

          <div className="rounded-md border border-line p-4">
            <p className="mb-3 text-[15px] font-semibold">工作類別</p>
            <div className="mb-4 grid gap-2 md:grid-cols-[1fr_auto]">
              <Input value={categoryName} onChange={setCategoryName} placeholder="輸入工作類別" />
              <Button type="button" onClick={() => void addSetting("category")}>
                <Plus size={16} />
                新增
              </Button>
            </div>
            <div className="space-y-2">
              {settings.categories.map((category) => (
                <SettingRow key={category.id} item={category} onChanged={onChanged} setToast={setToast} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingRow({
  item,
  onChanged,
  setToast,
}: {
  item: SettingOption;
  onChanged: (settings: SettingsPayload) => void;
  setToast: (toast: Toast) => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [email, setEmail] = useState(item.email);
  const [role, setRole] = useState<PersonRole>(item.role ?? "both");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload = await parseResponse<{ settings: SettingsPayload }>(
        await fetch(`/api/settings/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            role: item.type === "person" ? role : undefined,
            email: item.type === "person" ? email : undefined,
          }),
        }),
      );
      onChanged(payload.settings);
      setToast({ tone: "success", message: "設定已更新" });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "更新失敗" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`確定移除「${item.label}」？既有工作紀錄不會被刪除。`)) return;
    setSaving(true);
    try {
      const payload = await parseResponse<{ settings: SettingsPayload }>(
        await fetch(`/api/settings/${item.id}`, { method: "DELETE" }),
      );
      onChanged(payload.settings);
      setToast({ tone: "success", message: "設定已移除" });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "移除失敗" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-2 md:grid-cols-[1fr_1.2fr_132px_auto_auto]">
      <Input value={label} onChange={setLabel} placeholder="名稱" />
      {item.type === "person" ? (
        <Input type="email" value={email} onChange={setEmail} placeholder="Email" />
      ) : (
        <span className="hidden md:block" />
      )}
      {item.type === "person" ? (
        <Select
          value={role}
          onChange={(value) => setRole(value as PersonRole)}
          options={PERSON_ROLES.map((option) => ({ value: option.value, label: option.label }))}
        />
      ) : (
        <span className="hidden md:block" />
      )}
      <IconButton label="儲存" onClick={() => void save()} disabled={saving}>
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
      </IconButton>
      <IconButton label="移除" tone="danger" onClick={() => void remove()} disabled={saving}>
        <Trash2 size={15} />
      </IconButton>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-5 py-10 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-md bg-slate-100 text-slate-700">
        <ListPlus size={22} />
      </div>
      <p className="text-[18px] font-semibold">目前沒有工作</p>
      <p className="mt-2 max-w-[420px] text-[13px] leading-6 text-steel">
        點擊「新增工作」建立第一筆工作。
      </p>
      <div className="mt-5">
        <Button onClick={onCreate}>
          <Plus size={16} />
          新增工作
        </Button>
      </div>
    </div>
  );
}

function Button({
  children,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={classNames(
        "inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-[13px] font-semibold transition disabled:opacity-50",
        variant === "primary" && "bg-slate-950 text-white hover:bg-slate-800",
        variant === "secondary" && "border border-line bg-white text-slate-800 hover:border-slate-900",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
      )}
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  children,
  tone = "neutral",
  disabled,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "neutral" | "danger";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={classNames(
        "grid size-8 place-items-center rounded-md border transition disabled:opacity-50",
        tone === "danger"
          ? "border-red-100 bg-red-50 text-red-700 hover:border-red-300"
          : "border-line bg-white text-slate-700 hover:border-slate-900",
      )}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-[12px] font-semibold text-slate-600">{children}</label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function Input({
  type = "text",
  value,
  onChange,
  placeholder,
  required,
}: {
  type?: "text" | "email";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      required={required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none transition focus:border-slate-900"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none transition focus:border-slate-900"
    >
      {options.length === 0 ? <option value="">尚未設定</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  includeAll = true,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  includeAll?: boolean;
  className?: string;
}) {
  return (
    <div className={classNames("min-w-[132px] flex-[1_1_132px] xl:flex-none", className)}>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-line bg-white px-3 text-[13px] outline-none transition focus:border-slate-900"
      >
        {includeAll ? <option value="">全部</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={classNames("inline-flex rounded-md border px-2 py-1 text-[12px] font-semibold", className)}>
      {children}
    </span>
  );
}

function HeaderLabel({ children }: { children: React.ReactNode }) {
  if (typeof children === "string") {
    const label = children.trim();
    const shouldSplitIntoTwoRows = /^[\u4e00-\u9fff]{4}$/.test(label);

    if (shouldSplitIntoTwoRows) {
      return (
        <span className="inline-flex flex-col items-center leading-[1.15]">
          <span>{label.slice(0, 2)}</span>
          <span>{label.slice(2)}</span>
        </span>
      );
    }

    return <span className="whitespace-nowrap leading-tight">{label}</span>;
  }

  return <span className="whitespace-nowrap leading-tight">{children}</span>;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-center">
      <HeaderLabel>{children}</HeaderLabel>
    </th>
  );
}

function SortableTh({
  children,
  currentSort,
  sortAsc,
  sortDesc,
  onSort,
}: {
  children: React.ReactNode;
  currentSort: string;
  sortAsc: string;
  sortDesc: string;
  onSort: (sort: string) => void;
}) {
  const activeAsc = currentSort === sortAsc;
  const activeDesc = currentSort === sortDesc;
  const active = activeAsc || activeDesc;

  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onSort(activeAsc ? sortDesc : sortAsc)}
        className={classNames(
          "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-center text-[12px] font-semibold leading-tight transition",
          active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-200 hover:text-slate-900",
        )}
      >
        <HeaderLabel>{children}</HeaderLabel>
        {activeAsc ? (
          <ArrowUp size={13} className="shrink-0" />
        ) : activeDesc ? (
          <ArrowDown size={13} className="shrink-0" />
        ) : (
          <ArrowUpDown size={13} className="shrink-0" />
        )}
      </button>
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}
