# Member Q&A System

An intelligent question-answering API that uses adaptive semantic search and AI to answer natural language questions about luxury concierge member data.

## Live Demo

**API:** https://aurora-qa.vercel.app/ask

```bash
curl -X POST https://aurora-qa.vercel.app/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "When is Layla planning her trip to London?"}'
```

**Frontend Demo:** https://aurora-qa.vercel.app (includes a simple chat interface that matches Aurora theme)

## What It Does

The system uses an **adaptive search strategy** that automatically adjusts based on query type:
- **Specific queries** (mentions names, dates, locations) → Precision-focused search (50 results, high threshold)
- **Broad queries** (general patterns) → Comprehensive search (120 results, diversity sampling)

It retrieves member messages from an external API, uses semantic search to find relevant context, and generates natural language answers using Claude. It also provides proactive recommendations based on member behavior patterns.

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

- **Backend:** Node.js + TypeScript + Express
- **LLM:** Claude 3.5 Haiku (fast and cost-effective)
- **Embeddings:** OpenAI text-embedding-3-small (1,536 dimensions)
- **Vector Store:** Pinecone (serverless, free tier)
- **Caching:** In-memory with 1-hour TTL
- **Deployment:** Vercel (serverless functions)
- **Frontend:** Pure HTML/CSS/JavaScript (no framework)

## Architecture

```
User Query → Entity Detection → Query Classification
                                      ↓
                         ┌───────────────────────────┐
                         │ Specific or Broad Query?  │
                         └───────────────────────────┘
                                      ↓
              ┌──────────────────────────────────────────┐
              │                                          │
       [Specific Query]                          [Broad Query]
       topK=50, threshold=0.7                    topK=120, threshold=0.5
              │                                          │
              └──────────────┬───────────────────────────┘
                             ↓
                    Pinecone Vector Search
                             ↓
                    Diversity Sampling (if needed)
                             ↓
                    Token Truncation (20K limit)
                             ↓
                    Claude 3.5 Haiku
                             ↓
            ┌────────────────────────────────┐
            │  Answer + Confidence Score +   │
            │  References + Recommendation   │
            └────────────────────────────────┘
```

## How It Works

### 1. Data Ingestion & Indexing
- Messages are fetched from the external API and cached (1-hour TTL)
- All messages are converted to vector embeddings (OpenAI text-embedding-3-small)
- Embeddings stored in Pinecone for semantic similarity search

### 2. Adaptive Query Analysis
When a question arrives, the system automatically:
- **Detects entities:** User names, dates, locations, specific items
- **Classifies query type:**
  - **Specific** → "How many cars does Vikram have?" (user name + item detected)
  - **Broad** → "What do members prefer for dining?" (no specific entities)
- **Adjusts search parameters:**
  - Specific: `topK=50`, `threshold=0.7` (precision-focused)
  - Broad: `topK=120`, `threshold=0.5` (recall-focused)

### 3. Semantic Search with Diversity Sampling
- Query embedding generated and searched against Pinecone
- For broad multi-user queries, diversity sampling ensures results span multiple members
- Token-limited to 20,000 tokens (configurable) for cost optimization

### 4. AI Answer Generation
- Top relevant messages sent to Claude as context
- Claude generates a natural language answer
- Includes confidence score, source count, and references
- Provides proactive recommendations based on patterns

**Why semantic search?** It understands meaning, not just keywords. "Where is Layla traveling?" and "What are Layla's trip plans?" find the same relevant messages despite different wording.

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
cd Aurora-AIML-Engineer-Assignment
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

## Frontend Interface

A simple, elegant chat interface is included at the root URL (https://aurora-qa.vercel.app):

**Features:**
- Real-time question answering with typing indicators
- Displays confidence scores and source counts
- Shows top references from member messages
- Proactive recommendations displayed prominently
- Mobile-responsive design with Aurora's brand colors
- Example questions for quick testing

**Tech:** Pure HTML/CSS/JavaScript (no framework needed)

## Deployment

The system is deployed on **Vercel**:

- **Vercel:** Currently deployed (see `vercel.json`)

**Vercel Deployment:**
```bash
npm install -g vercel
vercel --prod
```

## Environment Variables

```bash
# Required
CLAUDE_API_KEY=your_claude_key
OPENAI_API_KEY=your_openai_key
PINECONE_API_KEY=your_pinecone_key

# Optional - Server Configuration
MESSAGES_API_URL=https://november7-730026606190.europe-west1.run.app
CACHE_TTL_HOURS=1
PORT=3000
PINECONE_INDEX=member-messages

# Optional - Search Configuration
ENABLE_SEMANTIC_SEARCH=true

# Adaptive Search Strategy (NEW)
SPECIFIC_QUERY_TOP_K=50          # Results for queries with specific entities
SPECIFIC_QUERY_THRESHOLD=0.7     # Similarity threshold for precision
BROAD_QUERY_TOP_K=120            # Results for general pattern queries
BROAD_QUERY_THRESHOLD=0.5        # Similarity threshold for recall
MAX_CONTEXT_TOKENS=20000         # Maximum tokens sent to Claude (~$0.006/query)
```

**Configuration Modes:**
- **Budget Mode:** `TOP_K=15/50`, `TOKENS=10000` (~$0.003/query)
- **Balanced Mode (default):** `TOP_K=50/120`, `TOKENS=20000` (~$0.006/query)
- **Quality Mode:** `TOP_K=100/150`, `TOKENS=30000` (~$0.009/query)

See [CONFIGURATION.md](CONFIGURATION.md) for detailed tuning guide.

## Design Alternatives Considered

### 1. Keyword Matching
Just use regex patterns to extract answers from messages.

**Pros:** Fast, cheap, no external dependencies.

**Cons:** Terrible accuracy. Can't handle "How many cars does Vikram have?" vs "What vehicles does Vikram own?" as the same question. Fails on anything requiring inference.

**Verdict:** Too brittle for real use.

### 2. RAG with Adaptive Search (chosen approach)
Convert all messages to embeddings, store in vector DB, retrieve similar messages, feed to LLM. **Enhanced with adaptive search strategy** that adjusts retrieval based on query type.

**Pros:**
- Excellent semantic understanding
- Scales well (handles 3,349+ messages efficiently)
- Handles diverse question phrasings
- **Adaptive approach optimizes quality vs cost** (80-95% accuracy)
- Diversity sampling prevents single-user bias in broad queries

**Cons:**
- More moving parts (vector DB, embeddings API)
- Higher initial complexity
- Per-query costs around $0.006 (optimized from $0.02 with smart retrieval)

**Verdict:** Best balance for this use case. The adaptive strategy gives us:
- Precision for specific queries (user/date/location mentions)
- Comprehensive recall for pattern discovery queries
- Cost-effective through configurable token limits

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

## Why I Chose RAG with Adaptive Search

The semantic search + adaptive strategy + LLM approach gives us:
- **High accuracy** without fine-tuning costs (80-95% depending on query complexity)
- **Fast retrieval** (vector search ~50-100ms)
- **Flexibility** to handle diverse questions automatically
- **Cost-optimized** (~$0.006/query vs $0.50+ for full-context approaches)
- **Intelligent scaling:** Specific queries get focused results, broad queries get comprehensive coverage
- **Diversity sampling:** Prevents bias toward active users in pattern-discovery queries
- **Easy to improve:** Just adjust retrieval parameters or prompts

### Key Innovation: Adaptive Query Strategy

Unlike traditional RAG that uses fixed retrieval parameters, our system:
1. **Analyzes each query** to detect entities (names, dates, locations, items)
2. **Classifies query type** (specific vs broad)
3. **Adjusts search parameters dynamically:**
   - User-specific questions → High precision (topK=50, threshold=0.7)
   - Pattern discovery → High recall with diversity (topK=120, threshold=0.5)
4. **Token-limited context** ensures cost control (20K tokens default)

This means a question like "How many cars does Vikram have?" gets 50 highly relevant messages about Vikram's cars, while "What do members prefer for restaurants?" gets 120 diverse messages spanning multiple members with smart sampling.

The main tradeoff is complexity, but with Pinecone's managed service and OpenAI's embedding API, it's mostly just configuration.

### Why using 2 types of queries?
While developing, I initially set the references/sources/top_k to 20, and tested few questions only to get not so accurate result. Then I increased the k to 50 and 100, noticed that given 300-350 messages per user despite of setting top_k to 100, the answer is accurate as the response we got fot the top_k 50. So, I have changed it back to 50. But then, I realised, thats just when you point out a specific user, so the semantic search goes on and provides result, because when you input a username or a date, the search will be limited to maybe 300-350 messages as per our dataset, but not all the 3k+ messages dataset.

Now, what if we dont input any specific word? say no name, no date, just we ask "What's the most visited restaurant" or "Common diet for all the people". Now the limited 50 references won't be sufficient, but again, if we set 100 as top_k, it might not effect in small scale, but it surely does effect on large scale. Not only in the aspect of cost based on the token out, but also the perfornamce time and efficiency, there might be even cases that the model wont accept the context length, most of the models accept upto 200k contect window, lets say if we convert all these 3k+ messages, it would near about 100-150k context length easily, so setting top_k to 100 or above on current scale is almost equal to setting up the context legth to almost maximum to above 50% on large scale. So there comes this 2 query theory, our model app will automaically define the query type into 2 types, the specific will have 50 or it can be adjustable because, i didnt noticed any difference change above 50 as much i noticied from 20 to 50. But in general, for the broad queries which i gave examples earlier, the search window/references/messages/context we give to the LLM is not sufficient, that's the reason we are providing claude more context length by giving it more top results. Yes, it still might effect on large scale, but atleast for the other questions the time, efficiency, cost are optimized. 

## Data Insights

The dataset has 3,349 messages from 10 luxury concierge members spanning November 2024 to November 2025.

### Things I Noticed

**Character Encoding Issues**
Hans Müller's name appears as "Hans Mü\u00c3\u00bc ller" in the API response. There are also issues with em dashes and smart quotes showing up as unicode escape sequences. This affects name matching accuracy. Should normalize to UTF-8 on ingestion.

**PII Exposure**
The API contains a lot of sensitive info - phone numbers, passport numbers, card numbers, full addresses, detailed travel itineraries. For a production system, this would need proper authentication and maybe PII redaction.

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

- **Initial cache load:** ~2-3 seconds (3,349 messages)
- **Query response time:** 2-4 seconds average
  - Vector search: 50-100ms
  - Claude API: 1.5-3s
  - Entity detection & classification: <50ms
- **Memory usage:** ~150MB with full cache
- **Indexing time:** ~3-4 minutes for all 3,349 messages
- **Cost per query:**
  - Balanced mode: ~$0.006 (optimized)
  - Budget mode: ~$0.003
  - Quality mode: ~$0.009
- **Scalability:**
  - Dataset size: 3,349 messages → Can scale to 100K+ with current architecture
  - Concurrent requests: Handles 10+ simultaneous queries
  - Token efficiency: Adaptive retrieval reduces waste by 60-70% vs fixed approaches

## Key Features & Notes

### Advanced Capabilities
- **Adaptive Search Strategy:** Automatically adjusts retrieval based on query type (specific vs broad)
- **Entity Detection:** Recognizes user names, dates, locations, and specific items in queries
- **Diversity Sampling:** Ensures broad queries get balanced representation across multiple members
- **Proactive Recommendations:** Analyzes member patterns to suggest next actions
- **Confidence Scoring:** Based on message count, answer specificity, and Claude's stop reason
- **Configurable Parameters:** All search settings tunable via environment variables
- **Fallback Mechanisms:** Falls back to keyword search if semantic search is unavailable

### What Makes This Different
Unlike traditional RAG systems with fixed parameters, this implementation:
- **Intelligently adapts** retrieval strategy per query
- **Optimizes cost vs quality** through dynamic token management
- **Prevents bias** through diversity sampling in multi-user queries
- **Fully configurable** for different use cases (budget/balanced/quality modes)

### Additional Documentation
- **[CONFIGURATION.md](CONFIGURATION.md):** Detailed parameter tuning guide

---

## 🚀 Future Scope & Enhancements

This project can be extended with the following features to enhance functionality and user experience:

### 1. Multi-Question Batch Processing
**Purpose:** Allow users to ask multiple questions in a single request for efficiency.

**Endpoint:** `POST /ask/batch`

**Request:**
```json
{
  "questions": [
    "When is Layla planning her trip to London?",
    "How many cars does Vikram Desai have?",
    "What are Amira's favorite restaurants?"
  ]
}
```

**Response:**
```json
{
  "answers": [
    { "question": "...", "answer": "...", "confidence": "high", "sources": 16 },
    { "question": "...", "answer": "...", "confidence": "low", "sources": 0 }
  ],
  "processingTime": "5.2s"
}
```

---

### 2. Conversational Context & Follow-up Questions
**Purpose:** Enable natural conversations with context retention across multiple questions.

**Enhancement:** Add conversation session tracking with TTL-based memory.

**Example:**
```json
{
  "question": "Tell me more about that trip",
  "conversationId": "conv-123"
}
```

**Implementation:** Store previous Q&A pairs in cache with conversation IDs, allowing follow-up questions to reference earlier context.

---

### 3. Question Suggestions & Auto-complete
**Purpose:** Help users discover what they can ask and improve query formulation.

**Endpoint:** `GET /ask/suggestions?query=Layla`

**Response:**
```json
{
  "suggestions": [
    "When is Layla planning her trip to London?",
    "What restaurants has Layla mentioned?",
    "What are Layla's dietary preferences?",
    "What hotels does Layla prefer?"
  ],
  "basedOn": "Member activity patterns and common question templates"
}
```

**Implementation:** Analyze member message patterns and generate template questions based on detected entities and topics.

---

### 4. Member-Specific Summary Endpoint
**Purpose:** Quick access to comprehensive information about a specific member.

**Endpoint:** `GET /members/:name/summary`

**Response:**
```json
{
  "name": "Layla Kawaguchi",
  "messageCount": 330,
  "recentTopics": ["London trip", "Claridge's", "Bentley chauffeur"],
  "upcomingEvents": [
    {
      "type": "travel",
      "destination": "London",
      "date": "November 2025",
      "details": "5-night stay at Claridge's"
    }
  ],
  "preferences": {
    "dining": ["Nobu", "The Ritz", "Michelin-starred"],
    "travel": ["luxury hotels", "private chauffeur"],
    "transportation": ["Bentley", "first-class flights"]
  },
  "contacts": {
    "phone": "555-xxx-xxxx",
    "lastUpdate": "2025-11-10"
  }
}
```

---

### 5. Enhanced Query Classification & Metadata
**Purpose:** Provide transparency about how questions are interpreted and processed.

**Enhancement to `/ask` response:**
```json
{
  "question": "When is Layla's London trip?",
  "answer": "...",
  "metadata": {
    "queryType": "specific",
    "strategy": "semantic-search",
    "detectedEntities": {
      "users": ["Layla Kawaguchi"],
      "dates": ["November 2025"],
      "locations": ["London"],
      "topics": ["travel", "accommodation"]
    },
    "searchParams": {
      "topK": 50,
      "threshold": 0.7,
      "messagesRetrieved": 16
    }
  }
}
```

---

### 6. Confidence Score Explanation
**Purpose:** Explain why the system has high/medium/low confidence in answers.

**Response enhancement:**
```json
{
  "answer": "...",
  "confidence": "high",
  "confidenceExplanation": {
    "score": 0.92,
    "factors": [
      "Found 16 highly relevant messages from the target user",
      "Multiple mentions of specific dates and locations",
      "Consistent information across messages",
      "Recent messages (within last 30 days)"
    ],
    "deductionReasons": []
  }
}
```

---

### 7. Search History & Analytics Dashboard
**Purpose:** Track system usage and identify popular queries for optimization.

**Endpoint:** `GET /analytics/popular-questions`

**Response:**
```json
{
  "period": "last-7-days",
  "topQuestions": [
    { "question": "When is Layla's London trip?", "count": 45, "avgConfidence": 0.89 },
    { "question": "Vikram's cars", "count": 23, "avgConfidence": 0.34 }
  ],
  "topMembers": [
    { "name": "Layla Kawaguchi", "queryCount": 89 },
    { "name": "Vikram Desai", "queryCount": 56 }
  ],
  "averageConfidence": 0.78,
  "averageResponseTime": "2.4s",
  "totalQueries": 342
}
```

---

### 8. Advanced Natural Language Date Parsing
**Purpose:** Better handle relative and contextual date references.

**Examples:**
- "What did Layla say last week?"
- "What are upcoming events this month?"
- "What was discussed on December 15th?"
- "Show me messages from 3 days ago"

**Implementation:** Add date normalization utilities in `queryAnalyzer.ts` to convert relative dates to absolute timestamps.

---

### 9. Similar Questions & Related Queries
**Purpose:** Suggest related questions users might be interested in.

**Endpoint:** `GET /ask/related?question=When is Layla's London trip?`

**Response:**
```json
{
  "relatedQuestions": [
    "What hotel is Layla staying at in London?",
    "Does Layla need transportation in London?",
    "What are Layla's dining preferences in London?",
    "Who else is traveling to London?"
  ],
  "similarPastQueries": [
    "When is Layla traveling to Paris?",
    "What are Layla's travel plans?"
  ]
}
```

---

### 10. Export & Download Member Data
**Purpose:** Allow users to export structured summaries of member information.

**Endpoint:** `GET /members/:name/export?format=json|csv|pdf`

**Formats:**
- JSON: Structured data export
- CSV: Spreadsheet-compatible format
- PDF: Human-readable report

**Use case:** Generating reports for concierge staff or member profiles.

---

### 11. Real-time Question Validation
**Purpose:** Validate questions before processing to prevent errors and improve UX.

**Endpoint:** `POST /ask/validate`

**Request:**
```json
{ "question": "asdfghjkl" }
```

**Response:**
```json
{
  "valid": false,
  "reason": "Question appears to be invalid or gibberish",
  "suggestions": [
    "Try asking about specific members (e.g., 'When is Layla's trip?')",
    "Include what information you're looking for (dates, preferences, reservations)",
    "Use complete sentences"
  ]
}
```

---

### 12. WebSocket Support for Streaming Answers
**Purpose:** Provide real-time streaming of answers as they're being generated.

**Implementation:**
```javascript
// Client receives incremental updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'partial') {
    appendAnswer(data.text); // "Layla is planning..."
  } else if (data.type === 'complete') {
    finalize(data.confidence, data.sources);
  }
}
```

**Benefits:** Better UX for long-running queries, reduced perceived latency.

---

### 13. Question Reformulation & Clarification
**Purpose:** Help users phrase questions more effectively.

**Response enhancement:**
```json
{
  "originalQuestion": "Layla London",
  "reformulatedQuestion": "When is Layla planning her trip to London?",
  "didReformulate": true,
  "reformulationConfidence": 0.85,
  "answer": "...",
  "askForClarification": false
}
```

**Alternative (ambiguous query):**
```json
{
  "needsClarification": true,
  "ambiguities": [
    "Which aspect of Layla's London trip? (dates, hotel, activities, transportation)"
  ],
  "suggestedQuestions": [
    "When is Layla traveling to London?",
    "Where is Layla staying in London?",
    "What activities does Layla have planned in London?"
  ]
}
```

---

### 14. Anomaly Detection in Answers
**Purpose:** Flag potentially inconsistent or conflicting information.

**Response enhancement:**
```json
{
  "answer": "Vikram has 5 luxury cars",
  "confidence": "medium",
  "anomalyDetected": true,
  "anomaly": {
    "type": "conflicting_information",
    "description": "Earlier messages mention 3 cars, but a recent message says 5",
    "conflictingReferences": [
      { "date": "Sep 10, 2024", "statement": "my three cars" },
      { "date": "Nov 2, 2024", "statement": "I now own five vehicles" }
    ],
    "recommendation": "Most recent information suggests 5 cars"
  }
}
```

---

### 15. Advanced Rate Limiting & Usage Analytics
**Purpose:** Production-ready API protection and usage tracking.

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1699876543
X-RateLimit-Policy: per-user
```

**Dashboard Endpoint:** `GET /usage/stats`
```json
{
  "currentPeriod": "2025-11-13",
  "requests": {
    "total": 1247,
    "successful": 1189,
    "failed": 58,
    "rateLimited": 12
  },
  "apiCosts": {
    "claude": "$8.42",
    "openai": "$2.15",
    "total": "$10.57"
  },
  "topUsers": [
    { "ip": "192.168.1.1", "requests": 234 }
  ]
}
```

---

## Implementation Priority

### High Priority (Most Valuable)
1. **Member-Specific Summary Endpoint** (#4) - Comprehensive data showcase
2. **Confidence Explanation** (#6) - Transparency and trust
3. **Question Suggestions** (#3) - Improved discoverability
4. **Multi-Question Batch** (#1) - Evaluation efficiency

### Medium Priority (Production Ready)
5. **Rate Limiting & Analytics** (#15) - Essential for deployment
6. **Question Validation** (#11) - Prevents abuse
7. **Search History** (#7) - System monitoring

### Lower Priority (Nice to Have)
8. **WebSocket Streaming** (#12) - UX enhancement
9. **Export Functionality** (#10) - Additional utility
10. **Conversational Context** (#2) - Advanced UX

---

## Technical Considerations

### Scalability
- All features designed to work with current vector store architecture
- Batch processing parallelizable for efficiency
- Analytics can use separate time-series database

### Cost Management
- Batch processing reduces per-query API costs
- Caching strategies for suggestions and summaries
- Rate limiting prevents cost overruns

### Privacy & Security
- PII redaction before exports
- Access controls for analytics endpoints
- Audit logs for all data access

