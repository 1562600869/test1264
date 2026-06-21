const CATEGORIES = ["信号灯", "标志标线", "行车规范", "违章处罚"];
const STORAGE_KEYS = {
  WRONG: "jtfg_wrong_book",
  STATS: "jtfg_stats",
  HISTORY: "jtfg_history",
  DAILY: "jtfg_daily_count"
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function getWrongBook() { return loadJSON(STORAGE_KEYS.WRONG, {}); }
function saveWrongBook(wb) { saveJSON(STORAGE_KEYS.WRONG, wb); }

function getStats() {
  return loadJSON(STORAGE_KEYS.STATS, {
    "信号灯": {total:0, correct:0},
    "标志标线": {total:0, correct:0},
    "行车规范": {total:0, correct:0},
    "违章处罚": {total:0, correct:0}
  });
}
function saveStats(s) { saveJSON(STORAGE_KEYS.STATS, s); }

function getHistory() { return loadJSON(STORAGE_KEYS.HISTORY, []); }
function saveHistory(h) { saveJSON(STORAGE_KEYS.HISTORY, h); }

function getDailyCount(dateKey) {
  const all = loadJSON(STORAGE_KEYS.DAILY, {});
  return all[dateKey] ?? 0;
}
function incrementDailyCount() {
  const key = todayKey();
  const all = loadJSON(STORAGE_KEYS.DAILY, {});
  all[key] = (all[key] ?? 0) + 1;
  saveJSON(STORAGE_KEYS.DAILY, all);
  updateTodayCount();
}
function updateTodayCount() {
  document.getElementById("todayCount").textContent = `今日练习：${getDailyCount(todayKey())} 次`;
}

function addWrong(idx) {
  const wb = getWrongBook();
  if (!wb[idx]) wb[idx] = { wrongStreak: 0, correctStreak: 0, added: Date.now() };
  wb[idx].wrongStreak++;
  wb[idx].correctStreak = 0;
  saveWrongBook(wb);
}

function updateWrongOnCorrect(idx) {
  const wb = getWrongBook();
  if (!wb[idx]) return false;
  wb[idx].correctStreak = (wb[idx].correctStreak || 0) + 1;
  let removed = false;
  if (wb[idx].correctStreak >= 2) {
    delete wb[idx];
    removed = true;
  }
  saveWrongBook(wb);
  return removed;
}

function updateStats(category, correct) {
  const s = getStats();
  if (!s[category]) s[category] = {total:0, correct:0};
  s[category].total++;
  if (correct) s[category].correct++;
  saveStats(s);
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-content").forEach(c => {
    c.classList.toggle("active", c.id === `tab-${tab}`);
  });
  const labels = {home:"首页", practice:"分类练习", exam:"模拟考试", wrong:"错题本", stats:"学习统计"};
  document.getElementById("modeLabel").textContent = `模式：${labels[tab]||""}`;
  if (tab === "stats") { drawRadarChart(); renderStats(); }
  if (tab === "wrong") { updateWrongCount(); }
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function renderQuestion(q, idx, options) {
  const letters = ["A", "B", "C", "D"];
  let html = `
    <div class="question-card" data-idx="${idx}">
      <div class="q-meta">
        <span class="q-category">${q.category}</span>
        <span class="q-number">第 ${options.position} 题 / 共 ${options.total} 题</span>
      </div>
      <div class="q-text">${options.position}. ${q.q}</div>
      <div class="options">
  `;
  q.o.forEach((opt, i) => {
    html += `
      <div class="option" data-opt="${i}">
        <span class="option-letter">${letters[i]}</span>
        <span class="option-text">${opt}</span>
      </div>
    `;
  });
  html += `</div><div class="q-actions">`;
  if (options.showNav) {
    if (options.hasNext) html += `<button class="btn-primary next-btn">下一题</button>`;
    else html += `<button class="btn-primary finish-btn">完成练习</button>`;
    if (options.hasPrev) html += `<button class="btn-secondary prev-btn">上一题</button>`;
  }
  if (options.submitBtn) html += `<button class="btn-primary submit-answer-btn">确认答案</button>`;
  html += `</div><div class="q-feedback-area"></div></div>`;
  return html;
}

// ============ 分类练习 ============
let practiceState = null;

document.querySelectorAll(".cat-btn").forEach(btn => {
  btn.addEventListener("click", () => startPractice(btn.dataset.cat));
});

function startPractice(category) {
  document.querySelectorAll(".cat-btn").forEach(b => b.classList.toggle("active", b.dataset.cat === category));
  let indices = [];
  if (category === "all") {
    indices = QUESTIONS.map((_, i) => i);
  } else {
    QUESTIONS.forEach((q, i) => { if (q.category === category) indices.push(i); });
  }
  indices = shuffle(indices);
  practiceState = {
    indices,
    current: 0,
    answers: {},
    submitted: {},
    stats: {total:0, correct:0, wrong:0}
  };
  renderPracticeQuestion();
  document.getElementById("practice-area").classList.remove("hidden");
}

function renderPracticeQuestion() {
  const {indices, current} = practiceState;
  const idx = indices[current];
  const q = QUESTIONS[idx];
  const area = document.getElementById("practice-area");
  area.innerHTML = renderQuestion(q, idx, {
    position: current + 1,
    total: indices.length,
    hasNext: current < indices.length - 1,
    hasPrev: current > 0,
    showNav: false,
    submitBtn: true
  });
  bindPracticeOptionClicks(area, idx);
  area.querySelector(".submit-answer-btn").addEventListener("click", () => submitPracticeAnswer(idx));
  if (practiceState.submitted[idx]) {
    markAnswerUI(area, idx, practiceState.answers[idx]);
  }
}

function bindPracticeOptionClicks(area, qIdx) {
  area.querySelectorAll(".option").forEach(opt => {
    opt.addEventListener("click", () => {
      if (practiceState.submitted[qIdx]) return;
      area.querySelectorAll(".option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      practiceState.answers[qIdx] = parseInt(opt.dataset.opt, 10);
    });
  });
}

function markAnswerUI(area, qIdx, userAns) {
  const q = QUESTIONS[qIdx];
  area.querySelectorAll(".option").forEach(o => {
    const oi = parseInt(o.dataset.opt, 10);
    if (oi === q.a) o.classList.add("correct");
    if (oi === userAns && oi !== q.a) o.classList.add("wrong");
  });
  const letters = ["A","B","C","D"];
  const fb = area.querySelector(".q-feedback-area");
  if (userAns === q.a) {
    fb.innerHTML = `<div class="q-feedback feedback-correct">✅ 回答正确！正确答案是 ${letters[q.a]}</div>`;
  } else {
    fb.innerHTML = `<div class="q-feedback feedback-wrong">❌ 回答错误！你的答案是 ${letters[userAns]}，正确答案是 ${letters[q.a]}</div>`;
  }
  const actions = area.querySelector(".q-actions");
  actions.innerHTML = "";
  if (practiceState.current < practiceState.indices.length - 1) {
    actions.innerHTML += `<button class="btn-primary next-practice-btn">下一题</button>`;
    actions.querySelector(".next-practice-btn").addEventListener("click", () => {
      practiceState.current++;
      renderPracticeQuestion();
    });
  } else {
    actions.innerHTML += `<button class="btn-primary finish-practice-btn">完成练习</button>`;
    actions.querySelector(".finish-practice-btn").addEventListener("click", () => {
      finishPractice();
    });
  }
  if (practiceState.current > 0) {
    actions.innerHTML += `<button class="btn-secondary prev-practice-btn">上一题</button>`;
    actions.querySelector(".prev-practice-btn").addEventListener("click", () => {
      practiceState.current--;
      renderPracticeQuestion();
    });
  }
}

function submitPracticeAnswer(qIdx) {
  if (practiceState.submitted[qIdx]) return;
  const userAns = practiceState.answers[qIdx];
  if (userAns === undefined) { alert("请先选择一个答案"); return; }
  practiceState.submitted[qIdx] = true;
  const q = QUESTIONS[qIdx];
  const correct = userAns === q.a;
  practiceState.stats.total++;
  if (correct) practiceState.stats.correct++;
  else practiceState.stats.wrong++;
  updateStats(q.category, correct);
  if (correct) {
    updateWrongOnCorrect(qIdx);
  } else {
    addWrong(qIdx);
  }
  const area = document.getElementById("practice-area");
  markAnswerUI(area, qIdx, userAns);
}

function finishPractice() {
  incrementDailyCount();
  const {stats} = practiceState;
  const area = document.getElementById("practice-area");
  const rate = stats.total > 0 ? Math.round(stats.correct/stats.total*100) : 0;
  area.innerHTML = `
    <div class="result-area">
      <h2>练习完成 🎉</h2>
      <div class="result-pass">正确率 ${rate}%</div>
      <div class="result-detail">
        <div>总题量<strong>${stats.total}</strong></div>
        <div style="color:#16a34a;">答对<strong>${stats.correct}</strong></div>
        <div style="color:#dc2626;">答错<strong>${stats.wrong}</strong></div>
      </div>
      <div style="margin-top:24px;">
        <button class="btn-primary" onclick="switchTab('practice')">再练一次</button>
        <button class="btn-secondary" onclick="switchTab('stats')">查看统计</button>
      </div>
    </div>
  `;
}

// ============ 模拟考试 ============
let examState = null;
let examTimerInterval = null;
const EXAM_TOTAL_MS = 45 * 60 * 1000;

document.getElementById("startExamBtn").addEventListener("click", startExam);
document.getElementById("submitExamBtn").addEventListener("click", submitExam);

function startExam() {
  const shuffled = shuffle(QUESTIONS.map((_, i) => i));
  const indices = shuffled.slice(0, 45);
  examState = {
    indices,
    answers: {},
    submitted: false,
    startAt: Date.now(),
    endAt: Date.now() + EXAM_TOTAL_MS
  };
  document.getElementById("startExamBtn").classList.add("hidden");
  document.getElementById("submitExamBtn").classList.remove("hidden");
  document.getElementById("exam-area").classList.remove("hidden");
  document.getElementById("exam-result").classList.add("hidden");
  renderExamPage();
  startExamTimer();
  incrementDailyCount();
}

function renderExamPage() {
  const {indices} = examState;
  const letters = ["A","B","C","D"];
  let html = `<form id="examForm">`;
  indices.forEach((idx, pos) => {
    const q = QUESTIONS[idx];
    html += `
      <div class="question-card" data-idx="${idx}">
        <div class="q-meta">
          <span class="q-category">${q.category}</span>
          <span class="q-number">第 ${pos+1} 题 / 45 题</span>
        </div>
        <div class="q-text">${pos+1}. ${q.q}</div>
        <div class="options">
    `;
    q.o.forEach((opt, i) => {
      const selected = examState.answers[idx] === i;
      html += `
        <label class="option" style="cursor:pointer;">
          <input type="radio" name="q_${idx}" value="${i}" ${selected?"checked":""} style="display:none;">
          <span class="option-letter">${letters[i]}</span>
          <span class="option-text">${opt}</span>
        </label>
      `;
    });
    html += `</div></div>`;
  });
  html += `</form>`;
  document.getElementById("exam-area").innerHTML = html;
  bindExamOptionClicks();
  updateExamProgress();
}

function bindExamOptionClicks() {
  document.querySelectorAll("#exam-area .option").forEach(opt => {
    opt.addEventListener("click", (e) => {
      e.preventDefault();
      if (examState.submitted) return;
      const radio = opt.querySelector("input[type=radio]");
      radio.checked = true;
      const card = opt.closest(".question-card");
      const qIdx = parseInt(card.dataset.idx, 10);
      const val = parseInt(radio.value, 10);
      examState.answers[qIdx] = val;
      card.querySelectorAll(".option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      updateExamProgress();
    });
  });
  Object.entries(examState.answers).forEach(([idx, val]) => {
    const card = document.querySelector(`.question-card[data-idx="${idx}"]`);
    if (card) {
      const opts = card.querySelectorAll(".option");
      if (opts[val]) opts[val].classList.add("selected");
    }
  });
}

function updateExamProgress() {
  const answered = Object.keys(examState.answers).length;
  document.getElementById("examProgress").textContent = `📋 进度：${answered} / 45`;
}

function startExamTimer() {
  updateExamTimerDisplay();
  examTimerInterval = setInterval(() => {
    if (!examState || examState.submitted) { clearInterval(examTimerInterval); return; }
    const remain = examState.endAt - Date.now();
    if (remain <= 0) {
      clearInterval(examTimerInterval);
      alert("考试时间到！系统将自动提交试卷。");
      submitExam();
      return;
    }
    updateExamTimerDisplay();
  }, 500);
}

function updateExamTimerDisplay() {
  const remain = Math.max(0, examState.endAt - Date.now());
  const mins = Math.floor(remain / 60000);
  const secs = Math.floor((remain % 60000) / 1000);
  const txt = `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
  const el = document.getElementById("examTimer");
  el.textContent = `⏱️ 剩余时间：${txt}`;
  if (mins <= 5) el.classList.add("exam-timer-warning");
  else el.classList.remove("exam-timer-warning");
}

function submitExam() {
  if (!examState || examState.submitted) return;
  if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
  examState.submitted = true;
  const {indices, answers} = examState;
  let correct = 0, wrong = 0, unanswered = 0;
  const catStats = {};
  CATEGORIES.forEach(c => catStats[c] = {correct:0, total:0});
  const letters = ["A","B","C","D"];
  indices.forEach(idx => {
    const q = QUESTIONS[idx];
    const ans = answers[idx];
    catStats[q.category].total++;
    updateStats(q.category, ans === q.a);
    if (ans === q.a) { correct++; catStats[q.category].correct++; updateWrongOnCorrect(idx); }
    else if (ans === undefined) { unanswered++; addWrong(idx); }
    else { wrong++; addWrong(idx); }
  });
  const score = correct * 2;
  const pass = score >= 90;
  document.querySelectorAll("#exam-area .question-card").forEach(card => {
    const qIdx = parseInt(card.dataset.idx, 10);
    const q = QUESTIONS[qIdx];
    const userAns = answers[qIdx];
    card.querySelectorAll(".option").forEach(o => {
      const oi = parseInt(o.querySelector("input").value, 10);
      if (oi === q.a) o.classList.add("correct");
      if (oi === userAns && oi !== q.a) o.classList.add("wrong");
    });
    const fb = document.createElement("div");
    fb.className = "q-feedback-area";
    if (userAns === q.a) {
      fb.innerHTML = `<div class="q-feedback feedback-correct">✅ 正确 (${letters[q.a]})</div>`;
    } else if (userAns === undefined) {
      fb.innerHTML = `<div class="q-feedback feedback-wrong">❌ 未作答，正确答案是 ${letters[q.a]}</div>`;
    } else {
      fb.innerHTML = `<div class="q-feedback feedback-wrong">❌ 你选了 ${letters[userAns]}，正确答案是 ${letters[q.a]}</div>`;
    }
    card.appendChild(fb);
  });
  document.getElementById("submitExamBtn").classList.add("hidden");
  const result = document.getElementById("exam-result");
  result.classList.remove("hidden");
  result.innerHTML = `
    <div class="result-area" style="background:${pass?'linear-gradient(145deg, #f0fdf4, #dcfce7)':'linear-gradient(145deg, #fef2f2, #fee2e2)'}; border-color:${pass?'#86efac':'#fca5a5'};">
      <h2>${pass?'🎉 恭喜通过！':'💪 继续加油！'}</h2>
      <div class="result-score" style="color:${pass?'#166534':'#991b1b'};">${score}<span style="font-size:24px;"> / 90</span></div>
      <div class="${pass?'result-pass':'result-fail'}">${pass?'已达到合格分数线 (≥90分)':'未达到合格分数线 (≥90分)'}</div>
      <div class="result-detail">
        <div>答对<strong style="color:#16a34a;">${correct}</strong></div>
        <div>答错<strong style="color:#dc2626;">${wrong}</strong></div>
        <div>未答<strong style="color:#92400e;">${unanswered}</strong></div>
        <div>用时<strong style="color:#1e40af;">${msToTime(Date.now() - examState.startAt)}</strong></div>
      </div>
      <div style="margin-top:16px; font-size:13px; color:#64748b;">
        各类别正确率：${CATEGORIES.map(c => `${c} ${catStats[c].total>0?Math.round(catStats[c].correct/catStats[c].total*100):0}%`).join(" · ")}
      </div>
      <div style="margin-top:24px;">
        <button class="btn-primary" onclick="resetExam()">重新考试</button>
        <button class="btn-secondary" onclick="switchTab('wrong')">查看错题</button>
        <button class="btn-secondary" onclick="switchTab('stats')">学习统计</button>
      </div>
    </div>
  `;
  saveHistoryRecord({
    type: "exam",
    score, pass, correct, wrong, unanswered,
    time: Date.now(),
    duration: Date.now() - examState.startAt
  });
}

function resetExam() {
  examState = null;
  document.getElementById("exam-area").classList.add("hidden");
  document.getElementById("exam-result").classList.add("hidden");
  document.getElementById("startExamBtn").classList.remove("hidden");
  document.getElementById("submitExamBtn").classList.add("hidden");
  document.getElementById("examTimer").textContent = "⏱️ 剩余时间：45:00";
  document.getElementById("examTimer").classList.remove("exam-timer-warning");
  document.getElementById("examProgress").textContent = "📋 进度：0 / 45";
}

function msToTime(ms) {
  const m = Math.floor(ms/60000);
  const s = Math.floor((ms%60000)/1000);
  return `${m}分${s}秒`;
}

function saveHistoryRecord(record) {
  const h = getHistory();
  h.unshift(record);
  saveHistory(h.slice(0, 100));
}

// ============ 错题本 ============
let wrongState = null;

function updateWrongCount() {
  const wb = getWrongBook();
  document.getElementById("wrongCount").textContent = `错题本：共 ${Object.keys(wb).length} 题`;
}

document.getElementById("startWrongBtn").addEventListener("click", startWrongPractice);
document.getElementById("clearWrongBtn").addEventListener("click", () => {
  if (confirm("确定要清空错题本吗？")) {
    saveWrongBook({});
    updateWrongCount();
    document.getElementById("wrong-area").classList.add("hidden");
  }
});

function startWrongPractice() {
  const wb = getWrongBook();
  const indices = Object.keys(wb).map(k => parseInt(k, 10));
  if (indices.length === 0) { alert("错题本是空的，继续保持！"); return; }
  wrongState = {
    indices: shuffle(indices),
    current: 0,
    answers: {},
    submitted: {},
    stats: {correct:0, wrong:0, removed:0}
  };
  renderWrongQuestion();
  document.getElementById("wrong-area").classList.remove("hidden");
  incrementDailyCount();
}

function renderWrongQuestion() {
  const {indices, current} = wrongState;
  const idx = indices[current];
  const q = QUESTIONS[idx];
  const area = document.getElementById("wrong-area");
  area.innerHTML = renderQuestion(q, idx, {
    position: current + 1,
    total: indices.length,
    hasNext: current < indices.length - 1,
    hasPrev: current > 0,
    showNav: false,
    submitBtn: true
  });
  area.querySelectorAll(".option").forEach(opt => {
    opt.addEventListener("click", () => {
      if (wrongState.submitted[idx]) return;
      area.querySelectorAll(".option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      wrongState.answers[idx] = parseInt(opt.dataset.opt, 10);
    });
  });
  area.querySelector(".submit-answer-btn").addEventListener("click", () => submitWrongAnswer(idx));
  if (wrongState.submitted[idx]) markWrongUI(area, idx, wrongState.answers[idx]);
}

function markWrongUI(area, qIdx, userAns) {
  const q = QUESTIONS[qIdx];
  area.querySelectorAll(".option").forEach(o => {
    const oi = parseInt(o.dataset.opt, 10);
    if (oi === q.a) o.classList.add("correct");
    if (oi === userAns && oi !== q.a) o.classList.add("wrong");
  });
  const letters = ["A","B","C","D"];
  const fb = area.querySelector(".q-feedback-area");
  const wb = getWrongBook();
  const correctStreak = wb[qIdx] ? wb[qIdx].correctStreak : 0;
  if (userAns === q.a) {
    const removed = updateWrongOnCorrect(qIdx);
    wrongState.stats.correct++;
    if (removed) {
      wrongState.stats.removed++;
      fb.innerHTML = `<div class="q-feedback feedback-correct">✅ 正确！连续答对2次，已从错题本移出 🎉</div>`;
    } else {
      fb.innerHTML = `<div class="q-feedback feedback-correct">✅ 正确！已连续答对 ${correctStreak}/2 次</div>`;
    }
  } else {
    wrongState.stats.wrong++;
    fb.innerHTML = `<div class="q-feedback feedback-wrong">❌ 错！你选${letters[userAns]}，正确答案是${letters[q.a]}</div>`;
  }
  const actions = area.querySelector(".q-actions");
  actions.innerHTML = "";
  if (wrongState.current < wrongState.indices.length - 1) {
    actions.innerHTML += `<button class="btn-primary next-wrong-btn">下一题</button>`;
    actions.querySelector(".next-wrong-btn").addEventListener("click", () => {
      wrongState.current++;
      renderWrongQuestion();
    });
  } else {
    actions.innerHTML += `<button class="btn-primary finish-wrong-btn">完成练习</button>`;
    actions.querySelector(".finish-wrong-btn").addEventListener("click", finishWrongPractice);
  }
  if (wrongState.current > 0) {
    actions.innerHTML += `<button class="btn-secondary prev-wrong-btn">上一题</button>`;
    actions.querySelector(".prev-wrong-btn").addEventListener("click", () => {
      wrongState.current--;
      renderWrongQuestion();
    });
  }
}

function submitWrongAnswer(qIdx) {
  if (wrongState.submitted[qIdx]) return;
  const userAns = wrongState.answers[qIdx];
  if (userAns === undefined) { alert("请先选择答案"); return; }
  wrongState.submitted[qIdx] = true;
  const q = QUESTIONS[qIdx];
  updateStats(q.category, userAns === q.a);
  if (userAns !== q.a) addWrong(qIdx);
  const area = document.getElementById("wrong-area");
  markWrongUI(area, qIdx, userAns);
}

function finishWrongPractice() {
  const {stats} = wrongState;
  const area = document.getElementById("wrong-area");
  area.innerHTML = `
    <div class="result-area">
      <h2>错题练习完成 ✨</h2>
      <div class="result-pass">本次共 ${stats.correct + stats.wrong} 题</div>
      <div class="result-detail">
        <div style="color:#16a34a;">答对<strong>${stats.correct}</strong></div>
        <div style="color:#dc2626;">答错<strong>${stats.wrong}</strong></div>
        <div style="color:#7c3aed;">移出错题本<strong>${stats.removed}</strong></div>
      </div>
      <div style="margin-top:24px;">
        <button class="btn-primary" onclick="startWrongPractice()">再练一次</button>
        <button class="btn-secondary" onclick="switchTab('stats')">查看统计</button>
      </div>
    </div>
  `;
  updateWrongCount();
}

// ============ 雷达图 & 统计 ============
function drawRadarChart() {
  const canvas = document.getElementById("radarChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2;
  const radius = Math.min(W, H) * 0.32;
  ctx.clearRect(0, 0, W, H);
  const stats = getStats();
  const rates = CATEGORIES.map(c => {
    const s = stats[c];
    return s.total > 0 ? s.correct/s.total : 0;
  });
  for (let lvl = 5; lvl >= 1; lvl--) {
    const r = radius * lvl / 5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = -Math.PI/2 + i * Math.PI/2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (lvl % 5 === 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px sans-serif";
      ctx.fillText(`${lvl*20}%`, cx+4, cy - r + 10);
    }
  }
  for (let i = 0; i < 4; i++) {
    const angle = -Math.PI/2 + i * Math.PI/2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = -Math.PI/2 + i * Math.PI/2;
    const r = radius * rates[i];
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(59, 130, 246, 0.35)";
  ctx.fill();
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const angle = -Math.PI/2 + i * Math.PI/2;
    const r = radius * rates[i];
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI*2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const angle = -Math.PI/2 + i * Math.PI/2;
    const labelR = radius + 36;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);
    const pct = Math.round(rates[i] * 100);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "#1e293b";
    ctx.fillText(`${CATEGORIES[i]}`, lx, ly - 8);
    ctx.font = "bold 15px sans-serif";
    ctx.fillStyle = "#3b82f6";
    ctx.fillText(`${pct}%`, lx, ly + 10);
  }
}

function renderStats() {
  const stats = getStats();
  const listEl = document.getElementById("statsList");
  let html = "";
  let grandTotal = 0, grandCorrect = 0;
  CATEGORIES.forEach(c => {
    const s = stats[c];
    const rate = s.total > 0 ? Math.round(s.correct/s.total*100) : 0;
    grandTotal += s.total; grandCorrect += s.correct;
    html += `
      <div class="stat-item">
        <span style="width:80px; font-weight:600;">${c}</span>
        <div class="bar"><div class="bar-fill" style="width:${rate}%;"></div></div>
        <span style="width:120px; text-align:right; color:#475569;">${s.correct}/${s.total} (${rate}%)</span>
      </div>
    `;
  });
  const grandRate = grandTotal > 0 ? Math.round(grandCorrect/grandTotal*100) : 0;
  html += `
    <div class="stat-item" style="border-top:2px solid #cbd5e1; padding-top:14px; margin-top:4px;">
      <span style="width:80px; font-weight:700; color:#1e293b;">合计</span>
      <div class="bar"><div class="bar-fill" style="width:${grandRate}%; background:linear-gradient(90deg,#10b981,#3b82f6);"></div></div>
      <span style="width:120px; text-align:right; font-weight:700; color:#1e40af;">${grandCorrect}/${grandTotal} (${grandRate}%)</span>
    </div>
  `;
  listEl.innerHTML = html;
  const hist = getHistory().slice(0, 20);
  const histEl = document.getElementById("historyList");
  if (hist.length === 0) {
    histEl.innerHTML = `<div style="color:#94a3b8; font-size:13px; padding:12px;">暂无练习记录</div>`;
  } else {
    histEl.innerHTML = hist.map(r => {
      const d = new Date(r.time);
      const dateStr = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
      if (r.type === "exam") {
        return `<div class="history-item"><span>📝 ${dateStr} 模拟考试</span><span style="font-weight:600; color:${r.pass?'#16a34a':'#dc2626'};">${r.score}分 ${r.pass?'通过':'未通过'}</span></div>`;
      }
      return `<div class="history-item"><span>✅ ${dateStr} 练习</span><span>${r.correct||0}对/${r.total||0}</span></div>`;
    }).join("");
  }
}

// ============ 初始化 ============
document.addEventListener("DOMContentLoaded", () => {
  updateTodayCount();
});
