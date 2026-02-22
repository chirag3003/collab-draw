package models

import (
	"go.mongodb.org/mongo-driver/v2/bson"
)

type Project struct {
	ID          bson.ObjectID  `bson:"_id,omitempty" json:"id"`
	Name        string         `bson:"name" json:"name"`
	Description string         `bson:"description" json:"description"`
	Owner       string         `bson:"owner" json:"owner"`
	Members     []string       `bson:"members" json:"members"`
	Workspace   *bson.ObjectID `bson:"workspace,omitempty" json:"workspace,omitempty"`
	Personal    bool           `bson:"personal" json:"personal"`
	Elements    string         `bson:"elements" json:"elements"`
	HeadSeq     int64          `bson:"head_seq" json:"headSeq"`
	CreatedAt   string         `bson:"created_at" json:"createdAt"`
	UpdatedAt   string         `bson:"updated_at" json:"updatedAt"`
}

type Operation struct {
	ID         bson.ObjectID `bson:"_id,omitempty" json:"id"`
	ProjectID  bson.ObjectID `bson:"project_id" json:"projectId"`
	Seq        int64         `bson:"seq" json:"seq"`
	ClientSeq  int           `bson:"client_seq" json:"clientSeq"`
	SocketID   string        `bson:"socket_id" json:"socketId"`
	Type       string        `bson:"type" json:"type"` // ADD, UPDATE, DELETE
	ElementID  string        `bson:"element_id" json:"elementId"`
	ElementVer int           `bson:"element_ver" json:"elementVer"`
	BaseSeq    int           `bson:"base_seq" json:"baseSeq"`
	Data       *string       `bson:"data,omitempty" json:"data,omitempty"`
	Timestamp  string        `bson:"timestamp" json:"timestamp"`
}

type OperationInput struct {
	ClientSeq  int     `json:"clientSeq"`
	Type       string  `json:"type"`
	ElementID  string  `json:"elementId"`
	ElementVer int     `json:"elementVer"`
	BaseSeq    int     `json:"baseSeq"`
	Data       *string `json:"data,omitempty"`
}
