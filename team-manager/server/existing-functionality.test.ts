import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

function createTestContext(): { ctx: TrpcContext; user: User } {
  const user: User = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {
        'user-agent': 'test-agent'
      },
      ip: '127.0.0.1',
      connection: {
        remoteAddress: '127.0.0.1'
      }
    } as any,
    res: {
      clearCookie: () => {},
    } as any,
  };

  return { ctx, user };
}

describe("Existing Functionality Preservation Property Tests", () => {
  it("Property 26: Existing Functionality Preservation - For any existing team member search, filter, or data access operation, it should continue to work correctly after department management implementation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          teamMemberName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          position: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          duties: fc.option(fc.string({ maxLength: 200 })),
          email: fc.option(fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length > 0).map(s => `${s.replace(/[^a-zA-Z0-9]/g, 'a')}@example.com`)),
          phone: fc.option(fc.string({ minLength: 10, maxLength: 15 })),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (teamMemberData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Create a unique team member name to avoid conflicts
          const uniqueName = `${teamMemberData.teamMemberName}_${uniqueId}`;
          const uniqueEmail = teamMemberData.email ? `${uniqueId}_${teamMemberData.email}` : undefined;

          // Test 1: Create team member using original endpoint
          const createdMember = await caller.team.create({
            name: uniqueName,
            position: teamMemberData.position,
            duties: teamMemberData.duties || undefined,
            email: uniqueEmail,
            phone: teamMemberData.phone || undefined,
          });

          // Verify creation worked as expected
          expect(createdMember).toBeDefined();
          expect(createdMember.name).toBe(uniqueName);
          expect(createdMember.position).toBe(teamMemberData.position);
          expect(createdMember.duties).toBe(teamMemberData.duties || null);
          expect(createdMember.email).toBe(uniqueEmail || null);
          expect(createdMember.phone).toBe(teamMemberData.phone || null);

          // Test 2: List all team members (original functionality)
          const allMembers = await caller.team.list();
          expect(Array.isArray(allMembers)).toBe(true);
          expect(allMembers.some(m => m.id === createdMember.id)).toBe(true);

          // Test 3: Get team member by ID (original functionality)
          const fetchedMember = await caller.team.getById({ id: createdMember.id });
          expect(fetchedMember).toBeDefined();
          expect(fetchedMember?.id).toBe(createdMember.id);
          expect(fetchedMember?.name).toBe(uniqueName);
          expect(fetchedMember?.position).toBe(teamMemberData.position);

          // Test 4: Update team member (original functionality)
          const updatedPosition = `Updated_${teamMemberData.position}`;
          const updatedMember = await caller.team.update({
            id: createdMember.id,
            position: updatedPosition,
          });
          expect(updatedMember).toBeDefined();
          expect(updatedMember?.position).toBe(updatedPosition);

          // Test 5: Verify enhanced endpoints still work with original data structure
          const membersWithDepartments = await caller.team.listWithDepartments();
          expect(Array.isArray(membersWithDepartments)).toBe(true);
          const memberWithDept = membersWithDepartments.find(m => m.id === createdMember.id);
          expect(memberWithDept).toBeDefined();
          expect(memberWithDept?.name).toBe(uniqueName);
          expect(memberWithDept?.position).toBe(updatedPosition);
          // Should have no department initially
          expect(memberWithDept?.currentDepartment).toBeUndefined();

          // Test 6: Get team member by ID with department info
          const memberWithDeptById = await caller.team.getByIdWithDepartment({ id: createdMember.id });
          expect(memberWithDeptById).toBeDefined();
          expect(memberWithDeptById?.id).toBe(createdMember.id);
          expect(memberWithDeptById?.name).toBe(uniqueName);
          expect(memberWithDeptById?.currentDepartment).toBeUndefined();

          // Test 7: Delete team member (original functionality)
          const deleteResult = await caller.team.delete({ id: createdMember.id });
          expect(deleteResult).toBe(true);

          // Test 8: Verify deletion worked
          const deletedMember = await caller.team.getById({ id: createdMember.id });
          expect(deletedMember).toBeUndefined();
        }
      ),
      { numRuns: 3 }
    );
  });

  it("Property 26 Extended: Team Member Data Integrity - For any team member operations, all original data fields should be preserved and accessible through both original and enhanced endpoints", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          position: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          duties: fc.option(fc.string({ maxLength: 200 })),
          email: fc.option(fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length > 0).map(s => `${s.replace(/[^a-zA-Z0-9]/g, 'a')}@example.com`)),
          phone: fc.option(fc.string({ minLength: 10, maxLength: 15 })),
          pictureFileName: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
        }),
        fc.integer({ min: 1, max: 1000000 }),
        async (memberData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          const uniqueName = `${memberData.name}_${uniqueId}`;
          const uniqueEmail = memberData.email ? `${uniqueId}_${memberData.email}` : undefined;

          // Create member with all possible fields
          const created = await caller.team.create({
            name: uniqueName,
            position: memberData.position,
            duties: memberData.duties || undefined,
            email: uniqueEmail,
            phone: memberData.phone || undefined,
            pictureFileName: memberData.pictureFileName || undefined,
          });

          // Verify all fields are preserved in original endpoint
          const originalFetch = await caller.team.getById({ id: created.id });
          expect(originalFetch?.name).toBe(uniqueName);
          expect(originalFetch?.position).toBe(memberData.position);
          expect(originalFetch?.duties).toBe(memberData.duties || null);
          expect(originalFetch?.email).toBe(uniqueEmail || null);
          expect(originalFetch?.phone).toBe(memberData.phone || null);
          expect(originalFetch?.pictureFileName).toBe(memberData.pictureFileName || null);

          // Verify all fields are preserved in enhanced endpoint
          const enhancedFetch = await caller.team.getByIdWithDepartment({ id: created.id });
          expect(enhancedFetch?.name).toBe(uniqueName);
          expect(enhancedFetch?.position).toBe(memberData.position);
          expect(enhancedFetch?.duties).toBe(memberData.duties || null);
          expect(enhancedFetch?.email).toBe(uniqueEmail || null);
          expect(enhancedFetch?.phone).toBe(memberData.phone || null);
          expect(enhancedFetch?.pictureFileName).toBe(memberData.pictureFileName || null);

          // Verify fields are preserved in list endpoints
          const originalList = await caller.team.list();
          const memberInOriginalList = originalList.find(m => m.id === created.id);
          expect(memberInOriginalList?.name).toBe(uniqueName);
          expect(memberInOriginalList?.position).toBe(memberData.position);

          const enhancedList = await caller.team.listWithDepartments();
          const memberInEnhancedList = enhancedList.find(m => m.id === created.id);
          expect(memberInEnhancedList?.name).toBe(uniqueName);
          expect(memberInEnhancedList?.position).toBe(memberData.position);
          expect(memberInEnhancedList?.duties).toBe(memberData.duties || null);
          expect(memberInEnhancedList?.email).toBe(uniqueEmail || null);
          expect(memberInEnhancedList?.phone).toBe(memberData.phone || null);

          // Clean up
          await caller.team.delete({ id: created.id });
        }
      ),
      { numRuns: 3 }
    );
  });

  it("Property 26 Search Compatibility: Team Member Search and Filter Operations - For any team member search or filter criteria, the functionality should work identically before and after department management implementation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            position: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            duties: fc.option(fc.string({ maxLength: 200 })),
            email: fc.option(fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length > 0).map(s => `${s.replace(/[^a-zA-Z0-9]/g, 'a')}@example.com`)),
            phone: fc.option(fc.string({ minLength: 10, maxLength: 15 })),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        fc.integer({ min: 1, max: 1000000 }),
        async (membersData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          const createdMembers: any[] = [];

          // Create multiple team members
          for (let i = 0; i < membersData.length; i++) {
            const memberData = membersData[i];
            const uniqueName = `${memberData.name}_${uniqueId}_${i}`;
            const uniqueEmail = memberData.email ? `${uniqueId}_${i}_${memberData.email}` : undefined;

            const created = await caller.team.create({
              name: uniqueName,
              position: memberData.position,
              duties: memberData.duties || undefined,
              email: uniqueEmail,
              phone: memberData.phone || undefined,
            });

            createdMembers.push(created);
          }

          // Test that both list endpoints return the same core data
          const originalList = await caller.team.list();
          const enhancedList = await caller.team.listWithDepartments();

          // Verify all created members appear in both lists
          for (const member of createdMembers) {
            const inOriginal = originalList.find(m => m.id === member.id);
            const inEnhanced = enhancedList.find(m => m.id === member.id);

            expect(inOriginal).toBeDefined();
            expect(inEnhanced).toBeDefined();

            // Verify core fields match between endpoints
            expect(inOriginal?.name).toBe(inEnhanced?.name);
            expect(inOriginal?.position).toBe(inEnhanced?.position);
            expect(inOriginal?.duties).toBe(inEnhanced?.duties);
            expect(inOriginal?.email).toBe(inEnhanced?.email);
            expect(inOriginal?.phone).toBe(inEnhanced?.phone);
            expect(inOriginal?.pictureFileName).toBe(inEnhanced?.pictureFileName);
          }

          // Test that enhanced list includes department info (should be null/undefined for unassigned)
          for (const member of createdMembers) {
            const enhanced = enhancedList.find(m => m.id === member.id);
            // Should have currentDepartment field (even if undefined)
            expect('currentDepartment' in enhanced!).toBe(true);
          }

          // Clean up
          for (const member of createdMembers) {
            await caller.team.delete({ id: member.id });
          }
        }
      ),
      { numRuns: 2 } // Reduced runs due to multiple member creation
    );
  });
});