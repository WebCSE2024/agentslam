import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquareText, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { getPublicMatchById } from "@/api/publicMatchApi";

const statusClass = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-amber-100 text-amber-700 border-amber-200",
  started: "bg-emerald-100 text-emerald-700 border-emerald-200",
  paused: "bg-orange-100 text-orange-700 border-orange-200",
  completed: "bg-violet-100 text-violet-700 border-violet-200",
};

const displayStatus = (status) => {
  if (status === "started") return "running";
  return status || "unknown";
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
};

const fmtEpoch = (value) => {
  const ms = Number(value || 0);
  if (!ms) return "—";
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
};

export default function PublicMatchConversationPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [matchInfo, setMatchInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadMatch = useCallback(async ({ silent = false } = {}) => {
    if (!matchId) return;

    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await getPublicMatchById(matchId);
      const data = res?.data ?? res;
      setMatchInfo(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load match info.");
      navigate("/public/matches", { replace: true });
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [matchId, navigate]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  const effectiveStatus = matchInfo?.matchStatus;
  const canRefresh = effectiveStatus && effectiveStatus !== "completed";

  const team1Name = matchInfo?.team1?.user?.name || "TEAM 1";
  const team2Name = matchInfo?.team2?.user?.name || "TEAM 2";

  const team1Role = matchInfo?.prosTeam === "team1" ? "PROS" : "CONS";
  const team2Role = matchInfo?.prosTeam === "team2" ? "PROS" : "CONS";
  const dbStartTime = Number(matchInfo?.matchStartTime || 0);
  const dbFinishTime = Number(matchInfo?.finishTime || 0);

  const orderedMessages = useMemo(() => {
    const conversations = Array.isArray(matchInfo?.conversations) ? matchInfo.conversations : [];

    return conversations
      .map((msg, idx) => ({ ...msg, __idx: idx }))
      .sort((a, b) => {
        const aTime = new Date(a?.timestamp || 0).getTime();
        const bTime = new Date(b?.timestamp || 0).getTime();

        const aValid = !Number.isNaN(aTime);
        const bValid = !Number.isNaN(bTime);

        if (aValid && bValid && aTime !== bTime) return aTime - bTime;
        if (aValid && !bValid) return -1;
        if (!aValid && bValid) return 1;
        return a.__idx - b.__idx;
      });
  }, [matchInfo?.conversations]);

  return (
    <div className="w-full px-6 md:px-10 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" className="gap-2" onClick={() => navigate("/public/matches")}>
          <ArrowLeft className="h-4 w-4" /> Back to Matches
        </Button>
        {canRefresh && (
          <Button variant="outline" className="gap-2" onClick={() => loadMatch({ silent: true })} disabled={refreshing || loading}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900">
              {team1Name} VS {team2Name}
            </h1>
            <p className="text-sm text-slate-600 font-medium">
              Round: {matchInfo?.round?.roundName || "—"}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`text-xs px-3 py-1 rounded-full border font-semibold capitalize ${statusClass[effectiveStatus] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
              {displayStatus(effectiveStatus)}
            </span>
            <span className="text-xs font-medium text-slate-500">Public conversation view</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xl font-black text-slate-900">{matchInfo?.topic?.title || "Topic"}</p>
          <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap break-words">
            {matchInfo?.topic?.description || "No description available."}
          </p>
        </div>

        {effectiveStatus === "completed" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Winner</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{matchInfo?.winner?.name || "—"}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Score</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {(matchInfo?.scores?.team1 ?? 0)} - {(matchInfo?.scores?.team2 ?? 0)}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Start Time</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{fmtEpoch(dbStartTime)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Finish Time</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{fmtEpoch(dbFinishTime)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col min-h-[560px] max-h-[72vh]">
        <div className="border-b border-slate-200 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-black uppercase tracking-wide text-slate-900">Conversation</h2>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <span className="font-bold uppercase">Team1:</span> {team1Name} ({team1Role})
            <span className="mx-2">•</span>
            <span className="font-bold uppercase">Team2:</span> {team2Name} ({team2Role})
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
          {loading ? (
            <div className="text-sm text-slate-500">Loading conversations…</div>
          ) : orderedMessages.length === 0 ? (
            <div className="text-sm text-slate-500">No messages yet.</div>
          ) : (
            orderedMessages.map((msg, idx) => {
              const isTeam1 = msg?.team === "team1";
              const senderTeam = isTeam1 ? "TEAM1" : "TEAM2";
              const senderRole = isTeam1 ? team1Role : team2Role;
              const senderName = msg?.user?.name || "User";

              return (
                <motion.div
                  key={`chat-${idx}-${msg.timestamp || idx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isTeam1 ? "justify-start" : "justify-end"}`}
                >
                  <div className={`max-w-[85%] rounded-xl border px-3 py-2.5 ${isTeam1 ? "border-blue-200 bg-blue-50" : "border-pink-200 bg-pink-50"}`}>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">{msg.message}</p>
                    <div className="mt-2 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold uppercase">{senderTeam} · {senderName} · {senderRole}</span>
                      <span>•</span>
                      <span>{fmtTime(msg.timestamp)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
