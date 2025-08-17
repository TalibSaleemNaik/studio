
import { getFirestore, collection, getDocs, query, doc, getDoc, setDoc, addDoc, serverTimestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { redirect } from "next/navigation";
import { headers } from 'next/headers';
import { DashboardClient } from "@/components/dashboard-client";
import { getAuth } from "firebase-admin/auth";

interface Board {
  id: string;
  name: string;
  description: string;
}

async function getBoards(workspaceId: string): Promise<Board[]> {
    if (!workspaceId) return [];
    const boardsQuery = query(collection(db, `workspaces/${workspaceId}/boards`));
    const querySnapshot = await getDocs(boardsQuery);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Board));
}

async function createBoard(formData: FormData) {
    'use server';
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const workspaceId = formData.get('workspaceId') as string;

    if (!title || !workspaceId) {
        throw new Error("Title and workspaceId are required");
    }

    try {
        const boardRef = await addDoc(collection(db, `workspaces/${workspaceId}/boards`), {
            name: title,
            description: description,
            createdAt: serverTimestamp(),
        });

        const defaultGroups = ['To Do', 'In Progress', 'Done'];
        for (let i = 0; i < defaultGroups.length; i++) {
            await addDoc(collection(db, `workspaces/${workspaceId}/groups`), {
                boardId: boardRef.id,
                name: defaultGroups[i],
                order: i,
            });
        }
    } catch (error) {
        console.error("Failed to create board:", error);
        throw new Error("Failed to create the new board.");
    }
}


export default async function DashboardPage() {
    // This is a server component, so we can't use the useAuth hook.
    // We'll rely on the app layout to handle unauthorized users.
    // For server-side data fetching that depends on the user,
    // you would typically get the user ID from a session managed by middleware
    // or pass it from a parent component.
    
    // For now, we'll continue with the hardcoded workspace ID,
    // as the primary issue was client-side redirection.

    const hardcodedWorkspaceId = 'default-workspace';
    
    try {
        // We add a dummy check here to ensure the page can render.
        // In a real app, you might fetch user-specific data.
        const workspaceRef = doc(db, 'workspaces', hardcodedWorkspaceId);
        const workspaceSnap = await getDoc(workspaceRef);
        if (!workspaceSnap.exists()) {
             await setDoc(workspaceRef, { name: "Default Workspace", createdAt: serverTimestamp() });
        }
    
        const boards = await getBoards(hardcodedWorkspaceId);
    
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
                        boards={boards} 
                        workspaceId={hardcodedWorkspaceId}
                        createBoardAction={createBoard} 
                    />
                </div>
            </div>
        )
    } catch (error) {
        console.error("Error loading dashboard:", error);
        return (
             <div className="flex items-center justify-center h-full">
                <div className="text-destructive text-center p-4 bg-destructive/10 rounded-md">
                    Could not load dashboard. Please check your connection and try again.
                </div>
            </div>
        )
    }
}
