# ChronosCraft AI API Documentation

## Calendar API

Base URL: `/calendar`

### Data Models

#### Calendar

```typescript
interface Calendar {
  id: string;
  year: number;
  selectedMonths: string[];
  events: CalendarEvent[];
  backgroundUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface CalendarEvent {
  date: string;
  title: string;
}
```

#### Google Calendar Integration

```typescript
interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}
```

### Endpoints

#### GET /calendar

Returns all calendars and available months.

**Query Parameters:**

- `id` (optional): Get a specific calendar by ID

**Response:**

- Without ID:
  ```json
  {
    "calendars": Calendar[],
    "months": string[]
  }
  ```
- With ID:
  ```json
  Calendar
  ```

**Status Codes:**

- 200: Success
- 404: Calendar not found (when using ID)

#### POST /calendar

Create a new calendar.

**Request Body:**

```json
{
  "year": number,
  "selectedMonths": string[],
  "events"?: CalendarEvent[],
  "backgroundUrl"?: string
}
```

**Response:**

```json
Calendar
```

**Status Codes:**

- 201: Created
- 400: Bad Request (missing required fields)

#### PUT /calendar/:id

Update an existing calendar.

**URL Parameters:**

- `id`: Calendar ID

**Request Body:**

```json
{
  "year"?: number,
  "selectedMonths"?: string[],
  "events"?: CalendarEvent[],
  "backgroundUrl"?: string
}
```

**Response:**

```json
Calendar
```

**Status Codes:**

- 200: Success
- 404: Calendar not found

#### DELETE /calendar/:id

Delete a calendar.

**URL Parameters:**

- `id`: Calendar ID

**Response:** None

**Status Codes:**

- 204: No Content
- 404: Calendar not found

### Google Calendar Integration Endpoints

#### GET /calendar/google/auth

Initiates the OAuth flow for Google Calendar integration.

**Response:**

```json
{
  "url": string  // Google OAuth authorization URL
}
```

#### GET /calendar/google/callback

Handles the OAuth callback from Google.

**Query Parameters:**

- `code`: OAuth authorization code
- `state`: State parameter for security validation

**Response:**

```json
{
  "token": string  // Access token for future requests
}
```

#### GET /calendar/google/events

Lists events from the user's Google Calendar.

**Headers:**

- `Authorization`: Bearer token received from callback

**Query Parameters:**

- `timeMin` (optional): Start time (ISO string)
- `timeMax` (optional): End time (ISO string)

**Response:**

```json
{
  "events": GoogleCalendarEvent[]
}
```

#### POST /calendar/google/import

Imports events from Google Calendar into ChronosCraft.

**Headers:**

- `Authorization`: Bearer token received from callback

**Request Body:**

```json
{
  "events": GoogleCalendarEvent[]
}
```

**Response:**

```json
{
  "success": boolean,
  "importedCount": number
}
```

### Error Responses

All error responses follow this format:

```json
{
  "message": string
}
```

### Test Coverage

The API has comprehensive test coverage:

- Statements: 100%
- Branches: 84.21%
- Functions: 100%
- Lines: 100%

Tests include both success and error cases for all endpoints.

## Project Save/Load API

Base URL: `/projects`

### Test Coverage

The Project Management API has excellent test coverage:

- Statements: 90.9%
- Branches: 62.5%
- Functions: 85.71%
- Lines: 90.9%

Tests include:

- Project creation with validation
- Project retrieval and listing
- Project updates (full and partial)
- Project deletion with cascade
- Error handling for all endpoints
- Edge cases and input validation

### Data Models

#### Project (Calendar)

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  year: number;
  selectedMonths: string[];
  settings?: object;
  backgroundUrl?: string;
  events: CalendarEvent[];
  createdAt: string;
  updatedAt: string;
}
```

### Endpoints

#### POST /projects

Create a new project.

**Request Body:**

```json
{
  "name": "Summer 2025 Calendar",
  "description": "Family vacation planning",
  "year": 2025,
  "selectedMonths": ["June", "July", "August"],
  "settings": {
    "theme": { "colors": ["#FF5733", "#33FF57"], "layout": "grid" }
  },
  "backgroundUrl": "https://..."
}
```

**Response:**

```json
Project
```

**Status Codes:**

- 201: Created
- 400: Bad Request (missing required fields)

#### GET /projects

List all projects.

**Response:**

```json
Project[]
```

**Status Codes:**

- 200: Success

#### GET /projects/:id

Get a project by ID.

**Response:**

```json
Project
```

**Status Codes:**

- 200: Success
- 404: Not Found

#### PUT /projects/:id

Update a project.

**Request Body:**

```json
{
  "name": "Updated Name",
  "settings": {
    "theme": { "colors": ["#000000"] }
  }
}
```

**Response:**

```json
Project
```

**Status Codes:**

- 200: Success
- 404: Not Found

#### DELETE /projects/:id

Delete a project.

**Status Codes:**

- 204: Deleted
- 404: Not Found

### Validation Implementation Status

- POST /projects

  - ✅ All required fields (name, year, selectedMonths)
  - ✅ Data type validation
  - ✅ Error response format

- PUT /projects/:id

  - ✅ Partial update support
  - ✅ Field validation
  - ✅ Error handling
  - ✅ Settings object merging

- DELETE /projects/:id
  - ✅ Project existence check
  - ✅ 404 handling
  - ✅ Cascade delete for events
  - ✅ Database integrity verification

### Error Handling

All error responses follow this format:

```json
{
  "error": "Error message"
}
```

Common error cases:

- Missing required fields
- Invalid data types
- Resource not found
- Database operation failures
