"use client";

import { useEffect } from "react";
import ProjectsList from "@/components/app/ProjectsList";
import { useAuth } from "@/lib/auth/context";
import { useCreateProject, usePersonalProjects } from "@/lib/hooks/project";

export default function App() {
  const [getProjects, { data, loading }] = usePersonalProjects();
  const [createProject] = useCreateProject();
  const { user } = useAuth();

  const handleCreateProject = async (data: {
    title: string;
    description: string;
  }) => {
    await createProject({
      variables: {
        name: data.title,
        description: data.description,
        personal: true,
        owner: user?.id ?? "",
      },
    });
  };

  useEffect(() => {
    if (user) {
      getProjects({ variables: { ID: user.id } });
    }
  }, [user, getProjects]);

  return (
    <div className="h-full p-8">
      <div className="max-w-7xl mx-auto">
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Loading projects...
              </p>
            </div>
          </div>
        )}
        {data && (
          <ProjectsList
            projects={data.projectsPersonalByUser}
            onCreateProject={handleCreateProject}
            personal={true}
          />
        )}
      </div>
    </div>
  );
}
