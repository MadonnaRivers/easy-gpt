# 🔧 Fix N8N Webhook Issue

## The Problem
Your N8N workflow with webhook ID `e61a4f26-156f-4802-ae33-743399345186` is **not active** or **doesn't exist**.

## ✅ Solution - Choose One:

### Option 1: Activate Existing Workflow (If it exists)

1. **Open N8N**: Go to `http://localhost:5678`
2. **Find the workflow**:
   - Look for workflows with webhook nodes
   - Search for workflow ID: `e61a4f26-156f-4802-ae33-743399345186`
3. **Activate it**:
   - Open the workflow
   - Click the **toggle switch** in the top-right corner (should turn green/ON)
   - Make sure it's saved
4. **Test**: Run `./test-webhook.sh` to verify

### Option 2: Create New Workflow (Recommended)

1. **Open N8N**: `http://localhost:5678`
2. **Create New Workflow**:
   - Click "New Workflow"
   - Add a **Webhook** node
   - Configure:
     - **HTTP Method**: POST
     - **Path**: `chat` (or leave default)
     - **Response Mode**: Respond to Webhook
   - Add a **Respond to Webhook** node (or use the webhook's response)
   - Connect them
3. **Get Webhook URL**:
   - Click on the Webhook node
   - Copy the **Production URL** (looks like: `http://localhost:5678/webhook/[ID]/chat`)
4. **Activate Workflow**:
   - Toggle switch in top-right → ON
   - Save the workflow
5. **Update Frontend**:
   - Edit `src/chatbot_interface.tsx`
   - Replace the webhook URL with your new one
   - Or update `vite.config.ts` proxy path

### Option 3: Use Test Webhook (Quick Test)

If you just want to test the frontend, you can create a simple test workflow:

1. Create workflow with:
   - **Webhook** node (POST, path: `chat`)
   - **Code** node with:
     ```javascript
     return [{
       json: {
         response: "Hello! This is a test response. Your message was: " + $input.item.json.message
       }
     }];
     ```
   - **Respond to Webhook** node
2. Activate it
3. Copy the webhook URL and update the frontend

## 📝 Update Webhook URL in Code

Once you have the correct webhook URL, update these files:

### 1. Update `src/chatbot_interface.tsx`:
```typescript
const N8N_WEBHOOK_URL = '/api/n8n'; // Keep this if using proxy
// OR use direct URL:
// const N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/YOUR_NEW_ID/chat';
```

### 2. Update `vite.config.ts` (if webhook path changed):
```typescript
rewrite: (path) => path.replace(/^\/api\/n8n/, '/webhook/YOUR_NEW_ID/YOUR_PATH'),
```

## 🧪 Test Your Webhook

Run the test script:
```bash
./test-webhook.sh
```

Or test manually:
```bash
curl -X POST http://localhost:5678/webhook/YOUR_ID/YOUR_PATH \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

## ✅ Success Indicators

- ✅ Webhook returns 200 status
- ✅ You get a JSON response
- ✅ No "not registered" errors
- ✅ Frontend can send messages successfully

