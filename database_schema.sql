-- ====================================================================
-- LEARN LOOP: ADAPTIVE GAMIFIED LMS DATABASE SCHEMA (POSTGRESQL 16)
-- Integrating Player Types (PT), Learning Styles (LS), and Cognitive Ability (ANNs)
-- ====================================================================

-- 1. Create Database (Run this if database does not already exist)
-- CREATE DATABASE learn_loop;

-- Connect to learn_loop database before running table creations below
-- \c learn_loop;

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------
-- 1. TEACHERS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teachers (
    id VARCHAR(36) PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    gender VARCHAR(20) NOT NULL DEFAULT 'others',
    department VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teachers_employee_id ON teachers(employee_id);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);

-- --------------------------------------------------------------------
-- 2. STUDENTS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(36) PRIMARY KEY,
    regno VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    gender VARCHAR(20) NOT NULL DEFAULT 'others',
    department VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Survey & Classification (Model 1)
    form_submission BOOLEAN DEFAULT FALSE,
    pt_ls VARCHAR(30), -- Visionaries, Mentors, Conquerors, Pioneers
    avatar_path VARCHAR(255),
    ppt VARCHAR(20),   -- Primary Player Type
    spt VARCHAR(20),   -- Secondary Player Type
    ld1_active_reflective VARCHAR(15),
    ld2_sequential_global VARCHAR(15),
    ld3_sensing_intuitive VARCHAR(15),
    ld4_visual_verbal VARCHAR(15),
    
    -- Cognitive Ability Tier
    cognitive_level VARCHAR(20) DEFAULT 'average', -- slow, average, fast
    level_streak_count INT DEFAULT 0,
    
    -- Gamification Currencies & Lifelines
    hearts INT DEFAULT 5,
    last_heart_loss_at TIMESTAMP,
    total_coins INT DEFAULT 0,
    total_keys INT DEFAULT 1,
    free_hints INT DEFAULT 2,
    free_extra_time INT DEFAULT 1,
    free_swaps INT DEFAULT 2,
    free_double_dips INT DEFAULT 1,
    free_fifty_fifty INT DEFAULT 2,
    high_achiever_bonus_active BOOLEAN DEFAULT FALSE,
    
    -- Dynamic Element Weights
    w_feedback FLOAT DEFAULT 1.0,
    w_leaderboard FLOAT DEFAULT 1.0,
    w_badges FLOAT DEFAULT 1.0,
    w_progressbar FLOAT DEFAULT 1.0,
    w_mystery FLOAT DEFAULT 1.0,
    w_rewards FLOAT DEFAULT 1.0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_regno ON students(regno);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);

-- --------------------------------------------------------------------
-- 3. COURSES TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    join_code VARCHAR(20) UNIQUE NOT NULL,
    teacher_id VARCHAR(36) NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_courses_join_code ON courses(join_code);

-- --------------------------------------------------------------------
-- 4. COURSE ENROLLMENTS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_enrollments (
    id VARCHAR(36) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 5. MODULES TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modules (
    id VARCHAR(36) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_number INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 6. STUDY MATERIALS TABLE (3-TIER ADAPTIVE)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_materials (
    id VARCHAR(36) PRIMARY KEY,
    module_id VARCHAR(36) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    tier VARCHAR(20) NOT NULL, -- basic, intermediate, advanced
    title VARCHAR(200) NOT NULL,
    content_body TEXT NOT NULL,
    pdf_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 7. QUIZ QUESTIONS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_questions (
    id VARCHAR(36) PRIMARY KEY,
    module_id VARCHAR(36) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    difficulty_level VARCHAR(20) NOT NULL, -- easy, medium, hard
    target_pt_ls VARCHAR(30) NOT NULL DEFAULT 'Universal',
    blooms_level VARCHAR(50) NOT NULL DEFAULT 'Remembering',
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option VARCHAR(5) NOT NULL, -- A, B, C, D
    hint_text TEXT,
    explanation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 8. TASK CHALLENGES TABLE (PROGRAMMING & DESCRIPTIVE)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_challenges (
    id VARCHAR(36) PRIMARY KEY,
    module_id VARCHAR(36) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    complexity_qlc VARCHAR(20) NOT NULL, -- basic, intermediate, advanced
    target_pt_ls VARCHAR(30) NOT NULL DEFAULT 'Universal',
    blooms_level VARCHAR(50) NOT NULL DEFAULT 'Applying',
    task_type VARCHAR(20) NOT NULL DEFAULT 'programming', -- programming, descriptive
    title VARCHAR(200) NOT NULL,
    problem_statement TEXT NOT NULL,
    starter_code JSON,
    test_cases JSON,
    max_marks INT DEFAULT 100,
    pdf_attachment VARCHAR(500),
    is_locked_bonus BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 9. QUIZ SUBMISSIONS TABLE (EVALUATED BY MODEL 2 - COQ)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_submissions (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    module_id VARCHAR(36) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    msq_score FLOAT NOT NULL,
    ttq_seconds INT NOT NULL,
    mistake_category_hit VARCHAR(20) NOT NULL,
    q_easy_count INT DEFAULT 0,
    q_med_count INT DEFAULT 0,
    q_hard_count INT DEFAULT 0,
    coq_predicted VARCHAR(20) NOT NULL, -- Model 2 output (INTERNAL ONLY)
    responses_detail JSON NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 10. TASK SUBMISSIONS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_submissions (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    task_id VARCHAR(36) NOT NULL REFERENCES task_challenges(id) ON DELETE CASCADE,
    programming_language VARCHAR(20), -- python, c, cpp, java
    submitted_code TEXT,
    submitted_text TEXT,
    compiler_output TEXT,
    mst_score FLOAT,
    teacher_feedback TEXT,
    evaluated_by VARCHAR(36) REFERENCES teachers(id),
    evaluated_at TIMESTAMP,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 11. LEARNER MODULE STATES TABLE (UPDATED BY MODEL 4 - LEADERBOARD)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learner_module_states (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    module_id VARCHAR(36) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    pmc INT DEFAULT 1,
    cmc INT DEFAULT 1,
    msq FLOAT NOT NULL,
    mst FLOAT NOT NULL,
    tp_total_performance FLOAT NOT NULL,
    model4_output VARCHAR(20) NOT NULL,
    leaderboard_level VARCHAR(20) NOT NULL, -- Stepper, Jogger, Glider
    level_streak_count INT DEFAULT 0,
    reward_coins_earned INT DEFAULT 0,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 12. ELEMENT RATINGS TABLE (ALGORITHM 3 GAMIFICATION FEEDBACK)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS element_ratings (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    module_id VARCHAR(36) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    rating_skipped BOOLEAN DEFAULT FALSE,
    r_feedback INT,
    r_leaderboard INT,
    r_badges INT,
    r_progressbar INT,
    r_mystery INT,
    r_rewards INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 13. USER BADGES TABLE (COLLECTIBLES: ASSOCIATE, PROFESSIONAL, MASTER)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_badges (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    badge_name VARCHAR(100) NOT NULL,
    tier VARCHAR(20) NOT NULL, -- associate, professional, master
    archetype VARCHAR(30) NOT NULL, -- Visionaries, Mentors, Conquerors, Pioneers
    awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 14. PEER QUERIES TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS peer_queries (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    module_id VARCHAR(36) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 15. PEER ANSWERS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS peer_answers (
    id VARCHAR(36) PRIMARY KEY,
    query_id VARCHAR(36) NOT NULL REFERENCES peer_queries(id) ON DELETE CASCADE,
    peer_student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    acknowledged_by_asker BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 16. REVALUATION REQUESTS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS revaluation_requests (
    id VARCHAR(36) PRIMARY KEY,
    task_submission_id VARCHAR(36) NOT NULL REFERENCES task_submissions(id) ON DELETE CASCADE,
    student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, reviewed, rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
