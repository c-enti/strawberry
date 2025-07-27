# Calendar API Validation Rules

## Calendar Creation & Updates

### Required Fields

- `name`: string (required)
- `year`: number (required)
- `selectedMonths`: string[] (at least one month required)

### Optional Fields

- `backgroundUrl`: string (optional)
- `events`: CalendarEvent[] (optional)
- `settings`: CalendarSettings (optional)

### Validation Rules

1. Year must be a valid number
2. Selected months must be from valid month names
3. Event dates must match format: YYYY-MM-DD
4. Event dates must fall within selected months
5. Event titles are required and must be strings
6. Background URL must be a valid URL format (if provided)

## Error Responses

All validation errors return 400 Bad Request with:

```json
{
  "message": "Error description",
  "details": {
    "field": "Specific error details"
  }
}
```
