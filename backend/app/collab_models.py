import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class CollabChallenge(Base):
    __tablename__ = "collab_challenges"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    course_id = Column(String(36), ForeignKey("courses.id"), nullable=False, index=True)
    teacher_id = Column(String(36), ForeignKey("teachers.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    statement = Column(Text, nullable=False)
    group_size = Column(Integer, default=4) # 4, 8, 12, 16
    modules_count = Column(Integer, default=1) # K = group_size / 4
    base_time_minutes = Column(Integer, default=60)
    break_pool_minutes = Column(Integer, default=10)
    stage_deadlines = Column(JSON, default=lambda: {"plan": 0.25, "draft": 0.50, "review": 0.75, "final": 1.0})
    invite_expiry_minutes = Column(Integer, default=60)
    adaptive_on = Column(Boolean, default=True)
    beta_max = Column(Float, default=0.15)
    strict_roles = Column(Boolean, default=False)
    max_swaps = Column(Integer, default=2)
    p_mod = Column(Float, default=100.0)
    p_int = Column(Float, default=50.0)
    p_leader = Column(Float, default=20.0)
    w_role = Column(Float, default=30.0)
    w_feedback = Column(Float, default=20.0)
    eta_partial = Column(Float, default=0.5)
    status = Column(String(20), default="PUBLISHED") # DRAFT, PUBLISHED, ARCHIVED
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    test_cases = relationship("CollabTestCase", back_populates="challenge", cascade="all, delete-orphan")
    teams = relationship("CollabTeam", back_populates="challenge", cascade="all, delete-orphan")

class CollabTestCase(Base):
    __tablename__ = "collab_test_cases"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    challenge_id = Column(String(36), ForeignKey("collab_challenges.id"), nullable=False, index=True)
    module_index = Column(Integer, default=1) # 1..K
    input_data = Column(Text, default="")
    expected_output = Column(Text, default="")
    is_hidden = Column(Boolean, default=False)
    weight = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    challenge = relationship("CollabChallenge", back_populates="test_cases")

class CollabTeam(Base):
    __tablename__ = "collab_teams"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    challenge_id = Column(String(36), ForeignKey("collab_challenges.id"), nullable=False, index=True)
    module_index = Column(Integer, default=1)
    team_key = Column(String(255), default="") # comma-separated sorted student IDs
    leader_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    status = Column(String(30), default="FORMING") # FORMING, ACTIVE, IN_INTEGRATION, COMPLETED, TIMEOUT, CANCELLED
    final_time_minutes = Column(Float, default=60.0)
    adaptive_bonus = Column(Float, default=0.0)
    current_stage = Column(String(20), default="PLAN") # PLAN, DRAFT, REVIEW, FIX, APPROVED, SUBMITTED
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    passed = Column(Boolean, default=False)
    integration_passed = Column(Boolean, default=False)
    swaps_used = Column(Integer, default=0)
    handovers_used = Column(Integer, default=0)

    challenge = relationship("CollabChallenge", back_populates="teams")
    members = relationship("CollabTeamMember", back_populates="team", cascade="all, delete-orphan")
    invites = relationship("CollabInvite", back_populates="team", cascade="all, delete-orphan")
    workspace = relationship("CollabWorkspaceState", back_populates="team", uselist=False, cascade="all, delete-orphan")
    comments = relationship("CollabComment", back_populates="team", cascade="all, delete-orphan")
    messages = relationship("CollabChatMessage", back_populates="team", cascade="all, delete-orphan")
    contributions = relationship("CollabContributionLog", back_populates="team", cascade="all, delete-orphan")

class CollabTeamMember(Base):
    __tablename__ = "collab_team_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    team_id = Column(String(36), ForeignKey("collab_teams.id"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    module_index = Column(Integer, default=1)
    assigned_role = Column(String(20), nullable=False) # Visionary, Pioneer, Mentor, Conqueror
    is_leader = Column(Boolean, default=False)
    
    # Frozen snapshot of student attributes for the challenge (rules 4 & 6)
    locked_pt_ls = Column(String(30), nullable=False)
    locked_cognitive_level = Column(String(20), nullable=False)
    
    # Status & Activity tracking (Algorithm 6)
    is_active = Column(Boolean, default=True)
    is_on_break = Column(Boolean, default=False)
    break_pool_remaining_seconds = Column(Integer, default=600)
    last_action_at = Column(DateTime, default=datetime.utcnow)
    idle_prompted_at = Column(DateTime, nullable=True)
    is_flagged_inactive = Column(Boolean, default=False)
    is_away = Column(Boolean, default=False)
    away_start_at = Column(DateTime, nullable=True)
    break_start_at = Column(DateTime, nullable=True)
    lead_seconds = Column(Integer, default=0)
    role_performance_score = Column(Float, default=0.0)
    points_awarded = Column(Float, default=0.0)
    points_released = Column(Boolean, default=False)
    role_switch_opted = Column(String(30), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("CollabTeam", back_populates="members")
    student = relationship("Student")

class CollabInvite(Base):
    __tablename__ = "collab_invites"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    challenge_id = Column(String(36), ForeignKey("collab_challenges.id"), nullable=False, index=True)
    team_id = Column(String(36), ForeignKey("collab_teams.id"), nullable=False, index=True)
    module_index = Column(Integer, default=1)
    needed_role = Column(String(20), nullable=False) # Visionary, Pioneer, Mentor, Conqueror
    inviter_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    invitee_id = Column(String(36), ForeignKey("students.id"), nullable=True) # Null for lobby
    is_lobby = Column(Boolean, default=False)
    status = Column(String(20), default="PENDING") # PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    team = relationship("CollabTeam", back_populates="invites")
    inviter = relationship("Student", foreign_keys=[inviter_id])
    invitee = relationship("Student", foreign_keys=[invitee_id])

class CollabWorkspaceState(Base):
    __tablename__ = "collab_workspace_state"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    team_id = Column(String(36), ForeignKey("collab_teams.id"), nullable=False, unique=True, index=True)
    module_index = Column(Integer, default=1)
    
    # Visionary Plan & Flowchart
    flowchart_data = Column(JSON, default=lambda: {"nodes": [], "edges": []})
    algorithm_text = Column(Text, default="")
    plan_ready = Column(Boolean, default=False)
    
    # Pioneer Code Terminal
    code_content = Column(Text, default="")
    code_language = Column(String(20), default="python")
    draft_submitted = Column(Boolean, default=False)
    
    # Mentor Review & Approval
    mentor_approved = Column(Boolean, default=False)
    review_status = Column(String(30), default="PENDING") # PENDING, CHANGES_REQUESTED, APPROVED
    
    # Conqueror Testing
    tests_passed_ratio = Column(Float, default=0.0)
    final_submitted = Column(Boolean, default=False)
    
    # General Workspace
    custom_stdin = Column(Text, default="")
    compiler_output = Column(Text, default="")
    latest_bug_report = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("CollabTeam", back_populates="workspace")

class CollabComment(Base):
    __tablename__ = "collab_comments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    team_id = Column(String(36), ForeignKey("collab_teams.id"), nullable=False, index=True)
    module_index = Column(Integer, default=1)
    author_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    author_role = Column(String(20), nullable=False)
    target_type = Column(String(30), default="code_line") # "code_line", "algorithm_line", "flowchart_shape"
    target_id_or_line = Column(String(50), nullable=False) # e.g. "5", "shape_1"
    comment_text = Column(Text, nullable=False)
    is_leader_note = Column(Boolean, default=False)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("CollabTeam", back_populates="comments")
    author = relationship("Student")

class CollabChatMessage(Base):
    __tablename__ = "collab_chat_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    team_id = Column(String(36), ForeignKey("collab_teams.id"), nullable=False, index=True)
    sender_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    sender_name = Column(String(100), nullable=False)
    sender_role = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("CollabTeam", back_populates="messages")

class CollabContributionLog(Base):
    __tablename__ = "collab_contribution_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    team_id = Column(String(36), ForeignKey("collab_teams.id"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    action_type = Column(String(50), nullable=False) # DrawFlowchart, WritePlan, PlanReady, WriteCode, RunCode, SubmitDraft, Comment, Approve, RequestChanges, RunTests, ReportBug, SuggestCode, FinalSubmit, LeaderNote, Swap, Handover
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("CollabTeam", back_populates="contributions")
    student = relationship("Student")

class CollabPeerReview(Base):
    __tablename__ = "collab_peer_reviews"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    challenge_id = Column(String(36), ForeignKey("collab_challenges.id"), nullable=False, index=True)
    team_id = Column(String(36), ForeignKey("collab_teams.id"), nullable=False, index=True)
    rater_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    ratee_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    ratee_role = Column(String(20), nullable=False)
    role_contribution = Column(Integer, default=5) # 1..5
    reliability_timeliness = Column(Integer, default=5) # 1..5
    communication = Column(Integer, default=5) # 1..5
    quality_of_work = Column(Integer, default=5) # 1..5
    written_comment = Column(Text, default="")
    is_approved_by_teacher = Column(Boolean, default=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    rater = relationship("Student", foreign_keys=[rater_id])
    ratee = relationship("Student", foreign_keys=[ratee_id])

class CollabTeamCounter(Base):
    __tablename__ = "collab_team_counters"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    team_key = Column(String(255), unique=True, index=True, nullable=False) # comma-separated sorted student IDs
    course_id = Column(String(36), nullable=False)
    completed_count = Column(Integer, default=0)
    reduction_step_s = Column(Integer, default=0)
    recent_results = Column(JSON, default=list) # e.g. ["ON_TIME", "OVERRUN"]
    updated_at = Column(DateTime, default=datetime.utcnow)
