# Campus Notifications Platform - System Design

## 1. API Contracts & Real-Time Communication

### APIs
- `GET /notifications` → Fetch all notifications for a student.
- `PATCH /notifications/read` → Mark notifications as read.

### Real-Time Updates
- Uses **Server-Sent Events (SSE)**.
- Enables real-time notification delivery from the server to the frontend.
- Chosen over WebSockets since only one-way communication (Server → Client) is required.

---

## 2. Database Design & Scaling

### Database
- **PostgreSQL**
- Chosen for:
  - ACID compliance
  - Structured relational data
  - Strong indexing support

### Tables

#### Students
```sql
id, name, email
```

#### Notifications
```sql
id, student_id, type, message, is_read, created_at
```

### Relationship
- One Student → Many Notifications (1:N)

### Indexing
```sql
(student_id, is_read, created_at DESC)
```

Used for faster notification retrieval.

### Scaling Challenges

#### Too Many Rows
As notification records grow into millions:

**Solution:** Monthly table partitioning.

#### Too Many Connections
Large numbers of concurrent users can exhaust database connections.

**Solution:** PgBouncer connection pooling.

---

## 3. Query Optimization

### Composite Index

```sql
CREATE INDEX idx_notifications
ON notifications(student_id, is_read, created_at DESC);
```

Benefits:
- Faster filtering by student.
- Faster unread notification lookup.
- Avoids expensive sorting operations.

### Why Not Index Every Column?
- Increased storage usage.
- Slower inserts and updates because every index must be maintained.

---

## 4. Handling 50,000 Dashboard Loads

### Redis Caching
- Stores frequently accessed notifications in memory.
- Reduces database read load significantly.

### Pagination
- Loads notifications in smaller batches.
- Prevents large payload transfers.

### Read Replicas

```text
           Primary DB
               |
      -------------------
      |                 |
   Replica 1       Replica 2
```

- Primary database handles writes.
- Replicas handle read requests.
- Distributes read traffic across multiple servers.

---

## 5. Notify All Students

### Problem
Sending notifications sequentially to 50,000 students can:
- Cause request timeouts.
- Be extremely slow.

### Solution: Message Queue

Technologies:
- RabbitMQ
- Kafka

Flow:

```text
Admin
  ↓
Message Queue
  ↓
Workers
  ↓
Students
```

Workers process notifications asynchronously and in parallel.

---

## 6. Priority Inbox

### Priority Weights

| Type | Weight |
|--------|--------|
| Placement | 3 |
| Result | 2 |
| Event | 1 |

### Priority Score

```text
Score = (Weight × 172800) + Timestamp
```

This gives higher-priority notifications a time boost while still allowing newer notifications to surface.

### Maintaining Top 10 Notifications

#### Min Heap
- Maintain an in-memory Min Heap of size 10.
- Efficiently keeps only the highest-priority notifications.

Complexity:

```text
O(M log 10)
```

instead of sorting all notifications.