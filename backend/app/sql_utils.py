"""
Helpers for safely building SQL against user-supplied database connections.

The explorer and transfer paths accept a raw ``WHERE`` fragment from the client.
That fragment cannot be parameterised (it is a full expression, not a value), so
it is validated instead: single expression, no statement separators, no comments,
no data-modifying keywords and no sub-selects.
"""

import re

from sqlalchemy.engine import Engine

_FORBIDDEN_KEYWORDS = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|"
    r"call|do|merge|vacuum|analyze|execute|commit|rollback|set|into)\b",
    re.IGNORECASE,
)
_FORBIDDEN_TOKENS = (";", "--", "/*", "*/", "\\")
_MAX_FILTER_LENGTH = 2000


class UnsafeFilterError(ValueError):
    """Raised when a supplied filter expression is rejected."""


def validate_filter_query(filter_query: str | None) -> str | None:
    """
    Validate a user-supplied ``WHERE`` fragment.

    Returns the trimmed fragment, or ``None`` when nothing was supplied.
    Raises :class:`UnsafeFilterError` when the fragment looks like it could
    escape the intended read-only predicate.
    """
    if filter_query is None:
        return None

    candidate = filter_query.strip()
    if not candidate:
        return None

    if len(candidate) > _MAX_FILTER_LENGTH:
        raise UnsafeFilterError(f"Filter is too long (max {_MAX_FILTER_LENGTH} characters)")

    if any(token in candidate for token in _FORBIDDEN_TOKENS):
        raise UnsafeFilterError("Filter contains a disallowed character sequence")

    if _FORBIDDEN_KEYWORDS.search(candidate):
        raise UnsafeFilterError("Filter contains a disallowed keyword")

    # A bare 'select' is only acceptable inside parentheses-free comparisons;
    # reject sub-selects outright to keep reads confined to the target table.
    if re.search(r"\bselect\b", candidate, re.IGNORECASE):
        raise UnsafeFilterError("Sub-queries are not allowed in filters")

    return candidate


def quote_identifier(engine: Engine, name: str) -> str:
    """
    Quote a single identifier using the target dialect's rules.

    Always quoting matters for case-sensitive names: PostgreSQL folds unquoted
    identifiers to lower case, so a table named ``Orders`` would silently be
    looked up as ``orders``.
    """
    preparer = engine.dialect.identifier_preparer
    return preparer.quote_identifier(name)


def qualify_table(engine: Engine, schema: str | None, table: str) -> str:
    """Return a fully quoted ``schema.table`` reference."""
    quoted_table = quote_identifier(engine, table)
    if not schema:
        return quoted_table
    return f"{quote_identifier(engine, schema)}.{quoted_table}"
