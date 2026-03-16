import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

const SETTINGS_PATH = join(process.cwd(), "data", "store-view-settings.json");
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

async function readSettings() {
  const raw = await readFile(SETTINGS_PATH, "utf-8");
  return JSON.parse(raw) as { actualPeriod?: string };
}

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "production_locked" }, { status: 403 });
  }

  const body = (await request.json()) as { actualPeriod?: string };
  if (!body.actualPeriod || !PERIOD_PATTERN.test(body.actualPeriod)) {
    return NextResponse.json({ error: "invalid_period" }, { status: 400 });
  }

  const payload = { actualPeriod: body.actualPeriod };
  await writeFile(SETTINGS_PATH, `${JSON.stringify(payload, null, 2)}
`, "utf-8");
  return NextResponse.json(payload);
}
