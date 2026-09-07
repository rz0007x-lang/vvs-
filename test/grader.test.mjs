import assert from "node:assert/strict";
import test from "node:test";
import { demoGrade, normalizeDeepSeekResult } from "../server/grader.mjs";

test("demo grader returns bounded structured result", () => {
  const result = demoGrade({
    answer: "首先说明观点。其次补充原因。最后得出结论。",
    maxScore: 20,
    catchphrases: "这个地方要注意；再往前走一步",
  });
  assert.ok(result.score >= 0 && result.score <= 20);
  assert.equal(result.maxScore, 20);
  assert.equal(result.dimensions.length, 4);
  assert.match(result.feedback, /这个地方要注意/);
});

test("demo grader respects custom maximum score", () => {
  const result = demoGrade({ answer: "简短回答", maxScore: 10, catchphrases: "" });
  assert.ok(result.score <= 10);
  assert.equal(result.maxScore, 10);
  assert.equal(result.dimensions.reduce((sum, item) => sum + item.maxScore, 0), 10);
  assert.equal(result.dimensions.reduce((sum, item) => sum + item.score, 0), result.score);
});

test("demo grader changes feedback by professional-course question type", () => {
  const definition = demoGrade({ answer: "平台是连接多方参与者的数字基础设施。", maxScore: 10, questionType: "definition", catchphrases: "这个地方要注意" });
  const essay = demoGrade({ answer: "首先提出观点，其次分析原因，最后联系案例。", maxScore: 30, questionType: "essay", catchphrases: "再往前走一步" });
  assert.equal(definition.dimensions[0].name, "概念定义");
  assert.equal(essay.dimensions[0].name, "中心论点");
  assert.match(definition.feedback, /名词解释|定义/);
  assert.match(essay.feedback, /理论|案例/);
});

test("DeepSeek output normalization accepts string findings", () => {
  const result = normalizeDeepSeekResult({
    score: 12,
    confidence: 0.9,
    summary: "整体较好",
    strengths: "概念准确",
    problems: "案例不足",
    feedback: "补充一个专业案例。",
  }, { answer: "测试答案", maxScore: 20, questionType: "short", catchphrases: "" });
  assert.deepEqual(result.strengths, ["概念准确"]);
  assert.deepEqual(result.problems, ["案例不足"]);
  assert.ok(Array.isArray(result.dimensions));
});
