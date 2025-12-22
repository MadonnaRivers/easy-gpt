# 🔴 CRITICAL: Activate Your N8N Workflow

## The Problem
The webhook is returning 404 because **the workflow is NOT ACTIVATED**.

## ✅ Step-by-Step Fix

### Step 1: Open N8N
Go to: **http://localhost:5678**

### Step 2: Find Your Workflow
1. Click on **"Workflows"** in the left sidebar
2. Look for a workflow with webhook ID: `e61a4f26-156f-4802-ae33-743399345186`
3. **OR** look for workflows that have a **Webhook** node

### Step 3: Open the Workflow
1. Click on the workflow to open it
2. You should see the workflow canvas with nodes

### Step 4: ACTIVATE the Workflow ⚠️ THIS IS CRITICAL
1. Look at the **top-right corner** of the workflow editor
2. You'll see a **toggle switch** (like a light switch)
3. **Click it to turn it ON** (it should turn green/blue)
4. You should see text like "Active" or "Inactive" change to "Active"

**Visual Guide:**
```
┌─────────────────────────────────────┐
│  Workflow Name          [●] Active │ ← Toggle switch HERE
│                                    │
│  [Webhook] → [Code] → [Respond]   │
│                                    │
└─────────────────────────────────────┘
```

### Step 5: Verify It's Active
- The toggle should be **ON/GREEN**
- Status should say **"Active"**
- Save the workflow (Ctrl+S or Cmd+S)

### Step 6: Wait a Few Seconds
N8N needs a moment to register the webhook. Wait 3-5 seconds.

### Step 7: Test
Run this command:
```bash
./test-webhook.sh
```

Or test in your browser at `http://localhost:3000`

## 🚨 Common Mistakes

❌ **Just saving the workflow** - Not enough! Must ACTIVATE
❌ **Workflow is "Inactive"** - Toggle must be ON
❌ **Not waiting** - N8N needs a few seconds to register
❌ **Wrong workflow** - Make sure it's the one with the correct webhook ID

## ✅ Success Indicators

When activated correctly:
- ✅ Toggle switch is ON/GREEN
- ✅ Status shows "Active"
- ✅ `./test-webhook.sh` returns 200 status
- ✅ No "not registered" errors
- ✅ Frontend can send messages successfully

## 🔍 How to Check if Workflow is Active

1. In N8N, go to Workflows list
2. Look at the workflow - it should show "Active" status
3. Or open the workflow - toggle should be ON

## 📝 If You Can't Find the Workflow

If the workflow doesn't exist, create a new one:

1. Click **"New Workflow"**
2. Add **Webhook** node
   - Method: POST
   - Path: `chat`
3. Add **Code** node (for testing):
   ```javascript
   return [{
     json: {
       response: "Hello! You said: " + $input.item.json.message
     }
   }];
   ```
4. Add **Respond to Webhook** node
5. Connect: Webhook → Code → Respond
6. **ACTIVATE** the workflow (toggle ON)
7. Copy the webhook URL and update `vite.config.ts` if needed

