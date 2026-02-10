import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronRight, Users } from "lucide-react";
import type { Department } from "@shared/types";

interface DepartmentWithHierarchy extends Department {
  level: number;
  path: string[];
  memberCount?: number;
  children?: DepartmentWithHierarchy[];
}

interface DepartmentSelectorProps {
  value?: number;
  onValueChange: (value: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  showHierarchy?: boolean;
  showMemberCount?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  excludeDepartmentIds?: number[];
  className?: string;
}

export function DepartmentSelector({
  value,
  onValueChange,
  placeholder = "Select a department",
  disabled = false,
  showHierarchy = true,
  showMemberCount = false,
  allowEmpty = true,
  emptyLabel = "No department",
  excludeDepartmentIds = [],
  className,
}: DepartmentSelectorProps) {
  const { data: departments, isLoading } = trpc.department.list.useQuery();
  const { data: departmentStats } = trpc.department.getStats.useQuery(
    undefined,
    { enabled: showMemberCount }
  );

  const hierarchicalDepartments = useMemo(() => {
    if (!departments) return [];

    // Filter out excluded departments
    const filteredDepartments = departments.filter(
      dept => !excludeDepartmentIds.includes(dept.id)
    );

    // Build hierarchy structure
    const buildHierarchy = (
      depts: Department[],
      parentId: number | null = null,
      level: number = 0,
      path: string[] = []
    ): DepartmentWithHierarchy[] => {
      return depts
        .filter(dept => dept.parentId === parentId)
        .map(dept => {
          const currentPath = [...path, dept.name];
          const memberCount = showMemberCount 
            ? departmentStats?.departmentSizeDistribution.find(s => s.departmentId === dept.id)?.memberCount || 0
            : undefined;

          const hierarchyDept: DepartmentWithHierarchy = {
            ...dept,
            level,
            path: currentPath,
            memberCount,
            children: buildHierarchy(depts, dept.id, level + 1, currentPath),
          };

          return hierarchyDept;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    };

    const hierarchy = buildHierarchy(filteredDepartments);

    // Flatten hierarchy for select options while preserving structure info
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

    return flattenHierarchy(hierarchy);
  }, [departments, excludeDepartmentIds, showMemberCount, departmentStats]);

  const selectedDepartment = hierarchicalDepartments.find(dept => dept.id === value);

  const formatDepartmentOption = (dept: DepartmentWithHierarchy) => {
    const indent = showHierarchy ? "  ".repeat(dept.level) : "";
    const hierarchyIndicator = showHierarchy && dept.level > 0 ? "└ " : "";
    
    return {
      displayName: `${indent}${hierarchyIndicator}${dept.name}`,
      fullPath: dept.path.join(" > "),
      level: dept.level,
      memberCount: dept.memberCount,
    };
  };

  const handleValueChange = (selectedValue: string) => {
    if (selectedValue === "none" || selectedValue === "") {
      onValueChange(undefined);
    } else {
      onValueChange(parseInt(selectedValue));
    }
  };

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Loading departments..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select
      value={value?.toString() || "none"}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedDepartment && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              <span>{selectedDepartment.name}</span>
              {showHierarchy && selectedDepartment.level > 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <ChevronRight className="h-3 w-3" />
                  <span>{formatDepartmentOption(selectedDepartment).fullPath}</span>
                </div>
              )}
              {showMemberCount && selectedDepartment.memberCount !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {selectedDepartment.memberCount}
                </Badge>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && (
          <SelectItem value="none">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">{emptyLabel}</span>
            </div>
          </SelectItem>
        )}
        
        {hierarchicalDepartments.map((dept) => {
          const formatted = formatDepartmentOption(dept);
          
          return (
            <SelectItem key={dept.id} value={dept.id.toString()}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Building2 
                    className={`h-4 w-4 ${
                      dept.level === 0 ? 'text-blue-600' : 'text-gray-500'
                    }`} 
                  />
                  <div className="flex flex-col">
                    <span 
                      className={`${
                        dept.level === 0 ? 'font-medium' : 'font-normal'
                      }`}
                      style={{ 
                        fontFamily: 'monospace',
                        fontSize: dept.level > 0 ? '0.875rem' : '1rem'
                      }}
                    >
                      {formatted.displayName}
                    </span>
                    {showHierarchy && dept.level > 0 && (
                      <span className="text-xs text-gray-500">
                        {formatted.fullPath}
                      </span>
                    )}
                    {dept.description && (
                      <span className="text-xs text-gray-500 mt-1">
                        {dept.description.length > 50 
                          ? `${dept.description.substring(0, 50)}...`
                          : dept.description
                        }
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {showMemberCount && formatted.memberCount !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {formatted.memberCount}
                    </Badge>
                  )}
                  {dept.level === 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Root
                    </Badge>
                  )}
                </div>
              </div>
            </SelectItem>
          );
        })}
        
        {hierarchicalDepartments.length === 0 && (
          <SelectItem value="empty" disabled>
            <div className="flex items-center gap-2 text-gray-500">
              <Building2 className="h-4 w-4" />
              <span>No departments available</span>
            </div>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

// Utility hook for getting department hierarchy information
export function useDepartmentHierarchy() {
  const { data: departments } = trpc.department.list.useQuery();
  
  const getDepartmentPath = (departmentId: number): string[] => {
    if (!departments) return [];
    
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
  
  const getDepartmentLevel = (departmentId: number): number => {
    const path = getDepartmentPath(departmentId);
    return Math.max(0, path.length - 1);
  };
  
  const isDescendantOf = (childId: number, ancestorId: number): boolean => {
    if (!departments) return false;
    
    const checkAncestry = (id: number): boolean => {
      const dept = departments.find(d => d.id === id);
      if (!dept || !dept.parentId) return false;
      
      if (dept.parentId === ancestorId) return true;
      
      return checkAncestry(dept.parentId);
    };
    
    return checkAncestry(childId);
  };
  
  return {
    getDepartmentPath,
    getDepartmentLevel,
    isDescendantOf,
  };
}