
"use client"
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile } from "@/components/board/types";

// This page now dynamically redirects on the client side.
export function DashboardRedirectClient() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [status, setStatus] = useState("Loading your session...");

    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (!user) {
            // If for some reason auth check completes and there's no user, redirect to login
            router.replace('/login');
            return;
        }

        const fetchWorkpanelAndRedirect = async () => {
            setStatus("Finding your workpanel...");
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data() as UserProfile;
                // Redirect to the first accessible workpanel, or the default if none exist yet
                const targetWorkpanel = userData.accessibleWorkpanels?.[0] || 'default-workpanel';
                router.replace(`/workpanels/${targetWorkpanel}`);
            } else {
                 // This case might happen for a brand new user
                router.replace('/workpanels/default-workpanel');
            }
        };

        fetchWorkpanelAndRedirect();

    }, [user, authLoading, router]);

    return (
        <div className="flex h-full w-full items-center justify-center">
             <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">{status}</p>
            </div>
        </div>
    );
}
