package handler

import (
	"errors"
	"evalora/internal/service"
	"fmt"
	"net/url"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type AuthHandler struct {
	authSvc service.AuthService
}

func NewAuthHandler(authSvc service.AuthService) *AuthHandler {
	return &AuthHandler{authSvc: authSvc}
}

// ---- helpers ----

func (h *AuthHandler) userID(c fiber.Ctx) (uuid.UUID, bool) {
	id, ok := c.Locals("user_id").(uuid.UUID)
	return id, ok
}

func (h *AuthHandler) sessionID(c fiber.Ctx) (uuid.UUID, bool) {
	id, ok := c.Locals("session_id").(uuid.UUID)
	return id, ok
}

func setRefreshCookie(c fiber.Ctx, value string, expires time.Time) {
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    value,
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Strict",
		Expires:  expires,
		Path:     "/auth/refresh",
	})
}

func clearRefreshCookie(c fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:    "refresh_token",
		Value:   "",
		Expires: time.Unix(0, 0),
		Path:    "/auth/refresh",
	})
}

func respondWithTokens(c fiber.Ctx, tokens *service.AuthTokens) error {
	setRefreshCookie(c, tokens.RefreshToken, time.Now().Add(7*24*time.Hour))
	return c.JSON(fiber.Map{
		"access_token": tokens.AccessToken,
		"expires_in":   tokens.ExpiresIn,
	})
}

// ---- Register / Verify / Resend ----

func (h *AuthHandler) Register(c fiber.Ctx) error {
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.Name == "" || req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name, email, and password are required"})
	}

	err := h.authSvc.Register(service.RegisterInput{Name: req.Name, Email: req.Email, Password: req.Password})
	if errors.Is(err, service.ErrUserExists) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "email already registered"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "registration failed"})
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "registration successful, please verify your email"})
}

func (h *AuthHandler) VerifyEmail(c fiber.Ctx) error {
	var req struct {
		Token string `json:"token"`
	}
	if err := c.Bind().JSON(&req); err != nil || req.Token == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "token is required"})
	}

	if err := h.authSvc.VerifyEmail(req.Token); errors.Is(err, service.ErrInvalidToken) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid or expired token"})
	} else if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "verification failed"})
	}
	return c.JSON(fiber.Map{"message": "email verified successfully"})
}

func (h *AuthHandler) ResendVerification(c fiber.Ctx) error {
	var req struct {
		Email string `json:"email"`
	}
	if err := c.Bind().JSON(&req); err != nil || req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "email is required"})
	}
	h.authSvc.ResendVerification(req.Email) //nolint:errcheck
	return c.JSON(fiber.Map{"message": "if the email exists, a verification link has been sent"})
}

// ---- Login / Logout / Refresh ----

func (h *AuthHandler) Login(c fiber.Ctx) error {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tokens, err := h.authSvc.Login(service.LoginInput{
		Email:     req.Email,
		Password:  req.Password,
		UserAgent: string(c.Request().Header.UserAgent()),
		IPAddress: c.IP(),
	})

	if errors.Is(err, service.ErrTOTPRequired) {
		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
			"2fa_required":  true,
			"pending_token": tokens.PendingTOTPToken,
		})
	}
	if errors.Is(err, service.ErrInvalidCredentials) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid email or password"})
	}
	if errors.Is(err, service.ErrEmailNotVerified) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "please verify your email before logging in"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "login failed"})
	}
	return respondWithTokens(c, tokens)
}

func (h *AuthHandler) Logout(c fiber.Ctx) error {
	sessionID, ok := h.sessionID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	if err := h.authSvc.Logout(sessionID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "logout failed"})
	}
	clearRefreshCookie(c)
	return c.JSON(fiber.Map{"message": "logged out successfully"})
}

func (h *AuthHandler) Refresh(c fiber.Ctx) error {
	refreshToken := c.Cookies("refresh_token")
	if refreshToken == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing refresh token"})
	}

	tokens, err := h.authSvc.Refresh(refreshToken, string(c.Request().Header.UserAgent()), c.IP())
	if errors.Is(err, service.ErrInvalidToken) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid or expired refresh token"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "token refresh failed"})
	}
	return respondWithTokens(c, tokens)
}

// ---- Forgot / Reset Password ----

func (h *AuthHandler) ForgotPassword(c fiber.Ctx) error {
	var req struct {
		Email string `json:"email"`
	}
	if err := c.Bind().JSON(&req); err != nil || req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "email is required"})
	}
	h.authSvc.ForgotPassword(req.Email) //nolint:errcheck — swallowed to prevent enumeration
	return c.JSON(fiber.Map{"message": "if the email exists, a password reset link has been sent"})
}

func (h *AuthHandler) ResetPassword(c fiber.Ctx) error {
	var req struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := c.Bind().JSON(&req); err != nil || req.Token == "" || req.NewPassword == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "token and new_password are required"})
	}

	if err := h.authSvc.ResetPassword(req.Token, req.NewPassword); errors.Is(err, service.ErrInvalidToken) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid or expired token"})
	} else if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "password reset failed"})
	}
	return c.JSON(fiber.Map{"message": "password reset successfully"})
}

// ---- Google OAuth ----

func (h *AuthHandler) GoogleOAuth(c fiber.Ctx) error {
	state, err := generateOAuthState()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to initiate OAuth"})
	}
	c.Cookie(&fiber.Cookie{
		Name:     "oauth_state",
		Value:    state,
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Lax",
		Expires:  time.Now().Add(10 * time.Minute),
	})
	return c.Redirect().To(h.authSvc.GoogleOAuthURL(state))
}

func (h *AuthHandler) GoogleOAuthCallback(c fiber.Ctx) error {
	state := c.Query("state")
	storedState := c.Cookies("oauth_state")
	if state == "" || state != storedState {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid OAuth state"})
	}

	code := c.Query("code")
	if code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing authorization code"})
	}

	tokens, err := h.authSvc.GoogleOAuthCallback(c.Context(), code, string(c.Request().Header.UserAgent()), c.IP())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "OAuth authentication failed"})
	}

	redirectURL := fmt.Sprintf(
		"%s/auth/google/callback?access_token=%s&refresh_token=%s&expires_in=%d",
		h.authSvc.FrontendURL(),
		url.QueryEscape(tokens.AccessToken),
		url.QueryEscape(tokens.RefreshToken),
		tokens.ExpiresIn,
	)
	return c.Redirect().To(redirectURL)
}

// ---- 2FA ----

func (h *AuthHandler) TOTPSetup(c fiber.Ctx) error {
	userID, ok := h.userID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	result, err := h.authSvc.SetupTOTP(userID)
	if errors.Is(err, service.ErrTOTPAlreadyEnabled) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "2FA is already enabled"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to setup 2FA"})
	}

	return c.JSON(fiber.Map{
		"secret":  result.Secret,
		"otp_url": result.OTPURL,
	})
}

func (h *AuthHandler) TOTPEnable(c fiber.Ctx) error {
	userID, ok := h.userID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req struct {
		Secret   string `json:"secret"`
		TOTPCode string `json:"totp_code"`
	}
	if err := c.Bind().JSON(&req); err != nil || req.Secret == "" || req.TOTPCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "secret and totp_code are required"})
	}

	backupCodes, err := h.authSvc.EnableTOTP(userID, req.Secret, req.TOTPCode)
	if errors.Is(err, service.ErrTOTPAlreadyEnabled) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "2FA is already enabled"})
	}
	if errors.Is(err, service.ErrInvalidTOTP) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid TOTP code"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to enable 2FA"})
	}

	return c.JSON(fiber.Map{
		"message":      "2FA enabled successfully",
		"backup_codes": backupCodes,
	})
}

func (h *AuthHandler) TOTPChallenge(c fiber.Ctx) error {
	var req struct {
		PendingToken string `json:"pending_token"`
		TOTPCode     string `json:"totp_code"`
	}
	if err := c.Bind().JSON(&req); err != nil || req.PendingToken == "" || req.TOTPCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "pending_token and totp_code are required"})
	}

	tokens, err := h.authSvc.ChallengeTOTP(req.PendingToken, req.TOTPCode, string(c.Request().Header.UserAgent()), c.IP())
	if errors.Is(err, service.ErrInvalidToken) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid or expired pending token"})
	}
	if errors.Is(err, service.ErrInvalidTOTP) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid 2FA code"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "2FA challenge failed"})
	}
	return respondWithTokens(c, tokens)
}

func (h *AuthHandler) TOTPDisable(c fiber.Ctx) error {
	userID, ok := h.userID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req struct {
		Password string `json:"password"`
	}
	if err := c.Bind().JSON(&req); err != nil || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "password is required"})
	}

	if err := h.authSvc.DisableTOTP(userID, req.Password); errors.Is(err, service.ErrInvalidCredentials) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid password"})
	} else if errors.Is(err, service.ErrTOTPNotEnabled) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "2FA is not enabled"})
	} else if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to disable 2FA"})
	}
	return c.JSON(fiber.Map{"message": "2FA disabled successfully"})
}

func (h *AuthHandler) TOTPRegenerateBackup(c fiber.Ctx) error {
	userID, ok := h.userID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req struct {
		TOTPCode string `json:"totp_code"`
	}
	if err := c.Bind().JSON(&req); err != nil || req.TOTPCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "totp_code is required"})
	}

	codes, err := h.authSvc.RegenerateTOTPBackup(userID, req.TOTPCode)
	if errors.Is(err, service.ErrInvalidTOTP) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid TOTP code"})
	}
	if errors.Is(err, service.ErrTOTPNotEnabled) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "2FA is not enabled"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to regenerate backup codes"})
	}
	return c.JSON(fiber.Map{"backup_codes": codes})
}

// ---- Sessions ----

func (h *AuthHandler) ListSessions(c fiber.Ctx) error {
	userID, ok := h.userID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	sessions, err := h.authSvc.ListSessions(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch sessions"})
	}
	return c.JSON(fiber.Map{"sessions": sessions})
}

func (h *AuthHandler) RevokeSession(c fiber.Ctx) error {
	userID, ok := h.userID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	targetID, err := uuid.Parse(c.Params("session_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid session_id"})
	}

	if err := h.authSvc.RevokeSession(userID, targetID); errors.Is(err, service.ErrForbidden) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "cannot revoke another user's session"})
	} else if errors.Is(err, service.ErrInvalidToken) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "session not found"})
	} else if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to revoke session"})
	}
	return c.JSON(fiber.Map{"message": "session revoked"})
}

func (h *AuthHandler) RevokeAllSessions(c fiber.Ctx) error {
	userID, ok := h.userID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	sessionID, _ := h.sessionID(c)
	if err := h.authSvc.RevokeAllSessions(userID, sessionID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to revoke sessions"})
	}
	return c.JSON(fiber.Map{"message": "all other sessions revoked"})
}

// ---- Profile (me) ----

func (h *AuthHandler) GetMe(c fiber.Ctx) error {
	userID, ok := h.userID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	user, err := h.authSvc.GetProfile(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch profile"})
	}
	return c.JSON(user)
}

func (h *AuthHandler) UpdateMe(c fiber.Ctx) error {
	userID, ok := h.userID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req struct {
		Name      string `json:"name"`
		Phone     string `json:"phone"`
		Timezone  string `json:"timezone"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	user, err := h.authSvc.UpdateProfile(userID, service.ProfileUpdateInput{
		Name:      req.Name,
		Phone:     req.Phone,
		Timezone:  req.Timezone,
		AvatarURL: req.AvatarURL,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update profile"})
	}
	return c.JSON(user)
}
