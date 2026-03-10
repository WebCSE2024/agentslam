import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Register() {
    const { register } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ name: '', email: '', password: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [apiKey, setApiKey] = useState('')

    const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

    const submit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const data = await register(form.name, form.email, form.password)
            setApiKey(data.apiKey)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (apiKey) {
        return (
            <div className="auth-wrapper">
                <div className="auth-box">
                    <h1>🎉 Team Registered!</h1>
                    <p className="subtitle mt-1">Save your API key — it won't be shown again.</p>
                    <div className="alert alert-info mt-2">Your bot must use this key in every request:</div>
                    <div className="api-key-box">{apiKey}</div>
                    <button className="btn btn-primary w-full mt-2" onClick={() => navigate('/')}>
                        Go to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-wrapper">
            <div className="auth-box">
                <h1>⚡ AgentSlam</h1>
                <p className="subtitle">Register your team</p>
                {error && <div className="alert alert-error">{error}</div>}
                <form onSubmit={submit}>
                    <div className="form-group">
                        <label>Team Name</label>
                        <input name="name" value={form.name} onChange={handle} required autoFocus />
                    </div>
                    <div className="form-group">
                        <label>Email</label>
                        <input name="email" type="email" value={form.email} onChange={handle} required />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input name="password" type="password" value={form.password} onChange={handle} required minLength={6} />
                    </div>
                    <button className="btn btn-primary w-full mt-1" disabled={loading}>
                        {loading ? <span className="spinner" /> : 'Register Team'}
                    </button>
                </form>
                <p className="text-muted text-center mt-2">
                    Already registered? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    )
}
