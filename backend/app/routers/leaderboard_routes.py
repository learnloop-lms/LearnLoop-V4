from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models

router = APIRouter(prefix="/leaderboards", tags=["Leaderboards"])

@router.get("/{course_id}")
def get_course_leaderboards(course_id: str, db: Session = Depends(get_db)):
    """
    Returns separate leaderboards for Stepper, Jogger, and Glider tiers
    under the specified course so learners compete within their cognitive tier!
    """
    enrollments = db.query(models.CourseEnrollment).filter(
        models.CourseEnrollment.course_id == course_id,
        models.CourseEnrollment.status == "active"
    ).all()

    stepper_list = []
    jogger_list = []
    glider_list = []

    for en in enrollments:
        student = en.student
        cog = (student.cognitive_level or "average").lower()

        # Calculate overall points from module states
        states = db.query(models.LearnerModuleState).filter(
            models.LearnerModuleState.student_id == student.id
        ).all()
        total_score = sum(s.tp_total_performance for s in states)

        entry = {
            "student_id": student.id,
            "name": student.name,
            "regno": student.regno,
            "avatar_path": student.avatar_path,
            "pt_ls": student.pt_ls,
            "total_coins": student.total_coins,
            "total_score": round(total_score, 1),
            "hearts": student.hearts
        }

        if cog == "slow":
            stepper_list.append(entry)
        elif cog == "fast":
            glider_list.append(entry)
        else:
            jogger_list.append(entry)

    # Sort each board descending by total_score then coins
    stepper_list.sort(key=lambda x: (-x["total_score"], -x["total_coins"]))
    jogger_list.sort(key=lambda x: (-x["total_score"], -x["total_coins"]))
    glider_list.sort(key=lambda x: (-x["total_score"], -x["total_coins"]))

    return {
        "course_id": course_id,
        "stepper_leaderboard": stepper_list,
        "jogger_leaderboard": jogger_list,
        "glider_leaderboard": glider_list
    }
