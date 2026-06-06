/**
 * 《反着来》游戏引擎
 * Canvas 渲染 + 触控事件 + 游戏状态机 + 全逻辑
 * 依赖：questions.js（全局 QuestionBank）
 */
(function () {
  'use strict';

  // ─── 常量（对齐 design-tokens.json）─────────────────────
  var CANVAS_W = 375;
  var CANVAS_H = 812;                // iPhone X+ 适配
  var QUESTIONS_PER_GAME = 20;
  var DEFAULT_TIME_LIMIT = 1200;
  var FEEDBACK_DURATION = 1000;      // 题目间隔 1 秒
  var SWIPE_THRESHOLD = 30;
  var TRANSITION_DELAY = 150;        // animation.fast
  var SAFE_PADDING = 24;             // layout.safePadding
  var MAX_DESKTOP_SCALE = 1.15;

  // colors.background
  var COLOR_BG = '#090C0B';
  var COLOR_BG_SECONDARY = '#101513';
  var COLOR_BG_CARD = '#121816';

  // colors.brand + colors.feedback
  var COLOR_PRIMARY = '#00F5A0';
  var COLOR_DANGER = '#FF3D5A';
  var COLOR_WARNING = '#FFD85C';
  var COLOR_INFO = '#58A6FF';

  // colors.text
  var COLOR_WHITE = '#FFFFFF';
  var COLOR_SECONDARY = '#95A29D';
  var COLOR_DISABLED = '#59625F';

  // colors.game + colors.border
  var COLOR_BTN_BG = '#1A1A1A';
  var COLOR_BTN_RED = '#FF4B5C';
  var COLOR_BTN_BLUE = '#3B82F6';
  var COLOR_TIMER_BG = '#26302D';
  var COLOR_BORDER = '#26302D';

  // typography
  var FONT_FAMILY = '"Alibaba PuHuiTi", "PingFang SC", "Microsoft YaHei", sans-serif';
  var FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  var FONT_HERO = 72;
  var FONT_TITLE = 40;
  var FONT_BUTTON = 22;
  var FONT_BODY = 18;
  var FONT_CAPTION = 14;

  // button
  var BTN_HEIGHT_LARGE = 64;
  var BTN_RADIUS = 16;

  // progressBar
  var PROGRESS_HEIGHT = 8;
  var PROGRESS_RADIUS = 999;

  // ─── 构造函数 ───────────────────────────────────────────

  function OppositeGame() {
    var self = this;

    // Canvas 元素
    this.canvas = document.getElementById('gameCanvas');
    if (!this.canvas) {
      console.error('[反着来] 找不到 #gameCanvas 元素');
      return;
    }
    this.ctx = this.canvas.getContext('2d');
    this.shell = document.getElementById('gameShell') || this.canvas.parentElement;
    if (!this.ctx) {
      console.error('[反着来] 当前浏览器无法创建 Canvas 2D 上下文');
      return;
    }

    // 缩放比例
    this.scale = 1;

    // 游戏状态
    this.page = 'home';         // home | tutorial | playing | pk_transition | result
    this.gameMode = 'single';   // single | shadow | local_pk
    this.shadowResult = null;
    this.currentPlayer = 'A';
    this.playerAResult = null;
    this.playerBResult = null;
    this.localPkResult = null;
    this.questions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.totalScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.fastestReaction = Infinity;
    this.answers = [];

    // 当前题目
    this.question = null;
    this.questionStartTime = 0;
    this.timeLimit = DEFAULT_TIME_LIMIT;
    this.timerProgress = 1;
    this.questionAnswered = false;

    // 反馈（数组，每项 {text, color, size}）
    this.feedbackLines = [];
    this.feedbackEndTime = 0;
    this.lastRoundScore = 0;
    this.lastSpeedLabel = '';
    this.lastComboBonus = 0;
    this.screenFlashColor = '';
    this.screenFlashEndTime = 0;
    this.hiddenAt = 0;

    // 触控
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.isTouching = false;

    // 按钮命中区域（逻辑坐标）
    this.buttons = [];

    // 渲染循环
    this.animFrameId = null;
    this.startQuestionTimerId = null;
    this.nextQuestionTimerId = null;

    // ── 后端功能新增字段 ──
    this.dailyMode = false;          // 是否每日挑战模式
    this.dailySeed = null;           // 每日种子
    this.dailyDate = '';             // 每日日期显示
    this.playerRank = null;          // 排行榜排名 {rank, total}
    this.leaderboardData = [];       // 排行榜Top20缓存
    this.showLeaderboard = false;    // 是否显示排行榜弹窗
    this.aiProfile = null;           // AI画像分析结果
    this.aiProfileLoading = false;   // AI画像加载中
    this.challengeCode = null;       // 当前挑战码
    this.gameStarting = false;       // 防重复启动

    // 里程碑特效（5/10/15/20 分）
    this.milestoneParticles = [];
    this.milestoneText = '';
    this.milestoneTextStartTime = 0;
    this.milestoneTextEndTime = 0;

    // 初始化
    this.resize();
    this.bindEvents();
    this.startRenderLoop();
  }

  // ─── 尺寸适配 ───────────────────────────────────────────

  OppositeGame.prototype.resize = function () {
    var bounds = this.shell ? this.shell.getBoundingClientRect() : null;
    var screenW = bounds && bounds.width ? bounds.width : window.innerWidth;
    var screenH = bounds && bounds.height ? bounds.height : window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);

    // 手机按视口等比适配，桌面端限制放大，避免把移动稿拉成巨幅海报。
    this.scale = Math.max(0.1, Math.min(
      screenW / CANVAS_W,
      screenH / CANVAS_H,
      MAX_DESKTOP_SCALE
    ));

    // CSS 尺寸（显示尺寸）
    var cssW = Math.floor(CANVAS_W * this.scale);
    var cssH = Math.floor(CANVAS_H * this.scale);

    // Canvas 物理像素（高分屏加倍）
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';

    // 变换矩阵：逻辑坐标 → 物理像素
    this.renderScaleX = this.canvas.width / CANVAS_W;
    this.renderScaleY = this.canvas.height / CANVAS_H;

    this.render();
  };

  // ─── 坐标转换 ───────────────────────────────────────────

  OppositeGame.prototype.toLogical = function (clientX, clientY) {
    var rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * CANVAS_W / rect.width,
      y: (clientY - rect.top) * CANVAS_H / rect.height
    };
  };

  // ─── 事件绑定 ───────────────────────────────────────────

  OppositeGame.prototype.bindEvents = function () {
    var self = this;

    window.addEventListener('resize', function () { self.resize(); });
    window.addEventListener('orientationchange', function () { self.resize(); });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () { self.resize(); });
    }

    // 触控
    this.canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      self.onTouchStart(e);
    }, { passive: false });

    this.canvas.addEventListener('touchend', function (e) {
      e.preventDefault();
      self.onTouchEnd(e);
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', function (e) {
      self.isTouching = false;
    });

    // 鼠标（PC 调试）
    this.canvas.addEventListener('mousedown', function (e) {
      self.onMouseDown(e);
    });
    this.canvas.addEventListener('mouseup', function (e) {
      self.onMouseUp(e);
    });
    this.canvas.addEventListener('mouseleave', function () {
      self.isTouching = false;
    });

    window.addEventListener('keydown', function (e) {
      self.onKeyDown(e);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        self.hiddenAt = self.page === 'playing' ? Date.now() : 0;
      } else if (self.hiddenAt) {
        if (self.page === 'playing' && !self.questionAnswered && self.questionStartTime > 0) {
          var pauseStart = Math.max(self.hiddenAt, self.questionStartTime);
          self.questionStartTime += Date.now() - pauseStart;
        }
        self.hiddenAt = 0;
      }
    });
  };

  OppositeGame.prototype.onKeyDown = function (e) {
    var key = e.key;

    if (this.page === 'home' && (key === 'Enter' || key === ' ')) {
      e.preventDefault();
      this.gameMode = 'single';
      this.goToPage('tutorial');
      return;
    }
    if (this.page === 'tutorial' && (key === 'Enter' || key === ' ')) {
      e.preventDefault();
      this.startGame();
      return;
    }
    if (this.page === 'pk_transition' && (key === 'Enter' || key === ' ')) {
      e.preventDefault();
      this.startGame();
      return;
    }
    if (this.page === 'result' && (key === 'Enter' || key === ' ')) {
      e.preventDefault();
      if (this.gameMode === 'local_pk') {
        this.currentPlayer = 'A';
        this.playerAResult = null;
        this.playerBResult = null;
        this.localPkResult = null;
      }
      if (!this.dailyMode) this.dailyMode = false;
      this.startGame();
      return;
    }
    if (this.page !== 'playing' || !this.question || this.questionAnswered) return;

    if (this.question.type === 'direction' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      e.preventDefault();
      this.judgeAnswer(key === 'ArrowLeft' ? 'swipe_left' : 'swipe_right',
        this.getReactionTime());
      return;
    }

    var optionIndex = key === '1' ? 0 : key === '2' ? 1 : -1;
    var options = this.question.options || [];
    if (optionIndex >= 0 && options[optionIndex]) {
      e.preventDefault();
      this.judgeAnswer(options[optionIndex].action, this.getReactionTime());
    } else if (options.length === 1 && (key === 'Enter' || key === ' ')) {
      e.preventDefault();
      this.judgeAnswer(options[0].action, this.getReactionTime());
    }
  };

  // ─── 触控处理 ───────────────────────────────────────────

  OppositeGame.prototype.onTouchStart = function (e) {
    if (!e.touches.length) return;
    this.isTouching = true;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  };

  OppositeGame.prototype.onTouchEnd = function (e) {
    if (!this.isTouching) return;
    this.isTouching = false;

    // 使用 changedTouches（手指离开时的位置）
    var endX, endY;
    if (e.changedTouches && e.changedTouches.length) {
      endX = e.changedTouches[0].clientX;
      endY = e.changedTouches[0].clientY;
    } else {
      return; // touchcancel 无坐标
    }

    this.processInput(endX, endY);
  };

  OppositeGame.prototype.onMouseDown = function (e) {
    this.isTouching = true;
    this.touchStartX = e.clientX;
    this.touchStartY = e.clientY;
  };

  OppositeGame.prototype.onMouseUp = function (e) {
    if (!this.isTouching) return;
    this.isTouching = false;
    this.processInput(e.clientX, e.clientY);
  };

  /**
   * 统一处理输入：判断 swipe 还是 tap，分发到对应页面逻辑
   */
  OppositeGame.prototype.processInput = function (clientX, clientY) {
    var start = this.toLogical(this.touchStartX, this.touchStartY);
    var end = this.toLogical(clientX, clientY);
    var deltaX = end.x - start.x;
    var deltaY = end.y - start.y;
    var absDX = Math.abs(deltaX);
    var absDY = Math.abs(deltaY);

    // 判断是否滑动：只认水平滑动，垂直滑动忽略
    var isSwipe = absDX > absDY && absDX > SWIPE_THRESHOLD;
    var swipeDir = null;
    if (isSwipe) {
      swipeDir = deltaX > 0 ? 'swipe_right' : 'swipe_left';
    }

    switch (this.page) {
      case 'home':
        this.handleHomeInput(end, isSwipe, swipeDir);
        break;
      case 'tutorial':
        this.handleTutorialInput(end, isSwipe, swipeDir);
        break;
      case 'playing':
        this.handleGameInput(end, isSwipe, swipeDir);
        break;
      case 'result':
        this.handleResultInput(end, isSwipe, swipeDir);
        break;
      case 'pk_transition':
        this.handlePkTransitionInput(end, isSwipe, swipeDir);
        break;
    }
  };

  // ─── 页面输入处理 ───────────────────────────────────────

  OppositeGame.prototype.handleHomeInput = function (point, isSwipe, swipeDir) {
    if (isSwipe) return; // 首页不响应滑动
    var btn = this.hitTest(point);
    if (btn && btn.id === 'singleStart') {
      this.gameMode = 'single';
      this.currentPlayer = 'A';
      this.goToPage('tutorial');
    } else if (btn && btn.id === 'shadowStart') {
      this.gameMode = 'shadow';
      this.currentPlayer = 'A';
      this.goToPage('tutorial');
    } else if (btn && btn.id === 'localPkStart') {
      this.gameMode = 'local_pk';
      this.currentPlayer = 'A';
      this.playerAResult = null;
      this.playerBResult = null;
      this.localPkResult = null;
      this.goToPage('tutorial');
    } else if (btn && btn.id === 'dailyStart') {
      this.dailyMode = true;
      this.gameMode = 'single';
      this.currentPlayer = 'A';
      this.goToPage('tutorial');
    }
  };

  OppositeGame.prototype.handleTutorialInput = function (point, isSwipe, swipeDir) {
    if (isSwipe) return;
    var btn = this.hitTest(point);
    if (btn && btn.id === 'tutorialStart') {
      this.startGame();
    }
    if (btn && btn.id === 'backHome') {
      this.dailyMode = false;
      this.dailySeed = null;
      this.goToPage('home');
    }
  };

  OppositeGame.prototype.handleGameInput = function (point, isSwipe, swipeDir) {
    if (this.questionAnswered) return; // 反馈显示期间忽略操作

    var question = this.question;
    if (!question) return;

    var playerAction = null;

    if (question.type === 'direction') {
      // 方向题：只响应水平滑动
      if (isSwipe) {
        playerAction = swipeDir;
      }
    } else {
      // 按钮题：只响应 tap（非滑动）
      if (!isSwipe) {
        var hitBtn = this.hitTest(point);
        if (hitBtn) {
          playerAction = hitBtn.action;
        }
      }
    }

    if (playerAction) {
      this.judgeAnswer(playerAction, this.getReactionTime());
    }
  };

  OppositeGame.prototype.handleResultInput = function (point, isSwipe, swipeDir) {
    if (isSwipe) return;
    var btn = this.hitTest(point);
    if (btn && btn.id === 'restart') {
      if (this.gameMode === 'local_pk') {
        this.currentPlayer = 'A';
        this.playerAResult = null;
        this.playerBResult = null;
        this.localPkResult = null;
      }
      // 每日模式：保持 dailyMode，用相同种子重开；非每日模式：保持 false
      // this.dailyMode 已经是正确的状态，无需修改
      this.startGame();
    }
    if (btn && btn.id === 'viewLeaderboard') {
      this.showLeaderboard = true;
      this.fetchLeaderboard();
    }
    if (btn && btn.id === 'closeLeaderboard') {
      this.showLeaderboard = false;
      this.render();
    }
    if (btn && btn.id === 'share') {
      this.handleShare();
    }
    if (btn && btn.id === 'backHome') {
      this.dailyMode = false;
      this.dailySeed = null;
      this.goToPage('home');
    }
    // 点击排行榜弹窗外部关闭
    if (this.showLeaderboard && !btn) {
      this.showLeaderboard = false;
      this.render();
    }
  };

  /**
   * 命中测试：遍历当前 buttons 数组，返回命中的按钮对象
   */
  OppositeGame.prototype.hitTest = function (point) {
    for (var i = 0; i < this.buttons.length; i++) {
      var b = this.buttons[i];
      if (point.x >= b.x && point.x <= b.x + b.w &&
          point.y >= b.y && point.y <= b.y + b.h) {
        return b;
      }
    }
    return null;
  };

  // ─── 页面导航 ───────────────────────────────────────────

  OppositeGame.prototype.clearScheduledTransitions = function () {
    if (this.startQuestionTimerId !== null) {
      clearTimeout(this.startQuestionTimerId);
      this.startQuestionTimerId = null;
    }
    if (this.nextQuestionTimerId !== null) {
      clearTimeout(this.nextQuestionTimerId);
      this.nextQuestionTimerId = null;
    }
  };

  OppositeGame.prototype.goToPage = function (page) {
    var self = this;
    this.page = page;
    this.buttons = [];
    this.render();

    // 如果进入游戏页，加载第一题
    if (page === 'playing') {
      if (this.startQuestionTimerId !== null) {
        clearTimeout(this.startQuestionTimerId);
      }
      this.startQuestionTimerId = setTimeout(function () {
        self.startQuestionTimerId = null;
        if (self.page === 'playing') {
          self.nextQuestion();
        }
      }, TRANSITION_DELAY);
    }
  };

  // ─── 游戏流程 ───────────────────────────────────────────

  /**
   * 启动每日挑战模式
   */
  OppositeGame.prototype.startDailyChallenge = function () {
    var self = this;
    this.dailyMode = true;
    this.gameStarting = true;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/daily-challenge', true);
    xhr.timeout = 5000;
    xhr.onload = function () {
      try {
        var data = JSON.parse(xhr.responseText);
        self.dailySeed = data.seed;
        self.dailyDate = data.date;
        self.questions = QuestionBank.getDailyQuestions(QUESTIONS_PER_GAME, data.seed);
        self._initGameState();
        self.goToPage('playing');
      } catch (e) {
        console.error('[反着来] 每日挑战解析失败', e);
        self.questions = QuestionBank.getQuestions(QUESTIONS_PER_GAME);
        self._initGameState();
        self.goToPage('playing');
      }
      self.gameStarting = false;
    };
    xhr.onerror = function () {
      console.error('[反着来] 每日挑战网络失败，使用本地种子');
      var today = new Date();
      var seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      self.dailySeed = seed;
      self.dailyDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      self.questions = QuestionBank.getDailyQuestions(QUESTIONS_PER_GAME, seed);
      self._initGameState();
      self.goToPage('playing');
      self.gameStarting = false;
    };
    xhr.ontimeout = function () {
      xhr.onerror();
    };
    xhr.send();
  };

  /**
   * 初始化游戏状态（startGame 和 startDailyChallenge 共用）
   */
  OppositeGame.prototype._initGameState = function () {
    this.currentIndex = 0;
    this.score = 0;
    this.totalScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.fastestReaction = Infinity;
    this.answers = [];
    this.question = null;
    this.questionStartTime = 0;
    this.timeLimit = DEFAULT_TIME_LIMIT;
    this.timerProgress = 1;
    this.questionAnswered = true;
    this.feedbackLines = [];
    this.feedbackEndTime = 0;
    this.lastRoundScore = 0;
    this.lastSpeedLabel = '';
    this.lastComboBonus = 0;
    this.shadowResult = null;
    this.hiddenAt = document.hidden ? Date.now() : 0;
    this.playerRank = null;
    this.aiProfile = null;
    this.aiProfileLoading = false;
    this.challengeCode = null;
  };

  OppositeGame.prototype.startGame = function () {
    if (this.gameStarting) return;
    this.gameStarting = true;

    if (this.dailyMode) {
      this.startDailyChallenge();
      return;
    }

    this._initGameState();
    this.questions = QuestionBank.getQuestions(QUESTIONS_PER_GAME);
    this.goToPage('playing');
    this.gameStarting = false;
  };

  /**
   * 加载下一题
   */
  OppositeGame.prototype.nextQuestion = function () {
    this.nextQuestionTimerId = null;

    if (this.currentIndex >= this.questions.length) {
      this.endGame();
      return;
    }

    this.question = this.questions[this.currentIndex];
    this.timeLimit = this.question.time_limit_ms || DEFAULT_TIME_LIMIT;
    this.timerProgress = 1;
    this.questionStartTime = Date.now();
    if (document.hidden) {
      this.hiddenAt = this.questionStartTime;
    }
    this.questionAnswered = false;
    this.feedbackLines = [];
    this.currentIndex++;
    this.render();
  };

  OppositeGame.prototype.getReactionTime = function () {
    var reactionTime = Date.now() - this.questionStartTime;
    if (!isFinite(reactionTime) || reactionTime < 0 || this.questionStartTime <= 0) {
      return this.timeLimit || DEFAULT_TIME_LIMIT;
    }
    return reactionTime;
  };

  /**
   * 根据反应时间获取速度评级和奖励
   */
  OppositeGame.prototype.getSpeedBonus = function (reactionMs) {
    if (reactionMs <= 400) return { bonus: 80, label: 'PERFECT', color: '#FFD700' };
    if (reactionMs <= 650) return { bonus: 50, label: 'FAST',   color: COLOR_PRIMARY };
    if (reactionMs <= 900) return { bonus: 20, label: 'GOOD',   color: COLOR_INFO };
    return                        { bonus: 0,  label: 'OK',     color: COLOR_SECONDARY };
  };

  /**
   * 根据连击数获取奖励
   */
  OppositeGame.prototype.getComboBonus = function (combo) {
    if (combo >= 8) return 80;
    if (combo >= 5) return 40;
    if (combo >= 3) return 20;
    return 0;
  };

  /**
   * 判题
   */
  OppositeGame.prototype.judgeAnswer = function (playerAction, elapsedMs) {
    if (!this.question || this.questionAnswered) return;

    this.questionAnswered = true;
    var correct = (playerAction === this.question.correct_action);
    var reactionTime = typeof elapsedMs === 'number' && isFinite(elapsedMs) && elapsedMs >= 0
      ? elapsedMs
      : this.getReactionTime();
    var roundScore = 0;
    var speedLabel = '';
    var comboBonus = 0;

    if (correct) {
      // ── 答对：累积基础分、连击、统计 ──
      this.score++;
      this.combo++;
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo;
      }
      if (reactionTime < this.fastestReaction) {
        this.fastestReaction = reactionTime;
      }

      // 速度奖励
      var speed = this.getSpeedBonus(reactionTime);
      // 连击奖励
      comboBonus = this.getComboBonus(this.combo);
      // 本题得分
      roundScore = 100 + speed.bonus + comboBonus;
      speedLabel = speed.label;
      this.totalScore += roundScore;

      // 构建反馈行
      var lines = [
        { text: '+' + roundScore, color: COLOR_PRIMARY, size: 52 },
        { text: speed.label, color: speed.color, size: 30 }
      ];
      if (this.combo >= 3) {
        lines.push({ text: 'COMBO x' + this.combo, color: COLOR_WARNING, size: 22 });
      }
      this.showFeedback(lines);
      this.showScreenFlash('rgba(0,255,157,0.10)', 180);

      // ── 里程碑特效：5, 10, 15, 20 分 ──
      if ([5, 10, 15, 20].indexOf(this.score) !== -1) {
        this.triggerMilestone(this.score);
      }
    } else {
      // ── 答错：断连击 ──
      this.combo = 0;
      this.showFeedback([
        { text: 'MISS', color: COLOR_DANGER, size: 52 },
        { text: 'COMBO BREAK', color: COLOR_SECONDARY, size: 24 }
      ]);
      this.showScreenFlash('rgba(255,61,90,0.18)', 180);
    }

    this.lastRoundScore = roundScore;
    this.lastSpeedLabel = speedLabel;
    this.lastComboBonus = comboBonus;

    // 记录答案
    this.answers.push({
      question_type: this.question.type,
      correct: correct,
      reaction_time_ms: reactionTime,
      round_score: roundScore,
      speed_label: speedLabel,
      combo_after: this.combo
    });

    // 延迟进入下一题
    var self = this;
    this.nextQuestionTimerId = setTimeout(function () {
      self.nextQuestionTimerId = null;
      if (self.page === 'playing' && self.questionAnswered) {
        self.nextQuestion();
      }
    }, FEEDBACK_DURATION);
  };

  /**
   * 超时处理（由渲染循环检测）
   */
  OppositeGame.prototype.handleTimeout = function () {
    if (this.questionAnswered) return;
    this.questionAnswered = true;
    this.combo = 0;
    this.lastRoundScore = 0;
    this.lastSpeedLabel = 'TIME OUT';
    this.lastComboBonus = 0;
    this.showFeedback([
      { text: 'TIME OUT', color: COLOR_DANGER, size: 48 },
      { text: '反应慢了！', color: COLOR_SECONDARY, size: 22 }
    ]);
    this.showScreenFlash('rgba(255,61,90,0.18)', 180);

    this.answers.push({
      question_type: this.question.type,
      correct: false,
      reaction_time_ms: this.timeLimit,
      round_score: 0,
      speed_label: 'TIME OUT',
      combo_after: 0
    });

    var self = this;
    this.nextQuestionTimerId = setTimeout(function () {
      self.nextQuestionTimerId = null;
      if (self.page === 'playing' && self.questionAnswered) {
        self.nextQuestion();
      }
    }, FEEDBACK_DURATION);
  };

  /**
   * 生成影子 PK 结果（仅在 shadow 模式下调用一次）
   * 影子分数在玩家分数 ±300 范围内随机，最低 600 分
   */
  OppositeGame.prototype.generateShadowResult = function () {
    var playerScore = this.getSafeTotalScore();

    var offset = Math.floor(Math.random() * 601) - 300; // -300 ~ +300
    var shadowScore = playerScore + offset;
    shadowScore = Math.max(600, shadowScore);

    var diff = playerScore - shadowScore;
    var resultLabel;
    if (diff >= 500) resultLabel = '大胜';
    else if (diff >= 100) resultLabel = '险胜';
    else if (diff > -100) resultLabel = '差点平手';
    else if (diff >= -500) resultLabel = '惜败';
    else resultLabel = '被影子碾压';

    return {
      playerScore: playerScore,
      shadowScore: shadowScore,
      diff: diff,
      resultLabel: resultLabel
    };
  };

  /**
   * 保存当前玩家结算快照（local_pk 模式用）
   */
  OppositeGame.prototype.createPlayerResultSnapshot = function (playerLabel) {
    return {
      player: playerLabel,
      correctCount: this.getSafeNumber(this.score, 0),
      totalQuestions: QUESTIONS_PER_GAME,
      totalScore: this.getSafeTotalScore(),
      maxCombo: this.getSafeNumber(this.maxCombo, 0),
      fastestReaction: this.getSafeNumber(this.fastestReaction, null),
      weakness: this.getWeakness(),
      title: this.getResultTitle()
    };
  };

  OppositeGame.prototype.getSafeNumber = function (value, fallback) {
    return typeof value === 'number' && isFinite(value) ? value : fallback;
  };

  OppositeGame.prototype.getSafeTotalScore = function () {
    var total = this.getSafeNumber(this.totalScore, null);
    if (total !== null && total >= 0) return total;
    return Math.max(0, this.getSafeNumber(this.score, 0)) * 100;
  };

  /**
   * 生成本地好友 PK 对比结果
   */
  OppositeGame.prototype.generateLocalPkResult = function () {
    var scoreA = this.playerAResult
      ? this.getSafeNumber(this.playerAResult.totalScore, 0)
      : 0;
    var scoreB = this.playerBResult
      ? this.getSafeNumber(this.playerBResult.totalScore, 0)
      : 0;
    var diff = scoreA - scoreB;
    var winner, resultLabel;
    if (diff > 0) {
      winner = 'A';
      resultLabel = '玩家 A 胜出';
    } else if (diff < 0) {
      winner = 'B';
      resultLabel = '玩家 B 胜出';
    } else {
      winner = 'draw';
      resultLabel = '平局';
    }
    return {
      scoreA: scoreA,
      scoreB: scoreB,
      diff: diff,
      winner: winner,
      resultLabel: resultLabel
    };
  };

  /**
   * 游戏结束
   */
  OppositeGame.prototype.endGame = function () {
    this.clearScheduledTransitions();

    // 缓存结算数据（避免 render 循环中 Math.random() 导致频闪）
    this.resultTitle = this.getResultTitle();
    this.resultWeakness = this.getWeakness();
    this.resultRoast = this.getRoast();

    // ── 本地好友 PK 模式：A→过渡页，B→最终结算 ──
    if (this.gameMode === 'local_pk') {
      if (this.currentPlayer === 'A') {
        // 玩家 A 完成，保存结果并进入过渡页
        this.playerAResult = this.createPlayerResultSnapshot('A');
        this.currentPlayer = 'B';
        this.page = 'pk_transition';
        this.buttons = [];
        this.render();
        return;
      } else {
        // 玩家 B 完成，保存结果并生成最终对比
        this.playerBResult = this.createPlayerResultSnapshot('B');
        this.localPkResult = this.generateLocalPkResult();
        this.page = 'result';
        this.buttons = [];
        this.render();
        return;
      }
    }

    // ── 影子 PK 模式下生成对手结果（仅一次） ──
    if (this.gameMode === 'shadow') {
      this.shadowResult = this.generateShadowResult();
    } else {
      this.shadowResult = null;
    }

    // ── 提交排行榜 + AI 画像分析（异步，不阻塞渲染）──
    this.submitToLeaderboard();
    this.fetchAIProfile();

    this.page = 'result';
    this.buttons = [];
    this.render();
  };

  // ─── 反馈文案 ───────────────────────────────────────────

  OppositeGame.prototype.showFeedback = function (lines) {
    this.feedbackLines = lines || [];
    this.feedbackEndTime = Date.now() + FEEDBACK_DURATION;
  };

  OppositeGame.prototype.showScreenFlash = function (color, duration) {
    this.screenFlashColor = color;
    this.screenFlashEndTime = Date.now() + duration;
  };

  OppositeGame.prototype.getSuccessText = function () {
    var texts = ['反骨成功！', '漂亮！', '手比脑快！', '完美反向！', '🦴 反骨！', '✓ 正确！'];
    return texts[Math.floor(Math.random() * texts.length)];
  };

  OppositeGame.prototype.getFailText = function () {
    var texts = ['手背叛了你', '想反了吗？', '本能赢了', '× 错了！', '大脑短路', '手太快了'];
    return texts[Math.floor(Math.random() * texts.length)];
  };

  // ─── 结果分析 ───────────────────────────────────────────

  OppositeGame.prototype.getResultTitle = function () {
    var rate = this.score / QUESTIONS_PER_GAME;
    if (rate >= 0.9) return '反骨之王 👑';
    if (rate >= 0.8) return '反向高手';
    if (rate >= 0.7) return '反向达人';
    if (rate >= 0.6) return '渐入佳境';
    if (rate >= 0.5) return '反着来学徒';
    if (rate >= 0.3) return '方向感缺失';
    return '反向小白';
  };

  OppositeGame.prototype.getWeakness = function () {
    var typeMap = {
      direction: '方向题',
      color: '颜色题',
      action: '动作题',
      double_neg: '双重否定',
      combo: '组合题'
    };
    var wrongCount = {};
    var maxWrong = 0;
    var worstType = null;
    for (var i = 0; i < this.answers.length; i++) {
      var a = this.answers[i];
      if (!a.correct) {
        var t = a.question_type;
        wrongCount[t] = (wrongCount[t] || 0) + 1;
        if (wrongCount[t] > maxWrong) {
          maxWrong = wrongCount[t];
          worstType = t;
        }
      }
    }
    return worstType ? (typeMap[worstType] || worstType) : '无';
  };

  OppositeGame.prototype.getRoast = function () {
    var weakness = this.getWeakness();
    var rate = this.score / QUESTIONS_PER_GAME;
    var roasts = {
      perfect: [
        '你天生反骨，大脑和手从来不对付！',
        '反向思维拉满，别人往东你偏往西！'
      ],
      good: [
        '你的手偶尔还是会背叛大脑，不过还好。',
        '继续练，总有一天你会完全不相信自己。'
      ],
      weak: [
        '你的' + weakness + '是短板，大脑还没学会欺骗手。',
        '被本能支配了吧？你需要更多的反骨训练。'
      ],
      bad: [
        '准备好被自己的手打败了吗？答案是：是的。',
        '你的大脑和手达成了某种危险的默契——都做错了。'
      ]
    };
    var pool;
    if (rate >= 0.9) pool = roasts.perfect;
    else if (rate >= 0.7) pool = roasts.good;
    else if (rate >= 0.5) pool = roasts.weak;
    else pool = roasts.bad;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // ─── 渲染循环 ───────────────────────────────────────────

  OppositeGame.prototype.startRenderLoop = function () {
    var self = this;
    function loop() {
      self.render();
      self.animFrameId = requestAnimationFrame(loop);
    }
    loop();
  };

  OppositeGame.prototype.render = function () {
    var ctx = this.ctx;
    if (!ctx) return;
    var sx = this.renderScaleX || this.scale;
    var sy = this.renderScaleY || this.scale;

    ctx.save();
    ctx.setTransform(sx, 0, 0, sy, 0, 0);

    // 清屏
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this.drawAmbientBackground(ctx);

    // 绘制当前页面
    switch (this.page) {
      case 'home':
        this.drawHomePage(ctx);
        break;
      case 'tutorial':
        this.drawTutorialPage(ctx);
        break;
      case 'playing':
        this.drawGamePage(ctx);
        break;
      case 'result':
        this.drawResultPage(ctx);
        break;
      case 'pk_transition':
        this.drawPkTransitionPage(ctx);
        break;
    }

    if (this.screenFlashColor && Date.now() < this.screenFlashEndTime) {
      ctx.fillStyle = this.screenFlashColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // ── 里程碑粒子特效（渲染在最顶层）──
    if (this.milestoneParticles.length > 0 || (this.milestoneText && Date.now() < this.milestoneTextEndTime)) {
      this.updateAndDrawMilestone(ctx);
    }

    ctx.restore();
  };

  OppositeGame.prototype.drawAmbientBackground = function (ctx) {
    var glow = ctx.createRadialGradient(188, 190, 0, 188, 190, 360);
    glow.addColorStop(0, 'rgba(0,245,160,0.045)');
    glow.addColorStop(1, 'rgba(0,245,160,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, 560);

    ctx.strokeStyle = 'rgba(255,255,255,0.014)';
    ctx.lineWidth = 1;
    for (var x = 0; x <= CANVAS_W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(0,245,160,0.018)';
    for (var y = 0; y <= CANVAS_H; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(CANVAS_W, y + 0.5);
      ctx.stroke();
    }

    // 参考稿中的像素角标，让画面更像一块独立的游戏终端。
    ctx.fillStyle = 'rgba(0,245,160,0.7)';
    ctx.fillRect(18, 18, 5, 5);
    ctx.fillRect(25, 18, 3, 3);
    ctx.fillRect(18, 25, 3, 3);
    ctx.fillStyle = 'rgba(255,216,92,0.75)';
    ctx.fillRect(CANVAS_W - 23, CANVAS_H - 23, 5, 5);
    ctx.fillRect(CANVAS_W - 28, CANVAS_H - 20, 3, 3);
  };

  // ─── 绘制工具函数 ───────────────────────────────────────

  OppositeGame.prototype.roundRect = function (ctx, x, y, w, h, r) {
    // Canvas arcTo 不会替 CSS 自动约束超大圆角。半径超过短边一半时，
    // Safari/WebKit 会产生自交路径，表现为贯穿整页的巨大多边形。
    r = Math.max(0, Math.min(Number(r) || 0, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  };

  OppositeGame.prototype.wrapText = function (ctx, text, maxWidth, maxLines) {
    var chars = String(text || '').split('');
    var lines = [];
    var current = '';

    for (var i = 0; i < chars.length; i++) {
      var candidate = current + chars[i];
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = chars[i];
        if (lines.length === maxLines - 1) {
          var remaining = current + chars.slice(i + 1).join('');
          var truncated = false;
          while (remaining && ctx.measureText(remaining + '…').width > maxWidth) {
            remaining = remaining.slice(0, -1);
            truncated = true;
          }
          lines.push(remaining + (truncated ? '…' : ''));
          return lines;
        }
      } else {
        current = candidate;
      }
    }

    if (current) lines.push(current);
    return lines;
  };

  OppositeGame.prototype.drawPanel = function (ctx, x, y, w, h, opts) {
    opts = opts || {};
    var border = opts.border || 'rgba(0,245,160,0.34)';
    var fill = opts.fill || 'rgba(12,18,16,0.92)';
    var radius = typeof opts.radius === 'number' ? opts.radius : 3;

    ctx.save();
    ctx.fillStyle = 'rgba(0,245,160,0.12)';
    this.roundRect(ctx, x + 4, y + 5, w, h, radius);
    ctx.fill();
    ctx.fillStyle = fill;
    this.roundRect(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = opts.lineWidth || 1;
    this.roundRect(ctx, x, y, w, h, radius);
    ctx.stroke();

    if (opts.accent !== false) {
      ctx.fillStyle = opts.accentColor || COLOR_PRIMARY;
      ctx.fillRect(x, y, 18, 2);
      ctx.fillRect(x, y, 2, 18);
      ctx.fillRect(x + w - 18, y + h - 2, 18, 2);
      ctx.fillRect(x + w - 2, y + h - 18, 2, 18);
    }
    ctx.restore();
  };

  OppositeGame.prototype.drawMicroLabel = function (ctx, text, x, y, align, color) {
    ctx.fillStyle = color || COLOR_PRIMARY;
    ctx.font = 'bold 10px ' + FONT_MONO;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text || '').toUpperCase(), x, y);
  };

  OppositeGame.prototype.setFitFont = function (ctx, text, maxWidth, maxSize, minSize, weight, family) {
    var size = maxSize;
    var content = String(text || '');
    var fontWeight = weight || 'bold';
    var fontFamily = family || FONT_FAMILY;
    while (size > minSize) {
      ctx.font = fontWeight + ' ' + size + 'px ' + fontFamily;
      if (ctx.measureText(content).width <= maxWidth) break;
      size -= 1;
    }
    return size;
  };

  /**
   * 绘制按钮并注册命中区域
   */
  OppositeGame.prototype.drawBtn = function (ctx, x, y, w, h, text, btnId, action, opts) {
    opts = opts || {};
    var bgColor = opts.bg || COLOR_BTN_BG;
    var borderColor = opts.border || COLOR_PRIMARY;
    var textColor = opts.text || COLOR_PRIMARY;
    var fontSize = opts.fontSize || 20;
    var radius = typeof opts.radius === 'number' ? opts.radius : 4;

    ctx.save();
    if (opts.glow) {
      ctx.shadowColor = opts.glow;
      ctx.shadowBlur = opts.shadowBlur || 18;
    }

    if (opts.pixelShadow !== false) {
      ctx.fillStyle = opts.shadowColor || 'rgba(0,245,160,0.28)';
      this.roundRect(ctx, x + 4, y + 5, w, h, radius);
      ctx.fill();
    }

    // 背景
    ctx.fillStyle = bgColor;
    this.roundRect(ctx, x, y, w, h, radius);
    ctx.fill();

    // 边框
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = opts.lineWidth || 1.5;
    this.roundRect(ctx, x, y, w, h, radius);
    ctx.stroke();
    ctx.restore();

    // 文字
    ctx.fillStyle = textColor;
    ctx.font = 'bold ' + fontSize + 'px ' + FONT_FAMILY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);

    // 注册命中区域
    this.buttons.push({ x: x, y: y, w: w, h: h, id: btnId, action: action });
  };

  // ─── 首页渲染 ───────────────────────────────────────────

  OppositeGame.prototype.drawHomePage = function (ctx) {
    this.buttons = [];

    this.drawMicroLabel(ctx, 'SYSTEM // OPPOSITE', CANVAS_W / 2, 82, 'center',
      'rgba(0,245,160,0.72)');

    // 主标题保持中文识别度，英文和系统标签承担像素终端气质。
    ctx.save();
    ctx.fillStyle = COLOR_PRIMARY;
    ctx.shadowColor = 'rgba(0,245,160,0.42)';
    ctx.shadowBlur = 18;
    ctx.font = '900 58px ' + FONT_FAMILY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('反着来', CANVAS_W / 2, 184);
    ctx.restore();

    ctx.fillStyle = COLOR_SECONDARY;
    ctx.font = '14px ' + FONT_FAMILY;
    ctx.textAlign = 'center';
    ctx.fillText('看到什么，做相反的', CANVAS_W / 2, 234);
    this.drawMicroLabel(ctx, 'THINK OPPOSITE // REACT FAST', CANVAS_W / 2, 264,
      'center', 'rgba(255,255,255,0.34)');

    ctx.strokeStyle = 'rgba(0,245,160,0.22)';
    ctx.beginPath();
    ctx.moveTo(58, 302);
    ctx.lineTo(CANVAS_W - 58, 302);
    ctx.stroke();
    this.drawMicroLabel(ctx, 'SELECT MODE', 58, 326, 'left');

    // 模式选择按钮
    var btnW = 250, btnH = 54;
    var btnX = (CANVAS_W - btnW) / 2;
    var btnGap = 18;
    var btnStartY = 356;

    this.drawBtn(ctx, btnX, btnStartY, btnW, btnH,
      '单人挑战  /  SOLO', 'singleStart', 'singleStart', {
        bg: COLOR_PRIMARY,
        border: COLOR_PRIMARY,
        text: '#07110d',
        fontSize: 15,
        radius: 3,
        glow: 'rgba(0,245,160,0.28)',
        shadowColor: 'rgba(0,245,160,0.32)'
      });

    this.drawBtn(ctx, btnX, btnStartY + btnH + btnGap, btnW, btnH,
      '影子 PK  /  SHADOW', 'shadowStart', 'shadowStart', {
        bg: 'rgba(14,22,20,0.96)',
        border: COLOR_INFO,
        text: COLOR_INFO,
        fontSize: 15,
        radius: 3,
        glow: 'rgba(88,166,255,0.16)',
        shadowColor: 'rgba(88,166,255,0.22)'
      });

    this.drawBtn(ctx, btnX, btnStartY + (btnH + btnGap) * 2, btnW, btnH,
      '好友 PK  /  VERSUS', 'localPkStart', 'localPkStart', {
        bg: 'rgba(14,22,20,0.96)',
        border: COLOR_WARNING,
        text: COLOR_WARNING,
        fontSize: 15,
        radius: 3,
        glow: 'rgba(255,216,92,0.14)',
        shadowColor: 'rgba(255,216,92,0.22)'
      });

    // ── 每日挑战按钮 ──
    this.drawBtn(ctx, btnX, btnStartY + (btnH + btnGap) * 3, btnW, btnH,
      '📅 每日挑战  /  DAILY', 'dailyStart', 'dailyStart', {
        bg: 'rgba(14,22,20,0.96)',
        border: COLOR_WARNING,
        text: COLOR_WARNING,
        fontSize: 15,
        radius: 3,
        glow: 'rgba(255,216,92,0.14)',
        shadowColor: 'rgba(255,216,92,0.22)'
      });

    this.drawMicroLabel(ctx, 'ENTER / SPACE : QUICK START', CANVAS_W / 2, 680,
      'center', 'rgba(255,255,255,0.28)');
  };

  // ─── 教学页渲染 ─────────────────────────────────────────

  OppositeGame.prototype.drawTutorialPage = function (ctx) {
    this.buttons = [];
    var isDaily = this.dailyMode;

    if (isDaily && this.dailyDate) {
      this.drawMicroLabel(ctx, 'DAILY CHALLENGE', 28, 60, 'left', COLOR_WARNING);
      ctx.fillStyle = COLOR_WARNING;
      ctx.font = 'bold 26px ' + FONT_FAMILY;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('📅 今日挑战', 28, 96);
      ctx.fillStyle = COLOR_SECONDARY; ctx.font = '12px ' + FONT_FAMILY;
      ctx.fillText('全国玩家同题竞技 · ' + this.dailyDate, 28, 122);
      ctx.strokeStyle = 'rgba(255,214,0,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(28, 138); ctx.lineTo(CANVAS_W - 28, 138); ctx.stroke();
    } else {
      this.drawMicroLabel(ctx, 'MISSION TRAINING', 28, 60, 'left');
      ctx.fillStyle = COLOR_PRIMARY;
      ctx.font = 'bold 29px ' + FONT_MONO;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('训练说明', 28, 96);
      ctx.fillStyle = COLOR_SECONDARY; ctx.font = '13px ' + FONT_FAMILY;
      ctx.fillText('读取指令，然后执行相反动作', 28, 126);
    }

    var examples = [
      { from: '向左滑', to: '向右滑', index: 'RULE 01' },
      { from: '点红色', to: '点蓝色', index: 'RULE 02' },
      { from: '别点',   to: '点一下', index: 'RULE 03' }
    ];

    var startY = 164;

    for (var i = 0; i < examples.length; i++) {
      var ex = examples[i];
      var y = startY + i * 104;

      this.drawPanel(ctx, 28, y, CANVAS_W - 56, 82, {
        border: 'rgba(0,245,160,0.30)'
      });
      this.drawMicroLabel(ctx, ex.index, 44, y + 18, 'left',
        'rgba(0,245,160,0.58)');
      ctx.fillStyle = COLOR_WHITE;
      ctx.font = 'bold 18px ' + FONT_FAMILY;
      ctx.textAlign = 'left';
      ctx.fillText(ex.from, 44, y + 48);
      ctx.fillStyle = COLOR_PRIMARY;
      ctx.font = 'bold 15px ' + FONT_FAMILY;
      ctx.textAlign = 'right';
      ctx.fillText('→  ' + ex.to, CANVAS_W - 44, y + 48);
    }

    this.drawMicroLabel(ctx, 'TIP // DON’T TRUST FIRST INSTINCT', 28, 512,
      'left', 'rgba(255,216,92,0.72)');
    ctx.fillStyle = COLOR_SECONDARY;
    ctx.font = '13px ' + FONT_FAMILY;
    ctx.fillText('反应要快，但别相信第一直觉。', 28, 540);

    var btnW = CANVAS_W - 56, btnH = 54;
    var btnText = isDaily ? '⏳ 开始今日挑战' : '开始任务  /  BEGIN';
    this.drawBtn(ctx, 28, 668, btnW, btnH,
      btnText, 'tutorialStart', 'tutorialStart', {
        bg: COLOR_PRIMARY,
        border: COLOR_PRIMARY,
        text: '#07110d',
        fontSize: 15,
        radius: 3,
        glow: 'rgba(0,245,160,0.24)'
      });

    // 每日模式：返回首页按钮
    if (isDaily) {
      this.drawBtn(ctx, CANVAS_W - 28 - 100, 668, 100, 40,
        '返回', 'backHome', 'backHome', {
          bg: 'transparent', border: COLOR_BORDER, text: COLOR_SECONDARY, fontSize: 14, radius: 8
        });
    }
  };

  // ─── 游戏页渲染 ─────────────────────────────────────────

  OppositeGame.prototype.drawGamePage = function (ctx) {
    this.buttons = [];

    var q = this.question;
    if (!q) return;

    // ── 顶栏 ──
    this.drawTopBar(ctx);

    // ── 顶栏分隔线 ──
    ctx.strokeStyle = 'rgba(0,245,160,0.20)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(22, 64);
    ctx.lineTo(CANVAS_W - 22, 64);
    ctx.stroke();

    // ── 连击提示（参考稿的黄色中央状态） ──
    if (this.combo >= 3) {
      ctx.fillStyle = COLOR_WARNING;
      ctx.font = 'bold 14px ' + FONT_MONO;
      ctx.textAlign = 'center';
      ctx.fillText('✦  COMBO  x' + this.combo + '  ✦', CANVAS_W / 2, 96);
    } else {
      this.drawMicroLabel(ctx, 'DO THE OPPOSITE', CANVAS_W / 2, 96, 'center',
        'rgba(255,255,255,0.34)');
    }

    // ── 题目卡 ──
    this.drawPanel(ctx, 34, 124, CANVAS_W - 68, 130, {
      border: 'rgba(0,245,160,0.56)',
      fill: 'rgba(11,15,14,0.96)',
      lineWidth: 1.5
    });
    this.drawMicroLabel(ctx, 'INSTRUCTION', 50, 144, 'left',
      'rgba(0,245,160,0.62)');
    ctx.fillStyle = COLOR_WHITE;
    this.setFitFont(ctx, q.instruction_text, CANVAS_W - 112, 39, 25, 'bold', FONT_FAMILY);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(q.instruction_text, CANVAS_W / 2, 190);
    ctx.fillStyle = COLOR_PRIMARY;
    ctx.font = '12px ' + FONT_FAMILY;
    ctx.fillText('执行相反动作', CANVAS_W / 2, 228);

    // ── 操作区域 ──
    if (q.type === 'direction') {
      this.drawSwipeArea(ctx);
    } else {
      this.drawActionButtons(ctx, q);
    }

    // ── 反馈（位于题目与操作区之间，不遮挡按钮） ──
    if (this.feedbackLines && this.feedbackLines.length > 0 && Date.now() < this.feedbackEndTime) {
      var lineCount = this.feedbackLines.length;
      var startY = lineCount > 2 ? 302 : 318;
      for (var i = 0; i < lineCount; i++) {
        var line = this.feedbackLines[i];
        ctx.fillStyle = line.color;
        var feedbackSize = Math.min(line.size || 40, i === 0 ? 42 : 22);
        ctx.font = 'bold ' + feedbackSize + 'px ' + FONT_MONO;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line.text, CANVAS_W / 2, startY + i * 34);
      }
    }

    // ── 倒计时条 ──
    this.drawTimerBar(ctx);

    // ── 更新倒计时（仅在未回答时） ──
    if (!this.questionAnswered && this.questionStartTime > 0) {
      var elapsed = Date.now() - this.questionStartTime;
      this.timerProgress = Math.max(0, 1 - elapsed / this.timeLimit);
      if (this.timerProgress <= 0) {
        this.handleTimeout();
      }
    }
  };

  /**
   * 绘制顶栏：题号 / 总分 / 连击
   */
  OppositeGame.prototype.drawTopBar = function (ctx) {
    ctx.textBaseline = 'middle';

    this.drawMicroLabel(ctx, 'MISSION ' + ('0' + this.currentIndex).slice(-2),
      22, 28, 'left', COLOR_PRIMARY);
    this.drawMicroLabel(ctx, this.dailyMode
      ? '📅 每日'
      : (this.gameMode === 'local_pk'
        ? 'PLAYER ' + this.currentPlayer
        : this.gameMode.toUpperCase()),
      CANVAS_W / 2, 28, 'center',
      this.dailyMode ? COLOR_WARNING : 'rgba(255,255,255,0.58)');
    this.drawMicroLabel(ctx, 'SCORE ' + this.getSafeTotalScore(),
      CANVAS_W - 22, 28, 'right', COLOR_WARNING);

    ctx.fillStyle = COLOR_SECONDARY;
    ctx.font = '10px ' + FONT_MONO;
    ctx.textAlign = 'left';
    ctx.fillText(this.currentIndex + ' / ' + QUESTIONS_PER_GAME, 22, 48);
    ctx.textAlign = 'right';
    ctx.fillText('COMBO ' + this.combo, CANVAS_W - 22, 48);
  };

  /**
   * 绘制滑动操作区（direction 题型）
   */
  OppositeGame.prototype.drawSwipeArea = function (ctx) {
    var areaY = 400;
    var areaH = 142;

    this.drawPanel(ctx, 34, areaY, CANVAS_W - 68, areaH, {
      border: 'rgba(255,255,255,0.16)',
      fill: 'rgba(11,15,14,0.76)',
      accent: false
    });
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.font = '38px ' + FONT_MONO;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('‹', 82, areaY + 66);
    ctx.fillText('›', CANVAS_W - 82, areaY + 66);

    ctx.fillStyle = COLOR_WHITE;
    ctx.font = 'bold 15px ' + FONT_FAMILY;
    ctx.fillText('左右滑动', CANVAS_W / 2, areaY + 58);
    this.drawMicroLabel(ctx, 'SWIPE TO ANSWER', CANVAS_W / 2, areaY + 92,
      'center', 'rgba(0,245,160,0.56)');
  };

  /**
   * 绘制按钮（color / action / double_neg / combo 题型）
   */
  OppositeGame.prototype.drawActionButtons = function (ctx, question) {
    var options = question.options || [];
    var optsLen = options.length;

    if (optsLen === 1) {
      var btnW = 246, btnH = 68;
      var opt = options[0];
      this.drawBtn(ctx, (CANVAS_W - btnW) / 2, 455, btnW, btnH,
        opt.label, 'actionBtn', opt.action, {
          bg: opt.color || COLOR_BTN_BG,
          border: opt.color || COLOR_WARNING,
          text: '#ffffff',
          fontSize: 20,
          radius: 3,
          shadowColor: 'rgba(255,216,92,0.22)'
        });
    } else if (optsLen === 2) {
      var bW = 142, bH = 68;
      var gap = 20;
      var totalW = bW * 2 + gap;
      var startX = (CANVAS_W - totalW) / 2;

      for (var i = 0; i < options.length; i++) {
        var o = options[i];
        var bx = startX + i * (bW + gap);
        var c = o.color || (i === 0 ? '#FF4444' : '#4488FF');
        this.drawBtn(ctx, bx, 455, bW, bH,
          o.label, 'btn_' + i, o.action, {
            bg: c,
            border: c,
            text: '#ffffff',
            fontSize: 20,
            radius: 3,
            shadowColor: i === 0
              ? 'rgba(255,61,90,0.25)'
              : 'rgba(88,166,255,0.25)'
          });
      }
    }

    this.drawMicroLabel(ctx, optsLen === 1 ? 'TAP / ENTER' : 'TAP / KEY 1 · 2',
      CANVAS_W / 2, 554, 'center', 'rgba(255,255,255,0.34)');
  };

  /**
   * 绘制倒计时条
   */
  OppositeGame.prototype.drawTimerBar = function (ctx) {
    var barW = CANVAS_W - 68;
    var barH = 6;
    var barX = 34;
    var barY = CANVAS_H - 70;
    var radius = 0;

    this.drawMicroLabel(ctx, 'TIME', barX, barY - 13, 'left',
      'rgba(255,255,255,0.40)');
    this.drawMicroLabel(ctx, Math.round(this.timerProgress * 100) + '%',
      barX + barW, barY - 13, 'right',
      this.timerProgress > 0.3 ? COLOR_PRIMARY : COLOR_DANGER);

    // 底色
    ctx.fillStyle = COLOR_TIMER_BG;
    this.roundRect(ctx, barX, barY, barW, barH, radius);
    ctx.fill();

    // 进度
    var progress = this.timerProgress;
    var fillW = Math.max(0, barW * progress);

    if (fillW > 0) {
      var fillColor = progress > 0.3 ? COLOR_PRIMARY :
                      progress > 0.15 ? COLOR_WARNING : COLOR_DANGER;
      ctx.fillStyle = fillColor;
      ctx.fillRect(barX, barY, fillW, barH);
    }
  };

  // ─── PK 过渡页渲染 ───────────────────────────────────────

  /**
   * 绘制好友 PK 过渡页（玩家 A 完成 → 提示轮到玩家 B）
   */
  OppositeGame.prototype.drawPkTransitionPage = function (ctx) {
    this.buttons = [];

    var scoreA = this.playerAResult
      ? this.getSafeNumber(this.playerAResult.totalScore, 0)
      : 0;

    this.drawMicroLabel(ctx, 'PLAYER SWITCH', CANVAS_W / 2, 94, 'center');
    ctx.fillStyle = COLOR_WHITE;
    ctx.font = 'bold 27px ' + FONT_FAMILY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('玩家 A 已完成', CANVAS_W / 2, 146);

    this.drawPanel(ctx, 58, 190, CANVAS_W - 116, 152, {
      border: 'rgba(0,245,160,0.52)',
      fill: 'rgba(11,15,14,0.96)'
    });
    this.drawMicroLabel(ctx, 'PLAYER A SCORE', CANVAS_W / 2, 222, 'center',
      'rgba(0,245,160,0.66)');
    ctx.fillStyle = COLOR_PRIMARY;
    ctx.font = 'bold 58px ' + FONT_MONO;
    ctx.fillText(String(scoreA), CANVAS_W / 2, 278);
    this.drawMicroLabel(ctx, 'POINTS', CANVAS_W / 2, 320, 'center',
      'rgba(255,255,255,0.40)');

    ctx.fillStyle = COLOR_SECONDARY;
    ctx.font = '14px ' + FONT_FAMILY;
    ctx.fillText('把设备交给下一位玩家', CANVAS_W / 2, 398);
    ctx.fillStyle = COLOR_WHITE;
    ctx.font = 'bold 22px ' + FONT_FAMILY;
    ctx.fillText('轮到玩家 B', CANVAS_W / 2, 440);
    this.drawMicroLabel(ctx, 'READY WHEN YOU ARE', CANVAS_W / 2, 472, 'center',
      'rgba(255,216,92,0.64)');

    var btnW = CANVAS_W - 76, btnH = 56;
    this.drawBtn(ctx, 38, 570, btnW, btnH,
      '玩家 B 开始  /  BEGIN', 'startPlayerB', 'startPlayerB', {
        bg: COLOR_PRIMARY,
        border: COLOR_PRIMARY,
        text: '#07110d',
        fontSize: 15,
        radius: 3,
        glow: 'rgba(0,245,160,0.28)'
      });
    this.drawMicroLabel(ctx, 'ENTER / SPACE', CANVAS_W / 2, 656, 'center',
      'rgba(255,255,255,0.30)');
  };

  /**
   * 好友 PK 过渡页输入处理
   */
  OppositeGame.prototype.handlePkTransitionInput = function (point, isSwipe, swipeDir) {
    if (isSwipe) return;
    var btn = this.hitTest(point);
    if (btn && btn.id === 'startPlayerB') {
      this.startGame();
    }
  };

  // ─── 结算页渲染 ─────────────────────────────────────────

  OppositeGame.prototype.drawResultPage = function (ctx) {
    this.buttons = [];
    var isDaily = this.dailyMode;

    // 每日挑战头部标签
    if (isDaily && this.dailyDate) {
      ctx.fillStyle = COLOR_WARNING;
      ctx.font = 'bold 14px ' + FONT_FAMILY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📅 ' + this.dailyDate + ' 每日挑战', CANVAS_W / 2, 42);
      ctx.strokeStyle = 'rgba(255,214,0,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(76, 60);
      ctx.lineTo(CANVAS_W - 76, 60);
      ctx.stroke();
    }

    var isLocalPk = this.gameMode === 'local_pk' && this.localPkResult;
    var isShadow = this.gameMode === 'shadow' && this.shadowResult;

    // 布局参数（每日模式压缩，防止按钮溢出）
    var dailyOffset = isDaily ? 32 : 0;
    var statsY = isLocalPk ? 278 : isShadow ? 330 : (238 + dailyOffset);
    var statsH = isDaily ? 178 : 202;
    var roastY = statsY + statsH + (isDaily ? 16 : 28);
    // restartY：动态计算，确保不跟 AI 画像区域重叠
    var aiY = isDaily ? roastY + 62 : roastY + 80;
    var aiAreaBottom = (this.aiProfile || this.aiProfileLoading) ? (aiY + 90) : (roastY + 70);
    var minRestartY = isLocalPk || isShadow ? 678 : (isDaily ? 600 : 646);
    var restartY = Math.max(minRestartY, aiAreaBottom);

    if (isLocalPk) {
      var lpr = this.localPkResult;
      this.drawMicroLabel(ctx, 'VERSUS RESULT', CANVAS_W / 2, 48, 'center',
        COLOR_WARNING);
      var winColor = lpr.winner === 'draw' ? COLOR_SECONDARY :
                     lpr.winner === 'A' ? COLOR_PRIMARY : COLOR_DANGER;
      ctx.fillStyle = winColor;
      ctx.font = 'bold 25px ' + FONT_FAMILY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lpr.resultLabel, CANVAS_W / 2, 82);

      this.drawPanel(ctx, 32, 112, CANVAS_W - 64, 132, {
        border: 'rgba(255,216,92,0.36)',
        fill: 'rgba(12,17,15,0.95)',
        accentColor: COLOR_WARNING
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(CANVAS_W / 2, 132);
      ctx.lineTo(CANVAS_W / 2, 222);
      ctx.stroke();

      this.drawMicroLabel(ctx, 'PLAYER A', 100, 140, 'center', COLOR_PRIMARY);
      this.drawMicroLabel(ctx, 'PLAYER B', CANVAS_W - 100, 140, 'center', COLOR_DANGER);
      ctx.fillStyle = COLOR_WHITE;
      ctx.font = 'bold 36px ' + FONT_MONO;
      ctx.textAlign = 'center';
      ctx.fillText(String(lpr.scoreA), 100, 178);
      ctx.fillText(String(lpr.scoreB), CANVAS_W - 100, 178);

      var pkDiffStr = lpr.diff > 0 ? '+' + lpr.diff : String(lpr.diff);
      var pkDiffColor = lpr.diff > 0 ? COLOR_PRIMARY :
        lpr.diff < 0 ? COLOR_DANGER : COLOR_SECONDARY;
      this.drawMicroLabel(ctx, 'DIFF ' + pkDiffStr, CANVAS_W / 2, 224,
        'center', pkDiffColor);
    } else {
      this.drawMicroLabel(ctx, isShadow ? 'SHADOW MISSION CLEAR' : 'MISSION CLEAR',
        CANVAS_W / 2, 48, 'center', COLOR_PRIMARY);
      ctx.fillStyle = COLOR_PRIMARY;
      ctx.font = 'bold 54px ' + FONT_MONO;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(this.getSafeTotalScore()), CANVAS_W / 2, 96);
      this.drawMicroLabel(ctx, 'TOTAL POINTS', CANVAS_W / 2, 132, 'center',
        'rgba(255,255,255,0.42)');
      ctx.fillStyle = COLOR_WHITE;
      ctx.font = 'bold 17px ' + FONT_FAMILY;
      ctx.fillText(this.resultTitle, CANVAS_W / 2, 164);
      this.drawMicroLabel(ctx, 'CLEAR ' + this.score + ' / ' + QUESTIONS_PER_GAME,
        CANVAS_W / 2, 190, 'center', COLOR_WARNING);
    }

    if (isShadow) {
      var sr = this.shadowResult;
      var cardX = 32, cardW = CANVAS_W - 64;
      var cardY = 216, cardH = 88;
      this.drawPanel(ctx, cardX, cardY, cardW, cardH, {
        border: 'rgba(88,166,255,0.38)',
        fill: 'rgba(10,16,19,0.95)',
        accentColor: COLOR_INFO
      });
      this.drawMicroLabel(ctx, 'YOU', cardX + 28, cardY + 22, 'left', COLOR_PRIMARY);
      this.drawMicroLabel(ctx, 'SHADOW', cardX + cardW - 28, cardY + 22, 'right', COLOR_INFO);
      ctx.fillStyle = COLOR_WHITE;
      ctx.font = 'bold 22px ' + FONT_MONO;
      ctx.textAlign = 'left';
      ctx.fillText(String(sr.playerScore), cardX + 28, cardY + 50);
      ctx.textAlign = 'right';
      ctx.fillText(String(sr.shadowScore), cardX + cardW - 28, cardY + 50);

      var diffStr = sr.diff > 0 ? '+' + sr.diff : String(sr.diff);
      var diffColor = sr.diff > 0 ? COLOR_PRIMARY :
        sr.diff < 0 ? COLOR_DANGER : COLOR_SECONDARY;
      ctx.fillStyle = diffColor;
      ctx.font = 'bold 12px ' + FONT_MONO;
      ctx.textAlign = 'center';
      ctx.fillText(sr.resultLabel + '  /  DIFF ' + diffStr, CANVAS_W / 2, cardY + 72);
    }

    var stats;
    if (isLocalPk) {
      var playerA = this.playerAResult || {};
      var playerB = this.playerBResult || {};
      stats = [
        { label: 'A 正确题数', value: this.getSafeNumber(playerA.correctCount, 0) + ' / ' + QUESTIONS_PER_GAME },
        { label: 'B 正确题数', value: this.getSafeNumber(playerB.correctCount, 0) + ' / ' + QUESTIONS_PER_GAME },
        { label: 'A 最长连击', value: this.getSafeNumber(playerA.maxCombo, 0) + ' 次' },
        { label: 'B 最长连击', value: this.getSafeNumber(playerB.maxCombo, 0) + ' 次' }
      ];
    } else {
      var fastest = this.getSafeNumber(this.fastestReaction, null);
      stats = [
        { label: '正确题数', value: this.getSafeNumber(this.score, 0) + ' / ' + QUESTIONS_PER_GAME },
        { label: '最长连击', value: this.getSafeNumber(this.maxCombo, 0) + ' 次' },
        { label: '最快反应',
          value: fastest === null ? '-- 秒' : (fastest / 1000).toFixed(2) + ' 秒' },
        { label: '弱点题型', value: this.resultWeakness || '无' }
      ];
    }

    this.drawPanel(ctx, 32, statsY, CANVAS_W - 64, statsH, {
      border: 'rgba(0,245,160,0.26)',
      fill: 'rgba(11,15,14,0.93)'
    });
    this.drawMicroLabel(ctx, isLocalPk ? 'MATCH REPORT' : 'SYSTEM REPORT',
      48, statsY + 22, 'left', 'rgba(0,245,160,0.64)');

    var statY = statsY + 58;
    ctx.textBaseline = 'middle';

    for (var i = 0; i < stats.length; i++) {
      var st = stats[i];
      var y = statY + i * 37;

      ctx.fillStyle = COLOR_SECONDARY;
      ctx.font = '13px ' + FONT_FAMILY;
      ctx.textAlign = 'left';
      ctx.fillText(st.label, 48, y);

      ctx.fillStyle = COLOR_WHITE;
      ctx.font = 'bold 14px ' + FONT_MONO;
      ctx.textAlign = 'right';
      ctx.fillText(st.value, CANVAS_W - 48, y);

      if (i < stats.length - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.055)';
        ctx.beginPath();
        ctx.moveTo(48, y + 18);
        ctx.lineTo(CANVAS_W - 48, y + 18);
        ctx.stroke();
      }
    }

    var roast = isLocalPk
      ? (this.localPkResult.winner === 'draw'
        ? '势均力敌，这局谁也没赢。'
        : this.localPkResult.resultLabel + '，分差 ' + Math.abs(this.localPkResult.diff) + ' 分。')
      : (this.resultRoast || '再来一局，看看还能不能更快。');
    this.drawMicroLabel(ctx, 'SYSTEM MESSAGE', 40, roastY, 'left',
      'rgba(255,216,92,0.72)');
    ctx.fillStyle = COLOR_SECONDARY;
    ctx.font = '14px ' + FONT_FAMILY;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOR_PRIMARY;
    ctx.fillRect(36, roastY + 18, 2, 52);
    ctx.fillStyle = COLOR_SECONDARY;
    var roastLines = this.wrapText(ctx, '“' + roast + '”', CANVAS_W - 88, 2);
    var roastStartY = roastY + 34;
    for (var lineIndex = 0; lineIndex < roastLines.length; lineIndex++) {
      ctx.fillText(roastLines[lineIndex], 50, roastStartY + lineIndex * 24);
    }

    // ── AI 画像分析区域 ──
    if (this.aiProfile || this.aiProfileLoading) {
      var aiX = 36, aiW = CANVAS_W - 72, aiY = roastY + 70;
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      this.roundRect(ctx, aiX, aiY, aiW, 80, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,255,157,0.10)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, aiX, aiY, aiW, 80, 10);
      ctx.stroke();

      if (this.aiProfileLoading) {
        ctx.fillStyle = COLOR_SECONDARY;
        ctx.font = '13px ' + FONT_FAMILY;
        ctx.textAlign = 'center';
        ctx.fillText('🤖 AI 正在分析你的表现...', CANVAS_W / 2, aiY + 40);
      } else if (this.aiProfile) {
        var ap = this.aiProfile;
        ctx.fillStyle = COLOR_PRIMARY;
        ctx.font = 'bold 14px ' + FONT_FAMILY;
        ctx.textAlign = 'left';
        ctx.fillText('🤖 ' + (ap.title || 'AI 分析'), aiX + 12, aiY + 22);
        ctx.fillStyle = COLOR_SECONDARY;
        ctx.font = '12px ' + FONT_FAMILY;
        var commentLines = this.wrapText(ctx, ap.comment || '', aiW - 24, 2);
        for (var ci = 0; ci < Math.min(commentLines.length, 2); ci++) {
          ctx.fillText(commentLines[ci], aiX + 12, aiY + 42 + ci * 16);
        }
        if (ap.tip) {
          ctx.fillStyle = COLOR_PRIMARY;
          ctx.font = 'bold 11px ' + FONT_FAMILY;
          ctx.fillText('💡 ' + ap.tip, aiX + 12, aiY + 68);
        }
      }
    }

    var btnW = CANVAS_W - 76, btnH = 54;
    this.drawBtn(ctx, 38, restartY, btnW, btnH,
      '重新开始  /  RESTART', 'restart', 'restart', {
        bg: COLOR_PRIMARY,
        border: COLOR_PRIMARY,
        text: '#07110d',
        fontSize: 15,
        radius: 3,
        glow: 'rgba(0,245,160,0.26)'
      });

    // ── 排行榜 / 分享 / 返回首页 ──
    var btnY2 = restartY + 60;
    this.drawBtn(ctx, 38, btnY2, (btnW - 12) / 2, 36,
      '🏆 排行榜', 'viewLeaderboard', 'viewLeaderboard', {
        bg: 'transparent', border: COLOR_INFO, text: COLOR_INFO, fontSize: 12, radius: 8
      });
    this.drawBtn(ctx, 38 + (btnW - 12) / 2 + 12, btnY2, (btnW - 12) / 2, 36,
      '📤 分享码', 'share', 'share', {
        bg: 'transparent', border: COLOR_PRIMARY, text: COLOR_PRIMARY, fontSize: 12, radius: 8
      });

    var btnY3 = btnY2 + 46;
    this.drawBtn(ctx, 38 + (btnW - 80) / 2, btnY3, 80, 28,
      '🏠 首页', 'backHome', 'backHome', {
        bg: 'transparent', border: COLOR_BORDER, text: COLOR_SECONDARY, fontSize: 11, radius: 6
      });

    // 挑战码显示
    if (this.challengeCode) {
      ctx.fillStyle = COLOR_PRIMARY;
      ctx.font = 'bold 11px ' + FONT_FAMILY;
      ctx.textAlign = 'center';
      ctx.fillText('挑战码: ' + this.challengeCode, CANVAS_W / 2, btnY3 + 42);
      ctx.fillStyle = COLOR_SECONDARY;
      ctx.font = '10px ' + FONT_FAMILY;
      ctx.fillText('已复制，发送好友即可对战', CANVAS_W / 2, btnY3 + 58);
    }

    // 排行榜弹窗
    if (this.showLeaderboard) {
      this.drawLeaderboardModal(ctx);
    }
  };

  // ─── 里程碑特效 ─────────────────────────────────────
  OppositeGame.prototype.triggerMilestone = function (score) {
    var colors = ['#00FF9D', '#FFD600', '#4D9FFF', '#FF6B9D', '#C084FC', '#FDE047', '#FF3D5A'];
    var cx = CANVAS_W / 2;
    var cy = CANVAS_H / 2 - 80;

    for (var i = 0; i < 50; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 2 + Math.random() * 7;
      this.milestoneParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life: 1,
        decay: 0.006 + Math.random() * 0.018,
        size: 3 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.25
      });
    }

    this.milestoneText = '🎉 ' + score + ' 分！';
    this.milestoneTextStartTime = Date.now();
    this.milestoneTextEndTime = Date.now() + 2200;
    this.showScreenFlash('rgba(0,255,157,0.14)', 450);
  };

  OppositeGame.prototype.updateAndDrawMilestone = function (ctx) {
    var now = Date.now();
    var alive = [];

    for (var i = 0; i < this.milestoneParticles.length; i++) {
      var p = this.milestoneParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07;
      p.life -= p.decay;
      p.rotation += p.rotSpeed;

      if (p.life > 0) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        var s = p.size;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
        alive.push(p);
      }
    }
    this.milestoneParticles = alive;

    if (this.milestoneText && now < this.milestoneTextEndTime) {
      var elapsed = now - this.milestoneTextStartTime;
      var duration = this.milestoneTextEndTime - this.milestoneTextStartTime;
      var progress = elapsed / duration;

      var alpha;
      if (progress < 0.12) alpha = progress / 0.12;
      else if (progress > 0.78) alpha = (1 - progress) / 0.22;
      else alpha = 1;

      var sc;
      if (progress < 0.18) sc = 0.3 + 0.7 * (progress / 0.18);
      else sc = 1 + Math.sin((progress - 0.18) * Math.PI * 3.5) * 0.04;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(CANVAS_W / 2, CANVAS_H / 2 - 130);
      ctx.scale(sc, sc);
      ctx.fillStyle = COLOR_PRIMARY;
      ctx.font = 'bold 48px ' + FONT_FAMILY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,255,157,0.75)';
      ctx.shadowBlur = 28;
      ctx.fillText(this.milestoneText, 0, 0);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeText(this.milestoneText, 0, 0);
      ctx.restore();
    }
  };

  // ─── 排行榜 API ───────────────────────────────────────
  OppositeGame.prototype.submitToLeaderboard = function () {
    var self = this;
    var payload = {
      player_name: 'Player_' + Math.random().toString(36).substring(2, 7),
      score: this.getSafeNumber(this.score, 0),
      max_combo: this.getSafeNumber(this.maxCombo, 0),
      fastest_reaction_ms: this.fastestReaction === Infinity ? null : this.getSafeNumber(this.fastestReaction, null),
      answers_json: JSON.stringify(this.answers)
    };

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/leaderboard/submit', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 6000;
    xhr.onload = function () {
      try {
        var data = JSON.parse(xhr.responseText);
        self.playerRank = { rank: data.rank, total: data.total };
      } catch (e) {
        self.playerRank = null;
      }
    };
    xhr.onerror = function () { self.playerRank = null; };
    xhr.ontimeout = function () { self.playerRank = null; };
    xhr.send(JSON.stringify(payload));
  };

  OppositeGame.prototype.fetchLeaderboard = function () {
    var self = this;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/leaderboard/top?limit=20', true);
    xhr.timeout = 6000;
    xhr.onload = function () {
      try {
        var data = JSON.parse(xhr.responseText);
        self.leaderboardData = data.leaderboard || [];
      } catch (e) {
        self.leaderboardData = [];
      }
      self.render();
    };
    xhr.onerror = function () { self.leaderboardData = []; self.render(); };
    xhr.send();
  };

  // ─── AI 画像分析 ─────────────────────────────────────
  OppositeGame.prototype.fetchAIProfile = function () {
    var self = this;
    this.aiProfileLoading = true;
    this.aiProfile = null;

    var payload = {
      score: this.getSafeNumber(this.score, 0),
      max_combo: this.getSafeNumber(this.maxCombo, 0),
      fastest_reaction_ms: this.fastestReaction === Infinity ? null : this.getSafeNumber(this.fastestReaction, null),
      answers: this.answers
    };

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/ai-profile', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 6000;
    xhr.onload = function () {
      self.aiProfileLoading = false;
      try {
        var data = JSON.parse(xhr.responseText);
        self.aiProfile = {
          title: data.title || 'AI 分析完成',
          comment: data.comment || '',
          tip: data.tip || ''
        };
      } catch (e) {
        self.aiProfile = {
          title: '🤖 分析完成',
          comment: '你的反向思维有独特风格。',
          tip: '多练颜色题，反应会更快。'
        };
      }
      self.render();
    };
    xhr.onerror = function () {
      self.aiProfileLoading = false;
      self.aiProfile = {
        title: '🤖 本地分析',
        comment: '你的反向思维有独特风格，继续挑战吧。',
        tip: '每天练10分钟，一周见效。'
      };
      self.render();
    };
    xhr.ontimeout = function () {
      xhr.onerror();
    };
    xhr.send(JSON.stringify(payload));
  };

  // ─── 挑战码分享 ─────────────────────────────────────
  OppositeGame.prototype.handleShare = function () {
    var self = this;
    var payload = {
      score: this.getSafeNumber(this.score, 0),
      max_combo: this.getSafeNumber(this.maxCombo, 0),
      fastest_reaction_ms: this.fastestReaction === Infinity ? null : this.getSafeNumber(this.fastestReaction, null),
      answers_json: JSON.stringify(this.answers)
    };

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/create-challenge', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 6000;
    xhr.onload = function () {
      try {
        var data = JSON.parse(xhr.responseText);
        self.challengeCode = data.challenge_code || '';
        if (self.challengeCode) {
          var input = document.createElement('input');
          input.value = self.challengeCode;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
        }
      } catch (e) {
        self.challengeCode = null;
      }
      self.render();
    };
    xhr.onerror = function () { self.challengeCode = null; self.render(); };
    xhr.send(JSON.stringify(payload));
  };

  // ─── 排行榜弹窗 ─────────────────────────────────────
  OppositeGame.prototype.drawLeaderboardModal = function (ctx) {
    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 弹窗面板
    var mW = CANVAS_W - 64;
    var mH = 420;
    var mX = 32;
    var mY = (CANVAS_H - mH) / 2;

    ctx.fillStyle = COLOR_BG_SECONDARY;
    this.roundRect(ctx, mX, mY, mW, mH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,157,0.15)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, mX, mY, mW, mH, 16);
    ctx.stroke();

    // 标题
    ctx.fillStyle = COLOR_PRIMARY;
    ctx.font = 'bold 18px ' + FONT_FAMILY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆 排行榜 Top 10', CANVAS_W / 2, mY + 32);

    // 关闭按钮
    this.drawBtn(ctx, CANVAS_W - mX - 44, mY + 16, 32, 28, '✕', 'closeLeaderboard', 'closeLeaderboard', {
      bg: 'transparent', border: 'rgba(255,255,255,0.12)', text: COLOR_SECONDARY, fontSize: 14, radius: 6
    });

    // 列表
    var listY = mY + 60;
    var itemH = 36;
    var maxShow = Math.min(this.leaderboardData.length, 10);

    for (var i = 0; i < maxShow; i++) {
      var entry = this.leaderboardData[i];
      var iY = listY + i * itemH;
      var isTop3 = (i === 0 || i === 1 || i === 2);

      if (isTop3) {
        ctx.fillStyle = i === 0 ? 'rgba(255,214,0,0.10)' : (i === 1 ? 'rgba(192,192,192,0.08)' : 'rgba(205,127,50,0.08)');
        this.roundRect(ctx, mX + 8, iY - 2, mW - 16, itemH - 4, 6);
        ctx.fill();
      }

      ctx.fillStyle = i === 0 ? 'rgba(255,214,0,0.9)' : (i === 1 ? 'rgba(192,192,192,0.9)' : (i === 2 ? 'rgba(205,127,50,0.9)' : COLOR_SECONDARY));
      ctx.font = (isTop3 ? 'bold ' : '') + '13px ' + FONT_FAMILY;
      ctx.textAlign = 'left';
      ctx.fillText((i + 1) + '.', mX + 16, iY + itemH / 2);

      ctx.fillStyle = COLOR_WHITE;
      ctx.font = '13px ' + FONT_FAMILY;
      ctx.fillText(entry.player_name || ('玩家' + (i + 1)), mX + 40, iY + itemH / 2);

      ctx.fillStyle = COLOR_PRIMARY;
      ctx.font = 'bold 13px ' + FONT_FAMILY;
      ctx.textAlign = 'right';
      ctx.fillText(entry.score + ' 分', mX + mW - 16, iY + itemH / 2);
    }

    if (maxShow === 0) {
      ctx.fillStyle = COLOR_SECONDARY;
      ctx.font = '14px ' + FONT_FAMILY;
      ctx.textAlign = 'center';
      ctx.fillText('暂无排行数据', CANVAS_W / 2, mY + mH / 2);
    }
  };

  // ─── 启动 ───────────────────────────────────────────────

  // 页面加载完成后启动
  function boot() {
    if (typeof QuestionBank === 'undefined') {
      console.error('[反着来] QuestionBank 未加载，请确认 questions.js 先于 game.js 引入');
      return;
    }
    window.game = new OppositeGame();

    // 隐藏加载画面
    var loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.classList.add('fade-out');
      loadingEl.addEventListener('transitionend', function () {
        loadingEl.remove();
      });
      // 兜底：1.5s 后强制移除
      setTimeout(function () {
        if (loadingEl.parentNode) loadingEl.remove();
      }, 1500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
