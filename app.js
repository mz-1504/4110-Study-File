/* ============================================
   ELI4110 Study Platform - Application Logic
   ============================================ */

(function () {
  'use strict';

  // ─── STATE ─────────────────────────────────────────
  const STORAGE_KEY = 'eli4110_progress';
  const BANK_STORAGE_KEY = 'eli4110_question_bank';
  const BLUEPRINT_KEY = 'eli4110_blueprint';

  let questionBank = [];
  let blueprint = null;
  let userState = null;
  let currentPage = 'home';

  // Exam state
  let examQuestions = [];
  let examAnswers = {};
  let examMarked = {};
  let examCurrentIdx = 0;
  let examSubmitted = false;

  // Drill state
  let drillQuestions = [];
  let drillCurrentIdx = 0;
  let drillAnswers = {};
  let drillShowingExplanation = false;
  let drillReinsertQueue = [];
  let drillSessionHistory = [];

  // Practice state
  let practiceQuestions = [];
  let practiceCurrentIdx = 0;
  let practiceAnswer = null;
  let practiceShowingExplanation = false;
  let practiceFilters = { categories: [], difficulty: [] };

  // Anti-repeat window
  const ANTI_REPEAT_WINDOW = 10;

  // ─── INIT ──────────────────────────────────────────
  async function init() {
    loadUserState();
    await loadQuestionBank();
    await loadBlueprint();
    initTheme();
    initNavigation();
    initFileInputs();
    renderPage('home');
  }

  function loadUserState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        userState = JSON.parse(saved);
      }
    } catch (e) { /* ignore */ }
    if (!userState) {
      userState = {
        answeredHistory: {},
        categoryAccuracy: {},
        tagAccuracy: {},
        missedCounts: {},
        totalAnswered: 0,
        totalCorrect: 0,
        streak: 0,
        bestStreak: 0,
        recentQuestionIds: [],
        examHistory: []
      };
    }
  }

  function saveUserState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
    } catch (e) { /* ignore */ }
  }

  async function loadQuestionBank() {
    // Try localStorage first
    try {
      const saved = localStorage.getItem(BANK_STORAGE_KEY);
      if (saved) {
        questionBank = JSON.parse(saved);
        if (questionBank.length > 0) return;
      }
    } catch (e) { /* ignore */ }

    // Try loading from file
    try {
      const resp = await fetch('data/question_bank.json');
      if (resp.ok) {
        questionBank = await resp.json();
        return;
      }
    } catch (e) { /* ignore */ }

    questionBank = [];
  }

  async function loadBlueprint() {
    try {
      const saved = localStorage.getItem(BLUEPRINT_KEY);
      if (saved) {
        blueprint = JSON.parse(saved);
        if (blueprint) return;
      }
    } catch (e) { /* ignore */ }

    try {
      const resp = await fetch('data/blueprint.json');
      if (resp.ok) {
        blueprint = await resp.json();
        return;
      }
    } catch (e) { /* ignore */ }

    blueprint = {
      categories: [
        { id: 'branches_of_government', name: 'Branches of Government', target_count: 6 },
        { id: 'responsibilities_by_law', name: 'Responsibilities by Law', target_count: 7 },
        { id: 'licensing_requirements', name: 'Licensing Requirements', target_count: 6 },
        { id: 'licensing_types', name: 'Types of Licensing', target_count: 4 },
        { id: 'peo_governance', name: 'PEO Governance', target_count: 10 },
        { id: 'ethics_triangle', name: 'Ethics Triangle', target_count: 4 },
        { id: 'quebec_bridge', name: 'Quebec Bridge', target_count: 4 },
        { id: 'ron_engineering', name: 'Ron Engineering', target_count: 5 },
        { id: 'general_course', name: 'General Course', target_count: 4 }
      ],
      exam_simulation: {
        total_questions: 50,
        distribution: {
          branches_of_government: 6, responsibilities_by_law: 7,
          licensing_requirements: 6, licensing_types: 4,
          peo_governance: 10, ethics_triangle: 4,
          quebec_bridge: 4, ron_engineering: 5, general_course: 4
        }
      }
    };
  }

  // ─── THEME ─────────────────────────────────────────
  function initTheme() {
    const saved = localStorage.getItem('eli4110_theme');
    const theme = saved || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);

    document.getElementById('themeToggle').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('eli4110_theme', next);
      updateThemeIcon(next);
    });
  }

  function updateThemeIcon(theme) {
    document.getElementById('themeIcon').innerHTML = theme === 'dark' ? '&#9788;' : '&#9790;';
  }

  // ─── NAVIGATION ────────────────────────────────────
  function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.getAttribute('data-page');
        navigateTo(page);
      });
    });
  }

  function navigateTo(page) {
    currentPage = page;
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    renderPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderPage(page) {
    const app = document.getElementById('app');
    switch (page) {
      case 'home': renderHome(app); break;
      case 'exam': renderExamStart(app); break;
      case 'drill': renderDrillStart(app); break;
      case 'practice': renderPracticeSetup(app); break;
      case 'analytics': renderAnalytics(app); break;
      case 'import-export': renderImportExport(app); break;
      case 'exam-active': renderExamActive(app); break;
      case 'exam-results': renderExamResults(app); break;
      case 'drill-active': renderDrillActive(app); break;
      case 'drill-results': renderDrillResults(app); break;
      case 'practice-active': renderPracticeActive(app); break;
      case 'missed-review': renderMissedReview(app); break;
      default: renderHome(app);
    }
  }

  // ─── FILE INPUTS ───────────────────────────────────
  function initFileInputs() {
    document.getElementById('questionBankFileInput').addEventListener('change', handleQuestionBankImport);
    document.getElementById('progressFileInput').addEventListener('change', handleProgressImport);
  }

  function handleQuestionBankImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) {
          questionBank = data;
        } else if (data.questions) {
          questionBank = data.questions;
        } else {
          showToast('Invalid format. Expected an array of questions.');
          return;
        }
        localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(questionBank));
        showToast(`Imported ${questionBank.length} questions`);
        renderPage(currentPage);
      } catch (err) {
        showToast('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleProgressImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const data = JSON.parse(ev.target.result);
        userState = data;
        saveUserState();
        showToast('Progress imported successfully');
        renderPage(currentPage);
      } catch (err) {
        showToast('Failed to parse progress file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ─── TOAST ─────────────────────────────────────────
  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // ─── UTILITY ───────────────────────────────────────
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getCategoryName(catId) {
    if (!blueprint) return catId;
    const cat = blueprint.categories.find(c => c.id === catId);
    return cat ? cat.name : catId;
  }

  function getMcqOnly() {
    return questionBank.filter(q => q.type === 'mcq' && q.choices && q.choices.length === 4);
  }

  function getBarColor(pct) {
    if (pct >= 80) return 'var(--success)';
    if (pct >= 60) return 'var(--accent)';
    if (pct >= 40) return 'var(--warning)';
    return 'var(--danger)';
  }

  function getScoreClass(pct) {
    if (pct >= 80) return 'excellent';
    if (pct >= 60) return 'good';
    if (pct >= 40) return 'needs-work';
    return 'poor';
  }

  // ─── HOME ──────────────────────────────────────────
  function renderHome(app) {
    const bankSize = getMcqOnly().length;
    app.innerHTML = `
      <div class="home-hero">
        <h1>ELI4110 Final Exam</h1>
        <p class="subtitle">50 MCQ Study Platform &middot; ${bankSize} questions loaded</p>
      </div>

      <div class="card study-plan">
        <h3>Recommended Study Strategy</h3>
        <ol class="study-steps">
          <li>Start with a <strong>50-question Exam Simulation</strong> to baseline your knowledge</li>
          <li>Review all missed questions and read explanations carefully</li>
          <li>Use <strong>Focus Drill</strong> to target your weakest categories</li>
          <li>Repeat until you consistently score above 80%</li>
        </ol>
      </div>

      <div class="home-actions">
        <button class="home-action-btn" onclick="app_navigateTo('exam')">
          <div class="home-action-icon" style="background:var(--accent-light);color:var(--accent)">&#9998;</div>
          <div class="home-action-text">
            <h3>Start Final Exam Simulation</h3>
            <p>50 MCQs, Brightspace-style. No feedback until submit.</p>
          </div>
        </button>

        <button class="home-action-btn" onclick="app_startDrill()">
          <div class="home-action-icon" style="background:var(--warning-light);color:var(--warning)">&#9889;</div>
          <div class="home-action-text">
            <h3>Focus Drill (Weak Areas)</h3>
            <p>Adaptive questions weighted toward your weakest categories.</p>
          </div>
        </button>

        <button class="home-action-btn" onclick="app_startMissedReview()">
          <div class="home-action-icon" style="background:var(--danger-light);color:var(--danger)">&#10006;</div>
          <div class="home-action-text">
            <h3>Review Missed Questions</h3>
            <p>See all questions you've gotten wrong, grouped by frequency.</p>
          </div>
        </button>

        <button class="home-action-btn" onclick="app_navigateTo('practice')">
          <div class="home-action-icon" style="background:var(--success-light);color:var(--success)">&#9881;</div>
          <div class="home-action-text">
            <h3>Practice by Category</h3>
            <p>Pick specific topics and difficulty levels.</p>
          </div>
        </button>
      </div>
    `;
  }

  // ─── EXAM ──────────────────────────────────────────
  function renderExamStart(app) {
    const bankSize = getMcqOnly().length;
    const canStart = bankSize >= 50;
    app.innerHTML = `
      <div class="section-header">
        <h2>Final Exam Simulation</h2>
        <p>50 MCQs drawn from the blueprint distribution. No feedback until you submit.</p>
      </div>
      <div class="card">
        <p style="margin-bottom:16px;color:var(--text-secondary)">
          Questions will be selected to match the exam blueprint distribution across all ${blueprint ? blueprint.categories.length : 9} categories.
          ${bankSize} MCQs available in the bank.
        </p>
        ${canStart ? `
          <button class="btn btn-primary btn-lg btn-block" onclick="app_startExam()">
            Begin Exam (50 Questions)
          </button>
        ` : `
          <div class="empty-state">
            <div class="empty-state-icon">&#128218;</div>
            <h3>Not Enough Questions</h3>
            <p>Need at least 50 MCQs. Import a question bank from the Import/Export page.</p>
          </div>
        `}
      </div>
    `;
  }

  function startExam() {
    const mcqs = getMcqOnly();
    examQuestions = selectExamQuestions(mcqs, 50);
    examAnswers = {};
    examMarked = {};
    examCurrentIdx = 0;
    examSubmitted = false;
    currentPage = 'exam-active';
    renderPage('exam-active');
  }

  function selectExamQuestions(pool, total) {
    if (!blueprint || !blueprint.exam_simulation) {
      return shuffle(pool).slice(0, total);
    }

    const dist = blueprint.exam_simulation.distribution;
    const selected = [];
    const usedIds = new Set();

    // Select per category
    for (const [catId, count] of Object.entries(dist)) {
      let catPool = pool.filter(q => q.category === catId && !usedIds.has(q.id));
      catPool = shuffle(catPool);
      const take = Math.min(count, catPool.length);
      for (let i = 0; i < take; i++) {
        selected.push(catPool[i]);
        usedIds.add(catPool[i].id);
      }
    }

    // Fill remaining from any category
    const remaining = total - selected.length;
    if (remaining > 0) {
      let extras = pool.filter(q => !usedIds.has(q.id));
      extras = shuffle(extras);
      for (let i = 0; i < Math.min(remaining, extras.length); i++) {
        selected.push(extras[i]);
        usedIds.add(extras[i].id);
      }
    }

    return shuffle(selected);
  }

  function renderExamActive(app) {
    if (examSubmitted) {
      renderExamResults(app);
      return;
    }

    const q = examQuestions[examCurrentIdx];
    const answered = Object.keys(examAnswers).length;
    const marked = Object.keys(examMarked).filter(k => examMarked[k]).length;
    const unanswered = examQuestions.length - answered;

    // Navigator
    let navGrid = '';
    for (let i = 0; i < examQuestions.length; i++) {
      const classes = ['nav-cell'];
      if (i === examCurrentIdx) classes.push('current');
      if (examAnswers[i] !== undefined) classes.push('answered');
      if (examMarked[i]) classes.push('marked');
      navGrid += `<div class="${classes.join(' ')}" onclick="app_examGoTo(${i})">${i + 1}</div>`;
    }

    // Choices
    let choicesHtml = '';
    const letters = ['A', 'B', 'C', 'D'];
    q.choices.forEach((choice, ci) => {
      const selected = examAnswers[examCurrentIdx] === ci;
      choicesHtml += `
        <button class="choice-btn ${selected ? 'selected' : ''}" onclick="app_examSelect(${ci})">
          <span class="choice-letter">${letters[ci]}</span>
          <span class="choice-text">${escHtml(choice)}</span>
        </button>
      `;
    });

    const isMarked = examMarked[examCurrentIdx] || false;

    app.innerHTML = `
      <div class="exam-header">
        <span class="exam-progress-text">Question ${examCurrentIdx + 1} of ${examQuestions.length}</span>
        <div class="exam-stats">
          <span style="color:var(--success)">&#10003; ${answered} answered</span>
          <span style="color:var(--text-tertiary)">&#9744; ${unanswered} remaining</span>
          <span style="color:var(--warning)">&#9873; ${marked} marked</span>
        </div>
      </div>

      <div class="exam-navigator">${navGrid}</div>

      <div class="question-card">
        <div class="question-meta">
          <span class="tag tag-category">${getCategoryName(q.category)}</span>
          <span class="tag tag-difficulty">Difficulty ${q.difficulty || '?'}/5</span>
        </div>
        <div class="question-prompt">${escHtml(q.prompt)}</div>
        <div class="choices-list">${choicesHtml}</div>
      </div>

      <div class="question-nav">
        <div class="question-nav-left">
          <button class="btn btn-secondary btn-sm" onclick="app_examPrev()" ${examCurrentIdx === 0 ? 'disabled' : ''}>
            &#8592; Previous
          </button>
          <button class="mark-review-btn ${isMarked ? 'marked' : ''}" onclick="app_examToggleMark()">
            &#9873; ${isMarked ? 'Marked' : 'Mark for Review'}
          </button>
        </div>
        <div class="question-nav-right">
          ${examCurrentIdx < examQuestions.length - 1 ? `
            <button class="btn btn-primary btn-sm" onclick="app_examNext()">Next &#8594;</button>
          ` : `
            <button class="btn btn-primary btn-sm" onclick="app_examSubmitConfirm()">Submit Exam</button>
          `}
        </div>
      </div>
    `;
  }

  function examSelect(ci) {
    examAnswers[examCurrentIdx] = ci;
    renderPage('exam-active');
  }

  function examNext() {
    if (examCurrentIdx < examQuestions.length - 1) {
      examCurrentIdx++;
      renderPage('exam-active');
    }
  }

  function examPrev() {
    if (examCurrentIdx > 0) {
      examCurrentIdx--;
      renderPage('exam-active');
    }
  }

  function examGoTo(idx) {
    examCurrentIdx = idx;
    renderPage('exam-active');
  }

  function examToggleMark() {
    examMarked[examCurrentIdx] = !examMarked[examCurrentIdx];
    renderPage('exam-active');
  }

  function examSubmitConfirm() {
    const unanswered = examQuestions.length - Object.keys(examAnswers).length;
    const marked = Object.keys(examMarked).filter(k => examMarked[k]).length;

    if (unanswered > 0 || marked > 0) {
      showModal(
        'Submit Exam?',
        `You have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''} and ${marked} marked for review. Submit anyway?`,
        [
          { text: 'Cancel', style: 'btn-secondary', action: hideModal },
          { text: 'Submit', style: 'btn-primary', action: () => { hideModal(); examSubmit(); } }
        ]
      );
    } else {
      examSubmit();
    }
  }

  function examSubmit() {
    examSubmitted = true;

    // Score
    let correct = 0;
    const missed = [];

    examQuestions.forEach((q, i) => {
      const userAnswer = examAnswers[i];
      const isCorrect = userAnswer === q.answer_index;
      if (isCorrect) {
        correct++;
      } else {
        missed.push({ question: q, index: i, userAnswer });
      }

      // Update global stats
      recordAnswer(q, isCorrect, userAnswer);
    });

    // Save exam to history
    userState.examHistory = userState.examHistory || [];
    userState.examHistory.push({
      date: new Date().toISOString(),
      score: correct,
      total: examQuestions.length,
      missed: missed.map(m => m.question.id)
    });
    saveUserState();

    currentPage = 'exam-results';
    renderPage('exam-results');
  }

  function recordAnswer(q, isCorrect, userAnswer) {
    // Per-question history
    if (!userState.answeredHistory[q.id]) {
      userState.answeredHistory[q.id] = { correct: 0, incorrect: 0, lastAnswer: null };
    }
    const qh = userState.answeredHistory[q.id];
    if (isCorrect) {
      qh.correct++;
    } else {
      qh.incorrect++;
    }
    qh.lastAnswer = userAnswer;

    // Missed counts
    if (!isCorrect) {
      userState.missedCounts[q.id] = (userState.missedCounts[q.id] || 0) + 1;
    }

    // Category accuracy
    if (q.category) {
      if (!userState.categoryAccuracy[q.category]) {
        userState.categoryAccuracy[q.category] = { correct: 0, total: 0 };
      }
      userState.categoryAccuracy[q.category].total++;
      if (isCorrect) userState.categoryAccuracy[q.category].correct++;
    }

    // Tag accuracy
    if (q.tags) {
      q.tags.forEach(tag => {
        if (!userState.tagAccuracy[tag]) {
          userState.tagAccuracy[tag] = { correct: 0, total: 0 };
        }
        userState.tagAccuracy[tag].total++;
        if (isCorrect) userState.tagAccuracy[tag].correct++;
      });
    }

    // Totals
    userState.totalAnswered++;
    if (isCorrect) {
      userState.totalCorrect++;
      userState.streak++;
      if (userState.streak > (userState.bestStreak || 0)) {
        userState.bestStreak = userState.streak;
      }
    } else {
      userState.streak = 0;
    }

    // Recent questions (anti-repeat)
    userState.recentQuestionIds.push(q.id);
    if (userState.recentQuestionIds.length > 50) {
      userState.recentQuestionIds = userState.recentQuestionIds.slice(-50);
    }

    saveUserState();
  }

  function renderExamResults(app) {
    const total = examQuestions.length;
    let correct = 0;
    const missedQuestions = [];
    const categoryStats = {};

    examQuestions.forEach((q, i) => {
      const isCorrect = examAnswers[i] === q.answer_index;
      if (isCorrect) correct++;
      else missedQuestions.push({ question: q, index: i, userAnswer: examAnswers[i] });

      const cat = q.category || 'unknown';
      if (!categoryStats[cat]) categoryStats[cat] = { correct: 0, total: 0 };
      categoryStats[cat].total++;
      if (isCorrect) categoryStats[cat].correct++;
    });

    const pct = Math.round((correct / total) * 100);
    const scoreClass = getScoreClass(pct);

    // Category breakdown HTML
    let catHtml = '';
    for (const [catId, stats] of Object.entries(categoryStats)) {
      const catPct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
      catHtml += `
        <div class="category-row">
          <span class="category-name">${getCategoryName(catId)}</span>
          <div class="category-bar-container">
            <div class="category-bar" style="width:${catPct}%;background:${getBarColor(catPct)}"></div>
          </div>
          <span class="category-percent">${stats.correct}/${stats.total}</span>
        </div>
      `;
    }

    // Missed questions HTML (grouped by ID with count)
    const missedGrouped = {};
    missedQuestions.forEach(m => {
      const id = m.question.id;
      if (!missedGrouped[id]) {
        missedGrouped[id] = { question: m.question, count: 0, userAnswers: [] };
      }
      missedGrouped[id].count++;
      missedGrouped[id].userAnswers.push(m.userAnswer);
    });

    let missedHtml = '';
    const sortedMissed = Object.values(missedGrouped).sort((a, b) => b.count - a.count);
    sortedMissed.forEach(m => {
      const q = m.question;
      const letters = ['A', 'B', 'C', 'D'];
      const userLetter = m.userAnswers[0] !== undefined ? letters[m.userAnswers[0]] : 'None';
      const correctLetter = letters[q.answer_index];
      missedHtml += `
        <div class="missed-item">
          <div class="missed-item-header">
            <span class="missed-prompt">${escHtml(q.prompt)}</span>
            <span class="missed-count-badge">Missed ${userState.missedCounts[q.id] || m.count}x total</span>
          </div>
          <div class="missed-your-answer">Your answer: ${userLetter}. ${q.choices[m.userAnswers[0]] || 'No answer'}</div>
          <div class="missed-answer">Correct: ${correctLetter}. ${q.choices[q.answer_index]}</div>
          <div class="explanation-panel incorrect-bg" style="margin-top:10px">
            <p>${escHtml(q.explanation || '')}</p>
          </div>
        </div>
      `;
    });

    app.innerHTML = `
      <div class="results-header">
        <div class="score-circle ${scoreClass}">
          <div class="score-value">${pct}%</div>
          <div class="score-label">${correct}/${total}</div>
        </div>
        <h2>Exam Complete</h2>
      </div>

      <div class="results-grid">
        <div class="result-stat">
          <div class="result-stat-value text-success">${correct}</div>
          <div class="result-stat-label">Correct</div>
        </div>
        <div class="result-stat">
          <div class="result-stat-value text-danger">${total - correct}</div>
          <div class="result-stat-label">Incorrect</div>
        </div>
        <div class="result-stat">
          <div class="result-stat-value">${userState.totalAnswered}</div>
          <div class="result-stat-label">Total Answered</div>
        </div>
        <div class="result-stat">
          <div class="result-stat-value">${userState.bestStreak || 0}</div>
          <div class="result-stat-label">Best Streak</div>
        </div>
      </div>

      <div class="card category-breakdown">
        <h3>Score by Category</h3>
        ${catHtml}
      </div>

      ${missedQuestions.length > 0 ? `
        <div class="card" style="margin-bottom:20px">
          <h3 style="margin-bottom:16px">Missed Questions (${missedQuestions.length})</h3>
          ${missedHtml}
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="app_drillMissed()">Drill Missed Questions</button>
          <button class="btn btn-secondary" onclick="app_startExam()">Retry Exam</button>
          <button class="btn btn-secondary" onclick="app_navigateTo('home')">Home</button>
        </div>
      ` : `
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="app_startExam()">Take Another Exam</button>
          <button class="btn btn-secondary" onclick="app_navigateTo('home')">Home</button>
        </div>
      `}
    `;
  }

  function drillMissed() {
    // Get recently missed question IDs
    const missedIds = [];
    examQuestions.forEach((q, i) => {
      if (examAnswers[i] !== q.answer_index) {
        missedIds.push(q.id);
      }
    });

    const missed = getMcqOnly().filter(q => missedIds.includes(q.id));
    if (missed.length === 0) {
      showToast('No missed questions to drill');
      return;
    }

    drillQuestions = shuffle(missed);
    drillCurrentIdx = 0;
    drillAnswers = {};
    drillShowingExplanation = false;
    drillReinsertQueue = [];
    drillSessionHistory = [];
    currentPage = 'drill-active';
    renderPage('drill-active');
  }

  // ─── FOCUS DRILL ───────────────────────────────────
  function renderDrillStart(app) {
    const bankSize = getMcqOnly().length;
    const weakCats = getWeakCategories();
    let weakHtml = '';
    if (weakCats.length > 0) {
      weakHtml = '<div style="margin-bottom:16px"><strong>Your weakest areas:</strong><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">';
      weakCats.slice(0, 5).forEach(c => {
        const pct = c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0;
        weakHtml += `<span class="tag tag-category">${getCategoryName(c.id)} (${pct}%)</span>`;
      });
      weakHtml += '</div></div>';
    }

    app.innerHTML = `
      <div class="section-header">
        <h2>Focus Drill</h2>
        <p>Adaptive questions weighted toward your weakest categories. Wrong answers reappear soon.</p>
      </div>
      <div class="card">
        ${weakHtml}
        <p style="margin-bottom:16px;color:var(--text-secondary)">
          ${bankSize} MCQs available. Questions will be drawn weighted toward your weakest categories.
          Incorrect answers will reappear within 8-12 questions.
        </p>
        <button class="btn btn-primary btn-lg btn-block" onclick="app_startDrill()" ${bankSize < 5 ? 'disabled' : ''}>
          Start Focus Drill (20 Questions)
        </button>
      </div>
    `;
  }

  function getWeakCategories() {
    const cats = [];
    for (const [catId, stats] of Object.entries(userState.categoryAccuracy)) {
      cats.push({ id: catId, ...stats });
    }
    cats.sort((a, b) => {
      const aPct = a.total > 0 ? a.correct / a.total : 0.5;
      const bPct = b.total > 0 ? b.correct / b.total : 0.5;
      return aPct - bPct;
    });
    return cats;
  }

  function startDrill() {
    const mcqs = getMcqOnly();
    if (mcqs.length < 5) {
      showToast('Not enough questions for drill');
      return;
    }

    // Weight toward weak categories
    const weakCats = getWeakCategories();
    const weakCatIds = new Set(weakCats.slice(0, 4).map(c => c.id));
    const recentIds = new Set(userState.recentQuestionIds.slice(-ANTI_REPEAT_WINDOW));

    // Build weighted pool
    let pool = mcqs.filter(q => !recentIds.has(q.id) || mcqs.length <= ANTI_REPEAT_WINDOW);

    // Sort: weak categories first, then missed questions, then random
    pool.sort((a, b) => {
      const aWeak = weakCatIds.has(a.category) ? 0 : 1;
      const bWeak = weakCatIds.has(b.category) ? 0 : 1;
      if (aWeak !== bWeak) return aWeak - bWeak;

      const aMissed = userState.missedCounts[a.id] || 0;
      const bMissed = userState.missedCounts[b.id] || 0;
      if (aMissed !== bMissed) return bMissed - aMissed;

      return Math.random() - 0.5;
    });

    drillQuestions = pool.slice(0, 20);
    drillCurrentIdx = 0;
    drillAnswers = {};
    drillShowingExplanation = false;
    drillReinsertQueue = [];
    drillSessionHistory = [];
    currentPage = 'drill-active';
    renderPage('drill-active');
  }

  function renderDrillActive(app) {
    if (drillCurrentIdx >= drillQuestions.length) {
      renderDrillResults(app);
      return;
    }

    const q = drillQuestions[drillCurrentIdx];
    const progress = drillSessionHistory.length;
    const total = drillQuestions.length;
    const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

    // Count correct in session
    const sessionCorrect = drillSessionHistory.filter(h => h.correct).length;

    let choicesHtml = '';
    const letters = ['A', 'B', 'C', 'D'];
    q.choices.forEach((choice, ci) => {
      let cls = 'choice-btn';
      if (drillShowingExplanation) {
        cls += ' locked';
        if (ci === q.answer_index) cls += ' correct';
        else if (drillAnswers[drillCurrentIdx] === ci) cls += ' incorrect';
      } else if (drillAnswers[drillCurrentIdx] === ci) {
        cls += ' selected';
      }
      choicesHtml += `
        <button class="${cls}" onclick="app_drillSelect(${ci})">
          <span class="choice-letter">${letters[ci]}</span>
          <span class="choice-text">${escHtml(choice)}</span>
        </button>
      `;
    });

    let explanationHtml = '';
    if (drillShowingExplanation) {
      const isCorrect = drillAnswers[drillCurrentIdx] === q.answer_index;
      explanationHtml = `
        <div class="explanation-panel ${isCorrect ? 'correct-bg' : 'incorrect-bg'}">
          <h4>${isCorrect ? 'Correct!' : 'Incorrect'}</h4>
          <p>${escHtml(q.explanation || 'No explanation available.')}</p>
        </div>
      `;
    }

    app.innerHTML = `
      <div class="drill-progress">
        <span class="drill-progress-text">${progress}/${total}</span>
        <div class="drill-progress-bar">
          <div class="drill-progress-fill" style="width:${pct}%"></div>
        </div>
        <span class="streak-indicator">&#128293; ${userState.streak}</span>
      </div>

      <div class="question-card">
        <div class="question-meta">
          <span class="tag tag-category">${getCategoryName(q.category)}</span>
          <span class="tag tag-difficulty">Difficulty ${q.difficulty || '?'}/5</span>
        </div>
        <div class="question-prompt">${escHtml(q.prompt)}</div>
        <div class="choices-list">${choicesHtml}</div>
        ${explanationHtml}
      </div>

      <div class="question-nav">
        <div class="question-nav-left">
          <button class="btn btn-secondary btn-sm" onclick="app_endDrill()">End Drill</button>
        </div>
        <div class="question-nav-right">
          ${drillShowingExplanation ? `
            <button class="btn btn-primary btn-sm" onclick="app_drillNext()">
              ${drillCurrentIdx < drillQuestions.length - 1 ? 'Next &#8594;' : 'See Results'}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  function drillSelect(ci) {
    if (drillShowingExplanation) return;
    drillAnswers[drillCurrentIdx] = ci;

    const q = drillQuestions[drillCurrentIdx];
    const isCorrect = ci === q.answer_index;

    recordAnswer(q, isCorrect, ci);
    drillSessionHistory.push({ id: q.id, correct: isCorrect });

    // If wrong, reinsert within 8-12 questions
    if (!isCorrect) {
      const reinsertAt = drillCurrentIdx + 8 + Math.floor(Math.random() * 5);
      if (reinsertAt < drillQuestions.length) {
        // Check if already in the list ahead
        const ahead = drillQuestions.slice(drillCurrentIdx + 1).map(qq => qq.id);
        if (!ahead.includes(q.id)) {
          drillQuestions.splice(reinsertAt, 0, q);
        }
      } else {
        drillQuestions.push(q);
      }
    }

    drillShowingExplanation = true;
    renderPage('drill-active');
  }

  function drillNext() {
    drillShowingExplanation = false;
    drillCurrentIdx++;
    renderPage('drill-active');
  }

  function endDrill() {
    currentPage = 'drill-results';
    renderPage('drill-results');
  }

  function renderDrillResults(app) {
    const total = drillSessionHistory.length;
    const correct = drillSessionHistory.filter(h => h.correct).length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const scoreClass = getScoreClass(pct);

    // Category accuracy for this session
    const catStats = {};
    drillSessionHistory.forEach(h => {
      const q = questionBank.find(qq => qq.id === h.id);
      if (!q) return;
      const cat = q.category || 'unknown';
      if (!catStats[cat]) catStats[cat] = { correct: 0, total: 0 };
      catStats[cat].total++;
      if (h.correct) catStats[cat].correct++;
    });

    let catHtml = '';
    for (const [catId, stats] of Object.entries(catStats)) {
      const catPct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
      catHtml += `
        <div class="category-row">
          <span class="category-name">${getCategoryName(catId)}</span>
          <div class="category-bar-container">
            <div class="category-bar" style="width:${catPct}%;background:${getBarColor(catPct)}"></div>
          </div>
          <span class="category-percent">${stats.correct}/${stats.total}</span>
        </div>
      `;
    }

    // Weakest categories globally
    const weakCats = getWeakCategories().slice(0, 5);
    let weakHtml = '';
    if (weakCats.length > 0) {
      weakHtml = '<div style="margin-top:16px"><strong>Your overall weakest areas:</strong><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">';
      weakCats.forEach(c => {
        const wp = c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0;
        weakHtml += `<span class="tag tag-category">${getCategoryName(c.id)} (${wp}%)</span>`;
      });
      weakHtml += '</div></div>';
    }

    app.innerHTML = `
      <div class="results-header">
        <div class="score-circle ${scoreClass}">
          <div class="score-value">${pct}%</div>
          <div class="score-label">${correct}/${total}</div>
        </div>
        <h2>Drill Complete</h2>
      </div>

      <div class="card category-breakdown">
        <h3>Session Accuracy by Category</h3>
        ${catHtml}
        ${weakHtml}
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="app_startDrill()">Drill Again</button>
        <button class="btn btn-secondary" onclick="app_navigateTo('home')">Home</button>
      </div>
    `;
  }

  // ─── PRACTICE ──────────────────────────────────────
  function renderPracticeSetup(app) {
    const cats = blueprint ? blueprint.categories : [];

    let catChips = '';
    cats.forEach(c => {
      const active = practiceFilters.categories.includes(c.id);
      catChips += `<button class="filter-chip ${active ? 'active' : ''}" onclick="app_togglePracticeCategory('${c.id}')">${c.name}</button>`;
    });

    let diffChips = '';
    for (let d = 1; d <= 5; d++) {
      const active = practiceFilters.difficulty.includes(d);
      diffChips += `<button class="filter-chip ${active ? 'active' : ''}" onclick="app_togglePracticeDifficulty(${d})">Level ${d}</button>`;
    }

    // Count matching
    const matching = getFilteredPracticePool().length;

    app.innerHTML = `
      <div class="section-header">
        <h2>Practice Mode</h2>
        <p>Select categories and difficulty, then practice at your own pace with instant feedback.</p>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="filter-section">
          <h3>Categories (select any or leave empty for all)</h3>
          <div class="filter-chips">${catChips}</div>
        </div>

        <div class="filter-section">
          <h3>Difficulty (select any or leave empty for all)</h3>
          <div class="filter-chips">${diffChips}</div>
        </div>

        <p style="color:var(--text-secondary);margin-bottom:16px">${matching} questions match your filters</p>

        <button class="btn btn-primary btn-lg btn-block" onclick="app_startPractice()" ${matching === 0 ? 'disabled' : ''}>
          Start Practice (${Math.min(20, matching)} Questions)
        </button>
      </div>
    `;
  }

  function getFilteredPracticePool() {
    let pool = getMcqOnly();
    if (practiceFilters.categories.length > 0) {
      pool = pool.filter(q => practiceFilters.categories.includes(q.category));
    }
    if (practiceFilters.difficulty.length > 0) {
      pool = pool.filter(q => practiceFilters.difficulty.includes(q.difficulty));
    }
    return pool;
  }

  function togglePracticeCategory(catId) {
    const idx = practiceFilters.categories.indexOf(catId);
    if (idx >= 0) practiceFilters.categories.splice(idx, 1);
    else practiceFilters.categories.push(catId);
    renderPage('practice');
  }

  function togglePracticeDifficulty(d) {
    const idx = practiceFilters.difficulty.indexOf(d);
    if (idx >= 0) practiceFilters.difficulty.splice(idx, 1);
    else practiceFilters.difficulty.push(d);
    renderPage('practice');
  }

  function startPractice() {
    let pool = getFilteredPracticePool();
    const recentIds = new Set(userState.recentQuestionIds.slice(-ANTI_REPEAT_WINDOW));
    pool = pool.filter(q => !recentIds.has(q.id) || pool.length <= ANTI_REPEAT_WINDOW);
    pool = shuffle(pool).slice(0, 20);

    if (pool.length === 0) {
      showToast('No questions match your filters');
      return;
    }

    practiceQuestions = pool;
    practiceCurrentIdx = 0;
    practiceAnswer = null;
    practiceShowingExplanation = false;
    currentPage = 'practice-active';
    renderPage('practice-active');
  }

  function renderPracticeActive(app) {
    if (practiceCurrentIdx >= practiceQuestions.length) {
      showToast('Practice session complete!');
      navigateTo('practice');
      return;
    }

    const q = practiceQuestions[practiceCurrentIdx];
    const letters = ['A', 'B', 'C', 'D'];

    let choicesHtml = '';
    q.choices.forEach((choice, ci) => {
      let cls = 'choice-btn';
      if (practiceShowingExplanation) {
        cls += ' locked';
        if (ci === q.answer_index) cls += ' correct';
        else if (practiceAnswer === ci) cls += ' incorrect';
      } else if (practiceAnswer === ci) {
        cls += ' selected';
      }
      choicesHtml += `
        <button class="${cls}" onclick="app_practiceSelect(${ci})">
          <span class="choice-letter">${letters[ci]}</span>
          <span class="choice-text">${escHtml(choice)}</span>
        </button>
      `;
    });

    let explanationHtml = '';
    if (practiceShowingExplanation) {
      const isCorrect = practiceAnswer === q.answer_index;
      explanationHtml = `
        <div class="explanation-panel ${isCorrect ? 'correct-bg' : 'incorrect-bg'}">
          <h4>${isCorrect ? 'Correct!' : 'Incorrect'}</h4>
          <p>${escHtml(q.explanation || 'No explanation available.')}</p>
        </div>
      `;
    }

    app.innerHTML = `
      <div class="drill-progress">
        <span class="drill-progress-text">${practiceCurrentIdx + 1}/${practiceQuestions.length}</span>
        <div class="drill-progress-bar">
          <div class="drill-progress-fill" style="width:${((practiceCurrentIdx + 1) / practiceQuestions.length) * 100}%"></div>
        </div>
      </div>

      <div class="question-card">
        <div class="question-meta">
          <span class="tag tag-category">${getCategoryName(q.category)}</span>
          <span class="tag tag-difficulty">Difficulty ${q.difficulty || '?'}/5</span>
        </div>
        <div class="question-prompt">${escHtml(q.prompt)}</div>
        <div class="choices-list">${choicesHtml}</div>
        ${explanationHtml}
      </div>

      <div class="question-nav">
        <div class="question-nav-left">
          <button class="btn btn-secondary btn-sm" onclick="app_navigateTo('practice')">End Practice</button>
        </div>
        <div class="question-nav-right">
          ${practiceShowingExplanation ? `
            <button class="btn btn-primary btn-sm" onclick="app_practiceNext()">
              ${practiceCurrentIdx < practiceQuestions.length - 1 ? 'Next &#8594;' : 'Finish'}
            </button>
          ` : (practiceAnswer !== null ? `
            <button class="btn btn-primary btn-sm" onclick="app_practiceConfirm()">Check Answer</button>
          ` : '')}
        </div>
      </div>
    `;
  }

  function practiceSelect(ci) {
    if (practiceShowingExplanation) return;
    practiceAnswer = ci;
    renderPage('practice-active');
  }

  function practiceConfirm() {
    if (practiceAnswer === null) return;
    const q = practiceQuestions[practiceCurrentIdx];
    const isCorrect = practiceAnswer === q.answer_index;
    recordAnswer(q, isCorrect, practiceAnswer);
    practiceShowingExplanation = true;
    renderPage('practice-active');
  }

  function practiceNext() {
    practiceCurrentIdx++;
    practiceAnswer = null;
    practiceShowingExplanation = false;
    renderPage('practice-active');
  }

  // ─── MISSED REVIEW ─────────────────────────────────
  function startMissedReview() {
    currentPage = 'missed-review';
    renderPage('missed-review');
  }

  function renderMissedReview(app) {
    const missedEntries = Object.entries(userState.missedCounts)
      .filter(([_, count]) => count > 0)
      .sort(([, a], [, b]) => b - a);

    if (missedEntries.length === 0) {
      app.innerHTML = `
        <div class="section-header">
          <h2>Missed Questions</h2>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">&#10003;</div>
          <h3>No Missed Questions</h3>
          <p>Complete an exam or drill first, then missed questions will appear here.</p>
        </div>
        <button class="btn btn-secondary mt-20" onclick="app_navigateTo('home')">Back to Home</button>
      `;
      return;
    }

    let missedHtml = '';
    missedEntries.forEach(([qId, count]) => {
      const q = questionBank.find(qq => qq.id === qId);
      if (!q) return;
      const letters = ['A', 'B', 'C', 'D'];
      missedHtml += `
        <div class="missed-item">
          <div class="missed-item-header">
            <span class="missed-prompt">${escHtml(q.prompt)}</span>
            <span class="missed-count-badge">Missed ${count}x</span>
          </div>
          <div class="missed-answer">Correct: ${letters[q.answer_index]}. ${escHtml(q.choices[q.answer_index])}</div>
          <div class="explanation-panel correct-bg" style="margin-top:8px">
            <p>${escHtml(q.explanation || '')}</p>
          </div>
        </div>
      `;
    });

    app.innerHTML = `
      <div class="section-header">
        <h2>Missed Questions (${missedEntries.length})</h2>
        <p>Questions you've gotten wrong, sorted by frequency. Study these carefully.</p>
      </div>
      ${missedHtml}
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px">
        <button class="btn btn-primary" onclick="app_drillAllMissed()">Drill All Missed</button>
        <button class="btn btn-secondary" onclick="app_navigateTo('home')">Home</button>
      </div>
    `;
  }

  function drillAllMissed() {
    const missedIds = Object.keys(userState.missedCounts).filter(id => userState.missedCounts[id] > 0);
    const missed = getMcqOnly().filter(q => missedIds.includes(q.id));
    if (missed.length === 0) {
      showToast('No missed questions to drill');
      return;
    }

    drillQuestions = shuffle(missed).slice(0, 30);
    drillCurrentIdx = 0;
    drillAnswers = {};
    drillShowingExplanation = false;
    drillReinsertQueue = [];
    drillSessionHistory = [];
    currentPage = 'drill-active';
    renderPage('drill-active');
  }

  // ─── ANALYTICS ─────────────────────────────────────
  function renderAnalytics(app) {
    const totalAcc = userState.totalAnswered > 0
      ? Math.round((userState.totalCorrect / userState.totalAnswered) * 100) : 0;

    // Category accuracy
    let catHtml = '';
    if (blueprint && blueprint.categories) {
      blueprint.categories.forEach(cat => {
        const stats = userState.categoryAccuracy[cat.id];
        if (!stats || stats.total === 0) {
          catHtml += `
            <div class="category-row">
              <span class="category-name">${cat.name}</span>
              <div class="category-bar-container">
                <div class="category-bar" style="width:0%;background:var(--text-tertiary)"></div>
              </div>
              <span class="category-percent" style="color:var(--text-tertiary)">--</span>
            </div>
          `;
        } else {
          const pct = Math.round((stats.correct / stats.total) * 100);
          catHtml += `
            <div class="category-row">
              <span class="category-name">${cat.name}</span>
              <div class="category-bar-container">
                <div class="category-bar" style="width:${pct}%;background:${getBarColor(pct)}"></div>
              </div>
              <span class="category-percent">${pct}% (${stats.correct}/${stats.total})</span>
            </div>
          `;
        }
      });
    }

    // Tag accuracy - top 15
    const tagEntries = Object.entries(userState.tagAccuracy)
      .filter(([_, s]) => s.total >= 2)
      .map(([tag, s]) => ({ tag, pct: Math.round((s.correct / s.total) * 100), ...s }))
      .sort((a, b) => a.pct - b.pct);

    let tagHtml = '';
    tagEntries.slice(0, 15).forEach(t => {
      tagHtml += `
        <div class="stat-row">
          <span class="stat-name">${t.tag}</span>
          <span class="stat-value" style="color:${getBarColor(t.pct)}">${t.pct}% (${t.correct}/${t.total})</span>
        </div>
      `;
    });

    // Most missed
    const missedEntries = Object.entries(userState.missedCounts)
      .filter(([_, c]) => c > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    let missedHtml = '';
    missedEntries.forEach(([qId, count]) => {
      const q = questionBank.find(qq => qq.id === qId);
      if (!q) return;
      const prompt = q.prompt.length > 80 ? q.prompt.substring(0, 80) + '...' : q.prompt;
      missedHtml += `
        <div class="stat-row">
          <span class="stat-name" style="flex:3">${escHtml(prompt)}</span>
          <span class="stat-value text-danger">${count}x</span>
        </div>
      `;
    });

    // Exam history
    let examHistHtml = '';
    const exams = (userState.examHistory || []).slice(-10).reverse();
    exams.forEach(e => {
      const pct = Math.round((e.score / e.total) * 100);
      const date = new Date(e.date).toLocaleDateString();
      examHistHtml += `
        <div class="stat-row">
          <span class="stat-name">${date}</span>
          <span class="stat-value" style="color:${getBarColor(pct)}">${pct}% (${e.score}/${e.total})</span>
        </div>
      `;
    });

    app.innerHTML = `
      <div class="section-header">
        <h2>Analytics</h2>
        <p>Track your progress and identify weak areas.</p>
      </div>

      <div class="analytics-grid">
        <div class="analytics-card">
          <div class="stats-row-flex">
            <div class="stat-big">
              <div class="stat-big-value">${totalAcc}%</div>
              <div class="stat-big-label">Overall Accuracy</div>
            </div>
            <div class="stat-big">
              <div class="stat-big-value">${userState.totalAnswered}</div>
              <div class="stat-big-label">Questions Answered</div>
            </div>
            <div class="stat-big">
              <div class="stat-big-value">${userState.bestStreak || 0}</div>
              <div class="stat-big-label">Best Streak</div>
            </div>
          </div>
        </div>

        <div class="analytics-card">
          <h3>Accuracy by Category</h3>
          ${catHtml || '<p style="color:var(--text-tertiary)">No data yet. Complete some questions first.</p>'}
        </div>

        ${tagHtml ? `
          <div class="analytics-card">
            <h3>Accuracy by Tag (weakest first)</h3>
            ${tagHtml}
          </div>
        ` : ''}

        ${missedHtml ? `
          <div class="analytics-card">
            <h3>Most Missed Questions</h3>
            ${missedHtml}
          </div>
        ` : ''}

        ${examHistHtml ? `
          <div class="analytics-card">
            <h3>Exam History</h3>
            ${examHistHtml}
          </div>
        ` : ''}
      </div>

      <div style="margin-top:24px">
        <button class="btn btn-danger btn-sm" onclick="app_resetProgress()">Reset All Progress</button>
      </div>
    `;
  }

  function resetProgress() {
    showModal(
      'Reset Progress?',
      'This will delete all your answer history, scores, and analytics. This cannot be undone.',
      [
        { text: 'Cancel', style: 'btn-secondary', action: hideModal },
        { text: 'Reset', style: 'btn-danger', action: () => {
          hideModal();
          userState = {
            answeredHistory: {}, categoryAccuracy: {}, tagAccuracy: {},
            missedCounts: {}, totalAnswered: 0, totalCorrect: 0,
            streak: 0, bestStreak: 0, recentQuestionIds: [], examHistory: []
          };
          saveUserState();
          showToast('Progress reset');
          renderPage(currentPage);
        }}
      ]
    );
  }

  // ─── IMPORT/EXPORT ─────────────────────────────────
  function renderImportExport(app) {
    app.innerHTML = `
      <div class="section-header">
        <h2>Import / Export</h2>
        <p>Manage your question bank and progress data.</p>
      </div>

      <div class="import-export-section">
        <div class="ie-card">
          <div class="ie-icon">&#128229;</div>
          <div class="ie-info">
            <h4>Import Question Bank</h4>
            <p>Replace current questions with a new JSON question bank file.</p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('questionBankFileInput').click()">
            Import
          </button>
        </div>

        <div class="ie-card">
          <div class="ie-icon">&#128228;</div>
          <div class="ie-info">
            <h4>Export Progress</h4>
            <p>Download your answer history, scores, and analytics as JSON.</p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="app_exportProgress()">Export</button>
        </div>

        <div class="ie-card">
          <div class="ie-icon">&#128229;</div>
          <div class="ie-info">
            <h4>Import Progress</h4>
            <p>Restore previously exported progress data.</p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('progressFileInput').click()">
            Import
          </button>
        </div>

        <div class="ie-card">
          <div class="ie-icon">&#128202;</div>
          <div class="ie-info">
            <h4>Question Bank Info</h4>
            <p>${questionBank.length} total questions loaded. ${getMcqOnly().length} MCQs available.</p>
          </div>
        </div>
      </div>
    `;
  }

  function exportProgress() {
    const data = JSON.stringify(userState, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eli4110_progress_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Progress exported');
  }

  // ─── MODAL ─────────────────────────────────────────
  function showModal(title, message, buttons) {
    let btnsHtml = '';
    buttons.forEach((b, i) => {
      btnsHtml += `<button class="btn ${b.style}" id="modalBtn${i}">${b.text}</button>`;
    });

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modalOverlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>${title}</h2>
        <p>${message}</p>
        <div class="modal-actions">${btnsHtml}</div>
      </div>
    `;
    document.body.appendChild(overlay);

    buttons.forEach((b, i) => {
      document.getElementById(`modalBtn${i}`).addEventListener('click', b.action);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideModal();
    });
  }

  function hideModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.remove();
  }

  // ─── HTML ESCAPING ─────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── GLOBAL API (for onclick handlers) ─────────────
  window.app_navigateTo = navigateTo;
  window.app_startExam = startExam;
  window.app_examSelect = examSelect;
  window.app_examNext = examNext;
  window.app_examPrev = examPrev;
  window.app_examGoTo = examGoTo;
  window.app_examToggleMark = examToggleMark;
  window.app_examSubmitConfirm = examSubmitConfirm;
  window.app_startDrill = startDrill;
  window.app_drillSelect = drillSelect;
  window.app_drillNext = drillNext;
  window.app_endDrill = endDrill;
  window.app_drillMissed = drillMissed;
  window.app_drillAllMissed = drillAllMissed;
  window.app_startMissedReview = startMissedReview;
  window.app_togglePracticeCategory = togglePracticeCategory;
  window.app_togglePracticeDifficulty = togglePracticeDifficulty;
  window.app_startPractice = startPractice;
  window.app_practiceSelect = practiceSelect;
  window.app_practiceConfirm = practiceConfirm;
  window.app_practiceNext = practiceNext;
  window.app_exportProgress = exportProgress;
  window.app_resetProgress = resetProgress;

  // ─── BOOT ──────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
