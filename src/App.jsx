import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";

const REPO_URL = "https://github.com/Babug01/timestamp-converter";

const TIMEZONES = [
  { id: "UTC", label: "UTC" },
  { id: "__browser__", label: "Browser Local" },
  { id: "America/New_York", label: "America/New York" },
  { id: "America/Los_Angeles", label: "America/Los Angeles" },
  { id: "Europe/Amsterdam", label: "Europe/Amsterdam" },
  { id: "Europe/London", label: "Europe/London" },
  { id: "Asia/Kolkata", label: "Asia/Kolkata" },
  { id: "Asia/Singapore", label: "Asia/Singapore" },
  { id: "Australia/Sydney", label: "Australia/Sydney" },
];

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function resolveTz(tzId) {
  return tzId === "__browser__" ? browserTimeZone() : tzId;
}

// Formats an instant as an ISO-8601-shaped string *in the given IANA time
// zone*, offset and all — Date.toISOString() only ever gives UTC, so this
// hand-assembles the equivalent using Intl.DateTimeFormat.formatToParts,
// which is the one API that actually knows a zone's wall-clock time and
// (via a second call with timeZoneName) its UTC offset on that date,
// DST included.
function isoInTimeZone(date, tzId) {
  const timeZone = resolveTz(tzId);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  let hour = parts.hour === "24" ? "00" : parts.hour;

  const offsetDtf = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" });
  const offsetPart = offsetDtf.formatToParts(date).find((p) => p.type === "timeZoneName")?.value || "GMT+0";
  const m = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  let offsetStr = "+00:00";
  if (m) {
    const sign = m[1];
    const hh = m[2].padStart(2, "0");
    const mm = (m[3] || "00").padStart(2, "0");
    offsetStr = `${sign}${hh}:${mm}`;
  }

  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}.${ms}${offsetStr}`;
}

function getZonedParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: p.hour === "24" ? 0 : Number(p.hour), minute: Number(p.minute), second: Number(p.second),
  };
}

// Converts a "wall clock" date+time (as typed into a <input type="datetime-local">,
// with no zone info of its own) into the UTC epoch instant it represents in
// the given IANA zone. Standard iterative-convergence trick: guess an instant,
// see what wall-clock time that instant actually shows in the target zone,
// and correct the guess by the difference — 2 passes always converges for
// real-world UTC offsets (including DST).
function zonedTimeToUtcMs(y, mo, d, h, mi, s, tzId) {
  const timeZone = resolveTz(tzId);
  const desired = Date.UTC(y, mo - 1, d, h, mi, s);
  let guess = desired;
  for (let i = 0; i < 3; i++) {
    const zp = getZonedParts(new Date(guess), timeZone);
    const zonedAsUtc = Date.UTC(zp.year, zp.month - 1, zp.day, zp.hour, zp.minute, zp.second);
    const delta = desired - zonedAsUtc;
    if (delta === 0) break;
    guess += delta;
  }
  return guess;
}

function relativeTime(targetMs, nowMs) {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const seconds = (targetMs - nowMs) / 1000;
  const units = [
    ["year", 31536000], ["month", 2592000], ["week", 604800],
    ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(seconds) >= secs || unit === "second") {
      return rtf.format(Math.round(seconds / secs), unit);
    }
  }
}

// Auto-detects seconds vs. milliseconds by digit count: a 10-digit Unix
// timestamp is seconds (covers 2001-09-09 through 2286-11-20); a 13-digit
// one is milliseconds (the same range). This is exactly what most APIs and
// logs actually emit, so digit count is a reliable, well-known heuristic —
// not foolproof (an 11-13 digit boundary is genuinely ambiguous) but correct
// for the values you'll encounter in the wild.
function parseUnixInput(raw) {
  const str = raw.trim();
  if (!str) throw new Error("Enter a Unix timestamp");
  if (!/^-?\d+$/.test(str)) throw new Error(`"${str}" isn't an integer Unix timestamp`);
  const digits = str.replace("-", "").length;
  const isMs = digits >= 11;
  const n = Number(str);
  return { ms: isMs ? n : n * 1000, detected: isMs ? "milliseconds" : "seconds", digits };
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const styles = {
  root: { minHeight: "100dvh", display: "flex", flexDirection: "column" },
  content: { fontFamily: "system-ui, sans-serif", padding: "24px 32px", maxWidth: 900, margin: "0 auto", color: "var(--text, #1a1a1a)", width: "100%", boxSizing: "border-box", background: "var(--bg-subtle, #f0efed)", flex: 1 },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 13, opacity: 0.6, margin: "4px 0 20px" },
  liveBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
    padding: "10px 16px", borderRadius: 8, background: "rgba(79,70,229,0.08)", fontSize: 12.5,
    fontFamily: "'SFMono-Regular', Consolas, monospace", marginBottom: 24,
  },
  sectionTitle: { fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6, marginBottom: 10, marginTop: 24 },
  row: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8, alignItems: "center" },
  input: {
    padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)",
    background: "var(--input-bg, #f9fafb)", color: "var(--text, #1a1a1a)", fontSize: 14, flex: 1, minWidth: 220,
    fontFamily: "'SFMono-Regular', Consolas, monospace",
  },
  select: {
    padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)",
    background: "var(--input-bg, #f9fafb)", color: "var(--text, #1a1a1a)", fontSize: 13,
  },
  hint: { fontSize: 11.5, opacity: 0.55, marginBottom: 4 },
  errorBox: {
    padding: 14, borderRadius: 8, border: "1px solid #e05c5c", background: "rgba(224,92,92,0.08)",
    color: "#e05c5c", fontSize: 13, margin: "8px 0 20px",
  },
  resultGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 8 },
  card: { background: "var(--input-bg, #f9fafb)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, padding: "12px 14px" },
  cardLabel: { fontSize: 11, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 },
  cardValue: { fontSize: 14, fontWeight: 600, fontFamily: "'SFMono-Regular', Consolas, monospace", wordBreak: "break-all" },
  plainLine: {
    padding: "12px 16px", borderRadius: 8, background: "rgba(79,70,229,0.08)", color: "var(--text, #1a1a1a)",
    fontSize: 14, marginBottom: 20,
  },
  tzTable: { width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border, #e5e7eb)", opacity: 0.6, fontWeight: 600, fontSize: 11, textTransform: "uppercase" },
  td: { padding: "8px 10px", borderBottom: "1px solid var(--border, #e5e7eb)", fontFamily: "'SFMono-Regular', Consolas, monospace" },
};

function ResultCard({ label, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>{value}</div>
    </div>
  );
}

export default function TimestampConverterTool() {
  const [epochMs, setEpochMs] = useState(() => Date.now());
  const [unixInput, setUnixInput] = useState(() => String(Math.floor(Date.now() / 1000)));
  const [unixError, setUnixError] = useState(null);
  const [dateInput, setDateInput] = useState(() => toLocalInputValue(new Date()));
  const [dateError, setDateError] = useState(null);
  const [tz, setTz] = useState("UTC");
  const [now, setNow] = useState(() => Date.now());

  // Live-ticking current time — independent of the converter's own state.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function handleUnixChange(raw) {
    setUnixInput(raw);
    try {
      const { ms } = parseUnixInput(raw);
      setEpochMs(ms);
      setDateInput(toLocalInputValue(new Date(ms)));
      setUnixError(null);
      setDateError(null);
    } catch (e) {
      setUnixError(e.message);
    }
  }

  function handleDateChange(raw) {
    setDateInput(raw);
    try {
      if (!raw) throw new Error("Enter a date and time");
      const [datePart, timePart] = raw.split("T");
      const [y, mo, d] = datePart.split("-").map(Number);
      const [h, mi, s] = (timePart || "00:00:00").split(":").map((x) => Number(x) || 0);
      const ms = zonedTimeToUtcMs(y, mo, d, h, mi, s || 0, tz);
      setEpochMs(ms);
      setUnixInput(String(Math.floor(ms / 1000)));
      setDateError(null);
      setUnixError(null);
    } catch (e) {
      setDateError(e.message);
    }
  }

  function handleTzChange(newTz) {
    setTz(newTz);
    // Re-derive epoch from the currently-entered wall-clock date under the
    // new zone, so the date field's meaning stays "this wall time, in this zone".
    try {
      if (!dateInput) return;
      const [datePart, timePart] = dateInput.split("T");
      const [y, mo, d] = datePart.split("-").map(Number);
      const [h, mi, s] = (timePart || "00:00:00").split(":").map((x) => Number(x) || 0);
      const ms = zonedTimeToUtcMs(y, mo, d, h, mi, s || 0, newTz);
      setEpochMs(ms);
      setUnixInput(String(Math.floor(ms / 1000)));
    } catch {
      // leave state as-is if the current date input can't be re-resolved
    }
  }

  const unixDetected = useMemo(() => {
    try {
      return parseUnixInput(unixInput).detected;
    } catch {
      return null;
    }
  }, [unixInput]);

  const date = new Date(epochMs);
  const isoUtc = !Number.isNaN(epochMs) ? date.toISOString() : null;
  const isoTz = !Number.isNaN(epochMs) ? isoInTimeZone(date, tz) : null;
  const relative = !Number.isNaN(epochMs) ? relativeTime(epochMs, now) : null;

  const nowDate = new Date(now);

  return (
    <div style={styles.root}>
      <Header repoUrl={REPO_URL} />
      <div style={styles.content}>
        <h1 style={styles.title}>Timestamp Converter</h1>
        <p style={styles.subtitle}>
          Convert between Unix timestamps and human dates, in any timezone, both directions. Runs entirely in the
          browser; nothing you enter ever leaves your machine.
        </p>

        <div style={styles.liveBar}>
          <span>Right now — Unix: {Math.floor(now / 1000)} ({now}ms)</span>
          <span>{nowDate.toISOString()}</span>
        </div>

        <div style={styles.sectionTitle}>Unix Timestamp</div>
        <div style={styles.hint}>Auto-detects seconds (10 digits) vs. milliseconds (13 digits) by length.</div>
        <div style={styles.row}>
          <input style={styles.input} value={unixInput} onChange={(e) => handleUnixChange(e.target.value)} placeholder="1700000000" spellCheck={false} />
          {unixDetected && <span style={{ fontSize: 12, opacity: 0.6 }}>detected: {unixDetected}</span>}
        </div>
        {unixError && <div style={styles.errorBox}>{unixError}</div>}

        <div style={styles.sectionTitle}>Human Date &amp; Time</div>
        <div style={styles.row}>
          <input style={styles.input} type="datetime-local" step="1" value={dateInput} onChange={(e) => handleDateChange(e.target.value)} />
          <select style={styles.select} value={tz} onChange={(e) => handleTzChange(e.target.value)}>
            {TIMEZONES.map((z) => (
              <option key={z.id} value={z.id}>{z.id === "__browser__" ? `${z.label} (${browserTimeZone()})` : z.label}</option>
            ))}
          </select>
        </div>
        {dateError && <div style={styles.errorBox}>{dateError}</div>}

        {!Number.isNaN(epochMs) && (
          <>
            <div style={{ ...styles.resultGrid, marginTop: 20 }}>
              <ResultCard label="Unix (seconds)" value={Math.floor(epochMs / 1000)} />
              <ResultCard label="Unix (milliseconds)" value={epochMs} />
              <ResultCard label="ISO 8601 (UTC)" value={isoUtc} />
              <ResultCard label={`ISO 8601 (${tz === "__browser__" ? browserTimeZone() : tz})`} value={isoTz} />
            </div>
            <div style={styles.plainLine}>
              {date.toUTCString()} UTC — that's {relative}.
            </div>

            <div style={styles.sectionTitle}>All Timezones</div>
            <table style={styles.tzTable}>
              <thead>
                <tr><th style={styles.th}>Timezone</th><th style={styles.th}>ISO 8601</th></tr>
              </thead>
              <tbody>
                {TIMEZONES.map((z) => (
                  <tr key={z.id}>
                    <td style={styles.td}>{z.id === "__browser__" ? `Browser Local (${browserTimeZone()})` : z.label}</td>
                    <td style={styles.td}>{isoInTimeZone(date, z.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
