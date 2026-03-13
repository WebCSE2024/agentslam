import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import {
  Layers,
  PlusCircle,
  Loader2,
  Save,
  RefreshCw,
  BookOpen,
  Trash2,
  FileJson,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createRound,
  getRounds,
  updateRoundName,
  updateRoundStatus,
} from "@/api/roundApi";
import {
  createTopic,
  createTopicsBatch,
  getTopicsByRound,
  updateTopic,
  deleteTopic,
} from "@/api/topicApi";

const ROUND_STATUSES = ["created", "ready", "ongoing", "completed"];

export default function RoundPage() {
  const [roundForm, setRoundForm] = useState({ roundName: "", roundStatus: "created" });
  const [rounds, setRounds] = useState([]);
  const [roundEditRows, setRoundEditRows] = useState({});
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [creatingRound, setCreatingRound] = useState(false);
  const [savingRoundId, setSavingRoundId] = useState(null);

  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [topicForm, setTopicForm] = useState({ title: "", description: "", weights: 1, round: "" });
  const [topicCreateMode, setTopicCreateMode] = useState("single");
  const [topics, setTopics] = useState([]);
  const [topicEditRows, setTopicEditRows] = useState({});
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [creatingTopicBatch, setCreatingTopicBatch] = useState(false);
  const [topicBatchJson, setTopicBatchJson] = useState("");
  const [savingTopicId, setSavingTopicId] = useState(null);
  const [deletingTopicId, setDeletingTopicId] = useState(null);

  const canCreateRound = useMemo(() => roundForm.roundName.trim().length > 0, [roundForm.roundName]);
  const canCreateTopic = useMemo(() => topicForm.title.trim().length > 0 && topicForm.round, [topicForm.title, topicForm.round]);

  const loadRounds = useCallback(async () => {
    setRoundsLoading(true);
    try {
      const res = await getRounds();
      const data = Array.isArray(res?.data) ? res.data : [];
      setRounds(data);

      const nextEdit = {};
      data.forEach((r) => {
        nextEdit[r._id] = {
          roundName: r.roundName || "",
          roundStatus: r.roundStatus || "created",
        };
      });
      setRoundEditRows(nextEdit);

      if (data.length > 0) {
        const defaultRoundId = selectedRoundId || data[0]._id;
        setSelectedRoundId(defaultRoundId);
        setTopicForm((prev) => ({ ...prev, round: prev.round || defaultRoundId }));
      } else {
        setSelectedRoundId("");
        setTopicForm((prev) => ({ ...prev, round: "" }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load rounds.");
    } finally {
      setRoundsLoading(false);
    }
  }, [selectedRoundId]);

  useEffect(() => {
    loadRounds();
  }, [loadRounds]);

  const loadTopics = useCallback(async () => {
    if (!selectedRoundId) {
      setTopics([]);
      setTopicEditRows({});
      return;
    }

    setTopicsLoading(true);
    try {
      const res = await getTopicsByRound(selectedRoundId);
      const data = Array.isArray(res?.data) ? res.data : [];
      setTopics(data);

      const nextEdit = {};
      data.forEach((t) => {
        nextEdit[t._id] = {
          title: t.title || "",
          description: t.description || "",
          weights: t.weights ?? 1,
          round: t.round || selectedRoundId,
        };
      });
      setTopicEditRows(nextEdit);
    } catch (err) {
      if (err?.response?.status === 404) {
        setTopics([]);
        setTopicEditRows({});
        return;
      }
      toast.error(err?.response?.data?.message || "Failed to load topics.");
      setTopics([]);
      setTopicEditRows({});
    } finally {
      setTopicsLoading(false);
    }
  }, [selectedRoundId]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const handleCreateRound = async (e) => {
    e.preventDefault();
    if (!canCreateRound) {
      toast.error("Round name is required.");
      return;
    }

    setCreatingRound(true);
    try {
      const res = await createRound({
        roundName: roundForm.roundName.trim(),
        roundStatus: roundForm.roundStatus,
      });
      toast.success(res?.message || "Round created successfully.");
      setRoundForm({ roundName: "", roundStatus: "created" });
      await loadRounds();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create round.");
    } finally {
      setCreatingRound(false);
    }
  };

  const setRoundField = (roundId, field, value) => {
    setRoundEditRows((prev) => ({
      ...prev,
      [roundId]: {
        ...prev[roundId],
        [field]: value,
      },
    }));
  };

  const handleSaveRound = async (round) => {
    const edited = roundEditRows[round._id];
    if (!edited) return;

    const nameChanged = (edited.roundName || "").trim() !== (round.roundName || "").trim();
    const statusChanged = edited.roundStatus !== round.roundStatus;

    if (!nameChanged && !statusChanged) {
      toast.info("No round changes to save.");
      return;
    }

    setSavingRoundId(round._id);
    try {
      if (nameChanged) {
        await updateRoundName({ roundId: round._id, roundName: edited.roundName.trim() });
      }
      if (statusChanged) {
        await updateRoundStatus({ roundId: round._id, status: edited.roundStatus });
      }

      toast.success("Round updated successfully.");
      await loadRounds();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update round.");
    } finally {
      setSavingRoundId(null);
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    if (!canCreateTopic) {
      toast.error("Topic title and round are required.");
      return;
    }

    setCreatingTopic(true);
    try {
      const res = await createTopic({
        title: topicForm.title.trim(),
        description: topicForm.description.trim(),
        round: topicForm.round,
        weights: Number(topicForm.weights) || 1,
      });
      toast.success(res?.message || "Topic created successfully.");
      setTopicForm((prev) => ({ ...prev, title: "", description: "", weights: 1 }));
      await loadTopics();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create topic.");
    } finally {
      setCreatingTopic(false);
    }
  };

  const handleCreateTopicBatch = async (e) => {
    e.preventDefault();

    const targetRound = topicForm.round || selectedRoundId;
    if (!targetRound) {
      toast.error("Select a round before batch topic add.");
      return;
    }

    if (!topicBatchJson.trim()) {
      toast.error("Paste batch JSON first.");
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(topicBatchJson);
    } catch {
      toast.error("Invalid JSON format.");
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      toast.error("Batch JSON must be a non-empty array.");
      return;
    }

    const normalizedTopics = parsed.map((t) => ({
      title: String(t?.title || "").trim(),
      description: String(t?.description || "").trim(),
      weights: 1,
      round: t?.round || targetRound,
    }));

    if (normalizedTopics.some((t) => !t.title || !t.round)) {
      toast.error("Each topic must include at least title (and round or selected round).");
      return;
    }

    setCreatingTopicBatch(true);
    try {
      const res = await createTopicsBatch({ topics: normalizedTopics });
      const inserted = res?.data?.insertedEntries;
      const failed = res?.data?.failedEntries;
      toast.success(
        res?.message ||
          `Batch add completed${typeof inserted === "number" ? ` (${inserted} inserted, ${failed ?? 0} failed)` : ""}.`
      );
      setTopicBatchJson("");
      await loadTopics();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create topics in batch.");
    } finally {
      setCreatingTopicBatch(false);
    }
  };

  const setTopicField = (topicId, field, value) => {
    setTopicEditRows((prev) => ({
      ...prev,
      [topicId]: {
        ...prev[topicId],
        [field]: value,
      },
    }));
  };

  const handleSaveTopic = async (topic) => {
    const edited = topicEditRows[topic._id];
    if (!edited) return;

    const titleChanged = (edited.title || "").trim() !== (topic.title || "").trim();
    const descriptionChanged = (edited.description || "") !== (topic.description || "");
    const weightChanged = Number(edited.weights) !== Number(topic.weights);
    const roundChanged = (edited.round || "") !== (topic.round || "");

    if (!titleChanged && !descriptionChanged && !weightChanged && !roundChanged) {
      toast.info("No topic changes to save.");
      return;
    }

    setSavingTopicId(topic._id);
    try {
      const res = await updateTopic({
        topicId: topic._id,
        title: edited.title?.trim(),
        description: edited.description,
        weights: Number(edited.weights) || 1,
        round: edited.round,
      });
      toast.success(res?.message || "Topic updated successfully.");
      await loadTopics();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update topic.");
    } finally {
      setSavingTopicId(null);
    }
  };

  const handleDeleteTopic = async (topicId) => {
    if (!window.confirm("Delete this topic?")) return;

    setDeletingTopicId(topicId);
    try {
      const res = await deleteTopic(topicId);
      toast.success(res?.message || "Topic deleted successfully.");
      await loadTopics();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete topic.");
    } finally {
      setDeletingTopicId(null);
    }
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black tracking-tight font-heading uppercase">Round Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Rounds on left, topics on right</p>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-border shadow-sm"
          >
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            <div className="px-6 py-5 border-b border-border flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
                <PlusCircle className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <h2 className="font-bold text-base">Create Round</h2>
                <p className="text-xs text-muted-foreground">Add round name and initial status</p>
              </div>
            </div>

            <form onSubmit={handleCreateRound} className="px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="round-name">Round Name</Label>
                <Input
                  id="round-name"
                  value={roundForm.roundName}
                  onChange={(e) => setRoundForm((p) => ({ ...p, roundName: e.target.value }))}
                  placeholder="Round 1"
                  disabled={creatingRound}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="round-status">Round Status</Label>
                <select
                  id="round-status"
                  value={roundForm.roundStatus}
                  onChange={(e) => setRoundForm((p) => ({ ...p, roundStatus: e.target.value }))}
                  disabled={creatingRound}
                  className="h-9 w-full appearance-none rounded-md border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  {ROUND_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <Button type="submit" disabled={creatingRound || !canCreateRound} className="gap-2">
                  {creatingRound
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                    : <><PlusCircle className="h-4 w-4" /> Create Round</>}
                </Button>
              </div>
            </form>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="bg-white rounded-2xl border border-border shadow-sm"
          >
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <h2 className="font-bold text-base">Rounds</h2>
                  <p className="text-xs text-muted-foreground">Edit round name and status</p>
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={loadRounds} disabled={roundsLoading} className="gap-1.5">
                {roundsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
              </Button>
            </div>

            <div className="px-6 py-6">
              {roundsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading rounds...
                </div>
              ) : rounds.length === 0 ? (
                <div className="text-sm text-muted-foreground">No rounds found.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-border text-left">
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Round Name</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rounds.map((round, idx) => {
                        const edited = roundEditRows[round._id] || { roundName: "", roundStatus: "created" };
                        const isBusy = savingRoundId === round._id;
                        return (
                          <tr key={round._id} className="border-b border-border last:border-0 hover:bg-slate-50/60">
                            <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                            <td className="px-4 py-3 min-w-52">
                              <Input
                                value={edited.roundName}
                                onChange={(e) => setRoundField(round._id, "roundName", e.target.value)}
                                disabled={isBusy}
                              />
                            </td>
                            <td className="px-4 py-3 min-w-40">
                              <select
                                value={edited.roundStatus}
                                onChange={(e) => setRoundField(round._id, "roundStatus", e.target.value)}
                                disabled={isBusy}
                                className="h-9 w-full appearance-none rounded-md border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                              >
                                {ROUND_STATUSES.map((status) => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <Button size="sm" onClick={() => handleSaveRound(round)} disabled={isBusy} className="gap-1.5">
                                {isBusy
                                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                                  : <><Save className="h-3.5 w-3.5" /> Save</>}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-border shadow-sm"
          >
            <div className="h-1 w-full bg-gradient-to-r from-fuchsia-500 to-pink-500" />
            <div className="px-6 py-5 border-b border-border flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <h2 className="font-bold text-base">Create Topic</h2>
                <p className="text-xs text-muted-foreground">Create single or batch topics linked to a round</p>
              </div>
            </div>

            <div className="px-6 pt-5">
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                {[["single", "Single Topic"], ["batch", "Batch JSON"]].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTopicCreateMode(id)}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${topicCreateMode === id ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {topicCreateMode === "single" ? (
              <form onSubmit={handleCreateTopic} className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="topic-title">Title</Label>
                  <Input
                    id="topic-title"
                    value={topicForm.title}
                    onChange={(e) => setTopicForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Debate Topic"
                    disabled={creatingTopic}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="topic-description">Description</Label>
                  <Input
                    id="topic-description"
                    value={topicForm.description}
                    onChange={(e) => setTopicForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Optional description"
                    disabled={creatingTopic}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="topic-round">Round</Label>
                  <select
                    id="topic-round"
                    value={topicForm.round}
                    onChange={(e) => {
                      const nextRound = e.target.value;
                      setTopicForm((p) => ({ ...p, round: nextRound }));
                      setSelectedRoundId(nextRound);
                    }}
                    disabled={creatingTopic || rounds.length === 0}
                    className="h-9 w-full appearance-none rounded-md border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">Select round</option>
                    {rounds.map((r) => (
                      <option key={r._id} value={r._id}>{r.roundName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="topic-weights">Weight</Label>
                  <Input
                    id="topic-weights"
                    type="number"
                    min={1}
                    step={1}
                    value={topicForm.weights}
                    onChange={(e) => setTopicForm((p) => ({ ...p, weights: e.target.value }))}
                    disabled={creatingTopic}
                  />
                </div>

                <div className="md:col-span-2">
                  <Button type="submit" disabled={creatingTopic || !canCreateTopic} className="gap-2">
                    {creatingTopic
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                      : <><PlusCircle className="h-4 w-4" /> Create Topic</>}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateTopicBatch} className="px-6 py-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="topic-batch-round">Round</Label>
                  <select
                    id="topic-batch-round"
                    value={topicForm.round}
                    onChange={(e) => {
                      const nextRound = e.target.value;
                      setTopicForm((p) => ({ ...p, round: nextRound }));
                      setSelectedRoundId(nextRound);
                    }}
                    disabled={creatingTopicBatch || rounds.length === 0}
                    className="h-9 w-full appearance-none rounded-md border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">Select round</option>
                    {rounds.map((r) => (
                      <option key={r._id} value={r._id}>{r.roundName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="topic-batch-json">Batch JSON</Label>
                  <textarea
                    id="topic-batch-json"
                    rows={8}
                    value={topicBatchJson}
                    onChange={(e) => setTopicBatchJson(e.target.value)}
                    placeholder={`[\n  { "title": "Should AI be regulated?", "description": "Optional" },\n  { "title": "Is open source sustainable?" }\n]`}
                    disabled={creatingTopicBatch}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 resize-y"
                  />
                </div>

                <Button type="submit" disabled={creatingTopicBatch || !topicBatchJson.trim()} className="gap-2">
                  {creatingTopicBatch
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating Batch…</>
                    : <><FileJson className="h-4 w-4" /> Add Topics in Batch</>}
                </Button>
              </form>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="bg-white rounded-2xl border border-border shadow-sm"
          >
            <div className="h-1 w-full bg-gradient-to-r from-cyan-500 to-blue-500" />
            <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <h2 className="font-bold text-base">Topics by Round</h2>
                  <p className="text-xs text-muted-foreground">Update topic details and delete topics</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedRoundId}
                  onChange={(e) => {
                    setSelectedRoundId(e.target.value);
                    setTopicForm((p) => ({ ...p, round: e.target.value }));
                  }}
                  className="h-8 rounded-md border border-input bg-white px-2 text-xs shadow-sm"
                  disabled={rounds.length === 0}
                >
                  <option value="">Select round</option>
                  {rounds.map((r) => (
                    <option key={r._id} value={r._id}>{r.roundName}</option>
                  ))}
                </select>

                <Button variant="outline" size="sm" onClick={loadTopics} disabled={topicsLoading} className="gap-1.5">
                  {topicsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
                </Button>
              </div>
            </div>

            <div className="px-6 py-6">
              {topicsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading topics...
                </div>
              ) : topics.length === 0 ? (
                <div className="text-sm text-muted-foreground">No topics found for selected round.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-border text-left">
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weight</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topics.map((topic, idx) => {
                        const edited = topicEditRows[topic._id] || {
                          title: "",
                          description: "",
                          weights: 1,
                          round: selectedRoundId,
                        };
                        const isSaving = savingTopicId === topic._id;
                        const isDeleting = deletingTopicId === topic._id;

                        return (
                          <tr key={topic._id} className="border-b border-border last:border-0 hover:bg-slate-50/60">
                            <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                            <td className="px-4 py-3 min-w-60">
                              <Input
                                value={edited.title}
                                onChange={(e) => setTopicField(topic._id, "title", e.target.value)}
                                disabled={isSaving || isDeleting}
                              />
                            </td>
                            <td className="px-4 py-3 min-w-32">
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                value={edited.weights}
                                onChange={(e) => setTopicField(topic._id, "weights", e.target.value)}
                                disabled={isSaving || isDeleting}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveTopic(topic)}
                                  disabled={isSaving || isDeleting}
                                  className="gap-1.5"
                                >
                                  {isSaving
                                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                                    : <><Save className="h-3.5 w-3.5" /> Save</>}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteTopic(topic._id)}
                                  disabled={isSaving || isDeleting}
                                  className="gap-1.5"
                                >
                                  {isDeleting
                                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…</>
                                    : <><Trash2 className="h-3.5 w-3.5" /> Delete</>}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
