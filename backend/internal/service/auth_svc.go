package service

import (
	"context"
	"encoding/json"
	"errors"
	"evalora/config"
	"evalora/internal/models"
	"evalora/internal/repository"
	"evalora/pkg/utils"
	"log"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
)

var (
	ErrUserExists         = errors.New("user already exists")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailNotVerified   = errors.New("email not verified")
	ErrInvalidToken       = errors.New("invalid or expired token")
	ErrUserNotFound       = errors.New("user not found")
	ErrTOTPAlreadyEnabled = errors.New("2FA is already enabled")
	ErrTOTPNotEnabled     = errors.New("2FA is not enabled")
	ErrInvalidTOTP        = errors.New("invalid 2FA code")
	ErrTOTPRequired       = errors.New("2FA verification required")
	ErrForbidden          = errors.New("forbidden")
)

// ---- Input/Output types ----

type RegisterInput struct {
	Name     string
	Email    string
	Password string
}

type LoginInput struct {
	Email     string
	Password  string
	UserAgent string
	IPAddress string
}

type AuthTokens struct {
	AccessToken     string
	RefreshToken    string
	ExpiresIn       int64
	SessionID       uuid.UUID
	PendingTOTPToken string // non-empty only when ErrTOTPRequired is returned
}

type TOTPSetupResult struct {
	Secret  string
	OTPURL  string
	QRBytes []byte
}

type SessionInfo struct {
	ID        uuid.UUID  `json:"id"`
	UserAgent string     `json:"user_agent"`
	IPAddress string     `json:"ip_address"`
	ExpiresAt time.Time  `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
}

type ProfileUpdateInput struct {
	Name      string
	Phone     string
	Timezone  string
	AvatarURL string
}

// ---- Interface ----

type AuthService interface {
	Register(input RegisterInput) error
	VerifyEmail(token string) error
	ResendVerification(email string) error
	Login(input LoginInput) (*AuthTokens, error)
	Logout(sessionID uuid.UUID) error
	Refresh(refreshToken, userAgent, ipAddress string) (*AuthTokens, error)

	ForgotPassword(email string) error
	ResetPassword(token, newPassword string) error

	GoogleOAuthURL(state string) string
	GoogleOAuthCallback(ctx context.Context, code, userAgent, ipAddress string) (*AuthTokens, error)
	FrontendURL() string

	GetTOTPStatus(userID uuid.UUID) (bool, int, error)
	SetupTOTP(userID uuid.UUID) (*TOTPSetupResult, error)
	EnableTOTP(userID uuid.UUID, secret, totpCode string) ([]string, error)
	ChallengeTOTP(pendingToken, totpCode, userAgent, ipAddress string) (*AuthTokens, error)
	DisableTOTP(userID uuid.UUID, password string) error
	RegenerateTOTPBackup(userID uuid.UUID, totpCode string) ([]string, error)

	ListSessions(userID uuid.UUID) ([]SessionInfo, error)
	RevokeSession(callerID, targetSessionID uuid.UUID) error
	RevokeAllSessions(userID, exceptSessionID uuid.UUID) error

	GetProfile(userID uuid.UUID) (*models.Users, error)
	UpdateProfile(userID uuid.UUID, input ProfileUpdateInput) (*models.Users, error)
}

// ---- Implementation ----

type authService struct {
	userRepo    repository.UserRepository
	authRepo    repository.AuthRepository
	emailSvc    EmailService
	cfg         *config.Config
	oauthConfig *oauth2.Config
}

func NewAuthService(userRepo repository.UserRepository, authRepo repository.AuthRepository, emailSvc EmailService, cfg *config.Config) AuthService {
	oauthCfg := &oauth2.Config{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURL:  cfg.AppURL + "/auth/google/callback",
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
	return &authService{
		userRepo:    userRepo,
		authRepo:    authRepo,
		emailSvc:    emailSvc,
		cfg:         cfg,
		oauthConfig: oauthCfg,
	}
}

// ---- Auth ----

func (s *authService) Register(input RegisterInput) error {
	_, err := s.userRepo.FindByEmail(input.Email)
	if err == nil {
		return ErrUserExists
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	user := &models.Users{
		ID:    uuid.New(),
		Name:  input.Name,
		Email: input.Email,
	}
	if err := s.userRepo.Create(user); err != nil {
		return err
	}

	cred := &models.UserCredential{
		ID:           uuid.New(),
		UserID:       user.ID,
		PasswordHash: string(hash),
	}
	if err := s.userRepo.CreateCredential(cred); err != nil {
		return err
	}

	if err := s.sendVerificationEmail(user); err != nil {
		log.Printf("[AUTH] Register: email send failed for %s: %v", user.Email, err)
	}
	return nil
}

func (s *authService) VerifyEmail(token string) error {
	tokenHash := utils.HashToken(token)
	ev, err := s.authRepo.FindEmailVerification(tokenHash)
	if err != nil {
		return ErrInvalidToken
	}

	if err := s.authRepo.MarkEmailVerificationUsed(ev.ID); err != nil {
		return err
	}

	user, err := s.userRepo.FindByID(ev.UserID)
	if err != nil {
		return ErrUserNotFound
	}

	now := time.Now()
	user.EmailVerified = true
	user.EmailVerifiedAt = &now
	return s.userRepo.Update(user)
}

func (s *authService) ResendVerification(email string) error {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return nil // swallow to prevent enumeration
	}
	if user.EmailVerified {
		return nil
	}

	if err := s.authRepo.InvalidatePreviousVerifications(user.ID); err != nil {
		return err
	}

	if err := s.sendVerificationEmail(user); err != nil {
		log.Printf("[AUTH] ResendVerification: email send failed for %s: %v", user.Email, err)
	}
	return nil
}

func (s *authService) Login(input LoginInput) (*AuthTokens, error) {
	user, err := s.userRepo.FindByEmail(input.Email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if !user.EmailVerified {
		return nil, ErrEmailNotVerified
	}

	cred, err := s.userRepo.FindCredentialByUserID(user.ID)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(cred.PasswordHash), []byte(input.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	if cred.TOTPEnabled {
		pendingToken, err := s.generatePendingTOTPToken(user.ID)
		if err != nil {
			return nil, err
		}
		return &AuthTokens{PendingTOTPToken: pendingToken}, ErrTOTPRequired
	}

	return s.issueTokens(user.ID, input.UserAgent, input.IPAddress)
}

func (s *authService) Logout(sessionID uuid.UUID) error {
	return s.authRepo.RevokeSession(sessionID)
}

func (s *authService) Refresh(refreshToken, userAgent, ipAddress string) (*AuthTokens, error) {
	tokenHash := utils.HashToken(refreshToken)
	session, err := s.authRepo.FindSessionByTokenHash(tokenHash)
	if err != nil {
		return nil, ErrInvalidToken
	}

	if err := s.authRepo.RevokeSession(session.ID); err != nil {
		return nil, err
	}

	return s.issueTokens(session.UserID, userAgent, ipAddress)
}

// ---- Password Reset ----

func (s *authService) ForgotPassword(email string) error {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return nil // swallow to prevent enumeration
	}

	if err := s.authRepo.InvalidatePreviousPasswordResets(user.ID); err != nil {
		return err
	}

	token, err := utils.GenerateSecureToken(32)
	if err != nil {
		return err
	}

	prt := &models.PasswordResetToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: utils.HashToken(token),
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}
	if err := s.authRepo.CreatePasswordResetToken(prt); err != nil {
		return err
	}

	if err := s.emailSvc.SendPasswordResetEmail(user.Email, user.Name, token); err != nil {
		log.Printf("[AUTH] ForgotPassword: email send failed for %s: %v", user.Email, err)
	}
	return nil
}

func (s *authService) ResetPassword(token, newPassword string) error {
	tokenHash := utils.HashToken(token)
	prt, err := s.authRepo.FindPasswordResetToken(tokenHash)
	if err != nil {
		return ErrInvalidToken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	cred, err := s.userRepo.FindCredentialByUserID(prt.UserID)
	if err != nil {
		return ErrUserNotFound
	}

	cred.PasswordHash = string(hash)
	if err := s.userRepo.UpdateCredential(cred); err != nil {
		return err
	}

	if err := s.authRepo.MarkPasswordResetTokenUsed(prt.ID); err != nil {
		return err
	}

	// revoke all sessions on password change
	return s.authRepo.RevokeAllUserSessions(prt.UserID)
}

// ---- Google OAuth ----

func (s *authService) FrontendURL() string { return s.cfg.AppFrontendURL }

func (s *authService) GoogleOAuthURL(state string) string {
	return s.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

func (s *authService) GoogleOAuthCallback(ctx context.Context, code, userAgent, ipAddress string) (*AuthTokens, error) {
	oauthToken, err := s.oauthConfig.Exchange(ctx, code)
	if err != nil {
		return nil, ErrInvalidToken
	}

	userInfo, err := fetchGoogleUserInfo(ctx, s.oauthConfig, oauthToken)
	if err != nil {
		return nil, err
	}

	oauthAccount, err := s.authRepo.FindOAuthAccount("google", userInfo.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	var userID uuid.UUID

	if oauthAccount != nil {
		userID = oauthAccount.UserID
	} else {
		// find or create user by email
		user, err := s.userRepo.FindByEmail(userInfo.Email)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			now := time.Now()
			user = &models.Users{
				ID:              uuid.New(),
				Name:            userInfo.Name,
				Email:           userInfo.Email,
				AvatarURL:       userInfo.Picture,
				EmailVerified:   true,
				EmailVerifiedAt: &now,
			}
			if err := s.userRepo.Create(user); err != nil {
				return nil, err
			}
			// create empty credential so FindCredentialByUserID doesn't fail
			cred := &models.UserCredential{ID: uuid.New(), UserID: user.ID}
			if err := s.userRepo.CreateCredential(cred); err != nil {
				return nil, err
			}
		}

		account := &models.OAuthAccounts{
			ID:         uuid.New(),
			UserID:     user.ID,
			Provider:   "google",
			ProviderID: userInfo.ID,
			Email:      userInfo.Email,
		}
		if err := s.authRepo.CreateOAuthAccount(account); err != nil {
			return nil, err
		}
		userID = user.ID
	}

	cred, err := s.userRepo.FindCredentialByUserID(userID)
	if err != nil {
		return nil, err
	}
	if cred.TOTPEnabled {
		pendingToken, err := s.generatePendingTOTPToken(userID)
		if err != nil {
			return nil, err
		}
		return &AuthTokens{PendingTOTPToken: pendingToken}, ErrTOTPRequired
	}

	return s.issueTokens(userID, userAgent, ipAddress)
}

// ---- 2FA ----

func (s *authService) GetTOTPStatus(userID uuid.UUID) (bool, int, error) {
	cred, err := s.userRepo.FindCredentialByUserID(userID)
	if err != nil {
		return false, 0, err
	}
	remaining := 0
	if cred.TOTPEnabled && cred.TOTPBackupCodes != "" {
		var codes []string
		if json.Unmarshal([]byte(cred.TOTPBackupCodes), &codes) == nil {
			remaining = len(codes)
		}
	}
	return cred.TOTPEnabled, remaining, nil
}

func (s *authService) SetupTOTP(userID uuid.UUID) (*TOTPSetupResult, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	cred, err := s.userRepo.FindCredentialByUserID(userID)
	if err != nil {
		return nil, err
	}
	if cred.TOTPEnabled {
		return nil, ErrTOTPAlreadyEnabled
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Evalora",
		AccountName: user.Email,
	})
	if err != nil {
		return nil, err
	}

	return &TOTPSetupResult{
		Secret: key.Secret(),
		OTPURL: key.URL(),
	}, nil
}

func (s *authService) EnableTOTP(userID uuid.UUID, secret, totpCode string) ([]string, error) {
	if !totp.Validate(totpCode, secret) {
		return nil, ErrInvalidTOTP
	}

	cred, err := s.userRepo.FindCredentialByUserID(userID)
	if err != nil {
		return nil, err
	}
	if cred.TOTPEnabled {
		return nil, ErrTOTPAlreadyEnabled
	}

	backupCodes, err := generateBackupCodes(8)
	if err != nil {
		return nil, err
	}

	hashedCodes := make([]string, len(backupCodes))
	for i, code := range backupCodes {
		hashedCodes[i] = utils.HashToken(code)
	}

	codesJSON, err := json.Marshal(hashedCodes)
	if err != nil {
		return nil, err
	}

	cred.TOTPSecret = secret
	cred.TOTPEnabled = true
	cred.TOTPBackupCodes = string(codesJSON)
	if err := s.userRepo.UpdateCredential(cred); err != nil {
		return nil, err
	}

	return backupCodes, nil
}

func (s *authService) ChallengeTOTP(pendingToken, totpCode, userAgent, ipAddress string) (*AuthTokens, error) {
	userID, err := s.validatePendingToken(pendingToken)
	if err != nil {
		return nil, ErrInvalidToken
	}

	cred, err := s.userRepo.FindCredentialByUserID(userID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	if totp.Validate(totpCode, cred.TOTPSecret) {
		return s.issueTokens(userID, userAgent, ipAddress)
	}

	// Check backup codes
	if cred.TOTPBackupCodes != "" {
		var hashedCodes []string
		if err := json.Unmarshal([]byte(cred.TOTPBackupCodes), &hashedCodes); err == nil {
			inputHash := utils.HashToken(totpCode)
			remaining := make([]string, 0, len(hashedCodes))
			found := false
			for _, h := range hashedCodes {
				if h == inputHash && !found {
					found = true
					continue
				}
				remaining = append(remaining, h)
			}
			if found {
				codesJSON, _ := json.Marshal(remaining)
				cred.TOTPBackupCodes = string(codesJSON)
				_ = s.userRepo.UpdateCredential(cred)
				return s.issueTokens(userID, userAgent, ipAddress)
			}
		}
	}

	return nil, ErrInvalidTOTP
}

func (s *authService) DisableTOTP(userID uuid.UUID, password string) error {
	cred, err := s.userRepo.FindCredentialByUserID(userID)
	if err != nil {
		return err
	}
	if !cred.TOTPEnabled {
		return ErrTOTPNotEnabled
	}

	if err := bcrypt.CompareHashAndPassword([]byte(cred.PasswordHash), []byte(password)); err != nil {
		return ErrInvalidCredentials
	}

	cred.TOTPEnabled = false
	cred.TOTPSecret = ""
	cred.TOTPBackupCodes = ""
	return s.userRepo.UpdateCredential(cred)
}

func (s *authService) RegenerateTOTPBackup(userID uuid.UUID, totpCode string) ([]string, error) {
	cred, err := s.userRepo.FindCredentialByUserID(userID)
	if err != nil {
		return nil, err
	}
	if !cred.TOTPEnabled {
		return nil, ErrTOTPNotEnabled
	}

	if !totp.Validate(totpCode, cred.TOTPSecret) {
		return nil, ErrInvalidTOTP
	}

	backupCodes, err := generateBackupCodes(8)
	if err != nil {
		return nil, err
	}

	hashedCodes := make([]string, len(backupCodes))
	for i, code := range backupCodes {
		hashedCodes[i] = utils.HashToken(code)
	}

	codesJSON, err := json.Marshal(hashedCodes)
	if err != nil {
		return nil, err
	}

	cred.TOTPBackupCodes = string(codesJSON)
	if err := s.userRepo.UpdateCredential(cred); err != nil {
		return nil, err
	}

	return backupCodes, nil
}

// ---- Sessions ----

func (s *authService) ListSessions(userID uuid.UUID) ([]SessionInfo, error) {
	sessions, err := s.authRepo.FindActiveSessionsByUserID(userID)
	if err != nil {
		return nil, err
	}

	result := make([]SessionInfo, len(sessions))
	for i, sess := range sessions {
		result[i] = SessionInfo{
			ID:        sess.ID,
			UserAgent: sess.UserAgent,
			IPAddress: sess.IPAddress,
			ExpiresAt: sess.ExpiresAt,
			CreatedAt: sess.CreatedAt,
			RevokedAt: sess.RevokedAt,
		}
	}
	return result, nil
}

func (s *authService) RevokeSession(callerID, targetSessionID uuid.UUID) error {
	session, err := s.authRepo.FindSessionByID(targetSessionID)
	if err != nil {
		return ErrInvalidToken
	}
	if session.UserID != callerID {
		return ErrForbidden
	}
	return s.authRepo.RevokeSession(targetSessionID)
}

func (s *authService) RevokeAllSessions(userID, exceptSessionID uuid.UUID) error {
	return s.authRepo.RevokeAllUserSessionsExcept(userID, exceptSessionID)
}

// ---- Profile ----

func (s *authService) GetProfile(userID uuid.UUID) (*models.Users, error) {
	return s.userRepo.FindByID(userID)
}

func (s *authService) UpdateProfile(userID uuid.UUID, input ProfileUpdateInput) (*models.Users, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	if input.Name != "" {
		user.Name = input.Name
	}
	if input.Phone != "" {
		user.Phone = input.Phone
	}
	if input.Timezone != "" {
		user.Timezone = input.Timezone
	}
	if input.AvatarURL != "" {
		user.AvatarURL = input.AvatarURL
	}

	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}
	return user, nil
}

// ---- Helpers ----

func (s *authService) issueTokens(userID uuid.UUID, userAgent, ipAddress string) (*AuthTokens, error) {
	expiresIn := int64(15 * 60) // 15 minutes
	sessionID := uuid.New()

	accessToken, err := s.generateAccessToken(userID, sessionID, expiresIn)
	if err != nil {
		return nil, err
	}

	refreshToken, err := utils.GenerateSecureToken(32)
	if err != nil {
		return nil, err
	}

	session := &models.UserSession{
		ID:               sessionID,
		UserID:           userID,
		RefreshTokenHash: utils.HashToken(refreshToken),
		UserAgent:        userAgent,
		IPAddress:        ipAddress,
		ExpiresAt:        time.Now().Add(7 * 24 * time.Hour),
	}
	if err := s.authRepo.CreateSession(session); err != nil {
		return nil, err
	}

	return &AuthTokens{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    expiresIn,
		SessionID:    sessionID,
	}, nil
}

func (s *authService) generateAccessToken(userID, sessionID uuid.UUID, expiresIn int64) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID.String(),
		"sid": sessionID.String(),
		"exp": time.Now().Unix() + expiresIn,
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.AppSecret))
}

// generatePendingTOTPToken issues a short-lived JWT used during the 2FA challenge step.
func (s *authService) generatePendingTOTPToken(userID uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"sub":  userID.String(),
		"type": "2fa_pending",
		"exp":  time.Now().Add(5 * time.Minute).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.AppSecret))
}

func (s *authService) validatePendingToken(tokenStr string) (uuid.UUID, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.cfg.AppSecret), nil
	})
	if err != nil || !token.Valid {
		return uuid.Nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || claims["type"] != "2fa_pending" {
		return uuid.Nil, ErrInvalidToken
	}

	return uuid.Parse(claims["sub"].(string))
}

func (s *authService) sendVerificationEmail(user *models.Users) error {
	token, err := utils.GenerateSecureToken(32)
	if err != nil {
		return err
	}

	ev := &models.EmailVerification{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: utils.HashToken(token),
		ExpiresAt: time.Now().Add(24 * time.Hour).Unix(),
	}
	if err := s.authRepo.CreateEmailVerification(ev); err != nil {
		return err
	}

	return s.emailSvc.SendVerificationEmail(user.Email, user.Name, token)
}

func generateBackupCodes(n int) ([]string, error) {
	codes := make([]string, n)
	for i := range codes {
		code, err := utils.GenerateSecureToken(5) // 10-char hex code
		if err != nil {
			return nil, err
		}
		codes[i] = code
	}
	return codes, nil
}
