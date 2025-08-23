
import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { SettingsRedirectClient } from '@/components/settings-redirect-client';

export const dynamic = 'force-dynamic';

// Redirect from the old dashboard URL to the default workpanel.
export default function SettingsRedirectPage() {
    return (
        <Suspense fallback={
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        }>
            <SettingsRedirectClient />
        </Suspense>
    );
}
