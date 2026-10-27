BACKSLASH = chr(92)


def like_pattern(term: str) -> str:
    """Contains-match pattern for ILIKE, with wildcard characters in the text taken literally."""
    escaped = (
        term.replace(BACKSLASH, BACKSLASH * 2)
        .replace("%", BACKSLASH + "%")
        .replace("_", BACKSLASH + "_")
    )
    return f"%{escaped}%"


def ticket_number(term: str) -> int | None:
    """'#42' or '42' as a ticket number, if the search text looks like one."""
    digits = term.strip().lstrip("#")
    return int(digits) if digits.isdigit() and len(digits) <= 9 else None
