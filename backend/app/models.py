import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Teacher(Base):
    __tablename__ = "teachers"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    employee_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    gender = Column(String(20), nullable=False, default="others")
    department = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    courses = relationship("Course", back_populates="teacher")

class Student(Base):
    __tablename__ = "students"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    regno = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    gender = Column(String(20), nullable=False, default="others")
    department = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # 24-Survey and Archetype Profiling
    form_submission = Column(Boolean, default=False)
    pt_ls = Column(String(30), nullable=True) # Visionaries, Mentors, Conquerors, Pioneers
    avatar_path = Column(String(255), nullable=True)
    ppt = Column(String(20), nullable=True) # Primary Player Type
    spt = Column(String(20), nullable=True) # Secondary Player Type
    ld1_active_reflective = Column(String(15), nullable=True)
    ld2_sequential_global = Column(String(15), nullable=True)
    ld3_sensing_intuitive = Column(String(15), nullable=True)
    ld4_visual_verbal = Column(String(15), nullable=True)
    
    # Cognitive Level (Backend: slow, average, fast; UI: Stepper, Jogger, Glider)
    cognitive_level = Column(String(20), default="average")
    level_streak_count = Column(Integer, default=0)
    
    # Gamification Lifelines & Currency
    hearts = Column(Integer, default=5)
    last_heart_loss_at = Column(DateTime, nullable=True)
    total_coins = Column(Integer, default=0)
    total_keys = Column(Integer, default=1)
    free_hints = Column(Integer, default=2)
    free_extra_time = Column(Integer, default=1)
    free_swaps = Column(Integer, default=2)
    free_double_dips = Column(Integer, default=1)
    free_fifty_fifty = Column(Integer, default=2)
    high_achiever_bonus_active = Column(Boolean, default=False)
    
    # Engagement score vector for Algorithm 2, 3, 4: [Feedback, Leaderboard, Badges, ProgressBar, Mystery, Rewards]
    engagement_scores = Column(JSON, default=lambda: [0, 0, 0, 0, 0, 0])
    
    created_at = Column(DateTime, default=datetime.utcnow)

    enrollments = relationship("CourseEnrollment", back_populates="student")
    quiz_submissions = relationship("QuizSubmission", back_populates="student")
    task_submissions = relationship("TaskSubmission", back_populates="student")
    badges = relationship("UserBadge", back_populates="student")

class Course(Base):
    __tablename__ = "courses"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    join_code = Column(String(50), unique=True, nullable=False, index=True)
    teacher_id = Column(String(36), ForeignKey("teachers.id"), nullable=False)
    allowed_compilers = Column(JSON, default=lambda: ["python", "c", "cpp", "java"])
    w1_quiz_weight = Column(Float, default=0.5)
    w2_task_weight = Column(Float, default=0.5)
    passing_threshold_p = Column(Float, default=5.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("Teacher", back_populates="courses")
    enrollments = relationship("CourseEnrollment", back_populates="course")
    modules = relationship("Module", back_populates="course", order_by="Module.module_no")

class CourseEnrollment(Base):
    __tablename__ = "course_enrollments"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    course_id = Column(String(36), ForeignKey("courses.id"), nullable=False)
    status = Column(String(20), default="active")
    enrolled_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

class Module(Base):
    __tablename__ = "modules"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    course_id = Column(String(36), ForeignKey("courses.id"), nullable=False)
    module_no = Column(Integer, nullable=False)
    concept_name = Column(String(150), nullable=False)
    complexity_cmc = Column(Integer, default=1) # 1: Low, 2: Medium, 3: High
    w1_quiz_weight = Column(Float, default=0.5)
    w2_task_weight = Column(Float, default=0.5)
    passing_threshold_p = Column(Float, default=5.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="modules")
    study_materials = relationship("StudyMaterial", back_populates="module")
    quiz_questions = relationship("QuizQuestion", back_populates="module")
    task_challenges = relationship("TaskChallenge", back_populates="module")

class StudyMaterial(Base):
    __tablename__ = "study_materials"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    module_id = Column(String(36), ForeignKey("modules.id"), nullable=False)
    learning_level = Column(String(20), nullable=False) # slow (Basic), average (Intermediate), fast (Advanced)
    title = Column(String(200), nullable=False)
    content_html = Column(Text, nullable=False)
    pdf_url = Column(String(500), nullable=True)
    is_locked_bonus = Column(Boolean, default=False) # Unlocked via 1 Key (400 coins)
    created_at = Column(DateTime, default=datetime.utcnow)

    module = relationship("Module", back_populates="study_materials")

class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    module_id = Column(String(36), ForeignKey("modules.id"), nullable=False)
    cognitive_level = Column(String(20), nullable=False) # slow (Easy), average (Medium), fast (Hard)
    target_pt_ls = Column(String(30), nullable=False, default="Universal")
    blooms_level = Column(String(50), nullable=False, default="Remembering")
    question_text = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_option = Column(String(5), nullable=False) # A, B, C, D
    hint_text = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True) # Shown to Visionaries (Feedback element)
    created_at = Column(DateTime, default=datetime.utcnow)

    module = relationship("Module", back_populates="quiz_questions")

class TaskChallenge(Base):
    __tablename__ = "task_challenges"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    module_id = Column(String(36), ForeignKey("modules.id"), nullable=False)
    complexity_qlc = Column(String(20), nullable=False) # basic, intermediate, advanced
    target_pt_ls = Column(String(30), nullable=False, default="Universal")
    blooms_level = Column(String(50), nullable=False, default="Applying") # Bloom's Taxonomy
    task_type = Column(String(20), nullable=False, default="programming") # programming, descriptive
    title = Column(String(200), nullable=False)
    problem_statement = Column(Text, nullable=False)
    starter_code = Column(JSON, nullable=True)
    test_cases = Column(JSON, nullable=True)
    max_marks = Column(Integer, default=100)
    pdf_attachment = Column(String(500), nullable=True)
    is_locked_bonus = Column(Boolean, default=False) # Mentor Mystery Box challenge
    created_at = Column(DateTime, default=datetime.utcnow)

    module = relationship("Module", back_populates="task_challenges")

class QuizSubmission(Base):
    __tablename__ = "quiz_submissions"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    module_id = Column(String(36), ForeignKey("modules.id"), nullable=False)
    msq_score = Column(Float, nullable=False)
    ttq_seconds = Column(Integer, nullable=False)
    mistake_category_hit = Column(String(20), nullable=False)
    q_easy_count = Column(Integer, default=0)
    q_med_count = Column(Integer, default=0)
    q_hard_count = Column(Integer, default=0)
    coq_predicted = Column(String(20), nullable=False) # Model 2 output (INTERNAL ONLY)
    responses_detail = Column(JSON, nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="quiz_submissions")

class TaskSubmission(Base):
    __tablename__ = "task_submissions"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    task_id = Column(String(36), ForeignKey("task_challenges.id"), nullable=False)
    programming_language = Column(String(20), nullable=True)
    submitted_code = Column(Text, nullable=True)
    submitted_text = Column(Text, nullable=True)
    compiler_output = Column(Text, nullable=True)
    mst_score = Column(Float, nullable=True)
    teacher_feedback = Column(Text, nullable=True)
    evaluated_by = Column(String(36), ForeignKey("teachers.id"), nullable=True)
    evaluated_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    # Hybrid Neuro-Symbolic Autograding fields
    auto_eval_score = Column(Float, nullable=True)
    auto_eval_explanation = Column(Text, nullable=True)
    auto_eval_confidence = Column(String(20), default="high") # high, medium, borderline
    auto_eval_details = Column(Text, nullable=True) # JSON test breakdown / rubric details
    is_calibrated = Column(Boolean, default=False)
    pre_check_count = Column(Integer, default=0)

    student = relationship("Student", back_populates="task_submissions")
    task = relationship("TaskChallenge")

class LearnerModuleState(Base):
    __tablename__ = "learner_module_states"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    module_id = Column(String(36), ForeignKey("modules.id"), nullable=False)
    pmc = Column(Integer, default=1)
    cmc = Column(Integer, default=1)
    msq = Column(Float, nullable=False)
    mst = Column(Float, nullable=False)
    tp_total_performance = Column(Float, nullable=False)
    model4_output = Column(String(20), nullable=False) # Model 4 output
    leaderboard_level = Column(String(20), nullable=False) # Stepper, Jogger, Glider (UPDATES LEADERBOARD)
    level_streak_count = Column(Integer, default=0)
    reward_coins_earned = Column(Integer, default=0)
    completed_at = Column(DateTime, default=datetime.utcnow)

class ElementRating(Base):
    __tablename__ = "element_ratings"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    module_id = Column(String(36), ForeignKey("modules.id"), nullable=False)
    rating_skipped = Column(Boolean, default=False)
    r_feedback = Column(Integer, nullable=True)
    r_leaderboard = Column(Integer, nullable=True)
    r_badges = Column(Integer, nullable=True)
    r_progress_bar = Column(Integer, nullable=True)
    r_mystery = Column(Integer, nullable=True)
    r_rewards = Column(Integer, nullable=True)
    resulting_pt_ls = Column(String(30), nullable=False)
    rated_at = Column(DateTime, default=datetime.utcnow)

class UserBadge(Base):
    __tablename__ = "user_badges"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    theme_archetype = Column(String(30), nullable=False)
    concept_name = Column(String(150), nullable=False)
    badge_tier = Column(String(20), nullable=False) # associate, professional, master
    badge_icon_path = Column(String(255), nullable=False)
    earned_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="badges")

class RevaluationRequest(Base):
    __tablename__ = "revaluation_requests"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    assessment_type = Column(String(10), nullable=False) # quiz or task
    assessment_id = Column(String(36), nullable=False)
    student_reason = Column(Text, nullable=False)
    original_score = Column(Float, nullable=False)
    revised_score = Column(Float, nullable=True)
    teacher_notes = Column(Text, nullable=True)
    status = Column(String(20), default="pending") # pending, accepted, rejected
    created_at = Column(DateTime, default=datetime.utcnow)

class PeerQuery(Base):
    __tablename__ = "peer_queries"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    module_id = Column(String(36), ForeignKey("modules.id"), nullable=False)
    heading = Column(String(255), nullable=True)
    query_text = Column(Text, nullable=False)
    status = Column(String(20), default="open") # open, answered, acknowledged
    created_at = Column(DateTime, default=datetime.utcnow)

    answers = relationship("PeerAnswer", back_populates="query")

class PeerAnswer(Base):
    __tablename__ = "peer_answers"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    query_id = Column(String(36), ForeignKey("peer_queries.id"), nullable=False)
    helper_student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    answer_text = Column(Text, nullable=False)
    is_acknowledged = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    query = relationship("PeerQuery", back_populates="answers")

class TaskSwapUsage(Base):
    __tablename__ = "task_swap_usages"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    module_id = Column(String(36), ForeignKey("modules.id"), nullable=False)
    swaps_used = Column(Integer, default=0)
    pre_checks_used = Column(Integer, default=0)
    last_swapped_at = Column(DateTime, default=datetime.utcnow)

class TaskExpertQuery(Base):
    __tablename__ = "task_expert_queries"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    task_id = Column(String(36), ForeignKey("task_challenges.id"), nullable=False)
    module_id = Column(String(36), ForeignKey("modules.id"), nullable=False)
    heading = Column(String(255), nullable=True)
    query_text = Column(Text, nullable=False)
    code_snapshot = Column(Text, nullable=True)
    compiler_output = Column(Text, nullable=True)
    status = Column(String(20), default="pending") # pending, answered
    teacher_reply = Column(Text, nullable=True)
    teacher_id = Column(String(36), ForeignKey("teachers.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    replied_at = Column(DateTime, nullable=True)

    student = relationship("Student")
    task = relationship("TaskChallenge")

class EvaluationCalibrationLog(Base):
    """
    RLHF Calibration Telemetry for PhD Research:
    Logs every time faculty confirms or alters an autograded score.
    Used for Reinforcement-Calibrated Expert Rule Weighting.
    """
    __tablename__ = "evaluation_calibration_logs"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    submission_id = Column(String(36), nullable=False)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    task_id = Column(String(36), ForeignKey("task_challenges.id"), nullable=False)
    assessment_type = Column(String(20), default="programming") # programming, descriptive
    auto_score = Column(Float, nullable=False)
    faculty_score = Column(Float, nullable=False)
    score_delta = Column(Float, nullable=False) # faculty_score - auto_score
    confidence = Column(String(20), nullable=True)
    auto_explanation = Column(Text, nullable=True)
    teacher_feedback = Column(Text, nullable=True)
    teacher_id = Column(String(36), ForeignKey("teachers.id"), nullable=True)
    calibrated_at = Column(DateTime, default=datetime.utcnow)
