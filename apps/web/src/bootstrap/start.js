(function (global) {
  "use strict";

  function boot() {
    if (typeof global.QuestionBank === "undefined") {
      console.error("[反着来] QuestionBank 未加载");
      return;
    }
    var game = new global.OppositeGame();
    global.game = game;
    if (typeof global.io !== "undefined") {
      game.initSocket();
    } else {
      console.warn("[反着来] Socket.IO 客户端未加载，在线 PK 不可用");
    }
    if (global.IntroAnimation) {
      global.IntroAnimation.play({ canvas: game.canvas });
    } else {
      var shell = document.getElementById("gameShell");
      if (shell) shell.classList.remove("is-intro-pending");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
