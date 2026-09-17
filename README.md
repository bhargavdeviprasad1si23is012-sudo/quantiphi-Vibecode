# Kanban Flow — Task Management Application

A full-stack Kanban board application for personal or team productivity, built with Node.js, Express, PostgreSQL, and Vanilla JavaScript. The application features drag-and-drop task organization, relational project/user data, and a workload balancing system that detects team member burnout in real time.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Design](#database-design)
- [API Endpoints](#api-endpoints)
- [Frontend Features](#frontend-features)
- [Workload Balancing (Burnout Detection)](#workload-balancing-burnout-detection)
- [How to Run](#how-to-run)

---

## Overview

The application provides a Kanban-style board with remotel columns — To-Do, In Progress, and Done. Users can create tasks with priority levels and due dates, assign them to team members, and drag cards between columns. The backend stores all data in PostgreSQL with proper relational constraints. A workload balancing feature monitors each team member's active task count and visually warns when someone has too many tasks in progress.

--- any

## Tech Stack

| Layer      | Technology         | Role                                      |
|------------|--------------------|--------------------------------------------|
| Runtime    | Node.js 20.x      | Server-side JavaScript                     |
| Framework  | Express 4.21       | HTTP routing, middleware, static serving    |
| Database   | PostgreSQL         | Relational storage with foreign keys        |
| DB Client  | pg (node-postgres) | Connection pooling and parameterized queries|
| Frontend   | Vanilla JS + CSS   | Single-page app with no framework dependency|
| Typography | Google Fonts (Inter)| UI typeface                                |

No frontend framework (React, Vue, etc.) is used. The entire UI is built with plain JavaScript DOM manipulation and CSS custom properties.

---

## Project Structure

```
kanban-flow/
├── package.json                 # Dependencies and npm scripts
├── server/
│   ├── index.js                 # Express app entry point, static file serving
│   ├── db.js                    # PostgreSQL connection pool configuration
│   ├── db_init.js               # Runs schema.sql and seed.sql to initialize the database
│   ├── schema.sql               # CREATE TABLE statements for all four tables
│   ├── seed.sql                 # Sample data: 2 projects, 4 users, 15 tasks
│   └── routes/
│       └── api.js               # All REST API route handlers
└── public/
    ├── index.html               # HTML structure (navbar, board, modals, toasts)
    ├── styles.css               # Design system, layout, animations
    └── app.js                   # State management, rendering, drag-and-drop, API calls
```

---

## Database Design

The application uses four PostgreSQL tables with the following relationships:

```
projects (1) ──── (*) tasks (*) ──── (1) users
    |                                      |
    └──── (*) project_members (*) ─────────┘
```

### Tables

**projects** — Stores project metadata.

| Column      | Type         | Notes               |
|-------------|--------------|----------------------|
| id          | SERIAL (PK)  | Auto-increment       |
| name        | VARCHAR(150) | Required             |
| description | TEXT         |                      |
| color       | VARCHAR(30)  | Hex color for UI     |
| created_at  | TIMESTAMPTZ  | Default: now()       |

**users** — Team members who can be assigned to tasks.

| Column     | Type         | Notes                |
|------------|--------------|----------------------|
| id         | SERIAL (PK)  | Auto-increment       |
| name       | VARCHAR(100) | Required             |
| email      | VARCHAR(150) | Unique, required     |
| avatar_url | TEXT         | Profile image URL    |
| role       | VARCHAR(50)  | Job title/specialty  |
| created_at | TIMESTAMPTZ  | Default: now()       |

**project_members** — Many-to-many junction table linking users to projects with permission roles.

| Column     | Type        | Notes                              |
|------------|-------------|------------------------------------|
| id         | SERIAL (PK) | Auto-increment                    |
| project_id | INT (FK)    | References projects, CASCADE      |
| user_id    | INT (FK)    | References users, CASCADE         |
| role       | VARCHAR(50) | Owner, Admin, Member, or Viewer   |
| joined_at  | TIMESTAMPTZ | Default: now()                    |

Unique constraint on `(project_id, user_id)` prevents duplicate memberships.

**tasks** — Individual work items on the Kanban board.

| Column     | Type        | Notes                                           |
|------------|-------------|-------------------------------------------------|
| id         | SERIAL (PK) | Auto-increment                                 |
| project_id | INT (FK)    | References projects, CASCADE                   |
| user_id    | INT (FK)    | References users (assignee), SET NULL on delete |
| title      | VARCHAR(255)| Required                                        |
| description| TEXT        | Optional details                                |
| priority   | VARCHAR(20) | CHECK: low, medium, high, urgent               |
| status     | VARCHAR(20) | CHECK: todo, in_progress, done                 |
| position   | INTEGER     | Ordering within a column                        |
| due_date   | DATE        | Optional deadline                               |
| created_at | TIMESTAMPTZ | Default: now()                                  |
| updated_at | TIMESTAMPTZ | Default: now(), updated on edit                 |

Indexes exist on `project_id`, `user_id`, and `status` for query performance.

---

## API Endpoints

All routes are prefixed with `/api`. The server listens on port 3000 by default.

### Projects

| Method | Path                        | Description                              |
|--------|-----------------------------|------------------------------------------|
| GET    | /api/projects               | List all projects with member/task counts|
| POST   | /api/projects               | Create a project                         |
| GET    | /api/projects/:id           | Get project details with members list    |
| POST   | /api/projects/:id/members   | Add a user to the project                |

### Users

| Method | Path         | Description                                            |
|--------|--------------|--------------------------------------------------------|
| GET    | /api/users   | List users with task counts and burnout flag. Accepts `project_id` query param |
| POST   | /api/users   | Create a new user                                      |

### Tasks

| Method | Path                     | Description                                         |
|--------|--------------------------|-----------------------------------------------------|
| GET    | /api/tasks               | List tasks. Filters: `project_id`, `priority`, `status`, `assignee_id`, `search` |
| POST   | /api/tasks               | Create a task with auto-calculated position         |
| PUT    | /api/tasks/:id           | Update task fields (title, description, priority, status, assignee, due date) |
| PATCH  | /api/tasks/:id/status    | Update only status and position (used by drag-and-drop) |
| DELETE | /api/tasks/:id           | Delete a task                                       |

### Workload

| Method | Path            | Description                                           |
|--------|-----------------|-------------------------------------------------------|
| GET    | /api/workload   | Column counts, per-user WIP stats, burnout alerts. Accepts `project_id` query param |

The workload endpoint returns a `hasBurnoutAlert` boolean and a `burnoutUsers` array listing anyone with more than 5 in-progress tasks.

---

## Frontend Features

### Kanban Board
- Three columns (To-Do, In Progress, Done), each with a live task counter in the header.
- Tasks are rendered as cards showing priority badge, title, description snippet, due date, and assignee avatar.

### Drag-and-Drop
- Uses the native HTML5 Drag and Drop API (no library).
- On drop, the UI updates immediately (optimistic update), then sends a `PATCH` request to the server. If the request fails, the card reverts to its original column.
- Drop zones highlight with a dashed outline during hover.

### Task CRUD
- Clicking the "New Task" button opens a modal form to create a task with title, description, priority, status, assignee, and due date.
- Clicking any card opens an edit modal where all fields can be modified or the task can be deleted.

### Filtering
- Priority filter pills (All, Urgent, High, Medium, Low) filter cards across all columns.
- Assignee dropdown filters by a specific team member.
- Search input filters by title and description in real time.
- Clicking a team member chip in the workload panel toggles the assignee filter.

### Project Switching
- A dropdown in the navbar lists all projects. Switching reloads the board with the selected project's tasks and team members.

### Add Member
- A modal with two tabs: select an existing user from the database or create a new user. Both options assign the user to the current project with a chosen permission role (Member, Admin, or Viewer).

---

## Workload Balancing (Burnout Detection)

This is the core differentiating feature. A panel above the board displays all team members as chips with their name, role, and work-in-progress (WIP) count.

**The rule**: If any user has more than 5 tasks in the "In Progress" column, their avatar background pulses red using a CSS animation. A warning banner also appears at the top of the panel.

### How it works

1. Every time tasks are rendered (on load, after drag-and-drop, after create/edit/delete), the frontend recalculates each user's in-progress count from the current task array.
2. If a user's count exceeds 5, the `burnout-pulse` CSS class is added to their avatar element, triggering a `@keyframes` animation that scales the avatar and radiates red box-shadows.
3. A fire icon badge appears on the avatar corner.
4. The warning banner shows the names of all overloaded members.
5. When tasks are moved out of "In Progress" and the count drops to 5 or below, the animation stops and the banner disappears.

The backend also calculates this independently — the `GET /api/users` endpoint returns an `is_burnout` boolean for each user, and the `GET /api/workload` endpoint returns a `burnoutUsers` array.

### Demo

A "Burnout Demo" button in the toolbar toggles Alex Mercer's tasks between columns so you can see the burnout pulse activate and deactivate without manually dragging cards.

### Seed Data

The database is pre-seeded so that Alex Mercer (Lead Architect) has 6 tasks in "In Progress", which immediately triggers the burnout warning on first load. The remaining 3 team members have normal workloads.

---

## How to Run

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher (running locally)
- npm

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Create the database
psql -d postgres -c "CREATE DATABASE kanban_flow;"

# 3. Initialize tables and seed demo data
npm run db:init

# 4. Start the server
npm run dev
```

Open http://localhost:3000 in the browser.

### npm Scripts

| Script          | Command                      | Description                          |
|-----------------|------------------------------|--------------------------------------|
| `npm start`     | `node server/index.js`       | Start the production server          |
| `npm run dev`   | `node --watch server/index.js`| Start with auto-restart on changes  |
| `npm run db:init`| `node server/db_init.js`    | Drop and recreate all tables, seed data |

### Environment Variables (Optional)

If needed, create a `.env` file:

```
DATABASE_URL=postgresql://user:password@localhost:5432/kanban_flow
PORT=3000
```

Without a `.env` file, the app connects to PostgreSQL using the system default user on localhost:5432.
