# Member Q&A System

A question-answering API that answers natural language questions about luxury concierge member data.

## Live Demo

**API:** [Your deployment URL]

```bash
curl -X POST https://your-url.com/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "When is Layla planning her trip to London?"}'
```

## What It Does

The system retrieves member messages from an external API, uses semantic search to find relevant context, and generates natural language answers using Claude. It also provides proactive recommendations based on member behavior patterns.

**Example:**

```json
POST /ask
{
  "question": "When is Layla planning her trip to London?"
}

Response:
{
  "answer": "Layla is planning a five-night stay at Claridge's in London starting on a Monday in November 2025.",
  "confidence": "high",
  "sources": 12,
  "references": [
    {
      "user": "Layla Chen",
      "date": "Nov 15, 2024",
      "excerpt": "I'd like to book five nights at Claridge's in London..."
    }
  ],
  "further_recommendation": "Consider arranging afternoon tea reservations at Claridge's and pre-booking theater tickets for West End shows during her London stay."
}
```

## Tech Stack

- **Node.js + TypeScript + Express** for the API
- **Claude 3.5 Haiku** for natural language understanding and answer generation
- **OpenAI embeddings** (text-embedding-3-small) for semantic search
- **Pinecone** for vector storage and similarity search
- **In-memory caching** with automatic refresh to minimize API calls

## How It Works

1. Messages are fetched from the external API and cached (1-hour TTL)
2. All messages are converted to vector embeddings and stored in Pinecone
3. When a question comes in, we generate its embedding and search for similar messages
4. Top 20 relevant messages are sent to Claude as context
5. Claude generates an answer and a proactive recommendation

The semantic search approach works better than keyword matching because it understands meaning. For example, "Where is Layla traveling?" and "What are Layla's trip plans?" will find the same relevant messages even though they use different words.

## API Endpoints

### POST /ask
Main endpoint for asking questions.

**Request:**
```json
{
  "question": "How many cars does Vikram Desai have?"
}
```

**Response:**
```json
{
  "answer": "Vikram Desai has three cars.",
  "confidence": "high",
  "sources": 5,
  "references": [...],
  "further_recommendation": "..."
}
```

### POST /reindex
Regenerates vector embeddings for all messages. Run this after deployment to populate Pinecone.

### GET /health
Health check endpoint.

### GET /stats
Returns dataset statistics (message count, users, date ranges, etc).

## Setup

### Prerequisites
- Node.js 18+
- Claude API key (from Anthropic)
- OpenAI API key (Tier 1 or higher recommended for production)
- Pinecone API key

### Local Development

1. Clone and install:
```bash
git clone <your-repo>
cd member-qa-system
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Add your API keys to .env
```

3. Run:
```bash
npm run dev
```

4. Index messages (one-time):
```bash
curl -X POST http://localhost:3000/reindex
```

5. Test:
```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What are Amira'\''s favorite restaurants?"}'
```

## Deployment

I've included configs for multiple deployment options:

- **GCP Cloud Run:** See DEPLOYMENT.md for full instructions
- **Render.com:** Just connect your repo, it'll use render.yaml
- **Docker:** Use docker-compose.yml or the Dockerfile directly

The comprehensive deployment guide is in [DEPLOYMENT.md](DEPLOYMENT.md).

## Environment Variables

```bash
# Required
CLAUDE_API_KEY=your_claude_key
OPENAI_API_KEY=your_openai_key
PINECONE_API_KEY=your_pinecone_key

# Optional
MESSAGES_API_URL=https://november7-730026606190.europe-west1.run.app
CACHE_TTL_HOURS=1
PORT=3000
PINECONE_INDEX=member-messages
ENABLE_SEMANTIC_SEARCH=true
SEMANTIC_SEARCH_TOP_K=20
```

## Design Alternatives Considered

### 1. Keyword Matching
Just use regex patterns to extract answers from messages.

**Pros:** Fast, cheap, no external dependencies.

**Cons:** Terrible accuracy. Can't handle "How many cars does Vikram have?" vs "What vehicles does Vikram own?" as the same question. Fails on anything requiring inference.

**Verdict:** Too brittle for real use.

### 2. RAG with Vector Embeddings (chosen approach)
Convert all messages to embeddings, store in vector DB, retrieve similar messages, feed to LLM.

**Pros:** Good semantic understanding, scales well, handles diverse question phrasings, reasonable accuracy (80-90%).

**Cons:** More moving parts (vector DB, embeddings API), higher initial complexity, per-query costs around $0.02.

**Verdict:** Best balance for this use case. The dataset is small enough (3,349 messages) that we can keep everything in Pinecone's free tier, but large enough that semantic search significantly outperforms keyword matching.

### 3. Fine-tuned Model
Train a smaller model specifically on this dataset.

**Pros:** Best accuracy potential, lower per-query costs long-term.

**Cons:** Expensive upfront ($500-2000), time-intensive, requires retraining when data changes, overkill for a dataset this size.

**Verdict:** Not worth it for an MVP or assignment scope.

### 4. Prompt Engineering Only
Send all 3,349 messages to Claude on every query.

**Pros:** Simplest implementation.

**Cons:** Hits context limits, slow, expensive ($0.50+ per query), not scalable.

**Verdict:** Works for tiny datasets, fails here.

## Why I Chose RAG

The semantic search + LLM approach gives us:
- Good accuracy without fine-tuning costs
- Fast retrieval (vector search is ~50ms)
- Flexibility to handle diverse questions
- Reasonable per-query costs
- Easy to improve (just adjust retrieval or prompts)

The main tradeoff is complexity, but with Pinecone's managed service and OpenAI's embedding API, it's mostly just configuration.

## Data Insights

The dataset has 3,349 messages from 10 luxury concierge members spanning November 2024 to November 2025.

### Things I Noticed

**Character Encoding Issues**
Hans Müller's name appears as "Hans Mü\u00c3\u00bc ller" in the API response. There are also issues with em dashes and smart quotes showing up as unicode escape sequences. This affects name matching accuracy. Should normalize to UTF-8 on ingestion.

**PII Exposure**
The API contains a lot of sensitive info - phone numbers, passport numbers, card numbers, full addresses, detailed travel itineraries. For a production system, this would need proper authentication and maybe PII redaction.

**Future Dates**
Messages are dated into November 2025, which obviously hasn't happened yet. This is fine for a demo dataset, just noting it.

**Message Distribution**
Looking at the data:
- Most common requests: accommodation (21%), dining (16%), travel (13%)
- Members frequently mention specific luxury brands (Claridge's, Nobu, Four Seasons)
- High satisfaction - lots of thank you messages
- Dietary restrictions are common (vegan, gluten-free, kosher)
- Popular destinations: Paris, Tokyo, Milan, New York, London

**Inconsistencies**
- Some messages reference previous conversations not in the dataset ("as we discussed")
- Date formats vary ("this Friday" vs "May 15th" vs "15/05/2025")
- Some near-duplicate requests days apart (same restaurant booking twice)
- All timestamps use UTC but members travel globally

### Production Recommendations

If this were going to production, I'd add:
- Authentication layer
- PII redaction or encryption
- Conversation threading (link related messages)
- Better error handling for malformed queries
- Rate limiting
- Monitoring and logging for answer accuracy
- A/B testing framework for different prompts

## Performance

- Initial cache load: ~2-3 seconds
- Query response time: 2-4 seconds average
- Memory usage: ~150MB with full cache
- Indexing time: ~3-4 minutes for all 3,349 messages
- Cost per query: ~$0.02 (Claude + embeddings)

## Notes

- The recommendation feature is a bonus I added. It analyzes member patterns and suggests proactive actions.
- Confidence scoring is based on factors like message count, specificity of the answer, and Claude's stop reason.
- The system falls back to keyword search if semantic search is disabled or unavailable.

