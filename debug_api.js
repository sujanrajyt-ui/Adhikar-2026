const http = require('http');
const fs = require('fs');

http.get('http://localhost:3000/api/public/leaderboard', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);

        console.log('=== AWARDS ===');
        json.awards.forEach(a => {
            console.log(a.id, '| name:', a.name, '| requires_role:', a.requires_role || 'NONE', '| requires_side:', a.requires_side || 'NONE');
        });

        console.log('\n=== DELEGATES (first 5) ===');
        json.leaderboard.slice(0, 5).forEach(d => {
            console.log(d.name, '| elected_role:', d.elected_role || 'EMPTY', '| side:', d.side || 'EMPTY', '| party:', d.party || 'EMPTY');
        });

        console.log('\n=== ALL ELECTED ROLES ===');
        const roles = json.leaderboard.map(d => d.elected_role).filter(Boolean);
        console.log('Delegates with roles:', roles.length, '/', json.leaderboard.length);
        roles.forEach(r => console.log(' -', r));
    });
}).on('error', (err) => console.log('Connection error:', err.message));
