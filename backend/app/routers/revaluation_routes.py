from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth

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

        # Update the actual submission record
        if rev.assessment_type == "quiz":
            sub = db.query(models.QuizSubmission).filter(models.QuizSubmission.id == rev.assessment_id).first()
            if sub:
                sub.msq_score = float(req.revised_score)
        elif rev.assessment_type == "task":
            sub = db.query(models.TaskSubmission).filter(models.TaskSubmission.id == rev.assessment_id).first()
            if sub:
                sub.mst_score = float(req.revised_score)
                if req.teacher_notes:
                    sub.teacher_feedback = req.teacher_notes
                sub.evaluated_by = current_user.id
                sub.evaluated_at = datetime.utcnow()

    db.commit()
    return {"message": f"Revaluation request {rev.status}."}

