"use client";

import { useAuth } from "@/lib/auth/context";
import { useEffect } from "react";
import ProjectsList from "@/components/app/ProjectsList";
import { useCreateProject, usePersonalProjects } from "@/lib/hooks/project";

export default function App() {
  const [getProjects, { data }] = usePersonalProjects();
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
        {data && (
          <ProjectsList
            projects={data.projectsPersonalByUser}
            onCreateProject={handleCreateProject}
            personal={false}
          />
        )}
      </div>
    </div>
  );
}
