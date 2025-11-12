# No-Limits Test Instructions

This test will run the query **"How many cars does Vikram Desai have?"** with ABSOLUTELY NO LIMITATIONS:

## What Gets Disabled:
- ❌ No top_k limits (fetches up to 10,000 results)
- ❌ No similarity threshold (accepts all results, threshold = 0.0)
- ❌ No token truncation (sends ALL context to Claude)
- ❌ No message count limits
- ✅ EVERYTHING relevant gets sent to Claude

## How to Run:

### Step 1: Add to your `.env` file
```bash
NO_LIMITS_TEST=true
```

### Step 2: Restart your server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

Wait for the server to fully start and show:
```
✅ Successfully fetched X messages
✅ Cache refreshed successfully
Server running on port 3000
```

### Step 3: Run the test (in a NEW terminal)
```bash
node test-no-limits.js
```

## What to Look For:

### In the test output:
```
📊 RESPONSE (NO LIMITS MODE)
================================================================================

📝 Answer:
[Claude's answer with maximum context]

📈 Metadata:
- Confidence: high/medium/low
- Sources: [Number of messages sent - could be 100+ or even ALL Vikram's messages]
- References: [Number of references]
```

### In the server console:
Look for these markers:
```
🚨 NO LIMITS TEST MODE ACTIVE
🔍 Search params: topK=10000, threshold=0
👤 Detected users: Vikram Desai
🚨 NO LIMITS TEST MODE: Using ALL XXX messages (XXXXX tokens, NO TRUNCATION)
```

This tells you:
- How many messages were found for Vikram
- Total tokens sent to Claude (no limit!)
- No truncation occurred

## After Testing:

### Step 4: Disable test mode
Remove or comment out from `.env`:
```bash
# NO_LIMITS_TEST=true
```

### Step 5: Restart server normally
```bash
# Ctrl+C to stop
npm run dev
```

## Comparison Test:

After running the no-limits test, you can run a normal query to compare:

```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How many cars does Vikram Desai have?"}'
```

This will use the standard limits (topK=50, 20K token limit).

## Expected Differences:

**No-Limits Mode:**
- Sources: Could be 100-500+ messages
- Tokens: Could be 50K-150K+ tokens
- Processing: Slower (more data)
- Quality: Maximum possible context
- Cost: Higher ($0.015-$0.045 per request)

**Normal Mode (topK=50, 20K tokens):**
- Sources: ~30-50 messages
- Tokens: ~20,000 max
- Processing: Faster
- Quality: Optimized, focused
- Cost: Standard ($0.006 per request)

## Why This Test?

This test shows:
1. **What Claude sees with unlimited context** - All relevant information
2. **Whether more context = better answers** - Quality comparison
3. **Token usage at scale** - Real cost implications
4. **System behavior without safety nets** - Testing edge cases

The comparison will help determine if the current limits (50/120 topK, 20K tokens) are optimal or should be adjusted.
