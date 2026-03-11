"use client";

import {
  ApolloClient,
  from,
  HttpLink,
  InMemoryCache,
  split,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { ApolloProvider as Provider } from "@apollo/client/react";
import { getMainDefinition } from "@apollo/client/utilities";
import type { Client } from "graphql-ws";
import { createClient } from "graphql-ws";
import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth/context";

export default function ApolloProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { accessToken } = useAuth();

  // Store the token in a ref so link closures always read the latest value
  // without triggering a full client rebuild.
  const tokenRef = useRef(accessToken);
  const wsClientRef = useRef<Client | null>(null);

  // Keep the ref in sync with the latest token
  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  const apolloClient = useMemo(() => {
    // Create HTTP link — goes through Next.js proxy
    const httpLink = new HttpLink({
      uri: "/api/graphql",
      credentials: "include",
    });

    // Create WebSocket link for subscriptions — connects directly to the API
    // (Next.js standalone doesn't proxy WebSocket upgrades through rewrites)
    const apiWsUrl =
      process.env.NEXT_PUBLIC_API_WS_URL ||
      (typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:5005`
        : "ws://localhost:5005");
    const wsUri = `${apiWsUrl}/query`;

    const wsClient = createClient({
      url: wsUri,
      connectionParams: () => {
        const token = tokenRef.current;
        return {
          ...(token && { authorization: `Bearer ${token}` }),
        };
      },
      shouldRetry: () => true,
      retryAttempts: Infinity,
      keepAlive: 10000,
    });
    wsClientRef.current = wsClient;

    const wsLink = new GraphQLWsLink(wsClient);

    // Create auth link — reads token dynamically from ref at request time
    const authLink = setContext(async (_, { headers }) => {
      const token = tokenRef.current;
      return {
        headers: {
          ...headers,
          ...(token && { authorization: `Bearer ${token}` }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally created once; token is read via ref
  }, []);

  // When the access token changes, restart the WebSocket connection so the
  // server receives the new token via connectionParams on reconnect.
  useEffect(() => {
    if (!accessToken) return;
    // On first mount the WS is already connecting with the initial token,
    // so only terminate if the token has actually changed from the initial value.
    const ws = wsClientRef.current;
    if (ws) {
      // terminate() closes the connection; the graphql-ws client will
      // automatically reconnect using shouldRetry/retryAttempts, and the
      // connectionParams callback will read the fresh token from tokenRef.
      ws.terminate();
    }
  }, [accessToken]);

  return <Provider client={apolloClient}>{children}</Provider>;
}
