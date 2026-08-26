#!/bin/bash

# Quick start script for KVI Monitoring System on localhost

echo "🚀 Starting KVI Monitoring System..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from template..."
    if [ -f ".env.monitoring.example" ]; then
        cp .env.monitoring.example .env
        echo "✅ Created .env file. You can edit it if needed."
    else
        echo "⚠️  .env.monitoring.example not found. Creating basic .env..."
        cat > .env << EOF
MONITORING_PORT=3001
KVI_BASE_URL=http://localhost:3000
ENABLE_404_CHECK=true
ENABLE_SSL_CHECK=false
EOF
    fi
    echo ""
fi

# Create logs directory
mkdir -p logs
echo "📁 Logs directory ready"
echo ""

# Start the monitoring server
echo "🎯 Starting monitoring backend on port 3001..."
echo "📊 Dashboard will be available at: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run monitor

