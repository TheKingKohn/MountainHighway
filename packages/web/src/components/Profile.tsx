import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Profile.css';

const Profile: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <div className="profile-container">
        <div className="profile-card">
          <h2>Please sign in to view your profile</h2>
          <p>You need to be logged in to access your profile page.</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div className="profile-info">
            <h2>Profile</h2>
            <p className="profile-email">{user.email}</p>
            <p className="profile-member-since">
              Member since {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently'}
            </p>
          </div>
        </div>

        <div className="profile-sections">
          <div className="profile-section">
            <h3>Account Information</h3>
            <div className="profile-field">
              <label>Email Address</label>
              <span>{user.email}</span>
            </div>
            <div className="profile-field">
              <label>Member Since</label>
              <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently'}</span>
            </div>
          </div>

          <div className="profile-section">
            <h3>Quick Actions</h3>
            <div className="profile-actions">
              <button className="action-btn primary" onClick={() => window.location.href = '/create-listing'}>
                Create New Listing
              </button>
              <button className="action-btn secondary" onClick={() => window.location.href = '/listings'}>
                Browse Listings
              </button>
            </div>
          </div>

          <div className="profile-section">
            <h3>Account Management</h3>
            <div className="profile-actions">
              <button className="action-btn danger" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
