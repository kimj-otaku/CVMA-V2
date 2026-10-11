/* ============================================================
   VOCAB DATA — โครงสร้างข้อมูลกลาง (Central Data Store)
   TASK 4.1: Vocabulary Data System
   ============================================================
   ไฟล์นี้เก็บข้อมูล Chapter / Vocabulary / Vocabulary Progress
   ไว้ที่เดียว เพื่อให้หน้า Home, Chapters, Learn Mode, Quick Review
   และหน้าอื่น ๆ ในอนาคต เรียกใช้ข้อมูลชุดเดียวกันได้ โดยไม่ต้อง
   เขียนคำศัพท์ซ้ำในแต่ละไฟล์ HTML

   สถานะปัจจุบัน:
   - เป็นเพียง "โครงสร้างข้อมูล" (Data Layer) เท่านั้น
   - เชื่อมกับ chapters.html, chapter-detail.html (4.2), learn.html (4.3),
     quick-review.html (4.4) แล้วผ่าน app.js — หน้า Home ยังเป็นข้อความ static
   - ยังไม่มี Local Storage / IndexedDB / Spaced Repetition จริง
   - ฟังก์ชันที่แนบมาเป็นเพียง getter อ่านข้อมูลอย่างง่าย ไม่มี logic อื่น

   วิธีใช้ (สำหรับอนาคต):
   <script src="data/vocab-data.js"></script>
   แล้วเรียกผ่าน window.VOCAB_DATA เช่น
   VOCAB_DATA.getVocabularyByChapter('ch-001')
   ============================================================ */

(function (global) {
  "use strict";

  /* ------------------------------------------------------------
     1) CHAPTERS
     โครงสร้าง:
       id            string  รหัสบทเรียน (unique)
       title         string  ชื่อบทแบบจีน เช่น "第1课"
       description   string  คำอธิบายสั้น ๆ ของบท
       vocabularyIds string[] รายการ id ของคำศัพท์ในบทนี้ — "สร้างอัตโนมัติ" จาก
                             Vocabulary.chapterId ตอนโหลดไฟล์ (ข้อ 1.1) จึงไม่ต้องเขียนเอง
                             ต้นทางข้อมูลจริงมีที่เดียวคือ Vocabulary.chapterId
       createdAt     string  วันที่สร้างบท (ISO 8601)
  ------------------------------------------------------------ */
  var STORAGE_CUSTOM_CHAPTERS_KEY = "cvma_custom_chapters";
  var STORAGE_CUSTOM_VOCAB_KEY = "cvma_custom_vocabularies";
  var STORAGE_PROGRESS_KEY = "cvma_vocab_progress";

  var chapters = [
    {
      id: "ch-001",
      title: "第1课",
      description: "คำศัพท์พื้นฐาน HSK1 — คน/บุคคล",
      vocabularyIds: [],
      createdAt: "2026-09-24T00:00:00.000Z"
    },
    {
      id: "ch-002",
      title: "第2课",
      description: "",
      // ยังไม่มีคำศัพท์ที่มี chapterId = "ch-002" (ใช้ทดสอบ Empty State)
      vocabularyIds: [],
      createdAt: "2026-09-24T00:00:00.000Z"
    }
  ];

  /* ------------------------------------------------------------
     2) VOCABULARY
     โครงสร้าง:
       id           string  รหัสคำศัพท์ (unique)
       chapterId    string  รหัสบทที่คำนี้สังกัด (เชื่อมกับ Chapter.id)
       hanzi        string  ตัวอักษรจีน
       pinyin       string  พินอิน
       meaning_th   string  ความหมายภาษาไทย
       example      string  ตัวอย่างประโยคภาษาจีน
       example_th   string  คำแปลของตัวอย่างประโยค
       memory_tip   string  เทคนิคช่วยจำ
       category     string  หมวดหมู่คำศัพท์ เช่น "人物"
       difficulty   number  ระดับความยาก (1-3 ตาม UI จุดใน vocab-card)

     หมายเหตุ:
     - "老师" คือคำศัพท์ตัวอย่างเดิมที่ใช้ซ้ำอยู่ใน learn.html, quick-review.html,
       vocab-card.html จึงถูกย้ายมาไว้ที่นี่เป็น vocab-001 (ข้อมูลจริงจากโปรเจกต์)
     - vocab-002, vocab-003 เป็นคำศัพท์ HSK1 ทั่วไปที่เพิ่มเข้ามาเป็นตัวอย่างเพิ่มเติม
       เพื่อทดสอบว่าโครงสร้างรองรับหลายคำ/หลายบทได้จริง (ตามข้อ 6 ของ Task 4.1)
  ------------------------------------------------------------ */
  var vocabulary = [
    {
      id: "vocab-001",
      chapterId: "ch-001",
      hanzi: "老师",
      pinyin: "lǎoshī",
      meaning_th: "ครู",
      example: "老师教我们中文。",
      example_th: "ครูสอนภาษาจีนให้เรา",
      memory_tip: "老 + 师 → 老师 = ครู",
      category: "人物",
      difficulty: 1
    },
    {
      id: "vocab-002",
      chapterId: "ch-001",
      hanzi: "学生",
      pinyin: "xuéshēng",
      meaning_th: "นักเรียน",
      example: "我是学生。",
      example_th: "ฉันเป็นนักเรียน",
      memory_tip: "学 (เรียน) + 生 (คน) → 学生 = นักเรียน",
      category: "人物",
      difficulty: 1
    },
    {
      id: "vocab-003",
      chapterId: "ch-001",
      hanzi: "朋友",
      pinyin: "péngyou",
      meaning_th: "เพื่อน",
      example: "他是我的朋友。",
      example_th: "เขาเป็นเพื่อนของฉัน",
      memory_tip: "朋 + 友 (เพื่อนสองคนอยู่ด้วยกัน) → 朋友 = เพื่อน",
      category: "人物",
      difficulty: 1
    }
  ];

  /* ------------------------------------------------------------
     2.1) Custom Chapters & Custom Vocabulary (TASK 8.1)
     - จัดเก็บและอ่านบทเรียนและคำศัพท์ที่ผู้ใช้สร้างเองลง Local Storage
     - ผสานเข้ากับ Data กลางอย่างไร้รอยต่อในทุกหน้า
  ------------------------------------------------------------ */
  var customChapters = [];
  var customVocabulary = [];

  function loadCustomChapters() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        var raw = window.localStorage.getItem(STORAGE_CUSTOM_CHAPTERS_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn("loadCustomChapters: error parsing localStorage", e);
    }
    return [];
  }

  function saveCustomChapters(list) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_CUSTOM_CHAPTERS_KEY, JSON.stringify(list));
        return true;
      }
    } catch (e) {
      console.warn("saveCustomChapters: error saving to localStorage", e);
    }
    return false;
  }

  function loadCustomVocabulary() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        var raw = window.localStorage.getItem(STORAGE_CUSTOM_VOCAB_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn("loadCustomVocabulary: error parsing localStorage", e);
    }
    return [];
  }

  function saveCustomVocabulary(list) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_CUSTOM_VOCAB_KEY, JSON.stringify(list));
        return true;
      }
    } catch (e) {
      console.warn("saveCustomVocabulary: error saving to localStorage", e);
    }
    return false;
  }

  function syncVocabularyIds() {
    var allVocabs = vocabulary.concat(customVocabulary);
    var allChs = chapters.concat(customChapters);
    allChs.forEach(function (c) {
      c.vocabularyIds = allVocabs
        .filter(function (v) { return v.chapterId === c.id; })
        .map(function (v) { return v.id; });
    });
  }

  function reloadCustomData() {
    customChapters = loadCustomChapters();
    customVocabulary = loadCustomVocabulary();
    syncVocabularyIds();
  }

  // Initial load
  customChapters = loadCustomChapters();
  customVocabulary = loadCustomVocabulary();
  syncVocabularyIds();

  /* ------------------------------------------------------------
     3) VOCABULARY PROGRESS (เบื้องต้น)
     เก็บแยกจาก Vocabulary เพราะเป็นข้อมูล "สถานะการเรียนรู้" ของผู้ใช้
     ซึ่งจะเปลี่ยนบ่อยกว่าตัวคำศัพท์เอง (เหมาะกับการย้ายไป Local Storage
     หรือ IndexedDB แยกต่างหากในอนาคต โดยไม่กระทบข้อมูลคำศัพท์)

     key = vocabulary id
     โครงสร้างของแต่ละ record:
       status        string  "new" | "learning" | "reviewing" | "mastered"
       srsLevel      number  ระดับความจำ 0-5 (TASK 6.1 Spaced Repetition System)
       reviewCount   number  จำนวนครั้งที่ทบทวนแล้ว
       lastReviewed  string|null  วันที่ทบทวนล่าสุด (ISO 8601) หรือ null ถ้ายังไม่เคย
       nextReview    string|null  วันที่ควรทบทวนครั้งถัดไป หรือ null ถ้ายังไม่กำหนด
  ------------------------------------------------------------ */
  var vocabularyProgress = {
    "vocab-001": {
      status: "learning",
      srsLevel: 1,
      reviewCount: 0,
      lastReviewed: null,
      nextReview: null
    },
    "vocab-002": {
      status: "new",
      srsLevel: 0,
      reviewCount: 0,
      lastReviewed: null,
      nextReview: null
    },
    "vocab-003": {
      status: "new",
      srsLevel: 0,
      reviewCount: 0,
      lastReviewed: null,
      nextReview: null
    }
  };

  /* ------------------------------------------------------------
     4) GETTER & MUTATION ฟังก์ชันอ่านและจัดการข้อมูล (ผสาน Seed + Custom Data)
  ------------------------------------------------------------ */
  function getAllChapters() {
    syncVocabularyIds();
    return chapters.concat(customChapters);
  }

  function getChapterById(chapterId) {
    if (!chapterId) return null;
    var all = getAllChapters();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === chapterId) return all[i];
    }
    return null;
  }

  function getAllVocabulary() {
    return vocabulary.concat(customVocabulary);
  }

  function getVocabularyById(vocabId) {
    if (!vocabId) return null;
    var all = getAllVocabulary();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === vocabId) return all[i];
    }
    return null;
  }

  function getVocabularyByChapter(chapterId) {
    if (!chapterId) return [];
    var all = getAllVocabulary();
    return all.filter(function (v) {
      return v.chapterId === chapterId;
    });
  }

  function getProgress(vocabId) {
    return vocabularyProgress[vocabId] || null;
  }

  /* ------------------------------------------------------------
     4.1) สร้างบทเรียนใหม่และบันทึกลง Local Storage (TASK 8.1)
  ------------------------------------------------------------ */
  function createChapter(chapterData, vocabulariesData) {
    if (!chapterData || !chapterData.title || !chapterData.title.trim()) {
      return { success: false, error: "กรุณาระบุชื่อบทเรียน" };
    }
    if (!Array.isArray(vocabulariesData) || vocabulariesData.length === 0) {
      return { success: false, error: "กรุณาเพิ่มคำศัพท์อย่างน้อย 1 คำ" };
    }

    // กรองคำศัพท์ที่ถูกต้อง (ต้องมี Hanzi และความหมายไทย)
    var validVocabs = [];
    for (var i = 0; i < vocabulariesData.length; i++) {
      var item = vocabulariesData[i];
      if (item && item.hanzi && item.hanzi.trim() && item.meaning_th && item.meaning_th.trim()) {
        validVocabs.push(item);
      }
    }

    if (validVocabs.length === 0) {
      return { success: false, error: "คำศัพท์ต้องมีตัวอักษรจีน (Hanzi) และความหมายภาษาไทยอย่างน้อย 1 คำ" };
    }

    var timestamp = Date.now();
    var chapterId = "ch-u-" + timestamp;
    var vocabIds = [];

    var newVocabObjects = [];
    for (var j = 0; j < validVocabs.length; j++) {
      var vItem = validVocabs[j];
      var vId = "vocab-u-" + timestamp + "-" + (j + 1);
      vocabIds.push(vId);

      var newV = {
        id: vId,
        chapterId: chapterId,
        hanzi: vItem.hanzi.trim(),
        pinyin: (vItem.pinyin || "").trim(),
        meaning_th: vItem.meaning_th.trim(),
        example: (vItem.example || "").trim(),
        example_th: (vItem.example_th || "").trim(),
        memory_tip: (vItem.memory_tip || "").trim(),
        category: (vItem.category || "").trim() || "ทั่วไป",
        difficulty: Math.max(1, Math.min(3, Number(vItem.difficulty) || 1))
      };
      newVocabObjects.push(newV);
    }

    var newChapter = {
      id: chapterId,
      title: chapterData.title.trim(),
      description: (chapterData.description || "").trim(),
      vocabularyIds: vocabIds,
      createdAt: new Date().toISOString(),
      isCustom: true
    };

    // เพิ่มใน Local Storage Custom Data
    customChapters.push(newChapter);
    customVocabulary = customVocabulary.concat(newVocabObjects);

    saveCustomChapters(customChapters);
    saveCustomVocabulary(customVocabulary);
    syncVocabularyIds();

    // เริ่มต้นสถานะ Progress ให้กับคำศัพท์ใหม่ใน Local Storage
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        var rawProg = window.localStorage.getItem(STORAGE_PROGRESS_KEY);
        var progObj = {};
        if (rawProg) {
          try { progObj = JSON.parse(rawProg) || {}; } catch (e) {}
        }
        for (var k = 0; k < vocabIds.length; k++) {
          progObj[vocabIds[k]] = {
            status: "new",
            srsLevel: 0,
            reviewCount: 0,
            lastReviewed: null,
            nextReview: null
          };
        }
        window.localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(progObj));

        // ตั้งบทที่เพิ่งสร้างเป็น Active Chapter
        window.localStorage.setItem("cvma_active_chapter", chapterId);
      }
    } catch (e) {
      console.warn("createChapter: error initializing progress", e);
    }

    return {
      success: true,
      chapter: newChapter,
      vocabularies: newVocabObjects
    };
  }

  /* ------------------------------------------------------------
     4.2) ลบบทเรียนที่ผู้ใช้สร้างเอง
  ------------------------------------------------------------ */
  function deleteChapter(chapterId) {
    if (!chapterId) return false;
    var initialLen = customChapters.length;
    customChapters = customChapters.filter(function (c) { return c.id !== chapterId; });
    if (customChapters.length === initialLen) {
      return false; // ไม่พบบทเรียน หรือเป็น seed chapter
    }
    customVocabulary = customVocabulary.filter(function (v) { return v.chapterId !== chapterId; });
    saveCustomChapters(customChapters);
    saveCustomVocabulary(customVocabulary);
    syncVocabularyIds();
    return true;
  }

  /* ------------------------------------------------------------
     4.3) แก้ไขบทเรียนและจัดการคำศัพท์ในบท (TASK 8.2)
  ------------------------------------------------------------ */
  function updateChapter(chapterId, chapterData, vocabulariesData) {
    if (!chapterId) return { success: false, error: "ไม่ได้ระบุรหัสบทเรียน" };
    if (!chapterData || !chapterData.title || !chapterData.title.trim()) {
      return { success: false, error: "กรุณาระบุชื่อบทเรียน" };
    }
    if (!Array.isArray(vocabulariesData) || vocabulariesData.length === 0) {
      return { success: false, error: "กรุณาเพิ่มคำศัพท์อย่างน้อย 1 คำ" };
    }

    var targetChIndex = -1;
    for (var c = 0; c < customChapters.length; c++) {
      if (customChapters[c].id === chapterId) {
        targetChIndex = c;
        break;
      }
    }

    if (targetChIndex === -1) {
      return { success: false, error: "ไม่พบบทเรียนที่ต้องการแก้ไข หรือบทเรียนนี้เป็นบทเรียนระบบที่ไม่สามารถแก้ไขได้" };
    }

    // กรองคำศัพท์ที่ถูกต้อง
    var validVocabs = [];
    for (var i = 0; i < vocabulariesData.length; i++) {
      var item = vocabulariesData[i];
      if (item && item.hanzi && item.hanzi.trim() && item.meaning_th && item.meaning_th.trim()) {
        validVocabs.push(item);
      }
    }

    if (validVocabs.length === 0) {
      return { success: false, error: "คำศัพท์ต้องมีตัวอักษรจีน (Hanzi) และความหมายภาษาไทยอย่างน้อย 1 คำ" };
    }

    var timestamp = Date.now();
    var newVocabIds = [];
    var updatedVocabs = [];
    var newlyCreatedVocabIds = [];

    for (var j = 0; j < validVocabs.length; j++) {
      var vItem = validVocabs[j];
      var vId = vItem.id;
      // ถ้าไม่มี ID เดิม (คำที่เพิ่มใหม่ขณะแก้ไข) ให้สร้าง ID ใหม่
      if (!vId || typeof vId !== "string" || vId.indexOf("vocab-") !== 0) {
        vId = "vocab-u-" + timestamp + "-" + (j + 1);
        newlyCreatedVocabIds.push(vId);
      }
      newVocabIds.push(vId);

      updatedVocabs.push({
        id: vId,
        chapterId: chapterId,
        hanzi: vItem.hanzi.trim(),
        pinyin: (vItem.pinyin || "").trim(),
        meaning_th: vItem.meaning_th.trim(),
        example: (vItem.example || "").trim(),
        example_th: (vItem.example_th || "").trim(),
        memory_tip: (vItem.memory_tip || "").trim(),
        category: (vItem.category || "").trim() || "ทั่วไป",
        difficulty: Math.max(1, Math.min(3, Number(vItem.difficulty) || 1))
      });
    }

    // อัปเดตข้อมูลของ Chapter
    customChapters[targetChIndex].title = chapterData.title.trim();
    customChapters[targetChIndex].description = (chapterData.description || "").trim();
    customChapters[targetChIndex].vocabularyIds = newVocabIds;
    customChapters[targetChIndex].updatedAt = new Date().toISOString();

    // กรองคำศัพท์ของบทอื่นคงไว้ แล้วรวมคำศัพท์ที่อัปเดตของบทนี้
    customVocabulary = customVocabulary.filter(function (v) { return v.chapterId !== chapterId; }).concat(updatedVocabs);

    saveCustomChapters(customChapters);
    saveCustomVocabulary(customVocabulary);
    syncVocabularyIds();

    // เริ่มต้นสถานะ Progress สำหรับคำศัพท์ใหม่ที่เพิ่งเพิ่มเข้ามา
    if (newlyCreatedVocabIds.length > 0) {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          var rawProg = window.localStorage.getItem(STORAGE_PROGRESS_KEY);
          var progObj = {};
          if (rawProg) {
            try { progObj = JSON.parse(rawProg) || {}; } catch (e) {}
          }
          for (var k = 0; k < newlyCreatedVocabIds.length; k++) {
            var nId = newlyCreatedVocabIds[k];
            if (!progObj[nId]) {
              progObj[nId] = {
                status: "new",
                srsLevel: 0,
                reviewCount: 0,
                lastReviewed: null,
                nextReview: null
              };
            }
          }
          window.localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(progObj));
        }
      } catch (e) {
        console.warn("updateChapter: error initializing progress for new vocabs", e);
      }
    }

    return {
      success: true,
      chapter: customChapters[targetChIndex],
      vocabularies: updatedVocabs
    };
  }

  /* ------------------------------------------------------------
     4.4) ลบคำศัพท์เดี่ยวในบทเรียนที่ผู้ใช้สร้างเอง
  ------------------------------------------------------------ */
  function deleteVocabulary(vocabId) {
    if (!vocabId) return false;
    var target = null;
    for (var i = 0; i < customVocabulary.length; i++) {
      if (customVocabulary[i].id === vocabId) {
        target = customVocabulary[i];
        break;
      }
    }
    if (!target) return false;

    // ลบออกจาก customVocabulary
    customVocabulary = customVocabulary.filter(function (v) { return v.id !== vocabId; });
    saveCustomVocabulary(customVocabulary);

    // อัปเดต chapter.vocabularyIds
    syncVocabularyIds();
    saveCustomChapters(customChapters);
    return true;
  }

  /* ------------------------------------------------------------
     4.4.1) เพิ่มคำศัพท์ใหม่เข้าสู่ฐานข้อมูล (Add Custom Vocabulary Word)
     - รองรับการเพิ่มคำศัพท์เดี่ยวพร้อม 汉字 (Character), Pinyin, และความหมายไทย (Meaning)
     - กำหนดบทเรียนเป้าหมายได้ หรือหากไม่ระบุจะบันทึกลงบท "คำศัพท์ของฉัน" อัตโนมัติ
     - บันทึกสถานะคำศัพท์เริ่มต้น (new / srsLevel: 0) ลง Local Storage ทันที
  ------------------------------------------------------------ */
  function addVocabulary(wordData, targetChapterId) {
    if (!wordData || !wordData.hanzi || !wordData.hanzi.trim()) {
      return { success: false, error: "กรุณาระบุตัวอักษรจีน (Hanzi)" };
    }
    if (!wordData.meaning_th || !wordData.meaning_th.trim()) {
      return { success: false, error: "กรุณาระบุความหมายภาษาไทย" };
    }

    var hanzi = wordData.hanzi.trim();
    var pinyin = (wordData.pinyin || "").trim();
    var meaning_th = wordData.meaning_th.trim();
    var example = (wordData.example || "").trim();
    var example_th = (wordData.example_th || "").trim();
    var memory_tip = (wordData.memory_tip || "").trim();
    var category = (wordData.category || "").trim() || "คำศัพท์ของฉัน";
    var difficulty = Math.max(1, Math.min(3, Number(wordData.difficulty) || 1));

    // ตรวจสอบหรือกำหนดบทเรียนเป้าหมาย
    var chapterId = targetChapterId;
    if (!chapterId || !getChapterById(chapterId)) {
      var allCh = getAllChapters();
      if (allCh.length > 0) {
        chapterId = allCh[0].id;
      } else {
        var defaultChapter = {
          id: "ch-custom-user",
          title: "คำศัพท์ของฉัน",
          description: "คลังคำศัพท์ที่บันทึกเพิ่มเติมด้วยตนเอง",
          vocabularyIds: [],
          createdAt: new Date().toISOString(),
          isCustom: true
        };
        customChapters.push(defaultChapter);
        saveCustomChapters(customChapters);
        chapterId = defaultChapter.id;
      }
    }

    var timestamp = Date.now();
    var newId = "vocab-u-" + timestamp + "-" + Math.floor(Math.random() * 1000);

    var newVocab = {
      id: newId,
      chapterId: chapterId,
      hanzi: hanzi,
      pinyin: pinyin,
      meaning_th: meaning_th,
      example: example,
      example_th: example_th,
      memory_tip: memory_tip,
      category: category,
      difficulty: difficulty
    };

    customVocabulary.push(newVocab);
    saveCustomVocabulary(customVocabulary);
    syncVocabularyIds();
    saveCustomChapters(customChapters);

    // เริ่มต้นสถานะ Progress ใน Local Storage
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        var rawProg = window.localStorage.getItem(STORAGE_PROGRESS_KEY);
        var progObj = rawProg ? JSON.parse(rawProg) : {};
        if (!progObj[newId]) {
          progObj[newId] = {
            status: "new",
            srsLevel: 0,
            reviewCount: 0,
            lastReviewed: null,
            nextReview: null
          };
          window.localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(progObj));
        }
      }
    } catch (e) {
      console.warn("addVocabulary: error setting progress", e);
    }

    return {
      success: true,
      vocabulary: newVocab,
      chapterId: chapterId
    };
  }

  /* ------------------------------------------------------------
     4.5) สำรองและส่งออกข้อมูล (Export Backup) (TASK 8.2)
  ------------------------------------------------------------ */
  function exportBackupData() {
    var progressData = {};
    var historyData = [];
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        var rawProg = window.localStorage.getItem(STORAGE_PROGRESS_KEY);
        if (rawProg) progressData = JSON.parse(rawProg) || {};
        var rawHist = window.localStorage.getItem("cvma_study_history");
        if (rawHist) historyData = JSON.parse(rawHist) || [];
      }
    } catch (e) {}

    return {
      appName: "Chinese Vocabulary Memory App",
      version: 1,
      exportedAt: new Date().toISOString(),
      customChapters: customChapters,
      customVocabulary: customVocabulary,
      progress: progressData,
      studyHistory: historyData
    };
  }

  /* ------------------------------------------------------------
     4.6) นำเข้าข้อมูลสำรอง (Import Backup) (TASK 8.2)
  ------------------------------------------------------------ */
  function importBackupData(backupData, mode) {
    var data = backupData;
    if (typeof backupData === "string") {
      try {
        data = JSON.parse(backupData);
      } catch (e) {
        return { success: false, error: "ไฟล์ JSON ไม่ถูกต้องหรือไม่สามารถอ่านได้" };
      }
    }

    if (!data || typeof data !== "object") {
      return { success: false, error: "โครงสร้างข้อมูลสำรองไม่ถูกต้อง" };
    }

    var importChapters = Array.isArray(data.customChapters) ? data.customChapters : [];
    var importVocabs = Array.isArray(data.customVocabulary) ? data.customVocabulary : [];
    var importProg = (data.progress && typeof data.progress === "object" && !Array.isArray(data.progress)) ? data.progress : {};
    var importHist = Array.isArray(data.studyHistory) ? data.studyHistory : [];

    if (importChapters.length === 0 && importVocabs.length === 0 && Object.keys(importProg).length === 0) {
      return { success: false, error: "ไม่พบข้อมูลบทเรียนหรือคำศัพท์ในไฟล์สำรอง" };
    }

    var isReplace = (mode === "replace");

    if (isReplace) {
      customChapters = importChapters;
      customVocabulary = importVocabs;
    } else {
      // Merge mode
      var chapterMap = {};
      customChapters.forEach(function (c) { chapterMap[c.id] = c; });
      importChapters.forEach(function (c) { chapterMap[c.id] = c; });
      customChapters = Object.values(chapterMap);

      var vocabMap = {};
      customVocabulary.forEach(function (v) { vocabMap[v.id] = v; });
      importVocabs.forEach(function (v) { vocabMap[v.id] = v; });
      customVocabulary = Object.values(vocabMap);
    }

    saveCustomChapters(customChapters);
    saveCustomVocabulary(customVocabulary);
    syncVocabularyIds();

    // บันทึก Progress & History
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        var existingProg = {};
        if (!isReplace) {
          var rawP = window.localStorage.getItem(STORAGE_PROGRESS_KEY);
          if (rawP) try { existingProg = JSON.parse(rawP) || {}; } catch (e) {}
        }
        var mergedProg = Object.assign({}, existingProg, importProg);
        window.localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(mergedProg));

        var existingHist = [];
        if (!isReplace) {
          var rawH = window.localStorage.getItem("cvma_study_history");
          if (rawH) try { existingHist = JSON.parse(rawH) || []; } catch (e) {}
        }
        var mergedHistSet = {};
        existingHist.concat(importHist).forEach(function (d) { if (d) mergedHistSet[d] = true; });
        var mergedHistArr = Object.keys(mergedHistSet).sort();
        window.localStorage.setItem("cvma_study_history", JSON.stringify(mergedHistArr));
      }
    } catch (e) {
      console.warn("importBackupData: error saving progress/history", e);
    }

    return {
      success: true,
      importedChaptersCount: importChapters.length,
      importedVocabCount: importVocabs.length,
      totalChapters: customChapters.length,
      totalVocabs: customVocabulary.length
    };
  }

  /* ------------------------------------------------------------
     5) EXPORT — ผูกกับ window เพื่อให้ทุกหน้า HTML เรียกใช้ร่วมกันได้
        ผ่าน <script src="data/vocab-data.js"></script>
  ------------------------------------------------------------ */
  global.VOCAB_DATA = {
    chapters: chapters,
    vocabulary: vocabulary,
    vocabularyProgress: vocabularyProgress,
    getAllChapters: getAllChapters,
    getChapterById: getChapterById,
    getAllVocabulary: getAllVocabulary,
    getVocabularyById: getVocabularyById,
    getVocabularyByChapter: getVocabularyByChapter,
    getProgress: getProgress,
    createChapter: createChapter,
    updateChapter: updateChapter,
    deleteChapter: deleteChapter,
    deleteVocabulary: deleteVocabulary,
    addVocabulary: addVocabulary,
    addCustomVocabulary: addVocabulary,
    exportBackupData: exportBackupData,
    importBackupData: importBackupData,
    reloadCustomData: reloadCustomData,
    getCustomChapters: function () { return customChapters; },
    getCustomVocabulary: function () { return customVocabulary; }
  };

})(typeof window !== "undefined" ? window : globalThis);
