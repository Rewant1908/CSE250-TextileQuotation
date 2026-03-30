import { useState } from 'react'
import ProductCatalogue from './components/ProductCatalogue'
import CustomerForm from './components/CustomerForm'
import QuotationForm from './components/QuotationForm'
import QuotationHistory from './components/QuotationHistory'
import LoginPage from './components/LoginPage'
import './App.css'

const tabs = ['Products', 'Register Customer', 'Create Quotation', 'Quotation History']

function App() {
    const [activeTab, setActiveTab] = useState(0)
    const [isLoggedIn, setIsLoggedIn] = useState(false)

    if (!isLoggedIn) {
        return <LoginPage onLogin={() => setIsLoggedIn(true)} />
    }

    return (
        <div className="app">
            <header className="navbar">
                <div className="brand">
                    <span className="brand-icon">🧵</span>
                    <span className="brand-name">KT Impex</span>
                    <span className="brand-sub">Textile Quotation System</span>
                </div>
                <button
                    className="btn btn-logout"
                    onClick={() => setIsLoggedIn(false)}
                    style={{ marginLeft: 'auto' }}
                >
                    Logout
                </button>
            </header>

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
                {activeTab === 0 && <ProductCatalogue />}
                {activeTab === 1 && <CustomerForm />}
                {activeTab === 2 && <QuotationForm />}
                {activeTab === 3 && <QuotationHistory />}
            </main>

            <footer className="footer">
                <p>CSE250 – Database Management Systems &nbsp;|&nbsp; KT Impex Textile Quotation System</p>
            </footer>
        </div>
    )
}

export default App
