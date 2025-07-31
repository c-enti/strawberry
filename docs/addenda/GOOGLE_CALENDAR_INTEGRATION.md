# Google Calendar Integration Guide

## Overview

ChronosCraft AI provides seamless integration with Google Calendar, allowing users to import their existing calendar events and export generated calendars to their Google Calendar.

## Integration Flow

### 1. Authentication

The application uses OAuth 2.0 for secure authentication with Google Calendar:

1. User initiates the flow by clicking "Connect with Google Calendar"
2. Application redirects to `/calendar/google/auth`
3. User completes Google consent screen
4. Google redirects back to `/calendar/google/callback` with auth code
5. Application exchanges code for access token
6. Token is used for subsequent API calls

### 2. Fetching Events

Once authenticated, you can fetch events from the user's Google Calendar:

```typescript
// Example using the Calendar API
const response = await fetch("/calendar/google/events", {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
const { events } = await response.json();
```

### 3. Importing Events

To import events into Google Calendar:

```typescript
// Example using the Calendar API
await fetch("/calendar/google/import", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    events: [
      {
        summary: "Team Meeting",
        description: "Weekly sync",
        start: {
          dateTime: "2025-06-10T10:00:00Z",
          timeZone: "UTC",
        },
        end: {
          dateTime: "2025-06-10T11:00:00Z",
          timeZone: "UTC",
        },
      },
    ],
  }),
});
```

## Error Handling

The API uses standard HTTP status codes:

- 401: Token expired or invalid
- 403: Insufficient permissions
- 404: Resource not found
- 500: Server error

Each error response includes a descriptive message:

```json
{
  "error": "Error description here"
}
```

## Development vs Production

### Development Environment

- Uses mock implementation
- No real Google Calendar access
- Simulated OAuth flow
- Test data for events

### Production Environment (Future)

- Real Google Calendar API integration
- Secure OAuth 2.0 flow
- Token refresh handling
- Rate limiting
- Quota management

## Security Considerations

1. **Token Storage**

   - Never store tokens in localStorage
   - Use secure HTTP-only cookies
   - Implement proper token refresh

2. **Scope Management**

   - Request minimal required scopes
   - Only calendar read/write permissions
   - No unnecessary access

3. **Error Handling**
   - Never expose internal errors
   - Provide user-friendly messages
   - Log detailed errors server-side

## Testing

1. Unit Tests

   ```bash
   npm test -- googleCalendar.test.ts
   ```

2. Test Coverage (Current)

   - Statements: 97.77%
   - Branches: 92.85%
   - Functions: 100%
   - Lines: 97.77%

3. Test Scenarios Covered
   - OAuth Flow
     - Successful authorization redirect
     - Valid/invalid authorization codes
     - Error handling during auth flow
   - Event Operations
     - Listing events with valid token
     - Importing events validation
     - Authorization header parsing
   - Error Handling
     - Missing/invalid tokens
     - Malformed request data
     - Internal server errors
     - Calendar-specific errors
   - Edge Cases
     - Malformed authorization headers
     - Invalid data structures
     - Service-level exceptions

## Future Enhancements

1. Real-time sync
2. Recurring events support
3. Multiple calendar support
4. Conflict resolution
5. Batch operations
