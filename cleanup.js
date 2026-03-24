const fs = require('fs');

const files = ['admin.html', 'user.html'];

const replacements = {
    '#212447': 'var(--bg-card)',
    '#23265C': 'var(--bg-card)',
    '#242a51': 'var(--bg-card)',
    '#1e2a5e': 'var(--bg-card)',
    '#232356': 'var(--bg-card)',
    '#263075': 'var(--bg-card)',
    '#1a1f4d': 'var(--bg-dark)',
    '#181931': 'var(--bg-dark)',
    '#252e4f': 'var(--bg-card)',
    '#22aaf9': 'var(--primary)',
    '#ffe170': 'var(--text-main)',
    '#ffd357': 'var(--text-main)',
    '#afe7ff': 'var(--text-main)',
    '#22ff9b': 'var(--primary)',
    '#93baf8': 'var(--text-muted)',
    '#bacfff': 'var(--text-muted)',
    '#aad': 'var(--text-muted)',
    'border-left:3px solid #22ff9b': 'border-left:3px solid var(--primary)',
    'border:1.5px solid #ffd357': 'border:1px solid var(--border)',
    'border:2.5px solid #ffd357': 'border:2px solid var(--border)',
    'border:2px solid #ffd357': 'border:1px solid var(--border)',
    'border-bottom:2px solid rgba(255,213,87,0.3)': 'border-bottom:1px solid var(--border)',
    'background:#22aaf9': 'background:var(--primary)',
    'background:#ff4444': 'background:var(--danger)',
    'color:#ff4444': 'color:var(--danger)',
    'color:#ffb84d': 'color:var(--warning)',
    'color:#ff7d5a': 'color:var(--danger)',
    'color:#11c79c': 'color:var(--accent)',
    'color:#ff5722': 'color:var(--danger)',
    'color:#6fc6ff': 'color:var(--primary)',
    'font-family: \'Plus Jakarta Sans\', sans-serif': 'font-family: \'Inter\', sans-serif'
};

files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        for (const [oldStr, newStr] of Object.entries(replacements)) {
            content = content.split(oldStr).join(newStr);
        }
        // Change fonts to Inter
        content = content.replace(/Plus\+Jakarta\+Sans:wght@300;400;500;600;700/g, 'Inter:wght@300;400;500;600;700');
        fs.writeFileSync(file, content);
    }
});
