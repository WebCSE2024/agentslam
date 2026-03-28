import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import { Play, Pause, RotateCcw, MessageSquareText, Radio, Timer, Zap } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserContext } from "@/contexts/UserContext";
import { activateMatch, cancelMatch, getMatchInfo, pauseMatch, resumeMatch, startMatch } from "@/api/matchApi";

const SOCKET_MESSAGE_TYPE = {
  WELCOME: "welcome",
  USER_JOINED: "user-joined",
  USER_LEFT: "user-left",
  INFO: "info",
  ERROR: "error",
  MATCH_UPDATE: "match-update",
  MATCH_STATE: "match-state",
  MATCH_PAUSED: "match-paused",
  MATCH_RESUMED: "match-resumed",
  MATCH_FINISH: "match-finish",
  DEBATE_MESSAGE: "debate-message",
  PREVIOUS_MESSAGE: "previous-message",
};

const displayStatus = (status) => {
  if (status === "started") return "running";
  return status || "unknown";
};

const statusClass = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-amber-100 text-amber-700 border-amber-200",
  started: "bg-emerald-100 text-emerald-700 border-emerald-200",
  paused: "bg-orange-100 text-orange-700 border-orange-200",
  completed: "bg-violet-100 text-violet-700 border-violet-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

const toWsUrl = (matchId) => {
  const backendUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:8000";
  const wsBase = backendUrl.startsWith("https://")
    ? backendUrl.replace("https://", "wss://")
    : backendUrl.replace("http://", "ws://");
  return `${wsBase}/ws?matchId=${encodeURIComponent(matchId)}`;
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

const fmtCountdown = (ms) => {
  const safe = Math.max(0, Number(ms || 0));
  const totalSec = Math.floor(safe / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const { user } = useContext(UserContext);
  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  const [matchInfo, setMatchInfo] = useState(null);
  const [matchState, setMatchState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [actionBusy, setActionBusy] = useState(null);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [resultBusy, setResultBusy] = useState(false);
  const [resultForm, setResultForm] = useState({ winner: "" });

  const wsRef = useRef(null);
  const scrollRef = useRef(null);

  const team1Name = matchState?.team1 || matchInfo?.opponents?.team1?.user?.name || "TEAM 1";
  const team2Name = matchState?.team2 || matchInfo?.opponents?.team2?.user?.name || "TEAM 2";

  const appendMessage = useCallback((entry) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...entry,
      },
    ]);
  }, []);

  const loadMatchInfo = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    try {
      const res = await getMatchInfo(matchId);
      const data = res?.data ?? res;
      setMatchInfo(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load match info.");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadMatchInfo();
  }, [loadMatchInfo]);

  useEffect(() => {
    if (!matchId) return;

    const ws = new WebSocket(toWsUrl(matchId));
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => {
      setWsConnected(false);
    };

    ws.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      const type = payload?.type || "info";
      const from = payload?.from || payload?.data?.from || "system";
      const timestamp = payload?.timestamp || payload?.data?.timestamp || new Date().toISOString();
      const text = payload?.data?.message;

      if (type === SOCKET_MESSAGE_TYPE.MATCH_STATE) {
        const stateData = payload?.data || null;
        const isRunning = stateData?.status === "started";
        const nextTurn = isRunning && (stateData?.turn === "team1" || stateData?.turn === "team2")
          ? stateData.turn
          : null;
        setMatchState({ ...(stateData || {}), turn: nextTurn });
        return;
      }

      if (type === SOCKET_MESSAGE_TYPE.PREVIOUS_MESSAGE) {
        if (text) {
          appendMessage({ type, from, timestamp, text });
        }

        const conversations = Array.isArray(payload?.data?.conversations) ? payload.data.conversations : [];
        if (conversations.length) {
          conversations.forEach((conv) => {
            appendMessage({
              type: SOCKET_MESSAGE_TYPE.DEBATE_MESSAGE,
              from: conv?.team || "system",
              timestamp: conv?.timestamp || timestamp,
              text: conv?.message || "",
            });
          });
        }
        return;
      }

      if (type === SOCKET_MESSAGE_TYPE.INFO && text === "acknowledged") {
        return;
      }

      if (type === SOCKET_MESSAGE_TYPE.USER_JOINED || type === SOCKET_MESSAGE_TYPE.USER_LEFT) {
        appendMessage({
          type,
          from: "system",
          timestamp,
          text: text || (type === SOCKET_MESSAGE_TYPE.USER_JOINED ? "A user joined the match." : "A user left the match."),
        });
        return;
      }

      if (text) {
        appendMessage({ type, from, timestamp, text });
      }

      if (
        type === SOCKET_MESSAGE_TYPE.MATCH_PAUSED
        || type === SOCKET_MESSAGE_TYPE.MATCH_RESUMED
        || type === SOCKET_MESSAGE_TYPE.MATCH_FINISH
      ) {
        loadMatchInfo();
      }
    };

    return () => {
      try {
        ws.close();
      } catch {
        // no-op
      }
    };
  }, [appendMessage, loadMatchInfo, matchId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const status = matchInfo?.matchStatus;
    const finishTime = Number(matchInfo?.finishTime || 0);
    const pausedRemaining = Number(matchInfo?.remainingTime || 0);

    if (status === "paused") {
      setTimeLeftMs(pausedRemaining);
      return undefined;
    }

    if (status === "started" && finishTime > 0) {
      const sync = () => setTimeLeftMs(Math.max(0, finishTime - Date.now()));
      sync();
      const id = setInterval(sync, 250);
      return () => clearInterval(id);
    }

    setTimeLeftMs(0);
    return undefined;
  }, [matchInfo?.finishTime, matchInfo?.matchStatus, matchInfo?.remainingTime]);

  const onAdminAction = useCallback(async (type) => {
    if (!matchId) return;
    setActionBusy(type);
    try {
      let res;
      if (type === "activate") res = await activateMatch(matchId);
      if (type === "start") res = await startMatch(matchId);
      if (type === "pause") res = await pauseMatch(matchId);
      if (type === "resume") res = await resumeMatch(matchId);
      toast.success(res?.message || `${type} successful.`);
      await loadMatchInfo();
    } catch (err) {
      toast.error(err?.response?.data?.message || `Failed to ${type} match.`);
    } finally {
      setActionBusy(null);
    }
  }, [loadMatchInfo, matchId]);

  const onResultFieldChange = useCallback((field, value) => {
    setResultForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const submitInlineResult = useCallback(async () => {
    if (!matchId) return;

    const winner = resultForm.winner;

    if (winner !== "team1" && winner !== "team2" && winner !== "none") {
      toast.error("Please select team1, team2, or none.");
      return;
    }

    setResultBusy(true);
    try {
      const res = await cancelMatch(matchId, { winner });
      toast.success(res?.message || "Match cancelled successfully.");
      await loadMatchInfo();
      setResultForm({ winner: "" });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to cancel match.");
    } finally {
      setResultBusy(false);
    }
  }, [loadMatchInfo, matchId, resultForm.winner]);

  const effectiveStatus = matchInfo?.matchStatus || matchState?.status;
  const currentTurn =
    effectiveStatus === "started" && (matchState?.turn === "team1" || matchState?.turn === "team2")
      ? matchState.turn
      : null;
  const canStart = effectiveStatus === "active";
  const canPause = effectiveStatus === "started";
  const canResume = effectiveStatus === "paused";
  const canShowInlineResultForm = isAdmin && effectiveStatus !== "completed" && effectiveStatus !== "cancelled";
  const dbStartTime = Number(matchInfo?.matchStartTime || 0);
  const dbFinishTime = Number(matchInfo?.finishTime || 0);
  const winnerDisplay = useMemo(() => {
    const winnerName = matchInfo?.winner?.name ? String(matchInfo.winner.name).toUpperCase() : "";
    if (effectiveStatus === "cancelled") return winnerName || "NONE";
    if (effectiveStatus === "completed") return winnerName || "—";
    return "Not yet completed";
  }, [effectiveStatus, matchInfo?.winner?.name]);
  const scoreDisplay = useMemo(() => {
    if (effectiveStatus !== "completed" && effectiveStatus !== "cancelled") return "Not yet completed";
    return `${matchInfo?.scores?.team1 ?? 0} - ${matchInfo?.scores?.team2 ?? 0}`;
  }, [effectiveStatus, matchInfo?.scores?.team1, matchInfo?.scores?.team2]);

  const roleByTeam = useMemo(() => {
    const prosTeam = matchState?.pros;
    const consTeam = matchState?.cons;

    const team1TopicType = String(matchInfo?.opponents?.team1?.topicType || "").toUpperCase();
    const team2TopicType = String(matchInfo?.opponents?.team2?.topicType || "").toUpperCase();

    const fallbackTeam1 = team1TopicType === "PROS" ? "PROS" : team1TopicType === "CONS" ? "CONS" : "—";
    const fallbackTeam2 = team2TopicType === "PROS" ? "PROS" : team2TopicType === "CONS" ? "CONS" : "—";

    return {
      team1: prosTeam === "team1" ? "PROS" : consTeam === "team1" ? "CONS" : fallbackTeam1,
      team2: prosTeam === "team2" ? "PROS" : consTeam === "team2" ? "CONS" : fallbackTeam2,
    };
  }, [matchInfo?.opponents?.team1?.topicType, matchInfo?.opponents?.team2?.topicType, matchState]);

  const conversationMessages = useMemo(() => {
    const liveDebateMessages = messages
      .filter((msg) => msg?.type === SOCKET_MESSAGE_TYPE.DEBATE_MESSAGE && (msg?.from === "team1" || msg?.from === "team2"))
      .map((msg, idx) => ({
        id: msg.id || `live-${idx}`,
        team: msg.from,
        timestamp: msg.timestamp,
        text: msg.text || "",
        order: idx,
      }));

    if (liveDebateMessages.length > 0) {
      return [...liveDebateMessages].sort((a, b) => {
        const ta = new Date(a.timestamp || 0).getTime();
        const tb = new Date(b.timestamp || 0).getTime();
        const aValid = !Number.isNaN(ta);
        const bValid = !Number.isNaN(tb);

        if (aValid && bValid && ta !== tb) return ta - tb;
        if (aValid && !bValid) return -1;
        if (!aValid && bValid) return 1;
        return a.order - b.order;
      });
    }

    const dbConversations = Array.isArray(matchInfo?.conversations) ? matchInfo.conversations : [];
    return dbConversations
      .map((conv, idx) => ({
        id: `db-${idx}`,
        team: conv?.team,
        timestamp: conv?.timestamp,
        text: conv?.message || "",
        order: idx,
      }))
      .filter((msg) => msg.team === "team1" || msg.team === "team2")
      .sort((a, b) => {
        const ta = new Date(a.timestamp || 0).getTime();
        const tb = new Date(b.timestamp || 0).getTime();
        const aValid = !Number.isNaN(ta);
        const bValid = !Number.isNaN(tb);

        if (aValid && bValid && ta !== tb) return ta - tb;
        if (aValid && !bValid) return -1;
        if (!aValid && bValid) return 1;
        return a.order - b.order;
      });
  }, [matchInfo?.conversations, messages]);

  return (
    <div className="w-full px-6 md:px-10 py-8 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900">
              {team1Name} VS {team2Name}
            </h1>
            <p className="text-sm text-slate-600 font-medium">
              Round: {matchInfo?.round?.roundName || matchInfo?.round?.name || matchState?.round || "—"}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`text-xs px-3 py-1 rounded-full border font-semibold capitalize ${statusClass[effectiveStatus] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
              {displayStatus(effectiveStatus)}
            </span>
            <span className={`text-xs font-medium ${wsConnected ? "text-emerald-600" : "text-rose-600"}`}>
              {wsConnected ? "WS Connected" : "WS Disconnected"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xl font-black text-slate-900">{matchInfo?.topic?.title || matchState?.topic || "Topic"}</p>
          <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap break-words">
            {matchInfo?.topic?.description || matchState?.description || "No description available."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Winner</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{winnerDisplay}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Scores</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{scoreDisplay}</p>
          </div>
        </div>

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

        {canShowInlineResultForm && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Cancel Match</h3>

            <div className="space-y-1.5">
              <Label htmlFor="detail-winner-select">Winner</Label>
              <select
                id="detail-winner-select"
                className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={resultForm.winner}
                onChange={(e) => onResultFieldChange("winner", e.target.value)}
                disabled={resultBusy}
              >
                <option value="">Select winner</option>
                <option value="team1">{team1Name} (team1)</option>
                <option value="team2">{team2Name} (team2)</option>
                <option value="none">None (both absent)</option>
              </select>
            </div>

            <div className="pt-1">
              <Button type="button" onClick={submitInlineResult} disabled={resultBusy}>
                {resultBusy ? "Cancelling..." : "Confirm Cancel"}
              </Button>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="flex flex-wrap gap-3 pt-1">
            <Button variant="secondary" onClick={() => onAdminAction("activate")} disabled={actionBusy !== null} className="gap-2">
              {actionBusy === "activate" ? <><Radio className="h-4 w-4 animate-pulse" /> Activating…</> : <><Zap className="h-4 w-4" /> Activate</>}
            </Button>
            <Button onClick={() => onAdminAction("start")} disabled={!canStart || actionBusy !== null} className="gap-2">
              {actionBusy === "start" ? <><Radio className="h-4 w-4 animate-pulse" /> Starting…</> : <><Play className="h-4 w-4" /> Start</>}
            </Button>
            <Button variant="secondary" onClick={() => onAdminAction("pause")} disabled={!canPause || actionBusy !== null} className="gap-2">
              {actionBusy === "pause" ? <><Radio className="h-4 w-4 animate-pulse" /> Pausing…</> : <><Pause className="h-4 w-4" /> Pause</>}
            </Button>
            <Button variant="outline" onClick={() => onAdminAction("resume")} disabled={!canResume || actionBusy !== null} className="gap-2">
              {actionBusy === "resume" ? <><Radio className="h-4 w-4 animate-pulse" /> Resuming…</> : <><RotateCcw className="h-4 w-4" /> Resume</>}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-black uppercase tracking-wide text-slate-900">Speaking Turn</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {["team1", "team2"].map((team) => {
              const isMatchRunning = effectiveStatus === "started" && timeLeftMs > 0;
              const isActive = isMatchRunning && currentTurn === team;
              const name = team === "team1" ? team1Name : team2Name;
              const role = team === "team1" ? roleByTeam.team1 : roleByTeam.team2;

              return (
                <motion.div
                  key={team}
                  animate={{ scale: isActive ? 1.03 : 1, opacity: isActive ? 1 : isMatchRunning ? 0.55 : 0.45 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18 }}
                  className={`rounded-2xl border p-5 ${isActive ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
                >
                  <div
                    className={`relative mx-auto h-24 w-24 rounded-full border-4 flex items-center justify-center font-black text-xl uppercase tracking-wide ${
                      isActive ? "border-emerald-500 bg-white text-emerald-700 shadow" : "border-slate-300 bg-white text-slate-400"
                    }`}
                  >
                    {isActive && (
                      <>
                        <motion.span
                          className="absolute inset-0 rounded-full border-2 border-emerald-400"
                          initial={{ scale: 1, opacity: 0.8 }}
                          animate={{ scale: 1.6, opacity: 0 }}
                          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                        />
                        <motion.span
                          className="absolute inset-0 rounded-full border-2 border-emerald-300"
                          initial={{ scale: 1, opacity: 0.6 }}
                          animate={{ scale: 1.9, opacity: 0 }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.25 }}
                        />
                      </>
                    )}
                    {team}
                  </div>
                  <p className="mt-4 text-center text-base font-bold uppercase text-slate-900 break-words">{name}</p>
                  <p className="mt-1 text-center text-xs font-semibold tracking-wider text-slate-500">{role}</p>
                </motion.div>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Timer className="h-4 w-4" />
              <span className="text-sm font-semibold">Time Left</span>
            </div>
            <span className="text-lg font-black tracking-wider text-slate-900">{fmtCountdown(timeLeftMs)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col min-h-[560px] max-h-[70vh]">
          <div className="border-b border-slate-200 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-black uppercase tracking-wide text-slate-900">Messages</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-bold uppercase">Team1:</span> {team1Name} · {roleByTeam.team1}
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-bold uppercase">Team2:</span> {team2Name} · {roleByTeam.team2}
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
            {loading ? (
              <div className="text-sm text-slate-500">Loading match details…</div>
            ) : (effectiveStatus === "completed" || effectiveStatus === "cancelled") ? (
              conversationMessages.length === 0 ? (
                <div className="text-sm text-slate-500">No messages yet.</div>
              ) : (
                conversationMessages.map((msg) => {
                  const isTeam1 = msg.team === "team1";
                  const senderTeam = isTeam1 ? "TEAM1" : "TEAM2";
                  const senderRole = isTeam1 ? roleByTeam.team1 : roleByTeam.team2;

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isTeam1 ? "justify-start" : "justify-end"}`}
                    >
                      <div className={`max-w-[85%] rounded-xl border px-3 py-2.5 ${isTeam1 ? "border-blue-200 bg-blue-50" : "border-pink-200 bg-pink-50"}`}>
                        <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">{msg.text}</p>
                        <div className="mt-2 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold uppercase">{senderTeam} · {senderRole}</span>
                          <span>•</span>
                          <span>{fmtTime(msg.timestamp)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )
            ) : messages.length === 0 ? (
              <div className="text-sm text-slate-500">No messages yet.</div>
            ) : (
              messages.map((msg) => {
                const senderCls = msg.from === "team1"
                  ? "border-blue-200 bg-blue-50"
                  : msg.from === "team2"
                    ? "border-purple-200 bg-purple-50"
                    : "border-slate-200 bg-white";

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border px-3 py-2.5 ${senderCls}`}
                  >
                    <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">{msg.text}</p>
                    <div className="mt-2 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold uppercase">{msg.from}</span>
                      <span>•</span>
                      <span>{fmtTime(msg.timestamp)}</span>
                      <span>•</span>
                      <span className="capitalize">{msg.type}</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
