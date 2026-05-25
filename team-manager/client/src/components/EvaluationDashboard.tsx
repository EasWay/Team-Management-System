import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Target,
  Palette,
  Briefcase,
  Code,
  TestTube,
  Rocket,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EvaluationDashboardProps {
  projectId: number;
  projectName: string;
  onEvaluationComplete?: () => void;
}

export function EvaluationDashboard({ projectId, projectName, onEvaluationComplete }: EvaluationDashboardProps) {
  const [isEvaluating, setIsEvaluating] = useState(false);

  const { data: evaluation, isLoading, refetch } = trpc.evaluation.get.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const evaluateMutation = trpc.evaluation.evaluate.useMutation({
    onSuccess: () => {
      toast.success("Folder inspection completed!");
      setIsEvaluating(false);
      refetch();
      onEvaluationComplete?.();
    },
    onError: (error) => {
      toast.error(error.message);
      setIsEvaluating(false);
    },
  });

  const handleEvaluate = () => {
    setIsEvaluating(true);
    evaluateMutation.mutate({ projectId });
  };

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

  const renderAlignmentCard = (
    title: string,
    icon: React.ReactNode,
    alignment: any
  ) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          {getScoreBadge(alignment.score)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Score</span>
            <span className={`font-bold text-2xl ${getScoreColor(alignment.score)}`}>
              {alignment.score}/100
            </span>
          </div>
          <Progress value={alignment.score} className="h-2" />
        </div>

        <Separator />

        {/* Strengths */}
        {alignment.strengths && alignment.strengths.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Strengths
            </h4>
            <ul className="space-y-1">
              {alignment.strengths.map((strength: string, idx: number) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Issues */}
        {alignment.issues && alignment.issues.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Issues
            </h4>
            <ul className="space-y-1">
              {alignment.issues.map((issue: string, idx: number) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {alignment.recommendations && alignment.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Recommendations
            </h4>
            <ul className="space-y-1">
              {alignment.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!evaluation?.evaluationData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>📋 Quality Assurance Inspection</CardTitle>
          </div>
          <CardDescription>
            Get comprehensive quality report for {projectName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <Sparkles className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              This folder hasn't been inspected yet. Run quality assurance to get comprehensive insights.
            </p>
            <Button onClick={handleEvaluate} disabled={isEvaluating}>
              {isEvaluating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Inspecting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Run Quality Inspection
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const evalData = evaluation.evaluationData;

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <Card className="border-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>📊 Quality Inspection Report</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {evalData.readyForLaunch ? (
                <Badge className="bg-green-500">
                  <Rocket className="h-3 w-3 mr-1" />
                  Cleared for Launch
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Needs Revision
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={handleEvaluate} disabled={isEvaluating}>
                {isEvaluating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Re-inspect"
                )}
              </Button>
            </div>
          </div>
          <CardDescription>
            Inspected on {new Date(evalData.evaluatedAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Score */}
          <div className="text-center">
            <div className={`text-6xl font-bold ${getScoreColor(evalData.overallScore)}`}>
              {evalData.overallScore}
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>
            <p className="text-muted-foreground mt-2">Overall Quality Score</p>
          </div>

          {/* Score Breakdown */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${getScoreColor(evalData.designAlignment.score)}`}>
                {evalData.designAlignment.score}
              </div>
              <p className="text-xs text-muted-foreground">Design</p>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getScoreColor(evalData.businessAlignment.score)}`}>
                {evalData.businessAlignment.score}
              </div>
              <p className="text-xs text-muted-foreground">Business</p>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getScoreColor(evalData.technicalQuality.score)}`}>
                {evalData.technicalQuality.score}
              </div>
              <p className="text-xs text-muted-foreground">Technical</p>
            </div>
          </div>

          {/* Critical Issues */}
          {evalData.criticalIssues && evalData.criticalIssues.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Critical Issues ({evalData.criticalIssues.length})
                </h4>
                <ul className="space-y-1">
                  {evalData.criticalIssues.map((issue: string, idx: number) => (
                    <li key={idx} className="text-sm text-red-600 flex items-start gap-2">
                      <span className="mt-0.5">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Top Recommendations */}
          {evalData.recommendations && evalData.recommendations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Top Recommendations
                </h4>
                <ul className="space-y-1">
                  {evalData.recommendations.slice(0, 5).map((rec: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs defaultValue="alignment" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="alignment">Quality Analysis</TabsTrigger>
          <TabsTrigger value="testing">Testing Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="alignment" className="space-y-4">
          <div className="grid gap-4">
            {renderAlignmentCard(
              "Design Quality",
              <Palette className="h-5 w-5 text-purple-500" />,
              evalData.designAlignment
            )}
            {renderAlignmentCard(
              "Business Requirements",
              <Briefcase className="h-5 w-5 text-blue-500" />,
              evalData.businessAlignment
            )}
            {renderAlignmentCard(
              "Technical Implementation",
              <Code className="h-5 w-5 text-green-500" />,
              evalData.technicalQuality
            )}
          </div>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TestTube className="h-5 w-5 text-orange-500" />
                <CardTitle>Testing Checklist</CardTitle>
              </div>
              <CardDescription>
                Comprehensive testing protocol generated by QA AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              {evalData.testingProtocol && evalData.testingProtocol.length > 0 ? (
                <div className="space-y-2">
                  {evalData.testingProtocol.map((test: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <p className="text-sm">{test}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No testing checklist generated
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
