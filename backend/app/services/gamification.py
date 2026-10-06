from datetime import datetime, timedelta

ELEMENT_INDICES = {
    "Feedback": 0,
    "Leaderboard": 1,
    "Badges": 2,
    "ProgressBar": 3,
    "Mystery": 4,
    "Rewards": 5
}

INDEX_TO_ELEMENT = {v: k for k, v in ELEMENT_INDICES.items()}

PT_LS_GROUPS = {
    "Visionaries": {"Feedback", "Leaderboard", "Badges"},
    "Mentors": {"Badges", "ProgressBar", "Mystery"},
    "Pioneers": {"Leaderboard", "Mystery", "Rewards"},
    "Conquerors": {"Badges", "ProgressBar", "Leaderboard"}
}

def initialize_engagement_score(pt_ls: str) -> list[int]:
    """
    Algorithm 2: Initialize engagement score vector:
    [Feedback, Leaderboard, Badges, ProgressBar, Mystery, Rewards]
    """
    if pt_ls == "Visionaries":
        return [2, 2, 2, 0, 0, 0]
    elif pt_ls == "Mentors":
        return [0, 0, 2, 2, 2, 0]
    elif pt_ls == "Pioneers":
        return [0, 2, 0, 0, 2, 2]
    elif pt_ls == "Conquerors":
        return [0, 2, 2, 2, 0, 0]
    return [1, 1, 1, 1, 1, 1]

def update_and_reclassify(current_pt_ls: str, current_scores: list[int], ratings: dict) -> tuple[list[int], str]:
    """
    Algorithm 3: Adds ratings to cumulative engagement scores and dynamically reclassifies learner.
    ratings: dict with keys like 'r_feedback', 'r_leaderboard', etc. (1-5)
    """
    updated_scores = list(current_scores)
    
    mapping = {
        "Feedback": ratings.get("r_feedback") or 0,
        "Leaderboard": ratings.get("r_leaderboard") or 0,
        "Badges": ratings.get("r_badges") or 0,
        "ProgressBar": ratings.get("r_progress_bar") or 0,
        "Mystery": ratings.get("r_mystery") or 0,
        "Rewards": ratings.get("r_rewards") or 0,
    }

    for elem, val in mapping.items():
        idx = ELEMENT_INDICES[elem]
        updated_scores[idx] += int(val)

    # Find top 3 elements
    # Sort elements by score descending, resolving ties stably
    ranked = sorted(ELEMENT_INDICES.keys(), key=lambda e: updated_scores[ELEMENT_INDICES[e]], reverse=True)
    top_3_elements = set(ranked[:3])

    # Check exact match with any PT_LS group
    new_pt_ls = current_pt_ls
    for group_name, group_elements in PT_LS_GROUPS.items():
        if top_3_elements == group_elements:
            new_pt_ls = group_name
            break

    return updated_scores, new_pt_ls

def calculate_reward_coins(leaderboard_level: str) -> int:
    """
    Reward coins rule:
    - Stepper: +100
    - Jogger: +250
    - Glider: +500
    """
    if leaderboard_level == "Glider":
        return 500
    elif leaderboard_level == "Jogger":
        return 250
    return 100

def check_streak_and_promotion(current_level: str, new_level: str, current_streak: int) -> tuple[str, int]:
    """
    Algorithm 6: If learner maintains the same cognitive level for >= 2 consecutive modules,
    they are automatically promoted to the next cognitive level.
    """
    if new_level == current_level:
        updated_streak = current_streak + 1
        if updated_streak >= 2:
            # Promote
            if current_level == "slow":
                promoted_level = "average"
            elif current_level == "average":
                promoted_level = "fast"
            else:
                promoted_level = "fast"
            return promoted_level, 0
        return current_level, updated_streak
    else:
        return new_level, 1

def regenerate_hearts(current_hearts: int, last_loss_at: datetime | None) -> tuple[int, datetime | None]:
    """
    Regenerates 1 heart per 30 minutes up to maximum of 5.
    """
    if current_hearts >= 5 or last_loss_at is None:
        return min(current_hearts, 5), None

    now = datetime.utcnow()
    diff = now - last_loss_at
    half_hours = int(diff.total_seconds() // 1800) # 1800 seconds = 30 minutes

    if half_hours > 0:
        new_hearts = min(5, current_hearts + half_hours)
        if new_hearts >= 5:
            return 5, None
        else:
            # Remaining time window
            remaining_loss_at = last_loss_at + timedelta(seconds=half_hours * 1800)
            return new_hearts, remaining_loss_at

    return current_hearts, last_loss_at
