#!/usr/bin/env node

/**
 * API Endpoint Verification Script
 * Tests all endpoints to ensure they're working correctly
 */

const http = require('http');
const https = require('https');

// Configuration
const CONFIG = {
  baseUrl: process.env.API_URL || 'http://localhost:3001',
  timeout: 5000,
  testUser: {
    email: `test${Date.now()}@example.com`, // Unique email for each test run
    password: 'TestPassword123',
    firstName: 'Test',
    lastName: 'User'
  }
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Helper function to make HTTP requests
function makeRequest(method, url, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: CONFIG.timeout
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = httpModule.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = responseData ? JSON.parse(responseData) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test result tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Test functions
async function testEndpoint(name, method, endpoint, expectedStatus = 200, data = null, headers = {}) {
  results.total++;
  
  try {
    console.log(`${colors.blue}Testing:${colors.reset} ${method.toUpperCase()} ${endpoint}`);
    
    const response = await makeRequest(method, `${CONFIG.baseUrl}${endpoint}`, data, headers);
    
    if (response.statusCode === expectedStatus) {
      console.log(`${colors.green}✓ PASS${colors.reset} - ${name} (${response.statusCode})`);
      results.passed++;
      return response;
    } else {
      console.log(`${colors.red}✗ FAIL${colors.reset} - ${name} (Expected: ${expectedStatus}, Got: ${response.statusCode})`);
      console.log(`  Response: ${JSON.stringify(response.data, null, 2)}`);
      results.failed++;
      results.errors.push(`${name}: Expected ${expectedStatus}, got ${response.statusCode}`);
      return null;
    }
  } catch (error) {
    console.log(`${colors.red}✗ ERROR${colors.reset} - ${name}: ${error.message}`);
    results.failed++;
    results.errors.push(`${name}: ${error.message}`);
    return null;
  }
}

// Main testing function
async function runTests() {
  console.log(`${colors.bold}${colors.blue}=== API Endpoint Verification ===${colors.reset}`);
  console.log(`Base URL: ${CONFIG.baseUrl}\n`);

  let authToken = null;
  let adminToken = null;

  // 1. Health and Info Endpoints
  console.log(`${colors.yellow}--- Health & Info Endpoints ---${colors.reset}`);
  await testEndpoint('Health Check', 'GET', '/health');
  await testEndpoint('API Info', 'GET', '/api');

  // 2. Authentication Endpoints
  console.log(`\n${colors.yellow}--- Authentication Endpoints ---${colors.reset}`);
  
  // Register test user
  const registerResponse = await testEndpoint(
    'User Registration', 
    'POST', 
    '/api/auth/register',
    201,
    CONFIG.testUser
  );
  
  if (registerResponse) {
    authToken = registerResponse.data.token;
  }

  // Login test user
  const loginResponse = await testEndpoint(
    'User Login', 
    'POST', 
    '/api/auth/login',
    200,
    {
      email: CONFIG.testUser.email,
      password: CONFIG.testUser.password
    }
  );
  
  if (loginResponse && !authToken) {
    authToken = loginResponse.data.token;
  }

  // Get current user (requires auth)
  if (authToken) {
    await testEndpoint(
      'Get Current User', 
      'GET', 
      '/api/auth/me',
      200,
      null,
      { 'Authorization': `Bearer ${authToken}` }
    );
  }

  // 3. Product Endpoints
  console.log(`\n${colors.yellow}--- Product Endpoints ---${colors.reset}`);
  await testEndpoint('Get All Products', 'GET', '/api/products');
  await testEndpoint('Get Products with Filters', 'GET', '/api/products?category=dumbbells&page=1&limit=5');
  await testEndpoint('Get All Categories', 'GET', '/api/products/categories/all');

  // Get a product ID for further tests
  const productsResponse = await makeRequest('GET', `${CONFIG.baseUrl}/api/products?limit=1`);
  let productId = null;
  if (productsResponse.data && productsResponse.data.products && productsResponse.data.products.length > 0) {
    productId = productsResponse.data.products[0].id;
    await testEndpoint('Get Single Product', 'GET', `/api/products/${productId}`);
    await testEndpoint('Get Related Products', 'GET', `/api/products/${productId}/related`);
  }

  // 4. Cart Endpoints (require authentication)
  if (authToken) {
    console.log(`\n${colors.yellow}--- Cart Endpoints ---${colors.reset}`);
    await testEndpoint('Get Cart', 'GET', '/api/cart', 200, null, { 'Authorization': `Bearer ${authToken}` });
    
    if (productId) {
      await testEndpoint(
        'Add to Cart', 
        'POST', 
        '/api/cart/add',
        200,
        { productId: productId, quantity: 2 },
        { 'Authorization': `Bearer ${authToken}` }
      );
    }
    
    await testEndpoint('Clear Cart', 'DELETE', '/api/cart/clear', 200, null, { 'Authorization': `Bearer ${authToken}` });
  }

  // 5. Address Endpoints (require authentication)
  if (authToken) {
    console.log(`\n${colors.yellow}--- Address Endpoints ---${colors.reset}`);
    await testEndpoint('Get Addresses', 'GET', '/api/addresses', 200, null, { 'Authorization': `Bearer ${authToken}` });
    
    const addressData = {
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      addressLine1: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      zipCode: '12345',
      country: 'USA'
    };
    
    const addressResponse = await testEndpoint(
      'Create Address', 
      'POST', 
      '/api/addresses',
      201,
      addressData,
      { 'Authorization': `Bearer ${authToken}` }
    );
    
    if (addressResponse && addressResponse.data.address) {
      const addressId = addressResponse.data.address.id;
      await testEndpoint(
        'Set Default Address', 
        'POST', 
        `/api/addresses/${addressId}/set-default`,
        200,
        {},
        { 'Authorization': `Bearer ${authToken}` }
      );
    }
  }

  // 6. Order Endpoints (require authentication)
  if (authToken) {
    console.log(`\n${colors.yellow}--- Order Endpoints ---${colors.reset}`);
    await testEndpoint('Get Orders', 'GET', '/api/orders', 200, null, { 'Authorization': `Bearer ${authToken}` });
  }

  // 7. Analytics Endpoints (require authentication)
  if (authToken) {
    console.log(`\n${colors.yellow}--- Analytics Endpoints ---${colors.reset}`);
    await testEndpoint('Analytics Overview', 'GET', '/api/analytics/overview', 200, null, { 'Authorization': `Bearer ${authToken}` });
    await testEndpoint('Payment Analytics', 'GET', '/api/analytics/payments', 200, null, { 'Authorization': `Bearer ${authToken}` });
    await testEndpoint('Product Analytics', 'GET', '/api/analytics/products', 200, null, { 'Authorization': `Bearer ${authToken}` });
    await testEndpoint('Refund Analytics', 'GET', '/api/analytics/refunds', 200, null, { 'Authorization': `Bearer ${authToken}` });
  }

  // 8. Test Unauthorized Access
  console.log(`\n${colors.yellow}--- Security Tests ---${colors.reset}`);
  await testEndpoint('Unauthorized Cart Access', 'GET', '/api/cart', 401);
  await testEndpoint('Unauthorized Admin Access', 'GET', '/api/admin/dashboard', 401);

  // 9. Test Invalid Endpoints
  console.log(`\n${colors.yellow}--- Error Handling Tests ---${colors.reset}`);
  await testEndpoint('Invalid Endpoint', 'GET', '/api/invalid-endpoint', 404);
  await testEndpoint('Invalid Product ID', 'GET', '/api/products/invalid-id', 404);

  // Results Summary
  console.log(`\n${colors.bold}${colors.blue}=== Test Results ===${colors.reset}`);
  console.log(`Total Tests: ${results.total}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  
  if (results.errors.length > 0) {
    console.log(`\n${colors.red}Errors:${colors.reset}`);
    results.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  console.log(`\n${colors.bold}Success Rate: ${successRate}%${colors.reset}`);
  
  if (results.failed === 0) {
    console.log(`\n${colors.green}${colors.bold}✓ All tests passed! API is ready for production.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bold}✗ Some tests failed. Please review the issues above.${colors.reset}`);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  runTests().catch(error => {
    console.error(`${colors.red}Test runner error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { runTests, testEndpoint };
