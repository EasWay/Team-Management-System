# Phase 1: Database Schema Updates

## Summary
Added new fields and tables to support AI Ideation, Sequential Handoff, Decision Table, and AI Project Evaluation features **without modifying any existing functionality**.

---

## ✅ Changes Made

### 1. **New Table: `approvals`**
Decision Table / Quality Gate approval system

**Fields:**
- `id` - Primary key
- `entityType` - 'task', 'project', 'handoff'
- `entityId` - Reference to the entity being approved
- `teamId` - Team context
- `approverType` - 'boss', 'pm', 'team_vote'
- `approverUserId` - Specific approver (null for team votes)
- `status` - 'pending', 'approved', 'rejected'
- `comments` - Approval comments
- **Voting fields:**
  - `votesFor`, `votesAgainst`, `votesAbstain`
  - `requiredVotes` - Calculated threshold
  - `voters` - JSONB array of voter records
- **Handoff context:**
  - `fromStage`, `toStage`
  - `deliverables` - Snapshot of what's being approved
- `createdAt`, `resolvedAt`, `resolvedBy`

---

### 2. **Extended: `teams` table**
Added approval workflow configuration

**New Fields:**
- `approvalMode` - 'boss', 'pm', 'team_vote' (default: 'pm')
- `bossUserId` - Reference to CEO/boss
- `pmUserId` - Reference to Project Manager
- `voteThreshold` - Percentage for team votes (default: 51)

---

### 3. **Extended: `tasks` table**
Added sequential handoff workflow support

**New Fields:**
- `workflowStage` - Current stage ('ideation', 'design', 'business', 'development', 'testing', 'review', 'completed')
- `assignedRole` - Role responsible ('designer', 'business_strategist', 'backend_dev', 'frontend_dev', etc.)
- `handoffHistory` - JSONB array of handoff records
- `deliverables` - JSONB object with deliverable links/files

---

### 4. **Extended: `projects` table**
Added AI ideation and evaluation support

**New Fields:**

**AI Ideation:**
- `ideationData` - JSONB: {chatLogs, speakers, aiAnalysis, finalDecisionReport}
- `workflowStage` - 'ideation', 'design', 'business', 'development', 'testing', 'completed' (default: 'ideation')
- `assignedRole` - Current role responsible
- `handoffHistory` - JSONB array of handoff records
- `deliverables` - JSONB accumulated deliverables

**AI Evaluation:**
- `evaluationData` - JSONB: {overallScore, designAlignment, businessAlignment, technicalQuality, testingProtocol, readyForLaunch}
- `evaluatedAt` - Timestamp of last evaluation

---

### 5. **Updated Relations**

**teamMembers:**
- Added `bossOfTeams` relation
- Added `pmOfTeams` relation
- Added `approvals` relation (as approver)
- Added `resolvedApprovals` relation (as resolver)

**teams:**
- Added `boss` relation
- Added `projectManager` relation
- Added `approvals` relation

**New `approvalsRelations`:**
- Links to team, approver, and resolver

---

## 📊 Data Structure Examples

### Ideation Data (projects.ideationData)
```json
{
  "chatLogs": "WhatsApp chat transcript...",
  "speakers": [
    {"name": "John Doe", "role": "CEO", "contributions": 15},
    {"name": "Jane Smith", "role": "Designer", "contributions": 8}
  ],
  "aiAnalysis": {
    "businessGoals": ["Goal 1", "Goal 2"],
    "designNeeds": ["Need 1", "Need 2"],
    "technicalSpecs": ["Spec 1", "Spec 2"]
  },
  "finalDecisionReport": "Comprehensive report text..."
}
```

### Handoff History (tasks/projects.handoffHistory)
```json
[
  {
    "from": "designer",
    "to": "backend_dev",
    "deliverables": [
      {"type": "figma", "url": "https://figma.com/...", "description": "UI mockups"}
    ],
    "timestamp": "2024-03-15T10:30:00Z",
    "comments": "Design approved, ready for development"
  }
]
```

### Deliverables (tasks/projects.deliverables)
```json
{
  "design": [
    {"type": "figma", "url": "https://figma.com/...", "description": "UI mockups", "uploadedAt": "2024-03-15T10:30:00Z"}
  ],
  "business": [
    {"type": "pdf", "url": "https://s3.../strategy.pdf", "description": "Business strategy", "uploadedAt": "2024-03-16T14:20:00Z"}
  ],
  "development": [
    {"type": "github", "url": "https://github.com/.../pull/123", "description": "Feature implementation", "uploadedAt": "2024-03-18T09:15:00Z"}
  ]
}
```

### Evaluation Data (projects.evaluationData)
```json
{
  "overallScore": 87,
  "designAlignment": {
    "score": 90,
    "issues": ["Minor color inconsistency"],
    "recommendations": ["Update color palette"]
  },
  "businessAlignment": {
    "score": 85,
    "issues": [],
    "recommendations": ["Consider additional revenue stream"]
  },
  "technicalQuality": {
    "score": 88,
    "issues": ["Missing error handling in payment module"],
    "recommendations": ["Add comprehensive error handling"]
  },
  "testingProtocol": [
    "Unit tests for payment processing",
    "Integration tests for user flow",
    "Load testing for 1000 concurrent users"
  ],
  "readyForLaunch": true
}
```

### Voters (approvals.voters)
```json
[
  {"userId": 5, "vote": "for", "timestamp": "2024-03-15T10:30:00Z"},
  {"userId": 8, "vote": "for", "timestamp": "2024-03-15T10:32:00Z"},
  {"userId": 12, "vote": "against", "timestamp": "2024-03-15T10:35:00Z", "reason": "Needs more testing"}
]
```

---

## 🔄 Next Steps

To apply these schema changes to the database:

```bash
cd team-manager

# Generate migration
pnpm drizzle-kit generate

# Apply migration
pnpm db:push
```

---

## ⚠️ Important Notes

1. **No Breaking Changes**: All new fields are nullable or have defaults
2. **Backward Compatible**: Existing features continue to work unchanged
3. **Existing Data Safe**: No modifications to existing records
4. **Relations Added**: New relations don't affect existing queries

---

## 🎯 What This Enables

✅ **AI Ideation Engine** - Store chat logs, speaker analysis, and AI-generated reports
✅ **Sequential Handoff** - Track work progression through different roles
✅ **Decision Table** - Implement boss/PM/team vote approval workflows
✅ **AI Evaluation** - Store comprehensive project quality assessments
✅ **Deliverables Tracking** - Accumulate work artifacts from all stages
✅ **Workflow Stages** - Move projects/tasks through defined stages

---

## 📝 Schema Validation

All changes follow Drizzle ORM best practices:
- ✅ Proper foreign key references
- ✅ Cascade delete where appropriate
- ✅ Default values for new fields
- ✅ JSONB for flexible data structures
- ✅ Proper indexing on foreign keys
- ✅ Type exports for TypeScript safety
