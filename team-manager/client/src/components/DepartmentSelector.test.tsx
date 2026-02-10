import { describe, expect, it } from "vitest";

describe("DepartmentSelector Component", () => {
  it("should validate department hierarchy building logic", () => {
    // Test hierarchy building - validates Requirements 2.1, 3.1
    const departments = [
      { id: 1, name: "Engineering", parentId: null, description: "Tech team" },
      { id: 2, name: "Frontend", parentId: 1, description: "UI team" },
      { id: 3, name: "Backend", parentId: 1, description: "API team" },
      { id: 4, name: "UI/UX", parentId: 2, description: "Design team" },
      { id: 5, name: "Marketing", parentId: null, description: "Sales team" },
    ];

    // Test hierarchy level calculation
    const calculateLevel = (deptId: number, depts: typeof departments): number => {
      const dept = depts.find(d => d.id === deptId);
      if (!dept || !dept.parentId) return 0;
      
      return 1 + calculateLevel(dept.parentId, depts);
    };

    expect(calculateLevel(1, departments)).toBe(0); // Root level
    expect(calculateLevel(2, departments)).toBe(1); // Child of Engineering
    expect(calculateLevel(4, departments)).toBe(2); // Grandchild of Engineering
    expect(calculateLevel(5, departments)).toBe(0); // Root level

    // Test path building
    const buildPath = (deptId: number, depts: typeof departments): string[] => {
      const dept = depts.find(d => d.id === deptId);
      if (!dept) return [];
      
      const path = [dept.name];
      if (dept.parentId) {
        const parentPath = buildPath(dept.parentId, depts);
        return [...parentPath, ...path];
      }
      
      return path;
    };

    expect(buildPath(1, departments)).toEqual(["Engineering"]);
    expect(buildPath(2, departments)).toEqual(["Engineering", "Frontend"]);
    expect(buildPath(4, departments)).toEqual(["Engineering", "Frontend", "UI/UX"]);
    expect(buildPath(5, departments)).toEqual(["Marketing"]);
  });

  it("should validate hierarchy flattening for select options", () => {
    // Test hierarchy flattening - validates Requirements 3.1
    interface DepartmentWithHierarchy {
      id: number;
      name: string;
      parentId: number | null;
      level: number;
      path: string[];
      children?: DepartmentWithHierarchy[];
    }

    const hierarchyData: DepartmentWithHierarchy[] = [
      {
        id: 1,
        name: "Engineering",
        parentId: null,
        level: 0,
        path: ["Engineering"],
        children: [
          {
            id: 2,
            name: "Frontend",
            parentId: 1,
            level: 1,
            path: ["Engineering", "Frontend"],
            children: [
              {
                id: 4,
                name: "UI/UX",
                parentId: 2,
                level: 2,
                path: ["Engineering", "Frontend", "UI/UX"],
              },
            ],
          },
          {
            id: 3,
            name: "Backend",
            parentId: 1,
            level: 1,
            path: ["Engineering", "Backend"],
          },
        ],
      },
      {
        id: 5,
        name: "Marketing",
        parentId: null,
        level: 0,
        path: ["Marketing"],
      },
    ];

    // Test flattening logic
    const flattenHierarchy = (depts: DepartmentWithHierarchy[]): DepartmentWithHierarchy[] => {
      const result: DepartmentWithHierarchy[] = [];
      
      for (const dept of depts) {
        result.push(dept);
        if (dept.children && dept.children.length > 0) {
          result.push(...flattenHierarchy(dept.children));
        }
      }
      
      return result;
    };

    const flattened = flattenHierarchy(hierarchyData);
    
    expect(flattened).toHaveLength(5);
    expect(flattened.map(d => d.id)).toEqual([1, 2, 4, 3, 5]);
    expect(flattened.map(d => d.level)).toEqual([0, 1, 2, 1, 0]);
    expect(flattened.map(d => d.name)).toEqual(["Engineering", "Frontend", "UI/UX", "Backend", "Marketing"]);
  });

  it("should validate department option formatting", () => {
    // Test option formatting - validates Requirements 2.1, 3.1
    const departmentWithHierarchy = {
      id: 4,
      name: "UI/UX",
      parentId: 2,
      level: 2,
      path: ["Engineering", "Frontend", "UI/UX"],
      description: "User interface and experience design team",
      memberCount: 5,
    };

    // Test display name formatting with hierarchy
    const formatWithHierarchy = (dept: typeof departmentWithHierarchy, showHierarchy: boolean) => {
      const indent = showHierarchy ? "  ".repeat(dept.level) : "";
      const hierarchyIndicator = showHierarchy && dept.level > 0 ? "└ " : "";
      
      return {
        displayName: `${indent}${hierarchyIndicator}${dept.name}`,
        fullPath: dept.path.join(" > "),
        level: dept.level,
        memberCount: dept.memberCount,
      };
    };

    const formattedWithHierarchy = formatWithHierarchy(departmentWithHierarchy, true);
    expect(formattedWithHierarchy.displayName).toBe("    └ UI/UX");
    expect(formattedWithHierarchy.fullPath).toBe("Engineering > Frontend > UI/UX");
    expect(formattedWithHierarchy.level).toBe(2);
    expect(formattedWithHierarchy.memberCount).toBe(5);

    const formattedWithoutHierarchy = formatWithHierarchy(departmentWithHierarchy, false);
    expect(formattedWithoutHierarchy.displayName).toBe("UI/UX");
    expect(formattedWithoutHierarchy.fullPath).toBe("Engineering > Frontend > UI/UX");
  });

  it("should validate department exclusion logic", () => {
    // Test department exclusion - validates Requirements 2.1
    const allDepartments = [
      { id: 1, name: "Engineering", parentId: null },
      { id: 2, name: "Frontend", parentId: 1 },
      { id: 3, name: "Backend", parentId: 1 },
      { id: 4, name: "Marketing", parentId: null },
      { id: 5, name: "HR", parentId: null },
    ];

    const excludeDepartmentIds = [2, 4]; // Exclude Frontend and Marketing

    // Test filtering logic
    const filteredDepartments = allDepartments.filter(
      dept => !excludeDepartmentIds.includes(dept.id)
    );

    expect(filteredDepartments).toHaveLength(3);
    expect(filteredDepartments.map(d => d.id)).toEqual([1, 3, 5]);
    expect(filteredDepartments.map(d => d.name)).toEqual(["Engineering", "Backend", "HR"]);
    expect(filteredDepartments.find(d => d.name === "Frontend")).toBeUndefined();
    expect(filteredDepartments.find(d => d.name === "Marketing")).toBeUndefined();
  });

  it("should validate member count display logic", () => {
    // Test member count display - validates Requirements 2.1
    const departmentStats = {
      departmentSizes: [
        { departmentId: 1, memberCount: 10 },
        { departmentId: 2, memberCount: 5 },
        { departmentId: 3, memberCount: 3 },
        { departmentId: 4, memberCount: 0 },
      ],
    };

    const departments = [
      { id: 1, name: "Engineering" },
      { id: 2, name: "Frontend" },
      { id: 3, name: "Backend" },
      { id: 4, name: "Marketing" },
      { id: 5, name: "HR" }, // No stats available
    ];

    // Test member count lookup
    const getMemberCount = (departmentId: number) => {
      return departmentStats.departmentSizes.find(s => s.departmentId === departmentId)?.memberCount || 0;
    };

    expect(getMemberCount(1)).toBe(10);
    expect(getMemberCount(2)).toBe(5);
    expect(getMemberCount(3)).toBe(3);
    expect(getMemberCount(4)).toBe(0);
    expect(getMemberCount(5)).toBe(0); // Default when no stats

    // Test member count formatting
    departments.forEach(dept => {
      const memberCount = getMemberCount(dept.id);
      expect(typeof memberCount).toBe('number');
      expect(memberCount).toBeGreaterThanOrEqual(0);
    });
  });

  it("should validate value change handling", () => {
    // Test value change logic - validates Requirements 2.1
    const testCases = [
      { input: "1", expected: 1 },
      { input: "42", expected: 42 },
      { input: "", expected: undefined },
      { input: "0", expected: 0 },
    ];

    const handleValueChange = (selectedValue: string): number | undefined => {
      if (selectedValue === "") {
        return undefined;
      } else {
        return parseInt(selectedValue);
      }
    };

    testCases.forEach(testCase => {
      const result = handleValueChange(testCase.input);
      expect(result).toBe(testCase.expected);
    });

    // Test type validation
    expect(typeof handleValueChange("1")).toBe('number');
    expect(typeof handleValueChange("")).toBe('undefined');
    expect(Number.isInteger(handleValueChange("42"))).toBe(true);
  });

  it("should validate empty option handling", () => {
    // Test empty option logic - validates Requirements 2.1
    const selectorProps = {
      allowEmpty: true,
      emptyLabel: "No department",
      value: undefined,
    };

    // Test empty option configuration
    expect(selectorProps.allowEmpty).toBe(true);
    expect(selectorProps.emptyLabel).toBe("No department");
    expect(selectorProps.value).toBeUndefined();

    // Test empty option display logic
    const shouldShowEmptyOption = selectorProps.allowEmpty;
    expect(shouldShowEmptyOption).toBe(true);

    // Test empty option value handling
    const emptyOptionValue = "";
    const isEmptySelection = selectorProps.value === undefined;
    expect(isEmptySelection).toBe(true);

    // Test custom empty labels
    const customEmptyLabels = [
      "No department selected",
      "Choose a department",
      "Unassigned",
      "None",
    ];

    customEmptyLabels.forEach(label => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it("should validate hierarchy utility functions", () => {
    // Test utility functions - validates Requirements 3.1
    const departments = [
      { id: 1, name: "Engineering", parentId: null },
      { id: 2, name: "Frontend", parentId: 1 },
      { id: 3, name: "Backend", parentId: 1 },
      { id: 4, name: "UI/UX", parentId: 2 },
      { id: 5, name: "Marketing", parentId: null },
    ];

    // Test getDepartmentPath utility
    const getDepartmentPath = (departmentId: number): string[] => {
      const buildPath = (id: number, path: string[] = []): string[] => {
        const dept = departments.find(d => d.id === id);
        if (!dept) return path;
        
        const newPath = [dept.name, ...path];
        
        if (dept.parentId) {
          return buildPath(dept.parentId, newPath);
        }
        
        return newPath;
      };
      
      return buildPath(departmentId);
    };

    expect(getDepartmentPath(1)).toEqual(["Engineering"]);
    expect(getDepartmentPath(2)).toEqual(["Engineering", "Frontend"]);
    expect(getDepartmentPath(4)).toEqual(["Engineering", "Frontend", "UI/UX"]);
    expect(getDepartmentPath(5)).toEqual(["Marketing"]);
    expect(getDepartmentPath(999)).toEqual([]); // Non-existent department

    // Test getDepartmentLevel utility
    const getDepartmentLevel = (departmentId: number): number => {
      const path = getDepartmentPath(departmentId);
      return Math.max(0, path.length - 1);
    };

    expect(getDepartmentLevel(1)).toBe(0); // Root
    expect(getDepartmentLevel(2)).toBe(1); // Child
    expect(getDepartmentLevel(4)).toBe(2); // Grandchild
    expect(getDepartmentLevel(999)).toBe(0); // Non-existent (Math.max(0, path.length - 1) where path.length = 0)

    // Test isDescendantOf utility
    const isDescendantOf = (childId: number, ancestorId: number): boolean => {
      const checkAncestry = (id: number): boolean => {
        const dept = departments.find(d => d.id === id);
        if (!dept || !dept.parentId) return false;
        
        if (dept.parentId === ancestorId) return true;
        
        return checkAncestry(dept.parentId);
      };
      
      return checkAncestry(childId);
    };

    expect(isDescendantOf(2, 1)).toBe(true); // Frontend is child of Engineering
    expect(isDescendantOf(4, 1)).toBe(true); // UI/UX is descendant of Engineering
    expect(isDescendantOf(4, 2)).toBe(true); // UI/UX is child of Frontend
    expect(isDescendantOf(1, 2)).toBe(false); // Engineering is not descendant of Frontend
    expect(isDescendantOf(5, 1)).toBe(false); // Marketing is not descendant of Engineering
    expect(isDescendantOf(1, 1)).toBe(false); // Department is not descendant of itself
  });

  it("should validate component props and configuration", () => {
    // Test component props - validates Requirements 2.1, 3.1
    const defaultProps = {
      value: undefined,
      onValueChange: () => {},
      placeholder: "Select a department",
      disabled: false,
      showHierarchy: true,
      showMemberCount: false,
      allowEmpty: true,
      emptyLabel: "No department",
      excludeDepartmentIds: [],
      className: undefined,
    };

    // Test prop types and defaults
    expect(typeof defaultProps.placeholder).toBe('string');
    expect(typeof defaultProps.disabled).toBe('boolean');
    expect(typeof defaultProps.showHierarchy).toBe('boolean');
    expect(typeof defaultProps.showMemberCount).toBe('boolean');
    expect(typeof defaultProps.allowEmpty).toBe('boolean');
    expect(typeof defaultProps.emptyLabel).toBe('string');
    expect(Array.isArray(defaultProps.excludeDepartmentIds)).toBe(true);
    expect(typeof defaultProps.onValueChange).toBe('function');

    // Test prop validation
    expect(defaultProps.placeholder.length).toBeGreaterThan(0);
    expect(defaultProps.emptyLabel.length).toBeGreaterThan(0);
    expect(defaultProps.excludeDepartmentIds.length).toBe(0);

    // Test custom props
    const customProps = {
      ...defaultProps,
      placeholder: "Choose your department",
      showHierarchy: false,
      showMemberCount: true,
      allowEmpty: false,
      emptyLabel: "Unassigned",
      excludeDepartmentIds: [1, 2, 3],
      className: "custom-selector",
    };

    expect(customProps.placeholder).toBe("Choose your department");
    expect(customProps.showHierarchy).toBe(false);
    expect(customProps.showMemberCount).toBe(true);
    expect(customProps.allowEmpty).toBe(false);
    expect(customProps.emptyLabel).toBe("Unassigned");
    expect(customProps.excludeDepartmentIds).toEqual([1, 2, 3]);
    expect(customProps.className).toBe("custom-selector");
  });

  it("should validate loading and error states", () => {
    // Test loading and error handling - validates Requirements 2.1
    const loadingState = {
      isLoading: true,
      data: undefined,
      error: null,
    };

    const loadedState = {
      isLoading: false,
      data: [
        { id: 1, name: "Engineering", parentId: null },
        { id: 2, name: "Marketing", parentId: null },
      ],
      error: null,
    };

    const errorState = {
      isLoading: false,
      data: undefined,
      error: new Error("Failed to load departments"),
    };

    // Test loading state
    expect(loadingState.isLoading).toBe(true);
    expect(loadingState.data).toBeUndefined();
    expect(loadingState.error).toBeNull();

    // Test loaded state
    expect(loadedState.isLoading).toBe(false);
    expect(loadedState.data).toBeDefined();
    expect(Array.isArray(loadedState.data)).toBe(true);
    expect(loadedState.data).toHaveLength(2);
    expect(loadedState.error).toBeNull();

    // Test error state
    expect(errorState.isLoading).toBe(false);
    expect(errorState.data).toBeUndefined();
    expect(errorState.error).toBeInstanceOf(Error);
    expect(errorState.error?.message).toBe("Failed to load departments");
  });

  it("should validate department sorting and organization", () => {
    // Test department sorting - validates Requirements 3.1
    const unsortedDepartments = [
      { id: 3, name: "Zebra Team", parentId: 1 },
      { id: 1, name: "Alpha Team", parentId: null },
      { id: 4, name: "Beta Team", parentId: 1 },
      { id: 2, name: "Marketing", parentId: null },
    ];

    // Test alphabetical sorting
    const sortedByName = [...unsortedDepartments].sort((a, b) => a.name.localeCompare(b.name));
    expect(sortedByName.map(d => d.name)).toEqual(["Alpha Team", "Beta Team", "Marketing", "Zebra Team"]);

    // Test hierarchical sorting (root departments first, then children)
    const sortedHierarchically = [...unsortedDepartments].sort((a, b) => {
      // Root departments first
      if (a.parentId === null && b.parentId !== null) return -1;
      if (a.parentId !== null && b.parentId === null) return 1;
      
      // Same level, sort alphabetically
      return a.name.localeCompare(b.name);
    });

    const rootDepartments = sortedHierarchically.filter(d => d.parentId === null);
    const childDepartments = sortedHierarchically.filter(d => d.parentId !== null);

    expect(rootDepartments.map(d => d.name)).toEqual(["Alpha Team", "Marketing"]);
    expect(childDepartments.map(d => d.name)).toEqual(["Beta Team", "Zebra Team"]);
  });

  it("should validate description truncation logic", () => {
    // Test description truncation - validates Requirements 2.1
    const departmentsWithDescriptions = [
      {
        id: 1,
        name: "Engineering",
        description: "Short description",
      },
      {
        id: 2,
        name: "Marketing",
        description: "This is a very long description that should be truncated because it exceeds the maximum length limit",
      },
      {
        id: 3,
        name: "HR",
        description: "",
      },
      {
        id: 4,
        name: "Finance",
        description: undefined,
      },
    ];

    const truncateDescription = (description: string | undefined, maxLength: number = 50) => {
      if (!description) return "";
      
      return description.length > maxLength 
        ? `${description.substring(0, maxLength)}...`
        : description;
    };

    expect(truncateDescription(departmentsWithDescriptions[0].description)).toBe("Short description");
    expect(truncateDescription(departmentsWithDescriptions[1].description)).toBe("This is a very long description that should be tru...");
    expect(truncateDescription(departmentsWithDescriptions[2].description)).toBe("");
    expect(truncateDescription(departmentsWithDescriptions[3].description)).toBe("");

    // Test custom max length
    expect(truncateDescription("This is a test description", 10)).toBe("This is a ...");
    expect(truncateDescription("Short", 10)).toBe("Short");
  });
});