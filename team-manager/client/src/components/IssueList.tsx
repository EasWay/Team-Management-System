import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Issue {
  number: number;
  title: string;
  state: string;
  url: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
}

interface IssueListProps {
  issues: Issue[];
}

export function IssueList({ issues }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 text-center">
          <p className="text-gray-600">No issues found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Issues</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {issues.map((issue) => (
            <div key={issue.number} className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50">
              <AlertCircle className="h-5 w-5 text-gray-400 mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium">#{issue.number} {issue.title}</p>
                  <Badge variant={issue.state === 'open' ? 'default' : 'secondary'}>
                    {issue.state}
                  </Badge>
                </div>
                {issue.labels.length > 0 && (
                  <div className="flex gap-1 flex-wrap mb-1">
                    {issue.labels.map((label) => (
                      <Badge key={label} variant="outline" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Opened by {issue.author} on {new Date(issue.createdAt).toLocaleDateString()}
                </p>
              </div>
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
