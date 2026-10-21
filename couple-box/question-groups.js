// One active question per overlapping conversation theme. Old IDs/text stay readable.
export const QUESTION_GROUPS={
 q01:['q112'],
 q08:['q03'],
 q07:['q31','q36','q120'],
 q10:['q12','q13','q14','q16','q17','q35','q86'],
 q11:['q85'],
 q19:['q53'],
 q20:['q21','q24','q26'],
 q22:['q63'],
 q25:['q33'],
 q27:['q60'],
 q28:['q29'],
 q37:['q23','q38','q45'],
 q40:['q68','q98'],
 q48:['q43'],
 q46:['q50','q51','q54'],
 q49:['q52'],
 q56:['q59'],
 q110:['q62'],
 q64:['q72'],
 q66:['q42'],
 q69:['q88','q100'],
 q106:['q71'],
 q95:['q84','q105'],
 q102:['q94','q113','q114'],
 q119:['q90','q116'],
 q118:['q99'],
 q75:['q83'],
 q77:['q81']
};
// These were removed to reduce intimate questioning, not relabeled as duplicates.
export const EXCLUDED_QUESTIONS=['q76'];
export const INTIMACY_GAP_DAYS=10;
export const INTIMACY_HISTORY=['q74','q75','q76','q77','q78','q79','q80','q81','q82','q83'];
export const canonicalQuestion=id=>Object.entries(QUESTION_GROUPS).find(([,aliases])=>aliases.includes(id))?.[0]||id;
