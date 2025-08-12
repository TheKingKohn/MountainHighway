import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './CreateListing.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface CreateListingProps {
  onListingCreated?: () => void;
}

const CreateListing: React.FC<CreateListingProps> = ({ onListingCreated }) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priceCents: '',
    category: 'other',
    subcategory: '',
    condition: 'good',
    brand: '',
    location: ''
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Category and condition options
  const categories = [
    { value: 'electronics', label: 'Electronics', icon: '📱' },
    { value: 'fashion', label: 'Fashion', icon: '👕' },
    { value: 'home', label: 'Home & Garden', icon: '🏠' },
    { value: 'collectibles', label: 'Collectibles', icon: '🎨' },
    { value: 'automotive', label: 'Automotive', icon: '🚗' },
    { value: 'services', label: 'Services', icon: '🛠️' },
    { value: 'other', label: 'Other', icon: '📦' }
  ];

  const conditions = [
    { value: 'new', label: 'New' },
    { value: 'like_new', label: 'Like New' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Special handling for price input
    if (name === 'priceCents') {
      // Convert dollar amount to cents
      const dollarValue = parseFloat(value);
      if (isNaN(dollarValue) || dollarValue < 0) {
        setFormData(prev => ({
          ...prev,
          [name]: ''
        }));
        return;
      }
      
      // Check for reasonable maximum (e.g., $10,000)
      if (dollarValue > 10000) {
        setError('Price cannot exceed $10,000');
        return;
      }
      
      // Convert to cents and ensure integer
      const centsValue = Math.round(dollarValue * 100).toString();
      setFormData(prev => ({
        ...prev,
        [name]: centsValue
      }));
      setError(null);
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      
      // Enforce 3-photo limit
      if (fileArray.length > 3) {
        setError('Maximum 3 photos allowed. Please select only 3 images.');
        // Clear the input
        e.target.value = '';
        return;
      }
      
      // Validate file types and sizes
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      for (const file of fileArray) {
        if (!validTypes.includes(file.type)) {
          setError('Only JPEG, PNG, and WebP images are allowed');
          e.target.value = '';
          return;
        }
        if (file.size > maxSize) {
          setError('Each image must be smaller than 5MB');
          e.target.value = '';
          return;
        }
      }
      
      setPhotos(fileArray);
      setError(null);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideo(e.target.files[0]);
    }
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return false;
    }
    if (formData.title.length > 200) {
      setError('Title cannot exceed 200 characters');
      return false;
    }
    
    if (!formData.description.trim()) {
      setError('Description is required');
      return false;
    }
    if (formData.description.length > 2000) {
      setError('Description cannot exceed 2000 characters');
      return false;
    }
    
    const priceInCents = parseInt(formData.priceCents);
    if (!formData.priceCents || isNaN(priceInCents) || priceInCents <= 0) {
      setError('Please enter a valid price between $0.01 and $10,000');
      return false;
    }
    if (priceInCents > 1000000) { // $10,000 in cents
      setError('Price cannot exceed $10,000');
      return false;
    }
    
    if (photos.length === 0) {
      setError('At least one photo is required');
      return false;
    }
    if (photos.length > 3) {
      setError('Maximum 3 photos allowed');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) return;

    if (!token) {
      setError('You must be logged in to create a listing');
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('priceCents', formData.priceCents);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('subcategory', formData.subcategory);
      formDataToSend.append('condition', formData.condition);
      formDataToSend.append('brand', formData.brand);
      formDataToSend.append('location', formData.location);

      // Add photos
      photos.forEach(photo => {
        formDataToSend.append('photos', photo);
      });

      // Add video if present
      if (video) {
        formDataToSend.append('video', video);
      }

      const response = await fetch(`${API_URL}/listings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create listing');
      }

      await response.json();
      
      setSuccess('Listing created successfully!');
      
      // Reset form
      setFormData({ 
        title: '', 
        description: '', 
        priceCents: '',
        category: 'other',
        subcategory: '',
        condition: 'good',
        brand: '',
        location: ''
      });
      setPhotos([]);
      setVideo(null);
      
      // Reset file inputs
      const photoInput = document.getElementById('photos') as HTMLInputElement;
      const videoInput = document.getElementById('video') as HTMLInputElement;
      if (photoInput) photoInput.value = '';
      if (videoInput) videoInput.value = '';

      if (onListingCreated) {
        onListingCreated();
      }

    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: string) => {
    if (!cents) return '';
    const dollars = parseInt(cents) / 100;
    return dollars.toFixed(2);
  };

  return (
    <div className="create-listing">
      <div className="create-listing-container">
        <h2>🏷️ Create New Listing</h2>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="listing-form">
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Give your item a great title"
              maxLength={200}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe your item in detail"
              maxLength={2000}
              rows={5}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.icon} {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="condition">Condition *</label>
              <select
                id="condition"
                name="condition"
                value={formData.condition}
                onChange={handleInputChange}
                required
              >
                {conditions.map(condition => (
                  <option key={condition.value} value={condition.value}>
                    {condition.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="brand">Brand</label>
              <input
                type="text"
                id="brand"
                name="brand"
                value={formData.brand}
                onChange={handleInputChange}
                placeholder="e.g., Apple, Nike, Toyota"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label htmlFor="subcategory">Subcategory</label>
              <input
                type="text"
                id="subcategory"
                name="subcategory"
                value={formData.subcategory}
                onChange={handleInputChange}
                placeholder="e.g., Smartphone, T-shirt, Laptop"
                maxLength={100}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="City, neighborhood, or area"
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label htmlFor="priceCents">Price * (Enter amount in dollars)</label>
            <input
              type="number"
              id="priceCents"
              name="priceCents"
              value={formData.priceCents ? (parseInt(formData.priceCents) / 100).toString() : ''}
              onChange={handleInputChange}
              placeholder="25.00"
              min="0.01"
              max="10000"
              step="0.01"
              required
            />
            <small className="form-help">Enter the price in dollars (e.g., 25.00 for $25.00). Maximum $10,000.</small>
            {formData.priceCents && (
              <div className="price-preview">
                Preview: ${formatPrice(formData.priceCents)}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="photos">Photos * (1-3 images)</label>
            <input
              type="file"
              id="photos"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handlePhotoChange}
              required
            />
            <div className="file-info">
              At least 1 photo required. Max 3 photos, 5MB each. JPEG, PNG, WebP supported.
            </div>
            {photos.length > 0 && (
              <div className="file-preview">
                Selected photos: {photos.map(photo => photo.name).join(', ')}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="video">Video (optional)</label>
            <input
              type="file"
              id="video"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleVideoChange}
            />
            <div className="file-info">
              Optional. Max 50MB. MP4, WebM, QuickTime supported.
            </div>
            {video && (
              <div className="file-preview">
                Selected video: {video.name}
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="submit-button"
            disabled={loading}
          >
            {loading ? '🔄 Creating...' : '📝 Create Listing'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateListing;
