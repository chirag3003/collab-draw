package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/chirag3003/collab-draw-backend/internal/config"
	"github.com/chirag3003/collab-draw-backend/internal/db"
	"github.com/chirag3003/collab-draw-backend/internal/models"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type operationRepository struct {
	operations *mongo.Collection
	projects   *mongo.Collection
}

type OpInput struct {
	ClientSeq  int32
	Type       string
	ElementID  string
	ElementVer int32
	BaseSeq    int32
	Data       *string
}

type OperationRepository interface {
	ApplyOps(ctx context.Context, projectID string, socketID string, ops []OpInput, userID string) (*ApplyOpsResult, error)
	GetOpsSince(ctx context.Context, projectID string, sinceSeq int32, limit *int32) ([]*models.Operation, error)
	GetOpsRange(ctx context.Context, projectID string, fromSeq int32, toSeq int32) ([]*models.Operation, error)
	ReconstructStateAt(ctx context.Context, projectID string, seq int32, userID string) (string, int64, string, error)
}

type ApplyOpsResult struct {
	Ack       bool
	ServerSeq int64
	Rejected  []RejectedOp
	Accepted  []*models.Operation
}

type RejectedOp struct {
	ClientSeq int32
	ElementID string
	Reason    string
}

func NewOperationRepository() OperationRepository {
	ops := db.GetCollection(config.OPERATIONS)

	// Create indexes for efficient queries
	indexModels := []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "project_id", Value: 1},
				{Key: "seq", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "project_id", Value: 1},
				{Key: "element_id", Value: 1},
				{Key: "seq", Value: -1},
			},
		},
	}
	_, _ = ops.Indexes().CreateMany(context.Background(), indexModels)

	return &operationRepository{
		operations: ops,
		projects:   db.GetCollection(config.PROJECT),
	}
}

func (r *operationRepository) ApplyOps(ctx context.Context, projectID string, socketID string, ops []OpInput, userID string) (*ApplyOpsResult, error) {
	projID, err := bson.ObjectIDFromHex(projectID)
	if err != nil {
		return nil, fmt.Errorf("invalid project ID: %v", err)
	}

	batchSize := int64(len(ops))
	if batchSize == 0 {
		return &ApplyOpsResult{Ack: true, ServerSeq: 0}, nil
	}

	// Atomically claim sequence numbers using FindOneAndUpdate with $inc
	var updatedProject models.Project
	err = r.projects.FindOneAndUpdate(
		ctx,
		bson.M{
			"_id": projID,
			"$or": bson.A{
				bson.M{"owner": userID},
				bson.M{"members": userID},
			},
		},
		bson.M{
			"$inc": bson.M{"head_seq": batchSize},
			"$set": bson.M{"updated_at": time.Now().Format(time.RFC3339)},
		},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&updatedProject)
	if err != nil {
		return nil, fmt.Errorf("failed to claim sequence numbers: %v", err)
	}

	// The new head_seq is updatedProject.HeadSeq
	// Our claimed range is [head_seq - batchSize + 1, head_seq]
	startSeq := updatedProject.HeadSeq - batchSize + 1

	result := &ApplyOpsResult{
		Ack:       true,
		ServerSeq: updatedProject.HeadSeq,
	}

	// For conflict detection: find the latest op for each element referenced in this batch
	elementIDs := make([]string, 0, len(ops))
	for _, op := range ops {
		elementIDs = append(elementIDs, op.ElementID)
	}

	// Get latest ops for these elements to check conflicts
	type latestInfo struct {
		Seq        int64
		ElementVer int32
		Type       string
	}
	latestOps := make(map[string]*latestInfo)
	if len(elementIDs) > 0 {
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{
				"project_id": projID,
				"element_id": bson.M{"$in": elementIDs},
			}}},
			{{Key: "$sort", Value: bson.M{"seq": -1}}},
			{{Key: "$group", Value: bson.M{
				"_id":         "$element_id",
				"latest_seq":  bson.M{"$first": "$seq"},
				"element_ver": bson.M{"$first": "$element_ver"},
				"type":        bson.M{"$first": "$type"},
			}}},
		}
		cursor, err := r.operations.Aggregate(ctx, pipeline)
		if err == nil {
			var results []struct {
				ElementID  string `bson:"_id"`
				LatestSeq  int64  `bson:"latest_seq"`
				ElementVer int32  `bson:"element_ver"`
				Type       string `bson:"type"`
			}
			if err := cursor.All(ctx, &results); err == nil {
				for _, res := range results {
					latestOps[res.ElementID] = &latestInfo{
						Seq:        res.LatestSeq,
						ElementVer: res.ElementVer,
						Type:       res.Type,
					}
				}
			}
		}
	}

	// Process each op: conflict check and build accepted ops
	var acceptedOps []*models.Operation
	var docsToInsert []interface{}

	for i, op := range ops {
		seq := startSeq + int64(i)

		// Conflict check: has this element been modified since op.BaseSeq?
		if latest, exists := latestOps[op.ElementID]; exists {
			if latest.Seq > int64(op.BaseSeq) && op.ElementVer <= latest.ElementVer {
				result.Rejected = append(result.Rejected, RejectedOp{
					ClientSeq: op.ClientSeq,
					ElementID: op.ElementID,
					Reason:    fmt.Sprintf("element modified at seq %d (ver %d), your base was seq %d (ver %d)", latest.Seq, latest.ElementVer, op.BaseSeq, op.ElementVer),
				})
				continue
			}
		}

		now := time.Now().Format(time.RFC3339Nano)
		opDoc := &models.Operation{
			ProjectID:  projID,
			Seq:        seq,
			ClientSeq:  int(op.ClientSeq),
			SocketID:   socketID,
			Type:       op.Type,
			ElementID:  op.ElementID,
			ElementVer: int(op.ElementVer),
			BaseSeq:    int(op.BaseSeq),
			Data:       op.Data,
			Timestamp:  now,
		}
		acceptedOps = append(acceptedOps, opDoc)
		docsToInsert = append(docsToInsert, opDoc)

		// Update our in-memory latest ops for subsequent conflict checks within the same batch
		latestOps[op.ElementID] = &latestInfo{
			Seq:        seq,
			ElementVer: op.ElementVer,
			Type:       op.Type,
		}
	}

	// Insert accepted ops into the operations collection
	if len(docsToInsert) > 0 {
		_, err = r.operations.InsertMany(ctx, docsToInsert)
		if err != nil {
			return nil, fmt.Errorf("failed to insert operations: %v", err)
		}
	}

	// Apply accepted ops to the project's elements field
	if len(acceptedOps) > 0 {
		err = r.applyOpsToElements(ctx, projID, acceptedOps)
		if err != nil {
			fmt.Printf("Warning: failed to apply ops to elements: %v\n", err)
		}
	}

	result.Accepted = acceptedOps
	return result, nil
}

// applyOpsToElements updates the project's elements field based on accepted ops
func (r *operationRepository) applyOpsToElements(ctx context.Context, projID bson.ObjectID, ops []*models.Operation) error {
	// Fetch current elements
	var project models.Project
	err := r.projects.FindOne(ctx, bson.M{"_id": projID}).Decode(&project)
	if err != nil {
		return err
	}

	// Parse elements as a map keyed by element ID
	var elements []map[string]interface{}
	if project.Elements != "" {
		if err := json.Unmarshal([]byte(project.Elements), &elements); err != nil {
			elements = []map[string]interface{}{}
		}
	}

	elementMap := make(map[string]map[string]interface{})
	var elementOrder []string
	for _, el := range elements {
		if id, ok := el["id"].(string); ok {
			elementMap[id] = el
			elementOrder = append(elementOrder, id)
		}
	}

	// Apply each operation
	for _, op := range ops {
		switch op.Type {
		case "ADD":
			if op.Data != nil {
				var elData map[string]interface{}
				if err := json.Unmarshal([]byte(*op.Data), &elData); err == nil {
					if _, exists := elementMap[op.ElementID]; !exists {
						elementOrder = append(elementOrder, op.ElementID)
					}
					elementMap[op.ElementID] = elData
				}
			}
		case "UPDATE":
			if op.Data != nil {
				var elData map[string]interface{}
				if err := json.Unmarshal([]byte(*op.Data), &elData); err == nil {
					if _, exists := elementMap[op.ElementID]; !exists {
						elementOrder = append(elementOrder, op.ElementID)
					}
					elementMap[op.ElementID] = elData
				}
			}
		case "DELETE":
			if el, exists := elementMap[op.ElementID]; exists {
				el["isDeleted"] = true
				elementMap[op.ElementID] = el
			}
		}
	}

	// Reconstruct the elements array in order
	var updatedElements []map[string]interface{}
	for _, id := range elementOrder {
		if el, exists := elementMap[id]; exists {
			updatedElements = append(updatedElements, el)
		}
	}

	// Serialize back
	elemBytes, err := json.Marshal(updatedElements)
	if err != nil {
		return err
	}

	_, err = r.projects.UpdateOne(ctx, bson.M{"_id": projID}, bson.M{
		"$set": bson.M{
			"elements":   string(elemBytes),
			"updated_at": time.Now().Format(time.RFC3339),
		},
	})
	return err
}

func (r *operationRepository) GetOpsSince(ctx context.Context, projectID string, sinceSeq int32, limit *int32) ([]*models.Operation, error) {
	projID, err := bson.ObjectIDFromHex(projectID)
	if err != nil {
		return nil, err
	}

	filter := bson.M{
		"project_id": projID,
		"seq":        bson.M{"$gt": sinceSeq},
	}

	findOpts := options.Find().SetSort(bson.D{{Key: "seq", Value: 1}})
	if limit != nil && *limit > 0 {
		findOpts.SetLimit(int64(*limit))
	} else {
		findOpts.SetLimit(1000) // Default limit
	}

	cursor, err := r.operations.Find(ctx, filter, findOpts)
	if err != nil {
		return nil, err
	}

	var ops []*models.Operation
	if err := cursor.All(ctx, &ops); err != nil {
		return nil, err
	}
	return ops, nil
}

func (r *operationRepository) GetOpsRange(ctx context.Context, projectID string, fromSeq int32, toSeq int32) ([]*models.Operation, error) {
	projID, err := bson.ObjectIDFromHex(projectID)
	if err != nil {
		return nil, err
	}

	filter := bson.M{
		"project_id": projID,
		"seq": bson.M{
			"$gte": fromSeq,
			"$lte": toSeq,
		},
	}

	findOpts := options.Find().SetSort(bson.D{{Key: "seq", Value: 1}})
	cursor, err := r.operations.Find(ctx, filter, findOpts)
	if err != nil {
		return nil, err
	}

	var ops []*models.Operation
	if err := cursor.All(ctx, &ops); err != nil {
		return nil, err
	}
	return ops, nil
}

func (r *operationRepository) ReconstructStateAt(ctx context.Context, projectID string, seq int32, userID string) (string, int64, string, error) {
	projID, err := bson.ObjectIDFromHex(projectID)
	if err != nil {
		return "", 0, "", err
	}

	// Get all ops from seq=0 to target seq and forward-apply from empty state
	filter := bson.M{
		"project_id": projID,
		"seq":        bson.M{"$lte": seq},
	}
	findOpts := options.Find().SetSort(bson.D{{Key: "seq", Value: 1}})
	cursor, err := r.operations.Find(ctx, filter, findOpts)
	if err != nil {
		return "", 0, "", err
	}

	var ops []*models.Operation
	if err := cursor.All(ctx, &ops); err != nil {
		return "", 0, "", err
	}

	// Forward-apply all ops to build state
	elementMap := make(map[string]map[string]interface{})
	var elementOrder []string
	var lastTimestamp string
	var lastSeq int64

	for _, op := range ops {
		lastSeq = op.Seq
		lastTimestamp = op.Timestamp

		switch op.Type {
		case "ADD", "UPDATE":
			if op.Data != nil {
				var elData map[string]interface{}
				if err := json.Unmarshal([]byte(*op.Data), &elData); err == nil {
					if _, exists := elementMap[op.ElementID]; !exists {
						elementOrder = append(elementOrder, op.ElementID)
					}
					elementMap[op.ElementID] = elData
				}
			}
		case "DELETE":
			if el, exists := elementMap[op.ElementID]; exists {
				el["isDeleted"] = true
				elementMap[op.ElementID] = el
			}
		}
	}

	// Reconstruct elements array
	var elements []map[string]interface{}
	for _, id := range elementOrder {
		if el, exists := elementMap[id]; exists {
			elements = append(elements, el)
		}
	}

	elemBytes, err := json.Marshal(elements)
	if err != nil {
		return "", 0, "", err
	}

	return string(elemBytes), lastSeq, lastTimestamp, nil
}
