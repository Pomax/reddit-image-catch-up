const fs = require("fs/promises");
const Database = require("better-sqlite3");
const tableName = `imagedata`;

class DataFile {
  constructor(name = tableName) {
    this.dbname = `./${name}.db`;
    this.db = new Database(this.dbname);
  }

  async ready() {
    return this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS ${tableName} (id INTEGER PRIMARY KEY, title TEXT NOT NULL, filepath TEXT NOT NULL, url TEXT NOT NULL)`
      )
      .run();
  }

  async save(title = ``, filepath, url) {
    if (!filepath || !url) {
      throw new Error(
        `could not save record:\n\ttitle=${title}\n\tfilepath=${filepath}\n\turl=${url}`
      );
    }

    return this.db
      .prepare(`INSERT INTO imagedata (title, filepath, url) VALUES (?,?,?)`)
      .run([title, filepath, url]);
  }

  async get(where) {
    const keys = Object.keys(where);
    const values = Object.values(where);
    return this.db
      .prepare(
        `SELECT * FROM imagedata WHERE ${keys
          .map((k) => `${k}=?`)
          .join(` AND `)}`
      )
      .get(...values);
  }

  async getAll() {
    return this.db.prepare(`SELECT * from imagedata`).all();
  }

  async clear() {
    return this.db.prepare(`DELETE from imagedata`).run();
  }

  delete() {
    const filepath = this.dbname;
    return new Promise((resolve, reject) => {
      let tries = 0;

      const deleteDB = async () => {
        if (tries > 10)
          return reject(new Error(`Could not delete ${filepath}`));
        if (this.db) {
          try {
            await this.db.close();
          } catch (e) {
            return reject(e);
          }
        }
        this.db = false;
        try {
          tries++;
          await fs.unlink(filepath);
          resolve();
        } catch (e) {
          setTimeout(deleteDB, 100);
        }
      };

      deleteDB();
    });
  }

  async flush() {
    return; // you don't manually flush to a sqlite3 databases
  }
}

if (false)
  (async function test() {
    const cname = `testconfig`;
    const file = new DataFile(cname);
    console.log(`waiting for file ready`);
    await file.ready();

    console.log(`saving data to file`);
    await file.save(
      `title image`,
      `cake/somewhere/moo.png`,
      `https://example.com/hpo3fg.png`
    );

    let data;

    console.log(`running single get`);
    data = await file.get({
      title: `title image`,
      url: `https://example.com/hpo3fg.png`,
    });
    console.log(`found record: ${!!data}`);

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
