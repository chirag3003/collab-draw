import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { getSession } from "@/lib/auth/session";

/**
 * Creates a server-side Apollo Client for use in React Server Components
 * and server actions.
 *
 * Reads the current session's access token and attaches it as a Bearer
 * `Authorization` header. The HTTP link points to the internal API URL
 * (or falls back to `localhost:5005` in development).
 *
 * Each call creates a fresh client instance — there is no caching across
 * requests, which is appropriate for server-side usage.
 *
 * @returns A configured `ApolloClient` instance with the user's auth token.
 */
export const getServerApollo = async () => {
  const session = await getSession();
  const token = session?.accessToken;
  const httpLink = new HttpLink({
    uri: process.env.INTERNAL_API_URL
      ? `${process.env.INTERNAL_API_URL}/query`
      : "http://localhost:5005/query",
    credentials: "include",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  const client = new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache(),
  });
  return client;
};
