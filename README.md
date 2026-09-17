# Kanban Flow — Task Management Application

A full-stack Kanban board built with Node.js, Express, PostgreSQL, and Vanilla JavaScript. Features drag-and-drop task management, relational project/user data, and real-time burnout detection.

---

## Tech Stack

- **Backend**: Node.js, Express, PostgreSQL (pg)
- **Frontend**: Vanilla JavaScript, Vanilla CSS (no frameworks)
- **Font**: Google Fonts (Inter)

---

## Features

- **Kanban Board** — Three columns (To-Do, In Progress, Done) with drag-and-drop using native HTML5 API
- **Task Cards** — Priority tags (Urgent/High/Medium/Low), due dates, assignee avatars
- **CRUD Operations** — Create, edit, and delete tasks via REST API
- **Filters** — Filter by priority, assignee, or search keyword
- **Team Management** — Add users to projects with permission roles (Owner/Admin/Member/Viewer)
- **Project Switching** — Multiple projects with separate task boards

### Workload Balancing (Burnout Detection)

If any team member has more than 5 tasks in "In Progress", their avatar pulses red as a burnout warning. This recalculates live on every task move. The seed data includes one user (Alex Mercer) with 6 in-progress tasks to demonstrate this on first load.

---

## Database Schema

Four tables with relational constraints:

- **projects** — id, name, description, color
- **users** — id, name, email, avatar_url, role
- **project_members** — project_id (FK), user_id (FK), role (junction table)
- **tasks** — id, project_id (FK), user_id (FK), title, description, priority, status, position, due_date

Key relationships: projects -> tasks (one-to-many), users -> tasks (assignee, one-to-many), projects <-> users (many-to-many via project_members).

---

## API Endpoints

| Method | Endpoint                     | Purpose                        |
|--------|------------------------------|--------------------------------|
| GET    | /api/projects                | List projects                  |
| POST   | /api/projects                | Create project                 |
| GET    | /api/projects/:id            | Project details with members   |
| POST   | /api/projects/:id/members    | Add user to project            |
| GET    | /api/users                   | List users with burnout flag   |
| POST   | /api/users                   | Create user                    |
| GET    | /api/tasks                   | List tasks (filterable)        |
| POST   | /api/tasks                   | Create task                    |
| PUT    | /api/tasks/:id               | Update task                    |
| PATCH  | /api/tasks/:id/status        | Drag-and-drop status change    |
| DELETE | /api/tasks/:id               | Delete task                    |
| GET    | /api/workload                | Column counts + burnout alerts |

---

## How to Run

```bash
npm install
psql -d postgres -c "CREATE DATABASE kanban_flow;"
npm run db:init
npm run dev
```

Open http://localhost:3000

---

## Project Structure

```
server/
  index.js          — Express server entry point
  db.js             — PostgreSQL connection pool
  schema.sql        — Table definitions
  seed.sql          — Demo data (4 users, 15 tasks)
  routes/api.js     — All API route handlers

public/
  index.html        — Page structure and modals
  styles.css        — Design system and animations
  app.js            — State management, rendering, drag-and-drop
```
