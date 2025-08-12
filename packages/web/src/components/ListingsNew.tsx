import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import SearchFilters, { FilterState } from './SearchFilters';
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
  category?: string;
  subcategory?: string;
  condition?: string;
  brand?: string;
  location?: string;
}

const Listings: React.FC = () => {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMediaIndex, setCurrentMediaIndex] = useState<{[key: string]: number}>({});
  const [filters, setFilters] = useState<FilterState>({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || 'all',
    condition: searchParams.get('condition') || '',
    brand: searchParams.get('brand') || '',
    location: searchParams.get('location') || '',
    minPrice: searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!) : null,
    maxPrice: searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!) : null,
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: searchParams.get('sortOrder') || 'desc'
  });

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    
    // Update URL parameters
    const newSearchParams = new URLSearchParams();
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== null && value !== '' && value !== 'all') {
        newSearchParams.set(key, value.toString());
      }
    });
    
    setSearchParams(newSearchParams);
  }, [setSearchParams]);

  useEffect(() => {
    fetchListings();
  }, [filters]); // Re-fetch when filters change

  const fetchListings = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      
      if (filters.search) queryParams.set('search', filters.search);
      if (filters.category && filters.category !== 'all') queryParams.set('category', filters.category);
      if (filters.condition) queryParams.set('condition', filters.condition);
      if (filters.brand) queryParams.set('brand', filters.brand);
      if (filters.location) queryParams.set('location', filters.location);
      if (filters.minPrice) queryParams.set('minPrice', filters.minPrice.toString());
      if (filters.maxPrice) queryParams.set('maxPrice', filters.maxPrice.toString());
      if (filters.sortBy) queryParams.set('sortBy', filters.sortBy);
      if (filters.sortOrder) queryParams.set('sortOrder', filters.sortOrder);
      
      const url = `${API_URL}/listings${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      console.log('Fetching listings with URL:', url);
      
      const response = await fetch(url);
      
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
      console.error('Failed to fetch listings:', err);
      
      // Fallback to mock data when backend is unavailable
      const mockListings: Listing[] = [
        {
          id: 'mock-1',
          title: 'iPhone 13 Pro',
          description: 'Excellent condition iPhone 13 Pro, 128GB, unlocked. Includes original box and charger.',
          priceCents: 75000,
          photos: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400'],
          status: 'active',
          createdAt: new Date().toISOString(),
          sellerId: 'mock-seller-1',
          category: 'electronics',
          condition: 'like_new',
          brand: 'Apple',
          location: 'San Francisco'
        },
        {
          id: 'mock-2',
          title: 'Vintage Leather Jacket',
          description: 'Classic brown leather jacket from the 90s. Size M, genuine leather, some wear but adds character.',
          priceCents: 12000,
          photos: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400'],
          status: 'active',
          createdAt: new Date().toISOString(),
          sellerId: 'mock-seller-2',
          category: 'fashion',
          condition: 'good',
          brand: 'Vintage',
          location: 'New York'
        },
        {
          id: 'mock-3',
          title: 'Home Garden Tools Set',
          description: 'Complete gardening tools set including spade, rake, hoe, and watering can. Perfect for home gardening.',
          priceCents: 8500,
          photos: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400'],
          status: 'active',
          createdAt: new Date().toISOString(),
          sellerId: 'mock-seller-3',
          category: 'home',
          condition: 'new',
          brand: 'GardenPro',
          location: 'Seattle'
        }
      ];
      
      setListings(mockListings);
      const indices: {[key: string]: number} = {};
      mockListings.forEach((listing: Listing) => {
        indices[listing.id] = 0;
      });
      setCurrentMediaIndex(indices);
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

  const changeMedia = (listingId: string, direction: number) => {
    const listing = listings.find(l => l.id === listingId);
    if (!listing) return;

    const mediaItems = [];
    if (listing.photos && listing.photos.length > 0) {
      mediaItems.push(...listing.photos);
    }
    if (listing.video) {
      mediaItems.push(listing.video);
    }

    if (mediaItems.length <= 1) return;

    const currentIndex = currentMediaIndex[listingId] || 0;
    const newIndex = (currentIndex + direction + mediaItems.length) % mediaItems.length;
    
    setCurrentMediaIndex(prev => ({
      ...prev,
      [listingId]: newIndex
    }));
  };

  const handlePurchase = (listing: Listing) => {
    if (token) {
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

  return (
    <div className="listings">
      <div className="listings-header">
        <h2>🛍️ Marketplace Listings</h2>
        <p>Discover amazing items from our community</p>
      </div>

      {/* Search and Filter Component */}
      <SearchFilters 
        onFiltersChange={handleFiltersChange}
        initialFilters={filters}
      />

      <div className="listings-stats">
        <div className="stat">
          <span className="stat-number">{listings.length}</span>
          <span className="stat-label">
            {filters.category === 'all' ? 'Active Listings' : `Filtered Results`}
          </span>
        </div>
        <div className="stat">
          <span className="stat-number">{new Set(listings.map(l => l.sellerId)).size}</span>
          <span className="stat-label">Active Sellers</span>
        </div>
        <div className="stat">
          <span className="stat-number">${listings.length > 0 ? (listings.reduce((sum, l) => sum + l.priceCents, 0) / listings.length / 100).toFixed(0) : '0'}</span>
          <span className="stat-label">Avg. Price</span>
        </div>
      </div>

      <div className="listings-grid">
        {listings.map(listing => {
          const mediaItems = [];
          if (listing.photos && listing.photos.length > 0) {
            mediaItems.push(...listing.photos.map(photo => ({ type: 'photo', url: photo })));
          }
          if (listing.video) {
            mediaItems.push({ type: 'video', url: listing.video });
          }
          
          const currentIndex = currentMediaIndex[listing.id] || 0;
          const currentMedia = mediaItems[currentIndex];

          return (
            <div key={listing.id} className="listing-card">
              <div className="listing-media">
                {mediaItems.length > 0 ? (
                  <>
                    {currentMedia?.type === 'video' ? (
                      <video 
                        src={currentMedia.url} 
                        controls 
                        className="listing-video"
                        onError={(e) => {
                          console.error('Video failed to load:', currentMedia.url);
                          (e.target as HTMLVideoElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <img 
                        src={currentMedia?.url} 
                        alt={listing.title}
                        className="listing-image"
                        onError={(e) => {
                          console.error('Image failed to load:', currentMedia?.url);
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                        }}
                      />
                    )}
                    
                    {mediaItems.length > 1 && (
                      <div className="media-controls">
                        <button 
                          className="media-nav prev"
                          onClick={() => changeMedia(listing.id, -1)}
                          aria-label="Previous media"
                        >
                          ‹
                        </button>
                        <span className="media-indicator">
                          {currentIndex + 1} / {mediaItems.length}
                        </span>
                        <button 
                          className="media-nav next"
                          onClick={() => changeMedia(listing.id, 1)}
                          aria-label="Next media"
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="no-image">📷 No Image</div>
                )}
              </div>
              
              <div className="listing-content">
                <h3 className="listing-title">{listing.title}</h3>
                <p className="listing-description">{listing.description}</p>
                
                {/* Additional listing details */}
                <div className="listing-details">
                  {listing.category && (
                    <span className="listing-badge category">
                      {listing.category}
                    </span>
                  )}
                  {listing.condition && (
                    <span className="listing-badge condition">
                      {listing.condition}
                    </span>
                  )}
                  {listing.brand && (
                    <span className="listing-badge brand">
                      {listing.brand}
                    </span>
                  )}
                  {listing.location && (
                    <span className="listing-badge location">
                      📍 {listing.location}
                    </span>
                  )}
                </div>
                
                <div className="listing-footer">
                  <span className="listing-price">${formatPrice(listing.priceCents)}</span>
                  <span className="listing-date">{formatDate(listing.createdAt)}</span>
                </div>
                
                <div className="listing-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => handlePurchase(listing)}
                  >
                    💳 Buy Now
                  </button>
                  <button className="btn btn-secondary">
                    💬 Message Seller
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {listings.length === 0 && !loading && (
        <div className="no-results">
          <h3>No listings found</h3>
          <p>Try adjusting your search filters or check back later.</p>
        </div>
      )}
    </div>
  );
};

export default Listings;
