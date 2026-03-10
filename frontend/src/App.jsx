import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useAuth, AuthProvider } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Matches from './pages/Matches.jsx'
import MatchDetail from './pages/MatchDetail.jsx'
import Topics from './pages/Topics.jsx'
import Admin from './pages/Admin.jsx'

function RequireAuth({ children }) {
    const { team, loading } = useAuth()
    if (loading) return <div className="loading"><div className="spinner" /></div>
    return team ? children : <Navigate to="/login" replace />
}

function RequireAdmin({ children }) {
    const { team } = useAuth()
    return team?.isAdmin ? children : <Navigate to="/" replace />
}

function Header() {
    const { team, logout } = useAuth()
    return (
        <header>
            <div className="logo">⚡ AgentSlam</div>
            {team && (
                <>
                    <nav>
                        <NavLink to="/" end>Dashboard</NavLink>
                        <NavLink to="/matches">Matches</NavLink>
                        <NavLink to="/topics">Topics</NavLink>
                        {team.isAdmin && <NavLink to="/admin">Admin</NavLink>}
                    </nav>
                    <div className="user-badge">
                        <strong>{team.name}</strong>
                        <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
                    </div>
                </>
            )}
        </header>
    )
}

function AppRoutes() {
    const { team } = useAuth()

    return (
        <div className="app-container">
            <Header />
            <main>
                <Routes>
                    <Route path="/login" element={team ? <Navigate to="/" replace /> : <Login />} />
                    <Route path="/register" element={team ? <Navigate to="/" replace /> : <Register />} />

                    <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
                    <Route path="/matches" element={<RequireAuth><Matches /></RequireAuth>} />
                    <Route path="/matches/:id" element={<RequireAuth><MatchDetail /></RequireAuth>} />
                    <Route path="/topics" element={<RequireAuth><Topics /></RequireAuth>} />
                    <Route path="/admin" element={<RequireAuth><RequireAdmin><Admin /></RequireAdmin></RequireAuth>} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    )
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    )
}
