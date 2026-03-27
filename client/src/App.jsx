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
import PublicMatchesPage from "@/pages/public/PublicMatchesPage";
import PublicMatchConversationPage from "@/pages/public/PublicMatchConversationPage";
import PublicLayout from "@/pages/public/PublicLayout";

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
        <Route path="/public" element={<PublicLayout />}>
          <Route path="matches" element={<PublicMatchesPage />} />
          <Route path="matches/:matchId" element={<PublicMatchConversationPage />} />
        </Route>

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
