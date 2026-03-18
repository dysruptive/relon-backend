#!/bin/bash

# KHY CRM Backend - MySQL Setup Script
# Prepares the backend for MySQL and GCP Cloud Run deployment

set -e  # Exit on error

echo "🚀 KHY CRM Backend - MySQL Setup & Deployment Preparation"
echo "=========================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo -e "${RED}❌ .env file not found!${NC}"
  echo "Please copy .env.example to .env and configure your settings:"
  echo "  cp .env.example .env"
  exit 1
fi

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."
echo ""

# Check Node.js
if command_exists node; then
  NODE_VERSION=$(node --version)
  echo -e "${GREEN}✓${NC} Node.js: $NODE_VERSION"
else
  echo -e "${RED}✗ Node.js not found${NC}"
  exit 1
fi

# Check npm
if command_exists npm; then
  NPM_VERSION=$(npm --version)
  echo -e "${GREEN}✓${NC} npm: $NPM_VERSION"
else
  echo -e "${RED}✗ npm not found${NC}"
  exit 1
fi

# Check Docker
if command_exists docker; then
  DOCKER_VERSION=$(docker --version)
  echo -e "${GREEN}✓${NC} Docker: $DOCKER_VERSION"
else
  echo -e "${YELLOW}⚠${NC} Docker not found (optional for local development)"
fi

# Check gcloud
if command_exists gcloud; then
  GCLOUD_VERSION=$(gcloud --version | head -n 1)
  echo -e "${GREEN}✓${NC} gcloud: $GCLOUD_VERSION"
else
  echo -e "${YELLOW}⚠${NC} gcloud CLI not found (required for GCP deployment)"
fi

echo ""
echo "=========================================================="
echo ""

# Ask user what they want to do
echo "What would you like to do?"
echo ""
echo "1) Test MySQL database connection"
echo "2) Reset migrations and create fresh MySQL migration"
echo "3) Install dependencies"
echo "4) Build Docker image"
echo "5) Run local Docker setup (docker-compose)"
echo "6) Full setup (all of the above)"
echo "7) Exit"
echo ""
read -p "Enter your choice [1-7]: " choice

case $choice in
  1)
    echo ""
    echo "🔍 Testing MySQL database connection..."
    echo ""
    npx prisma db pull --force
    if [ $? -eq 0 ]; then
      echo ""
      echo -e "${GREEN}✅ Database connection successful!${NC}"
    else
      echo ""
      echo -e "${RED}❌ Database connection failed!${NC}"
      echo ""
      echo "Please check:"
      echo "1. DATABASE_URL in .env has correct password"
      echo "2. Database 'kh3-db' exists on Cloud SQL"
      echo "3. Your IP is whitelisted in GCP Cloud SQL"
      echo "4. Cloud SQL instance is running"
    fi
    ;;

  2)
    echo ""
    echo "⚠️  This will DELETE existing migrations and create fresh MySQL migrations."
    echo "    Your database data will NOT be deleted, but migration history will be reset."
    echo ""
    read -p "Are you sure? (yes/no): " confirm

    if [ "$confirm" = "yes" ]; then
      echo ""
      echo "📦 Backing up old migrations..."
      if [ -d "prisma/migrations" ]; then
        timestamp=$(date +%Y%m%d_%H%M%S)
        cp -r prisma/migrations "prisma/migrations.backup.$timestamp"
        echo -e "${GREEN}✓${NC} Backed up to prisma/migrations.backup.$timestamp"
      fi

      echo ""
      echo "🗑️  Removing old migrations..."
      rm -rf prisma/migrations
      echo -e "${GREEN}✓${NC} Old migrations removed"

      echo ""
      echo "🔨 Creating fresh MySQL migration..."
      npx prisma migrate dev --name init

      if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ MySQL migration created successfully!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Verify tables in database with: npx prisma studio"
        echo "2. Test the backend with: npm run start:dev"
      else
        echo ""
        echo -e "${RED}❌ Migration failed!${NC}"
        echo "Please check your DATABASE_URL and database connection."
      fi
    else
      echo "Migration cancelled."
    fi
    ;;

  3)
    echo ""
    echo "📦 Installing dependencies..."
    npm install
    echo ""
    echo "🔧 Generating Prisma Client..."
    npx prisma generate
    echo ""
    echo -e "${GREEN}✅ Dependencies installed!${NC}"
    ;;

  4)
    echo ""
    echo "🐳 Building Docker image..."
    docker build -t khy-crm-backend:latest .

    if [ $? -eq 0 ]; then
      echo ""
      echo -e "${GREEN}✅ Docker image built successfully!${NC}"
      echo ""
      echo "To test locally:"
      echo "  docker run -p 4000:4000 --env-file .env khy-crm-backend:latest"
    else
      echo ""
      echo -e "${RED}❌ Docker build failed!${NC}"
    fi
    ;;

  5)
    echo ""
    echo "🐳 Starting Docker Compose..."
    docker-compose up -d

    if [ $? -eq 0 ]; then
      echo ""
      echo -e "${GREEN}✅ Docker services started!${NC}"
      echo ""
      echo "Services running:"
      echo "  - MySQL: localhost:3306"
      echo "  - Backend: localhost:4000"
      echo ""
      echo "View logs: docker-compose logs -f"
      echo "Stop services: docker-compose down"
    else
      echo ""
      echo -e "${RED}❌ Docker Compose failed!${NC}"
    fi
    ;;

  6)
    echo ""
    echo "🚀 Running full setup..."
    echo ""

    # Install dependencies
    echo "📦 Installing dependencies..."
    npm install
    echo ""

    # Generate Prisma Client
    echo "🔧 Generating Prisma Client..."
    npx prisma generate
    echo ""

    # Test connection
    echo "🔍 Testing database connection..."
    npx prisma db pull --force
    if [ $? -ne 0 ]; then
      echo ""
      echo -e "${RED}❌ Database connection failed!${NC}"
      echo "Please fix the connection and try again."
      exit 1
    fi
    echo ""

    # Ask about migrations
    echo "Do you want to reset migrations and create fresh MySQL migration?"
    read -p "(yes/no): " confirm

    if [ "$confirm" = "yes" ]; then
      echo ""
      echo "📦 Backing up old migrations..."
      if [ -d "prisma/migrations" ]; then
        timestamp=$(date +%Y%m%d_%H%M%S)
        cp -r prisma/migrations "prisma/migrations.backup.$timestamp"
      fi

      echo "🗑️  Removing old migrations..."
      rm -rf prisma/migrations

      echo "🔨 Creating fresh MySQL migration..."
      npx prisma migrate dev --name init
    fi

    echo ""
    echo -e "${GREEN}✅ Full setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test backend: npm run start:dev"
    echo "2. Build Docker: docker build -t khy-crm-backend:latest ."
    echo "3. Deploy to GCP: See CLOUD_RUN_DEPLOYMENT.md"
    ;;

  7)
    echo "Goodbye!"
    exit 0
    ;;

  *)
    echo "Invalid choice. Please run the script again."
    exit 1
    ;;
esac

echo ""
echo "=========================================================="
echo ""
