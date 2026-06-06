const http = require('http');

http.get('http://localhost:3000/api/public/leaderboard', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log("Awards Sample:", JSON.stringify(json.awards[0], null, 2));
            console.log("Minister Award:", JSON.stringify(json.awards.find(a => a.id === 'awd_minister'), null, 2));
            console.log("First Delegate Sample:", JSON.stringify(json.leaderboard[0], null, 2));
        } catch (e) {
            console.log("Fetch failed or invalid JSON:", e.message);
            console.log("Raw snapshot:", data.substring(0, 100));
        }
    });
}).on('error', (err) => {
    console.log("Error connecting to server:", err.message);
});
