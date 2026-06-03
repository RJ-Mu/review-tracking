"""
review_db.py
Data-access layer for the review-tracking app.

Small reusable functions that wrap the SQL, so the rest of the app
(UI, import/export) can just call add_entry(...) / get_entries(...)
without writing SQL itself.
"""

import json
import psycopg2

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


def main():
    """Demo: build a category, add one entry, read it back."""
    conn = get_connection()
    try:
        # Set up a category and its extra columns
        cat_id = add_category(conn, "Movies")
        add_category_column(conn, cat_id, "director", "text", 1)
        add_category_column(conn, cat_id, "year", "number", 2)

        # Add one review
        add_entry(
            conn,
            category_id=cat_id,
            title="Barbie",
            rating=7.5,
            reviewed_on="2024-01-15",
            data={"director": "Greta Gerwig", "year": 2023},
        )

        # Nothing above is permanent until we commit (see notes in chat)
        conn.commit()

        # Read it back
        rows = get_entries(conn, cat_id)
        print(f"Found {len(rows)} entry/entries in category {cat_id}:")
        for entry_id, title, rating, reviewed_on, data in rows:
            print(
                f"  #{entry_id}: {title} ({rating}/10), "
                f"reviewed {reviewed_on}, "
                f"director={data.get('director')}, year={data.get('year')}"
            )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
