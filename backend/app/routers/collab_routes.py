import math
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.auth import get_current_user
from app.models import Teacher, Student, Course, CourseEnrollment
from app.collab_models import (
    CollabChallenge,
    CollabTestCase,
    CollabTeam,
    CollabTeamMember,
    CollabInvite,
    CollabWorkspaceState,
    CollabComment,
    CollabChatMessage,
    CollabContributionLog,
    CollabPeerReview,
    CollabTeamCounter
)
from app.services.compiler import run_code
from pydantic import BaseModel

router = APIRouter(prefix="/collab", tags=["Collaborative Challenges"])

# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class TestCaseCreate(BaseModel):
    module_index: int = 1
    input_data: str = ""
    expected_output: str = ""
    is_hidden: bool = False
    weight: float = 1.0

class ChallengeCreateRequest(BaseModel):
    course_id: str
    title: str
    statement: str
    group_size: int = 4
    base_time_minutes: int = 60
    break_pool_minutes: int = 10
    stage_deadlines: Optional[Dict[str, float]] = None
    invite_expiry_minutes: int = 60
    adaptive_on: bool = True
    beta_max: float = 0.15
    strict_roles: bool = False
    max_swaps: int = 2
    p_mod: float = 100.0
    p_int: float = 50.0
    p_leader: float = 20.0
    w_role: float = 30.0
    w_feedback: float = 20.0
    eta_partial: float = 0.5
    test_cases: Optional[List[TestCaseCreate]] = None

class TeacherPointsRequest(BaseModel):
    student_id: str
    points: float

class InviteCandidateRequest(BaseModel):
    module_index: int = 1
    needed_role: str # Visionary, Pioneer, Mentor, Conqueror
    invitee_id: Optional[str] = None
    is_lobby: bool = False

class InviteRespondRequest(BaseModel):
    action: str # "accept" or "decline"

class RoleActionRequest(BaseModel):
    action_type: str
    details: Optional[Dict[str, Any]] = None

class AddCommentRequest(BaseModel):
    target_type: str = "code_line" # "code_line", "algorithm_line", "flowchart_shape"
    target_id_or_line: str
    comment_text: str
    is_leader_note: bool = False

class SendChatMessageRequest(BaseModel):
    message: str

class RunCodeRequest(BaseModel):
    code: str
    language: str = "python"
    stdin_input: str = ""

class BreakRequest(BaseModel):
    action: str # "start" or "end"

class FocusEventRequest(BaseModel):
    event: str # "away" or "returned"

class PeerReviewItem(BaseModel):
    ratee_id: str
    role_contribution: int
    reliability_timeliness: int
    communication: int
    quality_of_work: int
    written_comment: str

class PeerReviewSubmitRequest(BaseModel):
    reviews: List[PeerReviewItem]

class RoleSwitchRequest(BaseModel):
    new_role: str # "Visionary", "Mentor", "Pioneer", "Conqueror"

# ==========================================
# HELPER FUNCTIONS & ALGORITHM LOGIC
# ==========================================

ROLE_MAP = {
    "visionary": "Visionary",
    "visionaries": "Visionary",
    "mentor": "Mentor",
    "mentors": "Mentor",
    "pioneer": "Pioneer",
    "pioneers": "Pioneer",
    "conqueror": "Conqueror",
    "conquerors": "Conqueror"
}

def normalize_role(role_str: Optional[str]) -> str:
    if not role_str:
        return "Visionary"
    return ROLE_MAP.get(role_str.lower().strip(), "Visionary")

def normalize_cognitive_level(level_str: Optional[str]) -> str:
    """Normalize cognitive levels: S (Slow), I (Intermediate/Average), F (Fast)"""
    if not level_str:
        return "I"
    l = level_str.lower().strip()
    if l in ["slow", "stepper", "s"]:
        return "S"
    elif l in ["fast", "glider", "f"]:
        return "F"
    return "I" # average / jogger

def is_student_locked(student_id: str, db: Session) -> bool:
    """Checks if a student is locked in an ACTIVE ongoing collaborative challenge (Rule 6)."""
    active_member = db.query(CollabTeamMember).join(CollabTeam).filter(
        CollabTeamMember.student_id == student_id,
        CollabTeam.status.in_(["ACTIVE", "IN_INTEGRATION"])
    ).first()
    return active_member is not None

def check_feasibility(levels: List[str]) -> bool:
    """
    Equation 1: Feasible(T')
    Checks if a partial sub-team of cognitive levels can still be completed into a valid 2-1-1 team.
    Valid full mixes must contain S, I, and F with exactly one appearing twice.
    """
    counts = {"S": levels.count("S"), "I": levels.count("I"), "F": levels.count("F")}
    # No level can have more than 2 members
    if any(c > 2 for c in counts.values()):
        return False
    # Missing levels (count == 0) must be <= remaining slots
    missing = sum(1 for c in counts.values() if c == 0)
    remaining_slots = 4 - len(levels)
    return missing <= remaining_slots

def compute_adaptive_bonus(team_levels: List[str], s_counter: int, beta_max: float = 0.15, delta: float = 0.05) -> float:
    """
    Equation 2, 3, 4:
    Find doubled level lambda*, beta0(S)=0.15, beta0(I)=0.05, beta0(F)=0.
    beta = min(beta_max, max(0, beta0 - delta * s))
    """
    counts = {"S": team_levels.count("S"), "I": team_levels.count("I"), "F": team_levels.count("F")}
    # Find level that appears twice
    doubled = "I"
    for lvl, cnt in counts.items():
        if cnt == 2:
            doubled = lvl
            break
    
    beta0 = {"S": 0.15, "I": 0.05, "F": 0.0}.get(doubled, 0.05)
    return min(beta_max, max(0.0, beta0 - delta * s_counter))

def get_or_create_team_counter(member_ids: List[str], course_id: str, db: Session) -> CollabTeamCounter:
    """Finds or creates team counter for exact member set (Part 2, Team counter by exact set)."""
    sorted_key = ",".join(sorted(member_ids))
    counter = db.query(CollabTeamCounter).filter(CollabTeamCounter.team_key == sorted_key).first()
    if not counter:
        counter = CollabTeamCounter(
            team_key=sorted_key,
            course_id=course_id,
            completed_count=0,
            reduction_step_s=0,
            recent_results=[]
        )
        db.add(counter)
        db.commit()
        db.refresh(counter)
    return counter

# ==========================================
# TEACHER ENDPOINTS
# ==========================================

@router.get("/teacher/courses")
def get_teacher_collab_courses(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Lists courses taught by the current teacher with collaborative challenge counts."""
    if not isinstance(current_user, Teacher):
        raise HTTPException(status_code=403, detail="Access denied. Teachers only.")
    
    courses = db.query(Course).filter(Course.teacher_id == current_user.id).all()
    results = []
    for c in courses:
        challenge_count = db.query(CollabChallenge).filter(CollabChallenge.course_id == c.id).count()
        results.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "join_code": c.join_code,
            "challenge_count": challenge_count
        })
    return results

@router.post("/teacher/challenges")
def create_collab_challenge(
    req: ChallengeCreateRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Teacher creates and publishes a collaborative group activity."""
    if not isinstance(current_user, Teacher):
        raise HTTPException(status_code=403, detail="Access denied. Teachers only.")
    
    course = db.query(Course).filter(Course.id == req.course_id, Course.teacher_id == current_user.id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found or unauthorized.")
    
    if req.group_size not in [4, 8, 12, 16]:
        raise HTTPException(status_code=400, detail="Group size must be 4, 8, 12, or 16.")
    
    k_modules = req.group_size // 4
    stage_deadlines = req.stage_deadlines or {"plan": 0.25, "draft": 0.50, "review": 0.75, "final": 1.0}

    challenge = CollabChallenge(
        course_id=course.id,
        teacher_id=current_user.id,
        title=req.title.strip(),
        statement=req.statement.strip(),
        group_size=req.group_size,
        modules_count=k_modules,
        base_time_minutes=req.base_time_minutes,
        break_pool_minutes=req.break_pool_minutes,
        stage_deadlines=stage_deadlines,
        invite_expiry_minutes=req.invite_expiry_minutes,
        adaptive_on=req.adaptive_on,
        beta_max=req.beta_max,
        strict_roles=req.strict_roles,
        max_swaps=req.max_swaps,
        p_mod=req.p_mod,
        p_int=req.p_int,
        p_leader=req.p_leader,
        w_role=req.w_role,
        w_feedback=req.w_feedback,
        eta_partial=req.eta_partial,
        status="PUBLISHED"
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    # Add optional test cases (allowing zero or many test cases as requested)
    if req.test_cases:
        for tc in req.test_cases:
            test_case = CollabTestCase(
                challenge_id=challenge.id,
                module_index=tc.module_index,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                is_hidden=tc.is_hidden,
                weight=tc.weight
            )
            db.add(test_case)
        db.commit()

    return {"message": "Collaborative challenge published successfully!", "challenge_id": challenge.id}

@router.get("/teacher/challenges")
def list_teacher_challenges(
    course_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Lists all collaborative challenges published by the teacher."""
    if not isinstance(current_user, Teacher):
        raise HTTPException(status_code=403, detail="Access denied. Teachers only.")
    
    query = db.query(CollabChallenge).filter(CollabChallenge.teacher_id == current_user.id)
    if course_id:
        query = query.filter(CollabChallenge.course_id == course_id)
    
    challenges = query.order_by(CollabChallenge.created_at.desc()).all()
    results = []
    for ch in challenges:
        course = db.query(Course).filter(Course.id == ch.course_id).first()
        teams_count = db.query(CollabTeam).filter(CollabTeam.challenge_id == ch.id).count()
        completed_count = db.query(CollabTeam).filter(CollabTeam.challenge_id == ch.id, CollabTeam.status == "COMPLETED").count()
        results.append({
            "id": ch.id,
            "course_id": ch.course_id,
            "course_title": course.title if course else "Unknown",
            "title": ch.title,
            "statement": ch.statement,
            "group_size": ch.group_size,
            "modules_count": ch.modules_count,
            "base_time_minutes": ch.base_time_minutes,
            "break_pool_minutes": ch.break_pool_minutes,
            "status": ch.status,
            "teams_count": teams_count,
            "completed_count": completed_count,
            "created_at": ch.created_at.isoformat()
        })
    return results

@router.get("/teacher/challenges/{challenge_id}")
def get_teacher_challenge_detail(
    challenge_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Detailed view for teacher including team progress and monitoring logs."""
    if not isinstance(current_user, Teacher):
        raise HTTPException(status_code=403, detail="Access denied. Teachers only.")
    
    challenge = db.query(CollabChallenge).filter(
        CollabChallenge.id == challenge_id,
        CollabChallenge.teacher_id == current_user.id
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found.")
    
    test_cases = db.query(CollabTestCase).filter(CollabTestCase.challenge_id == challenge.id).all()
    teams = db.query(CollabTeam).filter(CollabTeam.challenge_id == challenge.id).all()

    teams_data = []
    for tm in teams:
        members = db.query(CollabTeamMember).filter(CollabTeamMember.team_id == tm.id).all()
        m_list = []
        for m in members:
            student = db.query(Student).filter(Student.id == m.student_id).first()
            m_list.append({
                "student_id": m.student_id,
                "name": student.name if student else "Unknown",
                "role": m.assigned_role,
                "is_leader": m.is_leader,
                "locked_pt_ls": m.locked_pt_ls,
                "locked_cognitive_level": m.locked_cognitive_level,
                "is_active": m.is_active,
                "is_away": m.is_away,
                "is_flagged_inactive": m.is_flagged_inactive,
                "is_on_break": m.is_on_break,
                "break_pool_remaining_seconds": m.break_pool_remaining_seconds,
                "role_performance_score": m.role_performance_score,
                "points_awarded": m.points_awarded
            })
        
        teams_data.append({
            "id": tm.id,
            "status": tm.status,
            "current_stage": tm.current_stage,
            "passed": tm.passed,
            "started_at": tm.started_at.isoformat() if tm.started_at else None,
            "ended_at": tm.ended_at.isoformat() if tm.ended_at else None,
            "members": m_list
        })
    
    return {
        "id": challenge.id,
        "title": challenge.title,
        "statement": challenge.statement,
        "group_size": challenge.group_size,
        "modules_count": challenge.modules_count,
        "base_time_minutes": challenge.base_time_minutes,
        "break_pool_minutes": challenge.break_pool_minutes,
        "test_cases_count": len(test_cases),
        "test_cases": [
            {
                "id": tc.id,
                "module_index": tc.module_index,
                "input_data": tc.input_data,
                "expected_output": tc.expected_output,
                "is_hidden": tc.is_hidden,
                "weight": tc.weight
            } for tc in test_cases
        ],
        "teams": teams_data
    }

@router.delete("/teacher/challenges/{challenge_id}")
def delete_collab_challenge(
    challenge_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Deletes a challenge."""
    if not isinstance(current_user, Teacher):
        raise HTTPException(status_code=403, detail="Access denied. Teachers only.")
    
    challenge = db.query(CollabChallenge).filter(
        CollabChallenge.id == challenge_id,
        CollabChallenge.teacher_id == current_user.id
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found.")
    
    db.delete(challenge)
    db.commit()
    return {"message": "Challenge deleted successfully."}

# ==========================================
# STUDENT ENDPOINTS: ENTRY, LOBBY & INVITATIONS
# ==========================================

@router.get("/student/challenges")
def get_student_collab_challenges(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Phase 2: Student Problem List
    Lists available challenges for courses the student is enrolled in.
    Also returns whether the current student is locked in an ongoing challenge.
    """
    if not isinstance(current_user, Student):
        raise HTTPException(status_code=403, detail="Access denied. Students only.")
    
    # Enrolled courses
    enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.student_id == current_user.id).all()
    course_ids = [e.course_id for e in enrollments]
    
    locked = is_student_locked(current_user.id, db)
    
    # Check if student currently has an active team in Game Zone
    current_team_id = None
    active_member = db.query(CollabTeamMember).join(CollabTeam).filter(
        CollabTeamMember.student_id == current_user.id,
        CollabTeam.status.in_(["ACTIVE", "IN_INTEGRATION"])
    ).first()
    if active_member:
        current_team_id = active_member.team_id

    challenges = db.query(CollabChallenge).filter(
        CollabChallenge.course_id.in_(course_ids),
        CollabChallenge.status == "PUBLISHED"
    ).order_by(CollabChallenge.created_at.desc()).all()

    results = []
    for ch in challenges:
        course = db.query(Course).filter(Course.id == ch.course_id).first()
        
        # Check if current student has a squad for this challenge
        my_team = db.query(CollabTeam).join(CollabTeamMember).filter(
            CollabTeam.challenge_id == ch.id,
            CollabTeamMember.student_id == current_user.id,
            CollabTeam.status.in_(["FORMING", "ACTIVE", "COMPLETED", "TIMEOUT"])
        ).order_by(CollabTeam.created_at.desc()).first()

        my_squad = None
        if my_team:
            members = db.query(CollabTeamMember).filter(CollabTeamMember.team_id == my_team.id).all()
            pending_invites = db.query(CollabInvite).filter(
                CollabInvite.team_id == my_team.id,
                CollabInvite.status == "PENDING"
            ).all()

            slots = []
            for r in ["Visionary", "Pioneer", "Mentor", "Conqueror"]:
                m = next((mem for mem in members if mem.assigned_role.lower() == r.lower()), None)
                if m:
                    st = db.query(Student).filter(Student.id == m.student_id).first()
                    slots.append({
                        "role": r,
                        "status": "accepted",
                        "label": f"✓ {st.name if st else 'Teammate'} ({r})",
                        "is_leader": m.is_leader,
                        "invite_id": None
                    })
                else:
                    inv = next((i for i in pending_invites if normalize_role(i.needed_role).lower() == r.lower()), None)
                    if inv:
                        if inv.is_lobby:
                            slots.append({
                                "role": r,
                                "status": "lobby",
                                "label": f"In Lobby: Waiting for {r}",
                                "is_leader": False,
                                "invite_id": inv.id
                            })
                        else:
                            inv_st = db.query(Student).filter(Student.id == inv.invitee_id).first() if inv.invitee_id else None
                            slots.append({
                                "role": r,
                                "status": "invited",
                                "label": f"Invited: {inv_st.name if inv_st else 'Classmate'} (Pending)",
                                "is_leader": False,
                                "invite_id": inv.id
                            })
                    else:
                        slots.append({
                            "role": r,
                            "status": "open",
                            "label": f"+ Invite {r}",
                            "is_leader": False,
                            "invite_id": None
                        })

            my_squad = {
                "team_id": my_team.id,
                "status": my_team.status,
                "is_leader": my_team.leader_id == current_user.id,
                "accepted_count": len(members),
                "total_needed": 4,
                "can_enter": (len(members) >= 4 and my_team.status == "ACTIVE"),
                "slots": slots
            }

        results.append({
            "id": ch.id,
            "title": ch.title,
            "course_title": course.title if course else "",
            "group_size": ch.group_size,
            "base_time_minutes": ch.base_time_minutes,
            "break_pool_minutes": ch.break_pool_minutes,
            "created_at": ch.created_at.isoformat(),
            "my_squad": my_squad
        })

    return {
        "is_locked": locked,
        "current_team_id": current_team_id,
        "my_role": normalize_role(current_user.pt_ls),
        "challenges": results
    }

@router.get("/student/my-invites")
def get_my_collab_invites(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Lists pending invites split into direct invites and course lobby requests."""
    if not isinstance(current_user, Student):
        raise HTTPException(status_code=403, detail="Access denied. Students only.")
    
    enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.student_id == current_user.id).all()
    course_ids = [e.course_id for e in enrollments]
    my_role = normalize_role(current_user.pt_ls)
    my_level = normalize_cognitive_level(current_user.cognitive_level)
    locked = is_student_locked(current_user.id, db)

    now = datetime.utcnow()
    # Expire old invites
    db.query(CollabInvite).filter(
        CollabInvite.status == "PENDING",
        CollabInvite.expires_at < now
    ).update({"status": "EXPIRED"})
    db.commit()

    # 1. Direct invites
    direct_invites = db.query(CollabInvite).filter(
        CollabInvite.invitee_id == current_user.id,
        CollabInvite.status == "PENDING"
    ).all()

    direct_results = []
    for inv in direct_invites:
        team = db.query(CollabTeam).filter(CollabTeam.id == inv.team_id).first()
        if not team or team.status != "FORMING":
            continue
        challenge = db.query(CollabChallenge).filter(CollabChallenge.id == inv.challenge_id).first()
        inviter = db.query(Student).filter(Student.id == inv.inviter_id).first()
        direct_results.append({
            "invite_id": inv.id,
            "challenge_id": challenge.id if challenge else "",
            "challenge_title": challenge.title if challenge else "",
            "team_id": inv.team_id,
            "needed_role": inv.needed_role,
            "is_lobby": False,
            "inviter_name": inviter.name if inviter else "Teammate",
            "expires_at": inv.expires_at.isoformat(),
            "is_locked": locked
        })

    # 2. Lobby invites (Only eligible ones satisfying Rule 2-1-1)
    lobby_invites = db.query(CollabInvite).join(CollabChallenge).filter(
        CollabInvite.is_lobby == True,
        CollabInvite.status == "PENDING",
        CollabInvite.needed_role == my_role,
        CollabChallenge.course_id.in_(course_ids)
    ).all()

    lobby_results = []
    for inv in lobby_invites:
        team = db.query(CollabTeam).filter(CollabTeam.id == inv.team_id).first()
        if not team or team.status != "FORMING":
            continue
        
        # Check level feasibility: if team already has 2 Slow, a Slow learner cannot see/join!
        current_members = db.query(CollabTeamMember).filter(CollabTeamMember.team_id == team.id).all()
        tentative_levels = [m.locked_cognitive_level for m in current_members] + [my_level]
        if not check_feasibility(tentative_levels):
            continue

        challenge = db.query(CollabChallenge).filter(CollabChallenge.id == inv.challenge_id).first()
        inviter = db.query(Student).filter(Student.id == inv.inviter_id).first()
        lobby_results.append({
            "invite_id": inv.id,
            "challenge_id": challenge.id if challenge else "",
            "challenge_title": challenge.title if challenge else "",
            "team_id": inv.team_id,
            "needed_role": inv.needed_role,
            "is_lobby": True,
            "inviter_name": inviter.name if inviter else "Teammate",
            "expires_at": inv.expires_at.isoformat(),
            "is_locked": locked
        })

    return {
        "direct_invites": direct_results,
        "lobby_invites": lobby_results
    }

@router.post("/student/challenges/{challenge_id}/initiate")
def initiate_challenge(
    challenge_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Algorithm 2: FormTeam (Initiator)
    Initiates a new challenge team. Locks student's current pt_ls and cognitive level.
    """
    if not isinstance(current_user, Student):
        raise HTTPException(status_code=403, detail="Access denied. Students only.")
    
    if is_student_locked(current_user.id, db):
        raise HTTPException(status_code=400, detail="You are currently locked in an active challenge.")
    
    challenge = db.query(CollabChallenge).filter(
        CollabChallenge.id == challenge_id,
        CollabChallenge.status == "PUBLISHED"
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found.")

    initiator_role = normalize_role(current_user.pt_ls)
    initiator_level = normalize_cognitive_level(current_user.cognitive_level)

    # If student already has a FORMING squad for this challenge, resume it
    existing_team = db.query(CollabTeam).join(CollabTeamMember).filter(
        CollabTeam.challenge_id == challenge.id,
        CollabTeamMember.student_id == current_user.id,
        CollabTeam.status == "FORMING"
    ).first()
    if existing_team:
        return {
            "message": "Resumed existing forming squad.",
            "team_id": existing_team.id,
            "assigned_role": initiator_role,
            "is_leader": True
        }

    # Create CollabTeam
    team = CollabTeam(
        challenge_id=challenge.id,
        module_index=1,
        team_key=current_user.id,
        leader_id=current_user.id,
        status="FORMING",
        final_time_minutes=float(challenge.base_time_minutes),
        current_stage="PLAN"
    )
    db.add(team)
    db.commit()
    db.refresh(team)

    # Create workspace state
    workspace = CollabWorkspaceState(
        team_id=team.id,
        module_index=1,
        flowchart_data={"nodes": [], "edges": []},
        algorithm_text="",
        code_content="# Collaborative Solution\ndef solve():\n    pass\n",
        code_language="python"
    )
    db.add(workspace)

    # Add Initiator as Team Member (Rule 4: Freeze at invitation)
    member = CollabTeamMember(
        team_id=team.id,
        student_id=current_user.id,
        module_index=1,
        assigned_role=initiator_role,
        is_leader=True,
        locked_pt_ls=initiator_role,
        locked_cognitive_level=initiator_level,
        break_pool_remaining_seconds=challenge.break_pool_minutes * 60
    )
    db.add(member)
    db.commit()

    return {
        "message": "Challenge initiated successfully! Form your sub-team.",
        "team_id": team.id,
        "assigned_role": initiator_role,
        "is_leader": True
    }

@router.get("/student/teams/{team_id}/formation-status")
def get_squad_formation_status(
    team_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Returns live slot status (accepted, invited, lobby, open) for the formation modal."""
    team = db.query(CollabTeam).filter(CollabTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    
    challenge = db.query(CollabChallenge).filter(CollabChallenge.id == team.challenge_id).first()
    members = db.query(CollabTeamMember).filter(CollabTeamMember.team_id == team.id).all()
    pending_invites = db.query(CollabInvite).filter(
        CollabInvite.team_id == team.id,
        CollabInvite.status == "PENDING"
    ).all()

    slots = []
    for r in ["Visionary", "Pioneer", "Mentor", "Conqueror"]:
        m = next((mem for mem in members if mem.assigned_role.lower() == r.lower()), None)
        if m:
            st = db.query(Student).filter(Student.id == m.student_id).first()
            slots.append({
                "role": r,
                "status": "accepted",
                "label": f"✓ {st.name if st else 'Teammate'} ({r})",
                "member_name": st.name if st else "Teammate",
                "is_leader": m.is_leader,
                "invite_id": None
            })
        else:
            inv = next((i for i in pending_invites if normalize_role(i.needed_role).lower() == r.lower()), None)
            if inv:
                if inv.is_lobby:
                    slots.append({
                        "role": r,
                        "status": "lobby",
                        "label": f"Lobby: Waiting for {r}",
                        "member_name": "In Course Lobby",
                        "is_leader": False,
                        "invite_id": inv.id
                    })
                else:
                    inv_st = db.query(Student).filter(Student.id == inv.invitee_id).first() if inv.invitee_id else None
                    slots.append({
                        "role": r,
                        "status": "invited",
                        "label": f"Invited: {inv_st.name if inv_st else 'Classmate'} (Pending)",
                        "member_name": inv_st.name if inv_st else "Classmate",
                        "is_leader": False,
                        "invite_id": inv.id
                    })
            else:
                slots.append({
                    "role": r,
                    "status": "open",
                    "label": f"+ Invite {r}",
                    "member_name": None,
                    "is_leader": False,
                    "invite_id": None
                })

    return {
        "team_id": team.id,
        "challenge_id": challenge.id,
        "challenge_title": challenge.title,
        "status": team.status,
        "is_leader": team.leader_id == current_user.id,
        "accepted_count": len(members),
        "total_needed": 4,
        "can_enter": (len(members) >= 4 and team.status == "ACTIVE"),
        "slots": slots
    }

@router.post("/student/invites/{invite_id}/cancel")
def cancel_team_invite(
    invite_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Cancels a pending invite or withdraws a lobby slot."""
    invite = db.query(CollabInvite).filter(CollabInvite.id == invite_id).first()
    if not invite or invite.status != "PENDING":
        raise HTTPException(status_code=400, detail="Invite is not active.")
    
    team = db.query(CollabTeam).filter(CollabTeam.id == invite.team_id).first()
    if not team or team.leader_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only squad leader can cancel invites.")
    
    invite.status = "CANCELLED"
    db.commit()
    return {"message": "Invite or lobby slot cancelled."}

@router.get("/student/teams/{team_id}/eligible-candidates")
def get_eligible_candidates(
    team_id: str,
    needed_role: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Algorithm 3: FilterCandidates
    Filters enrolled students for an open slot of type `needed_role`:
    - Enrolled in same course
    - Type matches needed_role
    - Not locked in another challenge
    - Satisfies Equation 1 (Feasible level mix 2-1-1)
    - Returns Name, Availability, Times worked together. NEVER reveals cognitive level!
    """
    team = db.query(CollabTeam).filter(CollabTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    
    challenge = db.query(CollabChallenge).filter(CollabChallenge.id == team.challenge_id).first()
    course = db.query(Course).filter(Course.id == challenge.course_id).first()
    
    current_members = db.query(CollabTeamMember).filter(CollabTeamMember.team_id == team.id).all()
    existing_student_ids = [m.student_id for m in current_members]
    existing_levels = [m.locked_cognitive_level for m in current_members]

    # Find students enrolled in the same course
    course_enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.course_id == course.id).all()
    enrolled_student_ids = [e.student_id for e in course_enrollments]
    enrolled_students = db.query(Student).filter(Student.id.in_(enrolled_student_ids)).all() if enrolled_student_ids else []
    candidates = []

    target_role = normalize_role(needed_role)

    for st in enrolled_students:
        if st.id in existing_student_ids:
            continue
        
        st_role = normalize_role(st.pt_ls)
        if st_role != target_role:
            continue
        
        # Check if already locked in an ACTIVE challenge
        if is_student_locked(st.id, db):
            continue
        
        # Check if already has a pending invite for this team
        pending_inv = db.query(CollabInvite).filter(
            CollabInvite.team_id == team.id,
            CollabInvite.invitee_id == st.id,
            CollabInvite.status == "PENDING"
        ).first()
        if pending_inv:
            continue

        # Feasibility check (Equation 1)
        st_level = normalize_cognitive_level(st.cognitive_level)
        tentative_levels = existing_levels + [st_level]
        if not check_feasibility(tentative_levels):
            continue

        # Times worked together with initiator
        pair_key = ",".join(sorted([team.leader_id, st.id]))
        times_worked = db.query(CollabTeamCounter).filter(CollabTeamCounter.team_key.contains(pair_key)).count()

        candidates.append({
            "student_id": st.id,
            "name": st.name,
            "department": st.department,
            "role": st_role,
            "availability": "Available",
            "times_worked": times_worked
        })

    return candidates

@router.post("/student/teams/{team_id}/invite")
def send_team_invite(
    team_id: str,
    req: InviteCandidateRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Sends invitation or posts slot to the lobby."""
    team = db.query(CollabTeam).filter(CollabTeam.id == team_id).first()
    if not team or team.status != "FORMING":
        raise HTTPException(status_code=400, detail="Team is not currently forming.")
    
    if team.leader_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the team leader can invite or post to lobby.")
    
    challenge = db.query(CollabChallenge).filter(CollabChallenge.id == team.challenge_id).first()
    expiry_time = datetime.utcnow() + timedelta(minutes=challenge.invite_expiry_minutes)

    if req.is_lobby:
        invite = CollabInvite(
            challenge_id=challenge.id,
            team_id=team.id,
            module_index=req.module_index,
            needed_role=normalize_role(req.needed_role),
            inviter_id=current_user.id,
            invitee_id=None,
            is_lobby=True,
            status="PENDING",
            expires_at=expiry_time
        )
        db.add(invite)
        db.commit()
        return {"message": "Slot posted to course lobby successfully!"}
    else:
        if not req.invitee_id:
            raise HTTPException(status_code=400, detail="Invitee ID is required.")
        
        invitee = db.query(Student).filter(Student.id == req.invitee_id).first()
        if not invitee:
            raise HTTPException(status_code=404, detail="Student not found.")
        
        invite = CollabInvite(
            challenge_id=challenge.id,
            team_id=team.id,
            module_index=req.module_index,
            needed_role=normalize_role(req.needed_role),
            inviter_id=current_user.id,
            invitee_id=invitee.id,
            is_lobby=False,
            status="PENDING",
            expires_at=expiry_time
        )
        db.add(invite)
        db.commit()
        return {"message": f"Invite sent to {invitee.name}!"}

@router.post("/student/invites/{invite_id}/respond")
def respond_to_invite(
    invite_id: str,
    req: InviteRespondRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Algorithm 2b: On Accept(u, k, t) or Decline
    Locks student, freezes type & level, checks feasibility, and starts challenge when team is full (n=4).
    """
    invite = db.query(CollabInvite).filter(CollabInvite.id == invite_id).first()
    if not invite or invite.status != "PENDING":
        raise HTTPException(status_code=400, detail="Invite is no longer active.")
    
    if req.action == "decline":
        invite.status = "DECLINED"
        db.commit()
        return {"message": "Invite declined."}
    
    if req.action != "accept":
        raise HTTPException(status_code=400, detail="Invalid action.")
    
    # Check if student is already locked in an ACTIVE challenge
    if is_student_locked(current_user.id, db):
        raise HTTPException(status_code=400, detail="You are already participating in an active challenge.")
    
    team = db.query(CollabTeam).filter(CollabTeam.id == invite.team_id).first()
    if not team or team.status != "FORMING":
        raise HTTPException(status_code=400, detail="Team is no longer open.")

    challenge = db.query(CollabChallenge).filter(CollabChallenge.id == team.challenge_id).first()

    my_role = normalize_role(current_user.pt_ls)
    my_level = normalize_cognitive_level(current_user.cognitive_level)

    # Re-verify role matches
    if my_role != normalize_role(invite.needed_role):
        raise HTTPException(status_code=400, detail=f"Your learner type ({my_role}) does not match the needed role ({invite.needed_role}).")

    # Re-verify feasibility (Equation 1)
    current_members = db.query(CollabTeamMember).filter(CollabTeamMember.team_id == team.id).all()
    tentative_levels = [m.locked_cognitive_level for m in current_members] + [my_level]
    if not check_feasibility(tentative_levels):
        raise HTTPException(status_code=400, detail="This team configuration is no longer feasible under level balance rules.")

    # Accept invite
    invite.status = "ACCEPTED"

    # Add member with frozen snapshot (Rule 4)
    new_member = CollabTeamMember(
        team_id=team.id,
        student_id=current_user.id,
        module_index=invite.module_index,
        assigned_role=my_role,
        is_leader=False,
        locked_pt_ls=my_role,
        locked_cognitive_level=my_level,
        break_pool_remaining_seconds=challenge.break_pool_minutes * 60
    )
    db.add(new_member)
    db.commit()

    # Decline or hold other pending invites for this student (Algorithm 2b line 6)
    db.query(CollabInvite).filter(
        CollabInvite.invitee_id == current_user.id,
        CollabInvite.status == "PENDING"
    ).update({"status": "DECLINED"})
    db.commit()

    # Check if team is now complete (4 members for K=1)
    all_members = db.query(CollabTeamMember).filter(CollabTeamMember.team_id == team.id).all()
    if len(all_members) >= 4:
        # Start Challenge (Algorithm 4)
        all_student_ids = [m.student_id for m in all_members]
        team_key = ",".join(sorted(all_student_ids))
        team.team_key = team_key

        counter = get_or_create_team_counter(all_student_ids, challenge.course_id, db)
        
        # Calculate adaptive bonus for K=1 (Equation 4)
        levels_list = [m.locked_cognitive_level for m in all_members]
        if challenge.adaptive_on and challenge.modules_count == 1:
            bonus = compute_adaptive_bonus(levels_list, counter.reduction_step_s, challenge.beta_max)
            final_time = challenge.base_time_minutes * (1.0 + bonus)
            team.adaptive_bonus = bonus
            team.final_time_minutes = final_time
        else:
            team.adaptive_bonus = 0.0
            team.final_time_minutes = float(challenge.base_time_minutes)

        team.status = "ACTIVE"
        team.started_at = datetime.utcnow()
        team.current_stage = "PLAN"

        # Suspend / cancel any other pending invites involving these 4 members across all challenges!
        for sid in all_student_ids:
            db.query(CollabInvite).filter(
                or_(CollabInvite.invitee_id == sid, CollabInvite.inviter_id == sid),
                CollabInvite.team_id != team.id,
                CollabInvite.status == "PENDING"
            ).update({"status": "CANCELLED"})

        db.commit()

    return {
        "message": "Invite accepted! Joined the team.",
        "team_id": team.id,
        "team_status": team.status
    }

# ==========================================
# GAME ZONE WORKSPACE & REAL-TIME ACTIONS
# ==========================================

@router.get("/student/teams/{team_id}/workspace")
def get_team_workspace(
    team_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Returns full state of the Game Zone:
    - Top bar: members, roles, activity status, leader, time countdown
    - Left side: Problem statement & test cases
    - Center: Code terminal & compiler output, custom input, mentor comments
    - Right side: Flowchart canvas & pseudocode algorithm box
    """
    team = db.query(CollabTeam).filter(CollabTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    if team.status == "FORMING":
        raise HTTPException(
            status_code=400,
            detail="Squad is still forming. All 4 members must accept invitations before entering the Game Zone."
        )
    
    challenge = db.query(CollabChallenge).filter(CollabChallenge.id == team.challenge_id).first()
    course = db.query(Course).filter(Course.id == challenge.course_id).first()
    workspace = db.query(CollabWorkspaceState).filter(CollabWorkspaceState.team_id == team.id).first()
    members = db.query(CollabTeamMember).filter(CollabTeamMember.team_id == team.id).all()

    # Calculate remaining time
    remaining_seconds = 0
    elapsed_seconds = 0
    if team.started_at:
        elapsed_seconds = int((datetime.utcnow() - team.started_at).total_seconds())
        total_seconds = int(team.final_time_minutes * 60)
        remaining_seconds = max(0, total_seconds - elapsed_seconds)
        if remaining_seconds == 0 and team.status == "ACTIVE":
            team.status = "TIMEOUT"
            team.ended_at = datetime.utcnow()
            db.commit()

    # Current user's member record
    my_member_record = next((m for m in members if m.student_id == current_user.id), None)
    my_role = my_member_record.assigned_role if my_member_record else "Observer"
    is_leader = my_member_record.is_leader if my_member_record else False

    # Members detail for Top Bar
    members_detail = []
    for m in members:
        st = db.query(Student).filter(Student.id == m.student_id).first()
        members_detail.append({
            "student_id": m.student_id,
            "name": st.name if st else "Teammate",
            "role": m.assigned_role,
            "is_leader": m.is_leader,
            "is_active": m.is_active,
            "is_on_break": m.is_on_break,
            "is_away": m.is_away,
            "break_pool_remaining_seconds": m.break_pool_remaining_seconds
        })

    # Test cases (both visible and teacher uploaded)
    test_cases = db.query(CollabTestCase).filter(CollabTestCase.challenge_id == challenge.id).all()
    test_cases_data = [
        {
            "id": tc.id,
            "module_index": tc.module_index,
            "input_data": tc.input_data,
            "expected_output": tc.expected_output,
            "is_hidden": tc.is_hidden
        } for tc in test_cases
    ]

    # Comments (Mentor Google Docs style)
    comments = db.query(CollabComment).filter(CollabComment.team_id == team.id).order_by(CollabComment.created_at.asc()).all()
    comments_data = []
    for cm in comments:
        auth_st = db.query(Student).filter(Student.id == cm.author_id).first()
        comments_data.append({
            "id": cm.id,
            "author_id": cm.author_id,
            "author_name": auth_st.name if auth_st else "Mentor",
            "author_role": cm.author_role,
            "target_type": cm.target_type,
            "target_id_or_line": cm.target_id_or_line,
            "comment_text": cm.comment_text,
            "is_leader_note": cm.is_leader_note,
            "is_resolved": cm.is_resolved,
            "created_at": cm.created_at.isoformat()
        })

    # Chat messages
    messages = db.query(CollabChatMessage).filter(CollabChatMessage.team_id == team.id).order_by(CollabChatMessage.created_at.asc()).all()
    messages_data = [
        {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_name": msg.sender_name,
            "sender_role": msg.sender_role,
            "message": msg.message,
            "created_at": msg.created_at.isoformat()
        } for msg in messages
    ]

    return {
        "team": {
            "id": team.id,
            "status": team.status,
            "current_stage": team.current_stage,
            "final_time_minutes": team.final_time_minutes,
            "remaining_seconds": remaining_seconds,
            "elapsed_seconds": elapsed_seconds,
            "passed": team.passed,
            "integration_passed": team.integration_passed,
            "leader_id": team.leader_id
        },
        "challenge": {
            "id": challenge.id,
            "title": challenge.title,
            "course_title": course.title if course else "",
            "statement": challenge.statement,
            "group_size": challenge.group_size,
            "modules_count": challenge.modules_count,
            "break_pool_minutes": challenge.break_pool_minutes,
            "strict_roles": challenge.strict_roles
        },
        "me": {
            "student_id": current_user.id,
            "name": current_user.name,
            "role": my_role,
            "is_leader": is_leader,
            "is_on_break": my_member_record.is_on_break if my_member_record else False,
            "break_pool_remaining_seconds": my_member_record.break_pool_remaining_seconds if my_member_record else 0
        },
        "members": members_detail,
        "test_cases": test_cases_data,
        "workspace": {
            "flowchart_data": workspace.flowchart_data if workspace else {"nodes": [], "edges": []},
            "algorithm_text": workspace.algorithm_text if workspace else "",
            "plan_ready": workspace.plan_ready if workspace else False,
            "code_content": workspace.code_content if workspace else "",
            "code_language": workspace.code_language if workspace else "python",
            "draft_submitted": workspace.draft_submitted if workspace else False,
            "mentor_approved": workspace.mentor_approved if workspace else False,
            "review_status": workspace.review_status if workspace else "PENDING",
            "tests_passed_ratio": workspace.tests_passed_ratio if workspace else 0.0,
            "compiler_output": workspace.compiler_output if workspace else "",
            "custom_stdin": workspace.custom_stdin if workspace else ""
        },
        "comments": comments_data,
        "messages": messages_data
    }

@router.post("/student/teams/{team_id}/action")
def perform_role_action(
    team_id: str,
    req: RoleActionRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Algorithm 5: ModuleWorkflow
    Executes specific role action with permission checks.
    """
    team = db.query(CollabTeam).filter(CollabTeam.id == team_id).first()
    if not team or team.status not in ["ACTIVE", "IN_INTEGRATION"]:
        raise HTTPException(status_code=400, detail="Team is not currently active.")
    
    workspace = db.query(CollabWorkspaceState).filter(CollabWorkspaceState.team_id == team.id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    
    member = db.query(CollabTeamMember).filter(
        CollabTeamMember.team_id == team.id,
        CollabTeamMember.student_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this team.")
    
    role = member.assigned_role
    action = req.action_type
    details = req.details or {}

    # Update activity timestamp (Algorithm 6 Line 21)
    member.last_action_at = datetime.utcnow()
    member.is_flagged_inactive = False
    member.idle_prompted_at = None

    # Role 1: VISIONARY Actions
    if action == "UpdatePlan":
        if role != "Visionary" and not member.is_leader:
            raise HTTPException(status_code=403, detail="Only the Visionary can edit the plan and flowchart.")
        if "flowchart_data" in details:
            workspace.flowchart_data = details["flowchart_data"]
        if "algorithm_text" in details:
            workspace.algorithm_text = details["algorithm_text"]
        workspace.updated_at = datetime.utcnow()
        db.commit()
        return {"message": "Plan updated successfully."}

    elif action == "PlanReady":
        if role != "Visionary" and not member.is_leader:
            raise HTTPException(status_code=403, detail="Only the Visionary can declare the plan ready.")
        workspace.plan_ready = True
        team.current_stage = "DRAFT"
        member.role_performance_score = min(1.0, member.role_performance_score + 0.5)
        db.commit()
        return {"message": "Plan marked as ready! Pioneer can now draft the code."}

    # Role 2: PIONEER Actions
    elif action == "UpdateCode":
        if role != "Pioneer" and not member.is_leader:
            raise HTTPException(status_code=403, detail="Only the Pioneer can edit code.")
        if "code_content" in details:
            workspace.code_content = details["code_content"]
        if "code_language" in details:
            workspace.code_language = details["code_language"]
        workspace.updated_at = datetime.utcnow()
        db.commit()
        return {"message": "Code updated."}

    elif action == "SubmitDraft":
        if role != "Pioneer" and not member.is_leader:
            raise HTTPException(status_code=403, detail="Only the Pioneer can submit code drafts.")
        workspace.draft_submitted = True
        team.current_stage = "REVIEW"
        workspace.review_status = "PENDING"
        member.role_performance_score = min(1.0, member.role_performance_score + 0.4)
        db.commit()
        return {"message": "Draft submitted! Mentor review and Conqueror testing can now begin."}

    elif action == "Resubmit":
        if role != "Pioneer" and not member.is_leader:
            raise HTTPException(status_code=403, detail="Only the Pioneer can resubmit code.")
        workspace.draft_submitted = True
        workspace.mentor_approved = False
        workspace.review_status = "PENDING"
        team.current_stage = "REVIEW"
        member.role_performance_score = min(1.0, member.role_performance_score + 0.2)
        db.commit()
        return {"message": "Bug fixes resubmitted for Mentor & Conqueror review."}

    # Role 3: MENTOR Actions
    elif action == "Approve":
        if role != "Mentor" and not member.is_leader:
            raise HTTPException(status_code=403, detail="Only the Mentor can approve the draft.")
        workspace.mentor_approved = True
        workspace.review_status = "APPROVED"
        member.role_performance_score = min(1.0, member.role_performance_score + 0.5)
        db.commit()
        return {"message": "Draft approved by Mentor!"}

    elif action == "RequestChanges":
        if role != "Mentor" and not member.is_leader:
            raise HTTPException(status_code=403, detail="Only the Mentor can request changes.")
        workspace.mentor_approved = False
        workspace.review_status = "CHANGES_REQUESTED"
        team.current_stage = "FIX"
        db.commit()
        return {"message": "Changes requested from Pioneer."}

    # Role 4: CONQUEROR Actions
    elif action == "ReportBug":
        if role != "Conqueror" and not member.is_leader:
            raise HTTPException(status_code=403, detail="Only the Conqueror can file bug reports.")
        workspace.latest_bug_report = {
            "description": details.get("description", ""),
            "failing_case": details.get("failing_case", ""),
            "suggested_code": details.get("suggested_code", ""),
            "reported_at": datetime.utcnow().isoformat()
        }
        team.current_stage = "FIX"
        workspace.mentor_approved = False
        member.role_performance_score = min(1.0, member.role_performance_score + 0.3)
        db.commit()
        return {"message": "Bug report and suggested code submitted to Pioneer."}

    elif action == "FinalSubmit":
        if role != "Conqueror" and not member.is_leader:
            raise HTTPException(status_code=403, detail="Only the Conqueror can submit the final solution.")
        
        # Check Mentor Approval and Passing Tests
        if not workspace.mentor_approved:
            raise HTTPException(status_code=400, detail="Cannot submit: Mentor approval is mandatory before final submit.")
        
        if workspace.tests_passed_ratio < 1.0:
            raise HTTPException(status_code=400, detail="Cannot submit: All test cases must pass (100%).")
        
        team.passed = True
        team.status = "COMPLETED"
        team.ended_at = datetime.utcnow()
        workspace.final_submitted = True
        member.role_performance_score = min(1.0, member.role_performance_score + 0.5)
        
        # Update team counter (Algorithm 8 line 20)
        counter = db.query(CollabTeamCounter).filter(CollabTeamCounter.team_key == team.team_key).first()
        if counter:
            counter.completed_count += 1
            # Check overrun vs on-time
            on_time = (team.ended_at - team.started_at).total_seconds() <= (team.final_time_minutes * 60)
            res_str = "ON_TIME" if on_time else "OVERRUN"
            curr_results = list(counter.recent_results or [])
            curr_results.append(res_str)
            if len(curr_results) >= 3:
                last_3 = curr_results[-3:]
                if all(r == "ON_TIME" for r in last_3):
                    counter.reduction_step_s += 1
                elif last_3.count("OVERRUN") >= 2:
                    counter.reduction_step_s = max(0, counter.reduction_step_s - 1)
            counter.recent_results = curr_results
        
        db.commit()
        return {"message": "Challenge completed successfully! All test cases passed and Mentor approved."}

    else:
        raise HTTPException(status_code=400, detail=f"Unrecognized action: {action}")

@router.post("/student/teams/{team_id}/comments")
def add_workspace_comment(
    team_id: str,
    req: AddCommentRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Mentor adds Google Docs-style comments to code lines, algorithm lines, or flowchart shapes.
    Leader can also add Leader Notes.
    """
    team = db.query(CollabTeam).filter(CollabTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    
    member = db.query(CollabTeamMember).filter(
        CollabTeamMember.team_id == team.id,
        CollabTeamMember.student_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not authorized.")

    is_leader_note = req.is_leader_note and member.is_leader

    comment = CollabComment(
        team_id=team.id,
        module_index=1,
        author_id=current_user.id,
        author_role=member.assigned_role,
        target_type=req.target_type,
        target_id_or_line=req.target_id_or_line,
        comment_text=req.comment_text.strip(),
        is_leader_note=is_leader_note,
        is_resolved=False
    )
    db.add(comment)
    member.role_performance_score = min(1.0, member.role_performance_score + 0.1)
    db.commit()
    db.refresh(comment)

    return {"message": "Comment posted successfully.", "comment_id": comment.id}

@router.post("/student/teams/{team_id}/comments/{comment_id}/resolve")
def resolve_workspace_comment(
    team_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Marks a comment thread as resolved."""
    comment = db.query(CollabComment).filter(
        CollabComment.id == comment_id,
        CollabComment.team_id == team_id
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")
    
    comment.is_resolved = True
    db.commit()
    return {"message": "Comment resolved."}

@router.post("/student/teams/{team_id}/chat")
def send_team_chat(
    team_id: str,
    req: SendChatMessageRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Sends a real-time chat message to the sub-team."""
    member = db.query(CollabTeamMember).filter(
        CollabTeamMember.team_id == team_id,
        CollabTeamMember.student_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member.")
    
    msg = CollabChatMessage(
        team_id=team_id,
        sender_id=current_user.id,
        sender_name=current_user.name,
        sender_role=member.assigned_role,
        message=req.message.strip()
    )
    db.add(msg)
    db.commit()
    return {"message": "Sent"}

@router.post("/student/teams/{team_id}/run-code")
def run_team_code(
    team_id: str,
    req: RunCodeRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Compiles and executes code using the existing compiler service!
    Also evaluates teacher test cases for the Conqueror.
    """
    team = db.query(CollabTeam).filter(CollabTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    
    challenge = db.query(CollabChallenge).filter(CollabChallenge.id == team.challenge_id).first()
    workspace = db.query(CollabWorkspaceState).filter(CollabWorkspaceState.team_id == team.id).first()

    # Run single execution with custom input
    run_res = run_code(req.language, req.code, req.stdin_input)

    # If test cases exist, evaluate pass/fail ratio for Conqueror
    test_cases = db.query(CollabTestCase).filter(CollabTestCase.challenge_id == challenge.id).all()
    test_results = []
    passed_count = 0

    if test_cases:
        for tc in test_cases:
            tc_res = run_code(req.language, req.code, tc.input_data)
            actual_out = (tc_res.get("output") or "").strip()
            expected_out = (tc.expected_output or "").strip()
            is_pass = (actual_out == expected_out)
            if is_pass:
                passed_count += 1
            
            test_results.append({
                "test_id": tc.id,
                "input_data": tc.input_data if not tc.is_hidden else "[Hidden Test Case]",
                "expected_output": tc.expected_output if not tc.is_hidden else "[Hidden Test Case]",
                "actual_output": actual_out if not tc.is_hidden else ("[Pass]" if is_pass else "[Fail]"),
                "passed": is_pass,
                "is_hidden": tc.is_hidden
            })
        
        ratio = passed_count / len(test_cases)
        if workspace:
            workspace.tests_passed_ratio = ratio
    else:
        # If teacher didn't upload test cases, passing is based on successful zero-error compilation
        ratio = 1.0 if run_res.get("success") else 0.0
        if workspace:
            workspace.tests_passed_ratio = ratio

    if workspace:
        workspace.compiler_output = run_res.get("output", "") or run_res.get("error", "")
        workspace.custom_stdin = req.stdin_input
        db.commit()

    return {
        "success": run_res.get("success", False),
        "output": run_res.get("output", ""),
        "error": run_res.get("error", ""),
        "tests_passed_ratio": ratio,
        "test_results": test_results
    }

@router.post("/student/teams/{team_id}/break")
def toggle_break(
    team_id: str,
    req: BreakRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Algorithm 6: Monitor & Break pool management."""
    member = db.query(CollabTeamMember).filter(
        CollabTeamMember.team_id == team_id,
        CollabTeamMember.student_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not authorized.")

    now = datetime.utcnow()
    if req.action == "start":
        if member.break_pool_remaining_seconds <= 0:
            raise HTTPException(status_code=400, detail="Break pool exhausted. Cannot take a break.")
        member.is_on_break = True
        member.break_start_at = now
        db.commit()
        return {"message": "Break started. Inactivity checks paused.", "is_on_break": True}
    elif req.action == "end":
        if member.is_on_break and member.break_start_at:
            duration = int((now - member.break_start_at).total_seconds())
            member.break_pool_remaining_seconds = max(0, member.break_pool_remaining_seconds - duration)
        member.is_on_break = False
        member.break_start_at = None
        member.last_action_at = now
        db.commit()
        return {
            "message": "Break ended. Welcome back!",
            "is_on_break": False,
            "break_pool_remaining_seconds": member.break_pool_remaining_seconds
        }
    return {"message": "Invalid break action."}

@router.post("/student/teams/{team_id}/focus")
def handle_focus_event(
    team_id: str,
    req: FocusEventRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """Algorithm 6 Line 5: Logs away duration when student leaves fullscreen / unfocuses Game Zone."""
    member = db.query(CollabTeamMember).filter(
        CollabTeamMember.team_id == team_id,
        CollabTeamMember.student_id == current_user.id
    ).first()
    if not member:
        return {"status": "ignored"}
    
    if req.event == "away":
        member.is_away = True
        member.away_start_at = datetime.utcnow()
    elif req.event == "returned":
        member.is_away = False
        member.away_start_at = None
    db.commit()
    return {"status": "ok"}

# ==========================================
# PEER REVIEWS, POINTS & POST-CHALLENGE
# ==========================================

@router.post("/student/teams/{team_id}/peer-review")
def submit_peer_review(
    team_id: str,
    req: PeerReviewSubmitRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Algorithm 9a & 9b: Mandatory Peer Evaluation and Points Calculation.
    """
    team = db.query(CollabTeam).filter(CollabTeam.id == team_id).first()
    if not team or team.status not in ["COMPLETED", "TIMEOUT"]:
        raise HTTPException(status_code=400, detail="Reviews can only be submitted after challenge completion.")
    
    challenge = db.query(CollabChallenge).filter(CollabChallenge.id == team.challenge_id).first()
    members = db.query(CollabTeamMember).filter(CollabTeamMember.team_id == team.id).all()
    my_member = next((m for m in members if m.student_id == current_user.id), None)
    if not my_member:
        raise HTTPException(status_code=403, detail="Not authorized.")

    for r in req.reviews:
        ratee_member = next((m for m in members if m.student_id == r.ratee_id), None)
        ratee_role = ratee_member.assigned_role if ratee_member else "Member"

        rev = CollabPeerReview(
            challenge_id=challenge.id,
            team_id=team.id,
            rater_id=current_user.id,
            ratee_id=r.ratee_id,
            ratee_role=ratee_role,
            role_contribution=r.role_contribution,
            reliability_timeliness=r.reliability_timeliness,
            communication=r.communication,
            quality_of_work=r.quality_of_work,
            written_comment=r.written_comment.strip()
        )
        db.add(rev)

    # Compute and release points for current user (Equation 11)
    team_passed = team.passed
    p_team = challenge.p_mod if team_passed else (challenge.eta_partial * challenge.p_mod * my_member.role_performance_score)
    role_pts = challenge.w_role * my_member.role_performance_score
    feedback_bonus = challenge.w_feedback * 0.8 # default good rating
    leader_bonus = challenge.p_leader if my_member.is_leader else 0.0
    total_pts = round(p_team + role_pts + feedback_bonus + leader_bonus, 1)

    my_member.points_awarded = total_pts
    my_member.points_released = True

    # Credit points to main student account (coins)
    current_user.total_coins += int(total_pts)

    db.commit()

    return {
        "message": "Peer reviews submitted and points released successfully!",
        "points_awarded": total_pts
    }

@router.post("/student/teams/{team_id}/role-switch")
def post_challenge_role_switch(
    team_id: str,
    req: RoleSwitchRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Algorithm 10: PostChallenge
    Unlocks student and optionally changes their learner type (pt_ls) for future challenges.
    """
    new_role = normalize_role(req.new_role)
    current_user.pt_ls = new_role
    
    member = db.query(CollabTeamMember).filter(
        CollabTeamMember.team_id == team_id,
        CollabTeamMember.student_id == current_user.id
    ).first()
    if member:
        member.role_switch_opted = new_role
    
    db.commit()
    return {"message": f"Your role has been updated to {new_role} for future challenges."}


# =====================================================================
# SQUAD REAL-TIME VOICE CHAT WEBSOCKET & SIGNALING (FREE FIRE STYLE)
# =====================================================================

class SquadVoiceManager:
    """
    Manages in-memory live voice channels per collaborative team.
    Supports WebRTC signaling (offers, answers, ICE candidates),
    speaking indicators, mute states, and audio frame relay fallback.
    Zero external dependencies, zero cost, works on local LAN/college Wi-Fi.
    """
    def __init__(self):
        # team_id -> { student_id: WebSocket }
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}
        # student_id -> { name, role, is_speaking, is_muted }
        self.peer_meta: Dict[str, Dict[str, Any]] = {}

    async def connect(self, team_id: str, student_id: str, websocket: WebSocket):
        await websocket.accept()
        if team_id not in self.rooms:
            self.rooms[team_id] = {}
        self.rooms[team_id][student_id] = websocket

        # Gather currently connected peers
        existing_peers = [sid for sid in self.rooms[team_id].keys() if sid != student_id]
        
        # Send current room state to newly joined student
        await websocket.send_json({
            "type": "room-state",
            "student_id": student_id,
            "existing_peers": existing_peers,
            "peers_meta": {sid: self.peer_meta.get(sid, {}) for sid in self.rooms[team_id].keys()}
        })

        # Broadcast peer-joined to all other squad members
        await self.broadcast(
            team_id,
            {
                "type": "peer-joined",
                "student_id": student_id,
                "meta": self.peer_meta.get(student_id, {}),
                "existing_peers": list(self.rooms[team_id].keys())
            },
            exclude=student_id
        )

    def disconnect(self, team_id: str, student_id: str):
        if team_id in self.rooms and student_id in self.rooms[team_id]:
            try:
                del self.rooms[team_id][student_id]
            except KeyError:
                pass
            if not self.rooms[team_id]:
                try:
                    del self.rooms[team_id]
                except KeyError:
                    pass
        if student_id in self.peer_meta:
            try:
                del self.peer_meta[student_id]
            except KeyError:
                pass

    async def send_personal(self, team_id: str, target_student_id: str, message: dict):
        if team_id in self.rooms and target_student_id in self.rooms[team_id]:
            ws = self.rooms[team_id][target_student_id]
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(team_id, target_student_id)

    async def broadcast(self, team_id: str, message: dict, exclude: Optional[str] = None):
        if team_id not in self.rooms:
            return
        dead = []
        for sid, ws in list(self.rooms[team_id].items()):
            if exclude and sid == exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(sid)
        for sid in dead:
            self.disconnect(team_id, sid)


voice_manager = SquadVoiceManager()


@router.websocket("/ws/voice/{team_id}/{student_id}")
async def squad_voice_websocket(websocket: WebSocket, team_id: str, student_id: str):
    """
    WebSocket endpoint for live squad voice communication.
    Clients exchange WebRTC SDP offers/answers, ICE candidates, and speaking states.
    """
    await voice_manager.connect(team_id, student_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            target = data.get("target")

            # Store peer metadata (e.g. role, name, muted)
            if msg_type in ("meta-update", "speaking-state", "mute-state"):
                if student_id not in voice_manager.peer_meta:
                    voice_manager.peer_meta[student_id] = {}
                voice_manager.peer_meta[student_id].update(data.get("meta", {}))
                data["sender"] = student_id
                await voice_manager.broadcast(team_id, data, exclude=student_id)
            elif target:
                # Direct WebRTC signal to target peer
                data["sender"] = student_id
                await voice_manager.send_personal(team_id, target, data)
            else:
                # Room-wide broadcast
                data["sender"] = student_id
                await voice_manager.broadcast(team_id, data, exclude=student_id)
    except WebSocketDisconnect:
        voice_manager.disconnect(team_id, student_id)
        await voice_manager.broadcast(
            team_id,
            {
                "type": "peer-left",
                "student_id": student_id,
                "remaining_peers": list(voice_manager.rooms.get(team_id, {}).keys())
            }
        )
    except Exception:
        voice_manager.disconnect(team_id, student_id)

