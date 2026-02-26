package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/chirag3003/collab-draw-backend/graph"
	"github.com/chirag3003/collab-draw-backend/graph/resolvers"
	"github.com/chirag3003/collab-draw-backend/internal/auth"
	"github.com/chirag3003/collab-draw-backend/internal/db"
	"github.com/chirag3003/collab-draw-backend/internal/oidc"
	"github.com/chirag3003/collab-draw-backend/internal/repository"
	"github.com/go-chi/chi"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"github.com/vektah/gqlparser/v2/ast"
)

const defaultPort = "8080"

func main() {
	// Loading Env Variables (non-fatal in Docker where env is set directly)
	if err := godotenv.Load(".env"); err != nil {
		log.Printf("Warning: .env file not found, using environment variables")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	// Connect to MongoDB
	db.ConnectMongo()

	// Setting up repositories
	repo := repository.Setup()

	// Initialize OIDC with retry for Keycloak startup
	for i := 0; i < 30; i++ {
		if err := oidc.Init(); err != nil {
			log.Printf("OIDC init attempt %d failed: %v, retrying in 2s...", i+1, err)
			time.Sleep(2 * time.Second)
			continue
		}
		log.Println("OIDC provider initialized successfully")
		break
	}
	if oidc.Verifier == nil {
		log.Fatal("Failed to initialize OIDC provider after retries")
	}

	srv := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: resolvers.NewResolver(repo)}))

	srv.AddTransport(transport.Websocket{
		KeepAlivePingInterval: 10 * time.Second,
		InitFunc: func(ctx context.Context, initPayload transport.InitPayload) (context.Context, *transport.InitPayload, error) {
			// Extract authorization from connection params
			authHeader := initPayload.Authorization()
			if authHeader == "" {
				if a, ok := initPayload["authorization"].(string); ok {
					authHeader = a
				}
			}

			if authHeader != "" {
				tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

				idToken, err := oidc.Verifier.Verify(ctx, tokenStr)
				if err == nil {
					var claims oidc.Claims
					if err := idToken.Claims(&claims); err == nil {
						validatedCtx := context.WithValue(ctx, auth.UserContextKey, &claims)
						return validatedCtx, &initPayload, nil
					}
				}
				log.Printf("WebSocket token verification failed: %v", err)
			}

			log.Printf("WebSocket auth failed or no auth provided")
			return ctx, &initPayload, nil
		},
		Upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if origin == "" || origin == r.Header.Get("Host") {
					return true
				}
				return true
			},
		},
	})
	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.POST{})

	srv.SetQueryCache(lru.New[*ast.QueryDocument](1000))

	srv.Use(extension.Introspection{})
	srv.Use(extension.AutomaticPersistedQuery{
		Cache: lru.New[string](100),
	})

	router := chi.NewRouter()
	router.Use(cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3080", "https://collab.chirag.codes"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	}).Handler)
	router.Handle("/", playground.Handler("GraphQL playground", "/query"))

	// Custom middleware that allows WebSocket upgrades to bypass auth middleware
	router.Handle("/query", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Upgrade") == "websocket" {
			srv.ServeHTTP(w, r)
			return
		}
		auth.Middleware()(srv).ServeHTTP(w, r)
	}))

	log.Printf("connect to http://localhost:%s/ for GraphQL playground", port)
	log.Fatal(http.ListenAndServe(":"+port, router))
}
