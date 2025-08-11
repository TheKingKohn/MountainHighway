# Production build script for API
echo "🔧 Building Mountain Highway API for production..."

# Install dependencies
npm install --production=false

# Run TypeScript compilation
echo "📦 Compiling TypeScript..."
npx tsc

# Generate Prisma client for production
echo "🗄️ Generating Prisma client..."
npx prisma generate

# Run database migrations (will be handled by Render during deployment)
echo "✅ Build complete! Ready for production."
