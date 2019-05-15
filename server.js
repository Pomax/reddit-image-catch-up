/**
 *
 * This is a review server that lets users mark images that were
 * generated during a catch-up pass for deletion (because it's
 * definitely not the case that every image is worth keeping!)
 *
 */

const http = require('http');
const path = require('path');
const fs = require('fs-extra');

/**
 * Generate the HTML for image selection
 */
function getImageFields(config, subreddits) {
    let uuid = 1;
    const fid = () => uuid++;
    const generate = dir => {
        let files = fs.readdirSync(dir);
        return files.map(filename => {
            return `
            <fieldset>
                <label>
                    <input type="checkbox" name="img-${ fid() }" value="${ path.join(dir, filename) }">
                    <img src="${ `${dir}/${filename}` }" alt="${filename}">
                </label>
            </fieldset>
            `;
        });
    };

    if (!config.consolidate) {
        return subreddits.map(subreddit => generate(subreddit.filepath, subreddit));
    }

    return generate(config.downloadPath);
}

/**
 * Generate the curation page HTML
 */
function generatePage(config, subreddits) {
    return `
<!doctype html>
<html>
    <head>
        <meta charset="utf-8">
        <title>Reddit image catch-up</title>
        <style>
            :root { --green: #8ee984; }
            fieldset { border: none; display: inline-block; }
            input[type=checkbox] { display: none; }
            img { border: 3px solid transparent; width: auto; height: 300px; }
            input[type=checkbox]:checked + img { border-color: red; }
            button {
                display: block;
                width: 80%;
                margin: auto;
                height: 2em;
                border-radius: 10px;
                font-family: Arial;
                font-size: 4em;
                background: var(--green);
            }
            #all, #none {
                display: inline-block;
                border: 1px solid black;
                background: var(--green);
                cursor: pointer;
                padding: 10px;
                border-radius: 5px;
                font-family: Arial;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <h1>Reddit image catch-up curation</h1>
        <p>Unselect any image you want to keep, and then hit the "Done" button</p>
        <p><span id="none">Unselect all images</span> <span id="all">Select all images</span></p>
        <form action="." method="POST">
            ${ getImageFields(config, subreddits).join('\n') }
            <button id='done'>Done</button>
        </form>
        <script>
            const fngen = (retval) => {
                return () => {
                    document.querySelectorAll('input[type=checkbox]').forEach(e => {
                        e.checked = retval;
                    });
                };
            };
            document.querySelector('#none').addEventListener('click', fngen(false));
            document.querySelector('#all').addEventListener('click', fngen(true));
            document.querySelector('#all').click();
        </script>
    </body>
</html>`;
}

/**
 * Delete any images not explicitly marked as "keep".
 */
function handlePOSTdata(req, whenDone) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', async() => {
        let query = decodeURIComponent(body);
        let files = query.split('&').map(v => v.split('=')[1]).filter(v => v);
        files.forEach(filename => fs.unlinkSync(filename));
        whenDone();
    });
}

/**
 * Run a super simple server that shows all downloaded
 * images and lets you pick which ones to keep.
 */
async function runServer(config, subreddits, whenDone) {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            if (req.method === 'GET') {
                if (req.url !== '/') {
                    let file = path.join(__dirname, req.url);
                    return fs.readFile(file, (err, data) => {
                        res.setHeader('Content-type', `image/${path.extname(file)}`);
                        res.end(data);
                    });
                }

                // show a listing of all downloaded images.
                res.setHeader("Content-Type", "text/html");
                res.write(generatePage(config, subreddits));
                res.end(); //end the response
            }

            if (req.method === 'POST') {
                handlePOSTdata(req, () => {
                    res.setHeader("Content-Type", "application/json");
                    res.write(JSON.stringify({ done: true }));
                    res.end();

                    server.close(whenDone);
                    process.nextTick(() => {
                        server.emit('close');
                        resolve();
                    });
                });
            }
        }).listen(8080); //the server object listens on port 8080
    });
}

/**
 * Turn this into something that the catch-up script can call.
 */
module.exports = async function(config, subreddits) {
    console.log("Starting review server on http://localhost:8080");
    await runServer(config, subreddits, config, subreddits, () => console.log("Interaction complete: shutting down review server."));
};
