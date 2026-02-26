import { ApolloClient, HttpLink, InMemoryCache, from, split } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";

let apolloClient: ApolloClient | null = null;

const createApolloClient = () => {
  // Create HTTP link — goes through Next.js proxy
  const httpLink = new HttpLink({
    uri: "/api/graphql",
    credentials: "include",
  });

  // Create WebSocket link for subscriptions — connects directly to the API
  let wsLink: GraphQLWsLink | null = null;
  if (typeof window !== "undefined") {
    const apiWsUrl = process.env.NEXT_PUBLIC_API_WS_URL
      || `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:5005`;
    const wsUri = `${apiWsUrl}/query`;

    wsLink = new GraphQLWsLink(
      createClient({
        url: wsUri,
        connectionParams: () => {
          return {};
        },
        shouldRetry: () => true,
        retryAttempts: Infinity,
        keepAlive: 10000,
      }),
    );
  }

  // Create auth link (no-op for client-side, auth is handled by the proxy)
  const authLink = setContext(async (_, { headers }) => {
    return {
      headers: {
        ...headers,
      },
    };
  });

  // Split links based on operation type
  const splitLink = wsLink
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === "OperationDefinition" &&
            definition.operation === "subscription"
          );
        },
        wsLink,
        from([authLink, httpLink]),
      )
    : from([authLink, httpLink]);

  apolloClient = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
  });

  return apolloClient;
};

export default createApolloClient;
export const getApolloClient = () => {
  if (!apolloClient) {
    apolloClient = createApolloClient();
  }
  return apolloClient;
};
