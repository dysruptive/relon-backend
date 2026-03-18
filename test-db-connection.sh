#!/bin/bash

# MySQL Database Connection Test Script
# Tests connection to GCP Cloud SQL MySQL instance

echo "🔍 Testing MySQL database connection..."
echo "Instance: kh3group-db"
echo "Database: kh3-db"
echo "Host: 35.196.28.206:3306"
echo ""

# Test with Prisma
echo "📊 Testing with Prisma..."
npx prisma db pull --force

if [ $? -eq 0 ]; then
  echo "✅ Database connection successful!"
  echo ""
  echo "📋 Introspecting database schema..."
  npx prisma db pull
else
  echo "❌ Database connection failed!"
  echo ""
  echo "Common issues:"
  echo "1. Check if the password in DATABASE_URL is correct"
  echo "2. Verify the database 'kh3-db' exists"
  echo "3. Ensure your IP is whitelisted in GCP Cloud SQL"
  echo "4. Check if the MySQL instance is running"
fi
