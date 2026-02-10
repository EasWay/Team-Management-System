import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { createDepartmentAssignment, getDb, assignMemberToDepartment, reassignMember, unassignMemberFromDepartment, setDepartmentParent, getDepartmentHierarchy, getDepartmentPath, getDepartmentChildren, deleteDepartmentWithStrategy, createTeamMemberWithDepartment, getAuditLogs } from "./db";
import { departmentAssignments } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

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
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };

  return { ctx, user };
}

describe("Department Management Property Tests", () => {
  it("Property 1: Department CRUD Operations - For any valid department data, creating a department should result in a department that can be retrieved, updated, and (if empty) deleted successfully", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          description: fc.option(fc.string({ maxLength: 200 })),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (departmentData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Make department name unique by adding timestamp and unique ID
          const uniqueName = `${departmentData.name}_${Date.now()}_${uniqueId}`;
          const testData = { ...departmentData, name: uniqueName };

          // Create department
          const created = await caller.department.create(testData);
          expect(created).toBeDefined();
          expect(created.name).toBe(testData.name);
          // Handle both null and empty string cases for description
          if (testData.description === null || testData.description === undefined) {
            expect(created.description).toBeNull();
          } else {
            expect(created.description).toBe(testData.description);
          }
          expect(created.id).toBeTypeOf("number");

          // Retrieve department
          const retrieved = await caller.department.getById({ id: created.id });
          expect(retrieved).toBeDefined();
          expect(retrieved?.id).toBe(created.id);
          expect(retrieved?.name).toBe(testData.name);

          // Update department
          const updateData = { name: `Updated_${testData.name}` };
          const updated = await caller.department.update({ id: created.id, ...updateData });
          expect(updated).toBeDefined();
          expect(updated?.name).toBe(updateData.name);

          // Delete department (should succeed since it's empty)
          const deleted = await caller.department.delete({ id: created.id });
          expect(deleted).toBe(true);

          // Verify deletion
          const afterDelete = await caller.department.getById({ id: created.id });
          expect(afterDelete).toBeUndefined();
        }
      ),
      { numRuns: 5 }
    );
  });

  it("Property 2: Department Name Uniqueness - For any department name that already exists in the system, attempting to create another department with the same name should fail with an appropriate error", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (baseName, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Make department name unique by adding timestamp and unique ID
          const uniqueName = `${baseName}_${Date.now()}_${uniqueId}`;

          // Create first department
          const firstDept = await caller.department.create({
            name: uniqueName,
            description: "First department"
          });
          expect(firstDept).toBeDefined();
          expect(firstDept.name).toBe(uniqueName);

          // Attempt to create second department with same name - should fail
          await expect(
            caller.department.create({
              name: uniqueName,
              description: "Second department with same name"
            })
          ).rejects.toThrow(/already exists/);

          // Clean up
          await caller.department.delete({ id: firstDept.id });
        }
      ),
      { numRuns: 5 }
    );
  });

  it("Property 3: Department Deletion Prevention - For any department that has assigned team members, attempting to delete the department should fail and return an appropriate error message", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          departmentName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          teamMemberName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          position: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (testData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Make names unique by adding timestamp and unique ID
          const uniqueDeptName = `${testData.departmentName}_${Date.now()}_${uniqueId}`;
          const uniqueMemberName = `${testData.teamMemberName}_${Date.now()}_${uniqueId}`;

          // Create a team member
          const teamMember = await caller.team.create({
            name: uniqueMemberName,
            position: testData.position,
          });
          expect(teamMember).toBeDefined();

          // Create a department
          const department = await caller.department.create({
            name: uniqueDeptName,
            description: "Test department"
          });
          expect(department).toBeDefined();

          // Assign the team member to the department using the helper function
          await createDepartmentAssignment({
            teamMemberId: teamMember.id,
            departmentId: department.id
          });

          // Attempt to delete department with assigned members - should fail
          await expect(
            caller.department.delete({ id: department.id })
          ).rejects.toThrow(/cannot delete department.*assigned team members/i);

          // Clean up - remove assignment first, then delete department and team member
          const db = await getDb();
          if (db) {
            await db.update(departmentAssignments)
              .set({ isActive: false })
              .where(and(
                eq(departmentAssignments.teamMemberId, teamMember.id),
                eq(departmentAssignments.departmentId, department.id)
              ));
          }

          // Now deletion should succeed
          const deleted = await caller.department.delete({ id: department.id });
          expect(deleted).toBe(true);

          // Clean up team member
          await caller.team.delete({ id: teamMember.id });
        }
      ),
      { numRuns: 3 }
    );
  }, 10000); // Increase timeout to 10 seconds

  it("Property 18: Data Integrity Maintenance - For any department operation, referential integrity should be maintained between departments, team members, and assignments", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          departmentName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          teamMemberName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          position: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (testData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Make names unique by adding timestamp and unique ID
          const uniqueDeptName = `${testData.departmentName}_${Date.now()}_${uniqueId}`;
          const uniqueMemberName = `${testData.teamMemberName}_${Date.now()}_${uniqueId}`;

          // Create a team member first
          const teamMember = await caller.team.create({
            name: uniqueMemberName,
            position: testData.position,
          });
          expect(teamMember).toBeDefined();
          expect(teamMember.id).toBeTypeOf("number");

          // Create a department with the team member as manager
          const department = await caller.department.create({
            name: uniqueDeptName,
            managerId: teamMember.id,
          });
          expect(department).toBeDefined();
          expect(department.managerId).toBe(teamMember.id);

          // Verify the department can be retrieved with correct manager reference
          const retrievedDept = await caller.department.getById({ id: department.id });
          expect(retrievedDept).toBeDefined();
          expect(retrievedDept?.managerId).toBe(teamMember.id);

          // Verify the team member still exists
          const retrievedMember = await caller.team.getById({ id: teamMember.id });
          expect(retrievedMember).toBeDefined();
          expect(retrievedMember?.id).toBe(teamMember.id);

          // Clean up - delete department first, then team member
          await caller.department.delete({ id: department.id });
          await caller.team.delete({ id: teamMember.id });
        }
      ),
      { numRuns: 5 }
    );
  });

  it("Property 4: Team Member Assignment Management - For any valid team member and department, the member can be assigned to the department, reassigned to a different department, and unassigned, with each operation updating the assignment state correctly", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          departmentName1: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          departmentName2: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          teamMemberName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          position: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (testData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Make names unique by adding timestamp and unique ID
          const uniqueDeptName1 = `${testData.departmentName1}_${Date.now()}_${uniqueId}`;
          const uniqueDeptName2 = `${testData.departmentName2}_${Date.now()}_${uniqueId}_2`;
          const uniqueMemberName = `${testData.teamMemberName}_${Date.now()}_${uniqueId}`;

          // Create a team member
          const teamMember = await caller.team.create({
            name: uniqueMemberName,
            position: testData.position,
          });
          expect(teamMember).toBeDefined();

          // Create two departments
          const department1 = await caller.department.create({
            name: uniqueDeptName1,
            description: "First department"
          });
          expect(department1).toBeDefined();

          const department2 = await caller.department.create({
            name: uniqueDeptName2,
            description: "Second department"
          });
          expect(department2).toBeDefined();

          // Test assignment: Assign team member to first department
          const assignment = await assignMemberToDepartment({
            teamMemberId: teamMember.id,
            departmentId: department1.id,
            assignedBy: teamMember.id // Self-assigned for testing
          });
          expect(assignment).toBeDefined();
          expect(assignment.teamMemberId).toBe(teamMember.id);
          expect(assignment.departmentId).toBe(department1.id);
          expect(assignment.isActive).toBe(true);

          // Test reassignment: Reassign team member to second department
          const reassignment = await reassignMember({
            teamMemberId: teamMember.id,
            newDepartmentId: department2.id,
            assignedBy: teamMember.id
          });
          expect(reassignment).toBeDefined();
          expect(reassignment.teamMemberId).toBe(teamMember.id);
          expect(reassignment.departmentId).toBe(department2.id);
          expect(reassignment.isActive).toBe(true);

          // Verify first assignment is now inactive (history preserved)
          const db = await getDb();
          if (db) {
            const oldAssignment = await db.select().from(departmentAssignments)
              .where(eq(departmentAssignments.id, assignment.id))
              .limit(1);
            expect(oldAssignment[0].isActive).toBe(false);
          }

          // Test unassignment: Remove team member from current department
          const unassigned = await unassignMemberFromDepartment({
            teamMemberId: teamMember.id,
            departmentId: department2.id
          });
          expect(unassigned).toBe(true);

          // Verify no active assignments remain
          if (db) {
            const activeAssignments = await db.select().from(departmentAssignments)
              .where(and(
                eq(departmentAssignments.teamMemberId, teamMember.id),
                eq(departmentAssignments.isActive, true)
              ));
            expect(activeAssignments).toHaveLength(0);
          }

          // Clean up
          await caller.department.delete({ id: department1.id });
          await caller.department.delete({ id: department2.id });
          await caller.team.delete({ id: teamMember.id });
        }
      ),
      { numRuns: 3 }
    );
  }, 15000); // Increase timeout to 15 seconds

  it("Property 6: Single Active Assignment Constraint - For any team member, they should have at most one active department assignment at any given time", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          departmentName1: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          departmentName2: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          departmentName3: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          teamMemberName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          position: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (testData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Make names unique by adding timestamp and unique ID
          const uniqueDeptName1 = `${testData.departmentName1}_${Date.now()}_${uniqueId}`;
          const uniqueDeptName2 = `${testData.departmentName2}_${Date.now()}_${uniqueId}_2`;
          const uniqueDeptName3 = `${testData.departmentName3}_${Date.now()}_${uniqueId}_3`;
          const uniqueMemberName = `${testData.teamMemberName}_${Date.now()}_${uniqueId}`;

          // Create a team member
          const teamMember = await caller.team.create({
            name: uniqueMemberName,
            position: testData.position,
          });
          expect(teamMember).toBeDefined();

          // Create three departments
          const department1 = await caller.department.create({
            name: uniqueDeptName1,
            description: "First department"
          });
          expect(department1).toBeDefined();

          const department2 = await caller.department.create({
            name: uniqueDeptName2,
            description: "Second department"
          });
          expect(department2).toBeDefined();

          const department3 = await caller.department.create({
            name: uniqueDeptName3,
            description: "Third department"
          });
          expect(department3).toBeDefined();

          const db = await getDb();
          if (!db) {
            throw new Error("Database not available");
          }

          // Assign team member to first department
          await assignMemberToDepartment({
            teamMemberId: teamMember.id,
            departmentId: department1.id,
            assignedBy: teamMember.id
          });

          // Verify only one active assignment exists
          let activeAssignments = await db.select().from(departmentAssignments)
            .where(and(
              eq(departmentAssignments.teamMemberId, teamMember.id),
              eq(departmentAssignments.isActive, true)
            ));
          expect(activeAssignments).toHaveLength(1);
          expect(activeAssignments[0].departmentId).toBe(department1.id);

          // Assign team member to second department (should deactivate first assignment)
          await assignMemberToDepartment({
            teamMemberId: teamMember.id,
            departmentId: department2.id,
            assignedBy: teamMember.id
          });

          // Verify still only one active assignment exists, now for department2
          activeAssignments = await db.select().from(departmentAssignments)
            .where(and(
              eq(departmentAssignments.teamMemberId, teamMember.id),
              eq(departmentAssignments.isActive, true)
            ));
          expect(activeAssignments).toHaveLength(1);
          expect(activeAssignments[0].departmentId).toBe(department2.id);

          // Assign team member to third department (should deactivate second assignment)
          await assignMemberToDepartment({
            teamMemberId: teamMember.id,
            departmentId: department3.id,
            assignedBy: teamMember.id
          });

          // Verify still only one active assignment exists, now for department3
          activeAssignments = await db.select().from(departmentAssignments)
            .where(and(
              eq(departmentAssignments.teamMemberId, teamMember.id),
              eq(departmentAssignments.isActive, true)
            ));
          expect(activeAssignments).toHaveLength(1);
          expect(activeAssignments[0].departmentId).toBe(department3.id);

          // Verify that all assignments exist in history (3 total, 1 active, 2 inactive)
          const allAssignments = await db.select().from(departmentAssignments)
            .where(eq(departmentAssignments.teamMemberId, teamMember.id));
          expect(allAssignments).toHaveLength(3);

          const inactiveAssignments = allAssignments.filter(a => !a.isActive);
          expect(inactiveAssignments).toHaveLength(2);

          // Clean up
          await unassignMemberFromDepartment({ teamMemberId: teamMember.id });
          await caller.department.delete({ id: department1.id });
          await caller.department.delete({ id: department2.id });
          await caller.department.delete({ id: department3.id });
          await caller.team.delete({ id: teamMember.id });
        }
      ),
      { numRuns: 3 }
    );
  }, 20000); // Increase timeout to 20 seconds

  it("Property 8: Department Existence Validation - For any assignment operation, attempting to assign a team member to a non-existent department should fail with an appropriate error", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          teamMemberName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          position: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        fc.integer({ min: 999999, max: 9999999 }), // Non-existent department ID
        async (testData, uniqueId, nonExistentDeptId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Make names unique by adding timestamp and unique ID
          const uniqueMemberName = `${testData.teamMemberName}_${Date.now()}_${uniqueId}`;

          // Create a team member
          const teamMember = await caller.team.create({
            name: uniqueMemberName,
            position: testData.position,
          });
          expect(teamMember).toBeDefined();

          // Attempt to assign team member to non-existent department - should fail
          await expect(
            assignMemberToDepartment({
              teamMemberId: teamMember.id,
              departmentId: nonExistentDeptId,
              assignedBy: teamMember.id
            })
          ).rejects.toThrow(/Department with ID .* does not exist/);

          // Attempt to reassign team member to non-existent department - should also fail
          await expect(
            reassignMember({
              teamMemberId: teamMember.id,
              newDepartmentId: nonExistentDeptId,
              assignedBy: teamMember.id
            })
          ).rejects.toThrow(/Department with ID .* does not exist/);

          // Clean up
          await caller.team.delete({ id: teamMember.id });
        }
      ),
      { numRuns: 3 }
    );
  }, 15000); // Increase timeout to 15 seconds

  it("Property 9: Department Hierarchy Management - For any valid parent-child department relationship, the hierarchy can be created and supports multiple nesting levels, with root-level departments allowed", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          rootDeptName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          childDeptName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          grandchildDeptName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (testData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Make names unique by adding timestamp and unique ID
          const uniqueRootName = `${testData.rootDeptName}_${Date.now()}_${uniqueId}`;
          const uniqueChildName = `${testData.childDeptName}_${Date.now()}_${uniqueId}`;
          const uniqueGrandchildName = `${testData.grandchildDeptName}_${Date.now()}_${uniqueId}`;

          // Create root department (no parent)
          const rootDept = await caller.department.create({
            name: uniqueRootName,
            description: "Root department"
          });
          expect(rootDept).toBeDefined();
          expect(rootDept.parentId).toBeNull();

          // Create child department
          const childDept = await caller.department.create({
            name: uniqueChildName,
            description: "Child department"
          });
          expect(childDept).toBeDefined();

          // Create grandchild department
          const grandchildDept = await caller.department.create({
            name: uniqueGrandchildName,
            description: "Grandchild department"
          });
          expect(grandchildDept).toBeDefined();

          // Set up hierarchy: root -> child -> grandchild
          const updatedChild = await setDepartmentParent(childDept.id, rootDept.id);
          expect(updatedChild).toBeDefined();
          expect(updatedChild?.parentId).toBe(rootDept.id);

          const updatedGrandchild = await setDepartmentParent(grandchildDept.id, childDept.id);
          expect(updatedGrandchild).toBeDefined();
          expect(updatedGrandchild?.parentId).toBe(childDept.id);

          // Test hierarchy retrieval
          const hierarchy = await getDepartmentHierarchy();
          expect(hierarchy).toBeDefined();
          expect(Array.isArray(hierarchy)).toBe(true);

          // Find our root department in the hierarchy
          const rootInHierarchy = hierarchy.find(dept => dept.id === rootDept.id);
          expect(rootInHierarchy).toBeDefined();
          expect(rootInHierarchy?.children).toHaveLength(1);
          expect(rootInHierarchy?.children[0].id).toBe(childDept.id);
          expect(rootInHierarchy?.children[0].children).toHaveLength(1);
          expect(rootInHierarchy?.children[0].children[0].id).toBe(grandchildDept.id);

          // Test path retrieval
          const grandchildPath = await getDepartmentPath(grandchildDept.id);
          expect(grandchildPath).toHaveLength(3);
          expect(grandchildPath[0].id).toBe(rootDept.id);
          expect(grandchildPath[1].id).toBe(childDept.id);
          expect(grandchildPath[2].id).toBe(grandchildDept.id);

          // Test children retrieval
          const rootChildren = await getDepartmentChildren(rootDept.id, false);
          expect(rootChildren).toHaveLength(1);
          expect(rootChildren[0].id).toBe(childDept.id);

          const rootDescendants = await getDepartmentChildren(rootDept.id, true);
          expect(rootDescendants).toHaveLength(2);
          expect(rootDescendants.map(d => d.id)).toContain(childDept.id);
          expect(rootDescendants.map(d => d.id)).toContain(grandchildDept.id);

          // Clean up - delete in reverse hierarchy order
          await caller.department.delete({ id: grandchildDept.id });
          await caller.department.delete({ id: childDept.id });
          await caller.department.delete({ id: rootDept.id });
        }
      ),
      { numRuns: 3 }
    );
  }, 20000); // Increase timeout to 20 seconds

  it("Property 10: Circular Reference Prevention - For any department hierarchy modification that would create a circular reference, the operation should be rejected with an appropriate error", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          deptName1: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          deptName2: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          deptName3: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (testData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Make names unique by adding timestamp and unique ID
          const uniqueName1 = `${testData.deptName1}_${Date.now()}_${uniqueId}`;
          const uniqueName2 = `${testData.deptName2}_${Date.now()}_${uniqueId}`;
          const uniqueName3 = `${testData.deptName3}_${Date.now()}_${uniqueId}`;

          // Create three departments
          const dept1 = await caller.department.create({
            name: uniqueName1,
            description: "Department 1"
          });
          expect(dept1).toBeDefined();

          const dept2 = await caller.department.create({
            name: uniqueName2,
            description: "Department 2"
          });
          expect(dept2).toBeDefined();

          const dept3 = await caller.department.create({
            name: uniqueName3,
            description: "Department 3"
          });
          expect(dept3).toBeDefined();

          // Create a valid hierarchy: dept1 -> dept2 -> dept3
          await setDepartmentParent(dept2.id, dept1.id);
          await setDepartmentParent(dept3.id, dept2.id);

          // Test Case 1: Direct circular reference (dept1 -> dept2, then try dept2 -> dept1)
          await expect(
            setDepartmentParent(dept1.id, dept2.id)
          ).rejects.toThrow(/circular reference/i);

          // Test Case 2: Indirect circular reference (dept1 -> dept2 -> dept3, then try dept1 -> dept3)
          await expect(
            setDepartmentParent(dept1.id, dept3.id)
          ).rejects.toThrow(/circular reference/i);

          // Test Case 3: Self-reference (dept1 -> dept1)
          await expect(
            setDepartmentParent(dept1.id, dept1.id)
          ).rejects.toThrow(/circular reference/i);

          // Test Case 4: Valid operations should still work
          // Create a fourth department and make it a sibling of dept2
          const dept4 = await caller.department.create({
            name: `${testData.deptName1}_sibling_${Date.now()}_${uniqueId}`,
            description: "Department 4 - sibling"
          });
          expect(dept4).toBeDefined();

          // This should work: dept1 -> [dept2, dept4] (dept4 as sibling to dept2)
          const updatedDept4 = await setDepartmentParent(dept4.id, dept1.id);
          expect(updatedDept4).toBeDefined();
          expect(updatedDept4?.parentId).toBe(dept1.id);

          // Verify hierarchy is still intact
          const hierarchy = await getDepartmentHierarchy();
          const dept1InHierarchy = hierarchy.find(d => d.id === dept1.id);
          expect(dept1InHierarchy).toBeDefined();
          expect(dept1InHierarchy?.children).toHaveLength(2); // dept2 and dept4
          
          const dept2InHierarchy = dept1InHierarchy?.children.find(d => d.id === dept2.id);
          expect(dept2InHierarchy).toBeDefined();
          expect(dept2InHierarchy?.children).toHaveLength(1); // dept3

          // Clean up - delete in reverse hierarchy order
          await caller.department.delete({ id: dept3.id });
          await caller.department.delete({ id: dept2.id });
          await caller.department.delete({ id: dept4.id });
          await caller.department.delete({ id: dept1.id });
        }
      ),
      { numRuns: 3 }
    );
  }, 25000); // Increase timeout to 25 seconds

  it("Property 11: Hierarchy Referential Integrity - For any department deletion in a hierarchy, the system should maintain referential integrity by appropriately handling child departments", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          rootDeptName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          childDeptName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          grandchildDeptName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        fc.constantFrom('promote', 'prevent'), // Test both strategies
        async (testData, uniqueId, strategy) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Make names unique by adding timestamp and unique ID
          const uniqueRootName = `${testData.rootDeptName}_${Date.now()}_${uniqueId}`;
          const uniqueChildName = `${testData.childDeptName}_${Date.now()}_${uniqueId}`;
          const uniqueGrandchildName = `${testData.grandchildDeptName}_${Date.now()}_${uniqueId}`;

          // Create a three-level hierarchy: root -> child -> grandchild
          const rootDept = await caller.department.create({
            name: uniqueRootName,
            description: "Root department"
          });
          expect(rootDept).toBeDefined();

          const childDept = await caller.department.create({
            name: uniqueChildName,
            description: "Child department"
          });
          expect(childDept).toBeDefined();

          const grandchildDept = await caller.department.create({
            name: uniqueGrandchildName,
            description: "Grandchild department"
          });
          expect(grandchildDept).toBeDefined();

          // Set up hierarchy: root -> child -> grandchild
          await setDepartmentParent(childDept.id, rootDept.id);
          await setDepartmentParent(grandchildDept.id, childDept.id);

          // Verify initial hierarchy
          const initialHierarchy = await getDepartmentHierarchy();
          const rootInHierarchy = initialHierarchy.find(d => d.id === rootDept.id);
          expect(rootInHierarchy).toBeDefined();
          expect(rootInHierarchy?.children).toHaveLength(1);
          expect(rootInHierarchy?.children[0].id).toBe(childDept.id);
          expect(rootInHierarchy?.children[0].children).toHaveLength(1);
          expect(rootInHierarchy?.children[0].children[0].id).toBe(grandchildDept.id);

          if (strategy === 'promote') {
            // Test promote strategy: delete middle department, grandchild should be promoted to root
            const deleted = await deleteDepartmentWithStrategy(childDept.id, 'promote');
            expect(deleted).toBe(true);

            // Verify grandchild is now a direct child of root
            const updatedHierarchy = await getDepartmentHierarchy();
            const rootAfterDeletion = updatedHierarchy.find(d => d.id === rootDept.id);
            expect(rootAfterDeletion).toBeDefined();
            expect(rootAfterDeletion?.children).toHaveLength(1);
            expect(rootAfterDeletion?.children[0].id).toBe(grandchildDept.id);

            // Verify the grandchild's parentId was updated
            const updatedGrandchild = await caller.department.getById({ id: grandchildDept.id });
            expect(updatedGrandchild).toBeDefined();
            expect(updatedGrandchild?.parentId).toBe(rootDept.id);

            // Clean up remaining departments
            await caller.department.delete({ id: grandchildDept.id });
            await caller.department.delete({ id: rootDept.id });

          } else if (strategy === 'prevent') {
            // Test prevent strategy: attempt to delete middle department should fail
            await expect(
              deleteDepartmentWithStrategy(childDept.id, 'prevent')
            ).rejects.toThrow(/cannot delete department.*child departments/i);

            // Verify hierarchy is unchanged
            const unchangedHierarchy = await getDepartmentHierarchy();
            const rootUnchanged = unchangedHierarchy.find(d => d.id === rootDept.id);
            expect(rootUnchanged).toBeDefined();
            expect(rootUnchanged?.children).toHaveLength(1);
            expect(rootUnchanged?.children[0].id).toBe(childDept.id);
            expect(rootUnchanged?.children[0].children).toHaveLength(1);
            expect(rootUnchanged?.children[0].children[0].id).toBe(grandchildDept.id);

            // Clean up - delete in reverse hierarchy order
            await caller.department.delete({ id: grandchildDept.id });
            await caller.department.delete({ id: childDept.id });
            await caller.department.delete({ id: rootDept.id });
          }
        }
      ),
      { numRuns: 3 }
    );
  }, 30000); // Increase timeout to 30 seconds

  it("Property 25: Assignment During Creation - For any team member creation with department assignment, the member should be created and assigned to the specified department in a single operation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          teamMemberName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          position: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          departmentName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          duties: fc.option(fc.string({ maxLength: 200 })),
          email: fc.option(fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.includes('@'))),
          phone: fc.option(fc.string({ minLength: 5, maxLength: 20 })),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (testData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Make names unique by adding timestamp and unique ID
          const uniqueMemberName = `${testData.teamMemberName}_${Date.now()}_${uniqueId}`;
          const uniqueDeptName = `${testData.departmentName}_${Date.now()}_${uniqueId}`;

          // Create a department first
          const department = await caller.department.create({
            name: uniqueDeptName,
            description: "Test department for assignment during creation"
          });
          expect(department).toBeDefined();
          expect(department.id).toBeTypeOf("number");

          // Create team member with department assignment using the new function
          const teamMemberData = {
            name: uniqueMemberName,
            position: testData.position,
            duties: testData.duties || undefined,
            email: testData.email || undefined,
            phone: testData.phone || undefined,
            departmentId: department.id
          };

          const createdMember = await createTeamMemberWithDepartment(teamMemberData);
          expect(createdMember).toBeDefined();
          expect(createdMember.name).toBe(uniqueMemberName);
          expect(createdMember.position).toBe(testData.position);
          expect(createdMember.id).toBeTypeOf("number");

          // Verify the team member was assigned to the department
          const departmentMembers = await caller.department.getMembers({
            departmentId: department.id
          });
          expect(departmentMembers).toBeDefined();
          expect(Array.isArray(departmentMembers)).toBe(true);
          expect(departmentMembers).toHaveLength(1);
          expect(departmentMembers[0].id).toBe(createdMember.id);
          expect(departmentMembers[0].name).toBe(uniqueMemberName);

          // Verify the assignment is active in the database
          const db = await getDb();
          if (db) {
            const activeAssignments = await db.select().from(departmentAssignments)
              .where(and(
                eq(departmentAssignments.teamMemberId, createdMember.id),
                eq(departmentAssignments.departmentId, department.id),
                eq(departmentAssignments.isActive, true)
              ));
            expect(activeAssignments).toHaveLength(1);
            expect(activeAssignments[0].teamMemberId).toBe(createdMember.id);
            expect(activeAssignments[0].departmentId).toBe(department.id);
            expect(activeAssignments[0].isActive).toBe(true);
          }

          // Test that creation without department also works (backward compatibility)
          const memberWithoutDept = await createTeamMemberWithDepartment({
            name: `${uniqueMemberName}_no_dept`,
            position: testData.position
            // No departmentId provided
          });
          expect(memberWithoutDept).toBeDefined();
          expect(memberWithoutDept.name).toBe(`${uniqueMemberName}_no_dept`);

          // Verify no assignment was created for the member without department
          const membersWithoutDept = await caller.department.getMembers({
            departmentId: department.id
          });
          expect(membersWithoutDept).toHaveLength(1); // Still only the first member

          // Clean up
          await unassignMemberFromDepartment({ teamMemberId: createdMember.id });
          await caller.department.delete({ id: department.id });
          await caller.team.delete({ id: createdMember.id });
          await caller.team.delete({ id: memberWithoutDept.id });
        }
      ),
      { numRuns: 5 }
    );
  }, 15000); // Increase timeout to 15 seconds

  it("Property 15: Department Reporting Accuracy - For any department report generation, the report should accurately reflect team member distribution, department sizes, hierarchy metrics, and unassigned members", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          departments: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
              description: fc.option(fc.string({ maxLength: 100 })),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          teamMembers: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
              position: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            }),
            { minLength: 1, maxLength: 8 }
          ),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (testData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          const timestamp = Date.now();
          const createdDepartments: any[] = [];
          const createdTeamMembers: any[] = [];

          try {
            // Create departments with unique names
            for (let i = 0; i < testData.departments.length; i++) {
              const deptData = testData.departments[i];
              const uniqueName = `${deptData.name}_${timestamp}_${uniqueId}_${i}`;
              
              const department = await caller.department.create({
                name: uniqueName,
                description: deptData.description || undefined,
              });
              expect(department).toBeDefined();
              createdDepartments.push(department);
            }

            // Create team members with unique names
            for (let i = 0; i < testData.teamMembers.length; i++) {
              const memberData = testData.teamMembers[i];
              const uniqueName = `${memberData.name}_${timestamp}_${uniqueId}_${i}`;
              
              const teamMember = await caller.team.create({
                name: uniqueName,
                position: memberData.position,
              });
              expect(teamMember).toBeDefined();
              createdTeamMembers.push(teamMember);
            }

            // Assign some team members to departments (leave some unassigned)
            const assignmentPromises: Promise<any>[] = [];
            for (let i = 0; i < Math.min(createdTeamMembers.length, createdDepartments.length); i++) {
              // Assign first N members to departments (where N = min(members, departments))
              if (i < createdDepartments.length) {
                assignmentPromises.push(
                  assignMemberToDepartment({
                    teamMemberId: createdTeamMembers[i].id,
                    departmentId: createdDepartments[i % createdDepartments.length].id,
                    assignedBy: createdTeamMembers[i].id
                  })
                );
              }
            }
            await Promise.all(assignmentPromises);

            // Create a simple hierarchy if we have multiple departments
            if (createdDepartments.length >= 2) {
              await setDepartmentParent(createdDepartments[1].id, createdDepartments[0].id);
            }

            // Get department statistics report
            const stats = await caller.department.getStats();
            expect(stats).toBeDefined();
            expect(typeof stats.totalDepartments).toBe('number');
            expect(typeof stats.totalAssignedMembers).toBe('number');
            expect(typeof stats.totalUnassignedMembers).toBe('number');
            expect(typeof stats.averageDepartmentSize).toBe('number');
            expect(typeof stats.maxHierarchyDepth).toBe('number');
            expect(Array.isArray(stats.departmentSizeDistribution)).toBe(true);
            expect(typeof stats.hierarchyMetrics).toBe('object');

            // Verify total departments count
            expect(stats.totalDepartments).toBeGreaterThanOrEqual(createdDepartments.length);

            // Verify department size distribution accuracy
            for (const deptStat of stats.departmentSizeDistribution) {
              const createdDept = createdDepartments.find(d => d.id === deptStat.departmentId);
              if (createdDept) {
                expect(deptStat.departmentName).toBe(createdDept.name);
                expect(typeof deptStat.memberCount).toBe('number');
                expect(deptStat.memberCount).toBeGreaterThanOrEqual(0);
              }
            }

            // Verify hierarchy metrics
            expect(typeof stats.hierarchyMetrics.rootDepartments).toBe('number');
            expect(typeof stats.hierarchyMetrics.departmentsWithChildren).toBe('number');
            expect(typeof stats.hierarchyMetrics.departmentsWithoutChildren).toBe('number');
            expect(stats.hierarchyMetrics.rootDepartments + stats.hierarchyMetrics.departmentsWithChildren).toBeLessThanOrEqual(stats.totalDepartments);

            // Get team member distribution report
            const distributionReport = await caller.department.getDistributionReport();
            expect(distributionReport).toBeDefined();
            expect(typeof distributionReport.totalTeamMembers).toBe('number');
            expect(typeof distributionReport.assignedMembers).toBe('number');
            expect(typeof distributionReport.unassignedMembers).toBe('number');
            expect(Array.isArray(distributionReport.departmentDistribution)).toBe(true);
            expect(Array.isArray(distributionReport.unassignedMembersList)).toBe(true);

            // Verify team member counts add up
            expect(distributionReport.assignedMembers + distributionReport.unassignedMembers).toBe(distributionReport.totalTeamMembers);

            // Verify department distribution accuracy
            for (const deptDist of distributionReport.departmentDistribution) {
              expect(typeof deptDist.departmentId).toBe('number');
              expect(typeof deptDist.departmentName).toBe('string');
              expect(typeof deptDist.memberCount).toBe('number');
              expect(Array.isArray(deptDist.members)).toBe(true);
              expect(deptDist.members).toHaveLength(deptDist.memberCount);
            }

            // Get unassigned members report
            const unassignedMembers = await caller.department.getUnassignedMembers();
            expect(Array.isArray(unassignedMembers)).toBe(true);
            expect(unassignedMembers).toHaveLength(distributionReport.unassignedMembers);

            // Verify unassigned members list matches the count
            expect(unassignedMembers.every(member => 
              typeof member.id === 'number' && 
              typeof member.name === 'string' && 
              typeof member.position === 'string'
            )).toBe(true);

          } finally {
            // Clean up - unassign all members first, then delete departments and team members
            for (const member of createdTeamMembers) {
              try {
                await unassignMemberFromDepartment({ teamMemberId: member.id });
              } catch (error) {
                // Ignore errors for members that weren't assigned
              }
            }

            // Delete departments (children first if hierarchy exists)
            const departmentsToDelete = [...createdDepartments].reverse();
            for (const dept of departmentsToDelete) {
              try {
                await caller.department.delete({ id: dept.id });
              } catch (error) {
                // Ignore errors for departments that might have been deleted already
              }
            }

            // Delete team members
            for (const member of createdTeamMembers) {
              try {
                await caller.team.delete({ id: member.id });
              } catch (error) {
                // Ignore errors for members that might have been deleted already
              }
            }
          }
        }
      ),
      { numRuns: 3 }
    );
  }, 30000); // Increase timeout to 30 seconds

  it("Property 16: Report Export Functionality - For any department data export operation, the exported data should contain complete and accurate department information and organizational structure", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          departments: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              description: fc.option(fc.string({ maxLength: 50 })),
            }),
            { minLength: 1, maxLength: 2 }
          ),
          teamMembers: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              position: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              email: fc.option(fc.constantFrom("test@example.com", "user@domain.org", "admin@company.net")),
              phone: fc.option(fc.string({ minLength: 5, maxLength: 12 })),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          includeHistoricalData: fc.boolean(),
          exportedBy: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (testData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          const timestamp = Date.now();
          const createdDepartments: any[] = [];
          const createdTeamMembers: any[] = [];

          try {
            // Create departments with unique names
            for (let i = 0; i < testData.departments.length; i++) {
              const deptData = testData.departments[i];
              const uniqueName = `${deptData.name}_${timestamp}_${uniqueId}_${i}`;
              
              const department = await caller.department.create({
                name: uniqueName,
                description: deptData.description || undefined,
              });
              expect(department).toBeDefined();
              createdDepartments.push(department);
            }

            // Create team members with unique names
            for (let i = 0; i < testData.teamMembers.length; i++) {
              const memberData = testData.teamMembers[i];
              const uniqueName = `${memberData.name}_${timestamp}_${uniqueId}_${i}`;
              
              const teamMember = await caller.team.create({
                name: uniqueName,
                position: memberData.position,
                email: memberData.email || undefined,
                phone: memberData.phone || undefined,
              });
              expect(teamMember).toBeDefined();
              createdTeamMembers.push(teamMember);
            }

            // Create a simple hierarchy if we have multiple departments
            if (createdDepartments.length >= 2) {
              await setDepartmentParent(createdDepartments[1].id, createdDepartments[0].id);
            }

            // Assign some team members to departments
            const assignmentPromises: Promise<any>[] = [];
            for (let i = 0; i < Math.min(createdTeamMembers.length, createdDepartments.length); i++) {
              assignmentPromises.push(
                assignMemberToDepartment({
                  teamMemberId: createdTeamMembers[i].id,
                  departmentId: createdDepartments[i % createdDepartments.length].id,
                  assignedBy: createdTeamMembers[i].id
                })
              );
            }
            await Promise.all(assignmentPromises);

            // Create some assignment history by reassigning members
            if (createdTeamMembers.length >= 2 && createdDepartments.length >= 2) {
              await reassignMember({
                teamMemberId: createdTeamMembers[0].id,
                newDepartmentId: createdDepartments[1].id,
                assignedBy: createdTeamMembers[0].id
              });
            }

            // Test export functionality
            const exportData = await caller.department.exportData({
              includeHistoricalData: testData.includeHistoricalData,
              exportedBy: testData.exportedBy || undefined,
            });

            // Verify export metadata
            expect(exportData).toBeDefined();
            expect(exportData.exportMetadata).toBeDefined();
            expect(exportData.exportMetadata.exportDate).toBeInstanceOf(Date);
            expect(exportData.exportMetadata.totalDepartments).toBeGreaterThanOrEqual(createdDepartments.length);
            expect(exportData.exportMetadata.totalTeamMembers).toBeGreaterThanOrEqual(createdTeamMembers.length);
            expect(typeof exportData.exportMetadata.totalAssignments).toBe('number');
            
            if (testData.exportedBy) {
              expect(exportData.exportMetadata.exportedBy).toBe(testData.exportedBy);
            }

            // Verify departments data completeness and accuracy
            expect(Array.isArray(exportData.departments)).toBe(true);
            expect(exportData.departments.length).toBeGreaterThanOrEqual(createdDepartments.length);

            for (const createdDept of createdDepartments) {
              const exportedDept = exportData.departments.find(d => d.id === createdDept.id);
              expect(exportedDept).toBeDefined();
              expect(exportedDept?.name).toBe(createdDept.name);
              expect(exportedDept?.description).toBe(createdDept.description);
              expect(exportedDept?.id).toBe(createdDept.id);
              expect(typeof exportedDept?.memberCount).toBe('number');
              expect(Array.isArray(exportedDept?.currentMembers)).toBe(true);
              expect(exportedDept?.createdAt).toBeInstanceOf(Date);
              expect(exportedDept?.updatedAt).toBeInstanceOf(Date);
            }

            // Verify hierarchy structure is included
            expect(Array.isArray(exportData.hierarchyStructure)).toBe(true);
            expect(exportData.hierarchyStructure.length).toBeGreaterThanOrEqual(0);

            // Find our created departments in hierarchy
            for (const createdDept of createdDepartments) {
              const deptInHierarchy = exportData.hierarchyStructure.find(d => d.id === createdDept.id);
              if (deptInHierarchy) {
                expect(deptInHierarchy.name).toBe(createdDept.name);
                expect(Array.isArray(deptInHierarchy.children)).toBe(true);
              }
            }

            // Verify unassigned members data
            expect(Array.isArray(exportData.unassignedMembers)).toBe(true);
            for (const unassignedMember of exportData.unassignedMembers) {
              expect(typeof unassignedMember.id).toBe('number');
              expect(typeof unassignedMember.name).toBe('string');
              expect(typeof unassignedMember.position).toBe('string');
              expect(unassignedMember.createdAt).toBeInstanceOf(Date);
            }

            // Verify assignment history based on includeHistoricalData flag
            expect(Array.isArray(exportData.assignmentHistory)).toBe(true);
            if (testData.includeHistoricalData) {
              // Should include historical data
              expect(exportData.assignmentHistory.length).toBeGreaterThanOrEqual(0);
              for (const assignment of exportData.assignmentHistory) {
                expect(typeof assignment.id).toBe('number');
                expect(typeof assignment.teamMemberId).toBe('number');
                expect(typeof assignment.teamMemberName).toBe('string');
                expect(typeof assignment.departmentId).toBe('number');
                expect(typeof assignment.departmentName).toBe('string');
                expect(assignment.assignedAt).toBeInstanceOf(Date);
                expect(typeof assignment.isActive).toBe('boolean');
              }
            }

            // Test JSON export format
            const jsonExport = await caller.department.exportJSON({
              includeHistoricalData: testData.includeHistoricalData,
              exportedBy: testData.exportedBy || undefined,
            });
            expect(typeof jsonExport).toBe('string');
            
            // Verify JSON is valid and contains same data
            const parsedJson = JSON.parse(jsonExport);
            expect(parsedJson.exportMetadata).toBeDefined();
            expect(Array.isArray(parsedJson.departments)).toBe(true);
            expect(Array.isArray(parsedJson.hierarchyStructure)).toBe(true);
            expect(Array.isArray(parsedJson.unassignedMembers)).toBe(true);
            expect(Array.isArray(parsedJson.assignmentHistory)).toBe(true);

            // Test CSV export format
            const csvExport = await caller.department.exportCSV({
              includeHistoricalData: testData.includeHistoricalData,
              exportedBy: testData.exportedBy || undefined,
            });
            expect(typeof csvExport).toBe('object');
            expect(typeof csvExport.departments).toBe('string');
            expect(typeof csvExport.unassignedMembers).toBe('string');
            expect(typeof csvExport.assignments).toBe('string');

            // Verify CSV format contains headers and data
            expect(csvExport.departments).toContain('ID,Name,Description');
            expect(csvExport.unassignedMembers).toContain('ID,Name,Position');
            
            if (testData.includeHistoricalData) {
              expect(csvExport.assignments).toContain('ID,Team Member ID,Team Member Name');
            }

            // Verify CSV contains our created data
            for (const createdDept of createdDepartments) {
              expect(csvExport.departments).toContain(createdDept.id.toString());
              expect(csvExport.departments).toContain(`"${createdDept.name}"`);
            }

          } finally {
            // Clean up - unassign all members first, then delete departments and team members
            for (const member of createdTeamMembers) {
              try {
                await unassignMemberFromDepartment({ teamMemberId: member.id });
              } catch (error) {
                // Ignore errors for members that weren't assigned
              }
            }

            // Delete departments (children first if hierarchy exists)
            const departmentsToDelete = [...createdDepartments].reverse();
            for (const dept of departmentsToDelete) {
              try {
                await caller.department.delete({ id: dept.id });
              } catch (error) {
                // Ignore errors for departments that might have been deleted already
              }
            }

            // Delete team members
            for (const member of createdTeamMembers) {
              try {
                await caller.team.delete({ id: member.id });
              } catch (error) {
                // Ignore errors for members that might have been deleted already
              }
            }
          }
        }
      ),
      { numRuns: 2 }
    );
  }, 30000); // Increase timeout to 30 seconds for comprehensive export testing

  it("Property 26: Existing Functionality Preservation - For any existing team member search, filter, or data access operation, it should continue to work correctly after department management implementation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          teamMemberName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          position: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          email: fc.option(fc.emailAddress()),
          phone: fc.option(fc.string({ minLength: 5, maxLength: 20 })),
          duties: fc.option(fc.string({ maxLength: 200 })),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (memberData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          // Make member name unique
          const uniqueName = `${memberData.teamMemberName}_${Date.now()}_${uniqueId}`;

          try {
            // Test 1: Create team member using original functionality
            const createdMember = await caller.team.create({
              name: uniqueName,
              position: memberData.position,
              email: memberData.email || undefined,
              phone: memberData.phone || undefined,
              duties: memberData.duties || undefined,
            });

            expect(createdMember).toBeDefined();
            expect(createdMember.name).toBe(uniqueName);
            expect(createdMember.position).toBe(memberData.position);

            // Test 2: List team members using original functionality
            const originalList = await caller.team.list();
            expect(originalList).toBeDefined();
            expect(Array.isArray(originalList)).toBe(true);
            const foundMember = originalList.find(m => m.id === createdMember.id);
            expect(foundMember).toBeDefined();
            expect(foundMember?.name).toBe(uniqueName);

            // Test 3: Get team member by ID using original functionality
            const retrievedMember = await caller.team.getById({ id: createdMember.id });
            expect(retrievedMember).toBeDefined();
            expect(retrievedMember?.name).toBe(uniqueName);
            expect(retrievedMember?.position).toBe(memberData.position);

            // Test 4: Update team member using original functionality
            const updatedPosition = `Updated_${memberData.position}`;
            const updatedMember = await caller.team.update({
              id: createdMember.id,
              position: updatedPosition,
            });
            expect(updatedMember).toBeDefined();
            expect(updatedMember?.position).toBe(updatedPosition);

            // Test 5: Verify enhanced functionality still works alongside original
            const listWithDepartments = await caller.team.listWithDepartments();
            expect(listWithDepartments).toBeDefined();
            expect(Array.isArray(listWithDepartments)).toBe(true);
            const foundMemberWithDept = listWithDepartments.find(m => m.id === createdMember.id);
            expect(foundMemberWithDept).toBeDefined();
            expect(foundMemberWithDept?.name).toBe(uniqueName);
            expect(foundMemberWithDept?.position).toBe(updatedPosition);
            // Should have currentDepartment property (undefined is acceptable for unassigned)
            expect('currentDepartment' in foundMemberWithDept!).toBe(true);

            // Test 6: Delete team member using original functionality
            await caller.team.delete({ id: createdMember.id });

            // Verify deletion worked
            const deletedMember = await caller.team.getById({ id: createdMember.id });
            expect(deletedMember).toBeUndefined();

          } catch (error) {
            // Clean up on error
            try {
              const allMembers = await caller.team.list();
              const memberToDelete = allMembers.find(m => m.name === uniqueName);
              if (memberToDelete) {
                await caller.team.delete({ id: memberToDelete.id });
              }
            } catch (cleanupError) {
              // Ignore cleanup errors
            }
            throw error;
          }
        }
      ),
      { numRuns: 3 }
    );
  }, 15000);

  it("Property 22: Audit Logging - For any department-related data modification operation, an audit log entry should be created with appropriate details", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          departmentName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          teamMemberName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          position: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          updatedName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (testData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          const timestamp = Date.now();
          const uniqueDeptName = `${testData.departmentName}_${timestamp}_${uniqueId}`;
          const uniqueMemberName = `${testData.teamMemberName}_${timestamp}_${uniqueId}`;
          const uniqueUpdatedName = `${testData.updatedName}_${timestamp}_${uniqueId}`;

          // Test 1: Department creation should create audit log
          const department = await caller.department.create({
            name: uniqueDeptName,
            description: "Test department for audit logging"
          });
          expect(department).toBeDefined();

          // Check audit log for department creation
          const createLogs = await getAuditLogs({
            entityType: 'DEPARTMENT',
            entityId: department.id,
            operation: 'CREATE',
            limit: 10
          });
          expect(createLogs.length).toBeGreaterThanOrEqual(1);
          
          const createLog = createLogs.find(log => 
            log.operation === 'CREATE' && 
            log.entityType === 'DEPARTMENT' && 
            log.entityId === department.id
          );
          expect(createLog).toBeDefined();
          expect(createLog?.details).toBeDefined();
          
          if (createLog?.details) {
            const details = JSON.parse(createLog.details);
            expect(details.departmentName).toBe(uniqueDeptName);
            expect(details.description).toBe("Test department for audit logging");
          }

          // Test 2: Department update should create audit log
          const updatedDepartment = await caller.department.update({
            id: department.id,
            name: uniqueUpdatedName,
            description: "Updated description"
          });
          expect(updatedDepartment).toBeDefined();

          // Check audit log for department update
          const updateLogs = await getAuditLogs({
            entityType: 'DEPARTMENT',
            entityId: department.id,
            operation: 'UPDATE',
            limit: 10
          });
          expect(updateLogs.length).toBeGreaterThanOrEqual(1);
          
          const updateLog = updateLogs.find(log => 
            log.operation === 'UPDATE' && 
            log.entityType === 'DEPARTMENT' && 
            log.entityId === department.id
          );
          expect(updateLog).toBeDefined();
          expect(updateLog?.details).toBeDefined();
          
          if (updateLog?.details) {
            const details = JSON.parse(updateLog.details);
            expect(details.previousValues).toBeDefined();
            expect(details.newValues).toBeDefined();
            expect(details.previousValues.name).toBe(uniqueDeptName);
            expect(details.newValues.name).toBe(uniqueUpdatedName);
          }

          // Test 3: Team member creation with department assignment should create audit logs
          const teamMember = await caller.team.createWithDepartment({
            name: uniqueMemberName,
            position: testData.position,
            departmentId: department.id
          });
          expect(teamMember).toBeDefined();

          // Check audit log for team member creation
          const memberCreateLogs = await getAuditLogs({
            entityType: 'TEAM_MEMBER',
            entityId: teamMember.id,
            operation: 'CREATE',
            limit: 10
          });
          expect(memberCreateLogs.length).toBeGreaterThanOrEqual(1);
          
          const memberCreateLog = memberCreateLogs.find(log => 
            log.operation === 'CREATE' && 
            log.entityType === 'TEAM_MEMBER' && 
            log.entityId === teamMember.id
          );
          expect(memberCreateLog).toBeDefined();
          expect(memberCreateLog?.details).toBeDefined();
          
          if (memberCreateLog?.details) {
            const details = JSON.parse(memberCreateLog.details);
            expect(details.teamMemberName).toBe(uniqueMemberName);
            expect(details.position).toBe(testData.position);
            expect(details.assignedToDepartment).toBe(department.id);
          }

          // Check audit log for assignment during creation
          const assignmentLogs = await getAuditLogs({
            entityType: 'ASSIGNMENT',
            operation: 'ASSIGN',
            limit: 10
          });
          const assignmentLog = assignmentLogs.find(log => 
            log.details && JSON.parse(log.details).teamMemberId === teamMember.id &&
            JSON.parse(log.details).departmentId === department.id
          );
          expect(assignmentLog).toBeDefined();
          
          if (assignmentLog?.details) {
            const details = JSON.parse(assignmentLog.details);
            expect(details.teamMemberName).toBe(uniqueMemberName);
            expect(details.departmentName).toBe(uniqueUpdatedName);
          }

          // Test 4: Assignment operations should create audit logs
          const secondDepartment = await caller.department.create({
            name: `${uniqueDeptName}_second`,
            description: "Second department for reassignment test"
          });
          expect(secondDepartment).toBeDefined();

          // Reassign member to second department
          await caller.department.assignMember({
            teamMemberId: teamMember.id,
            departmentId: secondDepartment.id,
            assignedBy: teamMember.id
          });

          // Check audit log for reassignment
          const reassignLogs = await getAuditLogs({
            entityType: 'ASSIGNMENT',
            operation: 'REASSIGN',
            limit: 10
          });
          const reassignLog = reassignLogs.find(log => 
            log.details && JSON.parse(log.details).teamMemberId === teamMember.id &&
            JSON.parse(log.details).departmentId === secondDepartment.id
          );
          expect(reassignLog).toBeDefined();
          
          if (reassignLog?.details) {
            const details = JSON.parse(reassignLog.details);
            expect(details.teamMemberName).toBe(uniqueMemberName);
            expect(details.departmentName).toBe(`${uniqueDeptName}_second`);
            expect(details.previousDepartment).toBeDefined();
            expect(details.previousDepartment.name).toBe(uniqueUpdatedName);
          }

          // Test 5: Unassignment should create audit log
          await caller.department.unassignMember({
            teamMemberId: teamMember.id,
            departmentId: secondDepartment.id
          });

          // Check audit log for unassignment
          const unassignLogs = await getAuditLogs({
            entityType: 'ASSIGNMENT',
            operation: 'UNASSIGN',
            limit: 10
          });
          const unassignLog = unassignLogs.find(log => 
            log.details && JSON.parse(log.details).teamMemberId === teamMember.id
          );
          expect(unassignLog).toBeDefined();
          
          if (unassignLog?.details) {
            const details = JSON.parse(unassignLog.details);
            expect(details.teamMemberName).toBe(uniqueMemberName);
            expect(details.departmentName).toBe(`${uniqueDeptName}_second`);
          }

          // Test 6: Department deletion should create audit log
          await caller.department.delete({ id: secondDepartment.id });

          // Check audit log for department deletion
          const deleteLogs = await getAuditLogs({
            entityType: 'DEPARTMENT',
            entityId: secondDepartment.id,
            operation: 'DELETE',
            limit: 10
          });
          expect(deleteLogs.length).toBeGreaterThanOrEqual(1);
          
          const deleteLog = deleteLogs.find(log => 
            log.operation === 'DELETE' && 
            log.entityType === 'DEPARTMENT' && 
            log.entityId === secondDepartment.id
          );
          expect(deleteLog).toBeDefined();
          expect(deleteLog?.details).toBeDefined();
          
          if (deleteLog?.details) {
            const details = JSON.parse(deleteLog.details);
            expect(details.departmentName).toBe(`${uniqueDeptName}_second`);
          }

          // Test 7: Team member deletion should create audit log
          await caller.team.delete({ id: teamMember.id });

          // Check audit log for team member deletion
          const memberDeleteLogs = await getAuditLogs({
            entityType: 'TEAM_MEMBER',
            entityId: teamMember.id,
            operation: 'DELETE',
            limit: 10
          });
          expect(memberDeleteLogs.length).toBeGreaterThanOrEqual(1);
          
          const memberDeleteLog = memberDeleteLogs.find(log => 
            log.operation === 'DELETE' && 
            log.entityType === 'TEAM_MEMBER' && 
            log.entityId === teamMember.id
          );
          expect(memberDeleteLog).toBeDefined();
          expect(memberDeleteLog?.details).toBeDefined();
          
          if (memberDeleteLog?.details) {
            const details = JSON.parse(memberDeleteLog.details);
            expect(details.teamMemberName).toBe(uniqueMemberName);
            expect(details.position).toBe(testData.position);
          }

          // Test 8: Verify audit logs have proper timestamps and are ordered
          const allLogs = await getAuditLogs({
            limit: 50
          });
          expect(allLogs.length).toBeGreaterThan(0);
          
          // Verify all logs have required fields
          for (const log of allLogs) {
            expect(log.id).toBeTypeOf('number');
            expect(log.operation).toBeTypeOf('string');
            expect(log.entityType).toBeTypeOf('string');
            expect(log.entityId).toBeTypeOf('number');
            expect(log.timestamp).toBeInstanceOf(Date);
            
            // Details should be valid JSON if present
            if (log.details) {
              expect(() => JSON.parse(log.details as string)).not.toThrow();
            }
          }

          // Clean up remaining department
          await caller.department.delete({ id: department.id });

          // Verify final deletion audit log
          const finalDeleteLogs = await getAuditLogs({
            entityType: 'DEPARTMENT',
            entityId: department.id,
            operation: 'DELETE',
            limit: 10
          });
          expect(finalDeleteLogs.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 3 }
    );
  }, 45000); // Increase timeout to 45 seconds

  it("Property 21: Transaction Rollback - For any failed department operation, partial changes should be rolled back to maintain data consistency", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          departmentName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          teamMemberName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          position: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          conflictingName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        }),
        fc.integer({ min: 1, max: 1000000 }), // Add a unique suffix
        async (testData, uniqueId) => {
          const { ctx } = createTestContext();
          const caller = appRouter.createCaller(ctx);

          const timestamp = Date.now();
          const uniqueDeptName = `${testData.departmentName}_${timestamp}_${uniqueId}`;
          const uniqueMemberName = `${testData.teamMemberName}_${timestamp}_${uniqueId}`;
          const uniqueConflictingName = `${testData.conflictingName}_${timestamp}_${uniqueId}`;

          // Test 1: Department creation with invalid manager should rollback completely
          const nonExistentManagerId = 999999;
          
          // Get initial department count
          const initialDepartments = await caller.department.list();
          const initialCount = initialDepartments.length;

          // Attempt to create department with non-existent manager - should fail and rollback
          await expect(
            caller.department.create({
              name: uniqueDeptName,
              description: "Test department",
              managerId: nonExistentManagerId
            })
          ).rejects.toThrow(/Manager with ID .* does not exist/);

          // Verify no department was created (transaction rolled back)
          const departmentsAfterFailure = await caller.department.list();
          expect(departmentsAfterFailure.length).toBe(initialCount);

          // Verify no department with that name exists
          const foundDept = departmentsAfterFailure.find(d => d.name === uniqueDeptName);
          expect(foundDept).toBeUndefined();

          // Test 2: Department update with conflicting name should rollback
          // First create a valid department
          const validDepartment = await caller.department.create({
            name: uniqueDeptName,
            description: "Valid department"
          });
          expect(validDepartment).toBeDefined();

          // Create another department to cause name conflict
          const conflictingDepartment = await caller.department.create({
            name: uniqueConflictingName,
            description: "Conflicting department"
          });
          expect(conflictingDepartment).toBeDefined();

          // Get the original values before attempted update
          const originalDept = await caller.department.getById({ id: validDepartment.id });
          expect(originalDept).toBeDefined();
          const originalDescription = originalDept?.description;

          // Attempt to update with conflicting name - should fail and rollback
          await expect(
            caller.department.update({
              id: validDepartment.id,
              name: uniqueConflictingName, // This should conflict
              description: "Updated description that should be rolled back"
            })
          ).rejects.toThrow(/Department with name .* already exists/);

          // Verify the department was not modified (transaction rolled back)
          const deptAfterFailedUpdate = await caller.department.getById({ id: validDepartment.id });
          expect(deptAfterFailedUpdate).toBeDefined();
          expect(deptAfterFailedUpdate?.name).toBe(uniqueDeptName); // Original name preserved
          expect(deptAfterFailedUpdate?.description).toBe(originalDescription); // Original description preserved

          // Test 3: Assignment to non-existent department should rollback
          // Create a team member
          const teamMember = await caller.team.create({
            name: uniqueMemberName,
            position: testData.position
          });
          expect(teamMember).toBeDefined();

          const nonExistentDepartmentId = 999999;

          // Get initial assignment count
          const db = await getDb();
          if (db) {
            const initialAssignments = await db.select().from(departmentAssignments);
            const initialAssignmentCount = initialAssignments.length;

            // Attempt to assign to non-existent department - should fail and rollback
            await expect(
              caller.department.assignMember({
                teamMemberId: teamMember.id,
                departmentId: nonExistentDepartmentId,
                assignedBy: teamMember.id
              })
            ).rejects.toThrow(/Department with ID .* does not exist/);

            // Verify no assignment was created (transaction rolled back)
            const assignmentsAfterFailure = await db.select().from(departmentAssignments);
            expect(assignmentsAfterFailure.length).toBe(initialAssignmentCount);

            // Verify team member has no active assignments
            const activeAssignments = await db.select().from(departmentAssignments)
              .where(and(
                eq(departmentAssignments.teamMemberId, teamMember.id),
                eq(departmentAssignments.isActive, true)
              ));
            expect(activeAssignments.length).toBe(0);
          }

          // Test 4: Department deletion with assigned members should rollback
          // Assign the team member to the valid department
          await caller.department.assignMember({
            teamMemberId: teamMember.id,
            departmentId: validDepartment.id,
            assignedBy: teamMember.id
          });

          // Verify assignment was created
          const membersInDept = await caller.department.getMembers({
            departmentId: validDepartment.id
          });
          expect(membersInDept.length).toBe(1);
          expect(membersInDept[0].id).toBe(teamMember.id);

          // Attempt to delete department with assigned members - should fail and rollback
          await expect(
            caller.department.delete({ id: validDepartment.id })
          ).rejects.toThrow(/Cannot delete department .* because it has .* assigned team member/);

          // Verify department still exists (transaction rolled back)
          const deptAfterFailedDelete = await caller.department.getById({ id: validDepartment.id });
          expect(deptAfterFailedDelete).toBeDefined();
          expect(deptAfterFailedDelete?.name).toBe(uniqueDeptName);

          // Verify assignment still exists
          const membersAfterFailedDelete = await caller.department.getMembers({
            departmentId: validDepartment.id
          });
          expect(membersAfterFailedDelete.length).toBe(1);

          // Test 5: Verify audit logs are not created for failed operations
          const auditLogs = await getAuditLogs({
            entityType: 'DEPARTMENT',
            entityId: validDepartment.id,
            operation: 'DELETE',
            limit: 10
          });
          
          // Should not find any DELETE audit logs for the failed deletion
          const failedDeleteLog = auditLogs.find(log => 
            log.operation === 'DELETE' && 
            log.entityType === 'DEPARTMENT' && 
            log.entityId === validDepartment.id
          );
          expect(failedDeleteLog).toBeUndefined();

          // Test 6: Verify successful operations after failed ones work correctly
          // Unassign the team member first
          await caller.department.unassignMember({
            teamMemberId: teamMember.id,
            departmentId: validDepartment.id
          });

          // Now deletion should succeed
          const successfulDelete = await caller.department.delete({ id: validDepartment.id });
          expect(successfulDelete).toBe(true);

          // Verify audit log was created for successful deletion
          const successfulDeleteLogs = await getAuditLogs({
            entityType: 'DEPARTMENT',
            entityId: validDepartment.id,
            operation: 'DELETE',
            limit: 10
          });
          expect(successfulDeleteLogs.length).toBeGreaterThanOrEqual(1);

          // Clean up remaining resources
          await caller.department.delete({ id: conflictingDepartment.id });
          await caller.team.delete({ id: teamMember.id });
        }
      ),
      { numRuns: 3 }
    );
  }, 50000); // Increase timeout to 50 seconds
});

describe("tRPC Department Router Integration Tests", () => {
  describe("CRUD Operations", () => {
    it("should create, retrieve, update, and delete departments through tRPC", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      // Create department
      const createData = {
        name: `Test_Dept_${Date.now()}`,
        description: "Test department description",
      };
      
      const created = await caller.department.create(createData);
      expect(created).toBeDefined();
      expect(created.name).toBe(createData.name);
      expect(created.description).toBe(createData.description);
      expect(created.id).toBeTypeOf("number");

      // Retrieve by ID
      const retrieved = await caller.department.getById({ id: created.id });
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(createData.name);

      // List departments (should include our created department)
      const departments = await caller.department.list();
      expect(departments).toBeDefined();
      expect(Array.isArray(departments)).toBe(true);
      const foundDept = departments.find(d => d.id === created.id);
      expect(foundDept).toBeDefined();

      // Update department
      const updateData = {
        id: created.id,
        name: `Updated_${createData.name}`,
        description: "Updated description",
      };
      
      const updated = await caller.department.update(updateData);
      expect(updated).toBeDefined();
      expect(updated?.name).toBe(updateData.name);
      expect(updated?.description).toBe(updateData.description);

      // Delete department
      const deleted = await caller.department.delete({ id: created.id });
      expect(deleted).toBe(true);

      // Verify deletion
      const afterDelete = await caller.department.getById({ id: created.id });
      expect(afterDelete).toBeUndefined();
    });

    it("should handle validation errors for department creation", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      // Test empty name
      await expect(
        caller.department.create({ name: "" })
      ).rejects.toThrow();

      // Test name too long
      await expect(
        caller.department.create({ name: "a".repeat(101) })
      ).rejects.toThrow();

      // Test description too long
      await expect(
        caller.department.create({ 
          name: "Valid Name",
          description: "a".repeat(501)
        })
      ).rejects.toThrow();
    });

    it("should handle department name uniqueness validation", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const departmentName = `Unique_Test_${Date.now()}`;
      
      // Create first department
      const first = await caller.department.create({
        name: departmentName,
        description: "First department"
      });
      expect(first).toBeDefined();

      // Attempt to create second department with same name
      await expect(
        caller.department.create({
          name: departmentName,
          description: "Second department"
        })
      ).rejects.toThrow(/already exists/);

      // Clean up
      await caller.department.delete({ id: first.id });
    });

    it("should prevent deletion of departments with assigned members", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      // Create team member
      const teamMember = await caller.team.create({
        name: `Test_Member_${Date.now()}`,
        position: "Test Position"
      });

      // Create department
      const department = await caller.department.create({
        name: `Test_Dept_${Date.now()}`,
        description: "Test department"
      });

      // Assign member to department
      await assignMemberToDepartment({
        teamMemberId: teamMember.id,
        departmentId: department.id
      });

      // Attempt to delete department should fail
      await expect(
        caller.department.delete({ id: department.id })
      ).rejects.toThrow(/assigned team members/);

      // Clean up - unassign first, then delete
      await unassignMemberFromDepartment({ teamMemberId: teamMember.id });
      await caller.department.delete({ id: department.id });
      await caller.team.delete({ id: teamMember.id });
    });
  });

  describe("Hierarchy Management", () => {
    it("should manage department hierarchies through tRPC", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      // Create parent and child departments
      const parent = await caller.department.create({
        name: `Parent_${Date.now()}`,
        description: "Parent department"
      });

      const child = await caller.department.create({
        name: `Child_${Date.now()}`,
        description: "Child department"
      });

      // Set parent relationship
      const updated = await caller.department.setParent({
        departmentId: child.id,
        parentId: parent.id
      });
      expect(updated).toBeDefined();
      expect(updated?.parentId).toBe(parent.id);

      // Get hierarchy
      const hierarchy = await caller.department.getHierarchy();
      expect(hierarchy).toBeDefined();
      expect(Array.isArray(hierarchy)).toBe(true);

      const parentInHierarchy = hierarchy.find(d => d.id === parent.id);
      expect(parentInHierarchy).toBeDefined();
      expect(parentInHierarchy?.children).toHaveLength(1);
      expect(parentInHierarchy?.children[0].id).toBe(child.id);

      // Remove parent relationship
      const unparented = await caller.department.setParent({
        departmentId: child.id,
        parentId: null
      });
      expect(unparented).toBeDefined();
      expect(unparented?.parentId).toBeNull();

      // Clean up
      await caller.department.delete({ id: child.id });
      await caller.department.delete({ id: parent.id });
    });

    it("should prevent circular references in hierarchy", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      // Create two departments
      const dept1 = await caller.department.create({
        name: `Dept1_${Date.now()}`,
        description: "Department 1"
      });

      const dept2 = await caller.department.create({
        name: `Dept2_${Date.now()}`,
        description: "Department 2"
      });

      // Set dept1 -> dept2
      await caller.department.setParent({
        departmentId: dept2.id,
        parentId: dept1.id
      });

      // Attempt to set dept2 -> dept1 (circular) should fail
      await expect(
        caller.department.setParent({
          departmentId: dept1.id,
          parentId: dept2.id
        })
      ).rejects.toThrow(/circular reference/);

      // Clean up
      await caller.department.delete({ id: dept2.id });
      await caller.department.delete({ id: dept1.id });
    });
  });

  describe("Assignment Operations", () => {
    it("should manage team member assignments through tRPC", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      // Create team member and department
      const teamMember = await caller.team.create({
        name: `Test_Member_${Date.now()}`,
        position: "Test Position"
      });

      const department = await caller.department.create({
        name: `Test_Dept_${Date.now()}`,
        description: "Test department"
      });

      // Assign member to department
      const assignment = await caller.department.assignMember({
        teamMemberId: teamMember.id,
        departmentId: department.id,
        assignedBy: teamMember.id
      });
      expect(assignment).toBeDefined();
      expect(assignment.teamMemberId).toBe(teamMember.id);
      expect(assignment.departmentId).toBe(department.id);
      expect(assignment.isActive).toBe(true);

      // Get department members
      const members = await caller.department.getMembers({
        departmentId: department.id
      });
      expect(members).toBeDefined();
      expect(Array.isArray(members)).toBe(true);
      expect(members).toHaveLength(1);
      expect(members[0].id).toBe(teamMember.id);

      // Unassign member
      const unassigned = await caller.department.unassignMember({
        teamMemberId: teamMember.id,
        departmentId: department.id
      });
      expect(unassigned).toBe(true);

      // Verify no members in department
      const membersAfterUnassign = await caller.department.getMembers({
        departmentId: department.id
      });
      expect(membersAfterUnassign).toHaveLength(0);

      // Clean up
      await caller.department.delete({ id: department.id });
      await caller.team.delete({ id: teamMember.id });
    });

    it("should validate assignment operations", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      // Test assignment to non-existent department
      await expect(
        caller.department.assignMember({
          teamMemberId: 999999,
          departmentId: 999999
        })
      ).rejects.toThrow(/does not exist/);

      // Test getting members of non-existent department
      await expect(
        caller.department.getMembers({ departmentId: 999999 })
      ).rejects.toThrow(/does not exist/);
    });
  });

  describe("Error Handling", () => {
    it("should handle non-existent department operations", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const nonExistentId = 999999;

      // Test getById with non-existent ID
      const result = await caller.department.getById({ id: nonExistentId });
      expect(result).toBeUndefined();

      // Test update with non-existent ID
      await expect(
        caller.department.update({
          id: nonExistentId,
          name: "Updated Name"
        })
      ).rejects.toThrow(/does not exist/);

      // Test delete with non-existent ID
      await expect(
        caller.department.delete({ id: nonExistentId })
      ).rejects.toThrow(/does not exist/);

      // Test setParent with non-existent department
      await expect(
        caller.department.setParent({
          departmentId: nonExistentId,
          parentId: null
        })
      ).rejects.toThrow(/does not exist/);

      // Test setParent with non-existent parent
      const validDept = await caller.department.create({
        name: `Valid_Dept_${Date.now()}`,
        description: "Valid department"
      });

      await expect(
        caller.department.setParent({
          departmentId: validDept.id,
          parentId: nonExistentId
        })
      ).rejects.toThrow(/does not exist/);

      // Clean up
      await caller.department.delete({ id: validDept.id });
    });
  });
});
  it("Property 17: Historical Data in Reports - For any report that includes historical data, it should accurately include assignment history for trend analysis", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          departmentCount: fc.integer({ min: 1, max: 2 }),
          teamMemberCount: fc.integer({ min: 2, max: 3 }),
          assignmentChanges: fc.integer({ min: 1, max: 2 }),
          timeRange: fc.constantFrom('30d', '90d', '1y', 'all'),
        }),
        async (testData) => {
          const caller = appRouter.createCaller({} as TrpcContext);
          const createdDepartments: any[] = [];
          const createdTeamMembers: any[] = [];

          try {
            // Create test departments
            for (let i = 0; i < testData.departmentCount; i++) {
              const department = await caller.department.create({
                name: `Test Department ${i + 1} ${Date.now()}`,
                description: `Test department for historical reporting ${i + 1}`,
              });
              createdDepartments.push(department);
            }

            // Create test team members
            for (let i = 0; i < testData.teamMemberCount; i++) {
              const teamMember = await caller.team.create({
                name: `Test Member ${i + 1} ${Date.now()}`,
                position: `Position ${i + 1}`,
                email: `test${i + 1}@example.com`,
              });
              createdTeamMembers.push(teamMember);
            }

            // Create assignment history by making multiple assignments
            const assignmentHistory: any[] = [];
            for (let i = 0; i < testData.assignmentChanges; i++) {
              const randomMember = createdTeamMembers[Math.floor(Math.random() * createdTeamMembers.length)];
              const randomDepartment = createdDepartments[Math.floor(Math.random() * createdDepartments.length)];

              const assignment = await caller.department.assignMember({
                teamMemberId: randomMember.id,
                departmentId: randomDepartment.id,
              });
              assignmentHistory.push(assignment);

              // Add small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Test assignment history report
            const historyReport = await caller.department.getAssignmentHistory({
              startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
              endDate: new Date().toISOString(),
            });

            // **Feature: department-management, Property 17: Historical Data in Reports**
            // Validate that historical data is accurately included
            expect(historyReport).toBeDefined();
            expect(typeof historyReport.totalAssignments).toBe('number');
            expect(typeof historyReport.uniqueMembers).toBe('number');
            expect(typeof historyReport.uniqueDepartments).toBe('number');
            expect(Array.isArray(historyReport.assignments)).toBe(true);

            // Verify assignment history contains our created assignments
            expect(historyReport.totalAssignments).toBeGreaterThanOrEqual(testData.assignmentChanges);
            expect(historyReport.uniqueMembers).toBeGreaterThanOrEqual(1);
            expect(historyReport.uniqueDepartments).toBeGreaterThanOrEqual(1);

            // Validate assignment data structure
            for (const assignment of historyReport.assignments) {
              expect(typeof assignment.id).toBe('number');
              expect(typeof assignment.teamMemberId).toBe('number');
              expect(typeof assignment.teamMemberName).toBe('string');
              expect(typeof assignment.departmentId).toBe('number');
              expect(typeof assignment.departmentName).toBe('string');
              expect(assignment.assignedAt).toBeInstanceOf(Date);
              expect(typeof assignment.isActive).toBe('boolean');
            }

            // Test department trends report
            const trendsReport = await caller.department.getDepartmentTrends({
              timeRange: testData.timeRange,
            });

            // Validate trends report structure
            expect(trendsReport).toBeDefined();
            expect(typeof trendsReport.timeRange).toBe('string');
            expect(Array.isArray(trendsReport.trends)).toBe(true);
            expect(trendsReport.summary).toBeDefined();
            expect(typeof trendsReport.summary.totalNewAssignments).toBe('number');
            expect(typeof trendsReport.summary.totalDepartures).toBe('number');
            expect(typeof trendsReport.summary.netChange).toBe('number');
            expect(typeof trendsReport.summary.averageMemberCount).toBe('number');

            // Test member movement patterns report
            const movementReport = await caller.department.getMemberMovementPatterns({
              timeRange: testData.timeRange,
            });

            // Validate movement patterns report structure
            expect(movementReport).toBeDefined();
            expect(typeof movementReport.timeRange).toBe('string');
            expect(Array.isArray(movementReport.patterns)).toBe(true);
            expect(movementReport.summary).toBeDefined();
            expect(typeof movementReport.summary.totalMovements).toBe('number');
            expect(typeof movementReport.summary.averageMovementsPerMember).toBe('number');

            // Validate movement pattern data structure
            for (const pattern of movementReport.patterns) {
              expect(typeof pattern.toDepartmentId).toBe('number');
              expect(typeof pattern.toDepartmentName).toBe('string');
              expect(typeof pattern.movementCount).toBe('number');
              expect(Array.isArray(pattern.memberIds)).toBe(true);
              // fromDepartmentId can be null for new hires
              if (pattern.fromDepartmentId !== null) {
                expect(typeof pattern.fromDepartmentId).toBe('number');
              }
            }

            // Test historical data consistency
            // The sum of all movements should be consistent with assignment history
            const totalMovements = movementReport.summary.totalMovements;
            const totalAssignments = historyReport.totalAssignments;
            
            // Movement count should be reasonable compared to assignment count
            // (movements are transitions, assignments include initial assignments)
            expect(totalMovements).toBeLessThanOrEqual(totalAssignments);

            // Test time range filtering
            if (testData.timeRange !== 'all') {
              // Verify that the reports respect the time range
              const cutoffDate = new Date();
              switch (testData.timeRange) {
                case '30d':
                  cutoffDate.setDate(cutoffDate.getDate() - 30);
                  break;
                case '90d':
                  cutoffDate.setDate(cutoffDate.getDate() - 90);
                  break;
                case '1y':
                  cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
                  break;
              }

              // All assignments in the filtered report should be within the time range
              for (const assignment of historyReport.assignments) {
                expect(assignment.assignedAt.getTime()).toBeGreaterThanOrEqual(cutoffDate.getTime());
              }
            }

          } finally {
            // Cleanup: Delete created departments and team members
            for (const dept of createdDepartments) {
              try {
                await caller.department.delete({ id: dept.id });
              } catch (error) {
                // Ignore errors for departments that might have members
              }
            }

            for (const member of createdTeamMembers) {
              try {
                await caller.team.delete({ id: member.id });
              } catch (error) {
                // Ignore errors for members that might have been deleted already
              }
            }
          }
        }
      ),
      { numRuns: 1 }
    );
  }, 30000); // Increase timeout for comprehensive historical data testing