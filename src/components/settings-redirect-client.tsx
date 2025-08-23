
"use client"
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export function SettingsRedirectClient() {
    const router = useRouter();
    
    useEffect(() => {
        // This is a basic catch-all. More robust logic would handle dynamic workpanel IDs.
        router.replace('/workpanels/default-workpanel/settings');
    }, [router]);

    return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
}
