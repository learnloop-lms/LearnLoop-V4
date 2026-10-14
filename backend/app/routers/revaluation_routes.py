from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.services.ai_engine import ai_engine
from app.services.gamification import calculate_reward_coins, check_streak_and_promotion

router = APIRouter(prefix="/revaluations", tags=["Assessment Revaluations"])

@router.post("")
def create_revaluation_request(
    req: schemas.RevaluationRequestCreate,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    original_score = 0.0
    if req.assessment_type == "quiz":
        sub = db.query(models.QuizSubmission).filter(
            models.QuizSubmission.id == req.assessment_id,
            models.QuizSubmission.student_id == current_user.id
        ).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Quiz submission not found.")
        original_score = sub.msq_score
    elif req.assessment_type == "task":
        sub = db.query(models.TaskSubmission).filter(
            models.TaskSubmission.id == req.assessment_id,
            models.TaskSubmission.student_id == current_user.id
        ).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Task submission not found.")
        original_score = sub.mst_score or 0.0
    else:
        raise HTTPException(status_code=400, detail="Invalid assessment type. Must be 'quiz' or 'task'.")

    rev = models.RevaluationRequest(
        student_id=current_user.id,
        assessment_type=req.assessment_type,
        assessment_id=req.assessment_id,
        student_reason=req.student_reason,
        original_score=original_score,
        status="pending"
    )
    db.add(rev)
    db.commit()
    db.refresh(rev)

    return {"message": "Revaluation request submitted to instructor.", "id": rev.id}

@router.get("/teacher/pending")
def get_pending_revaluations(
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    pending = db.query(models.RevaluationRequest).filter(
        models.RevaluationRequest.status == "pending"
    ).order_by(models.RevaluationRequest.created_at.desc()).all()

    res = []
    for r in pending:
        student = db.query(models.Student).filter(models.Student.id == r.student_id).first()
        question_text = ""
        task_title = ""
        submitted_code = ""
        submitted_text = ""
        compiler_output = ""
        teacher_feedback = ""
        course_title = ""
        module_name = ""
        prog_lang = ""

        quiz_breakdown = []
        if r.assessment_type == "task":
            sub = db.query(models.TaskSubmission).filter(models.TaskSubmission.id == r.assessment_id).first()
            if sub:
                submitted_code = sub.submitted_code or ""
                submitted_text = sub.submitted_text or ""
                compiler_output = sub.compiler_output or ""
                teacher_feedback = sub.teacher_feedback or ""
                prog_lang = sub.programming_language or ""
                if sub.task:
                    task_title = sub.task.title or ""
                    question_text = sub.task.problem_statement or ""
                    if sub.task.module:
                        module_name = sub.task.module.concept_name or ""
                        if sub.task.module.course:
                            course_title = sub.task.module.course.title or ""
        elif r.assessment_type == "quiz":
            sub = db.query(models.QuizSubmission).filter(models.QuizSubmission.id == r.assessment_id).first()
            if sub:
                mod = db.query(models.Module).filter(models.Module.id == sub.module_id).first()
                if mod:
                    module_name = mod.concept_name or ""
                    if mod.course:
                        course_title = mod.course.title or ""
                task_title = f"{module_name} Adaptive Quiz"
                question_text = f"Quiz Challenge: Original Score {sub.msq_score} marks"
                submitted_text = f"Student submitted quiz responses ({len(sub.responses_detail or [])} questions answered)."
                quiz_breakdown = sub.responses_detail or []

        res.append({
            "id": r.id,
            "student_name": student.name if student else "Student",
            "student_regno": student.regno if student else "",
            "assessment_type": r.assessment_type,
            "assessment_id": r.assessment_id,
            "original_score": r.original_score,
            "current_score": r.original_score,
            "student_reason": r.student_reason,
            "reason": r.student_reason,
            "course_title": course_title,
            "module_name": module_name,
            "task_title": task_title,
            "question_text": question_text,
            "submitted_code": submitted_code,
            "submitted_text": submitted_text,
            "compiler_output": compiler_output,
            "teacher_feedback": teacher_feedback,
            "programming_language": prog_lang,
            "quiz_breakdown": quiz_breakdown,
            "created_at": r.created_at
        })
    return res

@router.post("/{reval_id}/resolve")
@router.post("/resolve/{reval_id}")
def resolve_revaluation(
    reval_id: str,
    req: schemas.RevaluationResolveRequest,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only.")

    rev = db.query(models.RevaluationRequest).filter(models.RevaluationRequest.id == reval_id).first()
    if not rev:
        raise HTTPException(status_code=404, detail="Revaluation request not found.")

    rev.status = req.status.lower()
    rev.teacher_notes = req.teacher_notes

    if req.status.lower() == "accepted" and req.revised_score is not None:
        rev.revised_score = float(req.revised_score)
        student = db.query(models.Student).filter(models.Student.id == rev.student_id).first()

        module = None
        msq = 0.0
        mst = 0.0

        # Update the actual submission record
        if rev.assessment_type == "quiz":
            sub = db.query(models.QuizSubmission).filter(models.QuizSubmission.id == rev.assessment_id).first()
            if sub:
                sub.msq_score = float(req.revised_score)
                module = db.query(models.Module).filter(models.Module.id == sub.module_id).first()
                msq = float(req.revised_score)
                # Check task submission if exists for this module
                if module:
                    task_ids = [t.id for t in module.task_challenges]
                    last_task_sub = db.query(models.TaskSubmission).filter(
                        models.TaskSubmission.student_id == rev.student_id,
                        models.TaskSubmission.task_id.in_(task_ids)
                    ).order_by(models.TaskSubmission.submitted_at.desc()).first() if task_ids else None
                    mst = float(last_task_sub.mst_score) if (last_task_sub and last_task_sub.mst_score is not None) else 0.0

        elif rev.assessment_type == "task":
            sub = db.query(models.TaskSubmission).filter(models.TaskSubmission.id == rev.assessment_id).first()
            if sub:
                sub.mst_score = float(req.revised_score)
                if req.teacher_notes:
                    sub.teacher_feedback = req.teacher_notes
                sub.evaluated_by = current_user.id
                sub.evaluated_at = datetime.utcnow()
                if sub.task:
                    module = sub.task.module
                mst = float(req.revised_score)
                if module:
                    last_quiz = db.query(models.QuizSubmission).filter(
                        models.QuizSubmission.student_id == rev.student_id,
                        models.QuizSubmission.module_id == module.id
                    ).order_by(models.QuizSubmission.submitted_at.desc()).first()
                    msq = float(last_quiz.msq_score) if last_quiz else 0.0

        # Recalculate Model 4, Leaderboard Score (tp_total_performance), and Coins
        if module and student:
            course = module.course
            w1 = course.w1_quiz_weight if course else 0.5
            w2 = course.w2_task_weight if course else 0.5
            scaled_msq = msq * 10.0 if msq <= 10.0 else msq
            tp = (w1 * scaled_msq) + (w2 * mst)

            # Re-evaluate ANN Model 4: Cognitive Update
            cmc = module.complexity_cmc or 1
            raw_label, leaderboard_level = ai_engine.predict_cognitive_update(cmc, tp)

            cog_backend_map = {"Fast Learner": "fast", "Medium Learner": "average", "Slow Learner": "slow"}
            new_cog = cog_backend_map.get(raw_label, "average")

            final_cog, new_streak = check_streak_and_promotion(
                current_level=student.cognitive_level or "average",
                new_level=new_cog,
                current_streak=student.level_streak_count or 0
            )
            student.cognitive_level = final_cog
            student.level_streak_count = new_streak

            # Recalculate reward coins for the tier
            new_reward_coins = calculate_reward_coins(leaderboard_level)

            # Find or update LearnerModuleState
            st = db.query(models.LearnerModuleState).filter(
                models.LearnerModuleState.student_id == student.id,
                models.LearnerModuleState.module_id == module.id
            ).first()

            old_reward = 0
            if st:
                old_reward = st.reward_coins_earned or 0
                st.msq = msq
                st.mst = mst
                st.tp_total_performance = tp
                st.model4_output = raw_label
                st.leaderboard_level = leaderboard_level
                st.level_streak_count = new_streak
                st.reward_coins_earned = new_reward_coins
            else:
                st = models.LearnerModuleState(
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
                    reward_coins_earned=new_reward_coins
                )
                db.add(st)

            # Adjust student total coins:
            # 1. Tier upgrade bonus difference:
            tier_diff = new_reward_coins - old_reward
            if tier_diff > 0:
                student.total_coins += tier_diff

            # 2. Mark improvement coin reward (10 coins per point gained in revaluation):
            score_diff = rev.revised_score - (rev.original_score or 0.0)
            if score_diff > 0:
                mark_coins = int(score_diff * 10)
                student.total_coins += mark_coins

    db.commit()
    return {"message": f"Revaluation request {rev.status}."}

