import { useState } from 'react'

const API = 'http://localhost:5000'

export default function LoginPage({ onLogin }) {
    const [isSignup, setIsSignup] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        const username = e.target.username.value.trim()
        const password = e.target.password.value.trim()
        const email = isSignup ? (e.target.email?.value?.trim() || '') : ''

        const endpoint = isSignup ? '/api/signup' : '/api/login'
        const body = isSignup ? { username, password, email } : { username, password }

        try {
            const res = await fetch(`${API}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Something went wrong')
            } else {
                if (isSignup) {
                    setIsSignup(false)
                    setError('')
                    alert('Account created! Please login.')
                } else {
                    onLogin({ user_id: data.user_id, username: data.username, role: data.role })
                }
            }
        } catch {
            setError('Cannot connect to server. Is the backend running?')
        }
        setLoading(false)
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <span className="brand-icon">🧵</span>
                    <span className="login-brand-name">KT Impex</span>
                </div>
                <h1 className="login-title">{isSignup ? 'Create Account' : 'Sign in'}</h1>
                <p className="login-subtext">Textile Quotation System</p>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input id="username" name="username" type="text" placeholder="Enter username" required />
                    </div>

                    {isSignup && (
                        <div className="form-group">
                            <label htmlFor="email">Email (optional)</label>
                            <input id="email" name="email" type="email" placeholder="Enter email" />
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input id="password" name="password" type="password" placeholder="Enter password" required />
                    </div>

                    {error && <p className="login-error">{error}</p>}

                    <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                        {loading ? '...' : isSignup ? 'Create Account' : 'Login'}
                    </button>
                </form>

                <p className="login-toggle">
                    {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <span onClick={() => { setIsSignup(!isSignup); setError('') }}>
                        {isSignup ? 'Login' : 'Sign Up'}
                    </span>
                </p>
            </div>
        </div>
    )
}
