import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CircleCheckBig, ChevronDown, MessageSquareText, Search, Sparkles, Swords, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPublicAllMatches } from "@/api/publicMatchApi";

const bgByStatus = {
  pending: "from-sky-500 to-indigo-500",
  active: "from-amber-500 to-orange-500",
  started: "from-violet-500 to-fuchsia-500",
  paused: "from-orange-500 to-amber-500",
  completed: "from-emerald-500 to-teal-500",
};

const badgeByStatus = {
  pending: "bg-sky-100 text-sky-700 border-sky-200",
  active: "bg-amber-100 text-amber-700 border-amber-200",
  started: "bg-violet-100 text-violet-700 border-violet-200",
  paused: "bg-orange-100 text-orange-700 border-orange-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function PublicMatchesPage() {
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [expandedRoundIds, setExpandedRoundIds] = useState(new Set());

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPublicAllMatches();
      setGroups(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const displayedRoundWiseMatches = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return groups;

    return groups
      .map((group) => {
        const roundHit =
          group.roundName?.toLowerCase().includes(q) ||
          group.roundStatus?.toLowerCase().includes(q);

        if (roundHit) return group;

        const filteredMatches = (group.matches || []).filter((m) => {
          const pair = `${m.team1} vs ${m.team2}`;
          const reversePair = `${m.team2} vs ${m.team1}`;

          return [m.team1, m.team2, m.winner, m.matchStatus, pair, reversePair]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q));
        });

        return { ...group, matches: filteredMatches };
      })
      .filter((group) => group.matches?.length > 0);
  }, [globalSearch, groups]);

  useEffect(() => {
    if (!displayedRoundWiseMatches.length) {
      setExpandedRoundIds(new Set());
      return;
    }

    const topRoundId = displayedRoundWiseMatches[0]?.roundId;
    setExpandedRoundIds((prev) => {
      const next = new Set();
      if (topRoundId) next.add(topRoundId);

      for (const id of prev) {
        if (id !== topRoundId && displayedRoundWiseMatches.some((g) => g.roundId === id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [displayedRoundWiseMatches]);

  const toggleRound = useCallback((roundId) => {
    if (!roundId) return;
    setExpandedRoundIds((prev) => {
      const next = new Set(prev);
      if (next.has(roundId)) next.delete(roundId);
      else next.add(roundId);
      return next;
    });
  }, []);

  const totalMatches = useMemo(
    () => groups.reduce((acc, g) => acc + (g?.matches?.length || 0), 0),
    [groups]
  );

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
              <span className="text-xs font-bold tracking-wider uppercase text-violet-600">Public Match Hub</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight font-heading uppercase text-slate-900">Matches</h1>
          </div>
          <Button variant="outline" size="sm" onClick={loadMatches} disabled={loading} className="border-violet-200 hover:border-violet-400">
            {loading ? "Loading..." : "Reload"}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Rounds</p>
          <p className="text-3xl font-black mt-1 text-slate-900">{groups.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Matches</p>
          <p className="text-3xl font-black mt-1 text-slate-900">{totalMatches}</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Search rounds, teams, winner, status..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading matches...</div>
      ) : displayedRoundWiseMatches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground bg-white">
          No matches found.
        </div>
      ) : (
        <div className="space-y-8">
          {displayedRoundWiseMatches.map((group, index) => {
            const isTopRound = index === 0;
            const isExpanded = isTopRound || expandedRoundIds.has(group.roundId);

            return (
              <section key={group.roundId} className="space-y-4">
                <div
                  className={`flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 ${!isTopRound ? "cursor-pointer" : ""}`}
                  onClick={!isTopRound ? () => toggleRound(group.roundId) : undefined}
                  role={!isTopRound ? "button" : undefined}
                  tabIndex={!isTopRound ? 0 : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CircleCheckBig className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-xl font-black tracking-tight uppercase text-slate-900 truncate">{group.roundName}</h2>
                    <span className="text-xs px-2.5 py-1 rounded-full border bg-slate-100 text-slate-700 capitalize font-semibold">{group.roundStatus}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold">
                      {group.matches.length} match{group.matches.length === 1 ? "" : "es"}
                    </span>
                  </div>

                  {!isTopRound && (
                    <span className="inline-flex items-center justify-center rounded-md border border-slate-200 p-1.5 text-slate-700 bg-white">
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {group.matches?.map((m, idx) => {
                      const status = m.matchStatus || "pending";
                      const bg = bgByStatus[status] || bgByStatus.pending;
                      const statusBadge = badgeByStatus[status] || badgeByStatus.pending;
                      const canOpenConversation = status !== "pending";

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
                                {status}
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
                                  {status === "completed" && m.scores
                                    ? `${m.scores.team1 ?? 0} - ${m.scores.team2 ?? 0}`
                                    : "Not yet completed"}
                                </p>
                              </div>
                            </div>

                            {canOpenConversation ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                onClick={() => navigate(`/public/matches/${m._id}`)}
                              >
                                <MessageSquareText className="h-4 w-4" /> Conversation
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled>
                                Conversation
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
