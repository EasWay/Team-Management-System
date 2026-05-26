# 🧪 Testing Guide - Digital HQ Complete Workflow

This guide walks you through testing the entire Digital HQ system from start to finish.

---

## 🎯 Prerequisites

Before testing, ensure:
- ✅ Application is deployed at: https://team-management-system-zq6x.onrender.com
- ✅ You have a GitHub account for OAuth login
- ✅ You have at least 2-3 team members to test collaboration features
- ✅ Database is connected and migrations are applied

---

## 📋 Test Scenario: Building a New Feature

We'll test the complete workflow by simulating building a new feature called "User Profile Dashboard"

---

## Phase 1: Setup & Team Configuration

### Test 1.1: Login & Authentication
**Steps:**
1. Go to https://team-management-system-zq6x.onrender.com
2. Click "Sign in with GitHub"
3. Authorize the application
4. Verify you're redirected to the dashboard

**Expected Result:**
- ✅ Successfully logged in
- ✅ See your name and email in sidebar
- ✅ Dashboard loads without errors

---

### Test 1.2: Create Team
**Steps:**
1. Click "Teams" in sidebar
2. Click "Create New Team"
3. Enter team name: "Alpha Group Test Team"
4. Enter description: "Testing the Digital HQ workflow"
5. Click "Create Team"

**Expected Result:**
- ✅ Team created successfully
- ✅ You're automatically set as admin
- ✅ Team appears in teams list

---

### Test 1.3: Invite Team Members
**Steps:**
1. Select your newly created team
2. Go to "Team Members" page
3. Click "Invite Member"
4. Enter email addresses of 2-3 colleagues
5. Send invitations

**Expected Result:**
- ✅ Invitations sent successfully
- ✅ Invited members receive email notifications
- ✅ Members can accept invitations

---

### Test 1.4: Assign Office Roles
**Steps:**
1. Go to "Team Members" page
2. For each team member, click the "Office Role" dropdown
3. Assign roles:
   - Yourself → Backend Engineer (Office #202)
   - Member 2 → Lead Researcher (Office #101)
   - Member 3 → QA Tester (Office #302)
4. Save assignments

**Expected Result:**
- ✅ Office roles assigned successfully
- ✅ Each member sees their assigned office
- ✅ Office badges appear next to names

---

## Phase 2: Idea Generation (Idea Lab)

### Test 2.1: Access Idea Lab
**Steps:**
1. Click "🏛️ Conference Room" in sidebar
2. Click "Idea Lab" tab
3. Verify AI Transcriptionist interface loads

**Expected Result:**
- ✅ Idea Lab interface visible
- ✅ Text area for pasting chat logs
- ✅ "Process Brainstorming" button available

---

### Test 2.2: Process Brainstorming Session
**Steps:**
1. Copy this sample brainstorming chat:

```
Kingsley: Hey team, I think we need a user profile dashboard
George: That's a great idea! What features should it have?
Kingsley: Profile picture, bio, activity feed, and settings
Godfred: We should also add social links and achievements
George: Agreed. I'll research similar dashboards for inspiration
Kingsley: Perfect. Let's make it responsive and accessible
Godsway: I can add AI-powered profile suggestions
Abena: Sounds good. Timeline is 2 weeks. Let's do it!
```

2. Paste into Idea Lab text area
3. Click "Process Brainstorming"
4. Wait for AI to process (10-15 seconds)

**Expected Result:**
- ✅ AI identifies speakers (Kingsley, George, Godfred, Godsway, Abena)
- ✅ Final Decision Report generated with:
  - Project name: "User Profile Dashboard"
  - Key decisions extracted
  - Timeline: 2 weeks
  - Assigned roles
- ✅ "Activate Project" button appears

---

### Test 2.3: Activate Project
**Steps:**
1. Review the Final Decision Report
2. Click "Activate Project"
3. Confirm activation

**Expected Result:**
- ✅ Project/task created in system
- ✅ Automatically delivered to Lead Researcher's inbox (George - Office #101)
- ✅ Success notification appears
- ✅ Project visible in system

---

## Phase 3: Sequential Development Workflow

### Test 3.1: Lead Researcher Office (George - Office #101)
**Steps:**
1. Login as George (or switch to his account)
2. Click "🏢 My Office" in sidebar
3. Verify you see Office #101 (Lead Researcher)
4. Check "📬 Inbox" section on right side

**Expected Result:**
- ✅ "User Profile Dashboard" folder appears in inbox
- ✅ Folder shows project details
- ✅ Can see who sent it (from Idea Lab)

---

### Test 3.2: Work on Research
**Steps:**
1. In George's office, the folder should be on the desk
2. Click "Add File" button on the folder
3. Select file type: "PDF Document"
4. Enter URL: `https://example.com/research-doc.pdf`
5. Enter description: "Research on modern profile dashboard designs"
6. Click "Add File"

**Expected Result:**
- ✅ File added to folder successfully
- ✅ File count updates (shows "1 file")
- ✅ Deliverable saved in database

---

### Test 3.3: Send to Next Office (with Approval)
**Steps:**
1. Click "Send" button on the folder
2. Select "Send To": "Systems Architecture"
3. Enter notes: "Research complete. Ready for architecture design."
4. Check "Requires approval before delivery"
5. Click "Send to Systems Architecture"

**Expected Result:**
- ✅ Folder sent to Conference Room for approval
- ✅ Notification: "Handoff requested! Waiting for approval."
- ✅ Folder appears in Conference Room → Decision Table

---

### Test 3.4: Conference Room Approval
**Steps:**
1. Login as Project Manager (Abena) or Admin
2. Go to "🏛️ Conference Room"
3. Click "Decision Table" tab
4. Find "User Profile Dashboard" pending approval

**Expected Result:**
- ✅ Folder appears in pending approvals
- ✅ Shows sender (George), recipient (Systems Architect)
- ✅ Shows deliverables (research doc)
- ✅ Shows notes from sender

---

### Test 3.5: Approve Handoff
**Steps:**
1. Review the folder details
2. Select approval mode: "Boss Decision" or "PM Decision"
3. Click "Approve"
4. Add approval comment: "Research looks good. Proceed to architecture."

**Expected Result:**
- ✅ Approval recorded
- ✅ Folder moves to Systems Architect's inbox (Office #201)
- ✅ George receives notification of approval
- ✅ Folder removed from pending approvals

---

### Test 3.6: Systems Architect Office (Daniel - Office #201)
**Steps:**
1. Login as Daniel (Systems Architect)
2. Go to "🏢 My Office"
3. Check inbox for new folder

**Expected Result:**
- ✅ "User Profile Dashboard" appears in inbox
- ✅ Shows previous deliverables (research doc)
- ✅ Shows approval notes from PM

---

### Test 3.7: Add Architecture Design
**Steps:**
1. Click "Add File" on the folder
2. Select file type: "Figma Design"
3. Enter URL: `https://figma.com/architecture-diagram`
4. Enter description: "System architecture and database schema"
5. Click "Add File"
6. Click "Send" → Select "Backend Development"
7. Uncheck "Requires approval" (direct handoff)
8. Click "Send to Backend Development"

**Expected Result:**
- ✅ Architecture file added
- ✅ Folder sent directly to Backend Engineer (no approval needed)
- ✅ Folder appears in Backend Engineer's inbox (Office #202)

---

### Test 3.8: Backend Engineer Office (Kingsley - Office #202)
**Steps:**
1. Login as Kingsley (Backend Engineer)
2. Go to "🏢 My Office"
3. Verify folder in inbox
4. Click "Add File"
5. Select file type: "GitHub PR/Repo"
6. Enter URL: `https://github.com/alpha/profile-dashboard/pull/1`
7. Enter description: "Backend API implementation"
8. Click "Add File"

**Expected Result:**
- ✅ GitHub PR link added as deliverable
- ✅ File count shows 3 files now (research + architecture + backend)
- ✅ Can send to next office

---

### Test 3.9: Continue Through Workflow
**Steps:**
Repeat similar process for:
1. Full Stack Engineer (Office #203) - Add frontend PR
2. AI Engineer (Office #301) - Add AI features
3. QA Tester (Office #302) - Add test reports
4. Project Manager (Office #100) - Final review

**Expected Result:**
- ✅ Folder moves through all offices sequentially
- ✅ Each office adds their deliverables
- ✅ Approvals work when required
- ✅ Direct handoffs work when approval not required

---

## Phase 4: Quality Assurance

### Test 4.1: Access QA Office
**Steps:**
1. After final review, folder should be marked "Completed"
2. Go to "📊 QA Office" page
3. Find "User Profile Dashboard" in completed projects

**Expected Result:**
- ✅ Completed folder appears in QA Office
- ✅ Shows all deliverables from all offices
- ✅ "Run AI Inspection" button available

---

### Test 4.2: Run AI Quality Inspection
**Steps:**
1. Click "Run AI Inspection" on the folder
2. Wait for AI to analyze (15-20 seconds)
3. Review quality scores

**Expected Result:**
- ✅ AI inspection completes successfully
- ✅ Scores displayed for:
  - Design Quality (0-100)
  - Business Alignment (0-100)
  - Technical Quality (0-100)
  - Overall Score (average)
- ✅ Detailed feedback provided
- ✅ Score saved in database

---

### Test 4.3: Interpret Results
**Steps:**
1. Check overall score
2. If score ≥ 90: Project ready for launch ✅
3. If score < 90: Review feedback and improve ⚠️

**Expected Result:**
- ✅ Clear pass/fail indication
- ✅ Actionable feedback for improvements
- ✅ Can re-run inspection after improvements

---

## Phase 5: Integration with Existing Features

### Test 5.1: Tasks Integration
**Steps:**
1. Go to "Tasks" page (Kanban board)
2. Create a new task: "Fix profile picture upload bug"
3. Assign to yourself
4. Go back to "🏢 My Office"
5. Check if task appears in "My Tasks" section

**Expected Result:**
- ✅ Task created in Kanban board
- ✅ Task appears in office view
- ✅ Can click task to go to Tasks page
- ✅ Both views show same data

---

### Test 5.2: Repositories Integration
**Steps:**
1. Go to "Repositories" page
2. Connect a GitHub repository
3. Go to "🏢 My Office"
4. Click "GitHub Repos" in Quick Access section

**Expected Result:**
- ✅ Redirects to Repositories page
- ✅ Shows connected repos
- ✅ Can see PRs, issues, commits
- ✅ Can add repo links as deliverables in folders

---

### Test 5.3: Projects Integration
**Steps:**
1. Go to "Projects" page
2. Create a new project: "User Profile Dashboard"
3. Add project files
4. Link project to workflow folder

**Expected Result:**
- ✅ Project created successfully
- ✅ Can link to workflow folders
- ✅ Project status reflects workflow stage
- ✅ Files sync between project and folder

---

### Test 5.4: Messages Integration
**Steps:**
1. Go to "Messages" page
2. Send message to team: "Profile dashboard is ready for review!"
3. Team members receive notification
4. Can discuss folders and tasks

**Expected Result:**
- ✅ Messages sent successfully
- ✅ Real-time updates via Socket.io
- ✅ Team collaboration enabled
- ✅ Can reference folders and tasks in messages

---

## Phase 6: Office Access Control

### Test 6.1: Access Your Own Office
**Steps:**
1. Go to "🏢 My Office"
2. Click on your assigned office in Office Directory
3. Verify immediate access (no code required)

**Expected Result:**
- ✅ Your office opens immediately
- ✅ No access code prompt
- ✅ "YOUR OFFICE" badge visible
- ✅ Can see your desk and inbox

---

### Test 6.2: Access Other Offices (with Code)
**Steps:**
1. In Office Directory, click on another office (not yours)
2. Access code dialog appears
3. Enter the office code (e.g., for Office #202, enter "202")
4. Click "Access Office"

**Expected Result:**
- ✅ Access code dialog appears
- ✅ Correct code grants access
- ✅ Incorrect code shows error
- ✅ Can view other office after access granted

---

### Test 6.3: Admin Access (No Code Required)
**Steps:**
1. Login as admin or team_lead
2. Go to "🏢 My Office"
3. Click any office in Office Directory

**Expected Result:**
- ✅ Admin can access all offices without code
- ✅ No access code prompt for admins
- ✅ Can monitor all team members' work
- ✅ Full visibility across offices

---

## 🐛 Common Issues & Troubleshooting

### Issue 1: Office is Empty
**Problem:** When I open my office, nothing shows up

**Solutions:**
1. Check if you have an assigned office role (Team Members page)
2. Verify team is selected in sidebar
3. Check if any tasks/folders are assigned to your role
4. Try creating a test task in Tasks page

---

### Issue 2: Can't Send Folder
**Problem:** "Send" button doesn't work

**Solutions:**
1. Ensure you've added at least one deliverable
2. Check if folder has required fields filled
3. Verify you have permission to send
4. Check network connection

---

### Issue 3: Approval Not Working
**Problem:** Approval doesn't move folder to next office

**Solutions:**
1. Verify you have approval permissions (admin/PM)
2. Check if approval mode is selected correctly
3. Ensure next office role is assigned to someone
4. Check database connection

---

### Issue 4: AI Features Not Working
**Problem:** Idea Lab or QA Office AI not responding

**Solutions:**
1. Check if GROQ_API_KEY is set in environment variables
2. Verify API key is valid and has credits
3. Check server logs for errors
4. Try again after a few seconds (rate limiting)

---

### Issue 5: Tasks Not Showing in Office
**Problem:** Tasks from Kanban board don't appear in office

**Solutions:**
1. Ensure tasks are assigned to you
2. Check if task status is correct
3. Verify team is selected
4. Refresh the page

---

## ✅ Complete Test Checklist

Use this checklist to verify all features:

### Setup & Configuration
- [ ] Login with GitHub OAuth
- [ ] Create team
- [ ] Invite team members
- [ ] Assign office roles
- [ ] Configure team settings

### Idea Lab
- [ ] Access Idea Lab
- [ ] Paste brainstorming chat
- [ ] AI processes chat successfully
- [ ] Final Decision Report generated
- [ ] Activate project
- [ ] Project delivered to first office

### Office Workflow
- [ ] Receive folder in inbox
- [ ] Move folder to desk
- [ ] Add deliverables (files/links)
- [ ] Send folder to next office
- [ ] Approval workflow (when required)
- [ ] Direct handoff (when no approval)
- [ ] Folder moves through all offices

### Conference Room
- [ ] Access Conference Room
- [ ] View pending approvals
- [ ] Approve/reject folders
- [ ] Different approval modes work
- [ ] Notifications sent correctly

### QA Office
- [ ] Access QA Office
- [ ] View completed folders
- [ ] Run AI inspection
- [ ] View quality scores
- [ ] Interpret results
- [ ] Re-run inspection after improvements

### Feature Integration
- [ ] Tasks appear in office view
- [ ] Can navigate to Tasks page
- [ ] Repositories linked correctly
- [ ] Projects sync with folders
- [ ] Messages work for team communication
- [ ] Real-time updates via Socket.io

### Office Access Control
- [ ] Own office opens without code
- [ ] Other offices require code
- [ ] Correct code grants access
- [ ] Incorrect code shows error
- [ ] Admin access works without code

### UI/UX
- [ ] Office looks realistic (desk, inbox, filing cabinet)
- [ ] Office numbers hidden from public view
- [ ] Icons and colors consistent
- [ ] Responsive on mobile/tablet
- [ ] No console errors
- [ ] Loading states work correctly

---

## 📊 Performance Testing

### Load Testing
1. Create 10+ folders in workflow
2. Add 5+ deliverables per folder
3. Test with 5+ team members simultaneously
4. Verify no performance degradation

### Expected Performance:
- ✅ Page load < 2 seconds
- ✅ API responses < 500ms
- ✅ Real-time updates < 1 second
- ✅ AI processing < 20 seconds

---

## 🎯 Success Criteria

The workflow is successful if:
1. ✅ All phases complete without errors
2. ✅ Folders move through offices correctly
3. ✅ Approvals work as expected
4. ✅ AI features provide useful insights
5. ✅ Existing features integrate seamlessly
6. ✅ Office access control works properly
7. ✅ UI is intuitive and realistic
8. ✅ Team can collaborate effectively

---

## 📝 Test Report Template

After testing, document results:

```
# Test Report - [Date]

## Tester: [Your Name]
## Environment: Production / Staging
## Browser: Chrome / Firefox / Safari

### Test Results:
- Setup & Configuration: ✅ / ❌
- Idea Lab: ✅ / ❌
- Office Workflow: ✅ / ❌
- Conference Room: ✅ / ❌
- QA Office: ✅ / ❌
- Feature Integration: ✅ / ❌
- Office Access Control: ✅ / ❌

### Issues Found:
1. [Issue description]
2. [Issue description]

### Recommendations:
1. [Recommendation]
2. [Recommendation]

### Overall Assessment:
[Pass / Fail / Needs Improvement]
```

---

**Built with ❤️ by Alpha Group of Developers | 2026**
