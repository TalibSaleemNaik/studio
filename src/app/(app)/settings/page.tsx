
"use client"
import { redirect } from "next/navigation";

// Redirect from the old dashboard URL to the default workpanel.
export default function SettingsRedirectPage() {
    redirect('/workpanels/default-workpanel/settings');
    return null;
}
