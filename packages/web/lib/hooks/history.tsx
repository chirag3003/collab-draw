import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";

export const useProjectHistory = () => {
  const QUERY = gql`
    query ProjectHistory($projectID: ID!, $fromSeq: Int!, $toSeq: Int!) {
      projectHistory(projectID: $projectID, fromSeq: $fromSeq, toSeq: $toSeq) {
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
    projectHistory: Array<{
      opID: string;
      seq: number;
      type: "ADD" | "UPDATE" | "DELETE";
      elementID: string;
      timestamp: string;
    }>;
  }>(QUERY);
};

export const useProjectSnapshot = () => {
  const QUERY = gql`
    query ProjectSnapshotAt($projectID: ID!, $seq: Int!) {
      projectSnapshotAt(projectID: $projectID, seq: $seq) {
        elements
        seq
        timestamp
      }
    }
  `;
  return useLazyQuery<{
    projectSnapshotAt: {
      elements: string;
      seq: number;
      timestamp: string;
    };
  }>(QUERY);
};
