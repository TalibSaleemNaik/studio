
"use client"
import { DashboardClient } from "@/components/dashboard-client";

export default function WorkpanelDashboardPage({ params }: { params: { workpanelId: string }}) {
    const { workpanelId } = params;
    
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-headline text-3xl font-bold">Teamboards</h1>
                    <p className="text-muted-foreground">An overview of your teamboards in this workpanel.</p>
                </div>
            </div>
            <div>
                <DashboardClient 
                    workpanelId={workpanelId}
                />
            </div>
        </div>
    )
}
