import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Building2, Users, User } from "lucide-react";
import type { Department } from "@shared/types";

interface DepartmentNode extends Department {
  children: DepartmentNode[];
  memberCount: number;
  managerName?: string;
}

interface OrganizationalChartProps {
  className?: string;
}

export function OrganizationalChart({ className }: OrganizationalChartProps) {
  const { data: hierarchy, isLoading, error } = trpc.department.getHierarchy.useQuery();
  const { data: stats } = trpc.department.getStats.useQuery();
  const { data: teamMembers } = trpc.team.list.useQuery();
  
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // Build the tree structure with enhanced data
  const buildDepartmentTree = (departments: Department[]): DepartmentNode[] => {
    if (!departments || !stats || !teamMembers) return [];

    const departmentMap = new Map<number, DepartmentNode>();
    
    // Initialize all departments as nodes
    departments.forEach(dept => {
      const deptStats = stats.departmentSizeDistribution?.find((s: any) => s.departmentId === dept.id);
      const manager = teamMembers.find(tm => tm.id === dept.managerId);
      
      departmentMap.set(dept.id, {
        ...dept,
        children: [],
        memberCount: deptStats?.memberCount || 0,
        managerName: manager?.name,
      });
    });

    // Build parent-child relationships
    const rootNodes: DepartmentNode[] = [];
    
    departments.forEach(dept => {
      const node = departmentMap.get(dept.id)!;
      
      if (dept.parentId) {
        const parent = departmentMap.get(dept.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found, treat as root
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  };

  const toggleExpanded = (departmentId: number) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(departmentId)) {
      newExpanded.delete(departmentId);
    } else {
      newExpanded.add(departmentId);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    if (!hierarchy) return;
    const allIds = new Set<number>();
    const collectIds = (nodes: DepartmentNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          allIds.add(node.id);
          collectIds(node.children);
        }
      });
    };
    collectIds(buildDepartmentTree(hierarchy));
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const DepartmentTreeNode = ({ node, level = 0 }: { node: DepartmentNode; level?: number }) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const indentClass = level > 0 ? `ml-${Math.min(level * 6, 24)}` : '';

    return (
      <div className={`${indentClass} mb-2`}>
        <Collapsible open={isExpanded} onOpenChange={() => hasChildren && toggleExpanded(node.id)}>
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {hasChildren ? (
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1 h-6 w-6"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  ) : (
                    <div className="w-6 h-6 flex items-center justify-center">
                      <div className="w-2 h-2 bg-gray-300 rounded-full" />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-lg">{node.name}</CardTitle>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-green-600" />
                    <Badge variant="secondary" className="text-sm">
                      {node.memberCount}
                    </Badge>
                  </div>
                  
                  {node.managerName && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4 text-purple-600" />
                      <span className="text-sm text-gray-600">{node.managerName}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {node.description && (
                <p className="text-sm text-gray-600 mt-2 ml-9">{node.description}</p>
              )}
            </CardHeader>
          </Card>

          {hasChildren && (
            <CollapsibleContent className="mt-2">
              <div className="space-y-2">
                {node.children.map(child => (
                  <DepartmentTreeNode 
                    key={child.id} 
                    node={child} 
                    level={level + 1} 
                  />
                ))}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Loading organizational chart...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <Building2 className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-2">Failed to load organizational chart</p>
          <p className="text-sm text-gray-500">{error.message}</p>
        </div>
      </Card>
    );
  }

  const departmentTree = buildDepartmentTree(hierarchy || []);

  if (departmentTree.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No departments found</p>
          <p className="text-sm text-gray-500">Create departments to see the organizational structure</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Organizational Chart</h2>
          <p className="text-gray-600 mt-1">Department hierarchy and reporting structure</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      {stats && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.totalDepartments}</p>
                <p className="text-sm text-gray-600">Total Departments</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.totalAssignedMembers}</p>
                <p className="text-sm text-gray-600">Assigned Members</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{stats.totalUnassignedMembers}</p>
                <p className="text-sm text-gray-600">Unassigned Members</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.maxHierarchyDepth}</p>
                <p className="text-sm text-gray-600">Max Depth</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Department Tree */}
      <div className="space-y-4">
        {departmentTree.map(node => (
          <DepartmentTreeNode key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}