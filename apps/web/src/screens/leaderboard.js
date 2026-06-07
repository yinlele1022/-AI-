(function (global) {
  "use strict";
  var OppositeGame = global.OppositeGame;
  var ui = global.OppositeGameUI;
  var BTN_RADIUS = ui.BTN_RADIUS;
  var CANVAS_W = ui.CANVAS_W;
  var COLOR_PRIMARY = ui.COLOR_PRIMARY;
  var COLOR_SECONDARY = ui.COLOR_SECONDARY;
  var COLOR_WHITE = ui.COLOR_WHITE;
  var FONT_FAMILY = ui.FONT_FAMILY;
  var FONT_MONO = ui.FONT_MONO;

  /**
   * 排行榜页输入处理
   */
  OppositeGame.prototype.handleLeaderboardInput = function (point, isSwipe, swipeDir) {
    if (isSwipe) return;
    var btn = this.hitTest(point);
    if (btn && btn.id === 'leaderboardBack') {
      this.goToPage('home');
    } else if (btn && btn.id === 'leaderboardClear') {
      this.clearLeaderboard();
      this.render();
    }
  };

  // ─── 排行榜页渲染 ───────────────────────────────────────

  OppositeGame.prototype.drawLeaderboardPage = function (ctx) {
    this.buttons = [];

    var list = this.loadLeaderboard();
    var hasData = list.length > 0;

    // 标题区
    this.drawMicroLabel(ctx, 'RANKING SYSTEM', CANVAS_W / 2, 48, 'center',
      'rgba(0,245,160,0.66)');
    ctx.fillStyle = COLOR_PRIMARY;
    ctx.font = 'bold 34px ' + FONT_FAMILY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('排行榜', CANVAS_W / 2, 80);
    ctx.fillStyle = COLOR_SECONDARY;
    ctx.font = '13px ' + FONT_FAMILY;
    ctx.fillText('LEADERBOARD  ·  ' + list.length + ' 条记录', CANVAS_W / 2, 110);

    // 分隔线
    ctx.strokeStyle = 'rgba(0,245,160,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(38, 128);
    ctx.lineTo(CANVAS_W - 38, 128);
    ctx.stroke();

    if (!hasData) {
      // 空状态
      ctx.fillStyle = COLOR_SECONDARY;
      ctx.font = '16px ' + FONT_FAMILY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('尚无记录', CANVAS_W / 2, 370);
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.font = '13px ' + FONT_FAMILY;
      ctx.fillText('快去挑战吧！', CANVAS_W / 2, 400);
    } else {
      // 表头
      var headerY = 148;
      ctx.fillStyle = 'rgba(0,245,160,0.50)';
      ctx.font = '11px ' + FONT_MONO;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText('RANK', 40, headerY);
      ctx.fillText('SCORE', 106, headerY);
      ctx.textAlign = 'center';
      ctx.fillText('TITLE', 230, headerY);
      ctx.textAlign = 'right';
      ctx.fillText('MODE', CANVAS_W - 98, headerY);
      ctx.fillText('DATE', CANVAS_W - 42, headerY);

      // 分隔线
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(38, headerY + 16);
      ctx.lineTo(CANVAS_W - 38, headerY + 16);
      ctx.stroke();

      // 列表项
      var itemY = headerY + 32;
      var itemsToShow = Math.min(list.length, 8);

      for (var i = 0; i < itemsToShow; i++) {
        var entry = list[i];
        var rank = i + 1;
        var isTop3 = rank <= 3;

        // 行背景（前三名高亮）
        if (isTop3) {
          var medalColors = [
            'rgba(255,215,0,0.10)',   // 金
            'rgba(192,192,192,0.07)', // 银
            'rgba(205,127,50,0.07)'   // 铜
          ];
          ctx.fillStyle = medalColors[rank - 1];
          ctx.fillRect(34, itemY - 10, CANVAS_W - 68, 48);
          if (rank === 1) {
            ctx.fillStyle = 'rgba(255,215,0,0.28)';
            ctx.fillRect(34, itemY - 10, 3, 48);
          }
        }

        // 排名
        var rankColor = rank === 1 ? '#FFD700' :
                        rank === 2 ? '#C0C0C0' :
                        rank === 3 ? '#CD7F32' : COLOR_SECONDARY;
        ctx.fillStyle = rankColor;
        ctx.font = 'bold ' + (isTop3 ? 16 : 13) + 'px ' + FONT_MONO;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        var medal = rank === 1 ? '👑 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';
        ctx.fillText(medal + '#' + rank, 40, itemY + 12);

        // 分数（主要信息）
        ctx.fillStyle = COLOR_WHITE;
        ctx.font = 'bold 17px ' + FONT_MONO;
        ctx.fillText(String(entry.totalScore), 106, itemY + 12);
        ctx.fillStyle = COLOR_PRIMARY;
        ctx.font = '9px ' + FONT_MONO;
        ctx.fillText('PTS', 106, itemY + 30);

        // 称号
        ctx.fillStyle = COLOR_WHITE;
        ctx.font = '13px ' + FONT_FAMILY;
        ctx.textAlign = 'center';
        ctx.fillText(entry.title || '--', 230, itemY + 6);

        // 详细信息（正确数 / 连击 / 反应时间）
        var detail = '✓' + (entry.correctCount || 0) + '/' + (entry.totalQuestions || 20);
        if (entry.maxCombo) {
          detail += '  🔥' + entry.maxCombo;
        }
        if (entry.fastestReaction !== null && entry.fastestReaction !== undefined) {
          detail += '  ⚡' + (entry.fastestReaction / 1000).toFixed(2) + 's';
        }
        ctx.fillStyle = COLOR_SECONDARY;
        ctx.font = '10px ' + FONT_MONO;
        ctx.fillText(detail, 230, itemY + 22);

        // 模式
        ctx.fillStyle = COLOR_SECONDARY;
        ctx.font = '10px ' + FONT_FAMILY;
        ctx.textAlign = 'right';
        var modeLabel = entry.playMode === 'level'
          ? '第' + (entry.level || 1) + '关'
          : entry.mode === 'single' ? '单人' :
            entry.mode === 'shadow' ? '在线PK' : entry.mode;
        ctx.fillText(modeLabel, CANVAS_W - 98, itemY + 12);

        // 日期
        ctx.font = '10px ' + FONT_MONO;
        var dateStr = entry.date || '';
        // 只显示月-日 时:分
        ctx.fillText(dateStr.length > 10 ? dateStr.slice(5) : dateStr, CANVAS_W - 42, itemY + 12);

        itemY += 56;
      }
    }

    // 底部分隔线
    var bottomDividerY = 686;
    ctx.strokeStyle = 'rgba(0,245,160,0.18)';
    ctx.beginPath();
    ctx.moveTo(38, bottomDividerY);
    ctx.lineTo(CANVAS_W - 38, bottomDividerY);
    ctx.stroke();

    // 返回按钮
    var bottomBtnW = CANVAS_W - 76, bottomBtnH = 48;
    this.drawBtn(ctx, 38, 702, bottomBtnW, bottomBtnH,
      '返回首页  /  BACK', 'leaderboardBack', 'leaderboardBack', {
        bg: COLOR_PRIMARY,
        border: COLOR_PRIMARY,
        text: '#07110d',
        fontSize: 14,
        radius: BTN_RADIUS,
        glow: 'rgba(0,245,160,0.22)'
      });

    // 清空按钮（有数据时显示）
    if (hasData) {
      this.drawBtn(ctx, 38, 758, bottomBtnW, 36,
        '清空记录  /  CLEAR', 'leaderboardClear', 'leaderboardClear', {
          bg: 'rgba(14,22,20,0.90)',
          border: 'rgba(255,61,90,0.30)',
          text: 'rgba(255,61,90,0.60)',
          fontSize: 11,
          radius: BTN_RADIUS,
          glow: 'rgba(255,61,90,0.04)',
          shadowColor: 'rgba(255,61,90,0.08)',
          pixelShadow: true
        });
    }
  };

  // ─── 结算页渲染 ─────────────────────────────────────────

})(window);
