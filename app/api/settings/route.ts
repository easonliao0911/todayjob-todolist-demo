import { createSetting, listSettings } from "@/lib/db";
import { PERSON_ROLES, type PersonRole, type SettingType } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const settingTypes = new Set<SettingType>(["person", "category"]);
const personRoles = new Set(PERSON_ROLES.map((item) => item.value));

export async function GET() {
  const settings = await listSettings();
  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { type?: SettingType; label?: string; role?: PersonRole; email?: string };
  const label = body.label?.trim();
  const email = body.email?.trim() ?? "";

  if (!body.type || !settingTypes.has(body.type)) {
    return NextResponse.json({ error: "type is invalid" }, { status: 400 });
  }

  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  if (body.type === "person" && body.role && !personRoles.has(body.role)) {
    return NextResponse.json({ error: "role is invalid" }, { status: 400 });
  }

  await createSetting({ type: body.type, label, role: body.role, email });
  const settings = await listSettings();
  return NextResponse.json({ settings }, { status: 201 });
}
