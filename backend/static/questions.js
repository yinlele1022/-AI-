/**
 * 《反着来》题库 — 90题，从易到难
 * 暴露全局对象 QuestionBank，供 game.js 调用
 * difficulty: 1-2 → 简单, 3-4 → 中等, 5 → 困难
 */
const QuestionBank = (function () {
  'use strict';

  const allQuestions = [
    // ═══════════════════════════════════════════════════════
    // 方向类 direction (22 题)
    // ═══════════════════════════════════════════════════════
    { type:'direction', instruction_text:'向左滑', correct_action:'swipe_right', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:1000, difficulty:1 },
    { type:'direction', instruction_text:'向右滑', correct_action:'swipe_left', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:1000, difficulty:1 },
    { type:'direction', instruction_text:'向上滑', correct_action:'swipe_down', options:[{label:'向上',action:'swipe_up'},{label:'向下',action:'swipe_down'}], time_limit_ms:1000, difficulty:1 },
    { type:'direction', instruction_text:'向下滑', correct_action:'swipe_up', options:[{label:'向上',action:'swipe_up'},{label:'向下',action:'swipe_down'}], time_limit_ms:1000, difficulty:1 },
    { type:'direction', instruction_text:'往左划', correct_action:'swipe_right', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:950, difficulty:2 },
    { type:'direction', instruction_text:'往右划', correct_action:'swipe_left', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:950, difficulty:2 },
    { type:'direction', instruction_text:'往上划', correct_action:'swipe_down', options:[{label:'向上',action:'swipe_up'},{label:'向下',action:'swipe_down'}], time_limit_ms:950, difficulty:2 },
    { type:'direction', instruction_text:'往下划', correct_action:'swipe_up', options:[{label:'向上',action:'swipe_up'},{label:'向下',action:'swipe_down'}], time_limit_ms:950, difficulty:2 },
    { type:'direction', instruction_text:'不要向左滑', correct_action:'swipe_right', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:850, difficulty:3 },
    { type:'direction', instruction_text:'不要向右滑', correct_action:'swipe_left', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:850, difficulty:3 },
    { type:'direction', instruction_text:'不要向上滑', correct_action:'swipe_down', options:[{label:'向上',action:'swipe_up'},{label:'向下',action:'swipe_down'}], time_limit_ms:850, difficulty:3 },
    { type:'direction', instruction_text:'不要向下滑', correct_action:'swipe_up', options:[{label:'向上',action:'swipe_up'},{label:'向下',action:'swipe_down'}], time_limit_ms:850, difficulty:3 },
    { type:'direction', instruction_text:'禁止左滑', correct_action:'swipe_right', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:800, difficulty:4 },
    { type:'direction', instruction_text:'禁止右滑', correct_action:'swipe_left', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:800, difficulty:4 },
    { type:'direction', instruction_text:'禁止上滑', correct_action:'swipe_down', options:[{label:'向上',action:'swipe_up'},{label:'向下',action:'swipe_down'}], time_limit_ms:800, difficulty:4 },
    { type:'direction', instruction_text:'禁止下滑', correct_action:'swipe_up', options:[{label:'向上',action:'swipe_up'},{label:'向下',action:'swipe_down'}], time_limit_ms:800, difficulty:4 },
    { type:'direction', instruction_text:'别往左边动', correct_action:'swipe_right', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:700, difficulty:5 },
    { type:'direction', instruction_text:'别往右边动', correct_action:'swipe_left', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:700, difficulty:5 },
    { type:'direction', instruction_text:'不准往左', correct_action:'swipe_right', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:650, difficulty:5 },
    { type:'direction', instruction_text:'不准往右', correct_action:'swipe_left', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:650, difficulty:5 },
    { type:'direction', instruction_text:'向左是错的', correct_action:'swipe_left', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:700, difficulty:5 },
    { type:'direction', instruction_text:'向右是错的', correct_action:'swipe_right', options:[{label:'向左',action:'swipe_left'},{label:'向右',action:'swipe_right'}], time_limit_ms:700, difficulty:5 },

    // ═══════════════════════════════════════════════════════
    // 颜色类 color (22 题)
    // ═══════════════════════════════════════════════════════
    { type:'color', instruction_text:'点红色的', correct_action:'tap_blue', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:1100, difficulty:1 },
    { type:'color', instruction_text:'点蓝色的', correct_action:'tap_red', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:1100, difficulty:1 },
    { type:'color', instruction_text:'点绿色的', correct_action:'tap_yellow', options:[{label:'绿',action:'tap_green',color:'#44CC44'},{label:'黄',action:'tap_yellow',color:'#DDDD44'}], time_limit_ms:1100, difficulty:1 },
    { type:'color', instruction_text:'点黄色的', correct_action:'tap_green', options:[{label:'绿',action:'tap_green',color:'#44CC44'},{label:'黄',action:'tap_yellow',color:'#DDDD44'}], time_limit_ms:1100, difficulty:1 },
    { type:'color', instruction_text:'选红色的', correct_action:'tap_blue', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:1050, difficulty:2 },
    { type:'color', instruction_text:'选蓝色的', correct_action:'tap_red', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:1050, difficulty:2 },
    { type:'color', instruction_text:'选绿色的', correct_action:'tap_yellow', options:[{label:'绿',action:'tap_green',color:'#44CC44'},{label:'黄',action:'tap_yellow',color:'#DDDD44'}], time_limit_ms:1050, difficulty:2 },
    { type:'color', instruction_text:'选黄色的', correct_action:'tap_green', options:[{label:'绿',action:'tap_green',color:'#44CC44'},{label:'黄',action:'tap_yellow',color:'#DDDD44'}], time_limit_ms:1050, difficulty:2 },
    { type:'color', instruction_text:'不要点红色的', correct_action:'tap_red', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:950, difficulty:3 },
    { type:'color', instruction_text:'不要点蓝色的', correct_action:'tap_blue', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:950, difficulty:3 },
    { type:'color', instruction_text:'点紫色的', correct_action:'tap_orange', options:[{label:'紫',action:'tap_purple',color:'#BB44FF'},{label:'橙',action:'tap_orange',color:'#FF8844'}], time_limit_ms:950, difficulty:3 },
    { type:'color', instruction_text:'点橙色的', correct_action:'tap_purple', options:[{label:'紫',action:'tap_purple',color:'#BB44FF'},{label:'橙',action:'tap_orange',color:'#FF8844'}], time_limit_ms:950, difficulty:3 },
    { type:'color', instruction_text:'点粉色的', correct_action:'tap_cyan', options:[{label:'粉',action:'tap_pink',color:'#FF66AA'},{label:'青',action:'tap_cyan',color:'#44DDDD'}], time_limit_ms:900, difficulty:4 },
    { type:'color', instruction_text:'点青色的', correct_action:'tap_pink', options:[{label:'粉',action:'tap_pink',color:'#FF66AA'},{label:'青',action:'tap_cyan',color:'#44DDDD'}], time_limit_ms:900, difficulty:4 },
    { type:'color', instruction_text:'不要点绿色的', correct_action:'tap_green', options:[{label:'绿',action:'tap_green',color:'#44CC44'},{label:'黄',action:'tap_yellow',color:'#DDDD44'}], time_limit_ms:850, difficulty:5 },
    { type:'color', instruction_text:'不要点黄色的', correct_action:'tap_yellow', options:[{label:'绿',action:'tap_green',color:'#44CC44'},{label:'黄',action:'tap_yellow',color:'#DDDD44'}], time_limit_ms:850, difficulty:5 },
    { type:'color', instruction_text:'别选紫色的', correct_action:'tap_purple', options:[{label:'紫',action:'tap_purple',color:'#BB44FF'},{label:'橙',action:'tap_orange',color:'#FF8844'}], time_limit_ms:800, difficulty:5 },
    { type:'color', instruction_text:'别选橙色的', correct_action:'tap_orange', options:[{label:'紫',action:'tap_purple',color:'#BB44FF'},{label:'橙',action:'tap_orange',color:'#FF8844'}], time_limit_ms:800, difficulty:5 },
    { type:'color', instruction_text:'红色不对', correct_action:'tap_red', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:750, difficulty:5 },
    { type:'color', instruction_text:'蓝色不对', correct_action:'tap_blue', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:750, difficulty:5 },
    { type:'color', instruction_text:'点黑色', correct_action:'tap_white', options:[{label:'黑',action:'tap_black',color:'#222222'},{label:'白',action:'tap_white',color:'#EEEEEE'}], time_limit_ms:800, difficulty:5 },
    { type:'color', instruction_text:'点白色', correct_action:'tap_black', options:[{label:'黑',action:'tap_black',color:'#222222'},{label:'白',action:'tap_white',color:'#EEEEEE'}], time_limit_ms:800, difficulty:5 },

    // ═══════════════════════════════════════════════════════
    // 动作类 action (18 题)
    // ═══════════════════════════════════════════════════════
    { type:'action', instruction_text:'别点', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:1200, difficulty:1 },
    { type:'action', instruction_text:'别动', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:1200, difficulty:1 },
    { type:'action', instruction_text:'点一下', correct_action:'wait', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:1200, difficulty:1 },
    { type:'action', instruction_text:'碰一下', correct_action:'wait', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:1200, difficulty:1 },
    { type:'action', instruction_text:'别按', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:1100, difficulty:2 },
    { type:'action', instruction_text:'按一下', correct_action:'wait', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:1100, difficulty:2 },
    { type:'action', instruction_text:'忍住别点', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:1000, difficulty:3 },
    { type:'action', instruction_text:'不要碰', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:1000, difficulty:3 },
    { type:'action', instruction_text:'把手拿开', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:950, difficulty:3 },
    { type:'action', instruction_text:'不许点', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:950, difficulty:3 },
    { type:'action', instruction_text:'禁止触碰', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:900, difficulty:4 },
    { type:'action', instruction_text:'不许动', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:900, difficulty:4 },
    { type:'action', instruction_text:'立刻停手', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:800, difficulty:5 },
    { type:'action', instruction_text:'摸一下', correct_action:'wait', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:800, difficulty:5 },
    { type:'action', instruction_text:'千万别点', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:750, difficulty:5 },
    { type:'action', instruction_text:'一定要点', correct_action:'wait', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:700, difficulty:5 },
    { type:'action', instruction_text:'绝对别碰', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:700, difficulty:5 },
    { type:'action', instruction_text:'给我按住', correct_action:'wait', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:700, difficulty:5 },

    // ═══════════════════════════════════════════════════════
    // 双重否定 double_neg (12 题)
    // ═══════════════════════════════════════════════════════
    { type:'double_neg', instruction_text:'不要不点', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'不点',action:'wait'}], time_limit_ms:1100, difficulty:2 },
    { type:'double_neg', instruction_text:'别不碰', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'不点',action:'wait'}], time_limit_ms:1100, difficulty:2 },
    { type:'double_neg', instruction_text:'别不动', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:1050, difficulty:3 },
    { type:'double_neg', instruction_text:'不准不按', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'不按',action:'wait'}], time_limit_ms:1050, difficulty:3 },
    { type:'double_neg', instruction_text:'不要不碰', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'不碰',action:'wait'}], time_limit_ms:1000, difficulty:3 },
    { type:'double_neg', instruction_text:'别不摁', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'不摁',action:'wait'}], time_limit_ms:1000, difficulty:3 },
    { type:'double_neg', instruction_text:'不可以不点', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'不点',action:'wait'}], time_limit_ms:900, difficulty:4 },
    { type:'double_neg', instruction_text:'不能不摸', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:900, difficulty:4 },
    { type:'double_neg', instruction_text:'不是不点', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'不点',action:'wait'}], time_limit_ms:850, difficulty:5 },
    { type:'double_neg', instruction_text:'不许不碰', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'不碰',action:'wait'}], time_limit_ms:850, difficulty:5 },
    { type:'double_neg', instruction_text:'不能没反应', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:800, difficulty:5 },
    { type:'double_neg', instruction_text:'千万别没动作', correct_action:'tap_any', options:[{label:'点！',action:'tap_any'},{label:'忍住',action:'wait'}], time_limit_ms:750, difficulty:5 },

    // ═══════════════════════════════════════════════════════
    // 组合类 combo (16 题)
    // ═══════════════════════════════════════════════════════
    { type:'combo', instruction_text:'不要点红色的', correct_action:'tap_blue', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:950, difficulty:3 },
    { type:'combo', instruction_text:'不要点蓝色的', correct_action:'tap_red', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:950, difficulty:3 },
    { type:'combo', instruction_text:'别选绿色的', correct_action:'tap_yellow', options:[{label:'绿',action:'tap_green',color:'#44CC44'},{label:'黄',action:'tap_yellow',color:'#DDDD44'}], time_limit_ms:900, difficulty:3 },
    { type:'combo', instruction_text:'别选黄色的', correct_action:'tap_green', options:[{label:'绿',action:'tap_green',color:'#44CC44'},{label:'黄',action:'tap_yellow',color:'#DDDD44'}], time_limit_ms:900, difficulty:3 },
    { type:'combo', instruction_text:'不准点红色', correct_action:'tap_blue', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:850, difficulty:4 },
    { type:'combo', instruction_text:'不准点蓝色', correct_action:'tap_red', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:850, difficulty:4 },
    { type:'combo', instruction_text:'不要点紫色', correct_action:'tap_orange', options:[{label:'紫',action:'tap_purple',color:'#BB44FF'},{label:'橙',action:'tap_orange',color:'#FF8844'}], time_limit_ms:850, difficulty:4 },
    { type:'combo', instruction_text:'不要点橙色', correct_action:'tap_purple', options:[{label:'紫',action:'tap_purple',color:'#BB44FF'},{label:'橙',action:'tap_orange',color:'#FF8844'}], time_limit_ms:850, difficulty:4 },
    { type:'combo', instruction_text:'禁止点红色', correct_action:'tap_blue', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:800, difficulty:5 },
    { type:'combo', instruction_text:'禁止点蓝色', correct_action:'tap_red', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:800, difficulty:5 },
    { type:'combo', instruction_text:'红色是陷阱', correct_action:'tap_red', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:750, difficulty:5 },
    { type:'combo', instruction_text:'蓝色是陷阱', correct_action:'tap_blue', options:[{label:'红',action:'tap_red',color:'#FF4444'},{label:'蓝',action:'tap_blue',color:'#4488FF'}], time_limit_ms:750, difficulty:5 },
    { type:'combo', instruction_text:'绿色不能选', correct_action:'tap_green', options:[{label:'绿',action:'tap_green',color:'#44CC44'},{label:'黄',action:'tap_yellow',color:'#DDDD44'}], time_limit_ms:750, difficulty:5 },
    { type:'combo', instruction_text:'黄色不能选', correct_action:'tap_yellow', options:[{label:'绿',action:'tap_green',color:'#44CC44'},{label:'黄',action:'tap_yellow',color:'#DDDD44'}], time_limit_ms:750, difficulty:5 },
    { type:'combo', instruction_text:'别点粉色', correct_action:'tap_pink', options:[{label:'粉',action:'tap_pink',color:'#FF66AA'},{label:'青',action:'tap_cyan',color:'#44DDDD'}], time_limit_ms:750, difficulty:5 },
    { type:'combo', instruction_text:'别点青色', correct_action:'tap_cyan', options:[{label:'粉',action:'tap_pink',color:'#FF66AA'},{label:'青',action:'tap_cyan',color:'#44DDDD'}], time_limit_ms:750, difficulty:5 },
  ];

  // ─── 公开方法 ───────────────────────────────────────────

  function getQuestions(count) {
    count = count || 20;
    var easy = allQuestions.filter(function(q) { return q.difficulty <= 2; });
    var medium = allQuestions.filter(function(q) { return q.difficulty >= 3 && q.difficulty <= 4; });
    var hard = allQuestions.filter(function(q) { return q.difficulty >= 5; });
    easy = shuffle(easy); medium = shuffle(medium); hard = shuffle(hard);
    var easyCount = Math.ceil(count * 0.35);
    var mediumCount = Math.ceil(count * 0.35);
    var hardCount = count - easyCount - mediumCount;
    var result = [];
    for (var i = 0; i < easyCount; i++) { result.push(easy[i % easy.length]); }
    for (var j = 0; j < mediumCount; j++) { result.push(medium[j % medium.length]); }
    for (var k = 0; k < hardCount; k++) { result.push(hard[k % hard.length]); }
    result.sort(function (a, b) { return (a.difficulty || 1) - (b.difficulty || 1); });
    return result;
  }

  function getTotalCount() { return allQuestions.length; }

  function getByType(type) { return allQuestions.filter(function(q) { return q.type === type; }); }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function seededRandom(seed) {
    var s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(arr, seed) {
    var a = arr.slice();
    var rand = seededRandom(seed);
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function getDailyQuestions(count, seed) {
    var easy = allQuestions.filter(function(q) { return q.difficulty <= 2; });
    var medium = allQuestions.filter(function(q) { return q.difficulty >= 3 && q.difficulty <= 4; });
    var hard = allQuestions.filter(function(q) { return q.difficulty >= 5; });
    easy = seededShuffle(easy, seed + 100);
    medium = seededShuffle(medium, seed + 200);
    hard = seededShuffle(hard, seed + 300);
    var easyCount = Math.ceil(count * 0.30);
    var mediumCount = Math.ceil(count * 0.35);
    var hardCount = count - easyCount - mediumCount;
    var result = [];
    for (var i = 0; i < easyCount; i++) { result.push(easy[i % easy.length]); }
    for (var j = 0; j < mediumCount; j++) { result.push(medium[j % medium.length]); }
    for (var k = 0; k < hardCount; k++) { result.push(hard[k % hard.length]); }
    result.sort(function (a, b) { return (a.difficulty||1) - (b.difficulty||1); });
    return result;
  }

  return {
    getQuestions: getQuestions,
    getDailyQuestions: getDailyQuestions,
    getTotalCount: getTotalCount,
    getByType: getByType
  };
})();
