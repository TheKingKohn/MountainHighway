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
      {user && <Link to="/community">Community</Link>}
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
              <Route path="/community" element={<Community />} />
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
  const [recentListings, setRecentListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchRecentListings()
  }, [])

  const fetchRecentListings = async () => {
    try {
      const response = await fetch(`${API_URL}/listings`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Get the 2 most recent listings
          const recent = data.listings
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 2)
          setRecentListings(recent)
        }
      }
    } catch (error) {
      console.error('Failed to fetch recent listings:', error)
    } finally {
      setLoading(false)
    }
  }
  
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
          <p>Join 2,500+ members buying & selling locally</p>
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
            <Link to="/listings?category=electronics" className="category-item">
              <div className="category-icon">📱</div>
              <span>Electronics</span>
              <div className="category-indicator hot">🔥 Hot</div>
            </Link>
            <Link to="/listings?category=fashion" className="category-item">
              <div className="category-icon">👕</div>
              <span>Fashion</span>
              <div className="category-indicator">32+ items</div>
            </Link>
            <Link to="/listings?category=home" className="category-item">
              <div className="category-icon">🏠</div>
              <span>Home & Garden</span>
              <div className="category-indicator new">✨ New</div>
            </Link>
            <Link to="/listings?category=collectibles" className="category-item">
              <div className="category-icon">🎨</div>
              <span>Collectibles</span>
              <div className="category-indicator">15+ items</div>
            </Link>
            <Link to="/listings?category=automotive" className="category-item">
              <div className="category-icon">🚗</div>
              <span>Automotive</span>
              <div className="category-indicator">8+ items</div>
            </Link>
            <Link to="/listings?category=services" className="category-item">
              <div className="category-icon">🛠️</div>
              <span>Services</span>
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
            {loading ? (
              <>
                <div className="preview-card">
                  <div className="preview-image">📷</div>
                  <div className="preview-info">
                    <h3>Loading...</h3>
                    <p>$--</p>
                  </div>
                </div>
                <div className="preview-card">
                  <div className="preview-image">📷</div>
                  <div className="preview-info">
                    <h3>Loading...</h3>
                    <p>$--</p>
                  </div>
                </div>
              </>
            ) : recentListings.length > 0 ? (
              recentListings.map((listing, index) => (
                <div key={listing.id} className="preview-card">
                  <div className="preview-image">📷</div>
                  <div className="preview-info">
                    <h3>{listing.title}</h3>
                    <p>${(listing.priceCents / 100).toFixed(2)}</p>
                    <div className="urgency">
                      {index === 0 ? '🔥 Just listed' : '⏰ Popular item'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="preview-card">
                  <div className="preview-image">📷</div>
                  <div className="preview-info">
                    <h3>No listings yet</h3>
                    <p>Be the first to sell!</p>
                  </div>
                </div>
                <div className="preview-card">
                  <div className="preview-image">�</div>
                  <div className="preview-info">
                    <h3>Start selling today</h3>
                    <p>List your items</p>
                  </div>
                </div>
              </>
            )}
          </div>
          <Link to="/listings" className="view-all-button">
            View All Listings
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
      <h2>About Mountain Highway</h2>
      <p>Mountain Highway is your local exclusive marketplace where community matters. Connect with trusted members, discover unique items, and build lasting relationships.</p>
    </div>
  )
}

function Community() {
  const { user } = useAuth()
  
  if (!user) {
    return (
      <div className="community-page">
        <h2>Community</h2>
        <p>Please sign in to access the community features.</p>
      </div>
    )
  }

  return (
    <div className="community-page">
      <h2>🌟 Community Hub</h2>
      
      {/* Community Stats */}
      <div className="community-stats">
        <div className="stat-card">
          <div className="stat-number">2,500+</div>
          <div className="stat-label">Active Members</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">850+</div>
          <div className="stat-label">Items Sold</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">98%</div>
          <div className="stat-label">Satisfaction</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="community-actions">
        <h3>Connect & Share</h3>
        <div className="action-grid">
          <div className="action-card">
            <div className="action-icon">💬</div>
            <h4>General Chat</h4>
            <p>Connect with other members</p>
            <button className="action-btn">Join Chat</button>
          </div>
          <div className="action-card">
            <div className="action-icon">🤝</div>
            <h4>Trade Requests</h4>
            <p>Looking for something specific?</p>
            <button className="action-btn">Post Request</button>
          </div>
          <div className="action-card">
            <div className="action-icon">⭐</div>
            <h4>Member Reviews</h4>
            <p>Share your experience</p>
            <button className="action-btn">Write Review</button>
          </div>
          <div className="action-card">
            <div className="action-icon">📍</div>
            <h4>Local Events</h4>
            <p>Meet up with members nearby</p>
            <button className="action-btn">View Events</button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <h3>Recent Community Activity</h3>
        <div className="activity-feed">
          <div className="activity-item">
            <div className="activity-avatar">👤</div>
            <div className="activity-content">
              <p><strong>Sarah M.</strong> left a 5-star review</p>
              <small>2 hours ago</small>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-avatar">👤</div>
            <div className="activity-content">
              <p><strong>Mike D.</strong> is looking for vintage electronics</p>
              <small>4 hours ago</small>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-avatar">👤</div>
            <div className="activity-content">
              <p><strong>Lisa K.</strong> joined the community</p>
              <small>6 hours ago</small>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Features */}
      <div className="coming-soon">
        <h3>🚀 Coming Soon</h3>
        <div className="feature-list">
          <div className="feature-item">💬 Real-time messaging</div>
          <div className="feature-item">📱 Mobile app</div>
          <div className="feature-item">🏆 Member rewards program</div>
          <div className="feature-item">📊 Advanced analytics</div>
        </div>
      </div>
    </div>
  )
}

export default App
