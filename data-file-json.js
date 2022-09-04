const exists = require("fs").existsSync;
const fs = require("fs/promises");
const tableName = `imagedata`;

class DataFile {
  constructor(name = tableName) {
    this.dbname = `./${name}.db`;
    this.db = { records: [] };
  }

  async ready() {
    if (!exists(this.dbname)) {
      await fs.writeFile(this.dbname, `{ "records": [] }`, `utf-8`);
    }
    const data = (await fs.readFile(this.dbname)).toString(`utf-8`);
    this.db = JSON.parse(data);
  }

  async save(title = ``, filepath, url) {
    if (!filepath || !url) {
      throw new Error(
        `could not save record:\n\ttitle=${title}\n\tfilepath=${filepath}\n\turl=${url}`
      );
    }

    this.db.records.push({ title, filepath, url });
  }

  async get(where) {
    const pairs = Object.entries(where);

    let result = this.db.records;
    for (const [key, value] of pairs) {
      result = result.filter((v) => v[key] === value);
    }

    return result[0];
  }

  async getAll() {
    return this.db.records.slice();
  }

  async clear() {
    this.db.records = [];
  }

  async delete() {
    await fs.unlink(this.dbname);
  }

  async flush() {
    await fs.writeFile(this.dbname, JSON.stringify(this.db), `utf-8`);
  }
}

if (false)
  (async function test() {
    const cname = `testconfig`;
    const file = new DataFile(cname);
    console.log(`waiting for file ready`);
    await file.ready();

    console.log(`saving data to file`);
    const record = {
      title: `title image`,
      filepath: `cake/somewhere/moo.png`,
      url: `https://example.com/hpo3fg.png`,
    };
    await file.save(...Object.values(record));

    let data;

    console.log(`running single get`);
    data = await file.get({
      title: `title image`,
      url: `https://example.com/hpo3fg.png`,
    });
    console.log(`found record: ${!!data}`);
    console.log(`  title correct:`, data.title === record.title);
    console.log(`  filepath correct:`, data.filepath === record.filepath);
    console.log(`  url correct:`, data.url === record.url);

    console.log(`reading data back out`);
    data = await file.getAll();
    console.log(`found ${data.length} item${data.length === 1 ? `` : `s`}`);

    console.log(`clearing data`);
    await file.clear();

    console.log(`reading data back out`);
    data = await file.getAll();
    console.log(`found ${data.length} item${data.length === 1 ? `` : `s`}`);

    console.log(`deleting the file`);
    await file.delete();
  })();

module.exports = DataFile;
