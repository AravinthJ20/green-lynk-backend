# Backend Test Cases

These tests are designed to validate the backend API and environment config before deployment.

## Test cases

1. GET `/`
   - Expect 200 response
   - Expect body `{ message: 'Green Lynk backend is running' }`

2. Environment parsing
   - `CORS_ORIGINS` should parse comma-separated origins
   - `CORS_ORIGINS` should parse JSON array origins

## Run locally

```bash
cd green-lynk-backend
npm install
npm test
```
