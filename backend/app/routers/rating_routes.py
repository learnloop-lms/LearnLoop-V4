from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.services.gamification import update_and_reclassify

router = APIRouter(prefix="/ratings", tags=["Gamification Element Ratings"])

@router.post("/submit")
def submit_element_rating(
    req: schemas.ElementRatingRequest,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    resulting_pt_ls = current_user.pt_ls

    if not req.rating_skipped:
        ratings_dict = {
            "r_feedback": req.r_feedback,
            "r_leaderboard": req.r_leaderboard,
            "r_badges": req.r_badges,
            "r_progress_bar": req.r_progress_bar,
            "r_mystery": req.r_mystery,
            "r_rewards": req.r_rewards
        }
        current_scores = current_user.engagement_scores or [0, 0, 0, 0, 0, 0]
        updated_scores, new_pt_ls = update_and_reclassify(current_user.pt_ls, current_scores, ratings_dict)
        
        current_user.engagement_scores = updated_scores
        if new_pt_ls != current_user.pt_ls:
            current_user.pt_ls = new_pt_ls
            # Update avatar path with new theme while preserving gender
            gender_suffix = "girl" if current_user.gender == "female" else "boy"
            theme_key = new_pt_ls.lower()
            singular_key = {
                "visionaries": "visionary",
                "mentors": "mentor",
                "conquerors": "conqueror",
                "pioneers": "pioneer"
            }.get(theme_key, "visionary")
            current_user.avatar_path = f"/assets/{theme_key}/{singular_key}_avatar_{gender_suffix}.png"

        resulting_pt_ls = new_pt_ls

    # Store in database for research telemetry (even if skipped!)
    rating_rec = models.ElementRating(
        student_id=current_user.id,
        module_id=req.module_id,
        rating_skipped=req.rating_skipped,
        r_feedback=req.r_feedback,
        r_leaderboard=req.r_leaderboard,
        r_badges=req.r_badges,
        r_progress_bar=req.r_progress_bar,
        r_mystery=req.r_mystery,
        r_rewards=req.r_rewards,
        resulting_pt_ls=resulting_pt_ls
    )
    db.add(rating_rec)
    db.commit()

    return {
        "message": "Ratings saved successfully." if not req.rating_skipped else "Rating skip recorded.",
        "rating_skipped": req.rating_skipped,
        "current_pt_ls": current_user.pt_ls,
        "avatar_path": current_user.avatar_path
    }
