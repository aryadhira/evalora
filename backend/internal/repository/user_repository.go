package repository

import (
	"evalora/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRepository interface {
	FindByEmail(email string) (*models.Users, error)
	FindByID(id uuid.UUID) (*models.Users, error)
	Create(user *models.Users) error
	Update(user *models.Users) error
	CreateCredential(cred *models.UserCredential) error
	FindCredentialByUserID(userID uuid.UUID) (*models.UserCredential, error)
	UpdateCredential(cred *models.UserCredential) error
}

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) FindByEmail(email string) (*models.Users, error) {
	var user models.Users
	if err := r.db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindByID(id uuid.UUID) (*models.Users, error) {
	var user models.Users
	if err := r.db.Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) Create(user *models.Users) error {
	return r.db.Create(user).Error
}

func (r *userRepository) Update(user *models.Users) error {
	return r.db.Save(user).Error
}

func (r *userRepository) CreateCredential(cred *models.UserCredential) error {
	return r.db.Create(cred).Error
}

func (r *userRepository) FindCredentialByUserID(userID uuid.UUID) (*models.UserCredential, error) {
	var cred models.UserCredential
	if err := r.db.Where("user_id = ?", userID).First(&cred).Error; err != nil {
		return nil, err
	}
	return &cred, nil
}

func (r *userRepository) UpdateCredential(cred *models.UserCredential) error {
	return r.db.Save(cred).Error
}
