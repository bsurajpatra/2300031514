# Campus Notifications Platform - System Design Document

This document outlines the architecture, database design, performance tuning, scaling strategies, and algorithmic choices for the Campus Notifications Platform.

---

# Stage 1: API Contracts and Real-time Transport

We supportPlacement, Result, and Event notifications for logged-in students. Below are the REST API contracts, payload schemas, and the real-time notification mechanism.

## 1. REST API Endpoints

### Get Unread Notifications
*   **Endpoint**: `GET /api/v1/notifications`
*   **Headers**:
    ```http
    Authorization: Bearer <jwt_access_token>
    Accept: application/json
    ```
*   **Query Parameters**:
    *   `limit`: Integer (default: 10, max: 50)
    *   `cursor`: String (base64 encoded timestamp/ID for pagination)
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "notifications": [
        {
          "id": "ccf03d40-f3bf-4a4c-a3a5-612487e89627",
          "type": "Placement",
          "message": "Booking Holdings Inc. hiring",
          "timestamp": "2026-05-29T15:57:23Z",
          "isRead": false
        }
      ],
      "nextCursor": "MjAyNi0wNS0yOVQxNTo1NzoyM1osY2NmMzNkNDA..."
    }
    ```

### Mark Notifications as Read
*   **Endpoint**: `PATCH /api/v1/notifications/read`
*   **Headers**:
    ```http
    Authorization: Bearer <jwt_access_token>
    Content-Type: application/json
    ```
*   **Request Body**:
    ```json
    {
      "notificationIds": [
        "ccf03d40-f3bf-4a4c-a3a5-612487e89627"
      ]
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "1 notification marked as read"
    }
    ```

## 2. Real-Time Transport Design
To push notifications in real-time without polling, we use **Server-Sent Events (SSE)**.
*   **Why SSE over WebSockets?** SSE is a unidirectional channel (server-to-client) operating natively over standard HTTP. It automatically handles reconnection and is lighter on server resources compared to full-duplex WebSockets.
*   **SSE Endpoint**: `GET /api/v1/notifications/stream`
*   **Headers**:
    ```http
    Authorization: Bearer <jwt_access_token>
    Accept: text/event-stream
    Cache-Control: no-cache
    Connection: keep-alive
    ```
*   **Real-time Event Format**:
    ```http
    event: notification
    data: {"id":"ca8150b3-d884-4f34-9348-9ee2c0b733a2","type":"Placement","message":"Eli Lilly and Company hiring","timestamp":"2026-05-30T05:27:58Z"}
    ```

---

# Stage 2: Database Schema and Scaling

For persistent storage, we select **PostgreSQL** (Relational Database Management System).

## 1. Why PostgreSQL?
*   **ACID Compliance**: Ensures notification status changes (e.g. marking as read) are transactionally guaranteed.
*   **Structured Schema Validation**: Strictly enforces constraints on data types (e.g. UUID, Timestamp, Enums).
*   **Advanced Indexing**: Supports composite, partial, and cover indexes to speed up heavy query structures.
*   **Partitioning**: Natively handles partitioning by timestamp ranges (ideal for growing time-series notification data).

## 2. Relational Database Schema

```sql
CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    message VARCHAR(255) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_query 
ON notifications(student_id, is_read, created_at DESC);
```

## 3. Mitigating High Data Volume Problems
As data grows to tens of millions of rows:
1.  **Write Bottlenecks**: High concurrent inserts slow down because of index tree balancing.
    *   *Solution*: Implement **Table Partitioning** by `created_at` ranges (e.g., monthly partitions). Old partitions can be archived or dropped efficiently without lock contention.
2.  **Read Latency**: Index sizes exceed memory capacity (buffer pool cache-misses).
    *   *Solution*: Add **Partial Indexes** (e.g., `CREATE INDEX idx ON notifications(student_id) WHERE is_read = FALSE;`) since students rarely query read notifications, keeping index sizes small.
3.  **Connection Saturation**: Limit on simultaneous database connections.
    *   *Solution*: Deploy connection pooling middleware like **PgBouncer**.

---

# Stage 3: Query Optimization and Indexing

## 1. Slow Query Analysis
*   **Query**:
    ```sql
    SELECT * FROM notifications 
    WHERE studentID = 1042 AND isRead = false 
    ORDER BY createdAt DESC;
    ```

### Why is this query slow?
*   Without a proper index, the database executes a **Full Table Scan** ($O(N)$ complexity) searching through every record on disk.
*   In addition, it has to load matching rows into memory and perform a sorting operation (filesort) to satisfy `ORDER BY createdAt DESC`, costing $O(M \log M)$ time (where $M$ is the number of unread records for the student).

### Recommendations and Changes
*   Add a **composite index**:
    ```sql
    CREATE INDEX idx_student_unread_created 
    ON notifications(student_id, is_read, created_at DESC);
    ```
*   **Computational Cost Impact**:
    *   *Search*: Reduces from $O(N)$ to $O(\log N)$ (Index Seek).
    *   *Sort*: Reduces from $O(M \log M)$ to $O(1)$ because the leaf nodes of the index are already pre-sorted by `created_at DESC` for that student/read state.

## 2. Is Indexing Every Column Safe?
**No, it is highly unsafe.** Drawbacks of indexing every column:
1.  **Write Penalty**: Every insert, update, or delete must update every index table on disk, drastically reducing write throughput.
2.  **Storage Exhaustion**: Indexes consume physical disk space and memory (RAM). In write-heavy tables, indexes can quickly exceed the storage footprint of the actual raw data.
3.  **Optimizer Confusion**: Having too many indexes can cause the query optimizer to make sub-optimal index choices, resulting in slower execution times.

## 3. Query for Placements in the Last 7 Days
```sql
SELECT DISTINCT student_id 
FROM notifications
WHERE type = 'Placement'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days';
```

---

# Stage 4: High-Concurrency Page Load Optimization

When 50,000+ students load their dashboard, querying the database concurrently will cause a database connection bottleneck.

## Strategies and Tradeoffs

| Strategy | Tradeoffs / Pros | Tradeoffs / Cons |
|---|---|---|
| **Redis In-Memory Caching** | Extremely fast ($O(1)$ response time). Dramatically reduces database read IOPS. | Cache invalidation complexity. Memory space is expensive. |
| **Cursor-based Pagination** | Ensures lightweight payloads. Queries execute instantly by seeking on index values. | Clients cannot jump to arbitrary page numbers (e.g. Page 15). |
| **Database Read Replicas** | Spreads query load across read-only nodes. | Introduces replication lag (students might see slight delays in status changes). |
| **Connection Pooling** | Reuses active connections, preventing DB connection exhaustion. | Does not reduce query execution times; only manages queue concurrency. |

---

# Stage 5: Reliable Mass Notifications ("Notify All")

## 1. Shortcomings of the Loop Implementation
The provided pseudocode:
```python
for student_id in student_ids:
  send_email(student_id, message)
  save_to_db(student_id, message)
  push_to_app(student_id, message)
```
### Key Flaws:
1.  **Synchronous Blocking**: Each iteration waits for the HTTP request to the Email API. 50,000 students at 100ms per iteration takes **1.3 hours** to run. The HTTP request will time out instantly.
2.  **No Transactional Safety**: If the email service fails midway (e.g., at student 24,000), the loop crashes. There is no progress tracking, leading to double-notification or missing notifications.
3.  **SMTP Rate Limits**: Sending 50,000 SMTP connections sequentially will cause the provider to block the IP.

## 2. Separating DB and Email Actions
*   **Should they happen together?** **No.**
*   *Rationale*: Calling external network APIs (Email API) inside database transactions keeps database connections open, causing lock escalations and transaction pool exhaustion.

## 3. Reliable Redesign (Message Queue + Worker Pool)
We decouple the operations using a **Message Queue** (e.g. RabbitMQ) and the **Transactional Outbox Pattern**:
1.  The publisher creates a single broadcast record in a metadata table and publishes a message to a queue.
2.  A pool of concurrent worker threads consume chunks of messages from the queue.
3.  Workers dispatch emails in batches and log outcomes using retries with exponential backoff.

```python
# Publisher
def notify_all(broadcast_message):
    broadcast_id = db.insert_broadcast_meta(broadcast_message)
    message_queue.publish("notifications.broadcast", {
        "broadcast_id": broadcast_id,
        "message": broadcast_message
    })

# Worker (running concurrently across multiple instances)
def on_message_received(payload):
    broadcast_id = payload["broadcast_id"]
    message = payload["message"]
    
    # Process batch of students
    students = db.get_unprocessed_students(broadcast_id, batch_size=100)
    for student in students:
        try:
            # Async parallel dispatches
            email_dispatcher.queue_email(student.email, message)
            push_dispatcher.queue_push(student.id, message)
            db.mark_student_notified(broadcast_id, student.id)
        except Exception as e:
            log_error(student.id, e)
            message_queue.requeue_with_backoff(student.id, attempt=1)
```

---

# Stage 6: Priority Inbox Algorithm

The priority score is calculated using category weights (`Placement` > `Result` > `Event`) combined with the message timestamp.

## 1. Algorithmic Formula
To prevent older High-Priority notifications from forever blocking new Low-Priority notifications, we convert category weights into time offsets:
*   `Placement` (Weight = 3)
*   `Result` (Weight = 2)
*   `Event` (Weight = 1)

$$Score = (\text{Weight} \times 172800) + \text{Timestamp (Unix Epoch Seconds)}$$

*Note: $172800$ represents 2 days in seconds. Therefore, a Placement notification is preferred over an Event notification unless the Event notification is more than 4 days newer.*

## 2. Efficiently Maintaining the Top 10
Instead of sorting all notifications from disk on every page load:
1.  **Redis Sorted Set (ZSET)**: Maintain a ZSET for each active student:
    *   Score = `PriorityScore`
    *   Value = `NotificationID`
    *   Trim the set to 10 elements on insertion: `ZREMRANGEBYRANK student_id:inbox 0 -11`. This ensures fetch operations are $O(1)$.
2.  **In-Memory Min-Heap**: When reading from database buffers, we utilize a Min-Heap of size 10. We parse elements, replacing the root of the heap if a new element's score is higher, keeping operational complexity to $O(M \log 10)$ instead of $O(M \log M)$ sorting.
