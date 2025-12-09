#!/bin/bash
# Quick test to see if sourceInfo is populated

echo "🧪 Testing if sourceInfo is populated..."
echo ""

# Run discovery and check one screen
curl -X POST http://localhost:3000/api/discovery/scan \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/home/dimitrij/Projects/cxm/PolePosition-TESTING"}' \
  -s | \
  jq '.files.implications[] | 
      select(.className == "AcceptedBookingImplications") | 
      .metadata.uiCoverage.platforms.dancer.screens.bookingDetailsScreen[0] | 
      {
        description, 
        visible: .visible[0:3], 
        sourceInfo: {
          visible: .sourceInfo.visible,
          hidden: (.sourceInfo.hidden | keys[0:3])
        }
      }'

echo ""
echo "✅ If you see source/type/category fields above, it's working!"
echo "❌ If you see 'null', the fix isn't applied yet"