import { useContext } from "react";
import { motion } from "framer-motion";
import { Bot, Zap, Trophy, Users } from "lucide-react";
import { UserContext } from "@/contexts/UserContext";

const stats = [
  { icon: Users, label: "Registered Teams", value: "—" },
  { icon: Zap, label: "Rounds Completed", value: "—" },
  { icon: Trophy, label: "Your Points", value: "—" },
];

export default function HomePage() {
  const { user } = useContext(UserContext);

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
            <Bot className="h-7 w-7 text-white" />
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
        {stats.map(({ icon: Icon, label, value }, i) => (
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
            <div>
              <p className="text-2xl font-black font-heading">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Placeholder content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="rounded-xl border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center py-20 gap-4 text-center"
      >
        <div className="h-14 w-14 rounded-2xl bg-white border border-border shadow flex items-center justify-center">
          <Zap className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">
            The competition hasn&apos;t started yet
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Stay tuned — rounds and challenges will appear here once the
            organising team kicks things off.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
