const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const port = 3000;

// Enable CORS for all routes
app.use(cors());

// Set MIME type for .mjs files
app.use((req, res, next) => {
    if (req.path.endsWith('.mjs')) {
        res.type('application/javascript');
    }
    next();
});

// Serve static files from the current directory
app.use(express.static(__dirname));

// Handle all routes by serving index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Galaxy demo running at http://localhost:${port}`);
});
