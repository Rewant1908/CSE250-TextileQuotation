import { useState } from 'react'

export default function Login({ onLogin, apiBase }) {
    const [form, setForm] = useState({ username: '', password: '' })
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)
        setLoading(true)
        try {
            const res = await fetch(`${apiBase}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })
            const data = await res.json()
            if (!res.ok || !data.token) {
                setError(data.error || 'Invalid credentials')
            } else {
                onLogin(data.token, data.user)
            }
        } catch {
            setError('Unable to reach server. Please try again.')
        }
        setLoading(false)
    }

    return (
        <div className="login-card">
            <div className="login-header">
                <p className="eyebrow">Secure Sign-in</p>
                <h2>Welcome back</h2>
                <p className="subhead">Authenticate to unlock the quotation workspace.</p>
            </div>
            {error && <div className="toast toast-error">{error}</div>}
            <form className="login-form" onSubmit={handleSubmit}>
                <label>
                    <span>Username</span>
                    <input
                        type="text"
                        value={form.username}
                        onChange={e => setForm({ ...form, username: e.target.value })}
                        placeholder="admin"
                        autoComplete="username"
                        required
                    />
                </label>
                <label>
                    <span>Password</span>
                    <input
                        type="password"
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                    />
                </label>
                <button className="btn btn-primary full" type="submit" disabled={loading}>
                    {loading ? 'Verifying...' : 'Login'}
                </button>
                <p className="helper">Use the admin credentials configured in the backend.</p>
            </form>
        </div>
    )
}
