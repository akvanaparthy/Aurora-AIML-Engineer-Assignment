# Search Configuration Guide

All search parameters are now fully configurable via environment variables in your `.env` file.

## Quick Start

Copy `.env.example` to `.env` and adjust the following parameters based on your needs.

## Available Configuration Options

### 1. Context Token Limit
```bash
MAX_CONTEXT_TOKENS=20000
```
Controls how much context to send to Claude API.

**Impact:**
- Higher = Better quality answers (more context)
- Lower = Lower API costs
- **Default: 20,000** (~300-500 messages, ~$0.006/request)

### 2. Specific Query Settings
```bash
SPECIFIC_QUERY_TOP_K=50
SPECIFIC_QUERY_THRESHOLD=0.7
```

**What are "Specific Queries"?**
Queries that mention:
- ✅ User names: "Layla", "Vikram Desai", "Amira"
- ✅ Dates: "December 15", "last week", "next month"
- ✅ Locations: "London", "Paris", "Tokyo"
- ✅ Specific items: "cars", "restaurants", "hotels"

**Examples:**
- "How many cars does Vikram have?"
- "When is Layla's London trip?"
- "What did Amira say on December 15?"

**Parameters:**
- `SPECIFIC_QUERY_TOP_K`: Number of results to fetch (default: 50)
- `SPECIFIC_QUERY_THRESHOLD`: Similarity threshold 0-1 (default: 0.7)

### 3. Broad Query Settings
```bash
BROAD_QUERY_TOP_K=120
BROAD_QUERY_THRESHOLD=0.5
```

**What are "Broad Queries"?**
General questions that:
- ❌ Don't mention specific users
- ❌ Don't reference specific dates/locations
- ✅ Ask about patterns or preferences
- ✅ Use words like "members", "users", "everyone"

**Examples:**
- "What do members prefer for dining?"
- "What are the most popular travel destinations?"
- "Who travels frequently?"
- "What luxury items do people like?"

**Parameters:**
- `BROAD_QUERY_TOP_K`: Number of results to fetch (default: 120)
- `BROAD_QUERY_THRESHOLD`: Similarity threshold 0-1 (default: 0.5)

## Pre-configured Modes

### Budget Mode (Cost-Optimized)
```bash
SPECIFIC_QUERY_TOP_K=15
SPECIFIC_QUERY_THRESHOLD=0.75
BROAD_QUERY_TOP_K=50
BROAD_QUERY_THRESHOLD=0.55
MAX_CONTEXT_TOKENS=10000
```
**When to use:** Minimize API costs, still get good results
**Cost:** ~$0.003 per request
**Quality:** Good for straightforward questions

### Balanced Mode (Recommended - Default)
```bash
SPECIFIC_QUERY_TOP_K=50
SPECIFIC_QUERY_THRESHOLD=0.7
BROAD_QUERY_TOP_K=120
BROAD_QUERY_THRESHOLD=0.5
MAX_CONTEXT_TOKENS=20000
```
**When to use:** Best balance of quality and cost
**Cost:** ~$0.006 per request
**Quality:** Excellent for most use cases

### Quality Mode (Maximum Quality)
```bash
SPECIFIC_QUERY_TOP_K=50
SPECIFIC_QUERY_THRESHOLD=0.65
BROAD_QUERY_TOP_K=150
BROAD_QUERY_THRESHOLD=0.45
MAX_CONTEXT_TOKENS=30000
```
**When to use:** Need comprehensive, high-quality answers
**Cost:** ~$0.009 per request
**Quality:** Best possible, comprehensive coverage

## Parameter Tuning Guide

### If answers are too vague or miss details:
1. **Increase context:** `MAX_CONTEXT_TOKENS=30000`
2. **Fetch more results:** Increase `BROAD_QUERY_TOP_K=100`
3. **Lower threshold:** `BROAD_QUERY_THRESHOLD=0.45` (includes more results)

### If answers contain irrelevant information:
1. **Increase threshold:** `SPECIFIC_QUERY_THRESHOLD=0.8` (stricter relevance)
2. **Fetch fewer results:** Decrease `SPECIFIC_QUERY_TOP_K=15`
3. **Reduce context:** `MAX_CONTEXT_TOKENS=15000`

### If API costs are too high:
1. **Reduce context:** `MAX_CONTEXT_TOKENS=10000`
2. **Fetch fewer results:** Lower both `topK` values
3. **Increase thresholds:** Higher values = fewer results processed

### If broad queries don't cover enough users:
1. **Increase broad results:** `BROAD_QUERY_TOP_K=100` or higher
2. **Lower threshold:** `BROAD_QUERY_THRESHOLD=0.4` (more inclusive)
3. **The system will automatically apply diversity sampling**

## Understanding the Parameters

### top_k (Number of Results)
- How many candidate messages to retrieve from vector search
- Higher = More options to choose from
- **Specific queries:** 15-100 (default: 50)
- **Broad queries:** 50-200 (default: 120)

### threshold (Similarity Score)
- Minimum relevance score (0.0 = no filtering, 1.0 = exact match)
- Higher = Only very relevant results
- Lower = More inclusive, broader coverage
- **Specific queries:** 0.6-0.9 (default: 0.7)
- **Broad queries:** 0.4-0.6 (default: 0.5)

### MAX_CONTEXT_TOKENS
- Final limit on how much to send to Claude
- Acts as safety net after all filtering
- **Range:** 5,000-50,000 (default: 20,000)

## Monitoring

Watch the console logs when queries are processed:

```
📊 Query Analysis: specific query (precision)
🔍 Search params: topK=50, threshold=0.7
👤 Detected users: Layla
📍 Detected locations: London
✅ Using all 45 messages (11,250 tokens, within 20000 limit)
```

This tells you:
- Query type detected
- Parameters used
- Entities found
- Token usage vs limit
