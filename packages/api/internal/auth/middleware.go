package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/chirag3003/collab-draw-backend/internal/oidc"
)

// A private key for context that only this package can access.
type contextKey string

const UserContextKey = contextKey("user")

// Middleware verifies the Bearer token and adds OIDC claims to the context.
func Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

			idToken, err := oidc.Verifier.Verify(r.Context(), tokenStr)
			if err != nil {
				http.Error(w, "unauthorized: invalid token", http.StatusUnauthorized)
				return
			}

			var claims oidc.Claims
			if err := idToken.Claims(&claims); err != nil {
				http.Error(w, "unauthorized: invalid claims", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserContextKey, &claims)
			r = r.WithContext(ctx)
			next.ServeHTTP(w, r)
		})
	}
}

// ForContext finds the user from the context. REQUIRES Middleware to have run.
func ForContext(ctx context.Context) *oidc.Claims {
	raw, _ := ctx.Value(UserContextKey).(*oidc.Claims)
	return raw
}
