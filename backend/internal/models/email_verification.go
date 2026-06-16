package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EmailVerification struct {
	gorm.Model
	ID        uuid.UUID  `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;foreignKey:UserID;references:ID" json:"user_id"`
	TokenHash string     `gorm:"not null;unique;index:idx_ev_token_hash" json:"token_hash"`
	ExpiresAt int64      `gorm:"not null;index:idx_ev_expires_at,where:used_at IS NULL" json:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"created_at"`
}

func (EmailVerification) TableName() string {
	return "ms_email_verifications"
}
