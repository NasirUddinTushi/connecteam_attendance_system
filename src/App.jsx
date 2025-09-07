import React, { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Calendar, Bell, Check, Download, LogOut, Users, UserCircle2, FileText, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

// ---------- Dummy seed data ----------
const DEFAULT_WORKERS = [
  { id: "W-101", name: "Abdul Karim", trade: "Mason" },
  { id: "W-102", name: "Shahin Mia", trade: "Electrician" },
  { id: "W-103", name: "Rasel Ahmed", trade: "Carpenter" },
  { id: "W-104", name: "Mizanur Rahman", trade: "Plumber" },
  { id: "W-105", name: "Sumon Hossain", trade: "Helper" },
];

const SUPERVISORS = [
  { id: "S-1", name: "Site Supervisor A" },
  { id: "S-2", name: "Site Supervisor B" },
];

// ---------- LocalStorage helpers ----------
const LS_KEYS = {
  attendance: "ct_attendance_demo__records",
  workers: "ct_attendance_demo__workers",
  supervisor: "ct_attendance_demo__supervisor",
};

const getToday = () => new Date().toISOString().slice(0, 10);

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- UI Primitives ----------
function Card({ className = "", children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200/60 dark:border-neutral-800 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function CardHeader({ title, icon: Icon, aside }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-neutral-200/60 dark:border-neutral-800">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />}
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function CardBody({ children, className = "" }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

function Button({ children, onClick, variant = "primary", className = "", type = "button" }) {
  const base = "px-4 py-2 rounded-xl text-sm font-medium transition active:scale-[.98] disabled:opacity-50 flex items-center justify-center gap-2";
  const styles = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow",
    ghost: "bg-transparent border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800",
    subtle: "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700",
  };
  return (
    <motion.button whileTap={{ scale: 0.95 }} type={type} onClick={onClick} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </motion.button>
  );
}

function Badge({ children }) {
  return <span className="px-3 py-1 text-xs rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 font-medium">{children}</span>;
}

// ---------- Core App ----------
export default function App() {
  const [supervisor, setSupervisor] = useState(() => loadLS(LS_KEYS.supervisor, null));
  const [workers, setWorkers] = useState(() => loadLS(LS_KEYS.workers, DEFAULT_WORKERS));
  const [attendance, setAttendance] = useState(() => loadLS(LS_KEYS.attendance, {}));
  const [date, setDate] = useState(getToday());

  useEffect(() => saveLS(LS_KEYS.workers, workers), [workers]);
  useEffect(() => saveLS(LS_KEYS.attendance, attendance), [attendance]);
  useEffect(() => saveLS(LS_KEYS.supervisor, supervisor), [supervisor]);

  const todayRecords = attendance[date] || {};

  const presentCount = useMemo(() => Object.values(todayRecords).filter((s) => s === "P").length, [todayRecords]);
  const absentCount = useMemo(() => Object.values(todayRecords).filter((s) => s === "A").length, [todayRecords]);

  function handleMark(w, status) {
    setAttendance((prev) => {
      const copy = { ...prev };
      copy[date] = { ...(copy[date] || {}), [w.id]: status };
      return copy;
    });
    toast.success(`${w.name} marked ${status === "P" ? "Present" : "Absent"}`);
  }

  function handleBulk(status) {
    setAttendance((prev) => {
      const copy = { ...prev };
      const day = { ...(copy[date] || {}) };
      workers.forEach((w) => (day[w.id] = status));
      copy[date] = day;
      return copy;
    });
    toast(`All workers set to ${status === "P" ? "Present" : "Absent"}`);
  }

  function logout() {
    setSupervisor(null);
    toast("Logged out");
  }

  // PDF generation (captures hex-only printable node)
  async function downloadPDF() {
    try {
      const node = document.getElementById("printable-report");
      if (!node) {
        toast.error("Printable report not found on page");
        return;
      }
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 48;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 24, 24, imgWidth, Math.min(imgHeight, pageHeight - 48));
      pdf.save(`attendance_${date}.pdf`);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("PDF generation failed", err);
      toast.error("PDF generation failed. Check console for details.");
    }
  }

  const autoAbsentList = useMemo(() => computeAutoAbsent(attendance, workers), [attendance, workers]);

  if (!supervisor) return <AuthScreen onLogin={setSupervisor} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 text-neutral-900 dark:text-neutral-100">
      <Toaster position="top-right" />

      {/* Top Bar */}
      <div className="sticky top-0 z-20 backdrop-blur bg-white/80 dark:bg-neutral-900/80 border-b border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <div className="text-xs uppercase tracking-wide opacity-70">Attendance Demo</div>
              <div className="font-semibold">Site Attendance Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{supervisor.name}</Badge>
            <Button variant="ghost" onClick={logout}><LogOut className="w-4 h-4"/> Logout</Button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Left: Attendance sheet */}
        <Card className="md:col-span-2">
          <CardHeader
            title="Mark Attendance"
            icon={Users}
            aside={
              <div className="hidden md:flex items-center gap-2">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm" />
                <Button variant="subtle" onClick={() => handleBulk("P")}><Check className="w-4 h-4"/> All Present</Button>
                <Button variant="ghost" onClick={() => handleBulk("A")}>All Absent</Button>
                <Button onClick={downloadPDF}><Download className="w-4 h-4"/> PDF</Button>
              </div>
            }
          />
          <CardBody>
            <div className="overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
              <table className="min-w-full text-sm sm:text-base">
                <thead className="bg-neutral-100 dark:bg-neutral-800/60 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3">Worker</th>
                    <th className="text-left px-4 py-3">Trade</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((w) => {
                    const status = todayRecords[w.id];
                    return (
                      <tr key={w.id} className="border-t border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition active:scale-[.995]">
                        <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">{w.name}</td>
                        <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{w.trade}</td>
                        <td className="px-4 py-3">
                          {status ? (
                            <span className={`px-2 py-1 rounded-full text-xs sm:text-sm ${status === "P" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
                              {status === "P" ? "Present" : "Absent"}
                            </span>
                          ) : (
                            <Badge>Not Marked</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button onClick={() => handleMark(w, "P")} className="text-xs sm:text-sm py-3">Present</Button>
                            <Button onClick={() => handleMark(w, "A")} variant="ghost" className="text-xs sm:text-sm py-3">Absent</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        {/* Right: Summary + Daily Report */}
        <div className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader title="Today Summary" icon={Calendar} />
            <CardBody>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Total" value={workers.length} />
                <Stat label="Present" value={presentCount} />
                <Stat label="Absent" value={absentCount} />
              </div>
              <div className="mt-4 text-xs opacity-70">Date: {date}</div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Daily Attendance Report"
              icon={FileText}
              aside={<Button onClick={downloadPDF}><Download className="w-4 h-4"/> PDF</Button>}
            />
            <CardBody>
              <PrintableDailyReport
                id="printable-report"
                workers={workers}
                todayRecords={todayRecords}
                supervisor={supervisor}
                date={date}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Auto Absent (3 consecutive days)" icon={Bell} />
            <CardBody>
              {autoAbsentList.length === 0 ? (
                <div className="text-sm opacity-70">No workers flagged for 3 consecutive absences.</div>
              ) : (
                <ul className="space-y-2">
                  {autoAbsentList.map((w) => (
                    <li key={w.id} className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/60">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">{w.name}</span>
                      <Badge>Flagged</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 text-xs opacity-70">Rule: If a worker is Absent (or not marked) for the last 3 consecutive calendar days.</div>
            </CardBody>
          </Card>
        </div>
      
      {/* Mobile sticky action bar */}
      <div className="md:hidden fixed bottom-3 left-0 right-0 px-4 z-30">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl rounded-2xl p-3 flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm" />
          <Button variant="subtle" onClick={() => handleBulk("P")} className="px-3 py-3 text-xs">P</Button>
          <Button variant="ghost" onClick={() => handleBulk("A")} className="px-3 py-3 text-xs">A</Button>
          <Button onClick={downloadPDF} className="px-3 py-3" aria-label="Download PDF"><Download className="w-4 h-4"/></Button>
        </div>
      </div>
    </main>

      <footer className="py-10 text-center text-xs opacity-60">Client-side demo • Ready for DRF API hookup</footer>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-center"
    >
      <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </motion.div>
  );
}

function AuthScreen({ onLogin }) {
  const [sel, setSel] = useState(SUPERVISORS[0].id);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen grid place-items-center bg-gradient-to-br from-indigo-50 via-white to-indigo-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 px-4"
    >
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader title="Supervisor Login" icon={UserCircle2} />
        <CardBody>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Select Supervisor</label>
            <select
              value={sel}
              onChange={(e) => setSel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            >
              {SUPERVISORS.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Button onClick={() => onLogin(SUPERVISORS.find((s) => s.id === sel))} className="w-full">Continue</Button>
          </div>
        </CardBody>
      </Card>
      <Toaster position="top-right" />
    </motion.div>
  );
}

// ---------- Printable (hex-only colors) ----------
function PrintableDailyReport({ id = "printable-report", workers, todayRecords, supervisor, date }) {
  const container = {
    backgroundColor: "#ffffff",
    color: "#111827", // gray-900
    border: "1px solid #e5e7eb", // gray-200
    borderRadius: "12px",
    padding: "16px",
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  };
  const table = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  };
  const th = {
    textAlign: "left",
    padding: "8px 12px",
    backgroundColor: "#EEF2FF", // indigo-50
    color: "#111827",
    borderBottom: "1px solid #e5e7eb",
  };
  const td = {
    padding: "10px 12px",
    borderTop: "1px solid #e5e7eb",
  };

  return (
    <div id={id} style={container}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Site: Demo Site A</div>
      <div style={{ marginBottom: 12 }}>Supervisor: {supervisor.name}</div>
      <div style={{ overflow: "hidden", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Worker</th>
              <th style={th}>Trade</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w, i) => (
              <tr key={w.id}>
                <td style={td}>{i + 1}</td>
                <td style={td}>{w.name}</td>
                <td style={td}>{w.trade}</td>
                <td style={td}>{todayRecords[w.id] === "P" ? "Present" : todayRecords[w.id] === "A" ? "Absent" : "Not Marked"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Generated on {new Date().toLocaleString()}</div>
      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>Date: {date}</div>
    </div>
  );
}

// ----------- Utils -----------
function computeAutoAbsent(attendance, workers) {
  // Check last 3 calendar days (today-1, today-2, today-3). Missing record = Absent.
  const days = [1, 2, 3].map((d) => dateOffset(-d));
  const dayMaps = days.map((d) => attendance[d] || {});
  const flagged = [];
  for (const w of workers) {
    const allAbsent = dayMaps.every((m) => (m[w.id] ? m[w.id] === "A" : true));
    if (allAbsent) flagged.push(w);
  }
  return flagged;
}

function dateOffset(delta) {
  const dt = new Date();
  dt.setDate(dt.getDate() + delta);
  return dt.toISOString().slice(0, 10);
}

// ----------- Self Tests (console) -----------
(function runSelfTests() {
  try {
    // Case 1: Worker absent 3 days -> flagged
    const workers = [{ id: "W1" }, { id: "W2" }];
    const d1 = dateOffset(-1), d2 = dateOffset(-2), d3 = dateOffset(-3);
    const attendance = {
      [d1]: { W1: "A" },
      [d2]: { W1: "A" },
      [d3]: { W1: "A" },
    };
    const flagged = computeAutoAbsent(attendance, workers);
    console.assert(flagged.find((w) => w.id === "W1"), "W1 should be flagged for 3-day absence");

    // Case 2: One present day breaks streak -> not flagged
    const attendance2 = {
      [d1]: { W2: "P" },
      [d2]: { W2: "A" },
      [d3]: { W2: "A" },
    };
    const flagged2 = computeAutoAbsent(attendance2, workers);
    console.assert(!flagged2.find((w) => w.id === "W2"), "W2 should NOT be flagged due to a present day");

    // Case 3: Missing records treated as Absent -> flagged
    const attendance3 = { [d1]: {} }; // d2/d3 missing
    const flagged3 = computeAutoAbsent(attendance3, workers);
    console.assert(flagged3.length === 2, "Both workers should be flagged when records are missing for 3 days");

    // Case 4: Only 2 consecutive absences -> should NOT flag
    const attendance4 = {
      [d1]: { W1: "A" },
      [d2]: { W1: "A" },
      [d3]: { W1: "P" },
    };
    const flagged4 = computeAutoAbsent(attendance4, workers);
    console.assert(!flagged4.find((w) => w.id === "W1"), "W1 should NOT be flagged for only 2 days absent");
  } catch (e) {
    console.warn("Self tests failed:", e);
  }
})();