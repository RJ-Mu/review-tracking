"""
cli.py
Command-line interface for the review-tracking app.

This is the presentation layer: the part whose only job is to talk to a
human. It reads what the user types, calls the matching review_db function,
and prints what comes back. It never writes SQL itself — every database
touch goes through review_db.

Dependency direction: cli.py imports review_db; review_db never imports
cli.py. The data layer doesn't know this file exists, which is exactly why
it could be built and tested first.

Scope (for now): read-only. List categories, pick one, show its entries.
Adding / editing / deleting come later as extra menu branches calling
functions that already exist in review_db.
"""

import review_db
import datetime


# ---------------------------------------------------------------------------
# Screens
# ---------------------------------------------------------------------------
# Each "screen" is one menu action pulled out into its own function. The loop
# below stays short and readable, and each piece can be understood on its own.

def list_categories(conn):
    """Print every category as 'id: name'."""
    # get_categories returns a list of (id, name) tuples. We unpack each tuple
    # so we can format it nicely instead of printing the raw "(2, 'Movies')".
    for category_id, name in review_db.get_categories(conn):
        print(f"{category_id}: {name}")


def view_entries(conn):
    """Ask for a category id, then print that category's entries."""
    # input() ALWAYS returns a string, so "2" comes back as text, not the
    # number 2. get_entries expects an int for category_id, so we convert.
    raw = input("category id: ")
    category_id = int(raw)

    # get_entries returns (id, title, rating, reviewed_on, data) tuples.
    # `data` is the JSONB bag, already handed back as a Python dict.
    entries = review_db.get_entries(conn, category_id)

    if not entries:
        print("(no entries for that category)")
        return

    for entry_id, title, rating, reviewed_on, data in entries:
        print(f"{entry_id}: {title}  (rating: {rating}, reviewed: {reviewed_on})")
        print(f"     extra: {data}")


def add_entry(conn):
    """Prompt for one new entry's fields, insert it, and commit."""
    # Category first: it's what decides which extra fields we ask for below.
    category_id = int(input("category id: "))

    title = input("title: ")

    # input() gives a string; the rating column is numeric, so convert.
    # round(..., 1) keeps it to one decimal place.
    rating = round(float(input("rating: ")), 1)

    # The column is a DATE, so date.today() (no time component) fits cleanly.
    reviewed_on = datetime.date.today()

    # Ask for each category-specific field and collect them into a DICT
    # keyed by column name — that's the shape review_db.add_entry expects
    # for the JSONB `data` bag. (data_type is unused for now; it's what
    # you'd reach for later to validate or convert each value.)
    data = {}
    for col_name, data_type in review_db.get_category_columns(conn, category_id):
        data[col_name] = input(f"{col_name}: ")

    # Writes don't take effect until commit — the new wrinkle versus the
    # read-only screens, which needed none.
    new_id = review_db.add_entry(conn, category_id, title, rating, reviewed_on, data)
    conn.commit()
    print(f"added entry #{new_id}")





# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main():
    """
    Run the menu loop until the user quits.

    The connection lives here, opened once at the top and closed once in the
    `finally` — the same wrapper pattern as review_db's main(). The loop runs
    inside the try, so no matter how it ends (quit, or an error), the
    connection still gets closed on the way out.
    """
    conn = review_db.get_connection()
    try:
        while True:
            # 1. Show the options.
            print("\n--- review tracker ---")
            print("1) list categories")
            print("2) view a category's entries")
            print("3) add an entry")
            print("q) quit")

            # 2. Read the choice. .strip() drops stray spaces / the newline.
            choice = input("> ").strip()

            # 3. Branch to the matching action.
            if choice == "1":
                list_categories(conn)
            elif choice == "2":
                view_entries(conn)
            elif choice == "3":
                add_entry(conn)
            elif choice == "q":
                break  # 4. the only way out of the loop
            else:
                print("didn't recognize that — try again")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
