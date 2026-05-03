#!/bin/bash
# Test all API endpoints for IntelSphere

echo "🧪 Testing IntelSphere API Endpoints"
echo "===================================="
echo ""

BASE_URL="http://localhost:5173"
FAILED=0

test_endpoint() {
  local endpoint=$1
  local name=$2
  
  echo -n "Testing $name ($endpoint)... "
  
  response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
  
  if [ "$response" = "200" ]; then
    echo "✅ OK (200)"
  elif [ "$response" = "404" ]; then
    echo "❌ NOT FOUND (404)"
    FAILED=$((FAILED + 1))
  elif [ "$response" = "500" ]; then
    echo "❌ SERVER ERROR (500)"
    FAILED=$((FAILED + 1))
  else
    echo "⚠️  UNEXPECTED ($response)"
    FAILED=$((FAILED + 1))
  fi
}

echo "Core APIs:"
test_endpoint "/api/events" "Events"
test_endpoint "/api/feed" "Feed"
test_endpoint "/api/flights" "Flights"

echo ""
echo "AI APIs:"
test_endpoint "/api/ai/brief?eventId=test" "AI Brief"
test_endpoint "/api/ai/global-brief-api" "Global Brief"

echo ""
echo "Intelligence APIs:"
test_endpoint "/api/intelligence/global-risk" "Global Risk"
test_endpoint "/api/intelligence/hotspots-api" "Hotspots"
test_endpoint "/api/intelligence/trends-api" "Trending Signals"
test_endpoint "/api/intelligence/correlations" "Correlations"
test_endpoint "/api/intelligence/signals" "Predictive Signals"
test_endpoint "/api/intelligence/timeline-api" "Timeline"

echo ""
echo "===================================="
if [ $FAILED -eq 0 ]; then
  echo "✅ All endpoints working!"
else
  echo "❌ $FAILED endpoint(s) failed"
fi
