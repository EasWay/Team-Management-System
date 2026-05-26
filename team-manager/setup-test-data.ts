/**
 * Setup Test Data Script
 * 
 * This script creates sample data for testing the Digital HQ workflow
 * Run with: npx tsx setup-test-data.ts
 */

import { db } from './server/db';
import { teams, teamMembersCollaborative, tasks, users } from './drizzle/schema';
import { eq } from 'drizzle-orm';

async function setupTestData() {
  console.log('🚀 Setting up test data for Digital HQ...\n');

  try {
    // Check if test team already exists
    const existingTeam = await db.query.teams.findFirst({
      where: eq(teams.name, 'Alpha Group Test Team')
    });

    if (existingTeam) {
      console.log('✅ Test team already exists:', existingTeam.name);
      console.log('   Team ID:', existingTeam.id);
      return;
    }

    // Get current user (first user in database)
    const currentUser = await db.query.users.findFirst();
    
    if (!currentUser) {
      console.log('❌ No users found. Please login first to create a user.');
      return;
    }

    console.log('👤 Current user:', currentUser.email);

    // Create test team
    const [newTeam] = await db.insert(teams).values({
      name: 'Alpha Group Test Team',
      description: 'Testing the Digital HQ workflow',
      createdBy: currentUser.id,
    }).returning();

    console.log('✅ Created test team:', newTeam.name);
    console.log('   Team ID:', newTeam.id);

    // Add current user as admin
    await db.insert(teamMembersCollaborative).values({
      teamId: newTeam.id,
      userId: currentUser.id,
      role: 'admin',
      officeRole: 'backend_engineer', // Office #202
    });

    console.log('✅ Added you as admin with Backend Engineer role (Office #202)');

    // Create sample tasks
    const sampleTasks = [
      {
        title: 'User Profile Dashboard',
        description: 'Build a comprehensive user profile dashboard with bio, activity feed, and settings',
        status: 'todo',
        priority: 'high',
        workflowStage: 'research',
        assignedRole: 'lead_researcher',
      },
      {
        title: 'Payment Integration',
        description: 'Integrate Stripe payment gateway for subscription management',
        status: 'in_progress',
        priority: 'high',
        workflowStage: 'backend',
        assignedRole: 'backend_engineer',
      },
      {
        title: 'Mobile App Design',
        description: 'Create mobile-responsive designs for iOS and Android',
        status: 'todo',
        priority: 'medium',
        workflowStage: 'design',
        assignedRole: 'designer',
      },
      {
        title: 'AI Chatbot Feature',
        description: 'Implement AI-powered customer support chatbot',
        status: 'todo',
        priority: 'medium',
        workflowStage: 'ai',
        assignedRole: 'ai_engineer',
      },
      {
        title: 'Performance Testing',
        description: 'Conduct load testing and optimize database queries',
        status: 'todo',
        priority: 'low',
        workflowStage: 'testing',
        assignedRole: 'qa_tester',
      },
    ];

    for (const task of sampleTasks) {
      await db.insert(tasks).values({
        ...task,
        teamId: newTeam.id,
        createdBy: currentUser.id,
      });
    }

    console.log('✅ Created', sampleTasks.length, 'sample tasks');

    console.log('\n🎉 Test data setup complete!\n');
    console.log('📋 Next steps:');
    console.log('   1. Go to https://team-management-system-zq6x.onrender.com');
    console.log('   2. Select "Alpha Group Test Team" from the sidebar');
    console.log('   3. Go to Team Members page and invite colleagues');
    console.log('   4. Assign office roles to team members');
    console.log('   5. Start testing the workflow!');
    console.log('\n📖 See TESTING_GUIDE.md for detailed testing instructions\n');

  } catch (error) {
    console.error('❌ Error setting up test data:', error);
  }

  process.exit(0);
}

setupTestData();
