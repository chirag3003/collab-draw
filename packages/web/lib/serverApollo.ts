import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client"
import { getSession } from "@/lib/auth/session";

export const getServerApollo = async () => {
    const session = await getSession()
    const token = session?.accessToken
    const httpLink = new HttpLink({
        uri:
          process.env.INTERNAL_API_URL
            ? `${process.env.INTERNAL_API_URL}/query`
            : "http://localhost:5005/query",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

    const client = new ApolloClient({
        link: httpLink,
        cache: new InMemoryCache(),
      });
    return client;
}
