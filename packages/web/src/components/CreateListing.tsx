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
    priceCents: ''
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      if (fileArray.length > 3) {
        setError('Maximum 3 photos allowed');
        return;
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
    if (!formData.description.trim()) {
      setError('Description is required');
      return false;
    }
    if (!formData.priceCents || parseInt(formData.priceCents) <= 0) {
      setError('Valid price is required');
      return false;
    }
    if (photos.length === 0) {
      setError('At least one photo is required');
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
      setFormData({ title: '', description: '', priceCents: '' });
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

          <div className="form-group">
            <label htmlFor="priceCents">Price (in cents) *</label>
            <input
              type="number"
              id="priceCents"
              name="priceCents"
              value={formData.priceCents}
              onChange={handleInputChange}
              placeholder="e.g. 2500 for $25.00"
              min="1"
              required
            />
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
