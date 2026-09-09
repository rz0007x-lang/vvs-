import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { demoGrade, deepSeekGrade } from "./server/grader.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
export const app = express();
const port = Number(process.env.PORT || 4173);
const apiKey = process.env.DEEPSEEK_API_KEY;
const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const textModel = process.env.DEEPSEEK_TEXT_MODEL || "deepseek-v4-pro";
const visionModel = process.env.DEEPSEEK_VISION_MODEL || "deepseek-v4-flash-vision-exp";
const publicPassword = process.env.DEMO_PUBLIC_PASSWORD || "";
const accessToken = crypto.createHash("sha256").update(`yanpi:${publicPassword}`).digest("hex");

app.set("trust proxy", 1);
app.use(express.json({ limit: "12mb" }));

const hasAccess = (request) => {
  if (!publicPassword) return true;
  const cookies = Object.fromEntries((request.headers.cookie || "").split(";").map((item) => item.trim().split("=")));
  return cookies.yanpi_access === accessToken;
};

app.get("/api/auth/status", (request, response) => {
  response.json({ authenticated: hasAccess(request) });
});

app.post("/api/auth", (request, response) => {
  if (!publicPassword || request.body?.password === publicPassword) {
    response.set("Set-Cookie", `yanpi_access=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`);
    return response.json({ ok: true });
  }
  return response.status(401).json({ error: "访问密码不正确" });
});

app.use("/api/grade", (request, response, next) => {
  if (hasAccess(request)) return next();
  return response.status(401).json({ error: "请先输入访问密码" });
});

const gradeLimits = new Map();
app.use("/api/grade", (request, response, next) => {
  const now = Date.now();
  const key = request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.ip;
  const current = gradeLimits.get(key);
  const entry = !current || now - current.startedAt > 10 * 60 * 1000
    ? { startedAt: now, count: 0 }
    : current;
  entry.count += 1;
  gradeLimits.set(key, entry);
  if (entry.count > 20) return response.status(429).json({ error: "批改次数过多，请十分钟后再试" });
  return next();
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, mode: apiKey ? "ai" : "demo", provider: apiKey ? "deepseek" : null, model: apiKey ? textModel : null });
});

app.post("/api/grade", async (request, response) => {
  const payload = request.body || {};
  const maxScore = Number(payload.maxScore);

  if ((!payload.answer || !payload.answer.trim()) && !payload.attachment?.dataUrl) {
    return response.status(400).json({ error: "请先输入或上传学生答案" });
  }
  if (!payload.rubric?.trim()) {
    return response.status(400).json({ error: "请填写评分规则" });
  }
  if (!["definition", "short", "essay"].includes(payload.questionType)) {
    return response.status(400).json({ error: "请选择题型" });
  }
  if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 200) {
    return response.status(400).json({ error: "满分必须在 1 到 200 之间" });
  }

  try {
    const result = apiKey
      ? await deepSeekGrade({ ...payload, maxScore }, { apiKey, baseUrl, textModel, visionModel })
      : demoGrade({ ...payload, maxScore });
    return response.json(result);
  } catch (error) {
    console.error(error);
    return response.status(502).json({ error: error.message || "批改失败，请稍后重试" });
  }
});

if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
  app.use(express.static(path.join(rootDir, "dist")));
  app.use((_request, response) => response.sendFile(path.join(rootDir, "dist", "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ root: rootDir, server: { middlewareMode: true, allowedHosts: [".lhr.life"] }, appType: "spa" });
  app.use(vite.middlewares);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`研批已启动：http://127.0.0.1:${port}（${apiKey ? `DeepSeek AI 模式 · ${textModel}` : "演示模式"}）`);
  });
}
