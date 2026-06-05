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


# Valid types come straight from the CHECK constraint on category_columns.
# Keeping them here lets us reject a bad type before it hits the database.
VALID_DATA_TYPES = ("text", "number", "boolean", "date")


def create_category(conn):
    """Create a category, then prompt for its category-specific columns."""
    category_name = input("category name: ")
    if category_name == 'q':
        print("cancelled category creation")
        return

    # add_category already RETURNs the new id, so use it directly — no need
    # to turn around and re-fetch it with get_category_id.
    category_id = review_db.add_category(conn, category_name)

    # Guide for the loop below: the user keeps adding columns until they
    # signal they're done by entering 'q' as the column name.
    print("now add this category's columns — enter 'q' as the name to finish")

    pos = 1
    while True:
        column_name = input("column name (or 'q' to finish): ")
        if column_name == "q":
            break

        # Re-prompt until we get a valid type. Worth doing here (unlike the
        # crash-on-typo cases we deferred elsewhere) because everything in
        # this function shares ONE transaction: a rejected insert mid-loop
        # would poison it and we'd lose the whole category at commit time.
        column_datatype = input("data type (text / number / boolean / date): ")
        while column_datatype not in VALID_DATA_TYPES:
            print(f"  '{column_datatype}' isn't valid — pick one of {', '.join(VALID_DATA_TYPES)}")
            column_datatype = input("data type (text / number / boolean / date): ")

        review_db.add_category_column(conn, category_id, column_name, column_datatype, pos)
        pos += 1

    # One commit at the end makes the category and all its columns land
    # together — or, if you bailed before adding any, just the category.
    conn.commit()
    print(f"added category {category_name} (#{category_id})")

    



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
            print("c) create a category")
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
            elif choice == "c":
                create_category(conn)
            elif choice == "q":
                break  # 4. the only way out of the loop
            else:
                print("didn't recognize that — try again")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
