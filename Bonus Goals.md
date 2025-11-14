Already mentioned in README.md , but still pasting it here for quick access

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