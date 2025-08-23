
"use client"
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

// Redirect from the old dashboard URL to the default workpanel.
export default function SettingsRedirectPage() {
    const router = useRouter();
    const pathname = usePathname();
    
    useEffect(() => {
        // A simple redirect to the new settings pattern.
        // This is a basic catch-all. More robust logic would handle dynamic workpanel IDs.
        router.replace('/workpanels/default-workpanel/settings');
    }, [router, pathname]);

    return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
}
