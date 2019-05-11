/**
 *
 * Run this with "node catch-up" and that's basically all you need to know.
 *
 * See the README.md on how to actually configure the script, or just look
 * in package.json and change it in a way that you can assume will work.
 *
  */

const http = require('http');
const https = require('https');
const fs = require('fs-extra');
const path = require('path');
const { JSDOM }  = require("jsdom");
const Parser = require('rss-parser');
const parser = new Parser();

// load the config for this run
let configPath = "package.json";
let customConfig = process.argv.indexOf('-c');
if (customConfig > -1) configPath = path.join(__dirname, process.argv[customConfig+1]);
else if (fs.existsSync('./config.json')) configPath = path.join(__dirname, 'config.json');
else configPath = path.join(__dirname, 'package.json');
console.log(`Loading config from ${configPath}`);
const config = require(configPath).config;
config.downloadPath = config.downloadPath || "downloads";
config.exclude = config.exclude || [];

// ensure the download directories exist:
fs.mkdirpSync(path.join(__dirname, config.downloadPath));

// parse the desired subreddits for catching up on
const subreddits = [];
Object.keys(config.subreddits).forEach(subreddit => {
    let e = {};
    e.base = subreddit;
    e.r = subreddit.split('/')[0];
    e.s = subreddit.split('/')[1];

    let dir = path.join(__dirname, config.downloadPath, e.r);
    if (e.s) dir = path.join(dir, e.s);
    e.filepath = dir;
    e.since = config.subreddits[subreddit];

    fs.mkdirpSync(e.filepath);
    subreddits.push(e);
});

// ...docs go here...
function getFileName(url) {
    let p = url.lastIndexOf('/');
    let filename = url.substring(p+1);
    return filename;
}

// ...docs go here...
function downloadImage(url, dir) {
    // Don't download files we already have, or files
    // without an extention, or "bad" extension.
    const filename = getFileName(url);
    const ext = path.extname(filename);
    if (!ext || config.exclude.indexOf(ext) > -1) return false;
    const filepath = path.join(dir, filename);
    if (fs.existsSync(filepath)) return false;

    // otherwise, pick the correct protocol and download the image.
    let protocol = https;
    if (url.indexOf("https://") === -1) protocol = http;
    protocol.get(url, r => r.pipe(fs.createWriteStream(filepath)));
    return true;
}

// ...docs go here...
function imageDomain(href) {
    if (href.indexOf("imgur.com/") > -1) return true;
    if (href.indexOf("i.redd.it/") > -1) return true;
    return false;
}

// ...docs go here...
async function catchUp(subreddit, since, lastId) {
    console.log(`Catching up on ${subreddit.base}${lastId ? ` before ${lastId}`:``}`);
    let url = `https://www.reddit.com/r/${subreddit.base}.rss?limit=50`;
    if (lastId) url = `${url}&after=${lastId}`;

    let feed = await parser.parseURL(url);
    console.log(`Feed response for ${url}: ${feed.items.length} items`);
    let downloads = 0;

    feed.items.forEach(item => {
        let content = new JSDOM(item.content);
        let links = Array.from(content.window.document.querySelectorAll('a'));
        let imgLinks = links.filter(a => imageDomain(a.href));
        if (imgLinks.length > 1) {
            console.log("more than one image?", content.serialize());
        }
        let img = imgLinks[0];
        // comment-only posts do exist, so we skip over them.
        if (!img) return;
        let href = img.href;
        if (downloadImage(href, subreddit.filepath)) downloads++;
    });

    console.log(`${downloads} images were downloaded to ${subreddit.filepath}`);

    // Stop catch-up if:
    //   1. there's nothing left to download, or
    //   2. we caught up to what we downloaded last time
    if (feed.items.length === 0) { return console.log(`Feed exhausted for ${subreddit.base}`); }

    const last = feed.items.slice(-1)[0];
    const lastDate = new Date(last.isoDate);
    const lastTime = lastDate.getTime();
    if (lastTime < since) { return console.log(`Caught up on ${subreddit.base}`); }

    // Otherwise, wait a few seconds and try the next batch
    lastId = last.id;
    const next = () => catchUp(subreddit, since, lastId);
    const seconds = 3;
    const timeout = seconds * 1000;
    console.log(`Waiting ${seconds} seconds before trying the next batch...`);
    setTimeout(next, timeout);
}

// ...docs go here...
function writeConfig() {
    if (configPath.indexOf('package.json') === -1) {
        const json = JSON.stringify({ config }, false, 2);
        return fs.writeFileSync(configPath, json, "utf-8");
    }

    // slighlty more work when writing back to package.json
    const package = require('./package.json');
    package.config = config;
    const json = JSON.stringify(package, false, 2);
    return fs.writeFileSync('package.json', json, "utf-8");
}

// ...docs go here...
function startCatchingUp() {
    subreddits.forEach(subreddit => {
        catchUp(subreddit, subreddit.since);
        config.subreddits[subreddit.base] = Date.now();
    });
    writeConfig();
}

// And finally... run
startCatchingUp();
