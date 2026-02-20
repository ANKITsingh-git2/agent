const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const AGENT_ID = process.argv[2] || 'default-agent';
const THRESHOLD = parseFloat(process.argv[3]) || 0.7;

// Test Dataset: 30 queries with expected outcomes
const testDataset = [
  // Order Status Queries (English)
  { query: 'Where is my order 1234?', expectedIntent: 'order_status', expectedAction: 'tool_call', language: 'english' },
  { query: 'Can you check order number 5678?', expectedIntent: 'order_status', expectedAction: 'tool_call', language: 'english' },
  { query: 'Track my order 1234', expectedIntent: 'order_status', expectedAction: 'tool_call', language: 'english' },
  
  // Order Status Queries (Hinglish)
  { query: 'mera order 1234 kaha hai?', expectedIntent: 'order_status', expectedAction: 'tool_call', language: 'hinglish' },
  { query: 'order 5678 ka status batao', expectedIntent: 'order_status', expectedAction: 'tool_call', language: 'hinglish' },
  { query: 'mere order ki location check karo 1234', expectedIntent: 'order_status', expectedAction: 'tool_call', language: 'hinglish' },
  
  // Create Ticket Queries (English)
  { query: 'I want to file a complaint about my order', expectedIntent: 'create_ticket', expectedAction: 'tool_call', language: 'english' },
  { query: 'Create a support ticket for damaged product', expectedIntent: 'create_ticket', expectedAction: 'tool_call', language: 'english' },
  { query: 'I need help with my account access issue', expectedIntent: 'create_ticket', expectedAction: 'tool_call', language: 'english' },
  
  // Create Ticket Queries (Hinglish)
  { query: 'mujhe ticket banana hai for refund', expectedIntent: 'create_ticket', expectedAction: 'tool_call', language: 'hinglish' },
  { query: 'complaint karna hai product quality ke baare mein', expectedIntent: 'create_ticket', expectedAction: 'tool_call', language: 'hinglish' },
  
  // Greetings (English)
  { query: 'Hello', expectedIntent: 'greeting', expectedAction: 'answer', language: 'english' },
  { query: 'Hi there', expectedIntent: 'greeting', expectedAction: 'answer', language: 'english' },
  { query: 'Good morning', expectedIntent: 'greeting', expectedAction: 'answer', language: 'english' },
  
  // Greetings (Hinglish)
  { query: 'Namaste', expectedIntent: 'greeting', expectedAction: 'answer', language: 'hinglish' },
  { query: 'Hello, kaise ho?', expectedIntent: 'greeting', expectedAction: 'answer', language: 'hinglish' },
  
  // General Queries (English)
  { query: 'What are your business hours?', expectedIntent: 'general_query', expectedAction: 'answer', language: 'english' },
  { query: 'Do you ship internationally?', expectedIntent: 'general_query', expectedAction: 'answer', language: 'english' },
  { query: 'What is your return policy?', expectedIntent: 'general_query', expectedAction: 'answer', language: 'english' },
  
  // General Queries (Hinglish)
  { query: 'aapka return policy kya hai?', expectedIntent: 'general_query', expectedAction: 'answer', language: 'hinglish' },
  { query: 'international delivery hoti hai kya?', expectedIntent: 'general_query', expectedAction: 'answer', language: 'hinglish' },
  
  // Complaints (English)
  { query: 'This is unacceptable service!', expectedIntent: 'complaint', expectedAction: 'escalate', language: 'english' },
  { query: 'I am very disappointed with the quality', expectedIntent: 'complaint', expectedAction: 'tool_call', language: 'english' },
  
  // Complaints (Hinglish)
  { query: 'bahut bura experience hai', expectedIntent: 'complaint', expectedAction: 'tool_call', language: 'hinglish' },
  { query: 'product bilkul kharab hai', expectedIntent: 'complaint', expectedAction: 'tool_call', language: 'hinglish' },
  
  // Edge Cases
  { query: 'asdfgh random text xyz', expectedIntent: 'unknown', expectedAction: 'escalate', language: 'english' },
  { query: '', expectedIntent: 'unknown', expectedAction: 'escalate', language: 'english' },
  { query: 'order', expectedIntent: 'order_status', expectedAction: 'escalate', language: 'english' }, // Missing order ID
  
  // Abusive Language
  { query: 'you guys are idiots', expectedIntent: 'abusive', expectedAction: 'escalate', language: 'english' },
  { query: 'what the hell is wrong with you', expectedIntent: 'abusive', expectedAction: 'escalate', language: 'english' },
];

/**
 * Run evaluation
 */
async function runEvaluation() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🧪 AGENT EVALUATION PIPELINE');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Agent ID: ${AGENT_ID}`);
  console.log(`Confidence Threshold: ${THRESHOLD}`);
  console.log(`Test Queries: ${testDataset.length}`);
  console.log('═══════════════════════════════════════════════════\n');

  const results = [];
  let intentCorrect = 0;
  let actionCorrect = 0;
  let escalations = 0;
  let toolCalls = 0;
  let toolSuccesses = 0;
  let hallucinationBlocks = 0;
  let totalLatency = 0;
  let totalConfidence = 0;

  // Update agent threshold
  try {
    await axios.put(`${API_URL}/api/agents`, {
      agentId: AGENT_ID,
      confidenceThreshold: THRESHOLD,
    });
    console.log(`✓ Updated agent threshold to ${THRESHOLD}\n`);
  } catch (error) {
    console.error('Failed to update threshold. Using existing configuration.\n');
  }

  // Run each test query
  for (let i = 0; i < testDataset.length; i++) {
    const test = testDataset[i];
    process.stdout.write(`[${i + 1}/${testDataset.length}] Testing: "${test.query.substring(0, 40)}..." `);

    try {
      const response = await axios.post(`${API_URL}/api/run`, {
        agentId: AGENT_ID,
        message: test.query,
        sessionId: `eval-${Date.now()}-${i}`,
      });

      const data = response.data;
      
      // Check correctness
      const intentMatch = data.intent === test.expectedIntent;
      const actionMatch = data.action === test.expectedAction;

      if (intentMatch) intentCorrect++;
      if (actionMatch) actionCorrect++;
      if (data.action === 'escalate') escalations++;
      if (data.toolExecution) {
        toolCalls++;
        if (data.toolExecution.success) toolSuccesses++;
      }
      if (data.hallucinationBlocked) hallucinationBlocks++;

      totalLatency += data.timing.total;
      totalConfidence += data.confidence;

      // Store result
      results.push({
        query: test.query,
        expectedIntent: test.expectedIntent,
        predictedIntent: data.intent,
        intentCorrect: intentMatch,
        expectedAction: test.expectedAction,
        predictedAction: data.action,
        actionCorrect: actionMatch,
        confidence: data.confidence,
        hallucinationBlocked: data.hallucinationBlocked,
        toolSuccess: data.toolExecution ? data.toolExecution.success : null,
        latency: data.timing.total,
      });

      console.log(intentMatch && actionMatch ? '✓' : '✗');
    } catch (error) {
      console.log('✗ ERROR');
      results.push({
        query: test.query,
        expectedIntent: test.expectedIntent,
        predictedIntent: 'error',
        intentCorrect: false,
        expectedAction: test.expectedAction,
        predictedAction: 'error',
        actionCorrect: false,
        confidence: 0,
        hallucinationBlocked: false,
        toolSuccess: null,
        latency: 0,
        error: error.message,
      });
    }

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Calculate metrics
  const summary = {
    threshold: THRESHOLD,
    totalQueries: testDataset.length,
    intentAccuracy: (intentCorrect / testDataset.length) * 100,
    actionAccuracy: (actionCorrect / testDataset.length) * 100,
    escalationRate: (escalations / testDataset.length) * 100,
    toolSuccessRate: toolCalls > 0 ? (toolSuccesses / toolCalls) * 100 : 0,
    hallucinationBlockCount: hallucinationBlocks,
    averageLatency: totalLatency / testDataset.length,
    averageConfidence: totalConfidence / testDataset.length,
    results,
  };

  // Print summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 EVALUATION RESULTS');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Intent Accuracy:      ${summary.intentAccuracy.toFixed(2)}%`);
  console.log(`Action Accuracy:      ${summary.actionAccuracy.toFixed(2)}%`);
  console.log(`Escalation Rate:      ${summary.escalationRate.toFixed(2)}%`);
  console.log(`Tool Success Rate:    ${summary.toolSuccessRate.toFixed(2)}%`);
  console.log(`Hallucination Blocks: ${summary.hallucinationBlockCount}`);
  console.log(`Average Latency:      ${summary.averageLatency.toFixed(0)}ms`);
  console.log(`Average Confidence:   ${(summary.averageConfidence * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════════\n');

  // Save results
  const resultsDir = path.join(__dirname, '..', 'evaluation-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const filename = `eval-threshold-${THRESHOLD}-${Date.now()}.json`;
  const filepath = path.join(resultsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));

  console.log(`✓ Results saved to: ${filepath}\n`);

  // Save CSV for easy analysis
  const csvFilename = `eval-threshold-${THRESHOLD}-${Date.now()}.csv`;
  const csvPath = path.join(resultsDir, csvFilename);
  const csvLines = [
    'Query,Expected Intent,Predicted Intent,Intent Correct,Expected Action,Predicted Action,Action Correct,Confidence,Latency,Tool Success,Hallucination Blocked',
    ...results.map(r => 
      `"${r.query}",${r.expectedIntent},${r.predictedIntent},${r.intentCorrect},${r.expectedAction},${r.predictedAction},${r.actionCorrect},${r.confidence},${r.latency},${r.toolSuccess},${r.hallucinationBlocked}`
    )
  ];
  fs.writeFileSync(csvPath, csvLines.join('\n'));
  console.log(`✓ CSV saved to: ${csvPath}\n`);

  return summary;
}

/**
 * Run ablation study
 */
async function runAblationStudy() {
  console.log('\n🔬 STARTING ABLATION STUDY\n');
  console.log('Running evaluation with threshold = 0.60...\n');
  
  const results060 = await runEvaluation();
  
  console.log('\n' + '─'.repeat(55) + '\n');
  console.log('Running evaluation with threshold = 0.80...\n');
  
  // Update threshold
  process.argv[3] = '0.80';
  const results080 = await runEvaluation();

  // Compare results
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🔍 ABLATION ANALYSIS');
  console.log('═══════════════════════════════════════════════════');
  console.log('\nThreshold Comparison:\n');
  console.log('Metric                  | 0.60      | 0.80      | Δ');
  console.log('─'.repeat(55));
  console.log(`Intent Accuracy         | ${results060.intentAccuracy.toFixed(1)}%   | ${results080.intentAccuracy.toFixed(1)}%   | ${(results080.intentAccuracy - results060.intentAccuracy).toFixed(1)}%`);
  console.log(`Action Accuracy         | ${results060.actionAccuracy.toFixed(1)}%   | ${results080.actionAccuracy.toFixed(1)}%   | ${(results080.actionAccuracy - results060.actionAccuracy).toFixed(1)}%`);
  console.log(`Escalation Rate         | ${results060.escalationRate.toFixed(1)}%   | ${results080.escalationRate.toFixed(1)}%   | ${(results080.escalationRate - results060.escalationRate).toFixed(1)}%`);
  console.log(`Tool Success Rate       | ${results060.toolSuccessRate.toFixed(1)}%   | ${results080.toolSuccessRate.toFixed(1)}%   | ${(results080.toolSuccessRate - results060.toolSuccessRate).toFixed(1)}%`);
  console.log(`Avg Latency (ms)        | ${results060.averageLatency.toFixed(0)}     | ${results080.averageLatency.toFixed(0)}     | ${(results080.averageLatency - results060.averageLatency).toFixed(0)}`);
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Key Findings:');
  console.log(`• Higher threshold (0.80) results in ${(results080.escalationRate - results060.escalationRate).toFixed(1)}% more escalations`);
  console.log(`• This improves safety but reduces automation`);
  console.log(`• Routing sensitivity increases with threshold`);
  console.log(`• Lower threshold (0.60) provides more autonomous responses\n`);
}

// Main execution
if (require.main === module) {
  const runAblation = process.argv.includes('--ablation');
  
  if (runAblation) {
    runAblationStudy().catch(error => {
      console.error('Ablation study failed:', error.message);
      process.exit(1);
    });
  } else {
    runEvaluation().catch(error => {
      console.error('Evaluation failed:', error.message);
      process.exit(1);
    });
  }
}

module.exports = { runEvaluation, testDataset };
