import { extractFacts } from "@/domain/services/extract-facts";
import { classifyVisa } from "@/domain/services/classify-visa";
import { generateValidationQuestions } from "@/domain/services/generate-questions";
import { finalizeDecision } from "@/domain/services/finalize-decision";


export const Pipeline = {
extractFacts,
classifyVisa,
generateValidationQuestions,
finalizeDecision,
};