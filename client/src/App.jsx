import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";
import ProtectedRoute from "@/ProtectedRoutes";
import UserLayout from "@/pages/user/UserLayout";
import HomePage from "@/pages/user/HomePage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import RoundPage from "@/pages/admin/RoundPage";
import LeaderboardPage from "@/pages/admin/LeaderboardPage";
import CommonMatchesPage from "@/pages/common/CommonMatchesPage";
import MatchDetailPage from "@/pages/common/MatchDetailPage";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* ── Admin routes (admin / super_admin only) ── */}
        <Route path="/admin" element={<ProtectedRoute adminOnly />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="user" element={<AdminDashboard mode="user" />} />
            <Route path="rounds" element={<RoundPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="matches" element={<CommonMatchesPage />} />
            <Route path="matches/:matchId" element={<MatchDetailPage />} />
          </Route>
        </Route>

        {/* ── User routes ── */}
        <Route path="/" element={<ProtectedRoute />}>
          <Route element={<UserLayout />}>
            <Route index element={<HomePage />} />
            <Route path="matches" element={<CommonMatchesPage />} />
            <Route path="matches/:matchId" element={<MatchDetailPage />} />
          </Route>
        </Route>

        {/* ── Public ── */}
        <Route path="/login" element={<LoginPage />} />

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
