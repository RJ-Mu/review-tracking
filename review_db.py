"""
review_db.py
Data-access layer for the review-tracking app.

Small reusable functions that wrap the SQL, so the rest of the app
(UI, import/export) can just call add_entry(...) / get_entries(...)
without writing SQL itself.

Transaction note: none of these functions commit. The caller opens a
connection, calls one or more of these, and commits when ready. That lets
several changes be grouped into a single transaction, and keeps the
"when does it become permanent" decision in one place.
"""

import json
import psycopg2


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

# Local dev connection settings. Fine to hardcode for a local learning
# project; for anything real you'd read these from environment variables
# so the password never lives in the code.
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "reviewdb",
    "user": "postgres",
    "password": "postgres",
}


def get_connection():
    """Open a new connection to the database."""
    return psycopg2.connect(**DB_CONFIG)


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

def add_category(conn, name):
    """Create a category and return its new id."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO categories (name) VALUES (%s) RETURNING id;",
            (name,),
        )
        return cur.fetchone()[0]


def add_category_column(conn, category_id, name, data_type, position):
    """Register one category-specific column (the 'rulebook')."""
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO category_columns (category_id, name, data_type, position)
               VALUES (%s, %s, %s, %s) RETURNING id;""",
            (category_id, name, data_type, position),
        )
        return cur.fetchone()[0]


def get_category_id(conn, name):
    """Return the id for a category name, or None if no such category exists."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM categories WHERE name = %s;",
            (name,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return row[0]


def get_categories(conn):
    """Return all categories as a list of (id, name) rows."""
    with conn.cursor() as cur:
        cur.execute("SELECT id, name FROM categories ORDER BY id;")
        return cur.fetchall()


# ---------------------------------------------------------------------------
# Entries
# ---------------------------------------------------------------------------

def add_entry(conn, category_id, title, rating, reviewed_on, data):
    """
    Add one entry. `data` is a normal Python dict of the category-specific
    values; json.dumps turns it into JSON text for the JSONB column.
    """
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO entries (category_id, title, rating, reviewed_on, data)
               VALUES (%s, %s, %s, %s, %s) RETURNING id;""",
            (category_id, title, rating, reviewed_on, json.dumps(data)),
        )
        return cur.fetchone()[0]


def get_entries(conn, category_id):
    """
    Return all visible entries for a category as a list of rows.
    The JSONB `data` column comes back as a Python dict automatically.
    """
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, title, rating, reviewed_on, data
               FROM entries
               WHERE category_id = %s AND NOT is_hidden
               ORDER BY id;""",
            (category_id,),
        )
        return cur.fetchall()


def delete_entry(conn, entry_id):
    """Delete one entry by id. Returns the number of rows removed (0 or 1)."""
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM entries WHERE id = %s;",
            (entry_id,),
        )
        return cur.rowcount


# ---------------------------------------------------------------------------
# Scratchpad
# ---------------------------------------------------------------------------

def main():
    """
    Throwaway scratchpad for trying functions by hand.

    Runs only when you execute this file directly (python review_db.py).
    When a UI later does `import review_db`, this block does NOT run, so the
    library stays clean. Edit freely — nothing here is part of the real app.
    """
    conn = get_connection()
    try:
        # Read-only checks — safe to run as often as you like.
        print("Categories:", get_categories(conn))

        movies_id = get_category_id(conn, "Movies")
        print("Movies id:", movies_id)

        if movies_id is not None:
            print("Entries:", get_entries(conn, movies_id))

        # Destructive test — uncomment to try a delete. Remember: the commit
        # is what makes it stick; without it Postgres rolls the delete back.
        # removed = delete_entry(conn, 3)
        # print("Rows deleted:", removed)
        # conn.commit()

    finally:
        conn.close()


if __name__ == "__main__":
    main()
