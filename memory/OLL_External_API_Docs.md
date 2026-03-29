# OLL Schools External API — Documentation

**Base URL:** `https://oll-po-system.preview.emergentagent.com`

## Authentication

All requests require an API key passed in the `X-API-Key` header:

```
X-API-Key: oll_sk_ApxQPC2IjUfC6xmlqnLswSxIhsbX8JUgA4yJ7JitTMA
```

## Endpoints

### 1. GET /api/external/schools/active
Simple flat list of active/converted/renewed schools — best for maps, directories

**Query Parameters:**
- `limit` (optional): Number of results (default: 100)

### 2. GET /api/external/schools
Full paginated list with RM info, supports filtering

**Query Parameters:**
- `status` (optional): Filter by school status
- `city` (optional): Filter by city
- `limit` (optional): Number of results per page
- `offset` (optional): Pagination offset

### 3. GET /api/external/schools/{id}
Single school full detail

### 4. GET /api/external/schools/stats/summary
Count by status for dashboards

## Status Values

| Status | Description |
|--------|-------------|
| `active` | Currently active school |
| `converted` | Converted to paid |
| `renewed` | Renewed subscription |
| `demo` | Demo stage |
| `lead` | Lead stage |

## Response Example

```json
{
  "data": [
    {
      "id": "school-123",
      "school_name": "Delhi Public School",
      "location": {
        "address": "123 Main St",
        "city": "Mumbai",
        "state": "Maharashtra"
      },
      "contact": {
        "name": "Principal Name",
        "phone": "+91 9876543210",
        "email": "principal@school.com"
      }
    }
  ],
  "total": 100
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 401 | Invalid or missing API key |
| 404 | Endpoint not found |
| 500 | Server error |

## Rate Limits

Standard rate limits apply. Contact OLL for higher limits.
