# Mountain Highway Keep-Alive System

This system prevents your Mountain Highway services from spinning down on free hosting tiers by automatically pinging them every 10 minutes.

## 🎯 What It Does

- **Prevents Cold Starts**: Keeps your API and web app warm so users don't experience 30+ second load times
- **Multiple Methods**: Provides several ways to keep services alive
- **Monitoring**: Beautiful dashboard to monitor service health
- **Automated**: GitHub Actions runs automatically every 10 minutes

## 🚀 Quick Start

### Option 1: Use the HTML Dashboard (Recommended)

1. Open `keep-alive.html` in any browser
2. Bookmark it and keep the tab open
3. The dashboard will automatically ping every 10 minutes
4. Works great on mobile devices too!

### Option 2: Deploy the HTML Dashboard

1. Upload `keep-alive.html` to any free static hosting service:
   - **Netlify**: Drag and drop the file
   - **Vercel**: Import from GitHub
   - **GitHub Pages**: Add to a repository
   - **Surge.sh**: `npm install -g surge && surge keep-alive.html`

### Option 3: Run Locally

```bash
# Start the keep-alive service
npm run keep-alive

# Or just ping once
npm run ping
```

### Option 4: GitHub Actions (Automatic)

The `.github/workflows/keep-alive.yml` file automatically runs every 10 minutes on GitHub's servers. No setup required!

## 📊 Features

### HTML Dashboard
- ✨ Beautiful, responsive interface
- 📱 Works on mobile devices
- ⏰ Countdown timer to next ping
- 📝 Real-time logs
- 🎛️ Manual controls to start/stop
- 🌙 Works in background tabs

### Node.js Script
- 🔄 Automatic pinging every 10 minutes
- 📊 Detailed logging
- ⚡ Fast HTTP requests
- 🛡️ Error handling and retries

### GitHub Actions
- ☁️ Runs on GitHub's free infrastructure
- 🔄 Automatic scheduling (every 10 minutes)
- 📊 Build logs for monitoring
- 🚀 Zero maintenance

## 🏔️ Endpoints

### API Keep-Alive
- **URL**: `https://mountain-highway-api.onrender.com/keep-alive`
- **Purpose**: Lightweight endpoint specifically for keep-alive pings
- **Response**: Simple JSON with status and uptime

### API Health Check
- **URL**: `https://mountain-highway-api.onrender.com/health`
- **Purpose**: Comprehensive health check with database status
- **Response**: Detailed system information

### Web App
- **URL**: `https://mountain-highway.onrender.com`
- **Purpose**: Main application homepage
- **Response**: Full React application

## 🎛️ Configuration

### Ping Interval
- **Default**: 10 minutes
- **Why**: Balances between keeping warm and not overwhelming services
- **Free Tier Limit**: Most services spin down after 15 minutes of inactivity

### Timeout Settings
- **API Requests**: 30 seconds
- **Web Requests**: 30 seconds
- **Retries**: Built-in error handling

## 📱 Mobile Usage

The HTML dashboard works great on mobile:

1. Open `keep-alive.html` in your mobile browser
2. Add to home screen (iOS Safari: Share → Add to Home Screen)
3. The app will keep running in the background
4. Check periodically to ensure it's still active

## 🔧 Troubleshooting

### Services Still Cold?
- Check if GitHub Actions is enabled in your repository
- Verify the HTML dashboard is actually running (check logs)
- Ensure correct URLs in the configuration

### GitHub Actions Not Running?
- Go to your repository → Actions tab
- Enable workflows if they're disabled
- Check the workflow logs for errors

### Dashboard Not Working?
- Check browser console for errors
- Ensure you have internet connection
- Try refreshing the page

## 📊 Monitoring

### GitHub Actions Logs
1. Go to your repository on GitHub
2. Click "Actions" tab
3. Click on "Keep-Alive Service" workflow
4. View recent runs and logs

### HTML Dashboard Logs
- Real-time logs show all ping attempts
- Color-coded status indicators
- Timestamp for each event
- Clear button to reset logs

## 🌟 Pro Tips

1. **Bookmark the Dashboard**: Keep `keep-alive.html` bookmarked for quick access
2. **Multiple Tabs**: Open the dashboard in multiple browsers/devices for redundancy
3. **Check Logs**: Monitor the GitHub Actions logs weekly to ensure everything's working
4. **Mobile Friendly**: The dashboard works great on phones - add to home screen
5. **Background Tabs**: Modern browsers throttle background tabs, but the dashboard handles this

## 🚀 Free Hosting Options for Dashboard

Deploy the `keep-alive.html` file to any of these free services:

1. **Netlify** (Recommended)
   - Drag and drop deployment
   - Custom domain available
   - Automatic HTTPS

2. **Vercel**
   - GitHub integration
   - Fast global CDN
   - Custom domains

3. **GitHub Pages**
   - Free with GitHub account
   - Custom domain support
   - Automatic deployments

4. **Surge.sh**
   - Simple CLI deployment
   - Custom domains
   - Fast setup

## 🎯 Why This Works

Free hosting services like Render spin down applications after 15 minutes of inactivity to save resources. By pinging your services every 10 minutes:

- ✅ Services stay "warm" and ready
- ✅ Users get instant page loads
- ✅ No 30+ second cold start delays
- ✅ Better user experience
- ✅ Services appear more professional

This system ensures your Mountain Highway marketplace is always fast and responsive for visitors!
