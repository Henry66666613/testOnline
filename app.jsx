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
    const ni = index + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return {
        ok: false,
        message: `第 ${ni} 题不是有效对象`,
        hint: "每一题必须是形如 {\"type\":\"单选\", ...} 的单个对象，不能是数值、字符串或嵌套数组；若为数组请改为多个并列的题目对象。",
      };
    }

    const rawType = item.type || item.questionType;
    const qt = parseQuestionType(rawType);
    if (!qt) {
      const got = rawType === undefined || rawType === null || rawType === "" ? "未填写" : JSON.stringify(rawType);
      return {
        ok: false,
        message: `第 ${ni} 题题型无效：${got}`,
        hint: "请将 type（或 questionType）设为以下之一：单选、单选题、多选、多选题、判断、判断题（须与上述字样完全一致，区分大小写以外的标点）。",
      };
    }
    const question = pickFirstText([item.question, item.title, item.stem]);
    if (!question) {
      return {
        ok: false,
        message: `第 ${ni} 题缺少题干`,
        hint: "请至少填写 question、title、stem 三者之一作为题干文字。",
      };
    }

    const answer = normalizeAnswer(item.answer, qt);
    if (qt === "multi" && answer.length === 0) {
      return {
        ok: false,
        message: `第 ${ni} 题缺少正确答案（多选）`,
        hint: "多选题的 answer 应为非空数组，例如 [\"A\",\"B\"]；选项字母需与 options 中前缀一致。",
      };
    }
    if (qt !== "multi" && !answer) {
      return {
        ok: false,
        message: `第 ${ni} 题缺少正确答案`,
        hint:
          qt === "judge"
            ? "判断题请将 answer 设为 \"对\" 或 \"错\"（也可放在单元素数组中）。"
            : "单选题请将 answer 设为选项键（如 \"A\"）或整段选项文案；可为字符串或单元素数组 [\"A\"]。",
      };
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
      return {
        ok: false,
        message: `第 ${ni} 题选项不是数组`,
        hint: "单选/多选题必须提供 options（或 choices、items）字段，且为数组，例如 [\"A. xxx\",\"B. xxx\"]。",
      };
    }

    const options = rawOptions.map(normalizeOption).filter(Boolean);
    if (options.length === 0) {
      return {
        ok: false,
        message: `第 ${ni} 题没有有效选项`,
        hint: "请确保每个选项为非空字符串（或含 text/label 的对象）；去掉全是空白的项。",
      };
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

  /**
   * 从字段原文中截取最外层 JSON 数组；优先从 "[{" 起算，减少说明文字里抢先出现 "[" 的误判。
   * @returns {{ text: string, warnings: string[] }}
   */
  const extractJsonArrayText = (raw) => {
    const warnings = [];
    const s = String(raw || "")
      .trim()
      .replace(/^\uFEFF/, "");
    const preferred = s.search(/\[\s*\{/);
    const firstBracket = s.indexOf("[");
    let start;
    if (preferred >= 0) {
      start = preferred;
    } else if (firstBracket >= 0) {
      start = firstBracket;
      warnings.push(
        "未在内容中找到标准起始片段 [{ ，已使用第一个 [ 作为题库数组起点。若仍然解析失败，请把题库 JSON 挪到字段最前面，或删除说明文字中多余的 [  ] 符号。"
      );
    } else {
      throw new Error("未找到字符 [：题库须为 JSON 数组。标准写法以 [{ 开头（表示题目对象列表），前面尽量不要夹杂单独的 [ 符号。");
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
        if (depth === 0) return { text: s.slice(start, i + 1), warnings };
      }
    }
    const tail = s.slice(Math.max(start, s.length - 120));
    throw new Error(
      `题目 JSON 数组未正确结束：扫描到字段末尾时括号仍不配平（可能少了 ]，或字符串里双引号未转义导致解析错位）。末尾附近：${tail.replace(/\s+/g, " ")}`
    );
  };

  const makeFieldSnippet = (val, maxLen = 560) => {
    const raw = val === undefined || val === null ? "" : String(val);
    if (!raw) return "";
    if (raw.length <= maxLen) return raw;
    return `${raw.slice(0, maxLen)}\n…（已截断，全文共 ${raw.length} 个字符）`;
  };

  const PHASE_LABEL = {
    ref: "引用字段",
    empty: "题库为空",
    extract: "内容截取",
    json: "JSON 语法",
    validate: "题目校验",
    empty_list: "空题目列表",
  };

  const questionField =
    (env.questionTxt ? formData[env.questionTxt] : null) ||
    (env.exam ? formData[env.exam] : null);

  let questionList = [];
  let parseError = "";
  let invalidQuestionReports = [];
  let parseDetails = [];
  let parseFailurePhase = "";
  let questionFieldSnippet = "";

  try {
    if (!questionField) {
      parseFailurePhase = "ref";
      parseDetails = [
        "当前表单里没有通过别名 questionTxt 或 exam 绑定到「题库」引用字段。",
        `请在本字段设置中新增引用，并把别名设为 questionTxt 或 exam；当前 env 中可用的自定义别名：${formatAvailableAliases()}。`,
      ];
      throw new Error("未找到试题引用字段（questionTxt / exam）");
    }

    if (questionField.value === undefined || questionField.value === null || String(questionField.value).trim() === "") {
      parseFailurePhase = "empty";
      parseDetails = [
        "引用字段已绑定，但控件值为空（未粘贴题库或未保存表单）。",
        "请在题库字段中粘贴以 [{ 开头的 JSON 数组并保存记录后再试。",
      ];
      throw new Error("试题引用字段内容为空");
    }

    questionFieldSnippet = makeFieldSnippet(questionField.value);

    let jsonText = "";
    try {
      const extracted = extractJsonArrayText(questionField.value);
      jsonText = extracted.text;
    } catch (err) {
      parseFailurePhase = "extract";
      const base = err && err.message ? err.message : "无法从字段值中截取题目 JSON 数组。";
      parseDetails = [
        base,
        "请确认：① 题库是一段完整的 JSON 数组；② 优先使用 [{ 作为起始；③ 说明文字里不要在题库数组之前单独出现 [ ，以免截取错位。",
      ];
      throw err;
    }

    let parsedQuestions = null;
    try {
      parsedQuestions = JSON.parse(jsonText);
    } catch (err) {
      parseFailurePhase = "json";
      parseDetails = [
        getJsonSyntaxDetail(err, jsonText),
        `已成功截取题库片段，长度约 ${jsonText.length} 字符；错误位置信息针对该片段。`,
        "常见原因：缺少逗号、使用了中文引号「」、字符串未用英文双引号包裹、最后一个元素后多写了逗号、对象或数组未闭合。",
      ];
      throw new Error("题目 JSON 语法错误（JSON.parse 失败）");
    }

    const rawQuestionList = Array.isArray(parsedQuestions) ? parsedQuestions : [parsedQuestions];
    const normalizedQuestions = rawQuestionList.map(normalizeQuestion);
    invalidQuestionReports = normalizedQuestions
      .filter((item) => !item.ok)
      .map((item) => ({
        message: item.message,
        hint: item.hint || "请对照字段说明检查该题的 type、question、answer、options。",
      }));
    questionList = normalizedQuestions
      .filter((item) => item.ok)
      .map((item) => item.value);

    if (questionList.length === 0) {
      if (invalidQuestionReports.length > 0) {
        parseFailurePhase = "validate";
        parseDetails = [
          `题库 JSON 中共 ${rawQuestionList.length} 条记录，但没有任何一题通过校验，无法进入答题页。`,
          "下方列出每一题的具体错误与修改建议；修复后需保存题库字段再刷新。",
        ];
        throw new Error(`全部题目校验失败（${invalidQuestionReports.length} 条均无效）`);
      }
      parseFailurePhase = "empty_list";
      parseDetails = [
        "JSON 解析成功，但题目数组为空（例如 []），或唯一元素不是题目对象。",
        "请至少放入一道包含 type、question、answer 的题目对象。",
      ];
      throw new Error("题目数组为空或无可解析的题目对象");
    }
  } catch (err) {
    parseError = err && err.message ? err.message : "未知错误";
    if (parseDetails.length === 0) parseDetails = [parseError];
    if (!parseFailurePhase) parseFailurePhase = "extract";
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
    const phaseTitle = PHASE_LABEL[parseFailurePhase] || "试题解析";
    const phaseHints =
      parseFailurePhase === "ref"
        ? [
            "在本自定义字段的配置里添加「引用类型」字段，绑定存放题库的控件，并把别名写成 questionTxt 或 exam（与代码中的 env 一致）。",
            "保存表单设计后，确保该引用字段在表单上可见且已写入题库内容。",
          ]
        : parseFailurePhase === "empty"
          ? ["打开绑定好的题库字段，将完整的 JSON 题库粘贴进去并保存当前记录。"]
          : parseFailurePhase === "extract"
            ? [
                "把题库 JSON 尽量放在字段最开头，或保证最先出现的 [ 与紧随其后的 { 组成 [{ ，表示题目数组。",
                "若标题里必须提到方括号，请避免在题库数组之前出现单独的 [ 字符。",
              ]
            : parseFailurePhase === "json"
              ? [
                  "用 VS Code 等编辑器打开 JSON，查看报错行列；把中文引号改为英文双引号，检查逗号与括号配对。",
                  "可把下方「题库原文」复制到 jsonlint.com 等工具里格式化验证。",
                ]
              : parseFailurePhase === "validate"
                ? [
                    "按下方「逐题诊断」逐项修改题库；改一项保存一次便于定位。",
                    "题型字段必须与示例完全一致（如「单选」而非「单项选择」）。",
                  ]
                : parseFailurePhase === "empty_list"
                  ? ["确认数组内至少有一个 {...} 题目对象，而不是只有空白或注释。"]
                  : [
                      "确认已添加试题引用字段 questionTxt 或 exam，题库为 [{ 开头的 JSON 数组。",
                      "每道题需包含 type、question、answer；单选/多选还需 options 数组。",
                    ];

    return (
      <div className="space-y-4 rounded-xl border border-red-200 bg-red-50/90 p-4 text-red-900 shadow-sm max-w-2xl mx-auto">
        <div className="flex flex-wrap items-center gap-2 border-b border-red-100 pb-3">
          <span className="rounded-full bg-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-950">{phaseTitle}</span>
          <span className="text-lg font-semibold text-red-950">试题解析失败</span>
        </div>

        <div className="rounded-lg bg-white/90 p-3 shadow-sm ring-1 ring-red-100">
          <div className="text-xs font-medium uppercase tracking-wide text-red-600/90">摘要</div>
          <p className="mt-1 text-sm leading-relaxed text-red-950">{parseError}</p>
        </div>

        {parseDetails.length > 0 ? (
          <div className="rounded-lg border border-red-100 bg-white p-3 text-sm shadow-sm">
            <div className="font-semibold text-red-950">诊断说明</div>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-red-900 marker:text-red-400">
              {parseDetails.map((detail, index) => (
                <li key={index} className="leading-relaxed">
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {invalidQuestionReports.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm shadow-sm">
            <div className="font-semibold text-amber-950">逐题诊断（共 {invalidQuestionReports.length} 条）</div>
            <ul className="mt-3 space-y-3">
              {invalidQuestionReports.map((row, index) => (
                <li
                  key={index}
                  className="rounded-md border border-amber-100 bg-white p-3 text-amber-950 shadow-sm"
                >
                  <div className="font-medium text-red-900">{row.message}</div>
                  <div className="mt-2 border-l-2 border-amber-400 pl-3 text-sm leading-relaxed text-gray-800">
                    <span className="font-medium text-gray-600">修改建议：</span>
                    {row.hint}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {questionFieldSnippet ? (
          <details className="group rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm open:ring-1 open:ring-gray-200">
            <summary className="cursor-pointer select-none font-medium text-gray-800 hover:text-gray-950">
              查看题库字段原文（便于对照行列号）
              <span className="ml-2 text-xs font-normal text-gray-500">（用于排查 JSON 语法或截取范围）</span>
            </summary>
            <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-900/95 p-3 text-xs leading-relaxed text-green-100">
              {questionFieldSnippet}
            </pre>
          </details>
        ) : null}

        <div className="rounded-lg border border-red-100 bg-white/70 p-3 text-sm text-red-950">
          <div className="font-semibold">针对当前阶段的修改步骤</div>
          <ul className="mt-2 list-decimal space-y-1.5 pl-5 marker:text-red-400">
            {phaseHints.map((line, i) => (
              <li key={i} className="leading-relaxed">
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-xs leading-relaxed text-red-800/80">
          <span className="font-medium">通用格式：</span>
          题库须为 JSON 数组；单选/多选题须有 options；每题须有 type、question、answer。判断题 answer 为「对」或「错」。
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
  const showWrongBadge = submitted && !isCorrect(q, userAns);

  return (
    <div className="space-y-4 p-1 max-w-2xl mx-auto">
      {invalidQuestionReports.length > 0 ? (
        <div className="p-3 border border-yellow-200 rounded-lg bg-yellow-50 text-yellow-900 text-sm space-y-2 shadow-sm">
          <div className="font-semibold">以下题目已跳过（不影响其余题目作答）</div>
          <ul className="space-y-2">
            {invalidQuestionReports.map((row, index) => (
              <li key={index} className="rounded border border-yellow-100 bg-white/80 px-2 py-1.5">
                <span className="font-medium text-yellow-950">{row.message}</span>
                {row.hint ? (
                  <div className="mt-1 text-xs leading-relaxed text-yellow-900/90">建议：{row.hint}</div>
                ) : null}
              </li>
            ))}
          </ul>
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
            {showWrongBadge ? (
              <span
                className="rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 shadow-sm"
                title="本题作答与标准答案不一致"
              >
                错题
              </span>
            ) : null}
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
