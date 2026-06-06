async function debug() {
    try {
        const res = await fetch('http://localhost:3000/api/public/leaderboard');
        const data = await res.json();
        console.log("--- LEADERBOARD DATA PREVIEW ---");
        console.log("Delegates Count:", data.leaderboard.length);
        console.log("Awards Count:", data.awards.length);

        console.log("\n--- DELEGATE ROLES CHECK ---");
        data.leaderboard.forEach(d => {
            console.log(`Name: ${d.name} | Role: "${d.elected_role}" | Side: "${d.side}"`);
        });

        console.log("\n--- AWARD CONFIG CHECK ---");
        data.awards.forEach(a => {
            console.log(`Award: ${a.name} | Requires Role: "${a.requires_role}" | Requires Side: "${a.requires_side}"`);
        });
    } catch (e) {
        console.error("Debug failed:", e.message);
    }
}

debug();
