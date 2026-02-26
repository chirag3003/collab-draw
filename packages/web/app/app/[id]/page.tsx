"use client";

import { useAuth } from "@/lib/auth/context";
import { use } from "react";
import ProjectsList from "@/components/app/ProjectsList";
import { useCreateProject, useProjectsByWorkspace } from "@/lib/hooks/project";
import {
  useAddUserToWorkspace,
  useRemoveUserFromWorkspace,
  useWorkspace,
} from "@/lib/hooks/workspace";

interface WorkspaceAppProps {
  params: Promise<{ id: string }>;
}
export default function WorkspaceApp({ params }: WorkspaceAppProps) {
  const { user } = useAuth();
  const { id } = use(params);
  const { data: workspaceData, loading } = useWorkspace(id);
  const { data: projectsData } = useProjectsByWorkspace(id);
  const [createProject] = useCreateProject();
  const [addUser] = useAddUserToWorkspace();
  const [removeUser] = useRemoveUserFromWorkspace();

  const handleCreateProject = async (data: {
    title: string;
    description: string;
  }) => {
    await createProject({
      variables: {
        name: data.title,
        description: data.description,
        personal: false,
        owner: user?.id ?? "",
        workspace: id,
      },
    });
  };

  const handleAddUser = async (email: string) => {
    await addUser({
      variables: {
        ID: id,
        email,
      },
    });
  };

  const handleRemoveUser = async (userId: string) => {
    await removeUser({
      variables: {
        ID: id,
        userID: userId,
      },
    });
  };

  if(!loading && !workspaceData?.workspace) {
    location.replace("/app")
  }

  return (
    <div className="h-full p-8">
      <div className="max-w-7xl mx-auto">
        {!loading && workspaceData && workspaceData.workspace && projectsData && (
          <ProjectsList
            projects={projectsData.projectsByWorkspace}
            workspaceId={id}
            members={workspaceData.workspace.members}
            onCreateProject={handleCreateProject}
            personal={false}
            details={{
              title: workspaceData.workspace.name,
              description: workspaceData.workspace.description,
            }}
            owned={workspaceData.workspace.members.owner.id === user?.id}
            onAddUser={handleAddUser}
            onRemoveUser={handleRemoveUser}
          />
        )}
      </div>
    </div>
  );
}
