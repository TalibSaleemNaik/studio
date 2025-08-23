# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx. public

## Roles & Permissions Guide

The application uses a three-tiered hierarchical permission system: **Workpanel > TeamRoom > Teamboard**. A user's role at a higher level grants them corresponding permissions for all items nested within it.

---

### 1. Workpanel Roles (Highest Level)

| Role          | Permissions                                                                      | Inheritance                                                                    |
|---------------|----------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| **Owner/Admin** | Full control over Workpanel settings, members, and billing.                      | Becomes a **Manager** of all TeamRooms and Teamboards within.                  |
| **Member**      | Can create new TeamRooms and Teamboards. Can see all non-private items.          | Becomes an **Editor** of all TeamRooms and Teamboards within.                  |
| **Viewer**      | Read-only access to all non-private items.                                     | Becomes a **Viewer** of all TeamRooms and Teamboards within.                   |
| **Guest**       | No default access. Can only see items they are explicitly invited to.            | No inherited permissions.                                                      |

---

### 2. TeamRoom Roles (Mid Level)

| Role      | Permissions                                                       | Inheritance                                              |
|-----------|-------------------------------------------------------------------|----------------------------------------------------------|
| **Manager** | Full control over the TeamRoom, its members, and its settings.    | Becomes a **Manager** of all Teamboards within the room. |
| **Editor**  | Can create new Teamboards within the room.                        | Becomes an **Editor** of all Teamboards within the room. |
| **Viewer**  | Read-only access to the TeamRoom and the teamboards within it.    | Becomes a **Viewer** of all Teamboards within the room.  |

---

### 3. Teamboard Roles (Most Granular Level)

| Role      | Permissions                                                                                                         |
|-----------|---------------------------------------------------------------------------------------------------------------------|
| **Manager** | Full, unrestricted control. Can manage board settings, members, and all tasks.                                    |
| **Editor**  | Can see all tasks. Can only edit, move, or delete tasks that are **assigned to them**.                               |
| **Viewer**  | Read-only. Can see the board structure but only the content of tasks that are **assigned to them**. Cannot make any changes. |
