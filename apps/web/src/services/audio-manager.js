(function (global) {
  "use strict";

  var audioBase = "/assets/audio/";
  var musicBase = audioBase + "music/";
  var bgmEnabledKey = "opposite_bgm_enabled";
  var AudioContextClass = global.AudioContext || global.webkitAudioContext;
  var audioContext = null;
  var activeChannels = Object.create(null);

  function readBGMPreference() {
    try {
      return global.localStorage.getItem(bgmEnabledKey) !== "false";
    } catch (_error) {
      return true;
    }
  }

  var bgmState = {
    requested: null,
    requestedOptions: null,
    current: null,
    source: null,
    gainNode: null,
    volume: 0.12,
    enabled: readBGMPreference(),
    ducked: false,
    requestId: 0,
    resumeAfterHidden: false,
  };

  function publishBGMState() {
    var root = document.documentElement;
    if (!root) return;
    root.dataset.bgmRequested = bgmState.requested || "";
    root.dataset.bgmCurrent = bgmState.current || "";
    root.dataset.bgmEnabled = String(bgmState.enabled);
    root.dataset.audioContext = audioContext ? audioContext.state : "uninitialized";
  }

  function getAudioContext() {
    if (!AudioContextClass) return null;
    if (!audioContext) {
      audioContext = new AudioContextClass();
      audioContext.onstatechange = publishBGMState;
      publishBGMState();
    }
    return audioContext;
  }

  function createAudio(filename, volume, channel) {
    return {
      url: audioBase + filename,
      volume: volume,
      __channel: channel,
      buffer: null,
      bufferPromise: null,
    };
  }

  function createMusic(filename) {
    return {
      url: musicBase + filename,
      buffer: null,
      bufferPromise: null,
    };
  }

  var manager = {
    gameplay: {
      correct: createAudio("答对.mp3", 0.6, "feedback"),
      wrong: createAudio("答错.mp3", 0.5, "feedback"),
    },
    successPool: [
      createAudio("成功1.mp3", 0.6, "voice"),
      createAudio("成功2.mp3", 0.6, "voice"),
      createAudio("成功3.mp3", 0.6, "voice"),
      createAudio("成功4.mp3", 0.6, "voice"),
      createAudio("成功5.mp3", 0.6, "voice"),
    ],
    failPool: [
      createAudio("失败1.mp3", 0.6, "voice"),
      createAudio("失败2.mp3", 0.6, "voice"),
      createAudio("失败3.mp3", 0.6, "voice"),
    ],
    bgm: {
      theme: createMusic("retro-synth-main.mp3"),
      dark: createMusic("darker-waves.mp3"),
      horror: createMusic("synthwave-horror-loop.m4a"),
      drive: createMusic("retro-synth-drive.m4a"),
    },
  };

  function allEffectDescriptors() {
    return [
      manager.gameplay.correct,
      manager.gameplay.wrong,
    ].concat(manager.successPool, manager.failPool);
  }

  function loadBuffer(descriptor, label) {
    var context = getAudioContext();
    if (!context || !descriptor) return Promise.resolve(null);
    if (descriptor.buffer) return Promise.resolve(descriptor.buffer);
    if (descriptor.bufferPromise) return descriptor.bufferPromise;

    descriptor.bufferPromise = global.fetch(descriptor.url)
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.arrayBuffer();
      })
      .then(function (arrayBuffer) {
        return context.decodeAudioData(arrayBuffer);
      })
      .then(function (buffer) {
        descriptor.buffer = buffer;
        return buffer;
      })
      .catch(function (error) {
        descriptor.bufferPromise = null;
        console.warn("[反着来] " + (label || "音频") + "加载失败:", descriptor.url, error);
        return null;
      });
    return descriptor.bufferPromise;
  }

  function rampGain(gainNode, target, durationMs) {
    var context = getAudioContext();
    if (!context || !gainNode) return;
    var gain = gainNode.gain;
    gain.cancelScheduledValues(context.currentTime);
    gain.setValueAtTime(gain.value, context.currentTime);
    gain.linearRampToValueAtTime(
      Math.max(0, target),
      context.currentTime + Math.max(0, durationMs) / 1000
    );
  }

  function stopMusicNode(source, gainNode, fadeOutMs) {
    if (!source) return;
    if (gainNode && fadeOutMs > 0) rampGain(gainNode, 0, fadeOutMs);
    global.setTimeout(function () {
      source.onended = null;
      try {
        source.stop();
      } catch (_error) {
        // The source may already have ended.
      }
      source.disconnect();
      if (gainNode) gainNode.disconnect();
    }, Math.max(0, fadeOutMs) + 40);
  }

  function unduckBGM() {
    if (!bgmState.gainNode || !bgmState.ducked) return;
    bgmState.ducked = false;
    rampGain(bgmState.gainNode, bgmState.volume, 240);
  }

  function duckBGM() {
    if (!bgmState.gainNode) return;
    bgmState.ducked = true;
    rampGain(bgmState.gainNode, bgmState.volume * 0.32, 100);
  }

  function stopChannel(channel) {
    var active = activeChannels[channel];
    if (!active) return;
    if (active.timer) global.clearTimeout(active.timer);
    if (active.source) {
      active.source.onended = null;
      try {
        active.source.stop();
      } catch (_error) {
        // The source may already have ended.
      }
      active.source.disconnect();
      if (active.gain) active.gain.disconnect();
    }
    if (active.fallback) {
      active.fallback.pause();
      active.fallback.removeAttribute("src");
      active.fallback.load();
    }
    delete activeChannels[channel];
    if (channel === "voice") unduckBGM();
  }

  function stopAll() {
    Object.keys(activeChannels).forEach(stopChannel);
  }

  function playFallback(descriptor, channel, options, entry) {
    var audio = new Audio(descriptor.url);
    entry.fallback = audio;
    audio.volume = descriptor.volume;
    audio.preload = "auto";
    audio.onended = function () {
      if (activeChannels[channel] === entry) stopChannel(channel);
    };
    audio.onerror = audio.onended;
    if (options.maxDurationMs > 0) {
      entry.timer = global.setTimeout(function () {
        if (activeChannels[channel] === entry) stopChannel(channel);
      }, options.maxDurationMs);
    }
    return audio.play().then(function () {
      if (channel === "voice") duckBGM();
      return true;
    }).catch(function (error) {
      if (activeChannels[channel] === entry) stopChannel(channel);
      console.warn("[反着来] 音频播放被浏览器拦截:", error);
      return false;
    });
  }

  function playSound(descriptor, options) {
    if (!descriptor) return Promise.resolve(false);
    options = options || {};
    var channel = options.channel || descriptor.__channel || "feedback";
    stopChannel(channel);
    var entry = { source: null, gain: null, fallback: null, timer: null };
    activeChannels[channel] = entry;

    var context = getAudioContext();
    if (!context) return playFallback(descriptor, channel, options, entry);
    if (context.state !== "running") {
      stopChannel(channel);
      return Promise.resolve(false);
    }

    return loadBuffer(descriptor, "音频").then(function (buffer) {
      if (!buffer || activeChannels[channel] !== entry) return false;
      var source = context.createBufferSource();
      var gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = descriptor.volume;
      source.connect(gain);
      gain.connect(context.destination);
      entry.source = source;
      entry.gain = gain;
      source.onended = function () {
        if (activeChannels[channel] === entry) stopChannel(channel);
      };
      if (options.maxDurationMs > 0) {
        entry.timer = global.setTimeout(function () {
          if (activeChannels[channel] === entry) stopChannel(channel);
        }, options.maxDurationMs);
      }
      if (channel === "voice") duckBGM();
      source.start(0);
      return true;
    });
  }

  function playRandomFromPool(pool, options) {
    if (!pool || !pool.length) return Promise.resolve(false);
    return playSound(pool[Math.floor(Math.random() * pool.length)], options);
  }

  function playBGM(name, options) {
    options = options || {};
    var descriptor = manager.bgm[name];
    if (!descriptor) return Promise.resolve(false);

    bgmState.requested = name;
    bgmState.requestedOptions = {
      volume: options.volume == null ? 0.12 : options.volume,
      fadeInMs: options.fadeInMs == null ? 600 : options.fadeInMs,
      fadeOutMs: options.fadeOutMs == null ? 600 : options.fadeOutMs,
    };
    publishBGMState();

    if (!bgmState.enabled || document.hidden) return Promise.resolve(false);
    var context = getAudioContext();
    if (!context || context.state !== "running") return Promise.resolve(false);

    var targetVolume = bgmState.requestedOptions.volume;
    if (bgmState.current === name && bgmState.source) {
      bgmState.volume = targetVolume;
      if (!bgmState.ducked) rampGain(bgmState.gainNode, targetVolume, 240);
      return Promise.resolve(true);
    }

    var requestId = ++bgmState.requestId;
    return loadBuffer(descriptor, "BGM ").then(function (buffer) {
      if (
        !buffer
        || requestId !== bgmState.requestId
        || bgmState.requested !== name
        || !bgmState.enabled
        || document.hidden
      ) {
        return false;
      }

      var oldSource = bgmState.source;
      var oldGain = bgmState.gainNode;
      var source = context.createBufferSource();
      var gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(context.destination);

      bgmState.current = name;
      bgmState.source = source;
      bgmState.gainNode = gain;
      bgmState.volume = targetVolume;
      bgmState.ducked = false;
      publishBGMState();

      source.onended = function () {
        if (bgmState.source === source) {
          bgmState.source = null;
          bgmState.gainNode = null;
          bgmState.current = null;
          publishBGMState();
        }
      };
      source.start(0);
      rampGain(gain, targetVolume, bgmState.requestedOptions.fadeInMs);
      stopMusicNode(oldSource, oldGain, bgmState.requestedOptions.fadeOutMs);
      return true;
    });
  }

  function stopBGM(fadeOutMs, preserveRequest) {
    bgmState.requestId++;
    var source = bgmState.source;
    var gain = bgmState.gainNode;
    bgmState.source = null;
    bgmState.gainNode = null;
    bgmState.current = null;
    bgmState.ducked = false;
    if (!preserveRequest) {
      bgmState.requested = null;
      bgmState.requestedOptions = null;
    }
    publishBGMState();
    stopMusicNode(source, gain, fadeOutMs == null ? 600 : fadeOutMs);
    return Promise.resolve(Boolean(source));
  }

  function setBGVolume(volume) {
    bgmState.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    if (bgmState.requestedOptions) {
      bgmState.requestedOptions.volume = bgmState.volume;
    }
    if (bgmState.gainNode && !bgmState.ducked) {
      rampGain(bgmState.gainNode, bgmState.volume, 180);
    }
  }

  function setBGMEnabled(enabled) {
    bgmState.enabled = Boolean(enabled);
    try {
      global.localStorage.setItem(bgmEnabledKey, String(bgmState.enabled));
    } catch (_error) {
      // The preference remains available for this page load.
    }
    if (!bgmState.enabled) {
      stopBGM(300, true);
    } else if (bgmState.requested) {
      playBGM(bgmState.requested, bgmState.requestedOptions || {});
    }
    publishBGMState();
    return bgmState.enabled;
  }

  function toggleBGM() {
    return setBGMEnabled(!bgmState.enabled);
  }

  function getBGMState() {
    return {
      current: bgmState.current,
      requested: bgmState.requested,
      enabled: bgmState.enabled,
      volume: bgmState.volume,
      ducked: bgmState.ducked,
      contextState: audioContext ? audioContext.state : "uninitialized",
    };
  }

  function unlockAllAudio() {
    var context = getAudioContext();
    if (!context) return Promise.resolve(true);
    var resume = context.state === "running" ? Promise.resolve() : context.resume();
    return resume.then(function () {
      publishBGMState();
      if (bgmState.enabled && bgmState.requested) {
        return playBGM(bgmState.requested, bgmState.requestedOptions || {});
      }
      return true;
    }).catch(function () {
      return false;
    });
  }

  function activateAudio() {
    unlockAllAudio();
  }

  document.addEventListener("pointerdown", activateAudio, { capture: true });
  document.addEventListener("keydown", activateAudio, { capture: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopAll();
      bgmState.resumeAfterHidden = Boolean(bgmState.source || bgmState.requested);
      stopBGM(120, true);
    } else if (bgmState.resumeAfterHidden && bgmState.enabled && bgmState.requested) {
      bgmState.resumeAfterHidden = false;
      unlockAllAudio();
    }
  });

  allEffectDescriptors().forEach(function (descriptor) {
    loadBuffer(descriptor, "音频");
  });
  loadBuffer(manager.bgm.theme, "BGM ");
  publishBGMState();

  manager.play = playSound;
  manager.playRandom = playRandomFromPool;
  manager.unlock = unlockAllAudio;
  manager.stopChannel = stopChannel;
  manager.stopAll = stopAll;
  manager.playBGM = playBGM;
  manager.stopBGM = stopBGM;
  manager.setBGVolume = setBGVolume;
  manager.duckBGM = duckBGM;
  manager.unduckBGM = unduckBGM;
  manager.setBGMEnabled = setBGMEnabled;
  manager.toggleBGM = toggleBGM;
  manager.getBGMState = getBGMState;

  global.AudioManager = manager;
  global.playSound = playSound;
  global.playRandomFromPool = playRandomFromPool;
  global.unlockAllAudio = unlockAllAudio;
})(window);
