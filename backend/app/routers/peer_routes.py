from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/peer", tags=["Peer Learning System"])

@router.post("/query")
def raise_peer_query(
    req: schemas.PeerQueryCreate,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 1: Student raises query for help (Cost: 20 coins)
    """
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    if current_user.total_coins < 20:
        raise HTTPException(status_code=400, detail="Raising a peer query costs 20 coins. Insufficient balance.")

    current_user.total_coins = max(0, current_user.total_coins - 20)
    db.add(current_user)

    query = models.PeerQuery(
        student_id=current_user.id,
        module_id=req.module_id,
        query_text=req.query_text,
        status="open"
    )
    db.add(query)
    db.commit()
    db.refresh(query)
    db.refresh(current_user)

    return {
        "message": "Query posted to peers! Deducted 20 coins.",
        "query_id": query.id,
        "total_coins": current_user.total_coins
    }

@router.get("/module/{module_id}/queries")
def get_module_queries(module_id: str, db: Session = Depends(get_db)):
    queries = db.query(models.PeerQuery).filter(models.PeerQuery.module_id == module_id).order_by(models.PeerQuery.created_at.desc()).all()
    res = []
    for q in queries:
        answers = []
        for a in q.answers:
            helper = db.query(models.Student).filter(models.Student.id == a.helper_student_id).first()
            answers.append({
                "answer_id": a.id,
                "helper_name": helper.name if helper else "Peer",
                "answer_text": a.answer_text,
                "is_acknowledged": a.is_acknowledged,
                "created_at": a.created_at
            })
        inquirer = db.query(models.Student).filter(models.Student.id == q.student_id).first()
        res.append({
            "query_id": q.id,
            "inquirer_id": q.student_id,
            "inquirer_name": inquirer.name if inquirer else "Student",
            "query_text": q.query_text,
            "status": q.status,
            "created_at": q.created_at,
            "answers": answers
        })
    return res

@router.post("/answer")
def answer_peer_query(
    req: schemas.PeerAnswerCreate,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 2: Peer provides answer
    """
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    query = db.query(models.PeerQuery).filter(models.PeerQuery.id == req.query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found.")

    if query.student_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot answer your own query.")

    answer = models.PeerAnswer(
        query_id=req.query_id,
        helper_student_id=current_user.id,
        answer_text=req.answer_text
    )
    query.status = "answered"
    db.add(answer)
    db.commit()
    db.refresh(answer)

    return {"message": "Answer submitted to peer.", "answer_id": answer.id}

@router.post("/acknowledge/{answer_id}")
def acknowledge_answer(
    answer_id: str,
    current_user = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 3 & 4: Inquiring student acknowledges answer -> Reward 30 coins to helper!
    """
    if getattr(current_user, "current_role", "") != "student":
        raise HTTPException(status_code=403, detail="Students only.")

    ans = db.query(models.PeerAnswer).filter(models.PeerAnswer.id == answer_id).first()
    if not ans:
        raise HTTPException(status_code=404, detail="Answer not found.")

    query = ans.query
    if query.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the student who asked the question can acknowledge this answer.")

    if ans.is_acknowledged:
        return {"message": "Answer has already been acknowledged."}

    ans.is_acknowledged = True
    query.status = "acknowledged"

    # Reward 30 coins to helper
    helper = db.query(models.Student).filter(models.Student.id == ans.helper_student_id).first()
    if helper:
        helper.total_coins += 30

    db.commit()

    return {"message": "Answer acknowledged! 30 coins awarded to the peer helper."}
