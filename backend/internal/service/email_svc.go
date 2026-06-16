package service

import (
	"evalora/config"
	"fmt"
	"log"

	"github.com/resend/resend-go/v2"
)

type EmailService interface {
	SendVerificationEmail(to, name, token string) error
	SendPasswordResetEmail(to, name, token string) error
}

type emailService struct {
	client      *resend.Client
	fromEmail   string
	frontendURL string
}

func NewEmailService(cfg *config.Config) EmailService {
	return &emailService{
		client:      resend.NewClient(cfg.ResendAPIKey),
		fromEmail:   cfg.ResendFromEmail,
		frontendURL: cfg.AppFrontendURL,
	}
}

func (s *emailService) SendVerificationEmail(to, name, token string) error {
	verifyURL := fmt.Sprintf("%s/auth/verify-email?token=%s", s.frontendURL, token)
	html := verificationEmailHTML(name, verifyURL)

	resp, err := s.client.Emails.Send(&resend.SendEmailRequest{
		From:    fmt.Sprintf("Evalora <%s>", s.fromEmail),
		To:      []string{to},
		Subject: "Verify your Evalora account",
		Html:    html,
	})
	if err != nil {
		log.Printf("[EMAIL] SendVerificationEmail failed to=%s err=%v", to, err)
		return err
	}
	log.Printf("[EMAIL] SendVerificationEmail sent to=%s id=%s", to, resp.Id)
	return nil
}

func (s *emailService) SendPasswordResetEmail(to, name, token string) error {
	resetURL := fmt.Sprintf("%s/auth/reset-password?token=%s", s.frontendURL, token)
	html := passwordResetEmailHTML(name, resetURL)

	resp, err := s.client.Emails.Send(&resend.SendEmailRequest{
		From:    fmt.Sprintf("Evalora <%s>", s.fromEmail),
		To:      []string{to},
		Subject: "Reset your Evalora password",
		Html:    html,
	})
	if err != nil {
		log.Printf("[EMAIL] SendPasswordResetEmail failed to=%s err=%v", to, err)
		return err
	}
	log.Printf("[EMAIL] SendPasswordResetEmail sent to=%s id=%s", to, resp.Id)
	return nil
}

func verificationEmailHTML(name, verifyURL string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#1a1a2e;padding:32px 40px;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Evalora</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;">Verify your email address</h2>
          <p style="margin:0 0 8px;color:#6b7280;font-size:15px;">Hi %s,</p>
          <p style="margin:0 0 32px;color:#6b7280;font-size:15px;line-height:1.6;">
            Thanks for signing up for Evalora. Click the button below to verify your email address. This link expires in 24 hours.
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="%s" style="display:inline-block;background:#1a1a2e;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:15px;font-weight:600;">Verify Email</a>
          </td></tr></table>
          <p style="margin:32px 0 0;color:#9ca3af;font-size:13px;">
            If you didn't create an account, you can safely ignore this email.<br>
            Or copy this link: <a href="%s" style="color:#6366f1;">%s</a>
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© 2026 Evalora. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, name, verifyURL, verifyURL, verifyURL)
}

func passwordResetEmailHTML(name, resetURL string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#1a1a2e;padding:32px 40px;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Evalora</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;">Reset your password</h2>
          <p style="margin:0 0 8px;color:#6b7280;font-size:15px;">Hi %s,</p>
          <p style="margin:0 0 32px;color:#6b7280;font-size:15px;line-height:1.6;">
            We received a request to reset your Evalora password. Click the button below to choose a new password. This link expires in 1 hour.
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="%s" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:15px;font-weight:600;">Reset Password</a>
          </td></tr></table>
          <p style="margin:32px 0 0;color:#9ca3af;font-size:13px;">
            If you didn't request a password reset, please ignore this email. Your password will not change.<br>
            Or copy this link: <a href="%s" style="color:#6366f1;">%s</a>
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© 2026 Evalora. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, name, resetURL, resetURL, resetURL)
}
