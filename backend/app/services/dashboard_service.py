from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import ColumnElement, Float, cast, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Ticket, User
from app.models.enums import Role, TicketStatus, TriageStatus
from app.schemas.manager import AgentWorkload, CategoryCount, Dashboard


def _hours(delta_expr: Any) -> Any:
    return cast(func.extract("epoch", delta_expr), Float) / 3600


def _round(value: float | None, places: int = 2) -> float | None:
    return None if value is None else round(float(value), places)


def build_dashboard(db: Session, days: int) -> Dashboard:
    sla_hours = get_settings().sla_first_response_hours
    sla = timedelta(hours=sla_hours)
    now = datetime.now(UTC)
    since = now - timedelta(days=days)

    is_open = Ticket.status == TicketStatus.open
    overdue = is_open & Ticket.first_response_at.is_(None) & (Ticket.created_at < now - sla)
    in_period = Ticket.created_at >= since

    def count(*where: ColumnElement[bool]) -> int:
        return db.scalar(select(func.count()).select_from(Ticket).where(*where)) or 0

    response_time = _hours(Ticket.first_response_at - Ticket.created_at)
    avg_hours, median_hours = db.execute(
        select(
            func.avg(response_time),
            func.percentile_cont(0.5).within_group(response_time),
        ).where(in_period, Ticket.first_response_at.is_not(None))
    ).one()

    # Tickets whose deadline has passed or that were answered: did we respond within the SLA?
    decided = in_period & (Ticket.first_response_at.is_not(None) | (Ticket.created_at < now - sla))
    decided_count = count(decided)
    met_count = count(
        decided,
        Ticket.first_response_at.is_not(None),
        Ticket.first_response_at <= Ticket.created_at + sla,
    )

    def breakdown(column: Any) -> list[CategoryCount]:
        rows = db.execute(
            select(column, func.count())
            .where(in_period)
            .group_by(column)
            .order_by(func.count().desc())
        ).all()
        return [
            CategoryCount(category=getattr(key, "value", key) or "untriaged", count=n)
            for key, n in rows
        ]

    workload_rows = db.execute(
        select(
            User.id,
            User.name,
            User.is_active,
            User.max_open_tickets,
            func.count(Ticket.id).filter(is_open),
            func.count(Ticket.id).filter(overdue),
            func.count(Ticket.id).filter(
                (Ticket.status == TicketStatus.resolved) & (Ticket.resolved_at >= since)
            ),
        )
        .outerjoin(Ticket, Ticket.assignee_id == User.id)
        .where(User.role == Role.agent)
        .group_by(User.id)
        .order_by(User.name, User.id)
    ).all()

    return Dashboard(
        period_days=days,
        sla_hours=sla_hours,
        open_tickets=count(is_open),
        unassigned_open=count(is_open, Ticket.assignee_id.is_(None)),
        overdue_open=count(overdue),
        triage_failed_open=count(is_open, Ticket.triage_status == TriageStatus.failed),
        created_in_period=count(in_period),
        resolved_in_period=count(
            Ticket.status == TicketStatus.resolved, Ticket.resolved_at >= since
        ),
        avg_first_response_hours=_round(avg_hours),
        median_first_response_hours=_round(median_hours),
        sla_compliance_pct=_round(100 * met_count / decided_count, 1) if decided_count else None,
        by_category=breakdown(Ticket.category),
        by_urgency=breakdown(Ticket.urgency),
        agents=[
            AgentWorkload(
                agent_id=i,
                name=name,
                is_active=active,
                max_open_tickets=cap,
                open_tickets=open_n,
                overdue_tickets=overdue_n,
                resolved_in_period=resolved_n,
            )
            for i, name, active, cap, open_n, overdue_n, resolved_n in workload_rows
        ],
    )
