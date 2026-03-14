import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Swords, Target, CircleCheckBig, Play, Sparkles, X } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activateMatch, getAllMatches, updateMatchResult } from "@/api/matchApi";
import { UserContext } from "@/contexts/UserContext";

const ROUND_STATUS = {
  ONGOING: "ongoing",
  COMPLETED: "completed",
};

const MATCH_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  STARTED: "started",
  PAUSED: "paused",
  COMPLETED: "completed",
};

const bgByStatus = {
  created: "from-sky-500 to-indigo-500",
  activated: "from-amber-500 to-orange-500",
  started: "from-violet-500 to-fuchsia-500",
  completed: "from-emerald-500 to-teal-500",
};

const badgeByStatus = {
  created: "bg-sky-100 text-sky-700 border-sky-200",
  activated: "bg-amber-100 text-amber-700 border-amber-200",
  started: "bg-violet-100 text-violet-700 border-violet-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const canEnterStatuses = new Set(["activated", "started"]);

export default function CommonMatchesPage() {
  const { user } = useContext(UserContext);
  const isAdmin = ["admin", "super_admin"].includes(user?.role);
  const navigate = useNavigate();

  const [currentRound, setCurrentRound] = useState('None')
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activatingMatchId, setActivatingMatchId] = useState(null);
  const [resultModalMatch, setResultModalMatch] = useState(null);
  const [resultBusy, setResultBusy] = useState(false);
  const [resultForm, setResultForm] = useState({ team1: "", team2: "", winner: "" });

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllMatches();
      setMatches(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const handleActivate = useCallback(async (matchId) => {
    if (!matchId) return;
    setActivatingMatchId(matchId);
    try {
      const res = await activateMatch(matchId);
      toast.success(res?.message || "Match activated successfully.");
      await loadMatches();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to activate match.");
    } finally {
      setActivatingMatchId(null);
    }
  }, [loadMatches]);

  const openResultModal = useCallback((match) => {
    if (!match) return;
    setResultModalMatch(match);
    setResultForm({
      team1: Number.isFinite(match?.scores?.team1) ? String(match.scores.team1) : "",
      team2: Number.isFinite(match?.scores?.team2) ? String(match.scores.team2) : "",
      winner: "",
    });
  }, []);

  const closeResultModal = useCallback(() => {
    setResultModalMatch(null);
    setResultForm({ team1: "", team2: "", winner: "" });
  }, []);

  const onResultFieldChange = useCallback((field, value) => {
    setResultForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const submitResult = useCallback(async () => {
    if (!resultModalMatch?._id) return;

    const team1 = Number(resultForm.team1);
    const team2 = Number(resultForm.team2);
    const winner = resultForm.winner;

    if (!Number.isFinite(team1) || !Number.isFinite(team2)) {
      toast.error("Please enter valid numeric scores for both teams.");
      return;
    }

    if (team1 < 0 || team2 < 0) {
      toast.error("Scores cannot be negative.");
      return;
    }

    if (winner !== "team1" && winner !== "team2") {
      toast.error("Please select a winner.");
      return;
    }

    setResultBusy(true);
    try {
      const res = await updateMatchResult(resultModalMatch._id, {
        scores: { team1, team2 },
        winner,
      });
      toast.success(res?.message || "Match result updated successfully.");
      closeResultModal();
      await loadMatches();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update match result.");
    } finally {
      setResultBusy(false);
    }
  }, [closeResultModal, loadMatches, resultForm.team1, resultForm.team2, resultForm.winner, resultModalMatch]);

  const roundWiseMatches = useMemo(() => {
    const statusToDisplay = {
      [MATCH_STATUS.PENDING]: "created",
      [MATCH_STATUS.ACTIVE]: "activated",
      [MATCH_STATUS.STARTED]: "started",
      [MATCH_STATUS.PAUSED]: "started",
      [MATCH_STATUS.COMPLETED]: "completed",
    };

    const grouped = new Map();

    for (const m of matches) {
      const roundId = m?.round?._id || "unknown";
      if (!grouped.has(roundId)) {
        grouped.set(roundId, {
          roundId,
          roundName: m?.round?.roundName || "Unknown Round",
          roundStatus: m?.round?.roundStatus || "created",
          roundCreatedAt: m?.round?.createdAt || null,
          matches: [],
        });
      }

      grouped.get(roundId).matches.push({
        _id: m?._id,
        team1: m?.opponents?.team1?.user?.name || "Team 1",
        team2: m?.opponents?.team2?.user?.name || "Team 2",
        displayStatus: statusToDisplay[m?.matchStatus] || "created",
        winner: m?.winner?.name ? String(m.winner.name).toUpperCase() : null,
        scores: m?.scores || null,
        createdAt: m?.createdAt,
      });
    }

    const groups = Array.from(grouped.values());
    const ongoing = groups.filter((g) => g.roundStatus === ROUND_STATUS.ONGOING);
    if (ongoing.length > 0) setCurrentRound(ongoing[0].roundName);
    else setCurrentRound("None");
    const others = groups
      .filter((g) => g.roundStatus !== ROUND_STATUS.ONGOING)
      .sort((a, b) => {
        const ta = a.roundCreatedAt ? new Date(a.roundCreatedAt).getTime() : 0;
        const tb = b.roundCreatedAt ? new Date(b.roundCreatedAt).getTime() : 0;
        return tb - ta;
      });

    return [...ongoing, ...others].map((group) => ({
      ...group,
      matches: [...group.matches].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      }),
    }));
  }, [matches]);

  const totalMatches = useMemo(() => matches.length, [matches]);

  return (
    <div className="relative w-full max-w-7xl mx-auto px-6 py-8 md:px-8 md:py-10 space-y-8 overflow-hidden">
      <div className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-20 -right-12 h-44 w-44 rounded-full bg-cyan-200/40 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-indigo-50 p-6 shadow-sm"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              <span className="text-xs font-bold tracking-wider uppercase text-violet-600">Live Match Hub</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight font-heading uppercase text-slate-900">Matches</h1>
          </div>
          <Button variant="outline" size="sm" onClick={loadMatches} disabled={loading} className="border-violet-200 hover:border-violet-400">
            {loading ? "Loading..." : "Reload"}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Rounds</p>
          <p className="text-3xl font-black mt-1 text-slate-900">{roundWiseMatches.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Matches</p>
          <p className="text-3xl font-black mt-1 text-slate-900">{totalMatches}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Current Round</p>
          <p className="text-3xl font-black mt-1 text-slate-900">{currentRound}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading matches...</div>
      ) : roundWiseMatches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground bg-white">
          No matches found.
        </div>
      ) : (
        <div className="space-y-8">
          {roundWiseMatches.map((group) => (
            <section key={group.roundId} className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <CircleCheckBig className="h-5 w-5 text-indigo-600" />
                <h2 className="text-xl font-black tracking-tight uppercase text-slate-900">{group.roundName}</h2>
                <span className="text-xs px-2.5 py-1 rounded-full border bg-slate-100 text-slate-700 capitalize font-semibold">{group.roundStatus}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.matches?.map((m, idx) => {
                  const displayStatus = m.displayStatus || "created";
                  const bg = bgByStatus[displayStatus] || bgByStatus.created;
                  const statusBadge = badgeByStatus[displayStatus] || badgeByStatus.created;

                  return (
                    <motion.div
                      key={m._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      whileHover={{ y: -4, scale: 1.01 }}
                      className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white hover:shadow-lg transition-all"
                    >
                      <div className={`h-2 w-full bg-gradient-to-r ${bg}`} />
                      <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg md:text-xl">
                            <Swords className="h-4 w-4" />
                            <span className="truncate uppercase tracking-wide">{m.team1} vs {m.team2}</span>
                          </div>
                          <span className={`text-[11px] px-2 py-1 rounded-full border capitalize font-semibold ${statusBadge}`}>
                            {displayStatus}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Winner</p>
                            <p className="text-sm font-bold text-slate-900 mt-0.5">{m.winner || "Not yet completed"}</p>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Target className="h-3.5 w-3.5" />
                              <p className="text-[11px] uppercase tracking-wider font-semibold">Scores</p>
                            </div>
                            <p className="text-sm font-bold text-slate-900 mt-0.5">
                              {displayStatus === "completed" && m.scores
                                ? `${m.scores.team1 ?? 0} - ${m.scores.team2 ?? 0}`
                                : "Not yet completed"}
                            </p>
                          </div>
                        </div>

                        <div className="pt-1">
                          {isAdmin && displayStatus === "created" && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="gap-2 mr-2"
                                onClick={() => handleActivate(m._id)}
                                disabled={activatingMatchId === m._id}
                              >
                                {activatingMatchId === m._id ? "Activating..." : "Activate"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 mr-2"
                                onClick={() => openResultModal(m)}
                              >
                                Update Result
                              </Button>
                            </>
                          )}
                          {canEnterStatuses.has(displayStatus) ? (
                            <Button
                              size="sm"
                              className="gap-2 bg-slate-900 hover:bg-black text-white"
                              onClick={() => navigate(isAdmin ? `/admin/matches/${m._id}` : `/matches/${m._id}`)}
                            >
                              <Play className="h-4 w-4" /> Enter
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled>
                              Enter
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {isAdmin && resultModalMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-black uppercase tracking-wide text-slate-900">Update Pending Match Result</h3>
              <button
                type="button"
                onClick={closeResultModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-slate-600 font-medium">
                {resultModalMatch.team1} vs {resultModalMatch.team2}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pending-score-team1">Score: {resultModalMatch.team1} (team1)</Label>
                  <Input
                    id="pending-score-team1"
                    type="number"
                    min="0"
                    value={resultForm.team1}
                    onChange={(e) => onResultFieldChange("team1", e.target.value)}
                    placeholder="Enter score"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pending-score-team2">Score: {resultModalMatch.team2} (team2)</Label>
                  <Input
                    id="pending-score-team2"
                    type="number"
                    min="0"
                    value={resultForm.team2}
                    onChange={(e) => onResultFieldChange("team2", e.target.value)}
                    placeholder="Enter score"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pending-winner-select">Winner</Label>
                <select
                  id="pending-winner-select"
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={resultForm.winner}
                  onChange={(e) => onResultFieldChange("winner", e.target.value)}
                >
                  <option value="">Select winner</option>
                  <option value="team1">{resultModalMatch.team1} (team1)</option>
                  <option value="team2">{resultModalMatch.team2} (team2)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <Button type="button" variant="outline" onClick={closeResultModal} disabled={resultBusy}>
                Cancel
              </Button>
              <Button type="button" onClick={submitResult} disabled={resultBusy}>
                {resultBusy ? "Saving..." : "Save Result"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
