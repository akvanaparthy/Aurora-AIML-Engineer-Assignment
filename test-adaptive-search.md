# Adaptive Search Strategy - Test Examples

## Overview
The system now uses an adaptive search strategy that automatically adjusts search parameters based on query type.

**Key Update:** Token-based limits (configurable, default: 20,000 tokens) replace hard message count limits for better quality/cost balance.

## Query Classification

### Specific Queries (Precision-focused)
**Parameters (Configurable via .env):**
- `SPECIFIC_QUERY_TOP_K`: 50 results (default)
- `SPECIFIC_QUERY_THRESHOLD`: 0.7 (default)
- `strategy`: precision

**What makes a query "specific":**
- Mentions specific user names (e.g., "Layla", "Vikram Desai")
- Includes dates (e.g., "December 15", "last week")
- References locations (e.g., "London", "Paris")
- Asks about specific items (e.g., "cars", "restaurants", "hotels")

**Examples:**
1. "When is Layla planning her trip to London?"
   - Detects: user name (Layla), location (London)
   - Type: specific
   - Expected: 50 highly relevant results about Layla's London trip

2. "How many cars does Vikram Desai have?"
   - Detects: user name (Vikram Desai), specific item (cars)
   - Type: specific
   - Expected: 50 precise results about Vikram's cars

3. "What are Amira's favorite restaurants?"
   - Detects: user name (Amira), specific item (restaurants)
   - Type: specific
   - Expected: 50 focused results about Amira's restaurant preferences

4. "What did Layla say on December 15, 2023?"
   - Detects: user name (Layla), date (December 15, 2023)
   - Type: specific
   - Expected: 50 results from Layla around that date

### Broad Queries (Recall-focused)
**Parameters (Configurable via .env):**
- `BROAD_QUERY_TOP_K`: 120 results (default)
- `BROAD_QUERY_THRESHOLD`: 0.5 (default)
- `strategy`: recall
- **Diversity sampling enabled** for multi-user queries

**What makes a query "broad":**
- No specific user names mentioned
- No specific dates or locations
- General questions about patterns or preferences
- Questions about "members", "users", "people", "everyone"
- Questions like "what do", "who has", "what are the most"

**Examples:**
1. "What do members prefer for dining?"
   - Detects: no specific entities, multi-user indicator (members)
   - Type: broad
   - Expected: 120 results with diversity sampling across multiple users

2. "What are the most popular travel destinations?"
   - Detects: no specific entities
   - Type: broad
   - Expected: 120 results showing patterns across many members

3. "What are members' luxury preferences?"
   - Detects: no specific entities, multi-user indicator (members)
   - Type: broad
   - Expected: 120 diverse results from multiple users

4. "Who travels frequently?"
   - Detects: no specific user, multi-user query
   - Type: broad
   - Expected: 120 results with diversity sampling to show multiple members

## Diversity Sampling

For broad, multi-user queries, the system applies diversity sampling to ensure results span multiple users:

1. **Groups messages by user**
2. **Ensures at least 5 different users** in results (if available)
3. **Distributes messages evenly** across users
4. **Fills remaining slots** with most relevant additional messages

### Example:
Query: "What do members prefer for dining?"
- Fetches 75 results
- Groups by user: Alice (20), Bob (15), Carol (25), David (10), Eve (5)
- Samples: 10 from Alice, 7 from Bob, 12 from Carol, 5 from David, 5 from Eve
- Total: ~40 messages from 5 different users
- Result: More comprehensive view of dining preferences across the member base

## Entity Detection

The system automatically detects:

### User Names
- Pattern matching: "Layla's trip", "does Vikram have", "Amira prefers"
- Database lookup: Validates against known users

### Dates
- Specific dates: "12/25/2023", "December 25, 2023"
- Relative dates: "last week", "next month", "3 days ago"
- Day names: "last Monday", "this Friday"

### Locations
- City names: London, Paris, Tokyo, New York, etc.
- Country names: France, Italy, Japan, USA, etc.
- Contextual: "trip to London", "travel from Paris"

### Specific Items
- Categories: cars, restaurants, hotels, flights, wine, art, etc.
- Patterns: "how many cars", "favorite restaurant", "which hotel"

## Configuration

All search parameters are now fully configurable via `.env` file.

### Token Limits (Configurable)
Set in `.env`:
```bash
MAX_CONTEXT_TOKENS=20000
```

**Recommended Values:**
- **10,000 tokens**: Budget-friendly, ~150-250 messages
- **20,000 tokens**: Balanced (default), ~300-500 messages
- **30,000 tokens**: Maximum quality, ~600-800 messages

**Cost Consideration:**
- 20K tokens ≈ $0.006 per request (Claude 3.5 Sonnet pricing)
- Significantly better results than old 6K token limit
- More cost-effective than 50K-100K tokens

### Search Strategy Parameters (Configurable)

**Specific Queries:**
```bash
SPECIFIC_QUERY_TOP_K=50           # Number of results to fetch
SPECIFIC_QUERY_THRESHOLD=0.7      # Minimum similarity score (0.0-1.0)
```

**Broad Queries:**
```bash
BROAD_QUERY_TOP_K=120             # Number of results to fetch
BROAD_QUERY_THRESHOLD=0.5         # Minimum similarity score (0.0-1.0)
```

### Tuning Guide

**Increase Precision (Specific Queries):**
- Increase `SPECIFIC_QUERY_THRESHOLD` to 0.8 or 0.9
- Decrease `SPECIFIC_QUERY_TOP_K` to 15-20
- Use when: You want only the most relevant results

**Increase Recall (Broad Queries):**
- Decrease `BROAD_QUERY_THRESHOLD` to 0.4 or 0.45
- Increase `BROAD_QUERY_TOP_K` to 100-150
- Use when: You want comprehensive coverage

**Balance Cost vs Quality:**
- Lower `MAX_CONTEXT_TOKENS` to reduce API costs
- Lower `topK` values to reduce processing time
- Higher `threshold` values to filter out noise

**Example Configurations:**

**Budget Mode** (Lower costs):
```bash
SPECIFIC_QUERY_TOP_K=15
SPECIFIC_QUERY_THRESHOLD=0.75
BROAD_QUERY_TOP_K=50
BROAD_QUERY_THRESHOLD=0.55
MAX_CONTEXT_TOKENS=10000
```

**Quality Mode** (Better answers):
```bash
SPECIFIC_QUERY_TOP_K=50
SPECIFIC_QUERY_THRESHOLD=0.65
BROAD_QUERY_TOP_K=150
BROAD_QUERY_THRESHOLD=0.45
MAX_CONTEXT_TOKENS=30000
```

**Balanced Mode** (Default - Recommended):
```bash
SPECIFIC_QUERY_TOP_K=50
SPECIFIC_QUERY_THRESHOLD=0.7
BROAD_QUERY_TOP_K=120
BROAD_QUERY_THRESHOLD=0.5
MAX_CONTEXT_TOKENS=20000
```

## Benefits

1. **Better Context for Generic Questions**
   - Broad queries now fetch up to 150 results (vs 20 previously)
   - Token limit automatically optimizes context size
   - Ensures comprehensive coverage of the 3000+ message dataset

2. **Maintains Precision for Specific Queries**
   - Specific queries still get focused, highly relevant results
   - No dilution of quality with irrelevant messages

3. **Diversity for Multi-User Queries**
   - Broad queries about "members" or "users" get diverse perspectives
   - Avoids bias toward one or two highly active users

4. **Automatic Adaptation**
   - No manual configuration needed
   - System intelligently chooses strategy based on query content

5. **Cost-Effective Scaling**
   - Token-based limits prevent runaway costs
   - Configurable for different use cases
   - Quality scales with your budget

## Implementation Details

### Files Modified
1. `src/utils/queryAnalyzer.ts` - New query analysis and entity detection
2. `src/utils/queryOptimizer.ts` - Adaptive search strategy and diversity sampling
3. `.env.example` - Updated configuration documentation

### Key Functions
- `analyzeQuery()` - Determines query type and search parameters
- `extractEntities()` - Detects user names, dates, locations, items
- `diversifySampling()` - Ensures diverse user representation in results
- `optimizeWithAdaptiveSemanticSearch()` - Applies adaptive strategy to vector search

## Testing the Implementation

You can test the adaptive search by asking different types of questions:

### Test Specific Queries:
```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "When is Layla planning her trip to London?"}'
```

Check console output for:
- `📊 Query Analysis: specific query (precision)`
- `🔍 Search params: topK=50, threshold=0.7`
- `👤 Detected users: Layla`
- `📍 Detected locations: London`

### Test Broad Queries:
```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What do members prefer for dining?"}'
```

Check console output for:
- `📊 Query Analysis: broad query (recall)`
- `🔍 Search params: topK=120, threshold=0.5`
- `🌐 Applying diversity sampling for multi-user query`
- `📊 Diversity sampling: X unique users in results`
- `✅ Diversity sampling complete: Y messages from Z users`
