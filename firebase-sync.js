/**
 * Chinese Vocabulary Memory App — Cloud Sync & Offline Backup Engine
 * Firebase Authentication & Cloud Firestore Integration
 * 
 * Features:
 * 1. Google Account Authentication (Cross-device sync for iPhone, iPad, Mac/PC)
 * 2. Automatic & On-demand 2-way Cloud Sync (Firestore)
 * 3. Offline JSON Backup Export & Import (Zero-loss guarantee)
 * 4. Error Handling conforming to FirestoreErrorInfo standard
 * 5. Startup connection validation via getDocFromServer
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  getDocFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 1. Firebase Configuration from firebase-applet-config.json
const firebaseConfig = {
  projectId: "gen-lang-client-0437135159",
  appId: "1:210221518798:web:cc03543959b257f70fa59f",
  apiKey: "AIzaSyAathB80b0Mp_SCLHrGjdF3qLB_Cz1s_ik",
  authDomain: "gen-lang-client-0437135159.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-cvma-ce8c595e-454d-4707-9853-e970e4c9d357",
  storageBucket: "gen-lang-client-0437135159.firebasestorage.app",
  messagingSenderId: "210221518798",
  measurementId: "",
  oAuthClientId: "210221518798-7i1f6jrp9nk8ng3n4doa4i45uthq8b17.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// Initialize Firebase App, Auth and Firestore
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// 2. Error handling per FirestoreErrorInfo specification
const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write'
};

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 3. Mandatory connection check on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error && error.message && error.message.includes('the client is offline')) {
      console.warn("Firebase client is offline or network is disconnected.");
    }
  }
}
testConnection();

// State management
let currentUser = null;
let isSyncing = false;

// 4. Cloud Synchronization Engine
const CloudSync = {
  auth,
  db,
  getCurrentUser() {
    return currentUser;
  },

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err) {
      console.error("Google Sign-In Error:", err);
      throw err;
    }
  },

  async logout() {
    try {
      await signOut(auth);
      currentUser = null;
      updateUIStatus();
    } catch (err) {
      console.error("Sign-Out Error:", err);
      throw err;
    }
  },

  /**
   * Upload all local custom content, progress, and history to Firestore
   */
  async uploadToCloud() {
    if (!currentUser) return { success: false, reason: "not_logged_in" };
    isSyncing = true;
    updateUIStatus();

    const uid = currentUser.uid;
    try {
      // 1. Profile document
      const userRef = doc(db, 'users', uid);
      const userPayload = {
        uid: uid,
        email: currentUser.email || "",
        displayName: currentUser.displayName || "",
        dailyGoal: Number(localStorage.getItem("cvma_daily_goal") || 10),
        activeChapter: localStorage.getItem("cvma_active_chapter") || "ch-001",
        updatedAt: new Date().toISOString()
      };
      await setDoc(userRef, userPayload, { merge: true });

      // 2. Custom Chapters
      const customChapters = (window.VOCAB_DATA && window.VOCAB_DATA.getCustomChapters()) || [];
      for (const ch of customChapters) {
        if (!ch || !ch.id) continue;
        const chRef = doc(db, 'users', uid, 'custom_chapters', ch.id);
        await setDoc(chRef, {
          id: ch.id,
          userId: uid,
          title: ch.title || "",
          description: ch.description || "",
          level: ch.level || "HSK 1",
          createdAt: ch.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // 3. Custom Vocabularies
      const customVocab = (window.VOCAB_DATA && window.VOCAB_DATA.getCustomVocabulary()) || [];
      for (const v of customVocab) {
        if (!v || !v.id) continue;
        const vRef = doc(db, 'users', uid, 'custom_vocabularies', v.id);
        await setDoc(vRef, {
          id: v.id,
          userId: uid,
          chapterId: v.chapterId || "",
          hanzi: v.hanzi || "",
          pinyin: v.pinyin || "",
          meaning: v.meaning || "",
          exampleHanzi: v.exampleHanzi || "",
          exampleMeaning: v.exampleMeaning || "",
          tip: v.tip || "",
          category: v.category || "",
          createdAt: v.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // 4. Progress (SRS)
      let progressObj = {};
      try {
        const rawP = localStorage.getItem("cvma_vocab_progress");
        if (rawP) progressObj = JSON.parse(rawP) || {};
      } catch (e) {}

      for (const [vocabId, p] of Object.entries(progressObj)) {
        if (!vocabId || !p) continue;
        const pRef = doc(db, 'users', uid, 'vocab_progress', vocabId);
        await setDoc(pRef, {
          vocabId: vocabId,
          userId: uid,
          status: p.status || "new",
          reviewCount: Number(p.reviewCount || 0),
          srsLevel: Number(p.srsLevel || 0),
          intervalDays: Number(p.intervalDays || 1),
          lastReviewed: p.lastReviewed || "",
          nextReview: p.nextReview || "",
          updatedAt: new Date().toISOString()
        });
      }

      // 5. Study History
      let historyArr = [];
      try {
        const rawH = localStorage.getItem("cvma_study_history");
        if (rawH) historyArr = JSON.parse(rawH) || [];
      } catch (e) {}

      for (const dateStr of historyArr) {
        if (!dateStr || typeof dateStr !== "string") continue;
        const dateKey = dateStr.slice(0, 10);
        const hRef = doc(db, 'users', uid, 'study_history', dateKey);
        await setDoc(hRef, {
          date: dateKey,
          userId: uid,
          wordsLearnedCount: 0,
          active: true,
          updatedAt: new Date().toISOString()
        });
      }

      const nowTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      localStorage.setItem("cvma_last_sync_time", nowTime);
      return { success: true, timestamp: nowTime };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      return { success: false, error: err.message };
    } finally {
      isSyncing = false;
      updateUIStatus();
    }
  },

  /**
   * Download and smart-merge cloud data with local storage
   */
  async downloadAndMerge() {
    if (!currentUser) return { success: false, reason: "not_logged_in" };
    isSyncing = true;
    updateUIStatus();

    const uid = currentUser.uid;
    try {
      // 1. Fetch user doc
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        const uData = userSnap.data();
        if (uData.dailyGoal && !localStorage.getItem("cvma_daily_goal")) {
          localStorage.setItem("cvma_daily_goal", String(uData.dailyGoal));
        }
        if (uData.activeChapter && !localStorage.getItem("cvma_active_chapter")) {
          localStorage.setItem("cvma_active_chapter", uData.activeChapter);
        }
      }

      // 2. Fetch custom chapters
      const chSnap = await getDocs(collection(db, 'users', uid, 'custom_chapters'));
      const cloudChapters = [];
      chSnap.forEach(d => cloudChapters.push(d.data()));

      // 3. Fetch custom vocabs
      const vSnap = await getDocs(collection(db, 'users', uid, 'custom_vocabularies'));
      const cloudVocabs = [];
      vSnap.forEach(d => cloudVocabs.push(d.data()));

      // 4. Fetch progress
      const pSnap = await getDocs(collection(db, 'users', uid, 'vocab_progress'));
      const cloudProgress = {};
      pSnap.forEach(d => {
        const item = d.data();
        if (item.vocabId) {
          cloudProgress[item.vocabId] = {
            status: item.status || "new",
            reviewCount: item.reviewCount || 0,
            srsLevel: item.srsLevel || 0,
            intervalDays: item.intervalDays || 1,
            lastReviewed: item.lastReviewed || "",
            nextReview: item.nextReview || ""
          };
        }
      });

      // 5. Fetch history
      const hSnap = await getDocs(collection(db, 'users', uid, 'study_history'));
      const cloudHistory = [];
      hSnap.forEach(d => {
        const item = d.data();
        if (item.date) cloudHistory.push(item.date);
      });

      // Smart Merge with local data
      let localChapters = [];
      try {
        const raw = localStorage.getItem("cvma_custom_chapters");
        if (raw) localChapters = JSON.parse(raw) || [];
      } catch (e) {}

      const mergedChaptersMap = {};
      cloudChapters.forEach(c => { mergedChaptersMap[c.id] = c; });
      localChapters.forEach(c => { mergedChaptersMap[c.id] = Object.assign({}, mergedChaptersMap[c.id] || {}, c); });
      const mergedChapters = Object.values(mergedChaptersMap);
      localStorage.setItem("cvma_custom_chapters", JSON.stringify(mergedChapters));

      let localVocabs = [];
      try {
        const raw = localStorage.getItem("cvma_custom_vocabularies");
        if (raw) localVocabs = JSON.parse(raw) || [];
      } catch (e) {}

      const mergedVocabsMap = {};
      cloudVocabs.forEach(v => { mergedVocabsMap[v.id] = v; });
      localVocabs.forEach(v => { mergedVocabsMap[v.id] = Object.assign({}, mergedVocabsMap[v.id] || {}, v); });
      const mergedVocabs = Object.values(mergedVocabsMap);
      localStorage.setItem("cvma_custom_vocabularies", JSON.stringify(mergedVocabs));

      // Progress Merge (Keep highest review count or latest date)
      let localProgress = {};
      try {
        const raw = localStorage.getItem("cvma_vocab_progress");
        if (raw) localProgress = JSON.parse(raw) || {};
      } catch (e) {}

      const mergedProgress = Object.assign({}, cloudProgress);
      for (const [vid, lp] of Object.entries(localProgress)) {
        if (!mergedProgress[vid]) {
          mergedProgress[vid] = lp;
        } else {
          const cp = mergedProgress[vid];
          const localReviews = Number(lp.reviewCount || 0);
          const cloudReviews = Number(cp.reviewCount || 0);
          if (localReviews >= cloudReviews) {
            mergedProgress[vid] = lp;
          }
        }
      }
      localStorage.setItem("cvma_vocab_progress", JSON.stringify(mergedProgress));

      // History Merge
      let localHistory = [];
      try {
        const raw = localStorage.getItem("cvma_study_history");
        if (raw) localHistory = JSON.parse(raw) || [];
      } catch (e) {}

      const dateSet = new Set([...cloudHistory, ...localHistory]);
      const mergedHistory = Array.from(dateSet).sort();
      localStorage.setItem("cvma_study_history", JSON.stringify(mergedHistory));

      // Reload VOCAB_DATA and trigger UI updates
      if (window.VOCAB_DATA && typeof window.VOCAB_DATA.reloadCustomData === "function") {
        window.VOCAB_DATA.reloadCustomData();
      }

      // Upload any local additions that weren't in cloud yet
      await this.uploadToCloud();

      const nowTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      localStorage.setItem("cvma_last_sync_time", nowTime);

      window.dispatchEvent(new CustomEvent("cvma:data-synced", {
        detail: {
          chapters: mergedChapters.length,
          vocabularies: mergedVocabs.length,
          timestamp: nowTime
        }
      }));

      return { success: true, timestamp: nowTime };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      return { success: false, error: err.message };
    } finally {
      isSyncing = false;
      updateUIStatus();
    }
  },

  /**
   * Export all user data to a local downloadable JSON file
   */
  exportBackup() {
    let chapters = [];
    let vocabs = [];
    let progress = {};
    let history = [];

    try {
      if (window.VOCAB_DATA) {
        chapters = window.VOCAB_DATA.getCustomChapters() || [];
        vocabs = window.VOCAB_DATA.getCustomVocabulary() || [];
      }
      const rawP = localStorage.getItem("cvma_vocab_progress");
      if (rawP) progress = JSON.parse(rawP) || {};
      const rawH = localStorage.getItem("cvma_study_history");
      if (rawH) history = JSON.parse(rawH) || [];
    } catch (e) {}

    const backupPayload = {
      appName: "Chinese Vocabulary Memory App",
      version: 2,
      exportedAt: new Date().toISOString(),
      user: currentUser ? { email: currentUser.email, displayName: currentUser.displayName } : null,
      customChapters: chapters,
      customVocabulary: vocabs,
      progress: progress,
      studyHistory: history,
      dailyGoal: Number(localStorage.getItem("cvma_daily_goal") || 10),
      activeChapter: localStorage.getItem("cvma_active_chapter") || "ch-001"
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `cvma-vocab-backup-${dateStr}.json`;
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);

    return { success: true, fileName };
  },

  /**
   * Import data from JSON string or file
   */
  async importBackup(jsonString, isReplace = false) {
    let data;
    try {
      data = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
    } catch (e) {
      return { success: false, error: "ไฟล์ JSON ไม่ถูกต้องหรือไม่สามารถอ่านได้" };
    }

    if (!data || typeof data !== "object") {
      return { success: false, error: "โครงสร้างข้อมูลไม่ถูกต้อง" };
    }

    if (window.VOCAB_DATA && typeof window.VOCAB_DATA.importBackupData === "function") {
      const res = window.VOCAB_DATA.importBackupData(data, isReplace ? "replace" : "merge");
      if (!res.success) return res;
    }

    if (data.dailyGoal) {
      localStorage.setItem("cvma_daily_goal", String(data.dailyGoal));
    }
    if (data.activeChapter) {
      localStorage.setItem("cvma_active_chapter", String(data.activeChapter));
    }

    if (currentUser) {
      await this.uploadToCloud();
    }

    window.dispatchEvent(new CustomEvent("cvma:data-synced", {
      detail: { imported: true }
    }));

    return { success: true };
  }
};

window.CVMA_SYNC = CloudSync;

// 5. Auth State Observer
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  updateUIStatus();
  if (user) {
    console.log("Logged in user:", user.email);
    try {
      await CloudSync.downloadAndMerge();
    } catch (e) {
      console.warn("Auto-sync error on login:", e);
    }
  }
});

// 6. UI Injection: Cloud Sync Button & Clean First-Screen Modal
function injectSyncUI() {
  // Inject clean CSS for sync button, banner & modal
  if (!document.getElementById("cvma-sync-styles")) {
    const styleEl = document.createElement("style");
    styleEl.id = "cvma-sync-styles";
    styleEl.textContent = `
      .btn-cloud-sync {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        font-size: 12.5px;
        font-weight: 700;
        color: #6D28D9;
        background: #F5F3FF;
        border: 1px solid #DDD6FE;
        border-radius: 999px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 1px 4px rgba(109, 40, 217, 0.06);
        white-space: nowrap;
        flex-shrink: 0;
        outline: none;
      }
      .btn-cloud-sync:hover {
        background: #EDE9FE;
        border-color: #C4B5FD;
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(109, 40, 217, 0.12);
      }
      .btn-cloud-sync:active {
        transform: translateY(0);
      }
      .btn-cloud-sync.logged-in {
        color: #065F46;
        background: #ECFDF5;
        border-color: #A7F3D0;
        box-shadow: 0 1px 4px rgba(6, 95, 70, 0.06);
      }
      .btn-cloud-sync.logged-in:hover {
        background: #D1FAE5;
        border-color: #6EE7B7;
      }
      .sync-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #F59E0B;
        display: inline-block;
        flex-shrink: 0;
      }
      .btn-cloud-sync.logged-in .sync-status-dot {
        background: #10B981;
        box-shadow: 0 0 6px rgba(16, 185, 129, 0.7);
      }
      .btn-cloud-sync.syncing .sync-status-dot {
        background: #3B82F6;
        animation: syncPulseDot 0.8s infinite alternate;
      }
      @keyframes syncPulseDot {
        from { transform: scale(0.85); opacity: 0.6; }
        to { transform: scale(1.25); opacity: 1; }
      }

      /* Clean Modal Styling */
      .cloud-sync-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(26, 18, 36, 0.52);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        z-index: 10000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .cloud-sync-modal-backdrop.open {
        opacity: 1;
        pointer-events: auto;
      }
      .cloud-sync-modal {
        background: #FFFFFF;
        width: 100%;
        max-width: 440px;
        border-radius: 28px;
        border: 1px solid rgba(240, 225, 235, 0.9);
        box-shadow: 0 24px 60px -12px rgba(35, 20, 50, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
        overflow: hidden;
        transform: scale(0.94) translateY(10px);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        flex-direction: column;
        max-height: 92vh;
      }
      .cloud-sync-modal-backdrop.open .cloud-sync-modal {
        transform: scale(1) translateY(0);
      }

      .sync-modal-top-bar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 14px 18px 0;
      }
      .sync-modal-close {
        background: #F5EFF5;
        border: none;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        color: #7A6882;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }
      .sync-modal-close:hover {
        background: #EBE0EB;
        color: #2D2335;
        transform: scale(1.05);
      }

      .sync-modal-hero {
        text-align: center;
        padding: 4px 22px 14px;
      }
      .sync-hero-icon-badge {
        width: 58px;
        height: 58px;
        margin: 0 auto 12px;
        border-radius: 20px;
        background: linear-gradient(135deg, #EEF2FF 0%, #FAF5FF 100%);
        border: 1.5px solid #E0E7FF;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        box-shadow: 0 8px 20px -4px rgba(99, 102, 241, 0.16);
      }
      .sync-hero-title {
        font-size: 20px;
        font-weight: 800;
        color: #2D2335;
        margin: 0 0 6px;
        letter-spacing: -0.02em;
      }
      .sync-hero-sub {
        font-size: 13.5px;
        color: #7E7288;
        line-height: 1.45;
        margin: 0 auto;
        max-width: 340px;
      }

      .sync-modal-body {
        padding: 4px 20px 22px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      /* Clean Benefits List */
      .sync-benefits-card {
        background: #FAF8FD;
        border: 1px solid #EFE8F6;
        border-radius: 18px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .sync-benefit-row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .sync-benefit-icon {
        font-size: 16px;
        line-height: 1.2;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .sync-benefit-text {
        font-size: 12.5px;
        color: #4A3E54;
        line-height: 1.4;
      }
      .sync-benefit-text strong {
        color: #2D2335;
        font-weight: 700;
        margin-right: 4px;
      }

      /* Google Sign-in Button */
      .google-btn-clean {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        background: #FFFFFF;
        color: #1F2937;
        border: 1.5px solid #E5E7EB;
        border-radius: 16px;
        padding: 12px 18px;
        font-size: 14.5px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .google-btn-clean:hover {
        background: #F9FAFB;
        border-color: #D1D5DB;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        transform: translateY(-1px);
      }
      .google-btn-clean:active {
        transform: translateY(0);
      }

      .btn-skip-to-home {
        width: 100%;
        background: #F5EFF9;
        color: #7B4EC9;
        border: none;
        border-radius: 14px;
        padding: 11px 16px;
        font-size: 13.5px;
        font-weight: 700;
        cursor: pointer;
        text-align: center;
        transition: all 0.15s ease;
      }
      .btn-skip-to-home:hover {
        background: #ECE0F3;
        color: #6335B0;
      }

      /* Logged-in Profile Clean Box */
      .user-profile-clean {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        background: #F0FDF4;
        border: 1px solid #BBF7D0;
        border-radius: 18px;
      }
      .user-avatar-clean {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #10B981;
        color: #FFFFFF;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 17px;
        overflow: hidden;
        flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
      }
      .user-avatar-clean img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .user-details-clean {
        min-width: 0;
        flex: 1;
      }
      .user-name-clean {
        font-size: 14px;
        font-weight: 800;
        color: #1F2937;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .user-email-clean {
        font-size: 12px;
        color: #6B7280;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .user-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11.5px;
        font-weight: 700;
        color: #059669;
        margin-top: 2px;
      }

      .sync-actions-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .btn-sync-action {
        width: 100%;
        padding: 11px 16px;
        font-size: 13.5px;
        font-weight: 700;
        border-radius: 14px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border: none;
        transition: all 0.15s ease;
      }
      .btn-sync-action:active {
        transform: scale(0.99);
      }
      .btn-sync-primary {
        background: linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%);
        color: #FFFFFF;
        box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
      }
      .btn-sync-primary:hover {
        background: linear-gradient(135deg, #6D28D9 0%, #5B21B6 100%);
        box-shadow: 0 6px 16px rgba(124, 58, 237, 0.35);
      }
      .btn-sync-secondary {
        background: #F3EEFF;
        color: #6D28D9;
        border: 1px solid #DDD6FE;
      }
      .btn-sync-secondary:hover {
        background: #EDE5FF;
      }
      .btn-sync-ghost {
        background: transparent;
        color: #DC2626;
        border: 1px solid #FEE2E2;
      }
      .btn-sync-ghost:hover {
        background: #FEF2F2;
      }

      /* Clean Backup Accordion / Card */
      .backup-card-clean {
        background: #FFFFFF;
        border: 1px solid #EFE8F0;
        border-radius: 18px;
        padding: 12px 14px;
      }
      .backup-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .backup-card-title {
        font-size: 13px;
        font-weight: 800;
        color: #2D2335;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .backup-card-desc {
        font-size: 12px;
        color: #7E7288;
        line-height: 1.4;
        margin-bottom: 10px;
      }
      .backup-buttons-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .sync-security-note {
        font-size: 11.5px;
        color: #9C8EA5;
        text-align: center;
        line-height: 1.35;
        padding-top: 2px;
      }
    `;
    document.head.appendChild(styleEl);
  }

  // 1. Inject or bind header button
  let syncBtn = document.getElementById("btnCloudSync");
  const topBar = document.querySelector(".greeting-actions") || document.querySelector(".greeting-top-bar") || document.querySelector("header");
  if (!syncBtn && topBar) {
    syncBtn = document.createElement("button");
    syncBtn.type = "button";
    syncBtn.className = "btn-cloud-sync";
    syncBtn.id = "btnCloudSync";
    syncBtn.setAttribute("aria-label", "ซิงก์ข้อมูลคลาวด์และสำรองไฟล์");
    syncBtn.innerHTML = `<span class="sync-status-dot"></span> <span class="sync-btn-text">☁️ ซิงก์คลาวด์</span>`;

    const helpBtn = document.getElementById("btnPageHelp");
    if (helpBtn && helpBtn.parentNode === topBar) {
      topBar.insertBefore(syncBtn, helpBtn);
    } else {
      topBar.appendChild(syncBtn);
    }
  }

  if (syncBtn) {
    syncBtn.onclick = openSyncModal;
  }

  // Bind Home Page Cloud Banner if present
  const homeBannerBtn = document.getElementById("homeOpenSyncBannerBtn");
  if (homeBannerBtn) {
    homeBannerBtn.onclick = openSyncModal;
  }
  const homeBanner = document.getElementById("homeCloudSyncBanner");
  if (homeBanner) {
    homeBanner.onclick = (e) => {
      if (e.target !== homeBannerBtn) openSyncModal();
    };
  }

  // 2. Inject Modal HTML if not exists
  if (!document.getElementById("cloudSyncModalBackdrop")) {
    const modalWrap = document.createElement("div");
    modalWrap.id = "cloudSyncModalBackdrop";
    modalWrap.className = "cloud-sync-modal-backdrop";
    modalWrap.innerHTML = `
      <div class="cloud-sync-modal" role="dialog" aria-modal="true" aria-labelledby="syncModalTitle">
        
        <div class="sync-modal-top-bar">
          <button type="button" class="sync-modal-close" id="closeSyncModalBtn" aria-label="ปิด">✕</button>
        </div>

        <div class="sync-modal-hero">
          <div class="sync-hero-icon-badge">☁️</div>
          <h2 class="sync-hero-title" id="syncModalTitle">ซิงก์ข้อมูลคลาวด์</h2>
          <p class="sync-hero-sub">เชื่อมต่อ iPhone, iPad และคอมพิวเตอร์ ข้อมูลจะตรงกันเสมอ (ฟรี 100%)</p>
        </div>

        <div class="sync-modal-body">
          <!-- Guest View (เมื่อยังไม่ได้ล็อกอิน) -->
          <div id="cloudGuestView" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="sync-benefits-card">
              <div class="sync-benefit-row">
                <span class="sync-benefit-icon">📱</span>
                <div class="sync-benefit-text">
                  <strong>เปิดได้ทุกเครื่อง:</strong> iPhone, iPad หรือคอมพิวเตอร์ ข้อมูลจะตรงกันอัตโนมัติ
                </div>
              </div>
              <div class="sync-benefit-row">
                <span class="sync-benefit-icon">💾</span>
                <div class="sync-benefit-text">
                  <strong>ข้อมูลไม่สูญหาย:</strong> บันทึกคำศัพท์ คะแนน และบทเรียนที่สร้างเองถาวร
                </div>
              </div>
              <div class="sync-benefit-row">
                <span class="sync-benefit-icon">✨</span>
                <div class="sync-benefit-text">
                  <strong>ฟรีตลอดชีพ:</strong> ปลอดภัยบน Google Cloud ไม่มีค่าใช้จ่ายแอบแฝง
                </div>
              </div>
            </div>

            <button type="button" class="google-btn-clean" id="btnGoogleLogin">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              เข้าสู่ระบบด้วย Google
            </button>

            <button type="button" class="btn-skip-to-home" id="btnProceedGuest">
              ✨ เข้าสู่หน้าหลัก (ใช้งานออฟไลน์ในเครื่องนี้)
            </button>
          </div>

          <!-- Logged In View (เมื่อล็อกอินบัญชี Google แล้ว) -->
          <div id="cloudLoggedInView" style="display: none; flex-direction: column; gap: 12px;">
            <div class="user-profile-clean">
              <div class="user-avatar-clean" id="modalUserAvatar">?</div>
              <div class="user-details-clean">
                <div class="user-name-clean" id="modalUserName">ชื่อผู้ใช้</div>
                <div class="user-email-clean" id="modalUserEmail">user@example.com</div>
                <div class="user-status-pill">
                  <span>🟢</span> <span id="syncLastTimeDesc">เชื่อมต่อคลาวด์แล้ว</span>
                </div>
              </div>
            </div>

            <div class="sync-actions-group">
              <button type="button" class="btn-sync-action btn-sync-primary" id="btnManualSync">
                <span>🔄</span> ซิงก์ข้อมูลตอนนี้
              </button>
              <button type="button" class="btn-sync-action btn-sync-secondary" id="btnProceedHome">
                <span>✨</span> ไปที่หน้าหลัก (เริ่มเรียนเลย)
              </button>
              <button type="button" class="btn-sync-action btn-sync-ghost" id="btnLogout">
                <span>🚪</span> ออกจากระบบ
              </button>
            </div>
          </div>

          <!-- Offline Backup & Restore Card -->
          <div class="backup-card-clean">
            <div class="backup-card-head">
              <div class="backup-card-title">
                <span>📦</span> สำรองและกู้คืนไฟล์ (.json)
              </div>
            </div>
            <div class="backup-card-desc">
              ส่งออกไฟล์สำรองเก็บไว้ในเครื่อง หรือนำเข้าไฟล์ข้อมูล
            </div>
            <div class="backup-buttons-row">
              <button type="button" class="btn-sync-action btn-sync-secondary" id="btnExportBackup">
                <span>📥</span> ส่งออกไฟล์
              </button>
              <button type="button" class="btn-sync-action btn-sync-secondary" id="btnImportBackupTrigger">
                <span>📤</span> นำเข้าไฟล์
              </button>
            </div>
            <input type="file" id="backupFileInput" accept=".json" style="display: none;">
          </div>

          <div class="sync-security-note">
            🔒 เข้ารหัสและปกป้องข้อมูลปลอดภัยด้วย Google Cloud Firestore
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalWrap);

    // Bind Close buttons
    modalWrap.querySelector("#closeSyncModalBtn").addEventListener("click", closeSyncModal);
    modalWrap.querySelector("#btnProceedGuest").addEventListener("click", closeSyncModal);
    modalWrap.querySelector("#btnProceedHome").addEventListener("click", closeSyncModal);
    modalWrap.addEventListener("click", (e) => {
      if (e.target === modalWrap) closeSyncModal();
    });

    // Google Login Action
    modalWrap.querySelector("#btnGoogleLogin").addEventListener("click", async () => {
      const btn = modalWrap.querySelector("#btnGoogleLogin");
      try {
        btn.textContent = "กำลังเชื่อมต่อกับ Google...";
        btn.disabled = true;
        await CloudSync.loginWithGoogle();
      } catch (err) {
        alert("การเข้าสู่ระบบไม่สำเร็จ: " + (err.message || "กรุณาลองใหม่อีกครั้ง"));
      } finally {
        btn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          เข้าสู่ระบบด้วย Google
        `;
        btn.disabled = false;
      }
    });

    // Logout Action
    modalWrap.querySelector("#btnLogout").addEventListener("click", async () => {
      if (confirm("ต้องการออกจากระบบใช่หรือไม่? ข้อมูลในเครื่องจะยังคงอยู่")) {
        await CloudSync.logout();
      }
    });

    // Manual Sync Action
    modalWrap.querySelector("#btnManualSync").addEventListener("click", async () => {
      const btn = modalWrap.querySelector("#btnManualSync");
      btn.innerHTML = "<span>⏳</span> กำลังซิงก์ข้อมูล...";
      btn.disabled = true;
      try {
        const res = await CloudSync.downloadAndMerge();
        if (res.success) {
          alert("✨ ซิงก์ข้อมูลคลาวด์สำเร็จเรียบร้อย!");
        } else {
          alert("การซิงก์ขัดข้อง: " + res.error);
        }
      } catch (e) {
        alert("เกิดข้อผิดพลาดในการซิงก์");
      } finally {
        btn.innerHTML = "<span>🔄</span> ซิงก์ข้อมูลตอนนี้";
        btn.disabled = false;
      }
    });

    // Export Backup Action
    modalWrap.querySelector("#btnExportBackup").addEventListener("click", () => {
      const res = CloudSync.exportBackup();
      if (res.success) {
        alert("📥 ส่งออกไฟล์สำรองสำเร็จ (" + res.fileName + ")");
      }
    });

    // Import Backup Action
    const fileInput = modalWrap.querySelector("#backupFileInput");
    modalWrap.querySelector("#btnImportBackupTrigger").addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target.result;
        const replace = confirm("ต้องการนำเข้าไฟล์สำรองใช่หรือไม่?\n\n- กด [ตกลง (OK)] เพื่อ 'รวมข้อมูล' (Merge)\n- หรือยกเลิกหากไม่ต้องการ");
        if (replace) {
          const res = await CloudSync.importBackup(content, false);
          if (res.success) {
            alert("✨ นำเข้าข้อมูลสำรองสำเร็จเรียบร้อย! ระบบกำลังอัปเดตหน้าจอ");
            location.reload();
          } else {
            alert("การนำเข้าไม่สำเร็จ: " + res.error);
          }
        }
      };
      reader.readAsText(file);
    });
  }

  updateUIStatus();

  // บังคับให้ขึ้นหน้า ☁️ ซิงก์คลาวด์ เป็นหน้าแรก
  const isHomePage = document.getElementById("page-home") || 
                     window.location.pathname.endsWith("index.html") || 
                     window.location.pathname === "/";
  if (isHomePage) {
    setTimeout(() => {
      openSyncModal();
    }, 150);
  }
}

export function openSyncModal() {
  const modal = document.getElementById("cloudSyncModalBackdrop");
  if (modal) modal.classList.add("open");
}

export function closeSyncModal() {
  const modal = document.getElementById("cloudSyncModalBackdrop");
  if (modal) modal.classList.remove("open");
}

// Global window hooks
if (typeof window !== "undefined") {
  window.openSyncModal = openSyncModal;
  window.closeSyncModal = closeSyncModal;
}

function updateUIStatus() {
  const syncBtn = document.getElementById("btnCloudSync");
  const guestView = document.getElementById("cloudGuestView");
  const loggedView = document.getElementById("cloudLoggedInView");
  const avatarEl = document.getElementById("modalUserAvatar");
  const nameEl = document.getElementById("modalUserName");
  const emailEl = document.getElementById("modalUserEmail");
  const lastSyncDesc = document.getElementById("syncLastTimeDesc");

  const homeStatusDot = document.getElementById("homeCloudStatusDot");
  const homeStatusLabel = document.getElementById("homeCloudStatusLabel");
  const homeStatusSub = document.getElementById("homeCloudStatusSub");
  const homeBannerBtn = document.getElementById("homeOpenSyncBannerBtn");

  const lastSyncTime = localStorage.getItem("cvma_last_sync_time");

  if (currentUser) {
    if (syncBtn) {
      syncBtn.classList.add("logged-in");
      if (isSyncing) {
        syncBtn.classList.add("syncing");
        syncBtn.querySelector(".sync-btn-text").textContent = "กำลังซิงก์...";
      } else {
        syncBtn.classList.remove("syncing");
        const displayName = currentUser.displayName || currentUser.email.split("@")[0];
        syncBtn.querySelector(".sync-btn-text").textContent = `☁️ ${displayName}`;
      }
    }

    if (guestView) guestView.style.display = "none";
    if (loggedView) loggedView.style.display = "flex";

    if (nameEl) nameEl.textContent = currentUser.displayName || "ผู้ใช้งาน";
    if (emailEl) emailEl.textContent = currentUser.email || "";

    if (avatarEl) {
      if (currentUser.photoURL) {
        avatarEl.innerHTML = `<img src="${currentUser.photoURL}" alt="avatar">`;
      } else {
        avatarEl.textContent = (currentUser.displayName || currentUser.email || "U")[0].toUpperCase();
      }
    }

    if (lastSyncDesc) {
      lastSyncDesc.textContent = lastSyncTime
        ? `ซิงก์ล่าสุดเมื่อ ${lastSyncTime} • ปลอดภัยบน Firestore`
        : `พร้อมซิงก์ข้อมูลอัตโนมัติ`;
    }

    // Update Home Banner
    if (homeStatusDot) homeStatusDot.classList.add("is-online");
    if (homeStatusLabel) homeStatusLabel.textContent = `🟢 ซิงก์คลาวด์: ${currentUser.displayName || currentUser.email}`;
    if (homeStatusSub) homeStatusSub.textContent = `เชื่อมต่อกับ Google Account แล้ว • อุปกรณ์ทุกเครื่องจะตรงกัน`;
    if (homeBannerBtn) homeBannerBtn.textContent = "🔄 จัดการซิงก์";
  } else {
    if (syncBtn) {
      syncBtn.classList.remove("logged-in");
      syncBtn.classList.remove("syncing");
      syncBtn.querySelector(".sync-btn-text").textContent = "☁️ ซิงก์คลาวด์";
    }

    if (guestView) guestView.style.display = "flex";
    if (loggedView) loggedView.style.display = "none";

    // Update Home Banner
    if (homeStatusDot) homeStatusDot.classList.remove("is-online");
    if (homeStatusLabel) homeStatusLabel.textContent = `ระบบซิงก์คลาวด์ข้ามอุปกรณ์`;
    if (homeStatusSub) homeStatusSub.textContent = `เชื่อมต่อ iPhone, iPad หรือคอมพิวเตอร์ ข้อมูลจะตรงกันเสมอ (ฟรี 100%)`;
    if (homeBannerBtn) homeBannerBtn.textContent = "☁️ ตั้งค่าซิงก์";
  }
}

// Auto-sync trigger on progress updates or window focus
let debounceTimer = null;
window.addEventListener("cvma:progress-updated", () => {
  if (currentUser && !isSyncing) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      CloudSync.uploadToCloud().catch(err => console.warn("Background cloud upload:", err));
    }, 1500);
  }
});

window.addEventListener("focus", () => {
  if (currentUser && !isSyncing) {
    CloudSync.downloadAndMerge().catch(() => {});
  }
});

// Initialize UI when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectSyncUI);
} else {
  injectSyncUI();
}

