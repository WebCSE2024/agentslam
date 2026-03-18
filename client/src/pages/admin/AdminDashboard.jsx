import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, Users, Search, Loader2,
  ChevronDown, Mail, Hash, Shield, User, RefreshCw,
  AlertCircle, FileJson, Swords, Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardUser, onboardUsersBatch } from "@/api/onboarding";
import { getUsersByFilter, resetUserPassword, changeStatus } from "@/api/userApi";
import { getRounds } from "@/api/roundApi";
import { createMatch, generateMatches, getAllMatchesAdmin } from "@/api/matchApi";
import { getTopicsByRound } from "@/api/topicApi";
import { resetAllSystem, resetTournament } from "@/api/resetApi";

// ─── helpers ────────────────────────────────────────────────────────────────
const ROLES = ["user", "admin"];
const STATUSES = ["active", "disabled"];

function Section({ icon: Icon, title, subtitle, accent, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
    >
      {/* Accent bar */}
      <div className={`h-1 w-full ${accent}`} />
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <h2 className="font-bold text-base text-foreground font-heading">{title}</h2>
            {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="px-6 py-6">{children}</div>
    </motion.div>
  );
}

// ─── Badge ──────────────────────────────────────────────────────────────────
function Badge({ value, type }) {
  const roleMap = {
    admin: "bg-violet-100 text-violet-700 border-violet-200",
    super_admin: "bg-rose-100 text-rose-700 border-rose-200",
    user: "bg-blue-100 text-blue-700 border-blue-200",
  };
  const statusMap = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    disabled: "bg-red-100 text-red-700 border-red-200",
  };
  const cls = type === "role" ? roleMap[value] : statusMap[value];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${cls}`}>
      {value}
    </span>
  );
}

// ─── Single-user onboard form ────────────────────────────────────────────────
function OnboardSingleForm() {
  const [form, setForm] = useState({ name: "", email: "", admissionNumber: "", role: "user" });
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.admissionNumber) {
      toast.error("All fields are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await onboardUser(form);
      toast.success(res?.message || `Onboarded ${form.name} successfully!`);
      setForm({ name: "", email: "", admissionNumber: "", role: "user" });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to onboard user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="s-name" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <User className="h-3.5 w-3.5" /> Full Name
        </Label>
        <Input id="s-name" placeholder="Karthik Mohan" value={form.name} onChange={set("name")} disabled={busy} className="h-10" />
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="s-email" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Mail className="h-3.5 w-3.5" /> Email
        </Label>
        <Input id="s-email" type="email" placeholder="22je0459@iitism.ac.in" value={form.email} onChange={set("email")} disabled={busy} className="h-10" />
      </div>

      {/* Admission Number */}
      <div className="space-y-1.5">
        <Label htmlFor="s-adm" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Hash className="h-3.5 w-3.5" /> Admission Number
        </Label>
        <Input id="s-adm" placeholder="22je0459" value={form.admissionNumber} onChange={set("admissionNumber")} disabled={busy} className="h-10" />
      </div>

      {/* Role */}
      <div className="space-y-1.5">
        <Label htmlFor="s-role" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Shield className="h-3.5 w-3.5" /> Role
        </Label>
        <div className="relative">
          <select
            id="s-role"
            value={form.role}
            onChange={set("role")}
            disabled={busy}
            className="h-10 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="user">Participant (user)</option>
            <option value="admin">Admin</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Submit */}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy} className="w-full h-10 gap-2 font-semibold">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Onboarding…</> : <><UserPlus className="h-4 w-4" /> Onboard User</>}
        </Button>
      </div>
    </form>
  );
}

// ─── Batch onboard form ──────────────────────────────────────────────────────
function OnboardBatchForm() {
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [jsonError, setJsonError] = useState(null);

  function validateJson(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) { setJsonError("Must be a JSON array [ ... ]"); return null; }
      setJsonError(null);
      return parsed;
    } catch {
      setJsonError("Invalid JSON");
      return null;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const users = validateJson(json);
    if (!users) return;
    setBusy(true);
    try {
      const res = await onboardUsersBatch(users);
      const d = res?.data ?? res;
      toast.success(`${d?.created ?? users.length} created, ${d?.failed ?? 0} failed — ${res?.message || "Batch processed!"}`);
      setJson("");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Batch onboarding failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <FileJson className="h-3.5 w-3.5" /> Paste JSON Array
        </Label>
        <textarea
          rows={8}
          placeholder={`[\n  { "name": "Alice", "email": "alice@x.com", "admissionNumber": "23BCS001", "role": "user" },\n  { "name": "Bob",   "email": "bob@x.com",   "admissionNumber": "23BCS002", "role": "user" }\n]`}
          value={json}
          onChange={(e) => { setJson(e.target.value); if (e.target.value) validateJson(e.target.value); }}
          disabled={busy}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 resize-none"
        />
        <AnimatePresence>
          {jsonError && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-xs text-destructive font-medium">
              <AlertCircle className="h-3.5 w-3.5" /> {jsonError}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <Button type="submit" disabled={busy || !!jsonError || !json.trim()} className="w-full h-10 gap-2 font-semibold">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <><Users className="h-4 w-4" /> Batch Onboard</>}
      </Button>
    </form>
  );
}

// ─── User filter table ───────────────────────────────────────────────────────
function UserFilterTable() {
  const [filters, setFilters] = useState({ role: "user", status: "active" });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [search, setSearch] = useState("");
  const [busyAction, setBusyAction] = useState({ userId: null, type: null });

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await getUsersByFilter(filters);
      console.log('filtering users', filters)
      const data = res?.data ?? res;
      setUsers(Array.isArray(data) ? data : []);
      if ((data?.length ?? 0) === 0) toast.info("No users match those filters.");
      else toast.success(res?.message || `${data.length} user(s) found.`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to fetch users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const displayed = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.admissionNumber?.toLowerCase().includes(q)
    );
  });

  const handleResetPassword = async (user) => {
    if (!user?.email) {
      toast.error("User email not found.");
      return;
    }

    if (!window.confirm(`Reset password for ${user.name || user.email}?`)) return;

    setBusyAction({ userId: user._id, type: "reset" });
    try {
      const res = await resetUserPassword({ email: user.email });
      toast.success(res?.message || "Password reset successful.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to reset password.");
    } finally {
      setBusyAction({ userId: null, type: null });
    }
  };

  const handleChangeStatus = async (user) => {
    if (!user?._id) {
      toast.error("User id not found.");
      return;
    }

    const nextAction = user.status === "disabled" ? "Enable" : "Disable";
    if (!window.confirm(`${nextAction} ${user.name || user.email}?`)) return;

    setBusyAction({ userId: user._id, type: "change-status" });
    try {
      const res = await changeStatus({ input: user._id });
      toast.success(res?.message || "User status updated successfully.");
      await fetchUsers();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to change user status.");
    } finally {
      setBusyAction({ userId: null, type: null });
    }
  };

  return (
    <div className="space-y-5">
      {/* Filter controls */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Role */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role</Label>
          <div className="relative">
            <select value={filters.role} onChange={setFilter("role")} disabled={loading}
              className="h-9 appearance-none rounded-md border border-input bg-white px-3 pr-7 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</Label>
          <div className="relative">
            <select value={filters.status} onChange={setFilter("status")} disabled={loading}
              className="h-9 appearance-none rounded-md border border-input bg-white px-3 pr-7 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        <Button onClick={fetchUsers} disabled={loading} className="h-9 gap-2">
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Fetching…</>
            : <><Search className="h-4 w-4" /> Fetch Users</>}
        </Button>

        {users.length > 0 && (
          <Button variant="outline" size="sm" className="h-9 gap-1.5 ml-auto" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        )}
      </div>

      {/* Client-side search */}
      {users.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, admission no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      )}

      {/* Table */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Loading users…</p>
          </motion.div>
        ) : searched && displayed.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-14 gap-3 rounded-xl border border-dashed border-border">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No users found</p>
          </motion.div>
        ) : displayed.length > 0 ? (
          <motion.div key="table" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adm. No.</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((u, i) => (
                  <motion.tr key={u._id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border last:border-0 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-foreground uppercase">{u.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.admissionNumber || "—"}</td>
                    <td className="px-4 py-3"><Badge value={u.role} type="role" /></td>
                    <td className="px-4 py-3"><Badge value={u.status} type="status" /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetPassword(u)}
                          disabled={loading || busyAction.userId === u._id}
                        >
                          {busyAction.userId === u._id && busyAction.type === "reset"
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Resetting…</>
                            : "Reset Password"}
                        </Button>

                        <Button
                          variant={u.status === "disabled" ? "outline" : "destructive"}
                          size="sm"
                          onClick={() => handleChangeStatus(u)}
                          disabled={loading || busyAction.userId === u._id}
                        >
                          {busyAction.userId === u._id && busyAction.type === "change-status"
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…</>
                            : (u.status === "disabled" ? "Enable" : "Disable")}
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 bg-slate-50 border-t border-border text-xs text-muted-foreground">
              Showing {displayed.length} of {users.length} user(s)
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ─── Tab switcher for onboard forms ─────────────────────────────────────────
function OnboardSection() {
  const [tab, setTab] = useState("single");
  return (
    <Section
      icon={UserPlus}
      title="Onboard Users"
      accent="bg-gradient-to-r from-blue-500 to-violet-500"
    >
      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-lg w-fit">
        {[["single", "Single User"], ["batch", "Batch JSON"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${tab === id ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "single" ? (
          <motion.div key="single" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
            <OnboardSingleForm />
          </motion.div>
        ) : (
          <motion.div key="batch" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
            <OnboardBatchForm />
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}

function MatchStatusBadge({ status }) {
  const normalizedStatus = status || "pending";
  const statusClassMap = {
    pending: "bg-sky-100 text-sky-700 border-sky-200",
    active: "bg-amber-100 text-amber-700 border-amber-200",
    started: "bg-violet-100 text-violet-700 border-violet-200",
    paused: "bg-orange-100 text-orange-700 border-orange-200",
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${statusClassMap[normalizedStatus] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
      {normalizedStatus}
    </span>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function AdminDashboard({ mode = "dashboard" }) {
  const [rounds, setRounds] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [matches, setMatches] = useState([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [generatingMatches, setGeneratingMatches] = useState(false);
  const [resettingType, setResettingType] = useState(null);
  const [matchCreationMode, setMatchCreationMode] = useState("round");
  const [manualMatchForm, setManualMatchForm] = useState({ roundId: "", team1Id: "", team2Id: "", topicId: "" });
  const [manualUsers, setManualUsers] = useState([]);
  const [manualTopics, setManualTopics] = useState([]);
  const [loadingManualUsers, setLoadingManualUsers] = useState(false);
  const [loadingManualTopics, setLoadingManualTopics] = useState(false);
  const [creatingManualMatch, setCreatingManualMatch] = useState(false);

  const loadRounds = useCallback(async () => {
    setLoadingRounds(true);
    try {
      const res = await getRounds();
      const data = Array.isArray(res?.data) ? res.data : [];
      setRounds(data);
      setSelectedRoundId((current) => {
        if (current && data.some((round) => round._id === current)) return current;
        const defaultRound = data
          .filter((round) => round?.roundStatus === "created")
          .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())[0];
        return defaultRound?._id || "";
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load rounds.");
      setRounds([]);
    } finally {
      setLoadingRounds(false);
    }
  }, []);

  const loadMatches = useCallback(async () => {
    setLoadingMatches(true);
    try {
      const res = await getAllMatchesAdmin();
      setMatches(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 404) {
        setMatches([]);
      } else {
        toast.error(err?.response?.data?.message || "Failed to load matches.");
      }
    } finally {
      setLoadingMatches(false);
    }
  }, []);

  useEffect(() => {
    loadRounds();
    loadMatches();
  }, [loadRounds, loadMatches]);

  const loadManualUsers = useCallback(async () => {
    setLoadingManualUsers(true);
    try {
      const res = await getUsersByFilter({ role: "user", status: "active" });
      const data = Array.isArray(res?.data) ? res.data : [];
      setManualUsers(data);
    } catch {
      setManualUsers([]);
    } finally {
      setLoadingManualUsers(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "user") return;
    loadManualUsers();
  }, [loadManualUsers, mode]);

  const loadManualTopics = useCallback(async (roundId) => {
    if (!roundId) {
      setManualTopics([]);
      return;
    }

    setLoadingManualTopics(true);
    try {
      const res = await getTopicsByRound(roundId);
      const data = Array.isArray(res?.data) ? res.data : [];
      setManualTopics(data);
    } catch {
      setManualTopics([]);
    } finally {
      setLoadingManualTopics(false);
    }
  }, []);

  useEffect(() => {
    loadManualTopics(manualMatchForm.roundId);
  }, [loadManualTopics, manualMatchForm.roundId]);

  const creatableRounds = useMemo(() => {
    return [...rounds]
      .filter((round) => round?.roundStatus === "created")
      .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
  }, [rounds]);

  const manualCreatableRounds = useMemo(() => {
    return [...rounds]
      .filter((round) => round?.roundStatus !== "completed")
      .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
  }, [rounds]);

  const filteredCreatableRounds = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return creatableRounds;
    return creatableRounds.filter((round) =>
      [round?.roundName, round?.roundStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [creatableRounds, globalSearch]);

  const roundWiseMatches = useMemo(() => {
    const grouped = new Map();

    for (const match of matches) {
      const roundId = match?.round?._id || "unknown";
      if (!grouped.has(roundId)) {
        grouped.set(roundId, {
          roundId,
          roundName: match?.round?.roundName || "Unknown Round",
          roundStatus: match?.round?.roundStatus || "created",
          roundCreatedAt: match?.round?.createdAt || null,
          matches: [],
        });
      }

      grouped.get(roundId).matches.push({
        _id: match?._id,
        opponents: `${String(match?.opponents?.team1?.user?.name || "Team 1").toUpperCase()} VS ${String(match?.opponents?.team2?.user?.name || "Team 2").toUpperCase()}`,
        topic: match?.topic?.title || "—",
        matchStatus: match?.matchStatus || "pending",
        createdAt: match?.createdAt || null,
      });
    }

    return Array.from(grouped.values())
      .sort((a, b) => new Date(b?.roundCreatedAt || 0).getTime() - new Date(a?.roundCreatedAt || 0).getTime())
      .map((group) => ({
        ...group,
        matches: [...group.matches].sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()),
      }));
  }, [matches]);

  const filteredRoundWiseMatches = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return roundWiseMatches;

    return roundWiseMatches
      .map((group) => {
        const roundHit =
          group.roundName?.toLowerCase().includes(q) ||
          group.roundStatus?.toLowerCase().includes(q);

        if (roundHit) return group;

        const filteredMatches = (group.matches || []).filter((match) =>
          [match.opponents, match.topic, match.matchStatus]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q))
        );

        return { ...group, matches: filteredMatches };
      })
      .filter((group) => group.matches?.length > 0);
  }, [globalSearch, roundWiseMatches]);

  const handleGenerateMatches = useCallback(async (e) => {
    e.preventDefault();
    if (!selectedRoundId) {
      toast.error("Please select a round first.");
      return;
    }

    setGeneratingMatches(true);
    try {
      const res = await generateMatches(selectedRoundId);
      toast.success(res?.message || "Matches generated successfully.");
      await Promise.all([loadRounds(), loadMatches()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to generate matches.");
    } finally {
      setGeneratingMatches(false);
    }
  }, [selectedRoundId, loadMatches, loadRounds]);

  const onManualFieldChange = useCallback((field, value) => {
    setManualMatchForm((prev) => {
      if (field === "roundId") {
        return {
          roundId: value,
          team1Id: "",
          team2Id: "",
          topicId: "",
        };
      }
      return { ...prev, [field]: value };
    });
  }, []);

  const handleCreateManualMatch = useCallback(async (e) => {
    e.preventDefault();

    const { roundId, team1Id, team2Id, topicId } = manualMatchForm;

    if (!roundId || !team1Id || !team2Id || !topicId) {
      toast.error("Please select round, both teams, and a topic.");
      return;
    }

    if (team1Id === team2Id) {
      toast.error("Team 1 and Team 2 must be different users.");
      return;
    }

    setCreatingManualMatch(true);
    try {
      const res = await createMatch({ team1Id, team2Id, topicId, roundId });
      toast.success(res?.message || "Manual match created successfully.");
      setManualMatchForm({ roundId, team1Id: "", team2Id: "", topicId: "" });
      await Promise.all([loadRounds(), loadMatches()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create manual match.");
    } finally {
      setCreatingManualMatch(false);
    }
  }, [loadMatches, loadRounds, manualMatchForm]);

  const handleResetTournament = useCallback(async () => {
    const confirmed = window.confirm("Reset tournament data? This action cannot be undone.");
    if (!confirmed) return;

    setResettingType("tournament");
    try {
      const res = await resetTournament();
      toast.success(res?.message || "Tournament reset successful.");
      await Promise.all([loadRounds(), loadMatches()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to reset tournament.");
    } finally {
      setResettingType(null);
    }
  }, [loadMatches, loadRounds]);

  const handleResetAll = useCallback(async () => {
    const confirmed = window.confirm("Reset everything? This will clear all tournament and related data.");
    if (!confirmed) return;

    setResettingType("all");
    try {
      const res = await resetAllSystem();
      toast.success(res?.message || "Full system reset successful.");
      await Promise.all([loadRounds(), loadMatches()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to reset system.");
    } finally {
      setResettingType(null);
    }
  }, [loadMatches, loadRounds]);

  const isUserPage = mode === "user";

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black tracking-tight font-heading uppercase">
          {isUserPage ? "User Management" : "Admin Dashboard"}
        </h1>
      </motion.div>

      {!isUserPage && (
        <>
          <Section
            icon={Sparkles}
            title="Generate Matches"
            accent="bg-gradient-to-r from-fuchsia-500 to-violet-500"
          >
            <div className="space-y-4">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setMatchCreationMode("round")}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors ${
                    matchCreationMode === "round" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Generate Per Round
                </button>
                <button
                  type="button"
                  onClick={() => setMatchCreationMode("manual")}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors ${
                    matchCreationMode === "manual" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Create Manually
                </button>
              </div>

              {matchCreationMode === "round" ? (
                <>
                  <form onSubmit={handleGenerateMatches} className="flex flex-col gap-4 xl:flex-row xl:items-end">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="generate-round" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Select Round
                      </Label>
                      <div className="relative">
                        <select
                          id="generate-round"
                          value={selectedRoundId}
                          onChange={(e) => setSelectedRoundId(e.target.value)}
                          disabled={loadingRounds || generatingMatches || creatableRounds.length === 0}
                          className="h-10 w-full appearance-none rounded-md border border-input bg-white px-3 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                        >
                          <option value="">Select a round</option>
                          {filteredCreatableRounds.map((round) => (
                            <option key={round._id} value={round._id}>
                              {round.roundName} ({round.roundStatus})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button type="submit" disabled={!selectedRoundId || generatingMatches || loadingRounds} className="h-10 gap-2 font-semibold">
                        {generatingMatches
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                          : <><Sparkles className="h-4 w-4" /> Generate Matches</>}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { loadRounds(); loadMatches(); }} disabled={loadingRounds || loadingMatches} className="h-10 gap-2">
                        <RefreshCw className={`h-4 w-4 ${(loadingRounds || loadingMatches) ? "animate-spin" : ""}`} /> Refresh
                      </Button>
                    </div>
                  </form>

                  {filteredCreatableRounds.length === 0 && !loadingRounds && (
                    <p className="text-sm text-muted-foreground">No rounds in created status are available for match generation.</p>
                  )}
                </>
              ) : (
                <form onSubmit={handleCreateManualMatch} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-round" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Round
                    </Label>
                    <div className="relative">
                      <select
                        id="manual-round"
                        value={manualMatchForm.roundId}
                        onChange={(e) => onManualFieldChange("roundId", e.target.value)}
                        disabled={loadingRounds || creatingManualMatch || manualCreatableRounds.length === 0}
                        className="h-10 w-full appearance-none rounded-md border border-input bg-white px-3 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <option value="">Select round</option>
                        {manualCreatableRounds.map((round) => (
                          <option key={round._id} value={round._id}>
                            {round.roundName}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manual-team1" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Team 1
                    </Label>
                    <div className="relative">
                      <select
                        id="manual-team1"
                        value={manualMatchForm.team1Id}
                        onChange={(e) => onManualFieldChange("team1Id", e.target.value)}
                        disabled={loadingManualUsers || creatingManualMatch || manualUsers.length === 0}
                        className="h-10 w-full appearance-none rounded-md border border-input bg-white px-3 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <option value="">Select team 1</option>
                        {manualUsers.map((u) => (
                          <option key={u._id} value={u._id}>{u.name} ({u.admissionNumber || u.email})</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manual-team2" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Team 2
                    </Label>
                    <div className="relative">
                      <select
                        id="manual-team2"
                        value={manualMatchForm.team2Id}
                        onChange={(e) => onManualFieldChange("team2Id", e.target.value)}
                        disabled={loadingManualUsers || creatingManualMatch || manualUsers.length === 0}
                        className="h-10 w-full appearance-none rounded-md border border-input bg-white px-3 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <option value="">Select team 2</option>
                        {manualUsers.map((u) => (
                          <option key={u._id} value={u._id}>{u.name} ({u.admissionNumber || u.email})</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manual-topic" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Topic
                    </Label>
                    <div className="relative">
                      <select
                        id="manual-topic"
                        value={manualMatchForm.topicId}
                        onChange={(e) => onManualFieldChange("topicId", e.target.value)}
                        disabled={!manualMatchForm.roundId || loadingManualTopics || creatingManualMatch || manualTopics.length === 0}
                        className="h-10 w-full appearance-none rounded-md border border-input bg-white px-3 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <option value="">Select topic</option>
                        {manualTopics.map((topic) => (
                          <option key={topic._id} value={topic._id}>{topic.title}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="md:col-span-2 xl:col-span-4 flex gap-3">
                    <Button
                      type="submit"
                      disabled={creatingManualMatch || !manualMatchForm.roundId || !manualMatchForm.team1Id || !manualMatchForm.team2Id || !manualMatchForm.topicId}
                      className="h-10 gap-2 font-semibold"
                    >
                      {creatingManualMatch
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                        : <><Sparkles className="h-4 w-4" /> Create Match</>}
                    </Button>

                    <Button type="button" variant="outline" onClick={() => { loadRounds(); loadMatches(); loadManualUsers(); }} disabled={loadingRounds || loadingMatches || loadingManualUsers} className="h-10 gap-2">
                      <RefreshCw className={`h-4 w-4 ${(loadingRounds || loadingMatches || loadingManualUsers) ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Section>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search rounds, opponents, topics, status..."
              className="pl-9"
            />
          </div>

          <Section
            icon={Swords}
            title="Round-wise Matches"
            accent="bg-gradient-to-r from-amber-500 to-orange-500"
          >
            {loadingMatches ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading matches…
              </div>
            ) : filteredRoundWiseMatches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground text-center">
                No matches generated yet.
              </div>
            ) : (
              <div className="space-y-6">
                {filteredRoundWiseMatches.map((group) => (
                  <div key={group.roundId} className="overflow-hidden rounded-2xl border border-border bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-slate-50 px-4 py-3">
                      <div>
                        <h3 className="text-base font-black uppercase tracking-wide text-slate-900">{group.roundName}</h3>
                        <p className="text-xs text-muted-foreground">{group.matches.length} match(es)</p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
                        {group.roundStatus}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] table-fixed text-sm">
                        <thead>
                          <tr className="border-b border-border bg-white text-left">
                            <th className="w-[8%] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                            <th className="w-[32%] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opponents</th>
                            <th className="w-[42%] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Topic</th>
                            <th className="w-[18%] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Match Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.matches.map((match, index) => (
                            <tr key={match._id} className="border-b border-border last:border-0 hover:bg-slate-50/70 transition-colors align-top">
                              <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                              <td className="px-4 py-3 font-bold uppercase tracking-wide text-slate-900" title={match.opponents}>
                                <span className="block truncate">{match.opponents}</span>
                              </td>
                              <td className="px-4 py-3 text-slate-700" title={match.topic}>
                                <span className="block truncate">{match.topic}</span>
                              </td>
                              <td className="px-4 py-3"><MatchStatusBadge status={match.matchStatus} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            icon={AlertCircle}
            title="System Reset"
            accent="bg-gradient-to-r from-rose-500 to-red-500"
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Use these actions carefully. Both endpoints are rate-limited and irreversible.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleResetTournament}
                  disabled={resettingType !== null}
                  className="h-10 gap-2"
                >
                  {resettingType === "tournament" ? <><Loader2 className="h-4 w-4 animate-spin" /> Resetting…</> : "Reset Tournament"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetAll}
                  disabled={resettingType !== null}
                  className="h-10 gap-2 border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  {resettingType === "all" ? <><Loader2 className="h-4 w-4 animate-spin" /> Resetting…</> : "Reset All"}
                </Button>
              </div>
            </div>
          </Section>
        </>
      )}

      {isUserPage && (
        <>
          <OnboardSection />

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">User Search</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Section
              icon={Users}
              title="Find Users"
              accent="bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              <UserFilterTable />
            </Section>
          </motion.div>
        </>
      )}
    </div>
  );
}
