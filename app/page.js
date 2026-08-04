"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, ChevronLeft, ChevronRight, Gem, Receipt, Pencil, Plus, X, Hammer, Box, Trash2, Save } from "lucide-react";

// ---- Design tokens: blocky / pixel-art, inspired by sandbox-mining games ----
const T = {
  dirt: "#6B4A2F",
  dirtDark: "#4A3220",
  stone: "#5A5A56",
  stoneDark: "#3D3D3A",
  stoneLight: "#7A7A74",
  grass: "#5C9A3B",
  grassDark: "#3E6B27",
  cream: "#F2EDD8",
  muted: "#B9B5A0",
  emerald: "#3FC97A",
  emeraldDark: "#1F8A4E",
  diamond: "#5ED4D0",
  diamondDark: "#2E9B96",
  gold: "#E8C443",
  goldDark: "#A8871F",
  redstone: "#D4463A",
  redstoneDark: "#8F2A22",
};

const monoFont = "'SF Mono', 'Consolas', ui-monospace, Menlo, monospace";

const pixelText = (color = T.cream) => ({
  fontFamily: monoFont,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color,
  textShadow: "2px 2px 0 rgba(0,0,0,0.55)",
});

const pixelBorder = (base, light, dark, size = 3) => ({
  boxShadow: `
    inset ${size}px ${size}px 0 0 ${light},
    inset -${size}px -${size}px 0 0 ${dark}
  `,
  background: base,
});

const DEFAULT_CHORES = [
  { id: "c1", label: "Dirty dishes in the sink" },
  { id: "c2", label: "Dirty laundry in the hamper" },
];

const DEFAULT_BOYS = [
  { id: "b1", name: "Zach", accent: T.gold, accentDark: T.goldDark },
  { id: "b2", name: "Kyle", accent: T.diamond, accentDark: T.diamondDark },
];

// Default matches: home every week Tue–Thu, and every other week that
// block extends through Sunday (Tue–Sun). "Extended" weeks are the ones
// with the Thu–Sun stretch; "regular" weeks are just Tue–Thu.
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_SCHEDULE = {
  anchorDate: todayKeyPlaceholder(), // a date known to fall in an "extended" week
  regularDays: [2, 3, 4], // Tue, Wed, Thu
  extendedDays: [2, 3, 4, 5, 6, 0], // Tue, Wed, Thu, Fri, Sat, Sun
};
const DEFAULT_STREAK_SETTINGS = { length: 3, bonus: 3 };

function todayKeyPlaceholder() {
  // resolved at module load; fine since this only seeds the default
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STORAGE_KEY = "chore-dashboard-data";
const DAILY_BONUS = 2;

function dateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function prettyDate(key) {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function todayKey() {
  return dateKey(new Date());
}
function addDays(key, n) {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function formatTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function getWeekStart(d) {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}
// Is the given date one of the boys' scheduled days at this house?
function isEligibleDay(dateStr, schedule) {
  if (!schedule || !schedule.anchorDate) return true;
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay();
  const anchor = new Date(schedule.anchorDate + "T00:00:00");
  const weeksDiff = Math.round((getWeekStart(d) - getWeekStart(anchor)) / (7 * 24 * 3600 * 1000));
  const isExtendedWeek = (((weeksDiff % 2) + 2) % 2) === 0;
  const activeDays = isExtendedWeek ? schedule.extendedDays : schedule.regularDays;
  return activeDays.includes(dow);
}

export default function ChoreDashboard() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [boys, setBoys] = useState(DEFAULT_BOYS);
  const [chores, setChores] = useState(DEFAULT_CHORES);
  const [completions, setCompletions] = useState({});
  const [ledger, setLedger] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [showLedger, setShowLedger] = useState(false);
  const [editingBoy, setEditingBoy] = useState(null);
  const [editingChores, setEditingChores] = useState(false);
  const [newChoreLabel, setNewChoreLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState("");
  const [adjustingBoy, setAdjustingBoy] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [sideQuests, setSideQuests] = useState([]);
  const [showSideQuestForm, setShowSideQuestForm] = useState(false);
  const [newQuestLabel, setNewQuestLabel] = useState("");
  const [newQuestValue, setNewQuestValue] = useState("");
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [streakSettings, setStreakSettings] = useState(DEFAULT_STREAK_SETTINGS);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/data");
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setBoys(data.boys || DEFAULT_BOYS);
            setChores(data.chores || DEFAULT_CHORES);
            setCompletions(data.completions || {});
            setLedger(data.ledger || []);
            setSideQuests(data.sideQuests || []);
            setSchedule(data.schedule || DEFAULT_SCHEDULE);
            setStreakSettings(data.streakSettings || DEFAULT_STREAK_SETTINGS);
          }
        }
      } catch (e) {
        // no existing data yet, or network hiccup on first load
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setSaving(true);
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) setError("Couldn't save — changes may not persist.");
      else setError(null);
    } catch (e) {
      setError("Couldn't save — changes may not persist.");
    } finally {
      setSaving(false);
    }
  }, []);

  const saveAll = useCallback(
    (patch) => {
      const next = {
        boys: patch.boys ?? boys,
        chores: patch.chores ?? chores,
        completions: patch.completions ?? completions,
        ledger: patch.ledger ?? ledger,
        sideQuests: patch.sideQuests ?? sideQuests,
        schedule: patch.schedule ?? schedule,
        streakSettings: patch.streakSettings ?? streakSettings,
      };
      if (patch.boys) setBoys(patch.boys);
      if (patch.chores) setChores(patch.chores);
      if (patch.completions) setCompletions(patch.completions);
      if (patch.ledger) setLedger(patch.ledger);
      if (patch.sideQuests) setSideQuests(patch.sideQuests);
      if (patch.schedule) setSchedule(patch.schedule);
      if (patch.streakSettings) setStreakSettings(patch.streakSettings);
      persist(next);
    },
    [boys, chores, completions, ledger, sideQuests, schedule, streakSettings, persist]
  );

  const balances = useMemo(() => {
    const map = {};
    for (const b of boys) map[b.id] = 0;
    for (const entry of ledger) {
      map[entry.boyId] = (map[entry.boyId] || 0) + entry.amount;
    }
    return map;
  }, [boys, ledger]);

  // Date the current running total started accruing: the day after the
  // most recent payout, or the earliest bonus if no payout has happened yet.
  const accruingSince = useMemo(() => {
    const map = {};
    for (const b of boys) {
      const boyEntries = ledger
        .filter((e) => e.boyId === b.id)
        .sort((a, b2) => (a.timestamp < b2.timestamp ? -1 : 1));
      const lastPayout = [...boyEntries].reverse().find((e) => e.tag === "payout");
      const relevant = lastPayout
        ? boyEntries.filter((e) => e.timestamp > lastPayout.timestamp)
        : boyEntries;
      map[b.id] = relevant.length > 0 ? relevant[0].date : null;
    }
    return map;
  }, [boys, ledger]);

  // Each boy's current streak of consecutive home days with all chores done,
  // as of today (ineligible/non-home days are skipped, not counted as breaks).
  const currentStreaks = useMemo(() => {
    const map = {};
    for (const b of boys) {
      map[b.id] = computeStreak(b.id, todayKey(), completions);
    }
    return map;
  }, [boys, completions, chores, schedule]);

  function getCompletionMap(dKey, boyId) {
    return completions[`${dKey}|${boyId}`] || {};
  }

  function isDayComplete(boyId, dateStr, completionsMap) {
    const map = completionsMap[`${dateStr}|${boyId}`] || {};
    return chores.length > 0 && chores.every((c) => !!map[c.id]);
  }

  // Walk backward from a date, counting consecutive *eligible* (home) days
  // with every chore done. Days the boys aren't scheduled to be here are
  // skipped over — they neither add to nor break the streak.
  function computeStreak(boyId, uptoDateStr, completionsMap) {
    let count = 0;
    let d = uptoDateStr;
    let guard = 0;
    while (guard < 400) {
      guard++;
      if (isEligibleDay(d, schedule)) {
        if (isDayComplete(boyId, d, completionsMap)) {
          count++;
        } else {
          break;
        }
      }
      d = addDays(d, -1);
    }
    return count;
  }

  // Re-checks every day from `fromDateStr` through `toDateStr` (inclusive) for
  // this boy, adding or removing streak-bonus ledger entries as needed. This
  // is what makes editing a past day ripple forward correctly — a broken
  // streak un-awards every bonus that depended on it, and a repaired one
  // re-awards them.
  function recalcStreakBonuses(boyId, fromDateStr, toDateStr, completionsMap, ledgerArr) {
    let result = ledgerArr;
    let d = fromDateStr;
    let guard = 0;
    while (d <= toDateStr && guard < 730) {
      guard++;
      if (isEligibleDay(d, schedule)) {
        const dayComplete = isDayComplete(boyId, d, completionsMap);
        const streakCount = dayComplete ? computeStreak(boyId, d, completionsMap) : 0;
        const existing = result.find((e) => e.tag === "streak" && e.date === d && e.boyId === boyId);
        const qualifies =
          dayComplete && streakSettings.length > 0 && streakCount > 0 && streakCount % streakSettings.length === 0;
        if (qualifies && !existing) {
          result = [
            ...result,
            {
              id: uid(),
              date: d,
              boyId,
              amount: streakSettings.bonus,
              reason: `🔥 ${streakCount}-day streak bonus`,
              tag: "streak",
              timestamp: new Date().toISOString(),
            },
          ];
        } else if (!qualifies && existing) {
          result = result.filter((e) => e.id !== existing.id);
        } else if (qualifies && existing && existing.amount !== streakSettings.bonus) {
          // bonus amount was changed in settings after this entry was made — keep it in sync
          result = result.map((e) =>
            e.id === existing.id ? { ...e, amount: streakSettings.bonus, reason: `🔥 ${streakCount}-day streak bonus` } : e
          );
        }
      }
      d = addDays(d, 1);
    }
    return result;
  }

  function toggleChore(boyId, choreId) {
    const key = `${selectedDate}|${boyId}`;
    const current = { ...(completions[key] || {}) };
    current[choreId] = current[choreId] ? null : new Date().toISOString();

    const allDone = chores.length > 0 && chores.every((c) => current[c.id]);
    const nextCompletions = { ...completions, [key]: current };

    const existingBonus = ledger.find(
      (e) => e.tag === "bonus" && e.date === selectedDate && e.boyId === boyId
    );

    let nextLedger = ledger;
    if (allDone && !existingBonus) {
      nextLedger = [
        ...ledger,
        {
          id: uid(),
          date: selectedDate,
          boyId,
          amount: DAILY_BONUS,
          reason: "All daily chores complete",
          tag: "bonus",
          timestamp: new Date().toISOString(),
        },
      ];
    } else if (!allDone && existingBonus) {
      nextLedger = ledger.filter((e) => e.id !== existingBonus.id);
    }

    // Recalculate streak bonuses forward from the edited day through today,
    // so changing an old day correctly continues or breaks everything after it.
    nextLedger = recalcStreakBonuses(boyId, selectedDate, todayKey(), nextCompletions, nextLedger);

    saveAll({ completions: nextCompletions, ledger: nextLedger });
  }

  function payOut(boyId) {
    const balance = balances[boyId] || 0;
    if (balance <= 0) return;
    const boy = boys.find((b) => b.id === boyId);
    const ok = window.confirm(
      `Pay out $${balance.toFixed(2)} to ${boy?.name || "this boy"} and reset their balance to $0?`
    );
    if (!ok) return;
    const nextLedger = [
      ...ledger,
      {
        id: uid(),
        date: todayKey(),
        boyId,
        amount: -balance,
        reason: "Allowance paid out",
        tag: "payout",
        timestamp: new Date().toISOString(),
      },
    ];
    saveAll({ ledger: nextLedger });
  }

  function startEditEntry(entry) {
    setEditingEntryId(entry.id);
    setEditAmount(String(entry.amount));
    setEditReason(entry.reason);
  }

  function cancelEditEntry() {
    setEditingEntryId(null);
    setEditAmount("");
    setEditReason("");
  }

  function saveEditEntry(id) {
    const amount = Number(editAmount);
    if (isNaN(amount) || !editReason.trim()) return;
    const nextLedger = ledger.map((e) =>
      e.id === id ? { ...e, amount, reason: editReason.trim() } : e
    );
    saveAll({ ledger: nextLedger });
    cancelEditEntry();
  }

  function deleteEntry(entry) {
    const ok = window.confirm(
      `Delete this entry (${entry.amount >= 0 ? "+" : "-"}$${Math.abs(entry.amount).toFixed(2)} — ${entry.reason})? This will update the balance.`
    );
    if (!ok) return;
    const nextLedger = ledger.filter((e) => e.id !== entry.id);
    saveAll({ ledger: nextLedger });
  }

  function submitAdjustment(boyId) {
    const amount = Number(adjustAmount);
    if (isNaN(amount) || amount === 0 || !adjustReason.trim()) return;
    const nextLedger = [
      ...ledger,
      {
        id: uid(),
        date: todayKey(),
        boyId,
        amount,
        reason: adjustReason.trim(),
        tag: "manual",
        timestamp: new Date().toISOString(),
      },
    ];
    saveAll({ ledger: nextLedger });
    setAdjustingBoy(null);
    setAdjustAmount("");
    setAdjustReason("");
  }

  function renameBoy(boyId, name) {
    const nextBoys = boys.map((b) => (b.id === boyId ? { ...b, name } : b));
    saveAll({ boys: nextBoys });
  }

  function addSideQuest() {
    const label = newQuestLabel.trim();
    const value = Number(newQuestValue);
    if (!label || isNaN(value) || value <= 0) return;
    const next = [...sideQuests, { id: uid(), label, value, claimedBy: null }];
    setNewQuestLabel("");
    setNewQuestValue("");
    setShowSideQuestForm(false);
    saveAll({ sideQuests: next });
  }

  function claimSideQuest(id, boyId) {
    const next = sideQuests.map((q) => (q.id === id ? { ...q, claimedBy: boyId } : q));
    saveAll({ sideQuests: next });
  }

  function releaseSideQuest(id) {
    const next = sideQuests.map((q) => (q.id === id ? { ...q, claimedBy: null } : q));
    saveAll({ sideQuests: next });
  }

  function removeSideQuest(id) {
    const next = sideQuests.filter((q) => q.id !== id);
    saveAll({ sideQuests: next });
  }

  function completeSideQuest(quest) {
    const nextLedger = [
      ...ledger,
      {
        id: uid(),
        date: todayKey(),
        boyId: quest.claimedBy,
        amount: quest.value,
        reason: `Side quest: ${quest.label}`,
        tag: "sidequest",
        timestamp: new Date().toISOString(),
      },
    ];
    const nextSideQuests = sideQuests.filter((q) => q.id !== quest.id);
    saveAll({ ledger: nextLedger, sideQuests: nextSideQuests });
  }

  function addChore() {
    const label = newChoreLabel.trim();
    if (!label) return;
    const nextChores = [...chores, { id: uid(), label }];
    setNewChoreLabel("");
    saveAll({ chores: nextChores });
  }

  function removeChore(choreId) {
    const nextChores = chores.filter((c) => c.id !== choreId);
    saveAll({ chores: nextChores });
  }

  const isToday = selectedDate === todayKey();
  const isFuture = selectedDate > todayKey();

  const sortedLedger = useMemo(
    () => [...ledger].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)),
    [ledger]
  );

  if (!loaded) {
    return (
      <div style={{ background: T.stoneDark, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={pixelText()}>Loading world…</div>
      </div>
    );
  }

  return (
    <div style={{ background: T.stoneDark, minHeight: "100vh", fontFamily: monoFont, color: T.cream }}>
      <div style={{ height: 14, background: T.grass, borderBottom: `4px solid ${T.grassDark}` }} />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div style={{ ...pixelText(), fontSize: "1.5rem" }}>Daily Quests</div>
            <div style={{ color: T.muted, fontSize: "0.75rem", fontFamily: monoFont }}>
              daily quests &amp; emerald pay
            </div>
          </div>
          <button
            onClick={() => setShowLedger((s) => !s)}
            className="flex items-center gap-2 px-3 py-2"
            style={{ ...pixelBorder(T.stone, T.stoneLight, T.stoneDark), fontSize: "0.75rem" }}
          >
            <Receipt size={15} />
            {showLedger ? "BOARD" : "LEDGER"}
          </button>
        </div>

        {error && (
          <div
            className="mb-4 px-3 py-2 text-sm"
            style={{ ...pixelBorder("rgba(212,70,58,0.25)", T.redstone, T.redstoneDark), color: T.cream }}
          >
            {error}
          </div>
        )}

        {!showLedger && (
          <>
            <div className="flex items-center justify-center gap-3 mb-6">
              <button
                onClick={() => setSelectedDate((d) => addDays(d, -1))}
                className="p-2"
                style={pixelBorder(T.stone, T.stoneLight, T.stoneDark)}
                aria-label="Previous day"
              >
                <ChevronLeft size={18} color={T.cream} />
              </button>
              <div
                className="px-4 py-2 text-center"
                style={{ ...pixelBorder(T.dirt, T.stoneLight, T.dirtDark), minWidth: 190 }}
              >
                <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{prettyDate(selectedDate)}</div>
                <div
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    color: isEligibleDay(selectedDate, schedule) ? T.emerald : T.muted,
                    marginTop: 2,
                  }}
                >
                  {isEligibleDay(selectedDate, schedule) ? "● HOME DAY" : "○ not scheduled"}
                </div>
                {!isToday && (
                  <button
                    onClick={() => setSelectedDate(todayKey())}
                    style={{ color: T.gold, fontSize: "0.68rem", textDecoration: "underline" }}
                  >
                    jump to today
                  </button>
                )}
              </div>
              <button
                onClick={() => !isFuture && setSelectedDate((d) => addDays(d, 1))}
                disabled={isToday}
                className="p-2"
                style={{ ...pixelBorder(T.stone, T.stoneLight, T.stoneDark), opacity: isToday ? 0.35 : 1 }}
                aria-label="Next day"
              >
                <ChevronRight size={18} color={T.cream} />
              </button>
            </div>

            {!isToday && (
              <div
                className="mb-5 text-center text-xs px-3 py-2"
                style={{ ...pixelBorder("rgba(232,196,67,0.15)", T.gold, T.goldDark), color: T.gold }}
              >
                Viewing a past day — unchecking a quest here reverses that day's 2 emeralds.
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {boys.map((boy) => {
                const map = getCompletionMap(selectedDate, boy.id);
                const doneCount = chores.filter((c) => map[c.id]).length;
                const allDone = chores.length > 0 && doneCount === chores.length;
                const balance = balances[boy.id] || 0;
                return (
                  <div key={boy.id} className="p-4" style={pixelBorder(T.stone, T.stoneLight, T.stoneDark, 4)}>
                    <div className="flex items-center justify-between mb-3">
                      {editingBoy === boy.id ? (
                        <input
                          autoFocus
                          defaultValue={boy.name}
                          onBlur={(e) => {
                            renameBoy(boy.id, e.target.value.trim() || boy.name);
                            setEditingBoy(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                          }}
                          style={{
                            background: T.stoneDark,
                            color: T.cream,
                            border: `2px solid ${boy.accent}`,
                            padding: "2px 6px",
                            fontFamily: monoFont,
                            fontWeight: 800,
                            fontSize: "1.05rem",
                            width: "60%",
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Box size={16} color={boy.accent} />
                          <span style={{ ...pixelText(), fontSize: "1.05rem" }}>{boy.name}</span>
                          <button onClick={() => setEditingBoy(boy.id)} aria-label="Rename">
                            <Pencil size={13} color={T.muted} />
                          </button>
                        </div>
                      )}
                      <div
                        className="px-2 py-1 text-xs"
                        style={{
                          fontFamily: monoFont,
                          fontWeight: 700,
                          background: allDone ? "rgba(63,201,122,0.2)" : T.stoneDark,
                          color: allDone ? T.emerald : T.muted,
                        }}
                      >
                        {doneCount}/{chores.length}
                      </div>
                    </div>

                    {streakSettings.length > 0 && (
                      <div
                        className="flex items-center justify-between px-3 py-1.5 mb-3"
                        style={{
                          background: "rgba(232,196,67,0.08)",
                          border: `2px solid ${T.goldDark}`,
                          fontSize: "0.72rem",
                        }}
                      >
                        <span style={{ color: T.gold, fontWeight: 800 }}>
                          🔥 {currentStreaks[boy.id] || 0}-day streak
                        </span>
                        <span style={{ color: T.muted }}>
                          {streakSettings.length - ((currentStreaks[boy.id] || 0) % streakSettings.length)} to go for +
                          {streakSettings.bonus}
                        </span>
                      </div>
                    )}

                    <div className="space-y-2 mb-4">
                      {chores.map((chore) => {
                        const checked = !!map[chore.id];
                        return (
                          <button
                            key={chore.id}
                            onClick={() => toggleChore(boy.id, chore.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left"
                            style={pixelBorder(
                              checked ? "rgba(63,201,122,0.12)" : T.stoneDark,
                              checked ? T.emerald : T.stoneLight,
                              checked ? T.emeraldDark : "#222220",
                              2
                            )}
                          >
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                flexShrink: 0,
                                background: checked ? T.emerald : T.stone,
                                border: `2px solid ${checked ? T.emeraldDark : T.stoneDark}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {checked && <Check size={14} color={T.stoneDark} strokeWidth={3.5} />}
                            </div>
                            <span
                              style={{
                                fontSize: "0.88rem",
                                fontWeight: 600,
                                textDecoration: checked ? "line-through" : "none",
                                color: checked ? T.muted : T.cream,
                                flex: 1,
                              }}
                            >
                              {chore.label}
                            </span>
                            {checked && (
                              <span style={{ fontSize: "0.65rem", color: T.muted, whiteSpace: "nowrap" }}>
                                {formatTimestamp(map[chore.id])}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {sideQuests.some((q) => q.claimedBy === boy.id) && (
                      <div className="space-y-2 mb-4">
                        <div style={{ fontSize: "0.65rem", color: T.muted, fontWeight: 700 }}>SIDE QUESTS</div>
                        {sideQuests
                          .filter((q) => q.claimedBy === boy.id)
                          .map((q) => (
                            <div
                              key={q.id}
                              className="w-full flex items-center gap-3 px-3 py-2"
                              style={pixelBorder("rgba(232,196,67,0.10)", T.gold, T.goldDark, 2)}
                            >
                              <button
                                onClick={() => completeSideQuest(q)}
                                aria-label="Mark side quest done"
                                style={{
                                  width: 20,
                                  height: 20,
                                  flexShrink: 0,
                                  background: T.stone,
                                  border: `2px solid ${T.gold}`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Check size={13} color={T.gold} strokeWidth={3} />
                              </button>
                              <span style={{ fontSize: "0.88rem", fontWeight: 600, flex: 1 }}>{q.label}</span>
                              <span
                                className="flex items-center gap-1"
                                style={{ color: T.gold, fontWeight: 800, fontSize: "0.8rem" }}
                              >
                                <Gem size={12} />
                                {q.value.toFixed(2)}
                              </span>
                              <button onClick={() => releaseSideQuest(q.id)} aria-label="Unclaim side quest">
                                <X size={14} color={T.muted} />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}

                    {allDone && (
                      <div
                        className="mb-3 text-center text-xs py-1.5 flex items-center justify-center gap-1.5"
                        style={{ background: "rgba(63,201,122,0.15)", color: T.emerald, fontWeight: 700 }}
                      >
                        <Gem size={13} /> QUEST COMPLETE — +{DAILY_BONUS} EMERALDS
                      </div>
                    )}

                    <div
                      className="flex items-center justify-between p-3"
                      style={pixelBorder(T.stoneDark, T.stoneLight, "#222220", 2)}
                    >
                      <div>
                        <div style={{ fontSize: "0.65rem", color: T.muted, fontWeight: 700 }}>ALLOWANCE OWED</div>
                        <div className="flex items-center gap-1.5" style={{ fontSize: "1.5rem", fontWeight: 800, color: boy.accent }}>
                          <Gem size={18} />
                          {balance.toFixed(2)}
                        </div>
                        {accruingSince[boy.id] && (
                          <div style={{ fontSize: "0.62rem", color: T.muted }}>
                            since {prettyDate(accruingSince[boy.id])}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => payOut(boy.id)}
                        disabled={balance <= 0}
                        className="flex items-center gap-1.5 px-3 py-2"
                        style={{
                          ...pixelBorder(
                            balance > 0 ? boy.accent : T.stone,
                            balance > 0 ? T.cream : T.stoneLight,
                            balance > 0 ? boy.accentDark : T.stoneDark,
                            2
                          ),
                          color: balance > 0 ? T.stoneDark : T.muted,
                          opacity: balance > 0 ? 1 : 0.5,
                          fontSize: "0.75rem",
                          fontWeight: 800,
                        }}
                      >
                        <Hammer size={14} />
                        PAY OUT
                      </button>
                    </div>

                    <div className="mt-2">
                      {adjustingBoy === boy.id ? (
                        <div className="p-3 space-y-2" style={pixelBorder(T.stoneDark, T.stoneLight, "#222220", 2)}>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={adjustAmount}
                              onChange={(e) => setAdjustAmount(e.target.value)}
                              placeholder="+2 or -2"
                              className="w-24 px-2 py-1 text-sm"
                              style={{ background: T.stoneDark, border: `2px solid ${T.stoneLight}`, color: T.cream }}
                            />
                            <input
                              value={adjustReason}
                              onChange={(e) => setAdjustReason(e.target.value)}
                              placeholder="Reason (required)"
                              className="flex-1 px-2 py-1 text-sm"
                              style={{ background: T.stoneDark, border: `2px solid ${T.stoneLight}`, color: T.cream }}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => {
                                setAdjustingBoy(null);
                                setAdjustAmount("");
                                setAdjustReason("");
                              }}
                              className="px-2 py-1 text-xs"
                              style={{ color: T.muted }}
                            >
                              CANCEL
                            </button>
                            <button
                              onClick={() => submitAdjustment(boy.id)}
                              disabled={!adjustAmount || !adjustReason.trim()}
                              className="px-3 py-1 flex items-center gap-1 text-xs"
                              style={{
                                ...pixelBorder(T.gold, T.cream, T.goldDark, 2),
                                color: T.stoneDark,
                                fontWeight: 800,
                                opacity: !adjustAmount || !adjustReason.trim() ? 0.5 : 1,
                              }}
                            >
                              <Save size={12} /> SAVE
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAdjustingBoy(boy.id)}
                          className="w-full text-center text-xs py-1.5"
                          style={{ color: T.muted, fontWeight: 700 }}
                        >
                          + / − ADJUST BALANCE MANUALLY
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 mb-6" style={pixelBorder(T.stone, T.stoneLight, T.stoneDark)}>
              <div style={{ ...pixelText(), fontSize: "1rem" }} className="mb-3">
                Available Side Quests
              </div>
              {sideQuests.filter((q) => !q.claimedBy).length === 0 ? (
                <div style={{ color: T.muted, fontSize: "0.85rem" }} className="mb-3">
                  No side quests waiting to be claimed.
                </div>
              ) : (
                <div className="space-y-2 mb-3">
                  {sideQuests
                    .filter((q) => !q.claimedBy)
                    .map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between px-3 py-2 flex-wrap gap-2"
                        style={pixelBorder(T.stoneDark, T.stoneLight, "#222220", 2)}
                      >
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>{q.label}</span>
                          <span
                            className="flex items-center gap-1"
                            style={{ color: T.gold, fontWeight: 800, fontSize: "0.8rem" }}
                          >
                            <Gem size={12} />
                            {q.value.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {boys.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => claimSideQuest(q.id, b.id)}
                              className="px-2 py-1 text-xs"
                              style={{
                                ...pixelBorder(b.accent, T.cream, b.accentDark, 2),
                                color: T.stoneDark,
                                fontWeight: 800,
                              }}
                            >
                              CLAIM: {b.name.toUpperCase()}
                            </button>
                          ))}
                          <button onClick={() => removeSideQuest(q.id)} aria-label="Delete side quest">
                            <Trash2 size={14} color={T.redstone} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {showSideQuestForm ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={newQuestLabel}
                      onChange={(e) => setNewQuestLabel(e.target.value)}
                      placeholder="Task name"
                      className="flex-1 px-2 py-1 text-sm"
                      style={{ background: T.stoneDark, border: `2px solid ${T.stoneLight}`, color: T.cream }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={newQuestValue}
                      onChange={(e) => setNewQuestValue(e.target.value)}
                      placeholder="$ value"
                      className="w-24 px-2 py-1 text-sm"
                      style={{ background: T.stoneDark, border: `2px solid ${T.stoneLight}`, color: T.cream }}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowSideQuestForm(false);
                        setNewQuestLabel("");
                        setNewQuestValue("");
                      }}
                      className="px-2 py-1 text-xs"
                      style={{ color: T.muted }}
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={addSideQuest}
                      disabled={!newQuestLabel.trim() || !newQuestValue}
                      className="px-3 py-1 flex items-center gap-1 text-xs"
                      style={{
                        ...pixelBorder(T.gold, T.cream, T.goldDark, 2),
                        color: T.stoneDark,
                        fontWeight: 800,
                        opacity: !newQuestLabel.trim() || !newQuestValue ? 0.5 : 1,
                      }}
                    >
                      <Plus size={12} /> CREATE
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowSideQuestForm(true)}
                  className="flex items-center gap-2 text-xs"
                  style={{ color: T.muted, fontWeight: 700 }}
                >
                  <Plus size={13} />
                  ADD SIDE QUEST
                </button>
              )}
            </div>

            <div className="p-4" style={pixelBorder(T.stone, T.stoneLight, T.stoneDark)}>
              <button
                onClick={() => setEditingChores((s) => !s)}
                className="flex items-center gap-2 text-xs"
                style={{ color: T.muted, fontWeight: 700 }}
              >
                <Pencil size={13} />
                {editingChores ? "DONE EDITING QUEST LIST" : "EDIT SHARED QUEST LIST"}
              </button>
              {editingChores && (
                <div className="mt-3 space-y-2">
                  {chores.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span>{c.label}</span>
                      <button onClick={() => removeChore(c.id)} aria-label="Remove chore">
                        <X size={15} color={T.redstone} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <input
                      value={newChoreLabel}
                      onChange={(e) => setNewChoreLabel(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addChore()}
                      placeholder="New quest…"
                      className="flex-1 px-2 py-1 text-sm"
                      style={{ background: T.stoneDark, border: `2px solid ${T.stoneLight}`, color: T.cream }}
                    />
                    <button
                      onClick={addChore}
                      className="px-3 py-1 flex items-center gap-1 text-sm"
                      style={{ ...pixelBorder(T.gold, T.cream, T.goldDark, 2), color: T.stoneDark, fontWeight: 800 }}
                    >
                      <Plus size={14} /> ADD
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 mt-4" style={pixelBorder(T.stone, T.stoneLight, T.stoneDark)}>
              <button
                onClick={() => setShowScheduleEditor((s) => !s)}
                className="flex items-center gap-2 text-xs"
                style={{ color: T.muted, fontWeight: 700 }}
              >
                <Pencil size={13} />
                {showScheduleEditor ? "DONE EDITING SCHEDULE & STREAKS" : "EDIT HOME SCHEDULE & STREAKS"}
              </button>
              {showScheduleEditor && (
                <div className="mt-3 space-y-4">
                  <div>
                    <div style={{ fontSize: "0.72rem", color: T.muted, fontWeight: 700 }} className="mb-1">
                      STREAK BONUS
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span>Every</span>
                      <input
                        type="number"
                        min="1"
                        value={streakSettings.length}
                        onChange={(e) =>
                          saveAll({
                            streakSettings: { ...streakSettings, length: Number(e.target.value) || 1 },
                          })
                        }
                        className="w-14 px-2 py-1 text-sm text-center"
                        style={{ background: T.stoneDark, border: `2px solid ${T.stoneLight}`, color: T.cream }}
                      />
                      <span>consecutive home days completed, award</span>
                      <span style={{ color: T.gold }}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={streakSettings.bonus}
                        onChange={(e) =>
                          saveAll({
                            streakSettings: { ...streakSettings, bonus: Number(e.target.value) || 0 },
                          })
                        }
                        className="w-16 px-2 py-1 text-sm text-center"
                        style={{ background: T.stoneDark, border: `2px solid ${T.stoneLight}`, color: T.cream }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.72rem", color: T.muted, fontWeight: 700 }} className="mb-1">
                      REGULAR WEEK HOME DAYS
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DAY_NAMES.map((name, i) => {
                        const active = schedule.regularDays.includes(i);
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              const next = active
                                ? schedule.regularDays.filter((d) => d !== i)
                                : [...schedule.regularDays, i].sort();
                              saveAll({ schedule: { ...schedule, regularDays: next } });
                            }}
                            className="px-2 py-1 text-xs"
                            style={{
                              ...pixelBorder(
                                active ? boys[0]?.accent || T.gold : T.stoneDark,
                                active ? T.cream : T.stoneLight,
                                active ? T.goldDark : "#222220",
                                2
                              ),
                              color: active ? T.stoneDark : T.muted,
                              fontWeight: 700,
                            }}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.72rem", color: T.muted, fontWeight: 700 }} className="mb-1">
                      EXTENDED WEEK HOME DAYS (every other week)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DAY_NAMES.map((name, i) => {
                        const active = schedule.extendedDays.includes(i);
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              const next = active
                                ? schedule.extendedDays.filter((d) => d !== i)
                                : [...schedule.extendedDays, i].sort();
                              saveAll({ schedule: { ...schedule, extendedDays: next } });
                            }}
                            className="px-2 py-1 text-xs"
                            style={{
                              ...pixelBorder(
                                active ? T.diamond : T.stoneDark,
                                active ? T.cream : T.stoneLight,
                                active ? T.diamondDark : "#222220",
                                2
                              ),
                              color: active ? T.stoneDark : T.muted,
                              fontWeight: 700,
                            }}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.72rem", color: T.muted, fontWeight: 700 }} className="mb-1">
                      SYNC POINT
                    </div>
                    <div style={{ fontSize: "0.72rem", color: T.muted }} className="mb-1.5">
                      Pick any date that falls in an extended (Thu–Sun) week — this tells the app which weeks are
                      which.
                    </div>
                    <input
                      type="date"
                      value={schedule.anchorDate}
                      onChange={(e) => saveAll({ schedule: { ...schedule, anchorDate: e.target.value } })}
                      className="px-2 py-1 text-sm"
                      style={{ background: T.stoneDark, border: `2px solid ${T.stoneLight}`, color: T.cream }}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {showLedger && (
          <div className="p-4" style={pixelBorder(T.stone, T.stoneLight, T.stoneDark, 4)}>
            <div className="flex items-center justify-between mb-3">
              <div style={{ ...pixelText(), fontSize: "1.05rem" }}>Ledger</div>
              <div className="flex gap-4">
                {boys.map((b) => (
                  <div key={b.id} className="flex items-center gap-1" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                    <Gem size={12} color={b.accent} />
                    <span style={{ color: b.accent }}>{b.name}</span>
                    <span style={{ color: T.muted }}>{(balances[b.id] || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            {sortedLedger.length === 0 ? (
              <div style={{ color: T.muted, fontSize: "0.85rem" }}>No trades logged yet.</div>
            ) : (
              <div className="space-y-1.5">
                {sortedLedger.map((e) => {
                  const boy = boys.find((b) => b.id === e.boyId);
                  const positive = e.amount >= 0;
                  const isEditing = editingEntryId === e.id;
                  return (
                    <div
                      key={e.id}
                      className="px-3 py-2"
                      style={{ ...pixelBorder(T.stoneDark, "#222220", "#222220", 1), fontSize: "0.82rem" }}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span style={{ color: T.muted, width: 90, display: "inline-block" }}>
                              {prettyDate(e.date)}
                            </span>
                            <span style={{ color: boy?.accent || T.cream, fontWeight: 700 }}>
                              {boy?.name || "—"}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={editAmount}
                              onChange={(ev) => setEditAmount(ev.target.value)}
                              className="w-24 px-2 py-1 text-sm"
                              style={{ background: T.stoneDark, border: `2px solid ${T.stoneLight}`, color: T.cream }}
                            />
                            <input
                              value={editReason}
                              onChange={(ev) => setEditReason(ev.target.value)}
                              placeholder="Reason"
                              className="flex-1 px-2 py-1 text-sm"
                              style={{ background: T.stoneDark, border: `2px solid ${T.stoneLight}`, color: T.cream }}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={cancelEditEntry} className="px-2 py-1 text-xs" style={{ color: T.muted }}>
                              CANCEL
                            </button>
                            <button
                              onClick={() => saveEditEntry(e.id)}
                              className="px-3 py-1 flex items-center gap-1 text-xs"
                              style={{ ...pixelBorder(T.gold, T.cream, T.goldDark, 2), color: T.stoneDark, fontWeight: 800 }}
                            >
                              <Save size={12} /> SAVE
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span style={{ color: T.muted, width: 90, display: "inline-block" }}>
                              {prettyDate(e.date)}
                            </span>
                            <span style={{ color: boy?.accent || T.cream, fontWeight: 700 }}>{boy?.name || "—"}</span>
                            <span style={{ color: T.muted }}>{e.reason}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className="flex items-center gap-1"
                              style={{ fontWeight: 800, color: positive ? T.emerald : T.redstone }}
                            >
                              {positive ? "+" : "−"}
                              <Gem size={12} />
                              {Math.abs(e.amount).toFixed(2)}
                            </span>
                            <button onClick={() => startEditEntry(e)} aria-label="Edit entry">
                              <Pencil size={13} color={T.muted} />
                            </button>
                            <button onClick={() => deleteEntry(e)} aria-label="Delete entry">
                              <Trash2 size={13} color={T.redstone} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="text-center mt-4" style={{ color: T.muted, fontSize: "0.68rem" }}>
          {saving ? "SAVING…" : "SYNCED"}
        </div>
      </div>
    </div>
  );
}
