/**
 *
 * This is a review server that lets users mark images that were
 * generated during a catch-up pass for deletion (because it's
 * definitely not the case that every image is worth keeping!)
 *
 */

const http = require("http");
const path = require("path");
const fs = require("fs-extra");

/**
 * Generate the HTML for image selection
 */
function getImageFields(config, subreddits) {
  let uuid = 1;
  const fid = () => uuid++;
  const generate = (dir, subreddit) => {
    let files = fs.readdirSync(dir);

    let fieldsets = files.map((filename) => {
      return `
			<fieldset>
				<label>
					<input type="checkbox" name="img-${fid()}" value="${path.join(dir, filename)}">
					<img src="${`${dir}/${filename}`}" alt="${filename}">
				</label>
			</fieldset>
			`;
    });

    return `
			${
        subreddit
          ? `<h2><a href="https://reddit.com/r/${subreddit.r}">r/${subreddit.r}</a></h2>`
          : ``
      }
			${fieldsets.join("\n")}
		`;
  };

  if (!config.consolidate) {
    return subreddits.map((subreddit) =>
      generate(subreddit.filepath, subreddit)
    );
  }

  return generate(config.downloadPath);
}

/**
 * Delete any images not explicitly marked as "keep".
 */
function handlePOSTdata(req, whenDone) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    let query = decodeURIComponent(body);
    let files = query
      .split("&")
      .map((v) => v.split("=")[1])
      .filter((v) => v);
    files.forEach((filename) => {
      // something might have deleted a file while the server was running.
      try {
        fs.unlinkSync(filename);
      } catch (e) {}
    });
    whenDone();
  });
}

/**
 * A few simple static URL servicing functions.
 */
function getGenerator(url, imageHTML) {
  const pubdir = path.join(__dirname, "public");
  const generate = {
    "/": (res, configName, config) => {
      let file = path.join(pubdir, "index.html");
      fs.readFile(file, (err, data) => {
        res.setHeader("Content-Type", "text/html");
        data = data
          .toString("utf-8")
          .replace(`{{ images }}`, imageHTML)
          .replace(`{{ configName }}`, configName);
        res.end(data);
      });
    },
    "/index.js": (res, configName, config) => {
      let file = path.join(pubdir, "index.js");
      fs.readFile(file, (err, data) => {
        res.setHeader("Content-Type", "application/javascript");
        res.end(data);
      });
    },
    "/index.css": (res, configName, config) => {
      let file = path.join(pubdir, "index.css");
      fs.readFile(file, (err, data) => {
        res.setHeader("Content-Type", "text/css");
        res.end(data);
      });
    },
  };

  return generate[url];
}

/**
 * Run a super simple server that shows all downloaded
 * images and lets you pick which ones to keep.
 */
async function runServer(configName, config, subreddits, whenDone) {
  const imageHTML = getImageFields(config, subreddits);

  return new Promise(async (resolve) => {
    const server = http
      .createServer((req, res) => {
        if (req.method === "GET") {
          // known page
          let generator = getGenerator(req.url, imageHTML);
          if (generator) return generator(res, configName, config);

          // unknown page
          let file = path.join(__dirname, req.url);
          return fs.readFile(file, (err, data) => {
            res.setHeader("Content-type", `image/${path.extname(file)}`);
            res.end(data);
          });
        }

        if (req.method === "POST") {
          console.log(`Finalising received review...`);
          handlePOSTdata(req, () => {
            res.setHeader("Content-Type", "text/html");
            res.write(
              `<!doctype html><html><head><meta charset="utf-8"><title>review received</title></head><body><p>Review received, you can safely close this tab</p></body></html>`
            );
            res.end();

            server.close(whenDone);
            process.nextTick(() => {
              server.emit("close");
              resolve();
            });
          });
        }
      })
      .listen(0);

    console.log(
      `Starting review server on http://localhost:${server.address().port}`
    );

    const open = require("open");
    open(`http://localhost:${server.address().port}`);
  });
}

/**
 * Turn this into something that the catch-up script can call.
 */
module.exports = async function (configName, config, subreddits) {
  await runServer(configName, config, subreddits, config, subreddits, () =>
    console.log("Interaction complete: shutting down review server.")
  );
};
