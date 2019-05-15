/**
 *
 * Run this with "node catch-up" and that's basically all you need to know.
 *
 * See the README.md on how to actually configure the script, or just look
 * in package.json and change it in a way that you can assume will work.
 *
 */

// Some basic imports.
const http = require('http');
const https = require('https');
const path = require('path');

// fs-extra should really just be part of Node.js at this point.
const fs = require('fs-extra');

// Note that I will happily take any MR/PR that obviates the need for
// the following two imports, but I am absolutely not writing my own
// HTML and RSS parsers, because I've done enough of that and it's
// always a chore to get right because there are so many edge cases.
const { JSDOM }  = require("jsdom");
const Parser = require('rss-parser');
const parser = new Parser();

// Load the config for this run.
let configPath = "package.json";
let customConfig = process.argv.indexOf('-c');
if (customConfig > -1) configPath = path.join(__dirname, process.argv[customConfig+1]);
else if (fs.existsSync('./config.json')) configPath = path.join(__dirname, 'config.json');
else configPath = path.join(__dirname, 'package.json');
console.log(`Loading config from ${configPath}`);
const config = require(configPath).config;

// Make sure that unspecified values are set to sensible defaults:
config.downloadPath = config.downloadPath || "downloads";
config.exclude = config.exclude || [];
config.domains = config.domains || ["imgur.com", "i.redd.it"];

// Also make sure the main download directory exist:
fs.mkdirpSync(path.join(__dirname, config.downloadPath));

// parse the desired subreddits for catching up on
const subreddits = [];
Object.keys(config.subreddits).forEach(subreddit => {
    let e = {};
    e.base = subreddit;
    e.r = subreddit.split('/')[0];
    e.s = subreddit.split('/')[1];
    e.since = config.subreddits[subreddit];

    // If this configuration is not set to consolidate downloads,
    // ensure that each subreddit has a corresponding subdirectory
    // inside the download directory.
    if (!config.consolidate) {
        let dir = path.join(__dirname, config.downloadPath, e.r);
        if (e.s) dir = path.join(dir, e.s);
        e.filepath = dir;
        fs.mkdirpSync(e.filepath);
    }

    subreddits.push(e);
});

/**
 * A simple helper function for getting the filename
 * that an image URL should be saved to. This includes
 * stripping whatever URL query arguments might be tacked
 * on, because Node.js WILL see that as "the extension".
 */
function getFileName(url) {
    let p = url.lastIndexOf('/');
    let filename = url.substring(p+1);
    return filename;
}

/**
 * Download an image to disk, provided we (a) haven't already
 * done so (which might happen if you're consolidating downloads
 * and someone crossposted an image), and (b) the file extension
 * is not one of the excluded-for-download extensions.
 */
function downloadImage(url, dir) {
    // Don't download files we already have, or files
    // without an extention, or "bad" extension.
    const filename = getFileName(url).replace(/\?.*/,``);
    const ext = path.extname(filename);
    if (!ext || config.exclude.indexOf(ext) > -1) return false;
    const filepath = path.join(dir, filename);
    if (fs.existsSync(filepath)) return false;

    // otherwise, pick the correct protocol and download the image.
    let protocol = https;
    if (url.indexOf("https://") === -1) protocol = http;
    const imageFile = fs.createWriteStream(filepath);
    protocol.get(url, response => response.pipe(imageFile));

    // Note that we do not verify that the file-write succeeded.
    // As such, it is entirely possible that some images get
    // corrupted!

    return true;
}

/**
 * A simple function that verifies a url points to something
 * that we "know" is an image host.
 */
function imageDomain(href) {
    return config.domains.some(e => href.indexOf(`${e}/`) > -1);
}

/**
 * Run through a subreddit's RSS feed and keep downloading items until either:
 *
 *   1. there's nothing left to download, or
 *   2. we caught up to what we downloaded last time.
 */
async function catchUp(whenDone, subreddit, since, lastId) {
    console.log(`Catching up on ${subreddit.base}${lastId ? ` before ${lastId}`:``}`);

    // Get the RSS feed:
    let url = `https://www.reddit.com/r/${subreddit.base}.rss?limit=50`;
    if (lastId) url = `${url}&after=${lastId}`;
    let feed = await parser.parseURL(url);

    // If there's nothing to download, exit.
    if (feed.items.length === 0) {
        return whenDone(`Feed exhausted for ${subreddit.base}`);
    }

    console.log(`Feed response for ${url}: ${feed.items.length} items`);

    let downloads = 0;
    let dir = config.consolidate ? config.downloadPath : subreddit.filepath;
    feed.items.forEach(item => {
        // Skip any item that was covered by previous catch-up runs.
        let date = new Date(item.isoDate);
        let time = date.getTime();
        if (time < since) return;

        // Check the content for image links.
        let content = new JSDOM(item.content);
        let links = Array.from(content.window.document.querySelectorAll('a'));
        let imgLinks = links.filter(a => imageDomain(a.href));

        // Note that comment-only posts are obviously a thing, so we skip over them.
        if (!imgLinks.length) return;

        // If we get here, we should be able to download the image(s) for this post.
        imgLinks.forEach(img => {
            if (downloadImage(img.href, dir)) downloads++;
        });
    });

    console.log(`${downloads} images were downloaded to ${dir}`);

    // If the last image in the set is from before the last time we ran the catch-up
    // script, we can reasonably assume that everything from here on out will also
    // be from before we last ran catch-up, so we can "safely" stop.
    const last = feed.items.slice(-1)[0];
    const lastDate = new Date(last.isoDate);
    const lastTime = lastDate.getTime();
    if (lastTime < since) {
        return whenDone(`Caught up on ${subreddit.base}`);
    }

    // Otherwise, wait a few seconds and then try the next batch.
    lastId = last.id;
    const next = () => catchUp(whenDone, subreddit, since, lastId);
    const seconds = 3;
    const timeout = seconds * 1000;
    console.log(`Waiting ${seconds} seconds before trying the next batch...`);
    setTimeout(next, timeout);
}

/**
 * The updated to the "since" value for each subreddit means that whenever
 * a subreddit is done, we should write the updated config back to file.
 */
function writeConfig() {
    let filename = configPath;
    let json = JSON.stringify({ config }, false, 2);

    if (configPath.indexOf('package.json') > -1) {
        // If the config was loaded from package.json, things
        // are slightly more work, because we need to preserve
        // everything else in that file:
        filename = 'package.json';
        let package = require(`./${filename}`);
        package.config = config;
        json = JSON.stringify(package, false, 2);
    }

    return fs.writeFileSync(filename, json, "utf-8");
}

/**
 * Master function: run the catch-up process for all subreddits,
 * and update the configuration file (whichever that is) any time
 * a subreddit has been caught up on.
 *
 * Note that this function is invoked immediately upon declaration.
 */
(async function startCatchingUp() {
    await Promise.all(
        subreddits.map(subreddit => {
            return new Promise(resolve => {
                let whenDone = (msg) => {
                    console.log(msg);
                    config.subreddits[subreddit.base] = Date.now();
                    writeConfig();
                    resolve();
                };
                catchUp(whenDone, subreddit, subreddit.since);
            });
        })
    );
    console.log("\nYou're all caught up!");

    // If the script was invoked with -s then the user can
    // make a preselection of images worth keeping using a
    // very simple server running on http://localhost:8080
    if(process.argv.indexOf('-s') !== -1) {
        const runServer = require('./server.js');
        await runServer(config, subreddits);
    }

    // Stay-alive network connections can potentially
    // keep the script alive. We don't want that. So
    // rather than have Node "discover" it can exit,
    // force the process to exit.
    process.exit(0);
})();
