"use client";

import { CalendarDays, Cog, ExternalLink, Users } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import CreateProjectDialog from "./CreateProjectDialog";
import ShareWorkspaceDialog from "./ShareWorkspaceDialog";
import ProjectSettingsDialog from "./ProjectSettingsDialog";
import WorkspaceSettingsDialog from "./WorkspaceSettingsDialog";
import { useAuth } from "@/lib/auth/context";

interface Project {
  id: string;
  name: string;
  createdAt: string;
  owner: string;
  description?: string;
  bannerImage?: string;
}

interface WorkspaceListProps {
  projects: Project[];
  details?: { title: string; description: string };
  personal: boolean;
  workspaceId?: string;
  onCreateProject: (data: {
    title: string;
    description: string;
  }) => Promise<void>;
  onAddUser?: (email: string) => Promise<void>;
  onRemoveUser?: (userId: string) => Promise<void>;
  owned?: boolean;
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

export default function ProjectsList({
  projects,
  details,
  personal = false,
  workspaceId,
  onCreateProject,
  onAddUser,
  onRemoveUser,
  members,
  owned = true,
}: WorkspaceListProps) {
  const { user } = useAuth();
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCreateProject = async (data: {
    title: string;
    description: string;
  }) => {
    // Call the parent callback if provided
    await onCreateProject(data);
  };

  const handleAddUser = async (email: string) => {
    if (onAddUser) {
      await onAddUser(email);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (onRemoveUser) {
      await onRemoveUser(userId);
    }
  };

  return (
    <div className="w-full">
      <div className="header flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {details?.title || (user ? `Welcome back, ${user.name?.split(" ")[0]}` : "")}
          </h1>
          <p className="text-muted-foreground">
            {details?.description ||
              "Continue working on your projects or start something new"}
          </p>
        </div>
        <div className="controls flex space-x-3">
          {!personal && owned && workspaceId && (
            <WorkspaceSettingsDialog
              workspace={{
                id: workspaceId,
                name: details?.title || "",
                description: details?.description || "",
              }}
              trigger={
                <Button variant={"outline"}>
                  <Cog className="h-4 w-4" />
                </Button>
              }
            />
          )}
          {!personal && (
            <ShareWorkspaceDialog
              members={members}
              onAddUser={handleAddUser}
              onRemoveUser={handleRemoveUser}
              workspaceTitle={details?.title}
            />
          )}
          {owned && (
            <CreateProjectDialog onCreateProject={handleCreateProject} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {projects.map((project) => (
          <Card key={project.id} className="pt-0 gap-0 border border-border">
            <CardHeader className="p-0">
              {/* Banner Image */}
              <div className="relative w-full h-36 bg-muted rounded-t-lg overflow-hidden">
                {project.bannerImage ? (
                  <img
                    src={"https://placehold.co/400x200"}
                    alt={`${project.name} preview`}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <div className="text-4xl font-bold text-muted-foreground/50">
                      {project.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {/* Project Title */}
              <h3 className="font-semibold text-foreground text-lg mb-2 line-clamp-2">
                {project.name}
              </h3>

              {/* Created Date */}
              <div className="flex items-center text-sm text-muted-foreground mb-3">
                <CalendarDays className="h-4 w-4 mr-2" />
                Created {formatDate(project.createdAt)}
              </div>
            </CardContent>

            <CardFooter className="px-4 flex gap-2">
              <Link
                href={`/projects/${project.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants(), "flex-1")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Project
              </Link>
              {user?.id === project.owner && (
                <ProjectSettingsDialog project={project} />
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-sm">Create your first project to get started</p>
          </div>
        </div>
      )}
    </div>
  );
}
