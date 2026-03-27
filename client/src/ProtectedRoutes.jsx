import { useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { UserContext } from "@/contexts/UserContext";

const ADMIN_ROLES = ["admin", "super_admin"];

export default function ProtectedRoute({ adminOnly = false }) {
  const { user, loading } = useContext(UserContext);
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-black flex items-center justify-center border border-slate-800 shadow-lg">
            <img
              src="/banner.png"
              alt="AgentSlam banner"
              className="h-full w-full rounded-2xl object-cover"
            />
          </div>
          <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-primary animate-ping" />
        </div>
        <p className="text-sm text-muted-foreground font-medium tracking-wide">
          Verifying session…
        </p>
      </div>
    );
  }

  // Not logged in → /login
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const isAdmin = ADMIN_ROLES.includes(user.role);

  // Admin visiting a user-only route → redirect to /admin
  if (!adminOnly && isAdmin && !location.pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  // Non-admin visiting an admin-only route → redirect to /
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
