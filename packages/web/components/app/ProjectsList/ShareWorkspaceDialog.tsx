"use client";

import { useAuth } from "@/lib/auth/context";
import { Crown, Mail, Share2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ShareWorkspaceDialogProps {
  onAddUser?: (email: string) => void;
  onRemoveUser?: (userId: string) => void;
  workspaceTitle?: string;
  members?: {
    owner: {
      id: string;
      fullName: string;
      email: string;
      imageURL?: string;
    };
    members: {
      id: string;
      fullName: string;
      email: string;
      imageURL?: string;
    }[];
  };
}

export default function ShareWorkspaceDialog({
  onAddUser,
  onRemoveUser,
  workspaceTitle = "workspace",
  members = {
    owner: { id: "", fullName: "", email: "", imageURL: "" },
    members: [],
  },
}: ShareWorkspaceDialogProps) {
  const { user } = useAuth();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const handleAddUser = async () => {
    if (newUserEmail.trim() && isValidEmail(newUserEmail)) {
      setIsInviting(true);

      try {
        // Call the parent callback if provided
        if (onAddUser) {
          await onAddUser(newUserEmail.trim());
        } else {
          // TODO: Implement user invitation logic
          console.log("Inviting user:", newUserEmail.trim());
        }

        // Reset form
        setNewUserEmail("");
      } catch (error) {
        console.error("Failed to invite user:", error);
      } finally {
        setIsInviting(false);
      }
    }
  };

  const handleRemoveUser = (userId: string) => {
    if (onRemoveUser) {
      onRemoveUser(userId);
    } else {
      // TODO: Implement user removal logic
      console.log("Removing user:", userId);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddUser();
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="font-medium">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share {workspaceTitle}</DialogTitle>
          <DialogDescription>
            Invite people to collaborate on this workspace. They'll be able to
            view and edit projects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add User Section */}
          <div className="space-y-3">
            <Label htmlFor="user-email">Invite by email</Label>
            <div className="flex space-x-2">
              <div className="flex-1">
                <Input
                  id="user-email"
                  type="email"
                  placeholder="Enter email address..."
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="w-full"
                />
              </div>
              <Button
                onClick={handleAddUser}
                disabled={
                  !newUserEmail.trim() ||
                  !isValidEmail(newUserEmail) ||
                  isInviting
                }
                className="px-3"
              >
                {isInviting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Current Users Section */}
          <div className="space-y-3">
            <Label>People with access ({members.members.length + 1})</Label>

            {/* Owner */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={members.owner.imageURL}
                      alt={members.owner.fullName}
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {/* {user.initials} */}
                      CB
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {members.owner.fullName}
                      </p>
                      <Crown className="h-3 w-3 text-yellow-500" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground truncate">
                        {members.owner.email}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invited Members */}
              {members.members.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.imageURL} alt={user.fullName} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {/* {user.initials} */}
                        CB
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user.fullName}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {user?.id === members.owner.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUser(user.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {members.members.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Share2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No users have been invited yet</p>
                  <p className="text-xs">Start by inviting someone above</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
