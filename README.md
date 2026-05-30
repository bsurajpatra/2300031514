# Vehicle Maintenance Scheduler & Log Observability System

This repository contains the backend codebase for the centralized logging middleware and the vehicle maintenance scheduling microservice.

---

## Project Structure

*   `logging_middleware/` - Core reusable package managing dynamic token retrieval, log request formatting, and Express request integration.
*   `vehicle_scheduling/` / `vehicle_maintence_scheduler/` - Optimization microservices utilizing the 0-1 Knapsack Dynamic Programming algorithm to schedule vehicle repairs within mechanic budgets.
*   `notification_app_be/` - Backend service templates demonstrating multi-tier database, cache, and service log integration.
*   `notification_system_design.md` - System architecture specification document for high-throughput alerts.
*   `.env` - Local environment variables for service endpoints and access credentials.

---

## Configuration

Create a `.env` file in the root directory to store connection settings and credentials.

```env
LOG_API_URL=http://<your-api-domain>/evaluation-service/logs
LOG_AUTH_URL=http://<your-api-domain>/evaluation-service/auth
LOG_EMAIL=your_email@domain.com
LOG_NAME=your_name
LOG_ROLL_NO=your_roll_number
LOG_ACCESS_CODE=your_access_code
LOG_CLIENT_ID=your_client_id
LOG_CLIENT_SECRET=your_client_secret
```

---

## How to Run

Ensure Node.js (v20+) is installed before executing the commands.

### 1. Run the Optimization Scheduler API Server
This starts the Express server listening on port `5001`.

```bash
node --env-file=.env vehicle_scheduling/scheduler.js
node --env-file=.env vehicle_maintence_scheduler/scheduler.js
```

You can now use Postman, Insomnia, or curl to send requests to the API endpoints and retrieve the Knapsack-optimized results:
* **Endpoint:** `POST http://localhost:5001/api/schedule` (or `GET`)
* **Response:** A JSON payload containing the optimal subset of vehicles scheduled for each depot.

### 2. Verify Logging Middleware
This executes validation checks (stack, level, package) and makes a secure POST request to the remote log server.

```bash
node --env-file=.env logging_middleware/test_logging.js
```

### 3. Start the Express Server
This runs the local development server (listening on port `3000` by default).

```bash
node logging_middleware/server.js
```
