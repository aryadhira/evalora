package models

import "github.com/google/uuid"

type OAuthAccounts struct {
	ID         uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID     uuid.UUID `gorm:"type:uuid;not null;index:idx_oauth_user,foreignKey:UserID;references:ID" json:"user_id"`
	Provider   string    `gorm:"type:varchar(255);not null" json:"provider"`
	ProviderID string    `gorm:"type:varchar(255);not null" json:"provider_id"`
	Email      string    `gorm:"type:varchar(255)" json:"email"`
	CreatedAt  int64     `gorm:"autoCreateTime" json:"created_at"`
}

func (OAuthAccounts) TableName() string {
	return "ms_oauth_accounts"
}
