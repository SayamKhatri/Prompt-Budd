import re

PATTERNS = {
    "bank_account_number": r"\b\d{10,12}\b",
    "bank_routing_number": r"\b\d{9}\b",
    "credit_card_number": [
        r"\b(?:4\d{3}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b",      # Visa
        r"\b(?:5[1-5]\d{2}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b",    # Mastercard
        r"\b(?:3[47]\d{2}[-\s]?\d{6}[-\s]?\d{5})\b",               # American Express
        r"\b(?:6(?:011|5\d{2})[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b", # Discover
        r"\b(?:3(?:0[0-5]|[68]\d)\d{11,14})\b",                    # Diners Club
        r"\b(?:(?:2131|1800|35\d{3})[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b",  # JCB
        r"\b(?:(?:5[0678]\d\d|6304|6390|67\d\d)\d{8,15})\b",        # Maestro
        r"\b(?:\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b",          # Generic 16-digit pattern
    ],
    "money": [
        r'\{\$?\d+(?:\.\d{2})?\$?\}',
        r'(?:\$\s?\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s?\$)'
    ],
    "ssn_tin": r"\b\d{3}-\d{2}-\d{4}\b",
    "ein": r"\b\d{2}-\d{7}\b",
    "passport_number": r"\b[A-Z]{1}\d{7}\b",
    "email_address": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    "phone_number": [
        r"\+?\b(?:1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)?[2-9]\d{2}[-.\s]?\d{4}\b",
        r"\b\d{10}\b",
        r"\b\(\d{3}\)\s?\d{3}[-.\s]?\d{4}\b",
        r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
    ],
    "dates_of_birth": r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b",
    "home_address": r"\b\d{1,9},\s[\w\s]+,\s[\w\s]+,\s[A-Z]{2}\s\d{5}(?:-\d{4})?\b",
    "race": r"\b(?:White|Black|Asian|Native American|Pacific Islander|Multiracial|Biracial)\b",
    "ethnicity": r"\b(?:Hispanic|Latino|Latinx|African American|Caucasian|Arab|Jewish|Slavic|Celtic|Germanic|Scandinavian|Mediterranean|Ashkenazi|Sephardic)\b",
    "password": r"(?i)(password)\s*[:=]\s*['\"]?([^\s'\";]+)['\"]?",
    "access_key": r"(?i)(access[-_\s]*key)\s*[:=]\s*['\"]?([A-Z0-9]{16,})['\"]?",
    "secret_key": r"(?i)(secret[-_\s]*key)\s*[:=]\s*['\"]?([\w/\+=_-]{8,})['\"]?",
    "api_key": r"(?i)(api[-_\s]*key)\s*[:=]\s*['\"]?(sk-[A-Za-z0-9-_]{16,})['\"]?",
    # Standalone AWS keys.
    "aws_access_key": r"\bAKIA[0-9A-Z]{16}\b",
    "aws_secret_key": r"\b[0-9a-zA-Z/+=]{40}\b",
    # Generic credentials detection.
    "generic_credentials": r"(?i)(user|login|username)\s*[:=]\s*['\"]?([^\s'\";]+)['\"]?"
}


compiled_patterns = {}
for key, pattern in PATTERNS.items():
    if isinstance(pattern, list):
        compiled_patterns[key] = [re.compile(p, re.IGNORECASE) for p in pattern]
    else:
        compiled_patterns[key] = re.compile(pattern, re.IGNORECASE)


GENERIC_LABELS = {"api key", "access key", "secret key", "password", "username", "user", "login"}

def contains_pii(text: str) -> bool:
    """
    Check if the given text contains any PII based solely on regex matching.
    """
    for key, pattern in compiled_patterns.items():
        if isinstance(pattern, list):
            for p in pattern:
                m = p.search(text)
                if m:
                    if key in {"access_key", "secret_key", "api_key", "password", "generic_credentials"}:
                        value = m.group(2) if (m.lastindex and m.lastindex >= 2) else m.group(0)
                        value_clean = value.strip().lower()
                        if len(value_clean) < 10 or value_clean in GENERIC_LABELS:
                            continue
                        if len(set(value_clean)) <= 1:
                            continue
                        if (len(set(value_clean)) / len(value_clean)) < 0.3:
                            continue
                    return True
        else:
            m = pattern.search(text)
            if m:
                if key in {"access_key", "secret_key", "api_key", "password", "generic_credentials"}:
                    value = m.group(2) if (m.lastindex and m.lastindex >= 2) else m.group(0)
                    value_clean = value.strip().lower()
                    if len(value_clean) < 10 or value_clean in GENERIC_LABELS:
                        continue
                    if len(set(value_clean)) <= 1:
                        continue
                    if (len(set(value_clean)) / len(value_clean)) < 0.3:
                        continue
                return True
    return False

def _mask_replacement(match, key: str) -> str:
    """
    Helper function for regex replacement.
    Applies the same filtering logic as in contains_pii.
    """
    if key in {"access_key", "secret_key", "api_key", "password", "generic_credentials"}:
        value = match.group(2) if (match.lastindex and match.lastindex >= 2) else match.group(0)
        value_clean = value.strip().lower()
        if len(value_clean) < 10 or value_clean in GENERIC_LABELS:
            return match.group(0)
        if len(set(value_clean)) <= 1:
            return match.group(0)
        if (len(set(value_clean)) / len(value_clean)) < 0.3:
            return match.group(0)
    return 'XXXX'

def mask_pii(text: str) -> str:
    """
    Returns a version of the input text with any detected PII masked.
    Only regex-based detection is used in this implementation.
    """
    if not contains_pii(text):
        return text

    result = text
    for key, pattern in compiled_patterns.items():
        if isinstance(pattern, list):
            for p in pattern:
                result = p.sub(lambda m: _mask_replacement(m, key), result)
        else:
            result = pattern.sub(lambda m: _mask_replacement(m, key), result)
    return result
