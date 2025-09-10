---
description: Act on web pages using SimplePage API with see-act-see cycle
allowed-tools: Bash, Read
---

# SimplePage Automation Task

Complete this web automation task using SimplePage API: **$ARGUMENTS**

## Server Info
- API: `http://localhost:3100`
- Server is already running with SCREENSHOT=true

## Core Workflow: See → Act → See

### Step 1: Create Page
```bash
curl -X POST http://localhost:3100/api/pages \
  -H "Content-Type: application/json" \
  -d '{"name": "task", "url": "TARGET_URL", "timeout": 10000}'
```
Save the `pageId` from response.

### Step 2: See (Get Structure)
```bash
curl http://localhost:3100/api/pages/{pageId}/structure
```

You'll see output like:
```
[0-123] button "Search"
[0-124] textbox "Enter search term" 
[0-125] link "Home"
[0-126] heading "Welcome"
```

The format is: [EncodedId] role "text/name"

### Step 3: Act (Use EncodedId)
Based on what you see, act on elements using their EncodedId:

```bash
# Click
curl -X POST http://localhost:3100/api/pages/{pageId}/act-id \
  -H "Content-Type: application/json" \
  -d '{"encodedId": "0-123", "method": "click", "description": "Click search button"}'

# Fill text
curl -X POST http://localhost:3100/api/pages/{pageId}/act-id \
  -H "Content-Type: application/json" \
  -d '{"encodedId": "0-124", "method": "fill", "args": ["search text"], "description": "Fill search box"}'

# Other methods: selectOption, hover, press, scrollY, scrollX
```

### Step 4: See Again
After each action, get structure again to see what changed:
```bash
curl http://localhost:3100/api/pages/{pageId}/structure
```

### Additional Operations

**Navigate to new page:**
```bash
curl -X POST http://localhost:3100/api/pages/{pageId}/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "timeout": 5000}'
```

**Wait (if needed):**
```bash
curl -X POST http://localhost:3100/api/pages/{pageId}/wait \
  -H "Content-Type: application/json" \
  -d '{"timeout": 2000, "description": "Wait for page to load"}'
```

**Close when done:**
```bash
curl -X DELETE http://localhost:3100/api/pages/{pageId}
```

## Process

1. Create page with target URL
2. Get structure - SEE what's on the page
3. Find the element you need by its text/role
4. ACT on it using its EncodedId  
5. Get structure again - SEE the result
6. Repeat steps 3-5 until task complete
7. Close the page

## Tips
- Always add descriptive `description` to your actions
- If page changes significantly, EncodedIds will change - just get structure again
- Look for element roles (button, textbox, link) and text to identify what you need
- Each action is recorded with screenshots for debugging

Now complete the task step by step. Show each curl command and its key results.