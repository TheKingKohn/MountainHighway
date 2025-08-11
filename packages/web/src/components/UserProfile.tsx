import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './UserProfile.css';

interface UserProfileProps {
  onAuthClick: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onAuthClick }) => {
  const { user, logout, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="user-profile">
        <div className="loading-spinner">⏳</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="user-profile">
        <button 
          className="auth-trigger-button"
          onClick={onAuthClick}
          aria-label="Sign in or create account"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="user-profile">
      <div className="user-menu">
        <div className="user-info">
          <div className="user-avatar">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <span className="user-email">{user.email}</span>
            {isAdmin && <span className="admin-badge">ADMIN</span>}
          </div>
        </div>
        {isAdmin && (
          <button 
            className="admin-button"
            onClick={() => navigate('/admin')}
            aria-label="Access admin panel"
          >
            🛠️ Admin
          </button>
        )}
        <button 
          className="logout-button"
          onClick={logout}
          aria-label="Sign out"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default UserProfile;
