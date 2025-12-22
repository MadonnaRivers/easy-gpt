# N8N Webhook Setup Guide

## Error: Webhook Not Registered

The error "The requested webhook is not registered" means:
1. The workflow doesn't exist
2. The workflow is not active
3. The webhook path is incorrect
4. The workflow belongs to a different user

## How to Fix

### Step 1: Open N8N
Go to: `http://localhost:5678`

### Step 2: Find or Create Your Workflow

**Option A: If workflow exists:**
1. Search for workflows with webhook nodes
2. Find the workflow with webhook ID: `e61a4f26-156f-4802-ae33-743399345186`
3. Open the workflow
4. **Activate it** (toggle switch in top-right corner)
5. Make sure it's saved

**Option B: If workflow doesn't exist:**
1. Create a new workflow
2. Add a **Webhook** node
3. Configure it:
   - Method: `POST`
   - Path: `chat` (or leave default)
   - Save the workflow
4. **Activate the workflow**
5. Copy the webhook URL from the webhook node

### Step 3: Get the Correct Webhook URL

In N8N, when you click on the Webhook node, you'll see the webhook URL. It should look like:
```
http://localhost:5678/webhook/[WORKFLOW_ID]/[PATH]
```

**To find your webhook URL:**
1. Open your workflow in N8N
2. Click on the Webhook node
3. Look at the "Production URL" field
4. Copy the full URL

### Step 4: Update the Frontend

Once you have the correct webhook URL, update it in:
- `src/chatbot_interface.tsx` - Change `N8N_WEBHOOK_URL`
- `vite.config.ts` - Update the proxy rewrite path

## Quick Test

To test if your webhook is working, you can use curl:

```bash
curl -X POST http://localhost:5678/webhook/YOUR_WORKFLOW_ID/YOUR_PATH \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

If it works, you'll get a response. If not, check:
- Is the workflow activated?
- Is the webhook path correct?
- Is N8N running?

## Common Issues

### "Workflow not owned by you"
- Make sure you're logged in as the workflow owner
- Or create a new workflow under your account

### "Webhook not registered"
- The workflow must be **ACTIVE** (not just saved)
- Check the webhook path matches exactly
- Make sure the webhook node is configured for POST method

### "404 Not Found"
- Verify the webhook URL is correct
- Check if N8N is running on port 5678
- Ensure the workflow is activated

