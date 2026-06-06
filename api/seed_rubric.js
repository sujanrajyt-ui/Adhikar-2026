const db = require('./db.js');

async function seed() {
    console.log("[Seeder] Starting Mock Parliament Rubric and Data Seeding...");

    // 0. Define Default Admin/Judge
    const judges = [
        { id: 'judge1', password: 'password123', created_at: new Date().toISOString() }
    ];

    // 1. Define Criteria
    const criteria = [
        { id: 'crit_research', name: 'Content & Research', max_points: 25, description: 'Accuracy of facts, policy understanding, preparation depth' },
        { id: 'crit_comm', name: 'Communication & Oratory', max_points: 20, description: 'Clarity, confidence, articulation, language proficiency' },
        { id: 'crit_rebuttal', name: 'Rebuttal & Critical Thinking', max_points: 20, description: 'Ability to respond, counter arguments, think on feet' },
        { id: 'crit_lead', name: 'Leadership & Collaboration', max_points: 15, description: 'Team coordination, initiative, party strategy' },
        { id: 'crit_innov', name: 'Innovation & Problem Solving', max_points: 10, description: 'Original ideas, creative solutions, legislative thinking' },
        { id: 'crit_conduct', name: 'Parliamentary Conduct', max_points: 10, description: 'Decorum, adherence to rules, professionalism' }
    ];

    // 2. Define Awards
    const awards = [
        { name: 'Best Student Speaker', requires_role: 'Speaker, Deputy Speaker, Secretary General, Marshal', criteria_ids: [{ id: 'crit_comm', weight: 0.3 }, { id: 'crit_research', weight: 0.25 }, { id: 'crit_rebuttal', weight: 0.2 }, { id: 'crit_lead', weight: 0.15 }, { id: 'crit_conduct', weight: 0.1 }] },
        { name: 'Exceptional Debater', criteria_ids: [{ id: 'crit_rebuttal', weight: 0.4 }, { id: 'crit_comm', weight: 0.25 }, { id: 'crit_research', weight: 0.2 }, { id: 'crit_conduct', weight: 0.1 }, { id: 'crit_lead', weight: 0.05 }] },
        { name: 'Asset of the Ruling Government', requires_side: 'ruling', requires_role: 'Prime Minister, Deputy Prime Minister, Minister', criteria_ids: [{ id: 'crit_research', weight: 0.35 }, { id: 'crit_rebuttal', weight: 0.25 }, { id: 'crit_lead', weight: 0.2 }, { id: 'crit_comm', weight: 0.15 }, { id: 'crit_conduct', weight: 0.05 }] },
        { name: 'Asset of the Opposition', requires_side: 'opposition', requires_role: 'Leader of Opposition, Deputy Leader of Opposition, Whip', criteria_ids: [{ id: 'crit_rebuttal', weight: 0.35 }, { id: 'crit_research', weight: 0.3 }, { id: 'crit_comm', weight: 0.2 }, { id: 'crit_lead', weight: 0.1 }, { id: 'crit_conduct', weight: 0.05 }] }
    ];

    // 3. Define Mock Delegates (Verified)
    const delegates = [
        { name: 'Aarav Sharma', email: 'aarav@example.com', phone: '9876543210', year: '3rd Year', college: 'NLSIU', assigned_party: 'Indian National Congress', assigned_committee: 'Lok Sabha', elected_role: 'Prime Minister', status: 'verified' },
        { name: 'Isha Patel', email: 'isha@example.com', phone: '9876543211', year: '2nd Year', college: 'NALSAR', assigned_party: 'Bharatiya Janata Party', assigned_committee: 'Lok Sabha', elected_role: 'Leader of Opposition', status: 'verified' },
        { name: 'Rohan Gupta', email: 'rohan@example.com', phone: '9876543212', year: '4th Year', college: 'GNLU', assigned_party: 'Indian National Congress', assigned_committee: 'Lok Sabha', elected_role: 'Speaker', status: 'verified' },
        { name: 'Ananya Iyer', email: 'ananya@example.com', phone: '9876543213', year: '1st Year', college: 'NLU Jodhpur', assigned_party: 'Bharatiya Janata Party', assigned_committee: 'Lok Sabha', elected_role: 'Whip', status: 'verified' }
    ];

    try {
        console.log("[Seeder] Seeding Judges...");
        for (const j of judges) await db.createJudge(j);

        console.log("[Seeder] Seeding Criteria...");
        for (const c of criteria) await db.createCriteria(c);

        console.log("[Seeder] Seeding Awards...");
        for (const a of awards) await db.createAward(a);

        console.log("[Seeder] Seeding Delegates...");
        for (const d of delegates) {
            const reg = await db.create(d);
            await db.update(reg.id, { status: 'verified', assigned_party: d.assigned_party, assigned_committee: d.assigned_committee, elected_role: d.elected_role });
        }

        console.log("[Seeder] Seeding Completed Successfully!");
    } catch (err) {
        console.error("[Seeder] Error during seeding:", err);
    }
}

seed();

seed();
