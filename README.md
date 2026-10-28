# 🎓 SmartAttend AI — Smart QR School Attendance System with AI Assistant

**SmartAttend AI** is a complete, responsive, beginner-friendly school attendance web application built for **Smart School** (designed to be demonstrated by Class 5 students, teachers, and science fair presenters). It generates printable student QR ID cards, scans QR codes using a device camera (with a built-in simulator and manual backup), tracks finalized attendance sessions, visualizes analytics with charts, exports CSV reports, and includes a 100% private, offline rule-based **Smart Attendance Assistant — Demo AI**.

---

## 📋 Table of Contents

1. [What the Application Does](#1-what-the-application-does)
2. [Features Included](#2-features-included)
3. [Technologies Used](#3-technologies-used)
4. [How to Run the Application Locally](#4-how-to-run-the-application-locally)
5. [How to Use the Demo Admin Interface](#5-how-to-use-the-demo-admin-interface)
6. [Teacher Demo Usernames and Passwords](#6-teacher-demo-usernames-and-passwords)
7. [How to Add Students](#7-how-to-add-students)
8. [How to Generate QR Codes](#8-how-to-generate-qr-codes)
9. [How to Print Student ID Cards](#9-how-to-print-student-id-cards)
10. [How to Scan QR Codes Using a Phone or Webcam](#10-how-to-scan-qr-codes-using-a-phone-or-webcam)
11. [Why HTTPS or Localhost Is Needed for Camera Access](#11-why-https-or-localhost-is-needed-for-camera-access)
12. [How localStorage Works](#12-how-localstorage-works)
13. [How Attendance Is Finalized](#13-how-attendance-is-finalized)
14. [How to Export CSV Reports](#14-how-to-export-csv-reports)
15. [How the Rule-Based AI Assistant Works](#15-how-the-rule-based-ai-assistant-works)
16. [Why the Application Has No Real Backend](#16-why-the-application-has-no-real-backend)
17. [Limitations of Frontend-Only Authentication](#17-limitations-of-frontend-only-authentication)
18. [How to Restore Demo Data](#18-how-to-restore-demo-data)
19. [How to Reset the Demonstration](#19-how-to-reset-the-demonstration)
20. [Troubleshooting Camera and Library-Loading Issues](#20-troubleshooting-camera-and-library-loading-issues)

---

## 1. What the Application Does

Taking paper roll call in every classroom takes valuable teaching time and makes it hard to spot attendance patterns early. **SmartAttend AI** solves this by giving each student a printable **QR ID Card** encoding only their unique Student ID (such as `STU001`). When students arrive in class, the teacher scans their card—or marks them manually—and the system immediately updates live dashboards, charts, printable reports, and the AI Attendance Assistant.

---

## 2. Features Included

- **1. Home Dashboard**: Live school summary cards (`TOTAL STUDENTS`, `PRESENT TODAY`, `ABSENT TODAY`, `ATTENDANCE RATE`), quick-action buttons, a Chart.js class attendance bar chart, and a real-time recent activity feed.
- **2. Admin Dashboard**: Add, view, rename, and safely delete school classes (`Class 5-A`, `Class 5-B`, `Class 4-A`, etc.) with validation that prevents deleting classes that still have enrolled students.
- **3. Student Management**: Register new students with auto-suggested IDs (`STU013`, etc.), edit student profiles, search by name or ID, filter by class, sort, and delete students with confirmation.
- **4. QR Code Generator**: Generate privacy-first QR codes (containing only the Student ID) for a single student, a specific class, or the entire school, with dedicated print layouts.
- **5. Teacher Login**: Sign in using demo teacher accounts stored in `sessionStorage` during your active browser session.
- **6. Teacher Dashboard**: Select a class and attendance date, inspect present/absent counts, view recently checked-in students, and finalize class sessions.
- **7. QR Code Scanner & Manual Attendance**: Live camera scanning via `html5-qrcode`, duplicate prevention, wrong-class detection, unknown ID rejection, a **Classroom Demo QR Simulator** (for testing without a physical camera), and a full **Manual Attendance** backup table.
- **8. Attendance Records**: Filterable, searchable log of Present and finalized Absent entries by date, class, status, and method (`QR`, `Manual`, `Finalized`).
- **9. Attendance Reports**: Daily, Class, and Individual Student summaries, 3 interactive Chart.js charts (Doughnut, Class Bar, Daily Trend) with accessible text summaries, CSV export, and clean print sheets.
- **10. AI Attendance Assistant (`Smart Attendance Assistant — Demo AI`)**: Offline, rule-based chat assistant that answers questions using live stored data and configurable low-attendance thresholds.
- **11. Settings & Demo Data Management**: Customize the school name, low-attendance threshold (default `75%`), default class, or restore/clear demonstration data.

---

## 3. Technologies Used

- **HTML5**: Semantic, accessible structure (`index.html`).
- **CSS3**: Responsive educational dashboard theme with mobile navigation and `@media print` rules (`style.css`).
- **Vanilla JavaScript (ES6+)**: Modular, beginner-friendly logic with zero build tools or frameworks (`script.js`).
- **Browser `localStorage` & `sessionStorage`**: Persistent local data storage and active teacher login session.
- **[QRCode.js](https://github.com/davidshimjs/qrcodejs)**: Browser-based QR code generation.
- **[html5-qrcode](https://github.com/mebjas/html5-qrcode)**: Camera QR code scanning.
- **[Chart.js](https://www.chartjs.org/)**: Interactive attendance charts.
- **[Lucide Icons](https://lucide.dev/)**: Clean UI icons.

---

## 4. How to Run the Application Locally

For full functionality (especially camera access), run the folder using any simple local web server:

### Option A: Using Python (Built into macOS/Linux and common on Windows)
```bash
python -m http.server 8000
```
Then open **`http://localhost:8000`** in your web browser.

### Option B: Using Node.js `npx serve`
```bash
npx serve -l 8000
```
Then open **`http://localhost:8000`**.

### Option C: Using VS Code Live Server Extension
1. Open this folder in **Visual Studio Code**.
2. Right-click `index.html` and choose **"Open with Live Server"**.

---

## 5. How to Use the Demo Admin Interface

1. Click **2. Admin Dashboard** or **3. Student Management** in the left sidebar.
2. In this classroom demonstration, the Admin pages are unlocked by default so presenters and judges can add classes, register students, and print QR badges without switching accounts.
3. A blue notice card on the Admin Dashboard explains that frontend-only role checks are for demonstration convenience only.

---

## 6. Teacher Demo Usernames and Passwords

Navigate to **5. Teacher Login** and click either demo card to auto-fill, or type:

| Account | Username | Password |
| :--- | :--- | :--- |
| **Teacher 1** | `teacher1` | `teach123` |
| **Teacher 2** | `teacher2` | `teach456` |

- Clicking **Sign In** stores your active session in `sessionStorage` and opens the **Teacher Dashboard**.
- Clicking **Logout** in the sidebar or Teacher Dashboard clears `sessionStorage`.

---

## 7. How to Add Students

1. Open **3. Student Management**.
2. The **Student ID** (e.g., `STU013`) and **Roll Number** are automatically suggested based on the selected class.
3. Enter the **Student Full Name**, select a **Class** (e.g., `Class 5-A`), enter a **Section** (e.g., `A`), and confirm the **Roll Number**.
4. Click **Save Student**.
5. The system validates that all fields are filled, prevents duplicate Student IDs, and prevents duplicate Roll Numbers in the same class and section.

---

## 8. How to Generate QR Codes

1. Open **4. QR Code Generator**.
2. Use **Filter by Class** to pick a class (such as `Class 5-A`) or `All Classes`.
3. Optionally choose a single student from **Select Specific Student**.
4. Each card displays the school name, student name, class, roll number, Student ID, and a crisp QR code containing **only** the Student ID (e.g., `STU001`). No private phone numbers, home addresses, or passwords are ever encoded.

---

## 9. How to Print Student ID Cards

- **Single Student Card**: Click **🖨️ Print Card** on any student's QR card (or click **Print ID Card** in the Student Management table).
- **Entire Class or All Students**: Filter the view in **4. QR Code Generator** and click **Print Displayed ID Cards** at the top right.
- The `@media print` stylesheet automatically hides the sidebar, top bar, buttons, and dashboard clutter, arranging the ID cards in a clean two-column grid without splitting cards across page breaks.

---

## 10. How to Scan QR Codes Using a Phone or Webcam

1. Log in at **5. Teacher Login** and open **6. Teacher Dashboard**.
2. Select the **Class** (e.g., `Class 5-A`) and **Attendance Date**, then click **Start QR Scanner**.
3. Click **Start Scanner** and click **Allow** when your browser asks for camera permission.
4. Hold a printed Student ID card (or another screen showing the QR code) in front of the camera.
5. **Testing Without a Camera**: Use the **Classroom Demo QR Simulator** directly below the camera box in **7. QR Scanner & Manual** to test valid scans, duplicate scans, wrong-class scans, and unknown IDs with a single click!

---

## 11. Why HTTPS or Localhost Is Needed for Camera Access

Modern web browsers enforce a security rule called **Secure Contexts** (`window.isSecureContext`). Browsers only allow websites to access a webcam or phone camera (`navigator.mediaDevices.getUserMedia`) when loaded over:
- `http://localhost` or `http://127.0.0.1` (local development server), **or**
- `https://...` (encrypted web hosting such as GitHub Pages, Netlify, or Vercel).

If you double-click `index.html` directly from your computer's file explorer (`file:///...`), the browser blocks camera access for your privacy. Always run a local server or use the built-in **Classroom Demo QR Simulator** / **Manual Attendance** roll call.

---

## 12. How localStorage Works

All application data is saved in your browser's `localStorage` using clear keys:
- `smartAttend_students` — Array of registered student objects
- `smartAttend_classes` — Array of school class objects
- `smartAttend_attendance` — Array of recorded Present check-ins
- `smartAttend_sessions` — Array of finalized class attendance sessions
- `smartAttend_settings` — School name, low-attendance threshold, and default class

When saving, JavaScript converts arrays/objects to text using `JSON.stringify()`. When loading, it converts them back using `JSON.parse()`. Data stays saved when you refresh the page or close and reopen the browser on the same device.

---

## 13. How Attendance Is Finalized

In a real school, a day when a teacher hasn't taken attendance yet should **not** mark every student absent.
- While taking roll call, a class session is **Open**. Students who scan in are marked **Present**, and remaining students are shown as **Unmarked**.
- Once the teacher finishes taking attendance for that class and date, they click **Finalize Class Attendance** (available on the Teacher Dashboard, QR Scanner page, and Reports page).
- Finalizing records a completed session for that class and date. Any student in that class without a Present record is now counted as **Absent** in reports, charts, and AI low-attendance calculations.
- If a late student arrives after finalization, the teacher can still mark them Present or click **Reopen Session**, and the existing session updates cleanly without creating duplicates.

---

## 14. How to Export CSV Reports

1. Go to **8. Attendance Records** or **9. Attendance Reports**.
2. Select your desired date range and class filter.
3. Click **Export CSV** (or **Export Filtered CSV**).
4. The browser generates a standard `.csv` spreadsheet file (properly escaping commas, quotation marks, and line breaks) that opens cleanly in Microsoft Excel, Google Sheets, or LibreOffice Calc.

---

## 15. How the Rule-Based AI Assistant Works

Open **10. AI Assistant** to use the **Smart Attendance Assistant — Demo AI**.
- Because this project requires zero backend servers and zero paid API keys, the assistant uses a **JavaScript keyword-based intent detector**.
- When you ask a question (or click one of the 6 suggested prompt chips), the assistant inspects keywords (`summarize`, `low attendance`, `highest`, `present`/`absent`, `weekly`, `improve`) and runs live calculations over your `localStorage` records.
- **Privacy Guarantee**: No student data is ever sent over the internet to an external AI provider. Real generative AI in a school system would require a secure backend server and strict student data privacy agreements.

---

## 16. Why the Application Has No Real Backend

This project is designed to be 100% self-contained, free to run, offline-capable once loaded, and easy for Class 5 students and beginners to inspect and understand. By storing data in `localStorage` instead of requiring Node.js, PHP, MySQL, or Firebase, anyone can run the entire school attendance system on any laptop or static host without setting up databases or cloud accounts.

---

## 17. Limitations of Frontend-Only Authentication

- The demo teacher login (`teacher1` / `teach123` and `teacher2` / `teach456`) validates credentials in browser JavaScript and stores the active session in `sessionStorage`.
- Passwords are **never** stored in `localStorage`.
- However, anyone who opens Browser Developer Tools (`F12`) can inspect frontend JavaScript code or modify `localStorage` and `sessionStorage`. In a real production school system, authentication and authorization must always be enforced by a secure backend server.

---

## 18. How to Restore Demo Data

If you add test students or delete records during a practice run and want to return to the original **Smart School** dataset:
1. Open **11. Settings & Demo Data** in the sidebar.
2. Click **Restore Demo Data** and confirm in the dialog box.
3. The original 3 classes (`Class 5-A`, `Class 5-B`, `Class 4-A`), 12 fictional students (`STU001`–`STU012`), and sample attendance records will be restored immediately.

---

## 19. How to Reset the Demonstration

If you want to start with a completely blank school to demonstrate adding classes and students from scratch:
1. Open **11. Settings & Demo Data**.
2. Click **Clear All Demo Data**.
3. Type `CLEAR` in the confirmation box and click **Erase Everything**.
4. You can restore the original demo data at any time with one click.

---

## 20. Troubleshooting Camera and Library-Loading Issues

- **Camera Permission Denied**: Click the lock or camera icon on the left side of your browser's address bar, change **Camera** to **Allow**, and click **Start Scanner** again.
- **Opening via `file://` Blocks Camera**: Run the project through `http://localhost:8000` (see [Section 4](#4-how-to-run-the-application-locally)) or use the **Classroom Demo QR Simulator** in Section 7.
- **No Webcam on Desktop PC**: Use the **Classroom Demo QR Simulator** or the **Manual Attendance Roll Call** table directly below the scanner to demonstrate all attendance workflows.
- **CDN Libraries Offline**: If you open the app without an internet connection and CDN scripts (`QRCode.js`, `Chart.js`, `html5-qrcode`) cannot load, SmartAttend AI displays a helpful warning banner and activates built-in text summaries and offline QR badge fallbacks so the app never crashes.
