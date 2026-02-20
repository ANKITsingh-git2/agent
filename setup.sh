#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     GenAI Agent Orchestrator - Quick Setup Script            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi
echo "✅ Node.js $(node --version) detected"

# Check MongoDB
if ! command -v mongo &> /dev/null && ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB not found. Starting with Docker..."
    if command -v docker &> /dev/null; then
        docker run -d -p 27017:27017 --name genai-mongodb mongo:latest
        echo "✅ MongoDB started in Docker"
    else
        echo "❌ MongoDB not found. Please install MongoDB or Docker."
        exit 1
    fi
else
    echo "✅ MongoDB detected"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Setup environment
if [ ! -f .env.local ]; then
    echo ""
    echo "⚙️  Setting up environment variables..."
    cp .env.example .env.local
    echo "⚠️  IMPORTANT: Edit .env.local and add your GROK_API_KEY"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete! 🎉                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Edit .env.local and add your GROK_API_KEY"
echo "2. Run: npm run dev"
echo "3. Open: http://localhost:3000"
echo "4. Create your first agent in Agent Builder"
echo "5. Add FAQs in Tools & Knowledge"
echo "6. Test in Console"
echo "7. Run evaluation: npm run eval <agent-id> 0.7"
echo ""
echo "📚 See README.md for full documentation"
echo ""
