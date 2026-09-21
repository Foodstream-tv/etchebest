package notify

import (
	"crypto/tls"
	"fmt"
	"log"
	"mime"
	"net/smtp"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Notifier interface {
	SendVerificationEmail(toEmail, code string) error
	SendPasswordResetEmail(toEmail, resetLink string) error
	SendLiveScheduledEmail(toEmail, hostName, title string, scheduledAt time.Time, liveUrl string) error
	SendReservationConfirmationEmail(toEmail, userName, title string, scheduledAt time.Time, liveUrl string) error
}

type DefaultNotifier struct{}

func NewNotifier() Notifier {
	return &DefaultNotifier{}
}

// SendVerificationEmail sends a 6-digit OTP code to the given email address.
func (n *DefaultNotifier) SendVerificationEmail(toEmail, code string) error {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPortStr := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASSWORD")

	if smtpHost == "" || smtpPortStr == "" || smtpUser == "" || smtpPass == "" {
		log.Printf("\n=======================================================\n"+
			"[SIMULATION] EMAIL NOT SENT - SMTP IS NOT CONFIGURED!\n"+
			"To:   %s\n"+
			"Code: %s\n"+
			"To send real emails, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in .env\n"+
			"=======================================================\n", toEmail, code)
		return nil
	}

	subject := fmt.Sprintf("FoodStream - Code de vérification : %s", code)
	body := fmt.Sprintf(
		"Bonjour,\r\n\r\n"+
			"Voici votre code de vérification FoodStream : %s\r\n\r\n"+
			"Ce code est valable pendant 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\r\n\r\n"+
			"L'équipe FoodStream", code)

	return sendEmail(toEmail, subject, body, "Verification email")
}

// SendPasswordResetEmail sends a password reset link to the given email address.
func (n *DefaultNotifier) SendPasswordResetEmail(toEmail, resetLink string) error {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPortStr := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASSWORD")

	if smtpHost == "" || smtpPortStr == "" || smtpUser == "" || smtpPass == "" {
		log.Printf("\n=======================================================\n"+
			"[SIMULATION] EMAIL NOT SENT - SMTP IS NOT CONFIGURED!\n"+
			"To:   %s\n"+
			"Link: %s\n"+
			"To send real emails, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in .env\n"+
			"=======================================================\n", toEmail, resetLink)
		return nil
	}

	subject := "FoodStream - Réinitialisation de votre mot de passe"
	body := fmt.Sprintf(
		"Bonjour,\r\n\r\n"+
			"Vous avez demandé la réinitialisation de votre mot de passe FoodStream.\r\n\r\n"+
			"Pour choisir un nouveau mot de passe, cliquez sur le lien ci-dessous (valable 30 minutes) :\r\n"+
			"%s\r\n\r\n"+
			"Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.\r\n\r\n"+
			"L'équipe FoodStream", resetLink)

	return sendEmail(toEmail, subject, body, "Password reset email")
}

// SendLiveScheduledEmail sends a confirmation email to the host when they schedule a live stream.
func (n *DefaultNotifier) SendLiveScheduledEmail(toEmail, hostName, title string, scheduledAt time.Time, liveUrl string) error {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPortStr := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASSWORD")

	formattedDate := scheduledAt.Format("02/01/2006 à 15h04 (UTC)")
	startTime := scheduledAt.UTC().Format("20060102T150405Z")
	endTime := scheduledAt.Add(1 * time.Hour).UTC().Format("20060102T150405Z")
	gcalLink := fmt.Sprintf(
		"https://calendar.google.com/calendar/render?action=TEMPLATE&text=%s&dates=%s/%s&details=%s&location=%s",
		url.QueryEscape("FoodStream Live : "+title),
		startTime,
		endTime,
		url.QueryEscape("Votre live culinaire sur FoodStream : "+liveUrl),
		url.QueryEscape(liveUrl),
	)

	if smtpHost == "" || smtpPortStr == "" || smtpUser == "" || smtpPass == "" {
		log.Printf("\n=======================================================\n"+
			"[SIMULATION] LIVE SCHEDULED CONFIRMATION EMAIL\n"+
			"To:          %s\n"+
			"Title:       %s\n"+
			"ScheduledAt: %s\n"+
			"LiveURL:     %s\n"+
			"GCal:        %s\n"+
			"=======================================================\n", toEmail, title, formattedDate, liveUrl, gcalLink)
		return nil
	}

	greeting := "Bonjour"
	if hostName != "" {
		greeting = fmt.Sprintf("Bonjour %s", hostName)
	}

	cleanTitle := strings.ReplaceAll(strings.ReplaceAll(title, "\r", ""), "\n", " ")
	subject := fmt.Sprintf("FoodStream - Votre live « %s » est programmé !", cleanTitle)
	body := fmt.Sprintf(
		"%s,\r\n\r\n"+
			"Votre session en direct « %s » est bien programmée sur FoodStream.\r\n\r\n"+
			"📅 Date et heure : %s\r\n"+
			"🔗 Lien de votre live : %s\r\n\r\n"+
			"Ajouter cet horaire à votre agenda Google :\r\n%s\r\n\r\n"+
			"Pensez à vous connecter quelques minutes avant l'heure prévue pour préparer votre recette et accueillir votre communauté !\r\n\r\n"+
			"L'équipe FoodStream",
		greeting, cleanTitle, formattedDate, liveUrl, gcalLink)

	return sendEmail(toEmail, subject, body, "Live scheduled confirmation email")
}

// SendReservationConfirmationEmail sends a confirmation email to a viewer who reserved a spot in a scheduled live.
func (n *DefaultNotifier) SendReservationConfirmationEmail(toEmail, userName, title string, scheduledAt time.Time, liveUrl string) error {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPortStr := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASSWORD")

	formattedDate := scheduledAt.Format("02/01/2006 à 15h04 (UTC)")
	startTime := scheduledAt.UTC().Format("20060102T150405Z")
	endTime := scheduledAt.Add(1 * time.Hour).UTC().Format("20060102T150405Z")
	gcalLink := fmt.Sprintf(
		"https://calendar.google.com/calendar/render?action=TEMPLATE&text=%s&dates=%s/%s&details=%s&location=%s",
		url.QueryEscape("FoodStream Live : "+title),
		startTime,
		endTime,
		url.QueryEscape("Votre session culinaire réservée sur FoodStream : "+liveUrl),
		url.QueryEscape(liveUrl),
	)

	if smtpHost == "" || smtpPortStr == "" || smtpUser == "" || smtpPass == "" {
		log.Printf("\n=======================================================\n"+
			"[SIMULATION] LIVE RESERVATION CONFIRMATION EMAIL\n"+
			"To:          %s\n"+
			"Title:       %s\n"+
			"ScheduledAt: %s\n"+
			"LiveURL:     %s\n"+
			"GCal:        %s\n"+
			"=======================================================\n", toEmail, title, formattedDate, liveUrl, gcalLink)
		return nil
	}

	greeting := "Bonjour"
	if userName != "" {
		greeting = fmt.Sprintf("Bonjour %s", userName)
	}

	cleanTitle := strings.ReplaceAll(strings.ReplaceAll(title, "\r", ""), "\n", " ")
	subject := fmt.Sprintf("FoodStream - Votre place est réservée pour « %s »", cleanTitle)
	body := fmt.Sprintf(
		"%s,\r\n\r\n"+
			"Votre place pour le live « %s » a été réservée avec succès sur FoodStream ! 🎉\r\n\r\n"+
			"📅 Date et heure : %s\r\n"+
			"🔗 Accéder au direct : %s\r\n\r\n"+
			"Ajouter cet horaire à votre agenda Google :\r\n%s\r\n\r\n"+
			"Rendez-vous à l'heure prévue pour suivre la session et cuisiner avec le chef !\r\n\r\n"+
			"L'équipe FoodStream",
		greeting, cleanTitle, formattedDate, liveUrl, gcalLink)

	return sendEmail(toEmail, subject, body, "Live reservation confirmation email")
}

func sendEmail(toEmail, subject, body, desc string) error {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPortStr := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASSWORD")
	smtpFrom := os.Getenv("SMTP_FROM")

	if smtpFrom == "" {
		smtpFrom = smtpUser
	}

	smtpPort, err := strconv.Atoi(smtpPortStr)
	if err != nil {
		smtpPort = 587
	}

	cleanFrom := strings.ReplaceAll(strings.ReplaceAll(smtpFrom, "\r", ""), "\n", "")
	cleanTo := strings.ReplaceAll(strings.ReplaceAll(toEmail, "\r", ""), "\n", "")
	cleanSubject := strings.ReplaceAll(strings.ReplaceAll(subject, "\r", ""), "\n", " ")
	encodedSubject := mime.QEncoding.Encode("UTF-8", cleanSubject)

	domain := "foodstream.tv"
	if parts := strings.Split(cleanFrom, "@"); len(parts) == 2 {
		domain = parts[1]
	}
	messageID := fmt.Sprintf("<%s@%s>", uuid.New().String(), domain)
	dateStr := time.Now().Format(time.RFC1123Z)

	msg := fmt.Sprintf("From: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"Date: %s\r\n"+
		"Message-ID: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/plain; charset=UTF-8\r\n\r\n"+
		"%s", cleanFrom, cleanTo, encodedSubject, dateStr, messageID, body)

	addr := fmt.Sprintf("%s:%d", smtpHost, smtpPort)

	// Support port 465 (SMTPS / SSL direct) and 587 (STARTTLS)
	if smtpPort == 465 {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: false,
			ServerName:         smtpHost,
		}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("failed to dial SMTP over TLS: %w", err)
		}
		client, err := smtp.NewClient(conn, smtpHost)
		if err != nil {
			return fmt.Errorf("failed to create SMTP client: %w", err)
		}
		defer client.Close()

		auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
		if err = client.Auth(auth); err != nil {
			return fmt.Errorf("SMTP auth failed: %w", err)
		}
		if err = client.Mail(smtpFrom); err != nil {
			return fmt.Errorf("SMTP mail from failed: %w", err)
		}
		if err = client.Rcpt(toEmail); err != nil {
			return fmt.Errorf("SMTP rcpt to failed: %w", err)
		}
		w, err := client.Data()
		if err != nil {
			return fmt.Errorf("SMTP data failed: %w", err)
		}
		_, err = w.Write([]byte(msg))
		if err != nil {
			return fmt.Errorf("SMTP write body failed: %w", err)
		}
		err = w.Close()
		if err != nil {
			return fmt.Errorf("SMTP close data failed: %w", err)
		}
		return client.Quit()
	}

	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
	if err := smtp.SendMail(addr, auth, smtpFrom, []string{toEmail}, []byte(msg)); err != nil {
		log.Printf("[NOTIFY ERROR] %s failed via SMTP (%s) to %s: %v", desc, addr, toEmail, err)
		return fmt.Errorf("failed to send email via SMTP: %w", err)
	}

	log.Printf("[NOTIFY SUCCESS] %s sent to %s via %s (from: %s)", desc, MaskEmail(toEmail), addr, smtpFrom)
	return nil
}

// MaskEmail masks an email address for privacy, e.g. j***e@domain.com
func MaskEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return "***"
	}
	name := parts[0]
	domain := parts[1]
	if len(name) <= 2 {
		return name[:1] + "***@" + domain
	}
	return string(name[0]) + "***" + string(name[len(name)-1]) + "@" + domain
}
