-- ====================================================================
-- LEARN LOOP COLLABORATIVE ENVIRONMENT - DEDICATED DATABASE INIT SCRIPT
-- Completely isolated from existing tables (zero disruption to old tables)
-- PostgreSQL Compatible
-- ====================================================================

-- 1. Challenges Table
CREATE TABLE IF NOT EXISTS collab_challenges (
    id VARCHAR(36) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id VARCHAR(36) NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    statement TEXT NOT NULL,
    group_size INTEGER DEFAULT 4,
    modules_count INTEGER DEFAULT 1,
    base_time_minutes INTEGER DEFAULT 60,
    break_pool_minutes INTEGER DEFAULT 10,
    stage_deadlines JSON DEFAULT '{"plan": 0.25, "draft": 0.50, "review": 0.75, "final": 1.0}'::json,
    invite_expiry_minutes INTEGER DEFAULT 60,
    adaptive_on BOOLEAN DEFAULT TRUE,
    beta_max DOUBLE PRECISION DEFAULT 0.15,
    strict_roles BOOLEAN DEFAULT FALSE,
    max_swaps INTEGER DEFAULT 2,
    p_mod DOUBLE PRECISION DEFAULT 100.0,
    p_int DOUBLE PRECISION DEFAULT 50.0,
    p_leader DOUBLE PRECISION DEFAULT 20.0,
    w_role DOUBLE PRECISION DEFAULT 30.0,
    w_feedback DOUBLE PRECISION DEFAULT 20.0,
    eta_partial DOUBLE PRECISION DEFAULT 0.5,
    status VARCHAR(20) DEFAULT 'PUBLISHED',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_collab_challenges_course ON collab_challenges(course_id);
CREATE INDEX IF NOT EXISTS idx_collab_challenges_teacher ON collab_challenges(teacher_id);

-- 2. Test Cases Table
CREATE TABLE IF NOT EXISTS collab_test_cases (
    id VARCHAR(36) PRIMARY KEY,
    challenge_id VARCHAR(36) NOT NULL REFERENCES collab_challenges(id) ON DELETE CASCADE,
    module_index INTEGER DEFAULT 1,
    input_data TEXT DEFAULT '',
    expected_output TEXT DEFAULT '',
    is_hidden BOOLEAN DEFAULT FALSE,
    weight DOUBLE PRECISION DEFAULT 1.0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_collab_tc_challenge ON collab_test_cases(challenge_id);

-- 3. Teams Table
CREATE TABLE IF NOT EXISTS collab_teams (
    id VARCHAR(36) PRIMARY KEY,
    challenge_id VARCHAR(36) NOT NULL REFERENCES collab_challenges(id) ON DELETE CASCADE,
    module_index INTEGER DEFAULT 1,
    team_key VARCHAR(255) DEFAULT '',
    leader_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'FORMING',
    final_time_minutes DOUBLE PRECISION DEFAULT 60.0,
    adaptive_bonus DOUBLE PRECISION DEFAULT 0.0,
    current_stage VARCHAR(20) DEFAULT 'PLAN',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    started_at TIMESTAMP WITHOUT TIME ZONE,
    ended_at TIMESTAMP WITHOUT TIME ZONE,
    passed BOOLEAN DEFAULT FALSE,
    integration_passed BOOLEAN DEFAULT FALSE,
    swaps_used INTEGER DEFAULT 0,
    handovers_used INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_collab_teams_challenge ON collab_teams(challenge_id);

-- 4. Team Members Table
CREATE TABLE IF NOT EXISTS collab_team_members (
    id VARCHAR(36) PRIMARY KEY,
    team_id VARCHAR(36) NOT NULL REFERENCES collab_teams(id) ON DELETE CASCADE,
    student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    module_index INTEGER DEFAULT 1,
    assigned_role VARCHAR(20) NOT NULL,
    is_leader BOOLEAN DEFAULT FALSE,
    locked_pt_ls VARCHAR(30) NOT NULL,
    locked_cognitive_level VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_on_break BOOLEAN DEFAULT FALSE,
    break_pool_remaining_seconds INTEGER DEFAULT 600,
    last_action_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    idle_prompted_at TIMESTAMP WITHOUT TIME ZONE,
    is_flagged_inactive BOOLEAN DEFAULT FALSE,
    is_away BOOLEAN DEFAULT FALSE,
    away_start_at TIMESTAMP WITHOUT TIME ZONE,
    break_start_at TIMESTAMP WITHOUT TIME ZONE,
    lead_seconds INTEGER DEFAULT 0,
    role_performance_score DOUBLE PRECISION DEFAULT 0.0,
    points_awarded DOUBLE PRECISION DEFAULT 0.0,
    points_released BOOLEAN DEFAULT FALSE,
    role_switch_opted VARCHAR(30),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_collab_members_team ON collab_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_collab_members_student ON collab_team_members(student_id);

-- 5. Invites Table
CREATE TABLE IF NOT EXISTS collab_invites (
    id VARCHAR(36) PRIMARY KEY,
    challenge_id VARCHAR(36) NOT NULL REFERENCES collab_challenges(id) ON DELETE CASCADE,
    team_id VARCHAR(36) NOT NULL REFERENCES collab_teams(id) ON DELETE CASCADE,
    module_index INTEGER DEFAULT 1,
    needed_role VARCHAR(20) NOT NULL,
    inviter_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    invitee_id VARCHAR(36) REFERENCES students(id) ON DELETE CASCADE,
    is_lobby BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collab_invites_challenge ON collab_invites(challenge_id);
CREATE INDEX IF NOT EXISTS idx_collab_invites_team ON collab_invites(team_id);

-- 6. Workspace State Table
CREATE TABLE IF NOT EXISTS collab_workspace_state (
    id VARCHAR(36) PRIMARY KEY,
    team_id VARCHAR(36) NOT NULL UNIQUE REFERENCES collab_teams(id) ON DELETE CASCADE,
    module_index INTEGER DEFAULT 1,
    flowchart_data JSON DEFAULT '{"nodes": [], "edges": []}'::json,
    algorithm_text TEXT DEFAULT '',
    plan_ready BOOLEAN DEFAULT FALSE,
    code_content TEXT DEFAULT '',
    code_language VARCHAR(20) DEFAULT 'python',
    draft_submitted BOOLEAN DEFAULT FALSE,
    mentor_approved BOOLEAN DEFAULT FALSE,
    review_status VARCHAR(30) DEFAULT 'PENDING',
    tests_passed_ratio DOUBLE PRECISION DEFAULT 0.0,
    final_submitted BOOLEAN DEFAULT FALSE,
    custom_stdin TEXT DEFAULT '',
    compiler_output TEXT DEFAULT '',
    latest_bug_report JSON,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_collab_workspace_team ON collab_workspace_state(team_id);

-- 7. Comments & Reviews Table
CREATE TABLE IF NOT EXISTS collab_comments (
    id VARCHAR(36) PRIMARY KEY,
    team_id VARCHAR(36) NOT NULL REFERENCES collab_teams(id) ON DELETE CASCADE,
    module_index INTEGER DEFAULT 1,
    author_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    author_role VARCHAR(20) NOT NULL,
    target_type VARCHAR(30) DEFAULT 'code_line',
    target_id_or_line VARCHAR(50) NOT NULL,
    comment_text TEXT NOT NULL,
    is_leader_note BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_collab_comments_team ON collab_comments(team_id);

-- 8. Sub-Team Chat Messages Table
CREATE TABLE IF NOT EXISTS collab_chat_messages (
    id VARCHAR(36) PRIMARY KEY,
    team_id VARCHAR(36) NOT NULL REFERENCES collab_teams(id) ON DELETE CASCADE,
    sender_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    sender_name VARCHAR(100) NOT NULL,
    sender_role VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_collab_chat_team ON collab_chat_messages(team_id);

-- 9. Contribution Logs Table
CREATE TABLE IF NOT EXISTS collab_contribution_logs (
    id VARCHAR(36) PRIMARY KEY,
    team_id VARCHAR(36) NOT NULL REFERENCES collab_teams(id) ON DELETE CASCADE,
    student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    details JSON DEFAULT '{}'::json,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_collab_contrib_team ON collab_contribution_logs(team_id);

-- 10. Peer Reviews Table
CREATE TABLE IF NOT EXISTS collab_peer_reviews (
    id VARCHAR(36) PRIMARY KEY,
    challenge_id VARCHAR(36) NOT NULL REFERENCES collab_challenges(id) ON DELETE CASCADE,
    team_id VARCHAR(36) NOT NULL REFERENCES collab_teams(id) ON DELETE CASCADE,
    rater_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    ratee_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    ratee_role VARCHAR(20) NOT NULL,
    role_contribution INTEGER DEFAULT 5,
    reliability_timeliness INTEGER DEFAULT 5,
    communication INTEGER DEFAULT 5,
    quality_of_work INTEGER DEFAULT 5,
    written_comment TEXT DEFAULT '',
    is_approved_by_teacher BOOLEAN DEFAULT TRUE,
    submitted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_collab_peer_challenge ON collab_peer_reviews(challenge_id);
CREATE INDEX IF NOT EXISTS idx_collab_peer_team ON collab_peer_reviews(team_id);

-- 11. Team Repetition Counter Table
CREATE TABLE IF NOT EXISTS collab_team_counters (
    id VARCHAR(36) PRIMARY KEY,
    team_key VARCHAR(255) UNIQUE NOT NULL,
    course_id VARCHAR(36) NOT NULL,
    completed_count INTEGER DEFAULT 0,
    reduction_step_s INTEGER DEFAULT 0,
    recent_results JSON DEFAULT '[]'::json,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_collab_counters_key ON collab_team_counters(team_key);
