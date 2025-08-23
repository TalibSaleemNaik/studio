
'use client';

import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, doc, query, where, getDocs, updateDoc, deleteField, runTransaction, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { Loader2, Trash2, Share2 } from "lucide-react";
import type { UserProfile, TeamRoom, TeamRoomRole, WorkpanelRole } from "@/components/board/types";

interface ShareTeamRoomDialogProps {
    workpanelId: string;
    teamRoom: TeamRoom;
    allUsers: Map<string, UserProfile>;
    workpanelMembers: { [key: string]: WorkpanelRole };
    onUpdate: () => void;
}

export function ShareTeamRoomDialog({ workpanelId, teamRoom, allUsers, workpanelMembers, onUpdate }: ShareTeamRoomDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();
    const teamRoomMembers = teamRoom.members || {};
    
    // Determine which users to display in the list
    const displayedUserUids = React.useMemo(() => {
        const uids = new Set<string>();
        // Add direct teamroom members
        Object.keys(teamRoom.members || {}).forEach(uid => uids.add(uid));
        // Add workpanel members who have implicit access
        Object.keys(workpanelMembers || {}).forEach(uid => uids.add(uid));
        return Array.from(uids);
    }, [teamRoom.members, workpanelMembers]);


    const handleInvite = async () => {
        const trimmedEmail = inviteEmail.trim().toLowerCase();
        if (!trimmedEmail) {
            toast({ variant: 'destructive', title: 'Email is required.' });
            return;
        }
        setIsInviting(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', trimmedEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                throw new Error("User with that email not found.");
            }
            const userToInviteDoc = querySnapshot.docs[0];
            const userToInviteId = userToInviteDoc.id;

            if (Object.keys(teamRoomMembers).includes(userToInviteId)) {
                throw new Error("User is already a direct member of this TeamRoom.");
            }

            await runTransaction(db, async (transaction) => {
                const teamRoomRef = doc(db, `workspaces/${workpanelId}/teamRooms`, teamRoom.id);
                const userDocRef = doc(db, `users`, userToInviteId);

                transaction.update(teamRoomRef, {
                    [`members.${userToInviteId}`]: 'editor',
                    memberUids: arrayUnion(userToInviteId),
                });

                transaction.update(userDocRef, {
                    accessibleWorkpanels: arrayUnion(workpanelId)
                });
            });
            
            toast({ title: "User invited to TeamRoom!" });
            setInviteEmail('');
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Invitation failed', description: error.message });
        } finally {
            setIsInviting(false);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: TeamRoomRole) => {
        if(user?.uid === memberId) {
            toast({variant: 'destructive', title: 'You cannot change your own role.'});
            return;
        }
        try {
            const teamRoomRef = doc(db, `workspaces/${workpanelId}/teamRooms`, teamRoom.id);
            await updateDoc(teamRoomRef, { [`members.${memberId}`]: newRole });
            toast({ title: "Member role updated." });
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to update role', description: error.message });
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (user?.uid === memberId) {
            toast({ variant: 'destructive', title: 'You cannot remove yourself.' });
            return;
        }

        const teamRoomRef = doc(db, `workspaces/${workpanelId}/teamRooms`, teamRoom.id);
        const userDocRef = doc(db, 'users', memberId);

        try {
            const otherBoardsQuery = query(collection(db, `workspaces/${workpanelId}/boards`), where('memberUids', 'array-contains', memberId));
            const otherTeamRoomsQuery = query(collection(db, `workspaces/${workpanelId}/teamRooms`), where('memberUids', 'array-contains', memberId));

            const [otherBoardsSnap, otherTeamRoomsSnap] = await Promise.all([
                getDocs(otherBoardsQuery),
                getDocs(otherTeamRoomsQuery),
            ]);

            const otherBoardAccess = otherBoardsSnap.size > 0;
            const otherTeamRoomAccess = otherTeamRoomsSnap.docs.filter(d => d.id !== teamRoom.id).length > 0;
            
            await runTransaction(db, async (transaction) => {
                const workpanelDocRef = doc(db, 'workspaces', workpanelId);
                
                const workpanelDoc = await transaction.get(workpanelDocRef);
                if (!workpanelDoc.exists()) throw new Error("Workpanel not found.");

                const workpanelMemberAccess = !!workpanelDoc.data().members[memberId];
                const hasOtherAccess = otherBoardAccess || otherTeamRoomAccess || workpanelMemberAccess;

                transaction.update(teamRoomRef, {
                    [`members.${memberId}`]: deleteField(),
                    memberUids: arrayRemove(memberId)
                });

                if (!hasOtherAccess) {
                    transaction.update(userDocRef, {
                        accessibleWorkpanels: arrayRemove(workpanelId)
                    });
                }
            });

            toast({ title: "Member removed from TeamRoom." });
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to remove member', description: error.message });
        }
    };
    
    // Function to calculate the effective role for a user in this teamroom
    const getEffectiveRole = (uid: string): TeamRoomRole | 'Inherited' => {
        const directRole = teamRoomMembers[uid];
        if (directRole) return directRole;

        const workpanelRole = workpanelMembers[uid];
        if (workpanelRole) {
            if (workpanelRole === 'owner' || workpanelRole === 'admin') return 'manager';
            if (workpanelRole === 'member') return 'editor';
            if (workpanelRole === 'viewer') return 'viewer';
        }
        return 'Inherited'; // Should not happen with current logic, but as a fallback.
    }


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Share2 className="mr-2 h-4 w-4" /> Share
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Share TeamRoom: {teamRoom.name}</DialogTitle>
                    <DialogDescription>
                        Invite people to this TeamRoom. They will get access to all teamboards inside it.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-4 py-4">
                    <div className="flex space-x-2">
                        <Input
                            placeholder="Enter email to invite..."
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            disabled={isInviting}
                        />
                        <Button onClick={handleInvite} disabled={isInviting}>
                            {isInviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Invite'}
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-medium">People with access</h4>
                        {displayedUserUids.map(uid => {
                            const member = allUsers.get(uid);
                            const isCurrentUser = user?.uid === uid;
                            const effectiveRole = getEffectiveRole(uid);
                            const isInherited = !teamRoomMembers[uid] && workpanelMembers[uid];

                            return member ? (
                                <div key={uid} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={member.photoURL} />
                                            <AvatarFallback>{member.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{member.displayName} {isCurrentUser && '(You)'}</p>
                                            <p className="text-sm text-muted-foreground">{member.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isInherited ? (
                                             <div className="text-sm text-muted-foreground pr-2 w-[110px] text-right">
                                                Inherited
                                            </div>
                                        ) : (
                                            <Select
                                                value={effectiveRole}
                                                onValueChange={(value) => handleRoleChange(uid, value as TeamRoomRole)}
                                                disabled={isCurrentUser}
                                            >
                                                <SelectTrigger className="w-[110px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="manager">Manager</SelectItem>
                                                    <SelectItem value="editor">Editor</SelectItem>
                                                    <SelectItem value="viewer">Viewer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveMember(uid)} disabled={isCurrentUser || isInherited}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ) : null;
                        })}
                         {displayedUserUids.length === 0 && <p className="text-sm text-muted-foreground">Only you have access to this TeamRoom.</p>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
