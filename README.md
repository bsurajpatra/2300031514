# Campus Notifications, Scheduler & Log Observability System

This repository contains the backend codebase, optimization algorithms, and architectural specifications for the unified campus services platform.

---

## Project Structure

*   `logging_middleware/` - Core reusable package managing dynamic bearer token retrieval, parameter validation, automatic message truncation, and Express logging middleware integration.
*   `vehicle_scheduling/` & `vehicle_maintence_scheduler/` - Optimization microservices utilizing a 0-1 Knapsack Dynamic Programming algorithm to schedule vehicle repairs within mechanic hourly budgets. Exposes API endpoints on port `5001`.
*   `notification_app_be/` - Backend notifications service implementing the priority inbox engine (`priority_inbox.js`) with dynamic ranking logic.
*   `notification_system_design.md` - System architecture specification document for high-throughput, low-latency campus notifications (Stages 1-6).
*   `.env` - Local environment variables for evaluation endpoints and access credentials.

---

## Configuration

Create a `.env` file in the root directory to store connection settings and credentials.

```env
LOG_API_URL=http://<evaluator-api-domain>/evaluation-service/logs
LOG_AUTH_URL=http://<evaluator-api-domain>/evaluation-service/auth
LOG_EMAIL=your_email@domain.com
LOG_NAME=your_name
LOG_ROLL_NO=your_roll_number
LOG_ACCESS_CODE=your_access_code
LOG_CLIENT_ID=your_client_id
LOG_CLIENT_SECRET=your_client_secret
```

---

## How to Run

Ensure Node.js (v20+) is installed before executing commands.

### 1. Run the Vehicle Maintenance Scheduler API
This starts the Express server listening on port `5001`.

```bash
node --env-file=.env vehicle_scheduling/scheduler.js
```
*(Note: Code is identical in `vehicle_maintence_scheduler/scheduler.js` to ensure support for both folder structure specifications).*

#### Verify the Scheduler Endpoint:
Send a `GET` or `POST` request to the scheduler endpoint to optimize vehicle repair operations:
*   **Endpoint:** `http://localhost:5001/api/schedule`
*   **Response Format:**
    ```json
    {
      "success": true,
      "depots": [
        {
          "depotID": 2,
          "mechanicHours": 135,
          "totalScheduledHours": 128,
          "totalOperationalImpact": 199,
          "selectedVehicles": [
            { "TaskID": "366e68a9-...", "Duration": 2, "Impact": 2 },
            ...
          ]
        }
      ]
    }
    ```

### 2. Run the Campus Notifications Priority Inbox Engine
This script fetches unread notifications, applies the priority inbox scoring algorithm ($Score = Weight \times 172800 + Timestamp$), sorts the messages, and logs execution.

```bash
node --env-file=.env notification_app_be/priority_inbox.js
```
The console will display a premium sorted dashboard of the top 10 campus notifications.

### 3. Verify Logging Middleware Integration
The logging middleware automatically authenticates and logs lifecycle events across all components to the central log server. To run the standalone Express logging service:

```bash
node logging_middleware/server.js
```

---

## Verification & Output Screenshots

Validation outputs showing local test executions are stored in:
- `vehicle_scheduling/screenshots/` (Scheduler API responses)
- `vehicle_maintence_scheduler/screenshots/` (Scheduler API responses)
- `notification_app_be/screenshots/` (Priority inbox CLI output)
