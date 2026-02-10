# Design Document: Department Management

## Overview

The Department Management feature extends the existing team manager application with hierarchical organizational structure capabilities. The design leverages the existing TypeScript/React/tRPC/Drizzle architecture to add department creation, team member assignment, hierarchy management, and reporting functionality.

The solution uses an adjacency list pattern for storing department hierarchies in SQLite, provides RESTful tRPC endpoints for department operations, and implements React components for organizational chart visualization and department management interfaces.

## Architecture

### System Architecture

The department management system follows the existing application's layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer (React/TypeScript)          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Department      │  │ Org Chart       │  │ Assignment   │ │
│  │ Management UI   │  │ Visualization   │  │ Interface    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │ tRPC
┌─────────────────────────────────────────────────────────────┐
│                    Server Layer (Node.js/tRPC)             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Department      │  │ Assignment      │  │ Reporting    │ │
│  │ Router          │  │ Router          │  │ Router       │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │ Drizzle ORM
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (SQLite)                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ departments     │  │ team_members    │  │ department_  │ │
│  │ table           │  │ table (existing)│  │ assignments  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Integration Points

The department management system integrates with existing components:

- **Team Members**: Extends existing team member functionality with department assignments
- **Authentication**: Uses existing auth system for access control
- **UI Components**: Leverages existing shadcn/ui component library
- **Database**: Extends existing Drizzle schema and database operations

## Components and Interfaces

### Database Schema Extensions

#### Departments Table
```typescript
export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  parentId: integer("parentId").references(() => departments.id),
  managerId: integer("managerId").references(() => teamMembers.id),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
```

#### Department Assignments Table
```typescript
export const departmentAssignments = sqliteTable("departmentAssignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamMemberId: integer("teamMemberId").notNull().references(() => teamMembers.id),
  departmentId: integer("departmentId").notNull().references(() => departments.id),
  assignedAt: integer("assignedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  assignedBy: integer("assignedBy").references(() => teamMembers.id),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
});
```

### tRPC API Endpoints

#### Department Router
```typescript
department: router({
  // CRUD Operations
  list: publicProcedure.query(() => getDepartments()),
  getById: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getDepartmentById(input.id)),
  create: publicProcedure.input(createDepartmentSchema).mutation(({ input }) => createDepartment(input)),
  update: publicProcedure.input(updateDepartmentSchema).mutation(({ input }) => updateDepartment(input)),
  delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteDepartment(input.id)),
  
  // Hierarchy Operations
  getHierarchy: publicProcedure.query(() => getDepartmentHierarchy()),
  setParent: publicProcedure.input(setParentSchema).mutation(({ input }) => setDepartmentParent(input)),
  
  // Assignment Operations
  assignMember: publicProcedure.input(assignMemberSchema).mutation(({ input }) => assignMemberToDepartment(input)),
  unassignMember: publicProcedure.input(unassignMemberSchema).mutation(({ input }) => unassignMemberFromDepartment(input)),
  getMembers: publicProcedure.input(z.object({ departmentId: z.number() })).query(({ input }) => getDepartmentMembers(input.departmentId)),
  
  // Reporting
  getStats: publicProcedure.query(() => getDepartmentStats()),
  getUnassignedMembers: publicProcedure.query(() => getUnassignedTeamMembers()),
})
```

### React Components

#### Core Department Components
- **DepartmentList**: Displays all departments in a table/list format
- **DepartmentForm**: Create/edit department modal form
- **DepartmentCard**: Individual department display component
- **OrganizationalChart**: Hierarchical tree visualization of departments
- **DepartmentAssignmentModal**: Interface for assigning team members to departments

#### Integration Components
- **TeamMemberWithDepartment**: Enhanced team member display showing department info
- **DepartmentSelector**: Dropdown/select component for choosing departments
- **DepartmentBreadcrumb**: Navigation component showing department hierarchy path

## Data Models

### Core Entities

#### Department
```typescript
interface Department {
  id: number;
  name: string;
  description?: string;
  parentId?: number;
  managerId?: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Computed/joined fields
  parent?: Department;
  children?: Department[];
  manager?: TeamMember;
  memberCount?: number;
}
```

#### DepartmentAssignment
```typescript
interface DepartmentAssignment {
  id: number;
  teamMemberId: number;
  departmentId: number;
  assignedAt: Date;
  assignedBy?: number;
  isActive: boolean;
  
  // Joined fields
  teamMember?: TeamMember;
  department?: Department;
  assignedByMember?: TeamMember;
}
```

#### Enhanced TeamMember
```typescript
interface TeamMemberWithDepartment extends TeamMember {
  currentDepartment?: Department;
  departmentHistory?: DepartmentAssignment[];
}
```

### Validation Schemas

```typescript
const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  parentId: z.number().optional(),
  managerId: z.number().optional(),
});

const assignMemberSchema = z.object({
  teamMemberId: z.number(),
  departmentId: z.number(),
  assignedBy: z.number().optional(),
});
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Converting EARS to Properties

Based on the prework analysis, I'll convert the testable acceptance criteria into universally quantified properties, consolidating redundant properties for efficiency:

**Property 1: Department CRUD Operations**
*For any* valid department data, creating a department should result in a department that can be retrieved, updated, and (if empty) deleted successfully
**Validates: Requirements 1.1, 1.3, 1.4**

**Property 2: Department Name Uniqueness**
*For any* department name that already exists in the system, attempting to create another department with the same name should fail with an appropriate error
**Validates: Requirements 1.2**

**Property 3: Department Deletion Prevention**
*For any* department that has assigned team members, attempting to delete the department should fail and return an appropriate error message
**Validates: Requirements 1.5**

**Property 4: Team Member Assignment Management**
*For any* valid team member and department, the member can be assigned to the department, reassigned to a different department, and unassigned, with each operation updating the assignment state correctly
**Validates: Requirements 2.1, 2.4, 2.6**

**Property 5: Assignment Metadata Recording**
*For any* team member assignment operation, the system should record the assignment date and assigning manager information
**Validates: Requirements 2.2**

**Property 6: Single Active Assignment Constraint**
*For any* team member, they should have at most one active department assignment at any given time
**Validates: Requirements 2.3**

**Property 7: Assignment History Preservation**
*For any* team member reassignment, the previous assignment should be preserved as historical data while the new assignment becomes active
**Validates: Requirements 2.5**

**Property 8: Department Existence Validation**
*For any* assignment operation, attempting to assign a team member to a non-existent department should fail with an appropriate error
**Validates: Requirements 2.7**

**Property 9: Department Hierarchy Management**
*For any* valid parent-child department relationship, the hierarchy can be created and supports multiple nesting levels, with root-level departments allowed
**Validates: Requirements 3.1, 3.4, 3.5**

**Property 10: Circular Reference Prevention**
*For any* department hierarchy modification that would create a circular reference, the operation should be rejected with an appropriate error
**Validates: Requirements 3.2, 3.3**

**Property 11: Hierarchy Referential Integrity**
*For any* department deletion in a hierarchy, the system should maintain referential integrity by appropriately handling child departments
**Validates: Requirements 3.6**

**Property 12: Department Display Data Completeness**
*For any* department display operation, the returned data should include department names, member counts, and assigned manager information
**Validates: Requirements 4.2**

**Property 13: Department Listing and Search**
*For any* department search or filter operation, the results should correctly match the search criteria and include all matching departments
**Validates: Requirements 4.4, 4.5**

**Property 14: Assignment Display Integration**
*For any* department view, it should display all current team member assignments for that department
**Validates: Requirements 4.6**

**Property 15: Department Reporting Accuracy**
*For any* department report generation, the report should accurately reflect team member distribution, department sizes, hierarchy metrics, and unassigned members
**Validates: Requirements 5.1, 5.2, 5.3, 5.6**

**Property 16: Report Export Functionality**
*For any* department data export operation, the exported data should contain complete and accurate department information and organizational structure
**Validates: Requirements 5.4**

**Property 17: Historical Data in Reports**
*For any* report that includes historical data, it should accurately include assignment history for trend analysis
**Validates: Requirements 5.5**

**Property 18: Data Integrity Maintenance**
*For any* department operation, referential integrity should be maintained between departments, team members, and assignments
**Validates: Requirements 6.1**

**Property 19: Manager Validation**
*For any* department manager assignment, the assigned manager must be a valid existing team member
**Validates: Requirements 6.3**

**Property 20: Team Member Deletion Handling**
*For any* team member deletion, their department assignments and management roles should be appropriately handled to maintain system consistency
**Validates: Requirements 6.4**

**Property 21: Transaction Rollback**
*For any* failed department operation, partial changes should be rolled back to maintain data consistency
**Validates: Requirements 6.5**

**Property 22: Audit Logging**
*For any* department-related data modification operation, an audit log entry should be created with appropriate details
**Validates: Requirements 1.6, 6.6**

**Property 23: Team Member Display Enhancement**
*For any* team member display operation, the output should include current department assignment information
**Validates: Requirements 7.1, 7.4**

**Property 24: Team Member Detail History**
*For any* team member detail view, it should display both current and historical department assignments
**Validates: Requirements 7.2**

**Property 25: Assignment During Creation**
*For any* team member creation with department assignment, the member should be created and assigned to the specified department in a single operation
**Validates: Requirements 7.3**

**Property 26: Existing Functionality Preservation**
*For any* existing team member search, filter, or data access operation, it should continue to work correctly after department management implementation
**Validates: Requirements 7.5, 7.6**

## Error Handling

### Validation Errors
- **Department Name Conflicts**: Return HTTP 409 with descriptive error message
- **Circular Hierarchy References**: Return HTTP 400 with cycle detection details
- **Invalid Manager Assignments**: Return HTTP 400 with validation details
- **Non-existent Entity References**: Return HTTP 404 with entity type and ID

### Business Logic Errors
- **Department Deletion with Members**: Return HTTP 409 with member count and suggestion to reassign
- **Multiple Active Assignments**: Automatically deactivate previous assignment or return conflict error
- **Orphaned Department Prevention**: Return HTTP 400 with dependency details

### Database Errors
- **Constraint Violations**: Map to appropriate HTTP status codes with user-friendly messages
- **Transaction Failures**: Implement automatic rollback with error logging
- **Connection Issues**: Return HTTP 503 with retry suggestions

## Testing Strategy

### Dual Testing Approach

The department management system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests Focus:**
- Specific examples of department operations (create, update, delete)
- Edge cases like empty departments, maximum hierarchy depth
- Integration points with existing team member functionality
- Error conditions and validation scenarios
- UI component rendering and interaction

**Property-Based Tests Focus:**
- Universal properties that hold for all valid inputs
- Comprehensive input coverage through randomization
- Data integrity across all operations
- Hierarchy validation across all possible structures

**Property Test Configuration:**
- Minimum 100 iterations per property test
- Each property test references its design document property
- Tag format: **Feature: department-management, Property {number}: {property_text}**
- Use fast-check library for TypeScript property-based testing

**Test Data Generation:**
- Random department names, descriptions, and hierarchies
- Random team member assignments and reassignments
- Random hierarchy modifications and validations
- Edge cases: empty departments, deep hierarchies, large member counts

**Integration Testing:**
- Department operations with existing team member workflows
- Database transaction integrity across all operations
- tRPC endpoint functionality and error handling
- React component integration with backend services