#!/bin/bash

# Test script to check N8N webhook

echo "Testing N8N Webhook..."
echo ""

WEBHOOK_URL="http://localhost:5678/webhook/e61a4f26-156f-4802-ae33-743399345186/chat"

echo "Webhook URL: $WEBHOOK_URL"
echo ""
echo "Sending test request..."
echo ""

response=$(curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s)

echo "$response"
echo ""

if echo "$response" | grep -q "not registered"; then
    echo "❌ ERROR: Webhook is not registered!"
    echo ""
    echo "To fix this:"
    echo "1. Open N8N: http://localhost:5678"
    echo "2. Find or create a workflow with webhook ID: e61a4f26-156f-4802-ae33-743399345186"
    echo "3. Make sure the workflow is ACTIVATED (toggle switch)"
    echo "4. Check the webhook path matches: /chat"
    echo ""
elif echo "$response" | grep -q "HTTP Status: 200\|HTTP Status: 201"; then
    echo "✅ SUCCESS: Webhook is working!"
else
    echo "⚠️  Check the response above for details"
fi

