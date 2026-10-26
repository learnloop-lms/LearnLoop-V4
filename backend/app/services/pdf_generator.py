"""
Learn Loop — Module Completion Summary PDF Generator
Generates on-the-fly academic report of student's Quiz and/or Task submissions
with diagonal Registration Number watermark.
Supports separate reports (Quiz only, Task only, or Combined).
"""

import io
from datetime import datetime
from typing import Optional, Dict, Any, List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)

def _cognitive_ui_name(level_str: Optional[str]) -> str:
    lvl = (level_str or "").lower()
    if lvl in ["slow", "easy", "basic"]:
        return "Stepper"
    elif lvl in ["average", "medium", "intermediate"]:
        return "Jogger"
    elif lvl in ["fast", "hard", "advanced"]:
        return "Glider"
    return "Jogger"

def _difficulty_name(level_str: Optional[str]) -> str:
    lvl = (level_str or "").lower()
    if lvl in ["slow", "easy", "basic"]:
        return "Easy"
    elif lvl in ["average", "medium", "intermediate"]:
        return "Medium"
    elif lvl in ["fast", "hard", "advanced"]:
        return "Hard"
    return "Medium"

def generate_module_summary_pdf(
    student: Any,
    course: Any,
    module: Any,
    quiz_sub: Optional[Any],
    task_sub: Optional[Any],
    quiz_questions_map: Dict[str, Any],
    task_challenge: Optional[Any],
    report_type: str = "all" # "all", "quiz", "task"
) -> io.BytesIO:
    """
    Generates a beautifully styled in-memory PDF report.
    Watermark: student.regno across all pages.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=40,
        bottomMargin=40
    )

    watermark_text = getattr(student, "regno", "STUDENT") or "STUDENT"

    def draw_watermark(canvas, document):
        canvas.saveState()
        canvas.setFont("Helvetica-Bold", 54)
        # Translucent light purple/gray watermark
        canvas.setFillColor(colors.HexColor("#6366F1"), alpha=0.10)
        canvas.translate(300, 400)
        canvas.rotate(45)
        canvas.drawCentredString(0, 0, watermark_text.upper())
        canvas.restoreState()

    styles = getSampleStyleSheet()

    # Custom typography styles
    style_title = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1E1B4B")
    )
    style_subtitle = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#6B7280")
    )
    style_sec_heading = ParagraphStyle(
        'SecHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#4338CA"),
        spaceAfter=6
    )
    style_q_subtitle = ParagraphStyle(
        'QSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#312E81")
    )
    style_body = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1F2937")
    )
    style_code = ParagraphStyle(
        'Code',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#111827")
    )

    story = []

    # --------------------------------------------------------------------------
    # 1. DOCUMENT HEADER & TITLE (PRINTED ONCE ON TOP OF DOCUMENT)
    # --------------------------------------------------------------------------
    doc_heading = "Learn Loop — Academic Assessment Report"
    if report_type == "quiz":
        doc_heading = "Learn Loop — Adaptive Quiz Assessment Report"
    elif report_type == "task":
        doc_heading = "Learn Loop — Coding Task Assessment Report"

    story.append(Paragraph(doc_heading, style_title))
    story.append(Paragraph("Doctoral Research Framework: Adaptive Gamified Learning Management System", style_subtitle))
    story.append(Spacer(1, 10))

    # Calculate overall marks and timing
    quiz_score = float(quiz_sub.msq_score) if (quiz_sub and quiz_sub.msq_score is not None) else 0.0
    task_score = float(task_sub.mst_score) if (task_sub and task_sub.mst_score is not None) else 0.0
    task_max = float(task_challenge.max_marks) if task_challenge else 100.0
    prog_lang = getattr(task_sub, "programming_language", "N/A") or "N/A"

    def fmt_dt(dt):
        if not dt:
            return "N/A"
        if isinstance(dt, str):
            try:
                dt = datetime.fromisoformat(dt)
            except Exception:
                return dt[:16]
        return dt.strftime("%d-%b-%Y %I:%M %p")

    quiz_start = fmt_dt(getattr(quiz_sub, "started_at", None) or getattr(quiz_sub, "submitted_at", None))
    quiz_end = fmt_dt(getattr(quiz_sub, "submitted_at", None))
    task_start = fmt_dt(getattr(task_sub, "submitted_at", None))
    task_end = fmt_dt(getattr(task_sub, "evaluated_at", None) or getattr(task_sub, "submitted_at", None))

    # Build metadata rows based on report_type
    meta_table_data = [
        [
            Paragraph(f"<b>Student Name:</b> {student.name}", style_body),
            Paragraph(f"<b>Reg. No:</b> {student.regno}", style_body)
        ],
        [
            Paragraph(f"<b>Course Name:</b> {course.title if course else 'General'}", style_body),
            Paragraph(f"<b>Module Name:</b> Module {module.module_no}: {module.concept_name}", style_body)
        ],
        [
            Paragraph(f"<b>Question Category:</b> {module.concept_name}", style_body),
            Paragraph(f"<b>Programming Language:</b> {prog_lang.upper()}", style_body)
        ]
    ]

    if report_type == "quiz":
        meta_table_data.append([
            Paragraph(f"<b>Quiz Start Time:</b> {quiz_start}", style_body),
            Paragraph(f"<b>Quiz Completion Time:</b> {quiz_end}", style_body)
        ])
        meta_table_data.append([
            Paragraph(f"<b>Total Marks Earned (Quiz Score):</b> <font color='#4338CA'><b>{quiz_score:.1f} / 10.0 Marks</b></font>", style_body),
            Paragraph(f"<b>Passing Status:</b> {'PASSED' if quiz_score >= 5.0 else 'NEEDS REVIEW'}", style_body)
        ])
    elif report_type == "task":
        meta_table_data.append([
            Paragraph(f"<b>Task Submission Time:</b> {task_start}", style_body),
            Paragraph(f"<b>Evaluation Completion:</b> {task_end}", style_body)
        ])
        meta_table_data.append([
            Paragraph(f"<b>Total Marks Earned (Task Score):</b> <font color='#059669'><b>{task_score:.1f} / {task_max:.0f} Marks</b></font>", style_body),
            Paragraph(f"<b>Complexity Tier:</b> {task_challenge.complexity_qlc.capitalize() if task_challenge else 'Basic'}", style_body)
        ])
    else:
        # Combined "all"
        meta_table_data.append([
            Paragraph(f"<b>Quiz Timing:</b> {quiz_start} to {quiz_end}", style_body),
            Paragraph(f"<b>Task Timing:</b> {task_start} to {task_end}", style_body)
        ])
        meta_table_data.append([
            Paragraph(f"<b>Total Quiz Marks:</b> {quiz_score:.1f} / 10.0", style_body),
            Paragraph(f"<b>Total Task Marks:</b> {task_score:.1f} / {task_max:.0f}", style_body)
        ])

    t_meta = Table(meta_table_data, colWidths=[270, 270])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 14))

    # --------------------------------------------------------------------------
    # 2. ADAPTIVE QUIZ QUESTIONS SECTION (If report_type is "all" or "quiz")
    # --------------------------------------------------------------------------
    if report_type in ["all", "quiz"]:
        story.append(Paragraph("Adaptive Quiz Challenge Questions & Solutions", style_sec_heading))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#6366F1"), spaceAfter=10))

        quiz_responses = (quiz_sub.responses_detail if quiz_sub else []) or []
        if not quiz_responses:
            story.append(Paragraph("<i>No quiz responses recorded for this module.</i>", style_body))
        else:
            for idx, resp in enumerate(quiz_responses):
                q_id = resp.get("question_id", "")
                q_obj = quiz_questions_map.get(q_id)

                q_format = "Multiple Choice (MCQ)"
                if resp.get("is_fill_blank"):
                    q_format = "Fill in the Blank"
                elif resp.get("is_tf"):
                    q_format = "True / False"

                raw_cog = getattr(q_obj, "cognitive_level", "average") if q_obj else "average"
                cog_ui = _cognitive_ui_name(raw_cog)
                diff_ui = _difficulty_name(raw_cog)
                blooms = getattr(q_obj, "blooms_level", "Remembering") if q_obj else "Remembering"

                is_correct = resp.get("is_correct", False)
                mark_text = "+1.0 Mark (Correct)" if is_correct else "0.0 Marks (Incorrect)"
                mark_color = colors.HexColor("#059669") if is_correct else colors.HexColor("#DC2626")

                sub_text = (
                    f"<b>Question #{idx + 1} Metadata:</b> [Format: {q_format}] • "
                    f"[Bloom's Taxonomy: {blooms}] • "
                    f"[Cognitive Level: {cog_ui}] • "
                    f"[Difficulty: {diff_ui}]"
                )

                q_text = resp.get("question_text", "Question")
                student_ans = resp.get("student_answer", "N/A")
                correct_ans = resp.get("correct_answer", "N/A")

                q_card_data = [
                    [Paragraph(sub_text, style_q_subtitle)],
                    [Paragraph(f"<b>Question:</b> {q_text}", style_body)],
                    [Paragraph(f"<b>Student Answer:</b> {student_ans}&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;<b>Correct Answer:</b> {correct_ans}", style_body)],
                    [Paragraph(f"<b>Marks Awarded:</b> <font color='{mark_color.hexval()}'><b>{mark_text}</b></font>", style_body)]
                ]

                t_q = Table(q_card_data, colWidths=[540])
                t_q.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
                    ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EEF2FF")),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ]))

                story.append(KeepTogether([t_q, Spacer(1, 8)]))

        story.append(Spacer(1, 10))

    # --------------------------------------------------------------------------
    # 3. TASK / CODING CHALLENGE SECTION (If report_type is "all" or "task")
    # --------------------------------------------------------------------------
    if report_type in ["all", "task"]:
        story.append(Paragraph("Task Challenge & Submitted Solution", style_sec_heading))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#6366F1"), spaceAfter=10))

        if not task_sub or not task_challenge:
            story.append(Paragraph("<i>No task challenge submission found for this module.</i>", style_body))
        else:
            task_fmt = "Programming Challenge" if task_challenge.task_type == "programming" else "Descriptive / Written Analysis"
            raw_comp = task_challenge.complexity_qlc or "basic"
            task_cog = _cognitive_ui_name(raw_comp)
            task_diff = _difficulty_name(raw_comp)
            task_blooms = task_challenge.blooms_level or "Applying"

            task_sub_text = (
                f"<b>Task Challenge Metadata:</b> [Format: {task_fmt}] • "
                f"[Bloom's Taxonomy: {task_blooms}] • "
                f"[Cognitive Level: {task_cog}] • "
                f"[Complexity Level: {task_diff} ({raw_comp.capitalize()})]"
            )

            prob_stmt = task_challenge.problem_statement or task_challenge.title or ""
            sol_content = task_sub.submitted_code or task_sub.submitted_text or "No solution submitted."
            sol_display = sol_content if len(sol_content) < 4000 else sol_content[:4000] + "\n...[truncated for print]"
            feedback = task_sub.teacher_feedback or getattr(task_sub, "auto_eval_explanation", "") or "Evaluated against task specifications."

            task_card_data = [
                [Paragraph(task_sub_text, style_q_subtitle)],
                [Paragraph(f"<b>Problem Statement:</b> {prob_stmt}", style_body)],
                [Paragraph(f"<b>Submitted Solution ({prog_lang.upper()}):</b><br/><pre>{sol_display}</pre>", style_code)],
                [Paragraph(f"<b>Marks Earned:</b> <font color='#059669'><b>{task_score:.1f} / {task_max:.0f}</b></font>", style_body)],
                [Paragraph(f"<b>Autograder / Faculty Feedback & Evidence:</b> {feedback}", style_body)]
            ]

            t_task = Table(task_card_data, colWidths=[540])
            t_task.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
                ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F5F3FF")),
                ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor("#F8FAFC")),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(t_task)

    story.append(Spacer(1, 14))
    story.append(Paragraph("<i>Report generated automatically by Learn Loop LMS. Authenticity verified by Registration Watermark.</i>", style_subtitle))

    doc.build(story, onFirstPage=draw_watermark, onLaterPages=draw_watermark)
    buffer.seek(0)
    return buffer
