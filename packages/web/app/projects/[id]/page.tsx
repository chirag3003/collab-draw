import type { AppState } from "@excalidraw/excalidraw/types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import ProjectOT from "@/components/projects/ProjectOT";
import { GET_PROJECT_NAME } from "@/lib/graphql/operations";
import { getServerApollo } from "@/lib/serverApollo";

interface ProjectPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Cached project name query — deduplicates the identical query made by
 * both `ProjectPage` and `generateMetadata` within the same request.
 */
const getProjectName = cache(async (id: string) => {
  const apollo = await getServerApollo();
  const { data } = await apollo.query<{ project: { name: string } }>({
    query: GET_PROJECT_NAME,
    variables: { id },
  });
  return data?.project ?? null;
});

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  try {
    const project = await getProjectName(id);
    if (!project) {
      redirect("/app");
    }
  } catch {
    redirect("/app");
  }
  const cookieStore = await cookies();
  const appState = cookieStore.get(`appState_${id}`)?.value || "null";

  let parsedAppState: AppState | null = null;
  try {
    const parsed = JSON.parse(appState);
    if (parsed && typeof parsed === "object") {
      parsedAppState = parsed as AppState;
      parsedAppState.collaborators = new Map();
    }
  } catch {
    // Corrupted cookie — fall through with null (uses Excalidraw defaults)
  }

  return <ProjectOT projectID={id} initialAppState={parsedAppState} />;
}

export async function generateMetadata({ params }: ProjectPageProps) {
  const { id } = await params;
  let title = "Project";
  try {
    const project = await getProjectName(id);
    if (!project) {
      title = "project";
    } else {
      title = project.name || "Project";
    }
  } catch {
    title = "Project";
  }

  return {
    title,
  };
}
