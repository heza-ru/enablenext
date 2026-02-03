#!/bin/bash
# Test if build works properly

echo "🔨 Testing build sequence..."

echo ""
echo "Step 1: Building packages/data-provider..."
npm run build --workspace=packages/data-provider
if [ ! -d "packages/data-provider/dist" ]; then
    echo "❌ FAILED: packages/data-provider/dist not created"
    exit 1
fi
echo "✅ data-provider built successfully"

echo ""
echo "Step 2: Building packages/client (@librechat/client)..."
npm run build --workspace=packages/client
if [ ! -f "packages/client/dist/index.js" ]; then
    echo "❌ FAILED: packages/client/dist/index.js not created"
    exit 1
fi
echo "✅ @librechat/client built successfully"

echo ""
echo "Step 3: Checking @librechat/client entry points..."
if [ ! -f "packages/client/dist/index.es.js" ]; then
    echo "❌ FAILED: packages/client/dist/index.es.js missing"
    exit 1
fi
if [ ! -f "packages/client/dist/types/index.d.ts" ]; then
    echo "❌ FAILED: packages/client/dist/types/index.d.ts missing"
    exit 1
fi
echo "✅ All entry points present"

echo ""
echo "Step 4: Building main client..."
npm run build --workspace=client
if [ ! -d "client/dist" ]; then
    echo "❌ FAILED: client/dist not created"
    exit 1
fi
echo "✅ Client built successfully"

echo ""
echo "🎉 All builds completed successfully!"
echo "Ready to deploy to Vercel!"
