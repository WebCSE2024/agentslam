import { useCallback, useContext, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Mail, Hash, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { UserContext } from "@/contexts/UserContext";
import { getLeaderBoard } from "@/api/roundApi";

export default function HomePage() {
  const { user } = useContext(UserContext);
  const [leaderBoard, setLeaderBoard] = useState([]);
  const [loadingLeaderBoard, setLoadingLeaderBoard] = useState(false);

  const loadLeaderBoard = useCallback(async () => {
    setLoadingLeaderBoard(true);
    try {
      const res = await getLeaderBoard();
      setLeaderBoard(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load leaderboard.");
      setLeaderBoard([]);
    } finally {
      setLoadingLeaderBoard(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderBoard();
  }, [loadLeaderBoard]);

  const stats = [
    {
      icon: Mail,
      label: "User Email",
      value: user?.email || "—",
      valueClass: "text-base",
    },
    {
      icon: Hash,
      label: "Admission Number",
      value: user?.admissionNumber || "—",
      valueClass: "text-xl",
    },
    {
      icon: Trophy,
      label: "Your Points",
      value: Number(user?.tournamentPoints || 0),
      valueClass: "text-2xl",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="h-12 w-12 rounded-2xl bg-black flex items-center justify-center border border-slate-800 shadow">
            <img
              src="/banner.png"
              alt="AgentSlam banner"
              className="h-full w-full rounded-2xl object-cover"
            />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight font-heading">
              Welcome,{" "}
              <span className="text-primary">{user?.name || "Participant"}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AgentSlam 2026 — Dashboard
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mt-6" />
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {stats.map(({ icon: Icon, label, value, valueClass }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i, duration: 0.4 }}
            className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card shadow-sm"
          >
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className={`${valueClass} font-black font-heading truncate`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Leaderboard */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <h2 className="font-bold text-base">Current Leaderboard</h2>
            <p className="text-xs text-muted-foreground">Live standings for this round</p>
          </div>
        </div>

        <div className="px-6 py-6">
          {loadingLeaderBoard ? (
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
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderBoard.map((item, idx) => (
                    <tr key={`${item.name}-${idx}`} className="border-b border-border last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold">#{idx + 1}</td>
                      <td className="px-4 py-3 uppercase">{item.name}</td>
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
