
"use client"
import { DashboardClient } from "@/components/dashboard-client";

export default function DashboardPage() {
    // All data fetching and actions are now handled in the DashboardClient component
    // to avoid server-side authentication issues with the Firebase Admin SDK.
    const hardcodedWorkspaceId = 'default-workspace';
    
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-headline text-3xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground">An overview of your projects and workspaces.</p>
                </div>
            </div>
            <div>
                <h2 className="text-2xl font-headline font-semibold mb-4">My Boards</h2>
                <DashboardClient 
                    workspaceId={hardcodedWorkspaceId}
                />
            </div>
        </div>
    )
}
