# 研批

上海交通大学数字文创与管理专业课教师风格 AI 批改工作台。支持评分规则与口吻保存、图片/PDF/文字答案、名词解释/简答题/论述题专项批改、结果编辑，以及确认后一键复制“分数 + 评语”。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:4173`。不配置密钥时使用演示模式，批改与复制流程仍可使用。

## 接入真实 AI

复制 `.env.example` 为 `.env` 并填写 `DEEPSEEK_API_KEY`。项目启动时会自动读取该文件：

```bash
npm run dev
```

默认使用 `deepseek-v4-pro` 处理文字答案，上传图片时使用 `deepseek-v4-flash-vision-exp`。API 密钥仅由服务端读取，不会发送到浏览器或写入本地存储。PDF 目前需要同时粘贴文字，或转换成图片上传。

## 验证

```bash
npm test
npm run build
```

## 云平台部署

项目可直接作为 Node Web Service 部署。构建命令使用 `npm install && npm run build`，启动命令使用 `npm start`。在云平台中配置 `.env.example` 列出的环境变量，不要上传本地 `.env`；`PORT` 通常由平台自动注入。

仓库内的 `render.yaml` 可用于 Render Blueprint 部署。首次创建时填写 `DEEPSEEK_API_KEY` 和可选的 `DEMO_PUBLIC_PASSWORD`；此后每次推送到 GitHub 的 `main` 分支都会自动构建并发布。
