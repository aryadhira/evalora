package migration

import (
	"evalora/config"
	"evalora/internal/models"
	"log"

	"gorm.io/gorm"
)

type Migration struct {
	db     *gorm.DB
	config *config.Config
}

func NewMigration(db *gorm.DB, config *config.Config) *Migration {
	return &Migration{db: db, config: config}
}

func (m *Migration) Migrate() error {
	// Add your model migrations here, for example:
	log.Println(m.config.AutoMigrate)
	if m.config.AutoMigrate {
		return m.db.AutoMigrate(
			&models.Users{},
			&models.UserCredential{},
			&models.OAuthAccounts{},
			&models.EmailVerification{},
			&models.PasswordResetToken{},
		)
	}
	return nil
}
