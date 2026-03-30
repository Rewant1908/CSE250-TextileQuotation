function LoginPage({ onLogin }) {
    const handleSubmit = (e) => {
        e.preventDefault()
        const username = e.target.username.value.trim()
        const password = e.target.password.value.trim()

        // Simple hardcoded check for now — replace with real API later
        if (username === 'admin' && password === 'ktimpex') {
            onLogin()
        } else {
            const err = document.getElementById('login-error')
            err.textContent = 'Invalid username or password.'
            err.style.display = 'block'
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <span className="brand-icon">🧵</span>
                    <span className="login-brand-name">KT Impex</span>
                </div>
                <h1 className="login-title">Sign in</h1>
                <p className="login-subtext">Textile Quotation System</p>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            placeholder="Enter username"
                            required
                            autoComplete="username"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Enter password"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <p id="login-error" className="login-error" style={{ display: 'none' }}></p>

                    <button type="submit" className="btn btn-primary login-btn">
                        Login
                    </button>
                </form>

                <p className="login-hint">Default: admin / ktimpex</p>
            </div>
        </div>
    )
}

export default LoginPage
