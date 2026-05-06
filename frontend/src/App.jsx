import { useState } from 'react'
import CustomerForm from './components/CustomerForm'
import QuotationForm from './components/QuotationForm'
import QuotationHistory from './components/QuotationHistory'
import AdminProductManager from './components/AdminProductManager'
import LoginPage from './components/LoginPage'
import './App.css'

const USER_TABS  = ['Register Dealer', 'Create Quotation', 'My Quotations']
const ADMIN_TABS = ['Quotation Requests', 'Manage Products']

const STORAGE_KEY = 'kt_impex_user'

function App() {
    const [user, setUser]           = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            return saved ? JSON.parse(saved) : null
        } catch { return null }
    })
    const [activeTab, setActiveTab] = useState(0)

    const handleLogin = (u) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
        setUser(u)
        setActiveTab(0)
    }

    const handleLogout = () => {
        localStorage.removeItem(STORAGE_KEY)
        setUser(null)
        setActiveTab(0)
    }

    if (!user) return <LoginPage onLogin={handleLogin} />

    const isAdmin = user.role === 'admin'
    const tabs    = isAdmin ? ADMIN_TABS : USER_TABS

    return (
        <div className="app">
            <header className="navbar">
                <div className="brand">
                    <span className="brand-mark">KT</span>
                    <span className="brand-copy">
                        <span className="brand-name">KT Impex</span>
                        <span className="brand-sub">Premium Textile Wholesale</span>
                    </span>
                </div>
                <div className="userbar">
                    <span className="user-pill">
                        {isAdmin ? 'Admin' : 'Dealer'}: {user.username}
                    </span>
                    <button className="btn btn-logout" onClick={handleLogout}>Logout</button>
                </div>
            </header>

            <nav className="tabs">
                {tabs.map((tab, i) => (
                    <button key={i}
                        className={`tab-btn ${activeTab === i ? 'active' : ''}`}
                        onClick={() => setActiveTab(i)}>
                        {tab}
                    </button>
                ))}
            </nav>

            <main className="content">
                {isAdmin ? (
                    <>
                        {activeTab === 0 && <QuotationHistory user={user} />}
                        {activeTab === 1 && <AdminProductManager user={user} />}
                    </>
                ) : (
                    <>
                        {activeTab === 0 && <CustomerForm />}
                        {activeTab === 1 && <QuotationForm user={user} />}
                        {activeTab === 2 && <QuotationHistory user={user} />}
                    </>
                )}
            </main>

            <footer className="footer">
                <p>KT Impex, Birgunj, Nepal | Dealer quotation and factory sourcing portal</p>
            </footer>
        </div>
    )
}

export default App
