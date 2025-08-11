import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import axios from 'axios'
import './App.css'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import UserProfile from './components/UserProfile'
import AuthModal from './components/AuthModal'
import CreateListing from './components/CreateListing'
import ListingsPage from './components/Listings'
import AdminPanel from './components/AdminPanel'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function Navigation() {
  const { user, isAdmin } = useAuth()
  
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/listings">Listings</Link>
      {user && <Link to="/create-listing">Create Listing</Link>}
      {isAdmin && <Link to="/admin">Admin Panel</Link>}
      <Link to="/about">About</Link>
    </nav>
  )
}

function App() {
  const [apiHealth, setApiHealth] = useState<{ ok: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        console.log('Checking API health at:', `${API_URL}/health`)
        const response = await axios.get(`${API_URL}/health`)
        console.log('API health response:', response.data)
        setApiHealth(response.data)
      } catch (error) {
        console.error('API health check failed:', error)
        setApiHealth({ ok: false })
      } finally {
        setLoading(false)
      }
    }

    checkApiHealth()
    
    // Handle hash-based routing for admin
    if (window.location.hash === '#/admin') {
      window.location.href = '/admin';
    }
  }, [])

  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <header className="App-header">
            <div className="header-content">
              <div className="header-left">
                <h1>🏔️ Mountain Highway</h1>
                <Navigation />
              </div>
              <div className="header-right">
                <UserProfile onAuthClick={() => setShowAuthModal(true)} />
              </div>
            </div>
          </header>

          <main>
            <div className="api-status">
              {loading ? (
                <p>Checking API status...</p>
              ) : (
                <p>
                  API Status:{' '}
                  <span className={apiHealth?.ok ? 'status-ok' : 'status-error'}>
                    {apiHealth?.ok ? '✅ Connected' : '❌ Disconnected'}
                  </span>
                </p>
              )}
            </div>

            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/listings" element={<ListingsPage />} />
              <Route path="/create-listing" element={<CreateListing />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </main>

          <AuthModal 
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        </div>
      </Router>
    </AuthProvider>
  )
}

function Home() {
  const { user } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  
  const handleAuthClick = () => {
    setShowAuthModal(true)
  }
  
  return (
    <>
      <div className="marketplace-home">
        {/* Quick Actions Bar - Mobile First */}
        <div className="quick-actions">
          <Link to="/listings" className="action-button browse">
            <span className="action-icon">🔍</span>
            <span className="action-text">Browse</span>
          </Link>
          {user ? (
            <Link to="/create-listing" className="action-button sell">
              <span className="action-icon">💰</span>
              <span className="action-text">Sell</span>
            </Link>
          ) : (
            <button onClick={handleAuthClick} className="action-button login">
              <span className="action-icon">👤</span>
              <span className="action-text">Sign In</span>
            </button>
          )}
          {user && (
            <Link to="/profile" className="action-button profile">
              <span className="action-icon">⚙️</span>
              <span className="action-text">Profile</span>
            </Link>
          )}
        </div>

        {/* Welcome Banner with Social Proof */}
        <div className="welcome-banner">
          <h1>Mountain Highway</h1>
          <p>Join 2,500+ outdoor enthusiasts buying & selling gear locally</p>
          <div className="trust-indicators">
            <span className="trust-badge">🔒 Secure</span>
            <span className="trust-badge">⚡ Fast</span>
            <span className="trust-badge">👥 Trusted</span>
          </div>
        </div>

        {/* Categories Grid with Scarcity/Popularity */}
        <div className="categories-section">
          <h2>Shop by Category</h2>
          <div className="categories-grid">
            <Link to="/listings?category=hiking" className="category-item">
              <div className="category-icon">🥾</div>
              <span>Hiking</span>
              <div className="category-indicator hot">🔥 Hot</div>
            </Link>
            <Link to="/listings?category=camping" className="category-item">
              <div className="category-icon">⛺</div>
              <span>Camping</span>
              <div className="category-indicator">25+ items</div>
            </Link>
            <Link to="/listings?category=climbing" className="category-item">
              <div className="category-icon">🧗</div>
              <span>Climbing</span>
              <div className="category-indicator new">✨ New</div>
            </Link>
            <Link to="/listings?category=biking" className="category-item">
              <div className="category-icon">🚴</div>
              <span>Biking</span>
              <div className="category-indicator">18+ items</div>
            </Link>
            <Link to="/listings?category=water" className="category-item">
              <div className="category-icon">🏄</div>
              <span>Water Sports</span>
              <div className="category-indicator">12+ items</div>
            </Link>
            <Link to="/listings?category=winter" className="category-item">
              <div className="category-icon">⛷️</div>
              <span>Winter</span>
              <div className="category-indicator limited">⏰ Limited</div>
            </Link>
          </div>
        </div>

        {/* Recent Listings Preview with FOMO */}
        <div className="recent-listings">
          <div className="section-header">
            <h2>🔥 Trending Now</h2>
            <Link to="/listings" className="see-all">See all</Link>
          </div>
          <div className="listings-preview">
            <div className="preview-card">
              <div className="preview-image">📷</div>
              <div className="preview-info">
                <h3>Premium Backpack</h3>
                <p>$99 <span className="was-price">was $150</span></p>
                <div className="urgency">⏰ 3 people watching</div>
              </div>
            </div>
            <div className="preview-card">
              <div className="preview-image">📷</div>
              <div className="preview-info">
                <h3>Climbing Gear Set</h3>
                <p>$149</p>
                <div className="urgency">🔥 Just listed</div>
              </div>
            </div>
          </div>
          <Link to="/listings" className="view-all-button">
            View All {user ? '47' : '40+'} Listings
          </Link>
        </div>

        {/* Social Proof & Urgency CTA */}
        {user ? (
          <div className="sell-cta">
            <h3>💰 Start Earning Today</h3>
            <p>Join sellers making $200+ per month. List your first item in under 2 minutes!</p>
            <Link to="/create-listing" className="cta-button">
              List Your First Item
            </Link>
            <div className="success-stats">
              <small>✅ 85% of items sell within 7 days</small>
            </div>
          </div>
        ) : (
          <div className="sell-cta">
            <h3>🚀 Join 2,500+ Members</h3>
            <p>Free to join • Sell in minutes • Trusted community</p>
            <button onClick={handleAuthClick} className="cta-button">
              Sign Up Free - No Fees!
            </button>
            <div className="social-proof">
              <small>⭐ "Sold my gear in 2 days!" - Sarah M.</small>
            </div>
          </div>
        )}
      </div>
      
      {showAuthModal && (
        <AuthModal 
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)} 
        />
      )}
    </>
  )
}

function About() {
  return (
    <div>
      <h2>About</h2>
      <p>Mountain Highway connects outdoor enthusiasts through a trusted marketplace.</p>
    </div>
  )
}

export default App
