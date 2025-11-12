/**
 * Test script to query the API with NO LIMITS mode
 * This will send ALL relevant context to Claude with zero restrictions
 */

const axios = require('axios');

async function testNoLimits() {
  console.log('🚨 RUNNING NO-LIMITS TEST');
  console.log('📝 Question: "What are Amira\'s favorite restaurants?"');
  console.log('⚠️  ALL limitations disabled - fetching maximum context\n');

  try {
    const response = await axios.post('http://localhost:3000/ask', {
      question: 'What are Amira\'s favorite restaurants?'
    });

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESPONSE (NO LIMITS MODE)');
    console.log('='.repeat(80));
    console.log('\n📝 Answer:');
    console.log(response.data.answer);
    console.log('\n📈 Metadata:');
    console.log(`- Confidence: ${response.data.confidence}`);
    console.log(`- Sources: ${response.data.sources}`);
    console.log(`- References: ${response.data.references?.length || 0}`);

    if (response.data.further_recommendation) {
      console.log('\n💡 Recommendation:');
      console.log(response.data.further_recommendation);
    }

    if (response.data.references && response.data.references.length > 0) {
      console.log('\n📚 Top 5 References:');
      response.data.references.slice(0, 5).forEach((ref, idx) => {
        console.log(`\n${idx + 1}. ${ref.user} (${ref.date})`);
        console.log(`   ${ref.excerpt}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Test complete! Check server console for detailed logs.');
    console.log('🔍 Look for: "NO LIMITS TEST MODE" messages');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    console.error('\n⚠️  Make sure:');
    console.error('1. Server is running with NO_LIMITS_TEST=true');
    console.error('2. API is accessible at http://localhost:3000');
    console.error('3. All API keys are configured');
  }
}

testNoLimits();
