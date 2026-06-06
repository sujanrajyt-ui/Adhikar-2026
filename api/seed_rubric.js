const db = require('./db.js');

async function seed() {
    console.log("[Seeder] Starting Mock Parliament Rubric Seeding...");

    // 1. Define Criteria
    const criteria = [
        { id: 'crit_research', name: 'Content & Research', max_points: 25, description: 'Accuracy of facts, policy understanding, preparation depth' },
        { id: 'crit_comm', name: 'Communication & Oratory', max_points: 20, description: 'Clarity, confidence, articulation, language proficiency' },
        { id: 'crit_rebuttal', name: 'Rebuttal & Critical Thinking', max_points: 20, description: 'Ability to respond, counter arguments, think on feet' },
        { id: 'crit_lead', name: 'Leadership & Collaboration', max_points: 15, description: 'Team coordination, initiative, party strategy' },
        { id: 'crit_innov', name: 'Innovation & Problem Solving', max_points: 10, description: 'Original ideas, creative solutions, legislative thinking' },
        { id: 'crit_conduct', name: 'Parliamentary Conduct', max_points: 10, description: 'Decorum, adherence to rules, professionalism' }
    ];

    // 2. Define Awards with Formulas (Weights)
    const awards = [
        {
            name: 'Best Student Speaker',
            criteria_ids: [
                { id: 'crit_comm', weight: 0.30 },
                { id: 'crit_research', weight: 0.25 },
                { id: 'crit_rebuttal', weight: 0.20 },
                { id: 'crit_lead', weight: 0.15 },
                { id: 'crit_conduct', weight: 0.10 }
            ]
        },
        {
            name: 'Exceptional Debater',
            criteria_ids: [
                { id: 'crit_rebuttal', weight: 0.40 },
                { id: 'crit_comm', weight: 0.25 },
                { id: 'crit_research', weight: 0.20 },
                { id: 'crit_conduct', weight: 0.10 },
                { id: 'crit_lead', weight: 0.05 }
            ]
        },
        {
            name: 'Asset of the Ruling Government',
            criteria_ids: [
                { id: 'crit_research', weight: 0.35 },
                { id: 'crit_rebuttal', weight: 0.25 },
                { id: 'crit_lead', weight: 0.20 },
                { id: 'crit_comm', weight: 0.15 },
                { id: 'crit_conduct', weight: 0.05 }
            ]
        },
        {
            name: 'Asset of the Opposition',
            criteria_ids: [
                { id: 'crit_rebuttal', weight: 0.35 },
                { id: 'crit_research', weight: 0.30 },
                { id: 'crit_comm', weight: 0.20 },
                { id: 'crit_lead', weight: 0.10 },
                { id: 'crit_conduct', weight: 0.05 }
            ]
        },
        {
            name: 'Best Leader of the House',
            criteria_ids: [
                { id: 'crit_lead', weight: 0.40 },
                { id: 'crit_comm', weight: 0.20 },
                { id: 'crit_research', weight: 0.20 },
                { id: 'crit_rebuttal', weight: 0.10 },
                { id: 'crit_conduct', weight: 0.10 }
            ]
        },
        {
            name: 'Best Minister',
            criteria_ids: [
                { id: 'crit_research', weight: 0.45 },
                { id: 'crit_comm', weight: 0.20 },
                { id: 'crit_lead', weight: 0.15 },
                { id: 'crit_rebuttal', weight: 0.10 },
                { id: 'crit_conduct', weight: 0.10 }
            ]
        },
        {
            name: 'Most Creative Mind',
            criteria_ids: [
                { id: 'crit_innov', weight: 0.40 },
                { id: 'crit_research', weight: 0.25 },
                { id: 'crit_comm', weight: 0.15 },
                { id: 'crit_lead', weight: 0.10 },
                { id: 'crit_rebuttal', weight: 0.10 }
            ]
        },
        {
            name: 'Best Orator',
            criteria_ids: [
                { id: 'crit_comm', weight: 0.50 },
                { id: 'crit_research', weight: 0.20 },
                { id: 'crit_conduct', weight: 0.15 },
                { id: 'crit_lead', weight: 0.10 },
                { id: 'crit_rebuttal', weight: 0.05 }
            ]
        },
        {
            name: 'Distinguished Policy Advocate',
            criteria_ids: [
                { id: 'crit_research', weight: 0.50 },
                { id: 'crit_comm', weight: 0.20 },
                { id: 'crit_innov', weight: 0.15 },
                { id: 'crit_rebuttal', weight: 0.10 },
                { id: 'crit_conduct', weight: 0.05 }
            ]
        },
        {
            name: 'Most Impactful Presence',
            criteria_ids: [
                { id: 'crit_comm', weight: 0.35 },
                { id: 'crit_lead', weight: 0.25 },
                { id: 'crit_rebuttal', weight: 0.20 },
                { id: 'crit_conduct', weight: 0.10 },
                { id: 'crit_research', weight: 0.10 }
            ]
        }
    ];

    try {
        // Clear old data (if you want to strictly enforce the new rubric)
        // Note: We'll use the internal file/table logic if possible, 
        // but db.js doesn't have a "clearAll" method. 
        // We'll just create them one by one.

        // 3. Insert Criteria
        for (const c of criteria) {
            // In db.js, we might need to modify it to support custom IDs 
            // or we just trust the seeder to avoid duplicates.
            // Usually database id is autogenerated, but for seeder we might want specific ones.
            console.log(`[Seeder] Creating criterion: ${c.name}`);
            // Hack: db.js createCriteria generates a random ID. 
            // I'll update db.js to accept an optional ID for seeding purposes.
            await db.createCriteria(c);
        }

        // 4. Insert Awards
        for (const a of awards) {
            console.log(`[Seeder] Creating award: ${a.name}`);
            await db.createAward(a);
        }

        console.log("[Seeder] Full Rubric and Awards Seeding Completed!");
    } catch (err) {
        console.error("[Seeder] Error during seeding:", err);
    }
}

seed();
