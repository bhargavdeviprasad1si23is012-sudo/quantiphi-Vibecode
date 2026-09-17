-- Seed Users
INSERT INTO users (id, name, email, avatar_url, role) VALUES
(1, 'Alex Mercer', 'alex.mercer@kanbanflow.dev', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'Lead Architect'),
(2, 'Elena Rostova', 'elena.rostova@kanbanflow.dev', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80', 'Sr. Frontend Eng'),
(3, 'Marcus Vance', 'marcus.vance@kanbanflow.dev', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', 'DevOps Specialist'),
(4, 'Sophia Patel', 'sophia.patel@kanbanflow.dev', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80', 'Product Designer')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for users
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- Seed Projects
INSERT INTO projects (id, name, description, color) VALUES
(1, 'Quantum NextGen Platform', 'Next-generation cloud orchestration microservices & high throughput messaging pipeline.', '#6366f1'),
(2, 'CyberShield Security Suite', 'Zero-trust enterprise telemetry, audit logging & identity governance system.', '#10b981')
ON CONFLICT (id) DO NOTHING;

SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));

-- Seed Project Members
INSERT INTO project_members (project_id, user_id, role) VALUES
(1, 1, 'Owner'),
(1, 2, 'Admin'),
(1, 3, 'Member'),
(1, 4, 'Member'),
(2, 1, 'Admin'),
(2, 3, 'Owner')
ON CONFLICT DO NOTHING;

-- Seed Tasks for Project 1 (Quantum NextGen Platform)
-- Notice: Alex Mercer (user_id 1) has 6 tasks in 'in_progress', purposely triggering the Burnout Alert!
INSERT INTO tasks (id, project_id, user_id, title, description, priority, status, position, due_date) VALUES
-- 'in_progress' for Alex Mercer (Count: 6 -> triggers BURNOUT PULSE)
(1, 1, 1, 'Refactor OAuth2 JWT session handshake', 'Upgrade authentication to asymmetric RS256 with key rotation and fast revocation cache in Redis.', 'urgent', 'in_progress', 1, CURRENT_DATE + INTERVAL '2 days'),
(2, 1, 1, 'Implement distributed Redis lock manager', 'Prevent race condition spikes during heavy parallel cron reconciliation jobs.', 'high', 'in_progress', 2, CURRENT_DATE + INTERVAL '4 days'),
(3, 1, 1, 'Optimize PostgreSQL connection pooling & retry logic', 'Tune maximum idle connection pools and add exponential jitter backoff on transient disconnects.', 'high', 'in_progress', 3, CURRENT_DATE + INTERVAL '3 days'),
(4, 1, 1, 'Audit TLS 1.3 cipher suite configurations', 'Verify cryptographic hygiene across edge reverse proxies and disable legacy curves.', 'medium', 'in_progress', 4, CURRENT_DATE + INTERVAL '7 days'),
(5, 1, 1, 'Patch memory leak in WebSocket broker', 'Investigate heap dumps showing uncleared event emitter listeners on abnormal client drops.', 'urgent', 'in_progress', 5, CURRENT_DATE + INTERVAL '1 day'),
(6, 1, 1, 'Migrate database migrations to transaction-safe rollback', 'Wrap schema alter operations in conditional transactions to guarantee zero partial-state failures.', 'medium', 'in_progress', 6, CURRENT_DATE + INTERVAL '5 days'),

-- 'in_progress' for other team members
(7, 1, 4, 'Implement Figma wireframes for Project Settings', 'Build responsive mobile and desktop viewports with glassmorphic modal components.', 'high', 'in_progress', 7, CURRENT_DATE + INTERVAL '3 days'),
(8, 1, 3, 'Setup Prometheus & Grafana telemetry dashboards', 'Create dashboards for P99 latency, request rates, error budgets, and node CPU loads.', 'medium', 'in_progress', 8, CURRENT_DATE + INTERVAL '6 days'),

-- 'todo' tasks
(9, 1, 4, 'Design accessible design tokens for dark mode', 'Ensure WCAG AAA contrast ratio compliance across status badges, borders, and muted text.', 'low', 'todo', 1, CURRENT_DATE + INTERVAL '9 days'),
(10, 1, 3, 'Containerize backend services with multi-stage Docker build', 'Shrink production Alpine image footprint below 95MB and run as non-root user.', 'medium', 'todo', 2, CURRENT_DATE + INTERVAL '8 days'),
(11, 1, 2, 'Setup automated end-to-end Cypress test matrix', 'Write regression test scenarios for Kanban card drag-and-drop and modal form submissions.', 'high', 'todo', 3, CURRENT_DATE + INTERVAL '4 days'),
(12, 1, 2, 'Create real-time activity stream via Server-Sent Events', 'Broadcast state changes to connected project collaborators with optimistic UI reconciliation.', 'medium', 'todo', 4, CURRENT_DATE + INTERVAL '10 days'),

-- 'done' tasks
(13, 1, 3, 'Deploy initial staging Kubernetes cluster', 'Provision ingress controllers, cert-manager, and load balancer endpoints in staging VPC.', 'urgent', 'done', 1, CURRENT_DATE - INTERVAL '2 days'),
(14, 1, 4, 'Finalize typography system & color palette', 'Curated Plus Jakarta Sans type scale, semantic status tokens, and dark theme gradients.', 'low', 'done', 2, CURRENT_DATE - INTERVAL '4 days'),
(15, 1, 1, 'Build core REST API routing boilerplate', 'Express router structure, input validator middleware, and error formatting layer.', 'medium', 'done', 3, CURRENT_DATE - INTERVAL '6 days')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  position = EXCLUDED.position,
  due_date = EXCLUDED.due_date;

SELECT setval('tasks_id_seq', (SELECT MAX(id) FROM tasks));
