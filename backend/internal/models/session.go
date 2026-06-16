package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserSession struct {
	gorm.Model
	ID               uuid.UUID  `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID           uuid.UUID  `gorm:"type:uuid;not null;index:idx_sessions_user_id" json:"user_id"`
	RefreshTokenHash string     `gorm:"type:text;not null;unique;index:idx_sessions_token_hash" json:"refresh_token_hash"`
	UserAgent        string     `gorm:"type:text" json:"user_agent"`
	IPAddress        string     `gorm:"type:varchar(45)" json:"ip_address"`
	ExpiresAt        time.Time  `gorm:"type:timestamp;not null" json:"expires_at"`
	RevokedAt        *time.Time `gorm:"type:timestamp" json:"revoked_at,omitempty"`
	CreatedAt        time.Time  `gorm:"autoCreateTime" json:"created_at"`
}

func (UserSession) TableName() string {
	return "ms_user_sessions"
}
