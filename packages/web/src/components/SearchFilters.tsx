import React, { useState, useEffect } from 'react';
import './SearchFilters.css';

interface SearchFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  initialFilters?: Partial<FilterState>;
}

export interface FilterState {
  search: string;
  category: string;
  condition: string;
  brand: string;
  location: string;
  minPrice: number | null;
  maxPrice: number | null;
  sortBy: string;
  sortOrder: string;
}

interface FilterOptions {
  categories: Array<{ value: string; label: string; icon: string }>;
  conditions: Array<{ value: string; label: string }>;
  brands: string[];
  locations: string[];
  priceRange: {
    min: number;
    max: number;
    average: number;
  };
}

const SearchFilters: React.FC<SearchFiltersProps> = ({ onFiltersChange, initialFilters = {} }) => {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: 'all',
    condition: '',
    brand: '',
    location: '',
    minPrice: null,
    maxPrice: null,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    ...initialFilters
  });

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    categories: [
      { value: 'all', label: 'All Categories', icon: '🛍️' },
      { value: 'electronics', label: 'Electronics', icon: '📱' },
      { value: 'fashion', label: 'Fashion', icon: '👕' },
      { value: 'home', label: 'Home & Garden', icon: '🏠' },
      { value: 'collectibles', label: 'Collectibles', icon: '🎨' },
      { value: 'automotive', label: 'Automotive', icon: '🚗' },
      { value: 'services', label: 'Services', icon: '🛠️' },
      { value: 'other', label: 'Other', icon: '📦' }
    ],
    conditions: [
      { value: '', label: 'Any Condition' },
      { value: 'new', label: 'New' },
      { value: 'like_new', label: 'Like New' },
      { value: 'good', label: 'Good' },
      { value: 'fair', label: 'Fair' },
      { value: 'poor', label: 'Poor' }
    ],
    brands: [],
    locations: [],
    priceRange: { min: 0, max: 100000, average: 5000 }
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  // Fetch filter options from API
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Notify parent when filters change
  useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`${API_URL}/listings/filters`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFilterOptions(prevOptions => ({
            ...prevOptions,
            brands: data.filters.brands,
            locations: data.filters.locations,
            priceRange: data.filters.priceRange
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handlePriceChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    handleFilterChange(type === 'min' ? 'minPrice' : 'maxPrice', numValue);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      category: 'all',
      condition: '',
      brand: '',
      location: '',
      minPrice: null,
      maxPrice: null,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(0);
  };

  const parsePrice = (dollars: string) => {
    return dollars === '' ? '' : (parseFloat(dollars) * 100).toString();
  };

  return (
    <div className="search-filters">
      {/* Main Search Bar */}
      <div className="search-bar">
        <div className="search-input-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search for items, brands, or keywords..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="search-input"
          />
          {filters.search && (
            <button
              type="button"
              className="clear-search"
              onClick={() => handleFilterChange('search', '')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Quick Category Filter */}
      <div className="category-filter">
        <div className="category-tabs">
          {filterOptions.categories.map(category => (
            <button
              key={category.value}
              className={`category-tab ${filters.category === category.value ? 'active' : ''}`}
              onClick={() => handleFilterChange('category', category.value)}
            >
              <span className="category-icon">{category.icon}</span>
              <span className="category-label">{category.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Filters Toggle */}
      <div className="filters-header">
        <button
          className="advanced-filters-toggle"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          <span>Advanced Filters</span>
          <span className={`toggle-icon ${showAdvancedFilters ? 'open' : ''}`}>▼</span>
        </button>
        
        <div className="sort-controls">
          <label htmlFor="sort-select">Sort by:</label>
          <select
            id="sort-select"
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-');
              handleFilterChange('sortBy', sortBy);
              handleFilterChange('sortOrder', sortOrder);
            }}
          >
            <option value="createdAt-desc">Newest First</option>
            <option value="createdAt-asc">Oldest First</option>
            <option value="priceCents-asc">Price: Low to High</option>
            <option value="priceCents-desc">Price: High to Low</option>
            <option value="title-asc">Title: A to Z</option>
            <option value="title-desc">Title: Z to A</option>
          </select>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="advanced-filters">
          <div className="filters-grid">
            {/* Condition Filter */}
            <div className="filter-group">
              <label htmlFor="condition-select">Condition</label>
              <select
                id="condition-select"
                value={filters.condition}
                onChange={(e) => handleFilterChange('condition', e.target.value)}
              >
                {filterOptions.conditions.map(condition => (
                  <option key={condition.value} value={condition.value}>
                    {condition.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Filter */}
            <div className="filter-group">
              <label htmlFor="brand-select">Brand</label>
              <select
                id="brand-select"
                value={filters.brand}
                onChange={(e) => handleFilterChange('brand', e.target.value)}
              >
                <option value="">Any Brand</option>
                {filterOptions.brands.map(brand => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div className="filter-group">
              <label htmlFor="location-select">Location</label>
              <select
                id="location-select"
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
              >
                <option value="">Any Location</option>
                {filterOptions.locations.map(location => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Price Range */}
          <div className="price-range">
            <label>Price Range</label>
            <div className="price-inputs">
              <div className="price-input-group">
                <span className="currency">$</span>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minPrice ? formatPrice(filters.minPrice) : ''}
                  onChange={(e) => handlePriceChange('min', parsePrice(e.target.value))}
                  min="0"
                  step="1"
                />
              </div>
              <span className="price-separator">to</span>
              <div className="price-input-group">
                <span className="currency">$</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxPrice ? formatPrice(filters.maxPrice) : ''}
                  onChange={(e) => handlePriceChange('max', parsePrice(e.target.value))}
                  min="0"
                  step="1"
                />
              </div>
            </div>
            {filterOptions.priceRange && (
              <div className="price-range-info">
                Average price: ${formatPrice(filterOptions.priceRange.average)}
              </div>
            )}
          </div>

          {/* Clear Filters */}
          <div className="filter-actions">
            <button
              type="button"
              className="clear-filters-btn"
              onClick={clearFilters}
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilters;
