from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from urllib.parse import urlparse

def validate_google_docs_link(v: Optional[str]) -> Optional[str]:
    if not v or not str(v).strip():
        return None
    val = str(v).strip()
    if not val.startswith("http://") and not val.startswith("https://"):
        val = "https://" + val
    try:
        parsed = urlparse(val)
        host = (parsed.hostname or "").lower()
        if not (host == "docs.google.com" or host.endswith(".docs.google.com") or 
                host == "drive.google.com" or host.endswith(".drive.google.com")):
            raise ValueError(
                "Only Google Docs / Google Drive links (https://docs.google.com/... or https://drive.google.com/...) are allowed. File uploads and other links are not permitted."
            )
        return val
    except ValueError:
        raise
    except Exception:
        raise ValueError("Invalid Google Docs URL format.")

# -----------------------------------------------------------------------------
# Auth & User Schemas
# -----------------------------------------------------------------------------
class StudentRegister(BaseModel):
    name: str
    regno: str
    gender: str = "others" # male, female, others
    department: str
    email: EmailStr
    password: str

class TeacherRegister(BaseModel):
    name: str
    employee_id: str
    gender: str = "others"
    department: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "student" # student or teacher

class PasswordResetRequest(BaseModel):
    role: str = "student" # student or teacher
    email: EmailStr
    identifier: str # regno for student, employee_id for teacher
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    name: str
    form_submission: Optional[bool] = None
    pt_ls: Optional[str] = None
    gender: Optional[str] = None
    avatar_path: Optional[str] = None
    cognitive_level: Optional[str] = None

# -----------------------------------------------------------------------------
# Onboarding Survey (24 Questions)
# -----------------------------------------------------------------------------
class SurveyRequest(BaseModel):
    # 12 Player Type questions (Values: 1: Hate it, 2: Dislike it, 3: Like it, 4: Love it)
    pt_responses: List[int] # length 12
    # 12 Learning Style questions (Values: 1 or 2)
    ls_responses: List[int] # length 12

class SurveyResultOut(BaseModel):
    ppt: str
    spt: str
    ld1: str
    ld2: str
    ld3: str
    ld4: str
    pt_ls: str
    avatar_path: str
    engagement_scores: List[int]
    message: str

# -----------------------------------------------------------------------------
# Course & Module Schemas
# -----------------------------------------------------------------------------
class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    join_code: str # Instructor chosen
    allowed_compilers: List[str] = ["python", "c", "cpp", "java"]
    w1_quiz_weight: float = 0.5
    w2_task_weight: float = 0.5
    passing_threshold_p: float = 5.0

class CourseOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    join_code: str
    teacher_id: str
    allowed_compilers: List[str]
    w1_quiz_weight: float
    w2_task_weight: float
    passing_threshold_p: float
    created_at: datetime
    class Config:
        from_attributes = True

class CourseEnrollRequest(BaseModel):
    join_code: str

class ModuleCreate(BaseModel):
    course_id: str
    module_no: int
    concept_name: str
    complexity_cmc: int = 1
    w1_quiz_weight: float = 0.5
    w2_task_weight: float = 0.5
    passing_threshold_p: float = 5.0

class ModuleOut(BaseModel):
    id: str
    course_id: str
    module_no: int
    concept_name: str
    complexity_cmc: int
    w1_quiz_weight: float
    w2_task_weight: float
    passing_threshold_p: float
    class Config:
        from_attributes = True

# -----------------------------------------------------------------------------
# Study Material Schemas
# -----------------------------------------------------------------------------
class StudyMaterialCreate(BaseModel):
    module_id: str
    learning_level: str # slow, average, fast
    title: str
    content_html: str
    pdf_url: Optional[str] = None
    is_locked_bonus: bool = False

    @field_validator("pdf_url")
    @classmethod
    def validate_pdf_url(cls, v):
        return validate_google_docs_link(v)

class StudyMaterialOut(BaseModel):
    id: str
    module_id: str
    learning_level: str
    title: str
    content_html: str
    pdf_url: Optional[str]
    is_locked_bonus: bool
    class Config:
        from_attributes = True

class StudyMaterialUpdate(BaseModel):
    learning_level: Optional[str] = None
    title: Optional[str] = None
    content_html: Optional[str] = None
    pdf_url: Optional[str] = None
    is_locked_bonus: Optional[bool] = None

    @field_validator("pdf_url")
    @classmethod
    def validate_pdf_url(cls, v):
        if not v or not str(v).strip():
            return None
        return validate_google_docs_link(v)

# -----------------------------------------------------------------------------
# Quiz Schemas
# -----------------------------------------------------------------------------
class QuizQuestionCreate(BaseModel):
    module_id: str
    cognitive_level: str # slow, average, fast
    target_pt_ls: str = "Universal"
    blooms_level: str = "Remembering"
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    hint_text: Optional[str] = None
    explanation: Optional[str] = None

class QuizQuestionOut(BaseModel):
    id: str
    module_id: str
    cognitive_level: str
    blooms_level: str
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    hint_text: Optional[str] = None
    # correct_option and explanation are hidden during active test
    class Config:
        from_attributes = True

class QuizQuestionUpdate(BaseModel):
    cognitive_level: Optional[str] = None
    target_pt_ls: Optional[str] = None
    blooms_level: Optional[str] = None
    question_text: Optional[str] = None
    option_a: Optional[str] = None
    option_b: Optional[str] = None
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    correct_option: Optional[str] = None
    hint_text: Optional[str] = None
    explanation: Optional[str] = None

class QuizAnswerItem(BaseModel):
    question_id: str
    chosen_option: str
    lifelines_used: List[str] = [] # 50_50, double_dip, hint, swap

class QuizSubmissionRequest(BaseModel):
    module_id: str
    answers: List[QuizAnswerItem]
    ttq_seconds: int

class QuizSubmissionOut(BaseModel):
    id: str
    msq_score: float
    total_questions: int
    accuracy: float
    mistake_category_hit: str
    passed: bool
    next_step: str # "proceed_to_task" or "downgraded_retry"
    explanation_map: Optional[Dict[str, str]] = None # Visible only to Visionaries!

# -----------------------------------------------------------------------------
# Task Challenge & Submission Schemas
# -----------------------------------------------------------------------------
class TaskChallengeCreate(BaseModel):
    module_id: str
    complexity_qlc: str # basic, intermediate, advanced
    target_pt_ls: str = "Universal"
    blooms_level: str = "Applying"
    task_type: str = "programming" # programming or descriptive
    title: str
    problem_statement: str
    starter_code: Optional[Dict[str, str]] = None
    test_cases: Optional[List[Dict[str, Any]]] = None
    max_marks: int = 100
    pdf_attachment: Optional[str] = None
    is_locked_bonus: bool = False

    @field_validator("pdf_attachment")
    @classmethod
    def validate_pdf_attachment(cls, v):
        return validate_google_docs_link(v)

class TaskChallengeOut(BaseModel):
    id: str
    module_id: str
    complexity_qlc: str
    target_pt_ls: Optional[str] = "Universal"
    blooms_level: Optional[str] = "Applying"
    task_type: str
    title: str
    problem_statement: str
    starter_code: Optional[Dict[str, str]]
    max_marks: int
    pdf_attachment: Optional[str]
    is_locked_bonus: Optional[bool] = False
    class Config:
        from_attributes = True

class TaskChallengeUpdate(BaseModel):
    complexity_qlc: Optional[str] = None
    target_pt_ls: Optional[str] = None
    blooms_level: Optional[str] = None
    task_type: Optional[str] = None
    title: Optional[str] = None
    problem_statement: Optional[str] = None
    starter_code: Optional[Dict[str, str]] = None
    test_cases: Optional[List[Dict[str, Any]]] = None
    max_marks: Optional[int] = None
    pdf_attachment: Optional[str] = None
    is_locked_bonus: Optional[bool] = None

    @field_validator("pdf_attachment")
    @classmethod
    def validate_pdf_attachment(cls, v):
        if not v or not str(v).strip():
            return None
        return validate_google_docs_link(v)

class CodeRunRequest(BaseModel):
    language: str
    code: str
    stdin_input: str = ""

class CodeRunResponse(BaseModel):
    success: bool
    output: str
    error: str

class TaskSubmitRequest(BaseModel):
    task_id: str
    programming_language: Optional[str] = None
    submitted_code: Optional[str] = None
    submitted_text: Optional[str] = None
    compiler_output: Optional[str] = None

class TaskGradeRequest(BaseModel):
    mst_score: float
    teacher_feedback: Optional[str] = None

# -----------------------------------------------------------------------------
# Lifeline / In-Quiz Action
# -----------------------------------------------------------------------------
class LifelineRequest(BaseModel):
    lifeline_type: str # 50_50, double_dip, swap, hint, extra_time, ask_expert
    question_id: Optional[str] = None
    module_id: str

# -----------------------------------------------------------------------------
# End-of-Module Element Rating (Algorithm 3)
# -----------------------------------------------------------------------------
class ElementRatingRequest(BaseModel):
    module_id: str
    rating_skipped: bool = False
    r_feedback: Optional[int] = None
    r_leaderboard: Optional[int] = None
    r_badges: Optional[int] = None
    r_progress_bar: Optional[int] = None
    r_mystery: Optional[int] = None
    r_rewards: Optional[int] = None

# -----------------------------------------------------------------------------
# Revaluation Request
# -----------------------------------------------------------------------------
class RevaluationRequestCreate(BaseModel):
    assessment_type: str # quiz or task
    assessment_id: str
    student_reason: str

class RevaluationResolveRequest(BaseModel):
    status: str # accepted or rejected
    revised_score: Optional[float] = None
    teacher_notes: Optional[str] = None

# -----------------------------------------------------------------------------
# Peer Learning
# -----------------------------------------------------------------------------
class PeerQueryCreate(BaseModel):
    module_id: str
    query_text: str

class PeerAnswerCreate(BaseModel):
    query_id: str
    answer_text: str

class LeaderboardEntry(BaseModel):
    student_id: str
    student_name: str
    regno: str
    avatar_path: Optional[str]
    pt_ls: Optional[str]
    leaderboard_level: str # Stepper, Jogger, Glider
    total_coins: int
    overall_points: float
