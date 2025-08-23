
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, AlertTriangle, GripVertical } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, doc, writeBatch, where, getDocs, orderBy, updateDoc, deleteField, collectionGroup } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "./ui/skeleton";
import { UserProfile, Board as BoardType, WorkpanelRole, TeamRoom as TeamRoomType } from "./board/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from "@/lib/utils";
import { CreateTeamRoomDialog } from "./dashboard/create-team-room-dialog";
import { ShareTeamRoomDialog } from "./dashboard/share-team-room-dialog";
import { CreateBoardDialog } from "./dashboard/create-board-dialog";
import { BoardCard } from "./dashboard/board-card";

interface Board extends BoardType {
  id: string;
}
interface TeamRoom extends TeamRoomType {
  id: string;
}

interface Workpanel {
    id: string;
    members: { [key: string]: WorkpanelRole };
}

export function DashboardClient({ workpanelId }: { workpanelId: string }) {
    const [teamRooms, setTeamRooms] = useState<TeamRoom[]>([]);
    const [boards, setBoards] = useState<Board[]>([]);
    const [workpanel, setWorkpanel] = useState<Workpanel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();
    const [allUsers, setAllUsers] = useState<Map<string, UserProfile>>(new Map());

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const visibleBoards = React.useMemo(() => {
        if (!user || !workpanel) return [];

        const currentUserRole = workpanel.members[user.uid];
        return boards.filter(board => {
            if (currentUserRole && ['owner', 'admin'].includes(currentUserRole)) return true;
            if (board.members && board.members[user.uid]) return true;

            const parentRoom = teamRooms.find(r => r.id === board.teamRoomId);
            if (parentRoom && parentRoom.members && parentRoom.members[user.uid]) return true;

            if (currentUserRole && ['member', 'viewer'].includes(currentUserRole) && !board.isPrivate) return true;
            
            return false;
        });
    }, [boards, user, workpanel, teamRooms]);

    const visibleTeamRooms = React.useMemo(() => {
        if (!user || !workpanel) return [];
        const boardsInTeamRooms = new Set(visibleBoards.map(b => b.teamRoomId).filter(Boolean));
        const currentUserRole = workpanel.members[user.uid];

        return teamRooms.filter(teamRoom => {
            if (teamRoom.members && teamRoom.members[user.uid]) return true;
            if (currentUserRole && ['owner', 'admin', 'member', 'viewer'].includes(currentUserRole)) return true;
            if (boardsInTeamRooms.has(teamRoom.id)) return true;
            
            return false;
        });
    }, [teamRooms, user, workpanel, visibleBoards]);

    const visibleBoardsByTeamRoom = React.useMemo(() => {
        const grouped: {[key: string]: Board[]} = {};
        visibleTeamRooms.forEach(teamRoom => {
            grouped[teamRoom.id] = [];
        });
        visibleBoards.forEach(board => {
            if (board.teamRoomId && grouped[board.teamRoomId] !== undefined) {
                grouped[board.teamRoomId].push(board);
            }
        });
        return grouped;
    }, [visibleTeamRooms, visibleBoards]);

    const visibleUnassignedBoards = React.useMemo(() => {
        return visibleBoards.filter(board => !board.teamRoomId);
    }, [visibleBoards]);
    
    const fetchAllUsers = useCallback(async (currentWorkpanel: Workpanel, currentTeamRooms: TeamRoom[], currentBoards: Board[]) => {
        if (!currentWorkpanel) return;
        const memberIds = new Set<string>(Object.keys(currentWorkpanel.members));

        currentTeamRooms.forEach(room => {
            Object.keys(room.members || {}).forEach(uid => memberIds.add(uid));
        });

        currentBoards.forEach(board => {
            Object.keys(board.members || {}).forEach(uid => memberIds.add(uid));
        });
        
        if (memberIds.size > 0) {
            const userDocs = await getDocs(query(collection(db, 'users'), where('__name__', 'in', Array.from(memberIds).slice(0,30))));
            const newAllUsers = new Map<string, UserProfile>();
            userDocs.forEach(userDoc => {
                if (userDoc.exists()) {
                    newAllUsers.set(userDoc.id, userDoc.data() as UserProfile);
                }
            });
            setAllUsers(new Map(newAllUsers));
        }
    }, []);

    useEffect(() => {
        if (!user) {
            setLoading(true);
            return;
        }

        const workpanelRef = doc(db, `workspaces/${workpanelId}`);
        const unsubscribeWorkpanel = onSnapshot(workpanelRef, async (workspaceSnap) => {
            if (!workspaceSnap.exists()) {
                setError("This workpanel does not exist or you don't have access.");
                setLoading(false);
                return;
            }
            const workpanelData = { id: workspaceSnap.id, ...workspaceSnap.data() } as Workpanel;
            setWorkpanel(workpanelData);
            
            const teamRoomsQuery = query(collection(db, `workspaces/${workpanelId}/teamRooms`), orderBy('createdAt'));
            const unsubscribeTeamRooms = onSnapshot(teamRoomsQuery, (teamRoomsSnapshot) => {
                const teamRoomsData = teamRoomsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamRoom));
                setTeamRooms(teamRoomsData);
                
                 const boardsQuery = query(collection(db, `workspaces/${workpanelId}/boards`));
                 const unsubscribeBoards = onSnapshot(boardsQuery, (boardsSnapshot) => {
                     const boardsData = boardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Board));
                     setBoards(boardsData);
                     fetchAllUsers(workpanelData, teamRoomsData, boardsData);
                     setLoading(false);
                     setError(null);
                 }, (err) => {
                     console.error("Error fetching boards:", err);
                     setError("Failed to load teamboards.");
                     setLoading(false);
                 });
                 return () => unsubscribeBoards();

            }, (err) => {
                    console.error("Error fetching team rooms:", err);
                    setError("Failed to load team rooms.");
            });

            return () => {
                unsubscribeTeamRooms();
            };

        }, (err) => {
            console.error("Error fetching workpanel:", err);
            setError("Failed to load workpanel data.");
            setLoading(false);
        });
        
        return () => unsubscribeWorkpanel();
    }, [user, workpanelId, fetchAllUsers]);
    

    const openDeleteDialog = (board: Board) => {
        setBoardToDelete(board);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteBoard = async () => {
        if (!boardToDelete || !user) return;
        setIsDeleting(true);

        try {
            const batch = writeBatch(db);
            const boardRef = doc(db, `workspaces/${workpanelId}/boards`, boardToDelete.id);
            batch.delete(boardRef);
            await batch.commit();

            toast({ title: "Board deleted", description: `The board "${boardToDelete.name}" has been deleted.` });
        } catch (error) {
            console.error("Error deleting board: ", error);
            toast({ variant: 'destructive', title: 'Error deleting board' });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setBoardToDelete(null);
        }
    };
    
    const handleMoveBoard = async (boardId: string, newTeamRoomId: string) => {
        const boardRef = doc(db, `workspaces/${workpanelId}/boards`, boardId);
        try {
            await updateDoc(boardRef, { teamRoomId: newTeamRoomId || deleteField() });
            toast({ title: "Board moved successfully!" });
        } catch (error) {
            console.error("Error moving board: ", error);
            toast({ variant: 'destructive', title: 'Error moving board' });
        }
    };
    
    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;

        if (!destination) {
            return;
        }

        const sourceTeamRoomId = source.droppableId;
        const destTeamRoomId = destination.droppableId;

        if (sourceTeamRoomId === destTeamRoomId) {
            return;
        }
        
        handleMoveBoard(draggableId, destTeamRoomId === 'unassigned' ? '' : destTeamRoomId);
    };

    if (loading) {
        return <Skeleton className="h-96 w-full" />;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-destructive font-semibold">Could not load dashboard data</p>
                <p className="text-muted-foreground">{error}</p>
            </div>
        )
    }
    
    const currentUserRole = user && workpanel ? workpanel.members[user.uid] : undefined;
    const canCreate = currentUserRole === 'admin' || currentUserRole === 'owner' || currentUserRole === 'member';

    const renderBoardGrid = (boardsToRender: Board[], teamRoomId: string, canCreateBoardsInRoom: boolean) => {
        return (
            <Droppable droppableId={teamRoomId} type="BOARD">
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                            "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-colors duration-200 rounded-lg p-2 min-h-[210px]",
                            snapshot.isDraggingOver && "bg-primary/10"
                        )}
                    >
                        {boardsToRender.map((board, index) => {
                            const boardMembers = (board.memberUids || [])
                                .map(uid => allUsers.get(uid))
                                .filter((u): u is UserProfile => !!u);
                            const canDelete = currentUserRole === 'owner' || currentUserRole === 'admin' || (user?.uid === board.ownerId);

                            return (
                                <Draggable key={board.id} draggableId={board.id} index={index}>
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                        >
                                            <BoardCard
                                                board={board}
                                                workpanelId={workpanelId}
                                                teamRooms={teamRooms}
                                                boardMembers={boardMembers}
                                                openDeleteDialog={openDeleteDialog}
                                                handleMoveBoard={handleMoveBoard}
                                                canDelete={canDelete}
                                            />
                                        </div>
                                    )}
                                </Draggable>
                            );
                        })}
                        {provided.placeholder}
                        {canCreateBoardsInRoom && <CreateBoardDialog workpanelId={workpanelId} teamRoomId={teamRoomId === 'unassigned' ? '' : teamRoomId} onBoardCreated={() => {}} />}
                    </div>
                )}
            </Droppable>
        );
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            {canCreate && (
                <div className="mb-8">
                     <CreateTeamRoomDialog workpanelId={workpanelId} />
                </div>
            )}
            <Accordion type="multiple" defaultValue={visibleTeamRooms.map(f => f.id)} className="w-full space-y-4">
                 {visibleTeamRooms.map(teamRoom => {
                    const userTeamRoomRole = user?.uid ? teamRoom.members?.[user.uid] : undefined;
                    const canCreateBoardsInRoom = canCreate || userTeamRoomRole === 'manager' || userTeamRoomRole === 'editor';
                     
                    return (
                        <AccordionItem value={teamRoom.id} key={teamRoom.id} className="border rounded-lg bg-card">
                            <div className="flex items-center justify-between px-4 py-3 rounded-t-lg data-[state=open]:border-b hover:bg-muted/50">
                                <AccordionTrigger className="text-xl font-headline font-semibold hover:no-underline flex-1 text-left py-0">
                                <span>{teamRoom.name}</span>
                                </AccordionTrigger>
                                <ShareTeamRoomDialog workpanelId={workpanelId} teamRoom={teamRoom} allUsers={allUsers} onUpdate={() => workpanel && fetchAllUsers(workpanel, teamRooms, boards)} />
                            </div>
                            <AccordionContent className="pt-4 px-2">
                                {renderBoardGrid(visibleBoardsByTeamRoom[teamRoom.id] || [], teamRoom.id, canCreateBoardsInRoom)}
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
           
            {(visibleUnassignedBoards.length > 0 || visibleTeamRooms.length === 0) && (
                <div className="mt-8">
                    <h2 className="text-xl font-headline font-semibold mb-4">Uncategorized Boards</h2>
                    {renderBoardGrid(visibleUnassignedBoards, 'unassigned', canCreate)}
                </div>
            )}
            
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the board
                            <span className="font-semibold"> {boardToDelete?.name} </span>
                            and all of its tasks and lists.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteBoard} disabled={isDeleting}>
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DragDropContext>
    )
}
