"""Bulk demo tickets: realistic requests, triage results, assignments, replies and history."""

import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import AuditEvent, DraftReply, Message, Ticket, User
from app.models.enums import (
    Category,
    Direction,
    DraftStatus,
    Role,
    Sentiment,
    TicketStatus,
    TriageStatus,
    Urgency,
)

CUSTOMER_PASSWORD = "Customer@1234"
CUSTOMER_DOMAIN = "customers.example.com"
SLA_HOURS = 4

CUSTOMER_NAMES = [
    "Maya Kapoor", "Daniel Foster", "Sana Qureshi", "Lucas Meyer", "Anika Rao", "Owen Parker",
    "Zoya Khan", "Henry Collins", "Ritika Jain", "Mateo Alvarez", "Tara Nambiar", "Jack Turner",
    "Fatima Sheikh", "Ethan Brooks", "Naina Bose", "Leo Fischer", "Aisha Siddiqui", "Noah Bennett",
    "Pranav Iyer", "Chloe Murphy", "Vikram Sethi", "Grace Hughes", "Imran Ali", "Ella Russo",
    "Kunal Shah", "Sofia Marino", "Rohit Das", "Hannah Weber", "Arnav Gill", "Isabel Costa",
]  # fmt: skip

# category -> (subject, customer message, one-line summary)
TEMPLATES: dict[Category, list[tuple[str, str, str]]] = {
    Category.billing: [
        ("Charged twice this month", "I was charged twice for my subscription this month and need this fixed today. Both charges are on my card statement.", "Customer was charged twice this month and wants it fixed today."),
        ("Invoice shows wrong amount", "The latest invoice shows an amount higher than my plan price. Can someone check what was added?", "Invoice total is higher than the plan price; customer wants an explanation."),
        ("Payment failed but money was taken", "My payment shows as failed in the app but my bank took the money. Please confirm the status.", "Payment shows failed in the app but the bank charged the customer."),
        ("Need to update my card", "My card expires next month. Where do I update the payment method so renewals do not fail?", "Customer asks how to update the payment method before renewal."),
        ("Upgrade did not change my price", "I upgraded to the Pro plan yesterday but my invoice still shows the old plan.", "Plan upgrade is not reflected on the invoice."),
    ],
    Category.refund: [
        ("Refund for unused annual plan", "I bought the annual plan by mistake and have not used it. Please refund me.", "Customer requests a refund for an unused annual plan."),
        ("Refund request for duplicate payment", "You charged me twice last week. I would like the extra payment refunded to my card.", "Customer wants a refund for a duplicate payment."),
        ("Still waiting for my refund", "You approved my refund ten days ago and I have not received it. Can you check?", "Approved refund has not arrived after ten days."),
        ("Credit for the outage", "Your service was down for most of Monday. I would like a credit on my account.", "Customer asks for a credit for Monday's outage."),
    ],
    Category.login: [
        ("Cannot sign in to my account", "I get an invalid password error even though I just reset it. I am locked out and have a deadline.", "Customer is locked out after a password reset and has a deadline."),
        ("Password reset email never arrives", "I requested a password reset three times and no email arrives. I checked spam.", "Password reset emails are not arriving."),
        ("Two-factor codes not working", "My authenticator app codes are rejected at sign-in. I changed phones last week.", "Two-factor codes are rejected after a phone change."),
        ("Account locked after attempts", "My account says it is locked after too many attempts. How long until I can try again?", "Account is locked after repeated sign-in attempts."),
        ("How do I sign in with Google?", "I used to sign in with email. Can I switch to Google sign-in instead?", "Customer asks how to switch to Google sign-in."),
    ],
    Category.account: [
        ("Change the email on my account", "I changed jobs and need to move the account to my new email address.", "Customer wants to change the account email address."),
        ("Add a teammate to our workspace", "How do I invite two colleagues and give them read-only access?", "Customer asks how to invite teammates with read-only access."),
        ("Export all my data", "Please send me an export of everything stored on my account for our records.", "Customer requests a full export of their account data."),
        ("Delete my account and data", "I would like my account and all associated data permanently deleted.", "Customer requests permanent deletion of their account."),
        ("Wrong name on my profile", "My name is misspelled on my profile and invoices. How can I correct it?", "Customer wants to correct their name on the profile."),
    ],
    Category.bug: [
        ("Export button shows a blank page", "When I click Export on the reports page I get a blank white page. Chrome, latest version.", "Export button opens a blank page on the reports screen."),
        ("Dashboard numbers do not match", "The totals on my dashboard are different from the report I download. One of them is wrong.", "Dashboard totals differ from the downloaded report."),
        ("App crashes when uploading a file", "The page freezes and then shows an error when I upload a PDF larger than 5 MB.", "Uploading PDFs over 5 MB freezes the page and errors."),
        ("Notifications are duplicated", "I get every notification email twice since yesterday.", "Customer receives duplicate notification emails."),
        ("Search returns no results", "Search shows nothing even for items I can see in the list. It worked last week.", "Search returns no results for items that exist."),
    ],
    Category.integration: [
        ("API returns 401 with a valid key", "My API key worked yesterday and now every request returns 401. I did not change anything.", "API key that worked before now returns 401 errors."),
        ("Webhook is not firing", "I registered a webhook for new tickets but my endpoint receives nothing.", "Registered webhook does not deliver events."),
        ("How do I connect Slack?", "Is there a Slack integration? I want alerts for urgent tickets in a channel.", "Customer asks how to connect Slack for urgent alerts."),
        ("Rate limit questions for the API", "What are the API rate limits and can we get a higher limit for our import?", "Customer asks about API rate limits and a higher limit."),
    ],
    Category.feature_request: [
        ("Please add dark mode", "It would be great to have a dark mode. I work late and the white screen is harsh.", "Customer requests a dark mode."),
        ("Bulk edit for tickets", "Could you add a way to select many items and change them at once?", "Customer requests bulk editing."),
        ("Export to Excel format", "CSV is fine but my team would prefer a native Excel export.", "Customer asks for a native Excel export."),
        ("Scheduled weekly summary email", "A weekly summary email of activity would save us a lot of time.", "Customer requests a weekly summary email."),
    ],
    Category.cancellation: [
        ("How do I cancel my subscription?", "I want to cancel my subscription before the next billing date. Where do I do that?", "Customer wants to cancel before the next billing date."),
        ("Cancel and close my account", "Please cancel everything and close the account. We no longer need the service.", "Customer asks to cancel and close their account."),
        ("Pause my plan for two months", "Can I pause instead of cancelling? We are on a break until March.", "Customer asks to pause the plan for two months."),
    ],
    Category.general: [
        ("Question about plans", "What is the difference between the Standard and Pro plans?", "Customer asks about the difference between plans."),
        ("Do you offer a student discount?", "I am a student. Is there any discount available?", "Customer asks about student discounts."),
        ("Where can I find the user guide?", "I could not find documentation on setting up reports. Is there a guide?", "Customer is looking for the reports setup guide."),
        ("Feedback on the new layout", "I like the new layout but the menu is harder to reach on my phone.", "Customer shares feedback on the new layout."),
        ("Business hours for phone support", "What hours is phone support available, and in which time zones?", "Customer asks about phone support hours."),
    ],
}  # fmt: skip

AGENT_REPLIES = [
    "Hi {name}, thanks for getting in touch. I'm looking into this now and will update you here shortly.",
    "Hello {name}, I've reviewed your request and made the changes on our side. Please check and let me know if anything still looks off.",
    "Hi {name}, thanks for the details. I've passed this to the right team and will follow up as soon as I hear back.",
    "Hello {name}, I've checked your account and can confirm what you described. Here is what happens next.",
]
FOLLOW_UPS = [
    "Thanks, that worked. Appreciate the quick help.",
    "Still not fixed on my side. Could you take another look?",
    "Any update on this? It is becoming urgent for us.",
    "Great, thank you. Please go ahead and close it.",
]


def _ensure_customers(db: Session, count: int) -> list[User]:
    password_hash = hash_password(CUSTOMER_PASSWORD)
    existing = {u.email: u for u in db.scalars(select(User).where(User.role == Role.customer))}
    customers: list[User] = []
    for name in CUSTOMER_NAMES[:count]:
        email = f"{name.lower().replace(' ', '.')}@{CUSTOMER_DOMAIN}"
        user = existing.get(email)
        if user is None:
            user = User(name=name, email=email, password_hash=password_hash, role=Role.customer)
            db.add(user)
        customers.append(user)
    db.flush()
    return customers


def _urgency_and_sentiment(rng: random.Random) -> tuple[Urgency, Sentiment]:
    urgency = rng.choices(list(Urgency), weights=[30, 45, 25])[0]
    weights = {
        Urgency.high: [25, 20, 55],
        Urgency.medium: [50, 30, 20],
        Urgency.low: [65, 25, 10],
    }[urgency]
    return urgency, rng.choices([Sentiment.calm, Sentiment.confused, Sentiment.angry], weights)[0]


def seed_tickets(count: int, seed: int | None) -> int:
    rng = random.Random(seed)
    now = datetime.now(UTC)
    sla = timedelta(hours=SLA_HOURS)
    created_total = 0

    with SessionLocal() as db:
        customers = _ensure_customers(db, len(CUSTOMER_NAMES))
        agents = list(
            db.scalars(
                select(User)
                .where(User.role == Role.agent, User.is_active.is_(True))
                .options(selectinload(User.skills))
            )
        )
        if not agents:
            print("No active agents found. Run seed-agents first.")
            return 1
        by_skill = {c: [a for a in agents if c in {s.category for s in a.skills}] for c in Category}
        load: dict[int, int] = {
            agent_id: n
            for agent_id, n in db.execute(
                select(Ticket.assignee_id, func.count())
                .where(Ticket.status == TicketStatus.open, Ticket.assignee_id.is_not(None))
                .group_by(Ticket.assignee_id)
            )
            if agent_id is not None
        }

        for _ in range(count):
            customer = rng.choice(customers)
            category = rng.choices(list(Category), weights=[22, 10, 14, 8, 16, 8, 8, 6, 8])[0]
            subject, body, summary = rng.choice(TEMPLATES[category])
            # Mostly recent, with a tail back to 30 days ago.
            age = timedelta(hours=rng.triangular(0.2, 24 * 30, 24 * 3))
            created = now - age
            failed_triage = rng.random() < 0.05
            urgency, sentiment = _urgency_and_sentiment(rng)
            resolved = (not failed_triage) and age > timedelta(hours=2) and rng.random() < 0.55

            candidates = [] if failed_triage else by_skill[category]
            assignee: User | None = None
            if candidates:
                if resolved:
                    assignee = rng.choice(candidates)
                elif rng.random() < 0.85:
                    free = [a for a in candidates if load.get(a.id, 0) < a.max_open_tickets]
                    assignee = rng.choice(free) if free else None
            if assignee and not resolved:
                load[assignee.id] = load.get(assignee.id, 0) + 1

            ticket = Ticket(
                customer_id=customer.id,
                subject=subject,
                category=None if failed_triage else category,
                urgency=None if failed_triage else urgency,
                sentiment=None if failed_triage else sentiment,
                summary=None if failed_triage else summary,
                status=TicketStatus.resolved if resolved else TicketStatus.open,
                assignee_id=assignee.id if assignee else None,
                assigned_at=created + timedelta(seconds=rng.randint(20, 120)) if assignee else None,
                triage_status=TriageStatus.failed if failed_triage else TriageStatus.done,
                triage_attempts=3 if failed_triage else 1,
                triage_attempted_at=created + timedelta(minutes=8),
                created_at=created,
            )
            db.add(ticket)
            db.flush()

            ticket_id = ticket.id

            def say(
                direction: Direction, sender: str, text: str, at: datetime, tid: int = ticket_id
            ) -> datetime:
                db.add(
                    Message(
                        ticket_id=tid,
                        direction=direction,
                        sender=sender,
                        body_text=text,
                        created_at=at,
                    )
                )
                return at

            def log(
                actor: str,
                action: str,
                at: datetime,
                detail: dict[str, object] | None = None,
                tid: int = ticket_id,
            ) -> None:
                db.add(
                    AuditEvent(
                        ticket_id=tid,
                        actor=actor,
                        action=action,
                        detail=detail,
                        created_at=at,
                    )
                )

            say(Direction.inbound, customer.email, body, created)
            log(customer.email, "ticket_created", created, {"attachments": 0})
            if failed_triage:
                log("system", "triage_failed", created + timedelta(minutes=1), {"attempt": 3})
            else:
                log(
                    "system",
                    "triaged",
                    created + timedelta(seconds=30),
                    {"category": category.value},
                )
            if assignee:
                log("system", "assigned", ticket.assigned_at or created, {"agent_id": assignee.id})

            # Agent responses only exist for tickets that have an assignee.
            responded = bool(assignee) and (
                resolved or (age > timedelta(minutes=30) and rng.random() < 0.55)
            )
            last_at = created
            if responded and assignee:
                delay = (
                    timedelta(minutes=rng.randint(5, 230))
                    if rng.random() < 0.7
                    else timedelta(hours=rng.uniform(4.2, 20))
                )
                reply_at = min(created + delay, now - timedelta(minutes=1))
                reply = rng.choice(AGENT_REPLIES).format(name=customer.name.split()[0])
                last_at = say(Direction.outbound, assignee.email, reply, reply_at)
                ticket.first_response_at = reply_at
                log(assignee.email, "reply_sent", reply_at, {"first_response": True})
                if rng.random() < 0.35 and now - last_at > timedelta(hours=1):
                    last_at = say(
                        Direction.inbound,
                        customer.email,
                        rng.choice(FOLLOW_UPS),
                        last_at + timedelta(minutes=rng.randint(20, 300)),
                    )
                    log(customer.email, "customer_reply", last_at, {"attachments": 0})
                if resolved:
                    closed_at = min(last_at + timedelta(minutes=rng.randint(10, 600)), now)
                    ticket.resolved_at = closed_at
                    log(assignee.email, "resolved", closed_at)
            elif not failed_triage and not resolved:
                # Open and untouched: the AI draft is waiting for an agent.
                db.add(
                    DraftReply(
                        ticket_id=ticket.id,
                        body=rng.choice(AGENT_REPLIES).format(name=customer.name.split()[0]),
                        status=DraftStatus.pending,
                        created_at=created + timedelta(seconds=30),
                    )
                )
            _ = sla  # the 4h rule is applied by the app when it reads first_response_at
            created_total += 1

        db.commit()
    print(f"{created_total} ticket(s) created for {len(customers)} customer(s).")
    print(f"Customer password: {CUSTOMER_PASSWORD}  (e.g. maya.kapoor@{CUSTOMER_DOMAIN})")
    return 0
