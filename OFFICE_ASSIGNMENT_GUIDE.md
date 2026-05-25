# 🏢 Office Assignment Guide

## How to Assign Team Members to Their Offices

The Digital HQ uses a **dual-role system**:

1. **Permission Role** - Controls what they can do (admin, team_lead, developer, viewer)
2. **Office Role** - Defines which office they work in and what workflow stage they handle

---

## Step-by-Step Assignment Process

### 1. Navigate to Team Members

1. Go to your team's page
2. Click on the **"Team Members"** tab
3. You'll see a list of all team members

### 2. Assign Office Roles

For each team member, you'll see two dropdowns:

#### **Permission Role Dropdown** (Shield icon)
- Controls access permissions
- Options: Admin, Team Lead, Developer, Viewer

#### **Office Role Dropdown** (Building icon)
- Assigns them to a specific office
- Shows office number and role name

### 3. Available Offices

| Office # | Role | Workflow Stage |
|----------|------|----------------|
| **#100** | Project Manager | Final Review |
| **#101** | Lead Researcher | Research & Scoping |
| **#201** | Systems Architect | Systems Architecture |
| **#202** | Backend Engineer | Backend Development |
| **#203** | Full Stack Engineer | Full Stack Development |
| **#301** | AI Engineer | AI Integration |
| **#302** | QA Tester | QA Testing |
| **#303** | Designer | Design |

---

## Example: Setting Up Alpha Group Team

### Abena Ntewusu Exceltrine
- **Permission Role**: Admin
- **Office Role**: Project Manager (Office #100)

### George Essel Bonsu
- **Permission Role**: Team Lead
- **Office Role**: Lead Researcher (Office #101)

### Daniel Mensah
- **Permission Role**: Developer
- **Office Role**: Systems Architect (Office #201)

### Kingsley Okyere (Founder)
- **Permission Role**: Admin
- **Office Role**: Backend Engineer (Office #202)

### Godfred Fokuo (Co-founder)
- **Permission Role**: Admin
- **Office Role**: Full Stack Engineer (Office #203)

### Godsway Ganyo
- **Permission Role**: Developer
- **Office Role**: AI Engineer (Office #301)

---

## How Office Roles Work

### 1. **Workspace View**
- When a team member logs in, they see their assigned office
- They can view the "Office Directory" to see all offices
- They can only work on folders assigned to their office role

### 2. **Folder Delivery**
- When someone completes work, they "Deliver Folder" to the next office
- The system automatically routes it based on workflow stage
- Example: Designer finishes → Delivers to Backend Engineer's office

### 3. **Conference Room (Approvals)**
- Before folders move between offices, they go through the Conference Room
- Boss/PM/Team can approve or reject the handoff
- This ensures quality control at each stage

---

## Database Schema

The office role is stored in the `team_members_collaborative` table:

```sql
ALTER TABLE team_members_collaborative 
ADD COLUMN office_role TEXT;
```

Valid values:
- `'project_manager'`
- `'lead_researcher'`
- `'systems_architect'`
- `'backend_engineer'`
- `'fullstack_engineer'`
- `'ai_engineer'`
- `'qa_tester'`
- `'designer'`
- `NULL` (no office assigned - visitor)

---

## Migration Steps

### 1. Update Database Schema

Run this SQL migration:

```bash
cd team-manager
pnpm db:push
```

This will add the `office_role` column to your database.

### 2. Assign Office Roles

1. Log in as an admin
2. Go to your team
3. Click "Team Members"
4. For each member, click the "Assign Office" dropdown
5. Select their office role

### 3. Test the Workflow

1. Go to "My Office" page
2. You should see your assigned office
3. Create a test task/project
4. Try delivering it to the next office
5. Check the Conference Room for approvals

---

## Troubleshooting

### "Assign Office" button not showing
- Make sure you're logged in as an admin or team lead
- Refresh the page after database migration

### Office role not saving
- Check browser console for errors
- Verify database migration completed successfully
- Ensure you have permission to change roles

### Folders not appearing in office
- Verify the folder's `assignedRole` matches your `officeRole`
- Check the workflow stage is correct
- Refresh the workspace page

---

## API Reference

### Update Office Role

```typescript
// tRPC mutation
trpc.teams.updateOfficeRole.useMutation({
  teamId: number,
  userId: number,
  officeRole: 'project_manager' | 'lead_researcher' | ... | null
})
```

### Get Team Members with Office Roles

```typescript
// tRPC query
trpc.teams.getMembers.useQuery({
  teamId: number
})

// Returns:
{
  id: number,
  memberId: number,
  role: 'admin' | 'team_lead' | 'developer' | 'viewer',
  officeRole: 'project_manager' | ... | null,
  member: {
    name: string,
    email: string,
    ...
  }
}
```

---

## Next Steps

After assigning office roles:

1. **Configure Approval Workflow** - Set up boss/PM for Conference Room
2. **Create Projects in Idea Lab** - Start with brainstorming
3. **Test Handoff Flow** - Deliver folders between offices
4. **Run Quality Inspection** - Use QA Office for final review

---

**Built with ❤️ by Alpha Group of Developers | 2026**
