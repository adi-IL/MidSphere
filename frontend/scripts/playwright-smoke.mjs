import { chromium } from "playwright";
import fs from "fs";

const url = process.env.UI_URL || "https://midsphere.vercel.app";
const out = process.env.OUT || "ui.png";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(3000);
const body = (await page.textContent("body")) || "";
const hasMid = /MidSphere/i.test(body);
const hasRisk = /RISK|Risk/i.test(body);
const hasSwarm = /ContextSentinel|Swarm|Telemetry/i.test(body);
await page.screenshot({ path: out, fullPage: true });
const report = {
  url,
  hasMid,
  hasRisk,
  hasSwarm,
  errors: errors.slice(0, 20),
  bodySnippet: body.slice(0, 500),
};
fs.writeFileSync(out.replace(/\.png$/, "-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (!hasMid || !hasRisk) process.exit(2);
