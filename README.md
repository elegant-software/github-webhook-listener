# Project Item Status Webhook

Webhook receiver that accepts GitHub `projects_v2_item` events and forwards project status changes as repository dispatch events.

## What It Does

- Exposes `POST /webhook` for incoming GitHub webhook deliveries.
- Exposes `GET /health` for a simple health check.
- Accepts GitHub `projects_v2_item` events only.
- Extracts the target repository, issue number, and project status from the webhook payload.
- Resolves issue details from `content_node_id` when the payload does not include direct repository or issue routing data.
- Sends a repository dispatch event to the resolved target repository.

## Dispatch Payload

Outgoing repository dispatch events use:

- Event type: `project_status_change` by default
- Client payload fields:
  - `issue_number`
  - `project_status`
  - `target_repo`

## Configuration

Environment variables:

- `PORT`: HTTP port, default `3000`
- `GITHUB_EVENT_TYPE`: repository dispatch event type, default `project_status_change`
- `GH_BIN`: GitHub CLI binary path, default `gh`

## Local Development

Start the service:

```bash
npm start
```

Run tests:

```bash
npm test
```

## Request Handling Rules

- `GET /health` returns `200` with `{ "status": "ok" }`
- Requests other than `POST /webhook` return `404`
- Non-`projects_v2_item` webhook events are ignored
- Project item events without a status change are ignored
- Events missing required routing data are rejected
- Valid status change events are forwarded and return `202`

## Logging And Debugging

The server writes logs to standard output and error through the runtime logger.

Current log points:

- `Incoming request`: emitted for every request before route matching
- `Health check served`: emitted for `GET /health`
- `Request not matched`: emitted for unsupported paths or methods
- `Webhook received`: emitted after a valid JSON body is parsed
- `Webhook ignored`: emitted when the event is not actionable
- `Webhook rejected`: emitted when required data is missing
- `Resolving issue from content_node_id`: emitted before GitHub issue lookup
- `Dispatching repository event`: emitted before repository dispatch
- `Webhook forwarded`: emitted after a successful dispatch
- `Webhook forwarding failed` / `Webhook issue resolution failed`: emitted on failures

If you do not see logs:

- Confirm the Node process is running in the foreground or that your process manager captures stdout/stderr.
- Confirm requests are actually reaching this service instance.
- Check whether you are hitting `/health`, `/webhook`, or a different path.
- Check whether the request body is valid JSON.
- Check whether the `x-github-event` header is set to `projects_v2_item`.

## Project Structure

- [src/index.js](/Users/mehdi/MyProject/project-item-status-webhook/src/index.js): process entrypoint
- [src/server.js](/Users/mehdi/MyProject/project-item-status-webhook/src/server.js): HTTP server and request handling
- [src/extractors.js](/Users/mehdi/MyProject/project-item-status-webhook/src/extractors.js): webhook classification and field extraction
- [src/dispatch.js](/Users/mehdi/MyProject/project-item-status-webhook/src/dispatch.js): GitHub CLI dispatch and issue resolution
- [test/server.test.js](/Users/mehdi/MyProject/project-item-status-webhook/test/server.test.js): request handling tests
