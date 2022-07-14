const par = 72;

const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const http = require("https");

//const Entry = require('./models/entry');
const app = express();
app.listen(process.env.PORT || 3000, () => console.log('listening at port 3000'));
app.use(express.static('public'));

//const dbURI = 'mongodb+srv://nshurtleff:Bakermayfield1!@golfcluster.nyfxg.mongodb.net/golf-entries?retryWrites=true&w=majority';
//mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    //.then((result) => console.log('connected to db'))
    //.catch((err) => console.log(err));

app.get('/data', async function (req, res) {
    //let leaders = await scrape('https://www.espn.com/golf/leaderboard/_/tournamentId/401243418');
    let leaders = await getLeaders();
    //console.log(leaders);
    let entries = await getEntries(leaders);
    let data = [leaders[0], entries];
    res.send(data);
});

app.get('/test', async function (req, res) {
    let leaders = await getLeaders();
    //console.log(leaders);
    res.send(leaders);
});

function getLeaders() {
    return new Promise((resolve, reject) => {
        const options = {
            "method": "GET",
            "hostname": "golf-leaderboard-data.p.rapidapi.com",
            "port": null,
            "path": "/leaderboard/402",
            "headers": {
                "x-rapidapi-key": "21ce5dac67msh86911ecea6ef3cfp13b4f3jsn734afe0aa2df",
                "x-rapidapi-host": "golf-leaderboard-data.p.rapidapi.com",
                "useQueryString": true
            }
        };

        const req = http.request(options, function (res) {
            const chunks = [];
            let leaders = [];
            res.on("data", function (chunk) {
                chunks.push(chunk);
            });

            res.on("end", function () {
                const body = Buffer.concat(chunks);
                let jsonRes = JSON.parse(body);
                jsonRes.results.leaderboard.forEach(leader => {
                    let name = leader.first_name + ' ' + leader.last_name;
                    let round1 = leader.rounds[0].strokes;
                    let round2 = '--';
                    if (typeof leader.rounds[1] !== 'undefined') {
                        round2 = leader.rounds[1].strokes;
                    }

                    let thru = '--';
                    if (leader.holes_played != 0) {
                        thru = leader.holes_played;
                    }
                    if (leader.holes_played == 18) {
                        thru = 'F';
                    }

                    leaders.push({
                        "Place" : leader.position,
                        "Golfer" : name,
                        "Score" : leader.total_to_par,
                        "Status" : leader.status,
                        "Thru" : thru,
                        "R1" : round1,
                        "R2" : round2,
                        "R3" : '--',
                        "R4" : '--'
                    });
                });
                resolve(leaders);
            });      
        });

        req.end();
    });
}

async function getEntries(leaders) {
    let entrants = [];
    let tier1golfers = [];
    let tier2golfers = [];
    let tier3golfers = [];
    let tier4golfers = [];
    let tiebreakers = [];

    const creds = require('./config/astral-sorter-109303-a21075769e0e.json');
    const doc = new GoogleSpreadsheet('1SuX8VJ-3h1slamRO0EpRxaTWkGmrOY9V6hXW5z4U6xg');
    await doc.useServiceAccountAuth(creds);   
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    let numOfEntrants = sheet.rowCount - 1;
    console.log(numOfEntrants);
    for (var i = 0; i < numOfEntrants; i++) {
        entrants.push(rows[i].Name);
        tier1golfers.push(rows[i].Tier1);
        tier2golfers.push(rows[i].Tier2);
        tier3golfers.push(rows[i].Tier3);
        tier4golfers.push(rows[i].Tier4);
        tiebreakers.push(rows[i].Tiebreaker);
    }

    let allGolfers = [tier1golfers, tier2golfers, tier3golfers, tier4golfers];

    let entries = {
        entry: []
    };

    for (var k = 0; k < numOfEntrants; k++) {
        let golfers_scores = [];
        for (var j = 0; j < 4; j++) {
            let found = false;
            leaders.forEach(leader => {
                console.log('fetched guy: ' + leader.Golfer);
                if (allGolfers[j][k].localeCompare(leader.Golfer) == 0) {
                    let golfer_scores = {golfer:leader.Golfer, score:leader.Score, place:leader.Place, status:leader.Status, thru:leader.Thru, round1:leader.R1, round2:leader.R2, round3:leader.R3, round4:leader.R4};
                    golfers_scores.push(golfer_scores);
                    found = true;
                }
                if (allGolfers[j][k] == 'J. J. Spaun') {
                    var lastName1 = allGolfers[j][k].substring(allGolfers[j][k].indexOf('S'), allGolfers[j][k].length);
                    var lastName2 = leader.Golfer.substring(leader.Golfer.indexOf('S'), leader.Golfer.length);
                    if (lastName1.localeCompare(lastName2) == 0) {
                        let golfer_scores = {golfer:leader.Golfer, score:leader.Score, place:leader.Place, status:leader.Status, thru:leader.Thru, round1:leader.R1, round2:leader.R2, round3:leader.R3, round4:leader.R4};
                        golfers_scores.push(golfer_scores);
                        found = true;
                    }
                }
            });
            if (!found) {
                console.log('Invalid Guy: ' + allGolfers[j][k]);
                let golfer_scores = {golfer:"Invalid Name", score:0, place:0, status:"Invalid", thru:0, round1:0, round2:0, round3:0, round4:0};
                golfers_scores.push(golfer_scores);
            }
        }

        for (var x = 0; x < 4; x++) {
            if (golfers_scores[x].status != 'cut' && golfers_scores[x].status != 'wd' && golfers_scores[x].status != 'dq') {
                golfers_scores[x].score = (golfers_scores[x].score > 0) ? '+' + golfers_scores[x].score : golfers_scores[x].score;
            }
            if (golfers_scores[x].status == 'cut') {
                let score  = (golfers_scores[x].round1 - par) + (golfers_scores[x].round2 - par);

                score += (80 - par) * 2;
                golfers_scores[x].score = (score > 0) ? '+' + score : score;
                golfers_scores[x].thru = 'c';
            }
            if (golfers_scores[x].status == 'wd' || golfers_scores[x].status == 'dq') {
                //let score  = (golfers_scores[x].round1 == '--') ? 80 - par : golfers_scores[x].round1;
                //score += (golfers_scores[x].round2 == '--') ? 80 - par : golfers_scores[x].round2;
                //score += (golfers_scores[x].round3 == '--') ? 80 - par : golfers_scores[x].round3;
                //score += 80 - par;
                golfers_scores[x].score = '+30';
                golfers_scores[x].thru = 'wd';
            }
        }

        let worstScore = Math.max(parseInt(golfers_scores[0].score) || 0, parseInt(golfers_scores[1].score) || 0, parseInt(golfers_scores[2].score) || 0, parseInt(golfers_scores[3].score) || 0);
        let total = (parseInt(golfers_scores[0].score) || 0) + (parseInt(golfers_scores[1].score) || 0) + (parseInt(golfers_scores[2].score) || 0) + (parseInt(golfers_scores[3].score) || 0) - worstScore;
        let t_diff = Math.abs(leaders[0].Score - tiebreakers[k]);

        entries.entry.push({
            entrant: entrants[k],
            tier1golfer: golfers_scores[0],
            tier2golfer: golfers_scores[1],
            tier3golfer: golfers_scores[2],
            tier4golfer: golfers_scores[3],
            totalScore: total,
            tiebreaker: tiebreakers[k],
            tiebreaker_diff: t_diff
        });
    }
    
    entries.entry.sort((a, b) => (a.totalScore < b.totalScore) ? 1 : ((a.totalScore == b.totalScore) ? ((a.tiebreaker_diff < b.tiebreaker_diff) ? 1 : -1) : -1));

    return entries;
}

async function scrape(url) {
    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox','--disable-setuid-sandbox']});
    const page = await browser.newPage();
    await page.goto(url);

    let xpaths = ['/html/body/div[1]/div/div/div/div[4]/div[3]/div/div[1]/section[2]/div/div/div/div[2]/div[3]/div/div/div/div[2]/table/tbody/tr[$]/td[2]/a',
                    '/html/body/div[1]/div/div/div/div[4]/div[3]/div/div[1]/section[2]/div/div/div/div[2]/div[3]/div/div/div/div[2]/table/tbody/tr[$]/td[3]',
                    '/html/body/div[1]/div/div/div/div[4]/div[3]/div/div[1]/section[2]/div/div/div/div[2]/div[3]/div/div/div/div[2]/table/tbody/tr[$]/td[1]',
                    '/html/body/div[1]/div/div/div/div[4]/div[3]/div/div[1]/section[2]/div/div/div/div[2]/div[3]/div/div/div/div[2]/table/tbody/tr[$]/td[4]',
                    '/html/body/div[1]/div/div/div/div[4]/div[3]/div/div[1]/section[2]/div/div/div/div[2]/div[3]/div/div/div/div[2]/table/tbody/tr[$]/td[5]'];
                    //'/html/body/div[1]/div/div/div/div[4]/div[3]/div/div[1]/section[2]/div/div/div/div[2]/div[3]/div/div/div/div[2]/table/tbody/tr[$]/td[6]',
                    //'/html/body/div[1]/div/div/div/div[4]/div[3]/div/div[1]/section[2]/div/div/div/div[2]/div[3]/div/div/div/div[2]/table/tbody/tr[$]/td[7]'];

    let leaders = {
        leaderboard: []
    };

    for (var i = 1; i <= 156; i++) {
        for (var x = 0; x < 5; x++) {
            xpaths[x] = xpaths[x].replace("$", i);
        }

        const [el] = await page.$x(xpaths[0]);
        const name = await el.getProperty('textContent');
        const rawName = await name.jsonValue();

        const [el2] = await page.$x(xpaths[1]);
        const total = await el2.getProperty('textContent');
        const rawTotal = await total.jsonValue();

        const [el3] = await page.$x(xpaths[2]);
        const place = await el3.getProperty('textContent');
        const rawPlace = await place.jsonValue();

        const [el4] = await page.$x(xpaths[3]);
        const r1 = await el4.getProperty('textContent');
        const round1 = await r1.jsonValue();

        const [el5] = await page.$x(xpaths[4]);
        const r2 = await el5.getProperty('textContent');
        const round2 = await r2.jsonValue();

        /*const [el6] = await page.$x(xpaths[5]);
        const r3 = await el6.getProperty('textContent');
        const round3 = await r3.jsonValue();

        const [el7] = await page.$x(xpaths[6]);
        const r4 = await el7.getProperty('textContent');
        const round4 = await r4.jsonValue();*/

        leaders.leaderboard.push({
            "Place" : rawPlace,
            "Golfer" : rawName,
            "Score" : rawTotal,
            "R1" : round1,
            "R2" : round2,
            "R3" : '--',
            "R4" : '--'
        });

        for (var x = 0; x < 5; x++) {
            xpaths[x] = xpaths[x].replace("tbody/tr[" + i + "]", "tbody/tr[$]");
        }
    }
    browser.close();

    return leaders;
}