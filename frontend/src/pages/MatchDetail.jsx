import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api.js'

export default function MatchDetail() {
    const { id } = useParams()
    const { team } = useAuth()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const load = () => {
        api.get(`/matches/${id}`)
            .then(r => setData(r.data))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        load()
        // Poll every 5s if match is ongoing
        const interval = setInterval(() => {
            api.get(`/matches/${id}`).then(r => setData(r.data)).catch(() => { })
        }, 5000)
        return () => clearInterval(interval)
    }, [id])

    // Admin actions
    const adminAction = async (action) => {
        try {
            await api.post(`/matches/${id}/${action}`)
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    if (loading) return <div className="loading"><div className="spinner" /></div>
    if (error) return <div className="alert alert-error">{error}</div>
    if (!data) return null

    const { match, transcript, judge } = data

    return (
        <div>
            <Link to="/matches" className="btn btn-ghost btn-sm mb-1">← Back</Link>
            <h1 className="page-title">{match.topic?.title ?? 'Match Detail'}</h1>

            {/* Match info */}
            <div className="card">
                <div className="flex justify-between items-center">
                    <div>
                        <span className={`badge badge-${match.status}`}>{match.status}</span>
                        {match.isDraw && <span className="badge badge-judging ml-1">Draw</span>}
                    </div>
                    {team.isAdmin && match.status === 'scheduled' && (
                        <button className="btn btn-success btn-sm" onClick={() => adminAction('start')}>▶ Start</button>
                    )}
                    {team.isAdmin && ['scheduled', 'ongoing'].includes(match.status) && (
                        <button className="btn btn-danger btn-sm" onClick={() => adminAction('cancel')}>✕ Cancel</button>
                    )}
                </div>

                <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
                    <div className="card" style={{ flex: 1, margin: 0, padding: '1rem' }}>
                        <h3>{match.team1?.name}</h3>
                        <span className={`badge badge-${match.team1Role}`}>{match.team1Role}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', color: '#718096', fontWeight: 700 }}>vs</div>
                    <div className="card" style={{ flex: 1, margin: 0, padding: '1rem' }}>
                        <h3>{match.team2?.name}</h3>
                        <span className={`badge badge-${match.team2Role}`}>{match.team2Role}</span>
                    </div>
                </div>

                <div className="flex gap-2 mt-2 text-muted" style={{ fontSize: '0.82rem' }}>
                    <span>Turn {match.turnNumber}/{match.maxTurns}</span>
                    <span>·</span>
                    <span>{match.timePerTurn}s per turn</span>
                    {match.currentTurn && <span>· 🕐 {match.currentTurn.name}'s turn</span>}
                </div>

                {match.winner && (
                    <div className="alert alert-success mt-2">
                        🏆 Winner: <strong>{match.winner.name}</strong>
                    </div>
                )}
            </div>

            {/* Judge result */}
            {judge && (
                <div className="card">
                    <h2>📋 Judge Result</h2>
                    <div className="grid-2">
                        <div>
                            <div className="text-muted mb-1">{match.team1?.name}</div>
                            <div>Clarity: {judge.team1Score.clarity} / Logic: {judge.team1Score.logic} / Persuasion: {judge.team1Score.persuasion}</div>
                            <div style={{ fontWeight: 700, color: '#7c93ee' }}>Total: {judge.team1Score.total}</div>
                        </div>
                        <div>
                            <div className="text-muted mb-1">{match.team2?.name}</div>
                            <div>Clarity: {judge.team2Score.clarity} / Logic: {judge.team2Score.logic} / Persuasion: {judge.team2Score.persuasion}</div>
                            <div style={{ fontWeight: 700, color: '#7c93ee' }}>Total: {judge.team2Score.total}</div>
                        </div>
                    </div>
                    {judge.reasoning && <p className="text-muted mt-2" style={{ fontStyle: 'italic' }}>"{judge.reasoning}"</p>}
                </div>
            )}

            {/* Transcript */}
            <div className="card">
                <h2>💬 Transcript ({transcript.length} turns)</h2>
                {transcript.length === 0
                    ? <p className="text-muted">No messages yet. Waiting for the debate to start.</p>
                    : (
                        <div className="transcript">
                            {transcript.map(msg => (
                                <div key={msg._id} className={`msg msg-${msg.role}`}>
                                    <div className="msg-meta">Turn {msg.turnNumber} · {msg.team?.name} ({msg.role})</div>
                                    {msg.content}
                                </div>
                            ))}
                        </div>
                    )}
            </div>
        </div>
    )
}
