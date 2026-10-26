import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import Base, engine, SessionLocal
from app.routers import (
    auth_routes,
    student_routes,
    course_routes,
    quiz_routes,
    task_routes,
    leaderboard_routes,
    rating_routes,
    peer_routes,
    revaluation_routes,
    collab_routes
)
from app import models, collab_models, auth

from sqlalchemy import text

# Initialize DB tables and idempotent column additions
Base.metadata.create_all(bind=engine)
try:
    with engine.connect() as conn:
        for stmt in [
            "ALTER TABLE task_submissions ADD COLUMN auto_eval_score FLOAT",
            "ALTER TABLE task_submissions ADD COLUMN auto_eval_explanation TEXT",
            "ALTER TABLE task_submissions ADD COLUMN auto_eval_confidence VARCHAR(20)",
            "ALTER TABLE task_submissions ADD COLUMN auto_eval_details TEXT",
            "ALTER TABLE task_submissions ADD COLUMN is_calibrated BOOLEAN DEFAULT FALSE",
            "ALTER TABLE task_submissions ADD COLUMN pre_check_count INTEGER DEFAULT 0",
            "ALTER TABLE peer_queries ADD COLUMN heading VARCHAR(255)"
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass
except Exception:
    pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS middleware for React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import FileResponse

# Static Assets & Frontend SPA Configuration
FRONTEND_DIST = os.path.join(settings.BASE_DIR, "frontend", "dist")

if os.path.exists(FRONTEND_DIST) and os.path.exists(os.path.join(FRONTEND_DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")
elif os.path.exists(settings.ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=settings.ASSETS_DIR), name="assets")

# Include Routers
app.include_router(auth_routes.router, prefix=settings.API_V1_STR)
app.include_router(student_routes.router, prefix=settings.API_V1_STR)
app.include_router(course_routes.router, prefix=settings.API_V1_STR)
app.include_router(quiz_routes.router, prefix=settings.API_V1_STR)
app.include_router(task_routes.router, prefix=settings.API_V1_STR)
app.include_router(leaderboard_routes.router, prefix=settings.API_V1_STR)
app.include_router(rating_routes.router, prefix=settings.API_V1_STR)
app.include_router(peer_routes.router, prefix=settings.API_V1_STR)
app.include_router(revaluation_routes.router, prefix=settings.API_V1_STR)
app.include_router(collab_routes.router, prefix=settings.API_V1_STR)

if os.path.exists(FRONTEND_DIST):
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return None
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {
            "status": "online",
            "system": "Learn Loop - Adaptive Gamified LMS",
            "documentation": "/docs"
        }
else:
    @app.get("/")
    def root():
        return {
            "status": "online",
            "system": "Learn Loop - Adaptive Gamified LMS",
            "documentation": "/docs"
        }

# Seed sample instructor and course on startup if none exists
@app.on_event("startup")
def seed_initial_data():
    db = SessionLocal()
    try:
        teacher = db.query(models.Teacher).first()
        if not teacher:
            teacher = models.Teacher(
                employee_id="TCE_FAC_001",
                name="Dr. Scholar Lead",
                gender="female",
                department="Computer Science & Engineering",
                email="teacher@tce.edu",
                password_hash=auth.get_password_hash("password123")
            )
            db.add(teacher)
            db.commit()
            db.refresh(teacher)

            # Create default Python course with custom Join Code
            course = models.Course(
                title="Advanced Data Structures & Algorithms",
                description="Master Trees, Graphs, Dynamic Programming, and Recursion with personalized gamification.",
                join_code="DSA2026",
                teacher_id=teacher.id,
                allowed_compilers=["python", "c", "cpp", "java"],
                w1_quiz_weight=0.5,
                w2_task_weight=0.5,
                passing_threshold_p=5.0
            )
            db.add(course)
            db.commit()
            db.refresh(course)

            # Module 1
            m1 = models.Module(
                course_id=course.id,
                module_no=1,
                concept_name="Recursion & Backtracking",
                complexity_cmc=1
            )
            db.add(m1)
            db.commit()
            db.refresh(m1)

            # 3 Tiers of Study Material (Slow/Basic, Average/Intermediate, Fast/Advanced)
            db.add(models.StudyMaterial(
                module_id=m1.id,
                learning_level="slow",
                title="Recursion Fundamentals: Stepper Guide",
                content_html="<h3>Welcome Stepper!</h3><p>A recursive function is a function that calls itself with a base case to prevent infinite loops. Step-by-step trace: <code>factorial(3) = 3 * factorial(2)</code>.</p>"
            ))
            db.add(models.StudyMaterial(
                module_id=m1.id,
                learning_level="average",
                title="Recursion Trees & Call Stacks: Jogger Guide",
                content_html="<h3>Welcome Jogger!</h3><p>Understand the call stack frames, recursive branching factor, and recurrence relations like T(n) = 2T(n/2) + O(n).</p>"
            ))
            db.add(models.StudyMaterial(
                module_id=m1.id,
                learning_level="fast",
                title="Advanced Memoization & Tail Recursion: Glider Guide",
                content_html="<h3>Welcome Glider!</h3><p>Optimize deep recursion using compiler tail-call elimination, state-space tree pruning, and memoization arrays.</p>"
            ))

            # 10 Questions across Easy, Medium, Hard with explanations
            questions = [
                # Easy
                ("slow", "What is the primary stopping condition in recursion called?", "Base Case", "Stop Case", "Break Flag", "Pivot", "A", "Look for the condition where recursion stops.", "The base condition terminates further recursive calls."),
                ("slow", "Which data structure is implicitly used by recursion?", "Stack", "Queue", "Heap", "Tree", "A", "Think of Last-In-First-Out function calls.", "The runtime call stack keeps track of active frames."),
                ("slow", "What happens if a recursive function lacks a base case?", "Stack Overflow", "Faster code", "Compilation Error", "Zero division", "A", "Infinite calls exhaust memory.", "Without a base case, calls continue until the stack overflows."),
                ("slow", "In factorial(n), what is the base case when n=0?", "1", "0", "-1", "undefined", "A", "Factorial of 0 is mathematically defined as 1.", "0! = 1."),
                # Medium
                ("average", "What is the time complexity of naive Fibonacci recursion?", "O(2^n)", "O(n)", "O(n log n)", "O(1)", "A", "Each call generates two subcalls.", "The recursion tree doubles at every level yielding O(2^n)."),
                ("average", "Which technique prevents redundant recursive calculations?", "Memoization", "Overclocking", "Garbage collection", "Typecasting", "A", "Caching previously computed subproblem results.", "Memoization stores intermediate results."),
                ("average", "What is tail recursion?", "Recursive call is the last operation", "Calls are inside a loop", "Returns multiple values", "Runs in O(1) space always", "A", "No computation remains after returning from recursive call.", "Tail calls allow compiler stack frame reuse."),
                # Hard
                ("fast", "What is the space complexity of quicksort in the worst case recursion?", "O(n)", "O(log n)", "O(1)", "O(n^2)", "A", "Consider an already sorted array with poor pivot.", "Worst case partitioning creates a degenerate tree of height n."),
                ("fast", "How many recursive calls are made by Tower of Hanoi with n discs?", "2^n - 1", "n^2", "2n", "n!", "A", "Recurrence T(n) = 2T(n-1) + 1.", "Solving yields 2^n - 1 total moves."),
                ("fast", "In Master Theorem, T(n)=2T(n/2)+n belongs to which case?", "Case 2 (Theta(n log n))", "Case 1", "Case 3", "Inapplicable", "A", "Compare log_b(a) with exponent of f(n).", "log_2(2) = 1, matches n^1 -> Theta(n log n).")
            ]

            for cat, q_txt, a, b, c, d, corr, hnt, exp in questions:
                db.add(models.QuizQuestion(
                    module_id=m1.id,
                    cognitive_level=cat,
                    target_pt_ls="Universal",
                    blooms_level="Applying",
                    question_text=q_txt,
                    option_a=a,
                    option_b=b,
                    option_c=c,
                    option_d=d,
                    correct_option=corr,
                    hint_text=hnt,
                    explanation=exp
                ))

            # Task Challenges for Basic, Intermediate, Advanced
            db.add(models.TaskChallenge(
                module_id=m1.id,
                complexity_qlc="basic",
                task_type="programming",
                title="Basic: Implement Recursive Sum of Digits",
                problem_statement="Write a function `sum_of_digits(n)` that returns the sum of digits of a non-negative integer `n` recursively.\nExample: 1234 -> 1+2+3+4 = 10.",
                starter_code={
                    "python": "def sum_of_digits(n):\n    # Write your recursive code here\n    if n == 0:\n        return 0\n    return (n % 10) + sum_of_digits(n // 10)\n\nprint(sum_of_digits(1234))\n",
                    "c": "#include <stdio.h>\nint sum_digits(int n) {\n    if (n == 0) return 0;\n    return (n % 10) + sum_digits(n / 10);\n}\nint main() {\n    printf(\"%d\\n\", sum_digits(1234));\n    return 0;\n}\n"
                },
                max_marks=100
            ))

            db.add(models.TaskChallenge(
                module_id=m1.id,
                complexity_qlc="intermediate",
                task_type="programming",
                title="Intermediate: Recursive String Permutations",
                problem_statement="Write a program to generate all unique permutations of a string recursively.",
                starter_code={
                    "python": "def permute(s, ans=''):\n    if len(s) == 0:\n        print(ans)\n        return\n    for i in range(len(s)):\n        ch = s[i]\n        left = s[0:i]\n        right = s[i+1:]\n        permute(left + right, ans + ch)\n\npermute('ABC')\n"
                },
                max_marks=100
            ))

            db.add(models.TaskChallenge(
                module_id=m1.id,
                complexity_qlc="advanced",
                task_type="programming",
                title="Advanced: N-Queens Backtracking Solver",
                problem_statement="Implement the classic N-Queens puzzle solver using recursive backtracking to place N queens on an NxN chessboard without conflicts.",
                starter_code={
                    "python": "def solve_n_queens(n):\n    # Implement backtracking\n    pass\n"
                },
                max_marks=100
            ))

            db.commit()

        # -------------------------------------------------------------
        # Ensure Collaborative Test Squad Accounts & Course Enrollment Exist
        # -------------------------------------------------------------
        test_teacher = db.query(models.Teacher).filter(models.Teacher.email == "teacher@tce.edu").first()
        if not test_teacher:
            test_teacher = models.Teacher(
                employee_id="TCE_FAC_001",
                name="Dr. Scholar Lead",
                gender="female",
                department="Computer Science & Engineering",
                email="teacher@tce.edu",
                password_hash=auth.get_password_hash("password123")
            )
            db.add(test_teacher)
            db.commit()
            db.refresh(test_teacher)
        elif not auth.verify_password("password123", test_teacher.password_hash):
            test_teacher.password_hash = auth.get_password_hash("password123")
            db.commit()

        default_course = db.query(models.Course).first()

        test_students_spec = [
            ("26STU001", "Vikas (Visionary)", "visionary@student.tce.edu", "Visionaries", "average", "male"),
            ("26STU002", "Pooja (Pioneer)", "pioneer@student.tce.edu", "Pioneers", "fast", "female"),
            ("26STU003", "Mohan (Mentor)", "mentor@student.tce.edu", "Mentors", "slow", "male"),
            ("26STU004", "Charan (Conqueror)", "conqueror@student.tce.edu", "Conquerors", "average", "male"),
        ]

        for regno, sname, semail, pt, cog, sgender in test_students_spec:
            stu = db.query(models.Student).filter(models.Student.email == semail).first()
            if not stu:
                stu = models.Student(
                    regno=regno,
                    name=sname,
                    email=semail,
                    gender=sgender,
                    department="Computer Science & Engineering",
                    password_hash=auth.get_password_hash("password123"),
                    form_submission=True,
                    pt_ls=pt,
                    ppt=pt,
                    cognitive_level=cog,
                    hearts=5,
                    total_coins=100,
                    total_keys=5
                )
                db.add(stu)
                db.commit()
                db.refresh(stu)
            else:
                if not auth.verify_password("password123", stu.password_hash):
                    stu.password_hash = auth.get_password_hash("password123")
                    db.commit()

            if default_course:
                enrolled = db.query(models.CourseEnrollment).filter(
                    models.CourseEnrollment.student_id == stu.id,
                    models.CourseEnrollment.course_id == default_course.id
                ).first()
                if not enrolled:
                    db.add(models.CourseEnrollment(student_id=stu.id, course_id=default_course.id))
                    db.commit()
    finally:
        db.close()
