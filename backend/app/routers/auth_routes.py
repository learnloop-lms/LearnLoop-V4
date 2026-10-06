from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.services.gamification import regenerate_hearts

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register/student", response_model=schemas.TokenResponse)
def register_student(req: schemas.StudentRegister, db: Session = Depends(get_db)):
    # Check if email or regno exists
    existing = db.query(models.Student).filter(
        (models.Student.email == req.email) | (models.Student.regno == req.regno)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student with this email or register number already exists.")

    student = models.Student(
        name=req.name,
        regno=req.regno,
        gender=req.gender.lower(),
        department=req.department,
        email=req.email,
        password_hash=auth.get_password_hash(req.password),
        form_submission=False,
        cognitive_level="average",
        hearts=5,
        total_coins=0,
        total_keys=1
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    token = auth.create_access_token({"sub": student.id, "role": "student"})
    return schemas.TokenResponse(
        access_token=token,
        user_id=student.id,
        role="student",
        name=student.name,
        form_submission=student.form_submission,
        pt_ls=student.pt_ls,
        gender=student.gender,
        avatar_path=student.avatar_path,
        cognitive_level=student.cognitive_level
    )

@router.post("/register/teacher", response_model=schemas.TokenResponse)
def register_teacher(req: schemas.TeacherRegister, db: Session = Depends(get_db)):
    existing = db.query(models.Teacher).filter(
        (models.Teacher.email == req.email) | (models.Teacher.employee_id == req.employee_id)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Teacher with this email or employee ID already exists.")

    teacher = models.Teacher(
        name=req.name,
        employee_id=req.employee_id,
        gender=req.gender.lower(),
        department=req.department,
        email=req.email,
        password_hash=auth.get_password_hash(req.password)
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)

    token = auth.create_access_token({"sub": teacher.id, "role": "teacher"})
    return schemas.TokenResponse(
        access_token=token,
        user_id=teacher.id,
        role="teacher",
        name=teacher.name,
        gender=teacher.gender
    )

@router.post("/login", response_model=schemas.TokenResponse)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    role = req.role.lower()
    if role == "student":
        user = db.query(models.Student).filter(models.Student.email == req.email).first()
    elif role == "teacher":
        user = db.query(models.Teacher).filter(models.Teacher.email == req.email).first()
    else:
        raise HTTPException(status_code=400, detail="Invalid role specified.")

    if not user or not auth.verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # If student, handle hearts regeneration check
    if role == "student":
        new_hearts, new_time = regenerate_hearts(user.hearts, user.last_heart_loss_at)
        if new_hearts != user.hearts:
            user.hearts = new_hearts
            user.last_heart_loss_at = new_time
            db.commit()

    token = auth.create_access_token({"sub": user.id, "role": role})
    return schemas.TokenResponse(
        access_token=token,
        user_id=user.id,
        role=role,
        name=user.name,
        form_submission=getattr(user, "form_submission", None),
        pt_ls=getattr(user, "pt_ls", None),
        gender=getattr(user, "gender", None),
        avatar_path=getattr(user, "avatar_path", None),
        cognitive_level=getattr(user, "cognitive_level", None)
    )

@router.get("/me")
def get_current_profile(user=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    role = getattr(user, "current_role", "student")
    if role == "teacher":
        return {
            "id": user.id,
            "role": "teacher",
            "name": user.name,
            "employee_id": user.employee_id,
            "department": user.department,
            "email": user.email,
            "gender": user.gender
        }
    
    # Refresh student hearts if applicable
    new_hearts, new_time = regenerate_hearts(user.hearts, user.last_heart_loss_at)
    if new_hearts != user.hearts:
        user.hearts = new_hearts
        user.last_heart_loss_at = new_time
        db.commit()

    # Map cognitive level to UI term
    cog_map = {"slow": "Stepper", "average": "Jogger", "fast": "Glider"}
    student_ui_level = cog_map.get(user.cognitive_level, "Jogger")

    return {
        "id": user.id,
        "role": "student",
        "name": user.name,
        "regno": user.regno,
        "department": user.department,
        "email": user.email,
        "gender": user.gender,
        "form_submission": user.form_submission,
        "pt_ls": user.pt_ls,
        "avatar_path": user.avatar_path,
        "ppt": user.ppt,
        "spt": user.spt,
        "cognitive_level": user.cognitive_level,
        "leaderboard_level": student_ui_level,
        "hearts": user.hearts,
        "total_coins": user.total_coins,
        "total_keys": user.total_keys,
        "free_hints": user.free_hints,
        "free_extra_time": user.free_extra_time,
        "free_swaps": user.free_swaps,
        "free_double_dips": user.free_double_dips,
        "free_fifty_fifty": user.free_fifty_fifty,
        "high_achiever_bonus_active": user.high_achiever_bonus_active,
        "engagement_scores": user.engagement_scores
    }
