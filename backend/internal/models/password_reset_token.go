package models

import (
	"time"

	"github.com/google/uuid"
)

type PasswordResetToken struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;unique;foreignKey:UserID;references:ID" json:"user_id"`
	TokenHash string     `gorm:"type:text;not null;index:idx_prt_token_hash" json:"token_hash"`
	ExpiresAt time.Time  `gorm:"type:timestamp;not null;index:idx_prt_expires_at,where:used_at IS NULL" json:"expires_at"`
	UsedAt    *time.Time `gorm:"type:timestamp" json:"used_at,omitempty"`
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"created_at"`
}

func (PasswordResetToken) TableName() string {
	return "ms_password_reset_tokens"
}
