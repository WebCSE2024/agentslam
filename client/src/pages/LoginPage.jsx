import { useState, useContext, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2, Bot, AlertCircle } from "lucide-react";
import { UserContext } from "@/contexts/UserContext";

export default function LoginPage() {
  const { login, user, error: contextError, loading } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect already-authenticated users
  useEffect(() => {
    if (user) {
      const destination = location.state?.from || "/";
      navigate(destination, { replace: true });
    }
  }, [user, navigate, location]);

  useEffect(() => {
    if (contextError) setError(contextError);
  }, [contextError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Login failed. Please try again."
      );
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background font-sans overflow-hidden">
      {/* ── Left Panel ─ Branding ── */}
      <div className="hidden lg:flex w-7/12 bg-slate-50 relative flex-col justify-center p-16 border-r border-border overflow-hidden gap-8">
        {/* Subtle background blobs */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-violet-100/50 via-transparent to-transparent opacity-60 pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-20 w-64 h-64 bg-violet-200/20 rounded-full blur-3xl" />

        {/* Branding content */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 flex flex-col gap-8"
        >
          {/* Logo mark */}
          <div className="h-24 w-24 rounded-2xl bg-black shadow-2xl flex items-center justify-center border border-slate-800">
            <Bot className="h-12 w-12 text-white" />
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-7xl font-black tracking-tighter text-foreground font-heading uppercase leading-none">
              Agent
              <br />
              Slam
            </h1>
            <div className="flex items-center gap-4">
              <div className="h-[3px] w-20 bg-primary/40 rounded-full" />
              <span className="text-lg font-bold tracking-widest text-slate-500 uppercase">
                Edition 2026
              </span>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-slate-500 text-lg leading-relaxed max-w-sm">
            The ultimate AI Agent hackathon. Build. Deploy. Compete.
          </p>

          {/* Decorative stat pills */}
          <div className="flex flex-wrap gap-3 mt-2">
            {[
              { label: "Teams", value: "64" },
              { label: "Rounds", value: "5" },
              { label: "Prize Pool", value: "₹50K" },
            ].map(({ label, value }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="flex flex-col items-center px-6 py-3 bg-white rounded-xl border border-slate-200 shadow-sm"
              >
                <span className="text-2xl font-black text-foreground font-heading">
                  {value}
                </span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                  {label}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Right Panel ─ Login Form ── */}
      <div className="flex flex-1 flex-col justify-center px-8 py-12 sm:px-16 lg:px-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md mx-auto"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-xl bg-black flex items-center justify-center border border-slate-800">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <span className="font-heading text-2xl font-black tracking-tight">
              AgentSlam
            </span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-black tracking-tight text-foreground font-heading">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>

            <Button type="button" variant="outline" className="w-full h-11 text-sm font-semibold" asChild>
              <Link to="/public/matches">See match updates</Link>
            </Button>
          </form>

          {/* Footer note */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Use credentials provided by the organising team.
            <br />
            Contact support if you&apos;re having trouble logging in.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
