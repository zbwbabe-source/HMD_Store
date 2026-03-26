import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

const SETTINGS_PATH = join(process.cwd(), "data", "store-view-settings.json");
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const RATE_KEY_PATTERN = /^\d{4}$/;

type StoreViewSettings = {
  actualPeriod?: string;
  twExchangeRates?: Record<string, number>;
};

async function readSettings() {
  const raw = await readFile(SETTINGS_PATH, "utf-8");
  return JSON.parse(raw) as StoreViewSettings;
}

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "production_locked" }, { status: 403 });
  }

  const current = await readSettings();
  const body = (await request.json()) as StoreViewSettings;
  const payload: StoreViewSettings = { ...current };

  if (body.actualPeriod !== undefined) {
    if (!PERIOD_PATTERN.test(body.actualPeriod)) {
      return NextResponse.json({ error: "invalid_period" }, { status: 400 });
    }
    payload.actualPeriod = body.actualPeriod;
  }

  if (body.twExchangeRates !== undefined) {
    const nextRates: Record<string, number> = {};

    for (const [key, value] of Object.entries(body.twExchangeRates)) {
      if (!RATE_KEY_PATTERN.test(key)) {
        return NextResponse.json({ error: "invalid_rate_key" }, { status: 400 });
      }
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return NextResponse.json({ error: "invalid_rate_value" }, { status: 400 });
      }
      nextRates[key] = Number(value.toFixed(4));
    }

    payload.twExchangeRates = nextRates;
  }

  await writeFile(SETTINGS_PATH, `${JSON.stringify(payload, null, 2)}
`, "utf-8");
  return NextResponse.json(payload);
}
