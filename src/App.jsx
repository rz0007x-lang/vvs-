import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Copy,
  FileText,
  LockKeyhole,
  LoaderCircle,
  MessageSquareText,
  PenLine,
  RotateCcw,
  Save,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { defaultProfile, QUESTION_TYPES, sampleSubmission } from "./data.js";

const PROFILE_KEY = "yanpi-teacher-profile";

async function readApiResponse(response, fallbackMessage) {
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    const detail = raw.replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(detail || `${fallbackMessage}（HTTP ${response.status}）`);
  }
  if (!response.ok) throw new Error(data.error || `${fallbackMessage}（HTTP ${response.status}）`);
  return data;
}

function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeProfile(value) {
  if (value && value.definition && value.short && value.essay) {
    return Object.fromEntries(Object.keys(defaultProfile).map((type) => [type, { ...defaultProfile[type], ...value[type] }]));
  }
  if (value && typeof value.tone === "string") {
    return Object.fromEntries(Object.keys(defaultProfile).map((type) => [type, { ...defaultProfile[type], ...value }]));
  }
  return defaultProfile;
}

function IconButton({ label, children, ...props }) {
  return <button className="icon-button" title={label} aria-label={label} {...props}>{children}</button>;
}

function ModeBadge({ mode }) {
  return (
    <span className={`mode-badge ${mode === "ai" ? "is-ai" : ""}`}>
      <span className="mode-dot" />{mode === "ai" ? "DeepSeek 已连接" : "演示模式"}
    </span>
  );
}

function Sidebar({ page, setPage }) {
  const teacherItems = [
    ["workbench", PenLine, "批改工作台"],
    ["style", MessageSquareText, "我的批改风格"],
  ];
  return (
    <aside className="sidebar">
      <nav aria-label="主导航">
        {teacherItems.map(([value, Icon, label]) => (
          <button key={value} aria-label={label} className={page === value ? "active" : ""} onClick={() => setPage(value)}>
            <Icon size={18} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="account-block">
        <div className="avatar">林</div>
        <div><strong>林老师</strong><span>数字文创与管理</span></div>
      </div>
    </aside>
  );
}

function Header({ mode }) {
  return (
    <header className="app-header">
      <div className="brand"><span className="brand-mark"><PenLine size={18} /></span><span>研批</span><small>数字文创与管理专业课</small></div>
      <div className="header-actions">
        <ModeBadge mode={mode} />
        <IconButton label="通知"><Bell size={18} /></IconButton>
      </div>
    </header>
  );
}

function LoginScreen({ onAuthenticated }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await readApiResponse(response, "登录失败");
      onAuthenticated();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={submit}>
        <span className="login-mark"><PenLine size={22} /></span>
        <span className="eyebrow">上海交大数字文创与管理</span>
        <h1>研批工作台</h1>
        <p>请输入访问密码后继续。</p>
        <label className="login-field">
          <span>访问密码</span>
          <div><LockKeyhole size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus autoComplete="current-password" placeholder="输入访问密码" /></div>
        </label>
        {error && <div className="login-error"><CircleAlert size={15} />{error}</div>}
        <button className="primary-button login-submit" disabled={loading || !password}>{loading ? <LoaderCircle className="spin" size={18} /> : <ChevronRight size={18} />}{loading ? "正在验证……" : "进入工作台"}</button>
      </form>
    </main>
  );
}

function AttachmentPreview({ attachment, onRemove }) {
  if (!attachment) return null;
  return (
    <div className="attachment-preview">
      {attachment.type.startsWith("image/") ? <img src={attachment.dataUrl} alt="学生上传的答案" /> : <FileText size={36} />}
      <div><strong>{attachment.name}</strong><span>{Math.max(1, Math.round(attachment.size / 1024))} KB</span></div>
      <IconButton label="移除附件" onClick={onRemove}><X size={17} /></IconButton>
    </div>
  );
}

function AnswerPanel({ submission, setSubmission, attachment, setAttachment }) {
  const fileInput = useRef(null);
  const [inputMode, setInputMode] = useState("text");

  const loadFile = (file) => {
    if (!file) return;
    if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      alert("目前支持 PNG、JPG、WebP 和 PDF 文件");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert("单个文件不能超过 8MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <section className="answer-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">学生答案</span><h2>{submission.assignment}</h2></div>
        <div className="segmented-control">
          <button className={inputMode === "text" ? "active" : ""} onClick={() => setInputMode("text")}>文字</button>
          <button className={inputMode === "file" ? "active" : ""} onClick={() => setInputMode("file")}>文件</button>
        </div>
      </div>
      {inputMode === "text" ? (
        <textarea
          className="answer-editor"
          value={submission.answer}
          onChange={(event) => setSubmission({ ...submission, answer: event.target.value })}
          placeholder="粘贴学生答案……"
          aria-label="学生文字答案"
        />
      ) : (
        <div
          className="upload-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); loadFile(event.dataTransfer.files[0]); }}
        >
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => loadFile(event.target.files[0])} hidden />
          {attachment ? <AttachmentPreview attachment={attachment} onRemove={() => setAttachment(null)} /> : (
            <button onClick={() => fileInput.current?.click()} className="upload-button">
              <span className="upload-icon"><Upload size={22} /></span>
              <strong>上传学生答案</strong>
              <span>支持图片或 PDF，单个文件不超过 8MB</span>
            </button>
          )}
        </div>
      )}
      <div className="answer-footer"><span>{submission.answer.length} 字符</span><span>提交于 {submission.submittedAt}</span></div>
    </section>
  );
}

function ResultPanel({ result, feedback, setFeedback }) {
  if (!result) {
    return (
      <div className="empty-result">
        <span><Sparkles size={22} /></span>
        <strong>等待生成批改</strong>
        <p>AI 将按照右侧规则给出分数、依据和教师风格评语。</p>
      </div>
    );
  }
  return (
    <div className="result-content">
      <div className="score-summary">
        <div className="score-number"><strong>{result.score}</strong><span>/ {result.maxScore}</span></div>
        <div><span className="eyebrow">总体判断</span><p>{result.summary}</p></div>
      </div>
      <div className="dimension-list">
        {result.dimensions.map((item) => (
          <div className="dimension" key={item.name}>
            <div><strong>{item.name}</strong><span>{item.score} / {item.maxScore}</span></div>
            <div className="meter"><span style={{ width: `${Math.max(0, Math.min(100, (item.score / item.maxScore) * 100))}%` }} /></div>
            <p>{item.note}</p>
          </div>
        ))}
      </div>
      <div className="finding-columns">
        <div><h3><CheckCircle2 size={16} />做得好的</h3>{result.strengths.map((item) => <p key={item}>{item}</p>)}</div>
        <div><h3><CircleAlert size={16} />优先改进</h3>{result.problems.map((item) => <p key={item}>{item}</p>)}</div>
      </div>
      <label className="field">
        <span>给学生的评语 <small>可直接修改</small></span>
        <textarea className="feedback-editor" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
      </label>
    </div>
  );
}

function GradingControls({ submission, setSubmission, styleProfile, setStyleProfile, onTypeChange, onGrade, loading, error }) {
  const [openSection, setOpenSection] = useState("rubric");
  return (
    <div className="grading-controls">
      <div className="question-type-block">
        <div><span className="eyebrow">本题类型</span><strong>选择后按对应标准批改</strong></div>
        <div className="question-type-options" aria-label="选择题型">
          {Object.entries(QUESTION_TYPES).map(([value, preset]) => <button key={value} className={submission.questionType === value ? "active" : ""} onClick={() => onTypeChange(value)}>{preset.label}</button>)}
        </div>
      </div>
      <div className="control-section">
        <button className="section-toggle" onClick={() => setOpenSection(openSection === "rubric" ? "" : "rubric")}>
          <span><ClipboardList size={17} />评分规则</span><ChevronRight size={17} className={openSection === "rubric" ? "rotated" : ""} />
        </button>
        {openSection === "rubric" && <div className="section-body">
          <label className="compact-field"><span>满分</span><input type="number" min="1" max="200" value={submission.maxScore} onChange={(event) => setSubmission({ ...submission, maxScore: Number(event.target.value) })} /></label>
          <label className="field"><span>规则与扣分细节</span><textarea value={submission.rubric} onChange={(event) => setSubmission({ ...submission, rubric: event.target.value })} /></label>
          <label className="field"><span>参考答案 <small>用于综合比对，可留空</small></span><textarea value={submission.referenceAnswer || ""} onChange={(event) => setSubmission({ ...submission, referenceAnswer: event.target.value })} placeholder="粘贴教师参考答案、要点或标准结构……" /></label>
        </div>}
      </div>
      <div className="control-section">
        <button className="section-toggle" onClick={() => setOpenSection(openSection === "style" ? "" : "style")}>
          <span><MessageSquareText size={17} />我的批改风格</span><ChevronRight size={17} className={openSection === "style" ? "rotated" : ""} />
        </button>
        {openSection === "style" && <div className="section-body">
          <label className="field"><span>语气和方法 <small>已按本题型保存</small></span><textarea value={styleProfile.tone} onChange={(event) => setStyleProfile({ ...styleProfile, tone: event.target.value })} /></label>
          <label className="field"><span>常用口癖</span><textarea className="short" value={styleProfile.catchphrases} onChange={(event) => setStyleProfile({ ...styleProfile, catchphrases: event.target.value })} /></label>
        </div>}
      </div>
      {error && <div className="error-message"><CircleAlert size={16} />{error}</div>}
      <button className="primary-button grade-button" onClick={onGrade} disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
        {loading ? "正在分析答案……" : "生成批改结果"}
      </button>
    </div>
  );
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function Workbench({ profile, setProfile }) {
  const [submission, setSubmission] = useState(sampleSubmission);
  const [attachment, setAttachment] = useState(null);
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const styleProfile = profile[submission.questionType] || defaultProfile.short;

  const setStyleProfile = (next) => setProfile((current) => ({ ...current, [submission.questionType]: next }));

  const changeType = (questionType) => {
    const preset = QUESTION_TYPES[questionType];
    setSubmission((current) => ({ ...current, questionType, maxScore: preset.maxScore, rubric: preset.rubric }));
    setResult(null);
    setFeedback("");
    setCopied(false);
  };

  const grade = async () => {
    setLoading(true); setError(""); setCopied(false);
    try {
      const response = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...submission, ...styleProfile, attachment }),
      });
      const data = await readApiResponse(response, "批改失败");
      setResult(data); setFeedback(data.feedback);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmAndCopy = async () => {
    if (!result) return;
    const text = `${submission.student}｜${submission.assignment}\n题型：${QUESTION_TYPES[submission.questionType].label}\n得分：${result.score} / ${result.maxScore}\n评语：${feedback}`;
    try {
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setError("复制失败，请手动选中评语复制");
    }
  };

  return (
    <div className="workbench-page">
      <div className="workspace-titlebar">
        <div><span className="breadcrumb">上海交通大学 / 数字文创与管理专业课</span><h1>{submission.student}</h1></div>
        <div className={`review-state ${copied ? "done" : ""}`}>{copied ? <><Check size={15} />已复制</> : "待确认"}</div>
      </div>
      <div className="workbench-grid">
        <AnswerPanel submission={submission} setSubmission={setSubmission} attachment={attachment} setAttachment={setAttachment} />
        <aside className="review-panel">
          <GradingControls submission={submission} setSubmission={setSubmission} styleProfile={styleProfile} setStyleProfile={setStyleProfile} onTypeChange={changeType} onGrade={grade} loading={loading} error={error} />
          <section className="result-panel">
            <div className="result-heading"><h2>批改结果</h2>{result && <span>{result.mode === "ai" ? "AI 实际评分" : "演示评分"}</span>}</div>
            <ResultPanel result={result} feedback={feedback} setFeedback={setFeedback} />
          </section>
          <div className="publish-bar">
            <button className="secondary-button" onClick={() => { setResult(null); setFeedback(""); }} disabled={!result}><RotateCcw size={17} />清空</button>
            <button className="primary-button" onClick={confirmAndCopy} disabled={!result}><Copy size={17} />{copied ? "已复制，可直接粘贴" : "确认并复制结果"}</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StylePage({ profile, setProfile }) {
  const [saved, setSaved] = useState(false);
  const [selectedType, setSelectedType] = useState("short");
  const styleProfile = profile[selectedType] || defaultProfile.short;
  const setStyleProfile = (next) => setProfile((current) => ({ ...current, [selectedType]: next }));
  const save = () => { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  return (
    <main className="standard-page">
      <div className="page-intro"><span className="eyebrow">教师设置</span><h1>我的批改风格</h1><p>这里的内容会自动用于每一次批改。真实批改示例通常比单独填写口癖更有效。</p></div>
      <div className="settings-layout">
        <section className="settings-form">
          <div className="style-type-tabs" aria-label="选择要设置的题型">
            {Object.entries(QUESTION_TYPES).map(([type, preset]) => <button key={type} className={selectedType === type ? "active" : ""} onClick={() => setSelectedType(type)}>{preset.label}</button>)}
          </div>
          <p className="style-type-hint">当前设置会自动复用于每次{QUESTION_TYPES[selectedType].label}批改。</p>
          <label className="field"><span>整体语气和反馈顺序</span><textarea value={styleProfile.tone} onChange={(event) => setStyleProfile({ ...styleProfile, tone: event.target.value })} /></label>
          <label className="field"><span>常用表达或口癖</span><textarea value={styleProfile.catchphrases} onChange={(event) => setStyleProfile({ ...styleProfile, catchphrases: event.target.value })} /></label>
          <label className="field"><span>真实批改示例</span><textarea className="tall" value={styleProfile.examples} onChange={(event) => setStyleProfile({ ...styleProfile, examples: event.target.value })} /></label>
          <button className="primary-button save-profile" onClick={save}>{saved ? <Check size={17} /> : <Save size={17} />}{saved ? "已保存" : "保存批改风格"}</button>
        </section>
        <aside className="style-preview"><span className="eyebrow">效果预览</span><p><strong>整体方向是对的，</strong>但论证还停在结论层面。这个地方要注意，指出观点以后需要再补一句依据。再往前走一步，把因果关系说明白，得分会更稳。</p></aside>
      </div>
    </main>
  );
}

export default function App() {
  const [page, setPage] = useState("workbench");
  const [mode, setMode] = useState("demo");
  const [profile, setProfile] = useState(() => normalizeProfile(readStored(PROFILE_KEY, defaultProfile)));
  const [authenticated, setAuthenticated] = useState(null);

  useEffect(() => { fetch("/api/health").then((response) => response.json()).then((data) => setMode(data.mode)).catch(() => setMode("demo")); }, []);
  useEffect(() => { fetch("/api/auth/status").then((response) => response.json()).then((data) => setAuthenticated(data.authenticated)).catch(() => setAuthenticated(false)); }, []);
  useEffect(() => { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }, [profile]);

  const content = useMemo(() => {
    if (page === "workbench") return <Workbench profile={profile} setProfile={setProfile} />;
    if (page === "style") return <StylePage profile={profile} setProfile={setProfile} />;
    return <Workbench profile={profile} setProfile={setProfile} />;
  }, [page, profile]);

  if (authenticated === null) return <main className="login-page"><LoaderCircle className="spin" size={24} /></main>;
  if (!authenticated) return <LoginScreen onAuthenticated={() => setAuthenticated(true)} />;

  return (
    <div className="app-shell">
      <Header mode={mode} />
      <div className="app-body"><Sidebar page={page} setPage={setPage} />{content}</div>
    </div>
  );
}
