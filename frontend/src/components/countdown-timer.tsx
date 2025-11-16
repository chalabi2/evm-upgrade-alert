import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Clock } from 'lucide-react';
import type { Countdown } from '@/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface CountdownTimerProps {
  countdown: Countdown;
}

export function CountdownTimer({ countdown }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const target = new Date(countdown.target_ts);
      setTimeRemaining(formatDistanceToNow(target, { addSuffix: true }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [countdown.target_ts]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-500';
    if (confidence >= 0.7) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{countdown.chain_id}</CardTitle>
            <CardDescription>{countdown.fork_name}</CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <div className={`h-2 w-2 rounded-full ${getConfidenceColor(countdown.confidence)}`} />
            {Math.round(countdown.confidence * 100)}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-2xl font-bold text-primary">
          <Clock className="h-6 w-6" />
          {timeRemaining}
        </div>
        <div className="mt-4 space-y-1 text-sm text-muted-foreground">
          <div>Target: {new Date(countdown.target_ts).toLocaleString()}</div>
          <div>
            Window: {new Date(countdown.window_low_ts).toLocaleString()} -{' '}
            {new Date(countdown.window_high_ts).toLocaleString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

