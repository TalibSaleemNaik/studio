import { collection, getDocs, query, where, doc, getDoc, setDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase-admin"; // Switch to admin SDK for server-side
import { redirect } from "next/navigation";
import { headers } from 'next/headers';
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { DashboardClient } from "@/components/dashboard-client";

interface Board {
  id: string;
  name: string;
  description: string;
}

async function getBoards(workspaceId: string): Promise<Board[]> {
    const boardsQuery = query(collection(db, `workspaces/${workspaceId}/boards`));
    const querySnapshot = await getDocs(boardsQuery);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Board));
}

// A server action to handle board creation
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
        // This will trigger a re-render of the page with the new board
        // No need for client-side state updates
    } catch (error) {
        console.error("Failed to create board:", error);
        // Handle error appropriately
    }
}


export default async function DashboardPage() {
    // This is a Server Component, so we fetch data here
    const headersList = headers();
    const userSession = headersList.get('X-User-Session');
    
    if (!userSession) {
        redirect('/login');
    }
    
    const user = JSON.parse(userSession);

    const hardcodedWorkspaceId = 'default-workspace';
    const workspaceRef = doc(db, 'workspaces', hardcodedWorkspaceId);
    
    try {
        const workspaceSnap = await getDoc(workspaceRef);
        if (!workspaceSnap.exists()) {
            await setDoc(workspaceRef, { name: "Default Workspace", ownerId: user.uid });
        }
    
        const boards = await getBoards(hardcodedWorkspaceId);
    
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-headline font-bold">Dashboard</h1>
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
                    Could not load dashboard. Please try again later.
                </div>
            </div>
        )
    }
}