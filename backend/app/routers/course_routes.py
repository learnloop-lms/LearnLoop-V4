from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/courses", tags=["Courses & Modules"])

@router.post("", response_model=schemas.CourseOut)
def create_course(
    req: schemas.CourseCreate,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create courses.")

    # Check join code uniqueness
    existing = db.query(models.Course).filter(models.Course.join_code == req.join_code.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="This Join Code is already in use. Please enter a different code.")

    course = models.Course(
        title=req.title,
        description=req.description,
        join_code=req.join_code.strip().upper(),
        teacher_id=current_user.id,
        allowed_compilers=req.allowed_compilers,
        w1_quiz_weight=req.w1_quiz_weight,
        w2_task_weight=req.w2_task_weight,
        passing_threshold_p=req.passing_threshold_p
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course

@router.get("", response_model=list[schemas.CourseOut])
def list_courses(db: Session = Depends(get_db)):
    return db.query(models.Course).all()

@router.get("/teacher/my-courses")
def get_teacher_courses(
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    courses = db.query(models.Course).filter(models.Course.teacher_id == current_user.id).all()
    res = []
    for c in courses:
        res.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "join_code": c.join_code,
            "allowed_compilers": c.allowed_compilers,
            "w1_quiz_weight": c.w1_quiz_weight,
            "w2_task_weight": c.w2_task_weight,
            "passing_threshold_p": c.passing_threshold_p,
            "enrolled_students_count": len(c.enrollments),
            "modules_count": len(c.modules),
            "created_at": c.created_at
        })
    return res

@router.get("/my")
def get_my_courses_alias(
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    courses = db.query(models.Course).filter(models.Course.teacher_id == current_user.id).all()
    res = []
    for c in courses:
        res.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "join_code": c.join_code,
            "allowed_compilers": c.allowed_compilers,
            "w1_quiz_weight": c.w1_quiz_weight,
            "w2_task_weight": c.w2_task_weight,
            "passing_threshold_p": c.passing_threshold_p,
            "enrolled_students_count": len(c.enrollments),
            "modules_count": len(c.modules),
            "created_at": c.created_at
        })
    return res

@router.get("/{course_id}")
def get_single_course(
    course_id: str,
    db: Session = Depends(get_db)
):
    c = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found.")
    return {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "join_code": c.join_code,
        "teacher_id": c.teacher_id,
        "allowed_compilers": c.allowed_compilers,
        "w1_quiz_weight": c.w1_quiz_weight,
        "w2_task_weight": c.w2_task_weight,
        "passing_threshold_p": c.passing_threshold_p,
        "enrolled_students_count": len(c.enrollments),
        "modules_count": len(c.modules),
        "created_at": c.created_at
    }

@router.delete("/modules/{module_id}")
def delete_module(
    module_id: str,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")
    mod = db.query(models.Module).filter(models.Module.id == module_id).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found.")
    db.delete(mod)
    db.commit()
    return {"message": "Module deleted successfully."}

@router.post("/enroll")
def enroll_in_course(
    req: schemas.CourseEnrollRequest,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Only students can enroll in courses.")

    course = db.query(models.Course).filter(models.Course.join_code == req.join_code.strip().upper()).first()
    if not course:
        raise HTTPException(status_code=404, detail="Invalid Join Code. No matching course found.")

    already_enrolled = db.query(models.CourseEnrollment).filter(
        models.CourseEnrollment.student_id == current_user.id,
        models.CourseEnrollment.course_id == course.id
    ).first()
    if already_enrolled:
        return {"message": "Already enrolled in this course.", "course_id": course.id, "title": course.title}

    enrollment = models.CourseEnrollment(
        student_id=current_user.id,
        course_id=course.id
    )
    db.add(enrollment)
    db.commit()

    return {"message": f"Successfully enrolled in {course.title}!", "course_id": course.id}

@router.post("/{course_id}/modules", response_model=schemas.ModuleOut)
def add_module(
    course_id: str,
    req: schemas.ModuleCreate,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    course = db.query(models.Course).filter(models.Course.id == course_id, models.Course.teacher_id == current_user.id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found or unauthorized.")

    module = models.Module(
        course_id=course_id,
        module_no=req.module_no,
        concept_name=req.concept_name,
        complexity_cmc=req.complexity_cmc,
        w1_quiz_weight=req.w1_quiz_weight,
        w2_task_weight=req.w2_task_weight,
        passing_threshold_p=req.passing_threshold_p
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return module

@router.get("/{course_id}/modules")
def get_course_modules(course_id: str, db: Session = Depends(get_db)):
    modules = db.query(models.Module).filter(models.Module.course_id == course_id).order_by(models.Module.module_no).all()
    res = []
    for m in modules:
        mat_slow = sum(1 for mat in m.study_materials if (mat.learning_level or '').lower() in ['slow', 'basic'])
        mat_avg = sum(1 for mat in m.study_materials if (mat.learning_level or '').lower() in ['average', 'intermediate', 'med'])
        mat_fast = sum(1 for mat in m.study_materials if (mat.learning_level or '').lower() in ['fast', 'advanced', 'hard'])
        mat_mystery = sum(1 for mat in m.study_materials if getattr(mat, 'is_locked_bonus', False))

        q_easy = sum(1 for q in m.quiz_questions if (q.cognitive_level or '').lower() in ['slow', 'easy'])
        q_med = sum(1 for q in m.quiz_questions if (q.cognitive_level or '').lower() in ['average', 'medium'])
        q_hard = sum(1 for q in m.quiz_questions if (q.cognitive_level or '').lower() in ['fast', 'hard'])

        t_basic = sum(1 for t in m.task_challenges if (t.complexity_qlc or '').lower() == 'basic')
        t_int = sum(1 for t in m.task_challenges if (t.complexity_qlc or '').lower() in ['intermediate', 'med', 'medium'])
        t_adv = sum(1 for t in m.task_challenges if (t.complexity_qlc or '').lower() == 'advanced')
        t_mystery = sum(1 for t in m.task_challenges if getattr(t, 'is_locked_bonus', False))

        res.append({
            "id": m.id,
            "course_id": m.course_id,
            "module_no": m.module_no,
            "concept_name": m.concept_name,
            "complexity_cmc": m.complexity_cmc,
            "w1_quiz_weight": getattr(m, "w1_quiz_weight", 0.5),
            "w2_task_weight": getattr(m, "w2_task_weight", 0.5),
            "passing_threshold_p": getattr(m, "passing_threshold_p", 5.0),
            "has_quiz": len(m.quiz_questions) > 0,
            "has_task": len(m.task_challenges) > 0,
            "materials_count": len(m.study_materials),
            "materials_breakdown": {
                "slow": mat_slow,
                "average": mat_avg,
                "fast": mat_fast,
                "mystery": mat_mystery
            },
            "quizzes_breakdown": {
                "easy": q_easy,
                "medium": q_med,
                "hard": q_hard,
                "total": len(m.quiz_questions)
            },
            "tasks_breakdown": {
                "basic": t_basic,
                "intermediate": t_int,
                "advanced": t_adv,
                "mystery": t_mystery,
                "total": len(m.task_challenges)
            }
        })
    return res

@router.post("/modules/{module_id}/materials", response_model=schemas.StudyMaterialOut)
def add_study_material(
    module_id: str,
    req: schemas.StudyMaterialCreate,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    material = models.StudyMaterial(
        module_id=module_id,
        learning_level=req.learning_level.lower(),
        title=req.title,
        content_html=req.content_html,
        pdf_url=req.pdf_url,
        is_locked_bonus=req.is_locked_bonus
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material

@router.get("/modules/{module_id}/materials")
def get_study_materials_for_student(
    module_id: str,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    role = getattr(current_user, "current_role", "student")
    if role == "teacher":
        # Teachers can see all versions
        return db.query(models.StudyMaterial).filter(models.StudyMaterial.module_id == module_id).all()

    # For student: dynamically serve according to their current cognitive level
    # slow -> basic, average -> intermediate, fast -> advanced
    student_cog = (current_user.cognitive_level or "average").lower()
    materials = db.query(models.StudyMaterial).filter(
        models.StudyMaterial.module_id == module_id,
        (models.StudyMaterial.learning_level == student_cog) | (models.StudyMaterial.is_locked_bonus == True)
    ).all()

    # If no exact match, fallback to any available material for this module
    if not materials:
        materials = db.query(models.StudyMaterial).filter(
            models.StudyMaterial.module_id == module_id
        ).all()

    return materials

@router.get("/modules/{module_id}/student-progress")
def get_student_module_progress(
    module_id: str,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    module = db.query(models.Module).filter(models.Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")

    passing_threshold = module.passing_threshold_p or 5.0

    # 1. Latest Quiz Submission
    last_quiz = db.query(models.QuizSubmission).filter(
        models.QuizSubmission.student_id == current_user.id,
        models.QuizSubmission.module_id == module_id
    ).order_by(models.QuizSubmission.submitted_at.desc()).first()

    quiz_completed = last_quiz is not None
    quiz_score = last_quiz.msq_score if last_quiz else None
    quiz_passed = (last_quiz.msq_score >= passing_threshold) if last_quiz else False

    # 2. Latest Task Submission
    task_ids = [t.id for t in module.task_challenges]
    last_task_sub = db.query(models.TaskSubmission).filter(
        models.TaskSubmission.student_id == current_user.id,
        models.TaskSubmission.task_id.in_(task_ids)
    ).order_by(models.TaskSubmission.submitted_at.desc()).first() if task_ids else None

    task_submitted = last_task_sub is not None
    task_status = "not_submitted"
    task_score = None
    task_feedback = None
    if last_task_sub:
        task_status = "graded" if last_task_sub.mst_score is not None else "pending"
        task_score = last_task_sub.mst_score
        task_feedback = last_task_sub.teacher_feedback

    # 3. Element ratings
    rating_rec = db.query(models.ElementRating).filter(
        models.ElementRating.student_id == current_user.id,
        models.ElementRating.module_id == module_id
    ).first()
    has_rated = rating_rec is not None

    # 4. Check Revaluation request
    reval = None
    if last_task_sub:
        reval = db.query(models.RevaluationRequest).filter(
            models.RevaluationRequest.student_id == current_user.id,
            models.RevaluationRequest.assessment_type == "task",
            models.RevaluationRequest.assessment_id == last_task_sub.id
        ).order_by(models.RevaluationRequest.created_at.desc()).first()

    return {
        "module_id": module_id,
        "passing_threshold": passing_threshold,
        "quiz_completed": quiz_completed,
        "quiz_score": quiz_score,
        "quiz_passed": quiz_passed,
        "task_submitted": task_submitted,
        "task_submission_id": last_task_sub.id if last_task_sub else None,
        "task_status": task_status,
        "task_score": task_score,
        "task_feedback": task_feedback,
        "task_title": last_task_sub.task.title if (last_task_sub and last_task_sub.task) else None,
        "task_problem_statement": last_task_sub.task.problem_statement if (last_task_sub and last_task_sub.task) else None,
        "task_type": last_task_sub.task.task_type if (last_task_sub and last_task_sub.task) else None,
        "task_complexity": last_task_sub.task.complexity_qlc if (last_task_sub and last_task_sub.task) else None,
        "submitted_code": last_task_sub.submitted_code if last_task_sub else None,
        "submitted_text": last_task_sub.submitted_text if last_task_sub else None,
        "programming_language": last_task_sub.programming_language if last_task_sub else None,
        "compiler_output": last_task_sub.compiler_output if last_task_sub else None,
        "has_rated": has_rated,
        "revaluation_id": reval.id if reval else None,
        "revaluation_status": reval.status if reval else None,
        "revaluation_revised_score": reval.revised_score if reval else None,
        "revaluation_notes": reval.teacher_notes if reval else None
    }

@router.get("/{course_id}/modules-completion-summary")
def get_student_course_completion_summary(
    course_id: str,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    modules = db.query(models.Module).filter(models.Module.course_id == course_id).order_by(models.Module.module_no).all()
    res = []
    for m in modules:
        task_ids = [t.id for t in m.task_challenges]
        last_task_sub = db.query(models.TaskSubmission).filter(
            models.TaskSubmission.student_id == current_user.id,
            models.TaskSubmission.task_id.in_(task_ids)
        ).first() if task_ids else None

        last_quiz = db.query(models.QuizSubmission).filter(
            models.QuizSubmission.student_id == current_user.id,
            models.QuizSubmission.module_id == m.id
        ).first()

        quiz_passed = (last_quiz.msq_score >= (m.passing_threshold_p or 5.0)) if last_quiz else False
        is_completed = bool(last_task_sub is not None)

        res.append({
            "module_id": m.id,
            "module_no": m.module_no,
            "quiz_passed": quiz_passed,
            "task_submitted": last_task_sub is not None,
            "is_completed": is_completed
        })

    return res

