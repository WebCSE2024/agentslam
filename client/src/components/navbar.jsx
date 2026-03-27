import { useContext } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserContext } from "@/contexts/UserContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useContext(UserContext);
  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
      <div className="w-full px-6 md:px-12">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative overflow-hidden rounded-xl bg-black border border-slate-800 shadow-sm transition-transform group-hover:scale-105 p-1.5">
                <img
                  src="/banner.png"
                  alt="AgentSlam banner"
                  className="h-6 w-6 rounded-md object-cover"
                />
              </div>
              <span className="font-heading text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-black">
                AgentSlam
              </span>
            </Link>
          </motion.div>

          {/* Navigation */}
          {user && (
            <nav className="hidden md:flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              {isAdmin ? (
                <>
                  <NavLink
                    to="/admin"
                    end
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg text-sm font-semibold transition ${isActive ? "bg-white shadow text-slate-900" : "text-slate-600 hover:text-slate-900"}`
                    }
                  >
                    Dashboard
                  </NavLink>
                  <NavLink
                    to="/admin/user"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg text-sm font-semibold transition ${isActive ? "bg-white shadow text-slate-900" : "text-slate-600 hover:text-slate-900"}`
                    }
                  >
                    User
                  </NavLink>
                  <NavLink
                    to="/admin/rounds"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg text-sm font-semibold transition ${isActive ? "bg-white shadow text-slate-900" : "text-slate-600 hover:text-slate-900"}`
                    }
                  >
                    Rounds
                  </NavLink>
                  <NavLink
                    to="/admin/leaderboard"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg text-sm font-semibold transition ${isActive ? "bg-white shadow text-slate-900" : "text-slate-600 hover:text-slate-900"}`
                    }
                  >
                    Leaderboard
                  </NavLink>
                  <NavLink
                    to="/admin/matches"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg text-sm font-semibold transition ${isActive ? "bg-white shadow text-slate-900" : "text-slate-600 hover:text-slate-900"}`
                    }
                  >
                    Matches
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg text-sm font-semibold transition ${isActive ? "bg-white shadow text-slate-900" : "text-slate-600 hover:text-slate-900"}`
                    }
                  >
                    Home
                  </NavLink>
                  <NavLink
                    to="/matches"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg text-sm font-semibold transition ${isActive ? "bg-white shadow text-slate-900" : "text-slate-600 hover:text-slate-900"}`
                    }
                  >
                    Matches
                  </NavLink>
                </>
              )}
            </nav>
          )}

          {/* User controls */}
          {user && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-4"
            >
              {/* User badge */}
              <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="hidden sm:flex flex-col items-start leading-none">
                  <span className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                    {user.name || user.email}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-slate-500 capitalize">{user.role}</span>
                  </div>
                </div>
              </div>

              {/* Logout */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-slate-600 hover:text-red-600 hover:bg-red-50 gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </header>
  );
}
