# Product Requirements Document
## SaaS Exam & Assessment Platform

**Version:** 1.0.0  
**Status:** 🔒 LOCKED BLUEPRINT  
**Stack:** Go + Fiber · Next.js 15 · PostgreSQL 16  
**Architecture:** Modular Monolith  
**Date:** June 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Target Users & Personas](#2-target-users--personas)
3. [Success Metrics](#3-success-metrics)
4. [Platform Architecture Overview](#4-platform-architecture-overview)
5. [Feature Specifications](#5-feature-specifications)
   - [AUTH — Authentication & Accounts](#module-auth--authentication--accounts)
   - [ORG — Organization Management](#module-org--organization-management)
   - [BANK — Question Bank](#module-bank--question-bank)
   - [BUILD — Exam Builder](#module-build--exam-builder)
   - [MGMT — Exam Management](#module-mgmt--exam-management)
   - [PROC — Proctoring](#module-proc--proctoring)
   - [ENGINE — Exam Engine](#module-engine--exam-engine)
   - [SCORE — Scoring](#module-score--scoring)
   - [RESULTS — Results & Analytics](#module-results--results--analytics)
   - [SIM — Simulation (B2C)](#module-sim--simulation-b2c)
   - [BILL — Billing & Subscriptions](#module-bill--billing--subscriptions)
   - [NOTIF — Notifications](#module-notif--notifications)
   - [CERT — Certificates](#module-cert--certificates)
   - [ADMIN — Platform Administration](#module-admin--platform-administration)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [API Design Conventions](#7-api-design-conventions)
8. [Core Data Models](#8-core-data-models)
9. [Release Plan](#9-release-plan)

---

## 1. Executive Summary

### Vision
Build the most trusted online exam and assessment platform in Southeast Asia — serving organizations that need to assess people, and individuals who need to prepare for high-stakes exams.

### Problem Statement

**For Organizations (B2B):** Assessments are still manual, expensive, and fraud-prone. Paper tests require physical logistics. Third-party vendors are rigid and costly. HR teams spend weeks on what should take hours.

**For Individuals (B2C):** Millions of candidates preparing for CPNS, TOEFL, psychology tests, and other standardized exams rely on scattered PDFs, Telegram groups, and fragmented apps with no real simulation conditions and no actionable feedback.

### Solution
A dual-product SaaS platform:

- **Exam Platform (B2B):** Organizations create question banks, build exam packages, schedule and proctor exams, and receive instant auto-scored analytics.
- **Exam Simulation (B2C):** Individuals browse a curated catalog, practice at their own pace, and track score improvement over time.

### v1.0 Scope Boundaries
- ✅ B2B exam platform
- ✅ B2C exam simulation
- ❌ Content marketplace (v2.0)
- ❌ Mobile native app (v2.0)
- ❌ AI adaptive testing (v2.0)
- ❌ API access for enterprise (v2.0)

---

## 2. Target Users & Personas

### B2B Personas

**Rina — HR Manager**
Age 32, 500-person company. Runs 3–4 recruitment cycles per year with 200–500 applicants each. Currently sends psychometric tests via email PDF and manually compiles results over 2 weeks. Wants: fast candidate screening with objective, tamper-proof results and instant ranked output.

**Budi — Exam Administrator**
Age 28, university testing center. Manages mid-semester and final exams for 1,000+ students. Wants: bulk participant scheduling, proctoring controls, and automated transcript generation without technical support overhead.

**Dini — Training Coordinator**
Age 35, corporate L&D. Runs post-training knowledge assessments. Wants: question-level analytics to see which training content isn't landing, so she can improve programs.

### B2C Persona

**Rizky — CPNS Aspirant**
Age 24, fresh graduate competing for civil servant position against 100,000+ applicants. Currently studying from offline books. Wants: a real timed simulation that mirrors the actual exam, explanations for every wrong answer, and a score he can track week by week.

---

## 3. Success Metrics

### North Star
**Exams Completed** — total exam sessions finished across B2B and B2C per month.

### B2B Targets

| Metric | Month 3 | Month 6 |
|--------|---------|---------|
| Paying orgs | 10 | 50 |
| MRR | $1,000 | $5,000 |
| Avg sessions / org / month | 50 | 100 |
| Monthly churn | < 10% | < 7% |
| Trial → Paid conversion | > 20% | > 25% |

### B2C Targets

| Metric | Month 3 | Month 6 |
|--------|---------|---------|
| Registered users | 1,000 | 10,000 |
| Free → Paid conversion | > 5% | > 8% |
| Premium subscribers | 50 | 800 |
| Avg simulations / user / month | 3 | 5 |

### Technical SLAs

| SLA | Target |
|-----|--------|
| Exam session uptime | 99.9% during scheduled window |
| Answer autosave latency | < 500ms |
| Dashboard page load (P75) | < 2s |
| WebSocket reconnect | < 3s |
| Max concurrent users (launch) | 500 |

---

## 4. Platform Architecture Overview

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22 + Fiber (modular monolith) |
| Frontend | Next.js 15 (App Router — RSC + CSR mixed) |
| Database | PostgreSQL 16 (primary + read replica + PgBouncer) |
| Cache + Queue | Redis 7 (Asynq jobs + pub/sub fanout) |
| Object Storage | S3-compatible (media, recordings) |
| Real-time | Native Go WebSocket + Redis pub/sub |
| Proctoring Camera | LiveKit OSS (WebRTC SFU) |
| Payments | Stripe + Midtrans/Xendit |
| Email | Resend (transactional) |
| Observability | Sentry + OpenTelemetry → Grafana |

### Rendering Strategy per Surface

| Surface | Mode | Reason |
|---------|------|--------|
| Landing / marketing | SSG | Static, CDN-served |
| Simulation catalog | ISR | SEO + periodic freshness |
| Auth pages | SSR | Server-side session redirect |
| B2B dashboards | RSC | Auth-protected, server fetch, no client bundle |
| Question bank editor | CSR | Rich interactive editor |
| **Exam canvas** | **CSR (strict)** | **WebSocket, IndexedDB, camera — SSR breaks all** |
| Admin live monitoring | CSR | WebSocket real-time |
| Results & reports | SSR | Auth-protected, dynamic per-user |

---

## 5. Feature Specifications

> **Priority Legend**
> - **P0** — Must ship at v1.0 launch
> - **P1** — Ship within 3 months of launch
> - **P2** — Roadmap (v2.0, 6+ months)

> **Effort Legend**
> - **XS** 1–2 days · **S** 3–5 days · **M** 1–2 weeks · **L** 2–4 weeks · **XL** 1+ month

---

### MODULE: AUTH — Authentication & Accounts

---

#### AUTH-001 · Email Registration & Login
**Priority:** P0 | **Product:** Both | **Effort:** S

Users register with email, display name, and password. Email verification required before accessing protected features.

**Acceptance Criteria**
- [ ] Registration fields: email, full name, password, confirm password
- [ ] Password rules: min 8 chars, 1 uppercase, 1 number
- [ ] Verification email sent within 30 seconds of registration
- [ ] Verification link expires after 24 hours; resend option available
- [ ] Unverified accounts blocked from protected routes
- [ ] Duplicate email shows clear, non-enumerable error
- [ ] Login: email + password; failed attempts rate-limited (5/10min per IP)

**Technical Notes**
- Password: bcrypt hash, cost factor 12
- Verification token: crypto/rand 32-byte hex, stored in DB with expiry
- Session: JWT issued on login, stored as httpOnly cookie, 7-day expiry

---

#### AUTH-002 · Google OAuth Login
**Priority:** P0 | **Product:** Both | **Effort:** S

One-click sign-in with Google. Auto-creates user on first OAuth login.

**Acceptance Criteria**
- [ ] "Continue with Google" on login and register pages
- [ ] Google OAuth 2.0 PKCE flow
- [ ] First sign-in: creates account, skips email verification
- [ ] Subsequent sign-in: logs into existing account
- [ ] If email already exists as password account: prompt to link accounts or log in with password
- [ ] Profile photo from Google pre-filled (user can override)

---

#### AUTH-003 · Password Reset
**Priority:** P0 | **Product:** Both | **Effort:** XS

**Acceptance Criteria**
- [ ] "Forgot password" link on login page
- [ ] Success message shown regardless of email existence (prevents enumeration)
- [ ] Reset link sent if email found; expires 1 hour, single-use
- [ ] All active sessions invalidated after password reset
- [ ] New password must meet strength requirements

---

#### AUTH-004 · User Profile Management
**Priority:** P0 | **Product:** Both | **Effort:** XS

**Acceptance Criteria**
- [ ] Editable fields: full name, profile photo, phone number, timezone
- [ ] Photo upload: max 2MB, auto-resized to 256×256, stored in S3
- [ ] Phone number used for WhatsApp notifications (optional)
- [ ] Timezone applied to all exam datetime displays for this user
- [ ] Email change requires re-verification (separate support flow)

---

#### AUTH-005 · Two-Factor Authentication (TOTP)
**Priority:** P1 | **Product:** B2B | **Effort:** S

TOTP via authenticator app (Google Authenticator, Authy). Recommended for org Owners and Admins.

**Acceptance Criteria**
- [ ] Setup: display QR code + 8 backup codes (shown once, downloadable)
- [ ] TOTP challenge on login after password
- [ ] "Remember this device for 30 days" option (secure cookie)
- [ ] Recovery via backup code; backup codes regenerable (invalidates old set)
- [ ] Org owner can mandate 2FA for all members in org security settings

---

### MODULE: ORG — Organization Management

---

#### ORG-001 · Organization Setup Wizard
**Priority:** P0 | **Product:** B2B | **Effort:** M

First-run 3-step wizard after B2B registration.

**Steps:** (1) Basic info → (2) Invite team (optional) → (3) Start free trial

**Acceptance Criteria**
- [ ] Shown once on first B2B login; skippable after step 1
- [ ] Step 1: org name (2–100 chars), logo upload, industry dropdown, country
- [ ] Slug auto-generated from org name, editable (URL-safe, unique per platform)
- [ ] Logo: PNG/JPG, max 5MB, stored in S3, shown on exam canvas and emails
- [ ] Industry options: Education, Government, Corporate, Healthcare, Consulting, Other
- [ ] Org created immediately; 14-day trial begins on completion

---

#### ORG-002 · Member Invite by Email
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Invite by email with role selection (Admin / Examiner / Viewer)
- [ ] Invite email with join link sent immediately; link expires in 7 days
- [ ] Pending invites listed with resend and cancel options
- [ ] Invitee must register or log in to accept
- [ ] Seat limit per subscription tier enforced at invite; blocked with upgrade prompt
- [ ] Org Owner and Admins can invite; Examiners and Viewers cannot

---

#### ORG-003 · Role-Based Access Control (RBAC)
**Priority:** P0 | **Product:** B2B | **Effort:** M

Four roles with enforced permission matrix.

| Permission | Owner | Admin | Examiner | Viewer |
|------------|-------|-------|----------|--------|
| Manage billing & plan | ✓ | — | — | — |
| Manage members & roles | ✓ | ✓ | — | — |
| Create / edit question bank | ✓ | ✓ | ✓ | — |
| Create / edit exam package | ✓ | ✓ | ✓ | — |
| Schedule & manage exams | ✓ | ✓ | ✓ | — |
| Score essays | ✓ | ✓ | ✓ | — |
| View results & analytics | ✓ | ✓ | ✓ | ✓ |
| Export results | ✓ | ✓ | ✓ | — |
| Org settings | ✓ | ✓ | — | — |

**Acceptance Criteria**
- [ ] All API endpoints enforce role check in Go middleware (server-side, not client)
- [ ] UI hides controls the user's role cannot perform
- [ ] Owner role: exactly one per org; transfer requires explicit handoff
- [ ] Removing last Admin: Owner must assign another Admin first

---

#### ORG-004 · Department / Division Groups
**Priority:** P1 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Create, rename, archive departments (unlimited count)
- [ ] Assign members to one or more departments
- [ ] Assign exam participants to a department at invite time
- [ ] Results and analytics filterable by department

---

#### ORG-005 · Custom Branding
**Priority:** P1 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Upload org logo (displayed on exam canvas header and email templates)
- [ ] Set primary color (HEX); applied to buttons, progress bars on exam canvas
- [ ] Live preview: shows how exam page renders with org branding
- [ ] Available: Growth tier and above

---

#### ORG-006 · Custom Subdomain
**Priority:** P1 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] `{org-slug}.platform.com` auto-provisioned on org creation
- [ ] SSL auto-provisioned via Caddy + Let's Encrypt
- [ ] All exam links from this org default to org subdomain
- [ ] Available: Business tier and above

---

#### ORG-007 · Organization Usage Dashboard
**Priority:** P1 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Current billing period: exams run, total sessions, active seat count vs plan limit
- [ ] Visual progress bar per limit (red at 90%, yellow at 80%)
- [ ] Email + in-app warning at 80% of any plan limit

---

### MODULE: BANK — Question Bank

---

#### BANK-001 · Multiple Choice (Single Answer)
**Priority:** P0 | **Product:** B2B | **Effort:** S

Classic MCQ: one question body, 2–6 options, exactly one correct answer.

**Acceptance Criteria**
- [ ] Question body: rich text editor (see BANK-006)
- [ ] Options: 2–6 configurable; each option supports rich text
- [ ] Exactly one correct answer marked
- [ ] Optional explanation field (BANK-009)
- [ ] Preview renders exactly as exam canvas
- [ ] Limits: 5,000 chars per body, 1,000 chars per option

---

#### BANK-002 · Multiple Answer (Multi-Select)
**Priority:** P0 | **Product:** B2B | **Effort:** S

Multiple options can be correct. Visually distinct (checkbox UI).

**Acceptance Criteria**
- [ ] 2 or more options marked as correct (minimum 2 correct required)
- [ ] Scoring mode per question: **All-or-nothing** (full score only if all correct, none wrong) OR **Partial** (score per correct selection, penalty per incorrect)
- [ ] Partial score formula: `(question_score / correct_count) × correct_selected - penalty × incorrect_selected`; minimum 0

---

#### BANK-003 · Essay / Open-Ended
**Priority:** P0 | **Product:** B2B | **Effort:** M

Free-text answer requiring manual examiner review.

**Acceptance Criteria**
- [ ] Text area input; optional character/word limit (0 = unlimited)
- [ ] Max score defined at creation; examiner assigns 0–max
- [ ] Status in results: "Pending Manual Review" until examiner scores it
- [ ] Results cannot be released while any essay in the exam is unscored
- [ ] Examiner interface: question + participant answer → score input + optional comment

---

#### BANK-004 · True / False
**Priority:** P0 | **Product:** B2B | **Effort:** XS

**Acceptance Criteria**
- [ ] Two options only: True / False (labels customizable: Yes/No, Benar/Salah)
- [ ] Rendered as two large toggle buttons (not radio bullets)
- [ ] Stored internally as MCQ with 2 options; type = `true_false`

---

#### BANK-005 · Fill in the Blank
**Priority:** P1 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] `[blank]` placeholder in question body marks input position
- [ ] Participant sees inline text input within rendered question
- [ ] Correct answers: one or more acceptable answers per blank
- [ ] Match mode per question: exact / case-insensitive / contains
- [ ] Multiple blanks per question supported

---

#### BANK-006 · Rich Text Editor (Tiptap)
**Priority:** P0 | **Product:** B2B | **Effort:** M

Used for question body and option text fields.

**Acceptance Criteria**
- [ ] Inline: bold, italic, underline, strikethrough, inline code, superscript, subscript
- [ ] Block: paragraph, H2, H3, bullet list, numbered list, code block, blockquote, divider
- [ ] Table: insert, add/remove rows and columns, merge cells
- [ ] Math: KaTeX inline (`$...$`) and block (`$$...$$`)
- [ ] Image: upload (stored S3, served CDN), drag-resize, alt text required
- [ ] Paste from Word/Google Docs: clean HTML, strip unsupported styles
- [ ] Character count shown in toolbar

---

#### BANK-007 · Image in Questions & Options
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Accepted: JPG, PNG, WebP, GIF (max 10MB per image)
- [ ] Auto-processed on upload: max 1200px wide, quality 85%, WebP output
- [ ] Stored in S3, served via CDN with pre-signed URL (7-day expiry)
- [ ] Alt text field required for accessibility
- [ ] Images in options rendered above option text

---

#### BANK-008 · Audio in Questions
**Priority:** P1 | **Product:** Both | **Effort:** M

Listening-type questions for TOEFL, language exams.

**Acceptance Criteria**
- [ ] Accepted: MP3, M4A, WAV (max 50MB)
- [ ] Custom HTML5 audio player (no browser default UI)
- [ ] Optional max play count (0 = unlimited)
- [ ] Stored in S3, pre-signed URL; no autoplay; participant initiates

---

#### BANK-009 · Answer Explanation
**Priority:** P0 | **Product:** Both | **Effort:** XS

**Acceptance Criteria**
- [ ] Optional rich text field on every question type
- [ ] B2B: shown to participant if org enables "show explanations" in exam settings
- [ ] B2C practice mode: shown immediately after each answer
- [ ] B2C simulation mode: shown in answer review after submission

---

#### BANK-010 · Question Tags & Topic Labels
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Free-form tags created inline; auto-complete from existing org tags
- [ ] Max 10 tags per question; 50 chars per tag
- [ ] Filterable in question bank list
- [ ] Used in analytics: score breakdown by topic

---

#### BANK-011 · Draft & Publish Workflow
**Priority:** P0 | **Product:** B2B | **Effort:** XS

**Acceptance Criteria**
- [ ] Questions default to Draft on creation
- [ ] Publish: makes question available for package building
- [ ] Published questions used in a package: cannot be deleted (archive only)
- [ ] Archived: hidden from pickers but data preserved; past exams unaffected
- [ ] Unpublish: returns to Draft; removed from future packages

---

#### BANK-012 · Search & Filter Questions
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Full-text search: PostgreSQL `tsvector` on question body
- [ ] Filters: type, tags (multi-select), status, difficulty, created_by
- [ ] Sort: created_at, updated_at, difficulty
- [ ] Pagination: 20 per page
- [ ] Bulk actions on selection: publish, archive, delete (Draft only), export

---

#### BANK-013 · Duplicate Question
**Priority:** P0 | **Product:** B2B | **Effort:** XS

**Acceptance Criteria**
- [ ] Creates identical question; name prefixed "Copy of..."; status = Draft
- [ ] All options, explanation, tags, difficulty copied
- [ ] S3 images referenced (not duplicated)

---

#### BANK-014 · Bulk Import via Excel Template
**Priority:** P1 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] Downloadable `.xlsx` template with column headers and example rows
- [ ] Columns: `type, question_body, option_a–f, correct_answers, explanation, tags, difficulty`
- [ ] Supported types: MCQ, multi_answer, true_false
- [ ] Upload → row-by-row validation report (errors listed with row number)
- [ ] Option A: import only if zero errors. Option B: skip error rows, import valid
- [ ] Max 500 questions per import batch
- [ ] Images: not supported in bulk import; must add individually after

---

#### BANK-015 · Question Difficulty Level
**Priority:** P1 | **Product:** B2B | **Effort:** XS

**Acceptance Criteria**
- [ ] Three levels: Easy / Medium / Hard
- [ ] Set at creation or edit; defaults to unset
- [ ] Shown and filterable in question list
- [ ] Used in analytics: score vs difficulty correlation

---

#### BANK-016 · AI Question Generation
**Priority:** P2 | **Product:** B2B | **Effort:** L

Generate MCQ questions from topic/learning objective prompt via LLM. Questions created as Draft requiring human review before publish. *(v2.0)*

---

### MODULE: BUILD — Exam Builder

---

#### BUILD-001 · Build Package from Question Bank
**Priority:** P0 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] Question picker modal: search and filter published questions from any org bank
- [ ] Questions from multiple banks mixable in one package
- [ ] Package metadata: name, description (shown on exam start screen)
- [ ] Minimum 1 question to save
- [ ] Draft & Publish workflow: draft packages cannot be scheduled

---

#### BUILD-002 · Section Grouping
**Priority:** P0 | **Product:** Both | **Effort:** M

Group questions into named sections (e.g., CPNS: TIU / TWK / TKP).

**Acceptance Criteria**
- [ ] Add, rename, reorder, remove sections
- [ ] Drag-and-drop question reordering within and across sections
- [ ] Each section: name, optional description, optional independent sub-timer
- [ ] Flat package (no sections) is the default; sections are optional
- [ ] Section scores auto-calculated as sum of member questions

---

#### BUILD-003 · Per-Question Score Weight
**Priority:** P0 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] Default weight: 1.0 per question
- [ ] Per-question override: any positive decimal (e.g., 2.5, 0.5)
- [ ] Total max score and section max scores auto-displayed as questions are added

---

#### BUILD-004 · Timer Configuration
**Priority:** P0 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] Mode A: Global timer — single countdown for full exam
- [ ] Mode B: Per-section timers — each section has independent countdown; auto-advances to next section on expire
- [ ] Minimum 1 minute; maximum 600 minutes per timer
- [ ] Exam window end overrides all timers (exam force-submitted if window closes)

---

#### BUILD-005 · Randomize Question Order
**Priority:** P0 | **Product:** B2B | **Effort:** XS

**Acceptance Criteria**
- [ ] Toggle per package; randomization seeded per participant (deterministic replay on retry)
- [ ] Section structure preserved when randomizing within sections

---

#### BUILD-006 · Randomize Answer Choices
**Priority:** P0 | **Product:** B2B | **Effort:** XS

**Acceptance Criteria**
- [ ] Toggle per package; shuffles MCQ/multi-answer options per participant
- [ ] True/False: always True first, False second (no shuffle)
- [ ] "None of the above" / "All of the above" options: always rendered last (flagged via option metadata `always_last: true`)

---

#### BUILD-007 · Passing Score Threshold
**Priority:** P0 | **Product:** Both | **Effort:** XS

**Acceptance Criteria**
- [ ] Set as: absolute score OR percentage of total
- [ ] Optional per-section minimum score (must pass each section for overall pass)
- [ ] Pass/fail badge on result page based on threshold
- [ ] Certificate auto-triggered on pass (if certificate enabled)
- [ ] If threshold = 0: pass/fail not shown

---

#### BUILD-008 · Negative Scoring
**Priority:** P1 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] Toggle per package; deduction rate configurable (e.g., -0.25 × question_score per wrong answer)
- [ ] Unanswered questions: 0 (never deducted)
- [ ] Total score floor: 0 (cannot go negative)
- [ ] Prominently shown in exam instructions before start

---

#### BUILD-009 · Question Pool (Random Draw)
**Priority:** P1 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] Define pool of N questions; system randomly draws K per participant (K ≤ N)
- [ ] Participant receives unique random set; deterministic per participant_id seed
- [ ] Analytics normalized across all pool questions for fair comparison

---

#### BUILD-010 · Custom Exam Instructions
**Priority:** P0 | **Product:** Both | **Effort:** XS

**Acceptance Criteria**
- [ ] Rich text field shown on exam start screen before countdown begins
- [ ] Participant must click "Start Exam" to begin timer; no auto-start
- [ ] Optional PDF attachment upload for supplementary materials

---

#### BUILD-011 · Package Preview (As Participant)
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Preview opens exam canvas in preview mode; no timer, no submission
- [ ] Renders exact media, formatting, section structure
- [ ] Watermark: "PREVIEW — NOT A REAL EXAM"
- [ ] Randomization applies (new seed each preview)

---

#### BUILD-012 · Draft & Publish (Packages)
**Priority:** P0 | **Product:** B2B | **Effort:** XS

**Acceptance Criteria**
- [ ] Draft packages cannot be scheduled
- [ ] Published packages: changes locked if any exam is in progress or completed
- [ ] To edit a published package: must duplicate and create new version
- [ ] Duplicate package: copies all settings and question selections

---

### MODULE: MGMT — Exam Management

---

#### MGMT-001 · Fixed-Window Scheduling
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Fields: exam name, start datetime, end datetime, timezone, duration per attempt
- [ ] Duration ≤ window length enforced
- [ ] Participants must start within window; exam auto-submitted at window end
- [ ] Multiple exam events can use the same package

---

#### MGMT-002 · Flexible Access Window
**Priority:** P0 | **Product:** B2B | **Effort:** S

Participant starts anytime within a date range.

**Acceptance Criteria**
- [ ] Fields: window open date, window close date, attempt duration
- [ ] Cannot start if remaining window time < attempt duration
- [ ] Once started: participant has full duration regardless of window close
- [ ] Useful for: async assessments, multi-timezone participants

---

#### MGMT-003 · Add Participants Individually
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Add by email; name optional
- [ ] If email matches existing user: linked to account
- [ ] If not found: account pre-registered; activated on first invite-link login
- [ ] Remove allowed before exam starts; blocked once participant has started

---

#### MGMT-004 · Bulk Import Participants (CSV)
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] CSV columns: `email` (required), `name` (optional), `department` (optional)
- [ ] Validation: show invalid rows with row number before import
- [ ] Max 5,000 rows per import; duplicate emails deduplicated
- [ ] Import triggers batch invite email send (Asynq queue; not synchronous)

---

#### MGMT-005 · Invite via Shareable Link
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Generate unique link per exam; optional password protection
- [ ] Optional registrant cap (closes link on reach)
- [ ] Deactivatable without affecting already-registered participants
- [ ] Link registrations tracked in participant list (source: link)

---

#### MGMT-006 · Email Invitations (Auto-Send)
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Auto-sent when participant added, or on manual "Send All" trigger
- [ ] Content: exam name, date/time (participant's timezone), duration, exam link, instructions
- [ ] Org branding applied (logo, primary color)
- [ ] Batch send queued via Asynq (not synchronous during large imports)

---

#### MGMT-007 · Access Control
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Invite-only: only listed participants can access
- [ ] Open link: anyone with link can register and take
- [ ] Login required (default) vs. guest mode (email-only, no account)
- [ ] Exam page shows countdown when accessed before window opens

---

#### MGMT-008 · Retake Configuration
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Allow retake: yes / no
- [ ] If yes: max attempts (1–10 or unlimited); cooldown between attempts (0–24h)
- [ ] All attempts stored; analytics shows best or most recent (configurable)
- [ ] Participant informed of remaining attempts before starting

---

#### MGMT-009 · Result Release Control
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Mode A: Immediately — results visible as soon as submitted
- [ ] Mode B: After window closes — all participants finish before results shown
- [ ] Mode C: Scheduled — set datetime; Asynq delayed job publishes at that time
- [ ] Mode D: Manual — admin clicks "Release Results" button
- [ ] Before release: participant sees "Results pending" page with estimated date

---

#### MGMT-010 · Extend Time (Per Participant)
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Admin adds extra minutes to in-progress session from monitoring dashboard
- [ ] Participant's timer updates immediately via WebSocket event
- [ ] Action logged: admin_id, participant_id, minutes_added, timestamp
- [ ] Max single extension: 24 hours (prevents accidental input)

---

#### MGMT-011 · Force Stop Exam
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Admin terminates active session immediately from monitoring dashboard
- [ ] Answers saved to point of stop; session status = `FORCE_STOPPED`
- [ ] Participant sees: "Your exam was ended by the administrator"
- [ ] Action logged; FORCE_STOPPED sessions flagged in analytics

---

#### MGMT-012 · Participant Status Tracker
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Real-time statuses: Not Invited / Invited / Not Started / In Progress / Submitted / Absent / Force Stopped
- [ ] Auto-refresh every 30s via polling (or WebSocket push for live view)
- [ ] Columns: name, email, status, started_at, submitted_at, time_elapsed, progress %
- [ ] Filter by status; export current status as CSV

---

#### MGMT-013 · Batch Scheduling (Cohorts)
**Priority:** P1 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] Create multiple time slots (batches) under one exam
- [ ] Assign participants to specific batch
- [ ] Each batch: independent window, same package
- [ ] Results aggregated across batches for org-level analytics

---

#### MGMT-014 · WhatsApp Exam Invite & Reminder
**Priority:** P1 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] Send invite via WhatsApp Business API (Fonnte or Twilio)
- [ ] Auto-send reminders: 24h before and 1h before window open
- [ ] Phone number from participant profile or set at invite time
- [ ] Failed sends: retried once, then logged; admin notified of failures
- [ ] Participants can opt out; unsubscribe link in message

---

### MODULE: PROC — Proctoring

---

#### PROC-001 · Per-Exam Proctoring Configuration
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Each proctoring rule toggleable independently per exam event (not per package)
- [ ] Rules: Camera monitoring, Tab/window detection, Focus detection, Copy-paste block, Face detection (AI)
- [ ] Violation threshold configurable per rule (e.g., flag after 3 tab switches)
- [ ] Config locked once exam is in progress

---

#### PROC-002 · Camera Monitoring
**Priority:** P0 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] Pre-exam: camera permission prompt + live preview test
- [ ] Camera required = true: participant cannot start if camera denied
- [ ] Periodic snapshots: every 60 seconds (configurable: 30–300s per exam)
- [ ] Snapshots stored in S3 with path: `orgs/{org_id}/sessions/{session_id}/{timestamp}.jpg`
- [ ] Small camera overlay visible to candidate during exam (awareness)
- [ ] Snapshot failures logged; exam continues (non-blocking)
- [ ] Snapshots retained 90 days, then auto-deleted

---

#### PROC-003 · Tab / Window Switch Detection
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Detect: `document.visibilitychange` event (tab switch, window minimize)
- [ ] Log: event type, timestamp, duration away from tab
- [ ] Warning popup shown to participant on return
- [ ] After N violations (configurable threshold): flag in proctoring report, alert on monitoring dashboard

---

#### PROC-004 · Browser Focus Loss Detection
**Priority:** P0 | **Product:** B2B | **Effort:** XS

**Acceptance Criteria**
- [ ] Detect: `window.blur` event (alt-tab, other app focused)
- [ ] Log with timestamp and duration out of focus
- [ ] Combined with tab detection in proctoring event timeline

---

#### PROC-005 · Copy-Paste & Right-Click Block
**Priority:** P0 | **Product:** B2B | **Effort:** XS

**Acceptance Criteria**
- [ ] Block: Ctrl+C, Ctrl+V, right-click context menu in exam content area
- [ ] Block: text selection on question body
- [ ] Block: F12, Ctrl+Shift+I, Ctrl+U (dev tools shortcuts)
- [ ] Each blocked attempt logged as proctoring event
- [ ] Notice shown in exam UI: "Copying is disabled during this exam"

---

#### PROC-006 · Proctoring Event Log Per Session
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Chronological timeline: tab switches, focus loss, copy attempts, face anomalies, snapshots
- [ ] Each event: type, timestamp, severity (info / warning / critical), thumbnail if applicable
- [ ] Filterable by event type and severity
- [ ] Exportable as PDF per participant (see PROC-009)
- [ ] Retained 90 days post-exam

---

#### PROC-007 · Admin Live Monitoring Dashboard
**Priority:** P0 | **Product:** B2B | **Effort:** L

Real-time view of all participants currently in an active exam.

**Acceptance Criteria**
- [ ] Participant card grid: name, status, elapsed time, violation count badge (green / yellow / red)
- [ ] Click card → detail panel: latest camera snapshot + event log
- [ ] Alert banner on new critical violation (red badge threshold crossed)
- [ ] Actions per participant from dashboard: extend time, force stop, view full log
- [ ] Updates via WebSocket push from Go server via Redis pub/sub
- [ ] Performance: supports 500 concurrent participants without UI lag
- [ ] Auto-reconnects WebSocket on drop

---

#### PROC-008 · Face Detection (AI)
**Priority:** P1 | **Product:** B2B | **Effort:** L

**Acceptance Criteria**
- [ ] TensorFlow.js MediaPipe FaceDetector runs client-side (no video leaves browser for detection)
- [ ] Detection frequency: every 5 seconds during exam
- [ ] Anomaly types: no face present, multiple faces in frame
- [ ] On anomaly: client sends event to Go server via WebSocket; server validates and logs
- [ ] Snapshot taken automatically on face anomaly
- [ ] Warning shown to participant; exam not blocked by detection
- [ ] False positive target rate: < 2% (configurable sensitivity)

---

#### PROC-009 · Proctoring Report PDF
**Priority:** P1 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] Per-participant PDF: summary stats, violation timeline, key snapshots
- [ ] Org branding applied
- [ ] Generated async (Asynq job); download link from results page
- [ ] Admin can request all participants' reports as bulk ZIP

---

#### PROC-010 · ID Card Verification
**Priority:** P2 | **Product:** B2B | **Effort:** L

Pre-exam: candidate holds ID to camera; screenshot saved for proctor review. *(v2.0)*

---

### MODULE: ENGINE — Exam Engine

> ⚠️ The exam canvas is a pure Next.js Client Component (`"use client"`). No SSR. WebSocket, IndexedDB, and camera access all require browser environment.

---

#### ENGINE-001 · Exam Canvas UI
**Priority:** P0 | **Product:** Both | **Effort:** L

Core exam-taking interface.

**Acceptance Criteria**
- [ ] Renders: question body (all media types), answer options, navigation panel, timer, connection status, proctoring overlay
- [ ] Responsive: desktop and tablet minimum (mobile: read-only view with message to use desktop)
- [ ] Single-page, no browser navigation during exam (history.pushState blocked)
- [ ] Loading skeleton while initial exam state fetches
- [ ] Graceful error state if load fails with retry option
- [ ] Body font min 16px; readable contrast on all supported browsers
- [ ] Keyboard navigable: Tab between options, Enter to select, keyboard shortcut to flag

---

#### ENGINE-002 · Answer Autosave (Real-Time)
**Priority:** P0 | **Product:** Both | **Effort:** M

**Acceptance Criteria**
- [ ] Answer saved to server within 1 second of selection
- [ ] Debounce 500ms from last change before API call fires
- [ ] Visual indicator per question: syncing (spinner) → saved (checkmark) → error (red dot)
- [ ] API: `PUT /api/v1/sessions/{id}/answers/{question_id}` — idempotent upsert
- [ ] Save response includes `server_timestamp` for vector clock sync

---

#### ENGINE-003 · Offline Answer Buffer (IndexedDB)
**Priority:** P0 | **Product:** Both | **Effort:** M

**Acceptance Criteria**
- [ ] On answer select: write to IndexedDB immediately, then enqueue API call
- [ ] On API success: remove entry from IndexedDB queue
- [ ] On reconnect: flush IndexedDB queue in a single batch sync request
- [ ] Sync uses `last_updated_at` vector clock to prevent stale overwrites
- [ ] On successful exam submission: clear all IndexedDB data for this session
- [ ] Max IndexedDB age: 7 days (auto-purge old sessions)

---

#### ENGINE-004 · Connection Status Indicator
**Priority:** P0 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] Persistent badge: 🟢 Connected / 🟡 Reconnecting / 🔴 Offline
- [ ] Offline banner: "You're offline. Answers saved locally and will sync when reconnected."
- [ ] WebSocket reconnect: exponential backoff (1s → 2s → 4s → 8s → max 30s)
- [ ] On reconnect: trigger IndexedDB flush + re-fetch timer sync from server

---

#### ENGINE-005 · Question Navigation Panel
**Priority:** P0 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] Grid of question numbers with color coding: unanswered (gray) / answered (green) / flagged (orange) / current (blue ring)
- [ ] Click to jump to question (free navigation mode only)
- [ ] Section dividers when sections exist
- [ ] Collapsible on smaller screens; toggle button always visible

---

#### ENGINE-006 · Flag / Bookmark Question
**Priority:** P0 | **Product:** Both | **Effort:** XS

**Acceptance Criteria**
- [ ] Flag icon on each question; toggle on/off
- [ ] "Filter: Flagged only" option in navigation panel
- [ ] Flagged count shown in submit confirmation dialog
- [ ] Flags stored in IndexedDB (session-local only; not persisted to server)

---

#### ENGINE-007 · Countdown Timer
**Priority:** P0 | **Product:** Both | **Effort:** XS

**Acceptance Criteria**
- [ ] Format: HH:MM:SS; prominent placement (header)
- [ ] Color states: normal (white) → warning at 5:00 (yellow) → critical at 1:00 (red + pulse animation)
- [ ] Timer synced from server on exam start; re-synced every 5 minutes (client clock drift prevention)
- [ ] Per-section timers: show section timer when sections have independent timers

---

#### ENGINE-008 · Auto-Submit on Timer Expire
**Priority:** P0 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] Belt: Asynq delayed job created at exam start with `execute_at = started_at + duration`; submits if not already submitted
- [ ] Suspenders: client-side timer at 0 triggers auto-submit API call
- [ ] Final IndexedDB flush before submission
- [ ] Participant sees: "Time's up! Your answers have been submitted." (non-dismissable)
- [ ] Double-submission safe: `POST /sessions/{id}/submit` is idempotent

---

#### ENGINE-009 · Submit Confirmation Dialog
**Priority:** P0 | **Product:** Both | **Effort:** XS

**Acceptance Criteria**
- [ ] Modal: "X of N questions answered, Y flagged for review"
- [ ] Warning if unanswered questions > 0
- [ ] Two actions: "Submit Exam" (destructive, red) and "Keep Reviewing"
- [ ] Browser back/reload during exam: warns "Leaving will not submit your exam"

---

#### ENGINE-010 · Sequential vs Free Navigation
**Priority:** P0 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] Free: any question accessible at any time; navigation panel clickable
- [ ] Sequential: "Next →" only; no back navigation; navigation panel shows numbers but not clickable
- [ ] Sequential with section free: free within section, locked between sections
- [ ] Mode set in package config; enforced client-side and validated server-side

---

#### ENGINE-011 · Camera Permission & System Check
**Priority:** P0 | **Product:** B2B | **Effort:** S

Pre-exam gate shown before start screen.

**Acceptance Criteria**
- [ ] Step 1 — System check: internet ✓, camera ✓, clock sync ✓
- [ ] Step 2 — Camera preview: live feed shown; candidate confirms it's working
- [ ] Camera denied: error with troubleshooting steps; cannot proceed if camera required
- [ ] Camera optional (PROC config): show permission request but allow skip

---

### MODULE: SCORE — Scoring

---

#### SCORE-001 · Auto-Score MCQ & Multi-Answer
**Priority:** P0 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] MCQ single: correct = full question score; wrong = 0 (or negative if SCORE-006 enabled)
- [ ] Multi-answer all-or-nothing: all correct selected + zero incorrect = full score; else 0
- [ ] Multi-answer partial: `(question_score / correct_count) × correct_selected − penalty × incorrect_selected`; floored at 0
- [ ] Triggered immediately on submission; visible within 5 seconds for pure MCQ exams
- [ ] True/False scored as single MCQ

---

#### SCORE-002 · Weighted Scoring Engine
**Priority:** P0 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] Raw score = `Σ (question_weight × question_earned_score)`
- [ ] Percentage = `raw_score / max_possible_score × 100` (rounded 2 decimal places)
- [ ] Max possible score shown on result page
- [ ] Recalculation triggered if examiner updates essay score

---

#### SCORE-003 · Section-Level Sub-Scores
**Priority:** P0 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] Score computed per section independently
- [ ] Result page: section rows — TIU: 85/100 | TWK: 75/100 | TKP: 126/150
- [ ] Per-section threshold: must meet section minimum to count as overall pass

---

#### SCORE-004 · Pass / Fail Determination
**Priority:** P0 | **Product:** Both | **Effort:** XS

**Acceptance Criteria**
- [ ] `total_score ≥ passing_threshold` → status = PASSED (green badge)
- [ ] `total_score < passing_threshold` → status = FAILED (red badge)
- [ ] If per-section minimums: all sections must pass for overall PASSED
- [ ] Logic runs server-side; client cannot override
- [ ] No threshold set: pass/fail badge not shown

---

#### SCORE-005 · Essay Manual Scoring Interface
**Priority:** P0 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] Examiner queue: list of unscored essays; filterable by exam, question
- [ ] Grading view: question body, participant answer (full height), score input (0–max), comment field
- [ ] "Next Participant" / "Previous" for efficient same-question grading
- [ ] Draft save: partial scores saved but not counted; "Finalize" locks score
- [ ] Multiple examiners: different participants, not same participant's essay
- [ ] Score edit locked after result released (requires admin override + audit log)

---

#### SCORE-006 · Negative Marking
**Priority:** P1 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] Toggle per package; deduction rate: configurable (0.25, 0.33, 0.5 × question score)
- [ ] Unanswered: 0 (never deducted)
- [ ] Section and total scores floored at 0
- [ ] Displayed in exam instructions: "Wrong answers deduct {X} points"
- [ ] Shown in result breakdown: correct +X / wrong -Y / unanswered 0

---

#### SCORE-007 · Rank & Percentile
**Priority:** P1 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] B2B: rank among participants in same exam session (computed after window closes)
- [ ] B2C: percentile among all users who completed same simulation (updated nightly)
- [ ] Result page: "Rank 5 of 48 participants" / "Top 12% of all attempts"
- [ ] Histogram: score distribution with this participant's score highlighted

---

#### SCORE-008 · Scheduled Score Release
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Set `release_at` datetime; Asynq delayed job fires at that time
- [ ] Participant sees "Results available on {date}" before release
- [ ] On release: notification email sent to all participants
- [ ] Admin can release early (cancels pending Asynq job)

---

### MODULE: RESULTS — Results & Analytics

---

#### RESULT-001 · Participant Result Summary Page
**Priority:** P0 | **Product:** Both | **Effort:** M

**Acceptance Criteria**
- [ ] Displays: total score / max score, percentage, pass/fail status, time taken
- [ ] Section breakdown table: section name, score, max, percentage
- [ ] Rank / percentile row (when available)
- [ ] Actions: Review Answers, Download Certificate (if passed + enabled), Download Result PDF
- [ ] Accessible without auth via result share link (if org allows)

---

#### RESULT-002 · Answer Review (Post-Exam)
**Priority:** P0 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] Each question: participant's answer highlighted, correct answer shown, result icon (✓/✗)
- [ ] Explanation shown if set (see BANK-009)
- [ ] Filter: all / correct only / wrong only / unanswered only
- [ ] B2C: always shown after simulation ends
- [ ] B2B: shown based on org's exam setting `show_answers_after_exam`

---

#### RESULT-003 · Org Exam Summary Dashboard
**Priority:** P0 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] KPIs: invited, started, completed, absent, avg score, pass rate
- [ ] Score distribution histogram (10-point buckets)
- [ ] Completion over time: chart of submissions by hour during exam window
- [ ] Per-section avg scores
- [ ] Real-time updates during active exam window

---

#### RESULT-004 · Participant Result List (Table)
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Columns: name, email, dept, score, %, rank, pass/fail, submitted_at, time_taken, attempt #
- [ ] Sortable all columns; filter by pass/fail, department, status
- [ ] Pagination: 50 per page
- [ ] Bulk: export selected to Excel, download certificates for selected

---

#### RESULT-005 · Export Results (Excel .xlsx)
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Sheet 1: participant summary (all columns from RESULT-004)
- [ ] Sheet 2: raw answer matrix (participant × question answer detail)
- [ ] Sheet 3: exam configuration summary
- [ ] Async generation for >500 participants (Asynq job + email link when ready)
- [ ] < 500 participants: synchronous download

---

#### RESULT-006 · Export Individual Result (PDF)
**Priority:** P1 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] PDF: participant info, exam name, date, score summary, section scores, pass/fail badge
- [ ] Org branding applied
- [ ] Bulk export: ZIP of all participant PDFs (Asynq async job)

---

#### RESULT-007 · Question-Level Analytics
**Priority:** P1 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] Per question: difficulty index (% correct), most-chosen wrong answer, avg time on question
- [ ] Sortable: hardest first, most time-consuming first
- [ ] Flag: questions where >70% chose same wrong answer (potential bad question indicator)
- [ ] Export as Excel

---

#### RESULT-008 · Department Comparison
**Priority:** P1 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] Bar chart: avg score per department
- [ ] Table: dept name, participant count, avg score, pass rate
- [ ] Only visible when departments configured and participants assigned to departments

---

### MODULE: SIM — Simulation (B2C)

---

#### SIM-001 · Simulation Catalog with Search
**Priority:** P0 | **Product:** B2C | **Effort:** M

**Acceptance Criteria**
- [ ] Categories: CPNS, Psikotes, TOEFL/IELTS, UKBI, Academic Entrance, Professional Cert
- [ ] Catalog cards: thumbnail, name, category badge, question count, duration, avg user score, total attempts
- [ ] Full-text search across name and description
- [ ] Filters: category, duration, difficulty (Easy/Medium/Hard), free vs paid
- [ ] Sort: Most Popular, Newest, Highest Rated, Most Completed
- [ ] ISR-rendered (Next.js) for SEO — catalog pages indexed by search engines

---

#### SIM-002 · Simulation Detail Page
**Priority:** P0 | **Product:** B2C | **Effort:** S

**Acceptance Criteria**
- [ ] Hero: name, category, free/paid badge, difficulty, estimated time
- [ ] Stats: questions, duration, avg score of all users, total attempts
- [ ] Description: what it covers, who it's for, what real exam it prepares for
- [ ] Section breakdown preview (section names + question counts)
- [ ] Sample: 3 preview questions (non-answerable, read-only)
- [ ] Reviews: star rating + comment (top 5 shown, expandable)
- [ ] CTA: "Start Practice" / "Start Simulation" / "Subscribe to Unlock"
- [ ] Related simulations (same category)

---

#### SIM-003 · Practice Mode
**Priority:** P0 | **Product:** B2C | **Effort:** M

No timer. Explanation shown immediately after each answer.

**Acceptance Criteria**
- [ ] No countdown timer; question-by-question progress bar only
- [ ] After answering: reveal correct answer, show explanation, then "Next →"
- [ ] Free navigation: can go back to review any question
- [ ] Score shown at end; no pass/fail pressure
- [ ] Practice sessions: separate from simulation attempts; not counted in leaderboard
- [ ] Accessible to all users (free tier, no limit)

---

#### SIM-004 · Simulation Mode
**Priority:** P0 | **Product:** B2C | **Effort:** S

Real exam conditions: timed, no feedback during, full result at end.

**Acceptance Criteria**
- [ ] Full countdown timer matching real exam duration
- [ ] No answer feedback during session
- [ ] Auto-submit on timer expire
- [ ] Result page: score, section breakdown, pass/fail estimate vs typical passing scores
- [ ] Answer review available after submission

---

#### SIM-005 · Answer Explanations (Required for B2C)
**Priority:** P0 | **Product:** B2C | **Effort:** S

**Acceptance Criteria**
- [ ] Every question in a B2C simulation MUST have an explanation (enforced at publish)
- [ ] Practice mode: shown immediately after answering
- [ ] Simulation mode: shown in answer review post-submission
- [ ] "Was this explanation helpful?" thumbs up/down feedback per explanation

---

#### SIM-006 · Unlimited Retakes
**Priority:** P0 | **Product:** B2C | **Effort:** XS

**Acceptance Criteria**
- [ ] Premium/Pro subscribers: unlimited retakes on all accessible simulations
- [ ] Free tier: 3 total simulation attempts per calendar month (across all simulations)
- [ ] Each attempt = new session record; all stored for performance history

---

#### SIM-007 · Performance History Chart
**Priority:** P0 | **Product:** B2C | **Effort:** M

**Acceptance Criteria**
- [ ] Per simulation: line chart of scores over all attempts (chronological)
- [ ] Overall dashboard: simulations taken, avg score, practice days this month
- [ ] Trend per simulation: Improving / Stable / Declining (vs last 5 attempts)
- [ ] Activity calendar: heatmap of days with completed sessions

---

#### SIM-008 · Weak Area / Topic Detection
**Priority:** P1 | **Product:** B2C | **Effort:** M

**Acceptance Criteria**
- [ ] Aggregate wrong answers by question tag across all simulation attempts
- [ ] Display: "You score 45% on Vocabulary — 27 points below your overall average"
- [ ] Recommend simulations tagged with weak topics
- [ ] Updated after each completed session

---

#### SIM-009 · Score Percentile vs All Users
**Priority:** P1 | **Product:** B2C | **Effort:** S

**Acceptance Criteria**
- [ ] Compare user's latest score to all users' best scores on same simulation
- [ ] "Your score of 78 places you in the top 28% of all attempts"
- [ ] Score distribution histogram with user score highlighted
- [ ] Updated nightly via scheduled Asynq job

---

#### SIM-010 · Share Score Card
**Priority:** P1 | **Product:** B2C | **Effort:** M

**Acceptance Criteria**
- [ ] OG image card generated server-side: score, simulation name, percentile, date
- [ ] Share options: copy link, download image, WhatsApp, Twitter/X
- [ ] Public URL: `platform.com/results/{session_id}/share` (no auth required to view)
- [ ] Public share page: user's score prominently + "Try this simulation" CTA

---

### MODULE: BILL — Billing & Subscriptions

---

#### BILL-001 · B2B Subscription Tiers
**Priority:** P0 | **Product:** B2B | **Effort:** L

| Plan | Monthly | Annual | Seats/mo | Key Differentiators |
|------|---------|--------|----------|---------------------|
| Starter | $29 | $290 | 100 | Core proctoring, email support |
| Growth | $99 | $990 | 500 | AI face detection, custom branding |
| Business | $299 | $2,990 | Unlimited | Subdomain, priority support |
| Enterprise | Custom | Custom | Unlimited | SLA, SSO, dedicated CSM |

**Acceptance Criteria**
- [ ] Annual billing = 2 months free (displayed as savings in USD)
- [ ] Upgrade: immediate access to new plan features
- [ ] Downgrade: effective next billing cycle
- [ ] Seat overrun: exam creation blocked with in-app upgrade prompt
- [ ] Feature gates: locked features show upgrade prompt, not hard error

---

#### BILL-002 · 14-Day Free Trial (B2B)
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Growth-tier features unlocked; no credit card required at start
- [ ] Trial countdown shown in org header (days remaining)
- [ ] Email reminders: Day 7 and Day 13 to add payment
- [ ] On trial end: org enters read-only mode until payment added
- [ ] One trial per org (blocked by org domain + owner email)

---

#### BILL-003 · B2C Subscription Plans
**Priority:** P0 | **Product:** B2C | **Effort:** M

| Plan | Monthly | Annual | Simulations | Features |
|------|---------|--------|-------------|----------|
| Free | $0 | — | 3/month | Basic catalog, no explanations |
| Premium | $9 | $81 | Unlimited | All simulations, explanations, history |
| Pro | $19 | $171 | Unlimited | + Weak area analysis, priority support |

**Acceptance Criteria**
- [ ] Free tier applied automatically on registration
- [ ] Simulation counter resets on 1st of each month (free tier)
- [ ] Downgrade: effective next billing cycle; history retained
- [ ] Local pricing: IDR equivalents for Indonesian users (Rp 129,000 / Rp 289,000)

---

#### BILL-004 · Stripe Payment Gateway
**Priority:** P0 | **Product:** Both | **Effort:** M

**Acceptance Criteria**
- [ ] Cards: Visa, Mastercard, Amex via Stripe Checkout
- [ ] Stripe Customer Portal for subscription self-management
- [ ] Webhooks handled: `payment_intent.succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`
- [ ] Failed payment: 3 automatic retries over 7 days → account suspended on final failure
- [ ] PCI compliance: no raw card data on platform servers

---

#### BILL-005 · Local Payment (Midtrans or Xendit)
**Priority:** P0 | **Product:** Both | **Effort:** M

**Acceptance Criteria**
- [ ] Methods: GoPay, OVO, DANA, BCA VA, Mandiri VA, BNI VA, Alfamart/Indomaret
- [ ] One-time payments: redirect to hosted payment page; webhook on completion
- [ ] Recurring via tokenized e-wallet (GoPay recurring where supported)
- [ ] IDR currency; prices displayed in IDR when user locale is ID
- [ ] Failed payment handling mirrors Stripe flow

---

#### BILL-006 · Invoice & Receipt PDF
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Auto-generated per payment: invoice number, date, org details, plan, amount, VAT
- [ ] Downloadable from billing history
- [ ] Sent via email on every successful payment
- [ ] Sequential invoice numbers per org: `INV-{ORG_SLUG}-{YEAR}-{SEQ}`

---

#### BILL-007 · Subscription Self-Management
**Priority:** P0 | **Product:** Both | **Effort:** M

**Acceptance Criteria**
- [ ] Billing page: current plan, next billing date, payment method on file, billing history
- [ ] Upgrade / downgrade / cancel self-serve
- [ ] Cancel: remains active until end of paid period; no prorating on cancel
- [ ] Update payment method without re-subscribing
- [ ] Payment history: list of invoices with download links

---

#### BILL-008 · Pay-Per-Simulation Pack
**Priority:** P1 | **Product:** B2C | **Effort:** S

**Acceptance Criteria**
- [ ] Individual simulation packs buyable without subscription
- [ ] Price set per pack in platform admin
- [ ] Lifetime access after purchase (no expiry)
- [ ] Purchased packs in "My Library" tab
- [ ] Refund: within 24 hours, 0 simulation attempts used

---

#### BILL-009 · Promo Code / Voucher
**Priority:** P1 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] Admin creates: code string, discount (% or fixed), max uses, expiry date, applicable to (plan / simulation / all)
- [ ] Applied at checkout with live discount preview
- [ ] Single-use or multi-use configurable
- [ ] Usage count tracked; admin dashboard shows redeemed vs available

---

### MODULE: NOTIF — Notifications

---

#### NOTIF-001 · Email: Exam Invite
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Template:** Org name, exam name, start date/time (participant timezone), duration, exam link, instructions excerpt, org logo.

**Acceptance Criteria**
- [ ] Sent via Resend API with org branding applied
- [ ] Mobile-responsive HTML; plain text fallback
- [ ] Queued via Asynq (never synchronous during bulk import)
- [ ] Rate limited: max 50 emails/second (Resend limits respected)
- [ ] Delivery status tracked; failed sends logged

---

#### NOTIF-002 · Email: Exam Reminder (24h + 1h)
**Priority:** P0 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Two Asynq delayed jobs created per participant per exam: execute_at = window_start - 24h and - 1h
- [ ] Jobs cancelled if participant is removed or exam is cancelled
- [ ] Opt-out link in email (stored as participant preference)

---

#### NOTIF-003 · Email: Results Ready
**Priority:** P0 | **Product:** Both | **Effort:** XS

**Acceptance Criteria**
- [ ] Sent when results are released (any mode from MGMT-009)
- [ ] Content: score, pass/fail, link to results page
- [ ] B2C: sent automatically after every simulation session ends

---

#### NOTIF-004 · In-App Notification Center
**Priority:** P1 | **Product:** Both | **Effort:** M

**Acceptance Criteria**
- [ ] Bell icon in nav with unread count badge (max display: 99+)
- [ ] Notification list: title, description, timestamp, read/unread dot, deep link
- [ ] Mark read on click; "Mark all as read" button
- [ ] Event types: exam scheduled, results released, trial expiring, payment failed, member joined
- [ ] Polling every 30s or WebSocket push (if already connected)
- [ ] Max 100 per user; older archived from view

---

#### NOTIF-005 · WhatsApp: Exam Invite
**Priority:** P1 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] Via WhatsApp Business API (Fonnte as primary, Twilio as backup)
- [ ] Template: `"Hi {name}, you're invited to take {exam} on {date}. Start here: {link}"`
- [ ] Requires opt-in (checkbox at participant invite time)
- [ ] Phone required; defaults to participant profile phone
- [ ] Failed send: retry once after 5 minutes; log failure; admin alerted for bulk failures

---

#### NOTIF-006 · WhatsApp: 1-Hour Reminder
**Priority:** P1 | **Product:** B2B | **Effort:** S

**Acceptance Criteria**
- [ ] Asynq delayed job per participant; cancelled if participant removed or exam cancelled
- [ ] Template: `"Reminder: {exam} starts in 1 hour. Click to join: {link}"`

---

### MODULE: CERT — Certificates

---

#### CERT-001 · Auto-Generate Certificate PDF
**Priority:** P1 | **Product:** Both | **Effort:** M

**Acceptance Criteria**
- [ ] Trigger: exam submitted AND score ≥ passing threshold AND certificate enabled on exam
- [ ] Content: participant name, exam/simulation name, score, date, org name, unique cert ID (UUID)
- [ ] Default template: platform-branded (B2C); org-branded if CERT-002 configured (B2B)
- [ ] Generated by Asynq job within 60 seconds of scoring completion
- [ ] Downloadable from result page; also emailed to participant
- [ ] Format: PDF/A

---

#### CERT-002 · Custom Certificate Template (Per Org)
**Priority:** P1 | **Product:** B2B | **Effort:** M

**Acceptance Criteria**
- [ ] Org uploads background image: A4 landscape (2480×1754px min, PNG/JPG)
- [ ] Placeholder tags: `{participant_name}`, `{exam_name}`, `{score}`, `{date}`, `{cert_id}`
- [ ] Preview: render sample certificate with placeholder values
- [ ] Applied to all certificates generated for this org's exams

---

#### CERT-003 · Public Verification URL
**Priority:** P1 | **Product:** Both | **Effort:** S

**Acceptance Criteria**
- [ ] URL: `platform.com/verify/{cert_id}` — public, no auth required
- [ ] Displays: exam name, participant name, issue date, validity status (Valid / Invalid / Revoked)
- [ ] QR code printed on certificate linking to this URL
- [ ] Admin can revoke a certificate (status changes to Revoked on verify page)

---

### MODULE: ADMIN — Platform Administration

---

#### ADMIN-001 · User Management
**Priority:** P0 | **Product:** Platform | **Effort:** S

**Acceptance Criteria**
- [ ] List all users: name, email, type, registered date, plan, status
- [ ] Search by name / email
- [ ] Actions: view profile, suspend (blocks login), unsuspend, hard delete (with confirmation)
- [ ] Impersonate: all actions audit-logged under support agent ID; banner shows impersonation state

---

#### ADMIN-002 · Organization Management
**Priority:** P0 | **Product:** Platform | **Effort:** S

**Acceptance Criteria**
- [ ] List all orgs with: name, plan, MRR, member count, exam count, status, trial/paid flag
- [ ] Filter: plan, status
- [ ] Actions: view org details, manual plan change, suspend org, add promo credits
- [ ] Org detail: members, usage stats, billing history, full exam list

---

#### ADMIN-003 · Simulation Catalog Management
**Priority:** P0 | **Product:** Platform | **Effort:** M

**Acceptance Criteria**
- [ ] Create, edit, publish, unpublish simulations
- [ ] Set: name, category, description, thumbnail, free/paid, price (USD + IDR), difficulty
- [ ] Link to platform-owned question bank
- [ ] Feature flag: mark as "Featured" (appears first in category)
- [ ] Per-simulation analytics: attempt count, avg score, 5-star rating

---

#### ADMIN-004 · Business Metrics Dashboard
**Priority:** P0 | **Product:** Platform | **Effort:** M

**Acceptance Criteria**
- [ ] B2B: MRR, new orgs this month, churned orgs, trial → paid conversion rate
- [ ] B2C: MAU, DAU, premium subscribers, B2C revenue
- [ ] Operations: exams completed today / week / month, total sessions
- [ ] Top 10 orgs by MRR; top 10 simulations by attempts
- [ ] Time-series charts: MRR growth, user growth, exam volume

---

#### ADMIN-005 · Feature Flag Control
**Priority:** P1 | **Product:** Platform | **Effort:** M

**Acceptance Criteria**
- [ ] Toggle features on/off globally or per org (no code deploy required)
- [ ] Use cases: beta rollout, A/B tests, emergency kill-switch for broken features
- [ ] Flag changes effective within 30 seconds (Redis TTL-based cache invalidation)
- [ ] Audit log: flag name, old value, new value, changed by, timestamp

---

#### ADMIN-006 · Impersonate User / Org
**Priority:** P1 | **Product:** Platform | **Effort:** S

**Acceptance Criteria**
- [ ] Support agent logs in as any user from ADMIN-001
- [ ] Top banner: "Viewing as {name} — Exit Impersonation"
- [ ] All actions during impersonation logged under support agent identity
- [ ] Blocked during impersonation: payment changes, password/email change, account delete

---

## 6. Non-Functional Requirements

### 6.1 Performance Targets

| Metric | Target |
|--------|--------|
| API read P95 response time | < 300ms |
| API write P95 response time | < 500ms |
| Exam canvas initial load (P75, 4G) | < 2 seconds |
| Answer autosave end-to-end | < 500ms |
| WebSocket event delivery | < 100ms |
| Concurrent exam users (launch) | 500 |
| Concurrent exam users (6-month target) | 5,000 |

### 6.2 Availability & Reliability

- **Exam session SLA:** 99.9% uptime during scheduled exam windows
- **Answer loss tolerance:** Zero — offline buffer + server autosave belt-and-suspenders
- **RTO:** < 5 minutes for critical services
- **RPO:** < 1 minute via WAL streaming replication
- **Graceful degradation:** If LiveKit down, exam continues without camera proctoring (logged, admin notified)
- **Queue durability:** Asynq jobs persisted in Redis with retry; no job loss on Go process restart

### 6.3 Security

- All API endpoints: JWT validation in Go middleware (no public endpoints except auth + verify)
- TLS 1.3 on all connections (Caddy enforced)
- Question bank content: org_id scoped in every query (Go repository layer)
- S3 media: pre-signed URLs only (1-hour expiry for exam content, 7-day for bank editor)
- SQL: parameterized queries via `sqlc` (no raw string interpolation)
- XSS: Content Security Policy headers; Tiptap output sanitized before storage
- Rate limiting: per-IP on auth endpoints (5 attempts / 10 min); per-user on exam actions
- Audit log: all admin actions, exam config changes, score edits, impersonation sessions

### 6.4 Multi-Tenancy & Data Isolation

- Shared PostgreSQL schema; every B2B table has `org_id` column
- Row-Level Security policies in PostgreSQL as defense-in-depth
- Go repository layer enforces `WHERE org_id = $1` on every query
- B2C users cannot see B2B org data and vice versa
- Platform admin credentials separate from B2B/B2C user credentials

### 6.5 Privacy & Compliance

- Users can request data export (full personal data as JSON)
- Users can request account deletion (soft delete → hard delete after 30 days)
- Proctoring snapshots: auto-deleted 90 days after exam (Asynq scheduled job)
- Cookie consent banner (landing and marketing pages)
- Privacy Policy and Terms of Service acceptance recorded with timestamp before first exam
- GDPR-ready: data processing agreements available for EU org customers

### 6.6 Accessibility

- WCAG 2.1 AA compliance for exam canvas
- Full keyboard navigation: all questions answerable without mouse
- ARIA labels on all interactive elements
- Color contrast: minimum 4.5:1 ratio
- Body text minimum 16px
- Error messages: not color-only (icon + text always)

---

## 7. API Design Conventions

```
Base URL:       https://api.{domain}/v1
Authentication: Bearer JWT in Authorization header OR httpOnly cookie
Response:       JSON, camelCase keys
Timestamps:     ISO 8601 UTC  →  2026-06-15T10:30:00Z
IDs:            UUID v7 (time-ordered, k-sortable)
Pagination:     { "data": [...], "meta": { "page": 1, "perPage": 20, "total": 150 } }
Errors:         { "error": { "code": "ERR_VALIDATION", "message": "...", "fields": {} } }
Versioning:     URL-based (/v1/, /v2/); 6-month deprecation notice before removal
OpenAPI spec:   Auto-generated from Go annotations; published at /docs
```

**Idempotency:** All POST endpoints that create resources accept `Idempotency-Key` header. PUT endpoints are inherently idempotent.

**WebSocket protocol:**
```
Client → Server:  { "type": "ANSWER_UPDATE", "payload": { "questionId": "...", "answer": "B" } }
Server → Client:  { "type": "EXAM_EVENT", "payload": { "event": "TIME_EXTENDED", "minutes": 10 } }
```
All WebSocket message types documented in `/docs/ws-protocol.md` and versioned alongside REST API.

---

## 8. Core Data Models

```sql
-- Identity
users               (id, email, name, avatar_url, phone, timezone, role, created_at)
user_auth           (user_id, provider, provider_id, password_hash, totp_secret)

-- B2B Organization
organizations       (id, slug, name, logo_url, industry, plan, trial_ends_at, created_at)
org_members         (org_id, user_id, role, joined_at)
departments         (id, org_id, name)
dept_members        (dept_id, user_id)

-- Question Bank
question_banks      (id, org_id, name, description, status, created_by)
questions           (id, bank_id, org_id, type, body, options, answer_key, explanation,
                     difficulty, status, version, created_by, created_at)
question_tags       (question_id, tag)

-- Exam Package
exam_packages       (id, org_id, name, description, settings, status, created_by)
package_sections    (id, package_id, name, order, timer_minutes)
package_questions   (id, package_id, section_id, question_id, order, score_weight)

-- Exam Events
exam_events         (id, org_id, package_id, name, schedule_type, starts_at, ends_at,
                     duration_minutes, timezone, access_mode, settings, status)
exam_batches        (id, event_id, label, starts_at, ends_at)
exam_participants   (id, event_id, batch_id, user_id, email, name, dept_id,
                     status, invite_sent_at, whatsapp_opt_in)

-- Exam Sessions
exam_sessions       (id, event_id, participant_id, status, started_at, submitted_at,
                     ip_address, user_agent)
session_answers     (id, session_id, question_id, answer, is_correct, score,
                     answered_at, last_updated_at)

-- Scoring & Results
exam_results        (id, session_id, raw_score, max_score, percentage, rank,
                     pass_fail, released_at)
section_results     (id, result_id, section_id, raw_score, max_score, percentage, pass_fail)
essay_reviews       (id, session_id, question_id, score, comment, reviewed_by, reviewed_at)

-- Proctoring
proctoring_events   (id, session_id, type, severity, metadata, snapshot_url, created_at)

-- B2C Simulations
simulations         (id, package_id, name, category, description, thumbnail_url,
                     difficulty, pricing_model, price_usd, price_idr, is_featured, status)
simulation_attempts (id, user_id, simulation_id, mode, session_id, created_at)

-- Subscriptions & Billing
subscriptions       (id, entity_id, entity_type, plan, status, current_period_start,
                     current_period_end, stripe_subscription_id, payment_provider)
invoices            (id, subscription_id, amount, currency, status, pdf_url, paid_at)

-- Certificates
certificates        (id, session_id, user_id, template_id, cert_id, issued_at,
                     status, pdf_url)

-- Platform
notifications       (id, user_id, type, title, body, link, read_at, created_at)
feature_flags       (id, key, value, org_id, enabled_at, updated_by)
audit_logs          (id, actor_id, action, entity_type, entity_id, metadata, created_at)
```

---

## 9. Release Plan

### Phase 1 — Private Beta (Weeks 1–16)
**Goal:** Prove the B2B core loop with real paying customers.

**Shipped:** AUTH (all P0), ORG-001–003, BANK-001–015, BUILD-001–012, MGMT-001–012, ENGINE-001–011, PROC-001–007, SCORE-001–005, SCORE-008, RESULT-001–005, BILL-001–004 (Stripe), BILL-002, BILL-006–007, NOTIF-001–003, ADMIN-001–004

**Not shipped:** B2C simulation, local payments, WhatsApp, certificates, face detection, advanced analytics

**Target:** 5 pilot B2B orgs (internally recruited); iterate on feedback

---

### Phase 2 — Public Launch: B2C + Local Payments (Weeks 17–24)
**Goal:** Launch B2C simulation catalog with Indonesia-specific content and payment methods.

**Shipped:** SIM-001–007, BILL-003, BILL-005 (Midtrans/Xendit), NOTIF-004–006, CERT-001–003, ORG-004–007

**Content required before launch:** Minimum 3 complete CPNS SKD simulations (with explanations on every question)

**Target:** Public launch; 1,000 B2C registered users; 50 premium subscribers

---

### Phase 3 — Growth & Analytics (Weeks 25–36)
**Goal:** Deepen analytics, advanced proctoring, and conversion optimization.

**Shipped:** PROC-008 (AI face detection), PROC-009, RESULT-006–008, SIM-008–010, BILL-008–009, SCORE-006–007, ADMIN-005–006, AUTH-005

**Target:** 50 paying B2B orgs; 800 B2C premium subscribers; $5,000 MRR

---

### v2.0 Roadmap (6+ Months)
- Content marketplace (creator dashboard, revenue share, creator onboarding)
- React Native mobile app (iOS + Android)
- AI question generation (BANK-016)
- AI adaptive testing (difficulty adjusts per performance)
- Enterprise SSO (SAML, OIDC)
- HRIS/ATS webhook API
- Study streak & gamification (SIM-011, SIM-012)

---

*This document is the locked v1.0 feature scope. Any scope changes require a formal change review, version increment, and sign-off from product and engineering leads.*

---

**Document Version:** 1.0.0  
**Status:** 🔒 LOCKED BLUEPRINT  
**Product:** B2B Exam Platform + B2C Exam Simulation  
**Stack:** Go + Fiber · Next.js 15 · PostgreSQL 16 · Redis · LiveKit
