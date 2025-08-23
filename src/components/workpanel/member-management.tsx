
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Trash2, AlertTriangle, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, getDoc, updateDoc, collection, query, where, getDocs, deleteField } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "../ui/skeleton";
import { UserProfile, WorkpanelRole } from "../board/types";

interface Workpanel {
    members: { [key: string]: WorkpanelRole };
    ownerId: string;
}

interface WorkpanelMember extends UserProfile {
    role: WorkpanelRole;
}

export function MemberManagement({ workpanelId }: { workpanelId: string }) {
    const [members, setMembers] = useState<WorkpanelMember[]>([]);
    const [workpanel, setWorkpanel] = useState<Workpanel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();

    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    const [memberToRemove, setMemberToRemove] = useState<WorkpanelMember | null>(null);
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

    useEffect(() => {
        if (!user) return;

        const workpanelRef = doc(db, `workspaces/${workpanelId}`);
        const unsubscribe = onSnapshot(workpanelRef, async (docSnap) => {
            if (!docSnap.exists()) {
                setError("Workpanel not found.");
                setLoading(false);
                return;
            }

            const workpanelData = docSnap.data() as Workpanel;
            setWorkpanel(workpanelData);

            if (!workpanelData.members[user.uid]) {
                setError("You are not a member of this workpanel.");
                setLoading(false);
                return;
            }

            const memberIds = Object.keys(workpanelData.members);
            if (memberIds.length > 0) {
                const userDocs = await Promise.all(memberIds.map(uid => getDoc(doc(db, 'users', uid))));
                const membersData: WorkpanelMember[] = userDocs
                    .filter(doc => doc.exists())
                    .map(doc => ({
                        ...(doc.data() as UserProfile),
                        uid: doc.id,
                        role: workpanelData.members[doc.id]
                    }));
                setMembers(membersData);
            } else {
                setMembers([]);
            }
            setError(null);
            setLoading(false);
        }, (err) => {
            console.error(err);
            setError("Failed to load workpanel data.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [workpanelId, user]);
    
    const handleInvite = async () => {
        const trimmedEmail = inviteEmail.trim().toLowerCase();
        if (!trimmedEmail) {
            toast({ variant: 'destructive', title: 'Please enter an email address.' });
            return;
        }
        setIsInviting(true);

        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', trimmedEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ variant: 'destructive', title: 'User not found.' });
                setIsInviting(false);
                return;
            }

            const userToInviteDoc = querySnapshot.docs[0];
            const userId = userToInviteDoc.id;

            if (workpanel?.members[userId]) {
                toast({ variant: 'destructive', title: 'User is already a member of this workpanel.' });
                setIsInviting(false);
                return;
            }

            const workpanelRef = doc(db, `workspaces/${workpanelId}`);
            await updateDoc(workpanelRef, {
                [`members.${userId}`]: 'member' // Default role is 'member'
            });

            toast({ title: 'User invited successfully!' });
            setInviteEmail('');
        } catch (error) {
            console.error("Error inviting user:", error);
            toast({ variant: 'destructive', title: 'Failed to invite user.' });
        } finally {
            setIsInviting(false);
        }
    };
    
    const handleRoleChange = async (memberId: string, newRole: WorkpanelRole) => {
        if (!user || user.uid === memberId) {
            toast({ variant: 'destructive', title: 'You cannot change your own role.' });
            return;
        }

        const memberToChange = members.find(m => m.uid === memberId);
        if (memberToChange?.role === 'owner') {
             toast({ variant: 'destructive', title: 'The owner role cannot be changed.' });
            return;
        }

        try {
            const workpanelRef = doc(db, `workspaces/${workpanelId}`);
            await updateDoc(workpanelRef, {
                [`members.${memberId}`]: newRole
            });
            toast({ title: "Member's role updated." });
        } catch (error) {
            console.error("Error updating role:", error);
            toast({ variant: 'destructive', title: 'Failed to update role.' });
        }
    };
    
    const confirmRemoveMember = (member: WorkpanelMember) => {
        if (member.role === 'owner') {
            toast({ variant: 'destructive', title: 'The workpanel owner cannot be removed.' });
            return;
        }
        if (!user || user.uid === member.uid) {
            toast({ variant: 'destructive', title: 'You cannot remove yourself.' });
            return;
        }
        setMemberToRemove(member);
        setIsRemoveDialogOpen(true);
    };

    const handleRemoveMember = async () => {
        if (!memberToRemove) return;
        
        try {
            const workpanelRef = doc(db, `workspaces/${workpanelId}`);
            await updateDoc(workpanelRef, {
                [`members.${memberToRemove.uid}`]: deleteField()
            });

            toast({ title: 'Member removed from workpanel.' });
        } catch (error) {
            console.error("Error removing member:", error);
            toast({ variant: 'destructive', title: 'Failed to remove member.' });
        } finally {
            setIsRemoveDialogOpen(false);
            setMemberToRemove(null);
        }
    };


    if (loading) {
        return <Skeleton className="h-96 w-full" />;
    }

    if (error) {
        return (
             <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-destructive font-semibold">Access Denied</p>
                <p className="text-muted-foreground">{error}</p>
            </div>
        );
    }
    
    const currentUserRole = user && workpanel ? workpanel.members[user.uid] : undefined;
    const canManageSettings = currentUserRole === 'admin' || currentUserRole === 'owner';

    if (!canManageSettings) {
         return (
             <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-destructive font-semibold">Access Denied</p>
                <p className="text-muted-foreground">You must be an admin or owner to manage workpanel settings.</p>
            </div>
        );
    }

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>Member Management</CardTitle>
                <CardDescription>Invite new members and manage existing ones in this workpanel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex space-x-2">
                    <Input 
                        placeholder="user@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        disabled={isInviting}
                    />
                    <Button onClick={handleInvite} disabled={isInviting}>
                        {isInviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        Invite Member
                    </Button>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Current Members ({members.length})</h3>
                    <div className="rounded-md border">
                        {members.map(member => {
                            const isOwner = member.role === 'owner';
                            const isSelf = user?.uid === member.uid;
                            return (
                                <div key={member.uid} className="flex items-center justify-between p-4 border-b last:border-b-0">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={member.photoURL} />
                                            <AvatarFallback>{member.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{member.displayName} {isSelf && "(You)"}</p>
                                            <p className="text-sm text-muted-foreground">{member.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Select 
                                            value={member.role}
                                            onValueChange={(value) => handleRoleChange(member.uid, value as WorkpanelRole)}
                                            disabled={isOwner || isSelf}
                                        >
                                            <SelectTrigger className="w-[120px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="owner" disabled>Owner</SelectItem>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="member">Member</SelectItem>
                                                <SelectItem value="viewer">Viewer</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="text-destructive"
                                            onClick={() => confirmRemoveMember(member)}
                                            disabled={isOwner || isSelf}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
        
        <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will remove <span className="font-semibold">{memberToRemove?.displayName}</span> from the workpanel and all boards within it. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveMember}>
                        Remove Member
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
