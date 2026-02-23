import "dotenv/config";
import autocannon, { type Result as AutocannonResult } from "autocannon";

type Scenario = {
  name: string;
  url: string;
  connections: number;
  duration: number;
  headers?: Record<string, string>;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseBoolean(value: string | undefined): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function runScenario(scenario: Scenario): Promise<AutocannonResult> {
  return new Promise((resolve, reject) => {
    autocannon(
      {
        url: scenario.url,
        connections: scenario.connections,
        duration: scenario.duration,
        headers: scenario.headers,
      },
      (error: Error | null, result: AutocannonResult) => {
        if (error || !result) {
          reject(error ?? new Error(`Scenario failed: ${scenario.name}`));
          return;
        }
        resolve(result);
      },
    );
  });
}

function printResult(name: string, result: AutocannonResult): void {
  const latencyP95 = Number(result.latency?.p97_5 ?? 0);
  const latencyAvg = Number(result.latency?.average ?? 0);
  const requestsAvg = Number(result.requests?.average ?? 0);
  const errors = Number(result.errors ?? 0);
  const timeouts = Number(result.timeouts ?? 0);

  console.log(`\n[PERF] ${name}`);
  console.log(`- latency avg: ${latencyAvg.toFixed(2)}ms`);
  console.log(`- latency p97.5: ${latencyP95.toFixed(2)}ms`);
  console.log(`- req/sec avg: ${requestsAvg.toFixed(2)}`);
  console.log(`- errors/timeouts: ${errors}/${timeouts}`);
}

async function loginForCookie(baseUrl: string, email: string, password: string): Promise<string | null> {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Login failed (${response.status}): ${text}`);
  }

  const cookieHeader = response.headers.get("set-cookie");
  if (!cookieHeader) return null;

  return cookieHeader.split(";")[0] ?? null;
}

async function main() {
  const baseUrl = String(process.env.PERF_BASE_URL ?? "http://127.0.0.1:5000").replace(/\/+$/, "");
  const connections = parsePositiveInt(process.env.PERF_CONNECTIONS, 30);
  const duration = parsePositiveInt(process.env.PERF_DURATION_SECONDS, 12);
  const dashboardP95BudgetMs = parsePositiveInt(process.env.PERF_DASHBOARD_P95_BUDGET_MS, 300);
  const failOnThreshold = parseBoolean(process.env.PERF_FAIL_ON_THRESHOLD);

  const scenarios: Scenario[] = [
    {
      name: "landing",
      url: `${baseUrl}/`,
      connections,
      duration,
    },
    {
      name: "auth",
      url: `${baseUrl}/auth`,
      connections,
      duration,
    },
  ];

  const results: Array<{ name: string; result: AutocannonResult }> = [];

  for (const scenario of scenarios) {
    const result = await runScenario(scenario);
    results.push({ name: scenario.name, result });
    printResult(scenario.name, result);
  }

  const perfEmail = String(process.env.PERF_EMAIL ?? "").trim();
  const perfPassword = String(process.env.PERF_PASSWORD ?? "").trim();

  let dashboardP95 = 0;

  if (perfEmail && perfPassword) {
    const cookie = await loginForCookie(baseUrl, perfEmail, perfPassword);
    if (!cookie) {
      throw new Error("Login succeeded but no session cookie was returned.");
    }

    const dashboardResult = await runScenario({
      name: "dashboard_overview",
      url: `${baseUrl}/api/dashboard/overview`,
      connections,
      duration,
      headers: {
        Cookie: cookie,
      },
    });

    results.push({ name: "dashboard_overview", result: dashboardResult });
    printResult("dashboard_overview", dashboardResult);
    dashboardP95 = Number(dashboardResult.latency?.p97_5 ?? 0);

    console.log(`\nDashboard overview p97.5 target: <= ${dashboardP95BudgetMs}ms`);
    console.log(`Dashboard overview p97.5 actual: ${dashboardP95.toFixed(2)}ms`);
  } else {
    console.log("\nSkipping /api/dashboard/overview load test (set PERF_EMAIL and PERF_PASSWORD to enable).\n");
  }

  if (failOnThreshold && dashboardP95 > 0 && dashboardP95 > dashboardP95BudgetMs) {
    throw new Error(
      `dashboard_overview p97.5 ${dashboardP95.toFixed(2)}ms exceeded budget ${dashboardP95BudgetMs}ms`,
    );
  }

  const totalErrors = results.reduce((sum, item) => sum + Number(item.result.errors ?? 0), 0);
  const totalTimeouts = results.reduce((sum, item) => sum + Number(item.result.timeouts ?? 0), 0);
  console.log(`\nPerf smoke completed. Aggregate errors/timeouts: ${totalErrors}/${totalTimeouts}`);
}

main().catch((error) => {
  console.error("Perf smoke failed:", error);
  process.exit(1);
});
