const express = require('express');
const path = require('path');

const app = express();

const PORT = 3000;

// Retrieve Dir name


app.use(express.static('public'));
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
})

app.listen(PORT, () => {
    console.log("Web server started on port ", PORT);
})
