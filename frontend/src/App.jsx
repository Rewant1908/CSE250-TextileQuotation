import { useState } from 'react'
import ProductCatalogue from './components/ProductCatalogue'
import CustomerForm from './components/CustomerForm'
import QuotationForm from './components/QuotationForm'
import QuotationHistory from './components/QuotationHistory'
import AdminProductManager from './components/AdminProductManager'
import LoginPage from './components/LoginPage'
import './App.css'

const USER_TABS  = ['Products', 'Register Customer', 'Create Quotation', 'My Quotations']
const ADMIN_TABS = ['Quotation Requests', 'Manage Products']

function App() {
    const [user, setUser]         = useState(null)
    const [activeTab, setActiveTab] = useState(0)

    if (!user) return <LoginPage onLogin={(u) => { setUser(u); setActiveTab(0) }} />

    const isAdmin = user.role === 'admin'
    const tabs    = isAdmin ? ADMIN_TABS : USER_TABS

    return (
        <div className="app">
            <header className="navbar">
                <div className="brand">
                    <span className="brand-icon">🧵</span>
                    <span className="brand-name">KT Impex</span>
                    <span className="brand-sub">Textile Quotation System</span>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                        {isAdmin ? '🔐 Admin' : '👤'} {user.username}
                    </span>
                    <button className="btn btn-logout" onClick={() => { setUser(null); setActiveTab(0) }}>Logout</button>
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
                        {activeTab === 1 && <AdminProductManager />}
                    </>
                ) : (
                    <>
                        {activeTab === 0 && <ProductCatalogue />}
                        {activeTab === 1 && <CustomerForm />}
                        {activeTab === 2 && <QuotationForm user={user} />}
                        {activeTab === 3 && <QuotationHistory user={user} />}
                    </>
                )}
            </main>

            <footer className="footer">
                <p>CSE250 – Database Management Systems &nbsp;|&nbsp; KT Impex Textile Quotation System</p>
            </footer>
        </div>
    )
}

export default App
