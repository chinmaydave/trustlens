import os
import socket
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

import psycopg2
from psycopg2 import OperationalError
from dotenv import load_dotenv

load_dotenv()

def normalize_sslmode(url: str) -> str:
    """Ensure sslmode=require is present."""
    if not url:
        return url
    parsed = urlparse(url)
    q = dict(parse_qsl(parsed.query))
    if q.get("sslmode") is None:
        q["sslmode"] = "require"
    new_query = urlencode(q)
    return urlunparse(parsed._replace(query=new_query))

def hostname_from_url(url: str):
    """Extract hostname from a URL safely."""
    try:
        return urlparse(url).hostname
    except Exception:
        return None

def mask_password(url: str) -> str:
    """Hide password when printing connection strings."""
    if not url:
        return url
    p = urlparse(url)
    if p.password:
        netloc = p.netloc.replace(p.password, "*****")
        p = p._replace(netloc=netloc)
    return urlunparse(p)

def check_dns(host: str):
    """Check if hostname resolves to an IP."""
    try:
        ip = socket.gethostbyname(host)
        return True, ip
    except Exception as e:
        return False, repr(e)

def try_connect(url: str, label: str) -> bool:
    """Try to connect and print results."""
    url = normalize_sslmode(url)
    print(f"\n🔗 {label} URL: {mask_password(url)}")
    host = hostname_from_url(url)
    if not host:
        print("❌ Could not parse hostname from URL.")
        return False

    ok, info = check_dns(host)
    if not ok:
        print(f"❌ DNS failed for {host}: {info}")
        return False
    else:
        print(f"✅ DNS ok: {host} → {info}")

    try:
        with psycopg2.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                version = cur.fetchone()[0]
                print("✅ Database connection successful!")
                print("PostgreSQL version:", version)
                return True
    except OperationalError as e:
        print("❌ Connection failed (OperationalError):", repr(e))
    except Exception as e:
        print("❌ Connection failed:", repr(e))
    return False

def main():
    direct = os.getenv("DATABASE_URL", "").strip()
    pooler = os.getenv("DATABASE_POOLER_URL", "").strip()

    tried_any = False
    if direct:
        tried_any = True
        if try_connect(direct, "Direct"):
            return

    if pooler:
        tried_any = True
        print("\n— Trying Pooler as fallback —")
        if try_connect(pooler, "Pooler"):
            return

    if not tried_any:
        print("❌ No DATABASE_URL (or DATABASE_POOLER_URL) found in .env")
    else:
        print("\n⚠️ Still failing. Checklist:")
        print("  1) Re-copy URI from Supabase (Settings → Database → Connection string).")
        print("  2) Ensure project ref in hostname matches your project.")
        print("  3) If 5432 is blocked, add Pooler URI (port 6543) as DATABASE_POOLER_URL.")
        print("  4) Keep special chars in password only inside .env (don’t export via shell).")

if __name__ == "__main__":
    main()

