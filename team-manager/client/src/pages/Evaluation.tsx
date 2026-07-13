import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useTeamContext } from "@/contexts/TeamContext";
import {
  Sparkles,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Rocket,
  Loader2,
  BarChart3,
  ClipboardCheck,
  FileSearch,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EvaluationDashboard } from "@/components/EvaluationDashboard";

export default function Evaluation() {
  const { selectedTeamId } = useTeamContext();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string>("");

  const { data: evaluatedProjects, isLoading: projectsLoading } = trpc.evaluation.listEvaluated.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId }
  );

  const { data: stats, isLoading: statsLoading } = trpc.evaluation.getStats.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId }
  );

  const { data: readyProjects } = trpc.evaluation.getReadyForLaunch.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId }
  );

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-blue-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500">Excellent</Badge>;
    if (score >= 70) return <Badge className="bg-blue-500">Good</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-500">Needs Work</Badge>;
    return <Badge variant="destructive">Critical</Badge>;
  };

  if (!selectedTeamId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Please select a team to view evaluations</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <ClipboardCheck className="h-7 w-7" />
            Quality Assurance Office
          </h1>
          <p className="text-muted-foreground">
            Final review station where completed folders are inspected before launch
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Folders Inspected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEvaluated}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Average Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreColor(stats.averageScore)}`}>
                  {stats.averageScore}/100
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Rocket className="h-4 w-4" />
                  Cleared for Launch
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.readyForLaunch}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Needs Revision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.needsWork}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ready for Launch Projects */}
        {readyProjects && readyProjects.length > 0 && (
          <Card className="border-green-500">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-green-500" />
                <CardTitle>Cleared for Launch</CardTitle>
              </div>
              <CardDescription>
                Folders that passed all quality checks and are ready to ship
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {readyProjects.map((project: any) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Quality Score: {(project.evaluationData as any)?.overallScore}/100
                        </p>
                      </div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setSelectedProjectName(project.name);
                          }}
                        >
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <FileSearch className="h-4 w-4" />
                            Folder Inspection: {project.name}
                          </DialogTitle>
                          <DialogDescription>
                            Comprehensive quality assurance report
                          </DialogDescription>
                        </DialogHeader>
                        {selectedProjectId === project.id && (
                          <EvaluationDashboard
                            projectId={project.id}
                            projectName={project.name}
                          />
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Evaluated Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>All Inspected Folders</CardTitle>
            </div>
            <CardDescription>
              View detailed quality reports for all completed folders
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : evaluatedProjects && evaluatedProjects.length > 0 ? (
              <div className="space-y-3">
                {evaluatedProjects.map((project: any) => (
                  <Card key={project.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{project.name}</CardTitle>
                          <CardDescription>
                            Inspected {new Date(project.evaluatedAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {getScoreBadge(project.overallScore)}
                          {project.readyForLaunch && (
                            <Badge className="bg-green-500">
                              <Rocket className="h-3 w-3 mr-1" />
                              Ready
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Score Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Quality Score</span>
                          <span className={`font-bold ${getScoreColor(project.overallScore)}`}>
                            {project.overallScore}/100
                          </span>
                        </div>
                        <Progress value={project.overallScore} className="h-2" />
                      </div>

                      {/* Actions */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setSelectedProjectId(project.id);
                              setSelectedProjectName(project.name);
                            }}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            View Full Inspection Report
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <FileSearch className="h-4 w-4" />
                              Folder Inspection: {project.name}
                            </DialogTitle>
                            <DialogDescription>
                              Comprehensive quality assurance report
                            </DialogDescription>
                          </DialogHeader>
                          {selectedProjectId === project.id && (
                            <EvaluationDashboard
                              projectId={project.id}
                              projectName={project.name}
                            />
                          )}
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No inspected folders yet. Complete folders and run quality assurance to see reports here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
