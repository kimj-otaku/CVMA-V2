# PROJECT_STATE.md
## Chinese Vocabulary Memory App

---

## Project Goal
เว็บแอปส่วนตัวสำหรับช่วยจำคำศัพท์ภาษาจีน (Personal Chinese Vocabulary Memory Trainer)
เป้าหมาย: จำง่าย → จำเร็ว → นึกออกเอง → จำได้นาน → ใช้ภาษาจีนได้จริง

ผู้ใช้: นักศึกษาทุนจีน เรียนอยู่ในประเทศจีน ระดับ HSK 1–5 ใช้มือถือเป็นหลัก

---

### Current Phase
FIRST-SCREEN CLOUD SYNC & CLEAN UI POLISH COMPLETED
STATUS: PRODUCTION COMPLETE — บังคับเปิดหน้าต่าง ☁️ ซิงก์คลาวด์ เป็นหน้าแรกเมื่อเปิดแอปพลิเคชัน พร้อมปรับดีไซน์หน้าจอทั้งหมดให้คลีน สบายตา มินิมอล

## Current Task
- บังคับให้ขึ้นหน้า ☁️ ซิงก์คลาวด์ เป็นหน้าแรก และปรับ UI ให้คลีน สะอาดตา: เสร็จสมบูรณ์

## Completed Tasks
- [x] FIRST-SCREEN CLOUD SYNC & CLEAN MINIMALIST UI:
  - บังคับเปิดหน้าต่าง `☁️ ซิงก์คลาวด์` (Cloud Sync Modal) เป็นหน้าแรกโดยอัตโนมัติเมื่อเปิดแอปหรือเข้าสู่หน้า `index.html` เพื่อให้ผู้เรียนบน iPhone, iPad หรือคอมพิวเตอร์เชื่อมต่อบัญชีได้ทันที
  - ปรับดีไซน์หน้าต่างซิงก์คลาวด์ใหม่ทั้งหมดแบบมินิมอลคลีน (Apple-inspired clean aesthetic): มีไอคอนก้อนเมฆนุ่มนวล, ไฮไลต์ข้อดี 3 ข้อ, ปุ่ม Google Sign-In มาตรฐาน, ปุ่ม "✨ เข้าสู่หน้าหลัก (ใช้งานออฟไลน์ในเครื่องนี้)" สำหรับเริ่มเรียนต่อได้ทันที
  - จัดการสถานะผู้ใช้ที่ล็อกอินแล้ว: แสดงการ์ดโปรไฟล์คลีนๆ รูปภาพ/ชื่อ/อีเมล, สถานะ "🟢 เชื่อมต่อคลาวด์แล้ว", ปุ่ม "🔄 ซิงก์ข้อมูลตอนนี้", "✨ ไปที่หน้าหลัก", และ "🚪 ออกจากระบบ"
  - ติดตั้งแถบสถานะคลาวด์บนหน้าแรก (`#homeCloudSyncBanner`): แสดงสถานะเชื่อมต่อสด และปุ่มลัดแตะเปิดหน้าต่างซิงก์ได้ทุกเวลา
  - ปรับปรุงความสะอาดของ UI โดยรวม (Anti-Clutter Clean Polish): ปรับเงาขอบการ์ดให้นุ่มนวลสบายตา (Soft Pastel Shadows), ลดความหนาของเส้นขอบ (Clean Hairline Borders), จัดระยะห่างระหว่างการ์ดให้โปร่งสบาย และปรับการ์ดเป้าหมายประจำวันให้เรียบหรู
- [x] CROSS-DEVICE CLOUD SYNC & HYBRID BACKUP SYSTEM (FIREBASE + JSON):
  - ติดตั้ง Firebase Authentication รองรับการเข้าสู่ระบบด้วย Google Account เชื่อมต่ออุปกรณ์ข้ามแพลตฟอร์ม (iPhone, iPad, Mac, PC)
  - พัฒนาระบบ Cloud Firestore 2-Way Sync สำหรับบันทึกบทเรียนที่ผู้ใช้สร้างเอง (Custom Chapters), คำศัพท์ที่สร้างเอง (Custom Vocabularies), ระดับความจำ Spaced Repetition (SRS Progress), และประวัติการเรียนรายวัน (Study History)
  - บันทึกและดึงข้อมูลอัจฉริยะแบบ Smart-Merge รวมข้อมูลจากอุปกรณ์และคลาวด์เข้าด้วยกันโดยไม่ทำลายข้อมูลเดิม
  - ระบบสำรองข้อมูลออฟไลน์ (Export JSON Backup) ดาวน์โหลดไฟล์ข้อมูลทั้งหมดเก็บไว้ในเครื่อง
  - ระบบกู้คืนข้อมูล (Import JSON Backup) เลือกรวมข้อมูล (Merge) หรือแทนที่ (Replace) ได้อย่างอิสระ
  - ปุ่ม `☁️ ซิงก์คลาวด์` บน Header ทุกหน้า พร้อมสถานะเชื่อมต่อ (จุดสีเขียวเมื่อล็อกอินแล้ว) และ Modal จัดการอย่างละเอียด
  - การ์ดจัดการการเชื่อมต่อและการสำรองข้อมูลบนหน้า `progress.html`
- [x] PRODUCTION-READY DATA HYGIENE & CLEAN RESET:
  - นำเครื่องมือจำลองการทดสอบ `🧪 โหมดทดสอบ Streak Rewards` และปุ่มจำลองทั้งหมดออกจาก UI
  - ลบฟังก์ชันจำลอง `simulateStreak` และ `resetSimulatedStreak` ออกจาก `app.js`
  - ติดตั้งฟังก์ชัน `cleanSimulatedData()` ล้างคีย์จำลองการทดสอบทั้งหมด รีเซ็ตสถิติการเรียนรู้ ประวัติ และเหรียญรางวัลเริ่มต้นเป็นศูนย์แท้จริง (0 วัน, 0 คำ, 0/2 เหรียญ) เหมือนผู้ใช้ใหม่เปิดใช้งานครั้งแรก
  - รักษาฐานข้อมูลคำศัพท์มาตรฐาน HSK 1 และระบบ Spaced Repetition (SRS) ไว้อย่างครบถ้วนสมบูรณ์
- [x] INTERACTIVE PAGE-BY-PAGE ONBOARDING TOUR (ระบบแนะนำการใช้งานใหม่ทีละขั้นตอน):
  - ติดตั้งระบบ Tour Modal อัจฉริยะ แสดงคำแนะนำทีละขั้นตอนพร้อมไอคอน อิโมจิ หัวข้อ รายละเอียด เทคนิคการใช้งาน (Tips) และตัวบอกลำดับขั้นตอน (Step Dots)
  - ทำงานอัตโนมัติเมื่อเปิดเข้าใช้งานแต่ละหน้าครั้งแรก (Auto-trigger on First-Time Visit ผ่าน Local Storage `cvma_tour_seen_<page>`)
  - ติดตั้งปุ่ม `💡 วิธีใช้งาน` (Permanent Help / Tour Trigger) บน Header ของทุกหน้าในแอปพลิเคชัน (`index.html`, `chapters.html`, `chapter-detail.html`, `create-chapter.html`, `learn.html`, `quick-review.html`, `quiz.html`, และ `progress.html`) ให้ผู้ใช้สามารถแตะเพื่อเปิดอ่านคำแนะนำซ้ำได้ทุกเวลา
  - ไฮไลต์ส่วนประกอบเป้าหมายของแต่ละขั้นตอนด้วย Spotlight Outline เรืองแสงสีชมพูซากุระ พร้อมเลื่อนหน้าจอ (Auto-scroll) ไปยังตำแหน่งเป้าหมายอย่างนุ่มนวล
  - รองรับการควบคุมด้วยคีย์บอร์ด (Keyboard Accessibility: `Escape` เพื่อปิด, `ArrowRight` เพื่อไปขั้นตอนถัดไป, `ArrowLeft` เพื่อย้อนกลับ)
  - ออกแบบ UI ทัวร์สไตล์พาสเทลมินิมอล สะอาดตา ไร้ความรก (Anti-Slop) พร้อม Glassmorphism Backdrop Blur นุ่มนวล
- [x] DAILY NOTIFICATION REMINDER WITH CUSTOMIZABLE TIMING:
  - ระบบแจ้งเตือนเตือนใจรายวันให้ผู้เรียนเข้ามาตรวจสอบความคืบหน้าการจำศัพท์ หากในวันนั้นยังไม่พิชิตเป้าหมายประจำวัน (`!goalProg.isReached`)
  - รองรับการปรับแต่งเวลาแจ้งเตือนอย่างอิสระ (Customizable Timing): เลือกชิปเวลาแนะนำ (`08:30 ตอนเช้า`, `12:30 พักเที่ยง`, `18:00 ตอนเย็น`, `20:00 หัวค่ำ (แนะนำ)`, `21:30 ก่อนนอน`) หรือระบุเวลาแบบ 24 ชั่วโมง (`<input type="time">`)
  - สวิตช์เปิด/ปิดการแจ้งเตือน (Pastel iOS-Style Toggle Switch) และคงอยู่ผ่าน Local Storage (`cvma_daily_reminder_settings`)
  - เชื่อมต่อ Web Notifications API บนเบราว์เซอร์ พร้อมปุ่มขอสิทธิ์และสถานะการอนุญาต (Granted/Default/Denied)
  - แถบแจ้งเตือนเตือนใจบนหน้าแรก (`#homeReminderAlertBanner`) แสดงสถานะคำศัพท์ที่ยังขาดเทียบกับเป้าหมาย พร้อมปุ่ม `✨ ไปฝึกคำศัพท์เลย` (นำทางเข้าสู่บทเรียนปัจจุบัน), `⚙️ ปรับเวลา`, และ `✕ ปิด`
  - กล่องแสดงตัวอย่างข้อความแจ้งเตือนสด (Live Reminder Preview) อัปเดตตามจำนวนคำที่ต้องเรียนในวันนั้นแบบเรียลไทม์
  - ปุ่มทดสอบการแจ้งเตือนทันที (`🔔 ทดสอบการแจ้งเตือนทันที`) บน Modal ตั้งค่า เพื่อให้ผู้เรียนและผู้ตรวจทดสอบเสียง Chime, Browser Notification และ In-App Popup ได้ทันที
  - ตรวจสอบอัตโนมัติในพื้นหลัง (Background Interval Check) ทุก 30 วินาที
- [x] STREAK REWARD SYSTEM (7-DAY & 30-DAY DIGITAL BADGES + CONFETTI ANIMATION):
  - การ์ดรางวัลความต่อเนื่องบนหน้าความคืบหน้า (`#streakRewardsSummaryCard` ใน `progress.html`) ออกแบบอย่างประณีตพร้อมสถานะปลดล็อก (0/2)
  - เหรียญเกียรติยศดิจิทัล 7 วันติด (`⚡ มุ่งมั่น 7 วันติด - Week Warrior`): สะสมความสม่ำเสมอครบ 1 สัปดาห์
  - เหรียญเกียรติยศดิจิทัล 30 วันติด (`👑 ปรมาจารย์ 30 วัน - Monthly Legend`): พิชิตวินัยการจำคำศัพท์ 1 เดือนเต็ม
  - เมื่อผู้เรียนสะสม Streak ถึง 7 วัน หรือ 30 วัน:
    - ปลดล็อกเหรียญตราพร้อมออร่าเรืองแสงสีทอง/ม่วงลาเวนเดอร์และประกายวิบวับ
    - ยิงพลุเฉลิมฉลอง Confetti หลากสีพาสเทลหมุนพลิ้ว 3D สมจริง (`triggerConfetti`)
    - เล่นเสียงดนตรี Pentatonic Arpeggio Chime สังเคราะห์สดด้วย Web Audio API
    - แสดง Modal เฉลิมฉลองยกย่องความสำเร็จ
  - ผู้เรียนสามารถแตะที่เหรียญรางวัลหรือปุ่ม `🎉 แตะฉลอง Confetti!` เพื่อจุดพลุฉลองความสำเร็จได้ทุกเวลา
  - เครื่องมือจำลอง Streak (`🧪 โหมดทดสอบ Streak Rewards`): มีปุ่ม `⚡ ทดสอบ Streak 7 วัน`, `👑 ทดสอบ Streak 30 วัน`, และ `🔄 คืนค่าเดิม` ให้สามารถทดสอบการปลดล็อกเหรียญและพลุ Confetti ได้ทันทีโดยไม่ต้องรอเวลาจริง 30 วัน
- [x] 7-DAY D3 VOCABULARY LEARNING STREAK CHART (HOME PAGE):
  - พัฒนากราฟ D3.js (v7) แสดงสถิติคำศัพท์ที่เรียนและทบทวนจริงในแต่ละวันย้อนหลัง 7 วัน บนการ์ด `#homeStreakChartCard` หน้าแรก
  - กราฟผสมผสานแท่ง Bar Chart มุมมนไล่เฉดสีพาสเทล (ชมพูซากุระ `#FF88A5` / เขียวมัทฉะ `#5CE2B3` เมื่อพิชิตเป้าหมาย) ร่วมกับเส้นแนวโน้ม Trend Curve (`d3.curveMonotoneX`) เชื่อมโยงจุดยอดของแต่ละวัน
  - แสดงเส้นประเป้าหมายประจำวัน (Daily Goal Threshold Line) พร้อมป้ายระบุเป้าหมาย (เช่น `🎯 เป้าหมาย 10 คำ`)
  - รองรับ Interactive Tooltip เมื่อ Hover หรือ Touch บนแท่งกราฟ แสดงวันที่, จำนวนคำที่ฝึก, และสถานะการเรียนรู้อย่างละเอียด
  - แถบสรุปสถิติด้านล่างกราฟ: จำนวนคำสะสม 7 วัน, จำนวนวันที่ฝึกต่อเนื่อง (Active Days), และค่าเฉลี่ยคำต่อวัน
  - Responsive SVG Scaling ด้วย `viewBox="0 0 380 185"` คมชัดทุกหน้าจอ พร้อมระบบ Fallback SVG อัตโนมัติ
- [x] 'SPEAK TO ANSWER' MODE FOR QUIZ (ACTIVE RECALL):
  - เพิ่มโหมดคำถามใหม่ `🎙️ พูดตอบ (Speak)` บนแถบเลือกโหมด `#quizModeBar` และผนวกเข้าสู่โหมดคำถามผสม (Mixed Mode)
  - ผู้เรียนสามารถแตะไมโครโฟนเพื่อพูดตอบเป็นภาษาจีนกลาง (Hanzi) หรือออกเสียง Pinyin ได้โดยตรงแทนการพิมพ์
  - เชื่อมต่อ Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) โหมดภาษาจีนกลาง `zh-CN` แสดงคลื่นเสียงแอนิเมชัน (Waveform) และวงคลื่นขยาย (Pulsing Ripple Effect) ขณะกำลังฟังเสียง
  - ระบบถอดเสียงแบบ Real-time แสดงผลข้อความที่ได้ยินแบบสด (Interim & Final Transcript)
  - ระบบตรวจสอบความถูกต้องอัจฉริยะ (`isSpokenAnswerMatch`):
    - รองรับการพูดตัวอักษรจีน เช่น "老师", "你好"
    - รองรับการออกเสียง Pinyin แบบมีและไม่มีวรรณยุกต์ เช่น "laoshi", "nǐ hǎo", "ni hao"
    - รองรับการตัดเครื่องหมายวรรคตอนและการแยกจับคู่รายพยางค์
  - มีปุ่มฟังตัวอย่างการออกเสียงที่ถูกต้อง (`🔊 ฟังตัวอย่างการออกเสียง`) ก่อนหรือหลังตอบ
  - มีปุ่มไมโครโฟนสำหรับบอกเสียงพูด (Dictation Button `🎙️`) ในโหมดสะกด Pinyin (Spelling Quiz) เพื่อพูดแทนการพิมพ์ลงในช่องข้อความได้ทันที
  - รองรับ Fallback เปลี่ยนไปพิมพ์ตอบได้สะดวก (`⌨️ สลับไปพิมพ์ Pinyin แทน`) หากเบราว์เซอร์ไม่รองรับไมโครโฟนหรือไม่ได้รับสิทธิ์
- [x] TEXT-TO-SPEECH (TTS) ON FLASHCARDS:
  - รองรับการฟังเสียงออกเสียงภาษาจีนกลาง (Mandarin zh-CN) ด้วย Web Speech API อย่างเป็นธรรมชาติ (อัตราความเร็ว 0.85x ฟังชัดเจน เหมาะสำหรับผู้เรียนภาษาจีน)
  - ติดตั้งปุ่มฟังเสียง 🔊 บน Flashcard ทั้งด้านหน้า (ก่อนเปิดดูความหมาย) และด้านหลัง (หลังเปิดดูคำตอบ) ใน Learn Mode (`learn.html`), Quick Review Mode (`quick-review.html`), และ Vocab Card Demo (`vocab-card.html`)
  - รองรับการกดฟังเสียงตัวอย่างประโยคภาษาจีน (`vocab-example-hanzi`) ด้วยปุ่ม `🔊` แบบมินิเสียงใส เพื่อฝึกฟังรูปประโยคจริง
  - ปุ่มฟังเสียงมีแอนิเมชันคลื่นจังหวะเสียงน่ารัก (`cutePulse`) และข้อความแสดงสถานะ "🔊 กำลังเล่น..." ป้องกันการกดซ้ำซ้อนและหยุดเสียงเดิมอัตโนมัติเมื่อเปลี่ยนการ์ด
  - ปุ่มทดสอบฟังเสียง (Pronunciation Preview) ในหน้าเพิ่มคำศัพท์ใหม่และจัดการบทเรียน เพื่อให้ผู้ใช้ตรวจฟังสำเนียงก่อนบันทึกคำศัพท์
- [x] CUSTOM VOCABULARY CREATION:
  - ระบบเพิ่มคำศัพท์ใหม่ที่ผู้ใช้กำหนดเอง (Custom Vocabulary) เข้าสู่ฐานข้อมูล Local Storage (`cvma_custom_vocabularies`)
  - รองรับข้อมูลครบถ้วน: ตัวอักษรจีน (Hanzi) *, พินอิน (Pinyin), ความหมายภาษาไทย (Meaning) *, ตัวอย่างประโยคจีน, คำแปลประโยคตัวอย่าง, เทคนิคช่วยจำ (Memory Tip), และหมวดหมู่คำศัพท์
  - เพิ่มคำศัพท์ได้สะดวกจากหน้าบทเรียนรวม (`chapters.html`) โดยสามารถเลือกบทเรียนเป้าหมาย หรือเพิ่มโดยตรงจากหน้ารายละเอียดบท (`chapter-detail.html`) ทั้งในแถบสรุปบทเรียนและส่วนหัวรายการคำศัพท์
  - มีปุ่มทดสอบออกเสียงทันทีขณะพิมพ์ตัวอักษรจีนในฟอร์ม Modal เพื่อความถูกต้องมั่นใจ
  - ระบบตรวจสอบความถูกต้อง (Validation) ป้องกันข้อมูลว่างเปล่า พร้อมแอนิเมชัน Confetti เฉลิมฉลองและ Toast แจ้งเตือนเมื่อบันทึกคำศัพท์สำเร็จ
  - คำศัพท์ใหม่ที่เพิ่มจะซิงก์สถานะความจำ (Spaced Repetition System: new / srsLevel: 0) เข้าสู่คิวการเรียนรู้และทบทวนในทันที
- [x] DAILY VOCABULARY GOAL & CELEBRATION ANIMATION:
  - Daily Goal Card (`#homeDailyGoalCard`) บนหน้าแรก แสดงสถิติคำศัพท์ที่เรียน/ทบทวนวันนี้เทียบกับเป้าหมาย (เช่น `6 / 10 คำ (60%)`) พร้อมแถบ Progress Bar สีพาสเทลและข้อความให้กำลังใจ
  - ระบบปรับเปลี่ยนเป้าหมายประจำวัน (Quick Preset Chips: 5 คำ, 10 คำ, 15 คำ, 20 คำ บนการ์ด และ Modal ตั้งเป้าหมายพร้อมช่องระบุจำนวนคำเอง) บันทึกและคงอยู่ผ่าน Local Storage (`cvma_daily_goal`)
  - ติดตามคำศัพท์ที่เรียนรู้และทบทวนจริงในแต่ละวัน (`cvma_daily_words_YYYY-MM-DD` + `lastReviewed`) อัปเดตแบบ Real-time ทุกครั้งที่ผู้ใช้เรียนใน Learn Mode, ทบทวนใน Quick Review, หรือตอบใน Quiz Mode
  - Celebration Animation Engine (Native HTML5 Canvas Confetti): อนุภาคพาสเทล 9 สีหวานแหวว หลากรูปทรง (ริบบิ้น 3D หมุนพลิ้ว, ดาววิบวับ, วงกลม, สี่เหลี่ยม) พร้อมระบบฟิสิกส์ลอยตัวและการหมุนแบบสมจริง
  - ระบบเสียง Chime รื่นเริงอ่อนหวาน (Pentatonic Arpeggio) สังเคราะห์สดด้วย Web Audio API ไม่ต้องพึ่งพาไฟล์เสียงภายนอก
  - ฉลองอัตโนมัติเมื่อจบเซสชันการเรียนรู้ใน Learn Mode (`showComplete`), Quick Review Mode (`renderReviewSessionComplete`), และ Quiz Mode (`showQuizSummary`) พร้อมแสดงแถบแจ้งเตือนพิเศษเมื่อพิชิตเป้าหมายประจำวันได้
  - ระบบตรวจจับและเฉลิมฉลองเมื่อปลดล็อกเหรียญรางวัล Milestone ใหม่บนหน้า `progress.html` พร้อมเปิดให้แตะที่เหรียญรางวัลที่ปลดล็อกแล้วเพื่อจุดพลุฉลองความสำเร็จและแสดงข้อความภาคภูมิใจได้ทุกเวลา
- [x] UX/UI REDESIGN (Feminine Pastel Stationery Theme):
  - Google Fonts นำเข้า `Nunito` (Friendly Rounded Latin) ร่วมกับ `Mitr` (Modern Clean Thai)
  - Color Tokens: Sweet Sakura Rose (`#FF7597`), Soft Lavender (`#9B7BF7`), Fresh Mint Matcha (`#3EBF95`), Honey Apricot (`#FFAE33`), Sky Blue (`#5CA9FB`), Strawberry Blush (`#FF5A73`)
  - Background: สีครีมพาสเทลอ่อน (`#FFF8F6`) พร้อมรัศมีแสงสีชมพูอ่อน-ม่วงลาเวนเดอร์นุ่มนวลชวนมอง
  - Cards: สไตล์สมุดโน้ต stationery มุมมนละมุน (`22px`), ขอบสีชมพูอ่อนใส (`border: 1.5px solid rgba(255, 218, 228, 0.7)`), เงาฟุ้งแบบ Pillow Shadow
  - Buttons: ปุ่มสัมผัสนุ่มเด้ง (Bouncy tactile click), ไล่เฉดสีชมพูซากุระและม่วงลาเวนเดอร์ พร้อม hover lift และเงาสีนุ่ม
  - Bottom Navigation: Floating Glassmorphism Dock ขอบมนพร้อม backdrop blur และไอคอนสีสดใส
  - Flashcard: ขอบการ์ดพาสเทลพร้อมออร่าเรืองแสงสีชมพู-ม่วงรอบตัวอักษรจีน (Hanzi Halo Aura), ปุ่มฟังเสียงทรงแคปซูลแอนิเมชันจังหวะเสียงคลื่นน่ารัก
  - SRS Rating: 5 ปุ่ม 5 สีพาสเทลสดใสพร้อมอิโมจิบอกระดับความจำชัดเจน (`😵 ลืมแล้ว`, `😕 ยาก`, `🙂 ปานกลาง`, `😄 ง่าย`, `🤩 จำแม่น`)
  - Progress & Streak: การ์ดเปลวไฟสีแอปริคอทสดใสพร้อมวงกลมวันที่ 7 วันสไตล์มาการอง และเหรียญตราความสำเร็จสีทองเรืองรอง
  - Quiz Mode: การ์ดคำถามสไตล์เกมตอบคำถามน่ารัก, ปุ่มตัวเลือกแบบ Bubble Option, เอฟเฟกต์สีเขียวมินต์เมื่อตอบถูกและสีชมพูสตรอว์เบอร์รีเมื่อตอบผิด, วงกลมคะแนนสีรุ้งพาสเทล
  - Search & Category Filter Chips: แถบค้นหาขอบมนพร้อมชิปแคปซูลสีหวานกดสลับได้ทันที
  - Forms & OCR: กล่องนำเข้าแบบลากวางเส้นประสีชมพูอ่อนพร้อมไอคอนกล้องวิบวับ
- [x] PHASE 1: Product Vision, Target User, Core User Flow, IA, Sitemap, Navigation, UX หน้าหลัก, UI Style, Palette, Typography, Component System, Memory Design, MVP Scope
- [x] PHASE 2: Low-fidelity Wireframe (Home, Chapters, Learn, Quick Review, Create Chapter) + Visual Design Tokens
- [x] PHASE 3 / 3.1 Home, 3.2 Chapters, 3.3 Vocabulary Card, 3.4 Learn Mode, 3.5 Quick Review, 3.6 Create Chapter (ฟอร์ม static, ปุ่มนำเข้ารูป disabled "เร็ว ๆ นี้")
- [x] PHASE 3 / 3.7 Navigation: Home→Learn / Quick Review / bottom-nav (หน้าแรก, บทเรียน, ทบทวน); Chapters→Learn / Create Chapter (FAB); Create Chapter (←/ยกเลิก/สร้างบท)→Chapters; Learn/Vocab Card ←→Chapters; Quick Review ←→Home (ใช้ location.href เท่านั้น)
- [x] PHASE 3 / 3.8 Responsive: ตรวจ 360/390/430/1280px ไม่มี horizontal scroll, ปุ่ม ≥44px, bottom-nav/FAB จำกัด 480px, ฟอนต์จีน fallback
- [x] PHASE 3 / 3.9 Final UX/UI Review: ดูรายละเอียดใน "Final Review Changes"
- [x] PHASE 4 / TASK 4.1 Vocabulary Data System: สร้างโครงสร้างข้อมูลกลาง (Chapter / Vocabulary / Vocabulary Progress) ที่ `/data/vocab-data.js` — ยังไม่ได้เชื่อมกับหน้า HTML (เชื่อมแล้วใน 4.2)
- [x] PHASE 4 / TASK 4.2 Connect Vocabulary Data to Chapters: chapters.html สร้างรายการบทจาก `VOCAB_DATA` (ชื่อบท, คำอธิบาย, จำนวนคำศัพท์, จำแล้ว/progress bar) กด Card → `chapter-detail.html?id=<Chapter ID>`; หน้า Chapter Detail (สร้างใหม่) โหลดคำศัพท์ด้วย `getVocabularyByChapter(id)` แสดง Hanzi/Pinyin/ความหมายไทย ผ่านโครงสร้าง `.vocab-card` เดิม; มี Empty/Error State (ไม่มีบท, ไม่พบ ID, ไม่ระบุ ID, บทไม่มีคำศัพท์, โหลดข้อมูลไม่สำเร็จ); Logic อยู่ใน `app.js` (route ตาม id ของ `<main class="page">`)
- [x] PHASE 4 / TASK 4.3 Connect Vocabulary Data to Learn Mode: learn.html โหลด `data/vocab-data.js` และดึง Chapter ID จาก `?chapter=` ใน URL; เชื่อม Flow Chapters → Chapter Detail → "เริ่มเรียน" → Learn Mode → โหลดคำศัพท์ของ Chapter นั้นด้วย `getVocabularyByChapter(id)`; Vocabulary Card แสดงข้อมูลจริงทั้งหมด (汉字, Pinyin, tag/หมวดหมู่, ระดับความยาก, ความหมายไทย, ตัวอย่างประโยค+คำแปล, Memory Tip) โดยยังคง UX เดิมของ TASK 3.4 ครบ (reveal ทีละขั้น, ปุ่ม "แตะเพื่อดูคำตอบ", "ยังจำไม่ได้", "จำได้แล้ว"); ปุ่ม "ยังจำไม่ได้"/"จำได้แล้ว" ใช้เปลี่ยนไปคำถัดไปของบทแบบวนรอบ (Prototype level ยังไม่บันทึกสถานะจริง) พร้อมอัปเดตหัวข้อ/progress bar/"คำที่ X / Y" ทุกครั้งที่เปลี่ยนคำ; มี Empty/Error State ครบ (ไม่มี Chapter ID, ไม่พบ Chapter, Chapter ไม่มีคำศัพท์, ไม่พบ Vocabulary ของ index นั้น, โหลดข้อมูลไม่สำเร็จ) โดยซ่อนเนื้อหา Learn Mode (`#learnBody`) แล้วแสดง state box แทน (`#learnStateBox`); Logic อยู่ใน `app.js` (`initLearn()`, route ตาม id `page-learn`)
- [x] PHASE 4 / TASK 4.4 Connect Vocabulary Data to Quick Review: quick-review.html โหลด `data/vocab-data.js` และไม่มีคำศัพท์ hard-code ใน HTML แล้ว (ช่องข้อมูลเป็น element ว่างที่มี id `review*`); ชุดคำทบทวน (Prototype) = ค่าเริ่มต้นใช้ `getAllVocabulary()` จำกัดไม่เกิน 12 คำ (`REVIEW_LIMIT`) หรือถ้าใส่ `?chapter=<id>` ใช้ `getVocabularyByChapter(id)` ของบทนั้น; การ์ดแสดง 汉字, Pinyin, tag, ระดับความยาก, ความหมายไทย, ตัวอย่างประโยค+คำแปล, Memory Tip จากข้อมูลจริง; UX เดิมของ TASK 3.5 ครบ (แตะเพื่อดูคำตอบ → ปุ่มยังจำไม่ได้/จำได้แล้ว, คำก่อนหน้า/คำถัดไป, progress bar + "X / Y คำ" อัปเดตทุกคำ); ปุ่มยังจำไม่ได้/จำได้แล้ว/คำถัดไป ไปคำถัดไปแบบวนรอบ, คำก่อนหน้าย้อนกลับแบบวนรอบ (ยังไม่บันทึก Progress); มี Empty/Error State (โหลดข้อมูลไม่สำเร็จ, ไม่พบ Chapter, ไม่มีคำศัพท์, ไม่พบคำนั้น) แสดงใน `#reviewStateBox` แทน `#reviewBody`; Logic อยู่ใน `app.js` (`initQuickReview()`, route ตาม id `page-quick-review`)
- [x] PHASE 4 / TASK 4.5 Final Vocabulary Data System Check: ตรวจ Data Structure (Chapter/Vocabulary/ID/Progress), Data Flow (Chapter → Vocabulary → Learn → Quick Review), Empty/Error State ทุกหน้า, การเพิ่มคำศัพท์ใหม่, hard-code ซ้ำ, โครงสร้างไฟล์ — ผ่านทั้งหมด (ทดสอบอัตโนมัติ 46 กรณี + ตรวจข้อมูล) แก้เฉพาะจุดเล็ก: `Chapter.vocabularyIds` สร้างอัตโนมัติจาก `Vocabulary.chapterId` (ต้นทางข้อมูลจริงที่เดียว), Quick Review ข้ามคำที่ chapterId ไม่ตรงบทใด, header ของ Learn (`learn.html`) ไม่โชว์ "第1课 / คำที่ 1 / 1" ชั่วคราวก่อน JS ทำงาน/ตอนเป็น Empty State, ปรับ comment ใน app.js และ PROJECT_STATE.md
- [x] PHASE 5 / TASK 5.1 Learning Session Flow: Learn Mode (`learn.html?chapter=<id>`) เป็น Session แบบเชิงเส้น — Chapter Detail → เริ่มเรียน → คำที่ 1 … คำสุดท้าย → หน้า Session Complete ("🎉 เรียนครบแล้ว! / วันนี้เรียน N คำ" + ปุ่ม "กลับบท" → `chapter-detail.html?id=` และ "เรียนอีกครั้ง" → เริ่มที่คำแรก); ไม่วนรอบอีกแล้ว; ทุกครั้งที่เปลี่ยนคำ การ์ดรีเซ็ตกลับด้านหน้า, ข้อมูลคำก่อนหน้าถูกแทนที่, "คำที่ X / N" และ progress bar อัปเดต; UX 7 ขั้นเดิมครบ (汉字 → Pinyin → ปุ่มฟังเสียง placeholder → ข้อความชวนนึก → แตะเพื่อดูคำตอบ → ความหมาย/ตัวอย่าง/คำแปล/Memory Tip → ยังจำไม่ได้/จำได้แล้ว); ปุ่ม ← ในหัวกลับไปหน้ารายละเอียดบท (Session อยู่เป็น state ในหน้าเท่านั้น เข้าใหม่เริ่มคำแรกเสมอ); Empty/Error State เดิมครบ (ไม่มี Chapter ID, ไม่พบ Chapter, Chapter ไม่มีคำศัพท์, โหลดข้อมูลไม่สำเร็จ); แก้เฉพาะ `app.js` (`initLearn()`: `goToNext`, `showComplete`), `learn.html` (id ปุ่ม ←), `style.css` (`.state-actions`); ไม่มีข้อมูลคำศัพท์ชุดใหม่ ใช้ `getVocabularyByChapter()` จาก Data กลาง
- [x] PHASE 5 / TASK 5.2 Chinese Pronunciation / Text-to-Speech: ระบบออกเสียงภาษาจีนกลาง (Web Speech API) สำหรับปุ่ม 🔊 ใน Learn Mode & Learning Session — อ่านเฉพาะ Hanzi (`v.hanzi`) ด้วยภาษาจีนกลาง `zh-CN` (rate 0.85, pitch 1.0 ฟังชัด เหมาะกับการเรียน); แสดงสถานะขณะกำลังเล่น `🔊 กำลังเล่น...` พร้อมเปลี่ยนสไตล์ปุ่ม และคืนค่า `🔊 ฟังเสียง` เมื่อเล่นจบ/ถูกยกเลิก/เกิดข้อผิดพลาด; ป้องกันเสียงซ้อนด้วย `speechSynthesis.cancel()` ก่อนเล่นใหม่; ตัดเสียงคำก่อนหน้าทันทีเมื่อเปลี่ยนคำถัดไป (`goToNext`), กดปุ่มย้อนกลับ (`backBtn`), จบ Session (`showComplete`), หรือออกจากหน้า; มีการตรวจเช็ค Browser Speech API support และแสดง notice แบบนุ่มนวลไม่รบกวนหน้าเว็บหากไม่รองรับ; แก้ไข `app.js`, `learn.html`, `style.css`
- [x] PHASE 5 / TASK 5.3 Local Storage Progress: บันทึก Progress การเรียนรู้ลง Browser Local Storage (`STORAGE_KEY = "cvma_vocab_progress"`) ด้วย Vocabulary ID เป็น Key (โครงสร้าง `{ status, reviewCount, lastReviewed, nextReview }`); เชื่อมต่อปุ่ม "✅ จำได้แล้ว" (status: mastered, reviewCount+1, lastReviewed วันนี้) และ "😵 ยังจำไม่ได้" (status: learning, reviewCount+1, lastReviewed วันนี้) ใน Learn Mode และ Quick Review; Progress คงอยู่หลัง Refresh หน้าเว็บ; เมื่อเปิดหน้า Learn Mode และ Quick Review สามารถอ่าน Progress ของคำปัจจุบันได้; มี Fallback ป้องกันกรณี Local Storage ว่าง ข้อมูลเสีย หรือ JSON parse พัง; เชื่อมสถิติบทเรียน `getChapterStats` ให้นับคำ "จำแล้ว" จาก Local Storage Progress จริง; Expose Helper functions `loadProgress()`, `saveProgress()`, `getVocabularyProgress()`, `updateVocabularyProgress()` บน `VOCAB_DATA` และ `window`; ยังไม่มี SRS algorithm ใน Task นี้
- [x] PHASE 5 / TASK 5.4 Connect Saved Progress to Learning & Quick Review: เชื่อมต่อ Progress ที่บันทึกด้วย Local Storage เข้ากับ Learn Mode, Quick Review และ Chapter Detail ให้สถานะคำศัพท์สอดคล้องกันทั่วทั้งระบบ; แสดง Status Badge ("ยังไม่เริ่ม", "กำลังเรียน", "จำได้") บน Vocabulary Card อย่างสวยงามไม่รกสายตา; Quick Review คัดเลือกและเรียงลำดับคำศัพท์ตาม Progress (ให้ความสำคัญกับคำที่กำลังเรียน/ยังจำไม่ได้ `learning` เป็นลำดับแรก, คำที่ยังไม่เริ่ม `new` ถัดมา, และคำที่จำได้แล้ว `mastered` ลำดับสุดท้าย); เมื่อกด "ยังจำไม่ได้" หรือ "จำได้แล้ว" ในหน้าใด สถานะของคำศัพท์จะเปลี่ยนและแสดงผลตรงกันทันทีทุกหน้าทั้ง Learn Mode, Quick Review, Chapter Detail และ Chapters Progress; คงอยู่หลัง Refresh; แยกตาม Vocabulary ID และกรองตาม Chapter ชัดเจน ไม่ปนกัน; ปลอดภัยต่อกรณีไม่มีข้อมูลหรือ Local Storage เสียหาย; แก้ไข `app.js`, `learn.html`, `quick-review.html`, `style.css`, `PROJECT_STATE.md`
- [x] PHASE 5 / TASK 5.5 Learning Session Completion & Progress Summary: ปรับปรุงช่วงจบ Learning Session ให้ผู้ใช้เห็นผลการเรียนของ Session อย่างชัดเจน (แสดง "🎉 เรียนครบแล้ว! / วันนี้เรียน N คำ", แถวสรุป "✅ จำได้ X คำ", "😵 ยังไม่มั่นใจ Y คำ", และแถบความคืบหน้า %); ติดตามสถิติของ Session ปัจจุบันอย่างกระชับ ไม่สร้างระบบคะแนน/Gamification ซับซ้อน; แยก Session Result ออกจาก Vocabulary Persistent Progress ใน Local Storage โดยไม่แตะต้องหรือเปลี่ยนสถาปัตยกรรม Progress เดิม; ปุ่ม [ เรียนอีกครั้ง ] รีเซ็ตเฉพาะ Session Result และเริ่มเรียนบทเดิมใหม่จากคำแรก โดยข้อมูลที่บันทึกลง Local Storage ยังคงอยู่ครบ; ปุ่ม [ กลับไปที่บท ] นำทางกลับหน้ารายละเอียดบท (chapter-detail.html?id=) อย่างถูกต้อง; จัดการ Empty/Edge Cases ครบถ้วน (ไม่มี Chapter ID, ไม่พบ Chapter, บทไม่มีคำศัพท์, ข้อมูลเสียหาย); ดีไซน์น่ารักแบบผู้ใหญ่ อ่านง่าย สบายตา สอดคล้องกับ UI เดิม; แก้ไข `app.js`, `style.css`, `PROJECT_STATE.md`
- [x] PHASE 5 / TASK 5.6 Home Dashboard & Learning Mode Integration: เชื่อมต่อหน้า Home (`index.html`) กับ `VOCAB_DATA` และ Persistent Progress ใน Local Storage — การ์ด "กำลังเรียน" แสดงบทที่กำลังเรียน (ดึงจากบทที่ผู้ใช้เปิดล่าสุด หรือบทแรกที่ยังเรียนไม่ครบ 100%), แสดงชื่อบท, จำนวนคำที่จำได้/ทั้งหมด (เช่น "2 / 3 คำ"), แถบ Progress Fill คำนวณจริงตาม % ความคืบหน้า, ปุ่ม "เรียนต่อ" นำทางไปยัง `learn.html?chapter=<Active Chapter ID>`; การ์ด "วันนี้ต้องทบทวน" คำนวณจากสถานะของคำศัพท์ทั้งหมดในระบบจริง (badge สีแดง `🔴 X ยังจำไม่ได้`, badge สีเหลือง `🟡 Y ยังไม่เริ่ม`, และเมื่อจำได้ครบจะแสดง `✅ จำได้ครบทุกคำแล้ว`); แถบ Streak สรุปสถานะการเรียนวันนี้ ("🔥 เรียนต่อเนื่อง 1 วัน" เมื่อมีการเรียนวันนี้); อัปเดต `cvma_active_chapter` เมื่อเข้าชมบทเรียนใน Chapter Detail และ Learn Mode; ปลอดภัยต่อ Empty/Edge Cases ทุกกรณี; แก้ไข `index.html`, `app.js`, `PROJECT_STATE.md`
- [x] PHASE 6 / TASK 6.1 Spaced Repetition System (SRS 5 ระดับ) & Due Review Queue Engine: พัฒนาระบบ Spaced Repetition แบบ 5 ระดับ (Level 1: 1 วัน, Level 2: 3 วัน, Level 3: 7 วัน, Level 4: 14 วัน, Level 5: 30 วัน/จำแม่น); เพิ่มฟังก์ชัน `addDays` คำนวณวันที่บวกช่วงเวลาแบบ UTC แม่นยำข้ามเดือนและปีอธิกสุรทิน; ฟังก์ชัน `calculateSRS` ปรับระดับความจำ (srsLevel 0-5) และคำนวณ `nextReview` (YYYY-MM-DD) อัตโนมัติ (รองรับทั้ง boolean จำได้/ยังไม่ได้ และคะแนนประเมิน 1-5); อัปเกรด `updateVocabularyProgress` ให้คำนวณ SRS และบันทึก `srsLevel`, `intervalDays`, `nextReview` ลง Local Storage; ฟังก์ชัน `isDueForReview` ตรวจสอบคำที่ถึงกำหนดทบทวนในวันนี้จริง (คำที่สถานะ `learning` หรือ `mastered` ที่ `nextReview <= today`); ฟังก์ชัน `getReviewUrgency` จัดลำดับความเร่งด่วน 4 ระดับ (1. learning เร่งด่วนสูงสุด, 2. mastered ถึงกำหนดรอบ SRS, 3. new คำใหม่, 4. mastered ที่ยังไม่ถึงรอบ); เชื่อมต่อการ์ด "วันนี้ต้องทบทวน" บนหน้า Home ให้นับจำนวนคำ Due จริง (เช่น `🔴 X ต้องทบทวน / ยังจำไม่ได้`, `🟡 Y ยังไม่เริ่ม`, หรือ `🎉 วันนี้ทบทวนครบแล้ว`); ปรับการจัดลำดับคำศัพท์ใน Quick Review ให้ดึงคำ Due ขึ้นมาทบทวนเป็นอันดับแรก; Expose APIs บน `window` และ `VOCAB_DATA`; แก้ไข `data/vocab-data.js`, `app.js`, `PROJECT_STATE.md`
- [x] PHASE 6 / TASK 6.2 Quick Review with SRS Rating & Session Completion: พัฒนา Quick Review Session Flow แบบสมบูรณ์; เพิ่มปุ่ม Spaced Repetition Rating 5 ระดับ (`😵 ลืมแล้ว`, `😕 ยาก`, `🙂 ปานกลาง`, `😄 ง่าย`, `🤩 จำแม่น`) พร้อม interactive hover/active states; เชื่อมโยงการประเมินความจำเข้ากับ SRS Engine และบันทึกผลลง Local Storage ทันที; เพิ่มปุ่มออกเสียงภาษาจีนกลาง (`#reviewListenBtn`) บนการ์ดทบทวนด้วย Web Speech API พร้อมสถานะกำลังเล่นและหยุดเสียงอัตโนมัติเมื่อเปลี่ยนคำ; ปรับปรุงการนำทางด้วยปุ่มคำก่อนหน้า/คำถัดไป; แสดงผลสรุปเมื่อจบเซสชันการทบทวน (Review Session Complete) แสดงสถิติจำได้มั่นใจ (SRS 3-5) / ต้องฝึกเพิ่ม (SRS 1-2) และแถบ % ความคืบหน้า; ปุ่ม [ กลับหน้าหลัก ] นำทางไป index.html และ [ ทบทวนอีกครั้ง ] รีเซ็ตเซสชันเริ่มคำแรกโดยคงข้อมูลใน Local Storage ครบถ้วน; แก้ไข `quick-review.html`, `style.css`, `app.js`, `PROJECT_STATE.md`
- [x] PHASE 7 / TASK 7.1 Progress & Streak Tracking Dashboard: พัฒนาระบบติดตามความคืบหน้าและการเรียนรู้ต่อเนื่อง (Streak Tracking); บันทึกประวัติวันเรียนรู้ลง Local Storage (`cvma_study_history`) พร้อมผสานข้อมูล `lastReviewed` เดิม; คำนวณ Streak ปัจจุบัน (Current Streak) และสถิติสูงสุด (Best Streak); สร้างหน้า `progress.html` แสดง Streak Hero Card พร้อมปฏิทินย้อนหลัง 7 วันล่าสุด, การ์ดภาพรวมคำศัพท์ทั้งหมด (Mastered/Learning/New), ระดับความจำ Spaced Repetition (SRS Level 5 ถึง 0), และความคืบหน้ารายบทเรียน; เชื่อมต่อการคำนวณ Streak จริงไปยังหน้า Home (`index.html`); เปิดใช้งานเมนูนำทาง `📊 ความคืบหน้า` บนแถบ Bottom Navigation ทุกหน้า; แก้ไข `progress.html`, `index.html`, `chapters.html`, `chapter-detail.html`, `style.css`, `app.js`, `PROJECT_STATE.md`
- [x] PHASE 7 / TASK 7.2 Interactive Progress Drill-Down & Streak Milestones: พัฒนาระบบรางวัลความต่อเนื่อง & ความสำเร็จ (Streak & Learning Milestones) พร้อมสถานะปลดล็อก (🌱 ก้าวแรก, 🔥 ไฟแรง 3 วัน, ⚡ มุ่งมั่น 7 วัน, 🎯 เริ่มจำได้, ⭐ คลังศัพท์เติบโต, 💎 จำแม่นระยะยาว); พัฒนาระบบ Interactive Vocabulary Drill-Down บน progress.html ให้ผู้ใช้แตะที่ Stat Tiles (✅ จำได้แล้ว, 🟡 กำลังเรียน, ⚪ ยังไม่เริ่ม, 🔴 ต้องทบทวน) หรือแตะที่แถบ SRS Levels (ระดับ 5 ถึง 0) เพื่อกรองและเลื่อนลงมายังรายการคำศัพท์ในกลุ่มนั้นทันที; มี Filter Chips ให้เลือกดูคำศัพท์ตามสถานะหรือระดับความจำ; มีช่องค้นหาคำศัพท์แบบทันที (Quick Search by Hanzi, Pinyin, Meaning); การ์ดคำศัพท์แต่ละคำแสดง Hanzi, Pinyin, คำแปล, บทเรียน, ระดับ SRS, วันทบทวนถัดไป (หรือสถานะถึงกำหนดทบทวนแล้ว); รองรับปุ่ม 🔊 ฟังเสียงภาษาจีนกลาง (Web Speech API) สำหรับแต่ละคำโดยตรงจากหน้า Dashboard; มีปุ่ม 📖 ดูบทเรียน นำทางไปยัง chapter-detail.html; แก้ไข `progress.html`, `style.css`, `app.js`, `PROJECT_STATE.md`
- [x] PHASE 8 / TASK 8.1 Create Chapter with Local Storage Persistence: พัฒนาระบบสร้างบทเรียนใหม่และเพิ่มคำศัพท์พร้อมบันทึกลง Local Storage (`cvma_custom_chapters` และ `cvma_custom_vocabularies`); ผสานบทเรียนและคำศัพท์ที่สร้างเองเข้ากับ Data Layer กลาง (`VOCAB_DATA`) อย่างไร้รอยต่อในทุกหน้า ทั้ง Chapters, Chapter Detail, Learn Mode, Quick Review, Progress และ Home; สร้างฟอร์มสร้างบทเรียนและรายการคำศัพท์แบบไดนามิกใน `create-chapter.html` (เพิ่ม/ลบคำศัพท์ได้, อัปเดตตัวเลขอัตโนมัติ, ตรวจสอบข้อมูล Validation พร้อม Alert แจ้งเตือน); รองรับปุ่ม 🔊 ฟังเสียงภาษาจีนกลาง (Web Speech API) ทดสอบออกเสียงคำศัพท์ก่อนบันทึก; เริ่มต้นสถานะ Progress (status: "new", srsLevel: 0) ลง Local Storage ทันที; รองรับการลบบทเรียนที่ผู้ใช้สร้างเองใน `chapter-detail.html`; นำทางไปยังหน้ารายละเอียดบทเรียนที่เพิ่งสร้างโดยอัตโนมัติพร้อมแถบแสดงความยินดี; แก้ไข `data/vocab-data.js`, `create-chapter.html`, `style.css`, `app.js`, `PROJECT_STATE.md`
- [x] PHASE 8 / TASK 8.2 Edit Chapter, Quick Text Import & Backup/Restore: พัฒนาระบบแก้ไขบทเรียนเดิม (Edit Chapter Flow ผ่าน `create-chapter.html?edit=<id>`) โดยพรีโหลดชื่อบท คำอธิบาย และรายการคำศัพท์ทั้งหมด พร้อมคงค่า Vocabulary ID เดิมไว้เพื่อรักษา Learning Progress และประวัติ SRS ไม่ให้สูญหาย; รองรับการเพิ่มคำศัพท์ใหม่และลบคำศัพท์เดี่ยวในโหมดแก้ไข; เพิ่มปุ่ม [✏️ แก้ไขบทเรียน / จัดการคำศัพท์] บน `chapter-detail.html` สำหรับบทเรียนที่ผู้ใช้สร้างเอง; พัฒนาระบบ Quick Text / Batch Import ในหน้าสร้างและแก้ไขบทเรียน รองรับการวางข้อความหลายคำพร้อมกัน (คั่นด้วยจุลภาค `,` หรือ Tab จาก Excel/Sheets หรือ `/`) แปลงเป็นรายการคำศัพท์ในฟอร์มทันที; พัฒนาระบบสำรองและกู้คืนข้อมูล (Export & Import JSON Backup) ในหน้า `chapters.html` ดาวน์โหลดไฟล์ `cvma-backup-YYYY-MM-DD.json` และนำเข้าข้อมูลสำรองแบบ Merge หรือ Replace ได้อย่างปลอดภัย; แก้ไข `data/vocab-data.js`, `create-chapter.html`, `chapter-detail.html`, `chapters.html`, `style.css`, `app.js`, `PROJECT_STATE.md`
- [x] PHASE 8 / TASK 8.3 Active Recall / Flashcard Quiz Mode: พัฒนาระบบแบบทดสอบ Active Recall 3 รูปแบบ (เลือกความหมายภาษาไทย, ฟังเสียงภาษาจีนแล้วทายคำศัพท์ด้วย Web Speech API, พิมพ์สะกด Pinyin พร้อมระบบ Normalize ตรวจคำตอบอัจฉริยะ) พร้อมโหมดคำถามผสม (Mixed Challenge); มีแถบ Filter Chips สลับโหมดได้ทันที; มีระบบสุ่มตัวเลือกหลอก (Distractor Generator) อัตโนมัติพร้อม seed fallbacks ป้องกันตัวเลือกซ้ำ; อัปเดตระดับความจำ Spaced Repetition (SRS) และประวัติการเรียนรู้ Streak ลง Local Storage ทันทีที่ตอบคำถาม; มี Feedback Box แสดงความถูกต้องพร้อมการ์ดสรุปคำศัพท์ ประโยคตัวอย่าง และ Memory Tip; มีหน้าสรุปผลคะแนนเมื่อจบการทดสอบ (Quiz Completion Screen) แสดงคะแนน วงเปอร์เซ็นต์ ระดับผลงาน และรายการคำศัพท์พร้อมปุ่ม 🔊 ฟังเสียง; เชื่อมโยงทางเข้าควิซจากทุกหน้า (Home Card, Chapter Detail, Learn Complete, Quick Review Complete); สร้าง `quiz.html`, เพิ่มสไตล์ใน `style.css`, เพิ่ม `initQuiz` ใน `app.js`, อัปเดต `PROJECT_STATE.md`
- [x] PHASE 8 / TASK 8.4 Category Tags, Chapter Search & Filter, and OCR Image Import Assistant: พัฒนาระบบค้นหาและกรองคำศัพท์ระดับบทเรียนแบบ Real-time ใน `chapter-detail.html` (ค้นหาได้ทั้ง Hanzi, Pinyin, คำแปลไทย, และประโยคตัวอย่าง พร้อมปุ่มล้างการค้นหา ✕); แถบ Filter Chips กรองตามสถานะความจำ (🔴 ต้องทบทวน, ✅ จำแล้ว, 🟡 กำลังเรียน, ⚪ ยังไม่เริ่ม) และกรองตามหมวดหมู่ (🏷️ Category Tags) ที่สกัดจากคำศัพท์ในบทนั้นอัตโนมัติ; การ์ดคำศัพท์ปรับเป็น Interactive Cards รองรับปุ่ม 🔊 ฟังเสียงจีนกลาง และปุ่ม [💡 ดูตัวอย่าง & เทคนิคจำ ▼] พับเก็บ/ขยายดูตัวอย่าง ประโยคแปล และระดับ SRS พร้อมวันทบทวนรอบถัดไป; พัฒนาระบบจำลองนำเข้าคำศัพท์จากรูปภาพ (OCR Image Import Assistant) ใน `create-chapter.html` รองรับการอัปโหลดรูปภาพหน้าหนังสือเรียนหรือเลือกชุดภาพตัวอย่าง พร้อมแอนิเมชันสแกนอัจฉริยะ แสดงรายการคำศัพท์ที่ตรวจพบให้แก้ไข ตรวจสอบเสียงอ่าน 🔊 และเลือกนำเข้าลงฟอร์มได้ทันที; แก้ไข `create-chapter.html`, `chapter-detail.html`, `app.js`, `style.css`, `PROJECT_STATE.md`
- [x] PHASE 9: End-to-End System Verification, Polish & Production Readiness: ผ่านการทดสอบอัตโนมัติครบ 100% ทั้ง Data Integrity, Routing Engine ทุกหน้า, SRS 5-level Engine คำนวณถูกต้องตามเกณฑ์ทั้ง 5 ระดับ, Pinyin Normalization ตรวจจับทั้งสระเสียงวรรณยุกต์ ตัวเลข และวรรคตอน, Streak Engine & 7-day Weekly Calendar, Milestone Badges, Fallback เมื่อ LocalStorage ข้อมูลเสียหาย, Text-to-Speech Web Speech API ป้องกันเสียงซ้อน, และการตรวจสอบความถูกต้องของลิงก์นำทางทุกจุดบน Mobile Viewport; แอปพลิเคชันพร้อมใช้งานจริงระดับ Production MVP ครบถ้วนตามเป้าหมายโครงการทั้งหมด

## Final Review Changes (3.9)
- คำเรียกสอดคล้อง: nav "บทเรียน" = หัวหน้า Chapters; "ทบทวนวันนี้" = ปุ่มใน Home = หัวหน้า Quick Review
- ปุ่ม primary/secondary และ FAB เปลี่ยนตัวอักษรขาว → text-dark (คอนทราสต์); .tag/listen-btn ม่วงเข้มขึ้น (#6F55A0); --text-muted #8A8A8A → #757575; ข้อความไทยในการ์ด (คำแปลประโยค, hint, memory tip) 14 → 15px
- เมนู "ความคืบหน้า" เป็น disabled (ยังไม่มีหน้า) ; active nav label เข้มขึ้น
- vocab-card.html ใช้ .icon-spacer เหมือนหน้าอื่น

## Known Issues / Placeholder
- "จำแล้ว" ในหน้า Chapters/Detail นับจาก Progress `status === "mastered"` (ข้อมูลปัจจุบันยังเป็น 0 ทุกบท เพราะยังไม่มี Logic อัปเดต Progress); ปุ่ม "จำได้แล้ว"/"ยังจำไม่ได้" ใน Learn Mode (TASK 4.3) ยังแค่เปลี่ยนคำถัดไป ไม่ได้บันทึกสถานะจริงลง Progress (ตามข้อจำกัดของ Task — ยังไม่ทำ Local Storage/SRS จริง)
- ชื่อบทแสดงจาก `title` อย่างเดียว (ข้อมูลกลางยังไม่มีฟิลด์ชื่อไทยเช่น "บทที่ 1" และไม่มีคำอธิบายของ ch-002)
- ยังไม่มีหน้า Progress + Streak (nav disabled)
- ปุ่ม คำก่อนหน้า (Learn Mode ไม่มี — ไปได้เฉพาะคำถัดไปผ่านปุ่มจำได้/ยังไม่ได้), สร้างบท, SRS rating เป็น UI เท่านั้น ยังไม่มี Logic; ปุ่มฟังเสียงใน Learn Mode รองรับการออกเสียงภาษาจีนกลาง (Web Speech API) เรียบร้อยแล้วใน TASK 5.2
- vocab-card.html เป็นหน้า demo ของ component (ไม่มีลิงก์เข้าจากเมนู) และยังใช้ข้อความ static (ยังไม่เชื่อมกับ `data/vocab-data.js`)
- ยังไม่ทดสอบบนมือถือจริง
- vocab-card.html เป็นหน้า demo ของ component (ไม่มีลิงก์เข้าจากเมนู) และยังใช้ข้อความ static (ยังไม่เชื่อมกับ `data/vocab-data.js`); create-chapter.html ยังเป็นฟอร์มตัวอย่าง (PHASE 8) ส่วน index.html, chapters.html, chapter-detail.html, learn.html และ quick-review.html เชื่อมต่อกับ `data/vocab-data.js` และ Local Storage Progress แล้วทั้งหมด
- Quick Review ตอนนี้ยังไม่เลือกคำตาม nextReview/SRS (ใช้คำจากข้อมูลกลางตามลำดับ สูงสุด 12 คำ) และข้อมูลกลางมีเพียง 3 คำ จึงแสดง "X / 3 คำ"; Home ยังลิงก์ quick-review.html แบบไม่ส่ง `?chapter=`
- ch-002 (第2课) ในข้อมูลกลางยังไม่มีคำศัพท์จริง (vocabularyIds ว่าง) เพราะ Static Prototype ไม่มีข้อมูลตัวอย่างของบทนี้ — ใช้ทดสอบ Empty State ของ Learn Mode ได้ผ่าน `learn.html?chapter=ch-002`

## Current Features (ยืนยันแล้ว ยังไม่ได้ Build)
- Home (สรุปสิ่งที่ต้องทำวันนี้)
- Chapters + Chapter Detail
- Learn Mode (แสดงข้อมูลทีละขั้น)
- Flashcard
- Active Recall (เลือกความหมาย / ฟังเสียง / เห็นรูป / พิมพ์ Pinyin)
- Quick Review
- Spaced Repetition (แบบง่าย 5 ระดับ)
- Progress + Streak
- Create Chapter (พิมพ์เอง)
- Import Image → Review OCR (เตรียมระบบ, ยังไม่มี OCR จริง)

## File Structure
```
/index.html       (หน้า Home เสร็จแล้ว — เชื่อมต่อบทเรียนกำลังเรียน, สรุปทบทวนตาม SRS, และ Streak จริง)
/chapters.html    (หน้า Chapters — รายการบทสร้างจาก VOCAB_DATA + Local Storage Progress)
/chapter-detail.html (รายละเอียดบท + รายการคำศัพท์ตาม Chapter ID ใน query string `?id=`)
/vocab-card.html  (Vocabulary Card แบบ Static เสร็จแล้ว - demo หน้า/หลังการ์ด + SRS rating)
/learn.html       (Learning Session: โหลดคำศัพท์จาก VOCAB_DATA ตาม Chapter ID, reveal ทีละขั้น + ออกเสียง TTS + Local Storage)
/create-chapter.html (Create Chapter แบบ Static เสร็จแล้ว - ฟอร์มสร้างบท + เพิ่มคำศัพท์)
/quick-review.html (Quick Review Mode — ทบทวนคำศัพท์ตามลำดับความเร่งด่วน SRS + ให้คะแนนความจำ 5 ระดับ + ออกเสียง TTS)
/progress.html    (TASK 7.1 & 7.2 — Progress & Streak Dashboard: Streak Hero, ปฏิทิน 7 วัน, Milestones รางวัลความสำเร็จ, สถิติคำศัพท์ 4 สถานะ, SRS Breakdown, Drill-Down รายการคำศัพท์พร้อมค้นหาและฟังเสียง TTS, สถิติตามบทเรียน)
/style.css        (Design Token + สไตล์สำหรับทุกหน้า รองรับ Mobile-first 360-480px)
/app.js           (Controller กลาง: Navigation, Storage, TTS, SRS Engine, Review Session, Study History, Streak Engine, Progress Dashboard, Active Recall Quiz Engine)
/quiz.html        (TASK 8.3 — Active Recall / Flashcard Quiz Mode: เลือกความหมาย, ฟังเสียงทายศัพท์, พิมพ์สะกด Pinyin, คำถามผสม, บันทึก SRS + Streak ทันที)
/data/vocab-data.js  (ข้อมูลกลาง Chapter/Vocabulary/Progress + getter functions, ผูกกับ window.VOCAB_DATA)
```

## Data Structure (TASK 4.1)
ไฟล์: `/data/vocab-data.js` (ต้องโหลดก่อน app.js: `<script src="data/vocab-data.js"></script>`) — เก็บเป็น JavaScript Object (ผูกกับ `window.VOCAB_DATA`) แทน JSON
เพื่อให้เปิดใช้งานได้ตรงจากไฟล์ (`file://`) โดยไม่ต้องมี server/`fetch`

```js
// Chapter
{
  "id": "ch-001",
  "title": "第1课",
  "description": "คำศัพท์พื้นฐาน HSK1 — คน/บุคคล",
  "vocabularyIds": ["vocab-001", "vocab-002", "vocab-003"],   // สร้างอัตโนมัติจาก Vocabulary.chapterId ตอนโหลด ไม่ต้องเขียนเอง
  "createdAt": "2026-09-24T00:00:00.000Z"
}

// Vocabulary
{
  "id": "vocab-001",
  "chapterId": "ch-001",
  "hanzi": "老师",
  "pinyin": "lǎoshī",
  "meaning_th": "ครู",
  "example": "老师教我们中文。",
  "example_th": "ครูสอนภาษาจีนให้เรา",
  "memory_tip": "老 + 师 → 老师 = ครู",
  "category": "人物",
  "difficulty": 1
}

// Vocabulary Progress (แยกออกจาก Vocabulary, key = vocabulary id)
"vocab-001": {
  "status": "learning",
  "reviewCount": 0,
  "lastReviewed": null,
  "nextReview": null
}
```

Getter functions ที่มีให้ใช้: `getAllChapters()`, `getChapterById(id)`, `getAllVocabulary()`,
`getVocabularyById(id)`, `getVocabularyByChapter(chapterId)`, `getProgress(vocabId)`

## Important Decisions
- ใช้ HTML+CSS+JS ธรรมดาก่อน (เบากว่า React) สำหรับ Prototype เริ่มต้น
- เก็บข้อมูลด้วย localStorage
- ไม่มี Backend / Auth / AI API ใน MVP
- Image Import ช่วงแรกใช้วิธีส่งภาพให้ Claude อ่านนอกระบบ (ไม่ทำ OCR ในเว็บ)
- Spaced Repetition ใช้สูตรง่าย 5 ระดับ (วันนี้ / 1 วัน / 3 วัน / 7 วัน / 14 วัน)
- Palette (hex ยืนยันแล้ว): bg `#FFF8F3`, surface `#FFFFFF`, primary `#F7A8C4`, secondary `#C9B6E4`, info `#A8D8E8`, text dark `#3A3A3A`, text muted `#8A8A8A`, success `#8FD19E`, warning `#F5D67A`, danger `#F29191`
- Typography: Hanzi Display 40–48px, Hanzi Body 22–24px, Pinyin 16px italic, Heading 20px bold, Body 15–16px, Caption 12–13px
- Spacing scale 4/8/12/16/24/32px, Card radius 16–20px, Button radius 12px, Shadow `0 2px 8px rgba(0,0,0,0.06)`, ปุ่มสูงขั้นต่ำ 48px

## Known Bugs
- ไม่พบบัคจากการตรวจ TASK 4.5 (ยังไม่ได้ทดสอบบนมือถือจริง)

## Next Task
ระบบพัฒนาเสร็จสมบูรณ์ระดับ Production MVP ครบทั้ง 9 Phases ตามแผนงาน:
- ทุกฟังก์ชันผ่านการทดสอบ End-to-End System Verification ครบ 100%
- พร้อมรองรับการใช้งานจริง (Ready for Production Deployment)
- การพัฒนาเพิ่มเติมในอนาคต (Post-MVP): รองรับการเชื่อมต่อ AI Cloud OCR, ซิงค์ข้อมูลข้ามอุปกรณ์ (Cloud Sync / Firebase) หรือฟีเจอร์ขั้นสูงตามที่ผู้ใช้ต้องการเพิ่มเติม

## Development Notes
- ทำงานทีละ Task ตามกฎ Claude Free Optimization Protocol
- ตอบเป็นภาษาไทยเป็นหลักเสมอ
- ห้ามข้าม Phase, ห้ามทำ Task ถัดไปเอง
