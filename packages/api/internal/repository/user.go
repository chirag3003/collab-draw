package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sync"
	"time"
)

// KeycloakUser represents a user from the Keycloak Admin API.
type KeycloakUser struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
}

type userRepository struct {
	keycloakURL    string
	realm          string
	clientID       string
	clientSecret   string
	tokenCache     string
	tokenExpiresAt time.Time
	mu             sync.Mutex
}

type UserRepository interface {
	GetUsersByID(ctx context.Context, ids []string) ([]KeycloakUser, error)
	GetUserByEmail(ctx context.Context, email string) ([]KeycloakUser, error)
}

func NewUserRepository() UserRepository {
	return &userRepository{
		keycloakURL:  os.Getenv("KEYCLOAK_URL"),
		realm:        os.Getenv("KEYCLOAK_REALM"),
		clientID:     os.Getenv("KEYCLOAK_API_CLIENT_ID"),
		clientSecret: os.Getenv("KEYCLOAK_API_CLIENT_SECRET"),
	}
}

// getAdminToken obtains a service account token via client_credentials grant.
func (r *userRepository) getAdminToken() (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Return cached token if still valid
	if r.tokenCache != "" && time.Now().Before(r.tokenExpiresAt) {
		return r.tokenCache, nil
	}

	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", r.keycloakURL, r.realm)

	resp, err := http.PostForm(tokenURL, url.Values{
		"grant_type":    {"client_credentials"},
		"client_id":     {r.clientID},
		"client_secret": {r.clientSecret},
	})
	if err != nil {
		return "", fmt.Errorf("failed to request token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token request failed with status %d", resp.StatusCode)
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", fmt.Errorf("failed to decode token response: %w", err)
	}

	r.tokenCache = tokenResp.AccessToken
	// Expire 30 seconds early to avoid edge cases
	r.tokenExpiresAt = time.Now().Add(time.Duration(tokenResp.ExpiresIn-30) * time.Second)

	return r.tokenCache, nil
}

func (r *userRepository) GetUsersByID(ctx context.Context, ids []string) ([]KeycloakUser, error) {
	token, err := r.getAdminToken()
	if err != nil {
		return nil, err
	}

	var users []KeycloakUser
	for _, id := range ids {
		userURL := fmt.Sprintf("%s/admin/realms/%s/users/%s", r.keycloakURL, r.realm, id)
		req, err := http.NewRequestWithContext(ctx, "GET", userURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch user %s: %w", id, err)
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusNotFound {
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("keycloak returned status %d for user %s", resp.StatusCode, id)
		}

		var u KeycloakUser
		if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
			return nil, fmt.Errorf("failed to decode user %s: %w", id, err)
		}
		users = append(users, u)
	}

	return users, nil
}

func (r *userRepository) GetUserByEmail(ctx context.Context, email string) ([]KeycloakUser, error) {
	token, err := r.getAdminToken()
	if err != nil {
		return nil, err
	}

	userURL := fmt.Sprintf("%s/admin/realms/%s/users?email=%s&exact=true",
		r.keycloakURL, r.realm, url.QueryEscape(email))
	req, err := http.NewRequestWithContext(ctx, "GET", userURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user by email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("keycloak returned status %d for email lookup", resp.StatusCode)
	}

	var users []KeycloakUser
	if err := json.NewDecoder(resp.Body).Decode(&users); err != nil {
		return nil, fmt.Errorf("failed to decode user list: %w", err)
	}

	return users, nil
}
