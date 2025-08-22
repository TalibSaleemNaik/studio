
"use client"
import { redirect } from "next/navigation";

// Redirect from the old dashboard URL to the default workpanel.
// This is a temporary measure until we have a proper workpanel selection UI.
export default function DashboardRedirectPage() {
    redirect('/workpanels/default-workpanel');
    return null;
}
