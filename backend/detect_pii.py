import re

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    HAS_SPACY = True
except Exception as e:
    HAS_SPACY = False

# Regex patterns for various PII entities.
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
    # "date": [
    #     r"\b(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12][0-9]|3[01])[-/](?:\d{4}|\d{2})\b",  # MM/DD/YYYY or MM/DD/YY
    #     r"\b(?:0[1-9]|[12][0-9]|3[01])[-/](?:0[1-9]|1[0-2])[-/](?:\d{4}|\d{2})\b",  # DD/MM/YYYY or DD/MM/YY
    #     r"\b\d{4}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12][0-9]|3[01])\b",            # YYYY/MM/DD or YYYY-MM-DD
    #     r"\b\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}\b",                                  # 1st January 2024
    #     r"\b\w+\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}\b",                                  # January 31, 2024
    #     r"\b\w{3}\s+\d{1,2},\s+\d{4}\b",                                               # Jan 31, 2024
    #     r"\b\d{1,2}\s+\w{3}\s+\d{4}\b",                                                 # 31 Jan 2024
    #     r"\b\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}\s+\d{1,2}:\d{2}\b",                   # 1st January 2024 14:30
    #     r"\b\w+\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\b",                                 # January 31, 2024 2:30 PM
    #     r"\b\d{4}-\d{1,2}-\d{1,2}T\d{1,2}:\d{2}:\d{2}Z\b",                             # ISO 8601 Format
    # ],
    "money": [
        r'\{\$?\d+(?:\.\d{2})?\$?\}',
        r'(?:\$\s?\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s?\$)'
    ],
    "ssn_tin": r"\b\d{3}-\d{2}-\d{4}\b",
    "ein": r"\b\d{2}-\d{7}\b",
    "passport_number": r"\b[A-Z]{1}\d{7}\b",
    "email_address": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    "phone_number": [
        r"\+?\b(?:1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)?[2-9]\d{2}[-.\s]?\d{4}\b",
        r"\b\d{10}\b",
        r"\b\(\d{3}\)\s?\d{3}[-.\s]?\d{4}\b",
        r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
    ],
    # A simplified (and admittedly generic) date-of-birth pattern.
    "dates_of_birth": r"\b(?:\d{1,2}[-/])?(?:\d{1,2}[-/])?\d{2,4}\b",
    "home_address": r"\b\d{1,9},\s[\w\s]+,\s[\w\s]+,\s[A-Z]{2}\s\d{5}(?:-\d{4})?\b",
    "race": r"\b(?:White|Black|Asian|Native American|Pacific Islander|Multiracial|Biracial)\b",
    "ethnicity": r"\b(?:Hispanic|Latino|Latinx|African American|Caucasian|Arab|Jewish|Slavic|Celtic|Germanic|Scandinavian|Mediterranean|Ashkenazi|Sephardic)\b",
    # Credential/token patterns now use capturing groups for the value.
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

def contains_pii(text):

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


    if HAS_SPACY:
        doc = nlp(text)
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                ent_text = ent.text.strip().lower()
  
                if ent_text in GENERIC_LABELS or len(ent_text) < 4:
                    continue

                if len(ent_text.split()) < 2:
                    continue

                if any(term in ent_text for term in ["api", "openai", "key"]):
                    continue
                return True

    return False
