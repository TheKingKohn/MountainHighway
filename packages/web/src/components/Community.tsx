import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Community.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface Post {
  id: string;
  title: string;
  content: string;
  type: 'discussion' | 'trade_request' | 'local_event' | 'review';
  createdAt: string;
  author: {
    id: string;
    username: string;
    fullName: string;
    profileImage?: string;
  };
  comments: Comment[];
  _count: {
    comments: number;
    likes: number;
  };
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    fullName: string;
    profileImage?: string;
  };
}

interface CommunityStats {
  totalUsers: number;
  totalPosts: number;
  totalComments: number;
  activeUsers: number;
}

const Community: React.FC = () => {
  const { user, token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<CommunityStats>({
    totalUsers: 2500,
    totalPosts: 0,
    totalComments: 0,
    activeUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    type: 'discussion' as const
  });

  useEffect(() => {
    fetchPosts();
    fetchStats();
  }, [activeTab]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const typeParam = activeTab === 'all' ? '' : `?type=${activeTab}`;
      const response = await fetch(`${API_URL}/community/posts${typeParam}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPosts(data.posts);
        }
      } else {
        // Fallback to mock data
        setPosts(mockPosts);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      setPosts(mockPosts);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/community/stats`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const createPost = async () => {
    if (!token || !newPost.title.trim() || !newPost.content.trim()) return;

    try {
      const response = await fetch(`${API_URL}/community/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newPost)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPosts([data.post, ...posts]);
          setNewPost({ title: '', content: '', type: 'discussion' });
          setShowCreatePost(false);
        }
      } else {
        alert('Failed to create post. Please try again.');
      }
    } catch (error) {
      console.error('Failed to create post:', error);
      alert('Failed to create post. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'trade_request': return '🤝';
      case 'local_event': return '📍';
      case 'review': return '⭐';
      default: return '💬';
    }
  };

  const getPostTypeLabel = (type: string) => {
    switch (type) {
      case 'trade_request': return 'Trade Request';
      case 'local_event': return 'Local Event';
      case 'review': return 'Review';
      default: return 'Discussion';
    }
  };

  // Mock data for fallback
  const mockPosts: Post[] = [
    {
      id: 'mock-1',
      title: 'Welcome to the Mountain Highway Community!',
      content: 'Great to see our community growing! Feel free to introduce yourself and share what you\'re looking to buy or sell.',
      type: 'discussion',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      author: {
        id: 'admin',
        username: 'admin',
        fullName: 'Community Admin',
        profileImage: undefined
      },
      comments: [],
      _count: { comments: 5, likes: 12 }
    },
    {
      id: 'mock-2',
      title: 'Looking for vintage electronics',
      content: 'Anyone have any vintage radios, turntables, or old gaming consoles? Willing to pay fair prices for quality items!',
      type: 'trade_request',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      author: {
        id: 'user1',
        username: 'retrogamer',
        fullName: 'Mike D.',
        profileImage: undefined
      },
      comments: [],
      _count: { comments: 3, likes: 7 }
    }
  ];

  if (!user) {
    return (
      <div className="community-container">
        <div className="community-auth-prompt">
          <h2>🌟 Join the Community</h2>
          <p>Sign in to connect with other members, share experiences, and discover amazing deals!</p>
          <div className="auth-benefits">
            <div className="benefit">💬 Join discussions</div>
            <div className="benefit">🤝 Make trade requests</div>
            <div className="benefit">📍 Find local events</div>
            <div className="benefit">⭐ Share reviews</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="community-container">
      {/* Community Header */}
      <div className="community-header">
        <h1>🌟 Community Hub</h1>
        <p>Connect, share, and discover with fellow marketplace members</p>
      </div>

      {/* Community Stats */}
      <div className="community-stats">
        <div className="stat-card">
          <div className="stat-number">{stats.totalUsers.toLocaleString()}+</div>
          <div className="stat-label">Active Members</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.totalPosts}</div>
          <div className="stat-label">Community Posts</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.totalComments}</div>
          <div className="stat-label">Comments</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">98%</div>
          <div className="stat-label">Satisfaction</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button 
          className="action-btn primary"
          onClick={() => setShowCreatePost(true)}
        >
          ✍️ Create Post
        </button>
        <button className="action-btn">💬 Join Chat</button>
        <button className="action-btn">📍 Local Events</button>
      </div>

      {/* Post Type Filter */}
      <div className="post-filter">
        <button 
          className={`filter-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          🛍️ All Posts
        </button>
        <button 
          className={`filter-btn ${activeTab === 'discussion' ? 'active' : ''}`}
          onClick={() => setActiveTab('discussion')}
        >
          💬 Discussions
        </button>
        <button 
          className={`filter-btn ${activeTab === 'trade_request' ? 'active' : ''}`}
          onClick={() => setActiveTab('trade_request')}
        >
          🤝 Trade Requests
        </button>
        <button 
          className={`filter-btn ${activeTab === 'local_event' ? 'active' : ''}`}
          onClick={() => setActiveTab('local_event')}
        >
          📍 Events
        </button>
        <button 
          className={`filter-btn ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          ⭐ Reviews
        </button>
      </div>

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="modal-overlay" onClick={() => setShowCreatePost(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Post</h3>
            <div className="form-group">
              <label>Post Type</label>
              <select 
                value={newPost.type} 
                onChange={(e) => setNewPost({...newPost, type: e.target.value as any})}
                title="Select post type"
              >
                <option value="discussion">💬 Discussion</option>
                <option value="trade_request">🤝 Trade Request</option>
                <option value="local_event">📍 Local Event</option>
                <option value="review">⭐ Review</option>
              </select>
            </div>
            <div className="form-group">
              <label>Title</label>
              <input 
                type="text" 
                value={newPost.title}
                onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                placeholder="What's on your mind?"
                maxLength={200}
              />
            </div>
            <div className="form-group">
              <label>Content</label>
              <textarea 
                value={newPost.content}
                onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                placeholder="Share your thoughts, requests, or experiences..."
                rows={6}
                maxLength={5000}
              />
            </div>
            <div className="modal-actions">
              <button 
                className="btn secondary"
                onClick={() => setShowCreatePost(false)}
              >
                Cancel
              </button>
              <button 
                className="btn primary"
                onClick={createPost}
                disabled={!newPost.title.trim() || !newPost.content.trim()}
              >
                Create Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Posts Feed */}
      <div className="posts-feed">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner">🔄</div>
            <p>Loading community posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <h3>No posts yet</h3>
            <p>Be the first to start a conversation!</p>
            <button 
              className="btn primary"
              onClick={() => setShowCreatePost(true)}
            >
              Create First Post
            </button>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="post-card">
              <div className="post-header">
                <div className="post-author">
                  <div className="author-avatar">
                    {post.author.profileImage ? (
                      <img src={post.author.profileImage} alt={post.author.fullName} />
                    ) : (
                      <div className="avatar-placeholder">👤</div>
                    )}
                  </div>
                  <div className="author-info">
                    <div className="author-name">{post.author.fullName || post.author.username}</div>
                    <div className="post-meta">
                      <span className="post-type">
                        {getPostTypeIcon(post.type)} {getPostTypeLabel(post.type)}
                      </span>
                      <span className="post-time">{formatDate(post.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="post-content">
                <h3 className="post-title">{post.title}</h3>
                <p className="post-text">{post.content}</p>
              </div>
              
              <div className="post-actions">
                <button className="action-btn">
                  👍 {post._count.likes} Likes
                </button>
                <button className="action-btn">
                  💬 {post._count.comments} Comments
                </button>
                <button className="action-btn">
                  📤 Share
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Community;
