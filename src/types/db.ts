export type SubmissionRow = {
    id: string;
    user_id: string;
    status: "INTAKE"|"EXTRACTED"|"CLASSIFIED"|"VALIDATING"|"DECIDED"|"DELIVERED";
    language: string;
    raw_text: string | null;
    facts: any | null;
    initial_hypothesis: any | null;
    validation_questions: any | null;
    validation_answers: any | null;
    final_decision: any | null;
    guidance: any | null;
    created_at: string;
    updated_at: string;
    };