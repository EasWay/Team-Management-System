import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitPullRequest, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PullRequest {
  number: number;
  title: string;
  state: string;
  url: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

interface PullRequestListProps {
  pullRequests: PullRequest[];
}

export function PullRequestList({ pullRequests }: PullRequestListProps) {
  if (pullRequests.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 text-center">
          <p className="text-gray-600">No pull requests found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pull Requests</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pullRequests.map((pr) => (
            <div key={pr.number} className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50">
              <GitPullRequest className="h-5 w-5 text-gray-400 mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium">#{pr.number} {pr.title}</p>
                  <Badge variant={pr.state === 'open' ? 'default' : pr.mergedAt ? 'secondary' : 'outline'}>
                    {pr.mergedAt ? 'merged' : pr.state}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {pr.author} wants to merge {pr.head.ref} into {pr.base.ref}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Created {new Date(pr.createdAt).toLocaleDateString()}
                </p>
              </div>
              <a
                href={pr.url}
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
