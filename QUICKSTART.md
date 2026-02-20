# 🚀 Quick Start Guide

## Get Running in Under 10 Minutes

### Step 1: Prerequisites (2 minutes)
```bash
# Check Node.js (need 18+)
node --version

# Check MongoDB
mongod --version
# OR use Docker:
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### Step 2: Setup (3 minutes)
```bash
cd genai-agent-orchestrator

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local

# Edit .env.local and add your Grok API key
nano .env.local  # or use any text editor
```

**Required in .env.local:**
```env
GROK_API_KEY=your_actual_grok_api_key_here
```

### Step 3: Start Application (1 minute)
```bash
npm run dev
```

Open browser: `http://localhost:3000`

### Step 4: Create Your First Agent (2 minutes)

1. **Agent Builder** (http://localhost:3000/)
   - Name: "Customer Support Bot"
   - Persona: "You are a helpful customer support agent for an e-commerce platform."
   - Language: English (or Hinglish)
   - Safety: Balanced
   - Threshold: 0.70
   - Click "Save Configuration"

2. **Tools & Knowledge** (http://localhost:3000/tools)
   - Add at least 2-3 FAQs, for example:
     * Q: "What is your return policy?"
       A: "We accept returns within 30 days of purchase with original receipt."
     * Q: "Do you ship internationally?"
       A: "Yes, we ship to over 50 countries worldwide."

### Step 5: Test Your Agent (2 minutes)

Go to **Test Console** (http://localhost:3000/console)

Try these queries:
```
1. "Hello"  (Should respond with greeting)
2. "Where is my order 1234?"  (Should use order_lookup tool)
3. "mera order 5678 kaha hai?"  (Hinglish order query)
4. "I want to file a complaint"  (Should create ticket)
```

Watch the response cards show:
- Intent classification
- Confidence score
- Tool execution
- Latency breakdown

### Step 6: Run Evaluation (1 minute)

```bash
# Replace 'agent-xxx' with your actual agent ID (shown in Agent Builder)
npm run eval agent-xxx 0.7
```

Watch the evaluation run through 30 test queries!

## 📝 What You Should See

### Successful Response Card
```
✓ Intent: order_status
✓ Confidence: 85%
✓ Action: tool_call
✓ Tool: order_lookup({"orderId":"1234"})
✓ Result: Order is in transit
✓ Latency: 850ms
```

### Evaluation Output
```
═══════════════════════════════════════════════════
📊 EVALUATION RESULTS
═══════════════════════════════════════════════════
Intent Accuracy:      80.0%
Action Accuracy:      76.7%
Escalation Rate:      30.0%
Tool Success Rate:    83.3%
Hallucination Blocks: 3
Average Latency:      920ms
═══════════════════════════════════════════════════
```

## 🐛 Troubleshooting

### MongoDB Connection Failed
```bash
# Start MongoDB with Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Verify connection
mongo --eval "db.adminCommand('ping')"
```

### Grok API Error
- Double-check your API key in `.env.local`
- Verify it has no extra spaces
- Test with: `curl -H "Authorization: Bearer YOUR_KEY" https://api.x.ai/v1/models`

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Evaluation Script Fails
```bash
# Make sure you use the correct agent ID
# Get it from the Agent Builder screen after saving

# Also ensure MongoDB is running and has your agent data
```

## 🎯 Next Steps

1. **Add More FAQs** - Go to Tools & Knowledge and add all 5 FAQs
2. **Test Different Scenarios** - Try complaints, greetings, edge cases
3. **Run Ablation Study** - `npm run eval agent-xxx --ablation`
4. **Export Configuration** - Click "Export JSON" in Test Console
5. **Review Logs** - Use filters in Test Console to analyze behavior

## 📚 Full Documentation

See `README.md` for:
- Complete architecture details
- API documentation
- Safety policy explanation
- Deployment instructions
- Voice integration roadmap

## 🎥 Demo Video Checklist

- [ ] Show agent creation
- [ ] Add FAQs
- [ ] Test English queries
- [ ] Test Hinglish queries
- [ ] Show response card details
- [ ] Filter logs
- [ ] Run evaluation
- [ ] Show ablation results

## ✅ Verification Checklist

Before submitting, verify:
- [ ] All 3 screens work
- [ ] Can create and save agent
- [ ] Can add 5 FAQs
- [ ] Chat interface responds
- [ ] Response cards show all data
- [ ] Log filtering works
- [ ] Export agent works
- [ ] Evaluation script runs
- [ ] README is complete

---

**You're all set! Start building your safe AI agent.** 🎉

Need help? Check README.md for detailed documentation.
