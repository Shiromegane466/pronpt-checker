const form = document.querySelector("#prompt-form");
const input = document.querySelector("#prompt-input");
const charCount = document.querySelector("#char-count");
const statusText = document.querySelector("#status");
const analyzeButton = document.querySelector("#analyze-button");
const resetButton = document.querySelector("#reset-button");
const sampleButton = document.querySelector("#sample-button");
const resultContent = document.querySelector("#result-content");
const modeBadge = document.querySelector("#mode-badge");
const originalOutput = document.querySelector("#original-output");
const scoreRing = document.querySelector("#score-ring");
const scoreValue = document.querySelector("#score-value");
const summary = document.querySelector("#summary");
const strengths = document.querySelector("#strengths");
const issues = document.querySelector("#issues");
const questions = document.querySelector("#questions");
const improvedPrompt = document.querySelector("#improved-prompt");
const copyButton = document.querySelector("#copy-button");
const reuseButton = document.querySelector("#reuse-button");

const samplePrompt =
  "新しい勤怠管理アプリの紹介文を作成してください。シフト作成や勤怠確認に時間がかかっている人に向けて、便利そうだと感じてもらえるように、いい感じにまとめてください。";

let lastImprovedPrompt = "";

input.addEventListener("input", updateCharCount);

sampleButton.addEventListener("click", () => {
  input.value = samplePrompt;
  updateCharCount();
  input.focus();
});

resetButton.addEventListener("click", () => {
  form.reset();
  updateCharCount();
  clearResult();
  statusText.textContent = "";
  input.focus();
});

copyButton.addEventListener("click", async () => {
  if (!lastImprovedPrompt) return;
  await navigator.clipboard.writeText(lastImprovedPrompt);
  copyButton.textContent = "コピー済み";
  setTimeout(() => {
    copyButton.textContent = "コピー";
  }, 1400);
});

reuseButton.addEventListener("click", () => {
  if (!lastImprovedPrompt) return;
  input.value = lastImprovedPrompt;
  updateCharCount();
  input.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = input.value.trim();

  if (!prompt) {
    statusText.textContent = "プロンプトを入力してください。";
    return;
  }

  setLoading(true);
  statusText.textContent = "診断しています。";

  try {
    const response = await fetch("api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "診断に失敗しました。");
    }

    renderResult(payload.result, payload.mode);
    statusText.textContent =
      payload.mode === "local"
        ? "ローカル診断で表示しています。OPENAI_API_KEYを設定するとLLM診断に切り替わります。"
        : "診断が完了しました。";
  } catch (error) {
    const result = analyzeInBrowser(prompt);
    renderResult(result, "local");
    statusText.textContent =
      "APIに接続できないため、ブラウザ内の簡易診断で表示しています。";
  } finally {
    setLoading(false);
  }
});

function analyzeInBrowser(prompt) {
  const checks = {
    hasGoal: /したい|してください|作成|生成|分析|要約|比較|提案|write|create|summarize|analyze/i.test(prompt),
    hasContext: /背景|前提|目的|状況|context|background|対象|audience/i.test(prompt),
    hasFormat: /形式|表|箇条書き|json|markdown|出力|format|table|bullet/i.test(prompt),
    hasConstraints: /以内|文字|トーン|文体|条件|制約|禁止|必ず|constraint|tone|style/i.test(prompt),
    hasExamples: /例|example|サンプル/i.test(prompt),
    vague: /(いい感じ|適当に|なんか|よしなに|なるべく|できるだけ)/.test(prompt),
    risky: /(api[_ -]?key|password|パスワード|秘密鍵|secret|token|前の指示を無視|ignore previous)/i.test(prompt)
  };

  let score = 35;
  if (checks.hasGoal) score += 15;
  if (checks.hasContext) score += 12;
  if (checks.hasFormat) score += 15;
  if (checks.hasConstraints) score += 10;
  if (checks.hasExamples) score += 8;
  if (prompt.length > 120) score += 7;
  if (checks.vague) score -= 8;
  if (checks.risky) score -= 12;
  score = Math.max(0, Math.min(100, score));

  const issuesList = [];
  if (!checks.hasContext) {
    issuesList.push({
      priority: "high",
      title: "背景・前提が不足しています",
      reason: "モデルが何を重視すべきか判断しづらく、一般論に寄りやすくなります。",
      suggestion: "目的、利用シーン、対象読者、前提条件を追記してください。"
    });
  }
  if (!checks.hasFormat) {
    issuesList.push({
      priority: "high",
      title: "出力形式が指定されていません",
      reason: "回答の構成や粒度がモデル任せになり、期待とずれる可能性があります。",
      suggestion: "箇条書き、表、手順など希望する形式を指定してください。"
    });
  }
  if (!checks.hasConstraints) {
    issuesList.push({
      priority: "medium",
      title: "制約条件が不足しています",
      reason: "長さ、トーン、禁止事項がないと、使いづらい回答になる場合があります。",
      suggestion: "文字数、文体、対象範囲、避けたい内容を明記してください。"
    });
  }
  if (checks.vague) {
    issuesList.push({
      priority: "medium",
      title: "曖昧な表現があります",
      reason: "抽象的な指示は人によって解釈が変わり、出力品質が安定しません。",
      suggestion: "「3案」「初心者向け」「500字以内」のように測定可能な条件へ置き換えてください。"
    });
  }

  return {
    score,
    summary:
      score >= 60
        ? "依頼内容は読み取れますが、背景、出力形式、制約を補うと精度が上がります。"
        : "現状はモデルに任せる範囲が広いため、目的、前提、出力形式を明確にしましょう。",
    strengths: checks.hasGoal
      ? ["依頼したい作業内容が読み取れます。"]
      : ["短く入力されており、改善の起点にしやすいです。"],
    issues: issuesList,
    clarifying_questions: [
      "この回答は誰が、どの場面で使いますか？",
      "回答は箇条書き、表、文章、手順のどれが適していますか？",
      "文字数、トーン、除外したい内容はありますか？"
    ],
    prompt_output: buildFallbackOutput(prompt),
    improved_prompt: [
      "# 役割",
      "あなたは、ユーザーの目的に合わせて実務的で分かりやすい回答を作るアシスタントです。",
      "",
      "# 目的",
      prompt,
      "",
      "# 背景・前提",
      checks.hasContext
        ? "上記プロンプト内の背景・前提を踏まえてください。"
        : "[ここに背景、対象読者、利用シーンを入力してください]",
      "",
      "# 条件",
      "- 初心者にも分かる言葉で、曖昧な点は推測せず確認してください。",
      "- 不足情報がある場合は、回答前に確認質問をしてください。",
      "",
      "# 出力形式",
      checks.hasFormat
        ? "[元の指定に従う]"
        : "箇条書きで、最後に次のアクションを3つ提示してください。"
    ].join("\n")
  };
}

function renderResult(result, mode) {
  resultContent.hidden = false;
  modeBadge.hidden = false;
  modeBadge.textContent = mode === "local" ? "Local" : "LLM";

  const score = Number(result.score || 0);
  scoreValue.textContent = score;
  scoreRing.style.background = `conic-gradient(${scoreColor(score)} ${score * 3.6}deg, #edf1ed 0deg)`;
  summary.textContent = result.summary || "";
  originalOutput.textContent = result.prompt_output || buildFallbackOutput(input.value);

  renderList(strengths, result.strengths || []);
  renderIssues(result.issues || []);
  renderList(questions, result.clarifying_questions || []);

  lastImprovedPrompt = result.improved_prompt || "";
  improvedPrompt.textContent = lastImprovedPrompt;
}

function buildFallbackOutput(prompt) {
  return [
    "このプロンプトからは、一般的な回答が生成される可能性が高いです。",
    "",
    `入力内容: ${prompt}`,
    "",
    "背景、対象読者、出力形式、制約が不足している場合、回答は抽象的になりやすくなります。"
  ].join("\n");
}

function renderList(container, items) {
  container.replaceChildren();
  if (!items.length) {
    const item = document.createElement("li");
    item.textContent = "特にありません。";
    container.append(item);
    return;
  }

  for (const text of items) {
    const item = document.createElement("li");
    item.textContent = text;
    container.append(item);
  }
}

function renderIssues(items) {
  issues.replaceChildren();
  if (!items.length) {
    const box = document.createElement("div");
    box.className = "issue";
    box.textContent = "大きな改善点は見つかりませんでした。";
    issues.append(box);
    return;
  }

  for (const item of items) {
    const box = document.createElement("article");
    box.className = "issue";

    const title = document.createElement("div");
    title.className = "issue-title";

    const priority = document.createElement("span");
    priority.className = `priority ${item.priority || "medium"}`;
    priority.textContent = priorityLabel(item.priority);

    const titleText = document.createElement("span");
    titleText.textContent = item.title || "改善点";

    const reason = document.createElement("p");
    reason.textContent = item.reason || "";

    const suggestion = document.createElement("p");
    suggestion.textContent = item.suggestion ? `修正案: ${item.suggestion}` : "";

    title.append(priority, titleText);
    box.append(title, reason, suggestion);
    issues.append(box);
  }
}

function priorityLabel(priority) {
  if (priority === "high") return "高";
  if (priority === "low") return "低";
  return "中";
}

function scoreColor(score) {
  if (score >= 80) return "#1f7a4d";
  if (score >= 60) return "#9b6a12";
  return "#b73535";
}

function setLoading(isLoading) {
  analyzeButton.disabled = isLoading;
  sampleButton.disabled = isLoading;
  resetButton.disabled = isLoading;
  analyzeButton.textContent = isLoading ? "診断中" : "診断する";
}

function clearResult() {
  resultContent.hidden = true;
  modeBadge.hidden = true;
  originalOutput.textContent = "診断すると、入力したプロンプトから得られる回答例がここに表示されます。";
  lastImprovedPrompt = "";
}

function updateCharCount() {
  charCount.textContent = `${input.value.length} / 8000`;
}

updateCharCount();
