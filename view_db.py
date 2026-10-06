import os
import sys
import pandas as pd
from sqlalchemy import create_engine, text

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, "backend"))

from app.config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(db_url)

def print_header(title):
    print("\n" + "=" * 90)
    print(f"  {title.upper()}")
    print("=" * 90)

def display_table(query, title):
    try:
        with engine.connect() as conn:
            df = pd.read_sql_query(text(query), conn)
            print_header(title)
            if df.empty:
                print("  (No records found in this table yet)")
            else:
                pd.set_option('display.max_columns', None)
                pd.set_option('display.width', 1000)
                pd.set_option('display.colheader_justify', 'left')
                print(df.to_string(index=False))
                print(f"\nTotal records: {len(df)}")
    except Exception as e:
        print(f"[Error querying database]: {e}")

def view_students():
    query = """
        SELECT id, name, regno, gender, email, pt_ls, cognitive_level, 
               total_coins as coins, hearts, total_keys as keys, form_submission 
        FROM students
    """
    display_table(query, "Registered Students & Archetype Profiles")

def view_teachers():
    query = """
        SELECT id, name, employee_id, gender, department, email 
        FROM teachers
    """
    display_table(query, "Registered Teachers & Faculty")

def view_courses():
    query = """
        SELECT c.id, c.title, c.join_code, t.name as instructor_name, c.created_at
        FROM courses c
        LEFT JOIN teachers t ON c.teacher_id = t.id
    """
    display_table(query, "Courses & Custom Join Codes")

def view_quizzes():
    query = """
        SELECT qs.id, s.name as student_name, s.regno, qs.msq_score, qs.ttq_seconds, 
               qs.mistake_category_hit as hit_type, qs.coq_predicted as model2_coq_internal, qs.submitted_at
        FROM quiz_submissions qs
        JOIN students s ON qs.student_id = s.id
        ORDER BY qs.submitted_at DESC
    """
    display_table(query, "Quiz Submissions & Model 2 (COQ) Results")

def view_tasks():
    query = """
        SELECT ts.id, s.name as student_name, s.regno, ts.programming_language, 
               ts.mst_score, ts.teacher_feedback, ts.evaluated_at, ts.submitted_at
        FROM task_submissions ts
        JOIN students s ON ts.student_id = s.id
        ORDER BY ts.submitted_at DESC
    """
    display_table(query, "Task Submissions & Faculty Grading")

def view_leaderboard_states():
    query = """
        SELECT lms.id, s.name as student_name, s.regno, lms.cmc as module_no, 
               lms.msq, lms.mst, lms.tp_total_performance as total_points, 
               lms.model4_output, lms.leaderboard_level as active_leaderboard_tier, 
               lms.level_streak_count, lms.completed_at
        FROM learner_module_states lms
        JOIN students s ON lms.student_id = s.id
        ORDER BY lms.completed_at DESC
    """
    display_table(query, "Model 4 Cognitive Updates (Leaderboard Tiers: Stepper / Jogger / Glider)")

def view_ratings():
    query = """
        SELECT er.id, s.name as student_name, er.rating_skipped, 
               er.r_feedback, er.r_leaderboard, er.r_badges, er.r_progressbar, er.r_mystery, er.r_rewards, er.created_at
        FROM element_ratings er
        JOIN students s ON er.student_id = s.id
        ORDER BY er.created_at DESC
    """
    display_table(query, "Element Ratings (Algorithm 3 Gamification Feedback)")

def view_badges():
    query = """
        SELECT ub.id, s.name as student_name, ub.badge_name, ub.tier, ub.archetype, ub.awarded_at
        FROM user_badges ub
        JOIN students s ON ub.student_id = s.id
        ORDER BY ub.awarded_at DESC
    """
    display_table(query, "Collectibles & Badges Earned (Associate / Professional / Master)")

def export_to_excel():
    print_header("Exporting All Database Tables to Excel")
    with engine.connect() as conn:
        if "postgresql" in str(engine.url):
            res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
            tables = [row[0] for row in res]
        else:
            res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))
            tables = [row[0] for row in res]

        excel_path = os.path.join(BASE_DIR, "learn_loop_database_export.xlsx")
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            for table in tables:
                df = pd.read_sql_query(text(f'SELECT * FROM "{table}"'), conn)
                sheet_name = table[:31]
                df.to_excel(writer, sheet_name=sheet_name, index=False)
                print(f"  [+] Exported table '{table}' ({len(df)} rows) to sheet '{sheet_name}'")

    print("\n" + "=" * 90)
    print(f"SUCCESS! Entire Database exported to:")
    print(f"--> {excel_path}")
    print("You can open this file anytime in Microsoft Excel to view or analyze your research data!")
    print("=" * 90)

def custom_sql_query():
    print_header("Custom SQL Query Runner")
    print("Example: SELECT name, regno, pt_ls, total_coins FROM students WHERE gender='female'")
    query = input("\nEnter your SQL query: ").strip()
    if query:
        display_table(query, f"Query Results: {query}")

def main_menu():
    db_type = "PostgreSQL (localhost:5432/learn_loop)" if "postgresql" in str(engine.url) else "SQLite"
    while True:
        print("\n" + "=" * 65)
        print("         LEARN LOOP - DATABASE VIEWER & SEARCH TOOL")
        print(f"  Database Engine: {db_type}")
        print("=" * 65)
        print("  [1] View Students & Archetype Classifications (PT_LS)")
        print("  [2] View Teachers & Faculty (Employee ID, Department)")
        print("  [3] View Courses & Join Codes")
        print("  [4] View Quiz Performance & Model 2 (COQ) Outputs")
        print("  [5] View Coding Task Submissions & Faculty Grading")
        print("  [6] View Model 4 Leaderboard Tiers (Stepper/Jogger/Glider)")
        print("  [7] View Gamification Element Ratings (Algorithm 3)")
        print("  [8] View Badges & Collectibles Earned")
        print("  [9] Run Custom SQL Query (SELECT ...)")
        print("  [E] EXPORT Entire Database to Microsoft Excel (.xlsx)")
        print("  [0] Exit")
        print("-" * 65)
        
        choice = input("Enter your choice: ").strip().upper()
        
        if choice == '1':
            view_students()
        elif choice == '2':
            view_teachers()
        elif choice == '3':
            view_courses()
        elif choice == '4':
            view_quizzes()
        elif choice == '5':
            view_tasks()
        elif choice == '6':
            view_leaderboard_states()
        elif choice == '7':
            view_ratings()
        elif choice == '8':
            view_badges()
        elif choice == '9':
            custom_sql_query()
        elif choice == 'E':
            export_to_excel()
        elif choice == '0':
            print("\nExiting Database Viewer. Goodbye!\n")
            break
        else:
            print("\nInvalid choice. Please select from the menu.")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--export":
        export_to_excel()
    else:
        main_menu()
