import { NextResponse } from "next/server";

const spec = {
  openapi: "3.1.0",
  info: { title: "Apotho Dashboard API", version: "1.0.0", description: "Full CRUD API for the Apotho Dashboard. Authenticate with a Bearer API key." },
  servers: [{ url: "/", description: "Current server" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "API key: Authorization: Bearer ak_..." } },
  },
  paths: {
    "/api/v1/businesses": {
      get: { tags: ["Businesses"], summary: "List businesses visible to the authenticated user", responses: { "200": { description: "List of businesses" } } },
    },
    "/api/v1/rocks": {
      get: { tags: ["Rocks"], summary: "List rocks", parameters: [
        { name: "businessId", in: "query", schema: { type: "string" } },
        { name: "quarter", in: "query", schema: { type: "integer" } },
        { name: "year", in: "query", schema: { type: "integer" } },
      ], responses: { "200": { description: "List of rocks" } } },
      post: { tags: ["Rocks"], summary: "Create rock", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["title", "businessId", "quarter", "year"], properties: { title: { type: "string" }, businessId: { type: "string" }, quarter: { type: "integer" }, year: { type: "integer" }, description: { type: "string" }, ownerId: { type: "string" }, ownerIds: { type: "array", items: { type: "string" } }, integratorId: { type: "string" }, targetCompletionDate: { type: "string", format: "date" }, status: { type: "string", enum: ["not-started", "in-progress", "at-risk", "complete"] } } } } } }, responses: { "201": { description: "Created" } } },
    },
    "/api/v1/rocks/{id}": {
      get: { tags: ["Rocks"], summary: "Get rock detail", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Rock with todos, milestones, notes" } } },
      patch: { tags: ["Rocks"], summary: "Update rock", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Rocks"], summary: "Delete rock", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/api/v1/rocks/{id}/milestones": {
      get: { tags: ["Milestones"], summary: "List milestones for a rock", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "List of milestones" } } },
      post: { tags: ["Milestones"], summary: "Create milestone", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["title", "startDate", "endDate"], properties: { title: { type: "string" }, startDate: { type: "string", format: "date" }, endDate: { type: "string", format: "date" }, ownerId: { type: "string" } } } } } }, responses: { "201": { description: "Created" } } },
    },
    "/api/v1/rocks/{id}/milestones/{mid}": {
      patch: { tags: ["Milestones"], summary: "Update milestone", responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Milestones"], summary: "Delete milestone", responses: { "200": { description: "Deleted" } } },
    },
    "/api/v1/todos": {
      get: { tags: ["Todos"], summary: "List todos", parameters: [
        { name: "businessId", in: "query", schema: { type: "string" } },
        { name: "rockId", in: "query", schema: { type: "string" } },
        { name: "done", in: "query", schema: { type: "string", enum: ["true", "false"] } },
        { name: "killed", in: "query", schema: { type: "string", enum: ["true", "false"] } },
      ], responses: { "200": { description: "List of todos" } } },
      post: { tags: ["Todos"], summary: "Create todo", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["title", "businessId"], properties: { title: { type: "string" }, businessId: { type: "string" }, ownerId: { type: "string" }, rockId: { type: "string" }, milestoneId: { type: "string" }, startDate: { type: "string", format: "date" }, endDate: { type: "string", format: "date" } } } } } }, responses: { "201": { description: "Created" } } },
    },
    "/api/v1/todos/{id}": {
      get: { tags: ["Todos"], summary: "Get todo", responses: { "200": { description: "Todo detail" } } },
      patch: { tags: ["Todos"], summary: "Update todo", requestBody: { content: { "application/json": { schema: { type: "object", properties: { title: { type: "string" }, done: { type: "boolean" }, killed: { type: "boolean" }, ownerId: { type: "string" }, rockId: { type: "string" }, milestoneId: { type: "string" }, startDate: { type: "string", format: "date" }, endDate: { type: "string", format: "date" } } } } } }, responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Todos"], summary: "Delete todo", responses: { "200": { description: "Deleted" } } },
    },
    "/api/v1/meetings": {
      get: { tags: ["Meetings"], summary: "List meetings", parameters: [{ name: "businessId", in: "query", schema: { type: "string" } }], responses: { "200": { description: "List of meetings" } } },
      post: { tags: ["Meetings"], summary: "Start a meeting", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["businessId"], properties: { businessId: { type: "string" } } } } } }, responses: { "201": { description: "Meeting started" } } },
    },
    "/api/v1/meetings/{id}": {
      get: { tags: ["Meetings"], summary: "Get meeting detail with segues, issues, ratings, todos", responses: { "200": { description: "Meeting detail" } } },
      patch: { tags: ["Meetings"], summary: "End meeting", requestBody: { content: { "application/json": { schema: { type: "object", properties: { end: { type: "boolean" } } } } } }, responses: { "200": { description: "Meeting ended" } } },
    },
    "/api/v1/scorecard/measurables": {
      get: { tags: ["Scorecard"], summary: "List measurables with recent entries", parameters: [{ name: "businessId", in: "query", schema: { type: "string" } }], responses: { "200": { description: "List of measurables" } } },
      post: { tags: ["Scorecard"], summary: "Create measurable", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["businessId", "name", "goal"], properties: { businessId: { type: "string" }, name: { type: "string" }, goal: { type: "string" }, unit: { type: "string" }, goalDirection: { type: "string", enum: ["gte", "lte", "gt", "lt", "eq"] } } } } } }, responses: { "201": { description: "Created" } } },
    },
    "/api/v1/scorecard/measurables/{id}": {
      patch: { tags: ["Scorecard"], summary: "Update measurable", responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Scorecard"], summary: "Delete measurable", responses: { "200": { description: "Deleted" } } },
    },
    "/api/v1/scorecard/entries": {
      post: { tags: ["Scorecard"], summary: "Upsert weekly entry", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["measurableId", "weekOf", "actual"], properties: { measurableId: { type: "string" }, weekOf: { type: "string", format: "date", description: "YYYY-MM-DD (Sunday of the week)" }, actual: { type: "string" } } } } } }, responses: { "200": { description: "Entry upserted" } } },
    },
    "/api/v1/users": {
      get: { tags: ["Users"], summary: "List users (admin only)", responses: { "200": { description: "List of users" } } },
      post: { tags: ["Users"], summary: "Create user (admin only)", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "email"], properties: { name: { type: "string" }, email: { type: "string" }, role: { type: "string", enum: ["integrator", "visionary", "member"] } } } } } }, responses: { "201": { description: "Created with temp password" } } },
    },
    "/api/v1/users/{id}": {
      patch: { tags: ["Users"], summary: "Update user role (admin only)", responses: { "200": { description: "Updated" } } },
    },
    "/api/v1/api-keys": {
      get: { tags: ["API Keys"], summary: "List your API keys", responses: { "200": { description: "List of keys (prefix only)" } } },
      post: { tags: ["API Keys"], summary: "Create API key", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" } } } } } }, responses: { "201": { description: "Key created — raw key returned once" } } },
    },
    "/api/v1/api-keys/{id}": {
      delete: { tags: ["API Keys"], summary: "Revoke API key", responses: { "200": { description: "Key revoked" } } },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}
