"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteWorkspace,
  useUpdateWorkspaceMetadata,
} from "@/lib/hooks/workspace";

interface WorkspaceSettingsDialogProps {
  workspace: {
    id: string;
    name: string;
    description?: string;
  };
  trigger?: React.ReactNode;
}

export default function WorkspaceSettingsDialog({
  workspace,
  trigger,
}: WorkspaceSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteWorkspace] = useDeleteWorkspace();
  const [updateWorkspace] = useUpdateWorkspaceMetadata();

  const [formData, setFormData] = useState({
    name: workspace.name,
    description: workspace.description || "",
  });

  const handleUpdateWorkspace = async () => {
    if (!formData.name.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      await updateWorkspace({
        variables: {
          ID: workspace.id,
          name: formData.name.trim(),
          description: formData.description.trim(),
        },
      });
      setOpen(false);
    } catch (error) {
      console.error("Failed to update workspace:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    setIsDeleting(true);
    try {
      await deleteWorkspace({
        variables: {
          ID: workspace.id,
        },
      });
      setShowDeleteConfirm(false);
      setOpen(false);
      // Redirect to app page after deletion
      window.location.href = "/app";
    } catch (error) {
      console.error("Failed to delete workspace:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Reset form data when opening
      setFormData({
        name: workspace.name,
        description: workspace.description || "",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="icon">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Workspace Settings</DialogTitle>
            <DialogDescription>
              Update your workspace details or delete the workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Edit Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter workspace name"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspace-description">Description</Label>
                <Textarea
                  id="workspace-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Enter workspace description (optional)"
                  rows={3}
                  disabled={isLoading}
                />
              </div>

              <Button
                onClick={handleUpdateWorkspace}
                disabled={isLoading || !formData.name.trim()}
                className="w-full"
              >
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Danger Zone
                </span>
              </div>
            </div>

            {/* Delete Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <Trash2 className="h-4 w-4" />
                <span>Delete Workspace</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Once you delete a workspace, there is no going back. All
                projects within this workspace will also be deleted. Please be
                certain.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              workspace{" "}
              <span className="font-semibold">"{workspace.name}"</span> and all
              projects within it. All data will be removed from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkspace}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
