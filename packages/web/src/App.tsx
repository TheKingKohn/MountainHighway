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
  const { user } = useAuth()
  
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/listings">Listings</Link>
      {user && <Link to="/create-listing">Create Listing</Link>}
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
  
  return (
    <div className="home-container">
      <h2>Welcome to Mountain Highway</h2>
      <p>Your premier marketplace for outdoor gear and adventures!</p>
      
      <div className="home-buttons">
        <Link to="/listings" className="home-button primary">
          Browse Listings
        </Link>
        
        {user && (
          <Link to="/create-listing" className="home-button success">
            Create Listing
          </Link>
        )}
      </div>
      
      {!user && (
        <p className="home-subtitle">
          Sign in to create your own listings and start selling!
        </p>
      )}

      {/* Hidden admin hint - only visible in dev mode */}
      {user && (
        <div className="admin-dev-hint">
          <small>🔧 <em>Admin panel available at <a href="/admin">/admin</a></em></small>
        </div>
      )}
    </div>
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
