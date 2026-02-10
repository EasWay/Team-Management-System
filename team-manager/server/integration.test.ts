import { describe, it, expect, beforeEach } from "vitest";
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
    res: {} as any,
  };

  return { ctx, user };
}

/**
 * End-to-End Integration Tests for Department Management
 * 
 * These tests verify complete workflows from UI to database:
 * - Department creation → assignment → hierarchy → reporting workflow
 * - Error handling across the full stack
 * - Data consistency across all department operations
 * - Integration with existing team member functionality
 */

describe("Department Management End-to-End Integration Tests", () => {
  let ctx: ReturnType<typeof createTestContext>["ctx"];
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const testContext = createTestContext();
    ctx = testContext.ctx;
    caller = appRouter.createCaller(ctx);
  });

  describe("Core Integration Workflow", () => {
    it("should handle basic department and team member integration", async () => {
      // Generate unique identifiers to avoid conflicts
      const timestamp = Date.now();
      const uniqueId = Math.random().toString(36).substring(7);
      
      // Create a team member
      const member = await caller.team.create({
        name: `Test Member ${timestamp}`,
        position: "Developer",
        email: `test${uniqueId}@example.com`,
      });

      expect(member).toBeDefined();
      expect(member.name).toContain("Test Member");

      // Create a department
      const department = await caller.department.create({
        name: `Test Department ${timestamp}`,
        description: "Test department for integration",
      });

      expect(department).toBeDefined();
      expect(department.name).toContain("Test Department");

      // Assign member to department
      await caller.department.assignMember({
        teamMemberId: member.id,
        departmentId: department.id,
      });

      // Verify assignment through different endpoints
      const deptMembers = await caller.department.getMembers({ departmentId: department.id });
      expect(deptMembers).toHaveLength(1);
      expect(deptMembers[0].id).toBe(member.id);

      const teamMembersWithDepts = await caller.team.listWithDepartments();
      const memberWithDept = teamMembersWithDepts.find(m => m.id === member.id);
      expect(memberWithDept?.currentDepartment).toBeDefined();
      expect(memberWithDept?.currentDepartment?.id).toBe(department.id);

      // Test reporting
      const stats = await caller.department.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalDepartments).toBeGreaterThanOrEqual(1);
      expect(stats.totalAssignedMembers).toBeGreaterThanOrEqual(1);

      // Test unassignment
      await caller.department.unassignMember({
        teamMemberId: member.id,
        departmentId: department.id,
      });

      const deptMembersAfterUnassign = await caller.department.getMembers({ departmentId: department.id });
      expect(deptMembersAfterUnassign).toHaveLength(0);

      // Clean up
      await caller.department.delete({ id: department.id });
      await caller.team.delete({ id: member.id });
    });

    it("should handle department hierarchy operations", async () => {
      const timestamp = Date.now();
      
      // Create parent department
      const parentDept = await caller.department.create({
        name: `Parent Dept ${timestamp}`,
        description: "Parent department",
      });

      // Create child department
      const childDept = await caller.department.create({
        name: `Child Dept ${timestamp}`,
        description: "Child department",
        parentId: parentDept.id,
      });

      // Verify hierarchy
      const hierarchy = await caller.department.getHierarchy();
      const parentInHierarchy = hierarchy.find(d => d.id === parentDept.id);
      expect(parentInHierarchy).toBeDefined();
      expect(parentInHierarchy?.children).toBeDefined();
      expect(parentInHierarchy?.children?.some(c => c.id === childDept.id)).toBe(true);

      // Test circular reference prevention
      await expect(caller.department.setParent({
        departmentId: parentDept.id,
        parentId: childDept.id,
      })).rejects.toThrow();

      // Clean up
      await caller.department.delete({ id: childDept.id });
      await caller.department.delete({ id: parentDept.id });
    });

    it("should handle error scenarios correctly", async () => {
      const timestamp = Date.now();
      
      // Test department name uniqueness
      const deptName = `Unique Dept ${timestamp}`;
      
      await caller.department.create({
        name: deptName,
        description: "First department",
      });

      // Should fail to create department with same name
      await expect(caller.department.create({
        name: deptName,
        description: "Duplicate department",
      })).rejects.toThrow();

      // Test assignment to non-existent department
      const member = await caller.team.create({
        name: `Test Member ${timestamp}`,
        position: "Developer",
        email: `test${timestamp}@example.com`,
      });

      await expect(caller.department.assignMember({
        teamMemberId: member.id,
        departmentId: 99999, // Non-existent department
      })).rejects.toThrow();

      // Clean up
      await caller.team.delete({ id: member.id });
    });
  });
});