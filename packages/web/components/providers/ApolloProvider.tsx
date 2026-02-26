"use client";

import { ApolloProvider as Provider } from "@apollo/client/react";
import { ApolloClient, HttpLink, InMemoryCache, from, split } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";
import { useAuth } from "@/lib/auth/context";
import { useMemo } from "react";

export default function ApolloProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { accessToken } = useAuth();

  const apolloClient = useMemo(() => {
    // Create HTTP link — goes through Next.js proxy
    const httpLink = new HttpLink({
      uri: "/api/graphql",
      credentials: "include",
    });

    // Create WebSocket link for subscriptions — connects directly to the API
    // (Next.js standalone doesn't proxy WebSocket upgrades through rewrites)
    const apiWsUrl = process.env.NEXT_PUBLIC_API_WS_URL
      || (typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:5005`
        : "ws://localhost:5005");
    const wsUri = `${apiWsUrl}/query`;

    const wsLink = new GraphQLWsLink(
      createClient({
        url: wsUri,
        connectionParams: () => {
          return {
            ...(accessToken && { authorization: `Bearer ${accessToken}` }),
          };
        },
        shouldRetry: () => true,
        retryAttempts: 5,
        keepAlive: 10000,
      }),
    );

    // Create auth link
    const authLink = setContext(async (_, { headers }) => {
      return {
        headers: {
          ...headers,
          ...(accessToken && { authorization: `Bearer ${accessToken}` }),
        },
      };
    });

    // Split links based on operation type
    const splitLink = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === "OperationDefinition" &&
          definition.operation === "subscription"
        );
      },
      wsLink,
      from([authLink, httpLink]),
    );

    return new ApolloClient({
      link: splitLink,
      cache: new InMemoryCache(),
    });
  }, [accessToken]);

  return <Provider client={apolloClient}>{children}</Provider>;
}
