
import { MemberManagement } from "@/components/workpanel/member-management";

export default function WorkpanelSettingsPage({ params }: { params: { workpanelId: string }}) {
    const { workpanelId } = params;
    
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-headline text-3xl font-bold">Workpanel Settings</h1>
                    <p className="text-muted-foreground">Manage members and other settings for this workpanel.</p>
                </div>
            </div>
            <div>
                <MemberManagement workpanelId={workpanelId} />
            </div>
        </div>
    )
}
