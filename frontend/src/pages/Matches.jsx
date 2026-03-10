import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

export default function Matches() {
    const [matches, setMatches] = useState([])
    const [filter, setFilter] = useState('')
    const [loading, setLoading] = useState(true)

    const load = (status = '') => {
        setLoading(true)
        api.get(`/matches${status ? `?status=${status}` : ''}`)
            .then(r => setMatches(r.data))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [])

    const statuses = ['', 'scheduled', 'ongoing', 'judging', 'completed', 'cancelled']

    return (
        <div>
            <h1 className="page-title">Matches</h1>

            <div className="flex gap-1 mb-1" style={{ flexWrap: 'wrap' }}>
                {statuses.map(s => (
                    <button
                        key={s}
                        className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => { setFilter(s); load(s) }}
                    >
                        {s || 'All'}
                    </button>
                ))}
            </div>

            <div className="card">
                {loading
                    ? <div className="loading"><div className="spinner" /></div>
                    : matches.length === 0
                        ? <p className="text-muted">No matches found.</p>
                        : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Topic</th>
                                        <th>Team 1</th>
                                        <th>vs</th>
                                        <th>Team 2</th>
                                        <th>Turns</th>
                                        <th>Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matches.map(m => (
                                        <tr key={m._id}>
                                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {m.topic?.title ?? '—'}
                                            </td>
                                            <td>{m.team1?.name ?? '—'}</td>
                                            <td className="text-muted">vs</td>
                                            <td>{m.team2?.name ?? '—'}</td>
                                            <td className="text-muted">{m.turnNumber}/{m.maxTurns}</td>
                                            <td><span className={`badge badge-${m.status}`}>{m.status}</span></td>
                                            <td>
                                                <Link to={`/matches/${m._id}`} className="btn btn-ghost btn-sm">View</Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
            </div>
        </div>
    )
}
