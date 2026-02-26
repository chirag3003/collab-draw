import { gql } from "@apollo/client";
import {
  useLazyQuery,
  useMutation,
  useQuery,
  useSubscription,
} from "@apollo/client/react";

export const useProjectByID = (projectID: string) => {
  const QUERY = gql`
    query getProjectByID($ID:ID!) {
  project(id: $ID) {
    name
    description
    workspace
    elements
  }
}
    `;
  return useQuery<{
    project: {
      name: string;
      description: string;
      workspace: string;
      elements: string;
    };
  }>(QUERY, { variables: { ID: projectID } });
};

export const usePersonalProjects = () => {
  const QUERY = gql`
    query GetProjectByOwner($ID:ID!){
  projectsPersonalByUser(userId:$ID){
    id
    name
    description
    owner
    createdAt
  }
}
 `;
  return useLazyQuery<{
    projectsPersonalByUser: {
      id: string;
      name: string;
      description: string;
      owner: string;
      createdAt: string;
    }[];
  }>(QUERY);
};

export const useProjectsByWorkspace = (workspaceID: string) => {
  const QUERY = gql`
    query GetProjectByWorkspace($ID:ID!){
  projectsByWorkspace(workspaceId:$ID){
    id
    name
    description
    owner
    createdAt
  }
}
    `;
  return useQuery<{
    projectsByWorkspace: {
      id: string;
      name: string;
      description: string;
      owner: string;
      createdAt: string;
    }[];
  }>(QUERY, { variables: { ID: workspaceID } });
};

export const useCreateProject = () => {
  const QUERY = gql`
mutation createProject($name:String!, $description:String!, $owner:ID!, $personal:Boolean!, $workspace:ID){
  createProject(input:{
    name:$name,
    description:$description,
    owner:$owner,
    personal:$personal,
    workspace:$workspace
  })
}
    `;
  return useMutation(QUERY, {
    refetchQueries: ["GetProjectByOwner", "GetProjectByWorkspace"],
  });
};

export const useUpdateProject = () => {
  const QUERY = gql`
    mutation updateProject($ID:ID!, $elements:String!, $socketID:ID!) {
  updateProject(
    id: $ID
    elements: $elements
    socketID: $socketID
  )
}
    `;
  return useMutation(QUERY);
};

export const useProjectSubscription = (projectID: string, skip: boolean) => {
  const QUERY = gql`
  subscription GetProjectUpdates($ID:ID!){
  project(id:$ID){
    elements
    socketID
  }
}
  `;
  return useSubscription<{
    project: {
      elements: string;
      socketID: string;
    };
  }>(QUERY, {
    variables: { ID: projectID },
    skip: skip,
    shouldResubscribe: true,
    onError: (error) => {
      console.error("Subscription error:", error);
    },
  });
};

export function useDeleteProject() {
  const QUERY = gql`
  mutation DeleteProject($ID:ID!){
  deleteProject(id:$ID)
}
  `;
  return useMutation(QUERY, {
    refetchQueries: ["GetProjectByOwner", "GetProjectByWorkspace"],
  });
}

export function useUpdateProjectMetadata() {
  const QUERY = gql`
  mutation UpdateProjectMetadata($ID:ID!, $name:String!, $description:String!){
  updateProjectMetadata(id:$ID, name:$name, description:$description)
}
  `;
  return useMutation(QUERY, {
    refetchQueries: ["GetProjectByOwner", "GetProjectByWorkspace"],
  });
}

// --- OT Hooks ---

export const useApplyOps = () => {
  const MUTATION = gql`
    mutation ApplyOps($projectID: ID!, $socketID: ID!, $ops: [OperationInput!]!) {
      applyOps(projectID: $projectID, socketID: $socketID, ops: $ops) {
        ack
        serverSeq
        rejected {
          clientSeq
          elementID
          reason
        }
      }
    }
  `;
  return useMutation<{
    applyOps: {
      ack: boolean;
      serverSeq: number;
      rejected: Array<{
        clientSeq: number;
        elementID: string;
        reason: string;
      }> | null;
    };
  }>(MUTATION);
};

export const useProjectOpsSubscription = (projectID: string, skip: boolean) => {
  const SUBSCRIPTION = gql`
    subscription ProjectOps($ID: ID!) {
      projectOps(id: $ID) {
        ops {
          opID
          seq
          clientSeq
          socketID
          type
          elementID
          elementVer
          baseSeq
          data
          timestamp
        }
        socketID
      }
    }
  `;
  return useSubscription<{
    projectOps: {
      ops: Array<{
        opID: string;
        seq: number;
        clientSeq: number;
        socketID: string;
        type: "ADD" | "UPDATE" | "DELETE";
        elementID: string;
        elementVer: number;
        baseSeq: number;
        data: string | null;
        timestamp: string;
      }>;
      socketID: string;
    };
  }>(SUBSCRIPTION, {
    variables: { ID: projectID },
    skip,
    shouldResubscribe: true,
    onError: (error) => {
      console.error("ProjectOps subscription error:", error);
    },
  });
};

export const useOpsSince = () => {
  const QUERY = gql`
    query OpsSince($projectID: ID!, $sinceSeq: Int!, $limit: Int) {
      opsSince(projectID: $projectID, sinceSeq: $sinceSeq, limit: $limit) {
        opID
        seq
        clientSeq
        socketID
        type
        elementID
        elementVer
        baseSeq
        data
        timestamp
      }
    }
  `;
  return useLazyQuery<{
    opsSince: Array<{
      opID: string;
      seq: number;
      clientSeq: number;
      socketID: string;
      type: "ADD" | "UPDATE" | "DELETE";
      elementID: string;
      elementVer: number;
      baseSeq: number;
      data: string | null;
      timestamp: string;
    }>;
  }>(QUERY);
};