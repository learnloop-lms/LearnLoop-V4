# Learn Loop — Adaptive Gamified Learning Management System

Learn Loop is a full-stack, research-backed Learning Management System (LMS) developed specifically to operationalize the doctoral research framework: **"Adaptive Gamification through Learner Profiling: Integrating Player Type, Learning Style, and Cognitive Ability."**

---

## 🌟 Key Research Modules Implemented

### 1. 4-Archetype Profiling (ANN Model 1)
- Evaluates **24-question onboarding survey**:
  - **12 Bartle Player Type Questions** (Achiever, Explorer, Socializer, Killer)
  - **12 Felder-Silverman Learning Style Questions** (Active/Reflective, Sequential/Global, Sensing/Intuitive, Visual/Verbal)
- **Model 1 (`ANN_PT_LS`)** classifies learner into one of 4 archetypes:
  1. **Visionaries** (*Space & Cyber Station world*) — Elements: Feedback, Leaderboard, Badges
  2. **Mentors** (*Ancient Academy & Library world*) — Elements: Badges, Progress Bar, Mystery
  3. **Conquerors** (*Medieval Keep & Dragon Battlefield*) — Elements: Badges, Progress Bar, Leaderboard
  4. **Pioneers** (*Uncharted Jungle & Relic Quests*) — Elements: Leaderboard, Mystery, Rewards
- Automatically assigns boy/girl theme avatar based on user `gender`.

### 2. Cognitive Tiers (Psychologically Safe Terminology)
- Backend stores `slow`, `average`, `fast` to preserve statistical modeling integrity.
- Student-facing UI maps these seamlessly to:
  - `slow` $\longrightarrow$ **Stepper** (Stepper Leaderboard)
  - `average` $\longrightarrow$ **Jogger** (Jogger Leaderboard)
  - `fast` $\longrightarrow$ **Glider** (Glider Leaderboard)

### 3. In-Quiz Lifelines (Strictly Within Quiz / Task)
- **50:50**: Eliminates two wrong answers (2 free uses, then 100 coins)
- **Double Dip**: Pick 2 options for the same question (1 free use, then 100 coins)
- **Swap**: Replaces question with another of equal difficulty (2 free uses, then 1 heart)
- **Hint**: Reveals question hint (2 free uses, then 10 coins)
- **Extra Time**: +1 minute (1 free use, then 50 coins)
- **Hearts / Lives System**: 5 max lives. -1 for difficulty drop, -2 for failing easy level. Regenerates 1 life per 30 minutes!
- **High Achiever Bonus**: 20-30s free unlimited lifelines countdown for consistent high performers.

### 4. Mathematical 4-Model Pipeline (Freelancer Bug Permanently Fixed!)
```
[ Quiz Submission ]
        │
        ▼
   ANN Model 2 ──► coq (Slow / Medium / Fast)
                       │  (STRICTLY INTERNAL: Never touches leaderboard)
                       ▼
                 ANN Model 3 ──► Task Complexity qlc (Basic / Intermediate / Advanced)
                                      │
                                [ Task Submission ]
                                      │
                                      ▼
                        Calculate Total Score: tp = W1*msq + W2*mst
                                      │
                                      ▼
                                 ANN Model 4  (cmc, tp)
                                      │
                                      ▼
                        Outputs: Slow / Medium / Fast Learner
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼                                         ▼
   [ THIS MODEL ALONE UPDATES LEADERBOARD ]    [ Mapped to Student-Facing UI ]
                                                • Slow Learner   ──► Stepper
                                                • Medium Learner ──► Jogger
                                                • Fast Learner   ──► Glider
```

### 5. Multi-Language Code Compiler Workbench
- Supports: **Python, C, C++, Java, JavaScript**.
- Instructors select allowed compilers when creating a course.
- Students run code in real time with execution outputs and compiler error capture.

### 6. Dynamic Element Adaptation & Reclassification (Algorithm 3)
- Post-module 5-star ratings for the 6 elements.
- Cumulative engagement vector updates dynamically.
- Matching top 3 elements triggers archetype reclassification.
- Unassigned elements feature a "Preview" option.
- Includes an explicit "Skip" button that logs `rating_skipped: true` in PostgreSQL/SQLite for research analysis.

### 7. Rule-Based Badge Collectibles Showcase
- **Associate Badge**: Awarded for clearing Basic challenges.
- **Professional Badge**: Awarded for clearing Intermediate challenges.
- **Master Badge**: Awarded for clearing Advanced challenges.
- Badges earned across all archetype evolutions are preserved and displayed in the Collectibles trophy room!

---

## 🚀 How to Run the Platform (1-Click)

Simply double-click the file:
```
run_platform.bat
```
This automatically starts:
1. **FastAPI Backend**: `http://localhost:8000` (API Docs: `http://localhost:8000/docs`)
2. **React Frontend**: `http://localhost:5173`
3. Opens your default web browser directly to the application!

---

## 🔑 Default Accounts for Testing

### 1. Default Instructor Account
- **Email**: `teacher@tce.edu`
- **Password**: `password123`
- **Employee ID**: `TCE_FAC_001`
- **Pre-created Course**: *Advanced Data Structures & Algorithms*
- **Join Code**: `DSA2026`

### 2. Student Account
- Click **"Create an Account"** on the login screen.
- Select **Student Account**.
- Fill in Name, Register Number, Gender (Male/Female/Others), Department, Email, and Password.
- You will be automatically guided through the **24-Question Survey** to classify your archetype!
- Enter Join Code **`DSA2026`** on your dashboard to access the course.
