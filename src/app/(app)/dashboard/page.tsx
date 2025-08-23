
import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { DashboardRedirectClient } from '@/components/dashboard-redirect-client';

export const dynamic = 'force-dynamic';

export default function DashboardRedirectPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    }>
      <DashboardRedirectClient />
    </Suspense>
  );
}
