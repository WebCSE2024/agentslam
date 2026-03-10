import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api.js'

export default function Dashboard() {
    const { team } = useAuth()
    const [matches, setMatches] = useState([])
    const [teams, setTeams] = useState([])
    const [apiKey, setApiKey] = useState('')
    const [loading, setLoading] = useState(true)
    const [rotating, setRotating] = useState(false)
    const [msg, setMsg] = useState('')

    useEffect(() => {
        Promise.all([
            api.get(`/matches?teamId=${team._id}`),
            api.get('/teams'),
        ]).then(([m, t]) => {
            setMatches(m.data.slice(0, 5))
            setTeams(t.data)
        }).finally(() => setLoading(false))
    }, [team._id])

    const viewApiKey = async () => {
        try {
            const { data } = await api.get('/teams/me/api-key')
            setApiKey(data.apiKey)
        } catch (e) {
            setMsg(e.message)
        }
    }

    const rotateKey = async () => {
        if (!confirm('Rotate API key? Your bot will stop working until it uses the new key.')) return
        setRotating(true)
        try {
            const { data } = await api.post('/teams/me/rotate-api-key')
            setApiKey(data.apiKey)
            setMsg('API key rotated successfully!')
        } catch (e) {
            setMsg(e.message)
        } finally {
            setRotating(false)
        }
    }

    if (loading) return <div className="loading"><div className="spinner" /></div>

    return (
        <div>
            <h1 className="page-title">Dashboard</h1>
            {msg && <div className="alert alert-success">{msg}</div>}

            <div className="grid-2">
                {/* Team card */}
                <div className="card">
                    <h2>👥 {team.name}</h2>
                    <p className="text-muted mb-1">{team.email}</p>
                    {team.isAdmin && <span className="badge badge-judging">Admin</span>}
                    <div className="flex gap-2 mt-2">
                        <div className="text-center">
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2ecc71' }}>{team.stats?.wins ?? 0}</div>
                            <div className="text-muted">Wins</div>
                        </div>
                        <div className="text-center">
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e74c3c' }}>{team.stats?.losses ?? 0}</div>
                            <div className="text-muted">Losses</div>
                        </div>
                        <div className="text-center">
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f39c12' }}>{team.stats?.draws ?? 0}</div>
                            <div className="text-muted">Draws</div>
                        </div>
                    </div>
                </div>

                {/* API Key card */}
                <div className="card">
                    <h2>🔑 Bot API Key</h2>
                    <p className="text-muted mb-1">Used with <code>X-API-Key</code> header</p>
                    {apiKey
                        ? <div className="api-key-box">{apiKey}</div>
                        : <button className="btn btn-ghost btn-sm" onClick={viewApiKey}>Show API Key</button>
                    }
                    <div className="flex gap-1 mt-2">
                        <button className="btn btn-danger btn-sm" onClick={rotateKey} disabled={rotating}>
                            {rotating ? <span className="spinner" /> : 'Rotate Key'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Recent matches */}
            <div className="card mt-2">
                <div className="flex justify-between items-center mb-1">
                    <h2>Recent Matches</h2>
                    <Link to="/matches" className="btn btn-ghost btn-sm">View all</Link>
                </div>
                {matches.length === 0
                    ? <p className="text-muted">No matches yet.</p>
                    : (
                        <table>
                            <thead><tr><th>Topic</th><th>Opponent</th><th>Status</th></tr></thead>
                            <tbody>
                                {matches.map(m => {
                                    const opp = m.team1._id === team._id ? m.team2 : m.team1
                                    return (
                                        <tr key={m._id}>
                                            <td><Link to={`/matches/${m._id}`}>{m.topic?.title ?? '—'}</Link></td>
                                            <td>{opp?.name ?? '—'}</td>
                                            <td><span className={`badge badge-${m.status}`}>{m.status}</span></td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
            </div>

            {/* Leaderboard */}
            <div className="card mt-2">
                <h2>🏆 Leaderboard</h2>
                <table>
                    <thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>D</th></tr></thead>
                    <tbody>
                        {[...teams]
                            .sort((a, b) => (b.stats?.wins ?? 0) - (a.stats?.wins ?? 0))
                            .slice(0, 10)
                            .map((t, i) => (
                                <tr key={t._id}>
                                    <td>{i + 1}</td>
                                    <td>{t.name}</td>
                                    <td style={{ color: '#2ecc71' }}>{t.stats?.wins ?? 0}</td>
                                    <td style={{ color: '#e74c3c' }}>{t.stats?.losses ?? 0}</td>
                                    <td style={{ color: '#f39c12' }}>{t.stats?.draws ?? 0}</td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
