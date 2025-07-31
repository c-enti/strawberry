# Project Management API Test Documentation

This document describes the intent, scenarios, and expected outcomes for the tests in `projectManagement.test.ts`.

## POST /projects

### Should create a new project with valid data

- **Scenario:** Send a valid project payload.
- **Expected:** 201 Created, response contains project data and DB is updated.

### Should return 400 when required fields are missing

- **Scenario:** Omit required fields (name, year, selectedMonths) in various combinations.
- **Expected:** 400 Bad Request, error message for missing fields, no project created.

## GET /projects/:id

### Should get a project by ID

- **Scenario:** Create a project, then fetch it by ID.
- **Expected:** 200 OK, response matches created project.

### Should return 404 when project doesn't exist

- **Scenario:** Fetch a non-existent project ID.
- **Expected:** 404 Not Found, error message.

## GET /projects

### Should list all projects

- **Scenario:** Create multiple projects, then list all.
- **Expected:** 200 OK, array of projects in correct order.

### Should return empty array when no projects exist

- **Scenario:** List projects when DB is empty.
- **Expected:** 200 OK, empty array.

## PUT /projects/:id

### Should update an existing project

- **Scenario:** Create a project, then update fields.
- **Expected:** 200 OK, response and DB reflect updates.

### Should handle partial updates

- **Scenario:** Update only one field (e.g., name).
- **Expected:** 200 OK, only that field is changed.

### Should return 404 when updating non-existent project

- **Scenario:** Update a non-existent project ID.
- **Expected:** 404 Not Found, error message.

## DELETE /projects/:id

### Should delete an existing project

- **Scenario:** Create and then delete a project.
- **Expected:** 204 No Content, project is removed from DB.

### Should return 404 when deleting non-existent project

- **Scenario:** Delete a non-existent project ID.
- **Expected:** 404 Not Found, error message.

### Should delete project and its related events

- **Scenario:** Create a project with events, then delete it.
- **Expected:** 204 No Content, project and events are removed from DB.
