from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app import models
from app.services.ai_engine import ai_engine
from app.services.gamification import calculate_reward_coins, check_streak_and_promotion

def cascade_quiz_question_revaluation(
    question_id: str,
    new_correct_option: str,
    db: Session,
    new_explanation: str = None
) -> dict:
    """
    When a teacher corrects the answer key of a quiz question (e.g. from 'B' to 'A'):
    1. Updates QuizQuestion in the database.
    2. Finds ALL student submissions for that question's module.
    3. Re-evaluates every student who answered this question:
       - Updates responses_detail JSON (correct_option, correct_answer, is_correct)
       - Recalculates total msq_score
       - Recalculates cognitive model updates (Model 4), leaderboard performance (tp_total_performance), and coins
    4. Automatically resolves or updates any pending RevaluationRequest for this submission.
    """
    question = db.query(models.QuizQuestion).filter(models.QuizQuestion.id == question_id).first()
    if not question:
        raise ValueError(f"Quiz question with id '{question_id}' not found.")

    old_option = (question.correct_option or "").strip().upper()
    new_option = new_correct_option.strip().upper()

    question.correct_option = new_option
    if new_explanation is not None:
        question.explanation = new_explanation

    # Determine correct answer text for the new option
    opt_map = {
        "A": (question.option_a or "").strip(),
        "B": (question.option_b or "").strip(),
        "C": (question.option_c or "").strip(),
        "D": (question.option_d or "").strip(),
    }
    new_corr_text = opt_map.get(new_option[:1], question.option_a or new_option)

    # Fetch all submissions for this module
    submissions = db.query(models.QuizSubmission).filter(
        models.QuizSubmission.module_id == question.module_id
    ).all()

    module = question.module
    course = module.course if module else None
    w1 = course.w1_quiz_weight if course else 0.5
    w2 = course.w2_task_weight if course else 0.5
    cmc = module.complexity_cmc if module else 1

    affected_students = []

    for sub in submissions:
        responses = list(sub.responses_detail or [])
        found = False
        old_student_score = sub.msq_score

        for item in responses:
            if item.get("question_id") == question_id:
                found = True
                item["correct_option"] = new_option

                # Check student answer
                is_fib = item.get("is_fill_blank", False)
                is_tf = item.get("is_tf", False)
                student_ans_raw = str(item.get("student_answer") or item.get("chosen_option") or "")

                if is_fib:
                    expected = (question.option_a or new_option).strip().lower()
                    is_correct = bool(student_ans_raw and expected and (student_ans_raw.strip().lower() == expected))
                    item["correct_answer"] = question.option_a or new_option
                elif is_tf:
                    expected_tf = "TRUE" if new_option in ["A", "TRUE", "T"] else "FALSE"
                    student_tf = "TRUE" if student_ans_raw.strip().upper() in ["A", "TRUE", "T"] else "FALSE"
                    is_correct = (student_tf == expected_tf)
                    item["correct_answer"] = expected_tf.capitalize()
                else:
                    corr_letter = new_option[:1]
                    student_letter = student_ans_raw.strip().upper()[:1]
                    is_correct = (student_letter == corr_letter)
                    item["correct_answer"] = f"{corr_letter}: {opt_map.get(corr_letter, '')}"

                item["is_correct"] = is_correct
                if question.explanation:
                    item["explanation"] = question.explanation

        if not found:
            continue

        # Recalculate student's msq_score
        new_msq_score = float(sum(1 for r in responses if r.get("is_correct") is True))
        sub.msq_score = new_msq_score
        sub.responses_detail = responses
        flag_modified(sub, "responses_detail")

        student = sub.student
        if student and module:
            # Check last task submission to get mst
            task_ids = [t.id for t in module.task_challenges]
            last_task_sub = db.query(models.TaskSubmission).filter(
                models.TaskSubmission.student_id == student.id,
                models.TaskSubmission.task_id.in_(task_ids)
            ).order_by(models.TaskSubmission.submitted_at.desc()).first() if task_ids else None
            mst = float(last_task_sub.mst_score) if (last_task_sub and last_task_sub.mst_score is not None) else 0.0
            if mst > 10.0:
                mst = round(mst / 10.0, 1)

            scaled_msq = new_msq_score * 10.0 if new_msq_score <= 10.0 else new_msq_score
            scaled_mst = mst * 10.0 if mst <= 10.0 else mst
            tp = (w1 * scaled_msq) + (w2 * scaled_mst)

            # Re-evaluate ANN Model 4: Cognitive Update
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

            # Recalculate reward coins
            new_reward_coins = calculate_reward_coins(leaderboard_level)

            st = db.query(models.LearnerModuleState).filter(
                models.LearnerModuleState.student_id == student.id,
                models.LearnerModuleState.module_id == module.id
            ).first()

            old_reward = 0
            if st:
                old_reward = st.reward_coins_earned or 0
                st.msq = new_msq_score
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
                    msq=new_msq_score,
                    mst=mst,
                    tp_total_performance=tp,
                    model4_output=raw_label,
                    leaderboard_level=leaderboard_level,
                    level_streak_count=new_streak,
                    reward_coins_earned=new_reward_coins
                )
                db.add(st)

            tier_diff = new_reward_coins - old_reward
            if tier_diff > 0:
                student.total_coins += tier_diff

            score_diff = new_msq_score - old_student_score
            if score_diff > 0:
                student.total_coins += int(score_diff * 10)

        # Check any pending RevaluationRequest for this submission
        pending_reval = db.query(models.RevaluationRequest).filter(
            models.RevaluationRequest.student_id == sub.student_id,
            models.RevaluationRequest.assessment_type == "quiz",
            models.RevaluationRequest.assessment_id == sub.id,
            models.RevaluationRequest.status == "pending"
        ).first()

        if pending_reval:
            pending_reval.status = "accepted"
            pending_reval.revised_score = new_msq_score
            pending_reval.teacher_notes = (
                f"Question key updated from '{old_option}' to '{new_option}'. "
                f"Quiz mark automatically re-evaluated to {new_msq_score}/10."
            )

        affected_students.append({
            "student_id": sub.student_id,
            "student_name": student.name if student else "Student",
            "student_regno": student.regno if student else "",
            "old_score": old_student_score,
            "new_score": new_msq_score
        })

    db.commit()
    return {
        "question_id": question_id,
        "old_correct_option": old_option,
        "new_correct_option": new_option,
        "affected_count": len(affected_students),
        "affected_students": affected_students
    }
