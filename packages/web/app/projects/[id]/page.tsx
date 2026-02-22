import { gql } from "@apollo/client";
import type { AppState } from "@excalidraw/excalidraw/types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ProjectOT from "@/components/projects/ProjectOT";
import { getServerApollo } from "@/lib/serverApollo";

interface ProjectPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  const apollo = await getServerApollo();
  try {
    const { data } = await apollo.query<{
      project: {
        name: string;
      };
    }>({
      query: gql`
        query GetProject($id: ID!) {
          project(id: $id) {
            name
          }
        }
      `,
      variables: { id },
    });
    if (!data?.project) {
      redirect("/app");
    }
  } catch {
    redirect("/app");
  }
  const cookieStore = await cookies();
  const appState = cookieStore.get(`appState_${id}`)?.value || "null";

  const parsedAppState: AppState = JSON.parse(appState);
  if (parsedAppState !== null) {
    parsedAppState.collaborators = new Map()
  }

  return <ProjectOT projectID={id} initialAppState={parsedAppState} />;
}

export async function generateMetadata({ params }: ProjectPageProps) {
  const { id } = await params;
  const apollo = await getServerApollo();
  let title = "Project";
  try {
    const { data } = await apollo.query<{
      project: {
        name: string;
      };
    }>({
      query: gql`
        query GetProject($id: ID!) {
          project(id: $id) {
            name
          }
        }
      `,
      variables: { id },
    });
    if (!data?.project) {
      title = "project";
    } else {
      title = data.project.name || "Project";
    }
  } catch {
    title = "Project";
  }

  return {
    title,
  };
}
