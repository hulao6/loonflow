"""
Helpers for timezone-aware datetimes when Django USE_TZ is True.

Centralizes parsing so ORM filters and custom ticket fields do not pass naive datetimes.
"""

import datetime

from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime


def ensure_aware_datetime(dt: datetime.datetime) -> datetime.datetime:
    """Return an aware datetime in the current timezone if dt is naive."""
    if dt is None:
        return dt
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def parse_datetime_filter_param(value):
    """
    Parse list-filter create_start/create_end values for created_at lookups.

    Accepts ISO-like strings, 'YYYY-MM-DD HH:MM:SS', or date-only strings,
    or an existing datetime (naive values are interpreted in the active timezone).
    """
    if value is None or value == '':
        return value
    if isinstance(value, datetime.datetime):
        return ensure_aware_datetime(value)
    if isinstance(value, datetime.date) and not isinstance(value, datetime.datetime):
        combined = datetime.datetime.combine(value, datetime.time.min)
        return ensure_aware_datetime(combined)
    if not isinstance(value, str):
        return value
    s = value.strip()
    if not s:
        return value
    parsed = parse_datetime(s)
    if parsed is None and ' ' in s and 'T' not in s:
        parsed = parse_datetime(s.replace(' ', 'T', 1))
    if parsed is None:
        d = parse_date(s[:10]) if len(s) >= 10 else parse_date(s)
        if d is None:
            return value
        parsed = datetime.datetime.combine(d, datetime.time.min)
    return ensure_aware_datetime(parsed)


def coerce_custom_field_date_value(raw):
    """Normalize custom field date values for DB storage."""
    if raw is None or raw == '':
        return None
    if isinstance(raw, datetime.date) and not isinstance(raw, datetime.datetime):
        return raw
    if isinstance(raw, datetime.datetime):
        return raw.date()
    if isinstance(raw, str):
        s = raw.strip()
        d = parse_date(s[:10]) if len(s) >= 10 else parse_date(s)
        if d is None:
            dt = parse_datetime(s)
            if dt is None and ' ' in s and 'T' not in s:
                dt = parse_datetime(s.replace(' ', 'T', 1))
            if dt is not None:
                return dt.date()
        return d if d is not None else raw
    return raw


def coerce_custom_field_datetime_value(raw):
    """Normalize custom field datetime values to timezone-aware datetimes."""
    if raw is None or raw == '':
        return None
    if isinstance(raw, datetime.datetime):
        return ensure_aware_datetime(raw)
    if isinstance(raw, str):
        s = raw.strip()
        parsed = parse_datetime(s)
        if parsed is None and ' ' in s and 'T' not in s:
            parsed = parse_datetime(s.replace(' ', 'T', 1))
        if parsed is None:
            return raw
        return ensure_aware_datetime(parsed)
    return raw
