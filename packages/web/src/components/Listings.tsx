import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import './Listings.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface Listing {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  photos: string[];
  video?: string;
  status: string;
  createdAt: string;
  sellerId: string;
}

const Listings: React.FC = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState<{[key: string]: number}>({});
  
  // Get category from URL parameter
  const selectedCategory = searchParams.get('category') || 'all';

  // Debug logging
  useEffect(() => {
    console.log('Listings component - selectedCategory changed:', selectedCategory);
    console.log('Listings component - searchParams:', Object.fromEntries(searchParams));
  }, [selectedCategory, searchParams]);

  useEffect(() => {
    fetchListings();
  }, [selectedCategory]); // Re-fetch when category changes

  const fetchListings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/listings`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch listings');
      }
      
      const data = await response.json();
      if (data.success) {
        setListings(data.listings);
        // Initialize media indices for each listing
        const indices: {[key: string]: number} = {};
        data.listings.forEach((listing: Listing) => {
          indices[listing.id] = 0;
        });
        setCurrentMediaIndex(indices);
      } else {
        throw new Error(data.error || 'Failed to fetch listings');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch listings');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (priceCents: number) => {
    return (priceCents / 100).toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Filter listings based on selected category
  const categories = [
    { key: 'all', label: 'All Categories', icon: '🛍️' },
    { key: 'electronics', label: 'Electronics', icon: '📱' },
    { key: 'fashion', label: 'Fashion', icon: '👕' },
    { key: 'home', label: 'Home & Garden', icon: '🏠' },
    { key: 'collectibles', label: 'Collectibles', icon: '🎨' },
    { key: 'automotive', label: 'Automotive', icon: '🚗' },
    { key: 'services', label: 'Services', icon: '🛠️' }
  ];

  const filteredListings = React.useMemo(() => {
    if (selectedCategory === 'all' || !selectedCategory) {
      return listings;
    }
    
    return listings.filter(listing => {
      const searchText = selectedCategory.toLowerCase();
      const titleMatch = listing.title.toLowerCase().includes(searchText);
      const descriptionMatch = listing.description.toLowerCase().includes(searchText);
      
      // Also check for exact category matches
      const exactMatch = listing.title.toLowerCase().includes(selectedCategory) || 
                        listing.description.toLowerCase().includes(selectedCategory);
      
      return titleMatch || descriptionMatch || exactMatch;
    });
  }, [listings, selectedCategory]);

  const changeMedia = (listingId: string, direction: number) => {
    const listing = listings.find(l => l.id === listingId);
    if (!listing) return;
    
    const totalMedia = listing.photos.length + (listing.video ? 1 : 0);
    const currentIndex = currentMediaIndex[listingId] || 0;
    const newIndex = (currentIndex + direction + totalMedia) % totalMedia;
    
    setCurrentMediaIndex(prev => ({
      ...prev,
      [listingId]: newIndex
    }));
  };

  const setMedia = (listingId: string, index: number) => {
    setCurrentMediaIndex(prev => ({
      ...prev,
      [listingId]: index
    }));
  };

  const getCurrentMedia = (listing: Listing) => {
    const allMedia = [...listing.photos];
    if (listing.video) allMedia.push(listing.video);
    
    const currentIndex = currentMediaIndex[listing.id] || 0;
    return allMedia[currentIndex];
  };

  const isVideo = (url: string) => {
    return url.includes('videos/') || url.includes('.mp4') || url.includes('.webm') || url.includes('.mov');
  };

  const buyNow = async (listingId: string) => {
    if (!token) {
      alert('Please log in to purchase items');
      return;
    }
    
    const listing = listings.find(l => l.id === listingId);
    if (listing) {
      const price = formatPrice(listing.priceCents);
      alert(`🛒 Purchase: ${listing.title}\nPrice: $${price}\n\nIn a full implementation, this would:\n• Create Stripe checkout session\n• Process payment via escrow\n• Send confirmation email\n• Start delivery tracking`);
    }
  };

  if (loading) {
    return (
      <div className="listings-loading">
        <div className="loading-spinner">🔄</div>
        <p>Loading amazing listings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="listings-error">
        <h3>❌ Error loading listings</h3>
        <p>{error}</p>
        <button onClick={fetchListings} className="retry-button">
          🔄 Try Again
        </button>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="listings-empty">
        <h3>🌟 No listings yet</h3>
        <p>Be the first to create an amazing listing!</p>
      </div>
    );
  }

  return (
    <div className="listings">
      <div className="listings-header">
        <h2>🛍️ Marketplace Listings</h2>
        <p>Discover amazing items from our community</p>
      </div>

      {/* Category Filter */}
      <div className="category-filter">
        <h3>Filter by Category</h3>
        <div className="category-tabs">
          {categories.map(category => (
            <Link
              key={category.key}
              to={`/listings${category.key === 'all' ? '' : `?category=${category.key}`}`}
              className={`category-tab ${selectedCategory === category.key ? 'active' : ''}`}
            >
              <span className="category-icon">{category.icon}</span>
              <span>{category.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="listings-stats">
        <div className="stat">
          <span className="stat-number">{filteredListings.length}</span>
          <span className="stat-label">
            {selectedCategory === 'all' ? 'Active Listings' : `${categories.find(c => c.key === selectedCategory)?.label || ''} Items`}
          </span>
        </div>
        <div className="stat">
          <span className="stat-number">{new Set(filteredListings.map(l => l.sellerId)).size}</span>
          <span className="stat-label">Sellers</span>
        </div>
        <div className="stat">
          <span className="stat-number">${filteredListings.length > 0 ? (filteredListings.reduce((sum, l) => sum + l.priceCents, 0) / filteredListings.length / 100).toFixed(0) : '0'}</span>
          <span className="stat-label">Avg Price</span>
        </div>
      </div>

      <div className="listings-grid">
        {filteredListings.map(listing => {
          const currentMedia = getCurrentMedia(listing);
          const allMedia = [...listing.photos];
          if (listing.video) allMedia.push(listing.video);
          const currentIndex = currentMediaIndex[listing.id] || 0;

          return (
            <div key={listing.id} className="listing-card">
              <div className="media-container">
                {listing.video && <div className="video-badge">📹 VIDEO</div>}
                
                <div className="media-display">
                  {isVideo(currentMedia) ? (
                    <video 
                      src={currentMedia} 
                      className="media-item"
                      controls
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <img 
                      src={currentMedia} 
                      alt={listing.title}
                      className="media-item"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f0f0f0"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">📷 Photo</text></svg>';
                      }}
                    />
                  )}
                </div>

                {allMedia.length > 1 && (
                  <>
                    <button 
                      className="media-nav prev" 
                      onClick={() => changeMedia(listing.id, -1)}
                    >
                      ‹
                    </button>
                    <button 
                      className="media-nav next" 
                      onClick={() => changeMedia(listing.id, 1)}
                    >
                      ›
                    </button>
                    
                    <div className="media-indicators">
                      {allMedia.map((_, index) => (
                        <div 
                          key={index}
                          className={`indicator ${index === currentIndex ? 'active' : ''}`}
                          onClick={() => setMedia(listing.id, index)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="listing-info">
                <h3 className="listing-title">{listing.title}</h3>
                <p className="listing-description">{listing.description}</p>
                <div className="listing-price">${formatPrice(listing.priceCents)}</div>
                
                <div className="listing-meta">
                  <span>Listed {formatDate(listing.createdAt)}</span>
                  <span className={`status ${listing.status.toLowerCase()}`}>
                    {listing.status}
                  </span>
                </div>

                <button 
                  className="buy-button"
                  onClick={() => buyNow(listing.id)}
                >
                  💰 Buy Now
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Listings;
