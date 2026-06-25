import { updateSetting } from "@/lib/db";
import { PERSON_ROLES, type PersonRole } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const personRoles = new Set(PERSON_ROLES.map((item) => item.value));

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { label?: string; role?: PersonRole; email?: string; active?: boolean };

  if (body.role && !personRoles.has(body.role)) {
    return NextResponse.json({ error: "role is invalid" }, { status: 400 });
  }

  const settings = await updateSetting(id, body);
  if (!settings) {
    return NextResponse.json({ error: "Setting not found" }, { status: 404 });
  }

  return NextResponse.json({ settings });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const settings = await updateSetting(id, { active: false });

  if (!settings) {
    return NextResponse.json({ error: "Setting not found" }, { status: 404 });
  }

  return NextResponse.json({ settings });
}
