import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  CircleAlert,
  ClipboardList,
  Copy,
  FileText,
  LoaderCircle,
  MessageSquareText,
  PenLine,
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
    return { ...defaultProfile, ...value.short };
  }
  if (value && typeof value.tone === "string") {
    return { ...defaultProfile, ...value };
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
      <div className="feedback-block">
        <span className="eyebrow">综合意见</span>
        <p>{result.feedback}</p>
      </div>
      <div className="annotation-list">
        <span className="eyebrow">逐句意见</span>
        {result.annotations.map((item, index) => (
          <div className="annotation" key={`${item.quote}-${index}`}>
            <blockquote>“{item.quote}”</blockquote>
            <p>{item.comment}</p>
          </div>
        ))}
      </div>
      <label className="field">
        <span>最终意见 <small>可直接修改后复制</small></span>
        <textarea className="feedback-editor" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
      </label>
    </div>
  );
}

function ComparisonAnswer({ submission, attachment }) {
  return (
    <section className="comparison-answer">
      <div className="comparison-heading">
        <div><span className="eyebrow">学生答案</span><h2>{submission.assignment}</h2></div>
        <span>{QUESTION_TYPES[submission.questionType].label}</span>
      </div>
      {attachment?.type?.startsWith("image/") && <img className="comparison-image" src={attachment.dataUrl} alt="学生上传的答案" />}
      {attachment?.type === "application/pdf" && <div className="comparison-file"><FileText size={28} /><span>{attachment.name}</span></div>}
      {submission.answer && <article className="comparison-answer-text">{submission.answer}</article>}
      {!submission.answer && attachment && <p className="comparison-note">请结合左侧附件内容查看批改意见。</p>}
    </section>
  );
}

function ComparisonView({ submission, attachment, result, feedback, setFeedback, onReturn, onCopy, copied }) {
  return (
    <div className="comparison-page">
      <ComparisonAnswer submission={submission} attachment={attachment} />
      <section className="comparison-result">
        <div className="comparison-heading">
          <div><span className="eyebrow">AI 批改</span><h2>分数与意见</h2></div>
          <button className="return-button" onClick={onReturn}><ArrowLeft size={16} />返回修改</button>
        </div>
        <div className="comparison-result-scroll"><ResultPanel result={result} feedback={feedback} setFeedback={setFeedback} /></div>
        <div className="publish-bar">
          <button className="primary-button" onClick={onCopy}><Copy size={17} />{copied ? "已复制，可直接粘贴" : "确认并复制结果"}</button>
        </div>
      </section>
    </div>
  );
}

function GradingControls({ submission, setSubmission, profile, setProfile, onTypeChange, onGrade, loading, error }) {
  return (
    <div className="grading-controls">
      <div className="question-type-block">
        <div><span className="eyebrow">本题类型</span><strong>选择后按对应标准批改</strong></div>
        <div className="question-type-options" aria-label="选择题型">
          {Object.entries(QUESTION_TYPES).map(([value, preset]) => <button key={value} className={submission.questionType === value ? "active" : ""} onClick={() => onTypeChange(value)}>{preset.label}</button>)}
        </div>
      </div>
      <div className="control-section">
        <div className="section-title"><ClipboardList size={17} />评分规则</div>
        <div className="section-body">
          <label className="compact-field"><span>满分</span><input type="number" min="1" max="200" value={submission.maxScore} onChange={(event) => setSubmission({ ...submission, maxScore: Number(event.target.value) })} /></label>
          <label className="field"><span>规则与扣分细节</span><textarea value={submission.rubric} onChange={(event) => setSubmission({ ...submission, rubric: event.target.value })} /></label>
          <label className="field"><span>参考答案 <small>用于综合比对，可留空</small></span><textarea value={submission.referenceAnswer || ""} onChange={(event) => setSubmission({ ...submission, referenceAnswer: event.target.value })} placeholder="粘贴教师参考答案、要点或标准结构……" /></label>
        </div>
      </div>
      <div className="control-section">
        <div className="section-title"><MessageSquareText size={17} />批改风格 <small>全题型共用预设</small></div>
        <div className="section-body">
          <label className="field"><span>语气和方法 <small>全题型共用预设</small></span><textarea value={profile.tone} onChange={(event) => setProfile({ ...profile, tone: event.target.value })} /></label>
          <label className="field"><span>常用口癖</span><textarea className="short" value={profile.catchphrases} onChange={(event) => setProfile({ ...profile, catchphrases: event.target.value })} /></label>
        </div>
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
  const [view, setView] = useState("edit");
  const changeType = (questionType) => {
    const preset = QUESTION_TYPES[questionType];
    setSubmission((current) => ({ ...current, questionType, maxScore: preset.maxScore, rubric: preset.rubric }));
    setResult(null);
    setFeedback("");
    setCopied(false);
    setView("edit");
  };

  const grade = async () => {
    setLoading(true); setError(""); setCopied(false);
    try {
      const response = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...submission, ...profile, attachment }),
      });
      const data = await readApiResponse(response, "批改失败");
      setResult(data); setFeedback(data.feedback);
      setView("result");
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
      {view === "result" && result ? (
        <ComparisonView submission={submission} attachment={attachment} result={result} feedback={feedback} setFeedback={setFeedback} copied={copied} onCopy={confirmAndCopy} onReturn={() => { setResult(null); setFeedback(""); setCopied(false); setView("edit"); }} />
      ) : (
        <div className="workbench-grid">
          <AnswerPanel submission={submission} setSubmission={setSubmission} attachment={attachment} setAttachment={setAttachment} />
          <aside className="review-panel">
            <GradingControls submission={submission} setSubmission={setSubmission} profile={profile} setProfile={setProfile} onTypeChange={changeType} onGrade={grade} loading={loading} error={error} />
            <section className="result-panel">
              <div className="result-heading"><h2>批改结果</h2><span>生成后进入对照页</span></div>
              <ResultPanel result={null} feedback="" setFeedback={() => {}} />
            </section>
            <div className="publish-bar"><span>生成结果后可在对照页确认并复制。</span></div>
          </aside>
        </div>
      )}
    </div>
  );
}

function StylePage({ profile, setProfile }) {
  const [saved, setSaved] = useState(false);
  const save = () => { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  return (
    <main className="standard-page">
      <div className="page-intro"><span className="eyebrow">教师设置</span><h1>我的批改风格</h1><p>这里的内容会自动用于每一次批改。真实批改示例通常比单独填写口癖更有效。</p></div>
      <div className="settings-layout">
        <section className="settings-form">
          <p className="style-type-hint">保存后会自动复用于名词解释、简答题和论述题。</p>
          <label className="field"><span>整体语气和反馈顺序</span><textarea value={profile.tone} onChange={(event) => setProfile({ ...profile, tone: event.target.value })} /></label>
          <label className="field"><span>常用表达或口癖</span><textarea value={profile.catchphrases} onChange={(event) => setProfile({ ...profile, catchphrases: event.target.value })} /></label>
          <label className="field"><span>真实批改示例</span><textarea className="tall" value={profile.examples} onChange={(event) => setProfile({ ...profile, examples: event.target.value })} /></label>
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

  useEffect(() => { fetch("/api/health").then((response) => response.json()).then((data) => setMode(data.mode)).catch(() => setMode("demo")); }, []);
  useEffect(() => { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }, [profile]);

  const content = useMemo(() => {
    if (page === "workbench") return <Workbench profile={profile} setProfile={setProfile} />;
    if (page === "style") return <StylePage profile={profile} setProfile={setProfile} />;
    return <Workbench profile={profile} setProfile={setProfile} />;
  }, [page, profile]);

  return (
    <div className="app-shell">
      <Header mode={mode} />
      <div className="app-body"><Sidebar page={page} setPage={setPage} />{content}</div>
    </div>
  );
}
