// <free_field_name>答题字段</free_field_name>
// <file_name>AnswerField_v2.jsx</file_name>
function AnswerField({ value, formData = {}, onChange, env = {} } = {}) {

  // ====================== 核心修改 ======================
  // 从他表字段 lastAnswer 获取值，作为初始 value
  const lastAnswerValue = env.lastAnswer ? formData[env.lastAnswer]?.value : undefined;
  // 优先级：他表字段 lastAnswer → 原本的 value
  const initialValue = lastAnswerValue ?? value;
  // ======================================================

  const randomPermutation = (n) => {
    const a = [...Array(Math.max(0, n)).keys()];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  };

  const isValidShuffleOrder = (so, n) => {
    if (!Array.isArray(so) || so.length !== n || n <= 0) return false;
    const seen = new Set();
    for (let i = 0; i < so.length; i++) {
      const x = so[i];
      if (typeof x !== "number" || x !== Math.floor(x) || x < 0 || x >= n || seen.has(x)) return false;
      seen.add(x);
    }
    return seen.size === n;
  };

  const normType = (t) => {
    const s = String(t || "").trim();
    if (s === "单选" || s === "单选题") return "single";
    if (s === "多选" || s === "多选题") return "multi";
    if (s === "判断" || s === "判断题") return "judge";
    return "single";
  };

  const parseQuestionType = (t) => {
    const s = String(t || "").trim();
    if (s === "单选" || s === "单选题") return "single";
    if (s === "多选" || s === "多选题") return "multi";
    if (s === "判断" || s === "判断题") return "judge";
    return "";
  };

  const typeLabel = (qt) => {
    if (qt === "multi") return "多选";
    if (qt === "judge") return "判断";
    return "单选";
  };

  const getOptionKey = (optionText, index) => {
    if (typeof optionText !== "string") return String.fromCharCode(65 + index);
    const m = optionText.match(/^([A-Z])[.．、]\s*/);
    if (m) return m[1];
    return String.fromCharCode(65 + index);
  };

  const pickFirstText = (items) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === undefined || item === null) continue;
      const text = String(item).trim();
      if (text) return text;
    }
    return "";
  };

  const normalizeOption = (option, index) => {
    if (typeof option === "string" || typeof option === "number") {
      return String(option).trim();
    }
    if (option && typeof option === "object") {
      return pickFirstText([option.text, option.label, option.content, option.value]);
    }
    return String.fromCharCode(65 + index);
  };

  const normalizeAnswer = (answer, qt) => {
    if (qt === "multi") {
      const list = Array.isArray(answer) ? answer : [answer];
      return list
        .filter((item) => item !== undefined && item !== null)
        .map((item) => String(item).trim())
        .filter(Boolean);
    }
    const item = Array.isArray(answer) ? answer[0] : answer;
    return item === undefined || item === null ? "" : String(item).trim();
  };

  const normalizeQuestion = (item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, message: `第 ${index + 1} 题不是有效对象` };
    }

    const rawType = item.type || item.questionType;
    const qt = parseQuestionType(rawType);
    if (!qt) {
      return { ok: false, message: `第 ${index + 1} 题题型无效：${rawType || "未提供"}` };
    }
    const question = pickFirstText([item.question, item.title, item.stem]);
    if (!question) {
      return { ok: false, message: `第 ${index + 1} 题缺少题干` };
    }

    const answer = normalizeAnswer(item.answer, qt);
    if (qt === "multi" && answer.length === 0) {
      return { ok: false, message: `第 ${index + 1} 题缺少正确答案` };
    }
    if (qt !== "multi" && !answer) {
      return { ok: false, message: `第 ${index + 1} 题缺少正确答案` };
    }

    if (qt === "judge") {
      return {
        ok: true,
        value: {
          ...item,
          type: typeLabel(qt),
          question,
          answer,
        },
      };
    }

    const rawOptions = item.options || item.choices || item.items;
    if (!Array.isArray(rawOptions)) {
      return { ok: false, message: `第 ${index + 1} 题选项不是数组` };
    }

    const options = rawOptions.map(normalizeOption).filter(Boolean);
    if (options.length === 0) {
      return { ok: false, message: `第 ${index + 1} 题缺少有效选项` };
    }

    return {
      ok: true,
      value: {
        ...item,
        type: typeLabel(qt),
        question,
        options,
        answer,
      },
    };
  };

  const formatAvailableAliases = () => {
    const keys = Object.keys(env || {}).filter((key) => !["isMobile", "isDisabled"].includes(key));
    return keys.length > 0 ? keys.join("、") : "未检测到引用字段别名";
  };

  const getJsonSyntaxDetail = (err, jsonText) => {
    const message = err && err.message ? err.message : "未知 JSON 语法错误";
    const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    if (lineColumnMatch) {
      return `JSON 语法错误：第 ${lineColumnMatch[1]} 行第 ${lineColumnMatch[2]} 列附近，${message}`;
    }

    const positionMatch = message.match(/position\s+(\d+)/i);
    if (!positionMatch) {
      return `JSON 语法错误：${message}`;
    }

    const position = Number(positionMatch[1]);
    if (!Number.isFinite(position) || position < 0) {
      return `JSON 语法错误：${message}`;
    }

    const before = jsonText.slice(0, position);
    const lines = before.split(/\r\n|\r|\n/);
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    const start = Math.max(0, position - 40);
    const end = Math.min(jsonText.length, position + 40);
    const snippet = jsonText.slice(start, end).replace(/\s+/g, " ");
    return `JSON 语法错误：第 ${line} 行第 ${column} 列附近，${message}。附近片段：${snippet}`;
  };

  const isAnswered = (qt, ua) => {
    if (ua === undefined || ua === null || ua === "") return false;
    if (qt === "multi") return Array.isArray(ua) && ua.length > 0;
    return true;
  };

  const sameMulti = (got, expected) => {
    const a = Array.isArray(got) ? [...got].map(String).sort() : [];
    const b = Array.isArray(expected) ? [...expected].map(String).sort() : [];
    if (a.length !== b.length) return false;
    return a.every((x, i) => x === b[i]);
  };

  const isCorrect = (q, userAns) => {
    if (!q || typeof q !== "object") return false;
    const qt = normType(q.type);
    if (!isAnswered(qt, userAns)) return false;
    const exp = q.answer;
    if (qt === "single" || qt === "judge") {
      return String(userAns).trim() === String(exp).trim();
    }
    if (qt === "multi") {
      return sameMulti(userAns, exp);
    }
    return false;
  };

  const scoreStats = (list, answers) => {
    const maxScore = list.reduce((s, q) => s + (Number(q.score) || 0), 0);
    let totalScore = 0;
    let correct = 0;
    list.forEach((q, i) => {
      if (isCorrect(q, answers[i])) {
        totalScore += Number(q.score) || 0;
        correct += 1;
      }
    });
    return { totalScore, maxScore, correctCount: correct };
  };

  const migrateUserAnswers = (list, raw) => {
    const out = { ...raw };
    list.forEach((q, idx) => {
      const qt = normType(q.type);
      if (qt === "single" && Array.isArray(q.options)) {
        const v = out[idx];
        if (typeof v !== "string") return;
        const oi = q.options.findIndex((o) => o === v);
        if (oi >= 0) out[idx] = getOptionKey(q.options[oi], oi);
      }
      if (qt === "multi" && Array.isArray(q.options) && Array.isArray(out[idx])) {
        out[idx] = out[idx].map((item) => {
          const oi = q.options.findIndex((o) => o === item);
          if (oi >= 0) return getOptionKey(q.options[oi], oi);
          return item;
        });
      }
    });
    return out;
  };

  const unwrapStored = (parsed) => {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { answers: {}, meta: {}, shuffleOrder: null, submitted: false, attemptCount: 0 };
    }
    const topShuffle = Array.isArray(parsed.shuffleOrder) ? parsed.shuffleOrder : null;
    const submitted = !!parsed.submitted;
    const rawAttempt = Number(parsed.attemptCount);
    const attemptCount =
      Number.isFinite(rawAttempt) && rawAttempt >= 0 ? Math.floor(rawAttempt) : 0;
    if ("answers" in parsed) {
      const a = parsed.answers;
      const answers = a && typeof a === "object" && !Array.isArray(a) ? { ...a } : {};
      return {
        answers,
        meta: {
          totalScore: parsed.totalScore,
          maxScore: parsed.maxScore,
          scoreRate: parsed.scoreRate,
        },
        shuffleOrder: topShuffle,
        submitted,
        attemptCount,
      };
    }
    return {
      answers: { ...parsed },
      meta: {},
      shuffleOrder: topShuffle,
      submitted,
      attemptCount,
    };
  };

  const extractJsonArrayText = (raw) => {
    const s = String(raw || "")
      .trim()
      .replace(/^\uFEFF/, "");
    const start = s.indexOf("[");
    if (start === -1) {
      throw new Error("未找到题目数据：字段中需包含以 [ 开头的 JSON 题目数组（前可有标题等文字）");
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (inString) {
        if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === "[") depth++;
      else if (c === "]") {
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
    throw new Error("题目 JSON 数组未正确结束（括号 [ ] 不匹配）");
  };

  const questionField =
    (env.questionTxt ? formData[env.questionTxt] : null) ||
    (env.exam ? formData[env.exam] : null);

  let questionList = [];
  let parseError = "";
  let invalidQuestions = [];
  let parseDetails = [];
  try {
    if (!questionField) {
      parseDetails = [
        "未找到试题引用字段：请在字段设置中添加引用字段，并把别名设置为 questionTxt 或 exam。",
        `当前检测到的 env 别名：${formatAvailableAliases()}。`,
      ];
      throw new Error("未找到试题引用字段，请确认已添加引用字段，且别名为 questionTxt 或 exam");
    }
    if (questionField.value === undefined || questionField.value === null || String(questionField.value).trim() === "") {
      parseDetails = [
        "已找到试题引用字段，但字段值为空。",
        "请确认 questionTxt/exam 引用字段中已经写入题库 JSON 数组。",
      ];
      throw new Error("试题字段值为空");
    }
    let jsonText = "";
    try {
      jsonText = extractJsonArrayText(questionField.value);
    } catch (err) {
      parseDetails = [
        err && err.message ? err.message : "无法从字段值中截取题目 JSON 数组。",
        "请确认题库内容中存在完整的 JSON 数组，数组必须从 [ 开始并以匹配的 ] 结束。",
      ];
      throw err;
    }

    let parsedQuestions = null;
    try {
      parsedQuestions = JSON.parse(jsonText);
    } catch (err) {
      parseDetails = [
        getJsonSyntaxDetail(err, jsonText),
        "常见原因：缺少逗号、使用中文引号、字符串没有双引号、末尾多余逗号、括号没有闭合。",
      ];
      throw new Error("题目 JSON 语法错误");
    }

    const rawQuestionList = Array.isArray(parsedQuestions) ? parsedQuestions : [parsedQuestions];
    const normalizedQuestions = rawQuestionList.map(normalizeQuestion);
    invalidQuestions = normalizedQuestions
      .filter((item) => !item.ok)
      .map((item) => item.message);
    questionList = normalizedQuestions
      .filter((item) => item.ok)
      .map((item) => item.value);
    if (questionList.length === 0) {
      parseDetails = invalidQuestions.length > 0
        ? invalidQuestions
        : ["题目数组为空：JSON 数组中没有任何题目对象。"];
      throw new Error(
        invalidQuestions.length > 0
          ? `没有可渲染的有效试题：${invalidQuestions.join("；")}`
          : "题目数组为空"
      );
    }
  } catch (err) {
    parseError = err && err.message ? err.message : "未知错误";
    if (parseDetails.length === 0) parseDetails = [parseError];
  }

  const total = questionList.length;

  const parseStoredAnswers = (v) => {
    try {
      // ====================== 这里使用修改后的 initialValue ======================
      const raw = v ? JSON.parse(v) : {};
      const { answers: rawAnswers } = unwrapStored(raw);
      return migrateUserAnswers(questionList, rawAnswers || {});
    } catch {
      return {};
    }
  };

  const initialShuffle = () => {
    try {
      // ====================== 这里使用修改后的 initialValue ======================
      const raw = initialValue ? JSON.parse(initialValue) : {};
      const u = unwrapStored(raw);
      if (isValidShuffleOrder(u.shuffleOrder, questionList.length)) return u.shuffleOrder;
    } catch {}
    return randomPermutation(questionList.length);
  };

  // ====================== 所有用到 value 初始化的地方都换成 initialValue ======================
  const [userAnswers, setUserAnswers] = React.useState(() => parseStoredAnswers(initialValue));
  const [shuffleOrder, setShuffleOrder] = React.useState(initialShuffle);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [submitted, setSubmitted] = React.useState(() => {
    try {
      const raw = initialValue ? JSON.parse(initialValue) : {};
      return !!(raw && typeof raw === "object" && raw.submitted);
    } catch {
      return false;
    }
  });

  const [attemptCount, setAttemptCount] = React.useState(() => {
    try {
      const raw = initialValue ? JSON.parse(initialValue) : {};
      const u = unwrapStored(raw);
      return typeof u.attemptCount === "number" ? u.attemptCount : 0;
    } catch {
      return 0;
    }
  });

  const examFingerprintRef = React.useRef(questionField?.value);

  React.useEffect(() => {
    setUserAnswers(parseStoredAnswers(initialValue));
  }, [initialValue, questionField?.value]);

  React.useEffect(() => {
    try {
      const raw = initialValue ? JSON.parse(initialValue) : {};
      const u = unwrapStored(raw);
      setSubmitted(!!(raw && typeof raw === "object" && raw.submitted));
      setAttemptCount(typeof u.attemptCount === "number" ? u.attemptCount : 0);
    } catch {
      setSubmitted(false);
      setAttemptCount(0);
    }
  }, [initialValue]);

  React.useEffect(() => {
    const n = total;
    const fp = questionField?.value;
    if (examFingerprintRef.current !== fp) {
      examFingerprintRef.current = fp;
      if (n > 0) setShuffleOrder(randomPermutation(n));
      setCurrentIndex(0);
      setSubmitted(false);
      setAttemptCount(0);
      return;
    }
    try {
      const raw = initialValue ? JSON.parse(initialValue) : {};
      const u = unwrapStored(raw);
      if (n > 0 && isValidShuffleOrder(u.shuffleOrder, n)) setShuffleOrder(u.shuffleOrder);
    } catch {}
  }, [initialValue, questionField?.value, total]);

  React.useEffect(() => {
    setCurrentIndex((i) => (total <= 0 ? 0 : Math.min(i, total - 1)));
  }, [total]);

  const { totalScore, maxScore, correctCount } = scoreStats(questionList, userAnswers);
  const currentScoreRate = maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0;

  const baseOrder = total > 0 && isValidShuffleOrder(shuffleOrder, total) ? shuffleOrder : [...Array(total).keys()];
  const wrongOnlyCandidates = baseOrder.filter((i) => !isCorrect(questionList[i], userAnswers[i]));
  const showWrongOnly = submitted && currentScoreRate !== 100 && wrongOnlyCandidates.length > 0;
  const displayOrigIndices = showWrongOnly ? wrongOnlyCandidates : baseOrder;
  const displayTotal = displayOrigIndices.length;

  const safeIndex = displayTotal > 0 ? Math.min(Math.max(currentIndex, 0), displayTotal - 1) : 0;
  const origIndex = displayTotal > 0 ? displayOrigIndices[safeIndex] : 0;
  const q = displayTotal > 0 ? questionList[origIndex] : null;
  const userAns = q ? userAnswers[origIndex] : undefined;
  const progressPct = displayTotal > 0 ? ((safeIndex + 1) / displayTotal) * 100 : 0;

  const answeredCount = questionList.filter((_, i) => {
    const a = userAnswers[i];
    return isAnswered(normType(questionList[i].type), a);
  }).length;

  const displayAnsweredCount = displayOrigIndices.filter((i) => isAnswered(normType(questionList[i].type), userAnswers[i])).length;

  const allAnswered = total > 0 && answeredCount === total;

  React.useEffect(() => {
    setCurrentIndex((i) => (displayTotal <= 0 ? 0 : Math.min(i, displayTotal - 1)));
  }, [displayTotal]);

  const persistPayload = (newAnswers, order, opts = {}) => {
    const { totalScore: ts, maxScore: ms } = scoreStats(questionList, newAnswers);
    const scoreRate = ms > 0 ? Math.round((ts / ms) * 10000) / 100 : 0;
    const ord = order || shuffleOrder;
    const nextSubmitted = "submitted" in opts ? !!opts.submitted : submitted;
    const rawAttemptCount = "attemptCount" in opts ? Number(opts.attemptCount) : attemptCount;
    const nextAttemptCount =
      Number.isFinite(rawAttemptCount) && rawAttemptCount >= 0
        ? Math.floor(rawAttemptCount)
        : 0;
    const payload = {
      answers: newAnswers,
      totalScore: Math.round(ts * 1000) / 1000,
      maxScore: Math.round(ms * 1000) / 1000,
      scoreRate,
      shuffleOrder: isValidShuffleOrder(ord, total) ? ord : randomPermutation(total),
      submitted: nextSubmitted,
      attemptCount: nextAttemptCount,
    };
    onChange(JSON.stringify(payload));
  };

  const persistAnswers = (newAnswers) => {
    setUserAnswers(newAnswers);
    persistPayload(newAnswers, shuffleOrder);
  };

  const handleSubmitExam = () => {
    if (env.isDisabled || submitted) return;
    if (!allAnswered) return;
    const nextAttempt = attemptCount + 1;
    persistPayload(userAnswers, shuffleOrder, { submitted: true, attemptCount: nextAttempt });
    setAttemptCount(nextAttempt);
    setSubmitted(true);
  };

  const handleRetryExam = () => {
    if (env.isDisabled || !submitted) return;
    if (total <= 0) return;
    const curRate = maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0;
    if (curRate === 100) return;
    const newOrder = randomPermutation(total);
    const emptyAnswers = {};
    setShuffleOrder(newOrder);
    setUserAnswers(emptyAnswers);
    setCurrentIndex(0);
    setSubmitted(false);
    persistPayload(emptyAnswers, newOrder, { submitted: false, attemptCount });
  };

  const inputLocked = env.isDisabled || submitted;
  const navBlocked = env.isDisabled && !submitted;

  const handleAnswer = (origIdx, type, storedVal) => {
    if (inputLocked) return;
    const qu = questionList[origIdx];
    const qt = normType(type);
    const newAnswers = { ...userAnswers };
    if (qt === "multi") {
      let arr = Array.isArray(newAnswers[origIdx]) ? [...newAnswers[origIdx]] : [];
      if (Array.isArray(qu?.options)) {
        arr = arr.map((item) => {
          const oi = qu.options.findIndex((o) => o === item);
          if (oi >= 0) return getOptionKey(qu.options[oi], oi);
          return item;
        });
      }
      const i = arr.indexOf(storedVal);
      newAnswers[origIdx] = i >= 0 ? arr.filter((x) => x !== storedVal) : [...arr, storedVal];
    } else {
      newAnswers[origIdx] = storedVal;
    }
    persistAnswers(newAnswers);
    if (qt !== "multi" && origIdx === origIndex && safeIndex < displayTotal - 1) {
      setCurrentIndex((c) => (c < displayTotal - 1 ? c + 1 : c));
    }
  };

  const goPrev = () => {
    if (navBlocked) return;
    setCurrentIndex((c) => Math.max(0, c - 1));
  };

  const goNext = () => {
    if (navBlocked) return;
    setCurrentIndex((c) => Math.min(displayTotal - 1, c + 1));
  };

  const isSingleChecked = (ua, key, opt) => ua === key || ua === opt;
  const isMultiChecked = (ua, key, opt) => {
    const arr = Array.isArray(ua) ? ua : [];
    return arr.includes(key) || arr.includes(opt);
  };

  if (parseError) {
    return (
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <div>
          <div className="font-semibold">试题解析失败</div>
          <div className="mt-1 text-sm">{parseError}</div>
        </div>
        {parseDetails.length > 0 ? (
          <div className="rounded border border-red-100 bg-white/80 p-3 text-sm text-red-900">
            <div className="font-medium">失败原因</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {parseDetails.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="text-sm text-red-700">
          <div className="font-medium">修改建议</div>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>确认已添加试题引用字段，别名为 questionTxt 或 exam。</li>
            <li>题目须为 JSON 数组；字段前可加试卷名称等文字，数组须从 [ 开始。</li>
            <li>单选/多选题必须提供 options 数组；每题都必须提供 type、question 和 answer。</li>
          </ul>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="p-3 border border-yellow-200 rounded bg-yellow-50 text-yellow-800">
        暂无可渲染的试题。
      </div>
    );
  }

  const idx = safeIndex;
  const qt = normType(q.type);
  const isMulti = qt === "multi";
  const isJudge = qt === "judge";
  const isLast = idx >= displayTotal - 1;

  const hasScore =
    q.score !== undefined && q.score !== null && String(q.score).trim() !== "";
  const qScoreNum = hasScore ? Number(q.score) : NaN;
  const scorePart =
    hasScore && !Number.isNaN(qScoreNum)
      ? `${qScoreNum}分`
      : null;

  const showResultPanel = submitted || env.isDisabled;
  const canRetry = submitted && !env.isDisabled && currentScoreRate !== 100;
  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  return (
    <div className="space-y-4 p-1 max-w-2xl mx-auto">
      {invalidQuestions.length > 0 ? (
        <div className="p-3 border border-yellow-200 rounded bg-yellow-50 text-yellow-800 text-sm space-y-1">
          <div className="font-medium">以下题目已跳过：</div>
          {invalidQuestions.map((message, index) => (
            <div key={index}>{message}</div>
          ))}
        </div>
      ) : null}

      {showResultPanel && (
        <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50/80 p-5 shadow-sm">
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600">考试成绩</div>
            <div className="mt-2 text-4xl font-bold tabular-nums text-blue-900">
              {totalScore}
              <span className="text-xl font-semibold text-gray-500"> / {maxScore}</span>
            </div>
            <div className="mt-2 text-sm text-gray-600 tabular-nums">
              答题次数 {attemptCount}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              答对 {correctCount} 题，满分 {maxScore} 分
              {maxScore > 0 ? <span className="mx-1">·</span> : null}
              {maxScore > 0 ? <span>得分率 {pct}%</span> : null}
            </div>
            {submitted && !env.isDisabled ? (
              <p className="mt-3 text-xs text-gray-500">已交卷，可翻阅题目查看作答，不可再修改答案。</p>
            ) : null}
            {env.isDisabled ? <p className="mt-3 text-xs text-gray-500">当前为查看模式。</p> : null}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-gray-800">
          第 {idx + 1} / {displayTotal} 题
        </span>
        <span className="text-gray-600">
          已答 {displayAnsweredCount} / {displayTotal}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 transition-all duration-300 rounded-full" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="border rounded-lg p-4 bg-white shadow-sm">
        <div className="font-medium text-gray-800 mb-3 leading-snug">
          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mr-2 align-middle text-sm font-normal text-gray-600">
            <span className="tabular-nums text-gray-800 font-medium">{idx + 1}.</span>
            <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-700">
              {q.type}
              {scorePart ? (
                <>
                  <span className="mx-1 text-gray-300">|</span>
                  <span className="text-amber-800">{scorePart}</span>
                </>
              ) : null}
            </span>
          </span>
          <span>{q.question}</span>
        </div>
        {isMulti && (
          <p className="text-xs text-gray-500 mb-3">多选题需勾选后点击「下一题」切换；每次勾选都会自动保存。</p>
        )}
        <div className="space-y-2">
          {isJudge && (
            <>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  disabled={inputLocked}
                  checked={userAns === "对"}
                  onChange={() => handleAnswer(origIndex, q.type, "对")}
                  className="w-4 h-4 text-blue-600 shrink-0 mt-1"
                />
                <span className="flex-1 min-w-0">对</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  disabled={inputLocked}
                  checked={userAns === "错"}
                  onChange={() => handleAnswer(origIndex, q.type, "错")}
                  className="w-4 h-4 text-blue-600 shrink-0 mt-1"
                />
                <span className="flex-1 min-w-0">错</span>
              </label>
            </>
          )}
          {qt === "single" &&
            q.options?.map((opt, i) => {
              const key = getOptionKey(opt, i);
              return (
                <label key={i} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    disabled={inputLocked}
                    checked={isSingleChecked(userAns, key, opt)}
                    onChange={() => handleAnswer(origIndex, q.type, key)}
                    className="w-4 h-4 text-blue-600 shrink-0 mt-1"
                  />
                  <span className="flex-1 min-w-0 text-left break-normal whitespace-normal">{opt}</span>
                </label>
              );
            })}
          {isMulti &&
            q.options?.map((opt, i) => {
              const key = getOptionKey(opt, i);
              return (
                <label key={i} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={inputLocked}
                    checked={isMultiChecked(userAns, key, opt)}
                    onChange={() => handleAnswer(origIndex, q.type, key)}
                    className="w-4 h-4 text-blue-600 shrink-0 mt-1"
                  />
                  <span className="flex-1 min-w-0 text-left break-normal whitespace-normal">{opt}</span>
                </label>
              );
            })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={navBlocked || idx <= 0}
          onClick={goPrev}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          上一题
        </button>
        <button
          type="button"
          disabled={navBlocked || isLast}
          onClick={goNext}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          下一题
        </button>
        {canRetry && (
          <button
            type="button"
            onClick={handleRetryExam}
            className="px-5 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold shadow-sm hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            重新答题
          </button>
        )}
        {!env.isDisabled && !submitted && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!allAnswered}
              onClick={handleSubmitExam}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              交卷
            </button>
            {!allAnswered ? (
              <span className="text-xs text-amber-700">需答完所有题目（已答 {answeredCount}/{total}）后方可交卷</span>
            ) : null}
          </div>
        )}
        {isLast && !isMulti && (
          <span className="text-sm text-green-600 ml-auto">
            {submitted || env.isDisabled
              ? submitted
                ? "已浏览至最后一题。"
                : `已浏览至最后一题；总分 ${totalScore} / ${maxScore}。`
              : "已是最后一题"}
          </span>
        )}
        {isLast && isMulti && (
          <span className="text-sm text-green-600 ml-auto">
            {submitted || env.isDisabled
              ? submitted
                ? "已浏览至最后一题。"
                : `已浏览至最后一题；总分 ${totalScore} / ${maxScore}。`
              : "最后一题；可点击「上一题」回看。"}
          </span>
        )}
      </div>
    </div>
  );
}
