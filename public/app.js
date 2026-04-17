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
    const response = await fetch("/api/analyze", {
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
    statusText.textContent = error.message || "診断に失敗しました。";
  } finally {
    setLoading(false);
  }
});

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
