package resolvers

//go:generate go run github.com/99designs/gqlgen generate

import (
	"fmt"
	"math/rand/v2"
	"sync"

	"github.com/chirag3003/collab-draw-backend/graph/model"
	"github.com/chirag3003/collab-draw-backend/internal/repository"
)

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

type ProjectSubscriber struct {
	sockedID string
	channel  chan *model.ProjectSubscription
}

type ProjectOpsSubscriber struct {
	sockedID string
	userID   string
	userName string
	channel  chan *model.ProjectOpsSubscription
}

type CursorSubscriber struct {
	sockedID string
	channel  chan *model.CursorUpdate
}

type PresenceInfo struct {
	UserID   string
	UserName string
	Email    string
	JoinedAt string
	Status   model.PresenceStatus
}

type PresenceSubscriber struct {
	sockedID string
	channel  chan []*model.UserPresence
}

type Resolver struct {
	Repo               *repository.Repository
	projectSubscribers map[string][]ProjectSubscriber
	opsSubscribers     map[string][]ProjectOpsSubscriber
	cursorSubscribers  map[string][]CursorSubscriber
	projectPresence    map[string]map[string]*PresenceInfo // projectID -> userID -> info
	presenceSubscribers map[string][]PresenceSubscriber
	subscribersMutex   sync.RWMutex
}

func NewResolver(repo *repository.Repository) *Resolver {
	return &Resolver{
		Repo:               repo,
		projectSubscribers: make(map[string][]ProjectSubscriber),
		opsSubscribers:     make(map[string][]ProjectOpsSubscriber),
		cursorSubscribers:  make(map[string][]CursorSubscriber),
		projectPresence:    make(map[string]map[string]*PresenceInfo),
		presenceSubscribers: make(map[string][]PresenceSubscriber),
	}
}

func generateRandom8DigitString() string {
	// The range for an 8-digit number is [10000000, 99999999].
	// We generate a number in the range [0, 89999999] and add 10000000 to it.
	minN := 10000000
	maxNum := 90000000 // maxNum is exclusive in rand.Intn, so 99999999 is maxNum - 1
	randomNumber := rand.IntN(maxNum) + minN

	// Convert the integer to a string
	return fmt.Sprintf("%d", randomNumber)
}

// Subscribe adds a subscriber for a specific project
func (r *Resolver) subscribeToProject(projectID string, ch chan *model.ProjectSubscription) string {
	r.subscribersMutex.Lock()
	defer r.subscribersMutex.Unlock()
	subscriber := ProjectSubscriber{
		channel:  ch,
		sockedID: generateRandom8DigitString(),
	}
	r.projectSubscribers[projectID] = append(r.projectSubscribers[projectID], subscriber)
	return subscriber.sockedID
}

// Unsubscribe removes a subscriber for a specific project
func (r *Resolver) unsubscribeFromProject(projectID string, socketID string) {
	r.subscribersMutex.Lock()
	defer r.subscribersMutex.Unlock()

	subscribers := r.projectSubscribers[projectID]
	for i, subscriber := range subscribers {
		if subscriber.sockedID == socketID {
			r.projectSubscribers[projectID] = append(subscribers[:i], subscribers[i+1:]...)
			close(subscriber.channel)
			break
		}
	}

	// Clean up empty subscriber lists
	if len(r.projectSubscribers[projectID]) == 0 {
		delete(r.projectSubscribers, projectID)
	}
}

// Broadcast sends a project update to all subscribers
func (r *Resolver) broadcastProjectUpdate(projectID string, project *model.ProjectSubscription, fromID string) {
	r.subscribersMutex.RLock()
	defer r.subscribersMutex.RUnlock()

	if subscribers, ok := r.projectSubscribers[projectID]; ok {
		for _, subscriber := range subscribers {
			if subscriber.sockedID == fromID {
				continue
			}
			// Create a new struct per subscriber to avoid data race
			msg := &model.ProjectSubscription{
				Elements: project.Elements,
				SocketID: subscriber.sockedID,
			}
			select {
			case subscriber.channel <- msg:
			default:
				fmt.Printf("Warning: dropped update for subscriber %s on project %s (channel full)\n", subscriber.sockedID, projectID)
			}
		}
	}
}

// subscribeToProjectOps adds an ops subscriber for a specific project
func (r *Resolver) subscribeToProjectOps(projectID string, userID string, userName string, ch chan *model.ProjectOpsSubscription) string {
	r.subscribersMutex.Lock()
	defer r.subscribersMutex.Unlock()
	subscriber := ProjectOpsSubscriber{
		channel:  ch,
		sockedID: generateRandom8DigitString(),
		userID:   userID,
		userName: userName,
	}
	r.opsSubscribers[projectID] = append(r.opsSubscribers[projectID], subscriber)
	return subscriber.sockedID
}

// unsubscribeFromProjectOps removes an ops subscriber
func (r *Resolver) unsubscribeFromProjectOps(projectID string, socketID string) {
	r.subscribersMutex.Lock()
	defer r.subscribersMutex.Unlock()

	subscribers := r.opsSubscribers[projectID]
	for i, subscriber := range subscribers {
		if subscriber.sockedID == socketID {
			r.opsSubscribers[projectID] = append(subscribers[:i], subscribers[i+1:]...)
			close(subscriber.channel)
			break
		}
	}

	if len(r.opsSubscribers[projectID]) == 0 {
		delete(r.opsSubscribers, projectID)
	}
}

// broadcastOps sends operations to all ops subscribers except sender
func (r *Resolver) broadcastOps(projectID string, ops []*model.Operation, fromSocketID string) {
	r.subscribersMutex.RLock()
	defer r.subscribersMutex.RUnlock()

	if subscribers, ok := r.opsSubscribers[projectID]; ok {
		for _, subscriber := range subscribers {
			if subscriber.sockedID == fromSocketID {
				continue
			}
			msg := &model.ProjectOpsSubscription{
				Ops:      ops,
				SocketID: subscriber.sockedID,
			}
			select {
			case subscriber.channel <- msg:
			default:
				fmt.Printf("Warning: dropped ops for subscriber %s on project %s (channel full)\n", subscriber.sockedID, projectID)
			}
		}
	}
}

// subscribeToCursors adds a cursor subscriber
func (r *Resolver) subscribeToCursors(projectID string, ch chan *model.CursorUpdate) string {
	r.subscribersMutex.Lock()
	defer r.subscribersMutex.Unlock()
	subscriber := CursorSubscriber{
		channel:  ch,
		sockedID: generateRandom8DigitString(),
	}
	r.cursorSubscribers[projectID] = append(r.cursorSubscribers[projectID], subscriber)
	return subscriber.sockedID
}

// unsubscribeFromCursors removes a cursor subscriber
func (r *Resolver) unsubscribeFromCursors(projectID string, socketID string) {
	r.subscribersMutex.Lock()
	defer r.subscribersMutex.Unlock()

	subscribers := r.cursorSubscribers[projectID]
	for i, subscriber := range subscribers {
		if subscriber.sockedID == socketID {
			r.cursorSubscribers[projectID] = append(subscribers[:i], subscribers[i+1:]...)
			close(subscriber.channel)
			break
		}
	}

	if len(r.cursorSubscribers[projectID]) == 0 {
		delete(r.cursorSubscribers, projectID)
	}
}

// broadcastCursor sends cursor update to all subscribers except sender
func (r *Resolver) broadcastCursor(projectID string, cursor *model.CursorUpdate, fromSocketID string) {
	r.subscribersMutex.RLock()
	defer r.subscribersMutex.RUnlock()

	if subscribers, ok := r.cursorSubscribers[projectID]; ok {
		for _, subscriber := range subscribers {
			if subscriber.sockedID == fromSocketID {
				continue
			}
			select {
			case subscriber.channel <- cursor:
			default:
				// Cursor updates are ephemeral, safe to drop
			}
		}
	}
}

// addPresence adds a user to project presence
func (r *Resolver) addPresence(projectID string, userID string, userName string, email string, joinedAt string) {
	r.subscribersMutex.Lock()
	defer r.subscribersMutex.Unlock()

	if r.projectPresence[projectID] == nil {
		r.projectPresence[projectID] = make(map[string]*PresenceInfo)
	}
	r.projectPresence[projectID][userID] = &PresenceInfo{
		UserID:   userID,
		UserName: userName,
		Email:    email,
		JoinedAt: joinedAt,
		Status:   model.PresenceStatusActive,
	}
}

// removePresence removes a user from project presence
func (r *Resolver) removePresence(projectID string, userID string) {
	r.subscribersMutex.Lock()
	defer r.subscribersMutex.Unlock()

	if users, ok := r.projectPresence[projectID]; ok {
		delete(users, userID)
		if len(users) == 0 {
			delete(r.projectPresence, projectID)
		}
	}
}

// getPresenceList returns current presence for a project
func (r *Resolver) getPresenceList(projectID string) []*model.UserPresence {
	r.subscribersMutex.RLock()
	defer r.subscribersMutex.RUnlock()

	var result []*model.UserPresence
	if users, ok := r.projectPresence[projectID]; ok {
		for _, info := range users {
			result = append(result, &model.UserPresence{
				UserID:   info.UserID,
				UserName: info.UserName,
				Email:    info.Email,
				Status:   info.Status,
				JoinedAt: info.JoinedAt,
			})
		}
	}
	return result
}

// subscribeToPresence adds a presence subscriber
func (r *Resolver) subscribeToPresence(projectID string, ch chan []*model.UserPresence) string {
	r.subscribersMutex.Lock()
	defer r.subscribersMutex.Unlock()
	subscriber := PresenceSubscriber{
		channel:  ch,
		sockedID: generateRandom8DigitString(),
	}
	r.presenceSubscribers[projectID] = append(r.presenceSubscribers[projectID], subscriber)
	return subscriber.sockedID
}

// unsubscribeFromPresence removes a presence subscriber
func (r *Resolver) unsubscribeFromPresence(projectID string, socketID string) {
	r.subscribersMutex.Lock()
	defer r.subscribersMutex.Unlock()

	subscribers := r.presenceSubscribers[projectID]
	for i, subscriber := range subscribers {
		if subscriber.sockedID == socketID {
			r.presenceSubscribers[projectID] = append(subscribers[:i], subscribers[i+1:]...)
			close(subscriber.channel)
			break
		}
	}

	if len(r.presenceSubscribers[projectID]) == 0 {
		delete(r.presenceSubscribers, projectID)
	}
}

// broadcastPresence sends updated presence list to all subscribers
func (r *Resolver) broadcastPresence(projectID string) {
	presenceList := r.getPresenceList(projectID)

	r.subscribersMutex.RLock()
	defer r.subscribersMutex.RUnlock()

	if subscribers, ok := r.presenceSubscribers[projectID]; ok {
		for _, subscriber := range subscribers {
			// Make a copy of the list per subscriber
			listCopy := make([]*model.UserPresence, len(presenceList))
			copy(listCopy, presenceList)
			select {
			case subscriber.channel <- listCopy:
			default:
				// Presence updates can be dropped safely
			}
		}
	}
}
