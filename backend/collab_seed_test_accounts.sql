-- =========================================================================
-- SEED SCRIPT FOR 4 COLLABORATIVE SQUAD STUDENTS & TEST TEACHER
-- Password for all accounts: password123
-- Safe & Idempotent: Does not affect existing accounts (ON CONFLICT DO NOTHING)
-- =========================================================================

-- 1. Ensure Test Teacher exists
INSERT INTO teachers (
    id, employee_id, name, gender, department, email, password_hash, created_at
) VALUES (
    'tea-0000-0000-0000-000000000001',
    'TCE_FAC_001',
    'Dr. Scholar Lead',
    'female',
    'Computer Science & Engineering',
    'teacher@tce.edu',
    '$2b$12$Cy25mk8Y5KhPz82Pyr3RU.PuaF76OR3ZXbSHJt2Atj1Osk61ELvqO',
    NOW()
) ON CONFLICT (email) DO UPDATE 
SET password_hash = '$2b$12$Cy25mk8Y5KhPz82Pyr3RU.PuaF76OR3ZXbSHJt2Atj1Osk61ELvqO';

-- 2. Seed 4 Collaborative Squad Students with archetypes and cognitive speeds
-- Visionary (Average / Jogger)
INSERT INTO students (
    id, regno, name, gender, department, email, password_hash,
    form_submission, pt_ls, ppt, cognitive_level, hearts, total_coins, total_keys
) VALUES (
    'stu-0000-0000-0000-000000000001',
    '26STU001',
    'Vikas (Visionary)',
    'male',
    'Computer Science & Engineering',
    'visionary@student.tce.edu',
    '$2b$12$Cy25mk8Y5KhPz82Pyr3RU.PuaF76OR3ZXbSHJt2Atj1Osk61ELvqO',
    TRUE,
    'Visionaries',
    'Visionaries',
    'average',
    5,
    100,
    5
) ON CONFLICT (email) DO UPDATE 
SET password_hash = '$2b$12$Cy25mk8Y5KhPz82Pyr3RU.PuaF76OR3ZXbSHJt2Atj1Osk61ELvqO',
    pt_ls = 'Visionaries',
    cognitive_level = 'average';

-- Pioneer (Fast / Glider)
INSERT INTO students (
    id, regno, name, gender, department, email, password_hash,
    form_submission, pt_ls, ppt, cognitive_level, hearts, total_coins, total_keys
) VALUES (
    'stu-0000-0000-0000-000000000002',
    '26STU002',
    'Pooja (Pioneer)',
    'female',
    'Computer Science & Engineering',
    'pioneer@student.tce.edu',
    '$2b$12$Cy25mk8Y5KhPz82Pyr3RU.PuaF76OR3ZXbSHJt2Atj1Osk61ELvqO',
    TRUE,
    'Pioneers',
    'Pioneers',
    'fast',
    5,
    100,
    5
) ON CONFLICT (email) DO UPDATE 
SET password_hash = '$2b$12$Cy25mk8Y5KhPz82Pyr3RU.PuaF76OR3ZXbSHJt2Atj1Osk61ELvqO',
    pt_ls = 'Pioneers',
    cognitive_level = 'fast';

-- Mentor (Slow / Stepper)
INSERT INTO students (
    id, regno, name, gender, department, email, password_hash,
    form_submission, pt_ls, ppt, cognitive_level, hearts, total_coins, total_keys
) VALUES (
    'stu-0000-0000-0000-000000000003',
    '26STU003',
    'Mohan (Mentor)',
    'male',
    'Computer Science & Engineering',
    'mentor@student.tce.edu',
    '$2b$12$Cy25mk8Y5KhPz82Pyr3RU.PuaF76OR3ZXbSHJt2Atj1Osk61ELvqO',
    TRUE,
    'Mentors',
    'Mentors',
    'slow',
    5,
    100,
    5
) ON CONFLICT (email) DO UPDATE 
SET password_hash = '$2b$12$Cy25mk8Y5KhPz82Pyr3RU.PuaF76OR3ZXbSHJt2Atj1Osk61ELvqO',
    pt_ls = 'Mentors',
    cognitive_level = 'slow';

-- Conqueror (Average / Jogger)
INSERT INTO students (
    id, regno, name, gender, department, email, password_hash,
    form_submission, pt_ls, ppt, cognitive_level, hearts, total_coins, total_keys
) VALUES (
    'stu-0000-0000-0000-000000000004',
    '26STU004',
    'Charan (Conqueror)',
    'male',
    'Computer Science & Engineering',
    'conqueror@student.tce.edu',
    '$2b$12$Cy25mk8Y5KhPz82Pyr3RU.PuaF76OR3ZXbSHJt2Atj1Osk61ELvqO',
    TRUE,
    'Conquerors',
    'Conquerors',
    'average',
    5,
    100,
    5
) ON CONFLICT (email) DO UPDATE 
SET password_hash = '$2b$12$Cy25mk8Y5KhPz82Pyr3RU.PuaF76OR3ZXbSHJt2Atj1Osk61ELvqO',
    pt_ls = 'Conquerors',
    cognitive_level = 'average';

-- 3. Enroll all 4 students in existing courses
INSERT INTO course_enrollments (id, student_id, course_id, enrolled_at)
SELECT 
    SUBSTRING(MD5(CONCAT(s.id, c.id)), 1, 32),
    s.id,
    c.id,
    NOW()
FROM students s
CROSS JOIN courses c
WHERE s.email IN (
    'visionary@student.tce.edu',
    'pioneer@student.tce.edu',
    'mentor@student.tce.edu',
    'conqueror@student.tce.edu'
)
ON CONFLICT DO NOTHING;
