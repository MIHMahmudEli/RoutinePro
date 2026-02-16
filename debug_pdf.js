const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('data/ramadan-class-time-2026.pdf');

pdf(dataBuffer).then(function (data) {
    console.log(data.text);
});
