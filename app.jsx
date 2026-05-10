// <free_field_name>答题字段</free_field_name>
// <file_name>AnswerField_v2.jsx</file_name>
function AnswerField(props) {
  var value = props.value;
  var formData = props.formData || {};
  var onChange = props.onChange;
  var env = props.env || {};

  var QUESTION_TYPES = {
    "判断题": "判断题",
    "判断": "判断题",
    "truefalse": "判断题",
    "true/false": "判断题",
    "单选题": "单选题",
    "单选": "单选题",
    "选择题": "单选题",
    "radio": "单选题",
    "多选题": "多选题",
    "多选": "多选题",
    "checkbox": "多选题"
  };

  function getOptionKey(optionText, index) {
    if (typeof optionText !== "string") return String.fromCharCode(65 + index);
    var match = optionText.match(/^([A-Z])[.．、]\s*/);
    if (match) return match[1];
    return String.fromCharCode(65 + index);
  }

  function normalizeQuestionType(type) {
    if (typeof type !== "string") return "";
    var compact = type.trim();
    if (!compact) return "";
    return QUESTION_TYPES[compact] || QUESTION_TYPES[compact.toLowerCase()] || compact;
  }

  function ensureQuestionArray(input) {
    if (Array.isArray(input)) return input;
    if (input && typeof input === "object") return [input];
    return [];
  }

  function parseQuestionValue(rawValue) {
    var current;
    var parsed;
    var i;

    if (rawValue === undefined || rawValue === null) {
      throw new Error("试题字段值为空");
    }

    if (Array.isArray(rawValue)) return rawValue;
    if (rawValue && typeof rawValue === "object") return ensureQuestionArray(rawValue);

    if (typeof rawValue !== "string") {
      throw new Error("试题字段值类型不支持：" + typeof rawValue);
    }

    current = rawValue.trim();
    if (!current) {
      throw new Error("试题字段值为空");
    }

    for (i = 0; i < 3; i += 1) {
      parsed = JSON.parse(current);
      if (typeof parsed === "string") {
        current = parsed.trim();
        if (!current) {
          throw new Error("试题字段值为空");
        }
      } else {
        return ensureQuestionArray(parsed);
      }
    }

    throw new Error("试题字段解析层级过深，请检查输入格式");
  }

  function pickFirstText(list) {
    var i;
    var item;
    for (i = 0; i < list.length; i += 1) {
      item = list[i];
      if (typeof item === "string" && item.trim()) {
        return item.trim();
      }
    }
    return "";
  }

  function normalizeQuestion(question, index) {
    var type;
    var title;
    var options;

    if (!question || typeof question !== "object") {
      return {
        isValid: false,
        message: "第 " + (index + 1) + " 题不是有效对象"
      };
    }

    type = normalizeQuestionType(question.type || question.questionType);
    title = pickFirstText([question.question, question.title, question.stem]);

    if (!title) {
      return {
        isValid: false,
        message: "第 " + (index + 1) + " 题缺少题干"
      };
    }

    if (["判断题", "单选题", "多选题"].indexOf(type) < 0) {
      return {
        isValid: false,
        message: "第 " + (index + 1) + " 题题型无效：" + (question.type || "未提供")
      };
    }

    if (type === "判断题") {
      return {
        isValid: true,
        question: title,
        type: type,
        options: ["对", "错"]
      };
    }

    options = question.options || question.choices || question.items;
    if (!Array.isArray(options)) {
      return {
        isValid: false,
        message: "第 " + (index + 1) + " 题选项不是数组"
      };
    }

    options = options
      .map(function(option, optionIndex) {
        var text;
        if (typeof option === "string") return option.trim();
        if (option && typeof option === "object") {
          text = pickFirstText([option.text, option.label, option.content, option.value]);
          if (text) return text;
        }
        return String.fromCharCode(65 + optionIndex);
      })
      .filter(function(option) {
        return !!option;
      });

    if (!options.length) {
      return {
        isValid: false,
        message: "第 " + (index + 1) + " 题缺少有效选项"
      };
    }

    return {
      isValid: true,
      question: title,
      type: type,
      options: options
    };
  }

  function migrateUserAnswers(list, raw) {
    var out = {};
    var keyList = Object.keys(raw || {});

    keyList.forEach(function(key) {
      out[key] = raw[key];
    });

    list.forEach(function(q, idx) {
      var storedValue;
      var optionIndex;

      if (q.type === "单选题" && Array.isArray(q.options)) {
        storedValue = out[idx];
        if (typeof storedValue !== "string") return;
        optionIndex = q.options.findIndex(function(option) {
          return option === storedValue;
        });
        if (optionIndex >= 0) {
          out[idx] = getOptionKey(q.options[optionIndex], optionIndex);
        }
      }

      if (q.type === "多选题" && Array.isArray(q.options) && Array.isArray(out[idx])) {
        out[idx] = out[idx].map(function(item) {
          var matchedIndex = q.options.findIndex(function(option) {
            return option === item;
          });
          if (matchedIndex >= 0) {
            return getOptionKey(q.options[matchedIndex], matchedIndex);
          }
          return item;
        });
      }
    });

    return out;
  }

  var questionControlId = env.exam || env.questionTxt || "";
  var questionField = questionControlId ? formData[questionControlId] : null;
  var parsedQuestions = [];
  var normalizedQuestions = [];
  var questionList = [];
  var invalidQuestions = [];
  var parseError = "";

  try {
    if (!questionField) {
      throw new Error("未找到试题引用字段，请确认已添加引用字段，且别名为 exam 或 questionTxt");
    }

    parsedQuestions = parseQuestionValue(questionField.value);
    normalizedQuestions = parsedQuestions.map(function(item, index) {
      return normalizeQuestion(item, index);
    });

    invalidQuestions = normalizedQuestions
      .filter(function(item) {
        return !item.isValid;
      })
      .map(function(item) {
        return item.message;
      });

    questionList = normalizedQuestions.filter(function(item) {
      return item.isValid;
    });
  } catch (err) {
    parseError = err && err.message ? err.message : "未知错误";
  }

  function parseStoredAnswers(rawValue) {
    try {
      var raw = rawValue ? JSON.parse(rawValue) : {};
      return migrateUserAnswers(questionList, raw);
    } catch (err) {
      return {};
    }
  }

  var questionValueDep = questionField ? questionField.value : "";
  var stateRef = React.useRef(null);
  if (!stateRef.current || stateRef.current.dep !== questionValueDep) {
    stateRef.current = {
      dep: questionValueDep,
      answers: parseStoredAnswers(value),
      index: 0
    };
  }

  var answersState = React.useState(stateRef.current.answers);
  var userAnswers = answersState[0];
  var setUserAnswers = answersState[1];

  var indexState = React.useState(stateRef.current.index);
  var currentIndex = indexState[0];
  var setCurrentIndex = indexState[1];

  React.useEffect(function() {
    var nextAnswers = parseStoredAnswers(value);
    stateRef.current = {
      dep: questionValueDep,
      answers: nextAnswers,
      index: 0
    };
    setUserAnswers(nextAnswers);
    setCurrentIndex(0);
  }, [value, questionValueDep]);

  var total = questionList.length;
  var safeIndex = total > 0 ? Math.min(Math.max(currentIndex, 0), total - 1) : 0;
  var q = total > 0 ? questionList[safeIndex] : null;
  var userAns = q ? userAnswers[safeIndex] : undefined;
  var progressPct = total > 0 ? ((safeIndex + 1) / total) * 100 : 0;

  function persistAnswers(newAnswers) {
    stateRef.current.answers = newAnswers;
    setUserAnswers(newAnswers);
    if (typeof onChange === "function") {
      onChange(JSON.stringify(newAnswers));
    }
  }

  function handleAnswer(qIndex, type, storedVal) {
    var qu;
    var newAnswers;
    var arr;
    var optionPos;

    if (env.isDisabled) return;

    qu = questionList[qIndex];
    newAnswers = {};
    Object.keys(userAnswers || {}).forEach(function(key) {
      newAnswers[key] = userAnswers[key];
    });

    if (type === "多选题") {
      arr = Array.isArray(newAnswers[qIndex]) ? newAnswers[qIndex].slice() : [];
      if (qu && Array.isArray(qu.options)) {
        arr = arr.map(function(item) {
          var matchedIndex = qu.options.findIndex(function(option) {
            return option === item;
          });
          if (matchedIndex >= 0) {
            return getOptionKey(qu.options[matchedIndex], matchedIndex);
          }
          return item;
        });
      }

      optionPos = arr.indexOf(storedVal);
      if (optionPos >= 0) {
        newAnswers[qIndex] = arr.filter(function(item) {
          return item !== storedVal;
        });
      } else {
        newAnswers[qIndex] = arr.concat([storedVal]);
      }
    } else {
      newAnswers[qIndex] = storedVal;
    }

    persistAnswers(newAnswers);

    if (type !== "多选题" && qIndex === safeIndex && safeIndex < total - 1) {
      setCurrentIndex(function(prev) {
        return qIndex === prev && prev < total - 1 ? prev + 1 : prev;
      });
    }
  }

  function goPrev() {
    if (env.isDisabled) return;
    setCurrentIndex(function(prev) {
      return Math.max(0, prev - 1);
    });
  }

  function goNext() {
    if (env.isDisabled) return;
    setCurrentIndex(function(prev) {
      return Math.min(total - 1, prev + 1);
    });
  }

  function isSingleChecked(answerValue, key, option) {
    return answerValue === key || answerValue === option;
  }

  function isMultiChecked(answerValue, key, option) {
    var arr = Array.isArray(answerValue) ? answerValue : [];
    return arr.indexOf(key) >= 0 || arr.indexOf(option) >= 0;
  }

  function getAnsweredCount() {
    var count = 0;
    questionList.forEach(function(item, index) {
      var answerValue = userAnswers[index];
      if (answerValue === undefined || answerValue === null || answerValue === "") return;
      if (Array.isArray(answerValue) && answerValue.length === 0) return;
      count += 1;
    });
    return count;
  }

  if (parseError) {
    return (
      <div className="text-red-500 p-3 border border-red-200 rounded">
        <div className="font-medium">试题解析失败：{parseError}</div>
        <div className="text-sm mt-1">
          请检查：<br />
          1. 是否已在右侧添加引用字段，别名是否为 questionTxt 或 exam<br />
          2. 试题字段是否为有效 JSON / JSON 字符串 / 对象数组<br />
          3. 右侧引用字段中的试题内容是否真的有值
        </div>
      </div>
    );
  }

  if (questionList.length === 0) {
    return (
      <div className="p-3 border border-yellow-200 rounded bg-yellow-50 text-yellow-800 space-y-2">
        <div className="font-medium">暂无可渲染的试题</div>
        {invalidQuestions.length > 0 ? (
          <div className="text-sm">
            {invalidQuestions.map(function(message, index) {
              return <div key={index}>{message}</div>;
            })}
          </div>
        ) : null}
      </div>
    );
  }

  if (!q) {
    return (
      <div className="p-3 border border-yellow-200 rounded bg-yellow-50 text-yellow-800">
        当前试题索引无效，请刷新后重试。
      </div>
    );
  }

  var idx = safeIndex;
  var isMulti = q.type === "多选题";
  var isLast = idx >= total - 1;
  var answeredCount = getAnsweredCount();

  return (
    <div className="space-y-4 p-1 max-w-2xl mx-auto">
      {invalidQuestions.length > 0 ? (
        <div className="p-3 border border-yellow-200 rounded bg-yellow-50 text-yellow-800 text-sm space-y-1">
          <div className="font-medium">以下题目已跳过：</div>
          {invalidQuestions.map(function(message, index) {
            return <div key={index}>{message}</div>;
          })}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-sm text-gray-600">
        <span className="font-medium text-gray-800">
          第 {idx + 1} / {total} 题
        </span>
        <span>已答 {answeredCount} / {total}</span>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300 rounded-full"
          style={{ width: progressPct + "%" }}
        />
      </div>

      <div className="border rounded-lg p-4 bg-white shadow-sm">
        <div className="font-medium text-gray-800 mb-3">
          {idx + 1}. {q.question}
          <span className="ml-2 text-xs text-gray-500">({q.type})</span>
        </div>

        {isMulti ? (
          <p className="text-xs text-gray-500 mb-3">多选题需勾选后点击「下一题」切换；每次勾选都会自动保存。</p>
        ) : null}

        <div className="space-y-2">
          {q.type === "判断题" ? (
            <React.Fragment>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  disabled={env.isDisabled}
                  checked={userAns === "对"}
                  onChange={function() {
                    handleAnswer(idx, q.type, "对");
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span>对</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  disabled={env.isDisabled}
                  checked={userAns === "错"}
                  onChange={function() {
                    handleAnswer(idx, q.type, "错");
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span>错</span>
              </label>
            </React.Fragment>
          ) : null}

          {q.type === "单选题"
            ? q.options.map(function(opt, i) {
                var key = getOptionKey(opt, i);
                return (
                  <label key={i} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      disabled={env.isDisabled}
                      checked={isSingleChecked(userAns, key, opt)}
                      onChange={function() {
                        handleAnswer(idx, q.type, key);
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })
            : null}

          {q.type === "多选题"
            ? q.options.map(function(opt, i) {
                var key = getOptionKey(opt, i);
                return (
                  <label key={i} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={env.isDisabled}
                      checked={isMultiChecked(userAns, key, opt)}
                      onChange={function() {
                        handleAnswer(idx, q.type, key);
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })
            : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={env.isDisabled || idx <= 0}
          onClick={goPrev}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          上一题
        </button>

        <button
          type="button"
          disabled={env.isDisabled || isLast}
          onClick={goNext}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          下一题
        </button>

        {isLast && !isMulti ? (
          <span className="text-sm text-green-600 ml-auto">已是最后一题，答案已保存。</span>
        ) : null}

        {isLast && isMulti ? (
          <span className="text-sm text-green-600 ml-auto">最后一题；勾选后点击「上一题」可回看，数据已实时保存。</span>
        ) : null}
      </div>
    </div>
  );
}
