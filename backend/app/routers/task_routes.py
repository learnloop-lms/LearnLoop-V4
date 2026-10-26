import io
import csv
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.services.ai_engine import ai_engine
from app.services.compiler import run_code
from app.services.ai_answer_evaluator import (
    evaluate_programming_submission,
    evaluate_descriptive_submission,
    pre_check_programming_code
)
from app.services.gamification import (
    calculate_reward_coins,
    check_streak_and_promotion
)
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

router = APIRouter(prefix="/tasks", tags=["Task Challenges & Compiler"])

@router.get("/template/download")
def download_task_template(current_user = Depends(auth.get_current_user)):
    """
    Generates and downloads a clean, pre-formatted Excel template (.xlsx)
    for teachers to bulk upload task challenges (programming or descriptive).
    """
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Task Challenges"

    headers = [
        "title", "complexity_qlc", "task_type", "blooms_level", "target_pt_ls",
        "max_marks", "problem_statement", "starter_code", "test_cases", "is_locked_bonus"
    ]
    ws.append(headers)

    # Style header row (Dark purple/indigo for tasks)
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4C1D95", end_color="4C1D95", fill_type="solid")
    center_align = Alignment(horizontal="center", vertical="center")

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align

    # Add sample template rows
    sample_rows = [
        [
            "Find Maximum of Two Integers",
            "basic",
            "programming",
            "Applying",
            "Universal",
            100,
            "Write a program in C that reads two space-separated integers from standard input and prints the greater integer to standard output.",
            '#include <stdio.h>\n\nint main() {\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        printf("%d\\n", a > b ? a : b);\n    }\n    return 0;\n}',
            '[{"input": "10 20\\n", "expected_output": "20", "is_hidden": false}, {"input": "-5 -15\\n", "expected_output": "-5", "is_hidden": true}]',
            "No"
        ],
        [
            "Reverse Array In-Place",
            "intermediate",
            "programming",
            "Analyzing",
            "Mentors",
            100,
            "Write a C function to reverse an integer array of size N in-place without allocating auxiliary memory arrays.",
            '#include <stdio.h>\n\nvoid reverseArray(int arr[], int n) {\n    int i = 0, j = n - 1;\n    while (i < j) {\n        int t = arr[i];\n        arr[i] = arr[j];\n        arr[j] = t;\n        i++; j--;\n    }\n}',
            '[{"input": "5\\n1 2 3 4 5", "expected_output": "5 4 3 2 1", "is_hidden": false}]',
            "No"
        ],
        [
            "Stack vs Heap Memory Architecture Analysis",
            "advanced",
            "descriptive",
            "Evaluating",
            "Universal",
            100,
            "Explain the architectural differences between Stack and Heap memory in C programs. Discuss stack overflow limits, heap fragmentation, and automatic vs dynamic lifetimes.",
            "",
            "",
            "Yes"
        ]
    ]

    for row in sample_rows:
        ws.append(row)

    col_widths = {
        "A": 32, "B": 16, "C": 16, "D": 16, "E": 16,
        "F": 14, "G": 48, "H": 40, "I": 40, "J": 16
    }
    for col_letter, width in col_widths.items():
        ws.column_dimensions[col_letter].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    headers_response = {
        "Content-Disposition": "attachment; filename=learn_loop_task_template.xlsx"
    }
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers_response
    )

@router.post("/bulk-upload")
async def bulk_upload_task_challenges(
    module_id: str = Form(...),
    file: UploadFile = File(...),
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Parses an uploaded Excel (.xlsx) or CSV file and inserts all task challenges into the database.
    """
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    module = db.query(models.Module).filter(models.Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")

    filename = (file.filename or "").lower()
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    rows_data = []

    if filename.endswith(".xlsx") or filename.endswith(".xlsm"):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            if len(rows) < 2:
                raise HTTPException(status_code=400, detail="Excel file must contain a header row and at least one task.")
            
            raw_headers = [str(c).strip().lower() if c else "" for c in rows[0]]
            
            def get_col(name, alt_names=None):
                if name in raw_headers:
                    return raw_headers.index(name)
                if alt_names:
                    for alt in alt_names:
                        if alt in raw_headers:
                            return raw_headers.index(alt)
                return -1

            t_idx = get_col("title", ["task_title", "name", "problem_title"])
            comp_idx = get_col("complexity_qlc", ["complexity", "level", "qlc", "difficulty"])
            type_idx = get_col("task_type", ["type", "task type", "category"])
            bloom_idx = get_col("blooms_level", ["bloom", "blooms", "bloom_level"])
            pt_idx = get_col("target_pt_ls", ["pt_ls", "archetype", "target"])
            marks_idx = get_col("max_marks", ["marks", "max_score", "score"])
            prob_idx = get_col("problem_statement", ["problem", "description", "statement", "question", "task"])
            code_idx = get_col("starter_code", ["starter", "code", "template_code"])
            test_idx = get_col("test_cases", ["testcases", "tests", "test_cases_json"])
            bonus_idx = get_col("is_locked_bonus", ["locked_bonus", "bonus", "mystery", "is_mystery"])

            if t_idx == -1 or prob_idx == -1:
                raise HTTPException(status_code=400, detail="Missing required columns: title, problem_statement.")

            for r in rows[1:]:
                if not r or not any(r):
                    continue
                title_val = str(r[t_idx]).strip() if t_idx < len(r) and r[t_idx] is not None else ""
                prob_val = str(r[prob_idx]).strip() if prob_idx < len(r) and r[prob_idx] is not None else ""
                if not title_val or not prob_val:
                    continue

                rows_data.append({
                    "title": title_val,
                    "problem_statement": prob_val,
                    "complexity_qlc": str(r[comp_idx]).strip() if comp_idx != -1 and comp_idx < len(r) and r[comp_idx] is not None else "basic",
                    "task_type": str(r[type_idx]).strip() if type_idx != -1 and type_idx < len(r) and r[type_idx] is not None else "programming",
                    "blooms_level": str(r[bloom_idx]).strip() if bloom_idx != -1 and bloom_idx < len(r) and r[bloom_idx] is not None else "Applying",
                    "target_pt_ls": str(r[pt_idx]).strip() if pt_idx != -1 and pt_idx < len(r) and r[pt_idx] is not None else "Universal",
                    "max_marks": r[marks_idx] if marks_idx != -1 and marks_idx < len(r) and r[marks_idx] is not None else 100,
                    "starter_code": str(r[code_idx]).strip() if code_idx != -1 and code_idx < len(r) and r[code_idx] is not None else "",
                    "test_cases": str(r[test_idx]).strip() if test_idx != -1 and test_idx < len(r) and r[test_idx] is not None else "",
                    "is_locked_bonus": str(r[bonus_idx]).strip() if bonus_idx != -1 and bonus_idx < len(r) and r[bonus_idx] is not None else "No"
                })
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")

    elif filename.endswith(".csv"):
        try:
            text = contents.decode("utf-8", errors="ignore")
            reader = csv.DictReader(io.StringIO(text))
            for row in reader:
                clean_row = {k.strip().lower(): v for k, v in row.items() if k}
                title_val = (clean_row.get("title") or clean_row.get("task_title") or clean_row.get("name") or "").strip()
                prob_val = (clean_row.get("problem_statement") or clean_row.get("problem") or clean_row.get("description") or "").strip()
                if not title_val or not prob_val:
                    continue

                rows_data.append({
                    "title": title_val,
                    "problem_statement": prob_val,
                    "complexity_qlc": (clean_row.get("complexity_qlc") or clean_row.get("complexity") or clean_row.get("level") or "basic").strip(),
                    "task_type": (clean_row.get("task_type") or clean_row.get("type") or "programming").strip(),
                    "blooms_level": (clean_row.get("blooms_level") or clean_row.get("bloom") or "Applying").strip(),
                    "target_pt_ls": (clean_row.get("target_pt_ls") or clean_row.get("pt_ls") or "Universal").strip(),
                    "max_marks": clean_row.get("max_marks") or clean_row.get("marks") or 100,
                    "starter_code": (clean_row.get("starter_code") or clean_row.get("code") or "").strip(),
                    "test_cases": (clean_row.get("test_cases") or clean_row.get("tests") or "").strip(),
                    "is_locked_bonus": (clean_row.get("is_locked_bonus") or clean_row.get("bonus") or "No").strip()
                })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Only .xlsx (Excel) and .csv files are supported.")

    if not rows_data:
        raise HTTPException(status_code=400, detail="No valid task challenges found in file.")

    created = []
    for item in rows_data:
        comp = item["complexity_qlc"].lower()
        if comp in ["easy", "slow", "basic"]:
            comp = "basic"
        elif comp in ["medium", "average", "intermediate"]:
            comp = "intermediate"
        elif comp in ["hard", "fast", "advanced"]:
            comp = "advanced"
        else:
            comp = "basic"

        tt = item["task_type"].lower()
        if "desc" in tt:
            tt = "descriptive"
        else:
            tt = "programming"

        try:
            marks = int(item["max_marks"])
        except Exception:
            marks = 100

        raw_code = item["starter_code"]
        starter_dict = None
        if raw_code:
            if raw_code.startswith("{") and raw_code.endswith("}"):
                try:
                    starter_dict = json.loads(raw_code)
                except Exception:
                    starter_dict = {"default": raw_code, "c": raw_code}
            else:
                starter_dict = {"default": raw_code, "c": raw_code}

        raw_tests = item["test_cases"]
        test_cases_list = None
        if raw_tests:
            if raw_tests.startswith("[") and raw_tests.endswith("]"):
                try:
                    test_cases_list = json.loads(raw_tests)
                except Exception:
                    test_cases_list = None
            if not test_cases_list:
                cases = []
                for chunk in raw_tests.split(";"):
                    if "|" in chunk:
                        parts = chunk.split("|")
                        inp = parts[0].replace("Input:", "").strip()
                        outp = parts[1].replace("Output:", "").strip()
                        cases.append({"input": inp, "expected_output": outp, "is_hidden": False})
                if cases:
                    test_cases_list = cases
                elif raw_tests.strip():
                    test_cases_list = [{"input": raw_tests.strip(), "expected_output": "", "is_hidden": False}]

        is_bonus = str(item["is_locked_bonus"]).strip().lower() in ["yes", "true", "1", "y", "t", "bonus"]

        task = models.TaskChallenge(
            module_id=module_id,
            complexity_qlc=comp,
            target_pt_ls=item["target_pt_ls"] or "Universal",
            blooms_level=item["blooms_level"] or "Applying",
            task_type=tt,
            title=item["title"],
            problem_statement=item["problem_statement"],
            starter_code=starter_dict,
            test_cases=test_cases_list,
            max_marks=marks,
            is_locked_bonus=is_bonus
        )
        db.add(task)
        created.append(task)

    db.commit()

    return {
        "message": f"Successfully uploaded {len(created)} task challenge(s)!",
        "count": len(created)
    }

@router.post("/challenges")
def create_task_challenge(
    req: schemas.TaskChallengeCreate,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    task = models.TaskChallenge(
        module_id=req.module_id,
        complexity_qlc=req.complexity_qlc.lower(),
        target_pt_ls=req.target_pt_ls,
        blooms_level=getattr(req, "blooms_level", "Applying"),
        is_locked_bonus=getattr(req, "is_locked_bonus", False),
        task_type=req.task_type.lower(),
        title=req.title,
        problem_statement=req.problem_statement,
        starter_code=req.starter_code,
        test_cases=req.test_cases,
        max_marks=req.max_marks,
        pdf_attachment=req.pdf_attachment
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"message": "Task challenge created", "id": task.id}

@router.get("/module/{module_id}/all")
def get_all_module_task_challenges(
    module_id: str,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")
    return db.query(models.TaskChallenge).filter(models.TaskChallenge.module_id == module_id).all()

@router.put("/challenges/{task_id}")
def update_task_challenge(
    task_id: str,
    req: schemas.TaskChallengeUpdate,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    t = db.query(models.TaskChallenge).filter(models.TaskChallenge.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task challenge not found")

    if req.title is not None:
        t.title = req.title.strip()
    if req.problem_statement is not None:
        t.problem_statement = req.problem_statement.strip()
    if req.complexity_qlc is not None:
        t.complexity_qlc = req.complexity_qlc.lower().strip()
    if req.target_pt_ls is not None:
        t.target_pt_ls = req.target_pt_ls.strip()
    if req.blooms_level is not None:
        t.blooms_level = req.blooms_level.strip()
    if req.task_type is not None:
        t.task_type = req.task_type.strip()
    if req.starter_code is not None:
        t.starter_code = req.starter_code
    if req.test_cases is not None:
        t.test_cases = req.test_cases
    if req.max_marks is not None:
        t.max_marks = req.max_marks
    if req.pdf_attachment is not None:
        t.pdf_attachment = req.pdf_attachment
    if req.is_locked_bonus is not None:
        t.is_locked_bonus = req.is_locked_bonus

    db.commit()
    db.refresh(t)
    return {"message": "Task challenge updated successfully", "id": t.id}


@router.delete("/challenges/{task_id}")
def delete_task_challenge(
    task_id: str,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    t = db.query(models.TaskChallenge).filter(models.TaskChallenge.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task challenge not found")

    # Safety check: Prevent deletion if students have already submitted work for this task
    has_submissions = db.query(models.TaskSubmission).filter(models.TaskSubmission.task_id == task_id).first()
    if has_submissions:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this task challenge because student submissions already exist for it. You can edit the task challenge instead."
        )

    db.delete(t)
    db.commit()
    return {"message": "Task challenge deleted successfully", "id": task_id}

@router.get("/module/{module_id}")
def get_adaptive_task_for_student(
    module_id: str,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    module = db.query(models.Module).filter(models.Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")

    # 1. Fetch latest quiz submission to get internal coq
    last_quiz = db.query(models.QuizSubmission).filter(
        models.QuizSubmission.student_id == current_user.id,
        models.QuizSubmission.module_id == module_id
    ).order_by(models.QuizSubmission.submitted_at.desc()).first()

    coq = last_quiz.coq_predicted if last_quiz else "Medium Learner"

    # 2. ANN Model 3: Predict Task Complexity Level (qlc)
    prev_complexity = 1
    curr_complexity = module.complexity_cmc or 1
    prev_cognitive = current_user.cognitive_level or "average"

    qlc = ai_engine.predict_task_complexity(
        prev_complexity=prev_complexity,
        curr_complexity=curr_complexity,
        prev_cognitive=prev_cognitive,
        curr_quiz_cognitive=coq
    ) # Basic, Intermediate, Advanced

    # 3. Find matching task
    tasks = db.query(models.TaskChallenge).filter(
        models.TaskChallenge.module_id == module_id,
        models.TaskChallenge.complexity_qlc == qlc.lower()
    ).all()

    # Fallback to any task for this module if specific qlc pool is empty
    if not tasks:
        tasks = db.query(models.TaskChallenge).filter(models.TaskChallenge.module_id == module_id).all()

    if not tasks:
        raise HTTPException(status_code=404, detail="No task challenges available for this module yet.")

    selected_task = tasks[0]
    course = module.course
    allowed_compilers = course.allowed_compilers if course else ["python", "c", "cpp", "java"]

    return {
        "task_id": selected_task.id,
        "module_id": module_id,
        "course_id": module.course_id,
        "concept_name": module.concept_name,
        "predicted_qlc": qlc,
        "task_type": selected_task.task_type,
        "title": selected_task.title,
        "problem_statement": selected_task.problem_statement,
        "starter_code": selected_task.starter_code,
        "max_marks": selected_task.max_marks,
        "pdf_attachment": selected_task.pdf_attachment,
        "allowed_compilers": allowed_compilers
    }

@router.post("/run-code", response_model=schemas.CodeRunResponse)
def execute_code(req: schemas.CodeRunRequest):
    """
    In-browser compiler runner supporting Python, C, C++, Java, JS
    """
    res = run_code(req.language, req.code, req.stdin_input)
    return schemas.CodeRunResponse(
        success=res["success"],
        output=res["output"],
        error=res["error"]
    )

@router.post("/pre-check")
def pre_check_task_code(
    req: schemas.TaskPreCheckRequest,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Pre-Submission Health Check & Diagnostics for Programming Tasks.
    Rule: 1st check on a task is FREE.
    Subsequent checks cost 25 coins.
    """
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    task = db.query(models.TaskChallenge).filter(models.TaskChallenge.id == req.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    raw_tc = task.test_cases or []
    if isinstance(raw_tc, str):
        try:
            test_cases = json.loads(raw_tc)
        except Exception:
            test_cases = []
    else:
        test_cases = raw_tc

    # Check swap/precheck usage record for this student and module
    usage_rec = db.query(models.TaskSwapUsage).filter(
        models.TaskSwapUsage.student_id == current_user.id,
        models.TaskSwapUsage.module_id == task.module_id
    ).first()

    if not usage_rec:
        usage_rec = models.TaskSwapUsage(
            student_id=current_user.id,
            module_id=task.module_id,
            swaps_used=0,
            pre_checks_used=0
        )
        db.add(usage_rec)
        db.flush()

    coins_deducted = 0
    if usage_rec.pre_checks_used == 0:
        # 1st Check is FREE
        coins_deducted = 0
    else:
        # Subsequent checks cost 25 coins
        if (current_user.total_coins or 0) < 25:
            raise HTTPException(
                status_code=400,
                detail="Subsequent pre-submission checks cost 25 coins. Insufficient balance."
            )
        current_user.total_coins = max(0, current_user.total_coins - 25)
        coins_deducted = 25

    usage_rec.pre_checks_used += 1
    db.commit()

    # Run light diagnostic
    diag = pre_check_programming_code(
        code=req.code,
        language=req.programming_language or "python",
        test_cases=test_cases,
        problem_statement=task.problem_statement or ""
    )

    diag["coins_deducted"] = coins_deducted
    diag["remaining_coins"] = current_user.total_coins
    diag["check_number"] = usage_rec.pre_checks_used

    return diag

@router.post("/swap")
def swap_task(
    req: schemas.TaskSwapRequest,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Task Swap Lifeline:
    Rule: 2 Free Swaps per module, then costs 1 Heart.
    Swaps with another task of the exact same complexity level (basic/intermediate/advanced).
    """
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    curr_task = db.query(models.TaskChallenge).filter(models.TaskChallenge.id == req.current_task_id).first()
    if not curr_task:
        raise HTTPException(status_code=404, detail="Current task not found.")

    usage_rec = db.query(models.TaskSwapUsage).filter(
        models.TaskSwapUsage.student_id == current_user.id,
        models.TaskSwapUsage.module_id == req.module_id
    ).first()

    if not usage_rec:
        usage_rec = models.TaskSwapUsage(
            student_id=current_user.id,
            module_id=req.module_id,
            swaps_used=0,
            pre_checks_used=0
        )
        db.add(usage_rec)
        db.flush()

    # Check cost
    if usage_rec.swaps_used >= 2:
        if (current_user.hearts or 0) < 1:
            raise HTTPException(
                status_code=400,
                detail="You have used your 2 free swaps and do not have enough hearts to swap (costs 1 heart)."
            )
        current_user.hearts = max(0, current_user.hearts - 1)
        current_user.last_heart_loss_at = datetime.utcnow()

    usage_rec.swaps_used += 1
    usage_rec.last_swapped_at = datetime.utcnow()

    # Find another task in the same module with equal complexity
    alt_tasks = db.query(models.TaskChallenge).filter(
        models.TaskChallenge.module_id == req.module_id,
        models.TaskChallenge.complexity_qlc == curr_task.complexity_qlc,
        models.TaskChallenge.id != curr_task.id
    ).all()

    if not alt_tasks:
        # Fallback to any other task in the module
        alt_tasks = db.query(models.TaskChallenge).filter(
            models.TaskChallenge.module_id == req.module_id,
            models.TaskChallenge.id != curr_task.id
        ).all()

    if not alt_tasks:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No alternative task challenge found in this module to swap with."
        )

    # Pick the next task
    import random
    new_task = random.choice(alt_tasks)
    db.commit()

    return {
        "message": f"Task swapped successfully! (Swap #{usage_rec.swaps_used})",
        "swaps_used": usage_rec.swaps_used,
        "remaining_hearts": current_user.hearts,
        "task_id": new_task.id,
        "title": new_task.title,
        "complexity_qlc": new_task.complexity_qlc,
        "task_type": new_task.task_type,
        "problem_statement": new_task.problem_statement,
        "starter_code": new_task.starter_code,
        "max_marks": new_task.max_marks
    }

@router.post("/expert-query")
def raise_task_expert_query(
    req: schemas.TaskExpertQueryCreate,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Student asks the Course Expert (Teacher) for guidance on their code/task.
    The code snapshot and error trace are automatically bundled for teacher diagnosis.
    """
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    q = models.TaskExpertQuery(
        student_id=current_user.id,
        task_id=req.task_id,
        module_id=req.module_id,
        heading=req.heading or "Question on Task",
        query_text=req.query_text,
        code_snapshot=req.code_snapshot,
        compiler_output=req.compiler_output,
        status="pending"
    )
    db.add(q)
    db.commit()
    db.refresh(q)

    return {
        "message": "Your question has been sent to the course expert with your code diagnostic snapshot.",
        "query_id": q.id
    }

@router.get("/expert-queries/pending")
def get_pending_expert_queries(
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Teacher view of pending student expert queries with code snapshot attached.
    """
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    queries = db.query(models.TaskExpertQuery).filter(
        models.TaskExpertQuery.status == "pending"
    ).order_by(models.TaskExpertQuery.created_at.desc()).all()

    res = []
    for q in queries:
        student = q.student
        task = q.task
        res.append({
            "id": q.id,
            "student_id": q.student_id,
            "student_name": student.name if student else "Student",
            "student_regno": getattr(student, "regno", ""),
            "task_id": q.task_id,
            "task_title": task.title if task else "",
            "heading": q.heading,
            "query_text": q.query_text,
            "code_snapshot": q.code_snapshot,
            "compiler_output": q.compiler_output,
            "created_at": q.created_at
        })
    return res

@router.post("/expert-queries/{query_id}/reply")
def reply_task_expert_query(
    query_id: str,
    req: schemas.TaskExpertQueryReply,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    q = db.query(models.TaskExpertQuery).filter(models.TaskExpertQuery.id == query_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Query not found.")

    q.teacher_reply = req.teacher_reply
    q.teacher_id = current_user.id
    q.status = "answered"
    q.replied_at = datetime.utcnow()
    db.commit()

    return {"message": "Reply sent to student successfully."}

@router.post("/submit")
def submit_task(
    req: schemas.TaskSubmitRequest,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Task Submission with Instant Hybrid Neuro-Symbolic Autograding!
    - Symbolic AI for Programming (AST, tiered test cases, quality, anti-hardcoding).
    - Neural AI for Descriptive (Gemini Flash rubric evaluation with quoted evidence).
    - Immediately triggers ANN Model 4, streak promotions, badges, and unlocks next module!
    """
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    task = db.query(models.TaskChallenge).filter(models.TaskChallenge.id == req.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task challenge not found.")

    module = task.module
    course = module.course if module else None

    # Run Autograder
    eval_res = {}
    try:
        if task.task_type == "programming":
            raw_tc = task.test_cases or []
            if isinstance(raw_tc, str):
                try:
                    test_cases = json.loads(raw_tc)
                except Exception:
                    test_cases = []
            elif isinstance(raw_tc, list):
                test_cases = raw_tc
            else:
                test_cases = []

            eval_res = evaluate_programming_submission(
                code=req.submitted_code or "",
                language=req.programming_language or "python",
                test_cases=test_cases,
                problem_statement=task.problem_statement or "",
                starter_code=task.starter_code or "",
                max_marks=task.max_marks or 100
            )
        else:
            # Descriptive / Open-ended
            eval_res = evaluate_descriptive_submission(
                text=req.submitted_text or "",
                problem_statement=task.problem_statement or "",
                max_marks=task.max_marks or 100
            )
    except Exception as e:
        print(f"[Autograder Error] Failed during auto-evaluation: {e}")
        # Safe fallback: Award base credit and queue for teacher review rather than failing the student's submission
        eval_res = {
            "score": round((task.max_marks or 100) * 0.5, 1),
            "explanation": f"Submission successfully recorded. Queued for instructor evaluation.",
            "confidence": "manual_review"
        }

    awarded_score = float(eval_res.get("score", 0.0))
    explanation = eval_res.get("explanation", "Evaluation completed.")
    confidence = eval_res.get("confidence", "high")

    sub = models.TaskSubmission(
        student_id=current_user.id,
        task_id=req.task_id,
        programming_language=req.programming_language,
        submitted_code=req.submitted_code,
        submitted_text=req.submitted_text,
        compiler_output=req.compiler_output,
        mst_score=awarded_score,
        teacher_feedback=explanation,
        auto_eval_score=awarded_score,
        auto_eval_explanation=explanation,
        auto_eval_confidence=confidence,
        auto_eval_details=json.dumps(eval_res),
        is_calibrated=False,
        evaluated_at=datetime.utcnow()
    )
    db.add(sub)
    db.flush()

    # Model 4: Cognitive Update Pipeline
    leaderboard_level = "Stepper"
    if module and course:
        last_quiz = db.query(models.QuizSubmission).filter(
            models.QuizSubmission.student_id == current_user.id,
            models.QuizSubmission.module_id == module.id
        ).order_by(models.QuizSubmission.submitted_at.desc()).first()

        msq = last_quiz.msq_score if last_quiz else 0.0
        mst = awarded_score

        w1 = course.w1_quiz_weight if course else 0.5
        w2 = course.w2_task_weight if course else 0.5
        scaled_msq = msq * 10.0 if msq <= 10.0 else msq
        tp = (w1 * scaled_msq) + (w2 * mst)

        cmc = module.complexity_cmc or 1
        raw_label, leaderboard_level = ai_engine.predict_cognitive_update(cmc, tp)

        cog_backend_map = {"Fast Learner": "fast", "Medium Learner": "average", "Slow Learner": "slow"}
        new_cog = cog_backend_map.get(raw_label, "average")

        final_cog, new_streak = check_streak_and_promotion(
            current_level=current_user.cognitive_level or "average",
            new_level=new_cog,
            current_streak=current_user.level_streak_count or 0
        )
        current_user.cognitive_level = final_cog
        current_user.level_streak_count = new_streak

        # Award Coins
        reward_coins = calculate_reward_coins(leaderboard_level)
        current_user.total_coins = (current_user.total_coins or 0) + reward_coins

        # Award Badges
        if current_user.pt_ls in ["Visionaries", "Mentors", "Conquerors"]:
            badge_tier = "associate"
            if task.complexity_qlc == "intermediate":
                badge_tier = "professional"
            elif task.complexity_qlc == "advanced":
                badge_tier = "master"

            theme_folder = (current_user.pt_ls or "visionaries").lower()
            badge_icon_path = f"/assets/{theme_folder}/{theme_folder[:-3] if theme_folder.endswith('ies') else theme_folder[:-1]}_badge_{badge_tier}.png"

            existing_badge = db.query(models.UserBadge).filter(
                models.UserBadge.student_id == current_user.id,
                models.UserBadge.concept_name == module.concept_name,
                models.UserBadge.badge_tier == badge_tier
            ).first()

            if not existing_badge:
                new_badge = models.UserBadge(
                    student_id=current_user.id,
                    theme_archetype=current_user.pt_ls,
                    concept_name=module.concept_name,
                    badge_tier=badge_tier,
                    badge_icon_path=badge_icon_path
                )
                db.add(new_badge)

        # Save State Record
        state_rec = models.LearnerModuleState(
            student_id=current_user.id,
            module_id=module.id,
            pmc=1,
            cmc=cmc,
            msq=msq,
            mst=mst,
            tp_total_performance=tp,
            model4_output=raw_label,
            leaderboard_level=leaderboard_level,
            level_streak_count=new_streak,
            reward_coins_earned=reward_coins
        )
        db.add(state_rec)

    db.commit()
    db.refresh(sub)
    db.refresh(current_user)

    return {
        "message": "Task evaluated automatically!",
        "submission_id": sub.id,
        "score": awarded_score,
        "explanation": explanation,
        "confidence": confidence,
        "leaderboard_level": leaderboard_level,
        "eval_details": eval_res
    }

@router.get("/pending-evaluations")
def get_pending_task_evaluations(
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Teacher Evaluation Queue:
    Displays submissions with their auto-evaluated mark and evidence explanation,
    allowing faculty to 1-click Confirm or Edit/Adjust marks.
    """
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    teacher_course_ids = [c.id for c in db.query(models.Course).filter(models.Course.teacher_id == current_user.id).all()]
    query = db.query(models.TaskSubmission)
    if teacher_course_ids:
        query = query.join(models.TaskChallenge).join(models.Module).filter(models.Module.course_id.in_(teacher_course_ids))

    # Show uncalibrated first (most recent)
    pending = query.order_by(models.TaskSubmission.is_calibrated.asc(), models.TaskSubmission.submitted_at.desc()).all()

    res = []
    for p in pending:
        task = p.task
        student = p.student
        module = task.module if task else None
        course = module.course if module else None
        res.append({
            "submission_id": p.id,
            "status": "graded",
            "is_calibrated": bool(p.is_calibrated),
            "student_name": student.name if student else "Unknown",
            "student_regno": getattr(student, "regno", ""),
            "student_cognitive_level": getattr(student, "cognitive_level", "average"),
            "student_pt_ls": getattr(student, "pt_ls", "Visionaries"),
            "course_id": course.id if course else "",
            "course_title": course.title if course else "",
            "module_id": module.id if module else "",
            "module_no": module.module_no if module else 1,
            "concept_name": module.concept_name if module else "",
            "task_title": task.title if task else "",
            "task_type": task.task_type if task else "programming",
            "complexity_qlc": task.complexity_qlc if task else "basic",
            "problem_statement": task.problem_statement if task else "",
            "max_marks": task.max_marks if task else 100,
            "programming_language": p.programming_language,
            "submitted_code": p.submitted_code,
            "submitted_text": p.submitted_text,
            "compiler_output": p.compiler_output,
            "mst_score": p.mst_score,
            "auto_eval_score": p.auto_eval_score,
            "auto_eval_explanation": p.auto_eval_explanation,
            "auto_eval_confidence": p.auto_eval_confidence,
            "teacher_feedback": p.teacher_feedback,
            "submitted_at": p.submitted_at
        })
    return res

@router.post("/submissions/{submission_id}/confirm")
def confirm_auto_evaluation(
    submission_id: str,
    req: Optional[schemas.TaskEvaluationConfirmRequest] = None,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    RLHF Positive Reward Signal:
    Faculty confirms that the AI autograded score was accurate.
    Logs telemetry with score_delta = 0.0.
    """
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    sub = db.query(models.TaskSubmission).filter(models.TaskSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")

    sub.is_calibrated = True
    sub.evaluated_by = current_user.id
    sub.evaluated_at = datetime.utcnow()
    if req and req.teacher_notes:
        sub.teacher_feedback = f"{sub.teacher_feedback or ''} [Faculty Note: {req.teacher_notes}]"

    # Log to RLHF calibration telemetry
    calib = models.EvaluationCalibrationLog(
        submission_id=sub.id,
        student_id=sub.student_id,
        task_id=sub.task_id,
        assessment_type=sub.task.task_type if sub.task else "programming",
        auto_score=float(sub.auto_eval_score or sub.mst_score or 0.0),
        faculty_score=float(sub.mst_score or 0.0),
        score_delta=0.0,
        confidence=sub.auto_eval_confidence,
        auto_explanation=sub.auto_eval_explanation,
        teacher_feedback="Confirmed by faculty",
        teacher_id=current_user.id
    )
    db.add(calib)
    db.commit()

    return {"message": "Auto evaluation confirmed and logged for RL calibration.", "calibrated": True}

@router.get("/submissions/all")
def get_all_task_submissions(
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    teacher_course_ids = [c.id for c in db.query(models.Course).filter(models.Course.teacher_id == current_user.id).all()]
    query = db.query(models.TaskSubmission)
    if teacher_course_ids:
        query = query.join(models.TaskChallenge).join(models.Module).filter(models.Module.course_id.in_(teacher_course_ids))
    subs = query.order_by(models.TaskSubmission.submitted_at.desc()).all()

    res = []
    for p in subs:
        task = p.task
        student = p.student
        module = task.module if task else None
        course = module.course if module else None

        res.append({
            "submission_id": p.id,
            "status": "graded" if p.mst_score is not None else "pending",
            "student_name": student.name if student else "Unknown",
            "student_regno": getattr(student, "regno", ""),
            "student_cognitive_level": getattr(student, "cognitive_level", "average"),
            "student_pt_ls": getattr(student, "pt_ls", "Visionaries"),
            "course_id": course.id if course else "",
            "course_title": course.title if course else "",
            "module_id": module.id if module else "",
            "module_no": module.module_no if module else 1,
            "concept_name": module.concept_name if module else "",
            "task_title": task.title if task else "",
            "task_type": task.task_type if task else "programming",
            "complexity_qlc": task.complexity_qlc if task else "basic",
            "problem_statement": task.problem_statement if task else "",
            "max_marks": task.max_marks if task else 100,
            "programming_language": p.programming_language,
            "submitted_code": p.submitted_code,
            "submitted_text": p.submitted_text,
            "compiler_output": p.compiler_output,
            "mst_score": p.mst_score,
            "teacher_feedback": p.teacher_feedback,
            "evaluated_at": p.evaluated_at,
            "submitted_at": p.submitted_at
        })
    return res

@router.post("/submissions/{submission_id}/grade")
@router.post("/grade/{submission_id}")
def grade_task_submission(
    submission_id: str,
    req: schemas.TaskGradeRequest,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Teacher enters mark for task.
    TRIGGER: Runs Model 4 and ALONE updates the leaderboard & cognitive level!
    """
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    sub = db.query(models.TaskSubmission).filter(models.TaskSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")

    orig_auto_score = sub.auto_eval_score if sub.auto_eval_score is not None else sub.mst_score
    sub.mst_score = req.mst_score
    sub.teacher_feedback = req.teacher_feedback
    sub.evaluated_by = current_user.id
    sub.evaluated_at = datetime.utcnow()
    sub.is_calibrated = True

    # RLHF calibration logging
    delta = float(req.mst_score) - float(orig_auto_score or 0.0)
    calib = models.EvaluationCalibrationLog(
        submission_id=sub.id,
        student_id=sub.student_id,
        task_id=sub.task_id,
        assessment_type=sub.task.task_type if sub.task else "programming",
        auto_score=float(orig_auto_score or 0.0),
        faculty_score=float(req.mst_score),
        score_delta=delta,
        confidence=sub.auto_eval_confidence,
        auto_explanation=sub.auto_eval_explanation,
        teacher_feedback=req.teacher_feedback,
        teacher_id=current_user.id
    )
    db.add(calib)

    student = sub.student
    task = sub.task
    module = task.module
    course = module.course

    # 1. Fetch Quiz score
    last_quiz = db.query(models.QuizSubmission).filter(
        models.QuizSubmission.student_id == student.id,
        models.QuizSubmission.module_id == module.id
    ).order_by(models.QuizSubmission.submitted_at.desc()).first()

    msq = last_quiz.msq_score if last_quiz else 0.0
    mst = req.mst_score

    w1 = course.w1_quiz_weight if course else 0.5
    w2 = course.w2_task_weight if course else 0.5

    # Total performance score: tp = w1 * msq + w2 * mst (scaled to 100)
    # Assuming msq is out of 10, scale msq to 100: (msq * 10)
    scaled_msq = msq * 10.0 if msq <= 10.0 else msq
    tp = (w1 * scaled_msq) + (w2 * mst)

    # 2. ANN Model 4: Cognitive Update
    # THIS MODEL ALONE UPDATES THE LEADERBOARD!
    cmc = module.complexity_cmc or 1
    raw_label, leaderboard_level = ai_engine.predict_cognitive_update(cmc, tp)

    # Map raw_label to backend cognitive level
    cog_backend_map = {"Fast Learner": "fast", "Medium Learner": "average", "Slow Learner": "slow"}
    new_cog = cog_backend_map.get(raw_label, "average")

    # 3. Check streak and promotion (Algorithm 6)
    final_cog, new_streak = check_streak_and_promotion(
        current_level=student.cognitive_level or "average",
        new_level=new_cog,
        current_streak=student.level_streak_count or 0
    )
    student.cognitive_level = final_cog
    student.level_streak_count = new_streak

    # 4. Award Reward Coins (Stepper: 100, Jogger: 250, Glider: 500)
    reward_coins = calculate_reward_coins(leaderboard_level)
    student.total_coins += reward_coins

    # 5. Award Badges (Visionaries, Mentors, Conquerors)
    if student.pt_ls in ["Visionaries", "Mentors", "Conquerors"]:
        badge_tier = "associate"
        if task.complexity_qlc == "intermediate":
            badge_tier = "professional"
        elif task.complexity_qlc == "advanced":
            badge_tier = "master"

        # Theme folder
        theme_folder = (student.pt_ls or "visionaries").lower()
        badge_icon_path = f"/assets/{theme_folder}/{theme_folder[:-3] if theme_folder.endswith('ies') else theme_folder[:-1]}_badge_{badge_tier}.png"

        # Check if already earned
        existing_badge = db.query(models.UserBadge).filter(
            models.UserBadge.student_id == student.id,
            models.UserBadge.concept_name == module.concept_name,
            models.UserBadge.badge_tier == badge_tier
        ).first()

        if not existing_badge:
            new_badge = models.UserBadge(
                student_id=student.id,
                theme_archetype=student.pt_ls,
                concept_name=module.concept_name,
                badge_tier=badge_tier,
                badge_icon_path=badge_icon_path
            )
            db.add(new_badge)

    # 6. Save State Record for Research Telemetry
    state_rec = models.LearnerModuleState(
        student_id=student.id,
        module_id=module.id,
        pmc=1,
        cmc=cmc,
        msq=msq,
        mst=mst,
        tp_total_performance=tp,
        model4_output=raw_label,
        leaderboard_level=leaderboard_level,
        level_streak_count=new_streak,
        reward_coins_earned=reward_coins
    )
    db.add(state_rec)
    db.commit()

    return {
        "message": "Evaluation saved and Model 4 cognitive update applied successfully!",
        "total_performance_tp": tp,
        "model4_output": raw_label,
        "leaderboard_level": leaderboard_level,
        "new_cognitive_level": final_cog,
        "coins_awarded": reward_coins,
        "model4_update": {
            "leaderboard_level": leaderboard_level,
            "cognitive_level": final_cog,
            "coins_awarded": reward_coins
        }
    }
