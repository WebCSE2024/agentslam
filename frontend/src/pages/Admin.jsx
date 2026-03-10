import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Admin() {
    const { team } = useAuth()
    const navigate = useNavigate()
    const [teams, setTeams] = useState([])
    const [topics, setTopics] = useState([])
    const [allTeams, setAllTeams] = useState([])
    const [stats, setStats] = useState(null)
    const [matchForm, setMatchForm] = useState({ topicId: '', team1Id: '', team2Id: '', team1Role: 'for', maxTurns: 10, timePerTurn: 60 })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!team.isAdmin) { navigate('/'); return }
        Promise.all([
            api.get('/admin/teams'),
            api.get('/topics'),
            api.get('/teams'),
            api.get('/admin/stats'),
        ]).then(([t, top, at, s]) => {
            setTeams(t.data)
            setTopics(top.data)
            setAllTeams(at.data)
            setStats(s.data)
        }).finally(() => setLoading(false))
    }, [team.isAdmin, navigate])

    const mHandle = (e) => setMatchForm({ ...matchForm, [e.target.name]: e.target.value })

    const createMatch = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        try {
            await api.post('/matches', matchForm)
            setSuccess('Match created!')
        } catch (err) {
            setError(err.message)
        }
    }

    const toggleActive = async (teamId) => {
        try {
            await api.patch(`/admin/teams/${teamId}/toggle-active`)
            const refreshed = await api.get('/admin/teams')
            setTeams(refreshed.data)
        } catch (err) {
            setError(err.message)
        }
    }

    const promote = async (teamId) => {
        if (!confirm('Promote this team to admin?')) return
        try {
            await api.patch(`/admin/teams/${teamId}/make-admin`)
            const refreshed = await api.get('/admin/teams')
            setTeams(refreshed.data)
        } catch (err) {
            setError(err.message)
        }
    }

    if (loading) return <div className="loading"><div className="spinner" /></div>

    return (
        <div>
            <h1 className="page-title">⚙️ Admin Panel</h1>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Stats */}
            {stats && (
                <div className="flex gap-2 mb-1" style={{ flexWrap: 'wrap' }}>
                    {[
                        { label: 'Teams', val: stats.totalTeams, color: '#7c93ee' },
                        { label: 'Matches', val: stats.totalMatches, color: '#f39c12' },
                        ...Object.entries(stats.matchesByStatus || {}).map(([k, v]) => ({ label: k, val: v, color: '#a0aec0' })),
                    ].map(s => (
                        <div key={s.label} className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '1rem', margin: 0 }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: s.color }}>{s.val}</div>
                            <div className="text-muted">{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create match form */}
            <div className="card">
                <h2>🥊 Create Match</h2>
                <form onSubmit={createMatch}>
                    <div className="grid-2">
                        <div className="form-group">
                            <label>Topic</label>
                            <select name="topicId" value={matchForm.topicId} onChange={mHandle} required>
                                <option value="">Select topic…</option>
                                {topics.map(t => <option key={t._id} value={t._id}>{t.title}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Team 1 Role</label>
                            <select name="team1Role" value={matchForm.team1Role} onChange={mHandle}>
                                <option value="for">For</option>
                                <option value="against">Against</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Team 1</label>
                            <select name="team1Id" value={matchForm.team1Id} onChange={mHandle} required>
                                <option value="">Select team…</option>
                                {allTeams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Team 2</label>
                            <select name="team2Id" value={matchForm.team2Id} onChange={mHandle} required>
                                <option value="">Select team…</option>
                                {allTeams.filter(t => t._id !== matchForm.team1Id).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Max Turns</label>
                            <input name="maxTurns" type="number" min="2" max="50" value={matchForm.maxTurns} onChange={mHandle} />
                        </div>
                        <div className="form-group">
                            <label>Seconds per Turn</label>
                            <input name="timePerTurn" type="number" min="10" value={matchForm.timePerTurn} onChange={mHandle} />
                        </div>
                    </div>
                    <button className="btn btn-primary">Create Match</button>
                </form>
            </div>

            {/* Teams management */}
            <div className="card">
                <h2>👥 All Teams</h2>
                <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Active</th><th>Admin</th><th>API Key</th><th>Actions</th></tr></thead>
                    <tbody>
                        {teams.map(t => (
                            <tr key={t._id}>
                                <td>{t.name}</td>
                                <td className="text-muted">{t.email}</td>
                                <td>{t.isActive ? '✅' : '❌'}</td>
                                <td>{t.isAdmin ? '🔑' : '—'}</td>
                                <td><span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#7c93ee' }}>{t.apiKey?.slice(0, 12)}…</span></td>
                                <td>
                                    <div className="flex gap-1">
                                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(t._id)}>
                                            {t.isActive ? 'Disable' : 'Enable'}
                                        </button>
                                        {!t.isAdmin && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => promote(t._id)}>Make Admin</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
