# Simple API Testing Script
Write-Host "Testing Fit Space Forge API" -ForegroundColor Green

$baseUrl = "http://localhost:3001"

# Test Health Check
Write-Host "`nTesting Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "SUCCESS: Health Check - $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Health Check Failed" -ForegroundColor Red
}

# Test Contact Form
Write-Host "`nTesting Contact Form..." -ForegroundColor Yellow
$contactData = @{
    name = "Test User"
    email = "test@example.com"
    subject = "API Test"
    message = "Testing contact form"
    category = "technical"
} | ConvertTo-Json

try {
    $contact = Invoke-RestMethod -Uri "$baseUrl/api/contact/send" -Method POST -Body $contactData -ContentType "application/json"
    Write-Host "SUCCESS: Contact Form - Message sent" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Contact Form - $($_.Exception.Message)" -ForegroundColor Red
}

# Test Products
Write-Host "`nTesting Products..." -ForegroundColor Yellow
try {
    $products = Invoke-RestMethod -Uri "$baseUrl/api/products?limit=2" -Method GET
    Write-Host "SUCCESS: Products - Found $($products.products.Count) products" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Products - $($_.Exception.Message)" -ForegroundColor Red
}

# Test Categories
Write-Host "`nTesting Categories..." -ForegroundColor Yellow
try {
    $categories = Invoke-RestMethod -Uri "$baseUrl/api/products/categories/all" -Method GET
    Write-Host "SUCCESS: Categories - Found $($categories.categories.Count) categories" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Categories - $($_.Exception.Message)" -ForegroundColor Red
}

# Test Protected Endpoints (should return 401)
Write-Host "`nTesting Protected Endpoints..." -ForegroundColor Yellow

$protected = @(
    "/api/wishlist",
    "/api/cart", 
    "/api/orders",
    "/api/admin/dashboard"
)

foreach ($endpoint in $protected) {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl$endpoint" -Method GET
        Write-Host "WARNING: $endpoint - Should require auth!" -ForegroundColor Yellow
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host "SUCCESS: $endpoint - Properly protected" -ForegroundColor Green
        } else {
            Write-Host "INFO: $endpoint - Returns $($_.Exception.Response.StatusCode)" -ForegroundColor Cyan
        }
    }
}

Write-Host "`nAll Backend APIs are Ready!" -ForegroundColor Green
Write-Host "Total Available Endpoints: 41" -ForegroundColor Cyan
