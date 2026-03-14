import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { Trophy, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getLeaderBoard,
  getRoundSummary,
  refreshLeaderBoard,
} from "@/api/roundApi";

export default function LeaderboardPage() {
  const [summary, setSummary] = useState({ completedRounds: 0, ongoingRoundName: null });
  const [leaderBoard, setLeaderBoard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const res = await getRoundSummary();
      const data = res?.data ?? {};
      setSummary({
        completedRounds: Number(data?.completedRounds || 0),
        ongoingRoundName: data?.ongoingRoundName || null,
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load round summary.");
    }
  }, []);

  const loadLeaderBoard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLeaderBoard();
      setLeaderBoard(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load leaderboard.");
      setLeaderBoard([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadLeaderBoard();
  }, [loadSummary, loadLeaderBoard]);

  const regenerateLeaderBoard = async () => {
    setRegenerating(true);
    try {
      const res = await refreshLeaderBoard();
      toast.success(res?.message || "Leaderboard regenerated successfully.");
      await Promise.all([loadLeaderBoard(), loadSummary()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to regenerate leaderboard.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black tracking-tight font-heading uppercase">Leaderboard</h1>
        <p className="text-sm text-muted-foreground mt-1">View standings, reload and regenerate leaderboard</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-border shadow-sm"
      >
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
        <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <h2 className="font-bold text-base">Standings</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadLeaderBoard}
              disabled={loading || regenerating}
              className="gap-1.5"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Reload
            </Button>

            <Button
              size="sm"
              onClick={regenerateLeaderBoard}
              disabled={regenerating || loading}
              className="gap-1.5"
            >
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Regenerate
            </Button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Completed Rounds</p>
              <p className="text-2xl font-black mt-1">{summary.completedRounds}</p>
            </div>
            <div className="rounded-xl border border-border bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Current Ongoing Round</p>
              <p className="text-lg font-bold mt-1">{summary.ongoingRoundName || "—"}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading leaderboard...
            </div>
          ) : leaderBoard.length === 0 ? (
            <div className="text-sm text-muted-foreground">No leaderboard data found.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-border text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rank</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderBoard.map((item, idx) => (
                    <tr key={`${item.name}-${idx}`} className="border-b border-border last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold">#{idx + 1}</td>
                      <td className="px-4 py-3">{item.name}</td>
                      <td className="px-4 py-3">{item.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
