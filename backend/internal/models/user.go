package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Users struct {
	gorm.Model
	ID              uuid.UUID  `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	Name            string     `gorm:"type:varchar(255);not null" json:"name"`
	Email           string     `gorm:"index:idx_users_email,type:varchar(255);unique;not null" json:"email"`
	AvatarURL       string     `gorm:"type:text" json:"avatar_url"`
	Phone           string     `gorm:"type:varchar(20)" json:"phone"`
	Timezone        string     `gorm:"type:varchar(50)" json:"timezone"`
	Status          string     `gorm:"index:idx_users_status,where:status!='active',type:varchar(20);default:'active';enum('active','suspended')" json:"status"`
	EmailVerified   bool       `gorm:"default:false" json:"email_verified"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	CreatedAt       time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}

func (Users) TableName() string {
	return "ms_users"
}

type UserCredential struct {
	gorm.Model
	ID              uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID          uuid.UUID `gorm:"type:uuid;not null;references:ID" json:"user_id"`
	PasswordHash    string    `gorm:"type:text" json:"password_hash"`
	TOTPSecret      string    `gorm:"type:text" json:"totp_secret"`
	TOTPEnabled     bool      `gorm:"default:false" json:"totp_enabled"`
	TOTPBackupCodes string    `gorm:"type:text[]" json:"totp_backup_codes"`
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (UserCredential) TableName() string {
	return "ms_user_credentials"
}
