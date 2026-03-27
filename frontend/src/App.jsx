import { useCallback, useMemo, useState } from 'react'
import ProductCatalogue from './components/ProductCatalogue'
import CustomerForm from './components/CustomerForm'
import QuotationForm from './components/QuotationForm'
import QuotationHistory from './components/QuotationHistory'
import Login from './components/Login'
import './App.css'

const tabs = ['Products', 'Register Customer', 'Create Quotation', 'Quotation History']

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function App() {
    const [activeTab, setActiveTab] = useState(0)
    const [token, setToken] = useState(() => localStorage.getItem('authToken'))
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('authUser')
        return stored ? JSON.parse(stored) : null
    })

    const handleLogin = (sessionToken, authUser) => {
        setToken(sessionToken)
        setUser(authUser)
        localStorage.setItem('authToken', sessionToken)
        localStorage.setItem('authUser', JSON.stringify(authUser))
    }

    const handleLogout = useCallback(() => {
        setToken(null)
        setUser(null)
        setActiveTab(0)
        localStorage.removeItem('authToken')
        localStorage.removeItem('authUser')
    }, [])

    const authenticatedContent = useMemo(() => (
        <>
            <nav className="tabs">
                {tabs.map((tab, i) => (
                    <button
                        key={i}
                        className={`tab-btn ${activeTab === i ? 'active' : ''}`}
                        onClick={() => setActiveTab(i)}
                    >
                        {tab}
                    </button>
                ))}
            </nav>

            <main className="content">
                {activeTab === 0 && <ProductCatalogue token={token} apiBase={API_BASE} onAuthError={handleLogout} />}
                {activeTab === 1 && <CustomerForm token={token} apiBase={API_BASE} onAuthError={handleLogout} />}
                {activeTab === 2 && <QuotationForm token={token} apiBase={API_BASE} onAuthError={handleLogout} />}
                {activeTab === 3 && <QuotationHistory token={token} apiBase={API_BASE} onAuthError={handleLogout} />}
            </main>
        </>
    ), [activeTab, handleLogout, token])

    if (!token) {
        return (
            <div className="auth-shell">
                <div className="floating-blob blob-1" />
                <div className="floating-blob blob-2" />
                <div className="auth-grid">
                    <div className="hero-card">
                        <div className="hero-badge">KT Impex • Secure Portal</div>
                        <h1>
                            Production-ready access
                            <span> for quotations and pricing.</span>
                        </h1>
                        <p className="hero-copy">
                            Sign in to manage products, register customers, and generate audit-ready quotations with GST breakdowns.
                        </p>
                        <div className="stat-grid">
                            <div className="stat-card">
                                <p className="stat-label">Uptime</p>
                                <p className="stat-value">99.9%</p>
                                <p className="stat-sub">hardened API gateway</p>
                            </div>
                            <div className="stat-card">
                                <p className="stat-label">Data</p>
                                <p className="stat-value">Encrypted</p>
                                <p className="stat-sub">JWT secured access</p>
                            </div>
                        </div>
                    </div>
                    <Login onLogin={handleLogin} apiBase={API_BASE} />
                </div>
            </div>
        )
    }

    return (
        <div className="app">
            <div className="floating-blob blob-1" />
            <div className="floating-blob blob-2" />
            <header className="navbar">
                <div className="brand">
                    <span className="brand-icon">🧵</span>
                    <div>
                        <span className="brand-name">KT Impex</span>
                        <span className="brand-sub">Textile Quotation System</span>
                    </div>
                </div>
                <div className="user-chip">
                    <div className="avatar">
                        {(() => {
                            const source = user?.username || 'KTI';
                            return source.length ? source[0].toUpperCase() : 'K';
                        })()}
                    </div>
                    <div className="user-meta">
                        <span className="user-name">{user?.username || 'Session'}</span>
                        <span className="user-role">Administrator</span>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>Logout</button>
                </div>
            </header>

            {authenticatedContent}

            <footer className="footer">
                <p>CSE250 – Database Management Systems &nbsp;|&nbsp; KT Impex Textile Quotation System</p>
            </footer>
        </div>
    )
}

export default App
