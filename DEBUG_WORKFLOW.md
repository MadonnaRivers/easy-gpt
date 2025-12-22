# 🔍 Debugging N8N Workflow 500 Error

## ✅ Good News!
The webhook **IS working**! The 500 error means:
- ✅ Webhook is registered
- ✅ Workflow is active
- ❌ But there's an error **inside** the workflow execution

## 🔍 How to Find the Error

### Step 1: Check N8N Executions
1. Open N8N: `http://localhost:5678`
2. Click **"Executions"** in the left sidebar
3. Look at the **latest execution** (should be red/failed)
4. Click on it to see the error details

### Step 2: Check the Error Details
The execution will show:
- Which node failed
- What the error message is
- What data was received

## 🐛 Common Issues

### 1. Missing Input Data
**Problem:** Workflow expects data that isn't being sent

**Fix:** Check what your workflow expects:
- Does it expect `message` field? ✅ (we're sending this)
- Does it expect `chatId`? ✅ (we're sending this)
- Does it expect other fields?

### 2. Wrong Data Format
**Problem:** Workflow expects different JSON structure

**Current request:**
```json
{
  "message": "your message",
  "chatId": 1
}
```

**Fix:** Update your workflow to handle this format, or update the frontend to match what the workflow expects.

### 3. Code Node Errors
**Problem:** If you have a Code/Function node, there might be a JavaScript error

**Fix:** 
- Check the Code node
- Look for syntax errors
- Check if variables are defined correctly
- Use `$input.item.json.message` to access the message

### 4. Missing Respond Node
**Problem:** Workflow doesn't have a "Respond to Webhook" node

**Fix:** Add a "Respond to Webhook" node at the end of your workflow

## 📝 Example Workflow Structure

A simple working workflow should look like:

```
[Webhook] → [Code/Process] → [Respond to Webhook]
```

**Webhook Node:**
- Method: POST
- Path: `chat`

**Code Node (example):**
```javascript
// Access the incoming message
const message = $input.item.json.message;
const chatId = $input.item.json.chatId;

// Process it (your logic here)
const response = "You said: " + message;

// Return response
return [{
  json: {
    response: response
  }
}];
```

**Respond to Webhook Node:**
- Connect it after your processing
- It will send the response back

## 🧪 Test Your Workflow

1. In N8N, click "Test workflow" button
2. Or use the "Test URL" from the Webhook node
3. Send a test request and see if it works

## ✅ Quick Fix Checklist

- [ ] Check N8N Executions tab for error details
- [ ] Verify workflow has "Respond to Webhook" node
- [ ] Check Code nodes for errors
- [ ] Verify data format matches what workflow expects
- [ ] Test workflow manually in N8N

