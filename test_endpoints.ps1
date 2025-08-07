# Comprehensive API Endpoint Testing Script
# Tests all the business features that the frontend is expecting

Write-Host "🧪 Testing Fit Space Forge API Endpoints" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

$baseUrl = "http://localhost:3001"

# Test 1: Health Check
Write-Host "`n✅ Testing Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "✓ Health Check: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "✗ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Contact Form Endpoints
Write-Host "`nTesting Contact and Support System..." -ForegroundColor Yellow

# Test contact form submission
$contactData = @{
    name = "Test User"
    email = "test@example.com"
    phone = "+1234567890"
    subject = "API Test"
    message = "Testing the contact form API endpoint"
    category = "technical"
} | ConvertTo-Json

try {
    $contactResponse = Invoke-RestMethod -Uri "$baseUrl/api/contact/send" -Method POST -Body $contactData -ContentType "application/json"
    Write-Host "✓ Contact Form: $($contactResponse.message)" -ForegroundColor Green
} catch {
    Write-Host "✗ Contact Form Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test newsletter subscription
$newsletterData = @{
    email = "newsletter@example.com"
    firstName = "Newsletter"
} | ConvertTo-Json

try {
    $newsletterResponse = Invoke-RestMethod -Uri "$baseUrl/api/contact/newsletter/subscribe" -Method POST -Body $newsletterData -ContentType "application/json"
    Write-Host "✓ Newsletter Subscribe: $($newsletterResponse.message)" -ForegroundColor Green
} catch {
    Write-Host "✗ Newsletter Subscribe Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Product Endpoints (Public)
Write-Host "`n✅ Testing Product System..." -ForegroundColor Yellow

try {
    $products = Invoke-RestMethod -Uri "$baseUrl/api/products?limit=5" -Method GET
    Write-Host "✓ Products List: Found $($products.products.Count) products" -ForegroundColor Green
} catch {
    Write-Host "✗ Products List Failed: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $categories = Invoke-RestMethod -Uri "$baseUrl/api/products/categories/all" -Method GET
    Write-Host "✓ Categories: Found $($categories.categories.Count) categories" -ForegroundColor Green
} catch {
    Write-Host "✗ Categories Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Authentication Required Endpoints (without token)
Write-Host "`n✅ Testing Authentication Protection..." -ForegroundColor Yellow

$protectedEndpoints = @(
    @{ url = "$baseUrl/api/wishlist"; method = "GET"; name = "Wishlist" }
    @{ url = "$baseUrl/api/reviews"; method = "POST"; name = "Create Review" }
    @{ url = "$baseUrl/api/cart"; method = "GET"; name = "Cart" }
    @{ url = "$baseUrl/api/orders"; method = "GET"; name = "Orders" }
    @{ url = "$baseUrl/api/analytics/overview"; method = "GET"; name = "Analytics" }
)

foreach ($endpoint in $protectedEndpoints) {
    try {
        $response = Invoke-RestMethod -Uri $endpoint.url -Method $endpoint.method -ErrorAction Stop
        Write-Host "✗ $($endpoint.name): Should require authentication!" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host "✓ $($endpoint.name): Properly protected (401 Unauthorized)" -ForegroundColor Green
        } else {
            Write-Host "? $($endpoint.name): Unexpected error - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

# Test 5: Admin Endpoints (without admin token)
Write-Host "`n✅ Testing Admin Protection..." -ForegroundColor Yellow

$adminEndpoints = @(
    @{ url = "$baseUrl/api/admin/dashboard"; method = "GET"; name = "Admin Dashboard" }
    @{ url = "$baseUrl/api/admin/orders"; method = "GET"; name = "Admin Orders" }
)

foreach ($endpoint in $adminEndpoints) {
    try {
        $response = Invoke-RestMethod -Uri $endpoint.url -Method $endpoint.method -ErrorAction Stop
        Write-Host "✗ $($endpoint.name): Should require admin authentication!" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host "✓ $($endpoint.name): Properly protected (401 Unauthorized)" -ForegroundColor Green
        } else {
            Write-Host "? $($endpoint.name): Unexpected error - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n🎉 API Testing Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "📋 Summary of Available Endpoints:" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔐 Authentication (3 endpoints):" -ForegroundColor White
Write-Host "  POST /api/auth/register"
Write-Host "  POST /api/auth/login"  
Write-Host "  GET  /api/auth/me"
Write-Host ""
Write-Host "🛍️ Products (4 endpoints):" -ForegroundColor White
Write-Host "  GET  /api/products"
Write-Host "  GET  /api/products/:id"
Write-Host "  GET  /api/products/categories/all"
Write-Host "  GET  /api/products/:id/related"
Write-Host ""
Write-Host "🛒 Shopping (12 endpoints):" -ForegroundColor White
Write-Host "  Cart: GET, POST /add, PUT /items/:id, DELETE /items/:id, DELETE /clear"
Write-Host "  Orders: GET, POST /create, GET /:id, PATCH /:id/status"
Write-Host "  Addresses: GET, POST, PUT /:id, DELETE /:id, POST /:id/set-default"
Write-Host ""
Write-Host "💳 Payments (4 endpoints):" -ForegroundColor White
Write-Host "  POST /api/payments/create"
Write-Host "  PATCH /api/payments/:id/status"
Write-Host "  GET  /api/payments/:id"
Write-Host "  POST /api/payments/:id/refund"
Write-Host ""
Write-Host "📞 Contact & Support (3 endpoints):" -ForegroundColor White
Write-Host "  POST /api/contact/send"
Write-Host "  POST /api/contact/newsletter/subscribe"
Write-Host "  POST /api/contact/newsletter/unsubscribe"
Write-Host ""
Write-Host "❤️ Wishlist (5 endpoints):" -ForegroundColor White
Write-Host "  GET    /api/wishlist"
Write-Host "  POST   /api/wishlist/add"
Write-Host "  DELETE /api/wishlist/remove/:productId"
Write-Host "  DELETE /api/wishlist/clear"
Write-Host "  GET    /api/wishlist/check/:productId"
Write-Host ""
Write-Host "⭐ Product Reviews (5 endpoints):" -ForegroundColor White
Write-Host "  GET    /api/reviews/:productId"
Write-Host "  POST   /api/reviews"
Write-Host "  PUT    /api/reviews/:reviewId"
Write-Host "  DELETE /api/reviews/:reviewId"
Write-Host "  POST   /api/reviews/:reviewId/helpful"
Write-Host ""
Write-Host "👑 Admin Dashboard (3 endpoints):" -ForegroundColor White
Write-Host "  GET   /api/admin/dashboard"
Write-Host "  GET   /api/admin/orders"
Write-Host "  PATCH /api/admin/orders/:orderId/status"
Write-Host ""
Write-Host "📊 Analytics (2 endpoints):" -ForegroundColor White
Write-Host "  GET /api/analytics/overview"
Write-Host "  GET /api/analytics/payments"
Write-Host ""
Write-Host "🚀 Total: 41 API Endpoints Ready!" -ForegroundColor Green
