import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DashboardShell } from "@/components/dashboard-shell";

function loadStoreMonthlySales() {
  const scriptPath = join(process.cwd(), "scripts", "export_store_monthly_sales_sql.py");
  const output = execFileSync("python", ["-X", "utf8", scriptPath], {
    cwd: process.cwd(),
    encoding: "utf-8",
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
  });

  return JSON.parse(output);
}

function loadViewSettings() {
  const settingsPath = join(process.cwd(), "data", "store-view-settings.json");
  return JSON.parse(readFileSync(settingsPath, "utf-8")) as { actualPeriod?: string };
}

export default function Home() {
  const dataPath = join(process.cwd(), "data", "dashboard-data.json");
  const data = JSON.parse(readFileSync(dataPath, "utf-8"));
  const storeMonthlySales = loadStoreMonthlySales();
  const viewSettings = loadViewSettings();

  return (
    <DashboardShell
      data={data}
      storeMonthlySales={storeMonthlySales}
      initialActualPeriod={viewSettings.actualPeriod}
      canEditPeriod={process.env.NODE_ENV !== "production"}
    />
  );
}
