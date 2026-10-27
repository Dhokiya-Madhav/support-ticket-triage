import argparse
import getpass
import random
import sys

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import AgentSkill, User
from app.models.enums import Category, Role


def create_manager(email: str | None, password: str | None, name: str) -> int:
    settings = get_settings()
    email = (email or settings.manager_email or input("Manager email: ")).strip().lower()
    password = password or settings.manager_password or getpass.getpass("Manager password: ")
    if not email or not password:
        print("Email and password are required.", file=sys.stderr)
        return 1
    if len(password) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)):
            print(f"A user with email {email} already exists.", file=sys.stderr)
            return 1
        db.add(
            User(
                name=name,
                email=email,
                password_hash=hash_password(password),
                role=Role.manager,
            )
        )
        db.commit()
    print(f"Manager {email} created.")
    return 0


# Sample support team for development: (name, email, skills, open ticket limit).
SAMPLE_AGENTS: list[tuple[str, str, list[Category], int]] = [
    ("Aarav Sharma", "aarav.sharma@example.com", [Category.billing, Category.general], 10),
    ("Priya Patel", "priya.patel@example.com", [Category.login, Category.general], 10),
    ("Rohan Mehta", "rohan.mehta@example.com", [Category.bug, Category.login], 8),
    ("Neha Gupta", "neha.gupta@example.com", [Category.billing, Category.bug], 8),
    (
        "Kabir Singh",
        "kabir.singh@example.com",
        [Category.general, Category.billing, Category.login],
        12,
    ),
]


FIRST_NAMES = [
    "Aditya", "Ananya", "Arjun", "Diya", "Ishaan", "Kavya", "Meera", "Nikhil", "Pooja", "Rahul",
    "Riya", "Sanjay", "Sneha", "Tanvi", "Varun", "Isha", "Manish", "Divya", "Harsh", "Shreya",
    "Emma", "Liam", "Olivia", "Noah", "Sophia", "Lucas", "Mia", "Ethan", "Ava", "Mason",
]  # fmt: skip
LAST_NAMES = [
    "Agarwal", "Bansal", "Chopra", "Desai", "Iyer", "Joshi", "Kapoor", "Khanna", "Malhotra",
    "Nair", "Reddy", "Saxena", "Trivedi", "Verma", "Bhatt", "Chauhan", "Menon", "Pillai",
    "Rao", "Shah", "Smith", "Johnson", "Brown", "Taylor", "Walker", "Clark", "Lewis", "Young",
]  # fmt: skip
EXTRA_CAPS = [6, 8, 10, 12, 15]


def generated_agents(count: int) -> list[tuple[str, str, list[Category], int]]:
    """Reproducible fake agents: unique names, 1-3 skills each, a mix of workload limits."""
    rng = random.Random(2026)
    pairs = [(f, last) for f in FIRST_NAMES for last in LAST_NAMES]
    rng.shuffle(pairs)
    taken = {email for _, email, _, _ in SAMPLE_AGENTS}
    agents: list[tuple[str, str, list[Category], int]] = []
    for first, last in pairs:
        if len(agents) == count:
            break
        email = f"{first}.{last}@example.com".lower()
        if email in taken:
            continue
        taken.add(email)
        skills = rng.sample(list(Category), rng.choice([1, 2, 2, 3]))
        agents.append((f"{first} {last}", email, skills, rng.choice(EXTRA_CAPS)))
    return agents


def seed_agents(password: str, count: int) -> int:
    """Create the sample agents (plus `count` generated ones). Existing agents are left alone."""
    if len(password) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        return 1
    password_hash = hash_password(password)  # hashed once: every sample agent shares the password
    created = 0
    with SessionLocal() as db:
        existing = set(db.scalars(select(User.email)))
        for name, email, skills, cap in [*SAMPLE_AGENTS, *generated_agents(count)]:
            if email in existing:
                continue
            agent = User(
                name=name,
                email=email,
                password_hash=password_hash,
                role=Role.agent,
                max_open_tickets=cap,
            )
            agent.skills = [AgentSkill(category=c) for c in skills]
            db.add(agent)
            created += 1
        db.commit()
    print(f"{created} agent(s) created.")
    return 0


NEW_SKILLS = [
    Category.refund,
    Category.account,
    Category.integration,
    Category.feature_request,
    Category.cancellation,
]
MIN_AGENTS_PER_NEW_SKILL = 10


def add_skills() -> int:
    """Give existing agents the newer skills (about 60% of them, 1-3 each). Safe to re-run.

    Agents that already hold any of the newer skills are left as they are, and every new skill is
    topped up to at least MIN_AGENTS_PER_NEW_SKILL agents so tickets in it can always be assigned.
    """
    rng = random.Random(7)
    added = 0
    with SessionLocal() as db:
        agents = list(
            db.scalars(
                select(User)
                .where(User.role == Role.agent)
                .options(selectinload(User.skills))
                .order_by(User.id)
            )
        )
        for agent in agents:
            have = {s.category for s in agent.skills}
            # Seeded per agent, so the same agents are picked on every run.
            pick = random.Random(f"new-skills-{agent.id}")
            if have & set(NEW_SKILLS) or pick.random() > 0.6:
                continue
            for category in pick.sample(NEW_SKILLS, pick.choice([1, 2, 2, 3])):
                agent.skills.append(AgentSkill(category=category))
                added += 1

        for category in NEW_SKILLS:
            holders = [a for a in agents if category in {s.category for s in a.skills}]
            lacking = [a for a in agents if a not in holders]
            rng.shuffle(lacking)
            for agent in lacking[: max(0, MIN_AGENTS_PER_NEW_SKILL - len(holders))]:
                agent.skills.append(AgentSkill(category=category))
                added += 1
        db.commit()
    print(f"{added} skill(s) added across {len(agents)} agent(s).")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    cm = sub.add_parser("create-manager", help="Create the first manager account")
    cm.add_argument("--email")
    cm.add_argument("--password")
    cm.add_argument("--name", default="Manager")
    sa = sub.add_parser("seed-agents", help="Create sample agents with skills (development)")
    sa.add_argument("--password", default="Agent@1234", help="Password for every sample agent")
    sa.add_argument("--count", type=int, default=0, help="Also create this many generated agents")
    sub.add_parser("add-skills", help="Give existing agents the newer skills (development)")
    st = sub.add_parser("seed-tickets", help="Create demo customers and tickets (development)")
    st.add_argument("--count", type=int, default=100, help="How many tickets to create")
    st.add_argument("--seed", type=int, default=None, help="Fixed seed for repeatable data")
    args = parser.parse_args()
    if args.command == "seed-tickets":
        from app.cli.seed_tickets import seed_tickets

        return seed_tickets(args.count, args.seed)
    if args.command == "add-skills":
        return add_skills()
    if args.command == "seed-agents":
        return seed_agents(args.password, args.count)
    return create_manager(args.email, args.password, args.name)


if __name__ == "__main__":
    sys.exit(main())
