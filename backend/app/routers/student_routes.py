from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.services.ai_engine import ai_engine
from app.services.gamification import initialize_engagement_score

router = APIRouter(prefix="/students", tags=["Students"])

@router.post("/onboarding/survey", response_model=schemas.SurveyResultOut)
def submit_onboarding_survey(
    req: schemas.SurveyRequest,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Only students can submit the onboarding survey.")

    if current_user.form_submission:
        raise HTTPException(status_code=400, detail="Onboarding survey has already been completed.")

    if len(req.pt_responses) != 12 or len(req.ls_responses) != 12:
        raise HTTPException(status_code=400, detail="Exactly 12 Player Type and 12 Learning Style responses required.")

    # -------------------------------------------------------------------------
    # Algorithm 1: Player Type Classification
    # -------------------------------------------------------------------------
    pt = req.pt_responses
    achiever = sum(pt[0:3])   # Q1-3
    explorer = sum(pt[3:6])   # Q4-6
    socializer = sum(pt[6:9]) # Q7-9
    killer = sum(pt[9:12])    # Q10-12

    pt_scores = [
        ("Achiever", achiever),
        ("Explorer", explorer),
        ("Killer", killer),
        ("Socializer", socializer)
    ]
    # Sort by weight descending, resolve ties alphabetically (by name ascending)
    pt_scores.sort(key=lambda item: (-item[1], item[0]))

    ppt = pt_scores[0][0]
    spt = pt_scores[1][0]

    # -------------------------------------------------------------------------
    # Algorithm 1: Learning Style Classification
    # -------------------------------------------------------------------------
    ls = req.ls_responses
    def classify_dimension(sub_list, type1, type2):
        count1 = sub_list.count(1)
        count2 = sub_list.count(2)
        return type1 if count1 > count2 else type2

    ld1 = classify_dimension(ls[0:3], "Active", "Reflective")
    ld2 = classify_dimension(ls[3:6], "Sequential", "Global")
    ld3 = classify_dimension(ls[6:9], "Sensing", "Intuitive")
    ld4 = classify_dimension(ls[9:12], "Visual", "Verbal")

    # -------------------------------------------------------------------------
    # ANN Model 1: Archetype Prediction
    # -------------------------------------------------------------------------
    pt_ls = ai_engine.predict_pt_ls(ppt, spt, ld1, ld2, ld3, ld4)

    # -------------------------------------------------------------------------
    # Map Avatar based on Archetype and Gender
    # -------------------------------------------------------------------------
    gender_suffix = "girl" if current_user.gender == "female" else "boy"
    archetype_key = pt_ls.lower() # visionaries, mentors, conquerors, pioneers
    singular_key = {
        "visionaries": "visionary",
        "mentors": "mentor",
        "conquerors": "conqueror",
        "pioneers": "pioneer"
    }.get(archetype_key, "visionary")

    avatar_path = f"/assets/{archetype_key}/{singular_key}_avatar_{gender_suffix}.png"

    # Initialize Engagement Scores (Algorithm 2)
    engagement_scores = initialize_engagement_score(pt_ls)

    # Save to student record
    current_user.ppt = ppt
    current_user.spt = spt
    current_user.ld1_active_reflective = ld1
    current_user.ld2_sequential_global = ld2
    current_user.ld3_sensing_intuitive = ld3
    current_user.ld4_visual_verbal = ld4
    current_user.pt_ls = pt_ls
    current_user.avatar_path = avatar_path
    current_user.engagement_scores = engagement_scores
    current_user.form_submission = True

    db.commit()

    return schemas.SurveyResultOut(
        ppt=ppt,
        spt=spt,
        ld1=ld1,
        ld2=ld2,
        ld3=ld3,
        ld4=ld4,
        pt_ls=pt_ls,
        avatar_path=avatar_path,
        engagement_scores=engagement_scores,
        message="Profile successfully classified into " + pt_ls
    )

@router.get("/collectibles")
def get_student_collectibles(
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    badges = db.query(models.UserBadge).filter(
        models.UserBadge.student_id == current_user.id
    ).order_by(models.UserBadge.earned_at.desc()).all()

    return [
        {
            "id": b.id,
            "theme_archetype": b.theme_archetype,
            "concept_name": b.concept_name,
            "badge_tier": b.badge_tier,
            "badge_icon_path": b.badge_icon_path,
            "earned_at": b.earned_at
        }
        for b in badges
    ]

@router.get("/my-courses")
def get_enrolled_courses(
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    enrollments = db.query(models.CourseEnrollment).filter(
        models.CourseEnrollment.student_id == current_user.id
    ).all()

    courses = []
    for en in enrollments:
        c = en.course
        modules_sorted = sorted(c.modules, key=lambda m: m.module_no)
        modules_info = []
        completed_count = 0
        prev_completed = True

        for idx, m in enumerate(modules_sorted):
            task_ids = [t.id for t in m.task_challenges]
            last_task_sub = db.query(models.TaskSubmission).filter(
                models.TaskSubmission.student_id == current_user.id,
                models.TaskSubmission.task_id.in_(task_ids)
            ).first() if task_ids else None

            last_quiz = db.query(models.QuizSubmission).filter(
                models.QuizSubmission.student_id == current_user.id,
                models.QuizSubmission.module_id == m.id
            ).order_by(models.QuizSubmission.submitted_at.desc()).first()

            quiz_passed = (last_quiz.msq_score >= (m.passing_threshold_p or 5.0)) if last_quiz else False
            is_completed = bool(last_task_sub is not None)

            total_q = len(last_quiz.responses_detail) if last_quiz and last_quiz.responses_detail else 10
            quiz_pct = round((last_quiz.msq_score / total_q) * 100) if last_quiz else 0

            if is_completed:
                completed_count += 1
                status = "completed"
            elif quiz_passed or last_task_sub is not None or last_quiz is not None:
                status = "in_progress"
            elif idx == 0 or prev_completed:
                status = "active"
            else:
                status = "locked"

            prev_completed = is_completed

            modules_info.append({
                "module_id": m.id,
                "module_no": m.module_no,
                "concept_name": m.concept_name,
                "quiz_passed": quiz_passed,
                "quiz_score": last_quiz.msq_score if last_quiz else None,
                "quiz_percentage": quiz_pct,
                "task_submitted": last_task_sub is not None,
                "is_completed": is_completed,
                "status": status
            })

        courses.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "join_code": c.join_code,
            "instructor_name": c.teacher.name,
            "allowed_compilers": c.allowed_compilers,
            "modules_count": len(modules_sorted),
            "completed_count": completed_count,
            "modules_progress": modules_info,
            "enrolled_at": en.enrolled_at
        })

    return courses

@router.get("/mystery-vault")
def get_student_mystery_vault(
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    enrollments = db.query(models.CourseEnrollment).filter(
        models.CourseEnrollment.student_id == current_user.id
    ).all()

    vault_items = []
    total_unlocked = 0

    for en in enrollments:
        c = en.course
        for m in sorted(c.modules, key=lambda x: x.module_no):
            last_quiz = db.query(models.QuizSubmission).filter(
                models.QuizSubmission.student_id == current_user.id,
                models.QuizSubmission.module_id == m.id
            ).order_by(models.QuizSubmission.msq_score.desc()).first()

            total_q = len(last_quiz.responses_detail) if last_quiz and last_quiz.responses_detail else 10
            quiz_pct = round((last_quiz.msq_score / total_q) * 100) if last_quiz else 0
            
            # Single condition: Complete module quizzes with 80%+ score
            is_unlocked = bool(last_quiz and (quiz_pct >= 80 or last_quiz.msq_score >= 8.0))
            if is_unlocked:
                total_unlocked += 1

            # Fetch secret / bonus materials
            mystery_mats = [
                {
                    "id": mat.id,
                    "title": mat.title,
                    "pdf_url": mat.pdf_url,
                    "learning_level": mat.learning_level,
                    "is_locked_bonus": mat.is_locked_bonus
                }
                for mat in m.study_materials if mat.is_locked_bonus
            ]

            # If no materials are explicitly marked as is_locked_bonus, fallback to advanced materials
            if not mystery_mats:
                mystery_mats = [
                    {
                        "id": mat.id,
                        "title": mat.title,
                        "pdf_url": mat.pdf_url,
                        "learning_level": mat.learning_level,
                        "is_locked_bonus": True
                    }
                    for mat in m.study_materials if mat.learning_level in ["fast", "average"]
                ]

            vault_items.append({
                "course_id": c.id,
                "course_title": c.title,
                "module_id": m.id,
                "module_no": m.module_no,
                "concept_name": m.concept_name,
                "quiz_score": last_quiz.msq_score if last_quiz else 0,
                "quiz_percentage": quiz_pct,
                "is_unlocked": is_unlocked,
                "secret_materials": mystery_mats
            })

    return {
        "condition": "Complete module quizzes with 80%+ score",
        "total_unlocked": total_unlocked,
        "vaults": vault_items
    }

class StudentProfileUpdate(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    new_password: Optional[str] = None

@router.put("/profile")
def update_student_profile(
    req: StudentProfileUpdate,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")
    
    if req.name:
        current_user.name = req.name
    if req.gender and req.gender in ["female", "male", "others"]:
        current_user.gender = req.gender
        if current_user.pt_ls:
            gender_suffix = "girl" if current_user.gender == "female" else "boy"
            arch_key = current_user.pt_ls.lower()
            singular_key = {"visionaries": "visionary", "mentors": "mentor", "conquerors": "conqueror", "pioneers": "pioneer"}.get(arch_key, "visionary")
            current_user.avatar_path = f"/assets/{arch_key}/{singular_key}_avatar_{gender_suffix}.png"
    if req.department:
        current_user.department = req.department
    if req.email:
        current_user.email = req.email
    if req.new_password and len(req.new_password) >= 6:
        current_user.password_hash = auth.get_password_hash(req.new_password)
    
    db.commit()
    db.refresh(current_user)
    return {"message": "Profile updated successfully"}
