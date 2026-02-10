import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitCommit, ExternalLink } from "lucide-react";

interface Commit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
}

interface CommitListProps {
  commits: Commit[];
}

export function CommitList({ commits }: CommitListProps) {
  if (commits.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 text-center">
          <p className="text-gray-600">No commits found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Commits</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {commits.map((commit) => (
            <div key={commit.sha} className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50">
              <GitCommit className="h-5 w-5 text-gray-400 mt-1" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{commit.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {commit.author.name} • {new Date(commit.author.date).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-400 font-mono mt-1">{commit.sha.substring(0, 7)}</p>
              </div>
              <a
                href={commit.url}
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
