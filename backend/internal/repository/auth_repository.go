package repository

import (
	"evalora/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthRepository interface {
	// Email verification
	CreateEmailVerification(ev *models.EmailVerification) error
	FindEmailVerification(tokenHash string) (*models.EmailVerification, error)
	MarkEmailVerificationUsed(id uuid.UUID) error
	InvalidatePreviousVerifications(userID uuid.UUID) error

	// Sessions
	CreateSession(session *models.UserSession) error
	FindSessionByTokenHash(tokenHash string) (*models.UserSession, error)
	FindSessionByID(id uuid.UUID) (*models.UserSession, error)
	FindActiveSessionsByUserID(userID uuid.UUID) ([]models.UserSession, error)
	RevokeSession(id uuid.UUID) error
	RevokeAllUserSessions(userID uuid.UUID) error
	RevokeAllUserSessionsExcept(userID, exceptSessionID uuid.UUID) error

	// Password reset
	CreatePasswordResetToken(prt *models.PasswordResetToken) error
	FindPasswordResetToken(tokenHash string) (*models.PasswordResetToken, error)
	MarkPasswordResetTokenUsed(id uuid.UUID) error
	InvalidatePreviousPasswordResets(userID uuid.UUID) error

	// OAuth
	FindOAuthAccount(provider, providerID string) (*models.OAuthAccounts, error)
	CreateOAuthAccount(account *models.OAuthAccounts) error
}

type authRepository struct {
	db *gorm.DB
}

func NewAuthRepository(db *gorm.DB) AuthRepository {
	return &authRepository{db: db}
}

func (r *authRepository) CreateEmailVerification(ev *models.EmailVerification) error {
	return r.db.Create(ev).Error
}

func (r *authRepository) FindEmailVerification(tokenHash string) (*models.EmailVerification, error) {
	var ev models.EmailVerification
	err := r.db.Where("token_hash = ? AND used_at IS NULL AND expires_at > ?", tokenHash, time.Now().Unix()).
		First(&ev).Error
	if err != nil {
		return nil, err
	}
	return &ev, nil
}

func (r *authRepository) MarkEmailVerificationUsed(id uuid.UUID) error {
	now := time.Now()
	return r.db.Model(&models.EmailVerification{}).Where("id = ?", id).
		Update("used_at", &now).Error
}

func (r *authRepository) InvalidatePreviousVerifications(userID uuid.UUID) error {
	now := time.Now()
	return r.db.Model(&models.EmailVerification{}).
		Where("user_id = ? AND used_at IS NULL", userID).
		Update("used_at", &now).Error
}

func (r *authRepository) CreateSession(session *models.UserSession) error {
	return r.db.Create(session).Error
}

func (r *authRepository) FindSessionByTokenHash(tokenHash string) (*models.UserSession, error) {
	var session models.UserSession
	err := r.db.Where("refresh_token_hash = ? AND revoked_at IS NULL AND expires_at > ?", tokenHash, time.Now()).
		First(&session).Error
	if err != nil {
		return nil, err
	}
	return &session, nil
}

func (r *authRepository) FindSessionByID(id uuid.UUID) (*models.UserSession, error) {
	var session models.UserSession
	if err := r.db.Where("id = ?", id).First(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

func (r *authRepository) FindActiveSessionsByUserID(userID uuid.UUID) ([]models.UserSession, error) {
	var sessions []models.UserSession
	err := r.db.Where("user_id = ? AND revoked_at IS NULL AND expires_at > ?", userID, time.Now()).
		Order("created_at DESC").Find(&sessions).Error
	return sessions, err
}

func (r *authRepository) RevokeSession(id uuid.UUID) error {
	now := time.Now()
	return r.db.Model(&models.UserSession{}).Where("id = ?", id).
		Update("revoked_at", &now).Error
}

func (r *authRepository) RevokeAllUserSessions(userID uuid.UUID) error {
	now := time.Now()
	return r.db.Model(&models.UserSession{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", &now).Error
}

func (r *authRepository) RevokeAllUserSessionsExcept(userID, exceptSessionID uuid.UUID) error {
	now := time.Now()
	return r.db.Model(&models.UserSession{}).
		Where("user_id = ? AND id != ? AND revoked_at IS NULL", userID, exceptSessionID).
		Update("revoked_at", &now).Error
}

func (r *authRepository) CreatePasswordResetToken(prt *models.PasswordResetToken) error {
	return r.db.Create(prt).Error
}

func (r *authRepository) FindPasswordResetToken(tokenHash string) (*models.PasswordResetToken, error) {
	var prt models.PasswordResetToken
	err := r.db.Where("token_hash = ? AND used_at IS NULL AND expires_at > ?", tokenHash, time.Now()).
		First(&prt).Error
	if err != nil {
		return nil, err
	}
	return &prt, nil
}

func (r *authRepository) MarkPasswordResetTokenUsed(id uuid.UUID) error {
	now := time.Now()
	return r.db.Model(&models.PasswordResetToken{}).Where("id = ?", id).
		Update("used_at", &now).Error
}

func (r *authRepository) InvalidatePreviousPasswordResets(userID uuid.UUID) error {
	now := time.Now()
	return r.db.Model(&models.PasswordResetToken{}).
		Where("user_id = ? AND used_at IS NULL", userID).
		Update("used_at", &now).Error
}

func (r *authRepository) FindOAuthAccount(provider, providerID string) (*models.OAuthAccounts, error) {
	var account models.OAuthAccounts
	err := r.db.Where("provider = ? AND provider_id = ?", provider, providerID).First(&account).Error
	if err != nil {
		return nil, err
	}
	return &account, nil
}

func (r *authRepository) CreateOAuthAccount(account *models.OAuthAccounts) error {
	return r.db.Create(account).Error
}
