/**
 * ============================================================================
 * SmartAttend AI — Complete Frontend Application Logic (script.js)
 * Built with Vanilla JavaScript, localStorage, QRCode.js, html5-qrcode & Chart.js
 * ============================================================================
 */

(function () {
    "use strict";

    // ========================================================================
    // 1. STORAGE KEYS & DEMO TEACHER CREDENTIALS
    // ========================================================================
    const STORAGE_KEYS = {
        STUDENTS: "smartAttend_students",
        CLASSES: "smartAttend_classes",
        ATTENDANCE: "smartAttend_attendance",
        SESSIONS: "smartAttend_sessions",
        SETTINGS: "smartAttend_settings"
    };

    const SESSION_STORAGE_KEY = "smartAttend_teacherSession";

    /**
     * Classroom Demo Teacher Credentials
     * NOTE: For educational demonstration only. Passwords are NEVER saved in localStorage.
     */
    const DEMO_TEACHERS = [
        { username: "teacher1", password: "teach123", displayName: "Teacher 1 (Mr. Kamran)" },
        { username: "teacher2", password: "teach456", displayName: "Teacher 2 (Ms. Sana)" }
    ];

    // ========================================================================
    // 2. APPLICATION STATE
    // ========================================================================
    const state = {
        students: [],
        classes: [],
        attendance: [],
        sessions: [], // Finalized class attendance sessions: { id, classId, date, finalizedAt, teacher }
        settings: {
            schoolName: "Smart School",
            attendanceThreshold: 75,
            defaultClassId: "CLASS_5A"
        },
        activeSection: "home",
        teacherSession: null, // Loaded from sessionStorage
        storageCorrupted: false,

        // QR Scanner runtime state
        html5QrCode: null,
        isCameraRunning: false,
        availableCameras: [],
        currentCameraIndex: 0,
        scanLock: false,
        lastScannedCode: "",
        lastScannedTime: 0,

        // Chart.js instances
        charts: {
            homeChart: null,
            doughnutChart: null,
            classBarChart: null,
            trendChart: null
        }
    };

    // ========================================================================
    // 3. DATE, TIME & SAFE DOM HELPERS
    // ========================================================================

    /**
     * Returns a YYYY-MM-DD date string in local time (offset by daysOffset if provided)
     */
    function getLocalDateString(daysOffset = 0) {
        const d = new Date();
        if (daysOffset !== 0) {
            d.setDate(d.getDate() + daysOffset);
        }
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    /**
     * Returns current local time formatted like "08:15 AM"
     */
    function getCurrentTimeFormatted() {
        const now = new Date();
        return now.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
    }

    /**
     * Formats YYYY-MM-DD into a friendly human-readable date
     */
    function formatFriendlyDate(dateStr) {
        if (!dateStr) return "N/A";
        const parts = dateStr.split("-");
        if (parts.length !== 3) return dateStr;
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    /**
     * Escapes strings for safe HTML text insertion when building template structures
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Refreshes Lucide icons safely if the CDN script loaded
     */
    function refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            try {
                window.lucide.createIcons();
            } catch (e) {
                console.warn("Lucide icon refresh warning:", e);
            }
        }
    }

    // ========================================================================
    // 4. TOAST NOTIFICATIONS & REUSABLE MODAL DIALOG
    // ========================================================================

    /**
     * Displays a non-intrusive toast notification
     * @param {string} message
     * @param {"success"|"warning"|"error"|"info"} type
     */
    function showToast(message, type = "info") {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        const iconMap = {
            success: "✅",
            warning: "⚠️",
            error: "🚨",
            info: "ℹ️"
        };

        const iconSpan = document.createElement("span");
        iconSpan.textContent = iconMap[type] || "ℹ️";

        const textSpan = document.createElement("span");
        textSpan.textContent = message;

        toast.appendChild(iconSpan);
        toast.appendChild(textSpan);
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transition = "opacity 0.25s ease";
            setTimeout(() => toast.remove(), 260);
        }, 4000);
    }

    /**
     * Opens a custom confirmation or text-input modal dialog
     */
    function openModal({
        title = "Confirm Action",
        message = "",
        confirmText = "Confirm",
        confirmClass = "btn-primary",
        showInput = false,
        inputLabel = "",
        inputValue = "",
        extraHtml = "",
        onConfirm = () => {}
    }) {
        const backdrop = document.getElementById("app-modal-backdrop");
        const titleEl = document.getElementById("modal-title");
        const msgEl = document.getElementById("modal-message");
        const inputWrap = document.getElementById("modal-input-wrap");
        const inputLabelEl = document.getElementById("modal-input-label");
        const inputEl = document.getElementById("modal-text-input");
        const inputErr = document.getElementById("modal-input-error");
        const extraEl = document.getElementById("modal-extra-options");
        const confirmBtn = document.getElementById("modal-confirm-btn");
        const cancelBtn = document.getElementById("modal-cancel-btn");
        const closeX = document.getElementById("modal-close-x");

        titleEl.textContent = title;
        msgEl.textContent = message;
        confirmBtn.textContent = confirmText;
        confirmBtn.className = `btn ${confirmClass}`;
        inputErr.classList.add("hidden");
        inputErr.textContent = "";

        if (showInput) {
            inputWrap.classList.remove("hidden");
            inputLabelEl.textContent = inputLabel;
            inputEl.value = inputValue;
        } else {
            inputWrap.classList.add("hidden");
        }

        if (extraHtml) {
            extraEl.classList.remove("hidden");
            extraEl.innerHTML = extraHtml;
        } else {
            extraEl.classList.add("hidden");
            extraEl.innerHTML = "";
        }

        backdrop.classList.remove("hidden");
        if (showInput) {
            setTimeout(() => inputEl.focus(), 50);
        } else {
            setTimeout(() => confirmBtn.focus(), 50);
        }

        function closeModal() {
            backdrop.classList.add("hidden");
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            closeX.onclick = null;
        }

        cancelBtn.onclick = closeModal;
        closeX.onclick = closeModal;

        confirmBtn.onclick = () => {
            const val = showInput ? inputEl.value.trim() : null;
            const shouldClose = onConfirm(val, {
                showError: (errText) => {
                    inputErr.textContent = errText;
                    inputErr.classList.remove("hidden");
                }
            });
            if (shouldClose !== false) {
                closeModal();
            }
        };
    }

    // ========================================================================
    // 5. DEMO DATA GENERATION & LOCALSTORAGE PERSISTENCE
    // ========================================================================

    /**
     * Builds the default fictional dataset required by Section 6
     */
    function buildDefaultDemoData() {
        const today = getLocalDateString(0);
        const yesterday = getLocalDateString(-1);
        const twoDaysAgo = getLocalDateString(-2);
        const threeDaysAgo = getLocalDateString(-3);

        const defaultClasses = [
            { id: "CLASS_5A", name: "Class 5-A" },
            { id: "CLASS_5B", name: "Class 5-B" },
            { id: "CLASS_4A", name: "Class 4-A" }
        ];

        const defaultStudents = [
            // Class 5-A (5 students — matches prompt's exact examples)
            { id: "STU001", name: "Ali Ahmed", classId: "CLASS_5A", section: "A", rollNo: 1 },
            { id: "STU002", name: "Sara Khan", classId: "CLASS_5A", section: "A", rollNo: 2 },
            { id: "STU003", name: "Ahmed Ali", classId: "CLASS_5A", section: "A", rollNo: 3 },
            { id: "STU004", name: "Ayesha Noor", classId: "CLASS_5A", section: "A", rollNo: 4 },
            { id: "STU005", name: "Hassan Raza", classId: "CLASS_5A", section: "A", rollNo: 5 },
            // Class 5-B (4 students)
            { id: "STU006", name: "Fatima Zahra", classId: "CLASS_5B", section: "B", rollNo: 1 },
            { id: "STU007", name: "Bilal Mahmood", classId: "CLASS_5B", section: "B", rollNo: 2 },
            { id: "STU008", name: "Zainab Tariq", classId: "CLASS_5B", section: "B", rollNo: 3 },
            { id: "STU009", name: "Usman Farooq", classId: "CLASS_5B", section: "B", rollNo: 4 },
            // Class 4-A (3 students)
            { id: "STU010", name: "Maryam Siddiqui", classId: "CLASS_4A", section: "A", rollNo: 1 },
            { id: "STU011", name: "Hamza Iqbal", classId: "CLASS_4A", section: "A", rollNo: 2 },
            { id: "STU012", name: "Hira Nadeem", classId: "CLASS_4A", section: "A", rollNo: 3 }
        ];

        // Realistic attendance records across 3 historical finalized days + Today
        // NOTE: For Today in Class 5-A, ALL 5 students (STU001..STU005) start UNMARKED (0 Present)
        // so presenters can scan their printed QR cards live during the demo!
        const defaultAttendance = [
            // --- Today's Attendance ---
            // Class 5-A Today: Starts completely unmarked (0 Present) so live QR scanning starts fresh!

            // Class 5-B Today: 3 Present (STU006, STU007, STU008), STU009 Absent
            { id: "ATT_T05", studentId: "STU006", classId: "CLASS_5B", date: today, time: "08:14 AM", status: "Present", method: "QR", teacher: "teacher2" },
            { id: "ATT_T06", studentId: "STU007", classId: "CLASS_5B", date: today, time: "08:16 AM", status: "Present", method: "QR", teacher: "teacher2" },
            { id: "ATT_T07", studentId: "STU008", classId: "CLASS_5B", date: today, time: "08:18 AM", status: "Present", method: "QR", teacher: "teacher2" },

            // Class 4-A Today: All 3 Present
            { id: "ATT_T08", studentId: "STU010", classId: "CLASS_4A", date: today, time: "08:10 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_T09", studentId: "STU011", classId: "CLASS_4A", date: today, time: "08:11 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_T10", studentId: "STU012", classId: "CLASS_4A", date: today, time: "08:15 AM", status: "Present", method: "QR", teacher: "teacher1" },

            // --- Yesterday's Attendance ---
            { id: "ATT_Y01", studentId: "STU001", classId: "CLASS_5A", date: yesterday, time: "08:04 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_Y02", studentId: "STU002", classId: "CLASS_5A", date: yesterday, time: "08:06 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_Y03", studentId: "STU003", classId: "CLASS_5A", date: yesterday, time: "08:08 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_Y04", studentId: "STU004", classId: "CLASS_5A", date: yesterday, time: "08:10 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_Y05", studentId: "STU005", classId: "CLASS_5A", date: yesterday, time: "08:15 AM", status: "Present", method: "Manual", teacher: "teacher1" },

            { id: "ATT_Y06", studentId: "STU006", classId: "CLASS_5B", date: yesterday, time: "08:05 AM", status: "Present", method: "QR", teacher: "teacher2" },
            { id: "ATT_Y07", studentId: "STU007", classId: "CLASS_5B", date: yesterday, time: "08:09 AM", status: "Present", method: "QR", teacher: "teacher2" },
            { id: "ATT_Y08", studentId: "STU008", classId: "CLASS_5B", date: yesterday, time: "08:11 AM", status: "Present", method: "QR", teacher: "teacher2" },
            // STU009 absent yesterday

            { id: "ATT_Y09", studentId: "STU010", classId: "CLASS_4A", date: yesterday, time: "08:03 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_Y10", studentId: "STU011", classId: "CLASS_4A", date: yesterday, time: "08:07 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_Y11", studentId: "STU012", classId: "CLASS_4A", date: yesterday, time: "08:12 AM", status: "Present", method: "QR", teacher: "teacher1" },

            // --- Two Days Ago ---
            { id: "ATT_D01", studentId: "STU001", classId: "CLASS_5A", date: twoDaysAgo, time: "08:02 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_D02", studentId: "STU002", classId: "CLASS_5A", date: twoDaysAgo, time: "08:05 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_D03", studentId: "STU003", classId: "CLASS_5A", date: twoDaysAgo, time: "08:09 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_D04", studentId: "STU004", classId: "CLASS_5A", date: twoDaysAgo, time: "08:11 AM", status: "Present", method: "QR", teacher: "teacher1" },
            // STU005 absent twoDaysAgo

            { id: "ATT_D05", studentId: "STU006", classId: "CLASS_5B", date: twoDaysAgo, time: "08:06 AM", status: "Present", method: "QR", teacher: "teacher2" },
            { id: "ATT_D06", studentId: "STU007", classId: "CLASS_5B", date: twoDaysAgo, time: "08:08 AM", status: "Present", method: "QR", teacher: "teacher2" },
            // STU008 & STU009 absent twoDaysAgo

            { id: "ATT_D07", studentId: "STU010", classId: "CLASS_4A", date: twoDaysAgo, time: "08:04 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_D08", studentId: "STU011", classId: "CLASS_4A", date: twoDaysAgo, time: "08:06 AM", status: "Present", method: "QR", teacher: "teacher1" },
            // STU012 absent twoDaysAgo

            // --- Three Days Ago ---
            { id: "ATT_P01", studentId: "STU001", classId: "CLASS_5A", date: threeDaysAgo, time: "08:01 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_P02", studentId: "STU002", classId: "CLASS_5A", date: threeDaysAgo, time: "08:04 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_P03", studentId: "STU003", classId: "CLASS_5A", date: threeDaysAgo, time: "08:08 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_P04", studentId: "STU004", classId: "CLASS_5A", date: threeDaysAgo, time: "08:12 AM", status: "Present", method: "QR", teacher: "teacher1" },
            // STU005 absent threeDaysAgo

            { id: "ATT_P05", studentId: "STU006", classId: "CLASS_5B", date: threeDaysAgo, time: "08:05 AM", status: "Present", method: "QR", teacher: "teacher2" },
            { id: "ATT_P06", studentId: "STU007", classId: "CLASS_5B", date: threeDaysAgo, time: "08:07 AM", status: "Present", method: "QR", teacher: "teacher2" },
            { id: "ATT_P07", studentId: "STU008", classId: "CLASS_5B", date: threeDaysAgo, time: "08:10 AM", status: "Present", method: "QR", teacher: "teacher2" },
            { id: "ATT_P08", studentId: "STU009", classId: "CLASS_5B", date: threeDaysAgo, time: "08:14 AM", status: "Present", method: "Manual", teacher: "teacher2" },

            { id: "ATT_P09", studentId: "STU010", classId: "CLASS_4A", date: threeDaysAgo, time: "08:02 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_P10", studentId: "STU011", classId: "CLASS_4A", date: threeDaysAgo, time: "08:05 AM", status: "Present", method: "QR", teacher: "teacher1" },
            { id: "ATT_P11", studentId: "STU012", classId: "CLASS_4A", date: threeDaysAgo, time: "08:09 AM", status: "Present", method: "QR", teacher: "teacher1" }
        ];

        const defaultSessions = [
            // Class 5-A session for today starts OPEN so teacher1 can scan STU001, STU002, STU003 live and then click Finalize!
            { id: "SES_T_5B", classId: "CLASS_5B", date: today, finalizedAt: "08:35 AM", teacher: "teacher2" },
            { id: "SES_T_4A", classId: "CLASS_4A", date: today, finalizedAt: "08:32 AM", teacher: "teacher1" },

            { id: "SES_Y_5A", classId: "CLASS_5A", date: yesterday, finalizedAt: "08:30 AM", teacher: "teacher1" },
            { id: "SES_Y_5B", classId: "CLASS_5B", date: yesterday, finalizedAt: "08:35 AM", teacher: "teacher2" },
            { id: "SES_Y_4A", classId: "CLASS_4A", date: yesterday, finalizedAt: "08:32 AM", teacher: "teacher1" },

            { id: "SES_D_5A", classId: "CLASS_5A", date: twoDaysAgo, finalizedAt: "08:30 AM", teacher: "teacher1" },
            { id: "SES_D_5B", classId: "CLASS_5B", date: twoDaysAgo, finalizedAt: "08:35 AM", teacher: "teacher2" },
            { id: "SES_D_4A", classId: "CLASS_4A", date: twoDaysAgo, finalizedAt: "08:32 AM", teacher: "teacher1" },

            { id: "SES_P_5A", classId: "CLASS_5A", date: threeDaysAgo, finalizedAt: "08:30 AM", teacher: "teacher1" },
            { id: "SES_P_5B", classId: "CLASS_5B", date: threeDaysAgo, finalizedAt: "08:35 AM", teacher: "teacher2" },
            { id: "SES_P_4A", classId: "CLASS_4A", date: threeDaysAgo, finalizedAt: "08:32 AM", teacher: "teacher1" }
        ];

        const defaultSettings = {
            schoolName: "Smart School",
            attendanceThreshold: 75,
            defaultClassId: "CLASS_5A",
            demoDataVersion: 3
        };

        return {
            classes: defaultClasses,
            students: defaultStudents,
            attendance: defaultAttendance,
            sessions: defaultSessions,
            settings: defaultSettings
        };
    }

    /**
     * Loads application data from localStorage.
     * Initializes demo data ONLY if keys do not exist yet.
     */
    function loadApplicationData() {
        const defaults = buildDefaultDemoData();
        state.storageCorrupted = false;

        function readOrInitKey(key, fallbackValue, validatorFn) {
            try {
                const raw = localStorage.getItem(key);
                if (raw === null) {
                    localStorage.setItem(key, JSON.stringify(fallbackValue));
                    return fallbackValue;
                }
                const parsed = JSON.parse(raw);
                if (!validatorFn(parsed)) {
                    state.storageCorrupted = true;
                    return fallbackValue;
                }
                return parsed;
            } catch (err) {
                console.error(`Error reading localStorage key "${key}":`, err);
                state.storageCorrupted = true;
                return fallbackValue;
            }
        }

        state.classes = readOrInitKey(STORAGE_KEYS.CLASSES, defaults.classes, Array.isArray);
        state.students = readOrInitKey(STORAGE_KEYS.STUDENTS, defaults.students, Array.isArray);
        state.attendance = readOrInitKey(STORAGE_KEYS.ATTENDANCE, defaults.attendance, Array.isArray);
        state.sessions = readOrInitKey(STORAGE_KEYS.SESSIONS, defaults.sessions, Array.isArray);
        state.settings = readOrInitKey(
            STORAGE_KEYS.SETTINGS,
            defaults.settings,
            (obj) => obj && typeof obj === "object" && typeof obj.schoolName === "string"
        );

        // Auto-migrate older v1/v2 browser localStorage so Class 5-A starts with 0 Present today
        if (state.settings.demoDataVersion !== 3) {
            const oldPreMarkedIds = new Set(["ATT_T01", "ATT_T02", "ATT_T03", "ATT_T04"]);
            state.attendance = state.attendance.filter((r) => !oldPreMarkedIds.has(r.id));
            state.sessions = state.sessions.filter((s) => s.id !== "SES_T_5A");
            state.settings.demoDataVersion = 3;
            saveAllData();
        }

        // Load active teacher session from sessionStorage
        try {
            const rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (rawSession) {
                state.teacherSession = JSON.parse(rawSession);
            }
        } catch (e) {
            state.teacherSession = null;
        }

        const recoveryBanner = document.getElementById("storage-recovery-banner");
        if (recoveryBanner) {
            if (state.storageCorrupted) {
                recoveryBanner.classList.remove("hidden");
            } else {
                recoveryBanner.classList.add("hidden");
            }
        }
    }

    /**
     * Saves all current state collections to localStorage safely
     */
    function saveAllData() {
        try {
            localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(state.classes));
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(state.students));
            localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(state.attendance));
            localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(state.sessions));
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
        } catch (err) {
            console.error("Failed to save to localStorage:", err);
            showToast("Could not save data to browser localStorage. Storage may be full or restricted.", "error");
        }
    }

    /**
     * Restores the original demonstration dataset
     */
    function restoreDemoData() {
        const defaults = buildDefaultDemoData();
        state.classes = defaults.classes;
        state.students = defaults.students;
        state.attendance = defaults.attendance;
        state.sessions = defaults.sessions;
        state.settings = defaults.settings;
        state.storageCorrupted = false;
        saveAllData();

        const recoveryBanner = document.getElementById("storage-recovery-banner");
        if (recoveryBanner) recoveryBanner.classList.add("hidden");

        refreshAllViews();
        showToast("Original demonstration data restored successfully!", "success");
    }

    /**
     * Clears all demo data (students, classes, attendance, sessions)
     */
    function clearAllData() {
        state.classes = [];
        state.students = [];
        state.attendance = [];
        state.sessions = [];
        saveAllData();
        refreshAllViews();
        showToast("All students, classes, and attendance records have been cleared.", "warning");
    }

    // ========================================================================
    // 6. CORE REUSABLE DOMAIN & BUSINESS LOGIC FUNCTIONS
    // ========================================================================

    function findClassById(classId) {
        return state.classes.find((c) => c.id === classId) || null;
    }

    function getClassName(classId) {
        const cls = findClassById(classId);
        return cls ? cls.name : classId || "Unknown Class";
    }

    function findStudentById(studentId) {
        if (!studentId) return null;
        const normalized = String(studentId).trim().toUpperCase();
        return state.students.find((s) => s.id.toUpperCase() === normalized) || null;
    }

    function getStudentsByClass(classId) {
        if (!classId || classId === "ALL") return [...state.students];
        return state.students.filter((s) => s.classId === classId);
    }

    /**
     * Generates the next available Student ID like STU013
     */
    function generateNextStudentId() {
        let maxNum = 0;
        state.students.forEach((s) => {
            const match = String(s.id).toUpperCase().match(/^STU(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        });
        return `STU${String(maxNum + 1).padStart(3, "0")}`;
    }

    /**
     * Checks if a class session is finalized for a given classId and date
     */
    function isSessionFinalized(classId, dateStr) {
        return state.sessions.some((s) => s.classId === classId && s.date === dateStr);
    }

    function getFinalizedSession(classId, dateStr) {
        return state.sessions.find((s) => s.classId === classId && s.date === dateStr) || null;
    }

    /**
     * Checks if a student is already marked present for a given class and date
     */
    function findAttendanceRecord(studentId, classId, dateStr) {
        const normId = String(studentId).trim().toUpperCase();
        return (
            state.attendance.find(
                (r) =>
                    r.studentId.toUpperCase() === normId &&
                    r.classId === classId &&
                    r.date === dateStr &&
                    r.status === "Present"
            ) || null
        );
    }

    /**
     * Records attendance for a student (via QR or Manual) with full validation
     */
    function recordStudentAttendance({ studentId, selectedClassId, dateStr, method = "QR" }) {
        if (!state.students.length) {
            return { ok: false, code: "NO_STUDENTS", message: "No students are registered in the system yet." };
        }

        if (!selectedClassId) {
            return { ok: false, code: "NO_CLASS", message: "Please select a class before recording attendance." };
        }

        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return { ok: false, code: "INVALID_DATE", message: "Please select a valid attendance date." };
        }

        const rawCode = String(studentId || "").trim();
        if (!rawCode || rawCode.length > 32 || !/^[A-Za-z0-9_-]+$/.test(rawCode)) {
            return {
                ok: false,
                code: "INVALID_QR",
                message: "Invalid QR code format. Student QR badges only contain alphanumeric IDs like STU001."
            };
        }

        const student = findStudentById(rawCode);
        if (!student) {
            return {
                ok: false,
                code: "UNKNOWN_STUDENT",
                message: `Unknown Student ID "${rawCode.toUpperCase()}". No registered student matches this QR code.`
            };
        }

        if (student.classId !== selectedClassId) {
            const actualClassName = getClassName(student.classId);
            const targetClassName = getClassName(selectedClassId);
            return {
                ok: false,
                code: "WRONG_CLASS",
                student,
                message: `${student.name} (${student.id}) belongs to ${actualClassName}, not ${targetClassName}.`
            };
        }

        const existing = findAttendanceRecord(student.id, selectedClassId, dateStr);
        if (existing) {
            return {
                ok: false,
                code: "DUPLICATE",
                student,
                record: existing,
                message: "This student has already been marked present."
            };
        }

        const teacherUsername = state.teacherSession ? state.teacherSession.username : "demo_teacher";
        const newRecord = {
            id: `ATT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            studentId: student.id,
            classId: selectedClassId,
            date: dateStr,
            time: getCurrentTimeFormatted(),
            status: "Present",
            method: method === "Manual" ? "Manual" : "QR",
            teacher: teacherUsername
        };

        state.attendance.unshift(newRecord);
        saveAllData();

        return {
            ok: true,
            code: "SUCCESS",
            student,
            record: newRecord,
            message: "ATTENDANCE MARKED SUCCESSFULLY"
        };
    }

    /**
     * Finalizes attendance for a class and date so unrecorded students are counted as Absent
     */
    function finalizeClassSession(classId, dateStr) {
        if (!classId || !dateStr) {
            showToast("Please select both a class and a valid date to finalize.", "warning");
            return false;
        }
        const classStudents = getStudentsByClass(classId);
        if (classStudents.length === 0) {
            showToast("Cannot finalize an empty class with no registered students.", "warning");
            return false;
        }

        const teacherUsername = state.teacherSession ? state.teacherSession.username : "demo_teacher";
        const existingSession = getFinalizedSession(classId, dateStr);

        if (existingSession) {
            existingSession.finalizedAt = getCurrentTimeFormatted();
            existingSession.teacher = teacherUsername;
            saveAllData();
            refreshAllViews();
            showToast(`Updated finalized session for ${getClassName(classId)} on ${dateStr}.`, "success");
            return true;
        }

        state.sessions.push({
            id: `SES_${Date.now()}`,
            classId,
            date: dateStr,
            finalizedAt: getCurrentTimeFormatted(),
            teacher: teacherUsername
        });

        saveAllData();
        refreshAllViews();
        showToast(
            `Attendance finalized for ${getClassName(classId)} (${dateStr}). Unmarked students are now recorded as Absent for this session.`,
            "success"
        );
        return true;
    }

    /**
     * Reopens a finalized session if a teacher wants it back in Open/In-Progress state
     */
    function reopenClassSession(classId, dateStr) {
        const idx = state.sessions.findIndex((s) => s.classId === classId && s.date === dateStr);
        if (idx !== -1) {
            state.sessions.splice(idx, 1);
            saveAllData();
            refreshAllViews();
            showToast(`Reopened attendance session for ${getClassName(classId)} on ${dateStr}.`, "info");
        }
    }

    /**
     * Calculates summary statistics for a specific class and date
     * Note: Absent count is only calculated from finalized sessions (or shown as pending before finalization)
     */
    function calculateClassDateStats(classId, dateStr) {
        const students = getStudentsByClass(classId);
        const total = students.length;
        const presentRecords = state.attendance.filter(
            (r) =>
                r.classId === classId &&
                r.date === dateStr &&
                r.status === "Present" &&
                students.some((s) => s.id === r.studentId)
        );
        const presentCount = presentRecords.length;
        const finalized = isSessionFinalized(classId, dateStr);
        const absentCount = finalized ? Math.max(0, total - presentCount) : 0;
        const unmarkedCount = Math.max(0, total - presentCount);
        const rate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

        return {
            total,
            presentCount,
            absentCount,
            unmarkedCount,
            finalized,
            rate
        };
    }

    /**
     * Calculates school-wide statistics for a specific date (used on Home Dashboard)
     */
    function calculateSchoolDateStats(dateStr) {
        const totalStudents = state.students.length;
        const totalClasses = state.classes.length;

        let presentToday = 0;
        let absentToday = 0;
        let finalizedClassesCount = 0;

        state.classes.forEach((cls) => {
            const cStats = calculateClassDateStats(cls.id, dateStr);
            presentToday += cStats.presentCount;
            if (cStats.finalized) {
                absentToday += cStats.absentCount;
                finalizedClassesCount += 1;
            }
        });

        const rate = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;
        return {
            totalStudents,
            totalClasses,
            presentToday,
            absentToday,
            finalizedClassesCount,
            rate
        };
    }

    /**
     * Builds unified attendance rows (combining explicit Present records + synthesized Absent records for finalized sessions)
     */
    function getUnifiedAttendanceRows({ startDate = null, endDate = null, classId = "ALL", status = "ALL", method = "ALL", searchQuery = "" } = {}) {
        const rows = [];

        // 1. Add all explicit Present records matching date & class
        state.attendance.forEach((rec) => {
            if (startDate && rec.date < startDate) return;
            if (endDate && rec.date > endDate) return;
            if (classId !== "ALL" && rec.classId !== classId) return;

            const stu = findStudentById(rec.studentId);
            rows.push({
                recordId: rec.id,
                isSyntheticAbsent: false,
                date: rec.date,
                studentId: rec.studentId,
                studentName: stu ? stu.name : `${rec.studentId} (Removed)`,
                classId: rec.classId,
                className: getClassName(rec.classId),
                rollNo: stu ? stu.rollNo : "-",
                status: "Present",
                method: rec.method || "QR",
                time: rec.time || "-",
                teacher: rec.teacher || "teacher1"
            });
        });

        // 2. For every finalized session matching date & class, synthesize Absent rows for students without a Present record
        state.sessions.forEach((ses) => {
            if (startDate && ses.date < startDate) return;
            if (endDate && ses.date > endDate) return;
            if (classId !== "ALL" && ses.classId !== classId) return;

            const classStudents = getStudentsByClass(ses.classId);
            classStudents.forEach((stu) => {
                const wasPresent = state.attendance.some(
                    (r) => r.studentId === stu.id && r.classId === ses.classId && r.date === ses.date && r.status === "Present"
                );
                if (!wasPresent) {
                    rows.push({
                        recordId: `ABS_${ses.date}_${stu.id}`,
                        isSyntheticAbsent: true,
                        date: ses.date,
                        studentId: stu.id,
                        studentName: stu.name,
                        classId: ses.classId,
                        className: getClassName(ses.classId),
                        rollNo: stu.rollNo,
                        status: "Absent",
                        method: "Finalized",
                        time: ses.finalizedAt || "Session Close",
                        teacher: ses.teacher || "teacher1"
                    });
                }
            });
        });

        // 3. Filter by status, method, and search query
        const q = searchQuery.trim().toLowerCase();
        const filtered = rows.filter((row) => {
            if (status !== "ALL" && row.status !== status) return false;
            if (method !== "ALL" && row.method !== method) return false;
            if (q) {
                const hay = `${row.studentId} ${row.studentName} ${row.className} ${row.rollNo}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        // 4. Sort by date descending, then rollNo ascending
        filtered.sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            if (a.className !== b.className) return a.className.localeCompare(b.className);
            return (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0);
        });

        return filtered;
    }

    // ========================================================================
    // 7. NAVIGATION & SESSION UI
    // ========================================================================

    function navigateToSection(sectionId) {
        // Stop camera automatically if leaving qr-scanner
        if (state.activeSection === "qr-scanner" && sectionId !== "qr-scanner") {
            stopCameraScanner();
        }

        state.activeSection = sectionId;

        // Toggle section visibility
        document.querySelectorAll(".page-section").forEach((sec) => {
            if (sec.id === `section-${sectionId}`) {
                sec.classList.remove("hidden");
                sec.classList.add("active");
            } else {
                sec.classList.add("hidden");
                sec.classList.remove("active");
            }
        });

        // Update sidebar active button
        document.querySelectorAll(".nav-item").forEach((btn) => {
            if (btn.dataset.section === sectionId) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        // Close mobile sidebar if open
        closeMobileSidebar();

        // Refresh specific section views
        refreshAllViews();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function openMobileSidebar() {
        const sidebar = document.getElementById("app-sidebar");
        const backdrop = document.getElementById("sidebar-backdrop");
        const toggleBtn = document.getElementById("mobile-menu-toggle");
        if (sidebar) sidebar.classList.add("open");
        if (backdrop) backdrop.classList.remove("hidden");
        if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");
    }

    function closeMobileSidebar() {
        const sidebar = document.getElementById("app-sidebar");
        const backdrop = document.getElementById("sidebar-backdrop");
        const toggleBtn = document.getElementById("mobile-menu-toggle");
        if (sidebar) sidebar.classList.remove("open");
        if (backdrop) backdrop.classList.add("hidden");
        if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
    }

    function updateHeaderAndSessionUI() {
        const schoolName = state.settings.schoolName || "Smart School";
        const todayFriendly = formatFriendlyDate(getLocalDateString(0));

        const elIds = ["sidebar-school-name", "mobile-school-name"];
        elIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = schoolName;
        });

        const topSchool = document.getElementById("topbar-school-name");
        if (topSchool) topSchool.textContent = `🏫 ${schoolName}`;

        const homeBadge = document.getElementById("home-school-badge");
        if (homeBadge) homeBadge.textContent = `${schoolName} — Official Attendance Portal`;

        const topDate = document.getElementById("topbar-current-date");
        if (topDate) topDate.textContent = `📅 ${todayFriendly}`;

        const tdDate = document.getElementById("td-current-date");
        if (tdDate) tdDate.textContent = `📅 ${todayFriendly}`;

        // Session UI
        const dot = document.getElementById("sidebar-session-dot");
        const role = document.getElementById("sidebar-session-role");
        const user = document.getElementById("sidebar-session-user");
        const logoutBtn = document.getElementById("sidebar-logout-btn");
        const loginAlert = document.getElementById("login-active-session-alert");
        const loginUserSpan = document.getElementById("login-current-username");
        const tdTeacherName = document.getElementById("td-teacher-name");
        const tdGuestWarn = document.getElementById("td-guest-warning");

        if (state.teacherSession && state.teacherSession.username) {
            if (dot) dot.className = "session-dot status-teacher";
            if (role) role.textContent = "Teacher Logged In";
            if (user) user.textContent = state.teacherSession.username;
            if (logoutBtn) logoutBtn.classList.remove("hidden");
            if (loginAlert) loginAlert.classList.remove("hidden");
            if (loginUserSpan) loginUserSpan.textContent = state.teacherSession.username;
            if (tdTeacherName) tdTeacherName.textContent = state.teacherSession.username;
            if (tdGuestWarn) tdGuestWarn.classList.add("hidden");
        } else {
            if (dot) dot.className = "session-dot status-guest";
            if (role) role.textContent = "Visitor / Demo Mode";
            if (user) user.textContent = "Not logged in as teacher";
            if (logoutBtn) logoutBtn.classList.add("hidden");
            if (loginAlert) loginAlert.classList.add("hidden");
            if (tdTeacherName) tdTeacherName.textContent = "Demo Visitor";
            if (tdGuestWarn) tdGuestWarn.classList.remove("hidden");
        }
    }

    /**
     * Populates all class dropdown `<select>` elements across the application while preserving current selection
     */
    function syncClassSelectDropdowns() {
        const defaultCls = state.settings.defaultClassId || (state.classes[0] ? state.classes[0].id : "");

        // 1. Strict class selects (no "ALL" option)
        const strictIds = ["student-class-select", "td-class-select", "scanner-class-select", "setting-default-class"];
        strictIds.forEach((selectId) => {
            const sel = document.getElementById(selectId);
            if (!sel) return;
            const prevVal = sel.value;
            sel.innerHTML = "";

            if (state.classes.length === 0) {
                const opt = document.createElement("option");
                opt.value = "";
                opt.textContent = "No classes available — Add a class first";
                sel.appendChild(opt);
                return;
            }

            state.classes.forEach((c) => {
                const opt = document.createElement("option");
                opt.value = c.id;
                opt.textContent = c.name;
                sel.appendChild(opt);
            });

            if (prevVal && state.classes.some((c) => c.id === prevVal)) {
                sel.value = prevVal;
            } else if (state.classes.some((c) => c.id === defaultCls)) {
                sel.value = defaultCls;
            } else {
                sel.value = state.classes[0].id;
            }
        });

        // 2. Filter class selects (with "ALL" option)
        const filterIds = [
            { id: "student-filter-class", label: "All Classes" },
            { id: "qr-filter-class", label: "All Classes" },
            { id: "rec-filter-class", label: "All Classes" },
            { id: "rep-class-filter", label: "All Classes" },
            { id: "ai-context-class", label: "All Classes (School-Wide)" }
        ];

        filterIds.forEach(({ id, label }) => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const prev = sel.value || "ALL";
            sel.innerHTML = "";

            const allOpt = document.createElement("option");
            allOpt.value = "ALL";
            allOpt.textContent = label;
            sel.appendChild(allOpt);

            state.classes.forEach((c) => {
                const opt = document.createElement("option");
                opt.value = c.id;
                opt.textContent = c.name;
                sel.appendChild(opt);
            });

            if (prev === "ALL" || state.classes.some((c) => c.id === prev)) {
                sel.value = prev;
            } else {
                sel.value = "ALL";
            }
        });
    }

    // ========================================================================
    // 8. SECTION 1: HOME DASHBOARD RENDERING
    // ========================================================================

    function renderHomeDashboard() {
        const today = getLocalDateString(0);
        const stats = calculateSchoolDateStats(today);

        document.getElementById("home-total-classes").textContent = stats.totalClasses;
        document.getElementById("home-finalized-today").textContent = `${stats.finalizedClassesCount} / ${stats.totalClasses}`;

        document.getElementById("stat-total-students").textContent = stats.totalStudents;
        document.getElementById("stat-classes-subtext").textContent = `Across ${stats.totalClasses} registered ${stats.totalClasses === 1 ? "class" : "classes"}`;

        document.getElementById("stat-present-today").textContent = stats.presentToday;
        document.getElementById("stat-present-subtext").textContent = `Checked in on ${today}`;

        document.getElementById("stat-absent-today").textContent = stats.absentToday;
        document.getElementById("stat-absent-subtext").textContent =
            stats.finalizedClassesCount > 0
                ? `Across ${stats.finalizedClassesCount} finalized ${stats.finalizedClassesCount === 1 ? "class" : "classes"}`
                : "Finalize a class to compute absences";

        document.getElementById("stat-attendance-rate").textContent = `${stats.rate}%`;
        document.getElementById("stat-rate-subtext").textContent =
            stats.totalStudents > 0 ? `${stats.presentToday} of ${stats.totalStudents} students present` : "No students enrolled";

        // Recent Attendance Activity (latest 6 check-ins)
        const activityContainer = document.getElementById("home-recent-activity");
        activityContainer.innerHTML = "";

        if (state.attendance.length === 0) {
            activityContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h4>No Attendance Activity Yet</h4>
                    <p>Start the QR Scanner or use Manual Attendance to check in students.</p>
                </div>
            `;
        } else {
            const recent = state.attendance.slice(0, 6);
            recent.forEach((rec) => {
                const stu = findStudentById(rec.studentId);
                const stuName = stu ? stu.name : rec.studentId;
                const initials = stuName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();

                const item = document.createElement("div");
                item.className = "activity-item";
                item.innerHTML = `
                    <div class="activity-left">
                        <div class="activity-avatar">${escapeHtml(initials)}</div>
                        <div>
                            <p class="activity-name">${escapeHtml(stuName)} <code>${escapeHtml(rec.studentId)}</code></p>
                            <p class="activity-meta">${escapeHtml(getClassName(rec.classId))} • ${escapeHtml(rec.date)} at ${escapeHtml(rec.time)}</p>
                        </div>
                    </div>
                    <div>
                        <span class="badge badge-present">${escapeHtml(rec.method)} • Present</span>
                    </div>
                `;
                activityContainer.appendChild(item);
            });
        }

        // Home Overview Chart
        renderHomeOverviewChart(today);
    }

    function renderHomeOverviewChart(today) {
        const canvas = document.getElementById("homeAttendanceChart");
        const fallback = document.getElementById("home-chart-fallback");
        if (!canvas || !fallback) return;

        if (state.classes.length === 0) {
            fallback.textContent = "No classes registered yet. Add a class in the Admin Dashboard to view attendance charts.";
            if (state.charts.homeChart) {
                state.charts.homeChart.destroy();
                state.charts.homeChart = null;
            }
            return;
        }

        const labels = [];
        const presentData = [];
        const absentOrRemainingData = [];
        const textParts = [];

        state.classes.forEach((cls) => {
            const st = calculateClassDateStats(cls.id, today);
            labels.push(cls.name);
            presentData.push(st.presentCount);
            absentOrRemainingData.push(st.finalized ? st.absentCount : st.unmarkedCount);
            textParts.push(`${cls.name}: ${st.presentCount}/${st.total} Present (${st.rate}%)`);
        });

        fallback.textContent = `Today's Summary — ${textParts.join(" | ")}`;

        if (typeof window.Chart === "undefined") {
            return;
        }

        if (state.charts.homeChart) {
            state.charts.homeChart.destroy();
        }

        state.charts.homeChart = new window.Chart(canvas, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Present Today",
                        data: presentData,
                        backgroundColor: "#10b981",
                        borderRadius: 6
                    },
                    {
                        label: "Absent / Unmarked",
                        data: absentOrRemainingData,
                        backgroundColor: "#f87171",
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom" }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    }
                }
            }
        });
    }

    // ========================================================================
    // 9. SECTION 2: ADMIN DASHBOARD & CLASS MANAGEMENT
    // ========================================================================

    function renderAdminDashboard() {
        const summaryList = document.getElementById("admin-school-summary-list");
        if (summaryList) {
            summaryList.innerHTML = `
                <li><span>School Name:</span> <strong>${escapeHtml(state.settings.schoolName)}</strong></li>
                <li><span>Total Classes:</span> <strong>${state.classes.length}</strong></li>
                <li><span>Total Students:</span> <strong>${state.students.length}</strong></li>
                <li><span>Recorded Present Check-Ins:</span> <strong>${state.attendance.length}</strong></li>
                <li><span>Finalized Class Sessions:</span> <strong>${state.sessions.length}</strong></li>
            `;
        }

        const tbody = document.getElementById("classes-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (state.classes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; padding:1.5rem;">No classes registered yet. Create one using the form on the left.</td>
                </tr>
            `;
            return;
        }

        state.classes.forEach((cls) => {
            const enrolledCount = getStudentsByClass(cls.id).length;
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><code>${escapeHtml(cls.id)}</code></td>
                <td><strong>${escapeHtml(cls.name)}</strong></td>
                <td><span class="badge badge-blue">${enrolledCount} ${enrolledCount === 1 ? "student" : "students"}</span></td>
                <td>
                    <div class="table-actions">
                        <button type="button" class="btn btn-xs btn-outline" data-action="rename-class" data-id="${escapeHtml(cls.id)}">
                            Rename
                        </button>
                        <button type="button" class="btn btn-xs btn-outline-danger" data-action="delete-class" data-id="${escapeHtml(cls.id)}">
                            Delete
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function handleAddClassForm(e) {
        e.preventDefault();
        const input = document.getElementById("new-class-name");
        const errEl = document.getElementById("add-class-error");
        errEl.classList.add("hidden");

        const rawName = (input.value || "").trim();
        if (!rawName) {
            errEl.textContent = "Please enter a class name (e.g., Class 5-C).";
            errEl.classList.remove("hidden");
            return;
        }

        const duplicate = state.classes.some((c) => c.name.toLowerCase() === rawName.toLowerCase());
        if (duplicate) {
            errEl.textContent = `A class named "${rawName}" already exists.`;
            errEl.classList.remove("hidden");
            return;
        }

        const slug = rawName.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
        let classId = `CLASS_${slug || Date.now()}`;
        if (state.classes.some((c) => c.id === classId)) {
            classId = `${classId}_${Math.floor(Math.random() * 90 + 10)}`;
        }

        state.classes.push({ id: classId, name: rawName });
        saveAllData();
        input.value = "";
        syncClassSelectDropdowns();
        refreshAllViews();
        showToast(`Created "${rawName}" successfully!`, "success");
    }

    function promptRenameClass(classId) {
        const cls = findClassById(classId);
        if (!cls) return;

        openModal({
            title: `Rename ${cls.name}`,
            message: "Enter the updated name for this class:",
            confirmText: "Save Name",
            showInput: true,
            inputLabel: "New Class Name",
            inputValue: cls.name,
            onConfirm: (newVal, { showError }) => {
                if (!newVal) {
                    showError("Class name cannot be empty.");
                    return false;
                }
                const dup = state.classes.some(
                    (c) => c.id !== classId && c.name.toLowerCase() === newVal.toLowerCase()
                );
                if (dup) {
                    showError(`Another class already uses the name "${newVal}".`);
                    return false;
                }
                cls.name = newVal;
                saveAllData();
                syncClassSelectDropdowns();
                refreshAllViews();
                showToast(`Renamed class to "${newVal}".`, "success");
                return true;
            }
        });
    }

    function promptDeleteClass(classId) {
        const cls = findClassById(classId);
        if (!cls) return;

        const enrolled = getStudentsByClass(classId);
        if (enrolled.length > 0) {
            showToast(
                `Cannot delete "${cls.name}" because ${enrolled.length} student(s) are currently assigned to it. Reassign or remove those students first.`,
                "error"
            );
            return;
        }

        const hasHistory = state.attendance.some((r) => r.classId === classId);
        openModal({
            title: `Delete ${cls.name}?`,
            message: hasHistory
                ? `"${cls.name}" has no enrolled students, but historical attendance records exist. Deleting this class will also remove its empty session markers. Proceed?`
                : `Are you sure you want to delete "${cls.name}"?`,
            confirmText: "Delete Class",
            confirmClass: "btn-danger",
            onConfirm: () => {
                state.classes = state.classes.filter((c) => c.id !== classId);
                state.sessions = state.sessions.filter((s) => s.classId !== classId);
                saveAllData();
                syncClassSelectDropdowns();
                refreshAllViews();
                showToast(`Deleted "${cls.name}".`, "info");
            }
        });
    }

    // ========================================================================
    // 10. SECTION 3: STUDENT MANAGEMENT (REGISTRATION, EDIT, DELETE, TABLE)
    // ========================================================================

    function autoPopulateNextStudentIdAndRoll() {
        const editOrig = document.getElementById("edit-student-original-id");
        if (editOrig && editOrig.value) return; // Don't overwrite during edit mode

        const idInput = document.getElementById("student-id-input");
        if (idInput && !idInput.value.trim()) {
            idInput.value = generateNextStudentId();
        }

        const classSel = document.getElementById("student-class-select");
        const secInput = document.getElementById("student-section-input");
        const rollInput = document.getElementById("student-roll-input");

        if (classSel && rollInput && !rollInput.value) {
            const clsId = classSel.value;
            const secVal = (secInput ? secInput.value : "A").trim().toUpperCase() || "A";
            const existingInClassSec = state.students.filter(
                (s) => s.classId === clsId && s.section.toUpperCase() === secVal
            );
            const maxRoll = existingInClassSec.reduce((acc, s) => Math.max(acc, Number(s.rollNo) || 0), 0);
            rollInput.value = maxRoll + 1;
        }
    }

    function handleStudentFormSubmit(e) {
        e.preventDefault();
        const errEl = document.getElementById("student-form-error");
        errEl.classList.add("hidden");

        const editOriginalId = document.getElementById("edit-student-original-id").value.trim();
        const rawId = document.getElementById("student-id-input").value.trim().toUpperCase();
        const rawName = document.getElementById("student-name-input").value.trim();
        const classId = document.getElementById("student-class-select").value;
        const rawSection = document.getElementById("student-section-input").value.trim().toUpperCase();
        const rollVal = parseInt(document.getElementById("student-roll-input").value, 10);

        // Field validations
        if (!rawId || !/^[A-Z0-9_-]{2,20}$/.test(rawId)) {
            errEl.textContent = "Please enter a valid alphanumeric Student ID (e.g., STU013).";
            errEl.classList.remove("hidden");
            return;
        }
        if (!rawName || rawName.length < 2) {
            errEl.textContent = "Please enter the student's full name.";
            errEl.classList.remove("hidden");
            return;
        }
        if (!classId || !findClassById(classId)) {
            errEl.textContent = "Please select a valid class.";
            errEl.classList.remove("hidden");
            return;
        }
        if (!rawSection) {
            errEl.textContent = "Please enter a class section (e.g., A).";
            errEl.classList.remove("hidden");
            return;
        }
        if (isNaN(rollVal) || rollVal < 1 || rollVal > 999) {
            errEl.textContent = "Please enter a valid positive Roll Number (1–999).";
            errEl.classList.remove("hidden");
            return;
        }

        // Duplicate Student ID check
        const idConflict = state.students.find(
            (s) => s.id.toUpperCase() === rawId && s.id.toUpperCase() !== editOriginalId.toUpperCase()
        );
        if (idConflict) {
            errEl.textContent = `Student ID "${rawId}" is already assigned to ${idConflict.name}. Duplicate Student IDs are not allowed.`;
            errEl.classList.remove("hidden");
            return;
        }

        // Duplicate Roll Number within same Class and Section check
        const rollConflict = state.students.find(
            (s) =>
                s.classId === classId &&
                s.section.toUpperCase() === rawSection &&
                Number(s.rollNo) === rollVal &&
                s.id.toUpperCase() !== editOriginalId.toUpperCase()
        );
        if (rollConflict) {
            errEl.textContent = `Roll Number ${rollVal} in ${getClassName(classId)} (Section ${rawSection}) is already assigned to ${rollConflict.name}.`;
            errEl.classList.remove("hidden");
            return;
        }

        if (editOriginalId) {
            // Update existing student
            const stu = findStudentById(editOriginalId);
            if (stu) {
                const oldId = stu.id;
                stu.id = rawId;
                stu.name = rawName;
                stu.classId = classId;
                stu.section = rawSection;
                stu.rollNo = rollVal;

                // Keep historical attendance linked if ID or class changed
                state.attendance.forEach((rec) => {
                    if (rec.studentId.toUpperCase() === oldId.toUpperCase()) {
                        rec.studentId = rawId;
                    }
                });
            }
            resetStudentFormToRegisterMode();
            saveAllData();
            refreshAllViews();
            showToast(`Updated student record for ${rawName} (${rawId}).`, "success");
        } else {
            // Add new student
            state.students.push({
                id: rawId,
                name: rawName,
                classId,
                section: rawSection,
                rollNo: rollVal
            });
            resetStudentFormToRegisterMode();
            saveAllData();
            refreshAllViews();
            showToast(`Registered ${rawName} (${rawId}) in ${getClassName(classId)}!`, "success");
        }
    }

    function startEditStudent(studentId) {
        const stu = findStudentById(studentId);
        if (!stu) return;

        document.getElementById("edit-student-original-id").value = stu.id;
        document.getElementById("student-id-input").value = stu.id;
        document.getElementById("student-name-input").value = stu.name;
        document.getElementById("student-class-select").value = stu.classId;
        document.getElementById("student-section-input").value = stu.section;
        document.getElementById("student-roll-input").value = stu.rollNo;

        document.getElementById("student-form-title").innerHTML = `<i data-lucide="user-Check"></i> Edit Student: ${escapeHtml(stu.name)}`;
        document.getElementById("student-form-subtitle").textContent = `Updating record for ${stu.id}. Click "Update Student" when done.`;
        document.getElementById("student-submit-btn").innerHTML = `<i data-lucide="save"></i> Update Student`;
        document.getElementById("student-cancel-edit-btn").classList.remove("hidden");
        document.getElementById("student-form-error").classList.add("hidden");

        refreshIcons();
        document.getElementById("student-form-card").scrollIntoView({ behavior: "smooth" });
    }

    function resetStudentFormToRegisterMode() {
        const form = document.getElementById("student-registration-form");
        if (form) form.reset();
        document.getElementById("edit-student-original-id").value = "";
        document.getElementById("student-section-input").value = "A";
        document.getElementById("student-form-title").innerHTML = `<i data-lucide="user-plus"></i> Register New Student`;
        document.getElementById("student-form-subtitle").textContent = "Fill in the student details below. Student ID is auto-suggested.";
        document.getElementById("student-submit-btn").innerHTML = `<i data-lucide="check-circle-2"></i> Save Student`;
        document.getElementById("student-cancel-edit-btn").classList.add("hidden");
        document.getElementById("student-form-error").classList.add("hidden");

        autoPopulateNextStudentIdAndRoll();
        refreshIcons();
    }

    function promptDeleteStudent(studentId) {
        const stu = findStudentById(studentId);
        if (!stu) return;

        const recordCount = state.attendance.filter((r) => r.studentId === stu.id).length;
        const extraHtml =
            recordCount > 0
                ? `<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                       <input type="checkbox" id="delete-stu-records-checkbox" checked>
                       <span>Also delete ${recordCount} historical attendance record(s) for ${escapeHtml(stu.name)}</span>
                   </label>`
                : "";

        openModal({
            title: `Delete Student ${stu.name} (${stu.id})?`,
            message:
                recordCount > 0
                    ? `${stu.name} has ${recordCount} recorded attendance check-in(s). Choose below whether to remove their attendance records or keep them archived in logs:`
                    : `Are you sure you want to remove ${stu.name} (${stu.id}) from ${getClassName(stu.classId)}?`,
            confirmText: "Delete Student",
            confirmClass: "btn-danger",
            extraHtml,
            onConfirm: () => {
                const checkbox = document.getElementById("delete-stu-records-checkbox");
                const removeHistory = checkbox ? checkbox.checked : true;

                state.students = state.students.filter((s) => s.id !== stu.id);
                if (removeHistory) {
                    state.attendance = state.attendance.filter((r) => r.studentId !== stu.id);
                }
                if (document.getElementById("edit-student-original-id").value === stu.id) {
                    resetStudentFormToRegisterMode();
                }
                saveAllData();
                refreshAllViews();
                showToast(
                    `Deleted ${stu.name} (${stu.id})${removeHistory && recordCount > 0 ? " and associated attendance records" : ""}.`,
                    "info"
                );
            }
        });
    }

    function renderStudentsManagementTable() {
        const countBadge = document.getElementById("student-count-badge");
        if (countBadge) countBadge.textContent = state.students.length;

        const searchVal = (document.getElementById("student-search-input")?.value || "").trim().toLowerCase();
        const classFilter = document.getElementById("student-filter-class")?.value || "ALL";
        const sortBy = document.getElementById("student-sort-select")?.value || "id-asc";

        let list = state.students.filter((s) => {
            if (classFilter !== "ALL" && s.classId !== classFilter) return false;
            if (searchVal) {
                const hay = `${s.id} ${s.name} ${getClassName(s.classId)}`.toLowerCase();
                if (!hay.includes(searchVal)) return false;
            }
            return true;
        });

        list.sort((a, b) => {
            if (sortBy === "name-asc") return a.name.localeCompare(b.name);
            if (sortBy === "name-desc") return b.name.localeCompare(a.name);
            if (sortBy === "roll-asc") return (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0);
            return a.id.localeCompare(b.id);
        });

        const tbody = document.getElementById("students-table-body");
        const emptyState = document.getElementById("students-empty-state");
        if (!tbody || !emptyState) return;

        tbody.innerHTML = "";
        if (list.length === 0) {
            emptyState.classList.remove("hidden");
            return;
        }
        emptyState.classList.add("hidden");

        list.forEach((stu) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><code>${escapeHtml(stu.id)}</code></td>
                <td><strong>${escapeHtml(stu.name)}</strong></td>
                <td><span class="badge badge-blue">${escapeHtml(getClassName(stu.classId))}</span></td>
                <td>${escapeHtml(stu.section)}</td>
                <td>${escapeHtml(stu.rollNo)}</td>
                <td>
                    <button type="button" class="btn btn-xs btn-outline" data-action="view-student-qr" data-id="${escapeHtml(stu.id)}">
                        🪪 View QR Badge
                    </button>
                </td>
                <td>
                    <div class="table-actions">
                        <button type="button" class="btn btn-xs btn-emerald" data-action="print-single-card" data-id="${escapeHtml(stu.id)}" title="Print ID Card">
                            Print ID Card
                        </button>
                        <button type="button" class="btn btn-xs btn-outline" data-action="edit-student" data-id="${escapeHtml(stu.id)}">
                            Edit
                        </button>
                        <button type="button" class="btn btn-xs btn-outline-danger" data-action="delete-student" data-id="${escapeHtml(stu.id)}">
                            Delete
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ========================================================================
    // 11. SECTION 4: QR CODE GENERATOR & PRINTABLE STUDENT ID CARDS
    // ========================================================================

    /**
     * Renders a QR code into a container element using QRCode.js.
     * Provides a clean deterministic visual matrix fallback if offline/CDN blocked.
     */
    function renderQrCodeIntoElement(containerEl, codeText, size = 132) {
        if (!containerEl) return;
        containerEl.innerHTML = "";
        const safeCode = String(codeText || "").trim();
        if (!safeCode) {
            containerEl.textContent = "Invalid ID";
            return;
        }

        if (typeof window.QRCode === "function") {
            try {
                new window.QRCode(containerEl, {
                    text: safeCode,
                    width: size,
                    height: size,
                    colorDark: "#0f172a",
                    colorLight: "#ffffff",
                    correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0
                });
                return;
            } catch (err) {
                console.warn("QRCode.js error, using SVG fallback:", err);
            }
        }

        // Offline fallback badge if QRCode.js CDN failed to load
        containerEl.innerHTML = `
            <div style="width:${size}px;height:${size}px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid #0f172a;padding:8px;font-family:monospace;font-size:12px;text-align:center;">
                <strong>QR:${escapeHtml(safeCode)}</strong>
                <span style="font-size:10px;color:#64748b;">(Offline Mode)</span>
            </div>
        `;
    }

    function syncQrStudentDropdown() {
        const classSel = document.getElementById("qr-filter-class");
        const stuSel = document.getElementById("qr-filter-student");
        if (!classSel || !stuSel) return;

        const selectedClass = classSel.value || "ALL";
        const prevStu = stuSel.value || "ALL";
        const students = getStudentsByClass(selectedClass);

        stuSel.innerHTML = `<option value="ALL">Show All Students in Selected Class (${students.length})</option>`;
        students.forEach((s) => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = `${s.id} — ${s.name} (Roll ${s.rollNo})`;
            stuSel.appendChild(opt);
        });

        if (prevStu !== "ALL" && students.some((s) => s.id === prevStu)) {
            stuSel.value = prevStu;
        } else {
            stuSel.value = "ALL";
        }
    }

    /**
     * Builds a Student ID Card DOM element matching Section 8 specifications
     */
    function createStudentIdCardElement(student, includeButtons = true) {
        const schoolName = (state.settings.schoolName || "SMART SCHOOL").toUpperCase();
        const className = getClassName(student.classId).replace(/^Class\s+/i, "");

        const card = document.createElement("div");
        card.className = "student-id-card";
        card.dataset.studentId = student.id;

        card.innerHTML = `
            <div class="id-card-banner">
                <div class="id-card-school">${escapeHtml(schoolName)}</div>
                <div class="id-card-subtitle">OFFICIAL STUDENT ATTENDANCE ID CARD</div>
            </div>
            <div class="id-card-body">
                <div class="id-card-details">
                    <div class="id-card-row"><span>Student Name:</span> <strong>${escapeHtml(student.name)}</strong></div>
                    <div class="id-card-row"><span>Class:</span> <strong>${escapeHtml(className)} (Sec ${escapeHtml(student.section)})</strong></div>
                    <div class="id-card-row"><span>Roll Number:</span> <strong>${escapeHtml(student.rollNo)}</strong></div>
                </div>
                <div class="id-card-qr-box" id="qr-box-${escapeHtml(student.id)}-${Math.random().toString(36).substring(2, 7)}"></div>
                <div class="id-card-code-pill">Student ID: ${escapeHtml(student.id)}</div>
            </div>
            ${
                includeButtons
                    ? `<div class="id-card-actions no-print">
                           <button type="button" class="btn btn-xs btn-emerald" data-action="print-single-card" data-id="${escapeHtml(student.id)}">
                               🖨️ Print Card
                           </button>
                           <button type="button" class="btn btn-xs btn-outline" data-action="regen-single-qr" data-id="${escapeHtml(student.id)}">
                               🔄 Regenerate QR
                           </button>
                       </div>`
                    : ""
            }
        `;

        const qrBox = card.querySelector(".id-card-qr-box");
        renderQrCodeIntoElement(qrBox, student.id, 132);
        return card;
    }

    function renderQrGeneratorSection() {
        const grid = document.getElementById("qr-cards-grid");
        const emptyState = document.getElementById("qr-empty-state");
        if (!grid || !emptyState) return;

        const classVal = document.getElementById("qr-filter-class")?.value || "ALL";
        const stuVal = document.getElementById("qr-filter-student")?.value || "ALL";

        let list = getStudentsByClass(classVal);
        if (stuVal !== "ALL") {
            list = list.filter((s) => s.id === stuVal);
        }

        grid.innerHTML = "";
        if (list.length === 0) {
            emptyState.classList.remove("hidden");
            return;
        }
        emptyState.classList.add("hidden");

        list.forEach((student) => {
            if (!student || !student.id || !student.name) return; // Graceful handling of invalid student record
            const cardEl = createStudentIdCardElement(student, true);
            grid.appendChild(cardEl);
        });
    }

    /**
     * Prints one or multiple Student ID cards cleanly using #print-staging-area
     */
    function printStudentIdCards(studentsList) {
        if (!Array.isArray(studentsList) || studentsList.length === 0) {
            showToast("No student ID cards selected to print.", "warning");
            return;
        }

        const staging = document.getElementById("print-staging-area");
        staging.innerHTML = `
            <div class="print-sheet-header">
                <h2>${escapeHtml(state.settings.schoolName)} — Student QR ID Cards (${studentsList.length})</h2>
                <p>Generated on ${escapeHtml(formatFriendlyDate(getLocalDateString(0)))}</p>
            </div>
            <div class="print-cards-grid" id="print-cards-container"></div>
        `;

        const container = document.getElementById("print-cards-container");
        studentsList.forEach((stu) => {
            const card = createStudentIdCardElement(stu, false);
            container.appendChild(card);
        });

        // Allow QRCode.js canvas/img a brief tick to render before invoking browser print
        setTimeout(() => {
            window.print();
        }, 180);
    }

    // ========================================================================
    // 12. SECTION 5 & 6: TEACHER LOGIN & TEACHER DASHBOARD
    // ========================================================================

    function handleTeacherLogin(e) {
        e.preventDefault();
        const userIn = document.getElementById("teacher-username");
        const passIn = document.getElementById("teacher-password");
        const errEl = document.getElementById("teacher-login-error");
        errEl.classList.add("hidden");

        const username = (userIn.value || "").trim();
        const password = passIn.value || "";

        if (!username || !password) {
            errEl.textContent = "Please enter both your teacher username and password.";
            errEl.classList.remove("hidden");
            return;
        }

        const matched = DEMO_TEACHERS.find(
            (t) => t.username.toLowerCase() === username.toLowerCase() && t.password === password
        );

        if (!matched) {
            errEl.textContent = "Invalid username or password. Please use the demo credentials shown below (teacher1 / teach123 or teacher2 / teach456).";
            errEl.classList.remove("hidden");
            showToast("Login failed: Invalid demo credentials.", "error");
            return;
        }

        state.teacherSession = {
            username: matched.username,
            displayName: matched.displayName,
            loginTime: getCurrentTimeFormatted()
        };

        try {
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state.teacherSession));
        } catch (err) {
            console.warn("sessionStorage unavailable:", err);
        }

        passIn.value = "";
        updateHeaderAndSessionUI();
        showToast(`Welcome, ${matched.username}! Redirecting to Teacher Dashboard...`, "success");
        navigateToSection("teacher-dashboard");
    }

    function handleTeacherLogout() {
        stopCameraScanner();
        state.teacherSession = null;
        try {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } catch (e) {
            // ignore
        }
        updateHeaderAndSessionUI();
        showToast("You have been logged out of the Teacher Portal.", "info");
        navigateToSection("teacher-login");
    }

    function renderTeacherDashboard() {
        const classSel = document.getElementById("td-class-select");
        const dateIn = document.getElementById("td-date-input");
        if (!classSel || !dateIn) return;

        if (!dateIn.value) {
            dateIn.value = getLocalDateString(0);
        }

        const selectedClassId = classSel.value;
        const selectedDate = dateIn.value || getLocalDateString(0);
        const cStats = calculateClassDateStats(selectedClassId, selectedDate);
        const className = getClassName(selectedClassId);

        document.getElementById("td-stat-total").textContent = cStats.total;
        document.getElementById("td-stat-class-label").textContent = className;
        document.getElementById("td-stat-present").textContent = cStats.presentCount;
        document.getElementById("td-stat-absent").textContent = cStats.finalized ? cStats.absentCount : cStats.unmarkedCount;
        document.getElementById("td-stat-absent-note").textContent = cStats.finalized
            ? "Finalized absences"
            : "Unmarked (Session open)";
        document.getElementById("td-stat-rate").textContent = `${cStats.rate}%`;

        // Session status strip
        const strip = document.getElementById("td-session-status-strip");
        if (strip) {
            if (cStats.finalized) {
                const ses = getFinalizedSession(selectedClassId, selectedDate);
                strip.className = "session-status-strip strip-finalized";
                strip.innerHTML = `
                    <span>✅ <strong>Session Finalized:</strong> ${escapeHtml(className)} on ${escapeHtml(selectedDate)} (at ${escapeHtml(ses?.finalizedAt || "")}) — ${cStats.presentCount} Present, ${cStats.absentCount} Absent.</span>
                    <button type="button" class="btn btn-xs btn-outline" id="td-reopen-session-btn">Reopen Session for Edits</button>
                `;
                const reopenBtn = document.getElementById("td-reopen-session-btn");
                if (reopenBtn) {
                    reopenBtn.onclick = () => reopenClassSession(selectedClassId, selectedDate);
                }
            } else {
                strip.className = "session-status-strip strip-open";
                strip.innerHTML = `
                    <span>🟢 <strong>Attendance Session Open:</strong> ${escapeHtml(className)} on ${escapeHtml(selectedDate)} (${cStats.presentCount} of ${cStats.total} checked in). Click "Finalize Class Attendance" when finished.</span>
                `;
            }
        }

        // Recently scanned students in selected class & date
        const recentList = document.getElementById("td-recent-scans-list");
        if (recentList) {
            const recs = state.attendance.filter(
                (r) => r.classId === selectedClassId && r.date === selectedDate && r.status === "Present"
            );
            recentList.innerHTML = "";
            if (recs.length === 0) {
                recentList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📷</div>
                        <h4>No Students Checked In Yet for ${escapeHtml(className)} (${escapeHtml(selectedDate)})</h4>
                        <p>Click "Start QR Scanner" or "Manual Attendance" above to take roll call.</p>
                    </div>
                `;
            } else {
                recs.forEach((rec) => {
                    const stu = findStudentById(rec.studentId);
                    const stuName = stu ? stu.name : rec.studentId;
                    const row = document.createElement("div");
                    row.className = "activity-item";
                    row.innerHTML = `
                        <div class="activity-left">
                            <div class="activity-avatar">✓</div>
                            <div>
                                <p class="activity-name">${escapeHtml(stuName)} <code>${escapeHtml(rec.studentId)}</code> (Roll ${escapeHtml(stu ? stu.rollNo : "-")})</p>
                                <p class="activity-meta">Checked in at ${escapeHtml(rec.time)} via <strong>${escapeHtml(rec.method)}</strong></p>
                            </div>
                        </div>
                        <span class="badge badge-present">PRESENT</span>
                    `;
                    recentList.appendChild(row);
                });
            }
        }
    }

    // ========================================================================
    // 13. SECTION 7: QR CODE SCANNER (html5-qrcode) & MANUAL ATTENDANCE
    // ========================================================================

    function renderScannerAndManualSection() {
        const classSel = document.getElementById("scanner-class-select");
        const dateIn = document.getElementById("scanner-date-input");
        if (!classSel || !dateIn) return;

        if (!dateIn.value) {
            dateIn.value = getLocalDateString(0);
        }

        const selectedClassId = classSel.value;
        const selectedDate = dateIn.value || getLocalDateString(0);
        const cStats = calculateClassDateStats(selectedClassId, selectedDate);
        const className = getClassName(selectedClassId);

        // Progress bar
        document.getElementById("scanner-progress-label").textContent = `${className} (${selectedDate})`;
        document.getElementById("scanner-progress-Text").textContent = `${cStats.presentCount} / ${cStats.total} Present (${cStats.rate}%)`;
        document.getElementById("scanner-progress-fill").style.width = `${cStats.rate}%`;

        // Session banner
        const banner = document.getElementById("scanner-session-banner");
        if (banner) {
            if (cStats.finalized) {
                banner.className = "session-status-strip strip-finalized";
                banner.innerHTML = `
                    <span>✅ Session Finalized for <strong>${escapeHtml(className)}</strong> (${escapeHtml(selectedDate)}): ${cStats.presentCount} Present, ${cStats.absentCount} Absent.</span>
                    <button type="button" class="btn btn-xs btn-outline" id="scanner-reopen-btn">Reopen Session</button>
                `;
                const btn = document.getElementById("scanner-reopen-btn");
                if (btn) btn.onclick = () => reopenClassSession(selectedClassId, selectedDate);
            } else {
                banner.className = "session-status-strip strip-open";
                banner.innerHTML = `
                    <span>🟢 Taking attendance for <strong>${escapeHtml(className)}</strong> on <strong>${escapeHtml(selectedDate)}</strong> (${cStats.unmarkedCount} remaining).</span>
                `;
            }
        }

        // Populate Simulator dropdown with helpful classroom test cases
        const simSelect = document.getElementById("sim-student-select");
        if (simSelect) {
            const prevSim = simSelect.value;
            simSelect.innerHTML = "";

            const classStudents = getStudentsByClass(selectedClassId);
            const otherStudents = state.students.filter((s) => s.classId !== selectedClassId);

            if (classStudents.length > 0) {
                const grp1 = document.createElement("optgroup");
                grp1.label = `Students in ${className} (Valid for this class)`;
                classStudents.forEach((s) => {
                    const already = findAttendanceRecord(s.id, selectedClassId, selectedDate);
                    const opt = document.createElement("option");
                    opt.value = s.id;
                    opt.textContent = `${s.id} — ${s.name} (Roll ${s.rollNo}) ${already ? "[Already Present]" : "[Not Scanned Yet]"}`;
                    grp1.appendChild(opt);
                });
                simSelect.appendChild(grp1);
            }

            if (otherStudents.length > 0) {
                const grp2 = document.createElement("optgroup");
                grp2.label = "Students in Other Classes (Tests Wrong-Class Rejection)";
                otherStudents.slice(0, 3).forEach((s) => {
                    const opt = document.createElement("option");
                    opt.value = s.id;
                    opt.textContent = `${s.id} — ${s.name} (${getClassName(s.classId)})`;
                    grp2.appendChild(opt);
                });
                simSelect.appendChild(grp2);
            }

            const grp3 = document.createElement("optgroup");
            grp3.label = "Error Handling Test Cases";
            const unknownOpt = document.createElement("option");
            unknownOpt.value = "STU999";
            unknownOpt.textContent = "STU999 — Unknown Student ID Test";
            grp3.appendChild(unknownOpt);

            const invalidOpt = document.createElement("option");
            invalidOpt.value = "http://invalid-qr-content!!";
            invalidOpt.textContent = "Invalid QR Payload Test";
            grp3.appendChild(invalidOpt);
            simSelect.appendChild(grp3);

            if (prevSim && Array.from(simSelect.options).some((o) => o.value === prevSim)) {
                simSelect.value = prevSim;
            }
        }

        // Render Manual Attendance Roster Table
        renderManualRosterTable(selectedClassId, selectedDate);
    }

    /**
     * Displays the structured scan verification result card (Section 11)
     */
    function displayScanResultCard(result) {
        const box = document.getElementById("scan-result-container");
        const scanAgainBtn = document.getElementById("btn-scan-again");
        if (!box) return;

        if (scanAgainBtn) {
            scanAgainBtn.classList.remove("hidden");
        }

        if (result.ok) {
            const stu = result.student;
            const rec = result.record;
            const shortClass = getClassName(stu.classId).replace(/^Class\s+/i, "");

            box.className = "scan-result-box result-success";
            box.innerHTML = `
                <div class="result-icon">✅</div>
                <h4 class="result-heading">ATTENDANCE MARKED SUCCESSFULLY</h4>
                <div class="result-details-list">
                    <p><span>Student:</span> <strong>${escapeHtml(stu.name)}</strong></p>
                    <p><span>Student ID:</span> <strong>${escapeHtml(stu.id)}</strong></p>
                    <p><span>Class:</span> <strong>${escapeHtml(shortClass)}</strong></p>
                    <p><span>Roll Number:</span> <strong>${escapeHtml(stu.rollNo)}</strong></p>
                    <p><span>Status:</span> <strong style="color:#059669;">PRESENT</strong></p>
                    <p><span>Time:</span> <strong>${escapeHtml(rec.time)}</strong></p>
                </div>
            `;
            showToast(`Marked ${stu.name} (${stu.id}) Present!`, "success");
        } else if (result.code === "DUPLICATE") {
            const stu = result.student;
            const rec = result.record;
            box.className = "scan-result-box result-warning";
            box.innerHTML = `
                <div class="result-icon">⚠️</div>
                <h4 class="result-heading">This student has already been marked present.</h4>
                <p class="result-message">${escapeHtml(stu.name)} (<code>${escapeHtml(stu.id)}</code>) was already checked in at ${escapeHtml(rec.time)} via ${escapeHtml(rec.method)}.</p>
            `;
            showToast("This student has already been marked present.", "warning");
        } else {
            box.className = "scan-result-box result-error";
            box.innerHTML = `
                <div class="result-icon">❌</div>
                <h4 class="result-heading">Scan Rejected</h4>
                <p class="result-message">${escapeHtml(result.message)}</p>
            `;
            showToast(result.message, "error");
        }
    }

    /**
     * Processes a scanned QR string with cooldown lock to prevent rapid duplicate firing
     */
    function handleDecodedQrScan(decodedText) {
        const now = Date.now();
        if (state.scanLock) return;
        if (decodedText === state.lastScannedCode && now - state.lastScannedTime < 2500) {
            return;
        }

        state.scanLock = true;
        state.lastScannedCode = decodedText;
        state.lastScannedTime = now;

        const selectedClassId = document.getElementById("scanner-class-select")?.value;
        const selectedDate = document.getElementById("scanner-date-input")?.value;

        const result = recordStudentAttendance({
            studentId: decodedText,
            selectedClassId,
            dateStr: selectedDate,
            method: "QR"
        });

        displayScanResultCard(result);
        refreshAllViews();

        setTimeout(() => {
            state.scanLock = false;
        }, 1200);
    }

    /**
     * Starts the physical camera QR scanner using html5-qrcode
     */
    async function startCameraScanner() {
        const selectedClassId = document.getElementById("scanner-class-select")?.value;
        const selectedDate = document.getElementById("scanner-date-input")?.value;

        if (!selectedClassId) {
            showToast("Please select a class before starting the camera scanner.", "warning");
            return;
        }
        if (!selectedDate) {
            showToast("Please select a valid attendance date.", "warning");
            return;
        }
        if (typeof window.Html5Qrcode === "undefined") {
            displayScanResultCard({
                ok: false,
                code: "LIBRARY_ERROR",
                message: "The html5-qrcode camera library failed to load from the CDN. Check your internet connection or use the Classroom Demo QR Simulator below."
            });
            return;
        }

        if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
            displayScanResultCard({
                ok: false,
                code: "INSECURE_CONTEXT",
                message: "Browser camera access requires running via http://localhost or HTTPS. Opening index.html directly via file:// blocks webcam access. Use a local server or the Demo QR Simulator."
            });
            return;
        }

        const statusBadge = document.getElementById("scanner-status-badge");
        const placeholder = document.getElementById("qr-reader-placeholder");
        const startBtn = document.getElementById("btn-start-camera");
        const stopBtn = document.getElementById("btn-stop-camera");
        const switchBtn = document.getElementById("btn-switch-camera");

        try {
            if (statusBadge) {
                statusBadge.textContent = "Requesting Camera...";
                statusBadge.className = "badge badge-amber";
            }

            const cameras = await window.Html5Qrcode.getCameras();
            state.availableCameras = cameras || [];

            if (!state.availableCameras.length) {
                throw new Error("NO_CAMERA_FOUND");
            }

            if (!state.html5QrCode) {
                state.html5QrCode = new window.Html5Qrcode("qr-reader");
            }

            if (placeholder) placeholder.classList.add("hidden");

            const cameraId = state.availableCameras[state.currentCameraIndex % state.availableCameras.length].id;

            await state.html5QrCode.start(
                cameraId,
                { fps: 10, qrbox: { width: 220, height: 220 } },
                (decodedText) => {
                    handleDecodedQrScan(decodedText);
                },
                () => {
                    // Frame scan error (no QR in frame yet) — ignore quietly
                }
            );

            state.isCameraRunning = true;
            if (statusBadge) {
                statusBadge.textContent = "Camera Active";
                statusBadge.className = "badge badge-emerald";
            }
            if (startBtn) startBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = false;
            if (switchBtn) switchBtn.disabled = state.availableCameras.length < 2;

            showToast("Camera started! Hold a student QR card in front of the lens.", "info");
        } catch (err) {
            console.warn("Camera start issue:", err);
            state.isCameraRunning = false;
            if (placeholder) placeholder.classList.remove("hidden");
            if (statusBadge) {
                statusBadge.textContent = "Camera Unavailable";
                statusBadge.className = "badge badge-danger";
            }
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            if (switchBtn) switchBtn.disabled = true;

            const errStr = String(err || "");
            let friendlyMsg =
                "Could not access a camera on this device. Please ensure camera permission is allowed in your browser address bar, or use the Classroom Demo QR Simulator or Manual Attendance below.";
            if (errStr.includes("NotAllowedError") || errStr.includes("Permission")) {
                friendlyMsg =
                    "Camera permission was denied. To resolve this: click the lock/camera icon in your browser's address bar, set Camera to 'Allow', and click Start Scanner again.";
            } else if (errStr.includes("NO_CAMERA_FOUND") || errStr.includes("NotFoundError")) {
                friendlyMsg =
                    "No compatible camera was detected on this device. You can test scanning using the Classroom Demo QR Simulator or mark students via Manual Attendance below.";
            }

            displayScanResultCard({
                ok: false,
                code: "CAMERA_ERROR",
                message: friendlyMsg
            });
        }
    }

    /**
     * Stops the camera scanner safely when requested, leaving the page, or logging out
     */
    async function stopCameraScanner() {
        const statusBadge = document.getElementById("scanner-status-badge");
        const placeholder = document.getElementById("qr-reader-placeholder");
        const startBtn = document.getElementById("btn-start-camera");
        const stopBtn = document.getElementById("btn-stop-camera");
        const switchBtn = document.getElementById("btn-switch-camera");

        if (state.html5QrCode && state.isCameraRunning) {
            try {
                await state.html5QrCode.stop();
                await state.html5QrCode.clear();
            } catch (e) {
                console.warn("Stop scanner cleanup note:", e);
            }
        }

        state.isCameraRunning = false;
        if (placeholder) placeholder.classList.remove("hidden");
        if (statusBadge) {
            statusBadge.textContent = "Camera Idle";
            statusBadge.className = "badge badge-gray";
        }
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (switchBtn) switchBtn.disabled = true;
    }

    async function switchCamera() {
        if (!state.availableCameras || state.availableCameras.length < 2) return;
        state.currentCameraIndex = (state.currentCameraIndex + 1) % state.availableCameras.length;
        await stopCameraScanner();
        await startCameraScanner();
    }

    /**
     * Renders the Manual Attendance backup table (Section 12)
     */
    function renderManualRosterTable(classId, dateStr) {
        const tbody = document.getElementById("manual-roster-tbody");
        if (!tbody) return;

        const searchQ = (document.getElementById("manual-search-input")?.value || "").trim().toLowerCase();
        const finalized = isSessionFinalized(classId, dateStr);
        let roster = getStudentsByClass(classId).sort((a, b) => (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0));

        if (searchQ) {
            roster = roster.filter((s) => `${s.id} ${s.name}`.toLowerCase().includes(searchQ));
        }

        tbody.innerHTML = "";
        if (roster.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:1.5rem;">No students found in this class matching your search.</td>
                </tr>
            `;
            return;
        }

        roster.forEach((stu) => {
            const presentRec = findAttendanceRecord(stu.id, classId, dateStr);
            const tr = document.createElement("tr");

            let statusBadgeHtml = `<span class="badge badge-gray">Unmarked</span>`;
            if (presentRec) {
                statusBadgeHtml = `<span class="badge badge-present">Present</span>`;
            } else if (finalized) {
                statusBadgeHtml = `<span class="badge badge-absent">Absent (Finalized)</span>`;
            }

            const timeMethodText = presentRec
                ? `${presentRec.time} (${presentRec.method})`
                : finalized
                ? "Marked Absent on Finalize"
                : "Not checked in yet";

            const actionBtnHtml = presentRec
                ? `<button type="button" class="btn btn-xs btn-outline-danger" data-action="undo-attendance" data-record-id="${escapeHtml(presentRec.id)}" data-stu-name="${escapeHtml(stu.name)}">
                       Undo Present
                   </button>`
                : `<button type="button" class="btn btn-xs btn-emerald" data-action="mark-manual-present" data-stu-id="${escapeHtml(stu.id)}">
                       ✓ Mark Present (Manual)
                   </button>`;

            tr.innerHTML = `
                <td><strong>#${escapeHtml(stu.rollNo)}</strong></td>
                <td><code>${escapeHtml(stu.id)}</code></td>
                <td><strong>${escapeHtml(stu.name)}</strong></td>
                <td>${escapeHtml(getClassName(stu.classId))} (${escapeHtml(stu.section)})</td>
                <td>${statusBadgeHtml}</td>
                <td>${escapeHtml(timeMethodText)}</td>
                <td>${actionBtnHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function promptUndoAttendanceRecord(recordId, studentName) {
        const rec = state.attendance.find((r) => r.id === recordId);
        if (!rec) return;

        openModal({
            title: "Undo Attendance Marking?",
            message: `Are you sure you want to remove the Present attendance record for ${studentName || rec.studentId} on ${rec.date} (${rec.time})?`,
            confirmText: "Remove Record",
            confirmClass: "btn-danger",
            onConfirm: () => {
                state.attendance = state.attendance.filter((r) => r.id !== recordId);
                saveAllData();
                refreshAllViews();
                showToast(`Removed attendance entry for ${studentName || rec.studentId}.`, "info");
            }
        });
    }

    // ========================================================================
    // 14. SECTION 8: ATTENDANCE RECORDS TABLE & FILTERS
    // ========================================================================

    function renderAttendanceRecordsSection() {
        const dateFilter = document.getElementById("rec-filter-date")?.value || "";
        const classFilter = document.getElementById("rec-filter-class")?.value || "ALL";
        const statusFilter = document.getElementById("rec-filter-status")?.value || "ALL";
        const methodFilter = document.getElementById("rec-filter-method")?.value || "ALL";
        const searchQ = document.getElementById("rec-search-input")?.value || "";

        const rows = getUnifiedAttendanceRows({
            startDate: dateFilter || null,
            endDate: dateFilter || null,
            classId: classFilter,
            status: statusFilter,
            method: methodFilter,
            searchQuery: searchQ
        });

        const showingEl = document.getElementById("records-showing-count");
        if (showingEl) {
            showingEl.textContent = `Showing ${rows.length} attendance ${rows.length === 1 ? "record" : "records"}${dateFilter ? ` for ${dateFilter}` : " across all dates"}`;
        }

        const tbody = document.getElementById("records-table-body");
        const emptyState = document.getElementById("records-empty-state");
        if (!tbody || !emptyState) return;

        tbody.innerHTML = "";
        if (rows.length === 0) {
            emptyState.classList.remove("hidden");
            return;
        }
        emptyState.classList.add("hidden");

        rows.forEach((row) => {
            const tr = document.createElement("tr");
            const statusBadge =
                row.status === "Present"
                    ? `<span class="badge badge-present">Present</span>`
                    : `<span class="badge badge-absent">Absent</span>`;

            const methodBadge =
                row.method === "QR"
                    ? `<span class="badge badge-blue">📷 QR Scan</span>`
                    : row.method === "Manual"
                    ? `<span class="badge badge-indigo">✍️ Manual</span>`
                    : `<span class="badge badge-amber">📋 Finalized Session</span>`;

            const actionHtml = row.isSyntheticAbsent
                ? `<button type="button" class="btn btn-xs btn-outline" data-action="convert-absent-to-present" data-stu-id="${escapeHtml(row.studentId)}" data-class-id="${escapeHtml(row.classId)}" data-date="${escapeHtml(row.date)}">
                       Mark Present
                   </button>`
                : `<button type="button" class="btn btn-xs btn-outline-danger" data-action="undo-attendance" data-record-id="${escapeHtml(row.recordId)}" data-stu-name="${escapeHtml(row.studentName)}">
                       Remove
                   </button>`;

            tr.innerHTML = `
                <td>${escapeHtml(row.date)}</td>
                <td><code>${escapeHtml(row.studentId)}</code></td>
                <td><strong>${escapeHtml(row.studentName)}</strong></td>
                <td>${escapeHtml(row.className)}</td>
                <td>${escapeHtml(row.rollNo)}</td>
                <td>${statusBadge}</td>
                <td>${methodBadge}</td>
                <td>${escapeHtml(row.time)}</td>
                <td>${escapeHtml(row.teacher)}</td>
                <td>${actionHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ========================================================================
    // 15. SECTION 9: ATTENDANCE REPORTS, CHARTS, CSV EXPORT & PRINT
    // ========================================================================

    function getReportDateFilterBounds() {
        const mode = document.getElementById("rep-date-mode")?.value || "today";
        const today = getLocalDateString(0);

        const singleWrap = document.getElementById("rep-single-date-wrap");
        const startWrap = document.getElementById("rep-start-date-wrap");
        const endWrap = document.getElementById("rep-end-date-wrap");

        const singleInput = document.getElementById("rep-single-date");
        const startInput = document.getElementById("rep-start-date");
        const endInput = document.getElementById("rep-end-date");

        if (singleInput && !singleInput.value) singleInput.value = today;
        if (startInput && !startInput.value) startInput.value = getLocalDateString(-7);
        if (endInput && !endInput.value) endInput.value = today;

        if (mode === "today") {
            singleWrap?.classList.add("hidden");
            startWrap?.classList.add("hidden");
            endWrap?.classList.add("hidden");
            return { startDate: today, endDate: today, label: `Today (${today})` };
        }
        if (mode === "single") {
            singleWrap?.classList.remove("hidden");
            startWrap?.classList.add("hidden");
            endWrap?.classList.add("hidden");
            const d = singleInput?.value || today;
            return { startDate: d, endDate: d, label: `Date: ${d}` };
        }
        if (mode === "range") {
            singleWrap?.classList.add("hidden");
            startWrap?.classList.remove("hidden");
            endWrap?.classList.remove("hidden");
            let s = startInput?.value || getLocalDateString(-7);
            let e = endInput?.value || today;
            if (s > e) {
                const tmp = s;
                s = e;
                e = tmp;
            }
            return { startDate: s, endDate: e, label: `${s} to ${e}` };
        }

        // mode === "all"
        singleWrap?.classList.add("hidden");
        startWrap?.classList.add("hidden");
        endWrap?.classList.add("hidden");
        return { startDate: null, endDate: null, label: "All Recorded Dates" };
    }

    function renderReportsSection() {
        const bounds = getReportDateFilterBounds();
        const classFilter = document.getElementById("rep-class-filter")?.value || "ALL";
        const targetClasses = classFilter === "ALL" ? state.classes : state.classes.filter((c) => c.id === classFilter);
        const targetStudents = getStudentsByClass(classFilter);

        // Finalized sessions in period
        const matchingSessions = state.sessions.filter((ses) => {
            if (bounds.startDate && ses.date < bounds.startDate) return false;
            if (bounds.endDate && ses.date > bounds.endDate) return false;
            if (classFilter !== "ALL" && ses.classId !== classFilter) return false;
            return true;
        });

        // Calculate Class Summary rows
        let totalExpectedStudentSessions = 0;
        let totalPresentInPeriod = 0;
        let totalAbsentInFinalized = 0;

        const classSummaryRows = targetClasses.map((cls) => {
            const clsStudents = getStudentsByClass(cls.id);
            const clsSessions = matchingSessions.filter((s) => s.classId === cls.id);

            // Present records in date range for this class
            const clsPresentRecs = state.attendance.filter((r) => {
                if (r.classId !== cls.id || r.status !== "Present") return false;
                if (bounds.startDate && r.date < bounds.startDate) return false;
                if (bounds.endDate && r.date > bounds.endDate) return false;
                return clsStudents.some((stu) => stu.id === r.studentId);
            });

            // Absent count only comes from finalized sessions
            let clsAbsentCount = 0;
            clsSessions.forEach((ses) => {
                clsStudents.forEach((stu) => {
                    const wasPres = state.attendance.some(
                        (r) => r.studentId === stu.id && r.classId === cls.id && r.date === ses.date && r.status === "Present"
                    );
                    if (!wasPres) clsAbsentCount += 1;
                });
            });

            const denominator = clsPresentRecs.length + clsAbsentCount;
            const pct = denominator > 0 ? Math.round((clsPresentRecs.length / denominator) * 100) : 0;

            totalExpectedStudentSessions += denominator;
            totalPresentInPeriod += clsPresentRecs.length;
            totalAbsentInFinalized += clsAbsentCount;

            return {
                classId: cls.id,
                className: cls.name,
                studentCount: clsStudents.length,
                sessionCount: clsSessions.length,
                presentCount: clsPresentRecs.length,
                absentCount: clsAbsentCount,
                rate: pct
            };
        });

        const overallRate =
            totalExpectedStudentSessions > 0
                ? Math.round((totalPresentInPeriod / totalExpectedStudentSessions) * 100)
                : 0;

        // Update Summary Cards
        document.getElementById("rep-stat-enrolled").textContent = targetStudents.length;
        document.getElementById("rep-stat-sessions").textContent = `${matchingSessions.length} finalized ${matchingSessions.length === 1 ? "session" : "sessions"}`;
        document.getElementById("rep-stat-present").textContent = totalPresentInPeriod;
        document.getElementById("rep-stat-absent").textContent = totalAbsentInFinalized;
        document.getElementById("rep-stat-rate").textContent = `${overallRate}%`;

        // Finalization explainer bar
        const finBar = document.getElementById("rep-finalization-bar");
        if (finBar) {
            const singleDateForFinalize = bounds.startDate === bounds.endDate ? bounds.startDate : getLocalDateString(0);
            finBar.innerHTML = `
                <span>ℹ️ <strong>Absence Calculation Rule:</strong> A day without finalized attendance is never treated as everyone absent. Absences are only counted for finalized class sessions (${matchingSessions.length} finalized in selected filter: <strong>${escapeHtml(bounds.label)}</strong>).</span>
                <button type="button" class="btn btn-xs btn-indigo" id="rep-quick-finalize-all-btn">
                    Finalize All Classes for ${escapeHtml(singleDateForFinalize || getLocalDateString(0))}
                </button>
            `;
            const qBtn = document.getElementById("rep-quick-finalize-all-btn");
            if (qBtn) {
                qBtn.onclick = () => {
                    const targetDate = singleDateForFinalize || getLocalDateString(0);
                    state.classes.forEach((c) => {
                        if (getStudentsByClass(c.id).length > 0 && !isSessionFinalized(c.id, targetDate)) {
                            state.sessions.push({
                                id: `SES_${Date.now()}_${c.id}`,
                                classId: c.id,
                                date: targetDate,
                                finalizedAt: getCurrentTimeFormatted(),
                                teacher: state.teacherSession ? state.teacherSession.username : "teacher1"
                            });
                        }
                    });
                    saveAllData();
                    refreshAllViews();
                    showToast(`All classes finalized for ${targetDate}!`, "success");
                };
            }
        }

        // Render Class Summary Table
        const classTbody = document.getElementById("report-class-tbody");
        if (classTbody) {
            classTbody.innerHTML = "";
            if (classSummaryRows.length === 0) {
                classTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:1.2rem;">No classes available.</td></tr>`;
            } else {
                const actionDate = bounds.startDate === bounds.endDate && bounds.startDate ? bounds.startDate : getLocalDateString(0);
                classSummaryRows.forEach((r) => {
                    const isFinToday = isSessionFinalized(r.classId, actionDate);
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td><strong>${escapeHtml(r.className)}</strong></td>
                        <td>${r.studentCount}</td>
                        <td>${r.sessionCount}</td>
                        <td><span class="badge badge-present">${r.presentCount}</span></td>
                        <td><span class="badge badge-absent">${r.absentCount}</span></td>
                        <td><strong>${r.rate}%</strong></td>
                        <td>
                            ${
                                isFinToday
                                    ? `<span class="badge badge-emerald">✓ Finalized (${escapeHtml(actionDate)})</span>`
                                    : `<button type="button" class="btn btn-xs btn-indigo" data-action="finalize-class-date" data-class-id="${escapeHtml(r.classId)}" data-date="${escapeHtml(actionDate)}">
                                           Finalize (${escapeHtml(actionDate)})
                                       </button>`
                            }
                        </td>
                    `;
                    classTbody.appendChild(tr);
                });
            }
        }

        // Render Individual Student Summary Table
        const stuTbody = document.getElementById("report-student-tbody");
        const threshold = Number(state.settings.attendanceThreshold) || 75;
        if (stuTbody) {
            stuTbody.innerHTML = "";
            if (targetStudents.length === 0) {
                stuTbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:1.2rem;">No students enrolled in selected filter.</td></tr>`;
            } else {
                targetStudents.forEach((stu) => {
                    const stuSessions = matchingSessions.filter((s) => s.classId === stu.classId);
                    const totalDays = stuSessions.length;
                    let presentDays = 0;

                    stuSessions.forEach((ses) => {
                        const wasPres = state.attendance.some(
                            (r) => r.studentId === stu.id && r.classId === stu.classId && r.date === ses.date && r.status === "Present"
                        );
                        if (wasPres) presentDays += 1;
                    });

                    const absentDays = Math.max(0, totalDays - presentDays);
                    const pct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null;

                    let statusHtml = `<span class="badge badge-gray">No Finalized Days</span>`;
                    if (pct !== null) {
                        statusHtml =
                            pct < threshold
                                ? `<span class="badge badge-danger">Below ${threshold}% (${pct}%)</span>`
                                : `<span class="badge badge-emerald">Good Standing (${pct}%)</span>`;
                    }

                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td><code>${escapeHtml(stu.id)}</code></td>
                        <td><strong>${escapeHtml(stu.name)}</strong></td>
                        <td>${escapeHtml(getClassName(stu.classId))}</td>
                        <td>${escapeHtml(stu.rollNo)}</td>
                        <td>${totalDays}</td>
                        <td><span class="badge badge-present">${presentDays}</span></td>
                        <td><span class="badge badge-absent">${absentDays}</span></td>
                        <td><strong>${pct !== null ? `${pct}%` : "N/A"}</strong></td>
                        <td>${statusHtml}</td>
                    `;
                    stuTbody.appendChild(tr);
                });
            }
        }

        // Render the 3 Report Charts
        renderReportCharts(totalPresentInPeriod, totalAbsentInFinalized, classSummaryRows, matchingSessions);
    }

    function renderReportCharts(totalPresent, totalAbsent, classSummaryRows, matchingSessions) {
        // Text summaries (accessible alternatives)
        const doughnutText = document.getElementById("report-doughnut-text");
        if (doughnutText) {
            doughnutText.textContent =
                totalPresent + totalAbsent > 0
                    ? `Present: ${totalPresent} check-ins | Absent: ${totalAbsent} (in finalized sessions).`
                    : "No finalized attendance data in this period.";
        }

        const classText = document.getElementById("report-class-text");
        if (classText) {
            classText.textContent =
                classSummaryRows.length > 0
                    ? classSummaryRows.map((c) => `${c.className}: ${c.rate}%`).join(" • ")
                    : "No class data available.";
        }

        // Group sessions by date for trend chart
        const uniqueDates = Array.from(new Set(matchingSessions.map((s) => s.date))).sort();
        const trendRates = uniqueDates.map((d) => {
            const st = calculateSchoolDateStats(d);
            return st.rate;
        });

        const trendText = document.getElementById("report-trend-text");
        if (trendText) {
            trendText.textContent =
                uniqueDates.length > 0
                    ? uniqueDates.map((d, i) => `${d}: ${trendRates[i]}%`).join(" → ")
                    : "Finalize attendance across dates to view daily trend.";
        }

        if (typeof window.Chart === "undefined") return;

        // 1. Doughnut Chart
        const c1 = document.getElementById("reportDoughnutChart");
        if (c1) {
            if (state.charts.doughnutChart) state.charts.doughnutChart.destroy();
            state.charts.doughnutChart = new window.Chart(c1, {
                type: "doughnut",
                data: {
                    labels: ["Present", "Absent"],
                    datasets: [
                        {
                            data: totalPresent + totalAbsent > 0 ? [totalPresent, totalAbsent] : [1, 0],
                            backgroundColor: totalPresent + totalAbsent > 0 ? ["#10b981", "#ef4444"] : ["#cbd5e1", "#e2e8f0"]
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "bottom" } }
                }
            });
        }

        // 2. Class Bar Chart
        const c2 = document.getElementById("reportClassBarChart");
        if (c2) {
            if (state.charts.classBarChart) state.charts.classBarChart.destroy();
            state.charts.classBarChart = new window.Chart(c2, {
                type: "bar",
                data: {
                    labels: classSummaryRows.map((c) => c.className),
                    datasets: [
                        {
                            label: "Attendance %",
                            data: classSummaryRows.map((c) => c.rate),
                            backgroundColor: "#2563eb",
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, max: 100 } },
                    plugins: { legend: { display: false } }
                }
            });
        }

        // 3. Trend Line Chart
        const c3 = document.getElementById("reportTrendChart");
        if (c3) {
            if (state.charts.trendChart) state.charts.trendChart.destroy();
            state.charts.trendChart = new window.Chart(c3, {
                type: "line",
                data: {
                    labels: uniqueDates.length ? uniqueDates : [getLocalDateString(0)],
                    datasets: [
                        {
                            label: "School Attendance %",
                            data: uniqueDates.length ? trendRates : [0],
                            borderColor: "#4f46e5",
                            backgroundColor: "rgba(79, 70, 229, 0.15)",
                            fill: true,
                            tension: 0.25
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, max: 100 } },
                    plugins: { legend: { display: false } }
                }
            });
        }
    }

    /**
     * Properly escapes a CSV cell value according to RFC 4180 (commas, quotes, line breaks)
     */
    function escapeCsvCell(val) {
        const str = val === null || val === undefined ? "" : String(val);
        if (/[",\r\n]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    /**
     * Exports a list of attendance rows to a downloadable CSV file
     */
    function exportAttendanceRowsToCsv(rows, filenamePrefix = "SmartAttend_Report") {
        if (!Array.isArray(rows) || rows.length === 0) {
            showToast("No attendance records match the current filter to export.", "warning");
            return;
        }

        try {
            const headers = [
                "Date",
                "Student ID",
                "Student Name",
                "Class",
                "Roll Number",
                "Attendance Status",
                "Attendance Method",
                "Time",
                "Teacher"
            ];

            const csvLines = [headers.map(escapeCsvCell).join(",")];
            rows.forEach((r) => {
                csvLines.push(
                    [
                        r.date,
                        r.studentId,
                        r.studentName,
                        r.className,
                        r.rollNo,
                        r.status,
                        r.method,
                        r.time,
                        r.teacher
                    ]
                        .map(escapeCsvCell)
                        .join(",")
                );
            });

            const csvString = "\uFEFF" + csvLines.join("\r\n");
            const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${filenamePrefix}_${getLocalDateString(0)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast(`Exported ${rows.length} attendance records to CSV!`, "success");
        } catch (err) {
            console.error("CSV export failed:", err);
            showToast("Failed to export CSV file. Please try again.", "error");
        }
    }

    /**
     * Prints a formatted Attendance Report sheet (Daily, Class Summary, Student Summary, or All)
     */
    function printAttendanceReport(modeOverride = null) {
        const bounds = getReportDateFilterBounds();
        const classFilter = document.getElementById("rep-class-filter")?.value || "ALL";
        const mode = modeOverride || document.getElementById("rep-print-mode")?.value || "all";

        const staging = document.getElementById("print-staging-area");
        const schoolName = state.settings.schoolName || "Smart School";

        let html = `
            <div class="print-sheet-header">
                <h2>${escapeHtml(schoolName)} — Official Attendance Report</h2>
                <p>Period: ${escapeHtml(bounds.label)} | Class Filter: ${escapeHtml(classFilter === "ALL" ? "All Classes" : getClassName(classFilter))}</p>
            </div>
        `;

        if (mode === "all" || mode === "class") {
            const classTable = document.querySelector("#report-class-summary-card table");
            if (classTable) {
                html += `<h3 style="margin-top:1rem;">Class Attendance Summary</h3><table class="print-table">${classTable.innerHTML}</table>`;
            }
        }

        if (mode === "all" || mode === "student") {
            const stuTable = document.querySelector("#report-student-summary-card table");
            if (stuTable) {
                html += `<h3 style="margin-top:1.25rem;">Individual Student Attendance Summary</h3><table class="print-table">${stuTable.innerHTML}</table>`;
            }
        }

        if (mode === "all" || mode === "daily") {
            const rows = getUnifiedAttendanceRows({
                startDate: bounds.startDate,
                endDate: bounds.endDate,
                classId: classFilter
            });
            html += `
                <h3 style="margin-top:1.25rem;">Daily Attendance Log (${rows.length} entries)</h3>
                <table class="print-table">
                    <thead>
                        <tr>
                            <th>Date</th><th>Student ID</th><th>Student Name</th><th>Class</th><th>Roll No</th><th>Status</th><th>Method</th><th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows
                            .map(
                                (r) => `
                            <tr>
                                <td>${escapeHtml(r.date)}</td>
                                <td>${escapeHtml(r.studentId)}</td>
                                <td>${escapeHtml(r.studentName)}</td>
                                <td>${escapeHtml(r.className)}</td>
                                <td>${escapeHtml(r.rollNo)}</td>
                                <td>${escapeHtml(r.status)}</td>
                                <td>${escapeHtml(r.method)}</td>
                                <td>${escapeHtml(r.time)}</td>
                            </tr>`
                            )
                            .join("")}
                    </tbody>
                </table>
            `;
        }

        staging.innerHTML = html;
        setTimeout(() => window.print(), 120);
    }

    // ========================================================================
    // 16. SECTION 10: RULE-BASED AI ATTENDANCE ASSISTANT (DEMO AI)
    // ========================================================================

    function appendAiChatMessage(sender, htmlOrText, isHtml = false) {
        const list = document.getElementById("ai-messages-list");
        if (!list) return;

        const msgDiv = document.createElement("div");
        msgDiv.className = `ai-msg ${sender === "user" ? "ai-msg-user" : "ai-msg-bot"}`;

        const bubble = document.createElement("div");
        bubble.className = "ai-msg-bubble";
        if (isHtml) {
            bubble.innerHTML = htmlOrText;
        } else {
            bubble.textContent = htmlOrText;
        }

        msgDiv.appendChild(bubble);
        list.appendChild(msgDiv);
        list.scrollTop = list.scrollHeight;
    }

    function initAiWelcomeMessage() {
        const list = document.getElementById("ai-messages-list");
        if (!list || list.children.length > 0) return;

        appendAiChatMessage(
            "bot",
            `👋 Hello! I am the <strong>Smart Attendance Assistant — Demo AI</strong> for <strong>${escapeHtml(state.settings.schoolName)}</strong>.<br><br>` +
                `I analyze your live student roster and finalized attendance sessions directly in your browser. Click any suggested question below or type your own question!`,
            true
        );
    }

    /**
     * Generates a rule-based response from actual stored records (Section 17)
     */
    function generateAiAssistantResponse(queryText) {
        const q = String(queryText || "").trim().toLowerCase();
        const today = getLocalDateString(0);
        const threshold = Number(state.settings.attendanceThreshold) || 75;
        const focusClassId = document.getElementById("ai-context-class")?.value || "ALL";

        const badgeEl = document.getElementById("ai-threshold-badge");
        if (badgeEl) badgeEl.textContent = `Low Attendance Threshold: ${threshold}%`;

        if (state.students.length === 0) {
            return "There are currently no registered students in the database. Please add students in the Student Management section or restore the demo data in Settings.";
        }

        // Check if query mentions a specific class like "5-a", "5-b", "4-a"
        let detectedClass = focusClassId !== "ALL" ? findClassById(focusClassId) : null;
        state.classes.forEach((cls) => {
            const shortName = cls.name.toLowerCase().replace("class ", "");
            if (q.includes(cls.name.toLowerCase()) || q.includes(shortName)) {
                detectedClass = cls;
            }
        });

        // INTENT 1: Summarize today's attendance ("summarize" or "today")
        if (q.includes("summarize") || (q.includes("today") && !q.includes("weekly"))) {
            if (detectedClass) {
                const st = calculateClassDateStats(detectedClass.id, today);
                const absentWord = st.absentCount === 1 ? "1 student is absent" : `${st.absentCount} students are absent`;
                const presentWord = st.presentCount === 1 ? "1 student is present" : `${st.presentCount} students are present`;
                return `Today (${today}), <strong>${escapeHtml(detectedClass.name)}</strong> has <strong>${st.total}</strong> registered students. <strong>${presentWord}</strong> and <strong>${
                    st.finalized ? absentWord : `${st.unmarkedCount} unmarked (session not finalized yet)`
                }</strong>. Attendance is <strong>${st.rate}%</strong>.`;
            }

            // School-wide + per-class breakdown
            const schoolStats = calculateSchoolDateStats(today);
            const classLines = state.classes.map((cls) => {
                const st = calculateClassDateStats(cls.id, today);
                return `• <strong>${escapeHtml(cls.name)}</strong>: ${st.total} registered — ${st.presentCount} present, ${
                    st.finalized ? `${st.absentCount} absent` : `${st.unmarkedCount} unmarked`
                } (<strong>${st.rate}%</strong>)`;
            });

            return (
                `📊 <strong>Today's Attendance Summary (${today}):</strong><br>` +
                `Across <strong>${escapeHtml(state.settings.schoolName)}</strong>, there are <strong>${schoolStats.totalStudents}</strong> registered students. ` +
                `<strong>${schoolStats.presentToday}</strong> students are present and <strong>${schoolStats.absentToday}</strong> are absent across finalized sessions. Overall school attendance today is <strong>${schoolStats.rate}%</strong>.<br><br>` +
                classLines.join("<br>")
            );
        }

        // INTENT 2: Low attendance ("low attendance", "below", "threshold", "at risk")
        if (q.includes("low") || q.includes("threshold") || q.includes("below")) {
            if (state.sessions.length === 0) {
                return "More finalized attendance records are needed before calculating low-attendance rates. Please finalize at least one class attendance session first.";
            }

            const pool = detectedClass ? getStudentsByClass(detectedClass.id) : state.students;
            const lowStudents = [];

            pool.forEach((stu) => {
                const stuSessions = state.sessions.filter((s) => s.classId === stu.classId);
                if (stuSessions.length === 0) return;
                let pres = 0;
                stuSessions.forEach((ses) => {
                    if (
                        state.attendance.some(
                            (r) => r.studentId === stu.id && r.classId === stu.classId && r.date === ses.date && r.status === "Present"
                        )
                    ) {
                        pres += 1;
                    }
                });
                const rate = Math.round((pres / stuSessions.length) * 100);
                if (rate < threshold) {
                    lowStudents.push({ stu, pres, total: stuSessions.length, rate });
                }
            });

            if (lowStudents.length === 0) {
                return `🎉 Great news! Every student${detectedClass ? ` in ${escapeHtml(detectedClass.name)}` : ""} currently meets or exceeds the <strong>${threshold}%</strong> attendance threshold across finalized sessions.`;
            }

            const items = lowStudents
                .map(
                    (item) =>
                        `• <strong>${escapeHtml(item.stu.name)}</strong> (<code>${escapeHtml(item.stu.id)}</code>, ${escapeHtml(
                            getClassName(item.stu.classId)
                        )}): Present ${item.pres}/${item.total} finalized days (<strong>${item.rate}%</strong>)`
                )
                .join("<br>");

            return (
                `📌 <strong>Students Below ${threshold}% Threshold (${lowStudents.length} found):</strong><br>` +
                `${items}<br><br>` +
                `<em>Note: Attendance is below the selected threshold. Consider checking whether support is needed.</em>`
            );
        }

        // INTENT 3: Highest attendance class ("highest", "best", "top", "compare")
        if (q.includes("highest") || q.includes("best") || q.includes("top") || q.includes("which class")) {
            if (state.classes.length === 0) {
                return "No classes are registered yet.";
            }

            const rankings = state.classes.map((cls) => {
                const clsStudents = getStudentsByClass(cls.id);
                const clsSessions = state.sessions.filter((s) => s.classId === cls.id);
                let pres = 0;
                let totalPossible = 0;

                clsSessions.forEach((ses) => {
                    totalPossible += clsStudents.length;
                    clsStudents.forEach((stu) => {
                        if (
                            state.attendance.some(
                                (r) => r.studentId === stu.id && r.classId === cls.id && r.date === ses.date && r.status === "Present"
                            )
                        ) {
                            pres += 1;
                        }
                    });
                });

                const rate = totalPossible > 0 ? Math.round((pres / totalPossible) * 100) : calculateClassDateStats(cls.id, today).rate;
                return { cls, pres, totalPossible, rate };
            });

            rankings.sort((a, b) => b.rate - a.rate);
            const winner = rankings[0];
            const breakdown = rankings
                .map((r, idx) => `${idx + 1}. <strong>${escapeHtml(r.cls.name)}</strong> — <strong>${r.rate}%</strong> (${r.pres}/${r.totalPossible || getStudentsByClass(r.cls.id).length} check-ins)`)
                .join("<br>");

            return (
                `🏆 <strong>${escapeHtml(winner.cls.name)}</strong> currently has the highest attendance rate at <strong>${winner.rate}%</strong>!<br><br>` +
                `<strong>Class Rankings (Finalized Sessions):</strong><br>${breakdown}`
            );
        }

        // INTENT 4: Present and absent counts ("present", "absent", "count")
        if (q.includes("present") || q.includes("absent") || q.includes("count")) {
            const targetClasses = detectedClass ? [detectedClass] : state.classes;
            let totalReg = 0;
            let totalPresToday = 0;
            let totalAbsToday = 0;
            const absentNamesToday = [];

            targetClasses.forEach((cls) => {
                const st = calculateClassDateStats(cls.id, today);
                totalReg += st.total;
                totalPresToday += st.presentCount;
                totalAbsToday += st.absentCount;

                if (st.finalized) {
                    getStudentsByClass(cls.id).forEach((stu) => {
                        if (!findAttendanceRecord(stu.id, cls.id, today)) {
                            absentNamesToday.push(`${stu.name} (${stu.id}, ${cls.name})`);
                        }
                    });
                }
            });

            const absentListHtml =
                absentNamesToday.length > 0
                    ? `<br><br><strong>Absent Today (Finalized Sessions):</strong><br>• ${absentNamesToday.map(escapeHtml).join("<br>• ")}`
                    : `<br><br><em>No students are marked absent in finalized sessions today.</em>`;

            return (
                `📋 <strong>Present &amp; Absent Counts for Today (${today})${detectedClass ? ` — ${escapeHtml(detectedClass.name)}` : ""}:</strong><br>` +
                `• Total Registered Students: <strong>${totalReg}</strong><br>` +
                `• Present Today: <strong>${totalPresToday}</strong><br>` +
                `• Absent Today (Finalized): <strong>${totalAbsToday}</strong>` +
                absentListHtml
            );
        }

        // INTENT 5: Weekly attendance summary ("weekly", "week", "7 days", "seven days")
        if (q.includes("weekly") || q.includes("week") || q.includes("7 days")) {
            const sevenDaysAgo = getLocalDateString(-6);
            const recentSessions = state.sessions.filter((s) => {
                if (s.date < sevenDaysAgo || s.date > today) return false;
                if (detectedClass && s.classId !== detectedClass.id) return false;
                return true;
            });

            if (recentSessions.length === 0) {
                return `No finalized attendance sessions were found between ${sevenDaysAgo} and ${today}. Finalize attendance sessions to generate a weekly summary.`;
            }

            let totalPres = 0;
            let totalAbs = 0;
            const uniqueDates = Array.from(new Set(recentSessions.map((s) => s.date))).sort();

            recentSessions.forEach((ses) => {
                const clsStudents = getStudentsByClass(ses.classId);
                clsStudents.forEach((stu) => {
                    const wasPres = state.attendance.some(
                        (r) => r.studentId === stu.id && r.classId === ses.classId && r.date === ses.date && r.status === "Present"
                    );
                    if (wasPres) totalPres += 1;
                    else totalAbs += 1;
                });
            });

            const denom = totalPres + totalAbs;
            const rate = denom > 0 ? Math.round((totalPres / denom) * 100) : 0;

            return (
                `📅 <strong>Weekly Attendance Summary (${sevenDaysAgo} to ${today}):</strong><br>` +
                `• Recorded School Days: <strong>${uniqueDates.length} day(s)</strong> (${recentSessions.length} finalized class sessions)<br>` +
                `• Total Present Check-Ins: <strong>${totalPres}</strong><br>` +
                `• Total Absences: <strong>${totalAbs}</strong><br>` +
                `• 7-Day Attendance Rate: <strong>${rate}%</strong>`
            );
        }

        // INTENT 6: Suggestions for improving attendance ("improve", "suggestion", "tip", "help")
        if (q.includes("improve") || q.includes("suggestion") || q.includes("tip")) {
            return (
                `💡 <strong>Supportive Suggestions for Improving School Attendance:</strong><br>` +
                `1. <strong>Fast Morning Welcome with QR Badges:</strong> Keep QR ID cards on lanyards so Class 5 students can scan in under 2 seconds at the classroom door.<br>` +
                `2. <strong>Supportive Early Check-Ins:</strong> When a student's attendance dips below the ${threshold}% threshold, reach out to families with a caring, supportive check-in to see if assistance is needed.<br>` +
                `3. <strong>Celebrate Class Milestones:</strong> Recognize classes that achieve 95%+ weekly attendance during morning assembly.<br>` +
                `4. <strong>Morning Buddy System:</strong> Pair classmates as study buddies to make morning homeroom engaging and welcoming.`
            );
        }

        // Fallback if question is unrecognized
        return (
            `I didn't quite recognize that question. As the rule-based <strong>Smart Attendance Assistant — Demo AI</strong>, I can answer questions about:<br>` +
            `• <em>"Summarize today's attendance."</em><br>` +
            `• <em>"Which students have low attendance?"</em><br>` +
            `• <em>"Which class has the highest attendance?"</em><br>` +
            `• <em>"Show the present and absent counts."</em><br>` +
            `• <em>"Generate a weekly attendance summary."</em><br>` +
            `• <em>"Give suggestions for improving attendance."</em>`
        );
    }

    function handleAiQuestionSubmit(questionText) {
        const trimmed = String(questionText || "").trim();
        if (!trimmed) return;

        appendAiChatMessage("user", trimmed, false);
        const replyHtml = generateAiAssistantResponse(trimmed);
        appendAiChatMessage("bot", replyHtml, true);
    }

    // ========================================================================
    // 17. SECTION 11: SETTINGS & CONFIGURATION
    // ========================================================================

    function renderSettingsSection() {
        const nameIn = document.getElementById("setting-school-name");
        const threshIn = document.getElementById("setting-threshold");
        const classSel = document.getElementById("setting-default-class");

        if (nameIn) nameIn.value = state.settings.schoolName || "Smart School";
        if (threshIn) threshIn.value = state.settings.attendanceThreshold ?? 75;
        if (classSel && state.settings.defaultClassId) {
            classSel.value = state.settings.defaultClassId;
        }
    }

    function handleSettingsSave(e) {
        e.preventDefault();
        const errEl = document.getElementById("settings-form-error");
        errEl.classList.add("hidden");

        const schoolName = (document.getElementById("setting-school-name").value || "").trim();
        const threshold = parseInt(document.getElementById("setting-threshold").value, 10);
        const defaultClassId = document.getElementById("setting-default-class").value;

        if (!schoolName || schoolName.length < 2) {
            errEl.textContent = "Please enter a valid School Name (at least 2 characters).";
            errEl.classList.remove("hidden");
            return;
        }
        if (isNaN(threshold) || threshold < 10 || threshold > 100) {
            errEl.textContent = "Low Attendance Threshold must be a percentage between 10% and 100%.";
            errEl.classList.remove("hidden");
            return;
        }

        state.settings.schoolName = schoolName;
        state.settings.attendanceThreshold = threshold;
        state.settings.defaultClassId = defaultClassId;

        saveAllData();
        refreshAllViews();
        showToast("Settings saved! School name and thresholds updated across all views.", "success");
    }

    // ========================================================================
    // 18. MASTER VIEW REFRESH & EVENT LISTENERS SETUP
    // ========================================================================

    function refreshAllViews() {
        updateHeaderAndSessionUI();
        syncClassSelectDropdowns();
        autoPopulateNextStudentIdAndRoll();

        renderHomeDashboard();
        renderAdminDashboard();
        renderStudentsManagementTable();
        syncQrStudentDropdown();
        renderQrGeneratorSection();
        renderTeacherDashboard();
        renderScannerAndManualSection();
        renderAttendanceRecordsSection();
        renderReportsSection();
        renderSettingsSection();
        initAiWelcomeMessage();

        const badgeEl = document.getElementById("ai-threshold-badge");
        if (badgeEl) badgeEl.textContent = `Low Attendance Threshold: ${state.settings.attendanceThreshold}%`;

        refreshIcons();
    }

    function checkExternalLibrariesLoaded() {
        const missing = [];
        if (typeof window.QRCode === "undefined") missing.push("QRCode.js");
        if (typeof window.Html5Qrcode === "undefined") missing.push("html5-qrcode");
        if (typeof window.Chart === "undefined") missing.push("Chart.js");

        const banner = document.getElementById("library-warning-banner");
        const textEl = document.getElementById("library-warning-text");
        if (missing.length > 0 && banner && textEl) {
            textEl.textContent = `Note: External library (${missing.join(", ")}) could not be loaded from CDN. Offline fallbacks are active for core workflows.`;
            banner.classList.remove("hidden");
        }
    }

    function bindEventListeners() {
        // Sidebar Navigation
        document.querySelectorAll(".nav-item").forEach((btn) => {
            btn.addEventListener("click", () => {
                const target = btn.dataset.section;
                if (target) navigateToSection(target);
            });
        });

        // Quick-goto buttons anywhere in the app
        document.body.addEventListener("click", (e) => {
            const gotoBtn = e.target.closest("[data-goto]");
            if (gotoBtn) {
                const target = gotoBtn.dataset.goto;
                if (target) navigateToSection(target);
                return;
            }

            // Delegated table/card action buttons
            const actionBtn = e.target.closest("[data-action]");
            if (actionBtn) {
                const action = actionBtn.dataset.action;
                const id = actionBtn.dataset.id;

                if (action === "rename-class") {
                    promptRenameClass(id);
                } else if (action === "delete-class") {
                    promptDeleteClass(id);
                } else if (action === "edit-student") {
                    startEditStudent(id);
                } else if (action === "delete-student") {
                    promptDeleteStudent(id);
                } else if (action === "view-student-qr") {
                    const stu = findStudentById(id);
                    if (stu) {
                        navigateToSection("qr-generator");
                        const cSel = document.getElementById("qr-filter-class");
                        const sSel = document.getElementById("qr-filter-student");
                        if (cSel) cSel.value = stu.classId;
                        syncQrStudentDropdown();
                        if (sSel) sSel.value = stu.id;
                        renderQrGeneratorSection();
                    }
                } else if (action === "print-single-card") {
                    const stu = findStudentById(id);
                    if (stu) printStudentIdCards([stu]);
                } else if (action === "regen-single-qr") {
                    renderQrGeneratorSection();
                    showToast(`Regenerated QR code for ${id}.`, "success");
                } else if (action === "mark-manual-present") {
                    const stuId = actionBtn.dataset.stuId;
                    const classId = document.getElementById("scanner-class-select")?.value;
                    const dateStr = document.getElementById("scanner-date-input")?.value;
                    const res = recordStudentAttendance({
                        studentId: stuId,
                        selectedClassId: classId,
                        dateStr,
                        method: "Manual"
                    });
                    displayScanResultCard(res);
                    refreshAllViews();
                } else if (action === "undo-attendance") {
                    const recId = actionBtn.dataset.recordId;
                    const stuName = actionBtn.dataset.stuName;
                    promptUndoAttendanceRecord(recId, stuName);
                } else if (action === "convert-absent-to-present") {
                    const stuId = actionBtn.dataset.stuId;
                    const clsId = actionBtn.dataset.classId;
                    const dateStr = actionBtn.dataset.date;
                    openModal({
                        title: "Mark Absent Student as Present?",
                        message: `Record a manual Present entry for ${stuId} on ${dateStr}?`,
                        confirmText: "Mark Present",
                        confirmClass: "btn-emerald",
                        onConfirm: () => {
                            recordStudentAttendance({
                                studentId: stuId,
                                selectedClassId: clsId,
                                dateStr,
                                method: "Manual"
                            });
                            refreshAllViews();
                            showToast(`Updated ${stuId} to Present on ${dateStr}.`, "success");
                        }
                    });
                } else if (action === "finalize-class-date") {
                    const clsId = actionBtn.dataset.classId;
                    const dateStr = actionBtn.dataset.date;
                    finalizeClassSession(clsId, dateStr);
                }
            }
        });

        // Mobile sidebar controls
        document.getElementById("mobile-menu-toggle")?.addEventListener("click", openMobileSidebar);
        document.getElementById("sidebar-close-btn")?.addEventListener("click", closeMobileSidebar);
        document.getElementById("sidebar-backdrop")?.addEventListener("click", closeMobileSidebar);

        // Dismiss library warning banner
        document.getElementById("close-library-banner")?.addEventListener("click", () => {
            document.getElementById("library-warning-banner")?.classList.add("hidden");
        });

        // Recovery banner restore button
        document.getElementById("banner-restore-btn")?.addEventListener("click", restoreDemoData);

        // Admin: Add Class Form
        document.getElementById("add-class-form")?.addEventListener("submit", handleAddClassForm);

        // Student Management: Form & Filters
        document.getElementById("student-registration-form")?.addEventListener("submit", handleStudentFormSubmit);
        document.getElementById("student-cancel-edit-btn")?.addEventListener("click", resetStudentFormToRegisterMode);
        document.getElementById("btn-generate-next-id")?.addEventListener("click", () => {
            document.getElementById("student-id-input").value = generateNextStudentId();
            autoPopulateNextStudentIdAndRoll();
        });
        document.getElementById("student-class-select")?.addEventListener("change", autoPopulateNextStudentIdAndRoll);
        document.getElementById("student-search-input")?.addEventListener("input", renderStudentsManagementTable);
        document.getElementById("student-filter-class")?.addEventListener("change", renderStudentsManagementTable);
        document.getElementById("student-sort-select")?.addEventListener("change", renderStudentsManagementTable);

        // QR Code Generator Controls
        document.getElementById("qr-filter-class")?.addEventListener("change", () => {
            syncQrStudentDropdown();
            renderQrGeneratorSection();
        });
        document.getElementById("qr-filter-student")?.addEventListener("change", renderQrGeneratorSection);
        document.getElementById("btn-qr-generate-class")?.addEventListener("click", () => {
            renderQrGeneratorSection();
            showToast("Regenerated displayed QR cards!", "success");
        });
        document.getElementById("btn-qr-generate-all")?.addEventListener("click", () => {
            document.getElementById("qr-filter-class").value = "ALL";
            syncQrStudentDropdown();
            document.getElementById("qr-filter-student").value = "ALL";
            renderQrGeneratorSection();
            showToast("Showing QR ID cards for all registered students.", "info");
        });
        document.getElementById("btn-print-visible-cards")?.addEventListener("click", () => {
            const classVal = document.getElementById("qr-filter-class")?.value || "ALL";
            const stuVal = document.getElementById("qr-filter-student")?.value || "ALL";
            let list = getStudentsByClass(classVal);
            if (stuVal !== "ALL") list = list.filter((s) => s.id === stuVal);
            printStudentIdCards(list);
        });

        // Teacher Login & Demo Credential Pills
        document.getElementById("teacher-login-form")?.addEventListener("submit", handleTeacherLogin);
        document.querySelectorAll(".cred-pill").forEach((pill) => {
            pill.addEventListener("click", () => {
                document.getElementById("teacher-username").value = pill.dataset.demoUser || "";
                document.getElementById("teacher-password").value = pill.dataset.demoPass || "";
                document.getElementById("teacher-login-error")?.classList.add("hidden");
                showToast(`Filled demo credentials for ${pill.dataset.demoUser}. Click Sign In!`, "info");
            });
        });

        // Logout buttons
        document.getElementById("sidebar-logout-btn")?.addEventListener("click", handleTeacherLogout);
        document.getElementById("login-page-logout-btn")?.addEventListener("click", handleTeacherLogout);
        document.getElementById("td-logout-btn")?.addEventListener("click", handleTeacherLogout);

        // Teacher Dashboard Controls
        document.getElementById("td-class-select")?.addEventListener("change", (e) => {
            const scannerSel = document.getElementById("scanner-class-select");
            if (scannerSel) scannerSel.value = e.target.value;
            renderTeacherDashboard();
            renderScannerAndManualSection();
        });
        document.getElementById("td-date-input")?.addEventListener("change", (e) => {
            const scannerDate = document.getElementById("scanner-date-input");
            if (scannerDate) scannerDate.value = e.target.value;
            renderTeacherDashboard();
            renderScannerAndManualSection();
        });
        const goToScannerFromTd = () => {
            const tdClass = document.getElementById("td-class-select")?.value;
            const tdDate = document.getElementById("td-date-input")?.value;
            if (!tdClass) {
                showToast("Please select a class before starting attendance.", "warning");
                return;
            }
            const scannerSel = document.getElementById("scanner-class-select");
            const scannerDate = document.getElementById("scanner-date-input");
            if (scannerSel) scannerSel.value = tdClass;
            if (scannerDate && tdDate) scannerDate.value = tdDate;
            navigateToSection("qr-scanner");
        };
        document.getElementById("td-start-scanner-btn")?.addEventListener("click", goToScannerFromTd);
        document.getElementById("td-action-scan")?.addEventListener("click", goToScannerFromTd);
        document.getElementById("td-action-manual")?.addEventListener("click", () => {
            goToScannerFromTd();
            setTimeout(() => {
                document.getElementById("manual-attendance-card")?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        });
        document.getElementById("td-action-finalize")?.addEventListener("click", () => {
            const cls = document.getElementById("td-class-select")?.value;
            const dt = document.getElementById("td-date-input")?.value;
            finalizeClassSession(cls, dt);
        });

        // Scanner & Manual Controls
        document.getElementById("scanner-class-select")?.addEventListener("change", (e) => {
            const tdSel = document.getElementById("td-class-select");
            if (tdSel) tdSel.value = e.target.value;
            renderScannerAndManualSection();
            renderTeacherDashboard();
        });
        document.getElementById("scanner-date-input")?.addEventListener("change", (e) => {
            const tdDate = document.getElementById("td-date-input");
            if (tdDate) tdDate.value = e.target.value;
            renderScannerAndManualSection();
            renderTeacherDashboard();
        });
        document.getElementById("scanner-finalize-btn")?.addEventListener("click", () => {
            const cls = document.getElementById("scanner-class-select")?.value;
            const dt = document.getElementById("scanner-date-input")?.value;
            finalizeClassSession(cls, dt);
        });

        document.getElementById("btn-start-camera")?.addEventListener("click", startCameraScanner);
        document.getElementById("btn-stop-camera")?.addEventListener("click", stopCameraScanner);
        document.getElementById("btn-switch-camera")?.addEventListener("click", switchCamera);
        document.getElementById("btn-scan-again")?.addEventListener("click", () => {
            state.scanLock = false;
            state.lastScannedCode = "";
            const box = document.getElementById("scan-result-container");
            if (box) {
                box.className = "scan-result-box result-neutral";
                box.innerHTML = `
                    <div class="result-icon">🪪</div>
                    <h4 class="result-heading">Ready for Next Student</h4>
                    <p class="result-message">Hold the next student's QR ID card in front of the camera or click Simulate QR Scan.</p>
                `;
            }
        });

        // Demo Simulator buttons
        document.getElementById("btn-simulate-scan")?.addEventListener("click", () => {
            const code = document.getElementById("sim-student-select")?.value;
            state.scanLock = false;
            state.lastScannedCode = "";
            handleDecodedQrScan(code);
        });
        document.getElementById("btn-simulate-custom")?.addEventListener("click", () => {
            const customInput = document.getElementById("sim-custom-qr-input");
            const code = customInput ? customInput.value.trim() : "";
            state.scanLock = false;
            state.lastScannedCode = "";
            handleDecodedQrScan(code);
        });

        // Manual Attendance search & Mark All Present
        document.getElementById("manual-search-input")?.addEventListener("input", () => {
            const cls = document.getElementById("scanner-class-select")?.value;
            const dt = document.getElementById("scanner-date-input")?.value;
            renderManualRosterTable(cls, dt);
        });
        document.getElementById("btn-mark-all-present")?.addEventListener("click", () => {
            const cls = document.getElementById("scanner-class-select")?.value;
            const dt = document.getElementById("scanner-date-input")?.value;
            if (!cls || !dt) return;
            const roster = getStudentsByClass(cls);
            let added = 0;
            roster.forEach((stu) => {
                if (!findAttendanceRecord(stu.id, cls, dt)) {
                    recordStudentAttendance({ studentId: stu.id, selectedClassId: cls, dateStr: dt, method: "Manual" });
                    added += 1;
                }
            });
            refreshAllViews();
            showToast(
                added > 0 ? `Marked ${added} remaining student(s) Present manually.` : "All students in this class are already marked Present.",
                "success"
            );
        });

        // Attendance Records filters
        ["rec-filter-date", "rec-filter-class", "rec-filter-status", "rec-filter-method"].forEach((id) => {
            document.getElementById(id)?.addEventListener("change", renderAttendanceRecordsSection);
        });
        document.getElementById("rec-search-input")?.addEventListener("input", renderAttendanceRecordsSection);
        document.getElementById("rec-clear-filters-btn")?.addEventListener("click", () => {
            document.getElementById("rec-filter-date").value = "";
            document.getElementById("rec-filter-class").value = "ALL";
            document.getElementById("rec-filter-status").value = "ALL";
            document.getElementById("rec-filter-method").value = "ALL";
            document.getElementById("rec-search-input").value = "";
            renderAttendanceRecordsSection();
        });
        document.getElementById("records-export-csv-btn")?.addEventListener("click", () => {
            const dateFilter = document.getElementById("rec-filter-date")?.value || "";
            const classFilter = document.getElementById("rec-filter-class")?.value || "ALL";
            const statusFilter = document.getElementById("rec-filter-status")?.value || "ALL";
            const methodFilter = document.getElementById("rec-filter-method")?.value || "ALL";
            const searchQ = document.getElementById("rec-search-input")?.value || "";
            const rows = getUnifiedAttendanceRows({
                startDate: dateFilter || null,
                endDate: dateFilter || null,
                classId: classFilter,
                status: statusFilter,
                method: methodFilter,
                searchQuery: searchQ
            });
            exportAttendanceRowsToCsv(rows, "SmartAttend_Records");
        });

        // Attendance Reports filters & export/print
        ["rep-date-mode", "rep-single-date", "rep-start-date", "rep-end-date", "rep-class-filter"].forEach((id) => {
            document.getElementById(id)?.addEventListener("change", renderReportsSection);
        });
        document.getElementById("btn-export-report-csv")?.addEventListener("click", () => {
            const bounds = getReportDateFilterBounds();
            const classFilter = document.getElementById("rep-class-filter")?.value || "ALL";
            const rows = getUnifiedAttendanceRows({
                startDate: bounds.startDate,
                endDate: bounds.endDate,
                classId: classFilter
            });
            exportAttendanceRowsToCsv(rows, "SmartAttend_Report");
        });
        document.getElementById("btn-print-report")?.addEventListener("click", () => printAttendanceReport(null));
        document.getElementById("btn-print-class-only")?.addEventListener("click", () => printAttendanceReport("class"));
        document.getElementById("btn-print-student-only")?.addEventListener("click", () => printAttendanceReport("student"));

        // AI Assistant events
        document.getElementById("ai-chat-form")?.addEventListener("submit", (e) => {
            e.preventDefault();
            const input = document.getElementById("ai-question-input");
            if (!input) return;
            const q = input.value;
            input.value = "";
            handleAiQuestionSubmit(q);
        });
        document.querySelectorAll("#ai-suggestion-chips .chip-btn").forEach((chip) => {
            chip.addEventListener("click", () => {
                handleAiQuestionSubmit(chip.dataset.question);
            });
        });
        document.getElementById("ai-clear-chat-btn")?.addEventListener("click", () => {
            const list = document.getElementById("ai-messages-list");
            if (list) list.innerHTML = "";
            initAiWelcomeMessage();
        });

        // Settings & Demo Data Management
        document.getElementById("settings-form")?.addEventListener("submit", handleSettingsSave);
        document.getElementById("btn-restore-demo-data")?.addEventListener("click", () => {
            openModal({
                title: "Restore Original Demonstration Data?",
                message: "This will reset all classes, students, and attendance records back to the original Smart School demonstration dataset. Any custom changes will be replaced.",
                confirmText: "Restore Demo Data",
                confirmClass: "btn-emerald",
                onConfirm: () => restoreDemoData()
            });
        });
        document.getElementById("btn-clear-all-data")?.addEventListener("click", () => {
            openModal({
                title: "Clear All Application Data?",
                message: "WARNING: This will permanently erase all students, classes, and attendance records from your browser's localStorage. Type CLEAR below to confirm:",
                confirmText: "Erase Everything",
                confirmClass: "btn-danger",
                showInput: true,
                inputLabel: 'Type "CLEAR" to confirm',
                inputValue: "",
                onConfirm: (val, { showError }) => {
                    if (String(val).toUpperCase() !== "CLEAR") {
                        showError('Please type "CLEAR" in all caps to confirm erasing all data.');
                        return false;
                    }
                    clearAllData();
                    return true;
                }
            });
        });
    }

    // ========================================================================
    // 19. INITIALIZATION ON DOM CONTENT LOADED
    // ========================================================================
    window.addEventListener("DOMContentLoaded", () => {
        loadApplicationData();

        // Initialize date inputs to today's local date
        const today = getLocalDateString(0);
        ["td-date-input", "scanner-date-input", "rep-single-date", "rep-end-date"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = today;
        });
        const startEl = document.getElementById("rep-start-date");
        if (startEl) startEl.value = getLocalDateString(-7);

        bindEventListeners();
        refreshAllViews();
        setTimeout(checkExternalLibrariesLoaded, 800);
    });
})();
