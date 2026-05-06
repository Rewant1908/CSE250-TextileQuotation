import { useEffect, useState } from 'react'
import API from '../api'

const fabricLines = [
    {
        title: 'Suiting',
        body: 'Premium blended, wool-touch, and formalwear fabrics for menswear dealers.',
    },
    {
        title: 'Shirting',
        body: 'Cotton, poplin, checks, stripes, and office-ready shirting ranges.',
    },
    {
        title: 'Dress Material',
        body: 'Curated dress fabric lots for retailers serving everyday and occasion wear.',
    },
]

const factoryPoints = [
    'Factory-sourced lots selected for dealer movement',
    'Consistent wholesale pricing and quotation approvals',
    'Trusted dealer channel for textile manufacturers',
]

export default function ProductCatalogue() {
    const [products, setProducts] = useState([])
    const [loading, setLoading]   = useState(true)

    useEffect(() => {
        fetch(`${API}/api/products`)
            .then(r => r.json())
            .then(data => { setProducts(data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    if (loading) return <div className="loading">Loading products...</div>

    return (
        <div className="company-page">
            <section className="hero-section">
                <div className="hero-copy">
                    <p className="eyebrow">Birgunj textile wholesale firm</p>
                    <h1>KT Impex</h1>
                    <p className="hero-text">
                        A premium B2B textile dealer connecting trusted factories with dealers
                        across suiting, shirting, and dress material categories.
                    </p>
                    <div className="hero-actions">
                        <a className="btn btn-primary" href="#products">View Product Lines</a>
                        <a className="btn btn-secondary" href="#contact">Contact Office</a>
                    </div>
                </div>
                <div className="hero-panel" aria-label="Company summary">
                    <span>Founded by</span>
                    <strong>Sandeep Kumar Agrawal</strong>
                    <span>Established around 2002</span>
                    <strong>Wholesale dealer network</strong>
                </div>
            </section>

            <section className="section-grid">
                <article className="info-block">
                    <p className="eyebrow">About</p>
                    <h2>Dealer-first textile distribution</h2>
                    <p>
                        KT Impex is based in Birgunj, Nepal and works as a wholesale textile
                        firm for dealers, retailers, and factory partners. The firm focuses on
                        dependable fabric sourcing, clear quotations, and long-term trade
                        relationships.
                    </p>
                </article>
                <article className="info-block">
                    <p className="eyebrow">Factory Desk</p>
                    <h2>Factories trust KT Impex as their dealer channel</h2>
                    <ul className="clean-list">
                        {factoryPoints.map(point => <li key={point}>{point}</li>)}
                    </ul>
                </article>
            </section>

            <section className="fabric-section" id="products">
                <div className="section-heading">
                    <p className="eyebrow">Fabric Types</p>
                    <h2>Core wholesale product lines</h2>
                </div>
                <div className="fabric-grid">
                    {fabricLines.map(line => (
                        <article className="fabric-card" key={line.title}>
                            <span className={`fabric-swatch fabric-${line.title.toLowerCase().replace(' ', '-')}`} />
                            <h3>{line.title}</h3>
                            <p>{line.body}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="card product-card">
                <div className="section-heading inline">
                    <div>
                        <p className="eyebrow">Live Catalogue</p>
                        <h2>Available products and dealer pricing</h2>
                    </div>
                    <span className="vat-note">VAT calculated at 13% on quotations</span>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                        <tr>
                            <th>#</th>
                            <th>Product Name</th>
                            <th>Fabric Type</th>
                            <th>Base Price (NPR/m)</th>
                        </tr>
                        </thead>
                        <tbody>
                        {products.map((p, i) => (
                            <tr key={p.product_id}>
                                <td>{i + 1}</td>
                                <td>{p.product_name}</td>
                                <td>
                                    <span className={`badge badge-${p.category.toLowerCase().replace(' ', '-')}`}>
                                        {p.category}
                                    </span>
                                </td>
                                <td>NPR {Number(p.base_price).toFixed(2)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
                {products.length === 0 && (
                    <p className="empty-state">No products found.</p>
                )}
            </section>

            <section className="dealer-contact-grid" id="contact">
                <article className="info-block">
                    <p className="eyebrow">Dealer Network</p>
                    <h2>Built for wholesale customers</h2>
                    <p>
                        Dealers can register, request quotations, and track admin approval
                        from the portal. Factory partners can use KT Impex as a reliable
                        bridge to active textile dealers.
                    </p>
                </article>
                <article className="contact-block">
                    <p className="eyebrow">Location & Contact</p>
                    <h2>Birgunj, Nepal</h2>
                    <p>Founder: Sandeep Kumar Agrawal</p>
                    <p>Firm: KT Impex</p>
                    <p>Trade: Suiting, Shirting, Dress Material</p>
                </article>
            </section>
        </div>
    )
}
