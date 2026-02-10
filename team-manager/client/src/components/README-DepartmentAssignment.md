# Department Assignment Components

This document describes the new department assignment interface components implemented in task 11.

## Components

### DepartmentAssignmentModal

A comprehensive modal for managing team member assignments to departments.

**Features:**
- Assign team members to departments
- Reassign team members between departments  
- Unassign team members from departments
- Shows current assignment status
- Assignment preview before confirmation
- Supports assignment metadata recording

**Usage:**
```tsx
import { DepartmentAssignmentModal } from './DepartmentAssignmentModal';

function MyComponent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  return (
    <>
      <Button onClick={() => setIsModalOpen(true)}>
        Manage Assignments
      </Button>
      
      <DepartmentAssignmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedTeamMember={selectedMember} // Optional pre-selection
        selectedDepartment={selectedDept}   // Optional pre-selection
        mode="assign" // 'assign' | 'reassign' | 'unassign'
      />
    </>
  );
}
```

**Props:**
- `isOpen: boolean` - Controls modal visibility
- `onClose: () => void` - Called when modal should close
- `selectedTeamMember?: TeamMember` - Pre-select a team member
- `selectedDepartment?: Department` - Pre-select a department
- `mode?: 'assign' | 'reassign' | 'unassign'` - Initial mode (default: 'assign')

### DepartmentSelector

A hierarchical department selection dropdown with advanced features.

**Features:**
- Hierarchical department display with indentation
- Shows department paths (e.g., "Engineering > Frontend > UI Team")
- Optional member count display
- Department exclusion support
- Empty option support
- Loading states

**Usage:**
```tsx
import { DepartmentSelector } from './DepartmentSelector';

function MyComponent() {
  const [selectedDepartment, setSelectedDepartment] = useState<number>();
  
  return (
    <DepartmentSelector
      value={selectedDepartment}
      onValueChange={setSelectedDepartment}
      showHierarchy={true}
      showMemberCount={true}
      allowEmpty={true}
      emptyLabel="No department"
      excludeDepartmentIds={[1, 2]} // Optional exclusions
    />
  );
}
```

**Props:**
- `value?: number` - Selected department ID
- `onValueChange: (value: number | undefined) => void` - Selection change handler
- `placeholder?: string` - Placeholder text (default: "Select a department")
- `disabled?: boolean` - Disable the selector
- `showHierarchy?: boolean` - Show hierarchical structure (default: true)
- `showMemberCount?: boolean` - Show member counts (default: false)
- `allowEmpty?: boolean` - Allow empty selection (default: true)
- `emptyLabel?: string` - Label for empty option (default: "No department")
- `excludeDepartmentIds?: number[]` - Department IDs to exclude
- `className?: string` - Additional CSS classes

### Utility Hook: useDepartmentHierarchy

Provides utility functions for working with department hierarchies.

**Usage:**
```tsx
import { useDepartmentHierarchy } from './DepartmentSelector';

function MyComponent() {
  const { getDepartmentPath, getDepartmentLevel, isDescendantOf } = useDepartmentHierarchy();
  
  const path = getDepartmentPath(departmentId); // ["Engineering", "Frontend", "UI Team"]
  const level = getDepartmentLevel(departmentId); // 2
  const isChild = isDescendantOf(childId, parentId); // true/false
}
```

## Integration Example

The components are already integrated into the `DepartmentCard` component:

```tsx
// In DepartmentCard.tsx
<Button onClick={() => setIsAssignmentModalOpen(true)}>
  <Users className="h-3 w-3" />
  Manage
</Button>

<DepartmentAssignmentModal
  isOpen={isAssignmentModalOpen}
  onClose={() => {
    setIsAssignmentModalOpen(false);
    refetchMembers();
    onUpdate?.();
  }}
  selectedDepartment={department}
  mode="assign"
/>
```

## Requirements Validation

These components validate the following requirements:

**DepartmentAssignmentModal:**
- Requirements 2.1: Team member assignment to departments
- Requirements 2.2: Assignment metadata recording  
- Requirements 2.4: Team member reassignment
- Requirements 2.6: Team member unassignment

**DepartmentSelector:**
- Requirements 2.1: Department selection for assignments
- Requirements 3.1: Hierarchy display in selection interface

## Testing

Both components include comprehensive unit tests:

- `DepartmentAssignmentModal.test.tsx` - 13 test cases
- `DepartmentSelector.test.tsx` - 12 test cases

Run tests with:
```bash
npm test -- --run DepartmentAssignmentModal.test.tsx DepartmentSelector.test.tsx
```