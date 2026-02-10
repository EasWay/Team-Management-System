# Implementation Plan: Department Management

## Overview

This implementation plan converts the department management design into discrete coding tasks that build incrementally. Each task focuses on specific components while maintaining integration with the existing team manager application architecture.

## Status: ✅ COMPLETE

All tasks have been successfully completed. The Department Management feature is fully implemented, tested, and integrated into the Team Manager application. See `TASK_15_COMPLETION_SUMMARY.md` and `INTEGRATION_VERIFICATION.md` for detailed completion reports.

## Tasks

- [x] 1. Set up database schema and core data models
  - [x] 1.1 Create departments table schema in Drizzle
    - Add departments table with id, name, description, parentId, managerId, timestamps
    - Add departmentAssignments table with teamMemberId, departmentId, assignment metadata
    - Update schema exports and type definitions
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 1.2 Write property test for department creation
    - **Property 1: Department CRUD Operations**
    - **Validates: Requirements 1.1, 1.3, 1.4**

  - [x] 1.3 Create database relations and constraints
    - Define foreign key relationships between departments, team members, and assignments
    - Add unique constraints for department names
    - Set up cascade rules for referential integrity
    - _Requirements: 1.2, 6.1, 6.3_

  - [x] 1.4 Write property test for referential integrity
    - **Property 18: Data Integrity Maintenance**
    - **Validates: Requirements 6.1**

- [x] 2. Implement core department operations
  - [x] 2.1 Create department database operations
    - Implement createDepartment, getDepartments, getDepartmentById functions
    - Implement updateDepartment and deleteDepartment with validation
    - Add department name uniqueness validation
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Write property test for department uniqueness
    - **Property 2: Department Name Uniqueness**
    - **Validates: Requirements 1.2**

  - [x] 2.3 Implement department deletion validation
    - Add logic to prevent deletion of departments with assigned members
    - Implement appropriate error messages and status codes
    - _Requirements: 1.5_

  - [x] 2.4 Write property test for deletion prevention
    - **Property 3: Department Deletion Prevention**
    - **Validates: Requirements 1.5**
  - [x] 3. Implement department assignment operations
  - [x] 3.1 Create assignment database operations
    - Implement assignMemberToDepartment with metadata recording
    - Implement reassignMember with history preservation
    - Implement unassignMemberFromDepartment
    - Add single active assignment constraint logic
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 Write property test for assignment operations
    - **Property 4: Team Member Assignment Management**
    - **Validates: Requirements 2.1, 2.4, 2.6**

  - [x] 3.3 Write property test for assignment constraints
    - **Property 6: Single Active Assignment Constraint**
    - **Validates: Requirements 2.3**

  - [x] 3.4 Implement assignment validation
    - Add department existence validation before assignment
    - Implement manager validation for department assignments
    - _Requirements: 2.7, 6.3_

  - [x] 3.5 Write property test for assignment validation
    - **Property 8: Department Existence Validation**
    - **Validates: Requirements 2.7**

- [x] 4. Checkpoint - Ensure core operations work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement department hierarchy management
  - [x] 5.1 Create hierarchy database operations
    - Implement setDepartmentParent with circular reference detection
    - Implement getDepartmentHierarchy with tree structure building
    - Add support for multiple nesting levels and root departments
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.2 Write property test for hierarchy operations
    - **Property 9: Department Hierarchy Management**
    - **Validates: Requirements 3.1, 3.4, 3.5**

  - [x] 5.3 Write property test for circular reference prevention
    - **Property 10: Circular Reference Prevention**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 5.4 Implement hierarchy integrity maintenance
    - Add logic for handling department deletion in hierarchies
    - Implement orphan prevention and child department handling
    - _Requirements: 3.6, 6.2_

  - [x] 5.5 Write property test for hierarchy integrity
    - **Property 11: Hierarchy Referential Integrity**
    - **Validates: Requirements 3.6**

- [x] 6. Create tRPC API endpoints
  - [x] 6.1 Implement department router endpoints
    - Create department CRUD endpoints (list, getById, create, update, delete)
    - Add hierarchy management endpoints (getHierarchy, setParent)
    - Implement assignment endpoints (assignMember, unassignMember, getMembers)
    - Add input validation schemas using Zod
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.4, 2.6, 3.1_

  - [x] 6.2 Write integration tests for tRPC endpoints
    - Test all CRUD operations through tRPC interface
    - Test error handling and validation responses
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 6.3 Extend team member router for department integration
    - Add department assignment during team member creation
    - Enhance team member queries to include department information
    - Maintain compatibility with existing team member endpoints
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6_

  - [x] 6.4 Write property test for team member integration
    - **Property 25: Assignment During Creation**
    - **Validates: Requirements 7.3**

- [x] 7. Implement reporting and statistics
  - [x] 7.1 Create department reporting functions
    - Implement getDepartmentStats for size and hierarchy metrics
    - Create getUnassignedTeamMembers function
    - Add team member distribution reporting
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 7.2 Write property test for reporting accuracy
    - **Property 15: Department Reporting Accuracy**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.6**

  - [x] 7.3 Implement export functionality
    - Add department data export capabilities
    - Include historical assignment data in reports
    - _Requirements: 5.4, 5.5_

  - [x] 7.4 Write property test for export functionality
    - **Property 16: Report Export Functionality**
    - **Validates: Requirements 5.4**

- [x] 8. Checkpoint - Ensure backend functionality complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Create React components for department management
  - [x] 9.1 Create DepartmentList component
    - Implement department listing with search and filter capabilities
    - Add department creation, editing, and deletion actions
    - Include member count and manager information display
    - _Requirements: 4.4, 4.5, 1.1, 1.3, 1.4_

  - [x] 9.2 Write unit tests for DepartmentList component
    - Test rendering, search, filter, and CRUD operations
    - _Requirements: 4.4, 4.5_

  - [x] 9.3 Create DepartmentForm component
    - Implement create/edit modal form for departments
    - Add validation for department name uniqueness
    - Include parent department selection and manager assignment
    - _Requirements: 1.1, 1.2, 1.3, 3.1_

  - [x] 9.4 Write unit tests for DepartmentForm component
    - Test form validation, submission, and error handling
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 10. Create organizational chart visualization
  - [x] 10.1 Implement OrganizationalChart component
    - Create tree visualization of department hierarchy
    - Display department names, member counts, and managers
    - Add expand/collapse functionality for department branches
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 10.2 Write unit tests for OrganizationalChart component
    - Test hierarchy rendering and interaction functionality
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 10.3 Create DepartmentCard component
    - Implement individual department display with member assignments
    - Show current team members assigned to each department
    - Add quick assignment/unassignment actions
    - _Requirements: 4.6, 2.1, 2.6_

  - [x] 10.4 Write unit tests for DepartmentCard component
    - Test member display and assignment actions
    - _Requirements: 4.6_

- [x] 11. Implement team member assignment interface
  - [x] 11.1 Create DepartmentAssignmentModal component
    - Implement modal for assigning team members to departments
    - Add department selection and assignment metadata
    - Include reassignment and unassignment capabilities
    - _Requirements: 2.1, 2.2, 2.4, 2.6_

  - [x] 11.2 Write unit tests for assignment modal
    - Test assignment operations and validation
    - _Requirements: 2.1, 2.4, 2.6_

  - [x] 11.3 Create DepartmentSelector component
    - Implement dropdown/select for choosing departments
    - Support hierarchy display in selection interface
    - _Requirements: 2.1, 3.1_

  - [x] 11.4 Write unit tests for DepartmentSelector
    - Test selection functionality and hierarchy display
    - _Requirements: 2.1, 3.1_

- [x] 12. Enhance existing team member components
  - [x] 12.1 Update TeamMemberList to show department information
    - Add department column to team member table
    - Include department filtering in existing search
    - Maintain all existing functionality
    - _Requirements: 7.1, 7.4, 7.5_

  - [x] 12.2 Write property test for existing functionality preservation
    - **Property 26: Existing Functionality Preservation**
    - **Validates: Requirements 7.5, 7.6**

  - [x] 12.3 Update team member detail views
    - Add current department assignment display
    - Include department assignment history
    - Add quick department reassignment action
    - _Requirements: 7.2, 2.4_

  - [x] 12.4 Write unit tests for enhanced team member views
    - Test department information display and history
    - _Requirements: 7.2_

- [x] 13. Implement audit logging and error handling
  - [x] 13.1 Add audit logging system
    - Implement logging for all department operations
    - Record user actions, timestamps, and operation details
    - _Requirements: 1.6, 6.6_

  - [x] 13.2 Write property test for audit logging
    - **Property 22: Audit Logging**
    - **Validates: Requirements 1.6, 6.6**

  - [x] 13.3 Implement comprehensive error handling
    - Add transaction rollback for failed operations
    - Implement user-friendly error messages
    - Handle team member deletion with department cleanup
    - _Requirements: 6.4, 6.5_

  - [x] 13.4 Write property test for error handling
    - **Property 21: Transaction Rollback**
    - **Validates: Requirements 6.5**

- [x] 14. Complete reporting and analytics interface
  - [x] 14.1 Enhance DepartmentReports component
    - Complete the reporting dashboard with comprehensive statistics display
    - Add interactive charts for team member distribution visualization
    - Implement export functionality UI (JSON, CSV download buttons)
    - Add filtering and date range selection for reports
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 14.2 Write unit tests for reporting interface
    - Test report generation and display functionality
    - Test export functionality and data accuracy
    - Test filtering and date range selection
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 14.3 Add historical reporting capabilities
    - Implement trend analysis charts using assignment history data
    - Create timeline views showing department changes over time
    - Add member movement pattern visualization
    - _Requirements: 5.5_

  - [x] 14.4 Write property test for historical reporting
    - **Property 17: Historical Data in Reports**
    - **Validates: Requirements 5.5**

- [x] 15. Final integration and testing
  - [x] 15.1 Update application navigation and routing
    - Add department management pages to main application navigation
    - Create proper routing for all department features
    - Ensure consistent UI/UX with existing application
    - Update main App.tsx to include department routes
    - _Requirements: 4.1, 4.4_

  - [x] 15.2 Write end-to-end integration tests
    - Test complete workflows from UI to database
    - Test department creation → assignment → hierarchy → reporting workflow
    - Verify all requirements are met in integrated system
    - Test error handling across the full stack
    - _Requirements: All requirements_

  - [x] 15.3 Final system integration verification
    - Verify all tRPC endpoints are properly connected to React components
    - Test data consistency across all department operations
    - Ensure proper error handling and user feedback throughout
    - Validate that existing team member functionality remains intact
    - _Requirements: All requirements integration_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Run all property-based tests and unit tests
  - Verify all requirements are fully implemented and tested
  - Ensure system is ready for production use

- [x] 17. Fix TypeScript compilation errors
  - [x] 17.1 Fix Drizzle query builder type errors in db.ts
    - Add `$dynamic()` to queries with conditional where clauses
    - Fix getAssignmentHistoryReport query builder
    - Fix getDepartmentTrendsReport query builder
    - _Bug Fix: TypeScript compilation errors_
  
  - [x] 17.2 Fix MapIterator downlevel iteration error
    - Convert Map.keys() iterator to array using Array.from()
    - Fix getDepartmentTrendsReport weekly data iteration
    - _Bug Fix: TypeScript compilation errors_
  
  - [x] 17.3 Fix test file type errors
    - Add type assertion for JSON.parse with nullable string
    - Update timeRange generator to include all valid values ('30d', '90d', '1y', 'all')
    - _Bug Fix: Test compilation errors_

## Notes

- All tasks are required for comprehensive implementation with full testing coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout development
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples, edge cases, and UI functionality
- Integration tests ensure all components work together correctly