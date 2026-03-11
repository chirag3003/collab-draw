"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
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

interface CreateProjectDialogProps {
  onCreateProject: (data: { title: string; description: string }) => void;
}

export default function CreateProjectDialog({
  onCreateProject,
}: CreateProjectDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");

  const handleCreateProject = () => {
    if (projectTitle.trim()) {
      const projectData = {
        title: projectTitle.trim(),
        description: "", // Description can be added later if needed
      };

      // Call the parent callback if provided
      onCreateProject(projectData);

      // Reset form and close dialog
      setProjectTitle("");
      setIsDialogOpen(false);
    }
  };

  const handleCancel = () => {
    // Reset form and close dialog
    setProjectTitle("");
    setIsDialogOpen(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateProject();
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Create a new drawing project to start collaborating with your team.
            <br />
            <span className="text-xs text-muted-foreground">
              Tip: Press Enter to create quickly
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-title">Project Title *</Label>
            <Input
              id="project-title"
              placeholder="Enter project title..."
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full"
              maxLength={50}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {projectTitle.length}/50 characters
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleCreateProject} disabled={!projectTitle.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
