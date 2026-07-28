"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, ChevronLeft, ChevronRight, Gem, Receipt, Pencil, Plus, X, Hammer, Box } from "lucide-react";

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

const STORAGE_KEY = "chore-dashboard-data";
const DAILY_BONUS = 2;

function dateKey(d) {
  return d.toISOString().slice(0, 10);
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
      };
      if (patch.boys) setBoys(patch.boys);
      if (patch.chores) setChores(patch.chores);
      if (patch.completions) setCompletions(patch.completions);
      if (patch.ledger) setLedger(patch.ledger);
      persist(next);
    },
    [boys, chores, completions, ledger, persist]
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

  function getCompletionMap(dKey, boyId) {
    return completions[`${dKey}|${boyId}`] || {};
  }

  function toggleChore(boyId, choreId) {
    const key = `${selectedDate}|${boyId}`;
    const current = { ...(completions[key] || {}) };
    current[choreId] = !current[choreId];

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

    saveAll({ completions: nextCompletions, ledger: nextLedger });
  }

  function payOut(boyId) {
    const balance = balances[boyId] || 0;
    if (balance <= 0) return;
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

  function renameBoy(boyId, name) {
    const nextBoys = boys.map((b) => (b.id === boyId ? { ...b, name } : b));
    saveAll({ boys: nextBoys });
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
                              }}
                            >
                              {chore.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

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
                  </div>
                );
              })}
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
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between px-3 py-2"
                      style={{ ...pixelBorder(T.stoneDark, "#222220", "#222220", 1), fontSize: "0.82rem" }}
                    >
                      <div className="flex items-center gap-3">
                        <span style={{ color: T.muted, width: 90, display: "inline-block" }}>
                          {prettyDate(e.date)}
                        </span>
                        <span style={{ color: boy?.accent || T.cream, fontWeight: 700 }}>{boy?.name || "—"}</span>
                        <span style={{ color: T.muted }}>{e.reason}</span>
                      </div>
                      <span
                        className="flex items-center gap-1"
                        style={{ fontWeight: 800, color: positive ? T.emerald : T.redstone }}
                      >
                        {positive ? "+" : "−"}
                        <Gem size={12} />
                        {Math.abs(e.amount).toFixed(2)}
                      </span>
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
