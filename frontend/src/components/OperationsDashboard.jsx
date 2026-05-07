import { useCallback, useEffect, useMemo, useState } from 'react'
import API from '../api'

const money = (value) => `NPR ${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
})}`

const meters = (value) => `${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2
})} m`

export default function OperationsDashboard({ user }) {
    const [dashboard, setDashboard] = useState(null)
    const [inventory, setInventory] = useState([])
    const [query, setQuery] = useState('')
    const [maxPrice, setMaxPrice] = useState('')
    const [loading, setLoading] = useState(true)
    const [searching, setSearching] = useState(false)
    const [toast, setToast] = useState(null)

    const showToast = (msg, type) => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    const loadDashboard = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API}/api/operations/dashboard?user_id=${user.user_id}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Dashboard failed')
            setDashboard(data)
        } catch (err) {
            showToast(err.message || 'Could not load operations dashboard', 'error')
        } finally {
            setLoading(false)
        }
    }, [user.user_id])

    const searchInventory = useCallback(async () => {
        setSearching(true)
        const params = new URLSearchParams()
        if (query.trim()) params.set('q', query.trim())
        if (maxPrice) params.set('max_price', maxPrice)
        try {
            const res = await fetch(`${API}/api/inventory/search?${params.toString()}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Search failed')
            setInventory(Array.isArray(data) ? data : [])
        } catch (err) {
            showToast(err.message || 'Could not search inventory', 'error')
        } finally {
            setSearching(false)
        }
    }, [query, maxPrice])

    useEffect(() => { loadDashboard() }, [loadDashboard])
    useEffect(() => { searchInventory() }, [searchInventory])

    const summary = useMemo(() => dashboard?.summary || {}, [dashboard])
    const riskRatio = useMemo(() => {
        const stockValue = Number(summary.stock_cost_value || 0)
        if (!stockValue) return 0
        return Math.round((Number(summary.dead_stock_value || 0) / stockValue) * 100)
    }, [summary])

    if (loading) return <div className="loading">Loading operations dashboard...</div>

    return (
        <div className="ops-page">
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

            <section className="card ops-hero">
                <div>
                    <p className="eyebrow">Wholesale intelligence</p>
                    <h2>Inventory Operating System</h2>
                    <p>
                        Bale-to-Than visibility, retailer memory, stock movement, margin signals,
                        and procurement intelligence in one operating view.
                    </p>
                </div>
                <div className="ops-risk">
                    <span>Dead stock risk</span>
                    <strong>{riskRatio}%</strong>
                    <small>{money(summary.dead_stock_value)} blocked cost value</small>
                </div>
            </section>

            <section className="metric-grid">
                <Metric label="Bales" value={summary.total_bales || 0} />
                <Metric label="Thans" value={summary.total_thans || 0} />
                <Metric label="Available Meters" value={meters(summary.available_meters)} />
                <Metric label="Stock Cost" value={money(summary.stock_cost_value)} />
                <Metric label="Retail Value" value={money(summary.stock_retail_value)} />
                <Metric label="Unrealized Margin" value={money(summary.unrealized_margin)} />
            </section>

            <section className="ops-grid two">
                <Panel title="Category Movement">
                    <table>
                        <thead>
                            <tr><th>Category</th><th>Sold</th><th>Remaining</th><th>Sell Through</th><th>Margin</th></tr>
                        </thead>
                        <tbody>
                            {dashboard?.categoryMovement?.map(row => (
                                <tr key={row.category}>
                                    <td>{row.category}</td>
                                    <td>{meters(row.sold_meters)}</td>
                                    <td>{meters(row.remaining_meters)}</td>
                                    <td>{Math.round(Number(row.sell_through_rate || 0) * 100)}%</td>
                                    <td className="price-accent">{money(row.realized_margin)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>

                <Panel title="Supplier Signals">
                    <table>
                        <thead>
                            <tr><th>Supplier</th><th>Quality</th><th>Delay</th><th>Sold</th><th>Margin</th></tr>
                        </thead>
                        <tbody>
                            {dashboard?.supplierSignals?.map(row => (
                                <tr key={row.supplier_id}>
                                    <td>{row.supplier_name}</td>
                                    <td>{Number(row.quality_rating || 0).toFixed(1)}/5</td>
                                    <td><span className="mini-pill">{row.delay_frequency}</span></td>
                                    <td>{meters(row.meters_sold)}</td>
                                    <td className="price-accent">{money(row.realized_margin)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>
            </section>

            <section className="ops-grid two">
                <Panel title="Dead Stock Watchlist">
                    <table>
                        <thead>
                            <tr><th>Than</th><th>Fabric</th><th>Stock</th><th>Location</th><th>Idle Days</th></tr>
                        </thead>
                        <tbody>
                            {dashboard?.deadStock?.map(row => (
                                <tr key={row.than_id}>
                                    <td>{row.than_code}</td>
                                    <td>{[row.color, row.design, row.fabric_type].filter(Boolean).join(' / ')}</td>
                                    <td>{meters(row.remaining_stock)}</td>
                                    <td>{row.warehouse_location || '-'}</td>
                                    <td><span className={`mini-pill ${row.movement_speed === 'dead' ? 'danger' : ''}`}>{row.days_without_movement}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>

                <Panel title="Retailer Memory">
                    <table>
                        <thead>
                            <tr><th>Retailer</th><th>Prefers</th><th>Payment</th><th>Revenue</th><th>Balance</th></tr>
                        </thead>
                        <tbody>
                            {dashboard?.retailerSignals?.map(row => (
                                <tr key={row.retailer_id}>
                                    <td>{row.shop_name}<br /><small>{row.market_location || '-'}</small></td>
                                    <td>{row.preferred_categories || '-'}</td>
                                    <td><span className="mini-pill">{row.payment_pattern}</span></td>
                                    <td>{money(row.revenue)}</td>
                                    <td className={Number(row.outstanding_balance) > 0 ? 'risk-text' : ''}>{money(row.outstanding_balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>
            </section>

            <section className="card">
                <div className="section-heading inline">
                    <div>
                        <h2>Inventory Search</h2>
                        <p className="muted-copy">Search fabric, color, design, category, code, or warehouse location.</p>
                    </div>
                </div>
                <div className="search-row">
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="e.g. black floral cotton"
                    />
                    <input
                        type="number"
                        min="0"
                        value={maxPrice}
                        onChange={e => setMaxPrice(e.target.value)}
                        placeholder="Max price/m"
                    />
                    <button className="btn btn-primary" onClick={searchInventory} disabled={searching}>
                        {searching ? 'Searching...' : 'Search'}
                    </button>
                </div>
                <table>
                    <thead>
                        <tr><th>Than</th><th>Fabric</th><th>Stock</th><th>Price</th><th>Margin/m</th><th>Location</th><th>Speed</th></tr>
                    </thead>
                    <tbody>
                        {inventory.map(row => (
                            <tr key={row.than_id}>
                                <td>{row.than_code}</td>
                                <td>{[row.color, row.design, row.fabric_type].filter(Boolean).join(' / ')}</td>
                                <td>{meters(row.remaining_stock)}</td>
                                <td>{money(row.selling_price)}</td>
                                <td className="price-accent">{money(row.margin_per_meter)}</td>
                                <td>{row.warehouse_location || '-'}</td>
                                <td><span className="mini-pill">{row.movement_speed}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {inventory.length === 0 && <p className="empty-state">No matching Thans found.</p>}
            </section>
        </div>
    )
}

function Metric({ label, value }) {
    return (
        <div className="metric-card">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    )
}

function Panel({ title, children }) {
    return (
        <section className="card compact-panel">
            <h2>{title}</h2>
            {children}
        </section>
    )
}
