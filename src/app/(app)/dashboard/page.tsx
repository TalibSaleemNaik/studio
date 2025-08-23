
"use client"
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

// This page now dynamically redirects on the client side.
export default function DashboardRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/workpanels/default-workpanel');
    }, [router]);

    return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
}
