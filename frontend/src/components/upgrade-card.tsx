import { Calendar, GitBranch, AlertCircle } from 'lucide-react';
import type { Upgrade } from '@/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface UpgradeCardProps {
  upgrade: Upgrade;
}

const statusColors: Record<string, string> = {
  proposed: 'secondary',
  approved: 'default',
  scheduled: 'default',
  queued: 'default',
  executed: 'secondary',
  canceled: 'destructive',
  release_posted: 'default',
  announced: 'default',
};

export function UpgradeCard({ upgrade }: UpgradeCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{upgrade.fork_name}</CardTitle>
            <CardDescription>{upgrade.chain_name}</CardDescription>
          </div>
          <Badge variant={statusColors[upgrade.status] as any}>
            {upgrade.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {upgrade.activation_ts && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-primary" />
            <span>{new Date(upgrade.activation_ts).toLocaleString()}</span>
          </div>
        )}

        {upgrade.source_summary && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {upgrade.source_summary}
          </p>
        )}

        {upgrade.details?.keyPoints && upgrade.details.keyPoints.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <GitBranch className="h-4 w-4 text-primary" />
              Key Points
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {upgrade.details.keyPoints.slice(0, 3).map((point, i) => (
                <li key={i} className="line-clamp-1">
                  • {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {upgrade.details?.risks && upgrade.details.risks.length > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-destructive">Risks</div>
              <div className="mt-1 text-muted-foreground line-clamp-2">
                {upgrade.details.risks[0]}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>Confidence: {Math.round(upgrade.confidence * 100)}%</span>
          <span>Updated: {new Date(upgrade.last_updated_at).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}

