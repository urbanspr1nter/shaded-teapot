const fs = require('fs');
const express = require('express');
const app = express();

app.use(express.static('./'));

app.listen(3000, () => {
    console.log('Web Server for Teapot');
});

app.get('/', (req, res) => {
    res.redirect('app.html');
});

app.get('/assets/teapot_0.obj', (req, res) => {
    const data = getObject('./assets/teapot_0.obj');

    if (data.err) {
        res.status(400).send(data.message);
    }

    res.status(200).contentType('text/plain').send(data);
});

function getObject(path) {
    try {
        const data = fs.readFileSync(path, 'utf8');

        return data;
    } catch (e) {
        console.log(e);

        return {err: 'bad_request', message: 'Could not read file.'};
    }
}