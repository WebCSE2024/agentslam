import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Topics() {
    const { team } = useAuth()
    const [topics, setTopics] = useState([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({ title: '', description: '' })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const load = () => api.get('/topics').then(r => setTopics(r.data)).finally(() => setLoading(false))
    useEffect(() => { load() }, [])

    const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

    const create = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setSubmitting(true)
        try {
            await api.post('/topics', form)
            setForm({ title: '', description: '' })
            setSuccess('Topic created!')
            load()
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const toggle = async (topicId, currentStatus) => {
        try {
            await api.put(`/topics/${topicId}`, { status: currentStatus === 'open' ? 'closed' : 'open' })
            load()
        } catch (err) {
            setError(err.message)
        }
    }

    const del = async (topicId) => {
        if (!confirm('Delete this topic?')) return
        try {
            await api.delete(`/topics/${topicId}`)
            load()
        } catch (err) {
            setError(err.message)
        }
    }

    return (
        <div>
            <h1 className="page-title">Topics</h1>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Admin create form */}
            {team.isAdmin && (
                <div className="card">
                    <h2>➕ New Topic</h2>
                    <form onSubmit={create}>
                        <div className="form-group">
                            <label>Title</label>
                            <input name="title" value={form.title} onChange={handle} required placeholder="e.g. AI will replace lawyers" />
                        </div>
                        <div className="form-group">
                            <label>Description (optional)</label>
                            <textarea name="description" value={form.description} onChange={handle} placeholder="Context for the debaters..." />
                        </div>
                        <button className="btn btn-primary" disabled={submitting}>
                            {submitting ? <span className="spinner" /> : 'Create Topic'}
                        </button>
                    </form>
                </div>
            )}

            <div className="card">
                {loading
                    ? <div className="loading"><div className="spinner" /></div>
                    : topics.length === 0
                        ? <p className="text-muted">No topics yet.</p>
                        : (
                            <table>
                                <thead><tr><th>Title</th><th>Status</th><th>Created by</th>{team.isAdmin && <th>Actions</th>}</tr></thead>
                                <tbody>
                                    {topics.map(t => (
                                        <tr key={t._id}>
                                            <td>
                                                <div>{t.title}</div>
                                                {t.description && <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: 2 }}>{t.description}</div>}
                                            </td>
                                            <td><span className={t.status === 'open' ? 'badge badge-ongoing' : 'badge badge-cancelled'}>{t.status}</span></td>
                                            <td className="text-muted">{t.createdBy?.name ?? '—'}</td>
                                            {team.isAdmin && (
                                                <td>
                                                    <div className="flex gap-1">
                                                        <button className="btn btn-ghost btn-sm" onClick={() => toggle(t._id, t.status)}>
                                                            {t.status === 'open' ? 'Close' : 'Open'}
                                                        </button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => del(t._id)}>Delete</button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
            </div>
        </div>
    )
}
