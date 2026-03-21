"""
database/connection.py
DB connection config, get_conn(), and credential encryption helpers.
All other database modules import from here.
"""

import os
import psycopg2
from cryptography.fernet import Fernet, InvalidToken

DB_CONFIG = {
    'host':     os.environ.get('DB_HOST', 'db'),
    'port':     int(os.environ.get('DB_PORT', 5432)),
    'dbname':   os.environ.get('DB_NAME', 'kernexa'),
    'user':     os.environ.get('DB_USER', 'kernexa_user'),
    'password': os.environ.get('DB_PASSWORD', 'supersecret'),
}


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def _get_fernet() -> Fernet:
    key = os.environ.get('CREDENTIALS_KEY', '').strip()
    if not key:
        raise RuntimeError(
            "CREDENTIALS_KEY is not set in .env. "
            "Generate one with: python3 -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    try:
        return Fernet(key.encode())
    except Exception as e:
        raise RuntimeError(f"CREDENTIALS_KEY is invalid: {e}")


def encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception):
        return ciphertext