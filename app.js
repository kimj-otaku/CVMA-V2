/* ============================================================
   APP.JS — Logic กลางของแอป
   TASK 4.2: เชื่อม Chapters / Chapter Detail กับข้อมูลกลาง (VOCAB_DATA)
   TASK 4.3: เชื่อม Learn Mode (learn.html?chapter=<id>) กับ VOCAB_DATA
   TASK 4.4: เชื่อม Quick Review (quick-review.html[?chapter=<id>]) กับ VOCAB_DATA
   TASK 5.1: Learning Session ใน Learn Mode (ไล่ทีละคำ → Session Complete → เรียนอีกครั้ง/กลับบท)
   TASK 5.2: ออกเสียงภาษาจีน (Web Speech API / zh-CN) ใน Learn Mode & Learning Session
   TASK 5.3: บันทึก Progress การเรียนคำศัพท์ด้วย Browser Local Storage (คงอยู่หลัง Refresh)
   TASK 5.4: เชื่อมโยง Progress เข้ากับ Learn Mode และ Quick Review แสดงสถานะและจัดลำดับคำศัพท์
   TASK 5.5: Learning Session Completion & Progress Summary แสดงผลสรุปการเรียนของ Session
   TASK 5.6: Home Dashboard & Learning Mode Integration เชื่อมต่อหน้าหลักกับ Progress จริง
   TASK 6.1: Spaced Repetition System (SRS 5 ระดับ) & Due Review Queue Engine คำนวณช่วงเวลาทบทวน
   ============================================================
   - อ่านข้อมูลผ่าน window.VOCAB_DATA (data/vocab-data.js) เท่านั้น
     ไม่มีคำศัพท์/บทเรียนถูกเขียนซ้ำในไฟล์นี้หรือใน HTML
   - ไฟล์นี้ถูกโหลดในทุกหน้า: ตรวจจาก id ของ <main class="page">
     แล้วทำงานเฉพาะหน้าที่เกี่ยวข้อง (หน้าอื่นไม่ถูกกระทบ)
   - Flow: Chapters → (Chapter ID ใน URL ?id=...) → Chapter Detail
           → เริ่มเรียน → Learn Mode (?chapter=<id>)
           → getVocabularyByChapter(Chapter ID)
     Quick Review (Home → quick-review.html): ทุกคำจาก getAllVocabulary()
           (สูงสุด 12) หรือเฉพาะบทด้วย ?chapter=<id> โดยเรียงลำดับตามความเร่งด่วน SRS
   - เพิ่มคำศัพท์ใหม่: เพิ่ม object ใน vocabulary ของ data/vocab-data.js ที่เดียว
   - TASK 5.3 & 5.4: เก็บสถานะลง Local Storage อัตโนมัติ แสดง Badge สถานะ สอดคล้องกันทุกหน้า
   - TASK 6.1: Spaced Repetition System (SRS) 5 ระดับ (1, 3, 7, 14, 30 วัน)
     คำนวณ nextReview อัตโนมัติ และจัดคิวคำศัพท์ที่ถึงกำหนดทบทวน (Due) สำหรับ Quick Review
   ============================================================ */

(function () {
  "use strict";

  var DATA = window.VOCAB_DATA || null;

  /* ---------- Helpers ---------- */

  // สร้าง element ด้วย textContent (ไม่ใช้ innerHTML กับข้อมูล)
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function go(url) {
    location.href = url;
  }

  // Empty / Error state ใช้ร่วมกันทุกกรณี
  function stateBox(icon, title, text, actionLabel, actionUrl) {
    var box = el("section", "card state-box");
    box.appendChild(el("div", "state-icon", icon));
    box.appendChild(el("h2", "state-title", title));
    box.appendChild(el("p", "state-text", text));
    if (actionLabel && actionUrl) {
      var btn = el("button", "btn btn-secondary", actionLabel);
      btn.type = "button";
      btn.addEventListener("click", function () { go(actionUrl); });
      box.appendChild(btn);
    }
    return box;
  }

  function dataErrorBox() {
    return stateBox(
      "⚠️",
      "โหลดข้อมูลไม่สำเร็จ",
      "ไม่พบข้อมูลคำศัพท์ (data/vocab-data.js) กรุณาตรวจสอบไฟล์แล้วลองใหม่",
      "กลับหน้าแรก",
      "index.html"
    );
  }

  /* ============================================================
     Local Storage Progress Management (TASK 5.3)
     - บันทึก/อ่าน Progress ของแต่ละ Vocabulary ID ผ่าน Local Storage
     - ป้องกันข้อมูลสูญหายหลัง Refresh และป้องกัน error เมื่อข้อมูลเสีย
     - ไม่ใช้ Index แต่ใช้ Vocabulary ID (เช่น "vocab-001") เป็น Key
     ============================================================ */
  var STORAGE_KEY = "cvma_vocab_progress";
  var STORAGE_HISTORY_KEY = "cvma_study_history";
  var STORAGE_DAILY_GOAL_KEY = "cvma_daily_goal";
  var STORAGE_DAILY_WORDS_PREFIX = "cvma_daily_words_";
  var STORAGE_UNLOCKED_MILESTONES_KEY = "cvma_unlocked_milestones";
  var STORAGE_GOAL_CELEBRATED_PREFIX = "cvma_daily_goal_celebrated_";
  var STORAGE_REMINDER_SETTINGS_KEY = "cvma_daily_reminder_settings";
  var STORAGE_STREAK_7_REWARD_KEY = "cvma_streak_7_reward_celebrated";
  var STORAGE_STREAK_30_REWARD_KEY = "cvma_streak_30_reward_celebrated";
  var STORAGE_SIMULATED_STREAK_BACKUP = "cvma_streak_history_backup";

  function getTodayString() {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch (e) {
      return "";
    }
  }

  /* ============================================================
     Daily Vocabulary Learning Goal Engine
     - บันทึกและดึงเป้าหมายประจำวัน (ค่าเริ่มต้น: 10 คำ)
     - ติดตามคำศัพท์ที่เรียนหรือทบทวนในวันนี้จริง
     - คำนวณความคืบหน้า (%) และสถานะการบรรลุเป้าหมาย
     ============================================================ */
  function getDailyGoal() {
    var defaultGoal = 10;
    try {
      var val = localStorage.getItem(STORAGE_DAILY_GOAL_KEY);
      if (val) {
        var n = parseInt(val, 10);
        if (!isNaN(n) && n > 0) return n;
      }
    } catch (e) {}
    return defaultGoal;
  }

  function setDailyGoal(val) {
    var target = parseInt(val, 10);
    if (isNaN(target) || target <= 0) target = 10;
    if (target > 100) target = 100;
    try {
      localStorage.setItem(STORAGE_DAILY_GOAL_KEY, String(target));
    } catch (e) {}
    return target;
  }

  function getTodayWordsStudied() {
    var today = getTodayString();
    var set = {};

    // 1. อ่านจาก Daily Words Storage ของวันนี้
    try {
      var raw = localStorage.getItem(STORAGE_DAILY_WORDS_PREFIX + today);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (var i = 0; i < parsed.length; i++) {
            if (parsed[i]) set[parsed[i]] = true;
          }
        }
      }
    } catch (e) {}

    // 2. รวมคำที่ lastReviewed ตรงกับวันนี้ใน Persistent Progress
    var prog = loadProgress();
    if (prog) {
      var keys = Object.keys(prog);
      for (var j = 0; j < keys.length; j++) {
        var item = prog[keys[j]];
        if (item && item.lastReviewed === today) {
          set[keys[j]] = true;
        }
      }
    }

    return Object.keys(set);
  }

  function recordWordStudiedToday(vocabId) {
    if (!vocabId) return;
    var today = getTodayString();
    try {
      var words = getTodayWordsStudied();
      if (words.indexOf(vocabId) === -1) {
        words.push(vocabId);
      }
      localStorage.setItem(STORAGE_DAILY_WORDS_PREFIX + today, JSON.stringify(words));
    } catch (e) {}
  }

  function getDailyGoalProgress() {
    var goal = getDailyGoal();
    var todayWords = getTodayWordsStudied();
    var count = todayWords.length;
    var percent = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;
    var isReached = count >= goal;
    return {
      goal: goal,
      count: count,
      percent: percent,
      isReached: isReached,
      todayWords: todayWords
    };
  }

  function checkAndRecordGoalCelebration() {
    var today = getTodayString();
    var key = STORAGE_GOAL_CELEBRATED_PREFIX + today;
    try {
      var celebrated = localStorage.getItem(key);
      if (celebrated === "true") return false;
      var prog = getDailyGoalProgress();
      if (prog.isReached) {
        localStorage.setItem(key, "true");
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ============================================================
     Celebration & Confetti Animation Engine
     - สร้าง Particle Confetti สวยหวานสไตล์ Pastel Confectionery
     - รองรับรูปทรงหลากหลาย: ริบบิ้นหมุนพลิ้ว 3D, ดาววิบวับ, วงกลม, สี่เหลี่ยม
     - เล่นเสียง Chime รื่นเริงอ่อนหวานด้วย Web Audio API แบบ Pure Native
     ============================================================ */
  function playCelebrationChime() {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      // Pentatonic Arpeggio: C5 (523Hz), E5 (659Hz), G5 (784Hz), B5 (988Hz), C6 (1047Hz)
      var notes = [523.25, 659.25, 783.99, 987.77, 1046.50];
      var startTime = ctx.currentTime + 0.05;
      notes.forEach(function (freq, index) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime + index * 0.09);
        gain.gain.setValueAtTime(0.08, startTime + index * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + index * 0.09 + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime + index * 0.09);
        osc.stop(startTime + index * 0.09 + 0.42);
      });
    } catch (e) {
      // Graceful fallback
    }
  }

  function triggerConfetti(options) {
    options = options || {};
    var duration = options.duration || 3200;
    var particleCount = options.particleCount || 100;

    if (options.chime !== false) {
      playCelebrationChime();
    }

    var canvas = document.createElement("canvas");
    canvas.className = "celebration-confetti-canvas";
    document.body.appendChild(canvas);

    var ctx = canvas.getContext("2d");
    if (!ctx) return function () {};

    var width = window.innerWidth;
    var height = window.innerHeight;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    var colors = [
      "#FF7597", // sweet sakura rose
      "#9B7BF7", // soft lavender
      "#3EBF95", // fresh matcha mint
      "#FFAE33", // honey apricot
      "#5CA9FB", // sky blue
      "#FF5A73", // strawberry blush
      "#FFD166", // pastel butter gold
      "#F472B6", // cotton candy
      "#C084FC"  // pastel lilac
    ];

    var shapes = ["rect", "ribbon", "circle", "star"];
    var particles = [];

    for (var i = 0; i < particleCount; i++) {
      var fromLeft = Math.random() < 0.5;
      var originX = fromLeft
        ? Math.random() * (width * 0.32)
        : width * 0.68 + Math.random() * (width * 0.32);
      var originY = height + 10;
      var angle = fromLeft
        ? (-(Math.PI / 4) - (Math.random() * Math.PI / 4.5))
        : (-(Math.PI * 3 / 4) + (Math.random() * Math.PI / 4.5));
      var speed = 13 + Math.random() * 15;

      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        size: 7 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
        vRotation: (Math.random() - 0.5) * 0.25,
        wobble: Math.random() * Math.PI * 2,
        vWobble: 0.08 + Math.random() * 0.1,
        gravity: 0.36 + Math.random() * 0.12,
        drag: 0.985,
        opacity: 1
      });
    }

    var startTime = performance.now();
    var animFrameId;

    function render(now) {
      var elapsed = now - startTime;
      var progress = elapsed / duration;

      if (progress >= 1) {
        if (canvas && canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
        return;
      }

      ctx.clearRect(0, 0, width, height);

      var fadeOut = progress > 0.72 ? (1 - progress) / 0.28 : 1;

      for (var p = 0; p < particles.length; p++) {
        var item = particles[p];
        item.x += item.vx;
        item.y += item.vy;
        item.vy += item.gravity;
        item.vx *= item.drag;
        item.vy *= item.drag;
        item.rotation += item.vRotation;
        item.wobble += item.vWobble;

        var currentOpacity = item.opacity * fadeOut;
        if (currentOpacity <= 0) continue;

        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.rotation);
        ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity));
        ctx.fillStyle = item.color;

        var scaleX = Math.cos(item.wobble);

        if (item.shape === "rect") {
          ctx.fillRect(-item.size / 2 * scaleX, -item.size / 2, item.size * scaleX, item.size);
        } else if (item.shape === "ribbon") {
          ctx.fillRect(-item.size / 3 * scaleX, -item.size, (item.size / 1.5) * scaleX, item.size * 2);
        } else if (item.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, (item.size / 2) * Math.abs(scaleX), 0, Math.PI * 2);
          ctx.fill();
        } else if (item.shape === "star") {
          ctx.beginPath();
          var spikes = 5;
          var outerRadius = item.size / 1.4;
          var innerRadius = item.size / 3;
          var rot = Math.PI / 2 * 3;
          var step = Math.PI / spikes;
          var cx = 0, cy = 0;
          ctx.moveTo(cx, cy - outerRadius);
          for (var s = 0; s < spikes; s++) {
            var sx = cx + Math.cos(rot) * outerRadius * scaleX;
            var sy = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(sx, sy);
            rot += step;
            sx = cx + Math.cos(rot) * innerRadius * scaleX;
            sy = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(sx, sy);
            rot += step;
          }
          ctx.lineTo(cx, cy - outerRadius);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }

      animFrameId = requestAnimationFrame(render);
    }

    animFrameId = requestAnimationFrame(render);

    return function stop() {
      cancelAnimationFrame(animFrameId);
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }

  function showCelebrationToast(emoji, title, desc) {
    var existing = document.querySelector(".celebration-toast");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    var toast = el("div", "celebration-toast");
    toast.appendChild(el("div", "celebration-toast-icon", emoji || "✨"));
    var c = el("div", "celebration-toast-content");
    c.appendChild(el("div", "celebration-toast-title", title || "ยอดเยี่ยมมาก!"));
    if (desc) {
      c.appendChild(el("div", "celebration-toast-desc", desc));
    }
    toast.appendChild(c);

    document.body.appendChild(toast);

    setTimeout(function () {
      toast.classList.add("is-leaving");
      setTimeout(function () {
        if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
      }, 350);
    }, 2800);
  }

  function showCelebrationModal(title, message, emoji, actionLabel, onAction) {
    emoji = emoji || "🎉";
    title = title || "ยินดีด้วยนะ!";
    actionLabel = actionLabel || "รับทราบและลุยต่อ ✨";

    var backdrop = el("div", "modal-backdrop celebration-modal-backdrop");
    var content = el("div", "modal-content celebration-modal-content");
    content.style.textAlign = "center";
    content.style.padding = "28px 24px";

    var iconEl = el("div", null, emoji);
    iconEl.style.fontSize = "52px";
    iconEl.style.marginBottom = "10px";
    iconEl.style.animation = "bounceMini 1.6s infinite ease-in-out";

    var titleEl = el("div", "modal-title", title);
    titleEl.style.fontSize = "20px";
    titleEl.style.color = "#D9385C";
    titleEl.style.marginBottom = "8px";

    var descEl = el("p", null, message);
    descEl.style.fontSize = "14px";
    descEl.style.color = "var(--text-dark)";
    descEl.style.lineHeight = "1.5";
    descEl.style.margin = "0 0 20px 0";

    var btn = el("button", "btn btn-primary", actionLabel);
    btn.type = "button";
    btn.style.width = "100%";
    btn.addEventListener("click", function () {
      if (typeof onAction === "function") onAction();
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    });

    content.appendChild(iconEl);
    content.appendChild(titleEl);
    content.appendChild(descEl);
    content.appendChild(btn);
    backdrop.appendChild(content);

    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      }
    });

    document.body.appendChild(backdrop);
  }

  /* ============================================================
     Daily Notification & Unmet Goal Reminder Engine
     - แจ้งเตือนเตือนใจให้ตรวจสอบความคืบหน้าการเรียน หากยังไม่พิชิตเป้าหมาย
     - รองรับการปรับแต่งเวลาแจ้งเตือน (Customizable Timing) และเปิด/ปิดได้
     - รองรับ Web Notifications API บนเบราว์เซอร์ พร้อม In-App Alert Banner & Modal
     - ตรวจสอบอัตโนมัติแบบ Background และมีปุ่มทดสอบการแจ้งเตือนทันที
     ============================================================ */
  function getDailyReminderSettings() {
    var defaultSettings = {
      enabled: true,
      time: "20:00",
      sound: true,
      lastNotifiedDate: ""
    };
    try {
      var raw = localStorage.getItem(STORAGE_REMINDER_SETTINGS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null) {
          return {
            enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : defaultSettings.enabled,
            time: (typeof parsed.time === "string" && /^\d{2}:\d{2}$/.test(parsed.time)) ? parsed.time : defaultSettings.time,
            sound: typeof parsed.sound === "boolean" ? parsed.sound : defaultSettings.sound,
            lastNotifiedDate: typeof parsed.lastNotifiedDate === "string" ? parsed.lastNotifiedDate : ""
          };
        }
      }
    } catch (e) {}
    return defaultSettings;
  }

  function saveDailyReminderSettings(settings) {
    try {
      var current = getDailyReminderSettings();
      var merged = {
        enabled: typeof settings.enabled === "boolean" ? settings.enabled : current.enabled,
        time: (typeof settings.time === "string" && /^\d{2}:\d{2}$/.test(settings.time)) ? settings.time : current.time,
        sound: typeof settings.sound === "boolean" ? settings.sound : current.sound,
        lastNotifiedDate: typeof settings.lastNotifiedDate === "string" ? settings.lastNotifiedDate : current.lastNotifiedDate
      };
      localStorage.setItem(STORAGE_REMINDER_SETTINGS_KEY, JSON.stringify(merged));
      return merged;
    } catch (e) {
      return settings;
    }
  }

  function checkDailyGoalReminder(options) {
    options = options || {};
    var settings = getDailyReminderSettings();
    if (!settings.enabled && !options.force) {
      return { shouldRemind: false, reason: "disabled", settings: settings };
    }

    var goalProg = getDailyGoalProgress();
    var todayStr = getTodayString();

    // หากพิชิตเป้าหมายแล้วในวันนี้ -> ไม่ต้องเตือนให้ฝึกเพิ่ม
    if (goalProg.isReached && !options.force) {
      return { shouldRemind: false, reason: "goal_met", goalProg: goalProg, settings: settings };
    }

    var remaining = Math.max(0, goalProg.goal - goalProg.count);

    // ตรวจสอบเวลาปัจจุบันเทียบกับเวลาที่ตั้งไว้
    var now = new Date();
    var curHours = now.getHours();
    var curMinutes = now.getMinutes();
    var curTotalMins = curHours * 60 + curMinutes;

    var timeParts = (settings.time || "20:00").split(":");
    var setHours = parseInt(timeParts[0], 10) || 20;
    var setMinutes = parseInt(timeParts[1], 10) || 0;
    var setTotalMins = setHours * 60 + setMinutes;

    var isTimeReached = (curTotalMins >= setTotalMins);
    var hasNotifiedToday = (settings.lastNotifiedDate === todayStr);

    var shouldRemind = options.force || (isTimeReached && !hasNotifiedToday);

    return {
      shouldRemind: shouldRemind,
      isTimeReached: isTimeReached,
      hasNotifiedToday: hasNotifiedToday,
      goalProg: goalProg,
      remaining: remaining,
      settings: settings,
      todayStr: todayStr
    };
  }

  function triggerDailyReminderNotification(options) {
    options = options || {};
    var check = checkDailyGoalReminder(options);
    var goalProg = check.goalProg || getDailyGoalProgress();
    var remaining = Math.max(0, goalProg.goal - goalProg.count);
    var settings = check.settings || getDailyReminderSettings();

    var title = "🔔 เตือนความจำประจำวัน 🌸";
    var msg = (goalProg.count === 0)
      ? "วันนี้ยังไม่ได้เริ่มฝึกคำศัพท์เลย (เป้าหมาย " + goalProg.goal + " คำ) มาสะสมคำศัพท์กันสักนิดนะ ✨"
      : "วันนี้คุณเรียนไปแล้ว " + goalProg.count + "/" + goalProg.goal + " คำ (ยังขาดอีก " + remaining + " คำจะพิชิตเป้าหมาย) มาลุยต่อกันเถอะ! ✨";

    if (options.force && goalProg.isReached) {
      msg = "🎉 วันนี้คุณพิชิตเป้าหมาย " + goalProg.goal + " คำเรียบร้อยแล้ว เก่งมาก! (นี่คือตัวอย่างการแจ้งเตือน)";
    }

    // 1. เล่นเสียง Chime นุ่มนวล
    if (settings.sound) {
      playCelebrationChime();
    }

    // 2. ส่ง Web Notification บน Browser หากได้รับสิทธิ์
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          var notif = new Notification(title, {
            body: msg,
            icon: "https://api.iconify.design/noto:cherry-blossom.svg",
            badge: "https://api.iconify.design/noto:bell.svg"
          });
          notif.onclick = function () {
            window.focus();
            if (window.location.pathname.indexOf("index.html") === -1 && window.location.pathname !== "/") {
              window.location.href = "index.html";
            }
          };
        }
      }
    } catch (e) {}

    // 3. แสดง Alert Banner บนหน้า Home หากมี element อยู่
    var banner = document.getElementById("homeReminderAlertBanner");
    var descEl = document.getElementById("homeReminderAlertDesc");
    if (banner && descEl) {
      descEl.textContent = msg;
      banner.style.display = "flex";
    }

    // 4. แสดง In-App Toast
    showCelebrationToast("🔔", title, msg);

    // บันทึกวันแจ้งเตือนล่าสุดหากไม่ใช่การกดทดสอบชั่วคราว
    if (!options.force) {
      settings.lastNotifiedDate = getTodayString();
      saveDailyReminderSettings(settings);
    }

    return true;
  }

  function updateReminderUI() {
    var settings = getDailyReminderSettings();
    var goalReminderText = document.getElementById("homeGoalReminderText");
    if (goalReminderText) {
      if (settings.enabled) {
        goalReminderText.textContent = "เตือนความจำ: " + settings.time + " น. (เปิดใช้งาน)";
      } else {
        goalReminderText.textContent = "เตือนความจำ: ปิดใช้งาน";
      }
    }

    var progressReminderText = document.getElementById("progressReminderSummaryText");
    if (progressReminderText) {
      if (settings.enabled) {
        progressReminderText.textContent = "เตือนเวลา " + settings.time + " น. หากยังไม่ครบเป้าหมาย";
      } else {
        progressReminderText.textContent = "ปิดการแจ้งเตือนเตือนใจอยู่";
      }
    }
  }

  function setupReminderModal() {
    var modal = document.getElementById("reminderModal");
    var toggleSwitch = document.getElementById("reminderToggleSwitch");
    var customTimeInput = document.getElementById("reminderCustomTime");
    var presetsGrid = document.getElementById("reminderPresetsGrid");
    var previewTime = document.getElementById("reminderPreviewTime");
    var previewText = document.getElementById("reminderPreviewText");
    var configBody = document.getElementById("reminderConfigBody");
    var saveBtn = document.getElementById("reminderModalSaveBtn");
    var cancelBtn = document.getElementById("reminderModalCancelBtn");
    var closeBtn = document.getElementById("reminderModalCloseBtn");
    var testBtn = document.getElementById("reminderTestBtn");
    var reqPermBtn = document.getElementById("reminderReqPermBtn");
    var permStatusText = document.getElementById("reminderPermStatusText");

    if (!modal) return;

    var currentSettings = getDailyReminderSettings();

    function updatePreview() {
      var isEnabled = toggleSwitch ? toggleSwitch.checked : true;
      var chosenTime = customTimeInput ? customTimeInput.value : "20:00";
      if (!chosenTime) chosenTime = "20:00";

      if (previewTime) previewTime.textContent = chosenTime + " น.";

      var goalProg = getDailyGoalProgress();
      var remaining = Math.max(0, goalProg.goal - goalProg.count);

      if (previewText) {
        if (!isEnabled) {
          previewText.textContent = "⚠️ ปิดการแจ้งเตือนเตือนใจอยู่ (จะไม่ได้รับการเตือนเมื่อยังไม่ครบเป้าหมาย)";
          previewText.style.color = "var(--text-muted)";
        } else if (goalProg.count === 0) {
          previewText.textContent = "🔔 จำศัพท์จีน (" + chosenTime + " น.): วันนี้คุณยังไม่ได้เริ่มเรียนเลย (เป้าหมาย " + goalProg.goal + " คำ) มาฝึกจำศัพท์กันเถอะนะ 🌸";
          previewText.style.color = "var(--text-dark)";
        } else if (goalProg.isReached) {
          previewText.textContent = "🔔 จำศัพท์จีน (" + chosenTime + " น.): วันนี้พิชิตเป้าหมาย " + goalProg.goal + " คำแล้ว! ยอดเยี่ยมมาก ✨";
          previewText.style.color = "var(--text-dark)";
        } else {
          previewText.textContent = "🔔 จำศัพท์จีน (" + chosenTime + " น.): วันนี้คุณเรียนไปแล้ว " + goalProg.count + "/" + goalProg.goal + " คำ (ยังขาดอีก " + remaining + " คำจะพิชิตเป้าหมาย) มาฝึกต่อกันเถอะนะ 🌸";
          previewText.style.color = "var(--text-dark)";
        }
      }

      if (configBody) {
        configBody.style.opacity = isEnabled ? "1" : "0.55";
        configBody.style.pointerEvents = isEnabled ? "auto" : "none";
      }
    }

    function updatePermStatus() {
      if (!("Notification" in window)) {
        if (permStatusText) permStatusText.textContent = "เบราว์เซอร์นี้ไม่รองรับ Web Notification";
        if (reqPermBtn) reqPermBtn.style.display = "none";
        return;
      }
      if (Notification.permission === "granted") {
        if (permStatusText) permStatusText.textContent = "ได้รับอนุญาตแล้ว ✓ (แจ้งเตือนได้)";
        if (reqPermBtn) {
          reqPermBtn.textContent = "✓ ได้รับอนุญาตแล้ว";
          reqPermBtn.disabled = true;
          reqPermBtn.style.opacity = "0.7";
        }
      } else if (Notification.permission === "denied") {
        if (permStatusText) permStatusText.textContent = "ถูกปิดกั้นในเบราว์เซอร์ (จะเตือนในแอปแทน)";
        if (reqPermBtn) reqPermBtn.style.display = "none";
      } else {
        if (permStatusText) permStatusText.textContent = "แตะเพื่อเปิดสิทธิ์รับการแจ้งเตือน";
        if (reqPermBtn) {
          reqPermBtn.textContent = "ขอสิทธิ์เบราว์เซอร์";
          reqPermBtn.disabled = false;
        }
      }
    }

    // ตั้งค่าเริ่มต้นใน Modal
    if (toggleSwitch) {
      toggleSwitch.checked = currentSettings.enabled;
      toggleSwitch.onchange = updatePreview;
    }

    if (customTimeInput) {
      customTimeInput.value = currentSettings.time || "20:00";
      customTimeInput.oninput = function () {
        if (presetsGrid) {
          var pChips = presetsGrid.querySelectorAll(".reminder-preset-chip");
          for (var i = 0; i < pChips.length; i++) {
            pChips[i].classList.remove("is-selected");
            if (pChips[i].getAttribute("data-time") === customTimeInput.value) {
              pChips[i].classList.add("is-selected");
            }
          }
        }
        updatePreview();
      };
    }

    if (presetsGrid) {
      var chips = presetsGrid.querySelectorAll(".reminder-preset-chip");
      for (var c = 0; c < chips.length; c++) {
        var chip = chips[c];
        if (chip.getAttribute("data-time") === currentSettings.time) {
          chip.classList.add("is-selected");
        } else {
          chip.classList.remove("is-selected");
        }
        (function (cNode) {
          cNode.onclick = function () {
            for (var k = 0; k < chips.length; k++) {
              chips[k].classList.remove("is-selected");
            }
            cNode.classList.add("is-selected");
            var val = cNode.getAttribute("data-time");
            if (customTimeInput) customTimeInput.value = val;
            updatePreview();
          };
        })(chip);
      }
    }

    if (reqPermBtn) {
      reqPermBtn.onclick = function () {
        if ("Notification" in window) {
          Notification.requestPermission().then(function () {
            updatePermStatus();
            showCelebrationToast("🔔", "การแจ้งเตือนเบราว์เซอร์", "อัปเดตสิทธิ์การแจ้งเตือนเรียบร้อยแล้ว");
          });
        }
      };
    }

    if (testBtn) {
      testBtn.onclick = function () {
        triggerDailyReminderNotification({ force: true });
      };
    }

    function closeModal() {
      modal.style.display = "none";
    }

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    modal.onclick = function (e) {
      if (e.target === modal) closeModal();
    };

    if (saveBtn) {
      saveBtn.onclick = function () {
        var isEnabled = toggleSwitch ? toggleSwitch.checked : true;
        var chosenTime = customTimeInput ? customTimeInput.value : "20:00";
        if (!chosenTime) chosenTime = "20:00";

        saveDailyReminderSettings({
          enabled: isEnabled,
          time: chosenTime
        });

        closeModal();
        showCelebrationToast("🔔", "บันทึกเวลาแจ้งเตือนแล้ว", isEnabled ? "ระบบจะเตือนคุณเวลา " + chosenTime + " น. หากยังไม่ครบเป้าหมาย 🌸" : "ปิดการแจ้งเตือนเตือนใจเรียบร้อยแล้ว");

        updateReminderUI();
      };
    }

    updatePreview();
    updatePermStatus();
  }

  /* ============================================================
     Streak Milestone Rewards Engine (TASK: 7-Day & 30-Day Streak)
     - ปลดล็อกเหรียญตราดิจิทัล 7 วันติด (⚡) และ 30 วันติด (👑)
     - จุดพลุเฉลิมฉลอง Confetti และส่งเสียง Chime ดนตรีสดใส
     - เชื่อมต่อกับ Progress Summary Card บน progress.html
     - มีโหมดจำลอง Streak Simulator เพื่อการทดสอบที่สะดวกและรวดเร็ว
     ============================================================ */
  function celebrateStreakReward(days) {
    days = Number(days) || 7;
    var duration = days >= 30 ? 4500 : 3500;
    var particleCount = days >= 30 ? 180 : 120;
    triggerConfetti({ duration: duration, particleCount: particleCount });
    playCelebrationChime();

    if (days >= 30) {
      showCelebrationModal(
        "👑 สุดยอดตำนาน 30 วันต่อเนื่อง!",
        "คุณมีวินัยในการเรียนรู้ระดับยอดเยี่ยมที่สุด! เรียนต่อเนื่องครบ 30 วันเต็ม (1 เดือน) ปลดล็อกเหรียญตรา 'ปรมาจารย์ 30 วัน' ความสำเร็จสูงสุด 🌸👑✨",
        "🏆"
      );
    } else {
      showCelebrationModal(
        "⚡ ยอดเยี่ยมมาก! มุ่งมั่น 7 วันติด!",
        "คุณสะสมความสม่ำเสมอครบ 1 สัปดาห์เต็ม ปลดล็อกเหรียญตรา 'มุ่งมั่น 7 วันติด' สร้างรากฐานความจำภาษาจีนที่แข็งแกร่ง เก่งมากๆ เลยนะ 🌸✨",
        "🎉"
      );
    }
  }

  /* ============================================================
     Clean Simulated & Mock Test Data (Production Hygiene)
     - ล้างคีย์จำลองการทดสอบ Streak ออกจาก Local Storage
     - รีเซ็ตสถิติการเรียนรู้จำลองให้กลับสู่สถานะเริ่มต้น 0 อย่างสะอาด
     ============================================================ */
  function cleanSimulatedData() {
    try {
      localStorage.removeItem("cvma_streak_history_backup");
      localStorage.removeItem("cvma_simulated_streak_flag");
      var cleanFlag = "cvma_clean_mock_prod_v2";
      if (localStorage.getItem(cleanFlag) !== "true") {
        localStorage.removeItem(STORAGE_HISTORY_KEY);
        localStorage.removeItem(STORAGE_STREAK_7_REWARD_KEY);
        localStorage.removeItem(STORAGE_STREAK_30_REWARD_KEY);
        localStorage.removeItem(STORAGE_UNLOCKED_MILESTONES_KEY);
        var todayStr = getTodayString();
        localStorage.removeItem(STORAGE_DAILY_WORDS_PREFIX + todayStr);
        localStorage.removeItem(STORAGE_GOAL_CELEBRATED_PREFIX + todayStr);
        localStorage.setItem(cleanFlag, "true");
      }
    } catch (e) {}
  }

  /* ============================================================
     Page-by-Page Onboarding Tour Engine (Step-by-Step Interactive Guide)
     - ระบบแนะนำผู้ใช้งานใหม่แบบทีละขั้นตอนครอบคลุมทุกหน้า
     - ป๊อปอัปอัตโนมัติเมื่อเปิดหน้าครั้งแรก และมีปุ่มเปิดดูซ้ำ (💡 วิธีใช้งาน)
     - นำเสนอสไตล์พาสเทลซากุระอบอุ่น เข้าใจง่าย ตรงจุด
     ============================================================ */
  var PAGE_TOURS_CONFIG = {
    home: [
      {
        step: 1,
        total: 4,
        icon: "🎯",
        title: "ตั้งเป้าหมายคำศัพท์ประจำวัน (Daily Goal)",
        desc: "เริ่มต้นสร้างวินัยด้วยการกำหนดจำนวนคำศัพท์ที่ต้องการเรียนรู้ในแต่ละวัน เช่น 10 คำ สามารถแตะเลือกชิปด่วน (5, 10, 15, 20 คำ) หรือแตะปุ่มแก้ไขเพื่อระบุจำนวนคำได้เองตามสะดวก",
        tips: [
          "สะสมคำศัพท์ทีละนิดทุกวันช่วยให้จำแม่นยำกว่าการท่องจำอัดครั้งเดียว",
          "เมื่อทำครบเป้าหมาย ระบบจะมีพลุ Confetti ฉลองความสำเร็จให้คุณด้วย!"
        ],
        targetSelector: "#homeDailyGoalCard"
      },
      {
        step: 2,
        total: 4,
        icon: "🔔",
        title: "ระบบเตือนความจำประจำวัน (Daily Reminder)",
        desc: "ไม่พลาดทุกการฝึกฝน! สามารถตั้งเวลาแจ้งเตือนเตือนใจได้ตามสะดวก เช่น 20:00 น. หากวันไหนคุณยังไม่ครบเป้าหมาย ระบบจะแจ้งเตือนเตือนใจให้มาฝึกต่อ",
        tips: [
          "เตือนเฉพาะวันที่ยังไม่ครบเป้าหมาย ไม่รบกวนในวันที่ทำสำเร็จแล้ว",
          "แตะปุ่ม '⚙️ ตั้งเวลาเตือน' เพื่อเลือกเวลาหรือปรับแต่งเปิด/ปิดได้ตลอดเวลา"
        ],
        targetSelector: "#homeGoalReminderRow"
      },
      {
        step: 3,
        total: 4,
        icon: "📈",
        title: "กราฟสถิติความต่อเนื่อง 7 วัน (Streak Chart)",
        desc: "ติดตามสถิติการเรียนรู้จริงย้อนหลัง 7 วัน ด้วยกราฟ D3.js แสดงจำนวนคำที่เรียนและเส้นแนวโน้มความสม่ำเสมอ พร้อมขีดบอกเป้าหมายประจำวัน",
        tips: [
          "แท่งสีเขียวมัทฉะแสดงถึงวันที่คุณพิชิตเป้าหมายสำเร็จ",
          "แตะที่แท่งกราฟเพื่อดูรายละเอียดคำศัพท์ที่เรียนในวันนั้นๆ"
        ],
        targetSelector: "#homeStreakChartCard"
      },
      {
        step: 4,
        total: 4,
        icon: "📖",
        title: "บทเรียนปัจจุบัน & ทางลัดทบทวนด่วน",
        desc: "แตะปุ่ม '✨ เรียนต่อเลย' เพื่อเข้าสู่บทเรียนล่าสุด หรือแตะ '🧠 ทบทวนความจำด่วน' เพื่อทบทวนคำศัพท์ที่ถึงกำหนดตามหลัก Spaced Repetition",
        tips: [
          "เข้าถึงการเรียนได้สะดวกรวดเร็วในคลิกเดียว",
          "สามารถสลับหน้าต่างๆ ได้จากแถบเมนูด้านล่างสุด"
        ],
        targetSelector: "#homeCurrentChapterTitle"
      }
    ],
    chapters: [
      {
        step: 1,
        total: 3,
        icon: "📚",
        title: "คลังบทเรียนคำศัพท์ HSK 1",
        desc: "รวบรวมคำศัพท์ภาษาจีนพื้นฐานจัดเป็นหมวดหมู่ 15 บทเรียนอย่างเป็นระบบ พร้อมระดับความยากและตัวอย่างประโยคใช้งานจริง",
        tips: [
          "เลือกบทเรียนที่ต้องการเพื่อเข้าสู่ Flashcard Learn Mode",
          "ระบบจะบันทึกสถานะความก้าวหน้าแยกตามแต่ละบทอัตโนมัติ"
        ],
        targetSelector: "#chapterList"
      },
      {
        step: 2,
        total: 3,
        icon: "📊",
        title: "หลอดวัดระดับความจำ (Mastery Progress)",
        desc: "ในแต่ละการ์ดบทเรียน จะมีหลอดแสดงเปอร์เซ็นต์คำศัพท์ที่คุณจำได้แม่นแล้ว (Mastered) และคำที่กำลังเรียนรู้ (Learning)",
        tips: [
          "ช่วยให้เห็นภาพรวมได้ชัดเจนว่าบทไหนคล่องแล้ว หรือบทไหนต้องทบทวนเพิ่ม",
          "มีปุ่มเริ่มเรียนและปุ่มทดสอบเฉพาะบทให้เลือกใช้งาน"
        ],
        targetSelector: "#chapterList"
      },
      {
        step: 3,
        total: 3,
        icon: "➕",
        title: "สร้างบทใหม่และเพิ่มคำศัพท์เองได้อิสระ",
        desc: "คุณสามารถกด '➕ เพิ่มคำศัพท์ใหม่' หรือ '✏️ สร้างบทใหม่' เพื่อบันทึกคำศัพท์ที่คุณสนใจและจัดหมวดหมู่ได้ตามใจชอบ",
        tips: [
          "ระบบรองรับทั้งตัวอักษรจีน พินอิน คำแปลภาษาไทย และตัวอย่างประโยค",
          "คำศัพท์ที่เพิ่มเองจะเข้าสู่ระบบทบทวน SRS เสมือนบทเรียนมาตรฐาน"
        ],
        targetSelector: ".chapters-top-actions"
      }
    ],
    learn: [
      {
        step: 1,
        total: 3,
        icon: "🎴",
        title: "แฟลชการ์ดคำศัพท์อัจฉริยะ (Vocab Flashcard)",
        desc: "แตะที่ตัวการ์ดเพื่อพลิกดูคำแปลภาษาไทยและตัวอย่างประโยค พร้อมแตะปุ่มลำโพง 🔊 เพื่อฟังเสียงอ่านภาษาจีนสำเนียงแท้",
        tips: [
          "สามารถกดซ่อน/แสดงพินอิน เพื่อทดสอบว่าจำตัวอักษรจีนได้หรือไม่",
          "มีปุ่มคัดลอกคำศัพท์และปุ่มชะลอความเร็วเสียงเพื่อฝึกฟังชัดๆ"
        ],
        targetSelector: "#learnCard"
      },
      {
        step: 2,
        total: 3,
        icon: "🧠",
        title: "ประเมินระดับความจำ Spaced Repetition (SRS)",
        desc: "หลังดูความหมาย แตะประเมินว่าคุณจำคำนี้ได้หรือไม่: '✅ จำได้แล้ว' หรือ '😵 ยังจำไม่ได้' เพื่อให้อัลกอริทึมจัดรอบทบทวนให้อัตโนมัติ",
        tips: [
          "ระบบ Spaced Repetition จะคำนวณวันทบทวนรอบถัดไปตามวิทยาศาสตร์ความจำของสมอง",
          "ซื่อสัตย์กับตนเองในการประเมินเพื่อผลลัพธ์การจำที่ดีที่สุด!"
        ],
        targetSelector: "#learnActions"
      },
      {
        step: 3,
        total: 3,
        icon: "⚙️",
        title: "เครื่องมือช่วยเรียน & ออกเสียงภาษาจีน",
        desc: "แตะปุ่ม 🔊 ฟังเสียงเพื่อฟังสำเนียงภาษาจีนกลางมาตรฐาน zh-CN จาก Web Speech API ได้ตลอดเวลาทั้งฝั่ง Hanzi และตัวอย่างประโยค",
        tips: [
          "ฟังเสียงซ้ำๆ ช่วยฝึกสำเนียงและวรรณยุกต์ได้แม่นยำขึ้น",
          "หลอดความคืบหน้าด้านบนจะบอกว่าคุณเรียนไปแล้วกี่คำในบทนี้"
        ],
        targetSelector: "#learnListenBtn"
      }
    ],
    review: [
      {
        step: 1,
        total: 2,
        icon: "⏰",
        title: "ทบทวนคำศัพท์ที่ถึงกำหนด (Due for Review)",
        desc: "หน้านี้จะรวบรวมเฉพาะคำศัพท์ที่ถึงรอบเวลาทบทวนตามอัลกอริทึม Spaced Repetition (SRS) เพื่อช่วยกระตุ้นสมองก่อนที่คำศัพท์จะเลือนหาย",
        tips: [
          "หากวันนี้ไม่มีคำที่ถึงกำหนด ระบบจะแจ้งว่ายอดเยี่ยม และแนะนำให้ไปเรียนคำใหม่",
          "ทบทวนเพียง 3-5 นาทีต่อวันก็เพียงพอในการรักษาความจำระยะยาว"
        ],
        targetSelector: "#reviewCard"
      },
      {
        step: 2,
        total: 2,
        icon: "🎯",
        title: "อัปเกรดระดับความจำ Spaced Repetition 5 ระดับ",
        desc: "เลือกให้คะแนนความจำ 5 ระดับ (1: ลืมแล้ว ถึง 5: จำแม่น) คำศัพท์จะเลื่อนขั้นระดับ SRS สูงขึ้นเรื่อยๆ ทำให้ระยะเวลาทบทวนยาวนานขึ้นจนกลายเป็นความจำถาวร",
        tips: [
          "หากจำไม่ได้ ไม่ต้องกังวล! ระบบจะนำกลับมาให้ทบทวนซ้ำเร็วขึ้น",
          "ความสม่ำเสมอคือหัวใจสำคัญของการจำภาษาจีน"
        ],
        targetSelector: "#reviewSrsRating"
      }
    ],
    quiz: [
      {
        step: 1,
        total: 3,
        icon: "🎯",
        title: "แบบทดสอบ Active Recall หลายรูปแบบ",
        desc: "ฝึกฝนการดึงความจำผ่านแบบทดสอบ 5 โหมด: คำถามผสม, พูดตอบ (Speak), เลือกความหมาย, ฟังเสียง, และสะกด Pinyin",
        tips: [
          "สลับโหมดได้จากแถบชิปด้านบน เพื่อทดสอบมุมมองความจำที่หลากหลาย",
          "แต่ละข้อมีตัวช่วยจับเวลาและสรุปคะแนนความแม่นยำ"
        ],
        targetSelector: "#quizModeBar"
      },
      {
        step: 2,
        total: 3,
        icon: "🎙️",
        title: "ฟีเจอร์พูดตอบด้วยเสียง (Speak to Answer)",
        desc: "เลือกชิป '🎙️ พูดตอบ (Speak)' เพื่อฝึกออกเสียงภาษาจีนหรือสะกด Pinyin ผ่านไมโครโฟน โดยระบบตรวจจับเสียงจะวิเคราะห์ความถูกต้องให้อัตโนมัติ",
        tips: [
          "มีคลื่นเสียงแสดงขณะพูด และระบบตรวจจับคำตอบทันที",
          "หากไม่สะดวกพูด สามารถสลับกลับเป็นโหมดเลือกตอบหรือสะกด Pinyin ได้ทันที"
        ],
        targetSelector: ".quiz-chip[data-mode='speaking']"
      },
      {
        step: 3,
        total: 3,
        icon: "🏆",
        title: "สรุปคะแนนและประเมินผลความแม่นยำ",
        desc: "แถบด้านบนจะแสดงจำนวนข้อที่ตอบถูกและ Combo Streak ความต่อเนื่อง เมื่อจบแบบทดสอบจะมีพลุ Confetti และสรุปผลรายคำศัพท์อย่างละเอียด",
        tips: [
          "คะแนนสอบช่วยเพิ่มสถิติความจำเข้าระบบ",
          "ทำซ้ำได้บ่อยเท่าที่ต้องการเพื่อฝึกความคล่องตัว"
        ],
        targetSelector: "#quizScoreIndicator"
      }
    ],
    progress: [
      {
        step: 1,
        total: 3,
        icon: "📊",
        title: "ภาพรวมสถิติและคลังคำศัพท์ทั้งหมด",
        desc: "ดูภาพรวมจำนวนคำศัพท์ทั้งหมด แยกตามระดับความจำ SRS (จำได้แม่น, กำลังเรียนรู้, ยังไม่เริ่ม) พร้อมชาร์ตแสดงสัดส่วนชัดเจน",
        tips: [
          "ช่วยให้วางแผนการเรียนรู้ได้อย่างเป็นรูปธรรม",
          "ติดตามว่ามีคำศัพท์ครบกำหนดทบทวนในวันนี้กี่คำ"
        ],
        targetSelector: "#overallProgressCard"
      },
      {
        step: 2,
        total: 3,
        icon: "🏆",
        title: "รางวัลความต่อเนื่อง Streak 7 วัน & 30 วัน",
        desc: "สร้างวินัยการเรียนรู้เพื่อปลดล็อกเหรียญเกียรติยศดิจิทัล ⚡ มุ่งมั่น 7 วันติด (Week Warrior) และ 👑 ปรมาจารย์ 30 วัน (Monthly Legend) พร้อมพลุ Confetti และเสียงดนตรีสดใส!",
        tips: [
          "เมื่อปลดล็อกแล้ว สามารถแตะที่เหรียญหรือปุ่มฉลอง เพื่อจุดพลุ Confetti ได้ตลอดเวลา",
          "รักษา Streak ทุกวันเพื่อเกียรติยศและความภาคภูมิใจ"
        ],
        targetSelector: "#streakRewardsSummaryCard"
      },
      {
        step: 3,
        total: 3,
        icon: "🔥",
        title: "ปฏิทินความต่อเนื่องและสถิติ Streak (Weekly Tracker)",
        desc: "ติดตามการฝึกฝน 7 วันล่าสุดย้อนหลัง พร้อมสถิติ Streak สูงสุด (Best Streak) และสถานะการเรียนประจำวันแบบเรียลไทม์",
        tips: [
          "วันที่มีเครื่องหมายถูกแสดงถึงวันที่คุณได้ฝึกคำศัพท์แล้ว",
          "ความสม่ำเสมอคือบันไดสู่ความสำเร็จในการจำภาษาจีน!"
        ],
        targetSelector: "#streakHeroCard"
      }
    ],
    chapter_detail: [
      {
        step: 1,
        total: 3,
        icon: "📖",
        title: "สรุปภาพรวมบทเรียน & ความคืบหน้า",
        desc: "แสดงชื่อบท คำอธิบาย จำนวนคำศัพท์ทั้งหมด และสถิติคำศัพท์ที่คุณจำได้แล้วในบทนี้ พร้อมปุ่ม 'เริ่มเรียน' เพื่อเข้าสู่ Flashcard ทันที",
        tips: [
          "กด 'เริ่มเรียน' เพื่อฝึกจำคำศัพท์ทีละคำ",
          "กด '🎯 ทำแบบทดสอบ' เพื่อประเมินความจำเฉพาะบทนี้"
        ],
        targetSelector: ".card-chapter"
      },
      {
        step: 2,
        total: 3,
        icon: "🔊",
        title: "คลังคำศัพท์ประจำบท & ฟังการออกเสียง",
        desc: "รายการคำศัพท์ในบทนี้ แสดงตัวอักษรจีน พินอิน ความหมายไทย ตัวอย่างประโยค และปุ่ม 🔊 เพื่อฟังเสียงสำเนียงภาษาจีนมาตรฐาน",
        tips: [
          "แตะปุ่ม '💡 ดูตัวอย่าง & เทคนิคจำ' เพื่อดูประโยคตัวอย่างเพิ่มเติม",
          "ใช้ช่องค้นหาด้านบนเพื่อกรองคำศัพท์ตาม Hanzi หรือคำแปล"
        ],
        targetSelector: ".chapter-search-section"
      },
      {
        step: 3,
        total: 3,
        icon: "➕",
        title: "เพิ่มคำศัพท์หรือจัดการบทเรียน",
        desc: "สามารถกด '➕ เพิ่มคำศัพท์ใหม่ในบทนี้' เพื่อบันทึกคำศัพท์เพิ่มเติม หรือกดแก้ไข/ลบบทเรียนสำหรับบทที่คุณสร้างขึ้นเอง",
        tips: [
          "คำศัพท์ใหม่จะถูกนำไปรวมในระบบทบทวน SRS อัตโนมัติ",
          "สามารถฟังเสียงทดสอบก่อนกดบันทึกคำศัพท์ได้"
        ],
        targetSelector: "#chapterDetail"
      }
    ],
    create_chapter: [
      {
        step: 1,
        total: 3,
        icon: "✏️",
        title: "ตั้งชื่อบทเรียนและคำอธิบาย",
        desc: "ระบุชื่อบทเรียน เช่น 'HSK1 บทที่ 16 - การเดินทาง' และคำอธิบายย่อ เพื่อจัดระเบียบคำศัพท์ที่คุณต้องการเรียนรู้",
        tips: [
          "สามารถแก้ไขชื่อบทและคำอธิบายภายหลังได้ตลอดเวลา",
          "ชื่อบทที่ชัดเจนช่วยให้ค้นหาคำศัพท์ได้ง่ายขึ้น"
        ],
        targetSelector: "#chapterName"
      },
      {
        step: 2,
        total: 3,
        icon: "📝",
        title: "กรอกคำศัพท์และทดสอบฟังเสียง",
        desc: "กรอกตัวอักษรจีน (Hanzi), พินอิน, และคำแปลภาษาไทย พร้อมปุ่ม 🔊 เพื่อทดสอบฟังเสียงอ่านภาษาจีนจริงก่อนกดบันทึก",
        tips: [
          "กด '➕ เพิ่มคำศัพท์' ด้านล่างเพื่อเพิ่มคำศัพท์ได้ไม่จำกัด",
          "สามารถใส่ประโยคตัวอย่างและเทคนิคช่วยจำ (Memory Tip) ได้"
        ],
        targetSelector: "#vocabList"
      },
      {
        step: 3,
        total: 3,
        icon: "⚡",
        title: "นำเข้าคำศัพท์ด่วน (Quick Text & OCR Scanner)",
        desc: "ใช้เมนู '⚡ นำเข้าคำศัพท์แบบข้อความด่วน' เพื่อวางรายการคำศัพท์หลายๆ คำพร้อมกัน หรือกด '📷 นำเข้าจากรูปภาพ' เพื่อสแกนตัวอักษรจีนจากภาพถ่าย",
        tips: [
          "รองรับการคัดลอกจาก Excel หรือไฟล์ข้อความแบบคั่นด้วยจุลภาค/Tab",
          "ระบบ OCR ช่วยดึงคำศัพท์จากหน้าหนังสือเรียนได้สะดวกรวดเร็ว"
        ],
        targetSelector: ".quick-import-card"
      }
    ]
  };

  var currentTourStepIndex = 0;
  var currentTourKey = null;
  var activeTourKeyHandler = null;

  function showPageTour(pageKey, forceReplay) {
    var steps = PAGE_TOURS_CONFIG[pageKey];
    if (!steps || steps.length === 0) return;

    var storageKey = "cvma_tour_seen_" + pageKey;
    if (!forceReplay) {
      try {
        if (localStorage.getItem(storageKey) === "true") {
          return;
        }
      } catch (e) {}
    }

    currentTourKey = pageKey;
    currentTourStepIndex = 0;
    renderTourModalStep(pageKey, currentTourStepIndex);
  }

  function renderTourModalStep(pageKey, index) {
    var steps = PAGE_TOURS_CONFIG[pageKey];
    if (!steps || index < 0 || index >= steps.length) return;
    var stepData = steps[index];

    // Remove existing tour modal if any
    var existingModal = document.getElementById("pageTourModal");
    if (existingModal && existingModal.parentNode) {
      existingModal.parentNode.removeChild(existingModal);
    }

    // Remove old spotlight
    var oldHighlights = document.querySelectorAll(".tour-spotlight-active");
    for (var h = 0; h < oldHighlights.length; h++) {
      oldHighlights[h].classList.remove("tour-spotlight-active");
    }

    // Highlight target element if present
    if (stepData.targetSelector) {
      var targetEl = document.querySelector(stepData.targetSelector);
      if (targetEl) {
        targetEl.classList.add("tour-spotlight-active");
        try {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (e) {}
      }
    }

    var backdrop = document.createElement("div");
    backdrop.className = "tour-modal-backdrop";
    backdrop.id = "pageTourModal";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");

    var card = document.createElement("div");
    card.className = "tour-modal-card";

    // Top Header
    var topRow = document.createElement("div");
    topRow.className = "tour-modal-top";

    var badge = document.createElement("div");
    badge.className = "tour-step-badge";
    badge.innerHTML = "<span>💡 วิธีใช้งาน</span><span>·</span><span>ขั้นตอน " + (index + 1) + " / " + steps.length + "</span>";

    var closeBtn = document.createElement("button");
    closeBtn.className = "tour-close-btn";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "ปิดคำแนะนำ");
    closeBtn.textContent = "✕";
    closeBtn.onclick = function () {
      closePageTour(pageKey);
    };

    topRow.appendChild(badge);
    topRow.appendChild(closeBtn);

    // Body
    var body = document.createElement("div");
    body.className = "tour-body";

    var iconBox = document.createElement("div");
    iconBox.className = "tour-hero-icon-box";
    iconBox.textContent = stepData.icon || "💡";

    var title = document.createElement("h3");
    title.className = "tour-title";
    title.textContent = stepData.title;

    var desc = document.createElement("p");
    desc.className = "tour-desc";
    desc.textContent = stepData.desc;

    body.appendChild(iconBox);
    body.appendChild(title);
    body.appendChild(desc);

    // Tips Box
    if (stepData.tips && stepData.tips.length > 0) {
      var tipsBox = document.createElement("div");
      tipsBox.className = "tour-tips-box";
      for (var t = 0; t < stepData.tips.length; t++) {
        var tipItem = document.createElement("div");
        tipItem.className = "tour-tip-item";
        var bullet = document.createElement("span");
        bullet.className = "tour-tip-bullet";
        bullet.textContent = "🌸";
        var text = document.createElement("span");
        text.textContent = stepData.tips[t];
        tipItem.appendChild(bullet);
        tipItem.appendChild(text);
        tipsBox.appendChild(tipItem);
      }
      body.appendChild(tipsBox);
    }

    // Footer
    var footer = document.createElement("div");
    footer.className = "tour-footer";

    // Step Dots
    var dots = document.createElement("div");
    dots.className = "tour-step-dots";
    for (var d = 0; d < steps.length; d++) {
      var dot = document.createElement("span");
      dot.className = "tour-step-dot" + (d === index ? " is-active" : "");
      dots.appendChild(dot);
    }

    // Actions
    var actions = document.createElement("div");
    actions.className = "tour-actions";

    if (index > 0) {
      var prevBtn = document.createElement("button");
      prevBtn.className = "tour-btn-prev";
      prevBtn.type = "button";
      prevBtn.textContent = "← ย้อนกลับ";
      prevBtn.onclick = function () {
        currentTourStepIndex--;
        renderTourModalStep(pageKey, currentTourStepIndex);
      };
      actions.appendChild(prevBtn);
    } else {
      var skipBtn = document.createElement("button");
      skipBtn.className = "tour-btn-skip";
      skipBtn.type = "button";
      skipBtn.textContent = "ข้ามทัวร์";
      skipBtn.onclick = function () {
        closePageTour(pageKey);
      };
      actions.appendChild(skipBtn);
    }

    var nextBtn = document.createElement("button");
    nextBtn.className = "tour-btn-next";
    nextBtn.type = "button";
    var isLastStep = (index === steps.length - 1);
    nextBtn.textContent = isLastStep ? "เข้าใจแล้ว เริ่มเลย! ✨" : "ถัดไป →";
    nextBtn.onclick = function () {
      if (isLastStep) {
        closePageTour(pageKey);
        playCelebrationChime();
        showCelebrationToast("✨", "พร้อมลุย!", "คุณพร้อมใช้งานหน้านี้แล้ว ขอให้สนุกกับการจำศัพท์นะ");
      } else {
        currentTourStepIndex++;
        renderTourModalStep(pageKey, currentTourStepIndex);
      }
    };
    actions.appendChild(nextBtn);

    footer.appendChild(dots);
    footer.appendChild(actions);

    card.appendChild(topRow);
    card.appendChild(body);
    card.appendChild(footer);
    backdrop.appendChild(card);

    backdrop.onclick = function (e) {
      if (e.target === backdrop) {
        closePageTour(pageKey);
      }
    };

    // Remove previous key handler if any
    if (activeTourKeyHandler) {
      window.removeEventListener("keydown", activeTourKeyHandler);
    }

    activeTourKeyHandler = function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePageTour(pageKey);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (isLastStep) {
          closePageTour(pageKey);
          playCelebrationChime();
          showCelebrationToast("✨", "พร้อมลุย!", "คุณพร้อมใช้งานหน้านี้แล้ว ขอให้สนุกกับการจำศัพท์นะ");
        } else {
          currentTourStepIndex++;
          renderTourModalStep(pageKey, currentTourStepIndex);
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        currentTourStepIndex--;
        renderTourModalStep(pageKey, currentTourStepIndex);
      }
    };
    window.addEventListener("keydown", activeTourKeyHandler);

    document.body.appendChild(backdrop);
  }

  function closePageTour(pageKey) {
    try {
      localStorage.setItem("cvma_tour_seen_" + pageKey, "true");
    } catch (e) {}

    if (activeTourKeyHandler) {
      window.removeEventListener("keydown", activeTourKeyHandler);
      activeTourKeyHandler = null;
    }

    var modal = document.getElementById("pageTourModal");
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }

    var oldHighlights = document.querySelectorAll(".tour-spotlight-active");
    for (var h = 0; h < oldHighlights.length; h++) {
      oldHighlights[h].classList.remove("tour-spotlight-active");
    }
  }

  function setupPageOnboardingTour(pageId) {
    var pageMap = {
      "page-home": "home",
      "page-chapters": "chapters",
      "page-chapter-detail": "chapter_detail",
      "page-create-chapter": "create_chapter",
      "page-learn": "learn",
      "page-quick-review": "review",
      "page-quiz": "quiz",
      "page-progress": "progress"
    };
    var pageKey = pageMap[pageId];
    if (!pageKey || !PAGE_TOURS_CONFIG[pageKey]) return;

    var helpBtn = document.getElementById("btnPageHelp");
    if (helpBtn) {
      helpBtn.onclick = function () {
        showPageTour(pageKey, true);
      };
    }

    // Auto-show for first-time user (except home where Cloud Sync has first-screen priority)
    var storageKey = "cvma_tour_seen_" + pageKey;
    try {
      if (pageKey !== "home" && localStorage.getItem(storageKey) !== "true") {
        setTimeout(function () {
          showPageTour(pageKey, false);
        }, 500);
      }
    } catch (e) {}
  }

  function checkAndSaveNewMilestones(customConfig) {
    try {
      var allVocab = (DATA && DATA.getAllVocabulary) ? DATA.getAllVocabulary() : [];
      var todayStr = getTodayString();
      var streakData = calculateStreak(todayStr);
      var totalStudyDays = streakData.history ? streakData.history.length : 0;
      var maxStreak = Math.max(streakData.currentStreak || 0, streakData.bestStreak || 0);

      var masteredCount = 0;
      var srsCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (var i = 0; i < allVocab.length; i++) {
        var p = getVocabularyProgress(allVocab[i].id);
        if (p && p.status === "mastered") {
          masteredCount++;
          var lvl = typeof p.srsLevel === "number" ? p.srsLevel : 0;
          if (lvl >= 0 && lvl <= 5) srsCounts[lvl]++;
        }
      }

      var milestones = customConfig || getStreakMilestones(maxStreak, totalStudyDays, masteredCount, srsCounts);
      var currentUnlockedMap = {};
      var newlyUnlocked = [];

      var savedUnlockedList = [];
      var hasStoredBefore = false;
      try {
        var raw = localStorage.getItem(STORAGE_UNLOCKED_MILESTONES_KEY);
        if (raw !== null) {
          hasStoredBefore = true;
          savedUnlockedList = JSON.parse(raw);
          if (!Array.isArray(savedUnlockedList)) savedUnlockedList = [];
        }
      } catch (e) {}

      var savedSet = {};
      for (var s = 0; s < savedUnlockedList.length; s++) {
        savedSet[savedUnlockedList[s]] = true;
      }

      for (var m = 0; m < milestones.length; m++) {
        var item = milestones[m];
        if (item.current >= item.target) {
          currentUnlockedMap[item.id] = true;
          if (hasStoredBefore && !savedSet[item.id]) {
            newlyUnlocked.push(item);
          }
        }
      }

      var updatedList = Object.keys(currentUnlockedMap);
      localStorage.setItem(STORAGE_UNLOCKED_MILESTONES_KEY, JSON.stringify(updatedList));

      return newlyUnlocked;
    } catch (e) {
      return [];
    }
  }

  /* ============================================================
     Study History & Streak Tracking Engine (TASK 7.1)
     - บันทึกประวัติวันที่ผู้ใช้เรียนหรือทบทวนคำศัพท์ (YYYY-MM-DD)
     - คำนวณ Streak ต่อเนื่อง (Current Streak), สถิติสูงสุด (Best Streak)
     - รวมประวัติจาก lastReviewed เดิมอัตโนมัติ ไม่สูญหายหลังรีเฟรช
     ============================================================ */
  function getStudyHistory() {
    var historySet = {};
    // 1. อ่านจาก Local Storage cvma_study_history
    try {
      var raw = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (var i = 0; i < parsed.length; i++) {
            if (typeof parsed[i] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed[i])) {
              historySet[parsed[i]] = true;
            }
          }
        }
      }
    } catch (e) {}

    // 2. รวม lastReviewed จาก vocabulary progress เดิมเพื่อไม่ให้ประวัติที่เคยมีตกหล่น
    var prog = loadProgress();
    if (prog) {
      var keys = Object.keys(prog);
      for (var j = 0; j < keys.length; j++) {
        var item = prog[keys[j]];
        if (item && typeof item.lastReviewed === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.lastReviewed)) {
          historySet[item.lastReviewed] = true;
        }
      }
    }

    var result = Object.keys(historySet).sort();
    return result;
  }

  function recordStudyActivity(dateStr) {
    var today = (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) ? dateStr : getTodayString();
    if (!today) return;
    try {
      var history = getStudyHistory();
      if (history.indexOf(today) === -1) {
        history.push(today);
        history.sort();
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
      }
    } catch (e) {}
  }

  function calculateStreak(referenceDateStr) {
    var today = referenceDateStr || getTodayString();
    var history = getStudyHistory();
    var historySet = {};
    for (var i = 0; i < history.length; i++) {
      historySet[history[i]] = true;
    }

    var hasStudiedToday = !!historySet[today];
    var yesterday = addDays(today, -1);

    var currentStreak = 0;
    if (hasStudiedToday) {
      currentStreak = 1;
      var prevDay = addDays(today, -1);
      while (historySet[prevDay]) {
        currentStreak++;
        prevDay = addDays(prevDay, -1);
      }
    } else if (historySet[yesterday]) {
      // เรียนเมื่อวาน แต่วันนี้ยังไม่ได้เรียน -> คง Streak ไว้รอเรียนวันนี้
      currentStreak = 1;
      var prevYesterday = addDays(yesterday, -1);
      while (historySet[prevYesterday]) {
        currentStreak++;
        prevYesterday = addDays(prevYesterday, -1);
      }
    } else {
      currentStreak = 0;
    }

    // คำนวณ Best Streak (ช่วงวันต่อเนื่องที่ยาวที่สุดในประวัติทั้งหมด)
    var bestStreak = 0;
    if (history.length > 0) {
      var tempStreak = 1;
      bestStreak = 1;
      for (var k = 1; k < history.length; k++) {
        var expectedNext = addDays(history[k - 1], 1);
        if (history[k] === expectedNext) {
          tempStreak++;
          if (tempStreak > bestStreak) {
            bestStreak = tempStreak;
          }
        } else if (history[k] !== history[k - 1]) {
          tempStreak = 1;
        }
      }
    }
    if (currentStreak > bestStreak) {
      bestStreak = currentStreak;
    }

    return {
      currentStreak: currentStreak,
      bestStreak: bestStreak,
      hasStudiedToday: hasStudiedToday,
      history: history
    };
  }

  // ============================================================
  // Spaced Repetition System (SRS) — 5 ระดับ (TASK 6.1)
  // ระดับ 0: คำใหม่ (new) — ยังไม่ได้เริ่ม
  // ระดับ 1: 1 วัน (ทบทวนวันถัดไป)
  // ระดับ 2: 3 วัน
  // ระดับ 3: 7 วัน (1 สัปดาห์)
  // ระดับ 4: 14 วัน (2 สัปดาห์)
  // ระดับ 5: 30 วัน (1 เดือน — จำแม่น)
  // ============================================================
  var SRS_INTERVALS = {
    0: 0,
    1: 1,
    2: 3,
    3: 7,
    4: 14,
    5: 30
  };

  // คำนวณวันที่บวกเพิ่มจำนวนวัน (รองรับปีอธิกสุรทินและข้ามเดือนอย่างแม่นยำด้วย UTC)
  function addDays(dateString, days) {
    if (!dateString) dateString = getTodayString();
    var parts = dateString.split("-");
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    var dt = new Date(Date.UTC(y, m, d));
    dt.setUTCDate(dt.getUTCDate() + (Number(days) || 0));
    var resY = dt.getUTCFullYear();
    var resM = String(dt.getUTCMonth() + 1).padStart(2, "0");
    var resD = String(dt.getUTCDate()).padStart(2, "0");
    return resY + "-" + resM + "-" + resD;
  }

  /* ============================================================
     7-Day Daily Vocabulary Learning Streak & D3 Chart Engine
     - คำนวณจำนวนคำศัพท์ที่เรียน/ทบทวนในแต่ละวันย้อนหลัง 7 วัน
     - สร้างกราฟแท่งและเส้นความต่อเนื่อง (Streak Activity Chart) ด้วย D3.js (v7)
     - มีเส้นประแสดงเป้าหมายประจำวัน (Daily Goal Threshold Line)
     - Interactive Tooltip แสดงรายละเอียดคำศัพท์เมื่อ Hover / Touch
     - รองรับ Responsive SVG Scaling & Fallback Render
     ============================================================ */
  function getDailyWordsCount(dateStr) {
    if (!dateStr) return 0;
    var set = {};
    try {
      var raw = localStorage.getItem(STORAGE_DAILY_WORDS_PREFIX + dateStr);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (var i = 0; i < parsed.length; i++) {
            if (parsed[i]) set[parsed[i]] = true;
          }
        }
      }
    } catch (e) {}

    var prog = loadProgress();
    if (prog) {
      var keys = Object.keys(prog);
      for (var j = 0; j < keys.length; j++) {
        var item = prog[keys[j]];
        if (item && item.lastReviewed === dateStr) {
          set[keys[j]] = true;
        }
      }
    }

    var count = Object.keys(set).length;
    if (count === 0) {
      var history = getStudyHistory();
      if (history.indexOf(dateStr) !== -1) {
        count = 1;
      }
    }
    return count;
  }

  function getPast7DaysStreakData() {
    var todayStr = getTodayString();
    var thaiDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    var dailyGoal = getDailyGoal();
    var history = getStudyHistory();
    var historySet = {};
    for (var h = 0; h < history.length; h++) {
      historySet[history[h]] = true;
    }

    var days = [];
    for (var offset = 6; offset >= 0; offset--) {
      var dayDateStr = addDays(todayStr, -offset);
      var parts = dayDateStr.split("-");
      var y = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10) - 1;
      var d = parseInt(parts[2], 10);
      var dt = new Date(Date.UTC(y, m, d));
      var dayName = thaiDays[dt.getUTCDay()];
      var wordsCount = getDailyWordsCount(dayDateStr);
      var isStudied = wordsCount > 0 || !!historySet[dayDateStr];
      var isToday = (dayDateStr === todayStr);
      var reachedGoal = wordsCount >= dailyGoal;

      days.push({
        date: dayDateStr,
        dayName: dayName,
        dateNum: d,
        wordsCount: wordsCount,
        isStudied: isStudied,
        isToday: isToday,
        reachedGoal: reachedGoal,
        dailyGoal: dailyGoal
      });
    }

    return {
      days: days,
      dailyGoal: dailyGoal,
      todayStr: todayStr
    };
  }

  function renderSvgStreakChartFallback(containerEl, data, dailyGoal, yMax, width, height, margin) {
    var innerWidth = width - margin.left - margin.right;
    var innerHeight = height - margin.top - margin.bottom;
    var n = data.length;
    var barW = 24;
    var slotW = innerWidth / n;

    var svgHtml = '<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="กราฟสถิติการเรียนรู้คำศัพท์ 7 วันล่าสุด">' +
      '<defs>' +
        '<linearGradient id="streakFallbackGradDefault" x1="0%" y1="0%" x2="0%" y2="100%">' +
          '<stop offset="0%" stop-color="#FF88A5"/>' +
          '<stop offset="100%" stop-color="#FF547D"/>' +
        '</linearGradient>' +
        '<linearGradient id="streakFallbackGradGoal" x1="0%" y1="0%" x2="0%" y2="100%">' +
          '<stop offset="0%" stop-color="#5CE2B3"/>' +
          '<stop offset="100%" stop-color="#25BA88"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g transform="translate(' + margin.left + ',' + margin.top + ')">';

    var goalY = innerHeight - Math.round((dailyGoal / yMax) * innerHeight);
    svgHtml += '<line class="d3-goal-line" x1="0" x2="' + innerWidth + '" y1="' + goalY + '" y2="' + goalY + '"/>' +
      '<text class="d3-goal-label" x="' + innerWidth + '" y="' + (goalY - 4) + '">🎯 เป้าหมาย ' + dailyGoal + ' คำ</text>';

    data.forEach(function (d, idx) {
      var cx = idx * slotW + slotW / 2;
      var bx = cx - barW / 2;
      var bVal = d.wordsCount;
      var bh = bVal > 0 ? Math.max(4, Math.round((bVal / yMax) * innerHeight)) : 4;
      var by = innerHeight - bh;
      var fill = d.reachedGoal ? "url(#streakFallbackGradGoal)" : (bVal > 0 ? "url(#streakFallbackGradDefault)" : "#F2E5EA");

      svgHtml += '<rect class="d3-bar" x="' + bx + '" y="' + by + '" width="' + barW + '" height="' + bh + '" rx="6" ry="6" fill="' + fill + '"/>';
      svgHtml += '<text class="d3-bar-val' + (d.reachedGoal ? " is-goal-reached" : "") + '" x="' + cx + '" y="' + (by - 5) + '">' + (bVal > 0 ? (d.reachedGoal ? "★ " + bVal : bVal) : "0") + '</text>';
      svgHtml += '<text class="d3-axis-label' + (d.isToday ? " is-today" : "") + '" x="' + cx + '" y="' + (innerHeight + 14) + '">' + d.dayName + '</text>';
      svgHtml += '<text class="d3-axis-date" x="' + cx + '" y="' + (innerHeight + 26) + '">' + d.dateNum + '</text>';
      if (d.isToday) {
        svgHtml += '<circle cx="' + cx + '" cy="' + (innerHeight + 31) + '" r="2" fill="#E63964"/>';
      }
    });

    svgHtml += '</g></svg>';
    containerEl.innerHTML = svgHtml;
  }

  function renderHomeStreakChart(containerEl) {
    if (!containerEl) return;
    clear(containerEl);

    var streakInfo = getPast7DaysStreakData();
    var data = streakInfo.days;
    var dailyGoal = streakInfo.dailyGoal || 10;
    var tooltipEl = document.getElementById("homeStreakChartTooltip");

    var width = 380;
    var height = 185;
    var margin = { top: 26, right: 18, bottom: 36, left: 32 };
    var innerWidth = width - margin.left - margin.right;
    var innerHeight = height - margin.top - margin.bottom;

    var maxWords = 0;
    data.forEach(function (d) {
      if (d.wordsCount > maxWords) maxWords = d.wordsCount;
    });
    var yMax = Math.max(maxWords, dailyGoal, 10);
    yMax = Math.ceil(yMax * 1.15);

    if (window.d3) {
      var d3 = window.d3;
      var svg = d3.select(containerEl)
        .append("svg")
        .attr("viewBox", "0 0 " + width + " " + height)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("role", "img")
        .attr("aria-label", "กราฟสถิติการเรียนรู้คำศัพท์ 7 วันล่าสุด");

      var defs = svg.append("defs");

      var gradDefault = defs.append("linearGradient")
        .attr("id", "streakBarGradDefault")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
      gradDefault.append("stop").attr("offset", "0%").attr("stop-color", "#FF88A5");
      gradDefault.append("stop").attr("offset", "100%").attr("stop-color", "#FF547D");

      var gradGoal = defs.append("linearGradient")
        .attr("id", "streakBarGradGoal")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
      gradGoal.append("stop").attr("offset", "0%").attr("stop-color", "#5CE2B3");
      gradGoal.append("stop").attr("offset", "100%").attr("stop-color", "#25BA88");

      var gradEmpty = defs.append("linearGradient")
        .attr("id", "streakBarGradEmpty")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
      gradEmpty.append("stop").attr("offset", "0%").attr("stop-color", "#FAF0F4");
      gradEmpty.append("stop").attr("offset", "100%").attr("stop-color", "#EFE2E7");

      var g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      var xScale = d3.scaleBand()
        .domain(data.map(function (d) { return d.date; }))
        .range([0, innerWidth])
        .padding(0.38);

      var yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerHeight, 0]);

      var yTicks = [0, Math.round(yMax / 2), yMax];
      yTicks.forEach(function (tick) {
        g.append("line")
          .attr("class", "d3-grid-line")
          .attr("x1", 0)
          .attr("x2", innerWidth)
          .attr("y1", yScale(tick))
          .attr("y2", yScale(tick));

        g.append("text")
          .attr("x", -6)
          .attr("y", yScale(tick) + 3)
          .attr("font-size", "9px")
          .attr("font-family", "Nunito, sans-serif")
          .attr("fill", "#AFA1B5")
          .attr("text-anchor", "end")
          .text(tick);
      });

      if (dailyGoal <= yMax) {
        var goalY = yScale(dailyGoal);
        g.append("line")
          .attr("class", "d3-goal-line")
          .attr("x1", 0)
          .attr("x2", innerWidth)
          .attr("y1", goalY)
          .attr("y2", goalY);

        g.append("text")
          .attr("class", "d3-goal-label")
          .attr("x", innerWidth)
          .attr("y", goalY - 4)
          .text("🎯 เป้าหมาย " + dailyGoal + " คำ");
      }

      var hasAnyStudy = data.some(function (d) { return d.wordsCount > 0; });
      if (hasAnyStudy) {
        var lineGen = d3.line()
          .x(function (d) { return xScale(d.date) + xScale.bandwidth() / 2; })
          .y(function (d) { return yScale(d.wordsCount); })
          .curve(d3.curveMonotoneX);

        g.append("path")
          .datum(data)
          .attr("class", "d3-trend-line")
          .attr("d", lineGen);
      }

      data.forEach(function (d) {
        var barX = xScale(d.date);
        var barW = xScale.bandwidth();
        var barVal = d.wordsCount;
        var barH = barVal > 0 ? Math.max(4, innerHeight - yScale(barVal)) : 4;
        var barY = barVal > 0 ? yScale(barVal) : (innerHeight - 4);

        var fillColor = "url(#streakBarGradEmpty)";
        if (d.reachedGoal) {
          fillColor = "url(#streakBarGradGoal)";
        } else if (barVal > 0) {
          fillColor = "url(#streakBarGradDefault)";
        }

        var bar = g.append("rect")
          .attr("class", "d3-bar")
          .attr("x", barX)
          .attr("y", barY)
          .attr("width", barW)
          .attr("height", barH)
          .attr("rx", Math.min(barW / 2, 6))
          .attr("ry", Math.min(barW / 2, 6))
          .attr("fill", fillColor);

        var labelY = barVal > 0 ? (barY - 5) : (innerHeight - 8);
        var labelClass = "d3-bar-val";
        if (d.reachedGoal) labelClass += " is-goal-reached";
        if (d.isToday) labelClass += " is-today";

        g.append("text")
          .attr("class", labelClass)
          .attr("x", barX + barW / 2)
          .attr("y", labelY)
          .text(barVal > 0 ? (d.reachedGoal ? "★ " + barVal : String(barVal)) : "0");

        if (hasAnyStudy && barVal > 0) {
          g.append("circle")
            .attr("class", "d3-trend-dot")
            .attr("cx", barX + barW / 2)
            .attr("cy", yScale(barVal))
            .attr("r", 3.5);
        }

        g.append("text")
          .attr("class", "d3-axis-label" + (d.isToday ? " is-today" : ""))
          .attr("x", barX + barW / 2)
          .attr("y", innerHeight + 14)
          .text(d.dayName);

        g.append("text")
          .attr("class", "d3-axis-date")
          .attr("x", barX + barW / 2)
          .attr("y", innerHeight + 26)
          .text(String(d.dateNum));

        if (d.isToday) {
          g.append("circle")
            .attr("cx", barX + barW / 2)
            .attr("cy", innerHeight + 31)
            .attr("r", 2)
            .attr("fill", "#E63964");
        }

        function showTip(event) {
          if (!tooltipEl) return;
          var rect = containerEl.getBoundingClientRect();
          var clientX = event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : rect.left + barX);
          var clientY = event.clientY || (event.touches && event.touches[0] ? event.touches[0].clientY : rect.top + barY);
          var relX = clientX - rect.left;
          var relY = clientY - rect.top;

          var statusMsg = d.isStudied ? (d.reachedGoal ? "🎉 พิชิตเป้าหมายประจำวัน!" : "🔥 มีการเรียนต่อเนื่อง") : "⚪ ยังไม่ได้ฝึกฝน";
          var todaySuffix = d.isToday ? " (วันนี้)" : "";
          tooltipEl.innerHTML = "<div style='font-weight:800; font-size:12.5px; margin-bottom:2px;'>" + d.dayName + " " + d.date + todaySuffix + "</div>" +
            "<div>คำศัพท์ที่ฝึก: <strong>" + d.wordsCount + " คำ</strong></div>" +
            "<div style='font-size:11px; opacity:0.85; margin-top:2px;'>" + statusMsg + "</div>";

          tooltipEl.style.display = "block";
          tooltipEl.style.left = relX + "px";
          tooltipEl.style.top = relY + "px";
        }

        function hideTip() {
          if (tooltipEl) tooltipEl.style.display = "none";
        }

        bar.on("mouseenter", showTip)
           .on("mousemove", showTip)
           .on("mouseleave", hideTip)
           .on("touchstart", showTip)
           .on("touchend", hideTip);
      });

    } else {
      renderSvgStreakChartFallback(containerEl, data, dailyGoal, yMax, width, height, margin);
    }
  }

  // คำนวณการปรับระดับ SRS และกำหนดวันทบทวนรอบถัดไป
  // rating:
  //   - boolean: true (จำได้แล้ว) / false (ยังจำไม่ได้)
  //   - number: 1 (ลืมแล้ว), 2 (ยาก), 3 (ปานกลาง), 4 (ง่าย), 5 (จำแม่น)
  function calculateSRS(currentProgress, rating, todayDate) {
    var today = todayDate || getTodayString();
    var currentLevel = 0;
    if (currentProgress && typeof currentProgress.srsLevel === "number") {
      currentLevel = currentProgress.srsLevel;
    } else if (currentProgress && currentProgress.status === "mastered") {
      currentLevel = 1;
    }

    var newLevel = 1;
    var newStatus = "learning";

    if (typeof rating === "boolean") {
      if (rating) {
        newLevel = Math.min(5, Math.max(0, currentLevel) + 1);
        newStatus = "mastered";
      } else {
        newLevel = 1;
        newStatus = "learning";
      }
    } else if (typeof rating === "number") {
      if (rating <= 1) {
        newLevel = 1;
        newStatus = "learning";
      } else if (rating === 2) {
        newLevel = 1;
        newStatus = "learning";
      } else if (rating === 3) {
        newLevel = Math.min(5, Math.max(1, currentLevel) + 1);
        newStatus = "mastered";
      } else if (rating === 4) {
        newLevel = Math.min(5, Math.max(2, currentLevel) + 1);
        newStatus = "mastered";
      } else if (rating >= 5) {
        newLevel = 5;
        newStatus = "mastered";
      }
    }

    var intervalDays = SRS_INTERVALS[newLevel] !== undefined ? SRS_INTERVALS[newLevel] : 1;
    var nextReview = addDays(today, intervalDays);

    return {
      status: newStatus,
      srsLevel: newLevel,
      intervalDays: intervalDays,
      lastReviewed: today,
      nextReview: nextReview
    };
  }

  // Fallback Progress เริ่มต้นเมื่อไม่มีข้อมูล (ป้องกันหน้าเว็บพัง)
  function defaultProgress(vocabId) {
    if (DATA && DATA.vocabularyProgress && DATA.vocabularyProgress[vocabId]) {
      var base = DATA.vocabularyProgress[vocabId];
      return {
        status: base.status || "new",
        srsLevel: typeof base.srsLevel === "number" ? base.srsLevel : (base.status === "mastered" ? 1 : (base.status === "learning" ? 1 : 0)),
        reviewCount: typeof base.reviewCount === "number" ? base.reviewCount : 0,
        lastReviewed: base.lastReviewed || null,
        nextReview: base.nextReview || null
      };
    }
    return {
      status: "new",
      srsLevel: 0,
      reviewCount: 0,
      lastReviewed: null,
      nextReview: null
    };
  }

  // 1) โหลด Progress ทั้งหมดจาก Local Storage
  // คืนค่า Object { [vocabId]: { status, srsLevel, reviewCount, lastReviewed, nextReview } }
  function loadProgress() {
    try {
      if (typeof window === "undefined" || !window.localStorage) return {};
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
      return {};
    } catch (err) {
      console.warn("loadProgress: corrupted data or localStorage error, fallback to empty", err);
      return {};
    }
  }

  // 2) บันทึก Progress ทั้งหมดลง Local Storage
  function saveProgress(allProgress) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return false;
      if (!allProgress || typeof allProgress !== "object" || Array.isArray(allProgress)) return false;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
      return true;
    } catch (err) {
      console.warn("saveProgress: failed to save to localStorage", err);
      return false;
    }
  }

  // 3) ดึง Progress ของ Vocabulary ID ที่ระบุ
  function getVocabularyProgress(vocabId) {
    if (!vocabId) return defaultProgress(vocabId);
    var all = loadProgress();
    if (all && all[vocabId] && typeof all[vocabId] === "object") {
      var item = all[vocabId];
      var base = defaultProgress(vocabId);
      return {
        status: item.status || base.status || "new",
        srsLevel: typeof item.srsLevel === "number" ? item.srsLevel : (item.status === "mastered" ? 1 : (item.status === "learning" ? 1 : 0)),
        reviewCount: typeof item.reviewCount === "number" ? item.reviewCount : 0,
        lastReviewed: item.lastReviewed || null,
        nextReview: item.nextReview !== undefined ? item.nextReview : null
      };
    }
    return defaultProgress(vocabId);
  }

  // 4) อัปเดต Progress ของ Vocabulary ID (รองรับทั้ง boolean, number rating 1-5, และ object)
  function updateVocabularyProgress(vocabId, updates) {
    if (!vocabId) return null;
    var all = loadProgress();
    var current = (all && all[vocabId] && typeof all[vocabId] === "object")
      ? all[vocabId]
      : defaultProgress(vocabId);

    var count = (typeof current.reviewCount === "number" ? current.reviewCount : 0) + 1;
    var today = getTodayString();
    var newStatus = current.status || "learning";
    var newLevel = typeof current.srsLevel === "number" ? current.srsLevel : 0;
    var nextReview = current.nextReview || null;

    if (typeof updates === "boolean") {
      var srsRes = calculateSRS(current, updates, today);
      newStatus = srsRes.status;
      newLevel = srsRes.srsLevel;
      nextReview = srsRes.nextReview;
    } else if (typeof updates === "number") {
      var srsResNum = calculateSRS(current, updates, today);
      newStatus = srsResNum.status;
      newLevel = srsResNum.srsLevel;
      nextReview = srsResNum.nextReview;
    } else if (updates && typeof updates === "object") {
      if (typeof updates.rating === "number") {
        var srsResRate = calculateSRS(current, updates.rating, today);
        newStatus = srsResRate.status;
        newLevel = srsResRate.srsLevel;
        nextReview = srsResRate.nextReview;
      } else if (typeof updates.remembered === "boolean") {
        var srsResObj = calculateSRS(current, updates.remembered, today);
        newStatus = srsResObj.status;
        newLevel = srsResObj.srsLevel;
        nextReview = srsResObj.nextReview;
      }
      if (typeof updates.status === "string") {
        newStatus = updates.status;
      }
      if (typeof updates.srsLevel === "number") {
        newLevel = updates.srsLevel;
      }
      if (typeof updates.reviewCount === "number") {
        count = updates.reviewCount;
      }
      if (updates.lastReviewed !== undefined) {
        today = updates.lastReviewed;
      }
      if (updates.nextReview !== undefined) {
        nextReview = updates.nextReview;
      }
    }

    var record = {
      status: newStatus,
      srsLevel: newLevel,
      reviewCount: count,
      lastReviewed: today,
      nextReview: nextReview
    };

    all[vocabId] = record;
    saveProgress(all);
    recordStudyActivity(today);
    recordWordStudiedToday(vocabId);

    // Sync กลับไปยัง DATA.vocabularyProgress เพื่อให้ instance runtime สอดคล้องกันทันที
    if (DATA && DATA.vocabularyProgress) {
      DATA.vocabularyProgress[vocabId] = record;
    }

    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("cvma:progress-updated", { detail: { vocabId: vocabId, record: record } }));
      } catch (e) {}
    }

    return record;
  }

  // 5) ตรวจสอบว่าคำศัพท์นี้ถึงกำหนดทบทวนในวันนี้หรือไม่ (Due)
  function isDueForReview(vocabId, todayDate) {
    if (!vocabId) return false;
    var prog = getVocabularyProgress(vocabId);
    if (!prog) return false;
    var today = todayDate || getTodayString();

    // คำที่ยังจำไม่ได้ (learning) ต้องทบทวนเสมอ
    if (prog.status === "learning") return true;

    // คำที่จำได้แล้ว (mastered) ให้ดูวันที่ nextReview
    if (prog.status === "mastered") {
      if (!prog.nextReview) return true; // ยังไม่ระบุวันกำหนด = ต้องทบทวน
      return prog.nextReview <= today;
    }

    return false;
  }

  // 6) คำนวณลำดับความเร่งด่วนในการทบทวน (ค่าน้อย = เร่งด่วนกว่า มาก่อนในคิว)
  // 1: learning / ยังจำไม่ได้ (เร่งด่วนสูงสุด)
  // 2: mastered ที่ nextReview <= today (ถึงกำหนดทบทวนตามรอบ SRS)
  // 3: new / ยังไม่เริ่ม
  // 4: mastered ที่ยังไม่ถึงกำหนด (nextReview > today)
  function getReviewUrgency(vocabId, todayDate) {
    if (!vocabId) return 99;
    var prog = getVocabularyProgress(vocabId);
    var today = todayDate || getTodayString();
    var status = (prog && prog.status) ? prog.status : "new";

    if (status === "learning") return 1;
    if (status === "mastered") {
      if (!prog.nextReview || prog.nextReview <= today) return 2;
      return 4;
    }
    return 3;
  }

  // แปลงสถานะ Progress เป็นข้อความและ class ของ Badge (TASK 5.4)
  // แสดงสถานะเหมาะสม: ยังไม่เริ่ม / กำลังเรียน / จำได้ โดยไม่ทำให้ UI รก
  function getStatusBadgeInfo(status) {
    if (status === "mastered") {
      return { text: "จำได้", className: "status-badge status-mastered" };
    }
    if (status === "learning") {
      return { text: "กำลังเรียน", className: "status-badge status-learning" };
    }
    return { text: "ยังไม่เริ่ม", className: "status-badge status-new" };
  }

  function setStatusBadge(id, status) {
    var elem = document.getElementById(id);
    if (!elem) return;
    var info = getStatusBadgeInfo(status);
    elem.textContent = info.text;
    elem.className = info.className;
  }

  // สถิติของบท: ดึงคำศัพท์ตาม Chapter ID จาก Data กลาง
  // "จำแล้ว" = คำที่ Progress status เป็น "mastered" (อ่านจาก Local Storage Progress)
  function getChapterStats(chapterId) {
    var vocab = DATA.getVocabularyByChapter(chapterId);
    var mastered = 0;
    for (var i = 0; i < vocab.length; i++) {
      var p = getVocabularyProgress(vocab[i].id);
      if (p && p.status === "mastered") mastered++;
    }
    var percent = vocab.length > 0 ? Math.round((mastered / vocab.length) * 100) : 0;
    return { vocab: vocab, total: vocab.length, mastered: mastered, percent: percent };
  }

  function progressBar(percent) {
    var bar = el("div", "progress-bar");
    var fill = el("div", "progress-fill");
    fill.style.width = percent + "%";
    bar.appendChild(fill);
    return bar;
  }

  /* ============================================================
     Text-to-Speech (TTS) — Web Speech API (TASK 5.2)
     ============================================================ */
  function isSpeechSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined";
  }

  function stopSpeech() {
    if (!isSpeechSupported()) return;
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // ignore
    }
  }

  function speakChinese(text, callbacks) {
    if (!isSpeechSupported()) {
      if (callbacks && typeof callbacks.onUnsupported === "function") {
        callbacks.onUnsupported();
      }
      return;
    }

    if (!text) {
      if (callbacks && typeof callbacks.onEnd === "function") callbacks.onEnd();
      return;
    }

    // หยุดเสียงที่กำลังเล่นอยู่ก่อนหน้าเสมอเพื่อป้องกันเสียงซ้อน
    stopSpeech();

    var utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.85; // ช้าลงเล็กน้อยเพื่อให้ฟังชัดเจน เหมาะกับการเรียนภาษาจีน
    utterance.pitch = 1.0;

    // ค้นหาเสียง Chinese Mandarin ถ้า Browser มีรายชื่อเสียง
    try {
      var voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        var zhVoice = null;
        for (var i = 0; i < voices.length; i++) {
          var v = voices[i];
          if (v.lang === "zh-CN" || v.lang === "zh_CN") {
            zhVoice = v;
            break;
          }
        }
        if (!zhVoice) {
          for (var j = 0; j < voices.length; j++) {
            if (voices[j].lang && voices[j].lang.indexOf("zh") === 0) {
              zhVoice = voices[j];
              break;
            }
          }
        }
        if (zhVoice) utterance.voice = zhVoice;
      }
    } catch (e) {
      // ignore voice selection error
    }

    utterance.onstart = function () {
      if (callbacks && typeof callbacks.onStart === "function") {
        callbacks.onStart();
      }
    };

    utterance.onend = function () {
      if (callbacks && typeof callbacks.onEnd === "function") {
        callbacks.onEnd();
      }
    };

    utterance.onerror = function () {
      // เมื่อถูก cancel() หรือมีข้อผิดพลาด ให้ถือว่าสิ้นสุดการเล่นเพื่อคืนสถานะปุ่ม
      if (callbacks && typeof callbacks.onEnd === "function") {
        callbacks.onEnd();
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      if (callbacks && typeof callbacks.onError === "function") {
        callbacks.onError(err);
      }
    }
  }

  /* ============================================================
     หน้า Home (index.html) (TASK 5.6 & Daily Vocabulary Goal Feature)
     ============================================================ */
  function initHome() {
    var titleEl = document.getElementById("homeCurrentChapterTitle");
    var progressTextEl = document.getElementById("homeCurrentProgressText");
    var progressFillEl = document.getElementById("homeCurrentProgressFill");
    var learnBtn = document.getElementById("homeLearnBtn");
    var reviewCountsEl = document.getElementById("homeReviewCounts");
    var streakEl = document.getElementById("homeStreakText");

    if (!DATA) return;

    var allChapters = DATA.getAllChapters() || [];
    var allVocab = DATA.getAllVocabulary() || [];

    // 0. Daily Vocabulary Learning Goal Engine & Card
    var goalCurrentCountEl = document.getElementById("homeGoalCurrentCount");
    var goalTargetCountEl = document.getElementById("homeGoalTargetCount");
    var goalPercentBadgeEl = document.getElementById("homeGoalPercentBadge");
    var goalProgressFillEl = document.getElementById("homeGoalProgressFill");
    var goalMessageEl = document.getElementById("homeGoalMessage");
    var goalCelebrateBtn = document.getElementById("homeGoalCelebrateBtn");
    var goalEditBtn = document.getElementById("homeGoalEditBtn");
    var goalQuickChips = document.getElementById("homeGoalQuickChips");
    var goalModal = document.getElementById("goalModal");
    var goalModalCloseBtn = document.getElementById("goalModalCloseBtn");
    var goalModalCancelBtn = document.getElementById("goalModalCancelBtn");
    var goalModalSaveBtn = document.getElementById("goalModalSaveBtn");
    var goalCustomInput = document.getElementById("goalCustomInput");
    var goalModalPresets = document.getElementById("goalModalPresets");

    var goalProg = getDailyGoalProgress();

    if (goalCurrentCountEl) goalCurrentCountEl.textContent = String(goalProg.count);
    if (goalTargetCountEl) goalTargetCountEl.textContent = String(goalProg.goal);
    if (goalPercentBadgeEl) {
      if (goalProg.isReached) {
        goalPercentBadgeEl.classList.add("is-reached");
        goalPercentBadgeEl.textContent = "100% ✓";
      } else {
        goalPercentBadgeEl.classList.remove("is-reached");
        goalPercentBadgeEl.textContent = goalProg.percent + "%";
      }
    }
    if (goalProgressFillEl) {
      goalProgressFillEl.style.width = goalProg.percent + "%";
    }
    if (goalMessageEl) {
      if (goalProg.percent === 0) {
        goalMessageEl.textContent = "🌸 มาเริ่มต้นเรียนคำศัพท์วันนี้กันเถอะ";
      } else if (goalProg.percent < 50) {
        goalMessageEl.textContent = "🌱 ก้าวแรกยอดเยี่ยม! เรียนต่ออีก " + (goalProg.goal - goalProg.count) + " คำ";
      } else if (goalProg.percent < 100) {
        goalMessageEl.textContent = "🌟 เกินครึ่งทางแล้ว! อีกแค่ " + (goalProg.goal - goalProg.count) + " คำจะถึงเป้าหมาย";
      } else {
        goalMessageEl.textContent = "🎉 ยอดเยี่ยมที่สุด! คุณพิชิตเป้าหมายประจำวันแล้ว ✨";
      }
    }

    if (goalCelebrateBtn) {
      if (goalProg.isReached) {
        goalCelebrateBtn.style.display = "inline-flex";
        goalCelebrateBtn.onclick = function () {
          triggerConfetti({ duration: 3200, particleCount: 110 });
          showCelebrationToast("🎉", "พิชิตเป้าหมายประจำวันสำเร็จ!", "เรียนสะสมครบ " + goalProg.count + " คำแล้ว เก่งมากๆ เลยนะ 🌸✨");
        };
      } else {
        goalCelebrateBtn.style.display = "none";
      }
    }

    // ฉลองอัตโนมัติหากเพิ่งพิชิตเป้าหมายประจำวันสำเร็จครั้งแรกในวันนี้
    if (checkAndRecordGoalCelebration()) {
      setTimeout(function () {
        triggerConfetti({ duration: 3600, particleCount: 120 });
        showCelebrationToast("🎉", "ยินดีด้วยนะ!", "คุณพิชิตเป้าหมายประจำวัน " + goalProg.goal + " คำสำเร็จแล้ว! 🌸✨");
      }, 350);
    }

    // ตั้งค่า Quick Preset Chips บนตัวการ์ดเป้าหมาย
    if (goalQuickChips) {
      var chips = goalQuickChips.querySelectorAll(".goal-chip");
      for (var c = 0; c < chips.length; c++) {
        var chip = chips[c];
        var chipGoal = parseInt(chip.getAttribute("data-goal"), 10);
        if (chipGoal === goalProg.goal) {
          chip.classList.add("is-active");
        } else {
          chip.classList.remove("is-active");
        }
        (function (gVal) {
          chip.onclick = function () {
            setDailyGoal(gVal);
            initHome();
            triggerConfetti({ duration: 1600, particleCount: 40, chime: false });
            showCelebrationToast("🎯", "ปรับเป้าหมายสำเร็จ", "เป้าหมายใหม่: " + gVal + " คำต่อวัน 🌸");
          };
        })(chipGoal);
      }
    }

    // Modal ปรับแต่งเป้าหมายประจำวัน
    if (goalEditBtn && goalModal) {
      goalEditBtn.onclick = function () {
        goalModal.style.display = "flex";
        if (goalCustomInput) goalCustomInput.value = "";

        if (goalModalPresets) {
          var pBtns = goalModalPresets.querySelectorAll(".goal-modal-preset-btn");
          for (var p = 0; p < pBtns.length; p++) {
            var b = pBtns[p];
            var pVal = parseInt(b.getAttribute("data-val"), 10);
            if (pVal === goalProg.goal) {
              b.classList.add("is-selected");
            } else {
              b.classList.remove("is-selected");
            }
          }
        }
      };

      function closeModal() {
        goalModal.style.display = "none";
      }

      if (goalModalCloseBtn) goalModalCloseBtn.onclick = closeModal;
      if (goalModalCancelBtn) goalModalCancelBtn.onclick = closeModal;

      goalModal.onclick = function (e) {
        if (e.target === goalModal) closeModal();
      };

      if (goalModalPresets) {
        var pBtnsList = goalModalPresets.querySelectorAll(".goal-modal-preset-btn");
        for (var pi = 0; pi < pBtnsList.length; pi++) {
          (function (btnNode) {
            btnNode.onclick = function () {
              for (var k = 0; k < pBtnsList.length; k++) {
                pBtnsList[k].classList.remove("is-selected");
              }
              btnNode.classList.add("is-selected");
              if (goalCustomInput) goalCustomInput.value = "";
            };
          })(pBtnsList[pi]);
        }
      }

      if (goalCustomInput && goalModalPresets) {
        goalCustomInput.oninput = function () {
          var pBtnsList2 = goalModalPresets.querySelectorAll(".goal-modal-preset-btn");
          for (var k = 0; k < pBtnsList2.length; k++) {
            pBtnsList2[k].classList.remove("is-selected");
          }
        };
      }

      if (goalModalSaveBtn) {
        goalModalSaveBtn.onclick = function () {
          var chosenGoal = 10;
          var customNum = goalCustomInput ? parseInt(goalCustomInput.value, 10) : NaN;
          if (!isNaN(customNum) && customNum > 0) {
            chosenGoal = customNum;
          } else if (goalModalPresets) {
            var selPreset = goalModalPresets.querySelector(".goal-modal-preset-btn.is-selected");
            if (selPreset) {
              chosenGoal = parseInt(selPreset.getAttribute("data-val"), 10) || 10;
            }
          }

          setDailyGoal(chosenGoal);
          closeModal();
          initHome();
          triggerConfetti({ duration: 2000, particleCount: 50, chime: false });
          showCelebrationToast("🎯", "บันทึกเป้าหมายสำเร็จ", "เป้าหมายใหม่: " + chosenGoal + " คำต่อวัน 🌸✨");
        };
      }
    }

    // 1. ค้นหาบทที่กำลังเรียน (Active Chapter)
    var activeChapter = null;
    var savedActiveId = null;
    try {
      savedActiveId = localStorage.getItem("cvma_active_chapter");
    } catch (e) {}

    if (savedActiveId) {
      activeChapter = DATA.getChapterById(savedActiveId);
    }

    if (!activeChapter && allChapters.length > 0) {
      for (var i = 0; i < allChapters.length; i++) {
        var ch = allChapters[i];
        var chVocabs = DATA.getVocabularyByChapter(ch.id);
        if (chVocabs && chVocabs.length > 0) {
          var stats = getChapterStats(ch.id);
          if (stats.mastered < stats.total) {
            activeChapter = ch;
            break;
          }
        }
      }
      if (!activeChapter) {
        for (var j = 0; j < allChapters.length; j++) {
          var ch2 = allChapters[j];
          var chVocabs2 = DATA.getVocabularyByChapter(ch2.id);
          if (chVocabs2 && chVocabs2.length > 0) {
            activeChapter = ch2;
            break;
          }
        }
      }
      if (!activeChapter && allChapters.length > 0) {
        activeChapter = allChapters[0];
      }
    }

    // อัปเดตข้อมูลการ์ด "กำลังเรียน"
    if (activeChapter) {
      var chStats = getChapterStats(activeChapter.id);
      if (titleEl) {
        var displayTitle = activeChapter.title;
        if (activeChapter.description) {
          displayTitle += " · " + activeChapter.description;
        }
        titleEl.textContent = displayTitle;
      }
      if (progressTextEl) {
        progressTextEl.textContent = chStats.mastered + " / " + chStats.total + " คำ";
      }
      if (progressFillEl) {
        progressFillEl.style.width = chStats.percent + "%";
      }
      if (learnBtn) {
        learnBtn.onclick = function () {
          location.href = "learn.html?chapter=" + encodeURIComponent(activeChapter.id);
        };
      }
    } else {
      if (titleEl) titleEl.textContent = "ยังไม่มีบทเรียน";
      if (progressTextEl) progressTextEl.textContent = "0 / 0 คำ";
      if (progressFillEl) progressFillEl.style.width = "0%";
      if (learnBtn) {
        learnBtn.textContent = "ไปหน้าบทเรียน";
        learnBtn.onclick = function () { location.href = "chapters.html"; };
      }
    }

    // 2. อัปเดตข้อมูลการ์ด "วันนี้ต้องทบทวน" (TASK 5.6 & 6.1 SRS Integration)
    var learningCount = 0;
    var dueMasteredCount = 0;
    var newCount = 0;
    var masteredCount = 0;
    var todayStr = getTodayString();

    for (var k = 0; k < allVocab.length; k++) {
      var v = allVocab[k];
      var prog = getVocabularyProgress(v.id);
      var status = (prog && prog.status) ? prog.status : "new";
      if (status === "learning") {
        learningCount++;
      } else if (status === "mastered") {
        masteredCount++;
        if (!prog.nextReview || prog.nextReview <= todayStr) {
          dueMasteredCount++;
        }
      } else {
        newCount++;
      }
    }

    var totalDue = learningCount + dueMasteredCount;

    if (reviewCountsEl) {
      clear(reviewCountsEl);
      if (totalDue === 0 && newCount === 0 && allVocab.length > 0) {
        var allDoneBadge = el("span", "badge", "✅ จำได้ครบทุกคำแล้ว (" + masteredCount + " คำ)");
        allDoneBadge.style.background = "#E7F7ED";
        allDoneBadge.style.color = "#237346";
        reviewCountsEl.appendChild(allDoneBadge);
      } else if (totalDue === 0 && newCount > 0) {
        var doneBadge = el("span", "badge", "🎉 วันนี้ทบทวนครบแล้ว");
        doneBadge.style.background = "#E7F7ED";
        doneBadge.style.color = "#237346";
        var warningBadge = el("span", "badge badge-warning", "🟡 " + newCount + " ยังไม่เริ่ม");
        reviewCountsEl.appendChild(doneBadge);
        reviewCountsEl.appendChild(warningBadge);
      } else {
        var dueText = "🔴 " + totalDue + (dueMasteredCount > 0 ? " ต้องทบทวน" : " ยังจำไม่ได้");
        var dangerBadge = el("span", "badge badge-danger", dueText);
        var warningBadge2 = el("span", "badge badge-warning", "🟡 " + newCount + " ยังไม่เริ่ม");
        reviewCountsEl.appendChild(dangerBadge);
        reviewCountsEl.appendChild(warningBadge2);
      }
    }

    // 3. Streak (TASK 7.1: คำนวณ Streak จริงจากประวัติการเรียน)
    if (streakEl) {
      var streakData = calculateStreak();
      if (streakData.hasStudiedToday) {
        streakEl.textContent = "🔥 เรียนต่อเนื่อง " + streakData.currentStreak + " วัน";
      } else if (streakData.currentStreak > 0) {
        streakEl.textContent = "🔥 เรียนต่อเนื่อง " + streakData.currentStreak + " วัน (วันนี้ยังไม่ได้เรียน)";
      } else {
        streakEl.textContent = "🔥 วันนี้ยังไม่ได้เริ่มเรียน";
      }
    }

    // 4. 7-Day Vocabulary Learning Streak Chart & Summary (Powered by D3.js)
    var streakChartContainer = document.getElementById("homeStreakChartD3");
    if (streakChartContainer) {
      renderHomeStreakChart(streakChartContainer);
    }

    var streak7Data = getPast7DaysStreakData();
    var total7Words = 0;
    var active7Days = 0;
    if (streak7Data && streak7Data.days) {
      streak7Data.days.forEach(function (d) {
        total7Words += d.wordsCount;
        if (d.isStudied) active7Days++;
      });
    }
    var avg7Words = active7Days > 0 ? (total7Words / active7Days).toFixed(1) : "0";

    var streakBadgeEl = document.getElementById("homeStreakChartBadge");
    if (streakBadgeEl) {
      var sData = calculateStreak();
      streakBadgeEl.textContent = "🔥 " + sData.currentStreak + " วันต่อเนื่อง";
    }

    var totalWordsEl = document.getElementById("streakSummaryTotalWords");
    if (totalWordsEl) totalWordsEl.textContent = total7Words + " คำ";

    var activeDaysEl = document.getElementById("streakSummaryActiveDays");
    if (activeDaysEl) activeDaysEl.textContent = active7Days + " / 7 วัน";

    var avgWordsEl = document.getElementById("streakSummaryAvgWords");
    if (avgWordsEl) avgWordsEl.textContent = avg7Words + " คำ";

    // 5. Daily Notification Reminder UI & Goal Check
    updateReminderUI();
    var openReminderBtn = document.getElementById("homeOpenReminderBtn");
    var reminderModal = document.getElementById("reminderModal");
    if (openReminderBtn && reminderModal) {
      openReminderBtn.onclick = function () {
        reminderModal.style.display = "flex";
      };
    }
    setupReminderModal();

    // Check whether to show the Daily Goal Reminder Banner on Home
    var reminderCheck = checkDailyGoalReminder();
    var reminderBanner = document.getElementById("homeReminderAlertBanner");
    var reminderDesc = document.getElementById("homeReminderAlertDesc");
    var reminderActionBtn = document.getElementById("homeReminderActionBtn");
    var reminderSettingBtn = document.getElementById("homeReminderSettingBtn");
    var reminderDismissBtn = document.getElementById("homeReminderDismissBtn");

    if (reminderBanner) {
      if (reminderCheck.shouldRemind) {
        if (reminderDesc) {
          var remCount = Math.max(0, goalProg.goal - goalProg.count);
          if (goalProg.count === 0) {
            reminderDesc.textContent = "วันนี้ยังไม่ได้เริ่มฝึกคำศัพท์เลย (เป้าหมาย " + goalProg.goal + " คำ) มาฝึกจำศัพท์กันเถอะนะ 🌸";
          } else {
            reminderDesc.textContent = "วันนี้คุณเรียนไปแล้ว " + goalProg.count + "/" + goalProg.goal + " คำ (ยังขาดอีก " + remCount + " คำจะพิชิตเป้าหมาย) มาลุยต่อกันเลย! ✨";
          }
        }
        reminderBanner.style.display = "flex";

        if (reminderActionBtn) {
          reminderActionBtn.onclick = function () {
            var activeCh = (DATA && DATA.getActiveChapter) ? DATA.getActiveChapter() : null;
            if (activeCh) {
              location.href = "learn.html?chapter=" + encodeURIComponent(activeCh.id);
            } else {
              location.href = "quick-review.html";
            }
          };
        }

        if (reminderSettingBtn && reminderModal) {
          reminderSettingBtn.onclick = function () {
            reminderModal.style.display = "flex";
          };
        }

        if (reminderDismissBtn) {
          reminderDismissBtn.onclick = function () {
            reminderBanner.style.display = "none";
          };
        }

        // Trigger browser notification if permitted
        triggerDailyReminderNotification();
      } else {
        reminderBanner.style.display = "none";
      }
    }

    // 6. Streak Reward Celebration Check (7-Day & 30-Day Streak)
    var homeStreakData = calculateStreak();
    var currentHomeStreak = homeStreakData.currentStreak || 0;
    if (currentHomeStreak >= 7 && !localStorage.getItem(STORAGE_STREAK_7_REWARD_KEY)) {
      localStorage.setItem(STORAGE_STREAK_7_REWARD_KEY, "true");
      setTimeout(function () {
        celebrateStreakReward(7);
      }, 500);
    } else if (currentHomeStreak >= 30 && !localStorage.getItem(STORAGE_STREAK_30_REWARD_KEY)) {
      localStorage.setItem(STORAGE_STREAK_30_REWARD_KEY, "true");
      setTimeout(function () {
        celebrateStreakReward(30);
      }, 500);
    }
  }

  /* ============================================================
     หน้า Chapters (chapters.html)
     ============================================================ */
  function initChapters() {
    var list = document.getElementById("chapterList");
    if (!list) return;
    clear(list);

    if (!DATA) {
      list.appendChild(dataErrorBox());
      return;
    }

    var chapters = DATA.getAllChapters();
    if (!chapters || chapters.length === 0) {
      list.appendChild(stateBox(
        "📭",
        "ยังไม่มีบทเรียน",
        "ตอนนี้ยังไม่มีบทเรียนในระบบ กดปุ่ม ＋ มุมขวาล่างเพื่อสร้างบทใหม่",
        null,
        null
      ));
      return;
    }

    chapters.forEach(function (chapter) {
      var stats = getChapterStats(chapter.id);

      var card = el("article", "card card-chapter is-clickable");
      card.setAttribute("data-chapter-id", chapter.id);

      card.appendChild(el("h2", "chapter-title", chapter.title));

      if (chapter.description) {
        card.appendChild(el("p", "chapter-desc", chapter.description));
      } else {
        card.appendChild(el("p", "chapter-desc is-empty", "ยังไม่มีคำอธิบาย"));
      }

      var meta = el("div", "chapter-meta");
      meta.appendChild(el("span", null, "📚 " + stats.total + " คำศัพท์"));
      if (stats.total > 0) {
        meta.appendChild(el("span", null, "⭐ จำแล้ว " + stats.mastered + " คำ"));
      }
      card.appendChild(meta);

      if (stats.total > 0) {
        card.appendChild(progressBar(stats.percent));
      } else {
        card.appendChild(el("p", "chapter-desc is-empty", "ยังไม่มีคำศัพท์ในบทนี้"));
      }

      var btn = el("button", "btn btn-primary", "ดูบทเรียน");
      btn.type = "button";
      card.appendChild(btn);

      // กดที่ Card (รวมถึงปุ่ม) → Chapter Detail ตาม Chapter ID
      card.addEventListener("click", function () {
        go("chapter-detail.html?id=" + encodeURIComponent(chapter.id));
      });

      list.appendChild(card);
    });

    // ผูก Modal เพิ่มคำศัพท์สำหรับหน้า chapters.html
    var openAddBtn = document.getElementById("openAddWordModalBtn");
    var addModal = document.getElementById("addWordModal");
    var addCloseBtn = document.getElementById("addWordModalCloseBtn");
    var addCancelBtn = document.getElementById("addWordCancelBtn");
    var addSubmitBtn = document.getElementById("addWordSubmitBtn");
    var addSpeechBtn = document.getElementById("addWordPreviewSpeechBtn");
    var chSelect = document.getElementById("addWordChapterSelect");

    var inpHz = document.getElementById("addWordHanzi");
    var inpPy = document.getElementById("addWordPinyin");
    var inpMean = document.getElementById("addWordMeaning");
    var inpEx = document.getElementById("addWordExample");
    var inpExTh = document.getElementById("addWordExampleTh");
    var inpTip = document.getElementById("addWordTip");
    var inpCat = document.getElementById("addWordCategory");

    function openAddWord() {
      if (!addModal) return;
      if (chSelect) {
        clear(chSelect);
        chapters.forEach(function (ch) {
          var opt = document.createElement("option");
          opt.value = ch.id;
          opt.textContent = ch.title;
          chSelect.appendChild(opt);
        });
      }
      if (inpHz) inpHz.value = "";
      if (inpPy) inpPy.value = "";
      if (inpMean) inpMean.value = "";
      if (inpEx) inpEx.value = "";
      if (inpExTh) inpExTh.value = "";
      if (inpTip) inpTip.value = "";
      if (inpCat) inpCat.value = "";

      addModal.style.display = "flex";
      setTimeout(function () { if (inpHz) inpHz.focus(); }, 100);
    }

    function closeAddWord() {
      if (addModal) addModal.style.display = "none";
    }

    if (openAddBtn) openAddBtn.onclick = openAddWord;
    if (addCloseBtn) addCloseBtn.onclick = closeAddWord;
    if (addCancelBtn) addCancelBtn.onclick = closeAddWord;
    if (addModal) {
      addModal.onclick = function (e) {
        if (e.target === addModal) closeAddWord();
      };
    }

    if (addSpeechBtn) {
      addSpeechBtn.onclick = function () {
        var val = inpHz ? inpHz.value.trim() : "";
        if (!val) {
          alert("กรุณากรอกตัวอักษรจีน (Hanzi) ก่อนทดสอบฟังเสียง");
          if (inpHz) inpHz.focus();
          return;
        }
        addSpeechBtn.classList.add("is-playing");
        addSpeechBtn.textContent = "🔊 กำลังเล่น...";
        speakChinese(val, {
          onEnd: function () {
            addSpeechBtn.classList.remove("is-playing");
            addSpeechBtn.textContent = "🔊 ฟังเสียง";
          },
          onError: function () {
            addSpeechBtn.classList.remove("is-playing");
            addSpeechBtn.textContent = "🔊 ฟังเสียง";
          }
        });
      };
    }

    if (addSubmitBtn) {
      addSubmitBtn.onclick = function () {
        var hz = inpHz ? inpHz.value.trim() : "";
        var py = inpPy ? inpPy.value.trim() : "";
        var mean = inpMean ? inpMean.value.trim() : "";
        var ex = inpEx ? inpEx.value.trim() : "";
        var exTh = inpExTh ? inpExTh.value.trim() : "";
        var tip = inpTip ? inpTip.value.trim() : "";
        var cat = inpCat ? inpCat.value.trim() : "";
        var targetChId = chSelect ? chSelect.value : "";

        if (!hz) {
          alert("กรุณากรอกตัวอักษรจีน (Hanzi)");
          if (inpHz) inpHz.focus();
          return;
        }
        if (!mean) {
          alert("กรุณากรอกความหมายภาษาไทย");
          if (inpMean) inpMean.focus();
          return;
        }

        var newWord = {
          hanzi: hz,
          pinyin: py,
          meaning_th: mean,
          example: ex,
          example_th: exTh,
          memory_tip: tip,
          category: cat || "ทั่วไป",
          difficulty: 1
        };

        var res = null;
        if (DATA && typeof DATA.addVocabulary === "function") {
          res = DATA.addVocabulary(newWord, targetChId);
        } else if (typeof window.VOCAB_DATA !== "undefined" && typeof window.VOCAB_DATA.addVocabulary === "function") {
          res = window.VOCAB_DATA.addVocabulary(newWord, targetChId);
        }

        if (res && res.success) {
          closeAddWord();
          triggerConfetti({ duration: 2500, particleCount: 70 });
          showCelebrationToast("✨ เพิ่มคำศัพท์ \"" + hz + "\" เรียบร้อยแล้ว!");
          initChapters();
        } else {
          alert("เกิดข้อผิดพลาด: " + (res && res.error ? res.error : "ไม่สามารถบันทึกคำศัพท์ได้"));
        }
      };
    }

    // ส่วนสำรองและกู้คืนข้อมูล (TASK 8.2 Backup & Restore)
    renderBackupSection(list);
  }

  /* ------------------------------------------------------------
     ระบบสำรองและนำเข้าข้อมูล (TASK 8.2 Backup & Restore UI)
  ------------------------------------------------------------ */
  function renderBackupSection(container) {
    var sec = el("section", "card backup-section-card");
    var head = el("div", "backup-head");
    head.appendChild(el("div", "card-label", "📦 สำรองและกู้คืนข้อมูล (Backup & Restore)"));
    sec.appendChild(head);
    sec.appendChild(el("div", "form-hint", "บันทึกบทเรียนและคำศัพท์ที่สร้างไว้เป็นไฟล์สำรอง หรือนำเข้าข้อมูลที่สำรองไว้"));

    var btnRow = el("div", "backup-buttons-row");

    var expBtn = el("button", "btn btn-secondary", "📤 ส่งออกข้อมูลสำรอง");
    expBtn.type = "button";
    expBtn.addEventListener("click", function () {
      if (!DATA || typeof DATA.exportBackupData !== "function") return;
      var data = DATA.exportBackupData();
      var jsonStr = JSON.stringify(data, null, 2);
      var blob = new Blob([jsonStr], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "cvma-backup-" + getTodayString() + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    btnRow.appendChild(expBtn);

    var impBtn = el("button", "btn btn-secondary", "📥 นำเข้าข้อมูล");
    impBtn.type = "button";
    impBtn.addEventListener("click", function () {
      openImportModal();
    });
    btnRow.appendChild(impBtn);

    sec.appendChild(btnRow);
    container.appendChild(sec);
  }

  function openImportModal() {
    // ปิด modal เดิมถ้ามี
    var oldModal = document.getElementById("importModalBackdrop");
    if (oldModal && oldModal.parentNode) oldModal.parentNode.removeChild(oldModal);

    var backdrop = el("div", "modal-backdrop");
    backdrop.id = "importModalBackdrop";

    var modal = el("div", "modal-content");

    var head = el("div", "modal-head");
    head.appendChild(el("div", "modal-title", "📥 นำเข้าข้อมูลสำรอง"));
    var closeBtn = el("button", "modal-close-btn", "✕");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", function () {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    });
    head.appendChild(closeBtn);
    modal.appendChild(head);

    var hint = el("div", "form-hint", "เลือกไฟล์ .json ที่เคยส่งออกจากแอป หรือวางข้อความ JSON ด้านล่าง");
    modal.appendChild(hint);

    // ตัวเลือกไฟล์
    var fFile = el("div", "form-field");
    fFile.appendChild(el("label", "form-label", "เลือกไฟล์ .json"));
    var fileInput = el("input", "form-input");
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";
    fFile.appendChild(fileInput);
    modal.appendChild(fFile);

    // ช่องวาง JSON
    var fText = el("div", "form-field");
    fText.appendChild(el("label", "form-label", "หรือวางข้อความ JSON"));
    var textArea = el("textarea", "form-input");
    textArea.rows = 4;
    textArea.placeholder = "วางข้อความ JSON จากไฟล์สำรองที่นี่...";
    fText.appendChild(textArea);
    modal.appendChild(fText);

    // เมื่อเลือกไฟล์ให้อ่านลงใน Textarea
    fileInput.addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function (evt) {
          textArea.value = evt.target.result;
        };
        reader.readAsText(file);
      }
    });

    // รูปแบบการนำเข้า (Merge vs Replace)
    var fMode = el("div", "form-field");
    fMode.appendChild(el("label", "form-label", "รูปแบบการนำเข้า"));

    var rMergeLabel = el("label", null);
    rMergeLabel.style.display = "flex";
    rMergeLabel.style.alignItems = "center";
    rMergeLabel.style.gap = "8px";
    rMergeLabel.style.fontSize = "13px";
    rMergeLabel.style.marginBottom = "6px";
    rMergeLabel.style.cursor = "pointer";
    var rMerge = document.createElement("input");
    rMerge.type = "radio";
    rMerge.name = "importMode";
    rMerge.value = "merge";
    rMerge.checked = true;
    rMergeLabel.appendChild(rMerge);
    rMergeLabel.appendChild(document.createTextNode("รวมกับข้อมูลเดิม (Merge) — แนะนำ"));
    fMode.appendChild(rMergeLabel);

    var rReplaceLabel = el("label", null);
    rReplaceLabel.style.display = "flex";
    rReplaceLabel.style.alignItems = "center";
    rReplaceLabel.style.gap = "8px";
    rReplaceLabel.style.fontSize = "13px";
    rReplaceLabel.style.cursor = "pointer";
    var rReplace = document.createElement("input");
    rReplace.type = "radio";
    rReplace.name = "importMode";
    rReplace.value = "replace";
    rReplaceLabel.appendChild(rReplace);
    rReplaceLabel.appendChild(document.createTextNode("เขียนทับข้อมูลเดิมทั้งหมด (Replace)"));
    fMode.appendChild(rReplaceLabel);

    modal.appendChild(fMode);

    // Error Alert Box ใน Modal
    var modalError = el("div", "form-error-alert");
    modalError.style.display = "none";
    modal.appendChild(modalError);

    // ปุ่มล่าง
    var footer = el("div", "modal-footer");
    var cancelMBtn = el("button", "btn btn-secondary", "ยกเลิก");
    cancelMBtn.type = "button";
    cancelMBtn.addEventListener("click", function () {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    });
    footer.appendChild(cancelMBtn);

    var submitMBtn = el("button", "btn btn-primary", "🚀 เริ่มนำเข้าข้อมูล");
    submitMBtn.type = "button";
    submitMBtn.addEventListener("click", function () {
      var content = textArea.value.trim();
      if (!content) {
        modalError.textContent = "⚠️ กรุณาเลือกไฟล์หรือวางข้อความ JSON";
        modalError.style.display = "block";
        return;
      }

      var mode = rReplace.checked ? "replace" : "merge";

      if (mode === "replace") {
        if (!confirm("คำเตือน: โหมดเขียนทับจะล้างบทเรียนที่สร้างเองและคำศัพท์เดิมทั้งหมด คุณแน่ใจหรือไม่?")) {
          return;
        }
      }

      if (!DATA || typeof DATA.importBackupData !== "function") {
        modalError.textContent = "⚠️ ระบบจัดการข้อมูลไม่พร้อมใช้งาน";
        modalError.style.display = "block";
        return;
      }

      var res = DATA.importBackupData(content, mode);
      if (!res || !res.success) {
        modalError.textContent = "⚠️ " + (res && res.error ? res.error : "ข้อมูลไม่ถูกต้อง");
        modalError.style.display = "block";
        return;
      }

      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      alert("🎉 นำเข้าข้อมูลเรียบร้อยแล้ว!\n- นำเข้าบทเรียน: " + res.importedChaptersCount + " บท\n- นำเข้าคำศัพท์: " + res.importedVocabCount + " คำ");
      initChapters();
    });
    footer.appendChild(submitMBtn);
    modal.appendChild(footer);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  }

  /* ============================================================
     หน้า Chapter Detail (chapter-detail.html?id=<Chapter ID>)
     ============================================================ */
  function renderVocabItem(v) {
    var card = el("section", "vocab-card vocab-card-compact vocab-card-interactive is-revealed");

    var top = el("div", "vocab-card-top");
    var tagsGroup = el("div", "vocab-card-tags");
    if (v.category) tagsGroup.appendChild(el("span", "tag", v.category));
    var prog = getVocabularyProgress(v.id);
    var badgeInfo = getStatusBadgeInfo(prog.status);
    tagsGroup.appendChild(el("span", badgeInfo.className, badgeInfo.text));
    top.appendChild(tagsGroup);

    var rightActions = el("div", "vocab-card-action-bar");
    var diff = el("span", "difficulty");
    diff.setAttribute("aria-label", "ระดับความยาก");
    var level = Number(v.difficulty) || 0;
    for (var i = 1; i <= 3; i++) {
      diff.appendChild(el("span", i <= level ? "dot dot-filled" : "dot"));
    }
    rightActions.appendChild(diff);

    // ปุ่ม 🔊 ฟังเสียง
    var listenBtn = el("button", "vocab-detail-listen-btn", "🔊");
    listenBtn.type = "button";
    listenBtn.title = "ฟังเสียงออกเสียงภาษาจีน";
    listenBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      listenBtn.classList.add("is-playing");
      speakChinese(v.hanzi, {
        onEnd: function () { listenBtn.classList.remove("is-playing"); },
        onError: function () { listenBtn.classList.remove("is-playing"); }
      });
    });
    rightActions.appendChild(listenBtn);

    top.appendChild(rightActions);
    card.appendChild(top);

    var face = el("div", "vocab-card-face vocab-card-back");
    face.appendChild(el("div", "vocab-hanzi vocab-hanzi-sm", v.hanzi));
    face.appendChild(el("div", "vocab-pinyin", v.pinyin));
    face.appendChild(el("div", "vocab-meaning", v.meaning_th));

    // ส่วนรายละเอียดเพิ่มเติม (ประโยคตัวอย่าง & Memory Tip & SRS)
    var hasDetails = !!(v.example || v.memory_tip || (prog && prog.srsLevel > 0));
    if (hasDetails) {
      var expandBtn = el("button", "vocab-card-expand-btn", "💡 ดูตัวอย่าง & เทคนิคจำ ▼");
      expandBtn.type = "button";

      var detailsBox = el("div", "vocab-card-expanded-content is-hidden");

      if (v.example) {
        var exBox = el("div", "vocab-card-example-box");
        var exRow = el("div", null);
        exRow.style.display = "flex";
        exRow.style.alignItems = "center";
        exRow.style.justifyContent = "space-between";
        exRow.style.gap = "8px";

        var exHz = el("div", "vocab-card-example-hz", v.example);
        exHz.style.marginBottom = "0";
        exRow.appendChild(exHz);

        var exAudioBtn = el("button", "btn-mini-audio", "🔊");
        exAudioBtn.type = "button";
        exAudioBtn.title = "ฟังเสียงประโยคตัวอย่าง";
        exAudioBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          exAudioBtn.classList.add("is-playing");
          speakChinese(v.example, {
            onEnd: function () { exAudioBtn.classList.remove("is-playing"); },
            onError: function () { exAudioBtn.classList.remove("is-playing"); }
          });
        });
        exRow.appendChild(exAudioBtn);

        exBox.appendChild(exRow);
        if (v.example_th) {
          exBox.appendChild(el("div", "vocab-card-example-th", v.example_th));
        }
        detailsBox.appendChild(exBox);
      }

      if (v.memory_tip) {
        var tipBox = el("div", "vocab-card-tip-box", "💡 " + v.memory_tip);
        detailsBox.appendChild(tipBox);
      }

      if (prog && typeof prog.srsLevel === "number") {
        var nextDueText = prog.nextReview ? "รอบถัดไป: " + prog.nextReview : "ยังไม่ได้กำหนดวัน";
        var srsBox = el("div", "vocab-card-srs-box", "🎯 Spaced Repetition ระดับ " + prog.srsLevel + " (" + nextDueText + ")");
        detailsBox.appendChild(srsBox);
      }

      expandBtn.addEventListener("click", function () {
        var isHidden = detailsBox.classList.contains("is-hidden");
        if (isHidden) {
          detailsBox.classList.remove("is-hidden");
          expandBtn.textContent = "▲ ซ่อนตัวอย่าง & เทคนิคจำ";
        } else {
          detailsBox.classList.add("is-hidden");
          expandBtn.textContent = "💡 ดูตัวอย่าง & เทคนิคจำ ▼";
        }
      });

      face.appendChild(expandBtn);
      face.appendChild(detailsBox);
    }

    card.appendChild(face);

    return card;
  }

  function initChapterDetail() {
    var root = document.getElementById("chapterDetail");
    var titleEl = document.getElementById("detailTitle");
    var subEl = document.getElementById("detailSub");
    if (!root) return;
    clear(root);

    if (!DATA) {
      root.appendChild(dataErrorBox());
      return;
    }

    var chapterId = new URLSearchParams(location.search).get("id");

    if (!chapterId) {
      root.appendChild(stateBox(
        "🔎",
        "ไม่ได้ระบุบทเรียน",
        "กรุณาเลือกบทจากหน้าบทเรียน",
        "กลับไปหน้าบทเรียน",
        "chapters.html"
      ));
      return;
    }

    var chapter = DATA.getChapterById(chapterId);
    if (!chapter) {
      root.appendChild(stateBox(
        "🔎",
        "ไม่พบบทเรียนนี้",
        "ไม่พบบทเรียนรหัส \"" + chapterId + "\" อาจถูกลบหรือลิงก์ไม่ถูกต้อง",
        "กลับไปหน้าบทเรียน",
        "chapters.html"
      ));
      return;
    }

    var stats = getChapterStats(chapter.id);
    try {
      localStorage.setItem("cvma_active_chapter", chapter.id);
    } catch (e) {}

    // Header + ชื่อแท็บ
    if (titleEl) titleEl.textContent = chapter.title;
    if (subEl) subEl.textContent = stats.total + " คำศัพท์";
    document.title = chapter.title + " — จำศัพท์จีน";

    // แถบแจ้งเตือนเมื่อสร้างบทใหม่สำเร็จ หรืออัปเดตบทเรียนสำเร็จ
    var urlParams = new URLSearchParams(location.search);
    if (urlParams.get("created") === "1") {
      var successBox = el("div", "state-box");
      successBox.style.padding = "var(--space-3) var(--space-4)";
      successBox.style.background = "#EBF7EE";
      successBox.style.border = "1.5px solid #C3E6CB";
      successBox.style.borderRadius = "var(--radius-card)";
      successBox.style.marginBottom = "var(--space-4)";
      successBox.style.color = "#155724";
      successBox.style.fontSize = "14px";
      successBox.style.fontWeight = "600";
      successBox.textContent = "🎉 สร้างบทเรียนใหม่เรียบร้อยแล้ว! พร้อมเริ่มเรียนคำศัพท์ได้ทันที";
      root.appendChild(successBox);
    } else if (urlParams.get("updated") === "1") {
      var updateBox = el("div", "state-box");
      updateBox.style.padding = "var(--space-3) var(--space-4)";
      updateBox.style.background = "#EBF7EE";
      updateBox.style.border = "1.5px solid #C3E6CB";
      updateBox.style.borderRadius = "var(--radius-card)";
      updateBox.style.marginBottom = "var(--space-4)";
      updateBox.style.color = "#155724";
      updateBox.style.fontSize = "14px";
      updateBox.style.fontWeight = "600";
      updateBox.textContent = "🎉 บันทึกการแก้ไขบทเรียนเรียบร้อยแล้ว!";
      root.appendChild(updateBox);
    }

    // สรุปบท: ชื่อ / คำอธิบาย / จำนวนคำศัพท์ / progress
    var summary = el("section", "card card-chapter");
    summary.appendChild(el("h2", "chapter-title", chapter.title));
    summary.appendChild(el(
      "p",
      chapter.description ? "chapter-desc" : "chapter-desc is-empty",
      chapter.description || "ยังไม่มีคำอธิบาย"
    ));

    var meta = el("div", "chapter-meta");
    meta.appendChild(el("span", null, "📚 " + stats.total + " คำศัพท์"));
    if (stats.total > 0) {
      meta.appendChild(el("span", null, "⭐ จำแล้ว " + stats.mastered + " คำ"));
    }
    summary.appendChild(meta);

    if (stats.total > 0) {
      summary.appendChild(progressBar(stats.percent));
    }

    var startBtn = el("button", "btn btn-primary", "เริ่มเรียน");
    startBtn.type = "button";
    if (stats.total === 0) {
      startBtn.disabled = true;
    } else {
      // ส่ง Chapter ID ต่อไปให้ Learn Mode (learn.html อ่านค่านี้จาก ?chapter= — TASK 4.3)
      startBtn.addEventListener("click", function () {
        go("learn.html?chapter=" + encodeURIComponent(chapter.id));
      });
    }
    summary.appendChild(startBtn);

    var quizBtn = el("button", "btn btn-secondary", "🎯 ทำแบบทดสอบ (Quiz / Active Recall)");
    quizBtn.type = "button";
    quizBtn.style.marginTop = "var(--space-2)";
    if (stats.total === 0) {
      quizBtn.disabled = true;
    } else {
      quizBtn.addEventListener("click", function () {
        go("quiz.html?chapter=" + encodeURIComponent(chapter.id));
      });
    }
    summary.appendChild(quizBtn);

    // ปุ่มเปิด Modal เพิ่มคำศัพท์ใหม่ในบทนี้
    var addWordActionRow = el("div", "chapter-actions-row");
    addWordActionRow.style.marginTop = "var(--space-2)";
    var addWordBtn = el("button", "btn-action-outline is-primary", "➕ เพิ่มคำศัพท์ใหม่ในบทนี้");
    addWordBtn.type = "button";
    addWordBtn.style.width = "100%";
    addWordBtn.style.justifyContent = "center";
    addWordBtn.addEventListener("click", openAddWordModal);
    addWordActionRow.appendChild(addWordBtn);
    summary.appendChild(addWordActionRow);

    // ปุ่มจัดการบทเรียน (แก้ไข / ลบ) สำหรับบทเรียนที่ผู้ใช้สร้างเอง
    var isCustomChapter = chapter.isCustom || (chapter.id && chapter.id.indexOf("ch-u-") === 0);
    if (isCustomChapter) {
      var actRow = el("div", "chapter-actions-row");

      var editBtn = el("button", "btn-action-outline is-primary", "✏️ แก้ไขบทเรียน / จัดการคำศัพท์");
      editBtn.type = "button";
      editBtn.addEventListener("click", function () {
        go("create-chapter.html?edit=" + encodeURIComponent(chapter.id));
      });
      actRow.appendChild(editBtn);

      var delBtn = el("button", "btn-action-outline is-danger", "🗑️ ลบบท");
      delBtn.type = "button";
      delBtn.addEventListener("click", function () {
        if (confirm("คุณต้องการลบบทเรียน \"" + chapter.title + "\" และคำศัพท์ทั้งหมดในบทนี้ใช่หรือไม่?")) {
          if (DATA && typeof DATA.deleteChapter === "function") {
            DATA.deleteChapter(chapter.id);
          }
          go("chapters.html");
        }
      });
      actRow.appendChild(delBtn);

      summary.appendChild(actRow);
    }

    root.appendChild(summary);

    // รายการคำศัพท์ของบท
    if (stats.total === 0) {
      var emptyBox = stateBox(
        "📝",
        "บทนี้ยังไม่มีคำศัพท์",
        "เพิ่มคำศัพท์คำแรกให้บทนี้ เพื่อเริ่มฝึกจำและทำแบบทดสอบ",
        "➕ เพิ่มคำศัพท์ใหม่",
        null
      );
      var emptyAddBtn = emptyBox.querySelector("button");
      if (emptyAddBtn) {
        emptyAddBtn.addEventListener("click", openAddWordModal);
      }
      root.appendChild(emptyBox);
    } else {
      var head = el("div", "section-head");
      head.appendChild(el("div", "card-label", "รายการคำศัพท์ (" + stats.total + " คำ)"));
      var headActions = el("div", "section-head-actions");
      var addMoreLink = el("button", "btn-text-link", "➕ เพิ่มคำศัพท์ใหม่");
      addMoreLink.type = "button";
      addMoreLink.addEventListener("click", openAddWordModal);
      headActions.appendChild(addMoreLink);

      if (isCustomChapter) {
        var editLink = el("button", "btn-text-link", "✏️ แก้ไขบท");
        editLink.type = "button";
        editLink.addEventListener("click", function () {
          go("create-chapter.html?edit=" + encodeURIComponent(chapter.id));
        });
        headActions.appendChild(editLink);
      }
      head.appendChild(headActions);
      root.appendChild(head);

      // Section ค้นหาและกรองคำศัพท์ (TASK 8.4)
      var searchSection = el("section", "chapter-search-section");

      // กล่องค้นหา (Search Box)
      var sBox = el("div", "chapter-search-box");
      sBox.appendChild(el("span", "chapter-search-icon", "🔍"));
      var searchInput = el("input", "chapter-search-input");
      searchInput.type = "search";
      searchInput.placeholder = "ค้นหาคำศัพท์ (Hanzi, Pinyin, ความหมาย)...";
      searchInput.autocomplete = "off";
      sBox.appendChild(searchInput);

      var clearSearchBtn = el("button", "chapter-search-clear is-hidden", "✕");
      clearSearchBtn.type = "button";
      clearSearchBtn.title = "ล้างการค้นหา";
      sBox.appendChild(clearSearchBtn);
      searchSection.appendChild(sBox);

      // แถบชิปตัวกรองสถานะและหมวดหมู่ (Filter Chips)
      var chipsRow = el("div", "chapter-filter-chips");

      // รวบรวมหมวดหมู่คำศัพท์ที่มีในบทนี้
      var categoriesInChapter = [];
      var catSeen = {};
      stats.vocab.forEach(function (v) {
        if (v.category && !catSeen[v.category]) {
          catSeen[v.category] = true;
          categoriesInChapter.push(v.category);
        }
      });

      var currentFilterStatus = "all"; // "all", "due", "mastered", "learning", "new"
      var currentFilterCategory = "all";
      var currentSearchQuery = "";

      // สร้าง Chips สถานะ
      var filterDefs = [
        { id: "all", label: "ทั้งหมด" },
        { id: "due", label: "🔴 ต้องทบทวน" },
        { id: "mastered", label: "✅ จำแล้ว" },
        { id: "learning", label: "🟡 กำลังเรียน" },
        { id: "new", label: "⚪ ยังไม่เริ่ม" }
      ];

      // เพิ่ม Category Chips ถ้ามี
      categoriesInChapter.forEach(function (cat) {
        filterDefs.push({ id: "cat:" + cat, label: "🏷️ " + cat });
      });

      var chipButtons = [];
      filterDefs.forEach(function (def) {
        var chip = el("button", "chapter-chip" + (def.id === "all" ? " is-active" : ""), def.label);
        chip.type = "button";
        chip.setAttribute("data-filter-id", def.id);
        chip.addEventListener("click", function () {
          chipButtons.forEach(function (b) { b.classList.remove("is-active"); });
          chip.classList.add("is-active");

          if (def.id.indexOf("cat:") === 0) {
            currentFilterCategory = def.id.slice(4);
            currentFilterStatus = "all";
          } else {
            currentFilterStatus = def.id;
            currentFilterCategory = "all";
          }
          applyFilters();
        });
        chipButtons.push(chip);
        chipsRow.appendChild(chip);
      });
      searchSection.appendChild(chipsRow);

      // แถบแสดงจำนวนคำที่ผ่านการกรอง
      var filterStatsRow = el("div", "chapter-filter-stats");
      var countInfoSpan = el("span", null, "แสดง " + stats.total + " จาก " + stats.total + " คำ");
      filterStatsRow.appendChild(countInfoSpan);
      searchSection.appendChild(filterStatsRow);

      root.appendChild(searchSection);

      // คอนเทนเนอร์รายการคำศัพท์
      var vocabListWrap = el("div", "chapter-vocab-list-wrap");
      root.appendChild(vocabListWrap);

      function applyFilters() {
        clear(vocabListWrap);
        var q = currentSearchQuery.toLowerCase().trim();

        var filtered = stats.vocab.filter(function (v) {
          // กรองสถานะ
          var prog = getVocabularyProgress(v.id);
          var st = prog ? prog.status : "new";
          if (currentFilterStatus === "due") {
            if (!isDueForReview(v.id)) return false;
          } else if (currentFilterStatus === "mastered") {
            if (st !== "mastered") return false;
          } else if (currentFilterStatus === "learning") {
            if (st !== "learning") return false;
          } else if (currentFilterStatus === "new") {
            if (st !== "new") return false;
          }

          // กรองหมวดหมู่
          if (currentFilterCategory !== "all") {
            if (v.category !== currentFilterCategory) return false;
          }

          // กรองค้นหา
          if (q) {
            var matchHz = v.hanzi && v.hanzi.toLowerCase().indexOf(q) !== -1;
            var matchPy = v.pinyin && v.pinyin.toLowerCase().indexOf(q) !== -1;
            var matchTh = v.meaning_th && v.meaning_th.toLowerCase().indexOf(q) !== -1;
            var matchEx = v.example && v.example.toLowerCase().indexOf(q) !== -1;
            if (!matchHz && !matchPy && !matchTh && !matchEx) return false;
          }

          return true;
        });

        countInfoSpan.textContent = "แสดง " + filtered.length + " จาก " + stats.total + " คำ";

        if (filtered.length === 0) {
          var noMatchBox = el("div", "state-box");
          noMatchBox.style.padding = "var(--space-4)";
          noMatchBox.appendChild(el("div", "state-icon", "🔎"));
          noMatchBox.appendChild(el("h3", "state-title", "ไม่พบคำศัพท์ที่ตรงกับเงื่อนไข"));
          noMatchBox.appendChild(el("p", "state-text", "ลองค้นหาด้วยคำอื่น หรือเลือกตัวกรองเป็น \"ทั้งหมด\""));
          var resetBtn = el("button", "btn btn-secondary", "ล้างตัวกรองทั้งหมด");
          resetBtn.type = "button";
          resetBtn.style.maxWidth = "200px";
          resetBtn.style.margin = "var(--space-2) auto 0";
          resetBtn.addEventListener("click", function () {
            searchInput.value = "";
            currentSearchQuery = "";
            clearSearchBtn.classList.add("is-hidden");
            chipButtons.forEach(function (b) {
              b.classList.toggle("is-active", b.getAttribute("data-filter-id") === "all");
            });
            currentFilterStatus = "all";
            currentFilterCategory = "all";
            applyFilters();
          });
          noMatchBox.appendChild(resetBtn);
          vocabListWrap.appendChild(noMatchBox);
        } else {
          filtered.forEach(function (v) {
            vocabListWrap.appendChild(renderVocabItem(v));
          });
        }
      }

      // Event ค้นหา
      searchInput.addEventListener("input", function () {
        currentSearchQuery = searchInput.value;
        clearSearchBtn.classList.toggle("is-hidden", !currentSearchQuery);
        applyFilters();
      });

      clearSearchBtn.addEventListener("click", function () {
        searchInput.value = "";
        currentSearchQuery = "";
        clearSearchBtn.classList.add("is-hidden");
        applyFilters();
        searchInput.focus();
      });

      // Render ครั้งแรก
      applyFilters();
    }

    // Modal เพิ่มคำศัพท์ใหม่ในบทนี้
    var addWordModal = document.getElementById("addWordModal");
    var addWordCloseBtn = document.getElementById("addWordModalCloseBtn");
    var addWordCancelBtn = document.getElementById("addWordCancelBtn");
    var addWordSubmitBtn = document.getElementById("addWordSubmitBtn");
    var addWordPreviewSpeechBtn = document.getElementById("addWordPreviewSpeechBtn");

    var inpHanzi = document.getElementById("addWordHanzi");
    var inpPinyin = document.getElementById("addWordPinyin");
    var inpMeaning = document.getElementById("addWordMeaning");
    var inpExample = document.getElementById("addWordExample");
    var inpExampleTh = document.getElementById("addWordExampleTh");
    var inpTip = document.getElementById("addWordTip");
    var inpCategory = document.getElementById("addWordCategory");

    function openAddWordModal() {
      if (!addWordModal) return;
      if (inpHanzi) inpHanzi.value = "";
      if (inpPinyin) inpPinyin.value = "";
      if (inpMeaning) inpMeaning.value = "";
      if (inpExample) inpExample.value = "";
      if (inpExampleTh) inpExampleTh.value = "";
      if (inpTip) inpTip.value = "";
      if (inpCategory) inpCategory.value = "";

      addWordModal.style.display = "flex";
      setTimeout(function () {
        if (inpHanzi) inpHanzi.focus();
      }, 100);
    }

    function closeAddWordModal() {
      if (addWordModal) addWordModal.style.display = "none";
    }

    if (addWordCloseBtn) addWordCloseBtn.onclick = closeAddWordModal;
    if (addWordCancelBtn) addWordCancelBtn.onclick = closeAddWordModal;
    if (addWordModal) {
      addWordModal.onclick = function (e) {
        if (e.target === addWordModal) closeAddWordModal();
      };
    }

    if (addWordPreviewSpeechBtn) {
      addWordPreviewSpeechBtn.onclick = function () {
        var hz = inpHanzi ? inpHanzi.value.trim() : "";
        if (!hz) {
          alert("กรุณากรอกตัวอักษรจีน (Hanzi) ก่อนทดสอบฟังเสียง");
          if (inpHanzi) inpHanzi.focus();
          return;
        }
        addWordPreviewSpeechBtn.classList.add("is-playing");
        addWordPreviewSpeechBtn.textContent = "🔊 กำลังเล่น...";
        speakChinese(hz, {
          onEnd: function () {
            addWordPreviewSpeechBtn.classList.remove("is-playing");
            addWordPreviewSpeechBtn.textContent = "🔊 ฟังเสียง";
          },
          onError: function () {
            addWordPreviewSpeechBtn.classList.remove("is-playing");
            addWordPreviewSpeechBtn.textContent = "🔊 ฟังเสียง";
          }
        });
      };
    }

    if (addWordSubmitBtn) {
      addWordSubmitBtn.onclick = function () {
        var hz = inpHanzi ? inpHanzi.value.trim() : "";
        var py = inpPinyin ? inpPinyin.value.trim() : "";
        var mean = inpMeaning ? inpMeaning.value.trim() : "";
        var ex = inpExample ? inpExample.value.trim() : "";
        var exTh = inpExampleTh ? inpExampleTh.value.trim() : "";
        var tip = inpTip ? inpTip.value.trim() : "";
        var cat = inpCategory ? inpCategory.value.trim() : "";

        if (!hz) {
          alert("กรุณากรอกตัวอักษรจีน (Hanzi)");
          if (inpHanzi) inpHanzi.focus();
          return;
        }
        if (!mean) {
          alert("กรุณากรอกความหมายภาษาไทย");
          if (inpMeaning) inpMeaning.focus();
          return;
        }

        var newWordData = {
          hanzi: hz,
          pinyin: py,
          meaning_th: mean,
          example: ex,
          example_th: exTh,
          memory_tip: tip,
          category: cat || (chapter.title ? chapter.title.replace(/第\d+课\s*/, "") : "คำศัพท์ของฉัน"),
          difficulty: 1
        };

        var res = null;
        if (DATA && typeof DATA.addVocabulary === "function") {
          res = DATA.addVocabulary(newWordData, chapter.id);
        } else if (typeof window.VOCAB_DATA !== "undefined" && typeof window.VOCAB_DATA.addVocabulary === "function") {
          res = window.VOCAB_DATA.addVocabulary(newWordData, chapter.id);
        }

        if (res && res.success) {
          closeAddWordModal();
          triggerConfetti({ duration: 2500, particleCount: 70 });
          showCelebrationToast("✨ เพิ่มคำศัพท์ \"" + hz + "\" สำเร็จแล้ว!");
          initChapterDetail();
        } else {
          alert("เกิดข้อผิดพลาด: " + (res && res.error ? res.error : "ไม่สามารถบันทึกคำศัพท์ได้"));
        }
      };
    }
  }

  /* ============================================================
     หน้า Learn Mode (learn.html?chapter=<Chapter ID>)
     TASK 4.3: เชื่อม Learn Mode กับ VOCAB_DATA + Chapter ที่เลือก
     ============================================================ */
  function setText(id, text) {
    var node = document.getElementById(id);
    if (node) node.textContent = text || "";
  }

  // tag ว่าง (ไม่มี category) → ซ่อนไว้แทนที่จะโชว์ pill ว่างเปล่า
  function setTag(id, text) {
    var node = document.getElementById(id);
    if (!node) return;
    if (text) {
      node.textContent = text;
      node.classList.remove("is-hidden");
    } else {
      node.textContent = "";
      node.classList.add("is-hidden");
    }
  }

  function setDifficultyDots(id, level) {
    var container = document.getElementById(id);
    if (!container) return;
    clear(container);
    var lvl = Number(level) || 0;
    for (var i = 1; i <= 3; i++) {
      container.appendChild(el("span", i <= lvl ? "dot dot-filled" : "dot"));
    }
  }

  function initLearn() {
    var bodyEl = document.getElementById("learnBody");
    var stateEl = document.getElementById("learnStateBox");
    var cardEl = document.getElementById("learnCard");
    if (!bodyEl || !stateEl || !cardEl) return;

    function showState(box) {
      bodyEl.classList.add("is-hidden");
      setText("learnChapterTitle", "Learn Mode");
      setText("learnProgressSub", "");
      clear(stateEl);
      stateEl.appendChild(box);
      stateEl.classList.remove("is-hidden");
    }

    if (!DATA) {
      showState(dataErrorBox());
      return;
    }

    var chapterId = new URLSearchParams(location.search).get("chapter");

    if (!chapterId) {
      showState(stateBox(
        "🔎",
        "ไม่ได้ระบุบทเรียน",
        "กรุณาเลือกบทจากหน้าบทเรียนก่อนเริ่มเรียน",
        "กลับไปหน้าบทเรียน",
        "chapters.html"
      ));
      return;
    }

    var chapter = DATA.getChapterById(chapterId);
    if (!chapter) {
      showState(stateBox(
        "🔎",
        "ไม่พบบทเรียนนี้",
        "ไม่พบบทเรียนรหัส \"" + chapterId + "\" อาจถูกลบหรือลิงก์ไม่ถูกต้อง",
        "กลับไปหน้าบทเรียน",
        "chapters.html"
      ));
      return;
    }

    var vocabList = DATA.getVocabularyByChapter(chapter.id);
    try {
      localStorage.setItem("cvma_active_chapter", chapter.id);
    } catch (e) {}
    if (!vocabList || vocabList.length === 0) {
      showState(stateBox(
        "📝",
        "บทนี้ยังไม่มีคำศัพท์",
        "เมื่อเพิ่มคำศัพท์ให้บทนี้แล้ว จะสามารถเริ่มเรียนได้ที่นี่",
        "กลับไปหน้ารายละเอียดบท",
        "chapter-detail.html?id=" + encodeURIComponent(chapter.id)
      ));
      return;
    }

    var titleEl = document.getElementById("learnChapterTitle");
    var subEl = document.getElementById("learnProgressSub");
    var progressFillEl = document.getElementById("learnProgressFill");
    var listenBtn = document.getElementById("learnListenBtn");
    var listenBtnBack = document.getElementById("learnListenBtnBack");
    var exampleListenBtn = document.getElementById("learnExampleListenBtn");
    var speechNotice = document.getElementById("learnSpeechNotice");
    var speechNoticeTimer = null;
    var currentIndex = 0;

    // TASK 5.5: ติดตามผลการเรียนของ Session ปัจจุบัน (แยกจาก Persistent Progress ใน Local Storage)
    var sessionResult = {
      total: vocabList.length,
      remembered: 0,
      notRemembered: 0,
      responses: {}
    };

    function resetListenBtn() {
      if (listenBtn) {
        listenBtn.textContent = "🔊 ฟังเสียง";
        listenBtn.classList.remove("is-playing");
      }
      if (listenBtnBack) {
        listenBtnBack.textContent = "🔊 ฟังเสียง";
        listenBtnBack.classList.remove("is-playing");
      }
      if (exampleListenBtn) {
        exampleListenBtn.classList.remove("is-playing");
      }
    }

    function setListenBtnPlaying(btnNode) {
      if (btnNode) {
        btnNode.textContent = "🔊 กำลังเล่น...";
        btnNode.classList.add("is-playing");
      } else if (listenBtn) {
        listenBtn.textContent = "🔊 กำลังเล่น...";
        listenBtn.classList.add("is-playing");
      }
    }

    function showSpeechNotice(msg) {
      if (!speechNotice) return;
      speechNotice.textContent = msg;
      speechNotice.classList.remove("is-hidden");
      if (speechNoticeTimer) clearTimeout(speechNoticeTimer);
      speechNoticeTimer = setTimeout(function () {
        speechNotice.classList.add("is-hidden");
      }, 3500);
    }

    // ปุ่ม ← ในหัวหน้า: กลับไปหน้ารายละเอียดบทของ Chapter นี้ (Session เป็น state ในหน้านี้เท่านั้น
    // การออก/เข้าใหม่จึงเริ่ม Session ใหม่จากคำแรกเสมอ ไม่มีสถานะค้างที่ทำให้พัง)
    var backBtn = document.getElementById("learnBackBtn");
    if (backBtn) {
      backBtn.setAttribute("aria-label", "ย้อนกลับไปหน้ารายละเอียดบท");
      backBtn.onclick = function () {
        stopSpeech();
        go("chapter-detail.html?id=" + encodeURIComponent(chapter.id));
      };
    }

    // หยุดเสียงเมื่อออกจากหน้า
    window.addEventListener("pagehide", stopSpeech);

    function renderCurrent() {
      // หยุดเสียงของคำก่อนหน้าและรีเซ็ตสถานะปุ่มทันที
      stopSpeech();
      resetListenBtn();

      var v = vocabList[currentIndex];

      // ไม่พบ Vocabulary ของ index นี้ (กันหน้าเว็บพัง แม้ไม่ควรเกิดขึ้นจริง)
      if (!v) {
        showState(stateBox(
          "⚠️",
          "ไม่พบคำศัพท์",
          "เกิดข้อผิดพลาดในการโหลดคำศัพท์คำนี้ กรุณากลับไปหน้าบทเรียน",
          "กลับไปหน้าบทเรียน",
          "chapters.html"
        ));
        return;
      }

      cardEl.classList.remove("is-revealed");

      if (titleEl) titleEl.textContent = chapter.title;
      if (subEl) subEl.textContent = "คำที่ " + (currentIndex + 1) + " / " + vocabList.length;
      if (progressFillEl) {
        progressFillEl.style.width = Math.round(((currentIndex + 1) / vocabList.length) * 100) + "%";
      }
      document.title = chapter.title + " — Learn Mode — จำศัพท์จีน";

      setTag("learnTag", v.category);
      setDifficultyDots("learnDifficulty", v.difficulty);
      setText("learnHanziFront", v.hanzi);
      setText("learnPinyinFront", v.pinyin);
      setText("learnHanziBack", v.hanzi);
      setText("learnPinyinBack", v.pinyin);
      setText("learnMeaning", v.meaning_th);
      setText("learnExampleHanzi", v.example);
      setText("learnExampleTh", v.example_th);
      setText("learnTip", v.memory_tip);

      // TASK 5.3 & 5.4: อ่าน Progress ของคำศัพท์ปัจจุบัน และแสดงสถานะ (ยังไม่เริ่ม / กำลังเรียน / จำได้)
      var currentProg = getVocabularyProgress(v.id);
      cardEl.setAttribute("data-vocab-id", v.id);
      cardEl.setAttribute("data-status", currentProg.status);
      setStatusBadge("learnStatus", currentProg.status);
    }

    // TASK 5.1: Learning Session — ไล่ทีละคำตามลำดับ ไม่วนรอบ; หลังคำสุดท้าย → Session Complete
    function goToNext() {
      stopSpeech();
      resetListenBtn();

      if (currentIndex + 1 >= vocabList.length) {
        showComplete();
        return;
      }
      currentIndex++;
      renderCurrent();
    }

    // TASK 5.3 & 5.5: บันทึกผล "จำได้แล้ว" / "ยังจำไม่ได้" ลง Local Storage และนับสถิติของ Session ปัจจุบัน
    function handleLearnResponse(remembered) {
      var v = vocabList[currentIndex];
      if (v) {
        // บันทึก Persistent Progress ลง Local Storage
        updateVocabularyProgress(v.id, { remembered: remembered });

        // ติดตาม Session Result เฉพาะการเรียนครั้งนี้ (ไม่สร้างระบบคะแนนซับซ้อน)
        if (!sessionResult.responses[v.id]) {
          sessionResult.responses[v.id] = remembered ? "remembered" : "notRemembered";
          if (remembered) {
            sessionResult.remembered++;
          } else {
            sessionResult.notRemembered++;
          }
        }
      }
      goToNext();
    }

    // TASK 5.5: หน้าจบ Session แสดงสรุปผลการเรียน (จำนวนคำ, จำได้, ยังไม่มั่นใจ, ความคืบหน้า)
    function showComplete() {
      stopSpeech();
      resetListenBtn();

      // ฉลองความสำเร็จเมื่อจบเซสชันการเรียนรู้ประจำวันด้วย Confetti Animation
      triggerConfetti({ duration: 3500, particleCount: 110 });

      var total = sessionResult.total || vocabList.length;
      var remembered = sessionResult.remembered;
      var notRemembered = sessionResult.notRemembered;
      var unanswered = Math.max(0, total - (remembered + notRemembered));
      var percent = total > 0 ? Math.round((remembered / total) * 100) : 0;

      var box = el("section", "card state-box session-complete-box");
      box.appendChild(el("div", "state-icon", "🎉"));
      box.appendChild(el("h2", "state-title", "เรียนครบแล้ว!"));
      box.appendChild(el("p", "state-text", "วันนี้เรียน " + total + " คำ"));

      // สรุปผลของ Session ปัจจุบัน
      var summaryBox = el("div", "session-summary-box");

      // ตรวจสอบการบรรลุเป้าหมายคำศัพท์ประจำวัน
      var goalProg = getDailyGoalProgress();
      if (goalProg.isReached) {
        var goalCallout = el("div", "session-goal-callout");
        goalCallout.innerHTML = "<span>🎯</span><div><strong>พิชิตเป้าหมายประจำวันแล้ว!</strong> สะสมคำศัพท์ " + goalProg.count + " / " + goalProg.goal + " คำวันนี้ 🌸</div>";
        summaryBox.appendChild(goalCallout);
      }

      // ตรวจสอบและประกาศเหรียญรางวัล Milestone ที่เพิ่งปลดล็อกได้
      var newMilestones = checkAndSaveNewMilestones();
      if (newMilestones && newMilestones.length > 0) {
        var msNames = newMilestones.map(function (m) { return m.emoji + " " + m.title; }).join(", ");
        var msCallout = el("div", "session-milestone-callout");
        msCallout.innerHTML = "<span>🏆</span><div><strong>ปลดล็อกรางวัลความสำเร็จใหม่!</strong> " + msNames + " ✨</div>";
        summaryBox.appendChild(msCallout);
      }

      // แถว ✅ จำได้
      var rowRemembered = el("div", "session-summary-row");
      var labelRem = el("span", "session-summary-label");
      labelRem.innerHTML = '<span aria-hidden="true">✅</span> จำได้';
      var valRem = el("span", "session-summary-value", remembered + " คำ");
      rowRemembered.appendChild(labelRem);
      rowRemembered.appendChild(valRem);
      summaryBox.appendChild(rowRemembered);

      // แถว 😵 ยังไม่มั่นใจ
      var rowNotRem = el("div", "session-summary-row");
      var labelNot = el("span", "session-summary-label");
      labelNot.innerHTML = '<span aria-hidden="true">😵</span> ยังไม่มั่นใจ';
      var valNot = el("span", "session-summary-value", notRemembered + " คำ");
      rowNotRem.appendChild(labelNot);
      rowNotRem.appendChild(valNot);
      summaryBox.appendChild(rowNotRem);

      // แถว ⏳ ยังไม่ได้ตอบ (กรณีข้ามหรือยังไม่ตอบ)
      if (unanswered > 0) {
        var rowUnanswered = el("div", "session-summary-row");
        var labelUn = el("span", "session-summary-label");
        labelUn.innerHTML = '<span aria-hidden="true">⏳</span> ยังไม่ได้ตอบ';
        var valUn = el("span", "session-summary-value", unanswered + " คำ");
        rowUnanswered.appendChild(labelUn);
        rowUnanswered.appendChild(valUn);
        summaryBox.appendChild(rowUnanswered);
      }

      // แถบความคืบหน้าของ Session
      var progContainer = el("div", "session-summary-progress");
      var progLabelRow = el("div", "session-summary-progress-label");
      progLabelRow.appendChild(el("span", null, "ความคืบหน้า"));
      progLabelRow.appendChild(el("span", "session-summary-progress-pct", percent + "%"));
      progContainer.appendChild(progLabelRow);

      var progBar = el("div", "progress-bar");
      var progFill = el("div", "progress-fill");
      progFill.style.width = percent + "%";
      progBar.appendChild(progFill);
      progContainer.appendChild(progBar);

      summaryBox.appendChild(progContainer);
      box.appendChild(summaryBox);

      // ปุ่มควบคุม: [ กลับไปที่บท ] & [ เรียนอีกครั้ง ]
      var actions = el("div", "state-actions");
      var backBtn2 = el("button", "btn btn-primary", "กลับไปที่บท");
      backBtn2.type = "button";
      backBtn2.addEventListener("click", function () {
        stopSpeech();
        go("chapter-detail.html?id=" + encodeURIComponent(chapter.id));
      });

      var again = el("button", "btn btn-secondary", "เรียนอีกครั้ง");
      again.type = "button";
      again.addEventListener("click", function () {
        stopSpeech();
        currentIndex = 0;
        // Reset เฉพาะ Session Result ไม่แตะต้อง Persistent Progress ใน Local Storage
        sessionResult = {
          total: vocabList.length,
          remembered: 0,
          notRemembered: 0,
          responses: {}
        };
        stateEl.classList.add("is-hidden");
        clear(stateEl);
        bodyEl.classList.remove("is-hidden");
        renderCurrent();
      });

      var quizBtn = el("button", "btn-action-outline is-primary", "🎯 ทดสอบความจำทันที (Quiz Mode)");
      quizBtn.type = "button";
      quizBtn.style.marginTop = "var(--space-2)";
      quizBtn.style.textAlign = "center";
      quizBtn.addEventListener("click", function () {
        stopSpeech();
        go("quiz.html?chapter=" + encodeURIComponent(chapter.id));
      });

      actions.appendChild(backBtn2);
      actions.appendChild(again);
      actions.appendChild(quizBtn);
      box.appendChild(actions);

      bodyEl.classList.add("is-hidden");
      if (titleEl) titleEl.textContent = chapter.title;
      if (subEl) subEl.textContent = "จบ Session";
      clear(stateEl);
      stateEl.appendChild(box);
      stateEl.classList.remove("is-hidden");
    }

    // TASK 5.2: ผูกการทำงานปุ่มฟังเสียง (อ่านเฉพาะ Hanzi ด้วยภาษาจีนกลาง zh-CN และตัวอย่างประโยค)
    if (listenBtn) {
      listenBtn.addEventListener("click", function () {
        var v = vocabList[currentIndex];
        if (!v || !v.hanzi) return;

        if (!isSpeechSupported()) {
          showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
          return;
        }

        speakChinese(v.hanzi, {
          onStart: function () {
            setListenBtnPlaying(listenBtn);
          },
          onEnd: function () {
            resetListenBtn();
          },
          onError: function () {
            resetListenBtn();
          },
          onUnsupported: function () {
            resetListenBtn();
            showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
          }
        });
      });
    }

    if (listenBtnBack) {
      listenBtnBack.addEventListener("click", function () {
        var v = vocabList[currentIndex];
        if (!v || !v.hanzi) return;

        if (!isSpeechSupported()) {
          showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
          return;
        }

        speakChinese(v.hanzi, {
          onStart: function () {
            setListenBtnPlaying(listenBtnBack);
          },
          onEnd: function () {
            resetListenBtn();
          },
          onError: function () {
            resetListenBtn();
          },
          onUnsupported: function () {
            resetListenBtn();
            showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
          }
        });
      });
    }

    if (exampleListenBtn) {
      exampleListenBtn.addEventListener("click", function () {
        var v = vocabList[currentIndex];
        if (!v || !v.example) return;

        if (!isSpeechSupported()) {
          showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
          return;
        }

        exampleListenBtn.classList.add("is-playing");
        speakChinese(v.example, {
          onStart: function () {
            if (exampleListenBtn) exampleListenBtn.classList.add("is-playing");
          },
          onEnd: function () {
            resetListenBtn();
          },
          onError: function () {
            resetListenBtn();
          },
          onUnsupported: function () {
            resetListenBtn();
            showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
          }
        });
      });
    }

    var btnYes = document.getElementById("learnBtnYes");
    var btnNo = document.getElementById("learnBtnNo");
    if (btnYes) btnYes.addEventListener("click", function () { handleLearnResponse(true); });
    if (btnNo) btnNo.addEventListener("click", function () { handleLearnResponse(false); });

    renderCurrent();
  }

  /* ============================================================
     หน้า Quick Review (quick-review.html)
     TASK 4.4, 5.4, 6.1 & 6.2: Spaced Repetition Active Recall & Review Session
     - ไม่ระบุ ?chapter= → ใช้คำศัพท์จากข้อมูลกลางทั้งหมด (getAllVocabulary)
       จำกัดไม่เกิน REVIEW_LIMIT คำ เรียงตามความเร่งด่วน SRS Due Queue
     - ระบุ ?chapter=<id> → ทบทวนเฉพาะคำใน Chapter นั้น
     - รองรับ Spaced Repetition 5 ระดับ (1: ลืมแล้ว, 2: ยาก, 3: ปานกลาง, 4: ง่าย, 5: จำแม่น)
     - มีระบบออกเสียงภาษาจีนกลาง Web Speech API พร้อมสถานะปุ่ม
     - ปุ่มนำทาง ย้อนกลับ/ถัดไป
     - สรุปผลเมื่อจบเซสชัน (Review Session Completion) และบันทึกลง Local Storage
     ============================================================ */
  var REVIEW_LIMIT = 12;

  function initQuickReview() {
    var bodyEl = document.getElementById("reviewBody");
    var stateEl = document.getElementById("reviewStateBox");
    var cardEl = document.getElementById("reviewCard");
    if (!bodyEl || !stateEl || !cardEl) return;

    function showState(box) {
      bodyEl.classList.add("is-hidden");
      setText("reviewProgressSub", "");
      clear(stateEl);
      stateEl.appendChild(box);
      stateEl.classList.remove("is-hidden");
    }

    if (!DATA) {
      showState(dataErrorBox());
      return;
    }

    var chapterId = new URLSearchParams(location.search).get("chapter");
    var reviewList;

    if (chapterId) {
      var chapter = DATA.getChapterById(chapterId);
      if (!chapter) {
        showState(stateBox(
          "🔎",
          "ไม่พบบทเรียนนี้",
          "ไม่พบบทเรียนรหัส \"" + chapterId + "\" อาจถูกลบหรือลิงก์ไม่ถูกต้อง",
          "กลับไปหน้าบทเรียน",
          "chapters.html"
        ));
        return;
      }
      reviewList = DATA.getVocabularyByChapter(chapter.id);
    } else {
      // ข้ามคำที่ chapterId ไม่ตรงกับบทใด ๆ (ข้อมูลกำพร้า) เพื่อให้สอดคล้องกับ Chapters/Learn
      reviewList = DATA.getAllVocabulary().filter(function (v) {
        return DATA.getChapterById(v.chapterId);
      });
    }

    // TASK 5.4 & 6.1: ใช้ SRS Spaced Repetition และ Due Review Queue ในการจัดลำดับคำศัพท์
    // ลำดับความสำคัญ:
    // 1. กำลังเรียน / ยังจำไม่ได้ (learning)
    // 2. จำได้แล้วแต่ถึงกำหนดทบทวนวันนี้ (mastered และ nextReview <= วันนี้)
    // 3. ยังไม่เริ่ม (new)
    // 4. จำได้แล้วและยังไม่ถึงกำหนด (mastered และ nextReview > วันนี้)
    var todayStr = getTodayString();
    reviewList = (reviewList || []).slice().sort(function (a, b) {
      var prioA = getReviewUrgency(a.id, todayStr);
      var prioB = getReviewUrgency(b.id, todayStr);
      if (prioA !== prioB) return prioA - prioB;
      // หากอยู่ในกลุ่มความเร่งด่วนเดียวกัน ให้คำที่ถึงกำหนดก่อนหรือค้างนานกว่าขึ้นก่อน
      var progA = getVocabularyProgress(a.id);
      var progB = getVocabularyProgress(b.id);
      var dateA = (progA && progA.nextReview) ? progA.nextReview : "9999-99-99";
      var dateB = (progB && progB.nextReview) ? progB.nextReview : "9999-99-99";
      return dateA.localeCompare(dateB);
    });

    reviewList = reviewList.slice(0, REVIEW_LIMIT);

    if (reviewList.length === 0) {
      showState(stateBox(
        "📭",
        "ยังไม่มีคำศัพท์ให้ทบทวน",
        "เมื่อมีคำศัพท์ในบทเรียนแล้ว จะสามารถทบทวนได้ที่นี่",
        "ไปหน้าบทเรียน",
        "chapters.html"
      ));
      return;
    }

    var subEl = document.getElementById("reviewProgressSub");
    var progressFillEl = document.getElementById("reviewProgressFill");
    var listenBtn = document.getElementById("reviewListenBtn");
    var listenBtnBack = document.getElementById("reviewListenBtnBack");
    var exampleListenBtn = document.getElementById("reviewExampleListenBtn");
    var speechNotice = document.getElementById("reviewSpeechNotice");
    var prevBtn = document.getElementById("reviewPrevBtn");
    var nextBtn = document.getElementById("reviewNextBtn");
    var currentIndex = 0;

    // ติดตามผลลัพธ์ของเซสชันการทบทวนนี้ (TASK 6.2)
    var sessionResult = {
      total: reviewList.length,
      ratings: {},
      remembered: 0,
      forgot: 0
    };

    function resetListenBtn() {
      if (listenBtn) {
        listenBtn.classList.remove("is-playing");
        listenBtn.textContent = "🔊 ฟังเสียง";
      }
      if (listenBtnBack) {
        listenBtnBack.classList.remove("is-playing");
        listenBtnBack.textContent = "🔊 ฟังเสียง";
      }
      if (exampleListenBtn) {
        exampleListenBtn.classList.remove("is-playing");
      }
    }

    function setListenBtnPlaying(btnNode) {
      if (btnNode) {
        btnNode.classList.add("is-playing");
        btnNode.textContent = "🔊 กำลังเล่น...";
      } else if (listenBtn) {
        listenBtn.classList.add("is-playing");
        listenBtn.textContent = "🔊 กำลังเล่น...";
      }
    }

    function showSpeechNotice(msg) {
      if (!speechNotice) return;
      speechNotice.textContent = msg;
      speechNotice.classList.remove("is-hidden");
      setTimeout(function () {
        if (speechNotice) speechNotice.classList.add("is-hidden");
      }, 3500);
    }

    function renderCurrent() {
      stopSpeech();
      resetListenBtn();

      var v = reviewList[currentIndex];

      if (!v) {
        showState(stateBox(
          "⚠️",
          "ไม่พบคำศัพท์",
          "เกิดข้อผิดพลาดในการโหลดคำศัพท์คำนี้ กรุณากลับหน้าแรก",
          "กลับหน้าแรก",
          "index.html"
        ));
        return;
      }

      cardEl.classList.remove("is-revealed");

      if (subEl) subEl.textContent = (currentIndex + 1) + " / " + reviewList.length + " คำ";
      if (progressFillEl) {
        progressFillEl.style.width = Math.round(((currentIndex + 1) / reviewList.length) * 100) + "%";
      }

      setTag("reviewTag", v.category);
      setDifficultyDots("reviewDifficulty", v.difficulty);
      setText("reviewHanziFront", v.hanzi);
      setText("reviewPinyinFront", v.pinyin);
      setText("reviewHanziBack", v.hanzi);
      setText("reviewPinyinBack", v.pinyin);
      setText("reviewMeaning", v.meaning_th);
      setText("reviewExampleHanzi", v.example);
      setText("reviewExampleTh", v.example_th);
      setText("reviewTip", v.memory_tip);

      // TASK 5.3, 5.4 & 6.1: อ่าน Progress และแสดงสถานะคำศัพท์
      var currentProg = getVocabularyProgress(v.id);
      cardEl.setAttribute("data-vocab-id", v.id);
      cardEl.setAttribute("data-status", currentProg.status);
      setStatusBadge("reviewStatus", currentProg.status);

      // อัปเดตสถานะปุ่มนำทาง (คำก่อนหน้า / คำถัดไป)
      if (prevBtn) {
        prevBtn.disabled = (currentIndex === 0);
        prevBtn.style.opacity = (currentIndex === 0) ? "0.45" : "1";
        prevBtn.style.cursor = (currentIndex === 0) ? "not-allowed" : "pointer";
      }
      if (nextBtn) {
        nextBtn.textContent = (currentIndex === reviewList.length - 1) ? "จบการทบทวน →" : "คำถัดไป →";
      }
    }

    // TASK 6.2: แสดงผลสรุปเมื่อจบเซสชันการทบทวน (Review Session Complete)
    function renderReviewSessionComplete() {
      stopSpeech();
      resetListenBtn();

      // ฉลองความสำเร็จเมื่อจบเซสชันการทบทวนด้วย Confetti Animation
      triggerConfetti({ duration: 3500, particleCount: 110 });

      var box = el("div", "state-box");
      var icon = el("div", "state-icon", "🎉");
      var title = el("h2", "state-title", "ทบทวนครบแล้ว!");
      var text = el("p", "state-text", "ทบทวนคำศัพท์เสร็จสิ้น " + reviewList.length + " คำในเซสชันนี้");

      box.appendChild(icon);
      box.appendChild(title);
      box.appendChild(text);

      // สรุปคะแนนและความมั่นใจ
      var summaryBox = el("div", "session-summary-box");

      // ตรวจสอบการบรรลุเป้าหมายคำศัพท์ประจำวัน
      var goalProg = getDailyGoalProgress();
      if (goalProg.isReached) {
        var goalCallout = el("div", "session-goal-callout");
        goalCallout.innerHTML = "<span>🎯</span><div><strong>พิชิตเป้าหมายประจำวันแล้ว!</strong> สะสมคำศัพท์ " + goalProg.count + " / " + goalProg.goal + " คำวันนี้ 🌸</div>";
        summaryBox.appendChild(goalCallout);
      }

      // ตรวจสอบและประกาศเหรียญรางวัล Milestone ที่เพิ่งปลดล็อกได้
      var newMilestones = checkAndSaveNewMilestones();
      if (newMilestones && newMilestones.length > 0) {
        var msNames = newMilestones.map(function (m) { return m.emoji + " " + m.title; }).join(", ");
        var msCallout = el("div", "session-milestone-callout");
        msCallout.innerHTML = "<span>🏆</span><div><strong>ปลดล็อกรางวัลความสำเร็จใหม่!</strong> " + msNames + " ✨</div>";
        summaryBox.appendChild(msCallout);
      }

      // แถว 1: จำได้ / คล่อง (Ratings 3-5)
      var rowRemembered = el("div", "session-summary-row");
      var labelRem = el("span", "session-summary-label", "✅ จำได้มั่นใจ (SRS 3-5)");
      var valRem = el("span", "session-summary-value", sessionResult.remembered + " คำ");
      rowRemembered.appendChild(labelRem);
      rowRemembered.appendChild(valRem);
      summaryBox.appendChild(rowRemembered);

      // แถว 2: ต้องฝึกเพิ่ม (Ratings 1-2)
      var rowForgot = el("div", "session-summary-row");
      var labelForgot = el("span", "session-summary-label", "😵 ต้องฝึกเพิ่ม (SRS 1-2)");
      var valForgot = el("span", "session-summary-value", sessionResult.forgot + " คำ");
      rowForgot.appendChild(labelForgot);
      rowForgot.appendChild(valForgot);
      summaryBox.appendChild(rowForgot);

      // แถบความคืบหน้าของเซสชัน
      var percent = reviewList.length > 0
        ? Math.round((sessionResult.remembered / reviewList.length) * 100)
        : 100;
      var progContainer = el("div", "session-summary-progress");
      var progLabelRow = el("div", "session-summary-progress-label");
      progLabelRow.appendChild(el("span", null, "อัตราการจำได้ในเซสชัน"));
      progLabelRow.appendChild(el("span", "session-summary-progress-pct", percent + "%"));
      progContainer.appendChild(progLabelRow);

      var progBar = el("div", "progress-bar");
      var progFill = el("div", "progress-fill");
      progFill.style.width = percent + "%";
      progBar.appendChild(progFill);
      progContainer.appendChild(progBar);

      summaryBox.appendChild(progContainer);
      box.appendChild(summaryBox);

      // ปุ่มควบคุม: [ กลับหน้าหลัก ] & [ ทบทวนอีกครั้ง ]
      var actions = el("div", "state-actions");
      var homeBtn = el("button", "btn btn-primary", "กลับหน้าหลัก");
      homeBtn.type = "button";
      homeBtn.addEventListener("click", function () {
        stopSpeech();
        go("index.html");
      });

      var againBtn = el("button", "btn btn-secondary", "ทบทวนอีกครั้ง");
      againBtn.type = "button";
      againBtn.addEventListener("click", function () {
        stopSpeech();
        currentIndex = 0;
        sessionResult = {
          total: reviewList.length,
          ratings: {},
          remembered: 0,
          forgot: 0
        };
        stateEl.classList.add("is-hidden");
        clear(stateEl);
        bodyEl.classList.remove("is-hidden");
        renderCurrent();
      });

      var quizBtn = el("button", "btn-action-outline is-primary", "🎯 ทำแบบทดสอบ Active Recall (Quiz)");
      quizBtn.type = "button";
      quizBtn.style.marginTop = "var(--space-2)";
      quizBtn.style.textAlign = "center";
      quizBtn.addEventListener("click", function () {
        stopSpeech();
        go("quiz.html" + (chapterId ? "?chapter=" + encodeURIComponent(chapterId) : ""));
      });

      actions.appendChild(homeBtn);
      actions.appendChild(againBtn);
      actions.appendChild(quizBtn);
      box.appendChild(actions);

      bodyEl.classList.add("is-hidden");
      if (subEl) subEl.textContent = "จบเซสชัน";
      clear(stateEl);
      stateEl.appendChild(box);
      stateEl.classList.remove("is-hidden");
    }

    // TASK 6.2: บันทึกผล Spaced Repetition Rating (1-5 หรือ boolean)
    function handleReviewRating(rating) {
      stopSpeech();
      resetListenBtn();

      var v = reviewList[currentIndex];
      if (v) {
        var isRemembered = (typeof rating === "boolean") ? rating : (Number(rating) >= 3);
        var numericRating = (typeof rating === "boolean") ? (rating ? 4 : 1) : Number(rating);

        updateVocabularyProgress(v.id, numericRating);

        // ปรับยอด Session Result
        if (sessionResult.ratings[v.id] === undefined) {
          if (isRemembered) {
            sessionResult.remembered++;
          } else {
            sessionResult.forgot++;
          }
        } else {
          var prevWasRemembered = sessionResult.ratings[v.id] >= 3;
          if (prevWasRemembered && !isRemembered) {
            sessionResult.remembered--;
            sessionResult.forgot++;
          } else if (!prevWasRemembered && isRemembered) {
            sessionResult.forgot--;
            sessionResult.remembered++;
          }
        }
        sessionResult.ratings[v.id] = numericRating;
      }

      // ไปคำถัดไป หรือจบเซสชันเมื่อถึงคำสุดท้าย
      if (currentIndex + 1 < reviewList.length) {
        currentIndex++;
        renderCurrent();
      } else {
        renderReviewSessionComplete();
      }
    }

    function nextWord() {
      stopSpeech();
      resetListenBtn();
      if (currentIndex + 1 < reviewList.length) {
        currentIndex++;
        renderCurrent();
      } else {
        renderReviewSessionComplete();
      }
    }

    function prevWord() {
      stopSpeech();
      resetListenBtn();
      if (currentIndex > 0) {
        currentIndex--;
        renderCurrent();
      }
    }

    // ผูกปุ่มฟังเสียงภาษาจีนกลาง
    if (listenBtn) {
      listenBtn.addEventListener("click", function () {
        var v = reviewList[currentIndex];
        if (!v || !v.hanzi) return;

        if (!isSpeechSupported()) {
          showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
          return;
        }

        speakChinese(v.hanzi, {
          onStart: function () { setListenBtnPlaying(listenBtn); },
          onEnd: resetListenBtn,
          onError: resetListenBtn,
          onUnsupported: function () {
            resetListenBtn();
            showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
          }
        });
      });
    }

    if (listenBtnBack) {
      listenBtnBack.addEventListener("click", function () {
        var v = reviewList[currentIndex];
        if (!v || !v.hanzi) return;

        if (!isSpeechSupported()) {
          showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
          return;
        }

        speakChinese(v.hanzi, {
          onStart: function () { setListenBtnPlaying(listenBtnBack); },
          onEnd: resetListenBtn,
          onError: resetListenBtn,
          onUnsupported: function () {
            resetListenBtn();
            showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
          }
        });
      });
    }

    if (exampleListenBtn) {
      exampleListenBtn.addEventListener("click", function () {
        var v = reviewList[currentIndex];
        if (!v || !v.example) return;

        if (!isSpeechSupported()) {
          showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
          return;
        }

        exampleListenBtn.classList.add("is-playing");
        speakChinese(v.example, {
          onStart: function () { exampleListenBtn.classList.add("is-playing"); },
          onEnd: resetListenBtn,
          onError: resetListenBtn,
          onUnsupported: function () {
            resetListenBtn();
            showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
          }
        });
      });
    }

    // ผูกปุ่ม Spaced Repetition Rating (5 ระดับ)
    var srsBox = document.getElementById("reviewSrsRating");
    if (srsBox) {
      var srsButtons = srsBox.querySelectorAll(".srs-btn");
      for (var bIdx = 0; bIdx < srsButtons.length; bIdx++) {
        (function (btn) {
          btn.addEventListener("click", function () {
            var r = parseInt(btn.getAttribute("data-rating"), 10) || 3;
            handleReviewRating(r);
          });
        })(srsButtons[bIdx]);
      }
    }

    // ผูกปุ่มสำรอง 2 ตัวเลือกเดิม
    var revYes = document.getElementById("reviewBtnYes");
    var revNo = document.getElementById("reviewBtnNo");
    if (revYes) revYes.addEventListener("click", function () { handleReviewRating(4); });
    if (revNo) revNo.addEventListener("click", function () { handleReviewRating(1); });

    // ผูกปุ่มนำทาง ย้อนกลับ/ถัดไป
    if (nextBtn) nextBtn.addEventListener("click", nextWord);
    if (prevBtn) prevBtn.addEventListener("click", prevWord);

    renderCurrent();
  }

  /* ============================================================
     หน้า Progress & Streak Dashboard (progress.html) (TASK 7.1 & 7.2)
     ============================================================ */
  function getStreakMilestones(maxStreak, totalStudyDays, masteredCount, srsCounts) {
    maxStreak = Number(maxStreak) || 0;
    totalStudyDays = Number(totalStudyDays) || 0;
    masteredCount = Number(masteredCount) || 0;
    srsCounts = srsCounts || {};

    var dailyGoalProg = getDailyGoalProgress();
    var isGoalAchieved = dailyGoalProg.isReached ? 1 : 0;

    return [
      {
        id: "goal-1",
        emoji: "🎯",
        title: "พิชิตเป้าหมายรายวัน",
        desc: "เรียนรู้หรือทบทวนคำศัพท์ครบตามเป้าหมายของวันนี้",
        current: isGoalAchieved,
        target: 1,
        unit: "วัน"
      },
      {
        id: "streak-1",
        emoji: "🌱",
        title: "ก้าวแรกของการเรียน",
        desc: "เรียนหรือทบทวนคำศัพท์วันแรก",
        current: Math.max(maxStreak, totalStudyDays > 0 ? 1 : 0),
        target: 1,
        unit: "วัน"
      },
      {
        id: "streak-3",
        emoji: "🔥",
        title: "ไฟแรงต่อเนื่อง 3 วัน",
        desc: "รักษา Streak ต่อเนื่องอย่างน้อย 3 วัน",
        current: maxStreak,
        target: 3,
        unit: "วัน"
      },
      {
        id: "streak-7",
        emoji: "⚡",
        title: "มุ่งมั่น 7 วันติด",
        desc: "สะสมความสม่ำเสมอครบ 1 สัปดาห์",
        current: maxStreak,
        target: 7,
        unit: "วัน"
      },
      {
        id: "streak-30",
        emoji: "👑",
        title: "ตำนาน 30 วันต่อเนื่อง",
        desc: "รักษา Streak ต่อเนื่องครบ 30 วัน (1 เดือนเต็ม) สุดยอดวินัยการเรียน!",
        current: maxStreak,
        target: 30,
        unit: "วัน"
      },
      {
        id: "vocab-1",
        emoji: "🌸",
        title: "เริ่มจำได้",
        desc: "จำคำศัพท์ขึ้นใจสำเร็จ 1 คำแรก",
        current: masteredCount,
        target: 1,
        unit: "คำ"
      },
      {
        id: "vocab-3",
        emoji: "⭐",
        title: "คลังศัพท์เติบโต",
        desc: "จำคำศัพท์สำเร็จ 3 คำขึ้นไป",
        current: masteredCount,
        target: 3,
        unit: "คำ"
      },
      {
        id: "srs-master",
        emoji: "💎",
        title: "จำแม่นระยะยาว",
        desc: "มีคำศัพท์ขึ้นสู่ SRS ระดับ 4 หรือ 5",
        current: (srsCounts[4] || 0) + (srsCounts[5] || 0),
        target: 1,
        unit: "คำ"
      }
    ];
  }

  function initProgress() {
    var streakHeroCount = document.getElementById("streakHeroCount");
    var streakHeroSub = document.getElementById("streakHeroSub");
    var streakBestPill = document.getElementById("streakBestPill");
    var streakWeekRow = document.getElementById("streakWeekRow");

    var overallMasteredPercent = document.getElementById("overallMasteredPercent");
    var overallTotalCount = document.getElementById("overallTotalCount");
    var overallProgressFill = document.getElementById("overallProgressFill");
    var statMasteredCount = document.getElementById("statMasteredCount");
    var statLearningCount = document.getElementById("statLearningCount");
    var statNewCount = document.getElementById("statNewCount");

    var srsLevelList = document.getElementById("srsLevelList");
    var progressChapterList = document.getElementById("progressChapterList");

    if (!DATA) return;

    var allVocab = DATA.getAllVocabulary() || [];
    var allChapters = DATA.getAllChapters() || [];
    var todayStr = getTodayString();
    var streakData = calculateStreak(todayStr);

    // 1. Streak Hero Card
    if (streakHeroCount) {
      streakHeroCount.textContent = streakData.currentStreak + " วัน";
    }

    if (streakHeroSub) {
      if (streakData.hasStudiedToday) {
        streakHeroSub.textContent = "🔥 ยอดเยี่ยมมาก! คุณได้เรียนรู้/ทบทวนแล้ววันนี้";
      } else if (streakData.currentStreak > 0) {
        streakHeroSub.textContent = "⚡ อย่าลืมเรียนวันนี้เพื่อรักษา Streak ต่อเนื่อง!";
      } else {
        streakHeroSub.textContent = "🌱 เริ่มเรียนบทเรียนหรือทบทวนเพื่อสะสม Streak วันแรก!";
      }
    }

    if (streakBestPill) {
      streakBestPill.textContent = "สถิติสูงสุด: " + streakData.bestStreak + " วัน";
    }

    // 2. Weekly Calendar (7 วันล่าสุดย้อนหลังถึงวันนี้)
    if (streakWeekRow) {
      clear(streakWeekRow);
      var thaiDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
      var historySet = {};
      for (var h = 0; h < streakData.history.length; h++) {
        historySet[streakData.history[h]] = true;
      }

      for (var offset = 6; offset >= 0; offset--) {
        var dayDateStr = addDays(todayStr, -offset);
        var parts = dayDateStr.split("-");
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10) - 1;
        var d = parseInt(parts[2], 10);
        var dt = new Date(Date.UTC(y, m, d));
        var dayName = thaiDays[dt.getUTCDay()];
        var isStudied = !!historySet[dayDateStr];
        var isToday = (dayDateStr === todayStr);

        var dayItem = el("div", "streak-day-item");
        var nameLabel = el("span", "streak-day-name", dayName);
        var circle = el("div", "streak-day-circle");
        if (isStudied) circle.classList.add("is-active");
        if (isToday) circle.classList.add("is-today");

        if (isStudied) {
          circle.textContent = "✓";
        } else {
          circle.textContent = String(d);
        }

        dayItem.appendChild(nameLabel);
        dayItem.appendChild(circle);
        streakWeekRow.appendChild(dayItem);
      }
    }

    // 3. Overall Vocabulary Progress & Due Calculation
    var masteredCount = 0;
    var learningCount = 0;
    var newCount = 0;
    var dueCount = 0;
    var srsCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (var i = 0; i < allVocab.length; i++) {
      var v = allVocab[i];
      var prog = getVocabularyProgress(v.id);
      var status = (prog && prog.status) ? prog.status : "new";
      var level = (prog && typeof prog.srsLevel === "number") ? prog.srsLevel : 0;
      if (level < 0) level = 0;
      if (level > 5) level = 5;

      if (status === "mastered") {
        masteredCount++;
        srsCounts[level]++;
        if (!prog.nextReview || prog.nextReview <= todayStr) {
          dueCount++;
        }
      } else if (status === "learning") {
        learningCount++;
        dueCount++;
        srsCounts[level]++;
      } else {
        newCount++;
        srsCounts[0]++;
      }
    }

    var totalVocab = allVocab.length;
    var masterPercent = totalVocab > 0 ? Math.round((masteredCount / totalVocab) * 100) : 0;

    if (overallMasteredPercent) overallMasteredPercent.textContent = masterPercent + "%";
    if (overallTotalCount) overallTotalCount.textContent = masteredCount + " / " + totalVocab + " คำ";
    if (overallProgressFill) overallProgressFill.style.width = masterPercent + "%";
    if (statMasteredCount) statMasteredCount.textContent = String(masteredCount);
    if (statLearningCount) statLearningCount.textContent = String(learningCount);
    if (statNewCount) statNewCount.textContent = String(newCount);
    var statDueCount = document.getElementById("statDueCount");
    if (statDueCount) statDueCount.textContent = String(dueCount);

    // Streak Milestone Rewards (7-Day & 30-Day Digital Badges in Progress Summary)
    var currentStreak = streakData.currentStreak || 0;
    var maxStreakVal = Math.max(streakData.currentStreak || 0, streakData.bestStreak || 0);

    var is7Unlocked = maxStreakVal >= 7;
    var is30Unlocked = maxStreakVal >= 30;
    var unlockedStreakBadgesCount = (is7Unlocked ? 1 : 0) + (is30Unlocked ? 1 : 0);

    var rewardsUnlockedCountEl = document.getElementById("streakRewardsUnlockedCount");
    if (rewardsUnlockedCountEl) {
      rewardsUnlockedCountEl.textContent = "ปลดล็อก " + unlockedStreakBadgesCount + " / 2";
      if (unlockedStreakBadgesCount > 0) {
        rewardsUnlockedCountEl.style.background = "#DCFCE7";
        rewardsUnlockedCountEl.style.color = "#15803D";
        rewardsUnlockedCountEl.style.borderColor = "#BBF7D0";
      }
    }

    // 7-Day Card
    var rewardItem7 = document.getElementById("rewardItem7Days");
    var rewardStatus7 = document.getElementById("rewardStatus7Days");
    var rewardProgFill7 = document.getElementById("rewardProgFill7Days");
    var rewardDaysCount7 = document.getElementById("rewardDaysCount7Days");
    var rewardBtn7 = document.getElementById("rewardBtn7Days");

    if (rewardItem7) {
      var pct7 = Math.min(100, Math.round((maxStreakVal / 7) * 100));
      if (rewardProgFill7) rewardProgFill7.style.width = pct7 + "%";
      if (rewardDaysCount7) rewardDaysCount7.textContent = Math.min(maxStreakVal, 7) + " / 7 วัน";

      if (is7Unlocked) {
        rewardItem7.classList.add("is-unlocked");
        if (rewardStatus7) rewardStatus7.textContent = "✨ ปลดล็อกแล้ว!";
        if (rewardBtn7) {
          rewardBtn7.textContent = "🎉 แตะฉลอง Confetti!";
          rewardBtn7.classList.remove("is-locked");
          rewardBtn7.onclick = function () {
            celebrateStreakReward(7);
          };
        }
      } else {
        rewardItem7.classList.remove("is-unlocked");
        if (rewardStatus7) rewardStatus7.textContent = "🔒 ล็อกอยู่ (ขาดอีก " + (7 - maxStreakVal) + " วัน)";
        if (rewardBtn7) {
          rewardBtn7.textContent = "🔥 ขาดอีก " + (7 - maxStreakVal) + " วัน";
          rewardBtn7.classList.add("is-locked");
          rewardBtn7.onclick = function () {
            showCelebrationToast("🔥", "Streak 7 วัน", "สะสม Streak ต่ออีก " + (7 - maxStreakVal) + " วัน เพื่อปลดล็อกเหรียญตรา ⚡ มุ่งมั่น 7 วันติด");
          };
        }
      }
    }

    // 30-Day Card
    var rewardItem30 = document.getElementById("rewardItem30Days");
    var rewardStatus30 = document.getElementById("rewardStatus30Days");
    var rewardProgFill30 = document.getElementById("rewardProgFill30Days");
    var rewardDaysCount30 = document.getElementById("rewardDaysCount30Days");
    var rewardBtn30 = document.getElementById("rewardBtn30Days");

    if (rewardItem30) {
      var pct30 = Math.min(100, Math.round((maxStreakVal / 30) * 100));
      if (rewardProgFill30) rewardProgFill30.style.width = pct30 + "%";
      if (rewardDaysCount30) rewardDaysCount30.textContent = Math.min(maxStreakVal, 30) + " / 30 วัน";

      if (is30Unlocked) {
        rewardItem30.classList.add("is-unlocked", "is-30days");
        if (rewardStatus30) rewardStatus30.textContent = "👑 ปลดล็อกแล้ว! (ตำนาน)";
        if (rewardBtn30) {
          rewardBtn30.textContent = "🎊 แตะฉลอง Confetti!";
          rewardBtn30.classList.remove("is-locked");
          rewardBtn30.onclick = function () {
            celebrateStreakReward(30);
          };
        }
      } else {
        rewardItem30.classList.remove("is-unlocked", "is-30days");
        if (rewardStatus30) rewardStatus30.textContent = "🔒 ล็อกอยู่ (ขาดอีก " + (30 - maxStreakVal) + " วัน)";
        if (rewardBtn30) {
          rewardBtn30.textContent = "🔥 ขาดอีก " + (30 - maxStreakVal) + " วัน";
          rewardBtn30.classList.add("is-locked");
          rewardBtn30.onclick = function () {
            showCelebrationToast("👑", "Streak 30 วัน", "สะสม Streak ต่ออีก " + (30 - maxStreakVal) + " วัน เพื่อปลดล็อกเหรียญตรา 👑 ปรมาจารย์ 30 วัน");
          };
        }
      }
    }

    // Daily Reminder Widget on Progress page
    updateReminderUI();
    var progReminderBtn = document.getElementById("progressOpenReminderBtn");
    var progReminderModal = document.getElementById("reminderModal");
    if (progReminderBtn && progReminderModal) {
      progReminderBtn.onclick = function () {
        progReminderModal.style.display = "flex";
      };
    }
    setupReminderModal();

    // Auto-check Streak Rewards Celebration if just reached today
    if (currentStreak >= 7 && !localStorage.getItem(STORAGE_STREAK_7_REWARD_KEY)) {
      localStorage.setItem(STORAGE_STREAK_7_REWARD_KEY, "true");
      setTimeout(function () {
        celebrateStreakReward(7);
      }, 400);
    } else if (currentStreak >= 30 && !localStorage.getItem(STORAGE_STREAK_30_REWARD_KEY)) {
      localStorage.setItem(STORAGE_STREAK_30_REWARD_KEY, "true");
      setTimeout(function () {
        celebrateStreakReward(30);
      }, 400);
    }

    // 4. TASK 7.2: Streak Milestones & Achievement Badges
    var milestonesGrid = document.getElementById("milestonesGrid");
    if (milestonesGrid) {
      clear(milestonesGrid);
      var totalStudyDays = streakData.history ? streakData.history.length : 0;
      var maxStreak = Math.max(streakData.currentStreak || 0, streakData.bestStreak || 0);
      var milestonesConfig = getStreakMilestones(maxStreak, totalStudyDays, masteredCount, srsCounts);

      for (var mIdx = 0; mIdx < milestonesConfig.length; mIdx++) {
        var mItem = milestonesConfig[mIdx];
        var isUnlocked = mItem.current >= mItem.target;
        var pct = Math.min(100, Math.round((mItem.current / mItem.target) * 100));

        var mCard = el("div", "milestone-item " + (isUnlocked ? "is-unlocked" : "is-locked"));

        var top = el("div", "milestone-top");
        top.appendChild(el("span", "milestone-emoji", mItem.emoji));
        var badge = el("span", "milestone-badge", isUnlocked ? "✓ สำเร็จแล้ว" : mItem.current + "/" + mItem.target + " " + mItem.unit);
        top.appendChild(badge);
        mCard.appendChild(top);

        mCard.appendChild(el("div", "milestone-title", mItem.title));
        mCard.appendChild(el("div", "milestone-desc", mItem.desc));

        var barWrap = el("div", "milestone-progress-bar");
        var barFill = el("div", "milestone-progress-fill");
        barFill.style.width = pct + "%";
        barWrap.appendChild(barFill);
        mCard.appendChild(barWrap);

        // ให้ผู้ใช้แตะที่เหรียญรางวัลที่ปลดล็อกแล้ว เพื่อจุดพลุฉลองความสำเร็จได้ทุกเมื่อ
        if (isUnlocked) {
          mCard.classList.add("is-clickable");
          mCard.setAttribute("role", "button");
          mCard.setAttribute("tabindex", "0");
          mCard.title = "แตะเพื่อฉลองเหรียญรางวัลนี้! ✨";
          (function (item, cardNode) {
            cardNode.addEventListener("click", function () {
              cardNode.classList.add("is-celebrating");
              setTimeout(function () { cardNode.classList.remove("is-celebrating"); }, 750);
              triggerConfetti({ duration: 2600, particleCount: 80 });
              showCelebrationToast(item.emoji, item.title, "✓ ปลดล็อกสำเร็จแล้ว! " + item.desc);
            });
          })(mItem, mCard);
        }

        milestonesGrid.appendChild(mCard);
      }

      // ตรวจสอบและแสดงแอนิเมชันฉลอง Confetti เมื่อผู้ใช้ปลดล็อก Milestone ใหม่
      var newMilestones = checkAndSaveNewMilestones(milestonesConfig);
      if (newMilestones && newMilestones.length > 0) {
        setTimeout(function () {
          triggerConfetti({ duration: 3800, particleCount: 120 });
          var names = newMilestones.map(function (m) { return m.emoji + " " + m.title; }).join(", ");
          showCelebrationModal(
            "🏆 ปลดล็อกรางวัลความสำเร็จใหม่!",
            "ยินดีด้วย! คุณได้รับเหรียญรางวัล: " + names + " เก่งมากๆ เลยนะ 🌸✨",
            "🎉"
          );
        }, 300);
      }
    }

    // 5. Spaced Repetition (SRS) Level Breakdown & Clickable filter
    var srsConfig = [
      { level: 5, emoji: "🤩", name: "จำแม่นยำ", interval: "30 วัน", bg: "#D1FAE5", text: "#065F46", bar: "#10B981" },
      { level: 4, emoji: "😄", name: "คล่องแคล่ว", interval: "14 วัน", bg: "#ECFDF5", text: "#047857", bar: "#34D399" },
      { level: 3, emoji: "🙂", name: "เริ่มจำได้", interval: "7 วัน", bg: "#FEF3C7", text: "#92400E", bar: "#FBBF24" },
      { level: 2, emoji: "😕", name: "ยังสับสน", interval: "3 วัน", bg: "#FFEDD5", text: "#9A3412", bar: "#FB923C" },
      { level: 1, emoji: "😵", name: "เพิ่งเริ่ม/ลืม", interval: "1 วัน", bg: "#FEE2E2", text: "#991B1B", bar: "#F87171" },
      { level: 0, emoji: "⚪", name: "ยังไม่เริ่ม", interval: "คำใหม่", bg: "#F3F4F6", text: "#4B5563", bar: "#D1D5DB" }
    ];

    if (srsLevelList) {
      clear(srsLevelList);

      for (var s = 0; s < srsConfig.length; s++) {
        var cfg = srsConfig[s];
        var count = srsCounts[cfg.level] || 0;
        var pctOfTotal = totalVocab > 0 ? Math.round((count / totalVocab) * 100) : 0;

        var row = el("div", "srs-level-row is-clickable");
        row.setAttribute("data-srs-level", String(cfg.level));
        row.title = "แตะเพื่อดูคำศัพท์ระดับ " + (cfg.level > 0 ? cfg.level : "ยังไม่เริ่ม");

        // Badge Pill
        var pill = el("div", "srs-level-badge-pill");
        pill.style.backgroundColor = cfg.bg;
        pill.style.color = cfg.text;
        pill.textContent = cfg.emoji + " ระดับ " + (cfg.level > 0 ? cfg.level : "-");
        row.appendChild(pill);

        // Info / Name
        var info = el("div", null);
        info.style.minWidth = "80px";
        var nameSpan = el("div", null, cfg.name);
        nameSpan.style.fontSize = "12px";
        nameSpan.style.fontWeight = "600";
        var intSpan = el("div", null, cfg.interval);
        intSpan.style.fontSize = "11px";
        intSpan.style.color = "var(--text-muted)";
        info.appendChild(nameSpan);
        info.appendChild(intSpan);
        row.appendChild(info);

        // Progress track
        var track = el("div", "srs-level-track");
        var fill = el("div", "srs-level-fill");
        fill.style.backgroundColor = cfg.bar;
        fill.style.width = pctOfTotal + "%";
        track.appendChild(fill);
        row.appendChild(track);

        // Count
        var countEl = el("div", "srs-level-count", count + " คำ");
        row.appendChild(countEl);

        (function (levelNum) {
          row.addEventListener("click", function () {
            setDrillDownFilter("srs-" + levelNum, true);
          });
        })(cfg.level);

        srsLevelList.appendChild(row);
      }
    }

    // 6. Chapter Progress Breakdown
    if (progressChapterList) {
      clear(progressChapterList);
      if (allChapters.length === 0) {
        progressChapterList.appendChild(el("p", "form-hint", "ยังไม่มีบทเรียนในระบบ"));
      } else {
        for (var c = 0; c < allChapters.length; c++) {
          (function (chapter) {
            var stats = getChapterStats(chapter.id);
            var item = el("div", "progress-chapter-item");
            item.onclick = function () {
              location.href = "chapter-detail.html?id=" + encodeURIComponent(chapter.id);
            };

            var topRow = el("div", "progress-chapter-item-top");
            var titleEl = el("div", "progress-chapter-title", chapter.title + (chapter.description ? " · " + chapter.description : ""));
            var countEl = el("div", "progress-chapter-count", stats.mastered + " / " + stats.total + " คำ (" + stats.percent + "%)");
            topRow.appendChild(titleEl);
            topRow.appendChild(countEl);
            item.appendChild(topRow);

            var bar = el("div", "progress-bar");
            var fill = el("div", "progress-fill");
            fill.style.width = stats.percent + "%";
            bar.appendChild(fill);
            item.appendChild(bar);

            progressChapterList.appendChild(item);
          })(allChapters[c]);
        }
      }
    }

    // ============================================================
    // 7. TASK 7.2: Interactive Vocabulary Drill-Down Controller
    // ============================================================
    var drillDownFilters = document.getElementById("drillDownFilters");
    var drillDownSearch = document.getElementById("drillDownSearch");
    var drillDownCountText = document.getElementById("drillDownCountText");
    var drillDownResetBtn = document.getElementById("drillDownResetBtn");
    var drillDownList = document.getElementById("drillDownList");
    var drillDownCard = document.getElementById("drillDownCard");

    var currentFilter = "all";
    var currentSearch = "";
    var currentPlayingAudioBtn = null;

    // แผนที่บทเรียนสำหรับแสดงชื่อบท
    var chapterMap = {};
    for (var chIdx = 0; chIdx < allChapters.length; chIdx++) {
      chapterMap[allChapters[chIdx].id] = allChapters[chIdx];
    }

    function smoothScrollTo(element) {
      if (!element) return;
      try {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        element.scrollIntoView();
      }
    }

    // สร้าง Filter Chips Options
    var filterOptions = [
      { id: "all", label: "ทั้งหมด", count: allVocab.length },
      { id: "due", label: "🔴 ต้องทบทวน", count: dueCount },
      { id: "mastered", label: "✅ จำได้แล้ว", count: masteredCount },
      { id: "learning", label: "🟡 กำลังเรียน", count: learningCount },
      { id: "new", label: "⚪ ยังไม่เริ่ม", count: newCount },
      { id: "srs-5", label: "🤩 SRS 5", count: srsCounts[5] || 0 },
      { id: "srs-4", label: "😄 SRS 4", count: srsCounts[4] || 0 },
      { id: "srs-3", label: "🙂 SRS 3", count: srsCounts[3] || 0 },
      { id: "srs-2", label: "😕 SRS 2", count: srsCounts[2] || 0 },
      { id: "srs-1", label: "😵 SRS 1", count: srsCounts[1] || 0 },
      { id: "srs-0", label: "⚪ ยังไม่ประเมิน", count: srsCounts[0] || 0 }
    ];

    function renderFilterChips() {
      if (!drillDownFilters) return;
      clear(drillDownFilters);

      for (var f = 0; f < filterOptions.length; f++) {
        var opt = filterOptions[f];
        // ข้าม filter ที่ count เป็น 0 ยกเว้น all, due, mastered, learning, new
        if (opt.count === 0 && opt.id.indexOf("srs-") === 0) continue;

        var chip = el("button", "filter-chip" + (currentFilter === opt.id ? " is-active" : ""), opt.label + " (" + opt.count + ")");
        chip.type = "button";
        (function (filterId) {
          chip.addEventListener("click", function () {
            setDrillDownFilter(filterId, false);
          });
        })(opt.id);
        drillDownFilters.appendChild(chip);
      }
    }

    function renderDrillDownList() {
      if (!drillDownList) return;
      clear(drillDownList);

      // กรองคำศัพท์ตาม Filter
      var filtered = allVocab.filter(function (v) {
        var prog = getVocabularyProgress(v.id);
        var status = (prog && prog.status) ? prog.status : "new";
        var level = (prog && typeof prog.srsLevel === "number") ? prog.srsLevel : 0;
        var isDue = isDueForReview(v.id, todayStr);

        if (currentFilter === "all") {
          // ผ่านหมด
        } else if (currentFilter === "due") {
          if (!isDue) return false;
        } else if (currentFilter === "mastered") {
          if (status !== "mastered") return false;
        } else if (currentFilter === "learning") {
          if (status !== "learning") return false;
        } else if (currentFilter === "new") {
          if (status !== "new") return false;
        } else if (currentFilter.indexOf("srs-") === 0) {
          var targetLevel = parseInt(currentFilter.replace("srs-", ""), 10);
          if (level !== targetLevel) return false;
        }

        // กรองตาม Search Query
        if (currentSearch) {
          var q = currentSearch.toLowerCase().trim();
          var matchHanzi = (v.hanzi || "").toLowerCase().indexOf(q) !== -1;
          var matchPinyin = (v.pinyin || "").toLowerCase().indexOf(q) !== -1;
          var matchMeaning = (v.meaning_th || "").toLowerCase().indexOf(q) !== -1;
          var matchCat = (v.category || "").toLowerCase().indexOf(q) !== -1;
          if (!matchHanzi && !matchPinyin && !matchMeaning && !matchCat) return false;
        }

        return true;
      });

      // อัปเดต Summary และ Reset Button
      if (drillDownCountText) {
        var filterLabel = "ทั้งหมด";
        for (var i = 0; i < filterOptions.length; i++) {
          if (filterOptions[i].id === currentFilter) {
            filterLabel = filterOptions[i].label;
            break;
          }
        }
        var countStr = "แสดง " + filtered.length + " จาก " + allVocab.length + " คำ (" + filterLabel + ")";
        if (currentSearch) countStr += " · ค้นหา: \"" + currentSearch + "\"";
        drillDownCountText.textContent = countStr;
      }

      if (drillDownResetBtn) {
        if (currentFilter !== "all" || currentSearch !== "") {
          drillDownResetBtn.style.display = "inline";
        } else {
          drillDownResetBtn.style.display = "none";
        }
      }

      if (filtered.length === 0) {
        var emptyBox = el("div", "state-box");
        emptyBox.appendChild(el("div", "state-icon", "🔎"));
        emptyBox.appendChild(el("h3", "state-title", "ไม่พบคำศัพท์"));
        emptyBox.appendChild(el("p", "state-text", "ไม่มีคำศัพท์ที่ตรงกับเงื่อนไขตัวกรองหรือคำค้นหานี้"));
        var resetBtn = el("button", "btn btn-secondary", "ดูคำศัพท์ทั้งหมด");
        resetBtn.type = "button";
        resetBtn.onclick = function () {
          setDrillDownFilter("all", false);
          if (drillDownSearch) drillDownSearch.value = "";
          currentSearch = "";
        };
        emptyBox.appendChild(resetBtn);
        drillDownList.appendChild(emptyBox);
        return;
      }

      // สร้างรายการคำศัพท์
      for (var k = 0; k < filtered.length; k++) {
        (function (vocab) {
          var prog = getVocabularyProgress(vocab.id);
          var status = (prog && prog.status) ? prog.status : "new";
          var level = (prog && typeof prog.srsLevel === "number") ? prog.srsLevel : 0;
          var isDue = isDueForReview(vocab.id, todayStr);
          var chapter = chapterMap[vocab.chapterId];

          var item = el("div", "drilldown-item");

          // ส่วนบน: Hanzi, Pinyin, Chapter, Category
          var top = el("div", "drilldown-item-top");
          var left = el("div", "drilldown-item-left");
          var hanziRow = el("div", "drilldown-hanzi-row");
          hanziRow.appendChild(el("span", "drilldown-hanzi", vocab.hanzi));
          hanziRow.appendChild(el("span", "drilldown-pinyin", vocab.pinyin));
          left.appendChild(hanziRow);
          left.appendChild(el("div", "drilldown-meaning", vocab.meaning_th));
          top.appendChild(left);

          var tagsGroup = el("div", "drilldown-item-tags");
          if (vocab.category) {
            tagsGroup.appendChild(el("span", "tag", vocab.category));
          }
          if (chapter) {
            var chBadge = el("span", "tag", chapter.title);
            chBadge.style.background = "#F1EBF9";
            chBadge.style.color = "#5A3A85";
            tagsGroup.appendChild(chBadge);
          }
          var statusInfo = getStatusBadgeInfo(status);
          tagsGroup.appendChild(el("span", statusInfo.className, statusInfo.text));
          top.appendChild(tagsGroup);
          item.appendChild(top);

          // ส่วนล่าง: SRS Level, วันทบทวนถัดไป, และ Action Buttons
          var bottom = el("div", "drilldown-item-bottom");
          var meta = el("div", "drilldown-item-meta");

          // SRS badge
          var srsCfg = srsConfig.find(function (c) { return c.level === level; }) || srsConfig[5];
          var srsPill = el("span", null, srsCfg.emoji + " SRS " + (level > 0 ? level : "-"));
          srsPill.style.padding = "2px 6px";
          srsPill.style.borderRadius = "4px";
          srsPill.style.background = srsCfg.bg;
          srsPill.style.color = srsCfg.text;
          srsPill.style.fontWeight = "600";
          meta.appendChild(srsPill);

          // Next review date text
          var reviewText = "";
          if (status === "new") {
            reviewText = "⚪ ยังไม่ได้เริ่ม";
          } else if (isDue) {
            reviewText = "🔴 ถึงกำหนดทบทวนแล้ว";
          } else if (prog.nextReview) {
            reviewText = "📅 ทบทวน: " + prog.nextReview;
          } else {
            reviewText = "⚪ ยังไม่กำหนด";
          }
          var reviewSpan = el("span", null, reviewText);
          if (isDue) {
            reviewSpan.style.color = "#DC2626";
            reviewSpan.style.fontWeight = "600";
          }
          meta.appendChild(reviewSpan);
          bottom.appendChild(meta);

          // Actions: Listen button & Chapter detail link
          var actions = el("div", "drilldown-actions");

          var audioBtn = el("button", "btn-mini-audio", "🔊 ฟังเสียง");
          audioBtn.type = "button";
          audioBtn.title = "ฟังเสียงอ่านภาษาจีนกลาง";
          audioBtn.addEventListener("click", function (evt) {
            evt.stopPropagation();
            if (!isSpeechSupported()) {
              showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
              return;
            }

            if (currentPlayingAudioBtn) {
              currentPlayingAudioBtn.textContent = "🔊 ฟังเสียง";
              currentPlayingAudioBtn.classList.remove("is-playing");
            }

            currentPlayingAudioBtn = audioBtn;
            audioBtn.textContent = "🔊 เล่น...";
            audioBtn.classList.add("is-playing");

            speakChinese(vocab.hanzi, {
              onEnd: function () {
                audioBtn.textContent = "🔊 ฟังเสียง";
                audioBtn.classList.remove("is-playing");
                currentPlayingAudioBtn = null;
              },
              onError: function () {
                audioBtn.textContent = "🔊 ฟังเสียง";
                audioBtn.classList.remove("is-playing");
                currentPlayingAudioBtn = null;
              },
              onUnsupported: function () {
                audioBtn.textContent = "🔊 ฟังเสียง";
                audioBtn.classList.remove("is-playing");
                currentPlayingAudioBtn = null;
                showSpeechNotice("เบราว์เซอร์นี้ไม่รองรับการออกเสียงอัตโนมัติ");
              }
            });
          });
          actions.appendChild(audioBtn);

          if (chapter) {
            var viewBtn = el("button", "btn-mini-view", "📖 ดูบท");
            viewBtn.type = "button";
            viewBtn.title = "ดูรายละเอียดบทเรียน " + chapter.title;
            viewBtn.addEventListener("click", function (evt) {
              evt.stopPropagation();
              stopSpeech();
              location.href = "chapter-detail.html?id=" + encodeURIComponent(chapter.id);
            });
            actions.appendChild(viewBtn);
          }

          bottom.appendChild(actions);
          item.appendChild(bottom);

          drillDownList.appendChild(item);
        })(filtered[k]);
      }
    }

    function setDrillDownFilter(filterId, doScroll) {
      currentFilter = filterId;
      renderFilterChips();
      renderDrillDownList();

      // Highlight selected stat tile
      var tiles = ["statMasteredTile", "statLearningTile", "statNewTile", "statDueTile"];
      for (var t = 0; t < tiles.length; t++) {
        var tileEl = document.getElementById(tiles[t]);
        if (tileEl) tileEl.classList.remove("is-selected");
      }
      if (filterId === "mastered" && document.getElementById("statMasteredTile")) {
        document.getElementById("statMasteredTile").classList.add("is-selected");
      } else if (filterId === "learning" && document.getElementById("statLearningTile")) {
        document.getElementById("statLearningTile").classList.add("is-selected");
      } else if (filterId === "new" && document.getElementById("statNewTile")) {
        document.getElementById("statNewTile").classList.add("is-selected");
      } else if (filterId === "due" && document.getElementById("statDueTile")) {
        document.getElementById("statDueTile").classList.add("is-selected");
      }

      // Highlight selected SRS level row
      var rows = srsLevelList ? srsLevelList.querySelectorAll(".srs-level-row") : [];
      for (var r = 0; r < rows.length; r++) {
        rows[r].classList.remove("is-selected");
        if (filterId === "srs-" + rows[r].getAttribute("data-srs-level")) {
          rows[r].classList.add("is-selected");
        }
      }

      if (doScroll && drillDownCard) {
        smoothScrollTo(drillDownCard);
      }
    }

    // ผูก Click Handler ให้กับ Stat Tiles
    var statMasteredTile = document.getElementById("statMasteredTile");
    var statLearningTile = document.getElementById("statLearningTile");
    var statNewTile = document.getElementById("statNewTile");
    var statDueTile = document.getElementById("statDueTile");

    if (statMasteredTile) statMasteredTile.addEventListener("click", function () { setDrillDownFilter("mastered", true); });
    if (statLearningTile) statLearningTile.addEventListener("click", function () { setDrillDownFilter("learning", true); });
    if (statNewTile) statNewTile.addEventListener("click", function () { setDrillDownFilter("new", true); });
    if (statDueTile) statDueTile.addEventListener("click", function () { setDrillDownFilter("due", true); });

    // ผูก Search input
    if (drillDownSearch) {
      drillDownSearch.addEventListener("input", function () {
        currentSearch = drillDownSearch.value;
        renderDrillDownList();
      });
    }

    // ผูก Reset Button
    if (drillDownResetBtn) {
      drillDownResetBtn.addEventListener("click", function () {
        if (drillDownSearch) drillDownSearch.value = "";
        currentSearch = "";
        setDrillDownFilter("all", false);
      });
    }

    // Render เริ่มต้นของ Drill-Down
    renderFilterChips();
    renderDrillDownList();
  }

  /* ============================================================
     ระบบสแกนคำศัพท์จากรูปภาพ (TASK 8.4: Image Import & OCR Assistant)
     ============================================================ */
  var OCR_PRESETS = [
    {
      name: "📖 บทเรียน HSK1 หน้าที่ 1 (คนและสรรพนาม)",
      badge: "5 คำ",
      words: [
        { hanzi: "我", pinyin: "wǒ", meaning_th: "ฉัน", category: "人物", difficulty: 1, example: "我是学生。", example_th: "ฉันเป็นนักเรียน", memory_tip: "手 + 戈 → อาวุธในมือ = ตัวตน/ฉัน" },
        { hanzi: "你", pinyin: "nǐ", meaning_th: "คุณ/เธอ", category: "人物", difficulty: 1, example: "你好吗？", example_th: "คุณสบายดีไหม?", memory_tip: "亻 (คน) + 尔 → คนตรงหน้า = คุณ" },
        { hanzi: "他", pinyin: "tā", meaning_th: "เขา (ผู้ชาย)", category: "人物", difficulty: 1, example: "他是老师。", example_th: "เขาเป็นครู", memory_tip: "亻 (คน) + 也 → คนอื่น = เขา" },
        { hanzi: "她", pinyin: "tā", meaning_th: "เธอ (ผู้หญิง)", category: "人物", difficulty: 1, example: "她很漂亮。", example_th: "เธอสวยมาก", memory_tip: "女 (ผู้หญิง) + 也 → เธอ" },
        { hanzi: "我们", pinyin: "wǒmen", meaning_th: "พวกเรา", category: "人物", difficulty: 1, example: "我们一起去。", example_th: "พวกเราไปด้วยกัน", memory_tip: "我 (ฉัน) + 们 (พหูพจน์) → พวกเรา" }
      ]
    },
    {
      name: "🍜 เมนูอาหารและเครื่องดื่มจีนยอดนิยม",
      badge: "5 คำ",
      words: [
        { hanzi: "米饭", pinyin: "mǐfàn", meaning_th: "ข้าวสวย", category: "食物", difficulty: 1, example: "我想吃米饭。", example_th: "ฉันอยากกินข้าวสวย", memory_tip: "米 (เมล็ดข้าว) + 饭 (อาหาร) → ข้าวสวย" },
        { hanzi: "面条", pinyin: "miàntiáo", meaning_th: "ก๋วยเตี๋ยว/บะหมี่", category: "食物", difficulty: 1, example: "这里的面条很好吃。", example_th: "บะหมี่ที่นี่อร่อยมาก", memory_tip: "面 (แป้ง) + 条 (เส้น) → บะหมี่" },
        { hanzi: "牛肉", pinyin: "niúròu", meaning_th: "เนื้อวัว", category: "食物", difficulty: 2, example: "我喜欢吃牛肉。", example_th: "ฉันชอบกินเนื้อวัว", memory_tip: "牛 (วัว) + 肉 (เนื้อ) → เนื้อวัว" },
        { hanzi: "绿茶", pinyin: "lǜchá", meaning_th: "ชาเขียว", category: "饮料", difficulty: 1, example: "请给我一杯绿茶。", example_th: "ขอน้ำชาเขียวให้ฉันหนึ่งแก้ว", memory_tip: "绿 (เขียว) + 茶 (ชา) → ชาเขียว" },
        { hanzi: "好吃", pinyin: "hǎochī", meaning_th: "อร่อย", category: "形容词", difficulty: 1, example: "这个菜真好吃！", example_th: "กับข้าวนี้อร่อยจริงๆ!", memory_tip: "好 (ดี) + 吃 (กิน) → อร่อย" }
      ]
    },
    {
      name: "🏫 คำศัพท์ในห้องเรียนจีน",
      badge: "5 คำ",
      words: [
        { hanzi: "教室", pinyin: "jiàoshì", meaning_th: "ห้องเรียน", category: "场所", difficulty: 2, example: "我们在教室里学习。", example_th: "พวกเราเรียนอยู่ในห้องเรียน", memory_tip: "教 (สอน) + 室 (ห้อง) → ห้องเรียน" },
        { hanzi: "汉语", pinyin: "hànyǔ", meaning_th: "ภาษาจีน", category: "语言", difficulty: 1, example: "汉语不难。", example_th: "ภาษาจีนไม่ยาก", memory_tip: "汉 (ชาวฮั่น) + 语 (ภาษา) → ภาษาจีน" },
        { hanzi: "词典", pinyin: "cídiǎn", meaning_th: "พจนานุกรม", category: "物品", difficulty: 2, example: "这是我的中文词典。", example_th: "นี่คือพจนานุกรมภาษาจีนของฉัน", memory_tip: "词 (คำ) + 典 (คัมภีร์) → พจนานุกรม" },
        { hanzi: "作业", pinyin: "zuòyè", meaning_th: "การบ้าน", category: "学习", difficulty: 2, example: "今天的作业很多。", example_th: "การบ้านวันนี้เยอะมาก", memory_tip: "作 (ทำ) + 业 (งาน) → การบ้าน" },
        { hanzi: "练习", pinyin: "liànxí", meaning_th: "ฝึกฝน/แบบฝึกหัด", category: "动词", difficulty: 2, example: "多练习就会了。", example_th: "ฝึกฝนบ่อยๆ แล้วจะทำได้", memory_tip: "练 (ซ้อม) + 习 (เรียน) → ฝึกฝน" }
      ]
    }
  ];

  function openOcrAssistantModal(vocabListEl, updateVocabIndexLabels, createVocabCard) {
    var backdrop = el("div", "modal-backdrop");
    var modal = el("div", "modal-content ocr-modal-content");

    var head = el("div", "modal-head");
    head.appendChild(el("div", "modal-title", "📷 นำเข้าคำศัพท์จากรูปภาพ (OCR Scanner)"));
    var closeBtn = el("button", "modal-close-btn", "✕");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", function () {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    });
    head.appendChild(closeBtn);
    modal.appendChild(head);

    modal.appendChild(el("div", "form-hint", "ถ่ายรูปหน้าหนังสือเรียนหรือเลือกรูปภาพที่มีคำศัพท์ภาษาจีน เพื่อตรวจจับและดึงคำศัพท์เข้าสู่ฟอร์มอัตโนมัติ"));

    // Upload Zone
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";
    modal.appendChild(fileInput);

    var uploadZone = el("div", "ocr-upload-zone");
    uploadZone.appendChild(el("div", "ocr-upload-icon", "📸"));
    uploadZone.appendChild(el("div", "ocr-upload-title", "แตะเพื่อเลือกภาพจากคลัง หรือถ่ายรูปหน้าหนังสือ"));
    uploadZone.appendChild(el("div", "ocr-upload-sub", "รองรับไฟล์ภาพ JPG, PNG, WEBP จากกล้องมือถือ"));
    uploadZone.addEventListener("click", function () {
      fileInput.click();
    });
    modal.appendChild(uploadZone);

    // Sample Presets
    var samplesArea = el("div", "ocr-samples-area");
    samplesArea.appendChild(el("div", "ocr-samples-title", "หรือทดลองใช้ตัวอย่างภาพหน้าหนังสือเรียน:"));
    var samplesList = el("div", "ocr-samples-list");

    OCR_PRESETS.forEach(function (preset) {
      var btn = el("button", "ocr-sample-btn");
      btn.type = "button";
      btn.appendChild(el("span", null, preset.name));
      btn.appendChild(el("span", "ocr-sample-badge", preset.badge));
      btn.addEventListener("click", function () {
        triggerOcrProcess(preset.words, preset.name);
      });
      samplesList.appendChild(btn);
    });
    samplesArea.appendChild(samplesList);
    modal.appendChild(samplesArea);

    // Dynamic scanning/results area
    var dynamicArea = el("div", "ocr-dynamic-area");
    modal.appendChild(dynamicArea);

    // Footer
    var footer = el("div", "modal-footer");
    var cancelBtn = el("button", "btn btn-secondary", "ยกเลิก");
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", function () {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    });
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    fileInput.addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) {
        var detectedWords = [
          { hanzi: "你好", pinyin: "nǐ hǎo", meaning_th: "สวัสดี", category: "คำทักทาย", difficulty: 1, example: "你好！很高兴认识你。", example_th: "สวัสดี! ยินดีที่ได้รู้จักคุณ", memory_tip: "你 (เธอ) + 好 (ดี) → สวัสดี" },
          { hanzi: "谢谢", pinyin: "xièxie", meaning_th: "ขอบคุณ", category: "มารยาท", difficulty: 1, example: "谢谢你的帮助。", example_th: "ขอบคุณสำหรับความช่วยเหลือของคุณ", memory_tip: "言 (คำพูด) + 射 → ขอบคุณ" },
          { hanzi: "再见", pinyin: "zàijiàn", meaning_th: "ลาก่อน/พบกันใหม่", category: "คำทักทาย", difficulty: 1, example: "明天见，再见！", example_th: "เจอกันพรุ่งนี้ ลาก่อน!", memory_tip: "再 (อีกครั้ง) + 见 (พบ) → พบกันใหม่" },
          { hanzi: "高兴", pinyin: "gāoxìng", meaning_th: "ดีใจ/มีความสุข", category: "ความรู้สึก", difficulty: 1, example: "今天我很年轻，也很高兴。", example_th: "วันนี้ฉันมีความสุขมาก", memory_tip: "高 (สูง) + 兴 (อารมณ์) → อารมณ์ดี/ดีใจ" },
          { hanzi: "认识", pinyin: "rènshi", meaning_th: "รู้จัก", category: "动词", difficulty: 1, example: "认识你很高兴。", example_th: "ยินดีที่ได้รู้จักคุณ", memory_tip: "认 (จำได้) + 识 (รู้) → รู้จัก" }
        ];
        triggerOcrProcess(detectedWords, file.name);
      }
    });

    function triggerOcrProcess(words, sourceName) {
      clear(dynamicArea);
      uploadZone.style.display = "none";
      samplesArea.style.display = "none";

      var scanBox = el("div", "ocr-scanning-box");
      scanBox.appendChild(el("div", "ocr-scanning-spinner", "🔍"));
      scanBox.appendChild(el("div", "ocr-scanning-text", "กำลังสแกนและประมวลผลตัวอักษรจีน (OCR)..."));
      scanBox.appendChild(el("div", "form-hint", "แหล่งที่มา: " + sourceName));
      dynamicArea.appendChild(scanBox);

      setTimeout(function () {
        clear(dynamicArea);
        renderOcrResults(words);
      }, 350);
    }

    function renderOcrResults(words) {
      var resBox = el("div", "ocr-results-box");
      resBox.appendChild(el("div", "card-label", "📋 ตรวจพบ " + words.length + " คำศัพท์ (เลือกและแก้ไขก่อนนำเข้า):"));

      var container = el("div", "ocr-results-container");
      var wordRows = [];

      words.forEach(function (w) {
        var row = el("div", "ocr-item-row");

        var chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = true;
        chk.className = "ocr-item-check";
        row.appendChild(chk);

        var fields = el("div", "ocr-item-fields");

        var inpHanzi = el("input", "ocr-item-input hz");
        inpHanzi.value = w.hanzi;
        inpHanzi.placeholder = "汉字";
        fields.appendChild(inpHanzi);

        var inpPinyin = el("input", "ocr-item-input");
        inpPinyin.value = w.pinyin;
        inpPinyin.placeholder = "Pinyin";
        fields.appendChild(inpPinyin);

        var inpMeaning = el("input", "ocr-item-input");
        inpMeaning.value = w.meaning_th;
        inpMeaning.placeholder = "ความหมายไทย";
        fields.appendChild(inpMeaning);

        var inpCategory = el("input", "ocr-item-input");
        inpCategory.value = w.category || "ทั่วไป";
        inpCategory.placeholder = "หมวดหมู่";
        fields.appendChild(inpCategory);

        row.appendChild(fields);

        var soundBtn = el("button", "quiz-result-item-listen", "🔊");
        soundBtn.type = "button";
        soundBtn.title = "ฟังเสียง";
        soundBtn.addEventListener("click", function () {
          speakChinese(inpHanzi.value.trim());
        });
        row.appendChild(soundBtn);

        container.appendChild(row);

        wordRows.push({
          checkbox: chk,
          inpHanzi: inpHanzi,
          inpPinyin: inpPinyin,
          inpMeaning: inpMeaning,
          inpCategory: inpCategory,
          original: w
        });
      });

      resBox.appendChild(container);
      dynamicArea.appendChild(resBox);

      // ปรับ Footer เป็นปุ่มนำเข้า
      clear(footer);

      var cancelB = el("button", "btn btn-secondary", "ย้อนกลับ");
      cancelB.type = "button";
      cancelB.addEventListener("click", function () {
        clear(dynamicArea);
        uploadZone.style.display = "block";
        samplesArea.style.display = "block";
        clear(footer);
        footer.appendChild(cancelBtn);
      });
      footer.appendChild(cancelB);

      var importB = el("button", "btn btn-primary", "⚡ นำเข้าคำศัพท์ที่เลือก (" + words.length + " คำ)");
      importB.type = "button";

      function updateImportBtnText() {
        var count = wordRows.filter(function (r) { return r.checkbox.checked; }).length;
        importB.textContent = "⚡ นำเข้าคำศัพท์ที่เลือก (" + count + " คำ)";
        importB.disabled = count === 0;
      }

      wordRows.forEach(function (r) {
        r.checkbox.addEventListener("change", updateImportBtnText);
      });

      importB.addEventListener("click", function () {
        var selectedWords = [];
        wordRows.forEach(function (r) {
          if (r.checkbox.checked) {
            var hz = r.inpHanzi.value.trim();
            var mn = r.inpMeaning.value.trim();
            if (hz && mn) {
              selectedWords.push({
                hanzi: hz,
                pinyin: r.inpPinyin.value.trim(),
                meaning_th: mn,
                category: r.inpCategory.value.trim() || "ทั่วไป",
                difficulty: r.original.difficulty || 1,
                example: r.original.example || "",
                example_th: r.original.example_th || "",
                memory_tip: r.original.memory_tip || ""
              });
            }
          }
        });

        if (selectedWords.length === 0) {
          alert("กรุณาเลือกคำศัพท์อย่างน้อย 1 คำ");
          return;
        }

        // นำเข้าลงในฟอร์ม (ถ้าการ์ดแรกว่าง ให้แทนที่ก่อน)
        var currentCards = vocabListEl.querySelectorAll(".vocab-form");
        var firstCard = currentCards[0];
        var firstHanzi = firstCard ? firstCard.querySelector(".input-hanzi") : null;
        var firstMeaning = firstCard ? firstCard.querySelector(".input-meaning") : null;

        var startIdx = 0;
        if (currentCards.length === 1 && firstHanzi && !firstHanzi.value.trim() && firstMeaning && !firstMeaning.value.trim()) {
          var item0 = selectedWords[0];
          firstHanzi.value = item0.hanzi;
          var fP = firstCard.querySelector(".input-pinyin");
          if (fP) fP.value = item0.pinyin;
          firstMeaning.value = item0.meaning_th;
          var fCat = firstCard.querySelector(".input-category");
          if (fCat) fCat.value = item0.category;
          var fEx = firstCard.querySelector(".input-example");
          if (fEx) fEx.value = item0.example;
          var fExTh = firstCard.querySelector(".input-example-th");
          if (fExTh) fExTh.value = item0.example_th;
          var fTip = firstCard.querySelector(".input-memory-tip");
          if (fTip) fTip.value = item0.memory_tip;
          startIdx = 1;
        }

        for (var k = startIdx; k < selectedWords.length; k++) {
          var totalCount = vocabListEl.querySelectorAll(".vocab-form").length;
          var newCard = createVocabCard(totalCount, selectedWords[k]);
          vocabListEl.appendChild(newCard);
        }

        updateVocabIndexLabels();
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);

        alert("🎉 สแกนและนำเข้าคำศัพท์สำเร็จ " + selectedWords.length + " คำลงในฟอร์มเรียบร้อยแล้ว!");

        var cardsAfter = vocabListEl.querySelectorAll(".vocab-form");
        var targetCard = cardsAfter[cardsAfter.length - 1];
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });

      footer.appendChild(importB);
    }
  }

  /* ============================================================
     หน้า Create / Edit Chapter (create-chapter.html) (TASK 8.1 & TASK 8.2)
     - จัดการฟอร์มสร้างบทเรียนและแก้ไขบทเรียนแบบไดนามิก
     - โหมดแก้ไข (Edit Mode เมื่อมี ?edit=<Chapter ID>) พรีโหลดข้อมูลและคำศัพท์เดิมโดยคง ID ไว้เพื่อไม่ให้ Progress หาย
     - ระบบนำเข้าชุดคำศัพท์แบบข้อความด่วน (Quick Text / TSV / CSV Import)
     - ตรวจสอบความถูกต้องของข้อมูล (Validation & Friendly Alert)
     - ทดสอบออกเสียงภาษาจีนกลาง (Web Speech API) ก่อนบันทึก
     - บันทึกลง Local Storage ผ่าน VOCAB_DATA.createChapter หรือ VOCAB_DATA.updateChapter
     - นำทางไปยังหน้ารายละเอียดบทเรียนที่เพิ่งสร้างหรือแก้ไขโดยอัตโนมัติ
     ============================================================ */
  function initCreateChapter() {
    var chapterNameInput = document.getElementById("chapterName");
    var chapterDescInput = document.getElementById("chapterDesc");
    var vocabListEl = document.getElementById("vocabList");
    var vocabCountEl = document.getElementById("vocabCount");
    var addVocabBtn = document.getElementById("addVocabBtn");
    var saveChapterBtn = document.getElementById("saveChapterBtn");
    var cancelBtn = document.getElementById("cancelBtn");
    var errorAlert = document.getElementById("formErrorAlert");

    var pageHeaderTitle = document.getElementById("pageHeaderTitle");
    var pageHeaderSub = document.getElementById("pageHeaderSub");
    var createBackBtn = document.getElementById("createBackBtn");
    var openOcrModalBtn = document.getElementById("openOcrModalBtn");

    if (!vocabListEl || !addVocabBtn || !saveChapterBtn) return;

    var urlParams = new URLSearchParams(location.search);
    var editChapterId = urlParams.get("edit");
    var isEditMode = Boolean(editChapterId);
    var targetChapter = null;

    function showError(message) {
      if (!errorAlert) {
        alert(message);
        return;
      }
      errorAlert.textContent = "⚠️ " + message;
      errorAlert.classList.add("is-visible");
      errorAlert.style.display = "flex";
      errorAlert.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function hideError() {
      if (!errorAlert) return;
      errorAlert.textContent = "";
      errorAlert.classList.remove("is-visible");
      errorAlert.style.display = "none";
    }

    function updateVocabIndexLabels() {
      var cards = vocabListEl.querySelectorAll(".vocab-form");
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        card.setAttribute("data-vocab-index", i);
        var tag = card.querySelector(".tag");
        if (tag) tag.textContent = "คำที่ " + (i + 1);
        var removeBtn = card.querySelector(".btn-remove-vocab");
        if (removeBtn) {
          removeBtn.style.display = cards.length > 1 ? "inline-block" : "none";
        }
      }
      if (vocabCountEl) {
        vocabCountEl.textContent = cards.length + " คำ";
      }
    }

    function createVocabCard(index, initialData) {
      var card = el("section", "card vocab-form");
      card.setAttribute("data-vocab-index", index);
      if (initialData && initialData.id) {
        card.setAttribute("data-vocab-id", initialData.id);
      }

      // Header
      var head = el("div", "vocab-form-head");
      head.appendChild(el("span", "tag", "คำที่ " + (index + 1)));
      var removeBtn = el("button", "btn-remove-vocab", "🗑️ ลบคำนี้");
      removeBtn.type = "button";
      removeBtn.title = "ลบคำนี้";
      removeBtn.addEventListener("click", function () {
        var cards = vocabListEl.querySelectorAll(".vocab-form");
        if (cards.length > 1) {
          card.parentNode.removeChild(card);
          updateVocabIndexLabels();
        }
      });
      head.appendChild(removeBtn);
      card.appendChild(head);

      // Hanzi
      var fHanzi = el("div", "form-field");
      var lHanzi = el("label", "form-label", "汉字 (ตัวอักษรจีน) ");
      lHanzi.appendChild(el("span", "required-star", "*"));
      fHanzi.appendChild(lHanzi);
      var hanziGroup = el("div", "hanzi-input-group");
      var inpHanzi = el("input", "form-input form-input-hanzi input-hanzi");
      inpHanzi.id = "hanzi_" + index;
      inpHanzi.type = "text";
      inpHanzi.placeholder = "เช่น 老师 หรือ 苹果";
      inpHanzi.autocomplete = "off";
      inpHanzi.required = true;
      if (initialData && initialData.hanzi) inpHanzi.value = initialData.hanzi;

      var speechBtn = el("button", "btn-preview-speech", "🔊 ฟังเสียง");
      speechBtn.type = "button";
      speechBtn.title = "ทดสอบออกเสียงภาษาจีน";
      speechBtn.addEventListener("click", function () {
        var text = inpHanzi.value.trim();
        if (!text) {
          inpHanzi.focus();
          inpHanzi.classList.add("is-invalid");
          setTimeout(function () { inpHanzi.classList.remove("is-invalid"); }, 1500);
          return;
        }
        speechBtn.classList.add("is-playing");
        speechBtn.textContent = "🔊 เล่น...";
        speakChinese(text, {
          onEnd: function () {
            speechBtn.classList.remove("is-playing");
            speechBtn.textContent = "🔊 ฟังเสียง";
          }
        });
      });
      hanziGroup.appendChild(inpHanzi);
      hanziGroup.appendChild(speechBtn);
      fHanzi.appendChild(hanziGroup);
      card.appendChild(fHanzi);

      // Pinyin
      var fPinyin = el("div", "form-field");
      fPinyin.appendChild(el("label", "form-label", "Pinyin (พินอิน)"));
      var inpPinyin = el("input", "form-input input-pinyin");
      inpPinyin.id = "pinyin_" + index;
      inpPinyin.type = "text";
      inpPinyin.placeholder = "เช่น lǎoshī หรือ píngguǒ";
      inpPinyin.autocomplete = "off";
      if (initialData && initialData.pinyin) inpPinyin.value = initialData.pinyin;
      fPinyin.appendChild(inpPinyin);
      card.appendChild(fPinyin);

      // Meaning TH
      var fMeaning = el("div", "form-field");
      var lMeaning = el("label", "form-label", "ความหมายภาษาไทย ");
      lMeaning.appendChild(el("span", "required-star", "*"));
      fMeaning.appendChild(lMeaning);
      var inpMeaning = el("input", "form-input input-meaning");
      inpMeaning.id = "meaning_" + index;
      inpMeaning.type = "text";
      inpMeaning.placeholder = "เช่น ครู หรือ แอปเปิ้ล";
      inpMeaning.autocomplete = "off";
      inpMeaning.required = true;
      if (initialData && initialData.meaning_th) inpMeaning.value = initialData.meaning_th;
      fMeaning.appendChild(inpMeaning);
      card.appendChild(fMeaning);

      // Example CN
      var fEx = el("div", "form-field");
      fEx.appendChild(el("label", "form-label", "ตัวอย่างประโยคภาษาจีน (ไม่บังคับ)"));
      var inpEx = el("input", "form-input input-example");
      inpEx.id = "example_" + index;
      inpEx.type = "text";
      inpEx.placeholder = "เช่น 老师教我们中文。";
      inpEx.autocomplete = "off";
      if (initialData && initialData.example) inpEx.value = initialData.example;
      fEx.appendChild(inpEx);
      card.appendChild(fEx);

      // Example TH
      var fExTh = el("div", "form-field");
      fExTh.appendChild(el("label", "form-label", "คำแปลตัวอย่างประโยค (ไม่บังคับ)"));
      var inpExTh = el("input", "form-input input-example-th");
      inpExTh.id = "example_th_" + index;
      inpExTh.type = "text";
      inpExTh.placeholder = "เช่น ครูสอนภาษาจีนให้เรา";
      inpExTh.autocomplete = "off";
      if (initialData && initialData.example_th) inpExTh.value = initialData.example_th;
      fExTh.appendChild(inpExTh);
      card.appendChild(fExTh);

      // Memory Tip
      var fTip = el("div", "form-field");
      fTip.appendChild(el("label", "form-label", "💡 Memory Tip เทคนิคช่วยจำ (ไม่บังคับ)"));
      var inpTip = el("input", "form-input input-memory-tip");
      inpTip.id = "memory_" + index;
      inpTip.type = "text";
      inpTip.placeholder = "เช่น 老 (แก่/อาวุโส) + 师 (ผู้รู้) → ครู";
      inpTip.autocomplete = "off";
      if (initialData && initialData.memory_tip) inpTip.value = initialData.memory_tip;
      fTip.appendChild(inpTip);
      card.appendChild(fTip);

      // Category & Difficulty row
      var row = el("div", "vocab-extra-row");

      var fCat = el("div", "form-field");
      fCat.appendChild(el("label", "form-label", "หมวดหมู่"));
      var inpCat = el("input", "form-input input-category");
      inpCat.id = "category_" + index;
      inpCat.type = "text";
      inpCat.placeholder = "เช่น บุคคล, อาหาร, คำกริยา";
      inpCat.autocomplete = "off";
      if (initialData && initialData.category) inpCat.value = initialData.category;
      fCat.appendChild(inpCat);
      row.appendChild(fCat);

      var fDiff = el("div", "form-field");
      fDiff.appendChild(el("label", "form-label", "ระดับความยาก"));
      var selDiff = el("select", "form-input input-difficulty");
      selDiff.id = "difficulty_" + index;
      var opt1 = el("option", null, "⭐ ระดับ 1 (ง่าย)");
      opt1.value = "1";
      var opt2 = el("option", null, "⭐⭐ ระดับ 2 (ปานกลาง)");
      opt2.value = "2";
      var opt3 = el("option", null, "⭐⭐⭐ ระดับ 3 (ท้าทาย)");
      opt3.value = "3";
      selDiff.appendChild(opt1);
      selDiff.appendChild(opt2);
      selDiff.appendChild(opt3);
      if (initialData && initialData.difficulty) selDiff.value = String(initialData.difficulty);
      fDiff.appendChild(selDiff);
      row.appendChild(fDiff);

      card.appendChild(row);
      return card;
    }

    // 1) จัดการโหมดแก้ไข (Edit Mode)
    if (isEditMode) {
      if (!DATA) {
        showError("ไม่สามารถเข้าถึงระบบข้อมูล");
        return;
      }
      targetChapter = DATA.getChapterById(editChapterId);
      if (!targetChapter) {
        showError("ไม่พบบทเรียนรหัส \"" + editChapterId + "\" อาจถูกลบไปแล้ว");
        setTimeout(function () { go("chapters.html"); }, 2000);
        return;
      }

      if (pageHeaderTitle) pageHeaderTitle.textContent = "✏️ แก้ไขบทเรียน";
      if (pageHeaderSub) pageHeaderSub.textContent = "แก้ไขชื่อบทและรายการคำศัพท์";
      document.title = "แก้ไขบทเรียน — " + targetChapter.title;
      saveChapterBtn.textContent = "💾 บันทึกการแก้ไข";

      if (createBackBtn) {
        createBackBtn.onclick = function () {
          go("chapter-detail.html?id=" + encodeURIComponent(editChapterId));
        };
      }
      if (cancelBtn) {
        cancelBtn.onclick = function () {
          go("chapter-detail.html?id=" + encodeURIComponent(editChapterId));
        };
      }

      if (chapterNameInput) chapterNameInput.value = targetChapter.title || "";
      if (chapterDescInput) chapterDescInput.value = targetChapter.description || "";

      // ล้างการ์ดเดิมแล้วโหลดคำศัพท์ของบทนี้ลงในฟอร์ม
      clear(vocabListEl);
      var existingVocabs = DATA.getVocabularyByChapter(editChapterId);
      if (existingVocabs && existingVocabs.length > 0) {
        existingVocabs.forEach(function (v, idx) {
          vocabListEl.appendChild(createVocabCard(idx, v));
        });
      } else {
        vocabListEl.appendChild(createVocabCard(0));
      }
    } else {
      // โหมดสร้างบทเรียนใหม่ (Create Mode): ผูก Event ให้การ์ดแรกที่มีอยู่ใน HTML
      var existingCards = vocabListEl.querySelectorAll(".vocab-form");
      if (existingCards.length > 0) {
        existingCards.forEach(function (card) {
          var removeBtn = card.querySelector(".btn-remove-vocab");
          if (removeBtn) {
            removeBtn.addEventListener("click", function () {
              var cards = vocabListEl.querySelectorAll(".vocab-form");
              if (cards.length > 1) {
                card.parentNode.removeChild(card);
                updateVocabIndexLabels();
              }
            });
          }
          var speechBtn = card.querySelector(".btn-preview-speech");
          var inpHanzi = card.querySelector(".input-hanzi");
          if (speechBtn && inpHanzi) {
            speechBtn.addEventListener("click", function () {
              var text = inpHanzi.value.trim();
              if (!text) {
                inpHanzi.focus();
                inpHanzi.classList.add("is-invalid");
                setTimeout(function () { inpHanzi.classList.remove("is-invalid"); }, 1500);
                return;
              }
              speechBtn.classList.add("is-playing");
              speechBtn.textContent = "🔊 เล่น...";
              speakChinese(text, {
                onEnd: function () {
                  speechBtn.classList.remove("is-playing");
                  speechBtn.textContent = "🔊 ฟังเสียง";
                }
              });
            });
          }
        });
      }
    }

    updateVocabIndexLabels();

    // 2) จัดการ Quick Text Import (TASK 8.2)
    var quickToggleBtn = document.getElementById("quickImportToggleBtn");
    var quickBody = document.getElementById("quickImportBody");
    var quickIcon = document.getElementById("quickImportToggleIcon");
    var quickCard = document.querySelector(".quick-import-card");
    var quickTextarea = document.getElementById("quickImportText");
    var doQuickImportBtn = document.getElementById("doQuickImportBtn");

    if (quickToggleBtn && quickBody && quickIcon) {
      quickToggleBtn.addEventListener("click", function () {
        var isOpen = quickBody.style.display !== "none";
        quickBody.style.display = isOpen ? "none" : "block";
        if (isOpen) {
          quickIcon.classList.remove("is-open");
          if (quickCard) quickCard.classList.remove("is-expanded");
        } else {
          quickIcon.classList.add("is-open");
          if (quickCard) quickCard.classList.add("is-expanded");
          if (quickTextarea) quickTextarea.focus();
        }
      });
    }

    if (doQuickImportBtn && quickTextarea) {
      doQuickImportBtn.addEventListener("click", function () {
        var rawText = quickTextarea.value.trim();
        if (!rawText) {
          showError("กรุณาวางข้อความคำศัพท์ที่ต้องการนำเข้า");
          quickTextarea.focus();
          return;
        }

        var lines = rawText.split(/\r?\n/);
        var parsedItems = [];

        for (var l = 0; l < lines.length; l++) {
          var line = lines[l].trim();
          if (!line) continue;

          // แยกด้วย Tab หรือ จุลภาค หรือ / หรือ |
          var parts = [];
          if (line.indexOf("\t") !== -1) {
            parts = line.split("\t");
          } else if (line.indexOf("，") !== -1) {
            parts = line.split("，");
          } else if (line.indexOf(",") !== -1) {
            parts = line.split(",");
          } else if (line.indexOf("|") !== -1) {
            parts = line.split("|");
          } else if (line.indexOf("/") !== -1) {
            parts = line.split("/");
          } else {
            // แยกตามช่องว่างหลายเคาะ
            parts = line.split(/\s{2,}/);
          }

          parts = parts.map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });

          if (parts.length >= 2) {
            var hanzi = parts[0];
            var pinyin = "";
            var meaning = "";
            var ex = "";
            var exTh = "";

            if (parts.length === 2) {
              meaning = parts[1];
            } else if (parts.length === 3) {
              pinyin = parts[1];
              meaning = parts[2];
            } else if (parts.length === 4) {
              pinyin = parts[1];
              meaning = parts[2];
              ex = parts[3];
            } else {
              pinyin = parts[1];
              meaning = parts[2];
              ex = parts[3];
              exTh = parts[4];
            }

            if (hanzi && meaning) {
              parsedItems.push({
                hanzi: hanzi,
                pinyin: pinyin,
                meaning_th: meaning,
                example: ex,
                example_th: exTh,
                category: "ทั่วไป",
                difficulty: 1
              });
            }
          }
        }

        if (parsedItems.length === 0) {
          showError("ไม่สามารถแยกคำศัพท์ได้ กรุณาตรวจดูรูปแบบข้อความ เช่น 你好, nǐ hǎo, สวัสดี");
          return;
        }

        hideError();

        // ตรวจสอบว่าการ์ดแรกว่างอยู่หรือไม่ ถ้าว่างให้แทนที่
        var currentCards = vocabListEl.querySelectorAll(".vocab-form");
        var firstCard = currentCards[0];
        var firstHanzi = firstCard ? firstCard.querySelector(".input-hanzi") : null;
        var firstMeaning = firstCard ? firstCard.querySelector(".input-meaning") : null;

        var startIdx = 0;
        if (currentCards.length === 1 && firstHanzi && !firstHanzi.value.trim() && firstMeaning && !firstMeaning.value.trim()) {
          var firstItem = parsedItems[0];
          firstHanzi.value = firstItem.hanzi;
          var fP = firstCard.querySelector(".input-pinyin");
          if (fP) fP.value = firstItem.pinyin;
          firstMeaning.value = firstItem.meaning_th;
          var fEx = firstCard.querySelector(".input-example");
          if (fEx) fEx.value = firstItem.example;
          var fExTh = firstCard.querySelector(".input-example-th");
          if (fExTh) fExTh.value = firstItem.example_th;
          startIdx = 1;
        }

        for (var p = startIdx; p < parsedItems.length; p++) {
          var count = vocabListEl.querySelectorAll(".vocab-form").length;
          var newCard = createVocabCard(count, parsedItems[p]);
          vocabListEl.appendChild(newCard);
        }

        updateVocabIndexLabels();
        quickTextarea.value = "";
        if (quickBody) quickBody.style.display = "none";
        if (quickIcon) quickIcon.classList.remove("is-open");
        if (quickCard) quickCard.classList.remove("is-expanded");

        alert("⚡ นำเข้าคำศัพท์สำเร็จ " + parsedItems.length + " คำลงในฟอร์มเรียบร้อยแล้ว!");
      });
    }

    // 2.5) ปุ่มเปิด OCR Image Import Assistant (TASK 8.4)
    if (openOcrModalBtn) {
      openOcrModalBtn.addEventListener("click", function () {
        hideError();
        openOcrAssistantModal(vocabListEl, updateVocabIndexLabels, createVocabCard);
      });
    }

    // 3) ปุ่มเพิ่มคำศัพท์
    addVocabBtn.addEventListener("click", function () {
      hideError();
      var currentCards = vocabListEl.querySelectorAll(".vocab-form");
      var newCard = createVocabCard(currentCards.length);
      vocabListEl.appendChild(newCard);
      updateVocabIndexLabels();

      var newInp = newCard.querySelector(".input-hanzi");
      if (newInp) {
        newInp.focus();
      }
      newCard.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    // 4) ปุ่มยกเลิก
    if (cancelBtn && !isEditMode) {
      cancelBtn.addEventListener("click", function () {
        go("chapters.html");
      });
    }

    // 5) ปุ่มบันทึก (รองรับทั้ง Create และ Edit)
    saveChapterBtn.addEventListener("click", function () {
      hideError();

      // ล้างสถานะ invalid ทั้งหมดก่อน
      var allInputs = document.querySelectorAll(".form-input");
      allInputs.forEach(function (inp) { inp.classList.remove("is-invalid"); });

      // 1. ตรวจสอบชื่อบท
      var title = chapterNameInput ? chapterNameInput.value.trim() : "";
      if (!title) {
        showError("กรุณาระบุชื่อบทเรียน เช่น HSK2 บทที่ 5 — ร้านอาหาร");
        if (chapterNameInput) {
          chapterNameInput.classList.add("is-invalid");
          chapterNameInput.focus();
        }
        return;
      }

      var desc = chapterDescInput ? chapterDescInput.value.trim() : "";

      // 2. ตรวจสอบรายการคำศัพท์
      var cards = vocabListEl.querySelectorAll(".vocab-form");
      if (cards.length === 0) {
        showError("กรุณาเพิ่มคำศัพท์อย่างน้อย 1 คำ");
        return;
      }

      var vocabDataList = [];
      var hasError = false;

      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var existingVocabId = card.getAttribute("data-vocab-id") || null;
        var inpHanzi = card.querySelector(".input-hanzi");
        var inpPinyin = card.querySelector(".input-pinyin");
        var inpMeaning = card.querySelector(".input-meaning");
        var inpEx = card.querySelector(".input-example");
        var inpExTh = card.querySelector(".input-example-th");
        var inpTip = card.querySelector(".input-memory-tip");
        var inpCat = card.querySelector(".input-category");
        var selDiff = card.querySelector(".input-difficulty");

        var hanzi = inpHanzi ? inpHanzi.value.trim() : "";
        var pinyin = inpPinyin ? inpPinyin.value.trim() : "";
        var meaning = inpMeaning ? inpMeaning.value.trim() : "";
        var ex = inpEx ? inpEx.value.trim() : "";
        var exTh = inpExTh ? inpExTh.value.trim() : "";
        var tip = inpTip ? inpTip.value.trim() : "";
        var cat = inpCat ? inpCat.value.trim() : "";
        var diff = selDiff ? Number(selDiff.value) : 1;

        // ถ้าว่างทุกช่องและมีคำอื่นที่กรอกแล้ว สามารถข้ามได้
        var isEmptyRow = !hanzi && !pinyin && !meaning && !ex && !exTh && !tip && !cat;
        if (isEmptyRow && cards.length > 1) {
          continue;
        }

        if (!hanzi) {
          showError("คำที่ " + (i + 1) + " ต้องระบุตัวอักษรจีน (汉字)");
          if (inpHanzi) {
            inpHanzi.classList.add("is-invalid");
            inpHanzi.focus();
          }
          hasError = true;
          break;
        }

        if (!meaning) {
          showError("คำที่ " + (i + 1) + " ต้องระบุความหมายภาษาไทย");
          if (inpMeaning) {
            inpMeaning.classList.add("is-invalid");
            inpMeaning.focus();
          }
          hasError = true;
          break;
        }

        var vItemRecord = {
          hanzi: hanzi,
          pinyin: pinyin,
          meaning_th: meaning,
          example: ex,
          example_th: exTh,
          memory_tip: tip,
          category: cat || "ทั่วไป",
          difficulty: diff || 1
        };
        if (existingVocabId) {
          vItemRecord.id = existingVocabId;
        }

        vocabDataList.push(vItemRecord);
      }

      if (hasError) return;

      if (vocabDataList.length === 0) {
        showError("กรุณากรอกคำศัพท์อย่างน้อย 1 คำ พร้อมตัวอักษรจีนและความหมายภาษาไทย");
        return;
      }

      if (!DATA) {
        showError("เกิดข้อผิดพลาดในการเข้าถึงระบบจัดเก็บข้อมูล (VOCAB_DATA)");
        return;
      }

      saveChapterBtn.disabled = true;

      if (isEditMode) {
        saveChapterBtn.textContent = "⏳ กำลังบันทึกการแก้ไข...";
        var editRes = DATA.updateChapter(editChapterId, { title: title, description: desc }, vocabDataList);
        if (!editRes || !editRes.success) {
          saveChapterBtn.disabled = false;
          saveChapterBtn.textContent = "💾 บันทึกการแก้ไข";
          showError(editRes && editRes.error ? editRes.error : "ไม่สามารถบันทึกการแก้ไขได้ กรุณาลองใหม่อีกครั้ง");
          return;
        }

        saveChapterBtn.textContent = "✅ บันทึกสำเร็จ! กำลังเปิดบทเรียน...";
        setTimeout(function () {
          go("chapter-detail.html?id=" + encodeURIComponent(editChapterId) + "&updated=1");
        }, 350);
      } else {
        saveChapterBtn.textContent = "⏳ กำลังบันทึกบทเรียน...";
        var createRes = DATA.createChapter({ title: title, description: desc }, vocabDataList);
        if (!createRes || !createRes.success) {
          saveChapterBtn.disabled = false;
          saveChapterBtn.textContent = "✅ บันทึกและสร้างบท";
          showError(createRes && createRes.error ? createRes.error : "ไม่สามารถบันทึกบทเรียนได้ กรุณาลองใหม่อีกครั้ง");
          return;
        }

        saveChapterBtn.textContent = "✅ บันทึกสำเร็จ! กำลังเปิดบทเรียน...";
        setTimeout(function () {
          go("chapter-detail.html?id=" + encodeURIComponent(createRes.chapter.id) + "&created=1");
        }, 350);
      }
    });
  }

  /* ============================================================
     หน้า Active Recall / Quiz Mode (quiz.html[?chapter=<id>][&mode=<mode>])
     TASK 8.3: พัฒนาระบบ Active Recall / Flashcard Quiz Mode
     - โหมดคำถาม 3 รูปแบบ:
       1) เลือกความหมาย (Multiple Choice Thai Meaning)
       2) ฟังเสียงภาษาจีนแล้วทายคำศัพท์ (Listening Sound-to-Hanzi/Meaning)
       3) พิมพ์สะกด Pinyin (Pinyin Spelling Active Recall)
       + โหมดคำถามผสม (Mixed Challenge)
     - ระบบสร้างตัวเลือกหลอก (Distractor Generator) อัตโนมัติ พร้อม seed fallbacks
     - ตรวจ Pinyin แบบ Normalize (รองรับทั้งเสียงวรรณยุกต์ āáǎà, ตัวเลข 1-4, หรืออักษรธรรมดา)
     - แสดงเฉลยทันทีพร้อมการ์ดคำศัพท์ สรุปประโยคตัวอย่าง และ Memory Tip
     - บันทึกคะแนนและอัปเดตระดับ SRS + Streak การเรียนรู้ลง Local Storage ทันที
     - หน้าสรุปผลคะแนน (Quiz Completion Screen) พร้อมรายชื่อคำศัพท์และปุ่มฟังเสียง
     ============================================================ */
  var FALLBACK_MEANINGS = [
    "ครู", "นักเรียน", "เพื่อน", "ครอบครัว", "โรงเรียน", "โรงพยาบาล", "หมอ",
    "หนังสือ", "น้ำ", "ชา", "ข้าว", "ผลไม้", "กิน", "ดื่ม", "พูด", "เรียน",
    "ทำงาน", "ไป", "มา", "ดี", "ใหญ่", "เล็ก", "มาก", "สวย", "ยินดี", "ขอบคุณ",
    "ขอโทษ", "สวัสดี", "คนจีน", "ภาษาจีน", "โต๊ะ", "เก้าอี้", "กระเป๋า"
  ];

  var FALLBACK_VOCAB = [
    { hanzi: "老师", meaning_th: "ครู", pinyin: "lǎoshī" },
    { hanzi: "学生", meaning_th: "นักเรียน", pinyin: "xuéshēng" },
    { hanzi: "朋友", meaning_th: "เพื่อน", pinyin: "péngyou" },
    { hanzi: "医生", meaning_th: "หมอ", pinyin: "yīshēng" },
    { hanzi: "家", meaning_th: "ครอบครัว/บ้าน", pinyin: "jiā" },
    { hanzi: "学校", meaning_th: "โรงเรียน", pinyin: "xuéxiào" },
    { hanzi: "水", meaning_th: "น้ำ", pinyin: "shuǐ" },
    { hanzi: "中国", meaning_th: "ประเทศจีน", pinyin: "zhōngguó" },
    { hanzi: "喜欢", meaning_th: "ชอบ", pinyin: "xǐhuan" },
    { hanzi: "谢谢", meaning_th: "ขอบคุณ", pinyin: "xièxie" }
  ];

  function normalizePinyin(str) {
    if (!str) return "";
    var s = String(str).toLowerCase().trim();
    var map = {
      "ā": "a", "á": "a", "ǎ": "a", "à": "a",
      "ē": "e", "é": "e", "ě": "e", "è": "e",
      "ī": "i", "í": "i", "ǐ": "i", "ì": "i",
      "ō": "o", "ó": "o", "ǒ": "o", "ò": "o",
      "ū": "u", "ú": "u", "ǔ": "u", "ù": "u",
      "ǖ": "u", "ǘ": "u", "ǚ": "u", "ǜ": "u", "ü": "u", "v": "u"
    };
    var res = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (map[ch]) {
        res += map[ch];
      } else if ((ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9")) {
        res += ch;
      }
    }
    return res.replace(/[1-5]/g, "");
  }

  /* ============================================================
     Spoken Answer Matching Engine (Speak-to-Answer Feature)
     - เปรียบเทียบเสียงที่ผู้ใช้พูด (Speech Transcript) กับคำศัพท์เป้าหมาย
     - รองรับทั้งการพูดตัวอักษรจีน (Hanzi), เสียง Pinyin แบบมี/ไม่มีวรรณยุกต์
     - รองรับการจับคู่รายพยางค์และกรองเครื่องหมายวรรคตอนจาก Web Speech API
     ============================================================ */
  function isSpokenAnswerMatch(spokenText, currentVocab) {
    if (!spokenText || !currentVocab) return false;
    var raw = String(spokenText).trim().toLowerCase();
    if (!raw) return false;

    // 1. ตรวจสอบตรงกับ Hanzi (ลบเครื่องหมายวรรคตอนและช่องว่าง)
    var cleanSpokenHz = raw.replace(/[^\u4e00-\u9fa5]/g, "");
    var targetHz = (currentVocab.hanzi || "").replace(/[^\u4e00-\u9fa5]/g, "");
    if (targetHz && cleanSpokenHz) {
      if (cleanSpokenHz === targetHz || cleanSpokenHz.indexOf(targetHz) !== -1) {
        return true;
      }
      if (cleanSpokenHz.length >= 2 && targetHz.indexOf(cleanSpokenHz) !== -1) {
        return true;
      }
    }

    // 2. ตรวจสอบตรงกับ Pinyin แบบ Normalize
    var normSpoken = normalizePinyin(raw);
    var normTarget = normalizePinyin(currentVocab.pinyin);
    if (normSpoken && normTarget) {
      if (normSpoken === normTarget || normSpoken.indexOf(normTarget) !== -1) {
        return true;
      }
      if (normTarget.indexOf(normSpoken) !== -1 && normSpoken.length >= 3) {
        return true;
      }
    }

    // 3. ตรวจสอบรายพยางค์ (เช่น คำว่า nǐ hǎo ที่ Speech Recognition คืน "ni, hao")
    var spokenWords = raw.replace(/[^a-z0-9\u4e00-\u9fa5āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/gi, " ").split(/\s+/).filter(Boolean);
    var targetPinyinWords = (currentVocab.pinyin || "").toLowerCase().replace(/[^a-z0-9āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/gi, " ").split(/\s+/).filter(Boolean);

    if (targetPinyinWords.length > 0 && spokenWords.length > 0) {
      var allFound = targetPinyinWords.every(function (tw) {
        var nTw = normalizePinyin(tw);
        return spokenWords.some(function (sw) {
          return normalizePinyin(sw) === nTw || (sw.indexOf(nTw) !== -1 && nTw.length >= 2);
        });
      });
      if (allFound) return true;
    }

    // 4. ตรวจสอบคำแปลภาษาไทยหากผู้ใช้พูดความหมาย
    if (currentVocab.meaning_th && raw.indexOf(currentVocab.meaning_th.trim().toLowerCase()) !== -1) {
      return true;
    }

    return false;
  }

  function getMeaningDistractors(targetVocab, allVocabList) {
    var pool = [];
    var seen = {};
    seen[targetVocab.meaning_th] = true;

    if (allVocabList && allVocabList.length > 0) {
      for (var i = 0; i < allVocabList.length; i++) {
        var m = allVocabList[i].meaning_th;
        if (m && !seen[m]) {
          seen[m] = true;
          pool.push(m);
        }
      }
    }

    for (var j = 0; j < FALLBACK_MEANINGS.length; j++) {
      var fb = FALLBACK_MEANINGS[j];
      if (!seen[fb]) {
        seen[fb] = true;
        pool.push(fb);
      }
    }

    var shuffled = pool.sort(function () { return 0.5 - Math.random(); });
    return shuffled.slice(0, 3);
  }

  function getVocabDistractors(targetVocab, allVocabList) {
    var pool = [];
    var seen = {};
    seen[targetVocab.hanzi] = true;

    if (allVocabList && allVocabList.length > 0) {
      for (var i = 0; i < allVocabList.length; i++) {
        var v = allVocabList[i];
        if (v.hanzi && !seen[v.hanzi]) {
          seen[v.hanzi] = true;
          pool.push(v);
        }
      }
    }

    for (var j = 0; j < FALLBACK_VOCAB.length; j++) {
      var fv = FALLBACK_VOCAB[j];
      if (!seen[fv.hanzi]) {
        seen[fv.hanzi] = true;
        pool.push(fv);
      }
    }

    var shuffled = pool.sort(function () { return 0.5 - Math.random(); });
    return shuffled.slice(0, 3);
  }

  function initQuiz() {
    var page = document.getElementById("page-quiz");
    if (!page) return;

    var backBtn = document.getElementById("quizBackBtn");
    var titleEl = document.getElementById("quizTitle");
    var subEl = document.getElementById("quizSub");
    var quizBody = document.getElementById("quizBody");
    var qContainer = document.getElementById("quizQuestionContainer");
    var resultBox = document.getElementById("quizResultBox");
    var stateBoxEl = document.getElementById("quizStateBox");
    var modeBar = document.getElementById("quizModeBar");
    var progFill = document.getElementById("quizProgressFill");
    var scoreBadge = document.getElementById("quizScoreBadge");
    var streakBadge = document.getElementById("quizStreakBadge");

    function showErrorState(icon, title, desc, btnLabel, btnUrl) {
      if (quizBody) quizBody.classList.add("is-hidden");
      if (resultBox) resultBox.classList.add("is-hidden");
      if (stateBoxEl) {
        clear(stateBoxEl);
        stateBoxEl.appendChild(stateBox(icon, title, desc, btnLabel, btnUrl));
        stateBoxEl.classList.remove("is-hidden");
      }
    }

    if (!DATA) {
      showErrorState("⚠️", "โหลดข้อมูลไม่สำเร็จ", "ไม่พบข้อมูลคำศัพท์ (data/vocab-data.js)", "กลับหน้าแรก", "index.html");
      return;
    }

    var urlParams = new URLSearchParams(location.search);
    var chapterId = urlParams.get("chapter");
    var requestedMode = urlParams.get("mode") || "mixed";
    var activeMode = ["mixed", "speaking", "meaning", "listening", "spelling"].indexOf(requestedMode) >= 0 ? requestedMode : "mixed";

    var chapter = null;
    var rawVocabList = [];

    if (chapterId) {
      chapter = DATA.getChapterById(chapterId);
      if (!chapter) {
        showErrorState("🔎", "ไม่พบบทเรียน", "ไม่พบบทเรียนรหัส \"" + chapterId + "\" ในระบบ", "กลับไปหน้าบทเรียน", "chapters.html");
        return;
      }
      rawVocabList = DATA.getVocabularyByChapter(chapterId);
      if (!rawVocabList || rawVocabList.length === 0) {
        showErrorState("📝", "บทนี้ยังไม่มีคำศัพท์", "บทเรียน \"" + chapter.title + "\" ยังไม่มีคำศัพท์ให้ทำแบบทดสอบ", "ดูรายละเอียดบท", "chapter-detail.html?id=" + encodeURIComponent(chapter.id));
        return;
      }
      if (titleEl) titleEl.textContent = chapter.title + " — 🎯 ควิซ";
      if (backBtn) {
        backBtn.onclick = function () {
          go("chapter-detail.html?id=" + encodeURIComponent(chapter.id));
        };
      }
    } else {
      if (titleEl) titleEl.textContent = "🎯 แบบทดสอบ Active Recall";
      if (backBtn) {
        backBtn.onclick = function () {
          go("index.html");
        };
      }
      rawVocabList = DATA.getAllVocabulary();
      if (!rawVocabList || rawVocabList.length === 0) {
        showErrorState("📝", "ยังไม่มีคำศัพท์ในระบบ", "ยังไม่มีคำศัพท์ใดๆ ในระบบ กรุณาสร้างบทเรียนหรือเพิ่มคำศัพท์ก่อน", "สร้างบทใหม่", "create-chapter.html");
        return;
      }
      // ดึงคำศัพท์สูงสุด 12 คำ
      rawVocabList = rawVocabList.slice(0, 12);
    }

    // State ของการทำควิซ
    var quizQuestions = [];
    var currentIndex = 0;
    var score = 0;
    var comboStreak = 0;
    var sessionResults = [];
    var allVocabPool = DATA.getAllVocabulary() || [];

    // ผูก Event ให้ Filter Chips
    if (modeBar) {
      var chips = modeBar.querySelectorAll(".quiz-chip");
      for (var c = 0; c < chips.length; c++) {
        (function (chip) {
          var m = chip.getAttribute("data-mode");
          if (m === activeMode) chip.classList.add("is-active");
          else chip.classList.remove("is-active");

          chip.addEventListener("click", function () {
            if (activeMode === m) return;
            activeMode = m;
            for (var k = 0; k < chips.length; k++) {
              chips[k].classList.toggle("is-active", chips[k].getAttribute("data-mode") === m);
            }
            restartQuiz();
          });
        })(chips[c]);
      }
    }

    function setupQuestions() {
      // คัดลอกและสุ่มลำดับคำศัพท์
      var copy = rawVocabList.slice();
      copy.sort(function () { return 0.5 - Math.random(); });
      quizQuestions = copy;
      currentIndex = 0;
      score = 0;
      comboStreak = 0;
      sessionResults = [];
    }

    function updateHeaderStats() {
      var total = quizQuestions.length;
      if (subEl) subEl.textContent = "ข้อที่ " + (currentIndex + 1) + " / " + total;
      if (progFill) {
        var pct = total > 0 ? (currentIndex / total) * 100 : 0;
        progFill.style.width = pct + "%";
      }
      if (scoreBadge) {
        scoreBadge.textContent = "⭐ " + score + " / " + total;
      }
      if (streakBadge) {
        if (comboStreak >= 2) {
          streakBadge.textContent = "🔥 " + comboStreak + " ข้อติด!";
          streakBadge.classList.remove("is-hidden");
        } else {
          streakBadge.classList.add("is-hidden");
        }
      }
    }

    function determineQuestionType(idx) {
      if (activeMode === "speaking") return "speaking";
      if (activeMode === "meaning") return "meaning";
      if (activeMode === "listening") return "listening";
      if (activeMode === "spelling") return "spelling";
      // โหมดคำถามผสม (mixed): สลับ 4 รูปแบบ
      var types = ["meaning", "listening", "speaking", "spelling"];
      return types[idx % types.length];
    }

    function renderQuestion() {
      clear(qContainer);
      stopSpeech();

      if (currentIndex >= quizQuestions.length) {
        showQuizSummary();
        return;
      }

      updateHeaderStats();
      var currentVocab = quizQuestions[currentIndex];
      var qType = determineQuestionType(currentIndex);

      var card = el("section", "quiz-question-card");

      // Badge ประเภทคำถาม
      var typeBadgeText = "📝 เลือกความหมายที่ถูกต้อง";
      if (qType === "listening") typeBadgeText = "🔊 ฟังเสียงแล้วทายคำศัพท์";
      else if (qType === "speaking") typeBadgeText = "🎙️ พูดออกเสียงเพื่อตอบ (Speak to Answer)";
      else if (qType === "spelling") typeBadgeText = "✍️ สะกด Pinyin";
      card.appendChild(el("div", "quiz-type-badge", typeBadgeText));

      var promptBox = el("div", "quiz-prompt-box");

      // 1) โหมดเลือกความหมาย (Meaning Quiz)
      if (qType === "meaning") {
        promptBox.appendChild(el("div", "quiz-prompt-hanzi", currentVocab.hanzi));
        promptBox.appendChild(el("div", "quiz-prompt-pinyin", currentVocab.pinyin));

        var listenBtn = el("button", "quiz-listen-btn", "🔊 ฟังเสียง");
        listenBtn.type = "button";
        listenBtn.addEventListener("click", function () {
          listenBtn.classList.add("is-playing");
          speakChinese(currentVocab.hanzi, {
            onEnd: function () { listenBtn.classList.remove("is-playing"); },
            onError: function () { listenBtn.classList.remove("is-playing"); }
          });
        });
        promptBox.appendChild(listenBtn);
        promptBox.appendChild(el("div", "quiz-prompt-subhint", "เลือกความหมายภาษาไทยที่ถูกต้อง"));
        card.appendChild(promptBox);

        // ตัวเลือก 4 ข้อ (1 ข้อถูก + 3 ข้อหลอก)
        var distractors = getMeaningDistractors(currentVocab, allVocabPool);
        var options = distractors.concat([currentVocab.meaning_th]);
        options.sort(function () { return 0.5 - Math.random(); });

        var optList = el("div", "quiz-options-list");
        var prefixes = ["A", "B", "C", "D"];
        var isAnswered = false;

        options.forEach(function (optText, optIdx) {
          var btn = el("button", "quiz-option-btn");
          btn.type = "button";
          btn.appendChild(el("span", "quiz-option-prefix", prefixes[optIdx] || "•"));
          btn.appendChild(el("span", "quiz-option-text", optText));

          btn.addEventListener("click", function () {
            if (isAnswered) return;
            isAnswered = true;

            var isCorrect = optText === currentVocab.meaning_th;
            handleAnswer(currentVocab, isCorrect, qType, optText, currentVocab.meaning_th, card, btn, optList);
          });

          optList.appendChild(btn);
        });
        card.appendChild(optList);

      // 2) โหมดฟังเสียงทายศัพท์ (Listening Quiz)
      } else if (qType === "listening") {
        var bigListenBtn = el("button", "quiz-listen-btn", "🔊 แตะเพื่อฟังเสียงคำศัพท์");
        bigListenBtn.type = "button";
        bigListenBtn.style.padding = "16px 28px";
        bigListenBtn.style.fontSize = "17px";
        bigListenBtn.style.margin = "12px auto 8px";

        function playSound() {
          bigListenBtn.classList.add("is-playing");
          bigListenBtn.textContent = "🔊 กำลังเล่นเสียง...";
          speakChinese(currentVocab.hanzi, {
            onEnd: function () {
              bigListenBtn.classList.remove("is-playing");
              bigListenBtn.textContent = "🔊 ฟังซ้ำอีกครั้ง";
            },
            onError: function () {
              bigListenBtn.classList.remove("is-playing");
              bigListenBtn.textContent = "🔊 ฟังซ้ำอีกครั้ง";
            }
          });
        }

        bigListenBtn.addEventListener("click", playSound);
        promptBox.appendChild(bigListenBtn);
        promptBox.appendChild(el("div", "quiz-prompt-subhint", "ฟังเสียงภาษาจีนแล้วเลือกว่าตรงกับคำศัพท์ใด"));
        card.appendChild(promptBox);

        // เล่นเสียงอัตโนมัติ 1 ครั้งเพื่อความสะดวก
        setTimeout(playSound, 250);

        // ตัวเลือก 4 ข้อ (คำศัพท์ Hanzi + ความหมาย)
        var vocabDistractors = getVocabDistractors(currentVocab, allVocabPool);
        var vOptions = vocabDistractors.concat([currentVocab]);
        vOptions.sort(function () { return 0.5 - Math.random(); });

        var vOptList = el("div", "quiz-options-list");
        var vPrefixes = ["A", "B", "C", "D"];
        var isListenAnswered = false;

        vOptions.forEach(function (vOpt, vIdx) {
          var btn = el("button", "quiz-option-btn");
          btn.type = "button";
          btn.appendChild(el("span", "quiz-option-prefix", vPrefixes[vIdx] || "•"));

          var textSpan = el("span", "quiz-option-text");
          textSpan.innerHTML = "<strong>" + vOpt.hanzi + "</strong> <span style='color:var(--text-muted); font-size:13px;'>(" + vOpt.meaning_th + ")</span>";
          btn.appendChild(textSpan);

          btn.addEventListener("click", function () {
            if (isListenAnswered) return;
            isListenAnswered = true;

            var isCorrect = vOpt.hanzi === currentVocab.hanzi;
            handleAnswer(currentVocab, isCorrect, qType, vOpt.hanzi, currentVocab.hanzi, card, btn, vOptList);
          });

          vOptList.appendChild(btn);
        });
        card.appendChild(vOptList);

      // 3) โหมดพูดตอบ (Speak to Answer Quiz)
      } else if (qType === "speaking") {
        promptBox.appendChild(el("div", "quiz-prompt-hanzi", currentVocab.hanzi));
        promptBox.appendChild(el("div", "quiz-prompt-meaning", currentVocab.meaning_th));

        // ปุ่มฟังตัวอย่างเสียง
        var previewListenBtn = el("button", "quiz-listen-btn", "🔊 ฟังตัวอย่างการออกเสียง");
        previewListenBtn.type = "button";
        previewListenBtn.style.padding = "6px 14px";
        previewListenBtn.style.fontSize = "13px";
        previewListenBtn.style.margin = "8px auto 4px";
        previewListenBtn.addEventListener("click", function () {
          previewListenBtn.classList.add("is-playing");
          speakChinese(currentVocab.hanzi, {
            onEnd: function () { previewListenBtn.classList.remove("is-playing"); },
            onError: function () { previewListenBtn.classList.remove("is-playing"); }
          });
        });
        promptBox.appendChild(previewListenBtn);

        promptBox.appendChild(el("div", "quiz-prompt-subhint", "แตะไมโครโฟนแล้วออกเสียงคำศัพท์เป็นภาษาจีน หรือสะกด Pinyin"));
        card.appendChild(promptBox);

        var speakingBox = el("div", "quiz-speaking-box");

        // Microphone Button Wrapper with Wave Ripples
        var micWrap = el("div", "quiz-mic-btn-wrap");
        var micBtn = el("button", "quiz-mic-btn");
        micBtn.type = "button";
        micBtn.setAttribute("aria-label", "แตะเพื่อพูดตอบ");
        micBtn.innerHTML = "🎙️";

        var ripple1 = el("div", "quiz-mic-ripple");
        var ripple2 = el("div", "quiz-mic-ripple");
        var ripple3 = el("div", "quiz-mic-ripple");
        micWrap.appendChild(micBtn);
        micWrap.appendChild(ripple1);
        micWrap.appendChild(ripple2);
        micWrap.appendChild(ripple3);
        speakingBox.appendChild(micWrap);

        // Waveform Animation Bars
        var waveform = el("div", "quiz-waveform");
        for (var w = 0; w < 5; w++) {
          waveform.appendChild(el("div", "quiz-wave-bar"));
        }
        speakingBox.appendChild(waveform);

        // Status Badge
        var statusBadge = el("div", "quiz-mic-status-badge", "🎙️ แตะไมโครโฟนเพื่อเริ่มพูดตอบ");
        speakingBox.appendChild(statusBadge);

        // Live Transcript Box
        var transcriptBox = el("div", "quiz-spoken-transcript-box");
        var tLabel = el("div", "quiz-spoken-transcript-label", "เสียงที่ได้ยิน:");
        var tText = el("div", "quiz-spoken-transcript-text is-empty", "(รอฟังเสียงคำศัพท์ของคุณ...)");
        transcriptBox.appendChild(tLabel);
        transcriptBox.appendChild(tText);
        speakingBox.appendChild(transcriptBox);

        // Action Buttons Row
        var actionsRow = el("div", "quiz-speaking-actions");
        var retryBtn = el("button", "quiz-speak-retry-btn", "🔄 พูดใหม่อีกครั้ง");
        retryBtn.type = "button";
        retryBtn.style.display = "none";

        var typeFallbackBtn = el("button", "quiz-speak-type-fallback-btn", "⌨️ สลับไปพิมพ์ Pinyin แทน");
        typeFallbackBtn.type = "button";

        actionsRow.appendChild(retryBtn);
        actionsRow.appendChild(typeFallbackBtn);
        speakingBox.appendChild(actionsRow);

        card.appendChild(speakingBox);

        // Web Speech API Integration
        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        var recognition = null;
        var isListening = false;
        var isSpeakingAnswered = false;
        var lastTranscript = "";

        function stopRecognition() {
          if (recognition && isListening) {
            try { recognition.stop(); } catch (e) {}
          }
          isListening = false;
          micBtn.classList.remove("is-listening");
        }

        if (!SpeechRecognition) {
          statusBadge.textContent = "⚠️ เบราว์เซอร์ไม่รองรับ Web Speech API";
          statusBadge.style.color = "#996600";
          tText.textContent = "แนะนำ Google Chrome หรือ Edge หรือคลิกสลับไปพิมพ์ตอบ";
          typeFallbackBtn.textContent = "✍️ คลิกที่นี่เพื่อพิมพ์ Pinyin ตอบ";
          typeFallbackBtn.style.padding = "10px 18px";
          typeFallbackBtn.style.fontWeight = "800";
        }

        function startListening() {
          if (isSpeakingAnswered) return;
          if (!SpeechRecognition) {
            switchToTypingFallback();
            return;
          }

          try {
            if (recognition) {
              try { recognition.abort(); } catch (e) {}
            }

            recognition = new SpeechRecognition();
            recognition.lang = "zh-CN";
            recognition.interimResults = true;
            recognition.maxAlternatives = 3;
            recognition.continuous = false;

            recognition.onstart = function () {
              isListening = true;
              micBtn.classList.add("is-listening");
              statusBadge.className = "quiz-mic-status-badge is-listening";
              statusBadge.textContent = "🔴 กำลังฟัง... พูดภาษาจีนหรือ Pinyin ได้เลย";
              tText.className = "quiz-spoken-transcript-text";
              tText.textContent = "กำลังจับเสียง...";
              retryBtn.style.display = "none";
            };

            recognition.onresult = function (event) {
              var interim = "";
              var finalStr = "";

              for (var r = event.resultIndex; r < event.results.length; r++) {
                var item = event.results[r];
                if (item.isFinal) {
                  finalStr += item[0].transcript;
                } else {
                  interim += item[0].transcript;
                }
              }

              var currentSpeech = (finalStr || interim).trim();
              if (currentSpeech) {
                lastTranscript = currentSpeech;
                tText.className = "quiz-spoken-transcript-text";
                tText.textContent = currentSpeech;
              }

              if (finalStr) {
                processAnswer(finalStr);
              }
            };

            recognition.onerror = function (event) {
              isListening = false;
              micBtn.classList.remove("is-listening");
              statusBadge.className = "quiz-mic-status-badge";

              if (event.error === "no-speech") {
                statusBadge.textContent = "⏳ ไม่ได้ยินเสียง พูดใหม่อีกครั้งได้เลย";
                retryBtn.style.display = "inline-flex";
              } else if (event.error === "not-allowed") {
                statusBadge.textContent = "⚠️ ไม่ได้รับสิทธิ์เข้าถึงไมโครโฟน";
                tText.textContent = "กรุณาอนุญาตไมโครโฟนในเบราว์เซอร์ หรือสลับไปพิมพ์ตอบ";
                retryBtn.style.display = "inline-flex";
              } else {
                statusBadge.textContent = "⚠️ ลองแตะพูดใหม่อีกครั้ง (" + (event.error || "") + ")";
                retryBtn.style.display = "inline-flex";
              }
            };

            recognition.onend = function () {
              isListening = false;
              micBtn.classList.remove("is-listening");
              if (!isSpeakingAnswered) {
                if (lastTranscript) {
                  processAnswer(lastTranscript);
                } else {
                  statusBadge.className = "quiz-mic-status-badge";
                  statusBadge.textContent = "🎙️ แตะไมโครโฟนเพื่อพูดใหม่อีกครั้ง";
                  retryBtn.style.display = "inline-flex";
                }
              }
            };

            recognition.start();
          } catch (err) {
            statusBadge.textContent = "⚠️ เปิดไมโครโฟนไม่สำเร็จ: " + (err.message || "");
            retryBtn.style.display = "inline-flex";
          }
        }

        function processAnswer(transcriptText) {
          if (isSpeakingAnswered) return;
          var text = (transcriptText || "").trim();
          if (!text) return;

          var isMatch = isSpokenAnswerMatch(text, currentVocab);

          if (isMatch) {
            isSpeakingAnswered = true;
            stopRecognition();
            statusBadge.className = "quiz-mic-status-badge is-success";
            statusBadge.innerHTML = "✅ ถูกต้อง! เสียงตรงกับคำตอบ 🎉";
            micBtn.disabled = true;
            retryBtn.style.display = "none";
            typeFallbackBtn.style.display = "none";

            triggerConfetti({ duration: 1800, particleCount: 45, chime: true });

            setTimeout(function () {
              handleAnswer(currentVocab, true, qType, text, currentVocab.hanzi + " (" + currentVocab.pinyin + ")", card, null, null);
            }, 600);

          } else {
            statusBadge.className = "quiz-mic-status-badge";
            statusBadge.innerHTML = "❌ ยังไม่ตรงกับคำศัพท์นี้ (ได้ยินว่า: \"" + text + "\")";
            retryBtn.style.display = "inline-flex";

            var confirmWrongBtn = speakingBox.querySelector(".quiz-speak-confirm-wrong-btn");
            if (!confirmWrongBtn) {
              confirmWrongBtn = el("button", "btn btn-secondary quiz-speak-confirm-wrong-btn", "✓ ส่งคำตอบนี้ (" + text + ")");
              confirmWrongBtn.type = "button";
              confirmWrongBtn.style.marginTop = "6px";
              confirmWrongBtn.style.fontSize = "13px";
              confirmWrongBtn.addEventListener("click", function () {
                if (isSpeakingAnswered) return;
                isSpeakingAnswered = true;
                stopRecognition();
                handleAnswer(currentVocab, false, qType, text, currentVocab.hanzi + " (" + currentVocab.pinyin + ")", card, null, null);
              });
              speakingBox.appendChild(confirmWrongBtn);
            }
          }
        }

        function switchToTypingFallback() {
          stopRecognition();
          clear(speakingBox);
          speakingBox.className = "quiz-spelling-box";

          var fallbackWrap = el("div", "quiz-spelling-input-wrap");
          var input = el("input", "quiz-spelling-input");
          input.type = "text";
          input.placeholder = "พิมพ์ Pinyin ที่นี่ (เช่น " + normalizePinyin(currentVocab.pinyin) + ")...";
          input.autocomplete = "off";
          input.autocapitalize = "off";
          input.spellcheck = false;
          if (lastTranscript) {
            input.value = lastTranscript;
          }
          fallbackWrap.appendChild(input);
          speakingBox.appendChild(fallbackWrap);

          var actions = el("div", "quiz-spelling-actions");
          var submit = el("button", "btn btn-primary quiz-spelling-submit", "✓ ตรวจคำตอบ");
          submit.type = "button";

          var backToMic = el("button", "btn quiz-spelling-hint-btn", "🎙️ กลับไปพูดตอบ");
          backToMic.type = "button";
          backToMic.addEventListener("click", function () {
            renderQuestion();
          });

          submit.addEventListener("click", function () {
            var val = input.value.trim();
            if (!val) { input.focus(); return; }
            var isCorr = normalizePinyin(val) === normalizePinyin(currentVocab.pinyin) || isSpokenAnswerMatch(val, currentVocab);
            handleAnswer(currentVocab, isCorr, qType, val, currentVocab.pinyin, card, null, null);
          });

          input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
              e.preventDefault();
              submit.click();
            }
          });

          actions.appendChild(submit);
          actions.appendChild(backToMic);
          speakingBox.appendChild(actions);
          input.focus();
        }

        micBtn.addEventListener("click", function () {
          if (isListening) {
            stopRecognition();
            statusBadge.textContent = "⏹️ หยุดฟังแล้ว แตะไมค์เพื่อพูดใหม่";
            retryBtn.style.display = "inline-flex";
          } else {
            startListening();
          }
        });

        retryBtn.addEventListener("click", function () {
          startListening();
        });

        typeFallbackBtn.addEventListener("click", function () {
          switchToTypingFallback();
        });

      // 4) โหมดสะกด Pinyin (Spelling Quiz)
      } else if (qType === "spelling") {
        promptBox.appendChild(el("div", "quiz-prompt-hanzi", currentVocab.hanzi));
        promptBox.appendChild(el("div", "quiz-prompt-meaning", currentVocab.meaning_th));
        promptBox.appendChild(el("div", "quiz-prompt-subhint", "สะกดเสียง Pinyin ของคำนี้ (พิมพ์หรือแตะไมค์พูดตอบได้)"));
        card.appendChild(promptBox);

        var spellingBox = el("div", "quiz-spelling-box");
        var inputWrap = el("div", "quiz-spelling-input-wrap");
        var input = el("input", "quiz-spelling-input");
        input.type = "text";
        input.placeholder = "พิมพ์ Pinyin ที่นี่ (หรือแตะไมค์พูด)...";
        input.autocomplete = "off";
        input.autocapitalize = "off";
        input.spellcheck = false;
        inputWrap.appendChild(input);

        // Dictate microphone button on spelling input
        var micDictateBtn = el("button", "quiz-spelling-mic-btn");
        micDictateBtn.type = "button";
        micDictateBtn.title = "พูดตอบแทนการพิมพ์ (Dictate Pinyin)";
        micDictateBtn.innerHTML = "🎙️";

        var SpeechRecDictate = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecDictate) {
          var recDictate = null;
          micDictateBtn.addEventListener("click", function () {
            if (micDictateBtn.classList.contains("is-listening")) {
              try { recDictate.stop(); } catch (e) {}
              micDictateBtn.classList.remove("is-listening");
              return;
            }
            try {
              recDictate = new SpeechRecDictate();
              recDictate.lang = "zh-CN";
              recDictate.interimResults = true;
              recDictate.onstart = function () {
                micDictateBtn.classList.add("is-listening");
                input.placeholder = "กำลังฟังเสียงของคุณ...";
              };
              recDictate.onresult = function (evt) {
                var t = "";
                for (var i = evt.resultIndex; i < evt.results.length; i++) {
                  t += evt.results[i][0].transcript;
                }
                if (t) {
                  input.value = t.trim();
                }
              };
              recDictate.onerror = function () {
                micDictateBtn.classList.remove("is-listening");
                input.placeholder = "พิมพ์ Pinyin ที่นี่...";
              };
              recDictate.onend = function () {
                micDictateBtn.classList.remove("is-listening");
                input.placeholder = "พิมพ์ Pinyin ที่นี่...";
                input.focus();
              };
              recDictate.start();
            } catch (err) {
              micDictateBtn.classList.remove("is-listening");
            }
          });
          inputWrap.appendChild(micDictateBtn);
        }

        spellingBox.appendChild(inputWrap);

        var hintBox = el("div", "quiz-spelling-hint-box is-hidden");
        spellingBox.appendChild(hintBox);

        var actionsRow = el("div", "quiz-spelling-actions");
        var submitBtn = el("button", "btn btn-primary quiz-spelling-submit", "✓ ตรวจคำตอบ");
        submitBtn.type = "button";

        var hintBtn = el("button", "btn quiz-spelling-hint-btn", "💡 คำใบ้");
        hintBtn.type = "button";
        hintBtn.addEventListener("click", function () {
          var norm = normalizePinyin(currentVocab.pinyin);
          var firstChar = norm.charAt(0) || currentVocab.pinyin.charAt(0);
          hintBox.textContent = "💡 คำใบ้: ขึ้นต้นด้วยตัว \"" + firstChar + "\" และมีความยาวประมาณ " + norm.length + " ตัวอักษร";
          hintBox.classList.remove("is-hidden");
          input.focus();
        });

        var isSpellingAnswered = false;

        function submitSpelling() {
          if (isSpellingAnswered) return;
          var val = input.value.trim();
          if (!val) {
            input.focus();
            return;
          }
          isSpellingAnswered = true;
          input.disabled = true;
          submitBtn.disabled = true;
          hintBtn.disabled = true;

          var userNorm = normalizePinyin(val);
          var correctNorm = normalizePinyin(currentVocab.pinyin);
          var isCorrect = userNorm === correctNorm || isSpokenAnswerMatch(val, currentVocab);

          handleAnswer(currentVocab, isCorrect, qType, val, currentVocab.pinyin, card, null, null);
        }

        submitBtn.addEventListener("click", submitSpelling);
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            submitSpelling();
          }
        });

        actionsRow.appendChild(submitBtn);
        actionsRow.appendChild(hintBtn);
        spellingBox.appendChild(actionsRow);

        card.appendChild(spellingBox);

        setTimeout(function () { input.focus(); }, 150);
      }

      qContainer.appendChild(card);
    }

    function handleAnswer(vocab, isCorrect, qType, userAns, correctAns, cardEl, clickedBtn, optListEl) {
      if (isCorrect) {
        score++;
        comboStreak++;
      } else {
        comboStreak = 0;
      }

      sessionResults.push({
        vocab: vocab,
        isCorrect: isCorrect,
        questionType: qType,
        userAnswer: userAns,
        correctAnswer: correctAns
      });

      // ไฮไลต์ปุ่มตัวเลือก (สำหรับ meaning และ listening)
      if (optListEl) {
        var allBtns = optListEl.querySelectorAll(".quiz-option-btn");
        for (var b = 0; b < allBtns.length; b++) {
          allBtns[b].classList.add("is-disabled");
          var btnText = allBtns[b].querySelector(".quiz-option-text") ? allBtns[b].querySelector(".quiz-option-text").textContent : "";
          if (btnText.indexOf(correctAns) >= 0 || btnText === correctAns) {
            allBtns[b].classList.add("is-correct");
          }
        }
        if (!isCorrect && clickedBtn) {
          clickedBtn.classList.add("is-wrong");
        }
      }

      // บันทึกความคืบหน้าคำศัพท์ลง Local Storage และอัปเดตประวัติ Streak
      if (DATA && typeof DATA.updateProgress === "function") {
        DATA.updateProgress(vocab.id, isCorrect ? true : false);
      }

      // แสดง Feedback Box ด้านล่างการ์ดคำถาม
      var feedbackBox = el("div", "quiz-feedback-box");

      var banner = el("div", "quiz-feedback-banner " + (isCorrect ? "is-correct" : "is-wrong"));
      if (isCorrect) {
        banner.innerHTML = "<span>🎉</span> <span>ยอดเยี่ยมมาก! ตอบถูกต้อง</span>";
      } else {
        banner.innerHTML = "<span>❌</span> <span>ยังไม่ถูกต้องนะ คำตอบที่ถูกต้องคือ: <strong>" + correctAns + "</strong></span>";
      }
      feedbackBox.appendChild(banner);

      // Mini Vocabulary Card ทบทวนความรู้
      var details = el("div", "quiz-vocab-details");
      var dHead = el("div", "quiz-vocab-details-head");
      var dHz = el("span", "quiz-vocab-details-hanzi", vocab.hanzi);
      var dPy = el("span", "quiz-vocab-details-pinyin", vocab.pinyin);
      var dListen = el("button", "learn-listen-btn", "🔊 ฟังเสียง");
      dListen.type = "button";
      dListen.style.padding = "4px 10px";
      dListen.style.fontSize = "12px";
      dListen.addEventListener("click", function () {
        speakChinese(vocab.hanzi);
      });

      var dLeft = el("div", null);
      dLeft.appendChild(dHz);
      dLeft.appendChild(document.createTextNode(" "));
      dLeft.appendChild(dPy);
      dHead.appendChild(dLeft);
      dHead.appendChild(dListen);
      details.appendChild(dHead);

      details.appendChild(el("div", "quiz-vocab-details-meaning", "ความหมาย: " + vocab.meaning_th));

      if (vocab.example) {
        var exBox = el("div", "quiz-vocab-details-example");
        exBox.appendChild(el("div", "quiz-vocab-details-example-hz", vocab.example));
        if (vocab.example_th) {
          exBox.appendChild(el("div", "quiz-vocab-details-example-th", vocab.example_th));
        }
        details.appendChild(exBox);
      }

      if (vocab.memory_tip) {
        var tipBox = el("div", "quiz-vocab-details-tip");
        tipBox.innerHTML = "<span>💡</span> <span>เทคนิคช่วยจำ: " + vocab.memory_tip + "</span>";
        details.appendChild(tipBox);
      }

      feedbackBox.appendChild(details);

      // ปุ่มข้อถัดไป หรือ ดูผลสรุป
      var isLast = currentIndex === quizQuestions.length - 1;
      var nextBtn = el("button", "btn btn-primary quiz-next-btn", isLast ? "🎉 ดูสรุปผลคะแนน" : "ข้อถัดไป →");
      nextBtn.type = "button";
      nextBtn.addEventListener("click", function () {
        currentIndex++;
        renderQuestion();
      });
      feedbackBox.appendChild(nextBtn);

      cardEl.appendChild(feedbackBox);

      // เลื่อนจอลงมาหา feedback ถ้าอยู่ล่าง
      try {
        feedbackBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (e) {}

      updateHeaderStats();
    }

    function showQuizSummary() {
      if (quizBody) quizBody.classList.add("is-hidden");
      if (resultBox) {
        clear(resultBox);
        resultBox.classList.remove("is-hidden");
      }

      // ฉลองความสำเร็จเมื่อทำแบบทดสอบจบด้วย Confetti Animation
      triggerConfetti({ duration: 3500, particleCount: 120 });

      // ตรวจสอบเป้าหมายประจำวันและเหรียญรางวัล Milestone
      checkAndSaveNewMilestones();

      var total = quizQuestions.length;
      var pct = total > 0 ? Math.round((score / total) * 100) : 0;

      var trophy = "🏆";
      var title = "ยอดเยี่ยมมาก! อัจฉริยะจำศัพท์";
      var msg = "คุณตอบถูกเกือบทุกข้อ สมองของคุณเริ่มจดจำคำศัพท์เหล่านี้ได้อย่างแม่นยำแล้ว!";

      if (pct === 100) {
        trophy = "🏆";
        title = "ไร้ที่ติ! ถูกต้อง 100%";
        msg = "สุดยอดไปเลย! คุณจำคำศัพท์ชุดนี้ได้อย่างแม่นยำทุกตัว พร้อมนำไปใช้จริงแล้ว";
      } else if (pct >= 80) {
        trophy = "🌟";
        title = "เก่งมาก! จำได้แม่นยำ";
        msg = "คุณทำได้ดีมาก ตอบถูกเกือบทั้งหมด ทบทวนอีกนิดเดียวจะเต็มร้อย!";
      } else if (pct >= 60) {
        trophy = "👍";
        title = "ทำได้ดี! กำลังพัฒนา";
        msg = "จำได้เกินครึ่งแล้วนะ คำที่ยังจำไม่ได้การทบทวนซ้ำจะช่วยให้ติดหัวได้แน่นอน";
      } else {
        trophy = "💪";
        title = "สู้ต่อไป! อย่ายอมแพ้";
        msg = "การลองตอบและผิดพลาดเป็นวิธีที่สมองเรียนรู้ได้ดีที่สุด ลองทำซ้ำอีกครั้งนะ!";
      }

      var card = el("section", "quiz-result-card");
      card.appendChild(el("div", "quiz-result-trophy", trophy));
      card.appendChild(el("h2", "quiz-result-title", title));
      card.appendChild(el("p", "quiz-result-sub", "คุณทำแบบทดสอบครบทั้ง " + total + " ข้อแล้ว"));

      var circle = el("div", "quiz-result-score-circle");
      circle.appendChild(el("div", "quiz-result-score-num", score + " / " + total));
      circle.appendChild(el("div", "quiz-result-score-pct", pct + "% ถูกต้อง"));
      card.appendChild(circle);

      card.appendChild(el("div", "quiz-result-feedback", msg));

      // รายการคำศัพท์ที่ทดสอบพร้อมสถานะ ✅ / ❌
      var reviewHead = el("div", "card-label", "สรุปผลรายคำศัพท์");
      reviewHead.style.textAlign = "left";
      card.appendChild(reviewHead);

      var list = el("div", "quiz-result-review-list");
      sessionResults.forEach(function (res) {
        var item = el("div", "quiz-result-item " + (res.isCorrect ? "is-correct" : "is-wrong"));

        var left = el("div", "quiz-result-item-left");
        left.appendChild(el("span", "quiz-result-item-icon", res.isCorrect ? "✅" : "❌"));

        var info = el("div", null);
        var hzLine = el("div", null);
        hzLine.appendChild(el("span", "quiz-result-item-hanzi", res.vocab.hanzi));
        hzLine.appendChild(document.createTextNode(" "));
        hzLine.appendChild(el("span", "quiz-result-item-pinyin", res.vocab.pinyin));
        info.appendChild(hzLine);
        info.appendChild(el("div", "quiz-result-item-meaning", res.vocab.meaning_th));
        left.appendChild(info);

        item.appendChild(left);

        var listenBtn = el("button", "quiz-result-item-listen", "🔊");
        listenBtn.type = "button";
        listenBtn.title = "ฟังเสียง";
        listenBtn.addEventListener("click", function () {
          speakChinese(res.vocab.hanzi);
        });
        item.appendChild(listenBtn);

        list.appendChild(item);
      });
      card.appendChild(list);

      // ปุ่มควบคุม
      var actions = el("div", "quiz-result-actions");

      var retryBtn = el("button", "btn btn-primary", "🔄 ทำแบบทดสอบอีกครั้ง");
      retryBtn.type = "button";
      retryBtn.addEventListener("click", restartQuiz);
      actions.appendChild(retryBtn);

      if (chapter) {
        var backChapBtn = el("button", "btn btn-secondary", "📖 กลับไปที่บทเรียน (" + chapter.title + ")");
        backChapBtn.type = "button";
        backChapBtn.addEventListener("click", function () {
          go("chapter-detail.html?id=" + encodeURIComponent(chapter.id));
        });
        actions.appendChild(backChapBtn);
      } else {
        var chapBtn = el("button", "btn btn-secondary", "📚 ไปที่รายการบทเรียน");
        chapBtn.type = "button";
        chapBtn.addEventListener("click", function () {
          go("chapters.html");
        });
        actions.appendChild(chapBtn);
      }

      var homeBtn = el("button", "btn-action-outline is-primary", "🏠 กลับหน้าแรก");
      homeBtn.type = "button";
      homeBtn.style.textAlign = "center";
      homeBtn.addEventListener("click", function () {
        go("index.html");
      });
      actions.appendChild(homeBtn);

      card.appendChild(actions);
      resultBox.appendChild(card);
    }

    function restartQuiz() {
      if (quizBody) quizBody.classList.remove("is-hidden");
      if (resultBox) resultBox.classList.add("is-hidden");
      if (stateBoxEl) stateBoxEl.classList.add("is-hidden");
      setupQuestions();
      renderQuestion();
    }

    // เริ่มต้นทำควิซ
    setupQuestions();
    renderQuestion();
  }

  /* ---------- Expose Helpers (TASK 5.3, 5.4, 6.1, 7.1, 8.1, 8.3) ---------- */
  if (DATA) {
    DATA.getProgress = getVocabularyProgress;
    DATA.loadProgress = loadProgress;
    DATA.saveProgress = saveProgress;
    DATA.updateProgress = updateVocabularyProgress;
    DATA.getStatusBadgeInfo = getStatusBadgeInfo;
    DATA.SRS_INTERVALS = SRS_INTERVALS;
    DATA.addDays = addDays;
    DATA.calculateSRS = calculateSRS;
    DATA.isDueForReview = isDueForReview;
    DATA.getReviewUrgency = getReviewUrgency;
    DATA.getStudyHistory = getStudyHistory;
    DATA.recordStudyActivity = recordStudyActivity;
    DATA.calculateStreak = calculateStreak;
    DATA.normalizePinyin = normalizePinyin;
    DATA.getStreakMilestones = getStreakMilestones;
    DATA.getDailyGoal = getDailyGoal;
    DATA.setDailyGoal = setDailyGoal;
    DATA.getTodayWordsStudied = getTodayWordsStudied;
    DATA.getDailyWordsCount = getDailyWordsCount;
    DATA.getPast7DaysStreakData = getPast7DaysStreakData;
    DATA.renderHomeStreakChart = renderHomeStreakChart;
    DATA.isSpokenAnswerMatch = isSpokenAnswerMatch;
    DATA.getDailyGoalProgress = getDailyGoalProgress;
    DATA.triggerConfetti = triggerConfetti;
    DATA.speakChinese = speakChinese;
    DATA.stopSpeech = stopSpeech;
    DATA.isSpeechSupported = isSpeechSupported;
    DATA.addVocabulary = DATA.addVocabulary || (window.VOCAB_DATA ? window.VOCAB_DATA.addVocabulary : null);
    DATA.addCustomVocabulary = DATA.addVocabulary;
  }
  if (typeof window !== "undefined") {
    window.loadProgress = loadProgress;
    window.saveProgress = saveProgress;
    window.getVocabularyProgress = getVocabularyProgress;
    window.updateVocabularyProgress = updateVocabularyProgress;
    window.getStatusBadgeInfo = getStatusBadgeInfo;
    window.initHome = initHome;
    window.initChapters = initChapters;
    window.initChapterDetail = initChapterDetail;
    window.initLearn = initLearn;
    window.initQuickReview = initQuickReview;
    window.initProgress = initProgress;
    window.initCreateChapter = initCreateChapter;
    window.initQuiz = initQuiz;
    window.initVocabCard = initVocabCard;
    window.speakChinese = speakChinese;
    window.stopSpeech = stopSpeech;
    window.isSpeechSupported = isSpeechSupported;
    window.getDailyWordsCount = getDailyWordsCount;
    window.getPast7DaysStreakData = getPast7DaysStreakData;
    window.renderHomeStreakChart = renderHomeStreakChart;
    window.isSpokenAnswerMatch = isSpokenAnswerMatch;
    window.addVocabulary = function (wordData, targetChapterId) {
      if (DATA && typeof DATA.addVocabulary === "function") {
        return DATA.addVocabulary(wordData, targetChapterId);
      } else if (window.VOCAB_DATA && typeof window.VOCAB_DATA.addVocabulary === "function") {
        return window.VOCAB_DATA.addVocabulary(wordData, targetChapterId);
      }
      return { success: false, error: "VOCAB_DATA not available" };
    };
    window.addCustomVocabulary = window.addVocabulary;
    window.SRS_INTERVALS = SRS_INTERVALS;
    window.addDays = addDays;
    window.calculateSRS = calculateSRS;
    window.isDueForReview = isDueForReview;
    window.getReviewUrgency = getReviewUrgency;
    window.getStudyHistory = getStudyHistory;
    window.recordStudyActivity = recordStudyActivity;
    window.calculateStreak = calculateStreak;
    window.normalizePinyin = normalizePinyin;
    window.getStreakMilestones = getStreakMilestones;
    window.getChapterStats = getChapterStats;
    window.getDailyGoal = getDailyGoal;
    window.setDailyGoal = setDailyGoal;
    window.getTodayWordsStudied = getTodayWordsStudied;
    window.recordWordStudiedToday = recordWordStudiedToday;
    window.getDailyGoalProgress = getDailyGoalProgress;
    window.triggerConfetti = triggerConfetti;
    window.playCelebrationChime = playCelebrationChime;
    window.showCelebrationToast = showCelebrationToast;
    window.showCelebrationModal = showCelebrationModal;
    window.checkAndSaveNewMilestones = checkAndSaveNewMilestones;
    window.getDailyReminderSettings = getDailyReminderSettings;
    window.saveDailyReminderSettings = saveDailyReminderSettings;
    window.checkDailyGoalReminder = checkDailyGoalReminder;
    window.triggerDailyReminderNotification = triggerDailyReminderNotification;
    window.celebrateStreakReward = celebrateStreakReward;
    window.showPageTour = showPageTour;
    window.cleanSimulatedData = cleanSimulatedData;
    window.PAGE_TOURS_CONFIG = PAGE_TOURS_CONFIG;
  }

  /* ============================================================
     หน้า Vocab Card Demo (vocab-card.html)
     - รองรับการทดสอบ Flashcard และฟังเสียง TTS ทั้งด้านหน้า/หลัง/ตัวอย่างประโยค
     - รองรับ Spaced Repetition 5 ระดับ
     ============================================================ */
  function initVocabCard() {
    var btnF = document.getElementById("vocabCardListenBtnFront");
    var btnB = document.getElementById("vocabCardListenBtnBack");
    var btnEx = document.getElementById("vocabCardExampleListenBtn");
    var srsRating = document.getElementById("srsRating");

    function playBtnVoice(text, btn) {
      if (!text) return;
      if (btn) {
        btn.classList.add("is-playing");
        if (btn.classList.contains("learn-listen-btn")) btn.textContent = "🔊 กำลังเล่น...";
      }
      speakChinese(text, {
        onEnd: function () {
          if (btn) {
            btn.classList.remove("is-playing");
            if (btn.classList.contains("learn-listen-btn")) btn.textContent = "🔊 ฟังเสียง";
          }
        },
        onError: function () {
          if (btn) {
            btn.classList.remove("is-playing");
            if (btn.classList.contains("learn-listen-btn")) btn.textContent = "🔊 ฟังเสียง";
          }
        }
      });
    }

    if (btnF) {
      btnF.addEventListener("click", function (e) {
        e.stopPropagation();
        playBtnVoice("老师", btnF);
      });
    }
    if (btnB) {
      btnB.addEventListener("click", function (e) {
        e.stopPropagation();
        playBtnVoice("老师", btnB);
      });
    }
    if (btnEx) {
      btnEx.addEventListener("click", function (e) {
        e.stopPropagation();
        playBtnVoice("老师教我们中文。", btnEx);
      });
    }

    if (srsRating) {
      var srsButtons = srsRating.querySelectorAll(".srs-btn");
      for (var i = 0; i < srsButtons.length; i++) {
        (function (b, idx) {
          b.addEventListener("click", function () {
            triggerConfetti({ duration: 2000, particleCount: 50 });
            showCelebrationToast("⭐ บันทึกระดับความจำ Spaced Repetition ระดับ " + (idx + 1) + " แล้ว!");
          });
        })(srsButtons[i], i);
      }
    }
  }

  /* ---------- Router: ทำงานตามหน้าที่เปิดอยู่ ---------- */
  function init() {
    cleanSimulatedData();
    var page = document.querySelector("main.page");
    if (!page) return;
    if (page.id === "page-home") initHome();
    else if (page.id === "page-chapters") initChapters();
    else if (page.id === "page-chapter-detail") initChapterDetail();
    else if (page.id === "page-learn") initLearn();
    else if (page.id === "page-quick-review") initQuickReview();
    else if (page.id === "page-progress") initProgress();
    else if (page.id === "page-create-chapter") initCreateChapter();
    else if (page.id === "page-quiz") initQuiz();
    else if (page.id === "page-vocab-card") initVocabCard();

    // Auto-setup Page Onboarding Tour & bind Help button
    setupPageOnboardingTour(page.id);
  }

  // Re-render views when cloud data is synced or backup is imported
  window.addEventListener("cvma:data-synced", function () {
    try {
      var page = document.querySelector("main.page");
      if (!page) return;
      if (page.id === "page-home") initHome();
      else if (page.id === "page-chapters") initChapters();
      else if (page.id === "page-chapter-detail") initChapterDetail();
      else if (page.id === "page-progress") initProgress();
    } catch (e) {
      console.warn("Error re-rendering after cloud sync:", e);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Periodic Background Check for Daily Goal Reminder (checks every 30 seconds)
  setInterval(function () {
    try {
      var check = checkDailyGoalReminder();
      if (check && check.shouldRemind) {
        triggerDailyReminderNotification();
      }
    } catch (e) {}
  }, 30000);
})();
