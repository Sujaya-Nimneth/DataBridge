"""
Helpers for safely building SQL against user-supplied database connections.

The explorer and transfer paths accept a raw ``WHERE`` fragment from the client.
That fragment cannot be parameterised (it is a full expression, not a value), so
it is validated instead: single expression, no statement separators, no comments,
no data-modifying keywords, no sub-selects and no known-dangerous functions.

User-supplied identifiers (schemas, tables, columns) are validated against a
conservative pattern *and* quoted with the target dialect's preparer — the
pattern keeps names predictable for logs and raw-SQL paths, the quoting closes
the gap for anything the pattern alone would miss.
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

# Functions that either stall the connection (DoS) or read/exfiltrate server
# files. Called inside a WHERE fragment they serve no legitimate purpose.
_FORBIDDEN_FUNCTIONS = re.compile(
    r"\b(pg_sleep|pg_sleep_for|pg_sleep_until|sleep|benchmark|delay|"
    r"dbms_lock|dbms_pipe|pg_read_file|pg_read_binary_file|pg_ls_dir|"
    r"pg_ls_logdir|lo_import|lo_export|load_file|readfile|sys_eval)\s*\(",
    re.IGNORECASE,
)
# WAITFOR ... DELAY takes no parentheses; match the keyword itself.
_FORBIDDEN_KEYWORDS_EXTENDED = re.compile(r"\b(waitfor|exec\s+master)\b", re.IGNORECASE)

_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")


class UnsafeFilterError(ValueError):
    """Raised when a supplied filter expression is rejected."""


class InvalidIdentifierError(ValueError):
    """Raised when a user-supplied SQL identifier fails the safety pattern."""


def validate_identifier(name: str | None, field: str = "identifier") -> str:
    """
    Validate a user-supplied SQL identifier.

    Only plain ``[A-Za-z_][A-Za-z0-9_]{0,63}`` names are accepted: no quoting
    characters, no dots, no spaces, no unicode. Combined with dialect-aware
    quoting downstream this removes the identifier-injection vector while still
    covering the overwhelming majority of real table/column names.
    """
    if name is None:
        raise InvalidIdentifierError(f"{field} is required")
    if not _IDENTIFIER_PATTERN.match(name):
        raise InvalidIdentifierError(
            f"{field} must match [A-Za-z_][A-Za-z0-9_]* (max 64 chars); got {name!r}"
        )
    return name


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

    if _FORBIDDEN_FUNCTIONS.search(candidate):
        raise UnsafeFilterError("Filter contains a disallowed function call")

    if _FORBIDDEN_KEYWORDS_EXTENDED.search(candidate):
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
