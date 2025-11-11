import psycopg2
from psycopg2 import sql
import os
from dotenv import load_dotenv

def get_pg_connection():
    load_dotenv()
    
    # Check for DATABASE_URL first (preferred for production/cloud deployments)
    database_url = os.getenv("DATABASE_URL")
    
    if database_url:
        # Parse the database URL
        # Handle both postgres:// and postgresql:// schemes
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
        try:
            return psycopg2.connect(database_url)
        except Exception as e:
            raise RuntimeError(f"Failed to connect using DATABASE_URL: {str(e)}")
    
    # Fall back to individual environment variables (for backward compatibility)
    dbname = os.getenv("PGDATABASE")
    user = os.getenv("PGUSER")
    password = os.getenv("PGPASSWORD")
    host = os.getenv("PGHOST")
    port = os.getenv("PGPORT")

    missing = [
        name for name, val in (
            ("PGDATABASE", dbname),
            ("PGUSER", user),
            ("PGPASSWORD", password),
            ("PGHOST", host),
            ("PGPORT", port),
        ) if not val
    ]
    if missing:
        raise RuntimeError(
            f"Missing required environment variables. "
            f"Either set DATABASE_URL or set all of: {', '.join(missing)}. "
            f"Ensure they are set in your .env file."
        )
    return psycopg2.connect(dbname=dbname, user=user, password=password, host=host, port=port)

def create_table_if_not_exists(conn, table_name):
    with conn.cursor() as cursor:
        # Ensure case-insensitive text type is available
        cursor.execute("CREATE EXTENSION IF NOT EXISTS citext;")
        create_query = sql.SQL(
            """
            CREATE TABLE IF NOT EXISTS {table} (
                id SERIAL PRIMARY KEY,
                question CITEXT UNIQUE,
                explanation TEXT
            );
            """
        ).format(table=sql.Identifier(table_name))
        cursor.execute(create_query)
def insert_qna_rows(table_name, qna_rows):
    if not qna_rows:
        return
    conn = get_pg_connection()
    try:
        create_table_if_not_exists(conn, table_name)
        insert_query = sql.SQL(
            "INSERT INTO {table} (question, explanation) VALUES (%s, %s) ON CONFLICT (question) DO NOTHING"
        ).format(table=sql.Identifier(table_name))
        with conn.cursor() as cursor:
            cursor.executemany(insert_query.as_string(conn), qna_rows)
        conn.commit()
    finally:
        conn.close()

def create_users_table():
    """Create users table for authentication if it doesn't exist"""
    conn = get_pg_connection()
    try:
        with conn.cursor() as cursor:
            # Ensure case-insensitive text type is available
            cursor.execute("CREATE EXTENSION IF NOT EXISTS citext;")
            
            create_query = """
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email CITEXT UNIQUE NOT NULL,
                    password_hash VARCHAR(255),
                    full_name VARCHAR(255) NOT NULL,
                    student_id VARCHAR(100),
                    phone VARCHAR(20),
                    is_verified BOOLEAN DEFAULT FALSE,
                    verification_code VARCHAR(6),
                    verification_expires TIMESTAMP,
                    reset_token VARCHAR(6),
                    reset_expires TIMESTAMP,
                    google_id VARCHAR(255) UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE
                );
            """
            cursor.execute(create_query)
            conn.commit()
            return True, None
    except Exception as e:
        return False, str(e)
    finally:
        conn.close()

__all__ = [
    "get_pg_connection",
    "create_table_if_not_exists",
    "insert_qna_rows",
    "create_users_table",
]
